"""
Hotspot Analytics Service
=========================
Calculates maintenance hotspots across locations, equipment, and issue categories
from Redis incident hashes and report data.

Key features:
- Grouping by location, equipment, and category.
- Accounting for grouped incident report counts (student report volume).
- Safe handling of missing/malformed fields.
- Exclusion of incident-report link Set keys (campuscare:incident:reports:*).
- Transparent, bounded, deterministic priority scoring formula.
- Summary statistics across campus maintenance.
"""

from typing import Any, Dict, List, Optional
from app.redis_client import redis_client

INCIDENT_KEY_PREFIX = "campuscare:incident:"
INCIDENT_REPORTS_KEY_PREFIX = "campuscare:incident:reports:"
EQUIPMENT_KEY_PREFIX = "campuscare:equipment:"

ALLOWED_SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")

SEVERITY_WEIGHTS = {
    "LOW": 1.0,
    "MEDIUM": 2.0,
    "HIGH": 3.0,
    "CRITICAL": 4.0,
}


def calculate_hotspot_priority(
    incident_count: int,
    report_count: int,
    severity_dist: Dict[str, int],
) -> float:
    """
    Calculates a bounded, deterministic priority score in [0.0, 100.0].

    Formula:
    1. Average Severity Factor (S_factor in [0.25, 1.0]):
       avg_severity = sum(count * weight for severity) / incident_count
       S_factor = avg_severity / 4.0

    2. Combined Volume Factor (V_factor in [0.0, 1.0]):
       freq_factor = min(1.0, incident_count / 5.0)
       report_factor = min(1.0, max(incident_count, report_count) / 10.0)
       V_factor = 0.5 * freq_factor + 0.5 * report_factor

    3. Priority Score:
       raw_score = (0.60 * V_factor + 0.40 * S_factor) * 100.0
       score = min(100.0, max(0.0, raw_score))

    Properties:
    - Bounded in [0.0, 100.0]
    - Higher incident frequency increases priority
    - Higher student report count increases priority
    - Higher severity increases priority
    - Missing severity safely treated as MEDIUM (weight 2.0)
    - Deterministic with zero recursive risk_score dependencies
    """
    if incident_count <= 0:
        return 0.0

    total_sev_weight = sum(
        severity_dist.get(sev, 0) * weight
        for sev, weight in SEVERITY_WEIGHTS.items()
    )
    avg_severity = total_sev_weight / float(incident_count)
    s_factor = avg_severity / 4.0

    freq_factor = min(1.0, incident_count / 5.0)
    report_factor = min(1.0, max(incident_count, report_count) / 10.0)
    v_factor = 0.5 * freq_factor + 0.5 * report_factor

    raw_score = (0.60 * v_factor + 0.40 * s_factor) * 100.0
    return round(min(100.0, max(0.0, raw_score)), 2)


async def get_all_incidents_data(client=None) -> List[Dict[str, Any]]:
    """
    Safely retrieves and normalizes all incident records from Redis.
    Excludes relationship set keys (campuscare:incident:reports:*).
    Deduplicates scanned keys to avoid counting any incident twice.
    """
    r = client or redis_client
    incidents = []
    seen_keys = set()

    async for key in r.scan_iter(match=f"{INCIDENT_KEY_PREFIX}*"):
        key_str = key.decode() if isinstance(key, bytes) else key

        # Exclude relationship keys
        if key_str.startswith(INCIDENT_REPORTS_KEY_PREFIX):
            continue

        if key_str in seen_keys:
            continue
        seen_keys.add(key_str)

        raw = await r.hgetall(key)
        if not raw:
            continue

        incident = {
            (k.decode() if isinstance(k, bytes) else k): (
                v.decode() if isinstance(v, bytes) else v
            )
            for k, v in raw.items()
        }

        # Safe extraction and normalization
        incident_id = incident.get("incident_id") or key_str[len(INCIDENT_KEY_PREFIX):]
        incident["incident_id"] = incident_id

        # Normalize report_count
        raw_rc = incident.get("report_count")
        try:
            rc = int(raw_rc) if raw_rc is not None else 1
            if rc < 1:
                rc = 1
        except (ValueError, TypeError):
            rc = 1
        incident["report_count"] = rc

        # Normalize severity
        raw_sev = incident.get("severity")
        if raw_sev and isinstance(raw_sev, str):
            sev = raw_sev.strip().upper()
            if sev not in ALLOWED_SEVERITIES:
                sev = "MEDIUM"
        else:
            sev = "MEDIUM"
        incident["severity"] = sev

        # Normalize location
        raw_loc = incident.get("location")
        if raw_loc and isinstance(raw_loc, str) and raw_loc.strip():
            incident["location"] = raw_loc.strip()
        else:
            incident["location"] = "UNKNOWN"

        # Normalize category
        raw_cat = incident.get("category")
        if raw_cat and isinstance(raw_cat, str) and raw_cat.strip():
            incident["category"] = raw_cat.strip().upper()
        else:
            incident["category"] = "UNCATEGORIZED"

        # Normalize equipment_id
        raw_eq = incident.get("equipment_id")
        if raw_eq and isinstance(raw_eq, str) and raw_eq.strip():
            incident["equipment_id"] = raw_eq.strip()
        else:
            incident["equipment_id"] = None

        incidents.append(incident)

    return incidents


async def calculate_hotspots(client=None) -> Dict[str, Any]:
    """
    Computes location, equipment, and category hotspots along with summary metrics.
    """
    r = client or redis_client
    incidents = await get_all_incidents_data(client=r)

    total_incidents = len(incidents)
    total_reports = sum(inc["report_count"] for inc in incidents)

    # --------------------------------------------------
    # 1. LOCATION HOTSPOTS
    # --------------------------------------------------
    loc_groups: Dict[str, Dict[str, Any]] = {}
    for inc in incidents:
        loc = inc["location"]
        if loc not in loc_groups:
            loc_groups[loc] = {
                "location": loc,
                "incident_count": 0,
                "report_count": 0,
                "severity_distribution": {s: 0 for s in ALLOWED_SEVERITIES},
            }
        loc_groups[loc]["incident_count"] += 1
        loc_groups[loc]["report_count"] += inc["report_count"]
        loc_groups[loc]["severity_distribution"][inc["severity"]] += 1

    location_hotspots = []
    for loc, data in loc_groups.items():
        score = calculate_hotspot_priority(
            incident_count=data["incident_count"],
            report_count=data["report_count"],
            severity_dist=data["severity_distribution"],
        )
        # Recurring problem flag: multiple incidents or high report volume
        is_recurring = data["incident_count"] >= 2 or data["report_count"] >= 3
        location_hotspots.append({
            "location": loc,
            "incident_count": data["incident_count"],
            "report_count": data["report_count"],
            "severity_distribution": data["severity_distribution"],
            "is_recurring": is_recurring,
            "priority_score": score,
        })

    # Sort descending by priority_score, then incident_count
    location_hotspots.sort(
        key=lambda x: (x["priority_score"], x["incident_count"], x["report_count"]),
        reverse=True,
    )

    # --------------------------------------------------
    # 2. EQUIPMENT HOTSPOTS
    # --------------------------------------------------
    eq_groups: Dict[str, Dict[str, Any]] = {}
    for inc in incidents:
        eq_id = inc["equipment_id"]
        if not eq_id:
            continue
        if eq_id not in eq_groups:
            eq_groups[eq_id] = {
                "equipment_id": eq_id,
                "incident_count": 0,
                "report_count": 0,
                "severity_distribution": {s: 0 for s in ALLOWED_SEVERITIES},
            }
        eq_groups[eq_id]["incident_count"] += 1
        eq_groups[eq_id]["report_count"] += inc["report_count"]
        eq_groups[eq_id]["severity_distribution"][inc["severity"]] += 1

    equipment_hotspots = []
    for eq_id, data in eq_groups.items():
        # Fetch equipment details if available in Redis
        eq_key = f"{EQUIPMENT_KEY_PREFIX}{eq_id}"
        raw_eq = await r.hgetall(eq_key)
        eq_details = {}
        if raw_eq:
            eq_details = {
                (k.decode() if isinstance(k, bytes) else k): (
                    v.decode() if isinstance(v, bytes) else v
                )
                for k, v in raw_eq.items()
            }

        eq_name = eq_details.get("name")
        eq_type = eq_details.get("type")
        eq_loc = eq_details.get("location")
        eq_status = eq_details.get("status")

        raw_health = eq_details.get("health_score")
        health_score = None
        if raw_health is not None and raw_health != "":
            try:
                health_score = int(float(raw_health))
            except (ValueError, TypeError):
                health_score = None

        raw_failures = eq_details.get("failure_count")
        failure_count = None
        if raw_failures is not None and raw_failures != "":
            try:
                failure_count = int(raw_failures)
            except (ValueError, TypeError):
                failure_count = None

        score = calculate_hotspot_priority(
            incident_count=data["incident_count"],
            report_count=data["report_count"],
            severity_dist=data["severity_distribution"],
        )

        is_recurring = (
            data["incident_count"] >= 2
            or data["report_count"] >= 3
            or (failure_count is not None and failure_count >= 2)
        )

        equipment_hotspots.append({
            "equipment_id": eq_id,
            "equipment_name": eq_name,
            "equipment_type": eq_type,
            "location": eq_loc,
            "status": eq_status,
            "health_score": health_score,
            "failure_count": failure_count,
            "incident_count": data["incident_count"],
            "report_count": data["report_count"],
            "severity_distribution": data["severity_distribution"],
            "is_recurring": is_recurring,
            "priority_score": score,
        })

    equipment_hotspots.sort(
        key=lambda x: (x["priority_score"], x["incident_count"], x["report_count"]),
        reverse=True,
    )

    # --------------------------------------------------
    # 3. CATEGORY HOTSPOTS
    # --------------------------------------------------
    cat_groups: Dict[str, Dict[str, Any]] = {}
    for inc in incidents:
        cat = inc["category"]
        if cat not in cat_groups:
            cat_groups[cat] = {
                "category": cat,
                "incident_count": 0,
                "report_count": 0,
                "severity_distribution": {s: 0 for s in ALLOWED_SEVERITIES},
            }
        cat_groups[cat]["incident_count"] += 1
        cat_groups[cat]["report_count"] += inc["report_count"]
        cat_groups[cat]["severity_distribution"][inc["severity"]] += 1

    category_hotspots = []
    for cat, data in cat_groups.items():
        score = calculate_hotspot_priority(
            incident_count=data["incident_count"],
            report_count=data["report_count"],
            severity_dist=data["severity_distribution"],
        )
        category_hotspots.append({
            "category": cat,
            "incident_count": data["incident_count"],
            "report_count": data["report_count"],
            "severity_distribution": data["severity_distribution"],
            "priority_score": score,
        })

    category_hotspots.sort(
        key=lambda x: (x["priority_score"], x["incident_count"], x["report_count"]),
        reverse=True,
    )

    # --------------------------------------------------
    # 4. SUMMARY STATISTICS
    # --------------------------------------------------
    most_affected_location = location_hotspots[0]["location"] if location_hotspots else None
    most_frequently_affected_equipment = (
        equipment_hotspots[0]["equipment_id"] if equipment_hotspots else None
    )
    most_common_issue_category = (
        category_hotspots[0]["category"] if category_hotspots else None
    )

    summary = {
        "total_incidents_analyzed": total_incidents,
        "total_reports_represented": total_reports,
        "most_affected_location": most_affected_location,
        "most_frequently_affected_equipment": most_frequently_affected_equipment,
        "most_common_issue_category": most_common_issue_category,
    }

    return {
        "location_hotspots": location_hotspots,
        "equipment_hotspots": equipment_hotspots,
        "category_hotspots": category_hotspots,
        "summary": summary,
    }

