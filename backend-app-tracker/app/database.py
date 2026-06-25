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
