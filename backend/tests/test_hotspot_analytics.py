"""
Phase 5: Maintenance Hotspot Analytics Tests
============================================
Verifies:
- Empty incident dataset returns graceful empty structures and null summary.
- Location hotspot aggregation and report count summation.
- Equipment hotspot aggregation with equipment details and failure metrics.
- Category hotspot aggregation and frequency calculation.
- Multiple student reports attached to single incidents are counted accurately.
- Different severity levels directly impact priority score.
- Missing and malformed fields are safely handled.
- Priority scoring formula is bounded and deterministic.
- Exclusion of incident-report relationship Set keys (campuscare:incident:reports:*).
- GET /api/analytics/hotspots endpoint functionality.
"""

import pytest
import fakeredis
import fakeredis.aioredis
from unittest.mock import patch
from starlette.testclient import TestClient

from app.main import app
from app.services.hotspot_service import (
    calculate_hotspots,
    calculate_hotspot_priority,
    get_all_incidents_data,
    INCIDENT_KEY_PREFIX,
    INCIDENT_REPORTS_KEY_PREFIX,
    EQUIPMENT_KEY_PREFIX,
)


@pytest.fixture
def fake_redis_server():
    return fakeredis.FakeServer()


@pytest.fixture
def fake_redis(fake_redis_server):
    return fakeredis.FakeAsyncRedis(server=fake_redis_server, decode_responses=True)


# ---------------------------------------------------------------------------
# Test 1: Empty dataset
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_incident_dataset(fake_redis):
    """With zero incidents, service should return empty lists and None summary."""
    data = await calculate_hotspots(client=fake_redis)

    assert data["location_hotspots"] == []
    assert data["equipment_hotspots"] == []
    assert data["category_hotspots"] == []

    summary = data["summary"]
    assert summary["total_incidents_analyzed"] == 0
    assert summary["total_reports_represented"] == 0
    assert summary["most_affected_location"] is None
    assert summary["most_frequently_affected_equipment"] is None
    assert summary["most_common_issue_category"] is None


# ---------------------------------------------------------------------------
# Test 2: Location hotspot aggregation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_location_hotspot_aggregation(fake_redis):
    """Group incidents by location, verify report summation, recurring flag, and ordering."""
    # Location A: 2 incidents, total 4 reports
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-1",
        mapping={
            "incident_id": "INC-1",
            "location": "Science Block 101",
            "category": "ELECTRICAL",
            "severity": "HIGH",
            "report_count": "3",
        },
    )
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-2",
        mapping={
            "incident_id": "INC-2",
            "location": "Science Block 101",
            "category": "ELECTRICAL",
            "severity": "MEDIUM",
            "report_count": "1",
        },
    )

    # Location B: 1 incident, 1 report
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-3",
        mapping={
            "incident_id": "INC-3",
            "location": "Admin Office",
            "category": "PLUMBING",
            "severity": "LOW",
            "report_count": "1",
        },
    )

    data = await calculate_hotspots(client=fake_redis)
    loc_hotspots = data["location_hotspots"]

    assert len(loc_hotspots) == 2
    top = loc_hotspots[0]
    assert top["location"] == "Science Block 101"
    assert top["incident_count"] == 2
    assert top["report_count"] == 4
    assert top["is_recurring"] is True
    assert top["severity_distribution"]["HIGH"] == 1
    assert top["severity_distribution"]["MEDIUM"] == 1
    assert top["severity_distribution"]["LOW"] == 0

    second = loc_hotspots[1]
    assert second["location"] == "Admin Office"
    assert second["incident_count"] == 1
    assert second["report_count"] == 1
    assert second["is_recurring"] is False
    assert top["priority_score"] > second["priority_score"]


# ---------------------------------------------------------------------------
# Test 3: Equipment hotspot aggregation and equipment details
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_equipment_hotspot_aggregation_with_details(fake_redis):
    """Equipment hotspot attaches equipment hash details (health_score, failure_count)."""
    eq_id = "EQ-AC-01"
    await fake_redis.hset(
        f"{EQUIPMENT_KEY_PREFIX}{eq_id}",
        mapping={
            "id": eq_id,
            "name": "Library Chiller Unit",
            "type": "AC",
            "location": "Library 2nd Floor",
            "status": "Needs Maintenance",
            "health_score": "42",
            "failure_count": "3",
        },
    )

    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-EQ-1",
        mapping={
            "incident_id": "INC-EQ-1",
            "equipment_id": eq_id,
            "category": "HVAC",
            "location": "Library 2nd Floor",
            "severity": "HIGH",
            "report_count": "2",
        },
    )
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-EQ-2",
        mapping={
            "incident_id": "INC-EQ-2",
            "equipment_id": eq_id,
            "category": "HVAC",
            "location": "Library 2nd Floor",
            "severity": "CRITICAL",
            "report_count": "1",
        },
    )

    # Non-equipment incident
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-NO-EQ",
        mapping={
            "incident_id": "INC-NO-EQ",
            "equipment_id": "",
            "category": "CLEANING",
            "location": "Cafeteria",
            "severity": "LOW",
            "report_count": "1",
        },
    )

    data = await calculate_hotspots(client=fake_redis)
    eq_hotspots = data["equipment_hotspots"]

    assert len(eq_hotspots) == 1
    eq = eq_hotspots[0]
    assert eq["equipment_id"] == eq_id
    assert eq["equipment_name"] == "Library Chiller Unit"
    assert eq["equipment_type"] == "AC"
    assert eq["location"] == "Library 2nd Floor"
    assert eq["status"] == "Needs Maintenance"
    assert eq["health_score"] == 42
    assert eq["failure_count"] == 3
    assert eq["incident_count"] == 2
    assert eq["report_count"] == 3
    assert eq["is_recurring"] is True
    assert eq["severity_distribution"]["CRITICAL"] == 1
    assert eq["severity_distribution"]["HIGH"] == 1


# ---------------------------------------------------------------------------
# Test 4: Category hotspot aggregation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_category_hotspot_aggregation(fake_redis):
    """Category hotspots group incidents correctly and compute frequency and priority."""
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-CAT-1",
        mapping={
            "incident_id": "INC-CAT-1",
            "category": "ELECTRICAL",
            "severity": "CRITICAL",
            "report_count": "2",
            "location": "Hostel 1",
        },
    )
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-CAT-2",
        mapping={
            "incident_id": "INC-CAT-2",
            "category": "ELECTRICAL",
            "severity": "HIGH",
            "report_count": "1",
            "location": "Hostel 2",
        },
    )
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-CAT-3",
        mapping={
            "incident_id": "INC-CAT-3",
            "category": "PLUMBING",
            "severity": "LOW",
            "report_count": "1",
            "location": "Hostel 1",
        },
    )

    data = await calculate_hotspots(client=fake_redis)
    cat_hotspots = data["category_hotspots"]

    assert len(cat_hotspots) == 2
    assert cat_hotspots[0]["category"] == "ELECTRICAL"
    assert cat_hotspots[0]["incident_count"] == 2
    assert cat_hotspots[0]["report_count"] == 3
    assert cat_hotspots[0]["severity_distribution"]["CRITICAL"] == 1
    assert cat_hotspots[0]["severity_distribution"]["HIGH"] == 1

    assert cat_hotspots[1]["category"] == "PLUMBING"
    assert cat_hotspots[1]["incident_count"] == 1
    assert cat_hotspots[1]["report_count"] == 1

    assert cat_hotspots[0]["priority_score"] > cat_hotspots[1]["priority_score"]


# ---------------------------------------------------------------------------
# Test 5: Multiple reports attached to one incident
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multiple_reports_attached_to_one_incident(fake_redis):
    """Ensure report_count=5 counts as 1 incident but 5 reports in totals."""
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-MULTI",
        mapping={
            "incident_id": "INC-MULTI",
            "location": "Main Auditorium",
            "category": "AV",
            "severity": "MEDIUM",
            "report_count": "5",
        },
    )

    data = await calculate_hotspots(client=fake_redis)
    summary = data["summary"]

    assert summary["total_incidents_analyzed"] == 1
    assert summary["total_reports_represented"] == 5

    loc = data["location_hotspots"][0]
    assert loc["incident_count"] == 1
    assert loc["report_count"] == 5
    # High report volume triggers recurring flag (report_count >= 3)
    assert loc["is_recurring"] is True


# ---------------------------------------------------------------------------
# Test 6: Severity levels impact on priority score
# ---------------------------------------------------------------------------

def test_different_severity_levels_impact_priority():
    """Higher severity must monotonically increase priority score for same volume."""
    low_score = calculate_hotspot_priority(
        incident_count=1,
        report_count=1,
        severity_dist={"LOW": 1, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
    )
    med_score = calculate_hotspot_priority(
        incident_count=1,
        report_count=1,
        severity_dist={"LOW": 0, "MEDIUM": 1, "HIGH": 0, "CRITICAL": 0},
    )
    high_score = calculate_hotspot_priority(
        incident_count=1,
        report_count=1,
        severity_dist={"LOW": 0, "MEDIUM": 0, "HIGH": 1, "CRITICAL": 0},
    )
    crit_score = calculate_hotspot_priority(
        incident_count=1,
        report_count=1,
        severity_dist={"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 1},
    )

    assert low_score < med_score < high_score < crit_score
    assert 0.0 <= low_score <= 100.0
    assert 0.0 <= crit_score <= 100.0


# ---------------------------------------------------------------------------
# Test 7: Missing or malformed fields
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_or_malformed_fields_handled_safely(fake_redis):
    """Safe fallback for missing location, category, severity, and report_count."""
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-MALFORMED",
        mapping={
            # Missing location -> defaults to UNKNOWN
            # Missing category -> defaults to UNCATEGORIZED
            # Missing severity -> defaults to MEDIUM
            "report_count": "invalid-int",  # invalid int -> defaults to 1
        },
    )

    incidents = await get_all_incidents_data(client=fake_redis)
    assert len(incidents) == 1
    inc = incidents[0]
    assert inc["location"] == "UNKNOWN"
    assert inc["category"] == "UNCATEGORIZED"
    assert inc["severity"] == "MEDIUM"
    assert inc["report_count"] == 1
    assert inc["equipment_id"] is None

    data = await calculate_hotspots(client=fake_redis)
    assert len(data["location_hotspots"]) == 1
    assert data["location_hotspots"][0]["location"] == "UNKNOWN"
    assert data["category_hotspots"][0]["category"] == "UNCATEGORIZED"


# ---------------------------------------------------------------------------
# Test 8: Deterministic priority scores
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deterministic_priority_scores(fake_redis):
    """Running calculation multiple times on same data must return identical scores."""
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-DET-1",
        mapping={
            "incident_id": "INC-DET-1",
            "location": "Lab 101",
            "category": "NETWORK",
            "severity": "HIGH",
            "report_count": "3",
        },
    )

    res1 = await calculate_hotspots(client=fake_redis)
    res2 = await calculate_hotspots(client=fake_redis)

    assert res1["location_hotspots"][0]["priority_score"] == res2["location_hotspots"][0]["priority_score"]
    assert res1["category_hotspots"][0]["priority_score"] == res2["category_hotspots"][0]["priority_score"]
    assert res1["summary"] == res2["summary"]


# ---------------------------------------------------------------------------
# Test 9: Incident relationship Set keys are excluded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incident_relationship_set_keys_excluded(fake_redis):
    """campuscare:incident:reports:* keys must be excluded from incident scanning."""
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-REAL",
        mapping={
            "incident_id": "INC-REAL",
            "location": "Workshop",
            "category": "MECHANICAL",
            "severity": "MEDIUM",
            "report_count": "1",
        },
    )

    # Add relationship Set key
    await fake_redis.sadd(
        f"{INCIDENT_REPORTS_KEY_PREFIX}INC-REAL",
        "RPT-001",
        "RPT-002",
    )

    incidents = await get_all_incidents_data(client=fake_redis)
    # Only the real incident should be included
    assert len(incidents) == 1
    assert incidents[0]["incident_id"] == "INC-REAL"


# ---------------------------------------------------------------------------
# Test 10: Summary statistics
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_correct_summary_statistics(fake_redis):
    """Verify total incidents, total reports, most affected location/equipment/category."""
    # 2 incidents at Dorm A, AC-01, ELECTRICAL
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-S1",
        mapping={
            "incident_id": "INC-S1",
            "location": "Dorm A",
            "category": "ELECTRICAL",
            "equipment_id": "AC-01",
            "severity": "CRITICAL",
            "report_count": "2",
        },
    )
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-S2",
        mapping={
            "incident_id": "INC-S2",
            "location": "Dorm A",
            "category": "ELECTRICAL",
            "equipment_id": "AC-01",
            "severity": "HIGH",
            "report_count": "3",
        },
    )
    # 1 incident at Library, no equipment, PLUMBING
    await fake_redis.hset(
        f"{INCIDENT_KEY_PREFIX}INC-S3",
        mapping={
            "incident_id": "INC-S3",
            "location": "Library",
            "category": "PLUMBING",
            "equipment_id": "",
            "severity": "LOW",
            "report_count": "1",
        },
    )

    data = await calculate_hotspots(client=fake_redis)
    summary = data["summary"]

    assert summary["total_incidents_analyzed"] == 3
    assert summary["total_reports_represented"] == 6
    assert summary["most_affected_location"] == "Dorm A"
    assert summary["most_frequently_affected_equipment"] == "AC-01"
    assert summary["most_common_issue_category"] == "ELECTRICAL"


# ---------------------------------------------------------------------------
# Test 11: GET /api/analytics/hotspots HTTP Endpoint
# ---------------------------------------------------------------------------

def test_api_endpoint_hotspots():
    """Verify FastAPI route GET /api/analytics/hotspots returns 200 with schema."""
    client = TestClient(app)
    mock_response = {
        "location_hotspots": [
            {
                "location": "Block A",
                "incident_count": 2,
                "report_count": 5,
                "severity_distribution": {"LOW": 0, "MEDIUM": 1, "HIGH": 1, "CRITICAL": 0},
                "is_recurring": True,
                "priority_score": 52.0,
            }
        ],
        "equipment_hotspots": [],
        "category_hotspots": [],
        "summary": {
            "total_incidents_analyzed": 2,
            "total_reports_represented": 5,
            "most_affected_location": "Block A",
            "most_frequently_affected_equipment": None,
            "most_common_issue_category": None,
        },
    }

    with patch("app.routers.analytics.calculate_hotspots", return_value=mock_response):
        response = client.get("/api/analytics/hotspots", headers={"X-User-Role": "admin"})
        assert response.status_code == 200
        body = response.json()
        assert "location_hotspots" in body
        assert "equipment_hotspots" in body
        assert "category_hotspots" in body
        assert "summary" in body
        assert body["summary"]["total_incidents_analyzed"] == 2

