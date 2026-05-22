"""
Truck assignment algorithm for ML-predicted waste schedules.
Assigns real database trucks to districts based on predicted waste volume,
truck capacity, and driver proximity.

Nepal-context truck capacity tiers:
  - Light duty:  < 1,000 kg  (Tata Ace, small pickups — narrow gallis)
  - Medium duty: 1,000–3,500 kg (Tata 407, Eicher — standard municipal)
  - Heavy duty:  > 3,500 kg  (Compactors, Ashok Leyland — main roads)
"""

import math

from model import predict_waste, predict_waste_by_type, get_model_info, DISTRICTS, DISTRICT_TYPES, categorize_waste

EXACT_TRUCK_LIMIT = 16
BEAM_WIDTH = 250


def get_duty_type_for_waste(waste_kg):
    """
    Determine required truck duty type based on predicted waste.
    Nepal-context thresholds:
      < 1,000 kg  → light duty (small pickup fits)
      1,000–3,500 → medium duty (standard municipal truck)
      > 3,500     → heavy duty (compactor needed)
    """
    if waste_kg < 1000:
        return "light"
    elif waste_kg <= 3500:
        return "medium"
    else:
        return "heavy"


def score_truck_for_district(truck, district, predicted_kg):
    """
    Score a truck for a district assignment.
    Higher score = better fit.

    Scoring factors:
      1. Capacity match (50%) — truck should fit the waste
      2. Truck type match (50%) — right duty class for the waste volume
    """
    score = 0.0

    # 1. Capacity match
    capacity = truck["capacity_kg"]
    if capacity <= 0:
        return 0.0
    if capacity < predicted_kg:
        capacity_score = capacity / predicted_kg
    else:
        ratio = predicted_kg / capacity
        capacity_score = ratio
    score += 0.50 * capacity_score

    # 2. Truck type match
    required_type = get_duty_type_for_waste(predicted_kg)
    truck_type = truck.get("duty_type", "medium")
    # Normalize duty type
    if "light" in truck_type.lower():
        truck_duty = "light"
    elif "heavy" in truck_type.lower():
        truck_duty = "heavy"
    else:
        truck_duty = "medium"

    if truck_duty == required_type:
        score += 0.50 * 1.0
    elif (
        (required_type == "light" and truck_duty == "medium")
        or (required_type == "medium" and truck_duty == "heavy")
    ):
        score += 0.50 * 0.6
    else:
        score += 0.50 * 0.2

    return round(score, 4)


def _distance_km(left, right):
    if not left or not right:
        return 0.0
    if not left.get("latitude") or not left.get("longitude"):
        return 0.0
    if not right.get("latitude") or not right.get("longitude"):
        return 0.0

    earth_radius_km = 6371
    lat1 = math.radians(left["latitude"])
    lat2 = math.radians(right["latitude"])
    d_lat = math.radians(right["latitude"] - left["latitude"])
    d_lon = math.radians(right["longitude"] - left["longitude"])
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(h))


def _subset_cost(area, subset):
    predicted_kg = area.get("predicted_waste_kg", 0) or 0
    area_org_id = area.get("org_id")
    area_location = area.get("location") or area.get("coordinates")
    capacity = sum(t.get("capacity_kg", 0) or 0 for t in subset)
    uncovered = max(0, predicted_kg - capacity)
    excess = max(0, capacity - predicted_kg)
    cross_org = sum(
        1 for t in subset
        if area_org_id and t.get("org_id") != area_org_id
    )
    driverless = sum(1 for t in subset if not t.get("driver_id"))
    distance = sum(
        _distance_km(area_location, t.get("location") or t.get("driver_location"))
        for t in subset
    )

    return {
        "capacity": capacity,
        "uncovered": uncovered,
        "excess": excess,
        "cost": (
            uncovered * 1_000_000
            + excess * 1_000
            + cross_org * 10_000
            + driverless * 50_000
            + distance * 25
            + len(subset) * 5
        ),
    }


def _build_subset_options(area, trucks):
    ranked = sorted(
        [t for t in trucks if (t.get("capacity_kg", 0) or 0) > 0],
        key=lambda t: _subset_cost(area, [t])["cost"],
    )[:EXACT_TRUCK_LIMIT]

    options = [{"mask": 0, "trucks": [], **_subset_cost(area, [])}]
    for mask in range(1, 1 << len(ranked)):
        subset = [ranked[idx] for idx in range(len(ranked)) if mask & (1 << idx)]
        global_mask = 0
        for truck in subset:
            global_mask |= truck["_bit"]
        options.append({"mask": global_mask, "trucks": subset, **_subset_cost(area, subset)})

    return sorted(options, key=lambda o: o["cost"])[:350]


def optimize_truck_assignments(predictions, available_trucks):
    """
    Optimize all area assignments together instead of assigning each area greedily.

    Objective priorities are encoded as weighted costs:
      - minimize uncovered waste first
      - then minimize excess truck capacity
      - prefer same-organization trucks
      - prefer nearby trucks/drivers when coordinates exist
      - penalize driverless trucks
    """
    trucks = [
        {**truck, "_bit": 1 << idx}
        for idx, truck in enumerate(available_trucks)
        if (truck.get("capacity_kg", 0) or 0) > 0
    ]
    service_areas = [
        p for p in predictions
        if p.get("waste_category") != "none" and (p.get("predicted_waste_kg", 0) or 0) > 0
    ]
    service_areas.sort(key=lambda p: p.get("predicted_waste_kg", 0) or 0, reverse=True)

    states = {0: {"cost": 0, "assignment": {}}}
    for area in service_areas:
        area_key = area["district"]
        subset_options = _build_subset_options(area, trucks)
        next_states = {}
        for used_mask, state in states.items():
            for option in subset_options:
                if used_mask & option["mask"]:
                    continue
                next_mask = used_mask | option["mask"]
                next_cost = state["cost"] + option["cost"]
                existing = next_states.get(next_mask)
                if existing is None or next_cost < existing["cost"]:
                    assignment = dict(state["assignment"])
                    assignment[area_key] = option
                    next_states[next_mask] = {"cost": next_cost, "assignment": assignment}

        sorted_states = sorted(next_states.items(), key=lambda item: item[1]["cost"])
        if len(trucks) <= EXACT_TRUCK_LIMIT:
            states = dict(sorted_states)
        else:
            states = dict(sorted_states[:BEAM_WIDTH])

    if not states:
        return {}, "exact-bitmask-dp" if len(trucks) <= EXACT_TRUCK_LIMIT else "beam-search-dp"

    best = min(states.values(), key=lambda state: state["cost"])
    method = "exact-bitmask-dp" if len(trucks) <= EXACT_TRUCK_LIMIT else "beam-search-dp"
    return best["assignment"], method


def assign_trucks_to_district(district, predicted_kg, waste_category, available_trucks):
    """
    Assign best truck(s) to a district based on predicted waste.
    Trucks come from the real database (passed by backend).
    Returns list of assigned truck info dicts.
    """
    if waste_category == "none":
        return []

    assignments = []
    remaining_kg = predicted_kg

    # Score all available trucks
    scored = []
    for truck in available_trucks:
        s = score_truck_for_district(truck, district, predicted_kg)
        scored.append({"truck": truck, "score": s})

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    # Assign trucks until predicted waste is covered
    for item in scored:
        if remaining_kg <= 0:
            break

        truck = item["truck"]
        assignments.append({
            "truck_id": truck["id"],
            "license_plate": truck["license_plate"],
            "truck_type": truck.get("duty_type", "medium duty"),
            "capacity_kg": truck["capacity_kg"],
            "org_id": truck.get("org_id"),
            "org_name": truck.get("org_name"),
            "driver_id": truck.get("driver_id"),
            "driver_name": truck.get("driver_name", "Unassigned"),
            "score": item["score"],
        })

        remaining_kg -= truck["capacity_kg"]

    return assignments


def generate_schedule(target_date, trucks, unavailable_drivers=None, extra_areas=None):
    """
    Generate a full day schedule for all districts + any extra (new) areas.

    Args:
        target_date: date object
        trucks: list of truck dicts from MongoDB (real data from backend)
            Each truck: { id, license_plate, capacity_kg, duty_type, org_id, org_name, driver_id, driver_name }
        unavailable_drivers: list of driver IDs that are not available
        extra_areas: list of dicts for new areas not in trained data
            Each: { name: str, type: str, scale_factor: float }

    Returns:
        dict with full schedule details
    """
    unavailable = set(unavailable_drivers or [])
    extra_areas = extra_areas or []

    # Filter out trucks whose drivers are unavailable
    available_trucks = [
        t for t in trucks
        if t.get("driver_id") not in unavailable
    ]

    district_results = []
    total_predicted = 0

    # 1. Predict waste for all trained districts
    predictions = []
    for district in DISTRICTS:
        pred = predict_waste(district, target_date)
        predictions.append(pred)

    # 2. Predict waste for extra (new/unknown) areas using type-based averaging
    for area in extra_areas:
        area_name = area.get("name", "").strip()
        area_type = area.get("type", "residential")
        scale = area.get("scale_factor", 1.0)

        # Skip if this area is already a trained district
        if area_name in DISTRICT_TYPES:
            continue

        try:
            pred = predict_waste_by_type(area_name, area_type, target_date, scale)
            predictions.append(pred)
        except ValueError:
            # Skip areas with invalid types
            continue

    # 3. Optimize truck assignment across all districts in one pass.
    optimized_assignments, optimizer_method = optimize_truck_assignments(predictions, available_trucks)
    used_truck_ids = {
        truck["id"]
        for option in optimized_assignments.values()
        for truck in option.get("trucks", [])
    }

    # 4. Build district schedule rows from optimized assignment choices.
    for pred in predictions:
        district = pred["district"]
        predicted_kg = pred["predicted_waste_kg"]
        waste_category = pred["waste_category"]
        option = optimized_assignments.get(district, {"trucks": [], "capacity": 0, "uncovered": predicted_kg})
        assigned = []
        for truck in option.get("trucks", []):
            assigned.append({
                "truck_id": truck["id"],
                "license_plate": truck["license_plate"],
                "truck_type": truck.get("duty_type", "medium duty"),
                "capacity_kg": truck["capacity_kg"],
                "org_id": truck.get("org_id"),
                "org_name": truck.get("org_name"),
                "driver_id": truck.get("driver_id"),
                "driver_name": truck.get("driver_name", "Unassigned"),
                "score": score_truck_for_district(truck, district, predicted_kg),
            })

        if waste_category == "none":
            action = "skip"
        elif not assigned:
            action = "skip"
        elif option.get("uncovered", predicted_kg) <= 0:
            action = "dispatch"
        else:
            action = "reduced"

        total_predicted += predicted_kg

        district_results.append({
            "district": district,
            "district_type": pred["district_type"],
            "predicted_waste_kg": predicted_kg,
            "waste_category": waste_category,
            "action": action,
            "recommendation": pred["recommendation"],
            "is_holiday": pred["is_holiday"],
            "holiday_name": pred.get("holiday_name"),
            "prediction_method": pred.get("prediction_method", "model"),
            "confidence": pred.get("confidence"),
            "optimizer": optimizer_method,
            "assigned_trucks": assigned,
        })

    # Sort results by district name for consistent display
    district_results.sort(key=lambda d: d["district"])

    # Summary
    dispatched = sum(1 for d in district_results if d["action"] == "dispatch")
    skipped = sum(1 for d in district_results if d["action"] == "skip")
    reduced = sum(1 for d in district_results if d["action"] == "reduced")

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    return {
        "date": target_date.isoformat(),
        "day_name": day_names[target_date.weekday()],
        "model_info": {
            "model": "GradientBoosting",
            "metrics": get_model_info().get("metrics"),
        },
        "summary": {
            "total_districts": len(predictions),
            "dispatched": dispatched,
            "skipped": skipped,
            "reduced": reduced,
            "total_predicted_waste_kg": round(total_predicted, 1),
            "total_trucks_assigned": len(used_truck_ids),
            "total_trucks_available": len(available_trucks),
            "unavailable_drivers": list(unavailable),
        },
        "districts": district_results,
    }
