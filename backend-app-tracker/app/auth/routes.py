from datetime import datetime, timedelta, timezone

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
from app.notifications.notifier import EMAIL, get_notifier
from app.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    LogoutRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    EmailVerificationRequest,
    EmailVerificationConfirm,
)
from app.auth import service
from app.auth.service import (
    EMAIL_VERIFY,
    PASSWORD_RESET,
    hash_password,
    verify_password,
)

router = APIRouter()


def _send_email_verification(db, user: dict) -> None:
    """Issue an email-verification token and deliver it (best-effort)."""
    raw = service.issue_auth_token(
        db,
        user["_id"],
        EMAIL_VERIFY,
        timedelta(hours=settings.email_verification_token_expiry_hours),
    )
    get_notifier().send(
        EMAIL,
        user["email"],
        f"Confirm your CareerLog email with this code: {raw}",
    )


def _issue_session(user_id: str, email: str, generation: int = 0) -> dict:
    """Build the access + refresh token pair returned by login/register."""
    access = create_access_token(user_id=user_id, email=email)
    refresh = create_refresh_token(
        user_id=user_id, email=email, generation=generation
    )
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

    # Enforce unique email. Spend the same Argon2 cost as the create path before
    # responding so the 409 can't be distinguished from a fresh signup by timing
    # alone (SEC-10); the explicit 409 is a deliberate UX tradeoff.
    if users.find_one({"email": payload.email}):
        service.equalize_password_timing(payload.password)
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
        "pfp": None,
        "emailVerified": False,
        "tokenGeneration": 0,
        "createdAt": now,
        "updatedAt": now,
    }

    result = users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    _send_email_verification(db, {"_id": result.inserted_id, "email": payload.email})

    return success(
        data={
            "user": {
                "id": user_id,
                "email": payload.email,
                "phoneNumber": payload.phoneNumber,
                "firstName": payload.firstName,
                "lastName": payload.lastName,
                "pfp": None,
                "emailVerified": False,
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
        # Verify against a dummy hash so a missing account takes the same time as
        # a wrong password — no timing oracle for which emails exist (SEC-10).
        service.equalize_password_timing(payload.password)
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
                "emailVerified": user.get("emailVerified", False),
                "createdAt": user["createdAt"],
                "updatedAt": user["updatedAt"],
            },
            **_issue_session(
                user_id, user["email"], service.user_token_generation(user)
            ),
        }
    )


def _reject_refresh(message: str) -> None:
    raise_error(
        code="AUTH_TOKEN_INVALID",
        message=message,
        http_status=status.HTTP_401_UNAUTHORIZED,
    )


@router.post("/refresh")
def refresh(payload: RefreshRequest):
    db = get_db()
    claims = decode_jwt(payload.refreshToken, expected_type=REFRESH_TOKEN)

    user_id = claims["sub"]
    jti = claims.get("jti")

    if not jti:
        _reject_refresh("Refresh token is no longer valid")

    # The owning user must still exist.
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        _reject_refresh("Invalid token subject")

    user = db.users.find_one({"_id": object_id})
    if not user:
        _reject_refresh("User no longer exists")

    # Reuse detection: a presented token whose jti is already revoked means it was
    # rotated (or logged out) earlier. Treat replay as theft and revoke the whole
    # family (bump generation), forcing every session for this user to re-auth.
    if service.is_refresh_jti_revoked(db, jti):
        service.revoke_user_refresh_family(db, object_id)
        _reject_refresh("Refresh token reuse detected — session revoked")

    # Family revocation: reject tokens from a superseded generation.
    if service.is_refresh_generation_stale(user, claims.get("gen", 0)):
        _reject_refresh("Refresh token has been revoked")

    # Rotate: revoke the presented refresh token, then issue a fresh pair at the
    # user's current generation.
    service.revoke_refresh_jti(db, jti, service.exp_to_datetime(claims["exp"]))

    return success(
        data=_issue_session(
            user_id, claims["email"], service.user_token_generation(user)
        )
    )


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


# ---------------------------------------------------------------------------
# Password reset (FEAT-6)
# ---------------------------------------------------------------------------

@router.post("/password-reset/request")
@limiter.limit(settings.auth_rate_limit)
def request_password_reset(request: Request, payload: PasswordResetRequest):
    """Email a single-use reset token. Always succeeds — the response never
    reveals whether the email is registered (avoids account enumeration)."""
    db = get_db()
    user = db.users.find_one({"email": payload.email})
    if user:
        raw = service.issue_auth_token(
            db,
            user["_id"],
            PASSWORD_RESET,
            timedelta(minutes=settings.password_reset_token_expiry_minutes),
        )
        get_notifier().send(
            EMAIL,
            user["email"],
            f"Reset your CareerLog password with this code: {raw}",
        )

    return success(data=None)


@router.post("/password-reset/confirm")
@limiter.limit(settings.auth_rate_limit)
def confirm_password_reset(request: Request, payload: PasswordResetConfirm):
    db = get_db()
    user_id = service.consume_auth_token(db, payload.token, PASSWORD_RESET)
    if not user_id:
        raise_error(
            code="AUTH_TOKEN_INVALID",
            message="Password reset token is invalid or has expired",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    # Setting a new password revokes every existing session for the account.
    service.set_password(db, user_id, payload.newPassword)
    return success(data=None)


# ---------------------------------------------------------------------------
# Email verification (FEAT-6)
# ---------------------------------------------------------------------------

@router.post("/verify-email/request")
@limiter.limit(settings.auth_rate_limit)
def request_email_verification(request: Request, payload: EmailVerificationRequest):
    """Re-send a verification token. Always succeeds (no enumeration); skips
    accounts that are already verified."""
    db = get_db()
    user = db.users.find_one({"email": payload.email})
    if user and not user.get("emailVerified", False):
        _send_email_verification(db, user)

    return success(data=None)


@router.post("/verify-email/confirm")
@limiter.limit(settings.auth_rate_limit)
def confirm_email_verification(request: Request, payload: EmailVerificationConfirm):
    db = get_db()
    user_id = service.consume_auth_token(db, payload.token, EMAIL_VERIFY)
    if not user_id:
        raise_error(
            code="AUTH_TOKEN_INVALID",
            message="Verification token is invalid or has expired",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    service.mark_email_verified(db, user_id)
    return success(data=None)
