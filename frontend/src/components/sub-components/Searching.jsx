import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ThankYouPage from "./ThankYouPage";
import { getSocket } from "../../utils/socket";
import usePickupStore from "../../stores/usePickupStore";

// ── Map helpers ─────────────────────────────────────────────────────────────
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

function MapSearchControl({ onLocationSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        { headers: { "User-Agent": "SafaBin-WasteManagement/1.0" } }
      );
      setSearchResults(await res.json());
    } catch (e) {
      console.error("Address search error:", e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (r) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    onLocationSelect(
      [lat, lon],
      r.display_name || `${r.address?.road || ""}, ${r.address?.city || r.address?.town || ""}`.trim()
    );
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  useEffect(() => {
    if (isOpen && searchRef.current) searchRef.current.focus();
  }, [isOpen]);

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
          title="Search location"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Search location</span>
        </button>
      ) : (
        <div className="w-80 max-h-96 flex flex-col">
          <div className="flex items-center gap-2 p-3 border-b">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search address..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary text-sm"
            />
            <button
              onClick={() => { setIsOpen(false); setSearchQuery(""); setSearchResults([]); }}
              className="p-2 hover:bg-gray-100 rounded transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {searchQuery && (
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="mx-3 mt-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition text-sm font-medium disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          )}
          {searchResults.length > 0 && (
            <div className="overflow-y-auto max-h-64 p-2">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left p-3 hover:bg-gray-100 rounded transition text-sm"
                >
                  <div className="font-medium text-gray-800">{r.display_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Driver Found card ────────────────────────────────────────────────────────
function DriverFoundCard({ driverInfo, assignedAt }) {
  return (
    <div className="bg-white rounded-2xl border border-primary/15 shadow-sm overflow-hidden mt-4">
      <div className="px-5 py-4 bg-[#e8f5e2] border-b border-primary/15 flex items-center gap-3">
        {/* Green checkmark */}
        <span className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">Driver Assigned!</p>
          <p className="text-xs text-primary/70">Your pickup request has been accepted</p>
        </div>
      </div>

      <div className="divide-y divide-primary/10">
        <Row label="DRIVER NAME" value={driverInfo?.name || "—"} highlight />
        <Row label="PHONE" value={driverInfo?.phone || "—"} />
        <Row
          label="VEHICLE"
          value={
            [driverInfo?.vehicleId, driverInfo?.licensePlate].filter(Boolean).join(" · ") || "—"
          }
        />
        <Row
          label="ACCEPTED AT"
          value={assignedAt ? new Date(assignedAt).toLocaleTimeString() : "—"}
        />
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between">
      <span className="text-xs font-semibold tracking-wide text-primary/60">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-primary" : "text-primary/80"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
/**
 * Flow states:
 *  "confirm"   — customer picks location, clicks Confirm
 *  "searching" — pickup request sent; waiting for a driver
 *  "found"     — driver accepted; shows driver info + countdown
 *  "cancelled" — request was cancelled or expired
 *  "thankyou"  — customer clicked Call Driver
 */
function SearchPage() {
  const routerLocation = useLocation();
  const navigate = useNavigate();

  // Metadata from UploadWastePage navigation state
  const { wasteUploadId = null, category = "non-recyclable", level = "easy", province = null, district = null } =
    routerLocation.state || {};

  const { createPickup, cancelPickup, currentPickup, loading } = usePickupStore();

  const [flow, setFlow] = useState("confirm");
  const [pickupId, setPickupId] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [assignedAt, setAssignedAt] = useState(null);

  // Map state
  const [mapCenter, setMapCenter] = useState([27.7172, 85.324]); // Kathmandu
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  const addressLabel = selectedAddress
    ? selectedAddress
    : selectedLocation
      ? `Location: ${selectedLocation[0].toFixed(4)}, ${selectedLocation[1].toFixed(4)}`
      : "Manage waste collection with precision and ease";

  // Countdown after driver is found (60 s to cancel)
  const [secondsLeft, setSecondsLeft] = useState(60);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (flow !== "found") {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    clearInterval(intervalRef.current);
    setSecondsLeft(60);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(intervalRef.current); intervalRef.current = null; return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [flow]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  const [taskStatus, setTaskStatus] = useState(null);

  useEffect(() => {
    const socket = getSocket();

    const onAccepted = (data) => {
      // Only handle events for our own pickup
      if (pickupId && data.id?.toString() !== pickupId?.toString()) return;
      setDriverInfo(data.driverInfo || null);
      setAssignedAt(data.assignedAt || null);
      setFlow("found");
    };

    const onStatus = (data) => {
      if (pickupId && data.id?.toString() !== pickupId?.toString()) return;
      if (data.status === "CANCELLED" || data.status === "EXPIRED") {
        setFlow("cancelled");
      }
    };

    const onStatusUpdate = (data) => {
      if (pickupId && data.id?.toString() !== pickupId?.toString()) return;
      setTaskStatus(data.status);
      if (data.status === "COMPLETED") {
        setFlow("thankyou");
      }
    };

    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:status", onStatus);
    socket.on("pickup:statusUpdate", onStatusUpdate);

    return () => {
      socket.off("pickup:accepted", onAccepted);
      socket.off("pickup:status", onStatus);
      socket.off("pickup:statusUpdate", onStatusUpdate);
    };
  }, [pickupId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedLocation) {
      alert("Please select a location on the map first");
      return;
    }
    setFlow("searching");

    const result = await createPickup(
      {
        latitude: selectedLocation[0],
        longitude: selectedLocation[1],
        address: selectedAddress,
      },
      { wasteUploadId, category, level, province, district }
    );

    if (result.success) {
      setPickupId(result.pickup.id);
    } else {
      alert(result.error || "Failed to create pickup request. Please try again.");
      setFlow("confirm");
    }
  };

  const handleCancelSearching = async () => {
    if (pickupId) await cancelPickup(pickupId);
    setFlow("confirm");
    setPickupId(null);
  };

  const handleCancel = async () => {
    if (pickupId) await cancelPickup(pickupId);
    setFlow("confirm");
    setPickupId(null);
    setDriverInfo(null);
  };

  const handleCallDriver = () => setFlow("thankyou");

  const handleBackToHome = () => {
    setFlow("confirm");
    setSelectedLocation(null);
    setSelectedAddress(null);
    setPickupId(null);
    setDriverInfo(null);
    usePickupStore.getState().resetPickup();
    navigate("/customer-dashboard");
  };

  const handleMapClick = (latlng) => {
    const loc = [latlng.lat, latlng.lng];
    setSelectedLocation(loc);
    setMapCenter(loc);
    setSelectedAddress(null);
  };

  const handleMapSearchSelect = (location, address) => {
    setSelectedLocation(location);
    setMapCenter(location);
    setSelectedAddress(address);
  };

  const canCancel = secondsLeft > 0;

  if (flow === "thankyou") {
    return (
      <ThankYouPage
        driverInfo={driverInfo}
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <div className="app-bg">
      <main className="app-container">
        {/* Map Area */}
        <section className="bg-white rounded-2xl overflow-hidden border border-black/10 shadow-sm">
          <div className="h-[320px] md:h-[360px] w-full bg-black/5 relative">
            <MapSearchControl onLocationSelect={handleMapSearchSelect} />
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
              <ChangeMapView center={mapCenter} zoom={15} />
              {selectedLocation && <Marker position={selectedLocation} />}
              <MapClickHandler onClick={handleMapClick} />
            </MapContainer>
          </div>

          {/* Status Panel */}
          <div className="bg-[#f5f1e8] px-6 sm:px-8 py-6 sm:py-7">

            {/* ── CONFIRM ── */}
            {flow === "confirm" && (
              <>
                <h2 className="text-2xl sm:text-3xl font-semibold text-black mb-1">
                  Set Pickup Location
                </h2>
                <p className="text-[var(--accent)] text-sm mb-5">{addressLabel}</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => navigate(-1)}
                    className="border-2 border-primary text-primary px-8 py-3 rounded-2xl bg-transparent hover:bg-white active:scale-95 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedLocation || loading}
                    className={`px-8 py-3 rounded-2xl transition shadow-sm ${selectedLocation && !loading
                      ? "bg-primary text-white hover:opacity-95 active:scale-95 cursor-pointer"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                      }`}
                  >
                    {loading ? "Creating request…" : "Confirm Location"}
                  </button>
                </div>
              </>
            )}

            {/* ── SEARCHING ── */}
            {flow === "searching" && (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-flex">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-ping" />
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-black">Searching for drivers…</h2>
                </div>
                <p className="text-[var(--accent)] text-sm mb-5">{addressLabel}</p>
                <button
                  onClick={handleCancelSearching}
                  className="border-2 border-primary text-primary px-8 py-3 rounded-2xl bg-transparent hover:bg-white active:scale-95 transition"
                >
                  Cancel Searching
                </button>
              </>
            )}

            {/* ── DRIVER FOUND ── */}
            {flow === "found" && (
              <>
                <div className="flex items-baseline gap-4 mb-1">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-black">DRIVER FOUND</h2>
                  {driverInfo?.licensePlate && (
                    <span className="text-[var(--accent)] text-sm font-medium">
                      {driverInfo.licensePlate}
                    </span>
                  )}
                </div>
                <p className="text-[var(--accent)] text-sm mb-1">Truck is on its way. Be Patient.</p>
                {canCancel && (
                  <p className="text-primary/80 text-sm mb-4">
                    Cancel within{" "}
                    <span className="font-semibold text-primary">
                      {String(secondsLeft).padStart(2, "0")}s
                    </span>
                  </p>
                )}

                {/* Driver info card */}
                <DriverFoundCard driverInfo={driverInfo} assignedAt={assignedAt} />

                <div className="flex gap-4 mt-5">
                  <button
                    onClick={handleCallDriver}
                    className="bg-primary text-white px-8 py-3 rounded-2xl hover:opacity-95 active:scale-95 transition shadow-sm"
                  >
                    Confirm Pickup
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={!canCancel}
                    className={`px-8 py-3 rounded-2xl active:scale-95 transition shadow-sm ${canCancel
                      ? "bg-red-400 text-white hover:bg-red-500 cursor-pointer"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                      }`}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* ── CANCELLED / EXPIRED ── */}
            {flow === "cancelled" && (
              <>
                <h2 className="text-2xl sm:text-3xl font-semibold text-black mb-2">Request Cancelled</h2>
                <p className="text-[var(--accent)] text-sm mb-5">
                  Your pickup request was cancelled or expired. Please try again.
                </p>
                <button
                  onClick={() => { setFlow("confirm"); setPickupId(null); }}
                  className="bg-primary text-white px-8 py-3 rounded-2xl hover:opacity-95 active:scale-95 transition shadow-sm"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default SearchPage;