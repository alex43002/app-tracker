"""Richer analytics (FEAT-7)."""

from datetime import datetime, timezone


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    data = res.json()["data"]
    return data["jwt"], data["user"]["id"]


def _seed(db, user_id, specs):
    """Insert minimal job docs (only the fields analytics reads)."""
    db.jobs.insert_many(
        [
            {
                "userId": user_id,
                "company": s.get("company", "Acme"),
                "status": s["status"],
                "createdAt": s["createdAt"],
                "updatedAt": s.get("updatedAt", s["createdAt"]),
            }
            for s in specs
        ]
    )


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _utc(year, month, day):
    return datetime(year, month, day, tzinfo=timezone.utc)


def test_funnel_rates(client, db, auth_payload):
    jwt, user_id = _register(client, auth_payload, "funnel@example.com")
    _seed(
        db,
        user_id,
        [{"status": "applied", "createdAt": _utc(2026, 1, 1)} for _ in range(4)]
        + [{"status": "interviewing", "createdAt": _utc(2026, 1, 1)} for _ in range(2)]
        + [{"status": "offer", "createdAt": _utc(2026, 1, 1)}]
        + [{"status": "rejected", "createdAt": _utc(2026, 1, 1)} for _ in range(3)],
    )

    res = client.get("/api/analytics/funnel", headers=_headers(jwt))
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["applied"] == 4
    assert data["interviewing"] == 2
    assert data["offer"] == 1
    assert data["rejected"] == 3
    assert data["total"] == 10
    assert data["responseRate"] == 0.6  # (10 - 4) / 10
    assert data["interviewRate"] == 0.3  # (2 + 1) / 10
    assert data["offerRate"] == 0.1  # 1 / 10


def test_funnel_empty_has_zero_rates(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "funnel-empty@example.com")
    data = client.get("/api/analytics/funnel", headers=_headers(jwt)).json()["data"]
    assert data["total"] == 0
    assert data["responseRate"] == 0.0
    assert data["interviewRate"] == 0.0
    assert data["offerRate"] == 0.0


def test_applications_over_time_buckets_by_month(client, db, auth_payload):
    jwt, user_id = _register(client, auth_payload, "overtime@example.com")
    _seed(
        db,
        user_id,
        [
            {"status": "applied", "createdAt": _utc(2026, 5, 3)},
            {"status": "applied", "createdAt": _utc(2026, 6, 10)},
            {"status": "rejected", "createdAt": _utc(2026, 6, 20)},
        ],
    )

    data = client.get(
        "/api/analytics/applications-over-time", headers=_headers(jwt)
    ).json()["data"]

    assert data["interval"] == "month"
    assert data["points"] == [
        {"period": "2026-05", "count": 1},
        {"period": "2026-06", "count": 2},
    ]


def test_time_to_offer_averages_only_offers(client, db, auth_payload):
    jwt, user_id = _register(client, auth_payload, "tto@example.com")
    _seed(
        db,
        user_id,
        [
            # 10 days to offer
            {
                "status": "offer",
                "createdAt": _utc(2026, 1, 1),
                "updatedAt": _utc(2026, 1, 11),
            },
            # 20 days to offer
            {
                "status": "offer",
                "createdAt": _utc(2026, 1, 1),
                "updatedAt": _utc(2026, 1, 21),
            },
            # not an offer -> ignored
            {
                "status": "rejected",
                "createdAt": _utc(2026, 1, 1),
                "updatedAt": _utc(2026, 3, 1),
            },
        ],
    )

    data = client.get("/api/analytics/time-to-offer", headers=_headers(jwt)).json()[
        "data"
    ]
    assert data["offers"] == 2
    assert data["averageDays"] == 15.0
    assert data["medianDays"] == 15.0


def test_time_to_offer_none_when_no_offers(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "tto-none@example.com")
    data = client.get("/api/analytics/time-to-offer", headers=_headers(jwt)).json()[
        "data"
    ]
    assert data == {"offers": 0, "averageDays": None, "medianDays": None}


def test_by_company_sorted_by_total(client, db, auth_payload):
    jwt, user_id = _register(client, auth_payload, "bycompany@example.com")
    _seed(
        db,
        user_id,
        [
            {"company": "BigCo", "status": "applied", "createdAt": _utc(2026, 1, 1)},
            {"company": "BigCo", "status": "interviewing", "createdAt": _utc(2026, 1, 1)},
            {"company": "BigCo", "status": "offer", "createdAt": _utc(2026, 1, 1)},
            {"company": "SmallCo", "status": "rejected", "createdAt": _utc(2026, 1, 1)},
        ],
    )

    data = client.get("/api/analytics/by-company", headers=_headers(jwt)).json()["data"]
    companies = data["companies"]

    assert [c["company"] for c in companies] == ["BigCo", "SmallCo"]
    big = companies[0]
    assert big["total"] == 3
    assert big["applied"] == 1 and big["interviewing"] == 1 and big["offer"] == 1
    assert companies[1]["total"] == 1 and companies[1]["rejected"] == 1


def test_applications_over_time_supports_quarter_interval(client, db, auth_payload):
    """FEAT-13: the bucket interval is parametrizable (week/month/quarter)."""
    jwt, user_id = _register(client, auth_payload, "overtime-q@example.com")
    _seed(
        db,
        user_id,
        [
            {"status": "applied", "createdAt": _utc(2026, 2, 1)},  # Q1
            {"status": "applied", "createdAt": _utc(2026, 3, 1)},  # Q1
            {"status": "applied", "createdAt": _utc(2026, 5, 1)},  # Q2
        ],
    )

    data = client.get(
        "/api/analytics/applications-over-time?interval=quarter", headers=_headers(jwt)
    ).json()["data"]

    assert data["interval"] == "quarter"
    assert data["points"] == [
        {"period": "2026-Q1", "count": 2},
        {"period": "2026-Q2", "count": 1},
    ]


def test_applications_over_time_bad_interval_falls_back_to_month(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "overtime-bad@example.com")
    data = client.get(
        "/api/analytics/applications-over-time?interval=decade", headers=_headers(jwt)
    ).json()["data"]
    assert data["interval"] == "month"


def test_time_to_offer_uses_status_history(client, db, auth_payload):
    """FEAT-13: time-to-offer measures from createdAt to the offer's history
    entry, not the (later) updatedAt."""
    jwt, user_id = _register(client, auth_payload, "tto-history@example.com")
    db.jobs.insert_one(
        {
            "userId": user_id,
            "company": "Acme",
            "status": "offer",
            "createdAt": _utc(2026, 1, 1),
            # updatedAt drifted well past the offer (e.g. a later note edit)…
            "updatedAt": _utc(2026, 6, 1),
            # …but the timeline records the offer landing on day 5.
            "statusHistory": [
                {"status": "applied", "at": _utc(2026, 1, 1)},
                {"status": "offer", "at": _utc(2026, 1, 6)},
            ],
        }
    )

    data = client.get("/api/analytics/time-to-offer", headers=_headers(jwt)).json()[
        "data"
    ]
    assert data["offers"] == 1
    assert data["averageDays"] == 5.0


def test_status_change_appends_history(client, auth_payload):
    """FEAT-13: updating a job's status appends a timeline entry."""
    jwt, _ = _register(client, auth_payload, "history-append@example.com")
    headers = _headers(jwt)

    created = client.post(
        "/api/jobs/",
        headers=headers,
        json={
            "url": "https://example.com/job",
            "jobTitle": "Engineer",
            "company": "Acme",
            "salaryTarget": 100000,
            "status": "applied",
            "location": "Remote",
            "employmentType": "full-time",
        },
    )
    assert created.status_code == 200
    job_id = created.json()["data"]["id"]

    client.put(f"/api/jobs/{job_id}", headers=headers, json={"status": "interviewing"})
    client.put(f"/api/jobs/{job_id}", headers=headers, json={"status": "offer"})
    # A non-status update must not add a history entry.
    client.put(f"/api/jobs/{job_id}", headers=headers, json={"notes": "promising"})

    listing = client.get("/api/jobs/", headers=headers).json()["data"]["items"]
    job = next(j for j in listing if j["id"] == job_id)
    statuses = [h["status"] for h in job["statusHistory"]]
    assert statuses == ["applied", "interviewing", "offer"]


def test_summary_returns_all_metrics(client, db, auth_payload):
    """CLN-13: the combined endpoint returns every headline analytic."""
    jwt, user_id = _register(client, auth_payload, "summary@example.com")
    _seed(
        db,
        user_id,
        [
            {"company": "BigCo", "status": "applied", "createdAt": _utc(2026, 1, 1)},
            {"company": "BigCo", "status": "offer", "createdAt": _utc(2026, 1, 1)},
            {"company": "SmallCo", "status": "rejected", "createdAt": _utc(2026, 2, 1)},
        ],
    )

    data = client.get("/api/analytics/summary", headers=_headers(jwt)).json()["data"]

    assert set(data) == {"funnel", "applicationsOverTime", "timeToOffer", "byCompany"}
    assert data["funnel"]["total"] == 3
    assert data["funnel"]["offer"] == 1
    assert [c["company"] for c in data["byCompany"]["companies"]] == ["BigCo", "SmallCo"]
    assert data["applicationsOverTime"]["interval"] == "month"


def test_analytics_requires_auth(client):
    for path in (
        "/api/analytics/funnel",
        "/api/analytics/applications-over-time",
        "/api/analytics/time-to-offer",
        "/api/analytics/by-company",
        "/api/analytics/summary",
    ):
        assert client.get(path).status_code in (401, 403)
