import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Reverse geocode using Nominatim
const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
};

// Component to handle map clicks
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      onLocationSelect({ latitude: lat, longitude: lng, address });
    },
  });
  return null;
};

// Component to recenter map
const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
};

const LocationPickerMap = ({
  value = { latitude: null, longitude: null, address: "" },
  onChange,
  height = "300px",
  placeholder = "Search for a location...",
  label = "Location",
  required = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mapCenter, setMapCenter] = useState(
    value.latitude && value.longitude
      ? [value.latitude, value.longitude]
      : [27.7172, 85.324] // Default: Kathmandu
  );
  const [mapZoom, setMapZoom] = useState(value.latitude ? 15 : 12);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search with debounce
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=np&limit=6&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setSearchResults(data);
        setShowResults(data.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleSelectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;
    setMapCenter([lat, lng]);
    setMapZoom(16);
    setSearchQuery(address);
    setShowResults(false);
    setSearchResults([]);
    onChange({ latitude: lat, longitude: lng, address });
  };

  const handleMapClick = (location) => {
    setMapCenter([location.latitude, location.longitude]);
    setSearchQuery(location.address);
    onChange(location);
  };

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    onChange({ latitude: null, longitude: null, address: "" });
    setMapCenter([27.7172, 85.324]);
    setMapZoom(12);
  };

  const hasLocation = value.latitude && value.longitude;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-primary/60">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      {/* Search Bar */}
      <div className="relative" ref={searchRef}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
          />
          {(searchQuery || hasLocation) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary/40 hover:bg-primary/20 hover:text-primary/60 transition"
            >
              <span className="text-xs leading-none">&times;</span>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute z-1000 w-full mt-1 bg-white rounded-xl border border-primary/10 shadow-lg max-h-52 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectResult(r)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/5 transition-colors border-b border-primary/5 last:border-0 flex items-start gap-2"
              >
                <svg
                  className="w-4 h-4 text-primary/30 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-primary/70 line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Searching indicator */}
        {searching && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-primary/10 shadow-sm" style={{ height }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ChangeView center={mapCenter} zoom={mapZoom} />
          <MapClickHandler onLocationSelect={handleMapClick} />
          {hasLocation && (
            <Marker position={[value.latitude, value.longitude]} icon={greenIcon} />
          )}
        </MapContainer>
      </div>

      {/* Selected Location Info */}
      {hasLocation && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <svg
            className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">Location Selected</p>
            <p className="text-xs text-emerald-600 truncate">{value.address}</p>
            <p className="text-[10px] text-emerald-500 mt-0.5">
              {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
            </p>
          </div>
        </div>
      )}

      {/* Hint */}
      {!hasLocation && (
        <p className="text-xs text-primary/40 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Search or click on the map to set location
        </p>
      )}
    </div>
  );
};

export default LocationPickerMap;
