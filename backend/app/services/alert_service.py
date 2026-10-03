from datetime import datetime, timezone
from uuid import uuid4

from app.redis_client import redis_client


ALERT_INDEX_KEY = "campuscare:alerts:index"
ACTIVE_ALERTS_KEY = "campuscare:alerts:active"


# --------------------------------------------------
# CREATE OR REACTIVATE ALERT
# --------------------------------------------------

async def create_alert(
    equipment_id: str,
    title: str,
    message: str,
    severity: str = "HIGH",
):
    """
    Create or reactivate an alert for an equipment/risk condition.

    There will be only one alert for the same equipment + title.

    Behaviour:
    - No existing alert -> create one
    - Existing ACTIVE alert -> update its information
    - Existing RESOLVED alert -> reactivate it
    """

    existing_alert = await find_existing_alert(
        equipment_id=equipment_id,
        title=title,
    )

    if existing_alert:

        alert_id = existing_alert["alert_id"]
        key = f"campuscare:alert:{alert_id}"

        await redis_client.hset(
            key,
            mapping={
                "message": message,
                "severity": severity,
                "status": "ACTIVE",
            },
        )

        await redis_client.sadd(
            ACTIVE_ALERTS_KEY,
            alert_id,
        )

        return await get_alert(alert_id)

    # --------------------------------------------------
    # CREATE NEW ALERT
    # --------------------------------------------------

    alert_id = f"ALT-{uuid4().hex[:8].upper()}"

    created_at = datetime.now(
        timezone.utc
    ).isoformat()

    alert = {
        "alert_id": alert_id,
        "equipment_id": equipment_id,
        "title": title,
        "message": message,
        "severity": severity,
        "status": "ACTIVE",
        "created_at": created_at,
    }

    key = f"campuscare:alert:{alert_id}"

    await redis_client.hset(
        key,
        mapping=alert,
    )

    await redis_client.sadd(
        ALERT_INDEX_KEY,
        alert_id,
    )

    await redis_client.sadd(
        ACTIVE_ALERTS_KEY,
        alert_id,
    )

    return alert


# --------------------------------------------------
# FIND EXISTING ALERT
# --------------------------------------------------

async def find_existing_alert(
    equipment_id: str,
    title: str,
):
    """
    Find an alert for the same equipment and alert type.

    Searches both ACTIVE and RESOLVED alerts.
    """

    alert_ids = await redis_client.smembers(
        ALERT_INDEX_KEY
    )

    for alert_id in alert_ids:

        if isinstance(alert_id, bytes):
            alert_id = alert_id.decode()

        key = f"campuscare:alert:{alert_id}"

        record = await redis_client.hgetall(key)

        if not record:
            continue

        decoded_record = {
            (
                k.decode()
                if isinstance(k, bytes)
                else k
            ): (
                v.decode()
                if isinstance(v, bytes)
                else v
            )
            for k, v in record.items()
        }

        if (
            decoded_record.get("equipment_id")
            == equipment_id
            and decoded_record.get("title")
            == title
        ):
            return decoded_record

    return None


# --------------------------------------------------
# GET ALL ALERTS
# --------------------------------------------------

async def get_all_alerts():

    alert_ids = await redis_client.smembers(
        ALERT_INDEX_KEY
    )

    alerts = []

    for alert_id in alert_ids:

        if isinstance(alert_id, bytes):
            alert_id = alert_id.decode()

        key = f"campuscare:alert:{alert_id}"

        record = await redis_client.hgetall(key)

        if not record:
            continue

        decoded_record = {
            (
                k.decode()
                if isinstance(k, bytes)
                else k
            ): (
                v.decode()
                if isinstance(v, bytes)
                else v
            )
            for k, v in record.items()
        }

        alerts.append(decoded_record)

    return alerts


# --------------------------------------------------
# GET ONE ALERT
# --------------------------------------------------

async def get_alert(alert_id: str):

    key = f"campuscare:alert:{alert_id}"

    record = await redis_client.hgetall(key)

    if not record:
        return None

    return {
        (
            k.decode()
            if isinstance(k, bytes)
            else k
        ): (
            v.decode()
            if isinstance(v, bytes)
            else v
        )
        for k, v in record.items()
    }


# --------------------------------------------------
# UPDATE ALERT STATUS
# --------------------------------------------------

async def update_alert_status(
    alert_id: str,
    status: str,
):

    key = f"campuscare:alert:{alert_id}"

    exists = await redis_client.exists(key)

    if not exists:
        return None

    status = status.upper()

    allowed_statuses = {
        "ACTIVE",
        "RESOLVED",
    }

    if status not in allowed_statuses:
        raise ValueError(
            f"Invalid alert status. "
            f"Allowed statuses: "
            f"{sorted(allowed_statuses)}"
        )

    await redis_client.hset(
        key,
        "status",
        status,
    )

    if status == "ACTIVE":

        await redis_client.sadd(
            ACTIVE_ALERTS_KEY,
            alert_id,
        )

    else:

        await redis_client.srem(
            ACTIVE_ALERTS_KEY,
            alert_id,
        )

    return await get_alert(alert_id)


# --------------------------------------------------
# RESOLVE ALERTS FOR LOW-RISK EQUIPMENT
# --------------------------------------------------

async def resolve_high_risk_alerts(
    equipment_id: str,
):
    """
    Resolve active high-risk alerts when equipment
    is no longer above the high-risk threshold.

    The alert record is NOT deleted.

    It remains in the alert history as RESOLVED.
    """

    alert_ids = await redis_client.smembers(
        ALERT_INDEX_KEY
    )

    resolved = []

    for alert_id in alert_ids:

        if isinstance(alert_id, bytes):
            alert_id = alert_id.decode()

        key = f"campuscare:alert:{alert_id}"

        record = await redis_client.hgetall(key)

        if not record:
            continue

        decoded_record = {
            (
                k.decode()
                if isinstance(k, bytes)
                else k
            ): (
                v.decode()
                if isinstance(v, bytes)
                else v
            )
            for k, v in record.items()
        }

        if (
            decoded_record.get("equipment_id")
            == equipment_id
            and decoded_record.get("title")
            == "High equipment risk"
            and decoded_record.get("status")
            == "ACTIVE"
        ):

            await redis_client.hset(
                key,
                "status",
                "RESOLVED",
            )

            await redis_client.srem(
                ACTIVE_ALERTS_KEY,
                alert_id,
            )

            resolved.append(alert_id)

    return resolved
