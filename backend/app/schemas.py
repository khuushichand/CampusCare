from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --------------------------------------------------
# CREATE REPORT
# --------------------------------------------------

class ReportCreate(BaseModel):
    student_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1)
    equipment_id: Optional[str] = None


# --------------------------------------------------
# REPORT RESPONSE
# --------------------------------------------------

class ReportResponse(BaseModel):
    report_id: str
    student_id: str
    title: str
    description: str
    category: str
    location: str
    equipment_id: Optional[str] = None
    status: str
    created_at: str

# ==================================================
# MAINTENANCE SCHEMAS
# ==================================================

class MaintenanceCreate(BaseModel):
    equipment_id: str
    title: str
    description: str
    technician: str
    scheduled_date: str
    status: str = "SCHEDULED"


class MaintenanceStatusUpdate(BaseModel):
    status: str