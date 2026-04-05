import { Config } from '../config';

/** Decodes Google Directions `overview_polyline` into `{ latitude, longitude }[]`. */
export function decodeGooglePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const coords = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

/**
 * Driving directions path between two points (Jordan region bias).
 *
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ latitude: number, longitude: number }} destination
 * @param {{ apiKey?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ coordinates: { latitude: number, longitude: number }[], legMetrics: { km: number, minutes: number } | null } | null>}
 */
export async function fetchDirectionsCoordinates(origin, destination, opts = {}) {
  const apiKey = opts.apiKey ?? Config.googleMapsApiKey;
  if (!apiKey) return null;
  if (
    origin?.latitude == null ||
    origin?.longitude == null ||
    destination?.latitude == null ||
    destination?.longitude == null
  ) {
    return null;
  }
  const o = `${origin.latitude},${origin.longitude}`;
  const d = `${destination.latitude},${destination.longitude}`;
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}` +
    `&mode=driving&region=jo&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, { signal: opts.signal });
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.[0]?.overview_polyline?.points) {
      return null;
    }
    const decoded = decodeGooglePolyline(data.routes[0].overview_polyline.points);
    if (decoded.length < 2) return null;
    const leg = data.routes[0].legs?.[0];
    let legMetrics = null;
    if (leg?.distance?.value != null && leg?.duration?.value != null) {
      legMetrics = {
        km: leg.distance.value / 1000,
        minutes: Math.round(leg.duration.value / 60),
      };
    }
    return { coordinates: decoded, legMetrics };
  } catch {
    return null;
  }
}
