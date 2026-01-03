from datetime import datetime, timezone

from fastapi import APIRouter, status

from app.database import get_db
from app.common.responses import success
from app.common.errors import raise_error
from app.common.auth import create_jwt, decode_jwt
from app.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
)
from app.auth.service import hash_password, verify_password

router = APIRouter()


@router.post("/register")
def register(payload: RegisterRequest):
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

    token_data = create_jwt(
        user_id=user_id,
        email=payload.email,
    )

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
            "jwt": token_data["jwt"],
            "expiresAt": token_data["expiresAt"],
        }
    )


@router.post("/login")
def login(payload: LoginRequest):
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
    token_data = create_jwt(
        user_id=user_id,
        email=user["email"],
    )

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
            "jwt": token_data["jwt"],
            "expiresAt": token_data["expiresAt"],
        }
    )


@router.post("/refresh")
def refresh(payload: RefreshRequest):
    payload_data = decode_jwt(payload.jwt)

    token_data = create_jwt(
        user_id=payload_data["sub"],
        email=payload_data["email"],
    )

    return success(
        data={
            "jwt": token_data["jwt"],
            "expiresAt": token_data["expiresAt"],
        }
    )
