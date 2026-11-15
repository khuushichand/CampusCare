import uuid
from pathlib import Path

from fastapi import UploadFile, File
from app.services.report_service import attach_report_image

from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from app.auth import require_admin
from app.schemas import ReportCreate
from app.services.report_service import (
    create_report,
    get_reports,
    get_report_by_id,
    get_student_reports,
)

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
)
# --------------------------------------------------
# IMAGE UPLOAD CONFIGURATION
# --------------------------------------------------

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_IMAGE_SIZE = 5 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

def get_current_student_id(
    x_student_id: Optional[str] = Header(None, alias="X-Student-Id"),
) -> str:
    """
    Demo Identity Resolver:
    In this prototype, identity is passed via an explicit X-Student-Id header.
    
    IMPORTANT ARCHITECTURAL & SECURITY LIMITATION:
    This is a prototype demonstration mechanism. In a production deployment,
    this must be replaced with cryptographically signed tokens (e.g., JWT / OAuth2
    Authorization: Bearer <token>) validated against the campus IdP / Auth service.
    An unauthenticated header must NEVER be trusted as proof of identity in production.
    """
    if not x_student_id or not x_student_id.strip():
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Authentication required. Please provide a valid student identifier via the X-Student-Id header.",
                "demo_note": "This demo uses X-Student-Id header for identity simulation. Production requires JWT/OAuth2."
            },
        )
    return x_student_id.strip()


# --------------------------------------------------
# CREATE REPORT
# --------------------------------------------------

@router.post("")
async def create_student_report(
    report: ReportCreate,
    x_student_id: Optional[str] = Header(None, alias="X-Student-Id"),
):
    """
    Create a student report and append to Redis stream and student index.
    - Requires X-Student-Id header (HTTP 401 if missing).
    - Enforces that report.student_id matches X-Student-Id (HTTP 403 if mismatch).
    """
    auth_student_id = get_current_student_id(x_student_id)
    body_student_id = report.student_id.strip()

    if body_student_id != auth_student_id:
        raise HTTPException(
            status_code=403,
            detail="Student ID in request body does not match authenticated identity.",
        )

    result = await create_report(
        student_id=auth_student_id,
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
# GET CURRENT STUDENT'S REPORTS (/me)
# --------------------------------------------------

@router.get("/me")
async def get_my_reports(
    x_student_id: Optional[str] = Header(None, alias="X-Student-Id"),
):
    """
    Retrieves all reports submitted by the authenticated student.
    Does NOT expose other students' reports across campus.
    """
    student_id = get_current_student_id(x_student_id)
    reports = await get_student_reports(student_id)

    return {
        "student_id": student_id,
        "count": len(reports),
        "reports": reports,
    }


# --------------------------------------------------
# GET ALL REPORTS (GLOBAL / ADMIN)
# --------------------------------------------------

@router.get("", dependencies=[Depends(require_admin)])
async def get_all_reports():
    """
    Global stream report list for administrative inspection.
    """
    reports = await get_reports()

    return {
        "count": len(reports),
        "reports": reports,
    }

# --------------------------------------------------
# UPLOAD REPORT IMAGE
# --------------------------------------------------

@router.post("/{report_id}/image")
async def upload_report_image(
    report_id: str,
    file: UploadFile = File(...),
    x_student_id: Optional[str] = Header(None, alias="X-Student-Id"),
):
    student_id = get_current_student_id(x_student_id)

    report = await get_report_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    if report.get("student_id") != student_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot upload an image to another student's report.",
        )

    extension = ALLOWED_IMAGE_TYPES.get(file.content_type)

    if not extension:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG and WebP images are allowed.",
        )

    contents = await file.read(MAX_IMAGE_SIZE + 1)

    if not contents:
        raise HTTPException(status_code=400, detail="Image is empty.")

    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image must not exceed 5 MB.",
        )

    filename = f"{uuid.uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / filename

    try:
        file_path.write_bytes(contents)

        image_url = f"/uploads/{filename}"

        saved = await attach_report_image(report_id, image_url)

        if not saved:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=404, detail="Report not found.")

    except HTTPException:
        raise

    except Exception:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Unable to save report image.",
        )

    finally:
        await file.close()

    return {
        "message": "Image uploaded successfully.",
        "image_url": image_url,
    }
# --------------------------------------------------
# GET INDIVIDUAL REPORT DETAILS BY ID
# --------------------------------------------------

@router.get("/{report_id}")
async def get_report_details(
    report_id: str,
    x_student_id: Optional[str] = Header(None, alias="X-Student-Id"),
):
    """
    Retrieves details and live processing status for an individual report.
    - Requires X-Student-Id header (HTTP 401 if missing).
    - Always enforces report ownership (HTTP 403 if report author does not match).
    """
    auth_student_id = get_current_student_id(x_student_id)
    report = await get_report_by_id(report_id)

    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Report '{report_id}' not found.",
        )

    if report.get("student_id") != auth_student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You do not have permission to view this report.",
        )

    return {
        "report": report,
    }
