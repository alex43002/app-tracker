from pymongo.collection import Collection

def get_job_status_counts(jobs: Collection, user_id: str) -> dict:
    pipeline = [
        {"$match": {"userId": user_id}},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
            }
        },
    ]

    results = jobs.aggregate(pipeline)

    counts = {
        "applied": 0,
        "interviewing": 0,
        "offer": 0,
        "rejected": 0,
        "total": 0,
    }

    total = 0

    for row in results:
        status = row["_id"]
        count = row["count"]
        total += count

        if status in counts:
            counts[status] = count

    counts["total"] = total
    return counts