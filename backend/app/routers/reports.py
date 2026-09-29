from fastapi import APIRouter, HTTPException

from app.schemas import ReportCreate
from app.services.report_service import (
    create_report,
    get_reports,
)


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
)


# --------------------------------------------------
# CREATE REPORT
# --------------------------------------------------

@router.post("")
async def create_student_report(report: ReportCreate):

    result = await create_report(
        student_id=report.student_id,
        title=report.title,
        description=report.description,
        category=report.category,
        location=report.location,
        equipment_id=report.equipment_id,
    )

    return {
        "message": "Report submitted successfully",
        "report": result["report"],
        "stream_id": result["stream_id"],
    }


# --------------------------------------------------
# GET ALL REPORTS
# --------------------------------------------------

@router.get("")
async def get_all_reports():

    reports = await get_reports()

    return {
        "count": len(reports),
        "reports": reports,
    }