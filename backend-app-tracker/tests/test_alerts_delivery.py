from datetime import datetime, timedelta, timezone

from app.alerts.service import process_due_alerts


class CollectingNotifier:
    def __init__(self):
        self.sent = []

    def send(self, channel, recipient, message):
        self.sent.append((channel, recipient, message))


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    data = res.json()["data"]
    return data["jwt"], data["user"]["id"]


def _create_alert(client, jwt, scheduled, channel="email", message="ping"):
    res = client.post(
        "/api/alerts",
        headers={"Authorization": f"Bearer {jwt}"},
        json={
            "scheduledAlert": scheduled.isoformat(),
            "smsOrEmail": channel,
            "message": message,
        },
    )
    assert res.status_code == 200
    return res.json()["data"]["id"]


def test_due_alert_is_delivered_once(client, db, auth_payload):
    """FEAT-4: a due alert is delivered and not re-delivered."""
    jwt, _ = _register(client, auth_payload, "deliver@example.com")
    past = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    _create_alert(client, jwt, past, channel="email", message="Follow up")

    notifier = CollectingNotifier()
    now = datetime.now(tz=timezone.utc)

    sent = process_due_alerts(db, notifier, now)
    assert sent == 1
    assert notifier.sent == [("email", "deliver@example.com", "Follow up")]

    # Running again does not re-deliver.
    assert process_due_alerts(db, CollectingNotifier(), now) == 0


def test_future_alert_is_not_delivered(client, db, auth_payload):
    jwt, _ = _register(client, auth_payload, "future@example.com")
    future = datetime.now(tz=timezone.utc) + timedelta(days=1)
    _create_alert(client, jwt, future)

    notifier = CollectingNotifier()
    assert process_due_alerts(db, notifier, datetime.now(tz=timezone.utc)) == 0
    assert notifier.sent == []


def test_sms_alert_uses_phone_number(client, db, auth_payload):
    jwt, _ = _register(client, auth_payload, "sms@example.com")
    past = datetime.now(tz=timezone.utc) - timedelta(minutes=1)
    _create_alert(client, jwt, past, channel="sms", message="call recruiter")

    notifier = CollectingNotifier()
    process_due_alerts(db, notifier, datetime.now(tz=timezone.utc))

    assert notifier.sent[0][0] == "sms"
    # auth_payload phoneNumber is "1234567890"
    assert notifier.sent[0][1] == "1234567890"


def test_concurrent_worker_does_not_double_deliver(client, db, auth_payload):
    """FEAT-12: an alert claimed by one worker isn't delivered by another.

    The notifier re-enters ``process_due_alerts`` mid-send (standing in for a
    second scheduler instance). Because the alert is claimed *before* delivery,
    the re-entrant pass finds nothing due and delivers nothing.
    """
    jwt, _ = _register(client, auth_payload, "concurrent@example.com")
    past = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    _create_alert(client, jwt, past, message="only once")

    reentrant_counts = []

    class ReentrantNotifier(CollectingNotifier):
        def send(self, channel, recipient, message):
            # Simulate a second worker polling while we hold the claim.
            reentrant_counts.append(
                process_due_alerts(db, CollectingNotifier(), datetime.now(tz=timezone.utc))
            )
            super().send(channel, recipient, message)

    notifier = ReentrantNotifier()
    assert process_due_alerts(db, notifier, datetime.now(tz=timezone.utc)) == 1
    assert len(notifier.sent) == 1
    # The "other worker" saw the alert already claimed and delivered nothing.
    assert reentrant_counts == [0]


def test_failed_delivery_is_retried(client, db, auth_payload):
    """FEAT-12: a claim is released when delivery fails, so it retries later."""
    jwt, _ = _register(client, auth_payload, "retry@example.com")
    past = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    _create_alert(client, jwt, past, message="will fail first")

    class FlakyNotifier:
        def __init__(self):
            self.calls = 0

        def send(self, channel, recipient, message):
            self.calls += 1
            raise RuntimeError("smtp down")

    flaky = FlakyNotifier()
    assert process_due_alerts(db, flaky, datetime.now(tz=timezone.utc)) == 0
    assert flaky.calls == 1

    # The claim was released, so a healthy worker delivers it on the next pass.
    notifier = CollectingNotifier()
    assert process_due_alerts(db, notifier, datetime.now(tz=timezone.utc)) == 1
    assert notifier.sent == [("email", "retry@example.com", "will fail first")]


def test_rescheduling_allows_redelivery(client, db, auth_payload):
    """An alert rescheduled to a new (past) time after firing fires again."""
    jwt, _ = _register(client, auth_payload, "resched@example.com")
    t0 = datetime.now(tz=timezone.utc) - timedelta(hours=2)
    alert_id = _create_alert(client, jwt, t0, message="first")

    first_now = datetime.now(tz=timezone.utc) - timedelta(hours=1)
    assert process_due_alerts(db, CollectingNotifier(), first_now) == 1

    # Reschedule to a time after the last delivery but still in the past.
    client.put(
        f"/api/alerts/{alert_id}",
        headers={"Authorization": f"Bearer {jwt}"},
        json={
            "scheduledAlert": (
                datetime.now(tz=timezone.utc) - timedelta(minutes=1)
            ).isoformat()
        },
    )

    notifier = CollectingNotifier()
    assert process_due_alerts(db, notifier, datetime.now(tz=timezone.utc)) == 1
    assert len(notifier.sent) == 1
