import asyncio
import logging
import os
import signal
import socket
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import redis.exceptions
from app.redis_client import redis_client
from app.config import (
    PROCESSING_LOCK_EXPIRY_SEC,
    CREATION_LOCK_EXPIRY_SEC,
    PROCESSED_REPORT_RETENTION_SEC,
)
from app.services.risk_service import calculate_risk_score
from app.services.event_publisher import (
    publish_event,
    EVENT_INCIDENT_CREATED,
    EVENT_INCIDENT_UPDATED,
)

# --------------------------------------------------
# LOGGING CONFIGURATION
# --------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [ReportConsumer] %(message)s",
)
logger = logging.getLogger("report_consumer")

# --------------------------------------------------
# CONSTANTS & REDIS KEYS
# --------------------------------------------------
REPORT_STREAM = "campuscare:reports"
CONSUMER_GROUP_NAME = "campuscare:report_consumer_group"
INCIDENT_KEY_PREFIX = "campuscare:incident:"
PROCESSED_REPORT_KEY_PREFIX = "campuscare:processed_report:"
INCIDENT_REPORTS_KEY_PREFIX = "campuscare:incident:reports:"
CREATION_LOCK_KEY_PREFIX = "campuscare:lock:incident_creation:"

# Active incident statuses eligible for grouping
ACTIVE_INCIDENT_STATUSES = {"OPEN", "IN_PROGRESS"}

# Default minimum idle time for reclaiming abandoned messages (e.g. 60,000 ms)
DEFAULT_MIN_IDLE_TIME_MS = 60000

# Default lease expiry for report processing lock (e.g. 30 seconds)
DEFAULT_PROCESSING_LOCK_EXPIRY_SEC = PROCESSING_LOCK_EXPIRY_SEC

# Default lease expiry for creation lock (e.g. 10 seconds)
DEFAULT_CREATION_LOCK_EXPIRY_SEC = CREATION_LOCK_EXPIRY_SEC

# Default retention period for processed report idempotency tracking (7 days)
DEFAULT_PROCESSED_REPORT_RETENTION_SEC = PROCESSED_REPORT_RETENTION_SEC


# --------------------------------------------------
# LUA SCRIPTS
# --------------------------------------------------

# Lua script for token-checked safe release of processing lock
RELEASE_LOCK_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""

# Lua script for safe lock renewal
RENEW_LOCK_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('expire', KEYS[1], tonumber(ARGV[2]))
else
    return 0
end
"""

# Lua script for atomic incident report attachment
# KEYS[1] = link_key (campuscare:incident:reports:<incident_id>)
# KEYS[2] = incident_key (campuscare:incident:<incident_id>)
# ARGV[1] = report_id
# ARGV[2] = updated_at
ATTACH_REPORT_LUA = """
local link_key = KEYS[1]
local incident_key = KEYS[2]
local report_id = ARGV[1]
local updated_at = ARGV[2]

local added = redis.call('SADD', link_key, report_id)
if added == 1 then
    local new_count = redis.call('HINCRBY', incident_key, 'report_count', 1)
    redis.call('HSET', incident_key, 'updated_at', updated_at, 'latest_report_id', report_id)
    return {1, tostring(new_count)}
else
    local current_count = redis.call('HGET', incident_key, 'report_count')
    if not current_count then
        current_count = '1'
    end
    return {0, tostring(current_count)}
end
"""


# --------------------------------------------------
# CONSUMER GROUP SETUP
# --------------------------------------------------
async def ensure_consumer_group(
    client=None,
    stream_name: str = REPORT_STREAM,
    group_name: str = CONSUMER_GROUP_NAME,
) -> None:
    """
    Safely creates the Redis Stream consumer group starting from '0'.
    - Handles ResponseError with BUSYGROUP gracefully without modifying existing group.
    - Uses mkstream=True to ensure stream existence without deleting or recreating anything.
    - Guarantees zero report loss.
    """
    r = client or redis_client
    try:
        await r.xgroup_create(stream_name, group_name, id="0", mkstream=True)
        logger.info(f"Consumer group '{group_name}' successfully created for stream '{stream_name}'.")
    except redis.exceptions.ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            logger.info(f"Consumer group '{group_name}' already exists for stream '{stream_name}'.")
        else:
            logger.error(f"Failed to create consumer group '{group_name}': {exc}")
            raise


# --------------------------------------------------
# INCIDENT MATCHING & RETRIEVAL
# --------------------------------------------------
async def find_matching_incident(
    report_category: str,
    equipment_id: Optional[str] = None,
    location: Optional[str] = None,
    client=None,
) -> Optional[Dict[str, Any]]:
    """
    Conservative incident matching:
    1. If equipment_id is provided and non-empty:
       Matches any active incident (OPEN or IN_PROGRESS) with the exact same
       equipment_id and matching category.
    2. If equipment_id is absent/empty:
       Matches any active incident with the exact same category and location,
       and without an equipment_id attached.
    Does NOT group unrelated complaints simply because they share a location.
    """
    r = client or redis_client
    clean_equip = equipment_id.strip() if equipment_id else ""
    clean_cat = report_category.strip().upper() if report_category else ""
    clean_loc = location.strip().upper() if location else ""

    async for key in r.scan_iter(match=f"{INCIDENT_KEY_PREFIX}*"):
        key_str = key.decode() if isinstance(key, bytes) else key
        if key_str.startswith(INCIDENT_REPORTS_KEY_PREFIX):
            continue

        raw_incident = await r.hgetall(key)
        if not raw_incident:
            continue

        incident = {
            (k.decode() if isinstance(k, bytes) else k): (
                v.decode() if isinstance(v, bytes) else v
            )
            for k, v in raw_incident.items()
        }

        # Check status is active
        inc_status = incident.get("status", "OPEN").upper()
        if inc_status not in ACTIVE_INCIDENT_STATUSES:
            continue

        inc_cat = incident.get("category", "").strip().upper()
        inc_equip = incident.get("equipment_id", "").strip()
        inc_loc = incident.get("location", "").strip().upper()

        if clean_equip:
            # Equipment-specific match: same equipment and matching category
            if inc_equip == clean_equip and inc_cat == clean_cat:
                return incident
        else:
            # Non-equipment match: same category and same location
            if not inc_equip and inc_cat == clean_cat and inc_loc == clean_loc:
                return incident

    return None


# --------------------------------------------------
# INCIDENT CREATION & UPDATES
# --------------------------------------------------
async def create_new_incident_from_report(
    report_data: Dict[str, Any],
    client=None,
) -> Dict[str, Any]:
    """
    Creates a new incident hash in Redis and associates the triggering report.
    """
    r = client or redis_client
    incident_id = f"INC-{uuid4().hex[:8].upper()}"
    key = f"{INCIDENT_KEY_PREFIX}{incident_id}"

    created_at = datetime.now(timezone.utc).isoformat()
    report_id = report_data.get("report_id", "")
    equipment_id = report_data.get("equipment_id", "") or ""
    category = report_data.get("category", "")
    location = report_data.get("location", "")
    title = report_data.get("title", f"Issue reported: {category}")
    description = report_data.get("description", "")

    incident = {
        "incident_id": incident_id,
        "report_id": report_id,
        "equipment_id": equipment_id,
        "category": category,
        "title": title,
        "description": description,
        "location": location,
        "severity": "MEDIUM",
        "status": "OPEN",
        "created_at": created_at,
        "report_count": "1",
    }

    await r.hset(key, mapping=incident)

    # Preserve report-incident link
    link_key = f"{INCIDENT_REPORTS_KEY_PREFIX}{incident_id}"
    await r.sadd(link_key, report_id)

    return incident


async def attach_report_to_existing_incident(
    incident: Dict[str, Any],
    report_data: Dict[str, Any],
    client=None,
) -> Dict[str, Any]:
    """
    Attaches a related report to an existing incident atomically using Lua:
    - Atomically adds report_id to the incident's report set.
    - If newly added, increments report_count and updates timestamp and latest_report_id.
    - If already present, leaves report_count untouched (idempotent replay safety).
    """
    r = client or redis_client
    incident_id = incident["incident_id"]
    incident_key = f"{INCIDENT_KEY_PREFIX}{incident_id}"
    link_key = f"{INCIDENT_REPORTS_KEY_PREFIX}{incident_id}"
    report_id = report_data.get("report_id", "")
    updated_at = datetime.now(timezone.utc).isoformat()

    res = await r.eval(
        ATTACH_REPORT_LUA,
        2,
        link_key,
        incident_key,
        report_id,
        updated_at,
    )

    is_new = bool(res[0])
    count_str = str(res[1])
    incident["report_count"] = count_str
    if is_new:
        incident["latest_report_id"] = report_id
        incident["updated_at"] = updated_at

    return incident


# --------------------------------------------------
# LOCK HELPERS
# --------------------------------------------------
async def release_token_checked_lock(
    key: str,
    token: str,
    client=None,
) -> bool:
    """
    Safely releases a lock only if the current value matches the token.
    Prevents a worker from deleting another worker's acquired lock.
    """
    r = client or redis_client
    res = await r.eval(RELEASE_LOCK_LUA, 1, key, token)
    return bool(res)


async def renew_token_checked_lock(
    key: str,
    token: str,
    expiry_sec: int,
    client=None,
) -> bool:
    """
    Safely renews a lock lease only if the current value matches the token.
    """
    r = client or redis_client
    res = await r.eval(RENEW_LOCK_LUA, 1, key, token, expiry_sec)
    return bool(res)


# --------------------------------------------------
# EVENT PROCESSOR
# --------------------------------------------------
async def process_report_message(
    stream_id: str,
    raw_report: Dict[str, Any],
    client=None,
    lock_expiry_sec: int = DEFAULT_PROCESSING_LOCK_EXPIRY_SEC,
    creation_lock_expiry_sec: int = DEFAULT_CREATION_LOCK_EXPIRY_SEC,
    processed_retention_sec: int = DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
) -> Dict[str, Any]:
    """
    Processes a single report event with full idempotency, lock expiry, and concurrency control:
    1. Checks if the report_id has already been permanently processed.
    2. Acquires an expiring processing lock (SET NX EX) to prevent concurrent duplicate processing
       while ensuring crashed workers do not leave permanent locks.
    3. Handles expired locks during retries and releases with token verification.
    4. Guards concurrent incident creation for the same target group using a creation lock.
    5. Recalculates equipment risk score via injected Redis client.
    6. Permanently maps report_id to incident_id (removing TTL).
    """
    r = client or redis_client

    # Decode bytes if needed
    report_data = {
        (k.decode() if isinstance(k, bytes) else k): (
            v.decode() if isinstance(v, bytes) else v
        )
        for k, v in raw_report.items()
    }

    report_id = report_data.get("report_id")
    if not report_id:
        raise ValueError(f"Malformed report event {stream_id}: missing 'report_id'")

    logger.info(f"Report received: id={report_id}, stream_id={stream_id}, title='{report_data.get('title')}'")

    processed_key = f"{PROCESSED_REPORT_KEY_PREFIX}{report_id}"
    existing_incident_id = await r.get(processed_key)
    if existing_incident_id and not existing_incident_id.startswith("PROCESSING:"):
        logger.info(f"Duplicate event ignored: report {report_id} was already processed to incident {existing_incident_id}.")
        return {
            "status": "duplicate",
            "report_id": report_id,
            "incident_id": existing_incident_id,
        }

    # Acquire expiring lock for report_id to guard concurrent consumers
    worker_token = f"PROCESSING:{uuid4().hex}"
    acquired = await r.set(processed_key, worker_token, nx=True, ex=lock_expiry_sec)
    if not acquired:
        current_val = await r.get(processed_key)
        if current_val and not current_val.startswith("PROCESSING:"):
            logger.info(f"Report {report_id} was processed concurrently by another consumer (incident {current_val}).")
            return {
                "status": "duplicate",
                "report_id": report_id,
                "incident_id": current_val,
            }
        logger.info(f"Report {report_id} is currently being processed by another consumer; skipping concurrent execution.")
        return {
            "status": "concurrent_skip",
            "report_id": report_id,
            "incident_id": None,
        }

    creation_lock_key = None
    creation_lock_token = None

    try:
        equipment_id = report_data.get("equipment_id", "").strip()
        category = report_data.get("category", "").strip()
        location = report_data.get("location", "").strip()

        # Target key for creation lock to prevent concurrent reports for same equipment/category from creating split incidents
        clean_cat = category.upper()
        if equipment_id:
            group_scope = f"eq:{equipment_id.upper()}:{clean_cat}"
        else:
            group_scope = f"loc:{location.upper()}:{clean_cat}"
        creation_lock_key = f"{CREATION_LOCK_KEY_PREFIX}{group_scope}"
        creation_lock_token = f"LOCK:{uuid4().hex}"

        # Acquire creation lock with short spin-wait if another report for the same target is currently creating/linking
        acquired_creation = False
        for _ in range(5):
            acquired_creation = await r.set(
                creation_lock_key,
                creation_lock_token,
                nx=True,
                ex=creation_lock_expiry_sec,
            )
            if acquired_creation:
                break
            await asyncio.sleep(0.05)

        # Find matching incident (now protected by creation lock)
        matching_incident = await find_matching_incident(
            report_category=category,
            equipment_id=equipment_id if equipment_id else None,
            location=location if location else None,
            client=r,
        )

        if matching_incident:
            updated_incident = await attach_report_to_existing_incident(
                incident=matching_incident,
                report_data=report_data,
                client=r,
            )
            incident_id = updated_incident["incident_id"]
            logger.info(
                f"Existing incident updated: {incident_id} (report_count={updated_incident.get('report_count')}) for report {report_id}."
            )
            action = "updated"

            # Publish incident.updated event
            await publish_event(
                event_type=EVENT_INCIDENT_UPDATED,
                entity_id=incident_id,
                data={
                    "incident_id": incident_id,
                    "update_type": "report_attached",
                    "report_id": report_id,
                    "report_count": int(updated_incident.get("report_count", 1)),
                    "previous_status": None,
                    "status": updated_incident.get("status", "OPEN"),
                    "equipment_id": updated_incident.get("equipment_id", ""),
                    "category": updated_incident.get("category", ""),
                    "location": updated_incident.get("location", ""),
                },
                client=r,
            )
        else:
            new_incident = await create_new_incident_from_report(
                report_data=report_data,
                client=r,
            )
            incident_id = new_incident["incident_id"]
            logger.info(f"Incident created: {incident_id} for report {report_id}.")
            action = "created"

            # Publish incident.created event
            await publish_event(
                event_type=EVENT_INCIDENT_CREATED,
                entity_id=incident_id,
                data={
                    "incident_id": incident_id,
                    "report_id": report_id,
                    "equipment_id": new_incident.get("equipment_id", ""),
                    "category": new_incident.get("category", ""),
                    "location": new_incident.get("location", ""),
                    "severity": new_incident.get("severity", "MEDIUM"),
                    "status": new_incident.get("status", "OPEN"),
                },
                client=r,
            )

        # Release creation lock immediately after incident is linked/created
        if acquired_creation and creation_lock_key:
            await release_token_checked_lock(creation_lock_key, creation_lock_token, client=r)
            creation_lock_key = None

        # Evaluate risk if equipment_id is present
        # Historical failure_count is NOT incremented
        if equipment_id:
            try:
                eq_exists = await r.exists(f"campuscare:equipment:{equipment_id}")
                if eq_exists:
                    await calculate_risk_score(equipment_id, client=r)
                    logger.info(f"Recalculated risk score for equipment {equipment_id}.")
            except Exception as e:
                logger.warning(f"Could not calculate risk for equipment {equipment_id}: {e}")

        # Mark report as processed to incident_id with safe retention TTL
        if processed_retention_sec and processed_retention_sec > 0:
            await r.set(processed_key, incident_id, ex=processed_retention_sec)
        else:
            await r.set(processed_key, incident_id)

        return {
            "status": action,
            "report_id": report_id,
            "incident_id": incident_id,
        }

    except Exception:
        # On failure, release creation lock if held
        if creation_lock_key and creation_lock_token:
            try:
                await release_token_checked_lock(creation_lock_key, creation_lock_token, client=r)
            except Exception:
                pass

        # Release processing lock with token check so subsequent retries can succeed
        try:
            await release_token_checked_lock(processed_key, worker_token, client=r)
        except Exception:
            pass
        raise


# --------------------------------------------------
# CONSUMER BATCH HANDLER
# --------------------------------------------------
async def process_batch(
    messages: List[Any],
    consumer_name: str,
    stream_name: str = REPORT_STREAM,
    group_name: str = CONSUMER_GROUP_NAME,
    client=None,
    lock_expiry_sec: int = DEFAULT_PROCESSING_LOCK_EXPIRY_SEC,
    creation_lock_expiry_sec: int = DEFAULT_CREATION_LOCK_EXPIRY_SEC,
    processed_retention_sec: int = DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
) -> int:
    """
    Iterates through a list of stream messages:
    - Processes each event.
    - If successful, acknowledges via XACK.
    - If failed, logs error and DOES NOT XACK to allow retry/PEL tracking.
    """
    r = client or redis_client
    success_count = 0

    for stream_id, raw_fields in messages:
        if isinstance(stream_id, bytes):
            stream_id = stream_id.decode()

        try:
            res = await process_report_message(
                stream_id,
                raw_fields,
                client=r,
                lock_expiry_sec=lock_expiry_sec,
                creation_lock_expiry_sec=creation_lock_expiry_sec,
                processed_retention_sec=processed_retention_sec,
            )
            if res.get("status") == "concurrent_skip":
                # Another worker has claimed lock, do not XACK yet
                continue

            # Acknowledge only after successful processing
            await r.xack(stream_name, group_name, stream_id)
            logger.info(f"Successfully acknowledged event: stream_id={stream_id} by consumer={consumer_name}")
            success_count += 1
        except Exception as exc:
            # Errors must not result in acknowledgement before successful processing
            logger.error(
                f"Processing failure for stream_id={stream_id}: {exc}",
                exc_info=True,
            )

    return success_count


# --------------------------------------------------
# PENDING MESSAGE RECOVERY VIA XAUTOCLAIM
# --------------------------------------------------
async def recover_pending_messages(
    consumer_name: str,
    stream_name: str = REPORT_STREAM,
    group_name: str = CONSUMER_GROUP_NAME,
    min_idle_time_ms: int = DEFAULT_MIN_IDLE_TIME_MS,
    batch_size: int = 10,
    client=None,
    lock_expiry_sec: int = DEFAULT_PROCESSING_LOCK_EXPIRY_SEC,
    creation_lock_expiry_sec: int = DEFAULT_CREATION_LOCK_EXPIRY_SEC,
    processed_retention_sec: int = DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
) -> int:
    """
    Recovers abandoned pending messages using Redis XAUTOCLAIM with correct pagination:
    - Scans messages pending longer than min_idle_time_ms.
    - Continues scanning according to returned cursor even if a batch contains 0 messages.
    - Automatically handles and acknowledges deleted message IDs returned by Redis.
    - Stops when cursor returns '0-0' or reaches same cursor to avoid infinite loops.
    """
    r = client or redis_client
    start_id = "0-0"
    total_recovered = 0
    seen_cursors = set()

    try:
        while True:
            if start_id in seen_cursors:
                break
            seen_cursors.add(start_id)

            claim_result = await r.xautoclaim(
                stream_name,
                group_name,
                consumer_name,
                min_idle_time=min_idle_time_ms,
                start_id=start_id,
                count=batch_size,
            )

            if not claim_result:
                break

            next_id = claim_result[0]
            if isinstance(next_id, bytes):
                next_id = next_id.decode()

            messages = claim_result[1] if len(claim_result) > 1 else []
            deleted_ids = claim_result[2] if len(claim_result) > 2 else []

            # If Redis returns deleted message IDs, acknowledge them so they leave PEL
            if deleted_ids:
                for d_id in deleted_ids:
                    if isinstance(d_id, bytes):
                        d_id = d_id.decode()
                    try:
                        await r.xack(stream_name, group_name, d_id)
                        logger.info(f"Acknowledged deleted stream message from PEL: {d_id}")
                    except Exception as e:
                        logger.warning(f"Could not XACK deleted message {d_id}: {e}")

            if messages:
                logger.info(f"XAUTOCLAIM recovered {len(messages)} pending messages from stream '{stream_name}'.")
                processed = await process_batch(
                    messages,
                    consumer_name=consumer_name,
                    stream_name=stream_name,
                    group_name=group_name,
                    client=r,
                    lock_expiry_sec=lock_expiry_sec,
                    creation_lock_expiry_sec=creation_lock_expiry_sec,
                    processed_retention_sec=processed_retention_sec,
                )
                total_recovered += processed

            # Stop condition: cursor returned '0-0'
            if next_id == "0-0":
                break

            start_id = next_id

    except Exception as exc:
        logger.warning(f"Error during XAUTOCLAIM pending message recovery: {exc}")

    return total_recovered


# --------------------------------------------------
# WORKER LOOP
# --------------------------------------------------
async def run_worker(
    consumer_name: Optional[str] = None,
    stream_name: str = REPORT_STREAM,
    group_name: str = CONSUMER_GROUP_NAME,
    poll_interval_ms: int = 2000,
    batch_size: int = 10,
    min_idle_time_ms: int = DEFAULT_MIN_IDLE_TIME_MS,
    lock_expiry_sec: int = DEFAULT_PROCESSING_LOCK_EXPIRY_SEC,
    creation_lock_expiry_sec: int = DEFAULT_CREATION_LOCK_EXPIRY_SEC,
    processed_retention_sec: int = DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
    stop_event: Optional[asyncio.Event] = None,
    client=None,
) -> None:
    """
    Main loop for background stream consumer:
    1. Ensures consumer group exists.
    2. Recovers abandoned pending messages via XAUTOCLAIM.
    3. Reads and processes new messages with id=">".
    """
    r = client or redis_client
    c_name = consumer_name or f"consumer-{socket.gethostname()}-{os.getpid()}"

    logger.info(f"Starting Report Consumer worker '{c_name}' on group '{group_name}'...")
    await ensure_consumer_group(client=r, stream_name=stream_name, group_name=group_name)

    # 1. Initial recovery of abandoned pending messages using XAUTOCLAIM
    await recover_pending_messages(
        consumer_name=c_name,
        stream_name=stream_name,
        group_name=group_name,
        min_idle_time_ms=min_idle_time_ms,
        batch_size=batch_size,
        client=r,
        lock_expiry_sec=lock_expiry_sec,
        creation_lock_expiry_sec=creation_lock_expiry_sec,
        processed_retention_sec=processed_retention_sec,
    )

    logger.info("Worker ready. Listening for new reports...")

    while stop_event is None or not stop_event.is_set():
        try:
            # Check for abandoned messages periodically
            await recover_pending_messages(
                consumer_name=c_name,
                stream_name=stream_name,
                group_name=group_name,
                min_idle_time_ms=min_idle_time_ms,
                batch_size=batch_size,
                client=r,
                lock_expiry_sec=lock_expiry_sec,
                creation_lock_expiry_sec=creation_lock_expiry_sec,
                processed_retention_sec=processed_retention_sec,
            )

            entries = await r.xreadgroup(
                group_name,
                c_name,
                {stream_name: ">"},
                count=batch_size,
                block=poll_interval_ms,
            )

            if not entries:
                continue

            for _, messages in entries:
                if messages:
                    await process_batch(
                        messages,
                        c_name,
                        stream_name,
                        group_name,
                        client=r,
                        lock_expiry_sec=lock_expiry_sec,
                        creation_lock_expiry_sec=creation_lock_expiry_sec,
                        processed_retention_sec=processed_retention_sec,
                    )

        except asyncio.CancelledError:
            logger.info("Worker loop cancelled.")
            break
        except Exception as exc:
            logger.error(f"Unexpected error in worker loop: {exc}", exc_info=True)
            await asyncio.sleep(1)

    logger.info(f"Worker '{c_name}' shutdown cleanly.")


# --------------------------------------------------
# STANDALONE ENTRYPOINT
# --------------------------------------------------
def main():
    """
    Entrypoint when executed as `python -m app.workers.report_consumer`.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    stop_event = asyncio.Event()

    def handle_signal():
        logger.info("Shutdown signal received. Stopping worker...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, lambda s, f: handle_signal())
        except (ValueError, AttributeError):
            pass

    try:
        loop.run_until_complete(run_worker(stop_event=stop_event))
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received.")
    finally:
        loop.close()
        logger.info("Worker process exited.")


if __name__ == "__main__":
    main()
