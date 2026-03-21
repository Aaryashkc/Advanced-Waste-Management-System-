import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import api from "../../utils/api";

/* Fix default Leaflet marker icon in bundled envs */
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 15, { animate: true });
  }, [center, map]);
  return null;
}

export default function TaskRoutePage() {
  const { pickupId } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const [pickup, setPickup] = useState(routerLocation.state?.pickup || null);
  const [loading, setLoading] = useState(!pickup);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  // Fetch pickup if not passed via router state
  useEffect(() => {
    if (pickup) return;
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

  const handleStartCollection = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      await api.post(`/pickups/${pickupId}/status`, { status: "EN_ROUTE" });
      navigate(`/task-flow/${pickupId}`, { replace: true, state: { pickup } });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start collection");
      setStarting(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-primary/60">
            <Spinner />
            <p className="text-sm font-medium">Loading task details…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error / not found ───────────────────────────────────────────────────
  if (!pickup) {
    return (
      <div className="app-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-primary font-semibold text-lg">
            {error || "Pickup not found."}
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

  const loc = pickup.location || {};
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const hasCoords = !isNaN(lat) && !isNaN(lng);
  const mapCenter = hasCoords ? [lat, lng] : [27.7172, 85.324];

  const category = pickup.category || "non-recyclable";
  const level = pickup.level || "easy";

  return (
    <div className="app-bg min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-primary">
              Task Route
            </h1>
            <div className="mt-2 h-[3px] w-40 bg-[var(--accent)] rounded-full" />
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

        {/* Task details card */}
        <div className="bg-white rounded-3xl border border-primary/15 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-primary/15 bg-[var(--accent)] flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary/70">
                PICKUP DETAILS
              </p>
              <p className="text-sm text-primary/60 mt-1">
                Review the route then start collection.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-primary/70">REQUEST ID</p>
              <p className="text-sm font-bold text-primary font-mono">
                {pickup.id?.toString().slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-6">
            <DetailTile label="WASTE CATEGORY" value={category.toUpperCase()} accent />
            <DetailTile label="DIFFICULTY" value={level.toUpperCase()} />
            <DetailTile
              label="LOCATION"
              value={loc.address || (hasCoords ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "—")}
            />
          </div>

          {/* Driver info */}
          {pickup.driverInfo && (
            <div className="border-t border-primary/10 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <DetailTile label="DRIVER" value={pickup.driverInfo.name || "—"} />
              <DetailTile label="VEHICLE" value={pickup.driverInfo.licensePlate || "—"} />
              <DetailTile label="STATUS" value={pickup.status} accent />
              <DetailTile
                label="ASSIGNED AT"
                value={pickup.assignedAt ? new Date(pickup.assignedAt).toLocaleTimeString() : "—"}
              />
            </div>
          )}
        </div>

        {/* Map + Start button */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-primary/15 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 flex items-center gap-2">
              <MapPinIcon />
              <span className="text-white text-sm font-semibold">PICKUP LOCATION</span>
            </div>
            <div className="h-[350px] sm:h-[400px]">
              {hasCoords ? (
                <MapContainer
                  center={mapCenter}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <ChangeView center={mapCenter} />
                  <Marker position={mapCenter} />
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center text-primary/50">
                    <MapPinLargeIcon />
                    <p className="mt-2 text-sm font-medium">No coordinates available</p>
                  </div>
                </div>
              )}
            </div>
            {hasCoords && (
              <div className="px-5 py-3 border-t border-primary/10 bg-gray-50/50">
                <p className="text-xs text-primary/60 font-medium">
                  📍 {loc.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                </p>
              </div>
            )}
          </div>

          {/* Action panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-primary/15 shadow-sm p-6">
              <p className="text-sm font-semibold text-primary mb-4">
                TASK STATUS
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-white">
                  {pickup.status}
                </span>
              </div>

              <div className="space-y-3">
                <StepIndicator step={1} label="Review Route" active done />
                <StepIndicator step={2} label="Start Collection" active={false} />
                <StepIndicator step={3} label="Complete Pickup" active={false} />
              </div>
            </div>

            <button
              onClick={handleStartCollection}
              disabled={starting}
              className={`w-full py-4 rounded-2xl font-semibold text-lg transition shadow-sm ${starting
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-primary text-white hover:opacity-95 active:scale-[0.98]"
                }`}
            >
              {starting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Starting…
                </span>
              ) : (
                "START COLLECTION →"
              )}
            </button>

            <button
              onClick={() => navigate("/driver-dashboard")}
              className="w-full py-3.5 rounded-2xl border-2 border-primary/25 text-primary font-semibold hover:bg-white/60 transition text-sm"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function DetailTile({ label, value, accent }) {
  return (
    <div>
      <p className="text-xs font-semibold text-primary/60">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold ${accent ? "text-[var(--accent)]" : "text-primary"
          }`}
      >
        {value}
      </p>
    </div>
  );
}

function StepIndicator({ step, label, active, done }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done
            ? "bg-[var(--accent)] text-white"
            : active
              ? "bg-primary text-white"
              : "bg-primary/10 text-primary/40"
          }`}
      >
        {done ? "✓" : step}
      </span>
      <span
        className={`text-sm font-medium ${done || active ? "text-primary" : "text-primary/40"
          }`}
      >
        {label}
      </span>
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

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M12 22s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12Z" />
      <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
  );
}

function MapPinLargeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto">
      <path
        d="M12 22s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-300"
      />
      <circle cx="12" cy="10" r="3" fill="currentColor" className="text-gray-300" />
    </svg>
  );
}
