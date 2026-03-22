"""
Train GradientBoosting model for waste volume prediction.
Generates synthetic data if not found, trains model, saves .pkl files.

Usage:
    python train.py
"""

import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

DATA_PATH = "./data/kathmandu_waste_data.csv"
MODEL_PATH = "./models/waste_predictor.pkl"
ENCODER_PATH = "./models/label_encoders.pkl"


def load_or_generate_data():
    """Load existing CSV or generate fresh synthetic data."""
    if os.path.exists(DATA_PATH):
        print(f"Loading existing data from {DATA_PATH}")
        return pd.read_csv(DATA_PATH)
    else:
        print("No existing data found — generating synthetic dataset...")
        from data_generator import save_dataset
        return save_dataset(DATA_PATH)


def train_model():
    """Train GradientBoosting regressor and save model + encoders."""
    df = load_or_generate_data()
    print(f"\nDataset: {len(df)} records, {df['district'].nunique()} districts")

    # ── Feature engineering ──────────────────────────────────────────────────
    # Encode categorical features
    label_encoders = {}

    for col in ["district", "season", "district_type"]:
        le = LabelEncoder()
        df[f"{col}_encoded"] = le.fit_transform(df[col])
        label_encoders[col] = le
        print(f"  Encoded '{col}': {list(le.classes_)}")

    # Feature columns
    feature_cols = [
        "district_encoded",
        "day_of_week",
        "month",
        "is_weekend",
        "is_holiday",
        "holiday_proximity",
        "season_encoded",
        "district_type_encoded",
    ]

    X = df[feature_cols]
    y = df["waste_kg"]

    # ── Train/test split ─────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\n  Train: {len(X_train)} | Test: {len(X_test)}")

    # ── Train GradientBoosting ───────────────────────────────────────────────
    print("\n  Training GradientBoosting model...")
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # ── Evaluate ─────────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"\n  -- Model Performance --")
    print(f"  R2 Score:  {r2:.4f}")
    print(f"  MAE:       {mae:.1f} kg")
    print(f"  RMSE:      {rmse:.1f} kg")

    # -- Feature importance --
    print(f"\n  -- Feature Importance --")
    importances = sorted(
        zip(feature_cols, model.feature_importances_),
        key=lambda x: x[1],
        reverse=True,
    )
    for feat, imp in importances:
        bar = "#" * int(imp * 50)
        print(f"  {feat:30s} {imp:.4f} {bar}")

    # ── Save model + encoders ────────────────────────────────────────────────
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(label_encoders, ENCODER_PATH)
    print(f"\n  Model saved to {MODEL_PATH}")
    print(f"  Encoders saved to {ENCODER_PATH}")

    return model, label_encoders, r2


if __name__ == "__main__":
    train_model()
