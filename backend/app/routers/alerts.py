from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.alert_service import (
    create_alert,
    get_all_alerts,
    get_alert,
    update_alert_status,
)


router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"],
)


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------

class AlertCreate(BaseModel):
    equipment_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    severity: str = "HIGH"


class AlertStatusUpdate(BaseModel):
    status: str


# --------------------------------------------------
# CREATE ALERT
# --------------------------------------------------

@router.post("")
async def create_alert_endpoint(data: AlertCreate):

    alert = await create_alert(
        equipment_id=data.equipment_id,
        title=data.title,
        message=data.message,
        severity=data.severity,
    )

    return {
        "message": "Alert created successfully",
        "alert": alert,
    }


# --------------------------------------------------
# GET ALL ALERTS
# --------------------------------------------------

@router.get("")
async def get_alerts_endpoint():

    alerts = await get_all_alerts()

    return {
        "count": len(alerts),
        "alerts": alerts,
    }


# --------------------------------------------------
# GET ONE ALERT
# --------------------------------------------------

@router.get("/{alert_id}")
async def get_alert_endpoint(alert_id: str):

    alert = await get_alert(alert_id)

    if not alert:
        raise HTTPException(
            status_code=404,
            detail="Alert not found",
        )

    return {
        "alert": alert,
    }


# --------------------------------------------------
# UPDATE ALERT STATUS
# --------------------------------------------------

@router.patch("/{alert_id}/status")
async def update_alert_status_endpoint(
    alert_id: str,
    data: AlertStatusUpdate,
):

    alert = await update_alert_status(
        alert_id=alert_id,
        status=data.status,
    )

    if not alert:
        raise HTTPException(
            status_code=404,
            detail="Alert not found",
        )

    return {
        "message": "Alert status updated successfully",
        "alert": alert,
    }