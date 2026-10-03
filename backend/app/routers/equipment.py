from fastapi import APIRouter, HTTPException

from app.redis_client import redis_client


router = APIRouter(
    prefix="/api/equipment",
    tags=["Equipment"],
)


EQUIPMENT_INDEX_KEY = "campuscare:equipment:index"
EQUIPMENT_KEY_PREFIX = "campuscare:equipment:"


# --------------------------------------------------
# GET ALL EQUIPMENT
# --------------------------------------------------

@router.get("")
async def get_all_equipment():

    equipment_ids = await redis_client.smembers(
        EQUIPMENT_INDEX_KEY
    )

    equipment_list = []

    for equipment_id in equipment_ids:

        key = f"{EQUIPMENT_KEY_PREFIX}{equipment_id}"

        equipment = await redis_client.hgetall(key)

        if not equipment:
            continue

        # Convert numeric fields to proper numbers
        equipment["health_score"] = int(
            equipment.get("health_score", 0)
        )

        equipment["risk_score"] = float(
            equipment.get("risk_score", 0)
        )

        equipment["failure_count"] = int(
            equipment.get("failure_count", 0)
        )

        equipment_list.append(equipment)

    return {
        "count": len(equipment_list),
        "equipment": equipment_list,
    }


# --------------------------------------------------
# GET EQUIPMENT BY ID
# --------------------------------------------------

@router.get("/{equipment_id}")
async def get_equipment(equipment_id: str):

    key = f"{EQUIPMENT_KEY_PREFIX}{equipment_id}"

    equipment = await redis_client.hgetall(key)

    if not equipment:
        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    # Convert numeric fields to proper numbers
    equipment["health_score"] = int(
        equipment.get("health_score", 0)
    )

    equipment["risk_score"] = float(
        equipment.get("risk_score", 0)
    )

    equipment["failure_count"] = int(
        equipment.get("failure_count", 0)
    )

    return equipment