from bson import ObjectId
from bson.errors import InvalidId
from gridfs import GridFS

from app.common.errors import raise_error
from fastapi import status

def get_resume_file(db, resume_id: str, user_id: str):
    fs = GridFS(db)

    try:
        file_id = ObjectId(resume_id)
    except InvalidId:
        raise_error(
            code="INVALID_RESUME_ID",
            message="Invalid resume id",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        file = fs.get(file_id)
    except Exception:
        raise_error(
            code="RESUME_NOT_FOUND",
            message="Resume not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    # Ownership enforcement (same rule as jobs)
    if file.metadata.get("userId") != user_id:
        raise_error(
            code="FORBIDDEN",
            message="Not authorized to access this resume",
            http_status=status.HTTP_403_FORBIDDEN,
        )

    return file
