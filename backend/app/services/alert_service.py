from datetime import datetime, timezone
from uuid import uuid4

from app.redis_client import redis_client
from app.services.event_publisher import (
    publish_event,
    EVENT_ALERT_CREATED,
    EVENT_ALERT_RESOLVED,
)


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
    client=None,
):
    """
    Create or reactivate an alert for an equipment/risk condition.

    There will be only one alert for the same equipment + title.

    Behaviour:
    - No existing alert -> create one
    - Existing ACTIVE alert -> update its information
    - Existing RESOLVED alert -> reactivate it
    """

    r = client or redis_client

    existing_alert = await find_existing_alert(
        equipment_id=equipment_id,
        title=title,
        client=r,
    )

    if existing_alert:

        alert_id = existing_alert["alert_id"]
        key = f"campuscare:alert:{alert_id}"

        prev_status = existing_alert.get("status")
        prev_message = existing_alert.get("message")
        prev_severity = existing_alert.get("severity")

        # Check if meaningful state change occurs
        state_changed = (
            prev_status != "ACTIVE"
            or prev_message != message
            or prev_severity != severity
        )

        # Atomic update and reactivation via MULTI/EXEC transaction pipeline
        pipe = r.pipeline(transaction=True)
        pipe.hset(
            key,
            mapping={
                "message": message,
                "severity": severity,
                "status": "ACTIVE",
            },
        )
        pipe.sadd(
            ACTIVE_ALERTS_KEY,
            alert_id,
        )
        await pipe.execute()

        updated_alert = await get_alert(alert_id, client=r)

        if state_changed:
            await publish_event(
                event_type=EVENT_ALERT_CREATED,
                entity_id=alert_id,
                data={
                    "alert_id": alert_id,
                    "equipment_id": equipment_id,
                    "title": title,
                    "message": message,
                    "severity": severity,
                    "status": "ACTIVE",
                    "reactivated": (prev_status == "RESOLVED"),
                },
                client=r,
            )

        return updated_alert

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

    # Atomic creation and indexing via MULTI/EXEC transaction pipeline
    pipe = r.pipeline(transaction=True)
    pipe.hset(
        key,
        mapping=alert,
    )
    pipe.sadd(
        ALERT_INDEX_KEY,
        alert_id,
    )
    pipe.sadd(
        ACTIVE_ALERTS_KEY,
        alert_id,
    )
    await pipe.execute()

    # Publish alert.created event for new alert
    await publish_event(
        event_type=EVENT_ALERT_CREATED,
        entity_id=alert_id,
        data={
            "alert_id": alert_id,
            "equipment_id": equipment_id,
            "title": title,
            "message": message,
            "severity": severity,
            "status": "ACTIVE",
            "reactivated": False,
        },
        client=r,
    )

    return alert


# --------------------------------------------------
# FIND EXISTING ALERT
# --------------------------------------------------

async def find_existing_alert(
    equipment_id: str,
    title: str,
    client=None,
):
    """
    Find an alert for the same equipment and alert type.

    Searches both ACTIVE and RESOLVED alerts.
    """

    r = client or redis_client

    alert_ids = await r.smembers(
        ALERT_INDEX_KEY
    )

    for alert_id in alert_ids:

        if isinstance(alert_id, bytes):
            alert_id = alert_id.decode()

        key = f"campuscare:alert:{alert_id}"

        record = await r.hgetall(key)

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

async def get_all_alerts(client=None):

    r = client or redis_client

    alert_ids = await r.smembers(
        ALERT_INDEX_KEY
    )

    alerts = []

    for alert_id in alert_ids:

        if isinstance(alert_id, bytes):
            alert_id = alert_id.decode()

        key = f"campuscare:alert:{alert_id}"

        record = await r.hgetall(key)

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

async def get_alert(alert_id: str, client=None):

    r = client or redis_client
    key = f"campuscare:alert:{alert_id}"

    record = await r.hgetall(key)

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
    client=None,
):

    r = client or redis_client
    key = f"campuscare:alert:{alert_id}"

    exists = await r.exists(key)

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

    # Atomic status update and index adjustment via MULTI/EXEC transaction pipeline
    pipe = r.pipeline(transaction=True)
    pipe.hset(
        key,
        "status",
        status,
    )

    if status == "ACTIVE":
        pipe.sadd(
            ACTIVE_ALERTS_KEY,
            alert_id,
        )
    else:
        pipe.srem(
            ACTIVE_ALERTS_KEY,
            alert_id,
        )

    await pipe.execute()

    return await get_alert(alert_id, client=r)


# --------------------------------------------------
# RESOLVE ALERTS FOR LOW-RISK EQUIPMENT
# --------------------------------------------------

async def resolve_high_risk_alerts(
    equipment_id: str,
    client=None,
):
    """
    Resolve active high-risk alerts when equipment
    is no longer above the high-risk threshold.

    The alert record is NOT deleted.

    It remains in the alert history as RESOLVED.
    """

    r = client or redis_client

    alert_ids = await r.smembers(
        ALERT_INDEX_KEY
    )

    resolved = []

    for alert_id in alert_ids:

        if isinstance(alert_id, bytes):
            alert_id = alert_id.decode()

        key = f"campuscare:alert:{alert_id}"

        record = await r.hgetall(key)

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

            # Atomic status update and active set removal via MULTI/EXEC pipeline
            pipe = r.pipeline(transaction=True)
            pipe.hset(
                key,
                "status",
                "RESOLVED",
            )
            pipe.srem(
                ACTIVE_ALERTS_KEY,
                alert_id,
            )
            await pipe.execute()

            resolved.append(alert_id)

            # Publish alert.resolved event
            await publish_event(
                event_type=EVENT_ALERT_RESOLVED,
                entity_id=alert_id,
                data={
                    "alert_id": alert_id,
                    "equipment_id": equipment_id,
                    "title": decoded_record.get("title", ""),
                    "status": "RESOLVED",
                },
                client=r,
            )

    return resolved
