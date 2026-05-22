"""
Load trained model and provide prediction functions.
Handles model loading, feature preparation, and waste categorization.
"""

import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, date
from nepal_holidays import (
    get_holiday_info,
    get_holiday_impact_multiplier,
    days_to_nearest_holiday,
)

MODEL_PATH = os.getenv("MODEL_PATH", "./models/waste_predictor.pkl")
ENCODER_PATH = os.getenv("ENCODER_PATH", "./models/label_encoders.pkl")
METRICS_PATH = os.getenv("METRICS_PATH", "./models/waste_predictor_metrics.pkl")

# ── Global model/encoder references (loaded once) ───────────────────────────
_model = None
_encoders = None
_metrics = None


DEFAULT_METRICS = {
    "validation_strategy": "unknown_legacy_artifact",
    "global": {"r2": None, "mae": None, "rmse": None, "n": 0},
    "by_area": {},
    "by_district_type": {},
    "latest_data_date": None,
    "data_sources": ["unknown"],
}


def load_model():
    """Load model and encoders from .pkl files."""
    global _model, _encoders, _metrics
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. Run 'python train.py' first."
            )
        artifact = joblib.load(MODEL_PATH)
        if isinstance(artifact, dict) and "model" in artifact:
            _model = artifact["model"]
            _metrics = artifact.get("metrics") or DEFAULT_METRICS
        else:
            _model = artifact
            _metrics = DEFAULT_METRICS

        if os.path.exists(METRICS_PATH):
            _metrics = joblib.load(METRICS_PATH)

        _encoders = joblib.load(ENCODER_PATH)
        print(f"[Model] Loaded from {MODEL_PATH}")
    return _model, _encoders


def get_metrics():
    """Return stored training metrics, loading the model if needed."""
    if _metrics is None:
        load_model()
    return _metrics or DEFAULT_METRICS


# ── Season helper ────────────────────────────────────────────────────────────
def get_season(month):
    if month in [6, 7, 8, 9]:
        return "monsoon"
    elif month in [10, 11, 12]:
        return "autumn"
    elif month in [1, 2]:
        return "winter"
    else:
        return "spring"


# ── District types ───────────────────────────────────────────────────────────
DISTRICT_TYPES = {
    # Kathmandu (8 areas)
    "Kathmandu-Core": "commercial",
    "Baneshwor": "commercial",
    "Koteshwor": "commercial",
    "Balaju": "residential",
    "Maharajgunj": "residential",
    "Budhanilkantha": "suburban",
    "Tokha": "suburban",
    "Chandragiri": "rural",
    # Lalitpur (7 areas)
    "Lalitpur": "commercial",
    "Satdobato": "commercial",
    "Kirtipur": "residential",
    "Imadol": "residential",
    "Lubhu": "suburban",
    "Godawari": "rural",
    "Dakshinkali": "rural",
    # Bhaktapur (5 areas)
    "Bhaktapur": "commercial",
    "Madhyapur Thimi": "residential",
    "Suryabinayak": "suburban",
    "Changunarayan": "rural",
    "Nagarkot": "rural",
}

DISTRICTS = list(DISTRICT_TYPES.keys())


# ── Waste categorization ────────────────────────────────────────────────────
def categorize_waste(kg):
    """
    Categorize predicted waste volume.
    Thresholds tuned for Nepal context / Kathmandu Valley scale.
    """
    if kg < 500:
        return "none"
    elif kg < 1500:
        return "low"
    elif kg < 3500:
        return "medium"
    elif kg < 6000:
        return "high"
    else:
        return "critical"


def get_recommendation(waste_category, district, district_type):
    """Generate human-readable recommendation based on prediction."""
    recommendations = {
        "none": f"Skip {district} — predicted waste is negligible. Save fuel and reallocate truck.",
        "low": f"Reduced service for {district} — send a light-duty truck (< 1,000 kg).",
        "medium": f"Standard service for {district} — assign a medium-duty truck (1,000–3,500 kg).",
        "high": f"High volume expected in {district} — deploy heavy-duty truck (> 3,500 kg). Consider extra trip.",
        "critical": f"CRITICAL waste surge in {district}! Deploy multiple trucks. Possible festival/event waste spike.",
    }
    return recommendations.get(waste_category, f"Standard service for {district}.")


def _days_since_latest_data(target_date, metrics):
    latest = metrics.get("latest_data_date")
    if not latest:
        return None
    try:
        latest_date = date.fromisoformat(latest)
        return max(0, (target_date - latest_date).days)
    except ValueError:
        return None


def prediction_confidence(district, district_type, target_date, prediction_method="model"):
    """
    Estimate prediction confidence from validation error, data freshness, and
    whether the area is directly known or inferred from a district type average.
    """
    metrics = get_metrics()
    global_mae = ((metrics.get("global") or {}).get("mae")) or 1000
    area_mae = ((metrics.get("by_area") or {}).get(district) or {}).get("mae")
    type_mae = ((metrics.get("by_district_type") or {}).get(district_type) or {}).get("mae")
    error_kg = area_mae or type_mae or global_mae

    error_penalty = min(45, (error_kg / 5000) * 45)
    freshness_days = _days_since_latest_data(target_date, metrics)
    freshness_penalty = 0 if freshness_days is None else min(25, (freshness_days / 365) * 25)
    method_penalty = 18 if prediction_method == "type_average" else 0

    score = max(25, min(95, round(95 - error_penalty - freshness_penalty - method_penalty)))
    if score >= 75:
        label = "high"
    elif score >= 55:
        label = "medium"
    else:
        label = "low"

    return {
        "score": score,
        "label": label,
        "estimated_error_kg": round(float(error_kg), 1),
        "basis": {
            "prediction_method": prediction_method,
            "area_known": prediction_method == "model",
            "area_mae_kg": round(float(area_mae), 1) if area_mae is not None else None,
            "district_type_mae_kg": round(float(type_mae), 1) if type_mae is not None else None,
            "global_mae_kg": round(float(global_mae), 1) if global_mae is not None else None,
            "data_freshness_days": freshness_days,
        },
    }


# ── Prediction function ─────────────────────────────────────────────────────
def predict_waste(district, target_date):
    """
    Predict waste volume for a district on a given date.

    Args:
        district: str — one of the trained Kathmandu Valley districts
        target_date: date object

    Returns:
        dict with prediction details
    """
    model, encoders = load_model()

    if district not in DISTRICT_TYPES:
        raise ValueError(
            f"Unknown district '{district}'. Valid: {DISTRICTS}"
        )

    # Prepare features (same order as training)
    day_of_week = target_date.weekday()
    month = target_date.month
    is_weekend = 1 if day_of_week >= 5 else 0
    holiday_name, _ = get_holiday_info(target_date)
    is_holiday = 1 if holiday_name else 0
    holiday_proximity = days_to_nearest_holiday(target_date)
    season = get_season(month)
    district_type = DISTRICT_TYPES[district]

    # Encode categoricals
    district_encoded = encoders["district"].transform([district])[0]
    season_encoded = encoders["season"].transform([season])[0]
    district_type_encoded = encoders["district_type"].transform([district_type])[0]

    feature_names = [
        "district_encoded", "day_of_week", "month", "is_weekend",
        "is_holiday", "holiday_proximity", "season_encoded", "district_type_encoded",
    ]
    features = pd.DataFrame([[
        district_encoded,
        day_of_week,
        month,
        is_weekend,
        is_holiday,
        holiday_proximity,
        season_encoded,
        district_type_encoded,
    ]], columns=feature_names)

    predicted_kg = float(model.predict(features)[0])
    predicted_kg = max(0, round(predicted_kg, 1))

    waste_category = categorize_waste(predicted_kg)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    return {
        "district": district,
        "district_type": district_type,
        "date": target_date.isoformat(),
        "day_name": day_names[day_of_week],
        "predicted_waste_kg": predicted_kg,
        "waste_category": waste_category,
        "is_holiday": bool(is_holiday),
        "holiday_name": holiday_name or None,
        "recommendation": get_recommendation(waste_category, district, district_type),
        "prediction_method": "model",
        "confidence": prediction_confidence(district, district_type, target_date, "model"),
    }


def predict_waste_by_type(district_name, district_type, target_date, scale_factor=1.0):
    """
    Predict waste for an UNKNOWN area by averaging predictions of all trained
    districts with the same type, then applying a scale factor.

    This allows new areas added via the admin UI to get predictions without
    retraining the model. The scale_factor adjusts for area size differences
    (default 1.0 = average sized area of that type).

    Args:
        district_name: str — name of the new area (for display only)
        district_type: str — one of: commercial, residential, suburban, rural
        target_date: date object
        scale_factor: float — size multiplier (0.5 = half-sized, 2.0 = double)

    Returns:
        dict with prediction details
    """
    valid_types = ["commercial", "residential", "suburban", "rural"]
    if district_type not in valid_types:
        raise ValueError(f"Unknown district_type '{district_type}'. Valid: {valid_types}")

    # Find all trained districts of the same type
    same_type_districts = [d for d, t in DISTRICT_TYPES.items() if t == district_type]

    if not same_type_districts:
        raise ValueError(f"No trained districts found for type '{district_type}'")

    # Predict for each trained district of the same type
    predictions = []
    for d in same_type_districts:
        pred = predict_waste(d, target_date)
        predictions.append(pred["predicted_waste_kg"])

    # Average the predictions and apply scale factor
    avg_kg = sum(predictions) / len(predictions)
    predicted_kg = max(0, round(avg_kg * scale_factor, 1))

    waste_category = categorize_waste(predicted_kg)
    day_of_week = target_date.weekday()
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    holiday_name, _ = get_holiday_info(target_date)

    return {
        "district": district_name,
        "district_type": district_type,
        "date": target_date.isoformat(),
        "day_name": day_names[day_of_week],
        "predicted_waste_kg": predicted_kg,
        "waste_category": waste_category,
        "is_holiday": bool(holiday_name),
        "holiday_name": holiday_name or None,
        "recommendation": get_recommendation(waste_category, district_name, district_type),
        "prediction_method": "type_average",
        "scale_factor": scale_factor,
        "based_on_districts": same_type_districts,
        "confidence": prediction_confidence(district_name, district_type, target_date, "type_average"),
    }


def get_model_info():
    """Return model metadata."""
    metrics = get_metrics()
    global_metrics = metrics.get("global") or {}
    return {
        "model": "GradientBoosting",
        "r2_score": global_metrics.get("r2"),
        "metrics": metrics,
        "districts": DISTRICTS,
        "district_types": DISTRICT_TYPES,
        "waste_categories": ["none", "low", "medium", "high", "critical"],
    }
