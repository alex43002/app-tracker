from fastapi import APIRouter, Depends, Query, Request, UploadFile
from gridfs import GridFS
from bson import ObjectId

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.common.errors import raise_error
from app.jobs.schemas import (
    CreateJobRequest,
    UpdateJobRequest,
)
from app.jobs import service

router = APIRouter()


@router.post("/")
async def create_job(
    request: Request,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    fs = GridFS(db)

    content_type = request.headers.get("content-type", "")

    # ───────────────
    # Multipart (resume upload)
    # ───────────────
    if content_type.startswith("multipart/"):
        form = await request.form()

        resume: UploadFile | None = form.get("resume")
        resume_id = None

        if isinstance(resume, UploadFile):
            resume_id = str(
                fs.put(
                    resume.file,
                    filename=resume.filename,
                    content_type=resume.content_type,
                    metadata={"userId": current_user_id},
                )
            )

        payload = CreateJobRequest(
            jobId=form.get("jobId"),
            url=form["url"],
            jobTitle=form["jobTitle"],
            company=form["company"],
            salaryTarget=float(form["salaryTarget"]),
            salaryRange=form.get("salaryRange"),
            status=form["status"],
            resume=resume_id,
            location=form["location"],
            employmentType=form["employmentType"],
        )

    # ───────────────
    # JSON (no resume)
    # ───────────────
    else:
        payload = CreateJobRequest(**await request.json())

    result = service.create_job(db.jobs, payload, current_user_id)
    return success(data=result)


@router.get("/")
def get_jobs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    sortBy: str = Query("createdAt"),
    sortOrder: str = Query("asc"),
    filters: str | None = Query(None),
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.list_jobs(
        db.jobs,
        current_user_id,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder,
        filters=filters,
    )
    return success(data=result)


@router.put("/{id}")
async def update_job(
    id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    fs = GridFS(db)

    content_type = request.headers.get("content-type", "")

    # ───────────────
    # Multipart update
    # ───────────────
    if content_type.startswith("multipart/"):
        form = await request.form()
        update_fields: dict = {}

        existing = db.jobs.find_one(
            {"_id": ObjectId(id), "userId": current_user_id}
        )

        if not existing:
            raise_error(
                code="RESOURCE_NOT_FOUND",
                message="Job not found",
                http_status=404,
            )

        resume: UploadFile | None = form.get("resume")

        if isinstance(resume, UploadFile):
            if existing.get("resume"):
                fs.delete(ObjectId(existing["resume"]))

            update_fields["resume"] = str(
                fs.put(
                    resume.file,
                    filename=resume.filename,
                    content_type=resume.content_type,
                    metadata={"userId": current_user_id},
                )
            )

        for key in (
            "jobId",
            "url",
            "jobTitle",
            "company",
            "salaryTarget",
            "salaryRange",
            "status",
            "location",
            "employmentType",
        ):
            if key in form:
                update_fields[key] = (
                    float(form[key]) if key == "salaryTarget" else form[key]
                )

        payload = UpdateJobRequest(**update_fields)
        result = service.update_job(db.jobs, id, current_user_id, payload)
        return success(data=result)

    # ───────────────
    # JSON update
    # ───────────────
    payload = UpdateJobRequest(**await request.json())
    result = service.update_job(db.jobs, id, current_user_id, payload)
    return success(data=result)


@router.delete("/{id}")
def delete_job(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_job(db.jobs, id, current_user_id)
    return success(data=None)
