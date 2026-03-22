"""
SafaBin ML Service — FastAPI REST API
Waste volume prediction + smart truck scheduling for Kathmandu Valley.

Endpoints:
  POST /predict     — Predict waste for one district on a date
  POST /schedule    — Generate full schedule for all districts on a date
  GET  /districts   — List all supported districts
  GET  /health      — Service health check

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
from datetime import date, datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

load_dotenv()

# ── Import ML modules ────────────────────────────────────────────────────────
from model import predict_waste, get_model_info, DISTRICTS, DISTRICT_TYPES, load_model
from scheduler import generate_schedule

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="SafaBin ML Service",
    description="Smart waste collection scheduling for Kathmandu Valley",
    version="1.0.0",
)

# CORS — allow backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to backend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Load model on startup ───────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    try:
        load_model()
        print("[ML Service] Model loaded successfully")
    except FileNotFoundError as e:
        print(f"[ML Service] WARNING: {e}")
        print("[ML Service] Run 'python train.py' to train the model first")


# ── Request/Response models ──────────────────────────────────────────────────
class PredictRequest(BaseModel):
    district: str
    date: str  # ISO format: "2025-10-22"

    @field_validator("district")
    @classmethod
    def validate_district(cls, v):
        if v not in DISTRICTS:
            raise ValueError(f"Unknown district '{v}'. Valid: {DISTRICTS}")
        return v

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v


class ScheduleRequest(BaseModel):
    date: str
    trucks: list[dict] = []  # Real trucks from MongoDB
    unavailable_drivers: Optional[list[str]] = []

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Service health check with model info."""
    info = get_model_info()
    return {
        "status": "ok",
        "service": "SafaBin ML Service",
        "model": info["model"],
        "r2_score": info["r2_score"],
        "districts_count": len(info["districts"]),
    }


@app.post("/predict")
async def predict(req: PredictRequest):
    """Predict waste volume for a single district on a specific date."""
    try:
        target_date = date.fromisoformat(req.date)
        result = predict_waste(req.district, target_date)
        return result
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. Run 'python train.py' first.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/schedule")
async def schedule(req: ScheduleRequest):
    """Generate full day schedule with truck assignments for all districts."""
    try:
        target_date = date.fromisoformat(req.date)
        result = generate_schedule(target_date, req.trucks, req.unavailable_drivers)
        return result
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. Run 'python train.py' first.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/districts")
async def get_districts():
    """List all supported districts with types."""
    return {
        "districts": DISTRICTS,
        "district_types": DISTRICT_TYPES,
        "count": len(DISTRICTS),
    }


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("ML_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
