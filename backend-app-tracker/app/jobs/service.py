from datetime import datetime, timezone
import json
from bson import ObjectId
from pymongo.collection import Collection

from app.common.errors import raise_error
from fastapi import status


def parse_filters(raw_filters: str | None, user_id: str) -> dict:
    base = {"userId": user_id}

    if not raw_filters:
        return base

    try:
        filters = json.loads(raw_filters)
        if not isinstance(filters, dict):
            raise ValueError
    except Exception:
        raise_error(
            code="VALIDATION_ERROR",
            message="Invalid filters format",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    base.update(filters)
    return base


def create_job(jobs: Collection, payload, user_id: str):
    now = datetime.now(tz=timezone.utc)

    job_doc = {
        "userId": user_id,
        "jobId": payload.jobId,
        "url": str(payload.url),
        "jobTitle": payload.jobTitle,
        "company": payload.company,   # NEW
        "salaryTarget": payload.salaryTarget,
        "salaryRange": payload.salaryRange,
        "status": payload.status,
        "resume": payload.resume,
        "location": payload.location,
        "employmentType": payload.employmentType,
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
    mongo_filters = parse_filters(filters, user_id)

    sort_direction = 1 if sort_order == "asc" else -1
    skip = (page - 1) * page_size

    cursor = (
        jobs.find(mongo_filters)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(page_size)
    )

    items = []
    for job in cursor:
        job["id"] = str(job["_id"])
        del job["_id"]
        items.append(job)

    total_items = jobs.count_documents(mongo_filters)
    total_pages = (total_items + page_size - 1) // page_size

    return {
        "items": items,
        "meta": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def update_job(jobs: Collection, job_id: str, user_id: str, payload):
    update_fields = {
        k: (str(v) if k == "url" else v)
        for k, v in payload.dict().items()
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
    result = jobs.delete_one(
        {"_id": ObjectId(job_id), "userId": user_id}
    )

    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
