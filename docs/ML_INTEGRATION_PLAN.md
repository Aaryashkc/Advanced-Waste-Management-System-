# SafaBin ML Integration — Complete Change Document

**Created:** 2026-03-21
**Author:** Claude (AI Assistant)
**Status:** PENDING APPROVAL — No code will be written until you approve this document.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure After Changes](#2-project-structure-after-changes)
3. [New Files to Create](#3-new-files-to-create)
4. [Existing Files to Modify](#4-existing-files-to-modify)
5. [Files NOT Touched](#5-files-not-touched)
6. [Detailed Change Descriptions](#6-detailed-change-descriptions)
7. [Risk Assessment](#7-risk-assessment)
8. [Rollback Plan](#8-rollback-plan)

---

## 1. Overview

**Goal:** Add ML-powered smart waste scheduling to SafaBin by:
- Creating a standalone `ml/` Python FastAPI microservice (sibling to `backend/` and `frontend/`)
- Adding a `mlClient.js` service in the backend that calls the FastAPI service
- Adding new backend routes, controllers, and MongoDB models for ML scheduling
- Adding new frontend pages (admin scheduling dashboard, driver ML assignments)
- Integrating into the existing admin sidebar and React Router config

**Architecture:**
```
Frontend (React) → Backend (Express :5001) → ML Service (FastAPI :8000)
                         ↕
                    MongoDB (existing)
```

The frontend NEVER talks to FastAPI directly. The backend acts as the proxy/orchestrator.

---

## 2. Project Structure After Changes

```
maskey-1/
├── backend/                    ← EXISTING (minor additions only)
│   ├── config/                 ← NO CHANGES
│   ├── controllers/
│   │   ├── ... (all existing)  ← NO CHANGES
│   │   └── mlSchedule.controller.js   ← NEW
│   ├── middlewares/            ← NO CHANGES
│   ├── models/
│   │   ├── ... (all existing)  ← NO CHANGES
│   │   ├── MLSchedule.model.js        ← NEW
│   │   ├── District.model.js          ← NEW
│   │   └── WasteLog.model.js          ← NEW
│   ├── routes/
│   │   ├── ... (all existing)  ← NO CHANGES
│   │   └── mlSchedule.route.js        ← NEW
│   ├── services/
│   │   ├── driverMatcher.js    ← NO CHANGES
│   │   ├── emailService.js     ← NO CHANGES
│   │   ├── routeOptimizer.js   ← NO CHANGES
│   │   └── mlClient.js                ← NEW
│   ├── socket/                 ← NO CHANGES
│   ├── utils/                  ← NO CHANGES
│   └── server.js               ← MODIFIED (2 lines added: import + route mount)
│
├── frontend/                   ← EXISTING (additions only)
│   └── src/
│       ├── components/
│       │   ├── ... (all existing)  ← NO CHANGES
│       │   └── ml/                        ← NEW FOLDER
│       │       ├── MLScheduleDashboard.jsx    ← NEW
│       │       ├── DistrictPredictionCard.jsx ← NEW
│       │       ├── MLScheduleHistory.jsx      ← NEW
│       │       └── DriverMLAssignments.jsx    ← NEW
│       ├── stores/
│       │   ├── ... (all existing)  ← NO CHANGES
│       │   └── useMLScheduleStore.js      ← NEW
│       ├── routes/
│       │   └── AppRoutes.jsx    ← MODIFIED (add 3 new routes + imports)
│       ├── pages/               ← NO CHANGES
│       └── utils/
│           └── api.js           ← NO CHANGES (reuse existing axios instance)
│
├── ml/                                ← NEW FOLDER (entire Python microservice)
│   ├── main.py                        ← NEW (FastAPI entry point)
│   ├── model.py                       ← NEW (ML model loading + prediction)
│   ├── scheduler.py                   ← NEW (truck assignment algorithm)
│   ├── data_generator.py              ← NEW (synthetic data generation script)
│   ├── train.py                       ← NEW (model training script)
│   ├── nepal_holidays.py              ← NEW (Nepal holiday definitions)
│   ├── requirements.txt               ← NEW
│   ├── .env.example                   ← NEW
│   ├── models/                        ← NEW (saved .pkl model files)
│   │   └── .gitkeep
│   └── data/                          ← NEW (training data)
│       └── .gitkeep
│
├── scripts/
│   ├── seed.js                 ← NO CHANGES
│   └── seedDistricts.js               ← NEW (seed the 10 districts into MongoDB)
│
├── docs/
│   └── ML_INTEGRATION_PLAN.md         ← THIS FILE
│
└── .env                        ← MODIFIED (1 new variable: ML_SERVICE_URL)
```

---

## 3. New Files to Create

### 3A. ML Microservice (`ml/` folder) — 9 new files

| # | File | Purpose | Size Est. |
|---|------|---------|-----------|
| 1 | `ml/requirements.txt` | Python dependencies (fastapi, uvicorn, scikit-learn, pandas, numpy, joblib, python-dotenv) | ~10 lines |
| 2 | `ml/.env.example` | Example env vars (PORT=8000, MODEL_PATH, etc.) | ~5 lines |
| 3 | `ml/nepal_holidays.py` | Nepal holiday dates (Dashain, Tihar, Holi, etc.) for feature engineering | ~80 lines |
| 4 | `ml/data_generator.py` | Generate synthetic training data for 10 districts over 2 years | ~150 lines |
| 5 | `ml/train.py` | Train GradientBoosting model, save as .pkl | ~100 lines |
| 6 | `ml/model.py` | Load trained model, expose predict function | ~80 lines |
| 7 | `ml/scheduler.py` | Truck assignment algorithm (score by proximity + capacity match) | ~120 lines |
| 8 | `ml/main.py` | FastAPI app with endpoints: POST /predict, POST /schedule, GET /districts, GET /trucks, GET /health | ~200 lines |
| 9 | `ml/models/.gitkeep` | Placeholder for saved model files | 0 lines |
| 10 | `ml/data/.gitkeep` | Placeholder for training data | 0 lines |

### 3B. Backend Additions — 5 new files

| # | File | Purpose | Pattern Followed |
|---|------|---------|-----------------|
| 1 | `backend/services/mlClient.js` | Axios client that calls FastAPI at `ML_SERVICE_URL`. All calls wrapped in try/catch with graceful fallback. | Same pattern as `driverMatcher.js` (exported async functions, console.log for debugging) |
| 2 | `backend/models/MLSchedule.model.js` | Store generated ML schedules (date, status, districts array, totals) | Same schema pattern as `Schedule.model.js` (mongoose.Schema, pre-save updatedAt hook, indexes, default export) |
| 3 | `backend/models/District.model.js` | Static reference: 10 districts with name, type, coordinates | Same pattern as `Location.model.js` |
| 4 | `backend/models/WasteLog.model.js` | Actual waste collected (district, date, actual_kg) — for future model retraining | Same pattern as existing models |
| 5 | `backend/routes/mlSchedule.route.js` | Express router with auth + role middleware | Same pattern as `schedule.route.js` (import from controller, authMiddleware, roleMiddleware) |
| 6 | `backend/controllers/mlSchedule.controller.js` | Controller functions for ML scheduling endpoints | Same pattern as `schedule.controller.js` (async/await, try/catch, `res.status().json({ success, data/message })`) |

### 3C. Frontend Additions — 5 new files

| # | File | Purpose | Pattern Followed |
|---|------|---------|-----------------|
| 1 | `frontend/src/stores/useMLScheduleStore.js` | Zustand store for ML schedule state | Same pattern as `useScheduleStore.js` (create from zustand, api import, async actions) |
| 2 | `frontend/src/components/ml/MLScheduleDashboard.jsx` | Admin page: date picker → generate predictions → review → confirm dispatch | Same styling as `Zones.jsx` (Tailwind + CSS vars like `var(--primary)`, `var(--accent)`) |
| 3 | `frontend/src/components/ml/DistrictPredictionCard.jsx` | Card component showing prediction for one district | Same styling pattern as dashboard components |
| 4 | `frontend/src/components/ml/MLScheduleHistory.jsx` | Past ML schedules list with status badges | Same pattern as existing list pages |
| 5 | `frontend/src/components/ml/DriverMLAssignments.jsx` | Driver view: today's ML-assigned pickups | Same pattern as `DriverDashboard.jsx` |

### 3D. Scripts — 1 new file

| # | File | Purpose |
|---|------|---------|
| 1 | `scripts/seedDistricts.js` | One-time seed script to insert the 10 Kathmandu Valley districts into MongoDB | Same pattern as existing `scripts/seed.js` |

---

## 4. Existing Files to Modify

**Only 4 files will be modified. Every change is minimal and additive (no deletions, no rewrites).**

### 4A. `backend/server.js` — 2 lines added

**What changes:**
```
Line ~18 (after last import):
+ import mlScheduleRoutes from "./routes/mlSchedule.route.js";

Line ~56 (after last app.use route):
+ app.use("/api/ml-schedule", mlScheduleRoutes);
```

**Risk:** ZERO — purely additive. If `mlSchedule.route.js` doesn't exist, the server crashes at startup, but we create it first.

### 4B. `frontend/src/routes/AppRoutes.jsx` — ~15 lines added

**What changes:**
```
Top of file (after existing imports):
+ import MLScheduleDashboard from "../components/ml/MLScheduleDashboard";
+ import MLScheduleHistory from "../components/ml/MLScheduleHistory";
+ import DriverMLAssignments from "../components/ml/DriverMLAssignments";

Inside the admin-dashboard <Route> block (after the "reports" route, line ~187):
+ <Route path="ml-schedule" element={<MLScheduleDashboard />} />
+ <Route path="ml-schedule/history" element={<MLScheduleHistory />} />

Inside the driver routes section (after task-flow route, line ~166):
+ <Route
+   path="/driver-ml-assignments"
+   element={
+     <ProtectedRoute allowedRoles={['driver']}>
+       <DriverMLAssignments />
+     </ProtectedRoute>
+   }
+ />
```

**Risk:** ZERO — purely additive. Existing routes are untouched. New routes are independent paths.

### 4C. `frontend/src/components/dashboard/Sidebar.jsx` — 1 menu item added

**What changes:**
```
In the menuItems array (after the "Zones" entry, before "Reports"):
+ { name: "ML Schedule", icon: "🤖", path: "/admin-dashboard/ml-schedule" },
```

**Risk:** ZERO — adds one entry to an array. No existing items touched.

### 4D. `.env` — 1 new variable added

**What changes:**
```
At the end of the file:
+ ML_SERVICE_URL=http://localhost:8000
```

**Risk:** ZERO — additive. No existing variables touched. If this variable is missing, `mlClient.js` falls back to `http://localhost:8000` as default.

---

## 5. Files NOT Touched

**Every file below remains 100% untouched:**

### Backend — NO changes to:
- `config/db.js`, `config/jwt.config.js`, `config/cloudinary.js`
- `middlewares/auth.middleware.js`, `middlewares/role.middleware.js`, `middlewares/upload.middleware.js`
- `models/User.model.js` — no new fields
- `models/Driver.model.js` — no new fields
- `models/Truck.model.js` — no new fields
- `models/Schedule.model.js` — no new fields (ML uses its own MLSchedule model)
- `models/Organization.model.js`, `models/PickupRequest.model.js`, `models/Task.model.js`
- All other existing models
- `controllers/auth.controller.js` and ALL existing controllers
- `routes/auth.route.js` and ALL existing routes (except server.js mount)
- `services/driverMatcher.js`, `services/emailService.js`
- `socket/socketServer.js`
- `utils/otp.utils.js`, `utils/utils.js`

### Frontend — NO changes to:
- `vite.config.js` — no proxy needed (frontend → backend → FastAPI)
- `utils/api.js` — reuse existing axios instance as-is
- `utils/socket.js`
- ALL existing stores (useAuthStore, useScheduleStore, etc.)
- ALL existing components (auth/, users/, Driver/, dashboard/, layout/, common/, etc.)
- ALL existing pages (Dashboard.jsx, Vehicles.jsx, Drivers.jsx, Zones.jsx, etc.)
- `components/layout/DashboardLayout.jsx` — no changes needed (already uses <Outlet/>)
- `components/auth/ProtectedRoute.jsx`

---

## 6. Detailed Change Descriptions

### 6.1 — `backend/services/mlClient.js`

**Purpose:** Axios-based client that calls the Python FastAPI service.

**Functions exported:**
```javascript
export async function predictDistrict(district, date)
// Calls POST http://localhost:8000/predict
// Returns: { district, date, predicted_waste_kg, waste_category, recommendation }
// On failure: returns { error: "ML service unavailable", fallback: true }

export async function generateSchedule(date, unavailableDrivers = [])
// Calls POST http://localhost:8000/schedule
// Returns: full schedule with district assignments
// On failure: returns { error: "ML service unavailable", fallback: true }

export async function getMLDistricts()
// Calls GET http://localhost:8000/districts
// On failure: returns { error: "...", fallback: true }

export async function getMLTrucks()
// Calls GET http://localhost:8000/trucks
// On failure: returns { error: "...", fallback: true }

export async function checkMLHealth()
// Calls GET http://localhost:8000/health
// On failure: returns { status: "offline" }
```

**Key design decisions:**
- Uses `axios` (already in project dependencies via frontend, will add to backend package.json)
- Every function has try/catch — never throws, always returns an error object
- Timeout: 10 seconds per request (ML predictions can be slow)
- Reads `process.env.ML_SERVICE_URL` with fallback to `http://localhost:8000`

**NOTE:** `axios` is NOT currently in the backend `package.json`. We need to add it:
```bash
cd /d/maskey-1 && npm install axios
```
This is the ONLY new dependency for the backend.

### 6.2 — `backend/models/MLSchedule.model.js`

**Schema:**
```javascript
{
  date: { type: Date, required: true },                    // The date this schedule is for
  status: {
    type: String,
    enum: ["draft", "confirmed", "completed", "cancelled"],
    default: "draft"
  },
  totalPredictedWasteKg: { type: Number, default: 0 },

  districts: [{
    district: { type: String, required: true },            // e.g., "Lalitpur"
    predictedWasteKg: { type: Number, default: 0 },
    wasteCategory: { type: String },                       // "none"/"low"/"medium"/"high"/"critical"
    action: { type: String },                              // "dispatch"/"skip"/"reduced"
    recommendation: { type: String },                      // Human-readable recommendation
    assignedTrucks: [{
      truckId: { type: String },                           // ML service truck ID (e.g., "TRK-001")
      driverName: { type: String },
      capacity: { type: Number },
      truckType: { type: String }
    }]
  }],

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  confirmedAt: { type: Date },

  mlModelInfo: {
    model: { type: String },                               // "GradientBoosting"
    r2Score: { type: Number }                              // 0.9739
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

// Indexes: { date: 1 }, { status: 1 }
// Pre-save: updatedAt = Date.now()
```

**Why separate from existing Schedule model?**
- Existing `Schedule` = recurring weekly pickups (day-of-week based, tied to orgId)
- `MLSchedule` = one-time daily predictions (date-based, district-based, ML-generated)
- Different data shape, different lifecycle, different purpose
- Zero risk of breaking existing schedule functionality

### 6.3 — `backend/models/District.model.js`

**Schema:**
```javascript
{
  name: { type: String, required: true, unique: true },    // "Lalitpur"
  type: {
    type: String,
    enum: ["commercial", "residential", "suburban", "rural"],
    required: true
  },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 6.4 — `backend/models/WasteLog.model.js`

**Schema:**
```javascript
{
  district: { type: String, required: true },
  date: { type: Date, required: true },
  actualWasteKg: { type: Number, required: true },
  predictedWasteKg: { type: Number },                     // What ML predicted (for accuracy tracking)
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  mlScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "MLSchedule" },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

// Index: { district: 1, date: 1 }
```

### 6.5 — `backend/controllers/mlSchedule.controller.js`

**Exports 7 controller functions:**

| Function | Endpoint | Role | Description |
|----------|----------|------|-------------|
| `predictDistrict` | POST /api/ml-schedule/predict | admin, super_admin | Predict waste for one district+date |
| `generateSchedule` | POST /api/ml-schedule/generate | admin, super_admin | Generate full schedule for a date |
| `getMLSchedules` | GET /api/ml-schedule | admin, super_admin | List all generated schedules (with pagination) |
| `getMLScheduleById` | GET /api/ml-schedule/:id | admin, super_admin | Get one schedule detail |
| `confirmSchedule` | POST /api/ml-schedule/:id/confirm | admin, super_admin | Mark schedule as confirmed for dispatch |
| `getMLHealth` | GET /api/ml-schedule/health | admin, super_admin | Check ML service status |
| `getDriverMLAssignments` | GET /api/ml-schedule/driver-assignments | driver | Get today's ML assignments for the logged-in driver |

**Code pattern (matching your existing controllers):**
```javascript
export const generateSchedule = async (req, res) => {
  try {
    const { date, unavailableDrivers } = req.body;
    // ... validation ...
    // ... call mlClient ...
    // ... save to MongoDB ...
    res.status(201).json({ success: true, data: schedule, message: "Schedule generated" });
  } catch (error) {
    console.error("Generate ML schedule error:", error);
    res.status(500).json({ success: false, message: "Failed to generate schedule", error: error.message });
  }
};
```

### 6.6 — `backend/routes/mlSchedule.route.js`

```javascript
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import { /* all controllers */ } from "../controllers/mlSchedule.controller.js";

const router = express.Router();
router.use(authMiddleware);

// Admin/Super-admin endpoints
router.post("/predict", roleMiddleware("admin", "super_admin"), predictDistrict);
router.post("/generate", roleMiddleware("admin", "super_admin"), generateSchedule);
router.get("/health", roleMiddleware("admin", "super_admin"), getMLHealth);
router.get("/", roleMiddleware("admin", "super_admin"), getMLSchedules);
router.get("/:id", roleMiddleware("admin", "super_admin"), getMLScheduleById);
router.post("/:id/confirm", roleMiddleware("admin", "super_admin"), confirmSchedule);

// Driver endpoint
router.get("/driver-assignments", roleMiddleware("driver"), getDriverMLAssignments);

export default router;
```

### 6.7 — `frontend/src/stores/useMLScheduleStore.js`

**State shape (matching existing Zustand patterns):**
```javascript
{
  schedules: [],          // List of MLSchedule documents
  currentSchedule: null,  // Currently viewed schedule
  prediction: null,       // Single district prediction result
  mlHealth: null,         // ML service health status
  driverAssignments: [],  // Driver's today's ML assignments
  loading: false,
  error: null,

  // Actions
  generateSchedule: async (date, unavailableDrivers) => { ... },
  fetchSchedules: async () => { ... },
  fetchScheduleById: async (id) => { ... },
  confirmSchedule: async (id) => { ... },
  predictDistrict: async (district, date) => { ... },
  checkMLHealth: async () => { ... },
  fetchDriverAssignments: async () => { ... },
}
```

### 6.8 — Frontend Components

**`MLScheduleDashboard.jsx`** — The main admin page:
- Date picker input
- "Generate Schedule" button → calls generateSchedule
- ML health status indicator (green/red dot, like your System Status in Sidebar)
- Grid of DistrictPredictionCard components showing each district's prediction
- "Confirm & Dispatch" button for the entire schedule
- Uses Tailwind + your CSS variables (`var(--primary)`, `var(--accent)`)
- Color-coded waste categories: none=gray, low=green, medium=amber, high=orange, critical=red

**`DistrictPredictionCard.jsx`** — Reusable card:
- District name + type badge
- Predicted waste in kg
- Waste category badge (color-coded)
- Action (dispatch/skip/reduced)
- Assigned trucks list
- Recommendation text

**`MLScheduleHistory.jsx`** — History page:
- Table/list of past MLSchedule records
- Status badges: draft (gray), confirmed (green), completed (blue), cancelled (red)
- Click to view details
- Filter by date range

**`DriverMLAssignments.jsx`** — Driver view:
- Shows today's ML-assigned pickups for the logged-in driver
- District name, predicted waste, truck assignment
- Simple card layout matching existing DriverDashboard style

---

## 7. Risk Assessment

| Change | Risk Level | Why | Mitigation |
|--------|-----------|-----|------------|
| New `ml/` folder | NONE | Completely independent, no connection to existing code | N/A |
| New backend models | NONE | New collections in MongoDB, no existing collections touched | N/A |
| New backend service (mlClient.js) | NONE | New file, not imported by any existing code | N/A |
| New backend route + controller | NONE | New files, only connected via server.js mount | N/A |
| `server.js` — 2 lines added | VERY LOW | Import + route mount. If file missing, server won't start | Create route file before modifying server.js |
| `AppRoutes.jsx` — new routes added | VERY LOW | Additive only. New paths, no existing paths changed | N/A |
| `Sidebar.jsx` — 1 array item added | VERY LOW | Adds menu item, no existing items touched | N/A |
| `.env` — 1 variable added | NONE | Additive. If missing, code uses default value | N/A |
| `npm install axios` (backend) | VERY LOW | Adds one dependency. Already used in frontend | N/A |

**Overall risk: VERY LOW** — all changes are additive. No existing logic is modified, deleted, or restructured.

---

## 8. Rollback Plan

If anything goes wrong, reverting is trivial:

1. **Delete new files:** Remove `ml/`, and the new files in `backend/` and `frontend/`
2. **Revert server.js:** Remove the 2 added lines (import + route mount)
3. **Revert AppRoutes.jsx:** Remove the 3 new route entries + imports
4. **Revert Sidebar.jsx:** Remove the 1 array item
5. **Revert .env:** Remove the `ML_SERVICE_URL` line
6. **Uninstall axios from backend:** `npm uninstall axios` (if desired)

No database migration is needed. New MongoDB collections (MLSchedule, District, WasteLog) can simply be dropped.

---

## Implementation Order

To ensure the app is never in a broken state, files will be created in this exact order:

1. `ml/` folder (fully independent — can be done anytime)
2. `backend/models/District.model.js` (new file, no impact)
3. `backend/models/MLSchedule.model.js` (new file, no impact)
4. `backend/models/WasteLog.model.js` (new file, no impact)
5. `npm install axios` in root
6. `backend/services/mlClient.js` (new file, no impact)
7. `backend/controllers/mlSchedule.controller.js` (new file, no impact)
8. `backend/routes/mlSchedule.route.js` (new file, no impact)
9. `backend/server.js` — add import + mount (now the route file exists, safe to import)
10. `.env` — add ML_SERVICE_URL
11. `scripts/seedDistricts.js` (new file, no impact)
12. `frontend/src/stores/useMLScheduleStore.js` (new file, no impact)
13. `frontend/src/components/ml/MLScheduleDashboard.jsx` (new file, no impact)
14. `frontend/src/components/ml/DistrictPredictionCard.jsx` (new file, no impact)
15. `frontend/src/components/ml/MLScheduleHistory.jsx` (new file, no impact)
16. `frontend/src/components/ml/DriverMLAssignments.jsx` (new file, no impact)
17. `frontend/src/routes/AppRoutes.jsx` — add imports + routes (all component files exist now)
18. `frontend/src/components/dashboard/Sidebar.jsx` — add menu item

**At no point during this sequence will the app be in a broken state.**

---

## Approval Checklist

Please review and confirm:

- [ ] You agree with the `ml/` folder location (sibling to backend/frontend)
- [ ] You agree with the new MongoDB models (MLSchedule, District, WasteLog)
- [ ] You agree with the route path `/api/ml-schedule`
- [ ] You agree with the frontend component location (`components/ml/`)
- [ ] You agree with the admin sidebar addition
- [ ] You agree with the driver route `/driver-ml-assignments`
- [ ] You agree that NO existing files are significantly modified
- [ ] You're OK with adding `axios` to the backend dependencies

**Once approved, I will implement everything in the exact order listed above.**
