from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Request, status

from app.config import settings
from app.database import get_db
from app.common.responses import success
from app.common.errors import raise_error
from app.common.auth import (
    REFRESH_TOKEN,
    create_access_token,
    create_refresh_token,
    decode_jwt,
)
from app.common.ratelimit import limiter
from app.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    LogoutRequest,
)
from app.auth import service
from app.auth.service import hash_password, verify_password

router = APIRouter()


def _issue_session(user_id: str, email: str) -> dict:
    """Build the access + refresh token pair returned by login/register."""
    access = create_access_token(user_id=user_id, email=email)
    refresh = create_refresh_token(user_id=user_id, email=email)
    return {
        "jwt": access["jwt"],
        "expiresAt": access["expiresAt"],
        "refreshToken": refresh["token"],
        "refreshExpiresAt": refresh["expiresAt"],
    }


@router.post("/register")
@limiter.limit(settings.auth_rate_limit)
def register(request: Request, payload: RegisterRequest):
    db = get_db()
    users = db.users

    # Enforce unique email
    if users.find_one({"email": payload.email}):
        raise_error(
            code="RESOURCE_ALREADY_EXISTS",
            message="Email already registered",
            http_status=status.HTTP_409_CONFLICT,
        )

    now = datetime.now(tz=timezone.utc)

    user_doc = {
        "email": payload.email,
        "passwordHash": hash_password(payload.password),
        "phoneNumber": payload.phoneNumber,
        "firstName": payload.firstName,
        "lastName": payload.lastName,
        "pfp": payload.pfp,
        "createdAt": now,
        "updatedAt": now,
    }

    result = users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    return success(
        data={
            "user": {
                "id": user_id,
                "email": payload.email,
                "phoneNumber": payload.phoneNumber,
                "firstName": payload.firstName,
                "lastName": payload.lastName,
                "pfp": payload.pfp,
                "createdAt": now,
                "updatedAt": now,
            },
            **_issue_session(user_id, payload.email),
        }
    )


@router.post("/login")
@limiter.limit(settings.auth_rate_limit)
def login(request: Request, payload: LoginRequest):
    db = get_db()
    users = db.users

    user = users.find_one({"email": payload.email})
    if not user:
        raise_error(
            code="AUTH_INVALID_CREDENTIALS",
            message="Invalid email or password",
            http_status=status.HTTP_401_UNAUTHORIZED,
        )

    if not verify_password(payload.password, user["passwordHash"]):
        raise_error(
            code="AUTH_INVALID_CREDENTIALS",
            message="Invalid email or password",
            http_status=status.HTTP_401_UNAUTHORIZED,
        )

    user_id = str(user["_id"])

    return success(
        data={
            "user": {
                "id": user_id,
                "email": user["email"],
                "phoneNumber": user["phoneNumber"],
                "firstName": user["firstName"],
                "lastName": user["lastName"],
                "pfp": user["pfp"],
                "createdAt": user["createdAt"],
                "updatedAt": user["updatedAt"],
            },
            **_issue_session(user_id, user["email"]),
        }
    )


@router.post("/refresh")
def refresh(payload: RefreshRequest):
    db = get_db()
    claims = decode_jwt(payload.refreshToken, expected_type=REFRESH_TOKEN)

    user_id = claims["sub"]
    jti = claims.get("jti")

    # Reject replayed / already-rotated refresh tokens.
    if not jti or service.is_refresh_jti_revoked(db, jti):
        raise_error(
            code="AUTH_TOKEN_INVALID",
            message="Refresh token is no longer valid",
            http_status=status.HTTP_401_UNAUTHORIZED,
        )

    # The owning user must still exist.
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise_error(
            code="AUTH_TOKEN_INVALID",
            message="Invalid token subject",
            http_status=status.HTTP_401_UNAUTHORIZED,
        )

    if not db.users.find_one({"_id": object_id}, {"_id": 1}):
        raise_error(
            code="AUTH_TOKEN_INVALID",
            message="User no longer exists",
            http_status=status.HTTP_401_UNAUTHORIZED,
        )

    # Rotate: revoke the presented refresh token, then issue a fresh pair.
    service.revoke_refresh_jti(db, jti, service.exp_to_datetime(claims["exp"]))

    return success(data=_issue_session(user_id, claims["email"]))


@router.post("/logout")
def logout(payload: LogoutRequest):
    db = get_db()
    # Best-effort: decode and revoke if it's a valid refresh token. Logout must
    # not fail loudly for an already-invalid token.
    try:
        claims = decode_jwt(payload.refreshToken, expected_type=REFRESH_TOKEN)
        jti = claims.get("jti")
        if jti:
            service.revoke_refresh_jti(db, jti, service.exp_to_datetime(claims["exp"]))
    except Exception:
        pass

    return success(data=None)
