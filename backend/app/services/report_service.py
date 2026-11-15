from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any

from app.redis_client import redis_client


REPORT_STREAM = "campuscare:reports"
STUDENT_REPORTS_INDEX_PREFIX = "campuscare:student:reports:"
PROCESSED_REPORT_KEY_PREFIX = "campuscare:processed_report:"
INCIDENT_KEY_PREFIX = "campuscare:incident:"
REPORT_KEY_PREFIX = "campuscare:report:"


def _decode_dict(d: Dict[Any, Any]) -> Dict[str, Any]:
    return {
        (k.decode() if isinstance(k, bytes) else k): (
            v.decode() if isinstance(v, bytes) else v
        )
        for k, v in d.items()
    }


async def create_report(
    student_id: str,
    title: str,
    description: str,
    category: str,
    location: str,
    equipment_id: Optional[str] = None,
    client=None,
):
    """
    Creates a student report atomically using a Redis pipeline transaction:
    1. Stores the report hash.
    2. Adds the report reference to the student's index.
    3. Appends the report payload to the Redis Stream.
    """
    r = client or redis_client
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

    report_hash_key = f"{REPORT_KEY_PREFIX}{report_id}"
    student_index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}"

    pipe = r.pipeline(transaction=True)
    pipe.hset(report_hash_key, mapping=report_data)
    pipe.sadd(student_index_key, report_id)
    pipe.xadd(REPORT_STREAM, report_data)
    exec_results = await pipe.execute()

    stream_id = exec_results[2]
    if isinstance(stream_id, bytes):
        stream_id = stream_id.decode()

    return {
        "report": report_data,
        "stream_id": stream_id,
    }


async def get_reports(client=None):
    """
    Returns all reports in stream order, enriched from their Redis hashes.

    The Redis Stream contains the original submission fields, while later
    updates such as image_url are stored on the report hash. Reading only
    XRANGE therefore omits uploaded photographs. Fetch each report by ID so
    the admin API receives the current hash fields and lifecycle information.
    """
    r = client or redis_client
    entries = await r.xrange(REPORT_STREAM)

    reports = []
    for stream_id, raw_data in entries:
        decoded_stream_id = (
            stream_id.decode() if isinstance(stream_id, bytes) else stream_id
        )
        stream_report = _decode_dict(dict(raw_data))
        report_id = stream_report.get("report_id")

        if report_id:
            report = await get_report_by_id(report_id, client=r)
            if report:
                # Preserve the stream entry ID in the admin response.
                report["stream_id"] = decoded_stream_id
                reports.append(report)
                continue

        # Keep malformed/legacy stream entries visible rather than dropping them.
        stream_report["stream_id"] = decoded_stream_id
        reports.append(stream_report)

    return reports


async def get_report_by_id(
    report_id: str,
    client=None,
) -> Optional[Dict[str, Any]]:
    """
    Retrieves an individual report by ID, enriched with its live processing
    status and linked incident details.
    """
    r = client or redis_client

    report_hash_key = f"{REPORT_KEY_PREFIX}{report_id}"
    raw_hash = await r.hgetall(report_hash_key)

    report_data = None
    stream_id = None

    if raw_hash:
        report_data = _decode_dict(raw_hash)
    else:
        # Fallback for older reports that exist in the stream but not as hashes.
        stream_entries = await r.xrange(REPORT_STREAM)
        for s_id, raw_entry in stream_entries:
            decoded_entry = _decode_dict(dict(raw_entry))
            if decoded_entry.get("report_id") == report_id:
                report_data = decoded_entry
                stream_id = s_id.decode() if isinstance(s_id, bytes) else s_id

                student_id = report_data.get("student_id")
                if student_id:
                    await r.hset(report_hash_key, mapping=report_data)
                    await r.sadd(
                        f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}",
                        report_id,
                    )
                break

    if not report_data:
        return None

    processed_key = f"{PROCESSED_REPORT_KEY_PREFIX}{report_id}"
    processed_val = await r.get(processed_key)
    if isinstance(processed_val, bytes):
        processed_val = processed_val.decode()

    lifecycle_status = "QUEUED"
    linked_incident_id = None
    linked_incident = None

    if processed_val:
        if processed_val.startswith("PROCESSING:"):
            lifecycle_status = "PROCESSING"
        else:
            lifecycle_status = "PROCESSED"
            linked_incident_id = processed_val
            incident_key = f"{INCIDENT_KEY_PREFIX}{linked_incident_id}"
            incident_raw = await r.hgetall(incident_key)
            if incident_raw:
                linked_incident = _decode_dict(incident_raw)

    report_data["lifecycle_status"] = lifecycle_status
    report_data["incident_id"] = linked_incident_id
    report_data["incident"] = linked_incident

    if stream_id:
        report_data["stream_id"] = stream_id

    return report_data


async def get_student_reports(
    student_id: str,
    client=None,
) -> List[Dict[str, Any]]:
    """
    Retrieves all reports submitted by a specific student using the student
    index and enriches each report with its current hash fields.
    """
    r = client or redis_client
    student_index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}"

    raw_report_ids = await r.smembers(student_index_key)
    report_ids = [
        rid.decode() if isinstance(rid, bytes) else rid
        for rid in raw_report_ids
    ]

    if not report_ids:
        stream_entries = await r.xrange(REPORT_STREAM)
        for _, raw_entry in stream_entries:
            decoded = _decode_dict(dict(raw_entry))
            if (
                decoded.get("student_id") == student_id
                and decoded.get("report_id")
            ):
                report_id = decoded["report_id"]
                report_ids.append(report_id)
                await r.sadd(student_index_key, report_id)
                await r.hset(
                    f"{REPORT_KEY_PREFIX}{report_id}",
                    mapping=decoded,
                )

    reports = []
    for report_id in report_ids:
        report = await get_report_by_id(report_id, client=r)
        if report:
            reports.append(report)

    reports.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return reports


async def attach_report_image(
    report_id: str,
    image_url: str,
    client=None,
):
    """
    Attaches an uploaded image URL to an existing report hash.
    """
    r = client or redis_client
    report_key = f"{REPORT_KEY_PREFIX}{report_id}"

    exists = await r.exists(report_key)
    if not exists:
        return False

    await r.hset(report_key, mapping={"image_url": image_url})
    return True
