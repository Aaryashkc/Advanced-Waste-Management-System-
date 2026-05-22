function toFiniteNumber(value) {
  if (value == null) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function validateCoordinates(latitude, longitude, options = {}) {
  const {
    latitudeLabel = "latitude",
    longitudeLabel = "longitude",
  } = options;

  if (latitude == null || longitude == null) {
    return {
      ok: false,
      message: `${latitudeLabel} and ${longitudeLabel} are required`,
    };
  }

  const normalizedLatitude = toFiniteNumber(latitude);
  const normalizedLongitude = toFiniteNumber(longitude);

  if (normalizedLatitude == null || normalizedLongitude == null) {
    return {
      ok: false,
      message: `${latitudeLabel} and ${longitudeLabel} must be finite numbers`,
    };
  }

  if (normalizedLatitude < -90 || normalizedLatitude > 90) {
    return {
      ok: false,
      message: `${latitudeLabel} must be between -90 and 90`,
    };
  }

  if (normalizedLongitude < -180 || normalizedLongitude > 180) {
    return {
      ok: false,
      message: `${longitudeLabel} must be between -180 and 180`,
    };
  }

  return {
    ok: true,
    coordinates: {
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
    },
  };
}
