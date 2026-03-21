import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";

export default function AcceptTaskPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // pickupId either from DriverDashboard navigation state or from the
  // first PENDING pickup fetched from the server
  const [pickupId, setPickupId] = useState(routerLocation.state?.pickupId || null);
  const [pickup, setPickup] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, _setIsDeclining] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch pickup details on mount ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsFetching(true);
      setError(null);

      try {
        if (pickupId) {
          // Fetch the specific pickup passed from DriverDashboard
          const res = await api.get(`/pickups/${pickupId}`);
          setPickup(res.data.pickup);
        } else {
          // Fallback: fetch the first available PENDING request
          const res = await api.get("/pickups/pending");
          const first = res.data.pickups?.[0] || null;
          if (first) {
            setPickup(first);
            setPickupId(first.id);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load pickup request");
      } finally {
        setIsFetching(false);
      }
    };

    load();
  }, [pickupId]);

  // ── Accept ───────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (isAccepting || isDeclining || !pickupId) return;
    setIsAccepting(true);
    setError(null);

    try {
      await api.post(`/pickups/${pickupId}/accept`);
      // Navigate to task route page with the pickup data
      navigate(`/task-route/${pickupId}`, { replace: true, state: { pickup } });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to accept";
      if (err.response?.status === 409) {
        // Race condition: another driver was faster
        setError("This request was just accepted by another driver.");
        setTimeout(() => navigate("/driver-dashboard"), 2000);
      } else {
        setError(msg);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  // ── Decline ──────────────────────────────────────────────────────────────
  const handleDecline = () => {
    if (isAccepting || isDeclining) return;
    // Simply navigate away — the request stays PENDING for other drivers
    navigate("/driver-dashboard");
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isFetching) {
    return (
      <div className="app-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-[var(--primary)]/60">
            <Spinner />
            <p className="text-sm font-medium">Loading request…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── No pickup found ──────────────────────────────────────────────────────
  if (!pickup) {
    return (
      <div className="app-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-[var(--primary)] font-semibold text-lg">
            {error || "No pending pickup requests at the moment."}
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

  const category = pickup.category || "non-recyclable";
  const level = pickup.level || "easy";
  const location = pickup.location || {};

  return (
    <div className="app-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--primary)]">
              New Pickup Request
            </h1>
            <div className="mt-2 h-[3px] w-56 bg-[var(--accent)] rounded-full" />
          </div>
          <button
            className="w-11 h-11 rounded-full border border-[var(--primary)]/30 bg-white flex items-center justify-center hover:shadow-sm active:scale-95 transition"
            aria-label="Profile"
          >
            <UserIcon />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Card */}
        <div className="mt-6 sm:mt-8 bg-white rounded-3xl border border-[var(--primary)]/15 shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="px-5 sm:px-7 py-5 sm:py-6 bg-[var(--accent)] border-b border-[var(--primary)]/15 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[var(--primary)]/70">
                PICKUP REQUEST DETAILS
              </p>
              <p className="text-sm text-[var(--primary)]/60 mt-1">
                Review and accept to start pickup.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-[var(--primary)]/70">REQUEST ID</p>
              <p className="text-sm sm:text-base font-bold text-[var(--primary)] font-mono">
                {pickup.id?.toString().slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Body rows */}
          <div className="divide-y divide-[var(--primary)]/10">
            <Row
              leftLabel="WASTE CATEGORY"
              leftValue={category.toUpperCase()}
              leftValueClass="text-[var(--accent)] font-semibold"
              rightLabel="DIFFICULTY LEVEL"
              rightValue={level.toUpperCase()}
            />
            <Row
              leftLabel="LOCATION"
              leftValue={
                location.address ||
                (location.latitude
                  ? `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`
                  : "—")
              }
              rightLabel="STATUS"
              rightValue={pickup.status}
              rightValueClass="text-green-600 font-semibold"
            />
            <Row
              leftLabel="POSTED"
              leftValue={pickup.createdAt ? new Date(pickup.createdAt).toLocaleTimeString() : "—"}
              rightLabel="EXPIRES"
              rightValue={pickup.expiresAt ? new Date(pickup.expiresAt).toLocaleTimeString() : "—"}
              rightValueClass="text-red-500 font-semibold"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleAccept}
            disabled={isAccepting || isDeclining}
            className={`w-full sm:w-auto sm:min-w-[220px] px-8 py-4 rounded-2xl font-semibold transition shadow-sm
              ${isAccepting || isDeclining
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-[#213a3d] text-white hover:opacity-95 active:scale-[0.99]"
              }
            `}
          >
            {isAccepting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Accepting…
              </span>
            ) : (
              "ACCEPT REQUEST"
            )}
          </button>

          <button
            onClick={handleDecline}
            disabled={isAccepting || isDeclining}
            className={`w-full sm:w-auto sm:min-w-[180px] px-8 py-4 rounded-2xl font-semibold transition shadow-sm
              ${isAccepting || isDeclining
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-red-400 text-white hover:bg-red-500 active:scale-[0.99]"
              }
            `}
          >
            {isDeclining ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Declining…
              </span>
            ) : (
              "Skip"
            )}
          </button>
        </div>

        <p className="mt-4 text-sm text-[var(--primary)]/60">
          Tip: Only one driver can accept each request. Be quick!
        </p>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Row({ leftLabel, leftValue, rightLabel, rightValue, leftValueClass = "", rightValueClass = "", hideRightOnMobile = false }) {
  return (
    <div className="px-5 sm:px-7 py-5 sm:py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--primary)]/70">{leftLabel}</p>
        <p className={`mt-1 text-base text-[var(--primary)] ${leftValueClass}`}>{leftValue}</p>
      </div>
      <div className={`${hideRightOnMobile ? "hidden sm:block" : ""} sm:text-right`}>
        <p className="text-xs font-semibold tracking-wide text-[var(--primary)]/70">{rightLabel}</p>
        <p className={`mt-1 text-base text-[var(--primary)] ${rightValueClass}`}>{rightValue}</p>
      </div>
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

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" className="text-[var(--primary)]" />
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" className="text-[var(--primary)]" />
    </svg>
  );
}
