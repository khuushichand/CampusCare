from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from uuid import uuid4

from app.redis_client import redis_client
from app.schemas import MaintenanceCreate, MaintenanceStatusUpdate
from app.services.risk_service import calculate_risk_score


router = APIRouter(
    prefix="/api/maintenance",
    tags=["Maintenance"],
)


# --------------------------------------------------
# CREATE MAINTENANCE RECORD
# --------------------------------------------------

@router.post("")
async def create_maintenance(data: MaintenanceCreate):

    maintenance_id = f"MAIN-{uuid4().hex[:8].upper()}"

    created_at = datetime.now(timezone.utc).isoformat()

    maintenance = {
        "maintenance_id": maintenance_id,
        "equipment_id": data.equipment_id,
        "title": data.title,
        "description": data.description,
        "technician": data.technician,
        "scheduled_date": data.scheduled_date,
        "status": data.status,
        "created_at": created_at,
    }

    key = f"campuscare:maintenance:{maintenance_id}"

    await redis_client.hset(
        key,
        mapping=maintenance,
    )

    # Keep an index of maintenance records
    await redis_client.sadd(
        "campuscare:maintenance:index",
        maintenance_id,
    )

    return {
        "message": "Maintenance record created successfully",
        "maintenance": maintenance,
    }


# --------------------------------------------------
# GET ALL MAINTENANCE RECORDS
# --------------------------------------------------

@router.get("")
async def get_maintenance():

    maintenance_ids = await redis_client.smembers(
        "campuscare:maintenance:index"
    )

    maintenance_records = []

    for maintenance_id in maintenance_ids:

        if isinstance(maintenance_id, bytes):
            maintenance_id = maintenance_id.decode()

        key = f"campuscare:maintenance:{maintenance_id}"

        record = await redis_client.hgetall(key)

        if not record:
            continue

        decoded_record = {
            (
                k.decode() if isinstance(k, bytes) else k
            ): (
                v.decode() if isinstance(v, bytes) else v
            )
            for k, v in record.items()
        }

        maintenance_records.append(decoded_record)

    return {
        "count": len(maintenance_records),
        "maintenance": maintenance_records,
    }


# --------------------------------------------------
# GET ONE MAINTENANCE RECORD
# --------------------------------------------------

@router.get("/{maintenance_id}")
async def get_maintenance_by_id(maintenance_id: str):

    key = f"campuscare:maintenance:{maintenance_id}"

    record = await redis_client.hgetall(key)

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Maintenance record not found",
        )

    maintenance = {
        (
            k.decode() if isinstance(k, bytes) else k
        ): (
            v.decode() if isinstance(v, bytes) else v
        )
        for k, v in record.items()
    }

    return {
        "maintenance": maintenance,
    }


# --------------------------------------------------
# UPDATE MAINTENANCE STATUS
# --------------------------------------------------

@router.patch("/{maintenance_id}/status")
async def update_maintenance_status(
    maintenance_id: str,
    data: MaintenanceStatusUpdate,
):

    key = f"campuscare:maintenance:{maintenance_id}"

    exists = await redis_client.exists(key)

    if not exists:
        raise HTTPException(
            status_code=404,
            detail="Maintenance record not found",
        )

    status = data.status.upper()

    allowed_statuses = {
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
    }

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid maintenance status",
                "allowed_statuses": sorted(allowed_statuses),
            },
        )

    # Get maintenance record before updating it
    record = await redis_client.hgetall(key)

    equipment_id = record.get("equipment_id")

    # Update maintenance status
    await redis_client.hset(
        key,
        "status",
        status,
    )

    # --------------------------------------------------
    # MAINTENANCE COMPLETED
    # --------------------------------------------------
    #
    # When maintenance is completed:
    # 1. Mark equipment as operational
    # 2. Update last maintenance date
    # 3. Recalculate equipment risk
    #
    # We DO NOT reset failure_count.
    # Historical failures remain useful for risk prediction.
    # --------------------------------------------------

    if status == "COMPLETED" and equipment_id:

        equipment_key = (
            f"campuscare:equipment:{equipment_id}"
        )

        equipment_exists = await redis_client.exists(
            equipment_key
        )

        if equipment_exists:

            today = datetime.now(
                timezone.utc
            ).date().isoformat()

            await redis_client.hset(
                equipment_key,
                mapping={
                    "status": "Operational",
                    "last_maintenance": today,
                },
            )

            # Recalculate risk using the existing
            # centralized risk calculation.
            await calculate_risk_score(
                equipment_id
            )

    # Get updated maintenance record
    record = await redis_client.hgetall(key)

    maintenance = {
        (
            k.decode() if isinstance(k, bytes) else k
        ): (
            v.decode() if isinstance(v, bytes) else v
        )
        for k, v in record.items()
    }

    return {
        "message": "Maintenance status updated successfully",
        "maintenance": maintenance,
    }