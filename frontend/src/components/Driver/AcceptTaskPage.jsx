import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSocket } from "../../utils/socket";
import api from "../../utils/api";

export default function AcceptTaskPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const [pickupId, setPickupId] = useState(routerLocation.state?.pickupId || null);
  const [pickup, setPickup] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, _setIsDeclining] = useState(false);
  const [error, setError] = useState(null);
  const [takenByOther, setTakenByOther] = useState(false);
  const [newPickupAlert, setNewPickupAlert] = useState(null);
  const alertTimeoutRef = useRef(null);

  // ── Fetch pickup details on mount ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsFetching(true);
      setError(null);

      try {
        if (pickupId) {
          const res = await api.get(`/pickups/${pickupId}`);
          setPickup(res.data.pickup);
        } else {
          const res = await api.get("/pickups/pending");
          const first = res.data.pickups?.[0] || null;
          if (first) {
            setPickup(first);
            setPickupId(first.id || first._id);
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

  // ── Socket: listen for real-time events ──────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    // If someone else accepts the pickup we're viewing
    const onAccepted = ({ id, _id }) => {
      const acceptedId = id || _id;
      if (pickupId && acceptedId?.toString() === pickupId?.toString()) {
        setTakenByOther(true);
        setError("This request was just accepted by another driver.");
      }
    };

    // If pickup is cancelled while we're viewing it
    const onCancelled = ({ id, _id }) => {
      const cancelledId = id || _id;
      if (pickupId && cancelledId?.toString() === pickupId?.toString()) {
        setError("This pickup request has been cancelled.");
        setPickup(null);
      }
    };

    // New pickup notification while on this page
    const onCreated = (newPickup) => {
      if (!pickupId || takenByOther) {
        // Auto-load the new pickup if we don't have one
        setPickup(newPickup);
        setPickupId(newPickup.id || newPickup._id);
        setError(null);
        setTakenByOther(false);
      } else {
        // Show a subtle alert about the new pickup
        setNewPickupAlert(newPickup);
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = setTimeout(() => setNewPickupAlert(null), 8000);
      }
    };

    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:cancelled", onCancelled);
    socket.on("pickup:created", onCreated);

    return () => {
      socket.off("pickup:accepted", onAccepted);
      socket.off("pickup:cancelled", onCancelled);
      socket.off("pickup:created", onCreated);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, [pickupId, takenByOther]);

  // ── Accept ───────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (isAccepting || isDeclining || !pickupId) return;
    setIsAccepting(true);
    setError(null);

    try {
      await api.post(`/pickups/${pickupId}/accept`);
      navigate(`/task-route/${pickupId}`, { replace: true, state: { pickup } });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to accept";
      if (err.response?.status === 409) {
        setTakenByOther(true);
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
    navigate("/driver-dashboard");
  };

  // ── Switch to new pickup ─────────────────────────────────────────────────
  const switchToNewPickup = () => {
    if (newPickupAlert) {
      setPickupId(newPickupAlert.id || newPickupAlert._id);
      setPickup(newPickupAlert);
      setNewPickupAlert(null);
      setError(null);
      setTakenByOther(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isFetching) {
    return (
      <div className="app-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-primary/60">
            <Spinner />
            <p className="text-sm font-medium">Loading request...</p>
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
          <p className="text-primary font-semibold text-lg">
            {error || "No pending pickup requests at the moment."}
          </p>
          <p className="text-sm text-primary/50">Waiting for new requests via real-time connection...</p>
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
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-primary">
              New Pickup Request
            </h1>
            <div className="mt-2 h-[3px] w-56 bg-[var(--accent)] rounded-full" />
          </div>
          <button
            className="w-11 h-11 rounded-full border border-primary/30 bg-white flex items-center justify-center hover:shadow-sm active:scale-95 transition"
            aria-label="Profile"
          >
            <UserIcon />
          </button>
        </div>

        {/* New pickup alert banner */}
        {newPickupAlert && (
          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <p className="text-sm font-medium text-blue-700">
                New pickup request available!
              </p>
            </div>
            <button
              onClick={switchToNewPickup}
              className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
            >
              View It
            </button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            takenByOther
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {error}
          </div>
        )}

        {/* Card */}
        <div className={`mt-6 sm:mt-8 bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
          takenByOther ? "border-red-200 opacity-60" : "border-primary/15"
        }`}>
          {/* Header row */}
          <div className="px-5 sm:px-7 py-5 sm:py-6 bg-[var(--accent)] border-b border-primary/15 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary/70">
                PICKUP REQUEST DETAILS
              </p>
              <p className="text-sm text-primary/60 mt-1">
                Review and accept to start pickup.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-primary/70">REQUEST ID</p>
              <p className="text-sm sm:text-base font-bold text-primary font-mono">
                {(pickup.id || pickup._id)?.toString().slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Body rows */}
          <div className="divide-y divide-primary/10">
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
              rightValue={takenByOther ? "TAKEN" : pickup.status}
              rightValueClass={takenByOther ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}
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
            disabled={isAccepting || isDeclining || takenByOther}
            className={`w-full sm:w-auto sm:min-w-[220px] px-8 py-4 rounded-2xl font-semibold transition shadow-sm
              ${isAccepting || isDeclining || takenByOther
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-[#213a3d] text-white hover:opacity-95 active:scale-[0.99]"
              }
            `}
          >
            {isAccepting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Accepting...
              </span>
            ) : takenByOther ? (
              "Unavailable"
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
                <Spinner /> Declining...
              </span>
            ) : (
              "Skip"
            )}
          </button>
        </div>

        <p className="mt-4 text-sm text-primary/60">
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
        <p className="text-xs font-semibold tracking-wide text-primary/70">{leftLabel}</p>
        <p className={`mt-1 text-base text-primary ${leftValueClass}`}>{leftValue}</p>
      </div>
      <div className={`${hideRightOnMobile ? "hidden sm:block" : ""} sm:text-right`}>
        <p className="text-xs font-semibold tracking-wide text-primary/70">{rightLabel}</p>
        <p className={`mt-1 text-base text-primary ${rightValueClass}`}>{rightValue}</p>
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
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" className="text-primary" />
    </svg>
  );
}
