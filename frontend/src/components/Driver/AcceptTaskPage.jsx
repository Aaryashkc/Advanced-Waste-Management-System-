import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin, Tag, Gauge, Clock, AlertCircle, CheckCircle,
  ArrowLeft, Loader2, Package, ChevronRight, X,
} from "lucide-react";
import { getSocket } from "../../utils/socket";
import api from "../../utils/api";

export default function AcceptTaskPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const [pickupId, setPickupId] = useState(routerLocation.state?.pickupId || null);
  const [pickup, setPickup] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining] = useState(false);
  const [error, setError] = useState(null);
  const [takenByOther, setTakenByOther] = useState(false);
  const [newPickupAlert, setNewPickupAlert] = useState(null);
  const alertTimeoutRef = useRef(null);

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

  useEffect(() => {
    const socket = getSocket();

    const onAccepted = ({ id, _id }) => {
      const acceptedId = id || _id;
      if (pickupId && acceptedId?.toString() === pickupId?.toString()) {
        setTakenByOther(true);
        setError("This request was just accepted by another driver.");
      }
    };

    const onCancelled = ({ id, _id }) => {
      const cancelledId = id || _id;
      if (pickupId && cancelledId?.toString() === pickupId?.toString()) {
        setError("This pickup request has been cancelled.");
        setPickup(null);
      }
    };

    const onCreated = (newPickup) => {
      if (!pickupId || takenByOther) {
        setPickup(newPickup);
        setPickupId(newPickup.id || newPickup._id);
        setError(null);
        setTakenByOther(false);
      } else {
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

  const handleDecline = () => {
    if (isAccepting || isDeclining) return;
    navigate("/driver-dashboard");
  };

  const switchToNewPickup = () => {
    if (newPickupAlert) {
      setPickupId(newPickupAlert.id || newPickupAlert._id);
      setPickup(newPickupAlert);
      setNewPickupAlert(null);
      setError(null);
      setTakenByOther(false);
    }
  };

  // Loading
  if (isFetching) {
    return (
      <div className="min-h-screen bg-[#f5f3ee] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-primary/60">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm font-medium">Loading request...</p>
        </div>
      </div>
    );
  }

  // No pickup
  if (!pickup) {
    return (
      <div className="min-h-screen bg-[#f5f3ee] pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-[#354f52] to-[#2d4a4e] px-5 sm:px-8 pt-8 pb-12 sm:rounded-b-3xl">
          <button onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition">
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className="text-xl font-bold text-white">Pickup Requests</h1>
        </div>
        <div className="px-5 sm:px-8 -mt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-primary/8 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-primary/25" />
            </div>
            <h3 className="text-base font-semibold text-primary/70 mb-1">
              {error || "No pending requests"}
            </h3>
            <p className="text-sm text-primary/40 max-w-xs mx-auto">
              Waiting for new requests via real-time connection...
            </p>
          </div>
        </div>
      </div>
      </div>
    );
  }

  const category = pickup.category || "non-recyclable";
  const level = pickup.level || "easy";
  const location = pickup.location || {};
  const levelColor = level === "hard" ? "red" : level === "medium" ? "amber" : "emerald";
  const categoryColor = category === "recyclable" ? "blue" : "orange";

  return (
    <div className="min-h-screen bg-[#f5f3ee] pb-24">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#354f52] to-[#2d4a4e] px-5 sm:px-8 pt-8 pb-12 sm:rounded-b-3xl">
        <button onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">New Pickup Request</h1>
            <p className="text-sm text-white/50 mt-1">Review and accept to start</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 text-right">
            <p className="text-[10px] text-white/50 uppercase tracking-wider">ID</p>
            <p className="text-sm font-bold text-white font-mono">
              {(pickup.id || pickup._id)?.toString().slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 -mt-6 space-y-4 max-w-2xl">
        {/* New pickup alert */}
        {newPickupAlert && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <p className="text-sm font-medium text-blue-700">New request available!</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={switchToNewPickup} className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
                View
              </button>
              <button onClick={() => setNewPickupAlert(null)} className="text-blue-400 hover:text-blue-600">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 text-sm font-medium ${
            takenByOther ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"
          }`}>
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Main Card */}
        <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
          takenByOther ? "border-red-200 opacity-60" : "border-primary/8"
        }`}>
          {/* Details Grid */}
          <div className="p-5 space-y-4">
            {/* Category & Level */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl bg-${categoryColor}-50 p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={14} className={`text-${categoryColor}-500`} />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/50">Category</p>
                </div>
                <p className={`text-sm font-bold text-${categoryColor}-700 capitalize`}>{category}</p>
              </div>
              <div className={`rounded-xl bg-${levelColor}-50 p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Gauge size={14} className={`text-${levelColor}-500`} />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/50">Difficulty</p>
                </div>
                <p className={`text-sm font-bold text-${levelColor}-700 capitalize`}>{level}</p>
              </div>
            </div>

            {/* Location */}
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-primary/40" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/50">Location</p>
              </div>
              <p className="text-sm font-semibold text-primary">
                {location.address || (location.latitude ? `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}` : "--")}
              </p>
            </div>

            {/* Status & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-primary/40" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/50">Status</p>
                </div>
                <p className={`text-sm font-bold ${takenByOther ? "text-red-600" : "text-emerald-600"}`}>
                  {takenByOther ? "Taken" : pickup.status}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-primary/40" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/50">Posted</p>
                </div>
                <p className="text-sm font-bold text-primary">
                  {pickup.createdAt ? new Date(pickup.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                </p>
              </div>
            </div>

            {/* Customer */}
            {pickup.customerName && (
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/50 mb-1">Customer</p>
                <p className="text-sm font-semibold text-primary">{pickup.customerName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleAccept}
            disabled={isAccepting || isDeclining || takenByOther}
            className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
              isAccepting || isDeclining || takenByOther
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg active:scale-[0.98]"
            }`}
          >
            {isAccepting ? (
              <><Loader2 size={16} className="animate-spin" /> Accepting...</>
            ) : takenByOther ? "Unavailable" : (
              <><CheckCircle size={16} /> Accept Request</>
            )}
          </button>

          <button
            onClick={handleDecline}
            disabled={isAccepting || isDeclining}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-sm ${
              isAccepting || isDeclining
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-white border border-primary/15 text-primary/70 hover:bg-gray-50 active:scale-[0.98]"
            }`}
          >
            Skip
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
