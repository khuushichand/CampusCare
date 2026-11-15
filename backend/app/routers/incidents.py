from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from app.auth import require_admin
from app.redis_client import redis_client
from app.services.event_publisher import (
    publish_event,
    EVENT_INCIDENT_UPDATED,
)


router = APIRouter(
    prefix="/api/incidents",
    tags=["Incidents"],
    dependencies=[Depends(require_admin)],
)


INCIDENT_KEY_PREFIX = "campuscare:incident:"
INCIDENT_REPORTS_KEY_PREFIX = "campuscare:incident:reports:"


# ==================================================
# GET ALL INCIDENTS
# ==================================================

@router.get("")
async def get_incidents():
    """
    Get all incidents stored in Redis.
    """

    incidents = []

    async for key in redis_client.scan_iter(
        match=f"{INCIDENT_KEY_PREFIX}*"
    ):
        key_str = key.decode() if isinstance(key, bytes) else key
        if key_str.startswith(INCIDENT_REPORTS_KEY_PREFIX):
            continue

        incident = await redis_client.hgetall(key)

        if incident:
            incidents.append(incident)

    return {
        "count": len(incidents),
        "incidents": incidents,
    }


# ==================================================
# GET INCIDENT BY ID
# ==================================================

@router.get("/{incident_id}")
async def get_incident(incident_id: str):
    """
    Get a specific incident by ID.
    """

    key = f"{INCIDENT_KEY_PREFIX}{incident_id}"

    incident = await redis_client.hgetall(key)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found",
        )

    # Fetch associated report IDs from incident report set
    link_key = f"{INCIDENT_REPORTS_KEY_PREFIX}{incident_id}"
    raw_reports = await redis_client.smembers(link_key)
    report_ids = [
        r.decode() if isinstance(r, bytes) else r
        for r in raw_reports
    ] if raw_reports else []

    incident["reports"] = report_ids

    return {
        "incident": incident,
    }


# ==================================================
# UPDATE INCIDENT STATUS
# ==================================================

@router.patch("/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    status: str,
):
    """
    Update the status of an incident.
    """

    key = f"{INCIDENT_KEY_PREFIX}{incident_id}"

    incident = await redis_client.hgetall(key)

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found",
        )

    allowed_statuses = {
        "OPEN",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
    }

    status = status.upper()

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid incident status",
                "allowed_statuses": sorted(allowed_statuses),
            },
        )

    prev_status = incident.get("status")

    if prev_status != status:
        await redis_client.hset(
            key,
            mapping={
                "status": status,
            },
        )

        incident = await redis_client.hgetall(key)

        # Normalize report_count as integer
        raw_rc = incident.get("report_count")
        try:
            report_count = int(raw_rc) if raw_rc is not None else 1
        except (ValueError, TypeError):
            report_count = 1

        await publish_event(
            event_type=EVENT_INCIDENT_UPDATED,
            entity_id=incident_id,
            data={
                "incident_id": incident_id,
                "update_type": "status_change",
                "previous_status": prev_status,
                "status": status,
                "equipment_id": incident.get("equipment_id", ""),
                "category": incident.get("category", ""),
                "location": incident.get("location", ""),
                "report_count": report_count,
            },
            client=redis_client,
        )
    else:
        incident = await redis_client.hgetall(key)

    return {
        "message": "Incident status updated successfully",
        "incident": incident,
    }