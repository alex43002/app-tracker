from typing import Any, Optional, Dict


def success(data: Optional[Any] = None) -> Dict[str, Any]:
    """
    Standard success response envelope.
    """
    return {
        "success": True,
        "data": data,
        "error": None,
    }


def failure(code: str, message: str) -> Dict[str, Any]:
    """
    Standard error response envelope.
    """
    return {
        "success": False,
        "data": None,
        "error": {
            "code": code,
            "message": message,
        },
    }
