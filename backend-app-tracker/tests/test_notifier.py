from types import SimpleNamespace

from app.notifications.notifier import (
    EMAIL,
    SMS,
    ConsoleNotifier,
    Notifier,
    RetryingNotifier,
    RoutingNotifier,
    SmtpEmailNotifier,
    TwilioSmsNotifier,
    build_notifier,
)


class _FlakyNotifier(Notifier):
    """Fails the first ``fail_times`` sends, then succeeds."""

    def __init__(self, fail_times):
        self.fail_times = fail_times
        self.attempts = 0

    def send(self, channel, recipient, message):
        self.attempts += 1
        if self.attempts <= self.fail_times:
            raise RuntimeError("transient")


def _settings(**overrides):
    """A minimal settings stub with notifier-relevant fields defaulted off."""
    base = dict(
        smtp_host=None,
        smtp_port=587,
        smtp_user=None,
        smtp_password=None,
        smtp_from="no-reply@careerlog.app",
        twilio_account_sid=None,
        twilio_auth_token=None,
        twilio_from=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_twilio_posts_to_messages_api():
    """FEAT-5: an `sms` alert is POSTed to the Twilio Messages endpoint."""
    calls = []
    notifier = TwilioSmsNotifier(
        account_sid="AC123",
        auth_token="tok",
        sender="+15550000000",
        transport=lambda url, payload: calls.append((url, payload)),
    )

    notifier.send(SMS, "+15551112222", "call recruiter")

    assert len(calls) == 1
    url, payload = calls[0]
    assert url.endswith("/Accounts/AC123/Messages.json")
    assert payload == {
        "To": "+15551112222",
        "From": "+15550000000",
        "Body": "call recruiter",
    }


def test_twilio_falls_back_for_non_sms_channels():
    """Email (or a missing recipient) is handed to the fallback, not Twilio."""
    posted = []
    fallback = ConsoleNotifier()
    sent = []
    fallback.send = lambda c, r, m: sent.append((c, r, m))

    notifier = TwilioSmsNotifier(
        account_sid="AC123",
        auth_token="tok",
        sender="+15550000000",
        fallback=fallback,
        transport=lambda url, payload: posted.append(payload),
    )

    notifier.send(EMAIL, "user@example.com", "hi")
    notifier.send(SMS, None, "no recipient")

    assert posted == []
    assert sent == [(EMAIL, "user@example.com", "hi"), (SMS, None, "no recipient")]


def test_routing_notifier_dispatches_by_channel():
    email_sent, sms_sent, fallback_sent = [], [], []

    class Recorder(ConsoleNotifier):
        def __init__(self, sink):
            self._sink = sink

        def send(self, channel, recipient, message):
            self._sink.append((channel, recipient, message))

    router = RoutingNotifier(
        {EMAIL: Recorder(email_sent), SMS: Recorder(sms_sent)},
        fallback=Recorder(fallback_sent),
    )

    router.send(EMAIL, "user@example.com", "e")
    router.send(SMS, "+1555", "s")
    router.send("push", "device", "p")  # unknown channel -> fallback

    assert email_sent == [(EMAIL, "user@example.com", "e")]
    assert sms_sent == [(SMS, "+1555", "s")]
    assert fallback_sent == [("push", "device", "p")]


def test_retrying_notifier_recovers_after_transient_failures():
    """CLN-12: a flaky provider is retried until it succeeds."""
    slept = []
    inner = _FlakyNotifier(fail_times=2)
    notifier = RetryingNotifier(
        inner, max_attempts=3, backoff_seconds=0.1, sleep=slept.append
    )

    notifier.send(EMAIL, "user@example.com", "hi")

    assert inner.attempts == 3  # failed twice, succeeded on the third
    assert slept == [0.1, 0.2]  # exponential backoff between the three attempts


def test_retrying_notifier_dead_letters_after_exhausting_attempts(caplog):
    """CLN-12: a permanent failure is logged as a dead letter, not raised."""
    inner = _FlakyNotifier(fail_times=99)
    notifier = RetryingNotifier(
        inner, max_attempts=2, backoff_seconds=0, sleep=lambda _s: None
    )

    with caplog.at_level("ERROR"):
        notifier.send(SMS, "+1555", "call recruiter")  # must not raise

    assert inner.attempts == 2
    assert any("DEAD-LETTER" in r.message for r in caplog.records)


def test_build_notifier_wraps_providers_with_retries():
    """CLN-12: configured providers are wrapped in RetryingNotifier."""
    notifier = build_notifier(
        _settings(
            smtp_host="smtp.example.com",
            notifier_max_attempts=3,
        )
    )
    assert isinstance(notifier._routes[EMAIL], RetryingNotifier)


def test_build_notifier_defaults_to_console():
    assert isinstance(build_notifier(_settings()), ConsoleNotifier)


def test_build_notifier_wires_both_providers():
    notifier = build_notifier(
        _settings(
            smtp_host="smtp.example.com",
            twilio_account_sid="AC1",
            twilio_auth_token="tok",
            twilio_from="+15550000000",
        )
    )
    assert isinstance(notifier, RoutingNotifier)
    assert isinstance(notifier._routes[EMAIL], SmtpEmailNotifier)
    assert isinstance(notifier._routes[SMS], TwilioSmsNotifier)


def test_build_notifier_requires_full_twilio_config():
    """Partial Twilio config doesn't register the SMS route."""
    notifier = build_notifier(
        _settings(twilio_account_sid="AC1", twilio_auth_token="tok")  # no from
    )
    assert isinstance(notifier, ConsoleNotifier)
