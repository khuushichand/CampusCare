from app.redis_client import redis_client
from app.services.risk_service import recalculate_all_risks


EQUIPMENT = [
    {
        "id": "P001",
        "equipment_id": "P001",
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
        "equipment_id": "AC011",
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
        "equipment_id": "PC024",
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
        "equipment_id": "PR008",
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

DEMO_MAINTENANCE = [
    {
        "maintenance_id": "MAIN-AC011",
        "id": "MAIN-AC011",
        "equipment_id": "AC011",
        "title": "Air Conditioner Compressor Inspection",
        "description": "Investigate frequent cooling dropouts and high vibration.",
        "technician": "HVAC Engineering Team",
        "scheduled_date": "2026-11-20",
        "status": "SCHEDULED",
        "created_at": "2026-11-19T10:00:00Z",
    },
    {
        "maintenance_id": "MAIN-P001",
        "id": "MAIN-P001",
        "equipment_id": "P001",
        "title": "Projector Lamp Replacement",
        "description": "Routine optical cleaning and lamp lumen calibration.",
        "technician": "Audiovisual Support Team",
        "scheduled_date": "2026-11-22",
        "status": "IN_PROGRESS",
        "created_at": "2026-11-18T14:30:00Z",
    },
    {
        "maintenance_id": "MAIN-PC024",
        "id": "MAIN-PC024",
        "equipment_id": "PC024",
        "title": "Desktop RAM Upgrade & OS Re-image",
        "description": "Performance tuning and RAM replacement.",
        "technician": "IT Systems Support",
        "scheduled_date": "2026-11-15",
        "status": "COMPLETED",
        "created_at": "2026-11-14T09:15:00Z",
    },
    {
        "maintenance_id": "MAIN-PR008",
        "id": "MAIN-PR008",
        "equipment_id": "PR008",
        "title": "Roller Cleaning and Firmware Update",
        "description": "Paper tray roller inspection and network patch.",
        "technician": "IT Support",
        "scheduled_date": "2026-11-25",
        "status": "SCHEDULED",
        "created_at": "2026-11-19T11:00:00Z",
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

    # --------------------------------------------------
    # SEED DEMO MAINTENANCE RECORDS
    # --------------------------------------------------
    for maintenance in DEMO_MAINTENANCE:
        m_id = maintenance["maintenance_id"]
        await redis_client.hset(
            f"campuscare:maintenance:{m_id}",
            mapping=maintenance,
        )
        await redis_client.sadd(
            "campuscare:maintenance:index",
            m_id,
        )

    # --------------------------------------------------
    # RECALCULATE RISKS & GENERATE ALERTS (e.g. AC011 >= 80)
    # --------------------------------------------------
    try:
        await recalculate_all_risks()
    except Exception:
        pass

    print("CampusCare equipment and maintenance seeded successfully.")