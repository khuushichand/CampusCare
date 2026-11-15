"""
Maintenance Router Tests
========================
Verifies:
- POST /api/maintenance with non-existent equipment_id returns HTTP 404.
- Non-existent equipment validation prevents creating any maintenance hash or index.
- POST /api/maintenance with valid equipment_id returns HTTP 200 and persists records.
"""

import pytest
import fakeredis
import fakeredis.aioredis
from unittest.mock import patch
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
def fake_redis_server():
    return fakeredis.FakeServer()


@pytest.fixture
def fake_redis(fake_redis_server):
    return fakeredis.FakeAsyncRedis(server=fake_redis_server, decode_responses=True)


@pytest.mark.asyncio
async def test_create_maintenance_invalid_equipment_returns_404(fake_redis):
    """POST /api/maintenance must reject non-existent equipment_id with 404 without writing records."""
    client = TestClient(app)

    payload = {
        "equipment_id": "NON-EXISTENT-EQUIP",
        "title": "HVAC Filter Inspection",
        "description": "Quarterly inspection and cleaning",
        "technician": "Tech Jane",
        "scheduled_date": "2026-12-01",
        "status": "SCHEDULED",
    }

    with patch("app.routers.maintenance.redis_client", fake_redis):
        response = client.post(
            "/api/maintenance",
            json=payload,
            headers={"X-User-Role": "admin"},
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

        # Confirm no maintenance records were created in Redis
        idx_members = await fake_redis.smembers("campuscare:maintenance:index")
        assert len(idx_members) == 0

        keys = []
        async for k in fake_redis.scan_iter(match="campuscare:maintenance:*"):
            keys.append(k)
        assert len(keys) == 0


@pytest.mark.asyncio
async def test_create_maintenance_valid_equipment_success_200(fake_redis):
    """POST /api/maintenance succeeds with 200 when equipment exists in campuscare:equipment:index."""
    client = TestClient(app)

    # Seed equipment in index
    eq_id = "EQ-VAL-101"
    await fake_redis.sadd("campuscare:equipment:index", eq_id)

    payload = {
        "equipment_id": eq_id,
        "title": "Projector Lamp Replacement",
        "description": "Replace burned-out projector bulb",
        "technician": "Tech Bob",
        "scheduled_date": "2026-11-25",
        "status": "SCHEDULED",
    }

    with patch("app.routers.maintenance.redis_client", fake_redis):
        response = client.post(
            "/api/maintenance",
            json=payload,
            headers={"X-User-Role": "admin"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Maintenance record created successfully"
        maintenance_id = data["maintenance"]["maintenance_id"]
        assert maintenance_id.startswith("MAIN-")

        # Confirm index and hash were written
        idx_members = await fake_redis.smembers("campuscare:maintenance:index")
        assert maintenance_id in idx_members

        stored_hash = await fake_redis.hgetall(f"campuscare:maintenance:{maintenance_id}")
        assert stored_hash["equipment_id"] == eq_id
        assert stored_hash["technician"] == "Tech Bob"
        assert stored_hash["status"] == "SCHEDULED"

