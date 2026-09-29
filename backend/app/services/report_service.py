from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional

from app.redis_client import redis_client


REPORT_STREAM = "campuscare:reports"


async def create_report(
    student_id: str,
    title: str,
    description: str,
    category: str,
    location: str,
    equipment_id: Optional[str] = None,
):
    """
    Creates a student report and adds it to a Redis Stream.
    """

    report_id = f"REP-{uuid4().hex[:8].upper()}"

    created_at = datetime.now(timezone.utc).isoformat()

    report_data = {
        "report_id": report_id,
        "student_id": student_id,
        "title": title,
        "description": description,
        "category": category,
        "location": location,
        "equipment_id": equipment_id or "",
        "status": "OPEN",
        "created_at": created_at,
    }

    # Add report to Redis Stream
    stream_id = await redis_client.xadd(
        REPORT_STREAM,
        report_data,
    )

    return {
        "report": report_data,
        "stream_id": stream_id,
    }


async def get_reports():
    """
    Reads all reports from the Redis Stream.
    """

    entries = await redis_client.xrange(REPORT_STREAM)

    reports = []

    for stream_id, data in entries:
        report = dict(data)

        report["stream_id"] = stream_id

        reports.append(report)

    return reports