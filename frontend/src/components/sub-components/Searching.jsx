import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import ThankYouPage from "./ThankYouPage";
import { getSocket } from "../../utils/socket";
import usePickupStore from "../../stores/usePickupStore";
import usePaymentStore from "../../stores/usePaymentStore";
import SearchingBg from "../../assets/ourteam.webp";

// ── Icons ─────────────────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const depotIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const customerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const PICKUP_SESSION_KEY = "pending-pickup-payment";

// ── Map helpers ──────────────────────────────────────────────────────────────
function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center?.length === 2) map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length === 2) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [bounds, map]);
  return null;
}

function MapReadyHandler() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 200); }, [map]);
  return null;
}

// ── Search bar overlay ──────────────────────────────────────────────────────
function MapSearchBar({ onLocationSelect, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = useCallback((val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) { setResults([]); setShowResults(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=np&limit=6&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  const selectResult = (r) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const addr = r.display_name;
    onLocationSelect([lat, lng], addr);
    setQuery(addr);
    setShowResults(false);
    setResults([]);
  };

  return (
    <div
      ref={wrapperRef}
      className="absolute top-4 left-4 right-4 sm:left-4 sm:right-auto sm:w-96"
      style={{ zIndex: 1000 }}
    >
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-primary/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          disabled={disabled}
          placeholder="Search your pickup location..."
          className="w-full pl-11 pr-10 py-3 bg-white/95 backdrop-blur-md border border-white/60 rounded-2xl shadow-lg text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:ring-2 focus:ring-[#296200]/40 focus:border-[#296200]/30 disabled:opacity-50 transition-all"
        />
        {searching && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary/20 border-t-[#296200] rounded-full animate-spin" />
          </div>
        )}
        {query && !searching && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setShowResults(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center text-primary/50 hover:bg-primary/15 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showResults && (
        <div className="mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-primary/8 shadow-xl max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectResult(r)}
              className="w-full px-4 py-3 text-left hover:bg-[#296200]/5 transition-colors border-b border-primary/5 last:border-0 flex items-start gap-3"
            >
              <svg className="w-4 h-4 text-[#296200] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-primary/80 leading-snug line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────
const Icons = {
  route: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  building: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  truck: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0h2m0 0V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16h-2" />
    </svg>
  ),
  user: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  pin: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// ── Price Estimate Card ────────────────────────────────────────────────────
function PriceCard({ estimate, category, level }) {
  if (!estimate) return null;
  const catLabels = { recyclable: "Recyclable", "non-recyclable": "Non-Recyclable", both: "Mixed" };
  const lvlLabels = { easy: "Light", medium: "Medium", hard: "Heavy" };

  return (
    <div className="rounded-2xl border border-primary/8 overflow-hidden bg-white">
      {/* Rows */}
      <div className="divide-y divide-primary/6">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="text-xs text-primary/55 font-medium">Base rate ({catLabels[category] || category})</span>
          <span className="text-sm font-semibold text-primary">NPR {estimate.priceBreakdown?.categoryBase}</span>
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="text-xs text-primary/55 font-medium">Weight ({lvlLabels[level] || level})</span>
          <span className="text-sm font-semibold text-primary">&times;{estimate.priceBreakdown?.levelMultiplier}</span>
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="text-xs text-primary/55 font-medium">Distance ({estimate.distanceKm?.toFixed(1)} km)</span>
          <span className="text-sm font-semibold text-primary">NPR {estimate.priceBreakdown?.distanceCharge}</span>
        </div>
      </div>
      {/* Total */}
      <div className="px-5 py-4 bg-[#296200]/5 flex items-center justify-between border-t border-[#296200]/10">
        <span className="text-sm font-bold text-primary">Total Estimated</span>
        <span className="text-2xl font-extrabold text-[#296200]">NPR {estimate.estimatedPrice}</span>
      </div>
      {/* Route meta */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-4 text-xs text-primary/50 border-t border-primary/5">
        <span className="flex items-center gap-1.5">{Icons.route}{estimate.distanceKm?.toFixed(1)} km</span>
        <span className="flex items-center gap-1.5">{Icons.clock}~{Math.ceil(estimate.durationMinutes || 0)} min</span>
        {estimate.orgName && <span className="flex items-center gap-1.5">{Icons.building}{estimate.orgName}</span>}
        {estimate.fallback && <span className="text-amber-600 font-semibold">Approx. route</span>}
      </div>
    </div>
  );
}

// ── Driver Info Card ──────────────────────────────────────────────────────
function DriverCard({ driverInfo, assignedAt }) {
  if (!driverInfo) return null;
  const rows = [
    { icon: Icons.user, label: "Driver", value: driverInfo.name },
    { icon: Icons.phone, label: "Phone", value: driverInfo.phone },
    { icon: Icons.truck, label: "Vehicle", value: [driverInfo.vehicleId, driverInfo.licensePlate].filter(Boolean).join(" \u00B7 ") },
    { icon: Icons.clock, label: "Accepted", value: assignedAt ? new Date(assignedAt).toLocaleTimeString() : null },
  ].filter((r) => r.value);

  return (
    <div className="rounded-2xl border border-emerald-200 overflow-hidden bg-white">
      <div className="px-5 py-3.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          {Icons.check}
        </span>
        <div>
          <p className="text-sm font-bold text-emerald-800">Driver Assigned</p>
          <p className="text-[11px] text-emerald-600">Your pickup has been accepted</p>
        </div>
      </div>
      <div className="divide-y divide-primary/5">
        {rows.map((r, i) => (
          <div key={i} className="px-5 py-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs text-primary/50">{r.icon}{r.label}</span>
            <span className="text-sm font-semibold text-primary">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reusable button ──────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = "primary", className = "" }) {
  const base = "px-6 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#296200] text-white shadow-md shadow-[#296200]/20 hover:bg-[#245400]",
    outline: "border-2 border-primary/20 text-primary bg-white hover:bg-primary/5",
    danger: "bg-red-500 text-white shadow-md shadow-red-500/20 hover:bg-red-600",
    ghost: "text-primary/60 hover:text-primary hover:bg-primary/5",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
function SearchPage() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pickupIdFromUrl = searchParams.get("pickupId");

  const { wasteUploadId = null, category = "non-recyclable", level = "easy" } =
    routerLocation.state || {};

  const {
    createPickup, cancelPickup, estimatePickup, clearEstimate, fetchPickup, restoreEstimateFromPickup,
    estimate, estimateLoading, estimateError,
    currentPickup, loading,
  } = usePickupStore();

  const [flow, setFlow] = useState("confirm");
  const [pickupId, setPickupId] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [assignedAt, setAssignedAt] = useState(null);

  // Payment popup
  const { initiatePayment, loading: payLoading, error: payError } = usePaymentStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSettled, setPaymentSettled] = useState(false);

  // Map
  const [mapCenter, setMapCenter] = useState([27.7172, 85.324]);
  const [mapZoom, setMapZoom] = useState(14);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // Countdown
  const [secondsLeft, setSecondsLeft] = useState(60);
  const intervalRef = useRef(null);
  const flowRef = useRef(flow);
  const pickupIdRef = useRef(pickupId);
  const paymentSettledRef = useRef(paymentSettled);

  const clearPickupResume = useCallback(() => {
    localStorage.removeItem(PICKUP_SESSION_KEY);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const raw = localStorage.getItem(PICKUP_SESSION_KEY);
    let session = null;
    try {
      session = raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(PICKUP_SESSION_KEY);
    }

    const resumePickupId = pickupIdFromUrl || session?.pickupId;
    if (!resumePickupId) return;

    let cancelled = false;
    (async () => {
      const result = await fetchPickup(resumePickupId);
      if (cancelled) return;
      if (!result.success || !result.pickup) {
        clearPickupResume();
        return;
      }

      const pickup = result.pickup;
      const loc = pickup.location;
      const nextSession = {
        pickupId: pickup.id,
        selectedLocation: session?.selectedLocation || null,
        selectedAddress: loc?.address || session?.selectedAddress || null,
      };
      if (loc?.latitude && loc?.longitude) {
        const nextLocation = [Number(loc.latitude), Number(loc.longitude)];
        setSelectedLocation(nextLocation);
        setMapCenter(nextLocation);
        setMapZoom(16);
        setSelectedAddress(loc.address || session?.selectedAddress || null);
        nextSession.selectedLocation = nextLocation;
      }
      restoreEstimateFromPickup(pickup);
      setPickupId(pickup.id);
      localStorage.setItem(PICKUP_SESSION_KEY, JSON.stringify(nextSession));
      if (!pickupIdFromUrl) {
        setSearchParams({ pickupId: pickup.id }, { replace: true });
      }

      if (pickup.status === "PAYMENT_REQUIRED") {
        setFlow("payment");
        setShowPaymentModal(true);
        setPaymentSettled(false);
        paymentSettledRef.current = false;
      } else if (["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"].includes(pickup.status)) {
        setPaymentSettled(true);
        paymentSettledRef.current = true;
        if (pickup.status !== "PENDING") setSecondsLeft(60);
        setFlow(pickup.status === "PENDING" ? "searching" : "found");
        setDriverInfo(pickup.driverInfo || null);
        setAssignedAt(pickup.assignedAt || null);
      } else {
        clearPickupResume();
      }
    })();

    return () => { cancelled = true; };
  }, [pickupIdFromUrl, fetchPickup, restoreEstimateFromPickup, setSearchParams, clearPickupResume]);

  useEffect(() => {
    if (flow !== "found") { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => { if (s <= 1) { clearInterval(intervalRef.current); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [flow]);

  // Auto-cancel any in-flight pickup if the user navigates away (unmount).
  // IMPORTANT: do NOT cancel once the customer has chosen a payment method —
  // otherwise eSewa redirects (page navigates away → React unmount) would
  // wipe the freshly created pickup and corrupt the customer's history.
  useEffect(() => { flowRef.current = flow; }, [flow]);
  useEffect(() => { pickupIdRef.current = pickupId; }, [pickupId]);
  useEffect(() => { paymentSettledRef.current = paymentSettled; }, [paymentSettled]);
  useEffect(() => {
    return () => {
      const f = flowRef.current;
      const id = pickupIdRef.current;
      const settled = paymentSettledRef.current;
      if (id && !settled && (f === "searching" || f === "found")) {
        cancelPickup(id);
      }
    };
  }, [cancelPickup]);

  // Geolocation on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(loc);
          setMapZoom(16);
        },
        () => {}, { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Socket
  useEffect(() => {
    const socket = getSocket();
    const onAccepted = (data) => {
      if (pickupId && data.id?.toString() !== pickupId?.toString()) return;
      setDriverInfo(data.driverInfo || null);
      setAssignedAt(data.assignedAt || null);
      setSecondsLeft(60);
      setFlow("found");
    };
    const onStatus = (data) => {
      if (pickupId && data.id?.toString() !== pickupId?.toString()) return;
      if (data.status === "CANCELLED" || data.status === "EXPIRED") {
        clearPickupResume();
        setFlow("cancelled");
      }
    };
    const onStatusUpdate = (data) => {
      if (pickupId && data.id?.toString() !== pickupId?.toString()) return;
      if (data.status === "COMPLETED") {
        clearPickupResume();
        setFlow("thankyou");
      }
    };
    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:status", onStatus);
    socket.on("pickup:statusUpdate", onStatusUpdate);
    return () => { socket.off("pickup:accepted", onAccepted); socket.off("pickup:status", onStatus); socket.off("pickup:statusUpdate", onStatusUpdate); };
  }, [pickupId, clearPickupResume]);

  // Route bounds & positions
  const routeBounds = estimate?.depotLocation && selectedLocation
    ? [[estimate.depotLocation.latitude, estimate.depotLocation.longitude], selectedLocation]
    : null;
  const routePositions = estimate?.routeGeometry?.map(([lng, lat]) => [lat, lng]) || null;

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedLocation) return;
    const result = await estimatePickup(
      { latitude: selectedLocation[0], longitude: selectedLocation[1] },
      { category, level }
    );
    if (result.success) setFlow("estimate");
  };

  const handleAcceptEstimate = async () => {
    setFlow("payment");
    const result = await createPickup(
      { latitude: selectedLocation[0], longitude: selectedLocation[1], address: selectedAddress },
      { wasteUploadId, category, level }
    );
    if (result.success) {
      setPickupId(result.pickup.id);
      setSearchParams({ pickupId: result.pickup.id }, { replace: true });
      localStorage.setItem(PICKUP_SESSION_KEY, JSON.stringify({
        pickupId: result.pickup.id,
        selectedLocation,
        selectedAddress,
      }));
      setShowPaymentModal(true);
    }
    else { alert(result.error || "Failed to create pickup request."); setFlow("estimate"); }
  };

  const handleCancelSearching = async () => {
    if (pickupId) await cancelPickup(pickupId);
    clearPickupResume();
    setFlow("confirm"); setPickupId(null); clearEstimate();
  };

  const handleCancel = async () => {
    if (pickupId) await cancelPickup(pickupId);
    clearPickupResume();
    setFlow("confirm"); setPickupId(null); setDriverInfo(null); clearEstimate();
  };

  const handleChoosePayment = async (method) => {
    if (!pickupId) return;
    // Mark settled BEFORE the eSewa form submit fires — otherwise the page
    // navigation can race the React unmount and trigger the auto-cancel.
    setPaymentSettled(true);
    paymentSettledRef.current = true;
    const result = await initiatePayment({ pickupId, method });
    if (result.success) {
      setShowPaymentModal(false);
      if (method === "cash") {
        setFlow("searching");
      }
      // For eSewa the browser is already redirecting away.
    } else {
      // Roll back if initiation failed so the customer can retry / cancel.
      setPaymentSettled(false);
      paymentSettledRef.current = false;
    }
  };

  const handleBackToHome = () => {
    clearPickupResume();
    setFlow("confirm"); setSelectedLocation(null); setSelectedAddress(null);
    setPickupId(null); setDriverInfo(null); clearEstimate();
    usePickupStore.getState().resetPickup();
    navigate("/customer-dashboard");
  };

  const handleMapClick = (latlng) => {
    if (flow !== "confirm") return;
    const loc = [latlng.lat, latlng.lng];
    setSelectedLocation(loc);
    setMapCenter(loc);
    setMapZoom(16);
    // Reverse geocode
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`, { headers: { "Accept-Language": "en" } })
      .then((r) => r.json())
      .then((d) => setSelectedAddress(d.display_name || null))
      .catch(() => setSelectedAddress(null));
  };

  const handleSearchSelect = (location, address) => {
    if (flow !== "confirm") return;
    setSelectedLocation(location);
    setMapCenter(location);
    setMapZoom(16);
    setSelectedAddress(address);
  };

  const canCancel = secondsLeft > 0;

  if (flow === "thankyou") return <ThankYouPage driverInfo={driverInfo} onBackToHome={handleBackToHome} />;

  // ── Derive display address ────────────────────────────────────────────
  const shortAddress = selectedAddress
    ? selectedAddress.split(",").slice(0, 3).join(", ")
    : selectedLocation
      ? `${selectedLocation[0].toFixed(5)}, ${selectedLocation[1].toFixed(5)}`
      : null;

  const showRoute = flow === "estimate" || flow === "payment" || flow === "searching" || flow === "found";

  return (
    <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
      {/* ── Dynamic Background ── */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${SearchingBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-10">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={async () => {
              // If a pickup is in-flight, cancel it before leaving so it doesn't
              // linger as PENDING on the dashboard.
              if (pickupId && (flow === "payment" || flow === "searching" || flow === "found")) {
                await cancelPickup(pickupId);
                clearPickupResume();
              }
              navigate(-1);
            }}
            className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            {flow !== "confirm" && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                {flow === "estimate" ? "Review" : flow === "payment" ? "Payment" : flow === "searching" ? "Searching" : flow === "found" ? "Matched" : "Cancelled"}
              </span>
            )}
          </div>
        </div>

        {/* ── Map Card ── */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/10">

          {/* Map */}
          <div className="relative h-[50vh] min-h-80 max-h-130">
            {flow === "confirm" && (
              <MapSearchBar onLocationSelect={handleSearchSelect} disabled={false} />
            )}

            {/* Location hint overlay */}
            {flow === "confirm" && !selectedLocation && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-999 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg border border-primary/8 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#296200]/10 flex items-center justify-center shrink-0">
                    {Icons.pin}
                  </div>
                  <p className="text-sm text-primary/70 font-medium">Click on the map or search to set your pickup location</p>
                </div>
              </div>
            )}

            <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />
              <MapReadyHandler />

              {showRoute && routeBounds ? (
                <FitBounds bounds={routeBounds} />
              ) : (
                <ChangeMapView center={mapCenter} zoom={mapZoom} />
              )}

              {selectedLocation && <Marker position={selectedLocation} icon={customerIcon} />}

              {estimate?.depotLocation && showRoute && (
                <Marker position={[estimate.depotLocation.latitude, estimate.depotLocation.longitude]} icon={depotIcon} />
              )}

              {routePositions && showRoute && (
                <Polyline positions={routePositions} color="#296200" weight={4} opacity={0.85} dashArray="10 6" />
              )}

              <MapClickHandler onClick={handleMapClick} />
            </MapContainer>
          </div>

          {/* ── Bottom Panel ── */}
          <div className="p-5 sm:p-7">

            {/* CONFIRM */}
            {flow === "confirm" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary">Set Pickup Location</h2>
                  {shortAddress ? (
                    <div className="flex items-start gap-2 mt-2">
                      <span className="text-[#296200] mt-0.5 shrink-0">{Icons.pin}</span>
                      <p className="text-sm text-primary/70 leading-relaxed">{shortAddress}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-primary/40 mt-1">No location selected yet</p>
                  )}
                </div>

                {estimateError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-red-700">{estimateError}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Btn variant="outline" onClick={() => navigate(-1)}>Cancel</Btn>
                  <Btn onClick={handleConfirm} disabled={!selectedLocation || estimateLoading}>
                    {estimateLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Getting price...
                      </span>
                    ) : "Get Price Estimate"}
                  </Btn>
                </div>
              </div>
            )}

            {/* ESTIMATE */}
            {flow === "estimate" && estimate && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary">Review Price</h2>
                  {shortAddress && (
                    <div className="flex items-start gap-2 mt-1.5">
                      <span className="text-[#296200] mt-0.5 shrink-0">{Icons.pin}</span>
                      <p className="text-sm text-primary/60">{shortAddress}</p>
                    </div>
                  )}
                </div>

                <PriceCard estimate={estimate} category={currentPickup?.category || category} level={currentPickup?.level || level} />

                <div className="flex items-center gap-3 pt-1">
                  <Btn variant="outline" onClick={() => { setFlow("confirm"); clearEstimate(); }}>Change Location</Btn>
                  <Btn onClick={handleAcceptEstimate} disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Requesting...
                      </span>
                    ) : "Accept & Request Pickup"}
                  </Btn>
                </div>
              </div>
            )}

            {/* PAYMENT */}
            {flow === "payment" && estimate && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary">Choose Payment Method</h2>
                  <p className="text-sm text-primary/50 mt-1">
                    Your request will be sent to drivers after you choose how to pay.
                  </p>
                </div>

                <PriceCard estimate={estimate} category={currentPickup?.category || category} level={currentPickup?.level || level} />

                <div className="flex items-center gap-3 pt-1">
                  <Btn variant="outline" onClick={handleCancelSearching}>Cancel Request</Btn>
                  <Btn onClick={() => setShowPaymentModal(true)} disabled={payLoading}>
                    {payLoading ? "Processing..." : "Choose Payment"}
                  </Btn>
                </div>
              </div>
            )}

            {/* SEARCHING */}
            {flow === "searching" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-[#296200]/20 animate-ping" />
                    <span className="absolute inset-2 rounded-full bg-[#296200]/40 animate-ping [animation-delay:150ms]" />
                    <span className="absolute inset-3 rounded-full bg-[#296200]" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary">Searching for drivers...</h2>
                    <p className="text-sm text-primary/50">Nearby drivers are being notified</p>
                  </div>
                </div>

                {estimate && (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="px-3 py-1.5 rounded-full bg-primary/5 text-primary font-semibold">NPR {estimate.estimatedPrice}</span>
                    <span className="px-3 py-1.5 rounded-full bg-primary/5 text-primary/60">{estimate.distanceKm?.toFixed(1)} km</span>
                    <span className="px-3 py-1.5 rounded-full bg-primary/5 text-primary/60">~{Math.ceil(estimate.durationMinutes || 0)} min</span>
                  </div>
                )}

                <Btn variant="outline" onClick={handleCancelSearching}>Cancel Search</Btn>
              </div>
            )}

            {/* DRIVER FOUND */}
            {flow === "found" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 text-white">
                    {Icons.check}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary">Driver Found!</h2>
                    <p className="text-sm text-primary/50">
                      {driverInfo?.licensePlate && <span className="font-semibold text-[#296200]">{driverInfo.licensePlate}</span>}
                      {driverInfo?.licensePlate && " \u00B7 "}
                      Truck is on its way
                    </p>
                  </div>
                </div>

                <DriverCard driverInfo={driverInfo} assignedAt={assignedAt} />

                {estimate && (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="px-3 py-1.5 rounded-full bg-[#296200]/8 text-[#296200] font-bold">NPR {estimate.estimatedPrice}</span>
                    <span className="px-3 py-1.5 rounded-full bg-primary/5 text-primary/60">{estimate.distanceKm?.toFixed(1)} km</span>
                    <span className="px-3 py-1.5 rounded-full bg-primary/5 text-primary/60">~{Math.ceil(estimate.durationMinutes || 0)} min</span>
                  </div>
                )}

                {canCancel && (
                  <p className="text-xs text-primary/40">
                    You can cancel within <span className="font-bold text-primary">{String(secondsLeft).padStart(2, "0")}s</span>
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Btn onClick={() => setFlow("thankyou")}>Confirm Pickup</Btn>
                  <Btn variant="danger" onClick={handleCancel} disabled={!canCancel}>Cancel</Btn>
                </div>
              </div>
            )}

            {/* CANCELLED */}
            {flow === "cancelled" && (
              <div className="space-y-4 text-center py-4">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary">Request Cancelled</h2>
                  <p className="text-sm text-primary/50 mt-1">Your pickup request was cancelled or expired</p>
                </div>
                <Btn onClick={() => { setFlow("confirm"); setPickupId(null); clearEstimate(); }}>Try Again</Btn>
              </div>
            )}
          </div>
        </div>

        {/* ── Legend (when route is showing) ── */}
        {showRoute && estimate?.depotLocation && (
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500" /> Your location
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" /> Depot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 border-t-2 border-dashed border-[#296200]" /> Route
            </span>
          </div>
        )}
      </div>

      {/* ── Payment Method Modal ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-primary/10">
              <h3 className="text-2xl font-bold text-primary">Choose Payment Method</h3>
              <p className="text-sm text-primary/60 mt-1">
                Choose how you want to pay before we notify drivers.
              </p>
              {estimate?.estimatedPrice && (
                <div className="mt-3 inline-flex items-center px-3 py-1.5 rounded-full bg-[#296200]/10 text-[#296200] font-bold text-sm">
                  Total: NPR {estimate.estimatedPrice}
                </div>
              )}
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => handleChoosePayment("cash")}
                disabled={payLoading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/10 hover:border-[#296200] hover:bg-[#296200]/5 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-2xl">
                  💵
                </div>
                <div className="flex-1">
                  <div className="font-bold text-primary">Cash Payment</div>
                  <div className="text-xs text-primary/60">Pay the driver in cash on pickup</div>
                </div>
              </button>

              <button
                onClick={() => handleChoosePayment("esewa")}
                disabled={payLoading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/10 hover:border-[#296200] hover:bg-[#296200]/5 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center font-bold text-green-700">
                  eS
                </div>
                <div className="flex-1">
                  <div className="font-bold text-primary">eSewa</div>
                  <div className="text-xs text-primary/60">Pay online securely via eSewa</div>
                </div>
              </button>

              {payError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {payError}
                </div>
              )}

              {payLoading && (
                <div className="text-center text-sm text-primary/60">
                  Processing...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
