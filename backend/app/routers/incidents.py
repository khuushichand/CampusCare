from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from app.redis_client import redis_client


router = APIRouter(
    prefix="/api/incidents",
    tags=["Incidents"],
)


INCIDENT_KEY_PREFIX = "campuscare:incident:"


# ==================================================
# CREATE INCIDENT
# ==================================================

@router.post("")
async def create_incident(
    report_id: str,
    equipment_id: str,
    title: str,
    description: str,
    location: str,
    severity: str = "MEDIUM",
):
    """
    Create a new incident.

    Incidents are stored as Redis Hashes.
    """

    severity = severity.upper()

    allowed_severities = {
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
    }

    if severity not in allowed_severities:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid severity",
                "allowed_severities": sorted(allowed_severities),
            },
        )

    incident_id = f"INC-{uuid4().hex[:8].upper()}"

    key = f"{INCIDENT_KEY_PREFIX}{incident_id}"

    incident = {
        "incident_id": incident_id,
        "report_id": report_id,
        "equipment_id": equipment_id,
        "title": title,
        "description": description,
        "location": location,
        "severity": severity,
        "status": "OPEN",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await redis_client.hset(
        key,
        mapping=incident,
    )

    return {
        "message": "Incident created successfully",
        "incident": incident,
    }


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

    exists = await redis_client.exists(key)

    if not exists:
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

    await redis_client.hset(
        key,
        mapping={
            "status": status,
        },
    )

    incident = await redis_client.hgetall(key)

    return {
        "message": "Incident status updated successfully",
        "incident": incident,
    }