from fastapi import HTTPException, status
from typing import Optional

from app.common.responses import failure


def raise_error(
    *,
    code: str,
    message: str,
    http_status: int = status.HTTP_400_BAD_REQUEST,
) -> None:
    """
    Raise a standardized HTTPException using the locked error envelope.
    """
    raise HTTPException(
        status_code=http_status,
        detail=failure(code=code, message=message),
    )
