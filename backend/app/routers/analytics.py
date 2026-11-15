from fastapi import APIRouter, Depends
from app.auth import require_admin
from app.services.hotspot_service import calculate_hotspots

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_admin)],
)


# --------------------------------------------------
# GET MAINTENANCE HOTSPOTS
# --------------------------------------------------

@router.get("/hotspots")
async def get_maintenance_hotspots():
    """
    Retrieves campus maintenance hotspot analytics across:
    - Locations
    - Equipment
    - Issue categories
    Along with overall campus summary metrics.
    """
    hotspots_data = await calculate_hotspots()
    return hotspots_data

