from typing import List, Dict, Any

from app.redis_client import redis_client
from app.services.alert_service import (
    create_alert,
    resolve_high_risk_alerts,
)


RISK_ZSET_KEY = "campuscare:risk:ranking"

# Equipment at or above this score is considered high risk.
HIGH_RISK_THRESHOLD = 70


# --------------------------------------------------
# CALCULATE RISK SCORE
# --------------------------------------------------

async def calculate_risk_score(
    equipment_id: str,
) -> float:
    """
    Calculate equipment risk using:

    - failure count
    - health score
    - existing risk score

    The resulting score is stored in:
        1. Equipment HASH
        2. Risk sorted set

    High-risk equipment automatically receives
    an ACTIVE alert.

    Equipment that is no longer high-risk has its
    previous high-risk alert marked RESOLVED.

    Historical failure_count is NOT reset.
    """

    equipment_key = (
        f"campuscare:equipment:{equipment_id}"
    )

    equipment = await redis_client.hgetall(
        equipment_key
    )

    if not equipment:
        raise ValueError(
            "Equipment not found"
        )

    # --------------------------------------------------
    # DECODE REDIS VALUES
    # --------------------------------------------------

    equipment = {
        (
            key.decode()
            if isinstance(key, bytes)
            else key
        ): (
            value.decode()
            if isinstance(value, bytes)
            else value
        )
        for key, value in equipment.items()
    }

    failure_count = int(
        equipment.get(
            "failure_count",
            0,
        )
    )

    health_score = float(
        equipment.get(
            "health_score",
            100,
        )
    )

    existing_risk = float(
        equipment.get(
            "risk_score",
            0,
        )
    )

    # --------------------------------------------------
    # RISK FORMULA
    # --------------------------------------------------
    #
    # Failure contribution:
    #     maximum 40
    #
    # Health contribution:
    #     maximum 40
    #
    # Existing risk contribution:
    #     maximum 20
    #
    # Total:
    #     0 - 100
    #
    # --------------------------------------------------

    failure_component = min(
        failure_count * 5,
        40,
    )

    health_component = min(
        max(
            100 - health_score,
            0,
        ) * 0.4,
        40,
    )

    existing_risk_component = min(
        existing_risk * 0.2,
        20,
    )

    risk_score = (
        failure_component
        + health_component
        + existing_risk_component
    )

    risk_score = round(
        min(
            max(
                risk_score,
                0,
            ),
            100,
        ),
        2,
    )

    # --------------------------------------------------
    # UPDATE EQUIPMENT HASH
    # --------------------------------------------------

    await redis_client.hset(
        equipment_key,
        "risk_score",
        risk_score,
    )

    # --------------------------------------------------
    # UPDATE RISK SORTED SET
    # --------------------------------------------------

    await redis_client.zadd(
        RISK_ZSET_KEY,
        {
            equipment_id: risk_score
        },
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
        )

    else:

        # Equipment is no longer high-risk.
        # Resolve any previous active high-risk alert.
        await resolve_high_risk_alerts(
            equipment_id
        )

    return risk_score


# --------------------------------------------------
# UPDATE ALL EQUIPMENT RISK SCORES
# --------------------------------------------------

async def recalculate_all_risks() -> List[
    Dict[str, Any]
]:

    equipment_ids = await redis_client.smembers(
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
                    equipment_id
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

async def get_risk_ranking():

    ranking = await redis_client.zrevrange(
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
