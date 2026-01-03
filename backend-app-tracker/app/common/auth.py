from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings


security = HTTPBearer()


def create_jwt(user_id: str, email: str) -> Dict[str, str]:
    """
    Create a JWT with a fixed 2-hour lifespan.
    """
    now = datetime.now(tz=timezone.utc)
    expires_at = now + timedelta(hours=settings.jwt_expiry_hours)

    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": "job-tracker-api",
        "aud": "desktop-client",
        "scope": "user",
    }

    token = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    return {
        "jwt": token,
        "expiresAt": expires_at.isoformat(),
    }


def decode_jwt(token: str) -> Dict:
    """
    Decode and validate a JWT.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience="desktop-client",
            issuer="job-tracker-api",
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "AUTH_TOKEN_INVALID",
                    "message": "Invalid or expired token",
                },
            },
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    FastAPI dependency to extract and return the authenticated userId.

    Returns:
        userId (str) derived from JWT `sub`
    """
    token = credentials.credentials
    payload = decode_jwt(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "data": None,
                "error": {
                    "code": "AUTH_TOKEN_INVALID",
                    "message": "Token missing subject",
                },
            },
        )

    return user_id
