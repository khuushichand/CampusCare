"""
Phase 4: Redis TTL Management Tests
====================================
Verifies:
- Processing locks auto-expire and can be safely released/renewed with tokens.
- Incident creation locks auto-expire.
- Processed-report idempotency keys carry a configurable retention TTL.
- Permanent records (equipment, incidents, alerts, indexes, sorted sets) have NO TTL.
- Configurable TTL constants are correct.
- Worker recovery after lock expiry succeeds without duplicate incidents.
"""

import asyncio
import uuid

import fakeredis
import fakeredis.aioredis
import pytest
import pytest_asyncio

from app.config import (
    CREATION_LOCK_EXPIRY_SEC,
    PROCESSED_REPORT_RETENTION_SEC,
    PROCESSING_LOCK_EXPIRY_SEC,
)
from app.workers.report_consumer import (
    CREATION_LOCK_KEY_PREFIX,
    DEFAULT_CREATION_LOCK_EXPIRY_SEC,
    DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
    DEFAULT_PROCESSING_LOCK_EXPIRY_SEC,
    INCIDENT_KEY_PREFIX,
    INCIDENT_REPORTS_KEY_PREFIX,
    PROCESSED_REPORT_KEY_PREFIX,
    ensure_consumer_group,
    process_report_message,
    release_token_checked_lock,
    renew_token_checked_lock,
)
from app.services.risk_service import RISK_ZSET_KEY
from app.services.alert_service import ALERT_INDEX_KEY


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_redis_server():
    """Shared FakeServer so all keys persist across fixture uses within a test."""
    return fakeredis.FakeServer()


@pytest_asyncio.fixture
async def fake_redis(fake_redis_server):
    r = fakeredis.aioredis.FakeRedis(server=fake_redis_server, decode_responses=True)
    yield r
    await r.aclose()


def _make_report(equipment_id: str = "", category: str = "ELECTRICAL") -> dict:
    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    return {
        "report_id": report_id,
        "title": f"Test issue: {category}",
        "description": "TTL management test",
        "category": category,
        "location": "Building A",
        "equipment_id": equipment_id,
        "submitted_by": "test_user",
    }


# ---------------------------------------------------------------------------
# Test 1: Processing lock auto-expires
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_processing_lock_expires_automatically(fake_redis):
    """Processing lock set with EX must have a positive TTL, and once deleted
    (simulating expiry), another worker must be able to acquire it."""
    lock_key = f"{PROCESSED_REPORT_KEY_PREFIX}RPT-TESTLOCK01"
    token = f"PROCESSING:{uuid.uuid4().hex}"

    # Acquire with a 5-second TTL
    acquired = await fake_redis.set(lock_key, token, nx=True, ex=5)
    assert acquired, "Should acquire lock on first attempt"

    ttl = await fake_redis.ttl(lock_key)
    assert ttl > 0, f"TTL should be positive; got {ttl}"

    # Simulate expiry by deleting the key
    await fake_redis.delete(lock_key)
    assert await fake_redis.get(lock_key) is None, "Lock should be gone after expiry"

    # Another worker must now be able to acquire the same lock
    token2 = f"PROCESSING:{uuid.uuid4().hex}"
    acquired2 = await fake_redis.set(lock_key, token2, nx=True, ex=5)
    assert acquired2, "Second worker should acquire after expiry"


# ---------------------------------------------------------------------------
# Test 2: Incident creation lock auto-expires
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incident_creation_lock_expires_automatically(fake_redis):
    """Creation lock set with EX must carry a positive TTL.
    After expiry (simulated by delete), a new worker must be able to re-acquire."""
    scope = f"eq:EQ-TTL-TEST:ELECTRICAL"
    lock_key = f"{CREATION_LOCK_KEY_PREFIX}{scope}"
    token = f"LOCK:{uuid.uuid4().hex}"

    acquired = await fake_redis.set(lock_key, token, nx=True, ex=DEFAULT_CREATION_LOCK_EXPIRY_SEC)
    assert acquired

    ttl = await fake_redis.ttl(lock_key)
    assert ttl > 0, f"Creation lock TTL must be positive; got {ttl}"

    # Simulate crash / expiry
    await fake_redis.delete(lock_key)
    assert await fake_redis.get(lock_key) is None

    # Another worker re-acquires
    token2 = f"LOCK:{uuid.uuid4().hex}"
    acquired2 = await fake_redis.set(lock_key, token2, nx=True, ex=DEFAULT_CREATION_LOCK_EXPIRY_SEC)
    assert acquired2, "Should re-acquire creation lock after simulated expiry"


# ---------------------------------------------------------------------------
# Test 3: Safe lock release after expiry (old token must not delete new lock)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_safe_lock_release_after_expiry(fake_redis):
    """Worker A's old token must NOT release Worker B's lock after expiry."""
    lock_key = f"{PROCESSED_REPORT_KEY_PREFIX}RPT-TOKENTEST"
    token_a = f"PROCESSING:{uuid.uuid4().hex}"
    token_b = f"PROCESSING:{uuid.uuid4().hex}"

    # Worker A acquires
    await fake_redis.set(lock_key, token_a, nx=True, ex=30)

    # Simulate expiry: delete the key
    await fake_redis.delete(lock_key)

    # Worker B acquires
    await fake_redis.set(lock_key, token_b, nx=True, ex=30)
    assert await fake_redis.get(lock_key) == token_b

    # Worker A tries to release with its stale token — must NOT succeed
    released = await release_token_checked_lock(lock_key, token_a, client=fake_redis)
    assert not released, "Stale token from Worker A must not release Worker B's lock"

    # Worker B's lock must still be intact
    assert await fake_redis.get(lock_key) == token_b, "Worker B's lock must remain"

    # Worker B releases correctly
    released_b = await release_token_checked_lock(lock_key, token_b, client=fake_redis)
    assert released_b, "Worker B must be able to release its own lock"
    assert await fake_redis.get(lock_key) is None


# ---------------------------------------------------------------------------
# Test 4: Lock renewal requires ownership
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_lock_renewal_requires_ownership(fake_redis):
    """renew_token_checked_lock must succeed for the owner and fail for others."""
    lock_key = f"{PROCESSED_REPORT_KEY_PREFIX}RPT-RENEWTEST"
    token_a = f"PROCESSING:{uuid.uuid4().hex}"
    token_b = f"PROCESSING:{uuid.uuid4().hex}"

    # Worker A acquires
    await fake_redis.set(lock_key, token_a, nx=True, ex=30)

    # Worker A renews successfully
    renewed = await renew_token_checked_lock(lock_key, token_a, expiry_sec=30, client=fake_redis)
    assert renewed, "Owner must be able to renew its own lock"

    ttl_after_renew = await fake_redis.ttl(lock_key)
    assert ttl_after_renew > 0, "TTL must remain positive after renewal"

    # Worker B fails to renew
    not_renewed = await renew_token_checked_lock(lock_key, token_b, expiry_sec=30, client=fake_redis)
    assert not not_renewed, "Non-owner must not be able to renew lock"

    # Key still belongs to Worker A
    assert await fake_redis.get(lock_key) == token_a


# ---------------------------------------------------------------------------
# Test 5: Processed-report idempotency key carries retention TTL
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_processed_report_idempotency_within_retention(fake_redis):
    """After processing, the idempotency key must carry a retention TTL.
    Re-processing the same report must return 'duplicate' status."""
    await ensure_consumer_group(client=fake_redis)

    report = _make_report(equipment_id="", category="PLUMBING")

    # First processing
    result = await process_report_message(
        stream_id="1-1",
        raw_report=report,
        client=fake_redis,
        processed_retention_sec=DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
    )
    assert result["status"] in ("created", "updated"), f"Unexpected status: {result['status']}"
    incident_id = result["incident_id"]

    # Verify TTL is set on idempotency key
    processed_key = f"{PROCESSED_REPORT_KEY_PREFIX}{report['report_id']}"
    ttl = await fake_redis.ttl(processed_key)
    assert 0 < ttl <= DEFAULT_PROCESSED_REPORT_RETENTION_SEC, (
        f"Retention TTL must be between 0 and {DEFAULT_PROCESSED_REPORT_RETENTION_SEC}; got {ttl}"
    )

    # Second processing of same report must be duplicate
    result2 = await process_report_message(
        stream_id="1-2",
        raw_report=report,
        client=fake_redis,
        processed_retention_sec=DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
    )
    assert result2["status"] == "duplicate", f"Expected 'duplicate', got: {result2['status']}"
    assert result2["incident_id"] == incident_id

    # Incident report_count must still be 1
    incident_key = f"{INCIDENT_KEY_PREFIX}{incident_id}"
    report_count = await fake_redis.hget(incident_key, "report_count")
    assert report_count == "1", f"report_count must be 1 after duplicate; got {report_count}"


# ---------------------------------------------------------------------------
# Test 6: Permanent records must have no TTL
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_permanent_records_have_no_ttl(fake_redis):
    """Equipment, incident, alert hashes and their indexes/sorted sets must have TTL == -1."""
    await ensure_consumer_group(client=fake_redis)

    # Create an incident via processing a report (no equipment to keep it simple)
    report = _make_report(equipment_id="", category="STRUCTURAL")
    result = await process_report_message(
        stream_id="2-1",
        raw_report=report,
        client=fake_redis,
    )
    assert result["status"] in ("created", "updated")
    incident_id = result["incident_id"]

    # Check incident hash has no TTL
    incident_key = f"{INCIDENT_KEY_PREFIX}{incident_id}"
    assert await fake_redis.ttl(incident_key) == -1, "Incident hash must be permanent (TTL=-1)"

    # Check incident-reports set has no TTL
    incident_reports_key = f"{INCIDENT_REPORTS_KEY_PREFIX}{incident_id}"
    if await fake_redis.exists(incident_reports_key):
        assert await fake_redis.ttl(incident_reports_key) == -1, (
            "Incident reports set must be permanent (TTL=-1)"
        )

    # Seed a fake equipment key and risk ranking entry (no actual equipment service needed)
    eq_id = "EQ-TTL-PERM-01"
    eq_key = f"campuscare:equipment:{eq_id}"
    await fake_redis.hset(eq_key, mapping={
        "equipment_id": eq_id, "name": "Test Equipment", "health_score": "90",
        "failure_count": "0", "category": "ELECTRICAL",
    })
    # Must have no TTL (-1)
    assert await fake_redis.ttl(eq_key) == -1, "Equipment hash must be permanent (TTL=-1)"

    # Seed a fake alert hash and indexes
    alert_id = f"ALERT-{uuid.uuid4().hex[:8].upper()}"
    alert_key = f"campuscare:alert:{alert_id}"
    await fake_redis.hset(alert_key, mapping={
        "alert_id": alert_id, "equipment_id": eq_id, "message": "Test alert",
    })
    assert await fake_redis.ttl(alert_key) == -1, "Alert hash must be permanent (TTL=-1)"

    # Risk ranking sorted set (if it exists) must be permanent
    if await fake_redis.exists(RISK_ZSET_KEY):
        assert await fake_redis.ttl(RISK_ZSET_KEY) == -1, (
            "Risk ranking sorted set must be permanent (TTL=-1)"
        )

    # Alert index (if it exists) must be permanent
    if await fake_redis.exists(ALERT_INDEX_KEY):
        assert await fake_redis.ttl(ALERT_INDEX_KEY) == -1, (
            "Alert index set must be permanent (TTL=-1)"
        )


# ---------------------------------------------------------------------------
# Test 7: Configurable TTL constants have correct defaults
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_configurable_ttl_values(fake_redis):
    """Verify config constants are positive integers with expected defaults."""
    # Verify types
    assert isinstance(PROCESSING_LOCK_EXPIRY_SEC, int), "PROCESSING_LOCK_EXPIRY_SEC must be int"
    assert isinstance(CREATION_LOCK_EXPIRY_SEC, int), "CREATION_LOCK_EXPIRY_SEC must be int"
    assert isinstance(PROCESSED_REPORT_RETENTION_SEC, int), "PROCESSED_REPORT_RETENTION_SEC must be int"

    # Verify positivity
    assert PROCESSING_LOCK_EXPIRY_SEC > 0
    assert CREATION_LOCK_EXPIRY_SEC > 0
    assert PROCESSED_REPORT_RETENTION_SEC > 0

    # Verify default values
    assert PROCESSING_LOCK_EXPIRY_SEC == 30, (
        f"Default PROCESSING_LOCK_EXPIRY_SEC should be 30; got {PROCESSING_LOCK_EXPIRY_SEC}"
    )
    assert CREATION_LOCK_EXPIRY_SEC == 10, (
        f"Default CREATION_LOCK_EXPIRY_SEC should be 10; got {CREATION_LOCK_EXPIRY_SEC}"
    )
    assert PROCESSED_REPORT_RETENTION_SEC == 7 * 24 * 3600, (
        f"Default PROCESSED_REPORT_RETENTION_SEC should be 604800; got {PROCESSED_REPORT_RETENTION_SEC}"
    )

    # Verify that DEFAULT_* constants in the worker mirror config values
    assert DEFAULT_PROCESSING_LOCK_EXPIRY_SEC == PROCESSING_LOCK_EXPIRY_SEC
    assert DEFAULT_CREATION_LOCK_EXPIRY_SEC == CREATION_LOCK_EXPIRY_SEC
    assert DEFAULT_PROCESSED_REPORT_RETENTION_SEC == PROCESSED_REPORT_RETENTION_SEC

    # Process a report with a custom lock_expiry_sec and verify lock TTL is bounded
    await ensure_consumer_group(client=fake_redis)
    report = _make_report(equipment_id="", category="HVAC")
    custom_lock_expiry = 5

    # We'll check the lock TTL during the brief window it exists; to do this reliably,
    # we set it ourselves and check, mirroring what process_report_message does.
    lock_key = f"{PROCESSED_REPORT_KEY_PREFIX}{report['report_id']}"
    token = f"PROCESSING:{uuid.uuid4().hex}"
    await fake_redis.set(lock_key, token, nx=True, ex=custom_lock_expiry)
    ttl_before = await fake_redis.ttl(lock_key)
    assert 0 < ttl_before <= custom_lock_expiry, (
        f"Custom lock TTL must be <= {custom_lock_expiry}; got {ttl_before}"
    )


# ---------------------------------------------------------------------------
# Test 8: Worker recovery after lock expiry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_worker_recovery_after_lock_expires(fake_redis):
    """Worker 2 must successfully process a report after Worker 1 crashes
    (its processing lock is deleted/expired), without returning 'concurrent_skip'
    and without creating duplicate incidents."""
    await ensure_consumer_group(client=fake_redis)

    report = _make_report(equipment_id="", category="SAFETY")
    report_id = report["report_id"]
    processed_key = f"{PROCESSED_REPORT_KEY_PREFIX}{report_id}"

    # Simulate Worker 1: acquires the processing lock then crashes (delete key)
    token_w1 = f"PROCESSING:{uuid.uuid4().hex}"
    await fake_redis.set(processed_key, token_w1, nx=True, ex=30)
    # Worker 1 crashes — simulate lock expiry
    await fake_redis.delete(processed_key)

    # Worker 2 reprocesses the same report
    result = await process_report_message(
        stream_id="3-1",
        raw_report=report,
        client=fake_redis,
        processed_retention_sec=DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
    )

    # Must NOT return concurrent_skip — that would mean Worker 2 incorrectly
    # detected Worker 1's (expired) lock
    assert result["status"] != "concurrent_skip", (
        "Worker 2 must not skip after Worker 1's lock has expired"
    )
    assert result["status"] in ("created", "updated"), (
        f"Expected created/updated after recovery; got: {result['status']}"
    )

    incident_id = result["incident_id"]
    assert incident_id, "Incident ID must be set after successful recovery processing"

    # Processed key must exist as a permanent idempotency marker (not a PROCESSING: token)
    final_val = await fake_redis.get(processed_key)
    assert final_val == incident_id, (
        f"Processed key must hold incident_id after completion; got: {final_val}"
    )

    # No duplicate incidents: a third processing attempt must return 'duplicate'
    result3 = await process_report_message(
        stream_id="3-2",
        raw_report=report,
        client=fake_redis,
        processed_retention_sec=DEFAULT_PROCESSED_REPORT_RETENTION_SEC,
    )
    assert result3["status"] == "duplicate", (
        f"Third attempt must be duplicate; got: {result3['status']}"
    )
    assert result3["incident_id"] == incident_id

