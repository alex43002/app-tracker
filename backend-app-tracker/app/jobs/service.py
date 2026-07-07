import logging
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId

from pymongo.collection import Collection
from gridfs import GridFS

from app.common.errors import raise_error
from app.common.query import parse_filters, paginate
from fastapi import status

logger = logging.getLogger("careerlog.jobs")

# Fields a client is allowed to filter / sort jobs by.
JOB_FILTERABLE_FIELDS = ("status", "employmentType", "company", "location")
# Of those, the free-text fields matched as case-insensitive substrings (FEAT-19)
# rather than exact equality. status/employmentType stay exact (they're enums).
JOB_TEXT_FILTER_FIELDS = ("company", "location")
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
        # Multiple résumés per job (FEAT-10). The legacy single ``resume`` field
        # above is kept for backward compatibility; ``resumes`` is the list of
        # attached résumé metadata managed by the /resumes sub-resource.
        "resumes": [],
        # Per-status timeline (FEAT-13): seeded with the initial status so
        # analytics can measure exact transition timing (e.g. time-to-offer)
        # instead of approximating from updatedAt.
        "statusHistory": [{"status": payload.status, "at": now}],
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
    mongo_filters = parse_filters(
        filters, user_id, JOB_FILTERABLE_FIELDS, JOB_TEXT_FILTER_FIELDS
    )

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

    now = datetime.now(tz=timezone.utc)
    update_fields["updatedAt"] = now

    update_ops: dict = {"$set": update_fields}

    # Append to the status timeline only when the status actually changes
    # (FEAT-13). Requires reading the current status first.
    new_status = update_fields.get("status")
    if new_status is not None:
        existing = jobs.find_one(
            {"_id": ObjectId(job_id), "userId": user_id}, {"status": 1}
        )
        if existing is None:
            raise_error(
                code="RESOURCE_NOT_FOUND",
                message="Job not found",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        if existing.get("status") != new_status:
            update_ops["$push"] = {
                "statusHistory": {"status": new_status, "at": now}
            }

    result = jobs.update_one(
        {"_id": ObjectId(job_id), "userId": user_id},
        update_ops,
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

    # Remove every attached résumé from GridFS: the legacy single field plus all
    # FEAT-10 entries.
    fs = GridFS(jobs.database)
    resume_ids = set()
    legacy = job.get("resume")
    if legacy:
        resume_ids.add(legacy)
    for entry in job.get("resumes") or []:
        if entry.get("id"):
            resume_ids.add(entry["id"])
    for rid in resume_ids:
        if is_valid_object_id(rid):
            try:
                fs.delete(ObjectId(rid))
            except Exception:
                # Best-effort orphan cleanup — a failed GridFS delete must not
                # block deleting the job, but shouldn't vanish silently either.
                logger.debug("Failed to delete résumé file %s", rid, exc_info=True)

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


# ---------------------------------------------------------------------------
# Multiple résumés per job (FEAT-10)
#
# Each job carries a ``resumes`` list of metadata entries; the bytes live in
# GridFS (ownership-stamped, type/size validated) and are downloaded/previewed
# through the existing /api/resumes/{id} endpoint. The legacy single ``resume``
# field is surfaced as a synthesized entry so jobs created before FEAT-10 still
# show their attachment.
# ---------------------------------------------------------------------------

def _owned_job(jobs: Collection, job_id: str, user_id: str) -> dict:
    try:
        object_id = ObjectId(job_id)
    except (InvalidId, TypeError):
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    job = jobs.find_one({"_id": object_id, "userId": user_id})
    if not job:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return job


def _legacy_resume_entry(db, resume_id: str) -> dict | None:
    """Build a résumé metadata entry from a legacy GridFS file id, or None."""
    if not is_valid_object_id(resume_id):
        return None
    fs = GridFS(db)
    try:
        file = fs.get(ObjectId(resume_id))
    except Exception:
        return None
    return {
        "id": resume_id,
        "filename": file.filename,
        "contentType": file.content_type,
        "size": file.length,
        "uploadedAt": file.upload_date,
    }


def list_job_resumes(db, job_id: str, user_id: str) -> dict:
    job = _owned_job(db.jobs, job_id, user_id)
    resumes = list(job.get("resumes") or [])

    legacy = job.get("resume")
    if legacy and not any(r.get("id") == legacy for r in resumes):
        entry = _legacy_resume_entry(db, legacy)
        if entry:
            resumes.insert(0, entry)

    return {"resumes": resumes}


def add_job_resume(db, job_id: str, user_id: str, upload) -> dict:
    job = _owned_job(db.jobs, job_id, user_id)
    data = read_validated_resume(upload)

    fs = GridFS(db)
    file_id = fs.put(
        data,
        filename=upload.filename,
        content_type=upload.content_type,
        metadata={"userId": user_id},
    )

    now = datetime.now(tz=timezone.utc)
    entry = {
        "id": str(file_id),
        "filename": upload.filename,
        "contentType": upload.content_type,
        "size": len(data),
        "uploadedAt": now,
    }

    db.jobs.update_one(
        {"_id": job["_id"], "userId": user_id},
        {"$push": {"resumes": entry}, "$set": {"updatedAt": now}},
    )
    return entry


def delete_job_resume(db, job_id: str, user_id: str, resume_id: str) -> None:
    job = _owned_job(db.jobs, job_id, user_id)

    in_list = any(r.get("id") == resume_id for r in (job.get("resumes") or []))
    is_legacy = job.get("resume") == resume_id
    if not in_list and not is_legacy:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Resume not found on this job",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    if is_valid_object_id(resume_id):
        fs = GridFS(db)
        try:
            fs.delete(ObjectId(resume_id))
        except Exception:
            # Best-effort orphan cleanup; keep going even if the file is gone.
            logger.debug("Failed to delete résumé file %s", resume_id, exc_info=True)

    now = datetime.now(tz=timezone.utc)
    set_fields = {"updatedAt": now}
    if is_legacy:
        set_fields["resume"] = None

    db.jobs.update_one(
        {"_id": job["_id"], "userId": user_id},
        {"$pull": {"resumes": {"id": resume_id}}, "$set": set_fields},
    )
