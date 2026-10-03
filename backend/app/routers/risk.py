from fastapi import APIRouter, HTTPException

from app.services.risk_service import (
    calculate_risk_score,
    recalculate_all_risks,
    get_risk_ranking,
)


router = APIRouter(
    prefix="/api/risk",
    tags=["Risk"],
)


# --------------------------------------------------
# CALCULATE RISK FOR ONE EQUIPMENT
# --------------------------------------------------

@router.post("/{equipment_id}/calculate")
async def calculate_equipment_risk(
    equipment_id: str,
):

    try:

        risk_score = await calculate_risk_score(
            equipment_id
        )

    except ValueError:

        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    return {
        "message": "Risk score calculated successfully",
        "equipment_id": equipment_id,
        "risk_score": risk_score,
    }


# --------------------------------------------------
# RECALCULATE ALL EQUIPMENT
# --------------------------------------------------

@router.post("/calculate-all")
async def calculate_all_equipment_risks():

    results = await recalculate_all_risks()

    return {
        "message": "Risk scores recalculated successfully",
        "count": len(results),
        "equipment": results,
    }


# --------------------------------------------------
# GET RISK RANKING
# --------------------------------------------------

@router.get("/ranking")
async def risk_ranking():

    ranking = await get_risk_ranking()

    return {
        "count": len(ranking),
        "ranking": ranking,
    }