// Distance / "nearby" helpers shared by the appointment and chat directories.
// ---------------------------------------------------------------------------
// "Nearby" used to be a fake search keyword (`counselor.location ? 'nearby' : ''`)
// that matched any professional with any location string, so it never had
// anything to do with where the user actually was. These helpers do it properly,
// from the coordinates both sides already store:
//
//   user         -> getCachedLocationSummary().coordinates   (locationHelper)
//   professional -> locationData.current.coordinates          (/api/auth/counsellors)
//
// Both arrive as GeoJSON [longitude, latitude], so every read goes through
// toCoords() rather than assuming an order.
// ---------------------------------------------------------------------------

export const NEARBY_RADIUS_KM = 25;

const isFiniteNumber = (value) => Number.isFinite(Number(value));

/** Normalises any coordinate shape to { latitude, longitude }, or null. */
export const toCoords = (value) => {
  if (!value) return null;
  // GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
  if (Array.isArray(value?.coordinates)) return toCoords(value.coordinates);
  // Raw GeoJSON pair: [lng, lat]
  if (Array.isArray(value)) {
    const [lng, lat] = value;
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
    return { latitude: Number(lat), longitude: Number(lng) };
  }
  const latitude = value.latitude ?? value.lat;
  const longitude = value.longitude ?? value.lng ?? value.lon;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
};

/** Coordinates for a professional from the directory payload. */
export const getProfessionalCoords = (professional) =>
  toCoords(professional?.locationData?.current?.coordinates) ||
  toCoords(professional?.locationData?.current) ||
  toCoords(professional?.coordinates) ||
  toCoords(professional?.location?.coordinates) ||
  toCoords(professional);

/** Coordinates for the signed-in user from the cached location summary. */
export const getUserCoords = (summary) =>
  toCoords(summary?.coordinates) || toCoords(summary?.current?.coordinates) || toCoords(summary);

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in km, or null when either side has no coordinates. */
export const distanceKm = (from, to) => {
  const a = toCoords(from);
  const b = toCoords(to);
  if (!a || !b) return null;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Distance between the user and one professional, in km (null if unknown). */
export const getDistanceToProfessional = (userCoords, professional) =>
  distanceKm(userCoords, getProfessionalCoords(professional));

/** "450 m" / "1.2 km" / "18 km" — short enough for a badge. */
export const formatDistance = (km) => {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

/** Within the radius. Unknown distance is never treated as nearby. */
export const isNearby = (km, radiusKm = NEARBY_RADIUS_KM) =>
  km != null && Number.isFinite(km) && km <= radiusKm;

export default {
  NEARBY_RADIUS_KM,
  toCoords,
  getProfessionalCoords,
  getUserCoords,
  distanceKm,
  getDistanceToProfessional,
  formatDistance,
  isNearby,
};
