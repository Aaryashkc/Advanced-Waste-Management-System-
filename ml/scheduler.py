"""
Truck assignment algorithm for ML-predicted waste schedules.
Assigns real database trucks to districts based on predicted waste volume,
truck capacity, and driver proximity.

Nepal-context truck capacity tiers:
  - Light duty:  < 1,000 kg  (Tata Ace, small pickups — narrow gallis)
  - Medium duty: 1,000–3,500 kg (Tata 407, Eicher — standard municipal)
  - Heavy duty:  > 3,500 kg  (Compactors, Ashok Leyland — main roads)
"""

from model import predict_waste, predict_waste_by_type, DISTRICTS, DISTRICT_TYPES, categorize_waste


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

    used_truck_ids = set()
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

    # 3. Sort by predicted waste descending (prioritize high-waste districts)
    predictions.sort(key=lambda p: p["predicted_waste_kg"], reverse=True)

    # 4. Assign trucks to each district
    for pred in predictions:
        district = pred["district"]
        predicted_kg = pred["predicted_waste_kg"]
        waste_category = pred["waste_category"]

        # Determine action
        if waste_category == "none":
            action = "skip"
            assigned = []
        else:
            # Filter out already-used trucks
            remaining_trucks = [t for t in available_trucks if t["id"] not in used_truck_ids]

            if not remaining_trucks:
                action = "skip"
                assigned = []
            else:
                assigned = assign_trucks_to_district(
                    district, predicted_kg, waste_category, remaining_trucks
                )

                if assigned:
                    action = "dispatch"
                    for a in assigned:
                        used_truck_ids.add(a["truck_id"])
                else:
                    action = "skip"

        # Reduced service: if we couldn't fully cover the waste
        if action == "dispatch":
            total_assigned_capacity = sum(a["capacity_kg"] for a in assigned)
            if total_assigned_capacity < predicted_kg * 0.7:
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
