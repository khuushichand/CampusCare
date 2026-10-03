from app.redis_client import redis_client


EQUIPMENT = [
    {
        "id": "P001",
        "name": "Projector",
        "type": "Projector",
        "location": "Lab 204",
        "status": "Operational",
        "health_score": "78",
        "risk_score": "22",
        "last_maintenance": "2026-09-10",
        "failure_count": "2",
    },
    {
        "id": "AC011",
        "name": "Air Conditioner",
        "type": "AC",
        "location": "Block A",
        "status": "Needs Maintenance",
        "health_score": "35",
        "risk_score": "82",
        "last_maintenance": "2026-08-15",
        "failure_count": "7",
    },
    {
        "id": "PC024",
        "name": "Desktop Computer",
        "type": "Computer",
        "location": "Computer Lab 2",
        "status": "Operational",
        "health_score": "65",
        "risk_score": "55",
        "last_maintenance": "2026-09-01",
        "failure_count": "4",
    },
    {
        "id": "PR008",
        "name": "Printer",
        "type": "Printer",
        "location": "Admin Block",
        "status": "Operational",
        "health_score": "90",
        "risk_score": "15",
        "last_maintenance": "2026-09-20",
        "failure_count": "1",
    },
]


async def seed_equipment():

    for equipment in EQUIPMENT:

        equipment_id = equipment["id"]

        # --------------------------------------------------
        # STORE EQUIPMENT AS REDIS HASH
        # --------------------------------------------------

        await redis_client.hset(
            f"campuscare:equipment:{equipment_id}",
            mapping=equipment,
        )

        # --------------------------------------------------
        # STORE EQUIPMENT ID IN EQUIPMENT INDEX
        # --------------------------------------------------

        await redis_client.sadd(
            "campuscare:equipment:index",
            equipment_id,
        )

        # --------------------------------------------------
        # STORE RISK SCORE IN REDIS SORTED SET
        # --------------------------------------------------

        await redis_client.zadd(
            "campuscare:risk:ranking",
            {
                equipment_id: float(equipment["risk_score"])
            },
        )

        # --------------------------------------------------
        # STORE LOCATION IN REDIS SET
        # --------------------------------------------------

        await redis_client.sadd(
            "campuscare:locations",
            equipment["location"],
        )

        # --------------------------------------------------
        # STORE EQUIPMENT CATEGORY/TYPE IN REDIS SET
        # --------------------------------------------------

        await redis_client.sadd(
            "campuscare:categories",
            equipment["type"],
        )

    print("CampusCare equipment seeded successfully.")