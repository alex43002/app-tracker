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


def user_token_generation(user: dict) -> int:
    """The user's current refresh-token generation (0 for legacy users)."""
    return user.get("tokenGeneration", 0)


def revoke_user_refresh_family(db, user_id) -> None:
    """Invalidate every outstanding refresh token for a user by bumping their
    generation. Used as a theft response when a rotated token is replayed.
    """
    db.users.update_one({"_id": user_id}, {"$inc": {"tokenGeneration": 1}})


def is_refresh_generation_stale(user: dict, generation: int) -> bool:
    """True if the token's generation predates the user's current generation."""
    return generation < user_token_generation(user)


def exp_to_datetime(exp: int) -> datetime:
    return datetime.fromtimestamp(exp, tz=timezone.utc)
