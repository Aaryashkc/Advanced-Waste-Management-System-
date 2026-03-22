# ML Integration — Complete Change Log

All changes made to integrate ML-powered smart waste scheduling into SafaBin.

---

## Architecture Overview

```
Frontend (React)  →  Backend (Express)  →  ML Service (FastAPI)
                         ↕
                      MongoDB
```

**Key principle**: ML service ONLY predicts waste volumes. The backend handles all truck/driver assignment using real MongoDB data. The ML service receives trucks as input, not from hardcoded lists.

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `backend/models/Truck.model.js` | Updated `classifyDuty()` thresholds: light < 1000kg, medium 1000-3500kg, heavy > 3500kg (Nepal context) |
| `backend/models/District.model.js` | Added `orgId` field (ref Organization) to map districts to managing orgs |
| `backend/models/MLSchedule.model.js` | Added `orgId`, `orgName` to assigned truck schema; added `totalTrucksAvailable` to summary |
| `backend/controllers/mlSchedule.controller.js` | **Major rewrite** — `generateSchedule` now queries real Trucks + Drivers from MongoDB, builds truck payload, sends to ML service. Driver assignment matching uses MongoDB `_id` not name strings |
| `backend/services/mlClient.js` | `generateSchedule()` now accepts `trucks` array parameter. Removed `getMLTrucks()` (trucks come from MongoDB) |
| `backend/server.js` | No changes needed |
| `backend/routes/mlSchedule.route.js` | No changes needed |

### ML Service (Python)

| File | Change |
|------|--------|
| `ml/scheduler.py` | **Major rewrite** — Removed all hardcoded TRUCKS (10) and DRIVERS (10) lists. `generate_schedule()` now accepts `trucks` as input parameter from backend. Scoring simplified to capacity match (50%) + type match (50%) |
| `ml/main.py` | `ScheduleRequest` now includes `trucks: list[dict]` field. Removed `/trucks` endpoint. Updated `/schedule` to pass trucks to scheduler |
| `ml/model.py` | No changes |
| `ml/train.py` | No changes |
| `ml/data_generator.py` | No changes |
| `ml/nepal_holidays.py` | No changes |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/routes/AppRoutes.jsx` | Removed `Zones` import and `/admin-dashboard/zones` route |
| `frontend/src/components/dashboard/Sidebar.jsx` | Removed Zones menu item. Added "Schedule History" and "Notifications" items |
| `frontend/src/components/ml/MLScheduleDashboard.jsx` | Added "Trucks Available" stat in summary grid (6 columns now) |
| `frontend/src/components/ml/DistrictPredictionCard.jsx` | Added org name display on truck assignments |
| `frontend/src/components/ml/MLScheduleHistory.jsx` | No changes |
| `frontend/src/components/ml/DriverMLAssignments.jsx` | No changes |
| `frontend/src/stores/useMLScheduleStore.js` | No changes |

### Scripts

| File | Change |
|------|--------|
| `scripts/seedDistricts.js` | Now imports Organization model, maps districts to orgs by keyword match (kathmandu/lalitpur/bhaktapur), sets `orgId` on each district |

### Files NOT Changed (left intact)

- All auth files (middleware, controller, routes)
- All existing models (User, Driver, Organization, Schedule, Task, etc.) except Truck.model.js duty thresholds
- All existing controllers (auth, driver, pickup, orgAdmin, superAdmin, etc.)
- All existing routes
- Customer-facing pages (SchedulePage, CustomerDashboard, etc.)
- Driver pages (DriverDashboard, AcceptTask, TaskFlow, etc.)
- Socket.IO server
- Email service
- Driver matcher service (still used for on-demand pickups)

### Files Removed from UI (still on disk, just unrouted)

- `frontend/src/pages/Zones.jsx` — replaced by ML Schedule
- `frontend/src/stores/useZoneStore.js` — was only used by Zones page

---

## Data Flow: How ML Scheduling Works Now

### Generate Schedule (Admin)

```
1. Admin clicks "Generate Schedule" for a date
2. Frontend → POST /api/ml-schedule/generate { date }
3. Backend controller:
   a. Queries ALL available Trucks from MongoDB (with org info)
   b. Queries ALL available Drivers (with user names)
   c. Maps each truck to its assigned driver
   d. Sends truck list + date to ML service
4. ML service:
   a. Predicts waste for all 10 districts using trained model
   b. Sorts districts by predicted waste (high first)
   c. Assigns REAL trucks to districts by scoring (capacity + type match)
   d. Returns predictions + assignments
5. Backend saves MLSchedule document to MongoDB
6. Frontend displays schedule with real truck/driver/org info
```

### Key Constraint: Real Resources Only

- If DB has 5 trucks → ML assigns from those 5 only
- If only 1 driver exists → most trucks show "Unassigned" driver
- If a truck has no driver → it can still be assigned (just no driver name)
- High-waste districts get trucks first (priority by predicted waste)
- Low-waste rural districts may get skipped if trucks run out

### District → Organization Mapping

```
Kathmandu Waste Management:
  - Kathmandu-Core (commercial)
  - Budhanilkantha (suburban)
  - Tokha (suburban)
  - Chandragiri (rural)

Lalitpur Waste Management:
  - Lalitpur (commercial)
  - Kirtipur (residential)
  - Godawari (rural)
  - Dakshinkali (rural)

Bhaktapur Waste Management:
  - Bhaktapur (commercial)
  - Madhyapur Thimi (residential)
```

### Nepal Truck Capacity Tiers

```
Light duty:  < 1,000 kg   — Tata Ace, Mahindra Bolero (narrow lanes)
Medium duty: 1,000–3,500 kg — Tata 407, Eicher Pro (standard collection)
Heavy duty:  > 3,500 kg   — Ashok Leyland, compactors (main roads)
```

---

## How to Run

```bash
# Terminal 1 — Backend
cd D:\maskey-1 && npm run dev

# Terminal 2 — ML Service
cd D:\maskey-1\ml && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3 — Frontend
cd D:\maskey-1\frontend && npm run dev
```

### First-time setup

```bash
# Seed districts (links them to existing orgs)
node scripts/seedDistricts.js

# Train ML model
cd ml && python train.py
```
