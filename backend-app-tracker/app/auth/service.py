import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
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


# A throwaway hash used to equalize response timing on code paths that would
# otherwise skip the (deliberately slow) Argon2 work — e.g. registering an
# already-taken email or logging in as a non-existent user. Verifying against it
# costs roughly the same as hashing/verifying a real password, so an attacker
# can't distinguish "email exists" from "email is free" by latency (SEC-10).
# Computed lazily so importing this module stays cheap.
_DUMMY_HASH: str | None = None


def equalize_password_timing(password: str) -> None:
    """Spend ~one Argon2 verify so callers don't leak account existence by timing."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("careerlog-timing-equalizer")
    try:
        verify_password(password, _DUMMY_HASH)
    except Exception:
        pass


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


# ---------------------------------------------------------------------------
# Single-use auth tokens — password reset & email verification (FEAT-6)
#
# Tokens are random and opaque; only their SHA-256 hash is stored, so a leak of
# the `auth_tokens` collection does not expose usable tokens. Each token is
# single-use (claimed atomically) and expires; a TTL index purges stale rows.
# ---------------------------------------------------------------------------

PASSWORD_RESET = "password_reset"
EMAIL_VERIFY = "email_verify"


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue_auth_token(db, user_id, token_type: str, ttl: timedelta) -> str:
    """Create a single-use token of ``token_type`` and return the raw value.

    Only the hash is persisted. Any earlier unused tokens of the same type for
    this user are invalidated so only the most recent one works.
    """
    user_id = str(user_id)
    now = datetime.now(tz=timezone.utc)

    db.auth_tokens.delete_many({"userId": user_id, "type": token_type, "usedAt": None})

    raw = secrets.token_urlsafe(32)
    db.auth_tokens.insert_one(
        {
            "tokenHash": _hash_token(raw),
            "userId": user_id,
            "type": token_type,
            "expiresAt": now + ttl,
            "createdAt": now,
            "usedAt": None,
        }
    )
    return raw


def consume_auth_token(db, raw: str, token_type: str) -> str | None:
    """Atomically claim a valid, unexpired, unused token. Returns its userId."""
    now = datetime.now(tz=timezone.utc)
    doc = db.auth_tokens.find_one_and_update(
        {
            "tokenHash": _hash_token(raw),
            "type": token_type,
            "usedAt": None,
            "expiresAt": {"$gt": now},
        },
        {"$set": {"usedAt": now}},
    )
    return doc["userId"] if doc else None


def set_password(db, user_id: str, new_password: str) -> None:
    """Set a new password hash and revoke every existing session (generation bump)."""
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "passwordHash": hash_password(new_password),
                "updatedAt": datetime.now(tz=timezone.utc),
            },
            "$inc": {"tokenGeneration": 1},
        },
    )


def mark_email_verified(db, user_id: str) -> None:
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"emailVerified": True, "updatedAt": datetime.now(tz=timezone.utc)}},
    )
