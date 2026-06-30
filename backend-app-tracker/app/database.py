from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings

_client: MongoClient | None = None
_db: Database | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri)
    return _client


def get_db() -> Database:
    global _db
    if _db is None:
        client = get_client()
        _db = client[settings.mongodb_db_name]
    return _db


def ensure_indexes(db: Database) -> None:
    """Create the indexes documented in MONGO_SCHEMA.MD.

    Idempotent — safe to call on every startup.
    """
    db.users.create_index("email", unique=True)

    db.jobs.create_index("userId")
    db.jobs.create_index("status")
    db.jobs.create_index("employmentType")
    db.jobs.create_index([("createdAt", -1)])

    db.alerts.create_index("userId")
    db.alerts.create_index("scheduledAlert")

    # Saved searches (FEAT-11) — listed per user.
    db.saved_searches.create_index("userId")

    # Discovered jobs (FEAT-22) — shared, public postings deduped per ATS by
    # (source, sourceId); indexed for the common filters/sorts.
    # Posting ids are unique per board, not globally, so the dedupe key includes
    # the board token.
    db.discovered_jobs.create_index(
        [("source", 1), ("boardToken", 1), ("sourceId", 1)], unique=True
    )
    db.discovered_jobs.create_index([("postedAt", -1)])
    db.discovered_jobs.create_index("company")
    db.discovered_jobs.create_index("employmentType")

    # Per-user company preferences (FEAT-22) — one document per user.
    db.user_preferences.create_index("userId", unique=True)

    # Saved discovery searches / job alerts (FEAT-22) — listed per user, and the
    # scheduler scans notify-enabled ones.
    db.job_alerts.create_index("userId")
    db.job_alerts.create_index("notify")

    # Revoked refresh tokens — TTL purges entries once expired.
    db.revoked_tokens.create_index("jti", unique=True)
    db.revoked_tokens.create_index("expiresAt", expireAfterSeconds=0)

    # Single-use auth tokens (password reset / email verification) — looked up by
    # hash, TTL purges entries once expired.
    db.auth_tokens.create_index("tokenHash", unique=True)
    db.auth_tokens.create_index("expiresAt", expireAfterSeconds=0)
