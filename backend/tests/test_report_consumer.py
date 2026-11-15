import asyncio
import pytest
import fakeredis
from app.workers.report_consumer import (
    ensure_consumer_group,
    process_report_message,
    process_batch,
    run_worker,
    recover_pending_messages,
    find_matching_incident,
    release_token_checked_lock,
    renew_token_checked_lock,
    REPORT_STREAM,
    CONSUMER_GROUP_NAME,
    INCIDENT_KEY_PREFIX,
    PROCESSED_REPORT_KEY_PREFIX,
    INCIDENT_REPORTS_KEY_PREFIX,
)
from app.services.risk_service import calculate_risk_score


@pytest.fixture
def fake_redis():
    """Provides an isolated in-memory async Redis instance for each test."""
    server = fakeredis.FakeServer()
    client = fakeredis.FakeAsyncRedis(server=server, decode_responses=True)
    yield client


@pytest.mark.asyncio
async def test_new_incident_creation(fake_redis):
    """
    Test 1: New incident creation.
    When a student report is processed and no related active incident exists,
    a new incident hash should be created and the report should be linked.
    """
    await ensure_consumer_group(client=fake_redis)

    report_data = {
        "report_id": "REP-001",
        "student_id": "STU-100",
        "title": "Broken AC cooling",
        "description": "AC is blowing hot air",
        "category": "HVAC",
        "location": "Room 301",
        "equipment_id": "AC-301",
    }

    result = await process_report_message(
        stream_id="1-0",
        raw_report=report_data,
        client=fake_redis,
    )

    assert result["status"] == "created"
    assert result["report_id"] == "REP-001"
    incident_id = result["incident_id"]
    assert incident_id.startswith("INC-")

    # Verify incident hash in Redis
    incident = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{incident_id}")
    assert incident["incident_id"] == incident_id
    assert incident["report_id"] == "REP-001"
    assert incident["equipment_id"] == "AC-301"
    assert incident["category"] == "HVAC"
    assert incident["location"] == "Room 301"
    assert incident["status"] == "OPEN"
    assert incident["report_count"] == "1"

    # Verify report relationship set
    reports = await fake_redis.smembers(f"{INCIDENT_REPORTS_KEY_PREFIX}{incident_id}")
    assert "REP-001" in reports


@pytest.mark.asyncio
async def test_related_report_grouping_with_equipment(fake_redis):
    """
    Test 2: Related report grouping (with equipment_id).
    Subsequent reports concerning the same equipment and issue category
    must be grouped into the existing active incident.
    """
    await ensure_consumer_group(client=fake_redis)

    # First report
    rep1 = {
        "report_id": "REP-AC-1",
        "student_id": "STU-101",
        "title": "AC not turning on",
        "description": "No power",
        "category": "HVAC",
        "location": "Block A Lab 1",
        "equipment_id": "EQ-AC-01",
    }
    res1 = await process_report_message("1-0", rep1, client=fake_redis)
    assert res1["status"] == "created"
    incident_id_1 = res1["incident_id"]

    # Second report with same equipment and same category
    rep2 = {
        "report_id": "REP-AC-2",
        "student_id": "STU-102",
        "title": "AC still dead",
        "description": "Still won't start",
        "category": "HVAC",
        "location": "Block A Lab 1",
        "equipment_id": "EQ-AC-01",
    }
    res2 = await process_report_message("2-0", rep2, client=fake_redis)
    assert res2["status"] == "updated"
    assert res2["incident_id"] == incident_id_1

    # Check updated incident fields
    incident = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{incident_id_1}")
    assert incident["report_count"] == "2"
    assert incident["latest_report_id"] == "REP-AC-2"

    # Check both reports are in relationship set
    linked = await fake_redis.smembers(f"{INCIDENT_REPORTS_KEY_PREFIX}{incident_id_1}")
    assert linked == {"REP-AC-1", "REP-AC-2"}


@pytest.mark.asyncio
async def test_related_report_grouping_without_equipment(fake_redis):
    """
    Test 2b: Related report grouping without equipment_id.
    Reports sharing the same category and location (when equipment_id is absent)
    should be grouped into the same incident.
    """
    await ensure_consumer_group(client=fake_redis)

    rep1 = {
        "report_id": "REP-NOEQ-1",
        "student_id": "STU-201",
        "title": "Water leakage near door",
        "description": "Puddle forming",
        "category": "Plumbing",
        "location": "Library 2nd Floor Restroom",
        "equipment_id": "",
    }
    res1 = await process_report_message("10-0", rep1, client=fake_redis)
    assert res1["status"] == "created"

    rep2 = {
        "report_id": "REP-NOEQ-2",
        "student_id": "STU-202",
        "title": "Water dripping from pipe",
        "description": "Pipe leaking",
        "category": "Plumbing",
        "location": "Library 2nd Floor Restroom",
        "equipment_id": "",
    }
    res2 = await process_report_message("11-0", rep2, client=fake_redis)
    assert res2["status"] == "updated"
    assert res2["incident_id"] == res1["incident_id"]

    linked = await fake_redis.smembers(f"{INCIDENT_REPORTS_KEY_PREFIX}{res1['incident_id']}")
    assert linked == {"REP-NOEQ-1", "REP-NOEQ-2"}


@pytest.mark.asyncio
async def test_unrelated_report_separation(fake_redis):
    """
    Test 3: Unrelated report separation.
    Reports with different categories at the same location must NOT be merged.
    Reports with different equipment must NOT be merged.
    """
    await ensure_consumer_group(client=fake_redis)

    # Report A: Plumbing in Room 101
    rep_a = {
        "report_id": "REP-A",
        "student_id": "STU-01",
        "title": "Sink clogged",
        "description": "Water overflowing",
        "category": "Plumbing",
        "location": "Room 101",
        "equipment_id": "",
    }
    res_a = await process_report_message("21-0", rep_a, client=fake_redis)

    # Report B: Electrical in the SAME Room 101
    rep_b = {
        "report_id": "REP-B",
        "student_id": "STU-02",
        "title": "Flickering lights",
        "description": "Tube light flickering",
        "category": "Electrical",
        "location": "Room 101",
        "equipment_id": "",
    }
    res_b = await process_report_message("22-0", rep_b, client=fake_redis)

    # Must create separate incidents
    assert res_a["incident_id"] != res_b["incident_id"]
    assert res_a["status"] == "created"
    assert res_b["status"] == "created"

    # Report C: Different equipment in same category
    rep_c1 = {
        "report_id": "REP-C1",
        "student_id": "STU-03",
        "title": "PC 1 broken",
        "description": "Dead screen",
        "category": "IT",
        "location": "Lab 1",
        "equipment_id": "PC-01",
    }
    rep_c2 = {
        "report_id": "REP-C2",
        "student_id": "STU-04",
        "title": "PC 2 broken",
        "description": "Dead screen",
        "category": "IT",
        "location": "Lab 1",
        "equipment_id": "PC-02",
    }
    res_c1 = await process_report_message("23-0", rep_c1, client=fake_redis)
    res_c2 = await process_report_message("24-0", rep_c2, client=fake_redis)

    assert res_c1["incident_id"] != res_c2["incident_id"]


@pytest.mark.asyncio
async def test_duplicate_event_processing_idempotency(fake_redis):
    """
    Test 4: Duplicate event processing idempotency.
    Processing the exact same report twice should not create or increment incidents.
    """
    await ensure_consumer_group(client=fake_redis)

    rep = {
        "report_id": "REP-DUP-01",
        "student_id": "STU-DUP",
        "title": "Broken window latch",
        "description": "Window cannot lock",
        "category": "Carpentry",
        "location": "Hall 5",
        "equipment_id": "",
    }

    # First attempt
    res1 = await process_report_message("31-0", rep, client=fake_redis)
    assert res1["status"] == "created"
    incident_id = res1["incident_id"]

    inc_before = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{incident_id}")
    assert inc_before["report_count"] == "1"

    # Second attempt (replay/retry of same event)
    res2 = await process_report_message("31-0", rep, client=fake_redis)
    assert res2["status"] == "duplicate"
    assert res2["incident_id"] == incident_id

    # Verify incident state did NOT increment report_count
    inc_after = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{incident_id}")
    assert inc_after["report_count"] == "1"


@pytest.mark.asyncio
async def test_crash_before_ack_idempotency(fake_redis):
    """
    Test 4b: Idempotency when a worker crashes after updating an incident
    and setting final processed key, before acknowledging stream message.
    """
    await ensure_consumer_group(client=fake_redis)

    rep1 = {
        "report_id": "REP-BASE-1",
        "student_id": "STU-1",
        "title": "Fan not spinning",
        "description": "Dead fan",
        "category": "Electrical",
        "location": "Room 102",
        "equipment_id": "FAN-102",
    }
    res1 = await process_report_message("40-0", rep1, client=fake_redis)
    inc_id = res1["incident_id"]

    rep2 = {
        "report_id": "REP-CRASH-2",
        "student_id": "STU-2",
        "title": "Fan still dead",
        "description": "Nothing happens",
        "category": "Electrical",
        "location": "Room 102",
        "equipment_id": "FAN-102",
    }

    # First attempt successfully updates incident and sets processed key
    res2 = await process_report_message("41-0", rep2, client=fake_redis)
    assert res2["status"] == "updated"
    assert res2["incident_id"] == inc_id

    inc = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{inc_id}")
    assert inc["report_count"] == "2"

    # Worker crashes before XACK, message 41-0 is redelivered
    res2_replay = await process_report_message("41-0", rep2, client=fake_redis)
    assert res2_replay["status"] == "duplicate"
    assert res2_replay["incident_id"] == inc_id

    # report_count must remain 2, NOT 3
    inc_rechecked = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{inc_id}")
    assert inc_rechecked["report_count"] == "2"


@pytest.mark.asyncio
async def test_crash_interruption_before_processed_key_finalized(fake_redis):
    """
    Test 4c: Improved crash test simulating an actual worker crash right after
    updating the incident, but BEFORE the processed key is finalized (it remains as
    a processing lock token or expires).
    """
    await ensure_consumer_group(client=fake_redis)

    rep1 = {
        "report_id": "REP-INTR-1",
        "student_id": "STU-1",
        "title": "Water heater broken",
        "description": "Cold shower",
        "category": "Plumbing",
        "location": "Dorm 3",
        "equipment_id": "WH-03",
    }
    res1 = await process_report_message("45-0", rep1, client=fake_redis)
    inc_id = res1["incident_id"]

    rep2 = {
        "report_id": "REP-INTR-2",
        "student_id": "STU-2",
        "title": "Heater still cold",
        "description": "No hot water",
        "category": "Plumbing",
        "location": "Dorm 3",
        "equipment_id": "WH-03",
    }

    # Worker 1 starts processing rep2: acquires lock, updates incident via Lua, then crashes
    proc_key = f"{PROCESSED_REPORT_KEY_PREFIX}REP-INTR-2"
    worker_token = "PROCESSING:crashed-worker-token"
    await fake_redis.set(proc_key, worker_token, nx=True, ex=1)

    matching_inc = await find_matching_incident("Plumbing", "WH-03", "Dorm 3", client=fake_redis)
    assert matching_inc is not None
    # Report attached atomically
    from app.workers.report_consumer import attach_report_to_existing_incident
    await attach_report_to_existing_incident(matching_inc, rep2, client=fake_redis)

    inc = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{inc_id}")
    assert inc["report_count"] == "2"

    # Worker 1 crashed before final r.set(proc_key, inc_id). Lock expires.
    await fake_redis.delete(proc_key)

    # Worker 2 redelivers rep2: re-acquires lock, re-attaches, finalizes key
    res2_retry = await process_report_message("46-0", rep2, client=fake_redis)
    assert res2_retry["incident_id"] == inc_id

    # The Lua script ensures report_count remains 2, not incremented to 3
    inc_after_retry = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{inc_id}")
    assert inc_after_retry["report_count"] == "2"


@pytest.mark.asyncio
async def test_failed_processing_and_retry_behaviour(fake_redis):
    """
    Test 5: Failed processing and retry behaviour.
    An actual failed message is rejected initially (not acknowledged),
    subsequently retried after condition is resolved, successfully acknowledged,
    and its incident created only once.
    """
    stream_name = "campuscare:reports:test_fail"
    group_name = "test_retry_group"

    await ensure_consumer_group(
        client=fake_redis,
        stream_name=stream_name,
        group_name=group_name,
    )

    report_payload = {
        "report_id": "REP-RETRY-01",
        "student_id": "STU-999",
        "title": "Projector lamp failure",
        "description": "Blown bulb",
        "category": "Projector",
        "location": "Auditorium",
        "equipment_id": "PRJ-99",
    }

    msg_id = await fake_redis.xadd(stream_name, report_payload)

    # 1. Read message into consumer group PEL
    read_res = await fake_redis.xreadgroup(
        group_name,
        "consumer-1",
        {stream_name: ">"},
        count=1,
    )
    assert len(read_res[0][1]) == 1
    stream_id, raw_fields = read_res[0][1][0]

    # Simulate a transient failure during processing
    original_hset = fake_redis.hset
    async def failing_hset(*args, **kwargs):
        raise ConnectionError("Simulated Redis write timeout during processing")

    fake_redis.hset = failing_hset

    successes = await process_batch(
        [(stream_id, raw_fields)],
        consumer_name="consumer-1",
        stream_name=stream_name,
        group_name=group_name,
        client=fake_redis,
    )
    assert successes == 0

    # Restore healthy redis.hset
    fake_redis.hset = original_hset

    # Verify message was NOT acknowledged (still in PEL)
    pending_before = await fake_redis.xreadgroup(
        group_name,
        "consumer-1",
        {stream_name: "0"},
        count=10,
    )
    pending_ids = [m[0] for m in pending_before[0][1]]
    assert stream_id in pending_ids

    # 2. Retry processing of the pending message
    retry_successes = await process_batch(
        [(stream_id, raw_fields)],
        consumer_name="consumer-1",
        stream_name=stream_name,
        group_name=group_name,
        client=fake_redis,
    )
    assert retry_successes == 1

    # Verify message was acknowledged and removed from PEL
    pending_after = await fake_redis.xreadgroup(
        group_name,
        "consumer-1",
        {stream_name: "0"},
        count=10,
    )
    pending_after_ids = [m[0] for m in pending_after[0][1]]
    assert stream_id not in pending_after_ids

    # Verify incident was created exactly once
    incidents = []
    async for key in fake_redis.scan_iter(match=f"{INCIDENT_KEY_PREFIX}*"):
        if not key.startswith(INCIDENT_REPORTS_KEY_PREFIX):
            incidents.append(key)
    assert len(incidents) == 1

    # Confirm idempotency: a 3rd replay attempt does not create another incident
    res3 = await process_report_message(stream_id, raw_fields, client=fake_redis)
    assert res3["status"] == "duplicate"


@pytest.mark.asyncio
async def test_xautoclaim_pending_message_recovery(fake_redis):
    """
    Test 6: Verify XAUTOCLAIM recovers abandoned messages from another consumer.
    """
    stream_name = "campuscare:reports:claim_test"
    group_name = "claim_group"

    await ensure_consumer_group(client=fake_redis, stream_name=stream_name, group_name=group_name)

    # Consumer-A reads the message but crashes without acknowledging
    msg_id = await fake_redis.xadd(stream_name, {
        "report_id": "REP-CLAIM-1",
        "student_id": "STU-1",
        "title": "Broken bench",
        "description": "Leg snapped",
        "category": "Carpentry",
        "location": "Park",
        "equipment_id": "",
    })

    read_res = await fake_redis.xreadgroup(group_name, "consumer-A", {stream_name: ">"}, count=1)
    assert len(read_res[0][1]) == 1

    # Consumer-B runs recover_pending_messages with min_idle_time_ms=0
    recovered_count = await recover_pending_messages(
        consumer_name="consumer-B",
        stream_name=stream_name,
        group_name=group_name,
        min_idle_time_ms=0,
        batch_size=10,
        client=fake_redis,
    )

    assert recovered_count == 1

    # Verify message was acknowledged
    pending = await fake_redis.xreadgroup(group_name, "consumer-B", {stream_name: "0"}, count=10)
    assert len(pending[0][1]) == 0


@pytest.mark.asyncio
async def test_xautoclaim_pagination(fake_redis):
    """
    Test 6b: Verify XAUTOCLAIM pagination through multiple batches
    and proper cursor termination at '0-0'.
    """
    stream_name = "campuscare:reports:claim_page"
    group_name = "claim_page_group"

    await ensure_consumer_group(client=fake_redis, stream_name=stream_name, group_name=group_name)

    # Add 5 messages
    for i in range(5):
        await fake_redis.xadd(stream_name, {
            "report_id": f"REP-PAGE-{i}",
            "student_id": f"STU-{i}",
            "title": f"Issue {i}",
            "description": f"Details {i}",
            "category": "Maintenance",
            "location": "Block C",
            "equipment_id": "",
        })

    # Consumer A reads all 5 to place them in PEL
    await fake_redis.xreadgroup(group_name, "consumer-A", {stream_name: ">"}, count=5)

    # Consumer B recovers in batches of 2
    recovered_count = await recover_pending_messages(
        consumer_name="consumer-B",
        stream_name=stream_name,
        group_name=group_name,
        min_idle_time_ms=0,
        batch_size=2,
        client=fake_redis,
    )

    assert recovered_count == 5

    # Check PEL is empty
    pending = await fake_redis.xreadgroup(group_name, "consumer-B", {stream_name: "0"}, count=10)
    assert len(pending[0][1]) == 0


@pytest.mark.asyncio
async def test_risk_calculation_with_injected_client(fake_redis):
    """
    Test 7: Client consistency and risk calculation integration.
    Worker passes injected client to risk_service without altering historical failure_count.
    """
    eq_id = "EQ-PUMP-01"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "name": "Water Pump",
            "failure_count": "3",
            "health_score": "70",
            "risk_score": "10",
        },
    )

    report = {
        "report_id": "REP-RISK-1",
        "student_id": "STU-RISK",
        "title": "Pump loud noise",
        "description": "Vibrating heavily",
        "category": "Plumbing",
        "location": "Basement",
        "equipment_id": eq_id,
    }

    res = await process_report_message("50-0", report, client=fake_redis)
    assert res["status"] == "created"

    # Verify failure_count was NOT incremented
    eq_after = await fake_redis.hgetall(f"campuscare:equipment:{eq_id}")
    assert eq_after["failure_count"] == "3"

    # Verify risk_score was recalculated deterministically:
    # min(3*10, 50) + (100-70)*0.5 = 30 + 15 = 45.0
    risk_score = float(eq_after["risk_score"])
    assert risk_score == 45.0

    # Verify ranking sorted set was updated
    ranking_score = await fake_redis.zscore("campuscare:risk:ranking", eq_id)
    assert ranking_score == 45.0


@pytest.mark.asyncio
async def test_expired_processing_locks(fake_redis):
    """
    Test 8: Expired processing locks.
    If a worker acquires a lock with a short TTL and crashes, another worker can
    acquire the lock once expired without being blocked forever.
    """
    proc_key = f"{PROCESSED_REPORT_KEY_PREFIX}REP-EXP-1"
    # Worker 1 acquires with 1 second TTL
    token_1 = "PROCESSING:worker-1"
    await fake_redis.set(proc_key, token_1, nx=True, ex=1)

    # Attempt by worker 2 fails while unexpired
    token_2 = "PROCESSING:worker-2"
    acquired_early = await fake_redis.set(proc_key, token_2, nx=True, ex=5)
    assert not acquired_early

    # Simulate lock expiration
    await fake_redis.delete(proc_key)

    # Worker 2 now acquires successfully
    acquired_after_expiry = await fake_redis.set(proc_key, token_2, nx=True, ex=5)
    assert acquired_after_expiry is True


@pytest.mark.asyncio
async def test_lock_ownership_and_safe_release(fake_redis):
    """
    Test 9: Lock ownership and safe release.
    A worker cannot release another worker's lock when tokens differ.
    Only the owning worker can release it.
    """
    key = "test:lock:key"
    token_owner = "TOKEN-A"
    token_imposter = "TOKEN-B"

    await fake_redis.set(key, token_owner)

    # Imposter attempts release
    released_imposter = await release_token_checked_lock(key, token_imposter, client=fake_redis)
    assert released_imposter is False
    assert await fake_redis.get(key) == token_owner

    # Owner attempts release
    released_owner = await release_token_checked_lock(key, token_owner, client=fake_redis)
    assert released_owner is True
    assert await fake_redis.get(key) is None


@pytest.mark.asyncio
async def test_concurrent_reports_same_incident(fake_redis):
    """
    Test 10: Concurrent incident creation protection.
    When two different reports for the same equipment and category arrive
    simultaneously, only ONE incident is created and the second is attached.
    """
    await ensure_consumer_group(client=fake_redis)

    rep_a = {
        "report_id": "REP-RACE-A",
        "student_id": "STU-A",
        "title": "AC smoke",
        "description": "Smoke coming from AC unit",
        "category": "HVAC",
        "location": "Room 501",
        "equipment_id": "AC-501",
    }
    rep_b = {
        "report_id": "REP-RACE-B",
        "student_id": "STU-B",
        "title": "AC burning smell",
        "description": "Smells like burnt plastic",
        "category": "HVAC",
        "location": "Room 501",
        "equipment_id": "AC-501",
    }

    # Execute both processes concurrently
    res_a, res_b = await asyncio.gather(
        process_report_message("60-0", rep_a, client=fake_redis),
        process_report_message("61-0", rep_b, client=fake_redis),
    )

    # One must be created, the other updated to the same incident ID
    assert res_a["incident_id"] == res_b["incident_id"]
    actions = {res_a["status"], res_b["status"]}
    assert actions == {"created", "updated"}

    # Verify report_count is 2
    inc = await fake_redis.hgetall(f"{INCIDENT_KEY_PREFIX}{res_a['incident_id']}")
    assert inc["report_count"] == "2"

    # Only one incident hash should exist in Redis
    incidents = []
    async for key in fake_redis.scan_iter(match=f"{INCIDENT_KEY_PREFIX}*"):
        if not key.startswith(INCIDENT_REPORTS_KEY_PREFIX):
            incidents.append(key)
    assert len(incidents) == 1


@pytest.mark.asyncio
async def test_busygroup_consumer_group_creation(fake_redis):
    """
    Test 11: Safe consumer group creation handles BUSYGROUP cleanly.
    """
    stream_name = "campuscare:reports:busy_test"
    group_name = "test_busy_group"

    # First creation
    await ensure_consumer_group(client=fake_redis, stream_name=stream_name, group_name=group_name)

    # Second creation should catch BUSYGROUP without raising
    await ensure_consumer_group(client=fake_redis, stream_name=stream_name, group_name=group_name)
