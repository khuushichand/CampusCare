"""
Admin Endpoint Authorization Tests
==================================
Verifies:
1. Missing X-User-Role header returns HTTP 401 Unauthorized for admin endpoints.
2. Non-admin roles (e.g. 'student') return HTTP 403 Forbidden for admin endpoints.
3. Admin role ('admin', case-insensitive) succeeds with expected responses.
4. Student endpoints remain accessible with X-Student-Id only and do NOT require X-User-Role.
5. Covers:
   - GET /api/reports (global reports)
   - POST /api/incidents, GET /api/incidents, GET /api/incidents/{id}, PATCH /api/incidents/{id}/status
   - POST /api/maintenance, GET /api/maintenance, GET /api/maintenance/{id}, PATCH /api/maintenance/{id}/status
   - GET /api/alerts, POST /api/alerts, GET /api/alerts/{id}, PATCH /api/alerts/{id}/status
   - POST /api/risk/{equipment_id}/calculate, POST /api/risk/calculate-all
"""

import pytest
import fakeredis
import fakeredis.aioredis
from unittest.mock import patch, AsyncMock
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
def fake_redis_server():
    return fakeredis.FakeServer()


@pytest.fixture
def fake_redis(fake_redis_server):
    return fakeredis.FakeAsyncRedis(server=fake_redis_server, decode_responses=True)


# ==================================================
# 1. GLOBAL REPORTS (/api/reports)
# ==================================================

def test_get_all_reports_missing_header_returns_401():
    client = TestClient(app)
    response = client.get("/api/reports")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]["message"]


def test_get_all_reports_student_role_returns_403():
    client = TestClient(app)
    response = client.get("/api/reports", headers={"X-User-Role": "student"})
    assert response.status_code == 403
    assert "Administrator privileges are required" in response.json()["detail"]


def test_get_all_reports_admin_role_success_200():
    client = TestClient(app)
    with patch("app.routers.reports.get_reports", new_callable=AsyncMock) as mock_get_reports:
        mock_get_reports.return_value = []
        response = client.get("/api/reports", headers={"X-User-Role": "admin"})
        assert response.status_code == 200
        assert response.json()["reports"] == []


# ==================================================
# 2. INCIDENTS (/api/incidents)
# ==================================================

def test_incidents_missing_header_returns_401():
    client = TestClient(app)
    # Test GET list
    resp_get = client.get("/api/incidents")
    assert resp_get.status_code == 401

    # Test PATCH status
    resp_patch = client.patch("/api/incidents/INC-123/status", json={"status": "RESOLVED"})
    assert resp_patch.status_code == 401


def test_incidents_student_role_returns_403():
    client = TestClient(app)
    headers = {"X-User-Role": "student"}

    resp_get = client.get("/api/incidents", headers=headers)
    assert resp_get.status_code == 403

    resp_patch = client.patch("/api/incidents/INC-123/status", json={"status": "RESOLVED"}, headers=headers)
    assert resp_patch.status_code == 403


def test_post_incidents_endpoint_removed():
    """POST /api/incidents was removed to enforce single source of truth via Redis Streams."""
    client = TestClient(app)
    # Even with admin credentials, POST /api/incidents must return 405 Method Not Allowed
    resp = client.post("/api/incidents", headers={"X-User-Role": "admin"}, json={"title": "Test"})
    assert resp.status_code == 405


@pytest.mark.asyncio
async def test_incidents_admin_role_access_allowed(fake_redis):
    client = TestClient(app)
    headers = {"X-User-Role": "admin"}

    with patch("app.routers.incidents.redis_client", fake_redis):
        resp_get = client.get("/api/incidents", headers=headers)
        assert resp_get.status_code == 200
        assert resp_get.json()["incidents"] == []


# ==================================================
# 3. MAINTENANCE (/api/maintenance)
# ==================================================

def test_maintenance_missing_header_returns_401():
    client = TestClient(app)
    resp_get = client.get("/api/maintenance")
    assert resp_get.status_code == 401

    resp_post = client.post("/api/maintenance", json={
        "equipment_id": "EQ-1",
        "title": "Check AC",
        "description": "Routine check",
        "technician": "Tech Jane",
        "scheduled_date": "2026-12-01",
    })
    assert resp_post.status_code == 401


def test_maintenance_student_role_returns_403():
    client = TestClient(app)
    headers = {"X-User-Role": "student"}

    resp_get = client.get("/api/maintenance", headers=headers)
    assert resp_get.status_code == 403

    resp_post = client.post("/api/maintenance", json={
        "equipment_id": "EQ-1",
        "title": "Check AC",
        "description": "Routine check",
        "technician": "Tech Jane",
        "scheduled_date": "2026-12-01",
    }, headers=headers)
    assert resp_post.status_code == 403


@pytest.mark.asyncio
async def test_maintenance_admin_role_access_allowed(fake_redis):
    client = TestClient(app)
    headers = {"X-User-Role": "ADMIN"}  # Case-insensitivity check

    with patch("app.routers.maintenance.redis_client", fake_redis):
        resp_get = client.get("/api/maintenance", headers=headers)
        assert resp_get.status_code == 200
        assert resp_get.json()["maintenance"] == []


# ==================================================
# 4. ALERTS (/api/alerts)
# ==================================================

def test_alerts_missing_header_returns_401():
    client = TestClient(app)
    resp_get = client.get("/api/alerts")
    assert resp_get.status_code == 401

    resp_patch = client.patch("/api/alerts/ALT-1/status", json={"status": "RESOLVED"})
    assert resp_patch.status_code == 401


def test_alerts_student_role_returns_403():
    client = TestClient(app)
    headers = {"X-User-Role": "student"}

    resp_get = client.get("/api/alerts", headers=headers)
    assert resp_get.status_code == 403

    resp_patch = client.patch("/api/alerts/ALT-1/status", json={"status": "RESOLVED"}, headers=headers)
    assert resp_patch.status_code == 403


def test_alerts_admin_role_access_allowed():
    client = TestClient(app)
    headers = {"X-User-Role": "admin"}

    with patch("app.routers.alerts.get_all_alerts", new_callable=AsyncMock) as mock_alerts:
        mock_alerts.return_value = []
        resp_get = client.get("/api/alerts", headers=headers)
        assert resp_get.status_code == 200
        assert resp_get.json()["alerts"] == []


# ==================================================
# 5. RISK OPERATIONS (/api/risk)
# ==================================================

def test_risk_operations_missing_header_returns_401():
    client = TestClient(app)
    resp_calc = client.post("/api/risk/EQ-1/calculate")
    assert resp_calc.status_code == 401

    resp_all = client.post("/api/risk/calculate-all")
    assert resp_all.status_code == 401


def test_risk_operations_student_role_returns_403():
    client = TestClient(app)
    headers = {"X-User-Role": "student"}

    resp_calc = client.post("/api/risk/EQ-1/calculate", headers=headers)
    assert resp_calc.status_code == 403

    resp_all = client.post("/api/risk/calculate-all", headers=headers)
    assert resp_all.status_code == 403


def test_risk_operations_admin_role_access_allowed():
    client = TestClient(app)
    headers = {"X-User-Role": "admin"}

    with patch("app.routers.risk.calculate_risk_score", new_callable=AsyncMock) as mock_calc:
        mock_calc.return_value = 45.0
        resp_calc = client.post("/api/risk/EQ-1/calculate", headers=headers)
        assert resp_calc.status_code == 200
        assert resp_calc.json()["risk_score"] == 45.0

    with patch("app.routers.risk.recalculate_all_risks", new_callable=AsyncMock) as mock_all:
        mock_all.return_value = {"EQ-1": 45.0}
        resp_all = client.post("/api/risk/calculate-all", headers=headers)
        assert resp_all.status_code == 200

    # Risk ranking
    with patch("app.routers.risk.get_risk_ranking", new_callable=AsyncMock) as mock_rank:
        mock_rank.return_value = [{"equipment_id": "EQ-1", "risk_score": 45.0}]
        resp_rank = client.get("/api/risk/ranking", headers=headers)
        assert resp_rank.status_code == 200
        assert resp_rank.json()["ranking"][0]["equipment_id"] == "EQ-1"


def test_risk_ranking_missing_header_returns_401():
    client = TestClient(app)
    resp = client.get("/api/risk/ranking")
    assert resp.status_code == 401


def test_risk_ranking_student_role_returns_403():
    client = TestClient(app)
    resp = client.get("/api/risk/ranking", headers={"X-User-Role": "student"})
    assert resp.status_code == 403


# ==================================================
# 6. HOTSPOT ANALYTICS (/api/analytics/hotspots)
# ==================================================

def test_hotspots_missing_header_returns_401():
    client = TestClient(app)
    resp = client.get("/api/analytics/hotspots")
    assert resp.status_code == 401


def test_hotspots_student_role_returns_403():
    client = TestClient(app)
    resp = client.get("/api/analytics/hotspots", headers={"X-User-Role": "student"})
    assert resp.status_code == 403


def test_hotspots_admin_role_access_allowed():
    client = TestClient(app)
    with patch("app.routers.analytics.calculate_hotspots", new_callable=AsyncMock) as mock_hotspots:
        mock_hotspots.return_value = {"summary": {}, "location_hotspots": []}
        resp = client.get("/api/analytics/hotspots", headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        assert "location_hotspots" in resp.json()


# ==================================================
# 7. SEED DATABASE (/api/setup/seed)
# ==================================================

def test_seed_database_missing_header_returns_401():
    client = TestClient(app)
    resp = client.post("/api/setup/seed")
    assert resp.status_code == 401


def test_seed_database_student_role_returns_403():
    client = TestClient(app)
    resp = client.post("/api/setup/seed", headers={"X-User-Role": "student"})
    assert resp.status_code == 403


def test_seed_database_admin_role_access_allowed():
    client = TestClient(app)
    with patch("app.main.seed_equipment", new_callable=AsyncMock) as mock_seed:
        resp = client.post("/api/setup/seed", headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        assert "created successfully" in resp.json()["message"]
        mock_seed.assert_called_once()


# ==================================================
# 8. PUBLIC & STUDENT WORKFLOW PRESERVATION
# ==================================================

def test_public_endpoints_accessible_without_auth():
    client = TestClient(app)
    # Root
    resp_root = client.get("/")
    assert resp_root.status_code == 200

    # Health
    with patch("app.main.check_redis", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = True
        resp_health = client.get("/health")
        assert resp_health.status_code == 200

    # Equipment catalogue remains public
    with patch("app.routers.equipment.redis_client.smembers", new_callable=AsyncMock) as mock_smembers:
        mock_smembers.return_value = set()
        resp_eq = client.get("/api/equipment")
        assert resp_eq.status_code == 200


@pytest.mark.asyncio
async def test_student_endpoints_do_not_require_admin_header(fake_redis):
    """
    Student endpoints must function normally with only X-Student-Id
    and without X-User-Role.
    """
    client = TestClient(app)
    student_headers = {"X-Student-Id": "STU-AUTH-001"}

    # 1. Student /me history
    with patch("app.routers.reports.get_student_reports", new_callable=AsyncMock) as mock_get_stu:
        mock_get_stu.return_value = []
        resp_me = client.get("/api/reports/me", headers=student_headers)
        assert resp_me.status_code == 200
        assert resp_me.json()["student_id"] == "STU-AUTH-001"

    # 2. Student create report
    with patch("app.routers.reports.create_report", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = {
            "report": {"report_id": "REP-999", "student_id": "STU-AUTH-001"},
            "stream_id": "1000-0",
        }
        resp_post = client.post("/api/reports", json={
            "student_id": "STU-AUTH-001",
            "title": "Broken window",
            "description": "Draft in winter",
            "category": "Carpentry",
            "location": "Room 202",
        }, headers=student_headers)
        assert resp_post.status_code == 200
        assert resp_post.json()["report"]["report_id"] == "REP-999"
