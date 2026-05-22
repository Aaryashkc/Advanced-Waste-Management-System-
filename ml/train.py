"""
Train GradientBoosting model for waste volume prediction.

The training flow prefers real feedback rows when available, validates on the
newest dates, and stores the measured metrics with the model artifact.

Usage:
    python train.py
"""

import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder

DATA_PATH = "./data/kathmandu_waste_data.csv"
FEEDBACK_PATH = "./data/waste_feedback.csv"
MODEL_PATH = "./models/waste_predictor.pkl"
ENCODER_PATH = "./models/label_encoders.pkl"
METRICS_PATH = "./models/waste_predictor_metrics.pkl"


def load_or_generate_data():
    """Load existing CSV or generate fresh synthetic data."""
    if os.path.exists(DATA_PATH):
        print(f"Loading existing data from {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        if "data_source" not in df.columns:
            df["data_source"] = "historical_or_synthetic"
    else:
        print("No existing data found - generating synthetic dataset...")
        from data_generator import save_dataset

        df = save_dataset(DATA_PATH)
        df["data_source"] = "synthetic"

    if os.path.exists(FEEDBACK_PATH):
        feedback = pd.read_csv(FEEDBACK_PATH)
        if not feedback.empty:
            feedback["data_source"] = "field_feedback"
            df = pd.concat([df, feedback], ignore_index=True)
            print(f"Loaded {len(feedback)} field feedback records from {FEEDBACK_PATH}")

    return df


def season_for_month(month):
    if month in [6, 7, 8, 9]:
        return "monsoon"
    if month in [10, 11, 12]:
        return "autumn"
    if month in [1, 2]:
        return "winter"
    return "spring"


def add_calendar_features(df):
    """Fill feature columns for feedback rows that only contain area/date/waste."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["district"] = df["district"].astype(str)

    if "day_of_week" not in df.columns:
        df["day_of_week"] = df["date"].dt.dayofweek
    else:
        df["day_of_week"] = df["day_of_week"].fillna(df["date"].dt.dayofweek)

    if "month" not in df.columns:
        df["month"] = df["date"].dt.month
    else:
        df["month"] = df["month"].fillna(df["date"].dt.month)

    weekend = (df["day_of_week"] >= 5).astype(int)
    if "is_weekend" not in df.columns:
        df["is_weekend"] = weekend
    else:
        df["is_weekend"] = df["is_weekend"].fillna(weekend)

    if "is_holiday" not in df.columns:
        df["is_holiday"] = 0
    else:
        df["is_holiday"] = df["is_holiday"].fillna(0)

    if "holiday_proximity" not in df.columns:
        df["holiday_proximity"] = 30
    else:
        df["holiday_proximity"] = df["holiday_proximity"].fillna(30)

    if "season" not in df.columns:
        df["season"] = df["month"].apply(season_for_month)
    else:
        df["season"] = df["season"].fillna("")
        df.loc[df["season"] == "", "season"] = df.loc[df["season"] == "", "month"].apply(season_for_month)

    if "district_type" not in df.columns:
        df["district_type"] = "residential"
    else:
        df["district_type"] = df["district_type"].fillna("residential")

    return df


def regression_metrics(y_true, y_pred):
    return {
        "r2": float(r2_score(y_true, y_pred)) if len(y_true) > 1 else None,
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "n": int(len(y_true)),
    }


def grouped_metrics(eval_df, group_col):
    metrics = {}
    for value, group in eval_df.groupby(group_col):
        metrics[str(value)] = regression_metrics(group["actual"], group["predicted"])
    return metrics


def train_model():
    """Train GradientBoosting regressor and save model, encoders, and metrics."""
    df = add_calendar_features(load_or_generate_data())
    df = df.sort_values("date").reset_index(drop=True)
    print(f"\nDataset: {len(df)} records, {df['district'].nunique()} districts")

    label_encoders = {}
    for col in ["district", "season", "district_type"]:
        le = LabelEncoder()
        df[f"{col}_encoded"] = le.fit_transform(df[col])
        label_encoders[col] = le
        print(f"  Encoded '{col}': {list(le.classes_)}")

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

    split_index = max(1, int(len(df) * 0.8))
    if split_index >= len(df):
        split_index = len(df) - 1

    train_mask = df.index < split_index
    X_train, X_test = X.loc[train_mask], X.loc[~train_mask]
    y_train, y_test = y.loc[train_mask], y.loc[~train_mask]
    print(f"\n  Train: {len(X_train)} | Test: {len(X_test)}")

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

    y_pred = model.predict(X_test)
    eval_df = df.loc[~train_mask, ["district", "district_type", "date", "waste_kg"]].copy()
    eval_df["actual"] = y_test.values
    eval_df["predicted"] = y_pred
    eval_df["abs_error"] = (eval_df["actual"] - eval_df["predicted"]).abs()

    global_metrics = regression_metrics(y_test, y_pred)
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "validation_strategy": "time_based_last_20_percent",
        "training_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "latest_data_date": df["date"].max().date().isoformat(),
        "data_sources": sorted(df["data_source"].fillna("unknown").astype(str).unique().tolist()),
        "global": global_metrics,
        "by_area": grouped_metrics(eval_df, "district"),
        "by_district_type": grouped_metrics(eval_df, "district_type"),
    }

    print("\n  -- Model Performance --")
    print(f"  R2 Score:  {global_metrics['r2']:.4f}" if global_metrics["r2"] is not None else "  R2 Score:  n/a")
    print(f"  MAE:       {global_metrics['mae']:.1f} kg")
    print(f"  RMSE:      {global_metrics['rmse']:.1f} kg")

    print("\n  -- MAE by District Type --")
    for district_type, values in metrics["by_district_type"].items():
        print(f"  {district_type:15s} MAE={values['mae']:.1f} kg RMSE={values['rmse']:.1f} kg n={values['n']}")

    print("\n  -- Feature Importance --")
    importances = sorted(zip(feature_cols, model.feature_importances_), key=lambda x: x[1], reverse=True)
    for feat, imp in importances:
        bar = "#" * int(imp * 50)
        print(f"  {feat:30s} {imp:.4f} {bar}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({"model": model, "metrics": metrics, "feature_columns": feature_cols}, MODEL_PATH)
    joblib.dump(label_encoders, ENCODER_PATH)
    joblib.dump(metrics, METRICS_PATH)
    print(f"\n  Model saved to {MODEL_PATH}")
    print(f"  Encoders saved to {ENCODER_PATH}")
    print(f"  Metrics saved to {METRICS_PATH}")

    return model, label_encoders, metrics


if __name__ == "__main__":
    train_model()
