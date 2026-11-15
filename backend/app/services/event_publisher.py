import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from app.redis_client import redis_client

logger = logging.getLogger("event_publisher")

# --------------------------------------------------
# EVENT CHANNELS & EVENT TYPES
# --------------------------------------------------
DEFAULT_EVENTS_CHANNEL = "campuscare:events"

EVENT_INCIDENT_CREATED = "incident.created"
EVENT_INCIDENT_UPDATED = "incident.updated"
EVENT_ALERT_CREATED = "alert.created"
EVENT_ALERT_RESOLVED = "alert.resolved"
EVENT_RISK_UPDATED = "equipment.risk_updated"


# --------------------------------------------------
# EVENT PUBLISHER
# --------------------------------------------------
async def publish_event(
    event_type: str,
    entity_id: str,
    data: Optional[Dict[str, Any]] = None,
    channel: str = DEFAULT_EVENTS_CHANNEL,
    client=None,
) -> Optional[Dict[str, Any]]:
    """
    Publishes a structured real-time event to Redis Pub/Sub.

    Payload format:
    {
        "event_id": "EVT-<uuid>",
        "event_type": "<domain>.<action>",
        "entity_id": "<entity_id>",
        "timestamp": "<iso8601_utc>",
        "data": { ... }
    }

    Non-blocking: If publishing fails (e.g. transient Redis issue),
    it logs a warning and does NOT raise an exception, ensuring core
    workflows (report consumption, risk calculation, alert handling)
    continue uninterrupted.
    """
    event_id = f"EVT-{uuid4().hex[:12].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    event = {
        "event_id": event_id,
        "event_type": event_type,
        "entity_id": entity_id,
        "timestamp": timestamp,
        "data": data or {},
    }

    r = client or redis_client

    try:
        payload = json.dumps(event)
        await r.publish(channel, payload)
        logger.debug(f"Published {event_type} event {event_id} for {entity_id} to {channel}")
        return event
    except Exception as exc:
        logger.warning(
            f"Failed to publish event {event_type} for entity {entity_id} on channel {channel}: {exc}"
        )
        return None

