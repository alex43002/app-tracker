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
