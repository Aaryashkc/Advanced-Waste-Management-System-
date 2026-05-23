import { Suspense, lazy, useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";
import PaymentBadge from "./PaymentBadge";

const DriverRouteMap = lazy(() => import("./DriverRouteMap"));

/**
 * Task flow with real pickup data:
 * 1) Update Status (ongoing) -> click Update Status
 * 2) Task Execution (checklist) -> check items
 * 3) Mark Collection Complete -> updates status via API
 * 4) All done -> return to dashboard
 */

const CHECK_ITEMS = [
  { key: "containerLocated", label: "Container Located" },
  { key: "loadSecured", label: "Load Secured" },
  { key: "volumeVerified", label: "Volume Verified" },
  { key: "siteClean", label: "Site Clean" },
];

function nowTimeLabel() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TaskFlow() {
  const { pickupId: paramId } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const { pickup: passedPickup } = routerLocation.state || {};
  const [pickupId] = useState(paramId || null);
  const [pickup, setPickup] = useState(passedPickup || null);
  const [loading, setLoading] = useState(!passedPickup);
  const [error, setError] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [cashUpdating, setCashUpdating] = useState(false);
  const [cashConfirmed, setCashConfirmed] = useState(false);

  // Fetch pickup if not passed via state
  useEffect(() => {
    if (pickup || !pickupId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/pickups/${pickupId}`);
        setPickup(res.data.pickup);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load pickup");
      } finally {
        setLoading(false);
      }
    })();
  }, [pickupId, pickup]);

  // Page state: 1 = Update Status, 2 = Task Execution
  const [page, setPage] = useState(1);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Current pickup status tracking
  const [currentStatus, setCurrentStatus] = useState("EN_ROUTE");
  const [completedAt, setCompletedAt] = useState(null);

  // Checklist state
  const [checks, setChecks] = useState(() => ({
    containerLocated: false,
    loadSecured: false,
    volumeVerified: false,
    siteClean: false,
  }));

  const allChecked = Object.values(checks).every(Boolean);
  const isCompleted = currentStatus === "COMPLETED";
  const requiresCashConfirmation = pickup?.paymentMethod === "cash" && pickup?.paymentStatus !== "PAID";

  useEffect(() => {
    if (pickup?.paymentMethod === "cash" && pickup?.paymentStatus === "PAID") {
      setCashConfirmed(true);
    }
  }, [pickup?.paymentMethod, pickup?.paymentStatus]);

  // Call API to update status
  async function updateStatus(newStatus) {
    if (statusUpdating || !pickupId) return false;
    setStatusUpdating(true);
    setError(null);
    try {
      await api.post(`/pickups/${pickupId}/status`, { status: newStatus });
      setCurrentStatus(newStatus);
      if (newStatus === "COMPLETED") {
        setCompletedAt(nowTimeLabel());
        // Refetch the pickup so we get the latest paymentMethod / paymentStatus
        // (the customer may have switched to eSewa after the driver accepted).
        try {
          const fresh = await api.get(`/pickups/${pickupId}`);
          if (fresh.data?.pickup) setPickup(fresh.data.pickup);
        } catch { /* non-fatal */ }
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update status to ${newStatus}`);
      return false;
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleUpdateStatus() {
    // If already arrived, just switch page to checklist
    if (currentStatus === "ARRIVED") {
      setPage(2);
      return;
    }

    // Move from EN_ROUTE -> ARRIVED when driver clicks "Update Status"
    const ok = await updateStatus("ARRIVED");
    if (ok) setPage(2); // Go to task execution (checklist)
  }

  async function handleMarkComplete() {
    if (!allChecked) return;
    if (requiresCashConfirmation && !cashConfirmed) {
      setError("Confirm cash payment before completing this pickup");
      return;
    }

    // First move to COLLECTING
    const ok1 = await updateStatus("COLLECTING");
    if (!ok1) return;

    if (requiresCashConfirmation) {
      setCashUpdating(true);
      try {
        await api.post(`/payments/${pickupId}/cash-collected`);
        const fresh = await api.get(`/pickups/${pickupId}`);
        if (fresh.data?.pickup) setPickup(fresh.data.pickup);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to confirm cash received");
        setCashUpdating(false);
        return;
      }
      setCashUpdating(false);
    }

    // Then to COMPLETED
    const ok2 = await updateStatus("COMPLETED");
    if (ok2) {
      setPage(1); // Show completed state
    }
  }

  async function handleCashReceived() {
    if (!pickupId || cashUpdating) return;
    setCashUpdating(true);
    setError(null);
    try {
      await api.post(`/payments/${pickupId}/cash-collected`);
      const fresh = await api.get(`/pickups/${pickupId}`);
      if (fresh.data?.pickup) setPickup(fresh.data.pickup);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to confirm cash received");
    } finally {
      setCashUpdating(false);
    }
  }

  function handleBackToUpdate() {
    setPage(1);
  }

  function toggleCheck(key) {
    if (isCompleted) return;
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-primary/60">
            <Spinner />
            <p className="text-sm font-medium">Loading task…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pickup && !pickupId) {
    return (
      <div className="app-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-primary font-semibold text-lg">
            No active task. Accept a pickup request first.
          </p>
          <button
            onClick={() => navigate("/driver-dashboard")}
            className="px-6 py-3 rounded-2xl bg-[#213a3d] text-white font-semibold hover:opacity-90 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const loc = pickup?.location || {};
  const category = pickup?.category || "non-recyclable";
  const level = pickup?.level || "easy";

  return (
    <div className="app-bg min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-primary">
              {page === 1 ? "Update Status" : "Task Execution"}
            </h1>
            <div className="mt-2 h-0.75 w-48 bg-accent rounded-full" />
          </div>

          <button
            onClick={() => navigate("/driver-dashboard")}
            className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm font-semibold hover:bg-white/60 transition"
          >
            Dashboard
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Persistent mini-map (always visible during task) */}
        {pickup && !isCompleted && (
          <div className="mb-6 bg-white rounded-2xl border-2 border-primary/20 shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-primary text-white text-xs font-extrabold flex items-center justify-between">
              <span>LIVE NAVIGATION</span>
              <span className="text-[10px] font-bold text-white/80">Tap ⤢ to expand</span>
            </div>
            <Suspense fallback={<MapLoading />}>
              <DriverRouteMap
                destination={pickup.location}
                mode="mini"
                onExpand={() => setMapFullscreen(true)}
              />
            </Suspense>
          </div>
        )}

        {mapFullscreen && (
          <Suspense fallback={null}>
            <DriverRouteMap
              destination={pickup?.location}
              mode="full"
              onCollapse={() => setMapFullscreen(false)}
            />
          </Suspense>
        )}

        {/* ALL DONE STATE */}
        {isCompleted ? (
          <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div>
                <p className="text-2xl font-bold text-primary">
                  Task Complete!
                </p>
                <p className="text-sm text-primary/60">
                  All collection steps have been completed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 mb-6">
              <CompletedDetail label="CATEGORY" value={category.toUpperCase()} />
              <CompletedDetail label="LEVEL" value={level.toUpperCase()} />
              <CompletedDetail label="LOCATION" value={loc.address || "—"} />
              <CompletedDetail label="COMPLETED AT" value={completedAt || "—"} />
            </div>

            {/* Payment status — shown AFTER completion so the driver knows
                whether the customer pre-paid online or owes cash. */}
            <div className="mb-6">
              <PaymentBadge pickup={pickup} />
              {pickup?.paymentMethod === "cash" && pickup?.paymentStatus !== "PAID" && (
                <button
                  type="button"
                  onClick={handleCashReceived}
                  disabled={cashUpdating}
                  className="mt-3 w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-emerald-700 active:scale-95 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cashUpdating ? "Confirming..." : "Cash Received"}
                </button>
              )}
            </div>

            <button
              onClick={() => navigate("/driver-dashboard")}
              className="bg-primary text-white px-8 py-4 rounded-2xl font-semibold hover:opacity-95 active:scale-95 transition shadow-sm"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            {page === 1 ? (
              <UpdateStatusUI
                pickup={pickup}
                currentStatus={currentStatus}
                statusUpdating={statusUpdating}
                onUpdateStatus={handleUpdateStatus}
                onBack={() => navigate("/driver-dashboard")}
              />
            ) : (
              <TaskExecutionUI
                pickup={pickup}
                checks={checks}
                checkItems={CHECK_ITEMS}
                onToggle={toggleCheck}
                allChecked={allChecked}
                isCompleted={isCompleted}
                statusUpdating={statusUpdating}
                cashUpdating={cashUpdating}
                cashConfirmed={cashConfirmed}
                requiresCashConfirmation={requiresCashConfirmation}
                onCashConfirmedChange={setCashConfirmed}
                onMarkComplete={handleMarkComplete}
                onBack={handleBackToUpdate}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* =========================
   PAGE 1: UPDATE STATUS UI
   ========================= */

function UpdateStatusUI({ pickup, currentStatus, statusUpdating, onUpdateStatus, onBack }) {
  const loc = pickup?.location || {};
  const category = pickup?.category || "non-recyclable";

  return (
    <>
      {/* Location Status Card */}
      <div className="bg-white rounded-3xl border border-primary/15 shadow-sm overflow-hidden mb-6 sm:mb-10">
        <div className="px-6 py-5 border-b border-primary/15 bg-[#f5f1e8] flex justify-between items-start gap-4">
          <div>
            <p className="text-xs font-semibold text-primary/70">
              CURRENT LOCATION
            </p>
            <p className="font-bold text-primary">
              {loc.address || `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`}
            </p>
            <p className="text-sm text-primary/70 mt-1">
              {category.toUpperCase()} • {(pickup?.level || "easy").toUpperCase()}
            </p>
          </div>

          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white">
            {currentStatus.replace("_", " ")}
          </span>
        </div>

        <div className="px-6 py-6">
          {/* Progress steps */}
          <div className="flex items-center gap-0 overflow-x-auto">
            {["EN_ROUTE", "ARRIVED", "COLLECTING", "COMPLETED"].map((step, idx) => {
              const isDone = ["EN_ROUTE"].indexOf(currentStatus) < idx ? false : true;
              const isCurrent = currentStatus === step;
              return (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center min-w-20">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent
                          ? "bg-primary text-white ring-4 ring-primary/20"
                          : isDone
                            ? "bg-accent text-white"
                            : "bg-gray-200 text-gray-500"
                        }`}
                    >
                      {isDone && !isCurrent ? "✓" : idx + 1}
                    </span>
                    <span className={`text-[10px] mt-1 font-medium ${isCurrent ? "text-primary" : "text-primary/40"}`}>
                      {step.replace("_", " ")}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`h-0.5 w-8 sm:w-12 ${isDone ? "bg-accent" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          onClick={onUpdateStatus}
          disabled={statusUpdating}
          className={`px-8 py-4 rounded-2xl font-semibold transition shadow-sm ${statusUpdating
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-primary text-white hover:opacity-95 active:scale-95"
            }`}
        >
          {statusUpdating ? (
            <span className="inline-flex items-center gap-2"><Spinner /> Updating…</span>
          ) : currentStatus === "ARRIVED" ? (
            "Continue to Checklist"
          ) : (
            "Arrived — Start Checklist"
          )}
        </button>

        <button
          onClick={onBack}
          className="px-6 py-4 rounded-2xl font-semibold border border-primary/25 text-primary hover:bg-white/60 transition"
        >
          Return to Dashboard
        </button>
      </div>
    </>
  );
}

/* =========================
   PAGE 2: TASK EXECUTION UI
   ========================= */

function TaskExecutionUI({
  pickup,
  checks,
  checkItems,
  onToggle,
  allChecked,
  isCompleted,
  statusUpdating,
  cashUpdating,
  cashConfirmed,
  requiresCashConfirmation,
  onCashConfirmedChange,
  onMarkComplete,
  onBack,
}) {
  const loc = pickup?.location || {};
  const category = pickup?.category || "non-recyclable";
  const level = pickup?.level || "easy";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left */}
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-primary/70">
                PICKUP LOCATION
              </p>
              <p className="mt-1 font-bold text-primary">
                {loc.address || `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`}
              </p>
            </div>

            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white">
              ARRIVED
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6">
          <p className="text-sm font-semibold text-primary mb-4">
            COLLECTION CHECKLIST
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {checkItems.map((item) => (
              <label
                key={item.key}
                className={`flex items-center gap-3 border rounded-xl px-4 py-3 select-none transition-all ${checks[item.key]
                    ? "border-accent bg-accent/5"
                    : "border-primary/20"
                  } ${isCompleted ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:border-primary/50"}`}
              >
                <input
                  type="checkbox"
                  checked={!!checks[item.key]}
                  disabled={isCompleted}
                  onChange={() => onToggle(item.key)}
                  className="w-4 h-4 accent-primary"
                />
                <span className={`text-sm font-medium ${checks[item.key] ? "text-primary" : "text-primary"}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>

          {/* Progress indicator */}
          <div className="mt-4">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${(Object.values(checks).filter(Boolean).length / checkItems.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-primary/60 mt-1">
              {Object.values(checks).filter(Boolean).length} of {checkItems.length} items checked
            </p>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6">
          <p className="text-sm font-semibold text-primary mb-4">
            WASTE DETAILS
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-primary/60">CATEGORY</p>
              <p className="mt-1 font-semibold text-primary">
                {category.toUpperCase()}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-primary/60">
                DIFFICULTY LEVEL
              </p>
              <p className="mt-1 font-semibold text-primary">
                {level.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6">
          <p className="text-sm font-semibold text-primary mb-4">
            PAYMENT
          </p>
          <PaymentBadge pickup={pickup} />
          {requiresCashConfirmation && (
            <label className="mt-4 flex items-center gap-3 border rounded-xl px-4 py-3 select-none cursor-pointer hover:border-primary/50 transition-all border-primary/20">
              <input
                type="checkbox"
                checked={cashConfirmed}
                onChange={(e) => onCashConfirmedChange(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-semibold text-primary">
                Cash received from customer
              </span>
            </label>
          )}
        </div>

        {!isCompleted && (
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onMarkComplete}
              disabled={!allChecked || statusUpdating || cashUpdating || (requiresCashConfirmation && !cashConfirmed)}
              className={`px-8 py-4 rounded-2xl font-semibold transition shadow-sm ${allChecked && !statusUpdating && !cashUpdating && (!requiresCashConfirmation || cashConfirmed)
                  ? "bg-primary text-white hover:opacity-95 active:scale-95"
                  : "bg-black/10 text-black/40 cursor-not-allowed"
                }`}
            >
              {statusUpdating || cashUpdating ? (
                <span className="inline-flex items-center gap-2"><Spinner /> Completing...</span>
              ) : (
                "Mark Collection Complete"
              )}
            </button>

            <button
              onClick={() => alert("Report issue flow — coming soon")}
              className="px-6 py-4 rounded-2xl font-semibold border border-red-500/40 text-red-600 hover:bg-red-50 transition"
            >
              Report Issue
            </button>

            <button
              onClick={onBack}
              className="px-6 py-4 rounded-2xl font-semibold border border-primary/25 text-primary hover:bg-white/60 transition"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   SMALL UI HELPERS
   ========================= */

function CompletedDetail({ label, value }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-[#f5f1e8] p-4">
      <p className="text-xs text-primary/55 mb-1">{label}</p>
      <p className="font-semibold text-primary text-sm">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function MapLoading() {
  return (
    <div className="flex h-40 items-center justify-center bg-primary/5 text-sm font-semibold text-primary/55">
      Loading map...
    </div>
  );
}
