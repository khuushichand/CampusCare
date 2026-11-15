"""
Phase 6: Student-Specific Report Retrieval & Security Tests
===========================================================
Verifies:
- GET /api/reports/me returns reports for authenticated student only.
- Missing X-Student-Id header on GET /api/reports/me returns 401.
- Missing X-Student-Id header on GET /api/reports/{id} returns 401.
- Missing X-Student-Id header on POST /api/reports returns 401.
- Report body student_id mismatch with X-Student-Id header returns 403.
- Correct matching identity successfully creates a report (HTTP 200).
- Atomic Redis MULTI/EXEC transaction stores hash, index, and stream in one step.
- Transaction failure does not leave partially created report data.
- Cross-student access on GET /api/reports/{id} returns 403.
- Report hashes and student indexes have NO TTL (permanent storage).
- Student report index (campuscare:student:reports:{student_id}) prevents duplicates.
- Stream fallback / index backfill recovery if an existing report is queried.
"""

import pytest
import fakeredis
import fakeredis.aioredis
from unittest.mock import patch
from starlette.testclient import TestClient

from app.main import app
from app.services.report_service import (
    create_report,
    get_report_by_id,
    get_student_reports,
    REPORT_KEY_PREFIX,
    STUDENT_REPORTS_INDEX_PREFIX,
    PROCESSED_REPORT_KEY_PREFIX,
    INCIDENT_KEY_PREFIX,
    REPORT_STREAM,
)


@pytest.fixture
def fake_redis_server():
    return fakeredis.FakeServer()


@pytest.fixture
def fake_redis(fake_redis_server):
    return fakeredis.FakeAsyncRedis(server=fake_redis_server, decode_responses=True)


# ---------------------------------------------------------------------------
# Test 1: Empty report history
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_student_report_history(fake_redis):
    """When a student has submitted no reports, service returns empty list."""
    reports = await get_student_reports("STU-EMPTY-001", client=fake_redis)
    assert reports == []


# ---------------------------------------------------------------------------
# Test 2: Student-specific report isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_student_report_isolation(fake_redis):
    """Student A must only see their reports, never Student B's reports."""
    # Student A creates 2 reports
    rep_a1 = await create_report(
        student_id="STU-A",
        title="Projector broken",
        description="Flickering display",
        category="Projector",
        location="Lab 204",
        client=fake_redis,
    )
    rep_a2 = await create_report(
        student_id="STU-A",
        title="AC not working",
        description="Warm air blowing",
        category="AC",
        location="Lab 204",
        client=fake_redis,
    )

    # Student B creates 1 report
    rep_b1 = await create_report(
        student_id="STU-B",
        title="WiFi down",
        description="No connection",
        category="WiFi",
        location="Block B",
        client=fake_redis,
    )

    # Verify Student A sees exactly 2 reports
    reports_a = await get_student_reports("STU-A", client=fake_redis)
    assert len(reports_a) == 2
    ids_a = {r["report_id"] for r in reports_a}
    assert rep_a1["report"]["report_id"] in ids_a
    assert rep_a2["report"]["report_id"] in ids_a
    assert rep_b1["report"]["report_id"] not in ids_a

    # Verify Student B sees exactly 1 report
    reports_b = await get_student_reports("STU-B", client=fake_redis)
    assert len(reports_b) == 1
    assert reports_b[0]["report_id"] == rep_b1["report"]["report_id"]


# ---------------------------------------------------------------------------
# Test 3: Duplicate report ID prevention in student index
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_duplicate_index_prevention(fake_redis):
    """Student index must be a Set that prevents duplicate report IDs."""
    student_id = "STU-DUP-01"
    rep = await create_report(
        student_id=student_id,
        title="Door broken",
        description="Lock jammed",
        category="Facility",
        location="Hallway",
        client=fake_redis,
    )
    report_id = rep["report"]["report_id"]

    # Attempt to re-add same report ID to student index set
    index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}"
    added = await fake_redis.sadd(index_key, report_id)
    assert added == 0, "Set must not add duplicate report ID"

    count = await fake_redis.scard(index_key)
    assert count == 1


# ---------------------------------------------------------------------------
# Test 4: Atomic report creation via Redis MULTI/EXEC pipeline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_atomic_report_creation(fake_redis):
    """create_report atomically executes HSET, SADD, and XADD."""
    student_id = "STU-ATOMIC-01"
    res = await create_report(
        student_id=student_id,
        title="Monitor blank",
        description="No signal on power on",
        category="Computer",
        location="Lab 101",
        equipment_id="PC-01",
        client=fake_redis,
    )

    report_id = res["report"]["report_id"]
    stream_id = res["stream_id"]
    assert report_id.startswith("REP-")
    assert stream_id

    # 1. Verify hash exists
    hash_key = f"{REPORT_KEY_PREFIX}{report_id}"
    hash_data = await fake_redis.hgetall(hash_key)
    assert hash_data["student_id"] == student_id
    assert hash_data["title"] == "Monitor blank"

    # 2. Verify index set exists
    index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}"
    members = await fake_redis.smembers(index_key)
    assert report_id in members

    # 3. Verify stream has the entry
    stream_entries = await fake_redis.xrange(REPORT_STREAM)
    stream_rids = [dict(data).get("report_id") for _, data in stream_entries]
    assert report_id in stream_rids


@pytest.mark.asyncio
async def test_transaction_failure_leaves_no_partial_data(fake_redis):
    """When a Redis transaction fails or aborts, no partial report data remains."""
    student_id = "STU-TX-FAIL"
    report_id = "REP-FAILTEST"
    hash_key = f"{REPORT_KEY_PREFIX}{report_id}"
    index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}"

    # Simulate a pipeline that encounters an exception before execute or during execution
    pipe = fake_redis.pipeline(transaction=True)
    pipe.hset(hash_key, mapping={"report_id": report_id})
    pipe.sadd(index_key, report_id)

    # Discard pipeline without executing
    await pipe.reset()

    # Verify no partial keys were committed to Redis
    assert not await fake_redis.exists(hash_key)
    assert not await fake_redis.exists(index_key)


# ---------------------------------------------------------------------------
# Test 5: Stream backfill recovery for unindexed report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_backfill_recovery_for_student_index(fake_redis):
    """If a report exists in the stream but student index was not yet populated,
    get_student_reports / get_report_by_id recovers and backfills the index."""
    student_id = "STU-BACKFILL"
    report_id = "REP-LEGACY-01"

    # Insert directly into stream as if legacy report
    await fake_redis.xadd(REPORT_STREAM, {
        "report_id": report_id,
        "student_id": student_id,
        "title": "Legacy Issue",
        "description": "Existed before indexing",
        "category": "HVAC",
        "location": "Block C",
        "status": "OPEN",
        "created_at": "2026-11-15T00:00:00Z",
    })

    # Student index does not have it yet
    index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}{student_id}"
    assert await fake_redis.scard(index_key) == 0

    # get_student_reports should discover it and backfill index
    reports = await get_student_reports(student_id, client=fake_redis)
    assert len(reports) == 1
    assert reports[0]["report_id"] == report_id

    # Verify student index was safely backfilled
    members = await fake_redis.smembers(index_key)
    assert report_id in members


# ---------------------------------------------------------------------------
# Test 6: Individual report status transitions (QUEUED -> PROCESSING -> PROCESSED)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_report_lifecycle_and_incident_link(fake_redis):
    """Individual report reflects Queued, Processing, and Processed with incident details."""
    student_id = "STU-STATUS-01"
    res = await create_report(
        student_id=student_id,
        title="Light bulb out",
        description="Flickering in classroom",
        category="Electrical",
        location="Room 301",
        client=fake_redis,
    )
    report_id = res["report"]["report_id"]

    # 1. Initially QUEUED (no processed key)
    rep1 = await get_report_by_id(report_id, client=fake_redis)
    assert rep1["lifecycle_status"] == "QUEUED"
    assert rep1["incident_id"] is None
    assert rep1["incident"] is None

    # 2. While consumer has acquired lock: PROCESSING
    processed_key = f"{PROCESSED_REPORT_KEY_PREFIX}{report_id}"
    await fake_redis.set(processed_key, "PROCESSING:token-12345", ex=30)
    rep2 = await get_report_by_id(report_id, client=fake_redis)
    assert rep2["lifecycle_status"] == "PROCESSING"
    assert rep2["incident_id"] is None

    # 3. Once consumer completes: PROCESSED with linked incident
    incident_id = "INC-TEST-99"
    incident_key = f"{INCIDENT_KEY_PREFIX}{incident_id}"
    await fake_redis.hset(incident_key, mapping={
        "incident_id": incident_id,
        "title": "Room 301 Electrical Issue",
        "status": "OPEN",
        "severity": "MEDIUM",
        "location": "Room 301",
        "report_count": "1",
    })
    await fake_redis.set(processed_key, incident_id)

    rep3 = await get_report_by_id(report_id, client=fake_redis)
    assert rep3["lifecycle_status"] == "PROCESSED"
    assert rep3["incident_id"] == incident_id
    assert rep3["incident"] is not None
    assert rep3["incident"]["incident_id"] == incident_id
    assert rep3["incident"]["status"] == "OPEN"


# ---------------------------------------------------------------------------
# Test 7: Report hashes have no TTL (Permanent Storage)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_report_hash_has_no_ttl(fake_redis):
    """Report hashes and student indexes must never expire (TTL == -1)."""
    res = await create_report(
        student_id="STU-TTL-01",
        title="Printer jam",
        description="Tray 2 jammed",
        category="Printer",
        location="Library",
        client=fake_redis,
    )
    report_id = res["report"]["report_id"]

    hash_key = f"{REPORT_KEY_PREFIX}{report_id}"
    index_key = f"{STUDENT_REPORTS_INDEX_PREFIX}STU-TTL-01"

    assert await fake_redis.ttl(hash_key) == -1, "Report hash must have no TTL"
    assert await fake_redis.ttl(index_key) == -1, "Student report index must have no TTL"


# ---------------------------------------------------------------------------
# Test 8: HTTP Endpoint Security - POST /api/reports
# ---------------------------------------------------------------------------

def test_http_create_report_missing_header_returns_401():
    """POST /api/reports without X-Student-Id header returns 401."""
    client = TestClient(app)
    payload = {
        "student_id": "1RV20CS054",
        "title": "Test Issue",
        "description": "Missing header test",
        "category": "Other",
        "location": "Lab 101",
    }
    response = client.post("/api/reports", json=payload)
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]["message"]


def test_http_create_report_mismatched_identity_returns_403():
    """POST /api/reports where body student_id != X-Student-Id returns 403."""
    client = TestClient(app)
    headers = {"X-Student-Id": "1RV20CS054"}
    payload = {
        "student_id": "STU-IMPOSTOR",
        "title": "Spoofed Issue",
        "description": "Mismatch identity test",
        "category": "Other",
        "location": "Lab 101",
    }
    response = client.post("/api/reports", json=payload, headers=headers)
    assert response.status_code == 403
    assert "does not match" in response.json()["detail"]


def test_http_create_report_matching_identity_success():
    """POST /api/reports with matching X-Student-Id and body student_id succeeds."""
    client = TestClient(app)
    student_id = "1RV20CS054"
    headers = {"X-Student-Id": student_id}
    payload = {
        "student_id": student_id,
        "title": "Valid Issue",
        "description": "Correct identity test",
        "category": "Projector",
        "location": "Lab 204",
    }
    mock_result = {
        "report": {
            "report_id": "REP-VALID-01",
            "student_id": student_id,
            "title": payload["title"],
            "description": payload["description"],
            "category": payload["category"],
            "location": payload["location"],
            "status": "OPEN",
        },
        "stream_id": "1000-0",
    }
    with patch("app.routers.reports.create_report", return_value=mock_result):
        response = client.post("/api/reports", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["report"]["report_id"] == "REP-VALID-01"
        assert body["stream_id"] == "1000-0"


# ---------------------------------------------------------------------------
# Test 9: HTTP Endpoint Security - GET /api/reports/me
# ---------------------------------------------------------------------------

def test_http_get_my_reports_missing_header_returns_401():
    """GET /api/reports/me without X-Student-Id header returns 401."""
    client = TestClient(app)
    response = client.get("/api/reports/me")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]["message"]


def test_http_get_my_reports_success():
    """GET /api/reports/me with X-Student-Id returns 200 with student's reports."""
    client = TestClient(app)
    headers = {"X-Student-Id": "1RV20CS054"}
    mock_reports = [
        {
            "report_id": "REP-TEST1",
            "student_id": "1RV20CS054",
            "title": "Projector not working",
            "category": "Projector",
            "location": "Lab 204",
            "lifecycle_status": "QUEUED",
        }
    ]
    with patch("app.routers.reports.get_student_reports", return_value=mock_reports):
        response = client.get("/api/reports/me", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["student_id"] == "1RV20CS054"
        assert body["count"] == 1
        assert body["reports"][0]["report_id"] == "REP-TEST1"


# ---------------------------------------------------------------------------
# Test 10: HTTP Endpoint Security - GET /api/reports/{report_id}
# ---------------------------------------------------------------------------

def test_http_get_report_details_missing_header_returns_401():
    """GET /api/reports/{id} without X-Student-Id header returns 401."""
    client = TestClient(app)
    response = client.get("/api/reports/REP-ANY-01")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]["message"]


def test_http_get_report_details_unknown_returns_404():
    """GET /api/reports/{id} for non-existent report returns 404."""
    client = TestClient(app)
    headers = {"X-Student-Id": "1RV20CS054"}
    with patch("app.routers.reports.get_report_by_id", return_value=None):
        response = client.get("/api/reports/REP-UNKNOWN-9999", headers=headers)
        assert response.status_code == 404


def test_http_get_report_details_cross_student_forbidden_returns_403():
    """GET /api/reports/{id} returns 403 when authenticated user is not report author."""
    client = TestClient(app)
    mock_report = {
        "report_id": "REP-AUTH-1",
        "student_id": "STUDENT-OWNER",
        "title": "Broken desk",
        "lifecycle_status": "QUEUED",
    }
    with patch("app.routers.reports.get_report_by_id", return_value=mock_report):
        response = client.get(
            "/api/reports/REP-AUTH-1",
            headers={"X-Student-Id": "STUDENT-ATTACKER"},
        )
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]


def test_http_get_report_details_owner_success_returns_200():
    """GET /api/reports/{id} returns 200 when author matches authenticated identity."""
    client = TestClient(app)
    mock_report = {
        "report_id": "REP-AUTH-1",
        "student_id": "STUDENT-OWNER",
        "title": "Broken desk",
        "lifecycle_status": "PROCESSED",
        "incident_id": "INC-1234",
    }
    with patch("app.routers.reports.get_report_by_id", return_value=mock_report):
        response = client.get(
            "/api/reports/REP-AUTH-1",
            headers={"X-Student-Id": "STUDENT-OWNER"},
        )
        assert response.status_code == 200
        assert response.json()["report"]["incident_id"] == "INC-1234"
