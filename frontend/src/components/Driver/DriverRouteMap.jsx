import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MapContainer, TileLayer, Marker, Polyline, useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Maximize2, Minimize2, Navigation, Loader2, AlertCircle } from "lucide-react";
import api from "../../utils/api";
import { themeColor } from "../../utils/themeColors";

// Fix default Leaflet marker icon in bundled envs
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:var(--app-info);border:3px solid var(--app-white);box-shadow:0 0 0 2px var(--app-info);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const destIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--app-danger-strong);border:3px solid var(--app-white);box-shadow:0 2px 6px rgb(0 0 0 / .3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Live driving map for drivers.
 * Props:
 *  - destination: { latitude, longitude, address? }
 *  - mode: "mini" | "full" | "inline"
 *  - onExpand / onCollapse: optional toggle handlers
 */
export default function DriverRouteMap({ destination, mode = "inline", onExpand, onCollapse }) {
  const [driverPos, setDriverPos] = useState(null); // [lat, lng]
  const [route, setRoute] = useState(null); // { distanceKm, durationMinutes, geometry, fallback }
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef({ pos: null, ts: 0 });

  const dest = useMemo(() => {
    if (!destination) return null;
    const lat = Number(destination.latitude);
    const lng = Number(destination.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return [lat, lng];
  }, [destination]);

  // Watch driver position
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverPos([pos.coords.latitude, pos.coords.longitude]);
        setError(null);
      },
      (err) => setError(err.message || "Unable to get location"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const fetchRoute = useCallback(async (origin, target) => {
    setRouteLoading(true);
    try {
      const res = await api.post("/pickups/route", {
        originLat: origin[0], originLng: origin[1],
        destLat: target[0], destLng: target[1],
      });
      setRoute(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch route");
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // Re-fetch route when driver moves >150m or every 60s
  useEffect(() => {
    if (!driverPos || !dest) return;
    const now = Date.now();
    const last = lastFetchRef.current;
    const movedKm = last.pos ? haversineKm(last.pos, driverPos) : Infinity;
    if (movedKm > 0.15 || now - last.ts > 60_000) {
      lastFetchRef.current = { pos: driverPos, ts: now };
      fetchRoute(driverPos, dest);
    }
  }, [driverPos, dest, fetchRoute]);

  const positions = useMemo(() => {
    if (!route?.geometry) return null;
    return route.geometry.map(([lng, lat]) => [lat, lng]);
  }, [route]);

  const bounds = useMemo(() => {
    if (driverPos && dest) return [driverPos, dest];
    return null;
  }, [driverPos, dest]);

  const center = driverPos || dest || [27.7172, 85.324];

  const isFull = mode === "full";
  const heightClass = mode === "mini" ? "h-44" : isFull ? "h-screen" : "h-96 sm:h-[28rem]";

  const mapBlock = (
    <div className={`relative w-full ${heightClass}`}>
      {dest ? (
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={!isFull ? mode !== "mini" : true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {bounds && <FitBounds bounds={bounds} />}
          <Marker position={dest} icon={destIcon} />
          {driverPos && <Marker position={driverPos} icon={driverIcon} />}
          {positions && (
            <Polyline positions={positions} color={themeColor("info")} weight={5} opacity={0.85} />
          )}
        </MapContainer>
      ) : (
        <div className="h-full flex items-center justify-center bg-gray-100 text-primary font-medium text-sm">
          No destination coordinates
        </div>
      )}

      {/* Route info overlay */}
      {route && (
        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur rounded-xl shadow-md border-2 border-primary/20 px-3 py-2 flex items-center gap-2">
          <Navigation size={14} className="text-blue-700" />
          <div className="leading-tight">
            <p className="text-xs font-extrabold text-brand-ink-strong">
              {route.distanceKm?.toFixed(2)} km
            </p>
            <p className="text-[10px] font-semibold text-primary">
              ~{Math.ceil(route.durationMinutes || 0)} min
              {route.fallback && " • approx"}
            </p>
          </div>
        </div>
      )}

      {/* Status / loading / error */}
      {(routeLoading || error) && (
        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur rounded-lg shadow border border-primary/20 px-2.5 py-1.5 flex items-center gap-1.5">
          {routeLoading ? (
            <>
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="text-[10px] font-bold text-primary">Updating route…</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} className="text-red-700" />
              <span className="text-[10px] font-bold text-red-800">{error}</span>
            </>
          )}
        </div>
      )}

      {/* Expand/collapse button */}
      {(onExpand || onCollapse) && (
        <button
          onClick={isFull ? onCollapse : onExpand}
          className="absolute top-2 right-2 bg-white border-2 border-primary/30 text-primary hover:bg-primary hover:text-white transition rounded-lg p-2 shadow-md"
          aria-label={isFull ? "Collapse map" : "Expand map"}
        >
          {isFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      )}
    </div>
  );

  if (isFull) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/60 flex flex-col">
        <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
          <p className="font-extrabold">Live Navigation</p>
          <button
            onClick={onCollapse}
            className="px-3 py-1.5 rounded-lg bg-white text-primary font-bold text-sm flex items-center gap-1.5"
          >
            <Minimize2 size={14} /> Close
          </button>
        </div>
        <div className="flex-1">{mapBlock}</div>
      </div>
    );
  }

  return mapBlock;
}
