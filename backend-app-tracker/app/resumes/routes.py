from fastapi import APIRouter, Depends, Response

from app.database import get_db
from app.common.auth import get_current_user
from app.resumes import service

router = APIRouter()

@router.get("/{resume_id}")
def get_resume(
    resume_id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()

    file = service.get_resume_file(
        db=db,
        resume_id=resume_id,
        user_id=current_user_id,
    )

    return Response(
        content=file.read(),
        media_type=file.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file.filename}"'
        },
    )
