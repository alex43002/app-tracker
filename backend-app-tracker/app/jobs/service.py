from datetime import datetime, timezone
from bson import ObjectId

from pymongo.collection import Collection
from gridfs import GridFS

from app.common.errors import raise_error
from app.common.query import parse_filters, paginate
from fastapi import status

# Fields a client is allowed to filter / sort jobs by.
JOB_FILTERABLE_FIELDS = ("status", "employmentType", "company", "location")
JOB_SORTABLE_FIELDS = ("createdAt", "updatedAt", "company", "jobTitle", "status")

# Résumé upload constraints.
ALLOWED_RESUME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


def read_validated_resume(upload) -> bytes:
    """Validate an uploaded résumé's type/size and return its bytes."""
    if upload.content_type not in ALLOWED_RESUME_TYPES:
        raise_error(
            code="VALIDATION_ERROR",
            message="Unsupported resume file type",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    data = upload.file.read()
    if len(data) > MAX_RESUME_BYTES:
        raise_error(
            code="VALIDATION_ERROR",
            message="Resume exceeds the 5MB size limit",
            http_status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )
    return data


def _serialize_job(job: dict) -> dict:
    job["id"] = str(job["_id"])
    del job["_id"]
    return job


def create_job(jobs: Collection, payload, user_id: str):
    now = datetime.now(tz=timezone.utc)

    job_doc = {
        "userId": user_id,
        "jobId": payload.jobId,
        "url": str(payload.url),
        "jobTitle": payload.jobTitle,
        "company": payload.company,
        "salaryTarget": payload.salaryTarget,
        "salaryRange": payload.salaryRange,
        "status": payload.status,
        "resume": payload.resume,
        "location": payload.location,
        "employmentType": payload.employmentType,
        "notes": payload.notes,
        "createdAt": now,
        "updatedAt": now,
    }

    result = jobs.insert_one(job_doc)

    return {
        "id": str(result.inserted_id),
        "createdAt": now,
        "updatedAt": now,
    }


def list_jobs(
    jobs: Collection,
    user_id: str,
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
    filters: str | None,
):
    mongo_filters = parse_filters(filters, user_id, JOB_FILTERABLE_FIELDS)

    return paginate(
        jobs,
        mongo_filters,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        serializer=_serialize_job,
        sortable_fields=JOB_SORTABLE_FIELDS,
    )


def update_job(jobs: Collection, job_id: str, user_id: str, payload):
    update_fields = {
        k: (str(v) if k == "url" else v)
        for k, v in payload.model_dump().items()
        if v is not None
    }

    if not update_fields:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields["updatedAt"] = datetime.now(tz=timezone.utc)

    result = jobs.update_one(
        {"_id": ObjectId(job_id), "userId": user_id},
        {"$set": update_fields},
    )

    if result.matched_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    return {"updatedAt": update_fields["updatedAt"]}


def delete_job(jobs: Collection, job_id: str, user_id: str):
    job = jobs.find_one(
        {"_id": ObjectId(job_id), "userId": user_id}
    )

    if not job:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    resume_id = job.get("resume")
    if resume_id:
        fs = GridFS(jobs.database)
        fs.delete(ObjectId(resume_id))

    jobs.delete_one(
        {"_id": ObjectId(job_id), "userId": user_id}
    )


#Helper functions

def is_valid_object_id(value: str) -> bool:
    try:
        ObjectId(value)
        return True
    except Exception:
        return False