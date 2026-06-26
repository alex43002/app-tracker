from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.common.auth import get_current_user
from app.resumes import service

router = APIRouter()

@router.get("/{resume_id}")
def get_resume(
    resume_id: str,
    disposition: str = Query("attachment"),
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()

    file = service.get_resume_file(
        db=db,
        resume_id=resume_id,
        user_id=current_user_id,
    )

    # `inline` lets the desktop render the résumé in an in-app preview (FEAT-10);
    # anything else downloads it as an attachment.
    disp = "inline" if disposition == "inline" else "attachment"

    return Response(
        content=file.read(),
        media_type=file.content_type,
        headers={
            "Content-Disposition": f'{disp}; filename="{file.filename}"'
        },
    )
