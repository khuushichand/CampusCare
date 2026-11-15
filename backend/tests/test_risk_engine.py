import pytest
import fakeredis
from app.services.risk_service import (
    calculate_risk_score,
    recalculate_all_risks,
    get_risk_ranking,
    HIGH_RISK_THRESHOLD,
    RISK_ZSET_KEY,
)
from app.config import RISK_ALERT_THRESHOLD
from app.services.alert_service import get_all_alerts, ACTIVE_ALERTS_KEY


@pytest.fixture
def fake_redis():
    """Provides an isolated in-memory async Redis instance for each test."""
    server = fakeredis.FakeServer()
    client = fakeredis.FakeAsyncRedis(server=server, decode_responses=True)
    yield client


@pytest.mark.asyncio
async def test_deterministic_identical_input_repeated_calculations(fake_redis):
    """
    Test 1: Same input produces the same score across repeated calculations.
    Ensures no recursive dependency on prior risk_score.
    """
    eq_id = "EQ-DET-01"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "name": "Projector",
            "failure_count": "2",
            "health_score": "80",
            "risk_score": "0",  # Initial arbitrary value
        },
    )

    # First calculation: min(2*10, 50) + (100-80)*0.5 = 20 + 10 = 30.0
    score1 = await calculate_risk_score(eq_id, client=fake_redis)
    assert score1 == 30.0

    # Second calculation: with risk_score now stored as 30.0, running again MUST yield 30.0
    score2 = await calculate_risk_score(eq_id, client=fake_redis)
    assert score2 == 30.0

    # Third calculation: must still yield 30.0
    score3 = await calculate_risk_score(eq_id, client=fake_redis)
    assert score3 == 30.0


@pytest.mark.asyncio
async def test_changing_equipment_metrics_changes_score(fake_redis):
    """
    Test 2: Changing equipment metrics changes the score appropriately.
    Higher failures and lower health increase risk score; improving health decreases it.
    """
    eq_id = "EQ-DYN-01"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "name": "HVAC Unit",
            "failure_count": "1",
            "health_score": "90",
        },
    )

    # Initial score: min(1*10, 50) + (100-90)*0.5 = 10 + 5 = 15.0
    score_initial = await calculate_risk_score(eq_id, client=fake_redis)
    assert score_initial == 15.0

    # Increase failure_count to 3
    await fake_redis.hset(f"campuscare:equipment:{eq_id}", "failure_count", "3")
    # Score: min(3*10, 50) + 5 = 30 + 5 = 35.0
    score_after_failures = await calculate_risk_score(eq_id, client=fake_redis)
    assert score_after_failures == 35.0
    assert score_after_failures > score_initial

    # Degrade health_score from 90 to 40
    await fake_redis.hset(f"campuscare:equipment:{eq_id}", "health_score", "40")
    # Score: 30 + (100-40)*0.5 = 30 + 30 = 60.0
    score_after_health_drop = await calculate_risk_score(eq_id, client=fake_redis)
    assert score_after_health_drop == 60.0
    assert score_after_health_drop > score_after_failures

    # Maintain equipment: health restored to 100
    await fake_redis.hset(f"campuscare:equipment:{eq_id}", "health_score", "100")
    # Score: 30 + 0 = 30.0
    score_repaired = await calculate_risk_score(eq_id, client=fake_redis)
    assert score_repaired == 30.0
    assert score_repaired < score_after_health_drop


@pytest.mark.asyncio
async def test_risk_score_stays_within_bounds(fake_redis):
    """
    Test 3: Risk score strictly stays within 0 to 100 for extreme values.
    """
    # Perfect equipment
    eq_best = "EQ-BEST"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_best}",
        mapping={
            "id": eq_best,
            "failure_count": "0",
            "health_score": "100",
        },
    )
    score_best = await calculate_risk_score(eq_best, client=fake_redis)
    assert score_best == 0.0

    # Excessively failed / completely broken equipment
    eq_worst = "EQ-WORST"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_worst}",
        mapping={
            "id": eq_worst,
            "failure_count": "999",  # Capped at 50
            "health_score": "-50",   # Clamped to 0 -> 50
        },
    )
    score_worst = await calculate_risk_score(eq_worst, client=fake_redis)
    assert score_worst == 100.0


@pytest.mark.asyncio
async def test_threshold_triggers_and_resolves_alerts(fake_redis):
    """
    Test 4: Threshold triggers alerts correctly and resolves them when risk falls below.
    Verifies authoritative threshold from config is respected.
    """
    assert HIGH_RISK_THRESHOLD == RISK_ALERT_THRESHOLD == 80

    eq_id = "EQ-ALERT-01"
    # Create equipment that will score >= 80:
    # failure_count = 5 (50 pts), health_score = 30 ((100-30)*0.5 = 35 pts) -> 85.0
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "name": "Centrifuge",
            "failure_count": "5",
            "health_score": "30",
        },
    )

    high_score = await calculate_risk_score(eq_id, client=fake_redis)
    assert high_score == 85.0
    assert high_score >= HIGH_RISK_THRESHOLD

    # Verify active alert created
    alerts = await get_all_alerts(client=fake_redis)
    active_alerts = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert len(active_alerts) == 1
    alert_id = list(active_alerts)[0]
    alert_data = await fake_redis.hgetall(f"campuscare:alert:{alert_id}")
    assert alert_data["equipment_id"] == eq_id
    assert alert_data["status"] == "ACTIVE"
    assert alert_data["title"] == "High equipment risk"

    # Now repair equipment so risk drops below threshold:
    # health_score = 90 -> failure_count=5 (50 pts) + (100-90)*0.5 (5 pts) = 55.0 (< 80)
    await fake_redis.hset(f"campuscare:equipment:{eq_id}", "health_score", "90")
    low_score = await calculate_risk_score(eq_id, client=fake_redis)
    assert low_score == 55.0
    assert low_score < HIGH_RISK_THRESHOLD

    # Alert should now be resolved and removed from active set
    active_alerts_after = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert len(active_alerts_after) == 0
    resolved_alert_data = await fake_redis.hgetall(f"campuscare:alert:{alert_id}")
    assert resolved_alert_data["status"] == "RESOLVED"


@pytest.mark.asyncio
async def test_recalculation_does_not_create_duplicate_alerts(fake_redis):
    """
    Test 5: Recalculation does not create duplicate alerts.
    """
    eq_id = "EQ-DEDUP-01"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "name": "Elevator",
            "failure_count": "6",
            "health_score": "20",
        },
    )

    # First calculation triggers alert
    await calculate_risk_score(eq_id, client=fake_redis)
    alerts_pass1 = await fake_redis.smembers("campuscare:alerts:index")
    assert len(alerts_pass1) == 1

    # Second calculation on same high-risk equipment must NOT create a new alert record
    await calculate_risk_score(eq_id, client=fake_redis)
    alerts_pass2 = await fake_redis.smembers("campuscare:alerts:index")
    assert len(alerts_pass2) == 1

    active_alerts = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert len(active_alerts) == 1


@pytest.mark.asyncio
async def test_risk_ranking_reflects_updated_scores(fake_redis):
    """
    Test 6: Risk ranking reflects updated scores in descending order.
    """
    # Seed 3 equipments in index and hashes
    equipments = [
        ("EQ-1", "0", "90"),  # 0 + 5 = 5.0
        ("EQ-2", "3", "50"),  # 30 + 25 = 55.0
        ("EQ-3", "5", "10"),  # 50 + 45 = 95.0
    ]

    for eq_id, fc, hs in equipments:
        await fake_redis.sadd("campuscare:equipment:index", eq_id)
        await fake_redis.hset(
            f"campuscare:equipment:{eq_id}",
            mapping={
                "id": eq_id,
                "name": f"Device {eq_id}",
                "failure_count": fc,
                "health_score": hs,
            },
        )

    # Recalculate all
    results = await recalculate_all_risks(client=fake_redis)
    assert len(results) == 3

    # Fetch ranking
    ranking = await get_risk_ranking(client=fake_redis)
    assert len(ranking) == 3
    # Top score should be EQ-3 (95.0), then EQ-2 (55.0), then EQ-1 (5.0)
    assert ranking[0]["equipment_id"] == "EQ-3"
    assert ranking[0]["risk_score"] == 95.0
    assert ranking[1]["equipment_id"] == "EQ-2"
    assert ranking[1]["risk_score"] == 55.0
    assert ranking[2]["equipment_id"] == "EQ-1"
    assert ranking[2]["risk_score"] == 5.0


@pytest.mark.asyncio
async def test_missing_metric_values_handled_safely(fake_redis):
    """
    Test 7: Missing or invalid metric values are handled safely without crashing.
    """
    eq_missing = "EQ-MISSING"
    # Equipment hash with missing fields and non-numeric garbage
    await fake_redis.hset(
        f"campuscare:equipment:{eq_missing}",
        mapping={
            "id": eq_missing,
            "name": "Corrupted Device",
            "failure_count": "invalid_number",
            # health_score omitted
        },
    )

    score = await calculate_risk_score(eq_missing, client=fake_redis)
    # failure_count defaults to 0 -> 0 pts
    # health_score defaults to 100.0 -> (100 - 100)*0.5 = 0 pts
    assert score == 0.0

    # Equipment with empty string fields
    eq_empty = "EQ-EMPTY"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_empty}",
        mapping={
            "id": eq_empty,
            "failure_count": "",
            "health_score": "",
        },
    )
    score_empty = await calculate_risk_score(eq_empty, client=fake_redis)
    assert score_empty == 0.0

    # Non-existent equipment raises ValueError
    with pytest.raises(ValueError):
        await calculate_risk_score("EQ-NONEXISTENT", client=fake_redis)


@pytest.mark.asyncio
async def test_alert_reactivation_and_resolution_atomicity(fake_redis):
    """
    Test 8: Verifies alert creation, reactivation, and resolution atomicity
    between the alert Redis hash and the active alerts index set (campuscare:alerts:active).
    """
    from app.services.alert_service import (
        create_alert,
        update_alert_status,
        resolve_high_risk_alerts,
        ACTIVE_ALERTS_KEY,
        ALERT_INDEX_KEY,
    )

    eq_id = "EQ-ATOM-01"
    title = "High equipment risk"
    message = "Equipment exceeded threshold"

    # 1. Initial Creation
    alert = await create_alert(
        equipment_id=eq_id,
        title=title,
        message=message,
        severity="HIGH",
        client=fake_redis,
    )
    alert_id = alert["alert_id"]

    # Verify both hash and active set
    hash_data = await fake_redis.hgetall(f"campuscare:alert:{alert_id}")
    assert hash_data["status"] == "ACTIVE"
    active_ids = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert alert_id in active_ids

    # 2. Resolution via update_alert_status
    updated = await update_alert_status(alert_id, "RESOLVED", client=fake_redis)
    assert updated["status"] == "RESOLVED"
    hash_data_resolved = await fake_redis.hgetall(f"campuscare:alert:{alert_id}")
    assert hash_data_resolved["status"] == "RESOLVED"
    active_ids_after_res = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert alert_id not in active_ids_after_res

    # 3. Reactivation via create_alert
    reactivated = await create_alert(
        equipment_id=eq_id,
        title=title,
        message="Re-triggered alert",
        severity="CRITICAL",
        client=fake_redis,
    )
    assert reactivated["alert_id"] == alert_id
    assert reactivated["status"] == "ACTIVE"
    assert reactivated["severity"] == "CRITICAL"

    # Verify hash and active set are in sync
    hash_data_reactivated = await fake_redis.hgetall(f"campuscare:alert:{alert_id}")
    assert hash_data_reactivated["status"] == "ACTIVE"
    assert hash_data_reactivated["severity"] == "CRITICAL"
    active_ids_after_reactivate = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert alert_id in active_ids_after_reactivate

    # 4. Resolution via resolve_high_risk_alerts
    resolved_list = await resolve_high_risk_alerts(eq_id, client=fake_redis)
    assert alert_id in resolved_list

    hash_data_final = await fake_redis.hgetall(f"campuscare:alert:{alert_id}")
    assert hash_data_final["status"] == "RESOLVED"
    active_ids_final = await fake_redis.smembers(ACTIVE_ALERTS_KEY)
    assert alert_id not in active_ids_final

