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
      <div className="min-h-screen bg-brand-surface-warm flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-primary">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm font-bold">Loading request...</p>
        </div>
      </div>
    );
  }

  // No pickup
  if (!pickup) {
    return (
      <div className="min-h-screen bg-brand-surface-warm pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-primary to-brand-primary-hover px-5 sm:px-8 pt-8 pb-12 sm:rounded-b-3xl">
          <button onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-2 text-white hover:text-white/90 mb-4 transition font-medium">
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className="text-2xl font-extrabold text-white">Pickup Requests</h1>
        </div>
        <div className="px-5 sm:px-8 -mt-6">
          <div className="bg-white rounded-2xl shadow-md border-2 border-primary/20 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-primary" />
            </div>
            <h3 className="text-base font-bold text-brand-ink-strong mb-1">
              {error || "No pending requests"}
            </h3>
            <p className="text-sm text-primary max-w-xs mx-auto font-medium">
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
  const LEVEL_STYLES = {
    hard:   { bg: "bg-red-100",     text: "text-red-800",     icon: "text-red-700",     border: "border-red-300" },
    medium: { bg: "bg-amber-100",   text: "text-amber-900",   icon: "text-amber-700",   border: "border-amber-300" },
    easy:   { bg: "bg-emerald-100", text: "text-emerald-800", icon: "text-emerald-700", border: "border-emerald-300" },
  };
  const CATEGORY_STYLES = {
    recyclable:       { bg: "bg-blue-100",   text: "text-blue-800",   icon: "text-blue-700",   border: "border-blue-300" },
    "non-recyclable": { bg: "bg-orange-100", text: "text-orange-800", icon: "text-orange-700", border: "border-orange-300" },
  };
  const lvl = LEVEL_STYLES[level] || LEVEL_STYLES.easy;
  const cat = CATEGORY_STYLES[category] || CATEGORY_STYLES["non-recyclable"];

  return (
    <div className="min-h-screen bg-brand-surface-warm pb-24">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-brand-primary-hover px-5 sm:px-8 pt-8 pb-12 sm:rounded-b-3xl">
        <button onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-2 text-white hover:text-white/90 mb-4 transition font-medium">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">New Pickup Request</h1>
            <p className="text-sm text-white/85 mt-1 font-medium">Review and accept to start</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-right border border-white/30">
            <p className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">ID</p>
            <p className="text-sm font-bold text-white font-mono">
              {(pickup.id || pickup._id)?.toString().slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 -mt-6 space-y-4 max-w-2xl">
        {/* New pickup alert */}
        {newPickupAlert && (
          <div className="bg-blue-100 border-2 border-blue-400 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
              </span>
              <p className="text-sm font-bold text-blue-900">New request available!</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={switchToNewPickup} className="text-xs font-bold bg-blue-700 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">
                View
              </button>
              <button onClick={() => setNewPickupAlert(null)} className="text-blue-700 hover:text-blue-900">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`rounded-2xl border-2 px-4 py-3 flex items-center gap-3 text-sm font-semibold ${
            takenByOther ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-red-100 border-red-400 text-red-900"
          }`}>
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Main Card */}
        <div className={`bg-white rounded-2xl shadow-md border-2 overflow-hidden transition-all ${
          takenByOther ? "border-red-300 opacity-70" : "border-primary/20"
        }`}>
          {/* Details Grid */}
          <div className="p-5 space-y-4">
            {/* Category & Level */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl ${cat.bg} border ${cat.border} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={14} className={cat.icon} />
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${cat.text}`}>Category</p>
                </div>
                <p className={`text-sm font-extrabold ${cat.text} capitalize`}>{category}</p>
              </div>
              <div className={`rounded-xl ${lvl.bg} border ${lvl.border} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Gauge size={14} className={lvl.icon} />
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${lvl.text}`}>Difficulty</p>
                </div>
                <p className={`text-sm font-extrabold ${lvl.text} capitalize`}>{level}</p>
              </div>
            </div>

            {/* Location */}
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Location</p>
              </div>
              <p className="text-sm font-bold text-brand-ink-strong">
                {location.address || (location.latitude ? `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}` : "--")}
              </p>
            </div>

            {/* Status & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Status</p>
                </div>
                <p className={`text-sm font-extrabold ${takenByOther ? "text-red-700" : "text-emerald-700"} capitalize`}>
                  {takenByOther ? "Taken" : pickup.status}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Posted</p>
                </div>
                <p className="text-sm font-extrabold text-brand-ink-strong">
                  {pickup.createdAt ? new Date(pickup.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                </p>
              </div>
            </div>

            {/* Customer */}
            {pickup.customerName && (
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Customer</p>
                <p className="text-sm font-bold text-brand-ink-strong">{pickup.customerName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleAccept}
            disabled={isAccepting || isDeclining || takenByOther}
            className={`flex-1 px-8 py-3.5 rounded-2xl font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
              isAccepting || isDeclining || takenByOther
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg active:scale-[0.98]"
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
            className={`px-6 py-3.5 rounded-2xl font-extrabold text-sm transition-all shadow-sm ${
              isAccepting || isDeclining
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white active:scale-[0.98]"
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
