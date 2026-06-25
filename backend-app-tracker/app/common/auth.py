import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings
from app.database import get_db

ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"

security = HTTPBearer()


def _auth_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "success": False,
            "data": None,
            "error": {"code": "AUTH_TOKEN_INVALID", "message": message},
        },
    )


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, email: str) -> Dict[str, str]:
    """Create a short-lived access token (lifetime = jwt_expiry_hours)."""
    now = datetime.now(tz=timezone.utc)
    expires_at = now + timedelta(hours=settings.jwt_expiry_hours)

    token = _encode(
        {
            "sub": user_id,
            "email": email,
            "type": ACCESS_TOKEN,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "iss": "job-tracker-api",
            "aud": "desktop-client",
            "scope": "user",
        }
    )
    return {"jwt": token, "expiresAt": expires_at.isoformat()}


def create_refresh_token(
    user_id: str, email: str, generation: int = 0
) -> Dict[str, str]:
    """Create a long-lived refresh token (lifetime = refresh_token_expiry_days).

    Carries a unique ``jti`` (for individual revocation/rotation) and the user's
    refresh-token ``gen`` (for family revocation on reuse).
    """
    now = datetime.now(tz=timezone.utc)
    expires_at = now + timedelta(days=settings.refresh_token_expiry_days)
    jti = uuid.uuid4().hex

    token = _encode(
        {
            "sub": user_id,
            "email": email,
            "type": REFRESH_TOKEN,
            "jti": jti,
            "gen": generation,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "iss": "job-tracker-api",
            "aud": "desktop-client",
            "scope": "user",
        }
    )
    return {"token": token, "expiresAt": expires_at.isoformat(), "jti": jti}


def decode_jwt(token: str, expected_type: str | None = None) -> Dict:
    """Decode and validate a JWT, optionally enforcing its ``type`` claim."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience="desktop-client",
            issuer="job-tracker-api",
        )
    except JWTError:
        raise _auth_error("Invalid or expired token")

    if expected_type is not None and payload.get("type") != expected_type:
        raise _auth_error(f"Expected a {expected_type} token")

    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    FastAPI dependency to extract and return the authenticated userId.

    Returns:
        userId (str) derived from JWT `sub`
    """
    token = credentials.credentials
    payload = decode_jwt(token, expected_type=ACCESS_TOKEN)

    user_id = payload.get("sub")
    if not user_id:
        raise _auth_error("Token missing subject")

    # Re-validate that the user still exists — a token for a deleted account
    # must not remain usable until expiry.
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise _auth_error("Invalid token subject")

    if not get_db().users.find_one({"_id": object_id}, {"_id": 1}):
        raise _auth_error("User no longer exists")

    return user_id
