from typing import List, Dict, Any, Optional

from app.redis_client import redis_client
from app.config import RISK_ALERT_THRESHOLD
from app.services.alert_service import (
    create_alert,
    resolve_high_risk_alerts,
)
from app.services.event_publisher import (
    publish_event,
    EVENT_RISK_UPDATED,
)


RISK_ZSET_KEY = "campuscare:risk:ranking"

# Authoritative high risk threshold from config
HIGH_RISK_THRESHOLD = RISK_ALERT_THRESHOLD


# --------------------------------------------------
# CALCULATE DETERMINISTIC RISK SCORE
# --------------------------------------------------

async def calculate_risk_score(
    equipment_id: str,
    client=None,
) -> float:
    """
    Deterministically calculate equipment risk based on available, meaningful metrics:
    - failure_count: historical number of recorded failures (weight: up to 50 pts).
    - health_score: current operational health 0-100 (weight: up to 50 pts).

    Formula (Deterministic):
        failure_component = min(failure_count * 10, 50.0)
        health_component  = min(max(100.0 - health_score, 0.0) * 0.5, 50.0)
        risk_score        = round(failure_component + health_component, 2)

    Properties:
    1. Fully deterministic: identical equipment metrics always produce the exact
       same score regardless of invocation history or prior risk_score.
    2. Guaranteed bounds: strictly within [0.0, 100.0].
    3. Missing or invalid numeric values default safely (health_score -> 100.0, failure_count -> 0).
    4. Automatically activates a CRITICAL alert if risk_score >= HIGH_RISK_THRESHOLD (80).
    5. Resolves active high-risk alerts if risk_score drops below HIGH_RISK_THRESHOLD.
    6. Historical failure_count is NOT reset.
    """

    r = client or redis_client

    equipment_key = f"campuscare:equipment:{equipment_id}"

    equipment = await r.hgetall(equipment_key)

    if not equipment:
        raise ValueError("Equipment not found")

    # --------------------------------------------------
    # DECODE & SANITIZE REDIS VALUES
    # --------------------------------------------------

    equipment = {
        (key.decode() if isinstance(key, bytes) else key): (
            value.decode() if isinstance(value, bytes) else value
        )
        for key, value in equipment.items()
    }

    # Safe parsing of failure_count (default 0)
    try:
        raw_fc = equipment.get("failure_count")
        failure_count = max(0, int(float(raw_fc))) if raw_fc is not None and str(raw_fc).strip() != "" else 0
    except (ValueError, TypeError):
        failure_count = 0

    # Safe parsing of health_score (default 100.0, bounded 0-100)
    try:
        raw_hs = equipment.get("health_score")
        if raw_hs is not None and str(raw_hs).strip() != "":
            parsed_hs = float(raw_hs)
            health_score = max(0.0, min(100.0, parsed_hs))
        else:
            health_score = 100.0
    except (ValueError, TypeError):
        health_score = 100.0

    # --------------------------------------------------
    # DETERMINISTIC RISK FORMULA
    # --------------------------------------------------
    # Failure contribution: 0 - 50 (10 points per failure, capping at 5 failures)
    failure_component = min(failure_count * 10.0, 50.0)

    # Health degradation contribution: 0 - 50 (50 points if health is 0, 0 points if health is 100)
    health_component = (100.0 - health_score) * 0.5

    total_score = failure_component + health_component
    risk_score = round(max(0.0, min(100.0, total_score)), 2)

    # --------------------------------------------------
    # UPDATE EQUIPMENT HASH
    # --------------------------------------------------

    await r.hset(
        equipment_key,
        "risk_score",
        risk_score,
    )

    # --------------------------------------------------
    # UPDATE RISK SORTED SET
    # --------------------------------------------------

    previous_risk_raw = equipment.get("risk_score")
    try:
        previous_risk = float(previous_risk_raw) if previous_risk_raw is not None else None
    except (ValueError, TypeError):
        previous_risk = None

    await r.zadd(
        RISK_ZSET_KEY,
        {
            equipment_id: risk_score
        },
    )

    # Publish equipment.risk_updated only if score actually changed
    if previous_risk is None or round(previous_risk, 2) != round(risk_score, 2):
        await publish_event(
            event_type=EVENT_RISK_UPDATED,
            entity_id=equipment_id,
            data={
                "equipment_id": equipment_id,
                "risk_score": risk_score,
                "previous_risk_score": previous_risk,
                "failure_count": failure_count,
                "health_score": health_score,
            },
            client=r,
        )

    # --------------------------------------------------
    # HANDLE HIGH-RISK ALERT
    # --------------------------------------------------

    if risk_score >= HIGH_RISK_THRESHOLD:

        equipment_name = equipment.get(
            "name",
            equipment_id,
        )

        await create_alert(
            equipment_id=equipment_id,
            title="High equipment risk",
            message=(
                f"{equipment_name} {equipment_id} "
                f"has a high predicted failure risk."
            ),
            severity="CRITICAL",
            client=r,
        )

    else:

        # Equipment is no longer high-risk.
        # Resolve any previous active high-risk alert.
        await resolve_high_risk_alerts(
            equipment_id,
            client=r,
        )

    return risk_score


# --------------------------------------------------
# UPDATE ALL EQUIPMENT RISK SCORES
# --------------------------------------------------

async def recalculate_all_risks(client=None) -> List[
    Dict[str, Any]
]:

    r = client or redis_client

    equipment_ids = await r.smembers(
        "campuscare:equipment:index"
    )

    results = []

    for equipment_id in equipment_ids:

        if isinstance(
            equipment_id,
            bytes,
        ):
            equipment_id = equipment_id.decode()

        try:

            risk_score = (
                await calculate_risk_score(
                    equipment_id,
                    client=r,
                )
            )

            results.append(
                {
                    "equipment_id":
                        equipment_id,
                    "risk_score":
                        risk_score,
                }
            )

        except ValueError:
            continue

    return results


# --------------------------------------------------
# GET RISK RANKING
# --------------------------------------------------

async def get_risk_ranking(client=None):

    r = client or redis_client

    ranking = await r.zrevrange(
        RISK_ZSET_KEY,
        0,
        -1,
        withscores=True,
    )

    results = []

    for equipment_id, score in ranking:

        if isinstance(
            equipment_id,
            bytes,
        ):
            equipment_id = equipment_id.decode()

        results.append(
            {
                "equipment_id":
                    equipment_id,
                "risk_score":
                    score,
            }
        )

    return results
