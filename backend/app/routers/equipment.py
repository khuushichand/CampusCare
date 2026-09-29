from fastapi import APIRouter, HTTPException

from app.redis_client import redis_client


router = APIRouter(
    prefix="/api/equipment",
    tags=["Equipment"],
)


# --------------------------------------------------
# GET ALL EQUIPMENT
# --------------------------------------------------

@router.get("")
async def get_all_equipment():
    keys = await redis_client.keys("campuscare:equipment:*")

    equipment_list = []

    for key in keys:
        equipment = await redis_client.hgetall(key)

        if equipment:
            equipment["health_score"] = int(
                equipment.get("health_score", 0)
            )

            equipment["risk_score"] = int(
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
    key = f"campuscare:equipment:{equipment_id}"

    equipment = await redis_client.hgetall(key)

    if not equipment:
        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    equipment["health_score"] = int(
        equipment.get("health_score", 0)
    )

    equipment["risk_score"] = int(
        equipment.get("risk_score", 0)
    )

    equipment["failure_count"] = int(
        equipment.get("failure_count", 0)
    )

    return equipment