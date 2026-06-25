from datetime import datetime, timezone

from passlib.context import CryptContext

# Argon2 is stable, modern, and Windows-safe
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


# ---------------------------------------------------------------------------
# Refresh-token revocation (SEC-4)
#
# A refresh token's `jti` is stored here once it has been used (rotation) or
# explicitly logged out. A TTL index on `expiresAt` (see ensure_indexes) lets
# Mongo purge entries after the token would have expired anyway.
# ---------------------------------------------------------------------------

def revoke_refresh_jti(db, jti: str, expires_at: datetime) -> None:
    db.revoked_tokens.update_one(
        {"jti": jti},
        {"$set": {"jti": jti, "expiresAt": expires_at}},
        upsert=True,
    )


def is_refresh_jti_revoked(db, jti: str) -> bool:
    return db.revoked_tokens.find_one({"jti": jti}, {"_id": 1}) is not None


def exp_to_datetime(exp: int) -> datetime:
    return datetime.fromtimestamp(exp, tz=timezone.utc)
