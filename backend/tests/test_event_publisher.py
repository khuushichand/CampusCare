import asyncio
import json
import pytest
import fakeredis

from app.services.event_publisher import (
    publish_event,
    DEFAULT_EVENTS_CHANNEL,
    EVENT_INCIDENT_CREATED,
    EVENT_INCIDENT_UPDATED,
    EVENT_ALERT_CREATED,
    EVENT_ALERT_RESOLVED,
    EVENT_RISK_UPDATED,
)
from app.workers.report_consumer import (
    ensure_consumer_group,
    process_report_message,
)
from app.services.risk_service import calculate_risk_score
from app.services.alert_service import (
    create_alert,
    resolve_high_risk_alerts,
)


@pytest.fixture
def fake_redis_server():
    return fakeredis.FakeServer()


@pytest.fixture
def fake_redis(fake_redis_server):
    """Primary client instance."""
    return fakeredis.FakeAsyncRedis(server=fake_redis_server, decode_responses=True)


@pytest.fixture
def fake_sub_redis(fake_redis_server):
    """Subscriber client instance sharing the same server."""
    return fakeredis.FakeAsyncRedis(server=fake_redis_server, decode_responses=True)


async def subscribe_and_consume_confirm(pubsub, channel):
    """Subscribes and drains the initial 'subscribe' confirmation message."""
    await pubsub.subscribe(channel)
    conf = await pubsub.get_message(timeout=1.0)
    assert conf is not None and conf["type"] == "subscribe"


@pytest.mark.asyncio
async def test_publish_event_structure_and_channel(fake_redis, fake_sub_redis):
    """
    Test 1: Correct event structure and channel publication.
    Event must have event_id, event_type, entity_id, timestamp, and data.
    """
    pubsub = fake_sub_redis.pubsub()
    await subscribe_and_consume_confirm(pubsub, DEFAULT_EVENTS_CHANNEL)

    event_payload = await publish_event(
        event_type="test.event",
        entity_id="ENT-123",
        data={"key": "value"},
        client=fake_redis,
    )

    assert event_payload is not None
    assert event_payload["event_type"] == "test.event"
    assert event_payload["entity_id"] == "ENT-123"
    assert event_payload["event_id"].startswith("EVT-")
    assert "timestamp" in event_payload
    assert event_payload["data"] == {"key": "value"}

    # Receive message from channel
    msg = await pubsub.get_message(timeout=1.0)
    assert msg is not None
    assert msg["type"] == "message"
    assert msg["channel"] == DEFAULT_EVENTS_CHANNEL

    received_data = json.loads(msg["data"])
    assert received_data["event_id"] == event_payload["event_id"]
    assert received_data["event_type"] == "test.event"
    assert received_data["entity_id"] == "ENT-123"
    assert received_data["data"] == {"key": "value"}


@pytest.mark.asyncio
async def test_incident_created_and_updated_events(fake_redis, fake_sub_redis):
    """
    Test 2: Report consumer publishes incident.created on new incidents
    and incident.updated when reports are grouped.
    """
    await ensure_consumer_group(client=fake_redis)

    pubsub = fake_sub_redis.pubsub()
    await subscribe_and_consume_confirm(pubsub, DEFAULT_EVENTS_CHANNEL)

    # 1. Create first report -> incident.created
    rep1 = {
        "report_id": "REP-EVT-1",
        "student_id": "STU-1",
        "title": "Broken projector bulb",
        "description": "Flickering",
        "category": "Projector",
        "location": "Room 101",
        "equipment_id": "PRJ-101",
    }
    res1 = await process_report_message("10-0", rep1, client=fake_redis)
    assert res1["status"] == "created"
    inc_id = res1["incident_id"]

    msg1 = await pubsub.get_message(timeout=1.0)
    assert msg1 is not None and msg1["type"] == "message"
    data1 = json.loads(msg1["data"])
    assert data1["event_type"] == EVENT_INCIDENT_CREATED
    assert data1["entity_id"] == inc_id
    assert data1["data"]["report_id"] == "REP-EVT-1"
    assert data1["data"]["equipment_id"] == "PRJ-101"

    # 2. Related report -> incident.updated
    rep2 = {
        "report_id": "REP-EVT-2",
        "student_id": "STU-2",
        "title": "Projector bulb dead",
        "description": "Completely off",
        "category": "Projector",
        "location": "Room 101",
        "equipment_id": "PRJ-101",
    }
    res2 = await process_report_message("11-0", rep2, client=fake_redis)
    assert res2["status"] == "updated"
    assert res2["incident_id"] == inc_id

    # Drain messages received
    received_events = []
    while True:
        m = await pubsub.get_message(timeout=0.5)
        if not m:
            break
        if m["type"] == "message":
            received_events.append(json.loads(m["data"]))

    incident_updated_events = [e for e in received_events if e["event_type"] == EVENT_INCIDENT_UPDATED]
    assert len(incident_updated_events) == 1
    updated_evt = incident_updated_events[0]
    assert updated_evt["entity_id"] == inc_id
    assert updated_evt["data"]["report_count"] == 2
    assert updated_evt["data"]["report_id"] == "REP-EVT-2"
    assert updated_evt["data"]["update_type"] == "report_attached"
    assert updated_evt["data"]["previous_status"] is None
    assert updated_evt["data"]["status"] == "OPEN"
    assert updated_evt["data"]["equipment_id"] == "PRJ-101"
    assert updated_evt["data"]["category"] == "Projector"
    assert updated_evt["data"]["location"] == "Room 101"


@pytest.mark.asyncio
async def test_risk_updated_event_published_on_change(fake_redis, fake_sub_redis):
    """
    Test 3: Risk update events published on change and avoided on unchanged score.
    """
    pubsub = fake_sub_redis.pubsub()
    await subscribe_and_consume_confirm(pubsub, DEFAULT_EVENTS_CHANNEL)

    eq_id = "EQ-RISK-EVT"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "name": "AC Unit",
            "failure_count": "2",
            "health_score": "80",
            # No prior risk_score in hash
        },
    )

    # First calculation: min(2*10, 50) + (100-80)*0.5 = 20 + 10 = 30.0 -> score changes from None to 30.0
    score1 = await calculate_risk_score(eq_id, client=fake_redis)
    assert score1 == 30.0

    msg1 = await pubsub.get_message(timeout=1.0)
    assert msg1 is not None and msg1["type"] == "message"
    data1 = json.loads(msg1["data"])
    assert data1["event_type"] == EVENT_RISK_UPDATED
    assert data1["entity_id"] == eq_id
    assert data1["data"]["risk_score"] == 30.0

    # Second calculation with identical input -> score remains 30.0 -> NO new risk event published
    score2 = await calculate_risk_score(eq_id, client=fake_redis)
    assert score2 == 30.0

    msg2 = await pubsub.get_message(timeout=0.5)
    assert msg2 is None  # Deduplicated, no event for unchanged state

    # Metric changes -> score changes -> event published
    await fake_redis.hset(f"campuscare:equipment:{eq_id}", "failure_count", "4")
    score3 = await calculate_risk_score(eq_id, client=fake_redis)
    assert score3 == 50.0  # min(4*10, 50) + 10 = 50.0

    msg3 = await pubsub.get_message(timeout=1.0)
    assert msg3 is not None and msg3["type"] == "message"
    data3 = json.loads(msg3["data"])
    assert data3["event_type"] == EVENT_RISK_UPDATED
    assert data3["data"]["risk_score"] == 50.0
    assert data3["data"]["previous_risk_score"] == 30.0


@pytest.mark.asyncio
async def test_alert_created_and_resolved_events(fake_redis, fake_sub_redis):
    """
    Test 4: Alert creation, deduplication on unchanged state, and resolution events.
    """
    pubsub = fake_sub_redis.pubsub()
    await subscribe_and_consume_confirm(pubsub, DEFAULT_EVENTS_CHANNEL)

    eq_id = "EQ-ALT-EVT"

    # 1. Create alert
    alert1 = await create_alert(
        equipment_id=eq_id,
        title="High equipment risk",
        message="Risk exceeded 80",
        severity="CRITICAL",
        client=fake_redis,
    )
    alert_id = alert1["alert_id"]

    msg1 = await pubsub.get_message(timeout=1.0)
    assert msg1 is not None and msg1["type"] == "message"
    data1 = json.loads(msg1["data"])
    assert data1["event_type"] == EVENT_ALERT_CREATED
    assert data1["entity_id"] == alert_id
    assert data1["data"]["status"] == "ACTIVE"

    # 2. Redundant call with identical active message and severity -> NO event
    await create_alert(
        equipment_id=eq_id,
        title="High equipment risk",
        message="Risk exceeded 80",
        severity="CRITICAL",
        client=fake_redis,
    )
    msg_redundant = await pubsub.get_message(timeout=0.5)
    assert msg_redundant is None  # Unchanged state, no duplicate event

    # 3. Resolve alert -> alert.resolved event
    resolved_ids = await resolve_high_risk_alerts(eq_id, client=fake_redis)
    assert alert_id in resolved_ids

    msg_resolved = await pubsub.get_message(timeout=1.0)
    assert msg_resolved is not None and msg_resolved["type"] == "message"
    data_res = json.loads(msg_resolved["data"])
    assert data_res["event_type"] == EVENT_ALERT_RESOLVED
    assert data_res["entity_id"] == alert_id
    assert data_res["data"]["status"] == "RESOLVED"


@pytest.mark.asyncio
async def test_publishing_failure_does_not_break_operations(fake_redis):
    """
    Test 5: Publishing failures must not interrupt core operations.
    """
    eq_id = "EQ-FAULTY"
    await fake_redis.hset(
        f"campuscare:equipment:{eq_id}",
        mapping={
            "id": eq_id,
            "failure_count": "1",
            "health_score": "90",
        },
    )

    # Mock publish to raise an exception simulating Redis disconnect during publish
    original_publish = fake_redis.publish
    async def broken_publish(channel, message):
        raise ConnectionError("Pub/Sub channel connection dropped")

    fake_redis.publish = broken_publish

    # Risk score calculation must succeed despite publisher failure
    score = await calculate_risk_score(eq_id, client=fake_redis)
    assert score == 15.0

    # Alert creation must succeed despite publisher failure
    alert = await create_alert(
        equipment_id=eq_id,
        title="Manual Alert",
        message="Notice",
        client=fake_redis,
    )
    assert alert is not None
    assert alert["title"] == "Manual Alert"

    fake_redis.publish = original_publish


@pytest.mark.asyncio
async def test_admin_incident_status_update_event(fake_redis, fake_sub_redis):
    """
    Test 6: Admin status update publishes standardized incident.updated event
    containing previous_status, new status, update_type='status_change', and common metadata.
    """
    from starlette.testclient import TestClient
    from app.main import app
    from unittest.mock import patch

    pubsub = fake_sub_redis.pubsub()
    await subscribe_and_consume_confirm(pubsub, DEFAULT_EVENTS_CHANNEL)

    # Seed incident in Redis
    inc_id = "INC-STATUS-EVT"
    await fake_redis.hset(
        f"campuscare:incident:{inc_id}",
        mapping={
            "incident_id": inc_id,
            "status": "OPEN",
            "equipment_id": "EQ-99",
            "category": "Electrical",
            "location": "Science Wing",
            "report_count": "3",
        },
    )

    client = TestClient(app)

    with patch("app.routers.incidents.redis_client", fake_redis):
        response = client.patch(
            f"/api/incidents/{inc_id}/status?status=RESOLVED",
            headers={"X-User-Role": "admin"},
        )
        assert response.status_code == 200

    # Drain messages received
    received_events = []
    while True:
        m = await pubsub.get_message(timeout=0.5)
        if not m:
            break
        if m["type"] == "message":
            received_events.append(json.loads(m["data"]))

    status_events = [e for e in received_events if e["event_type"] == EVENT_INCIDENT_UPDATED]
    assert len(status_events) == 1
    evt = status_events[0]
    assert evt["entity_id"] == inc_id
    assert evt["data"]["incident_id"] == inc_id
    assert evt["data"]["update_type"] == "status_change"
    assert evt["data"]["previous_status"] == "OPEN"
    assert evt["data"]["status"] == "RESOLVED"
    assert evt["data"]["equipment_id"] == "EQ-99"
    assert evt["data"]["category"] == "Electrical"
    assert evt["data"]["location"] == "Science Wing"
    assert evt["data"]["report_count"] == 3

