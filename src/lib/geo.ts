// Geocoding (address -> lat/lng) via Nominatim, routing (distance/duration + geometry)
// via OSRM. Both free, keyless, and CORS-enabled.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  from: LatLng;
  to: LatLng;
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][]; // GeoJSON coordinate pairs [lng, lat]
  originAddress: string;
  destAddress: string;
}

export interface AddressSuggestion {
  value: string; // display name
  coords: LatLng;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

async function getJSON(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** Resolve a human address to coordinates via Nominatim. Returns null if not found. */
export async function geocode(address: string): Promise<LatLng | null> {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const data = await getJSON(url);
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

/** Search addresses matching `query` via Nominatim. Returns up to `limit` suggestions. */
export async function searchAddresses(query: string, limit = 6): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${NOMINATIM}?format=json&limit=${limit}&q=${encodeURIComponent(q)}`;
  const data = await getJSON(url);
  if (!Array.isArray(data)) return [];
  return data
    .filter((d) => d && d.lat && d.lon && d.display_name)
    .map((d) => ({
      value: d.display_name as string,
      coords: { lat: parseFloat(d.lat), lng: parseFloat(d.lon) },
    }));
}

/**
 * Get driving route from -> to via OSRM. Returns distance (km), duration (min)
 * and the full route polyline geometry as [lat, lng] pairs (for Leaflet).
 */
export async function route(
  from: LatLng,
  to: LatLng
): Promise<{ distanceKm: number; durationMin: number; geometry: [number, number][] }> {
  const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const data = await getJSON(url);
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error("No route found between the selected points.");
  }
  const r = data.routes[0];
  const coords: [number, number][] = (r.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
  return {
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    geometry: coords,
  };
}

/** Reverse-geocode coordinates to a display address via Nominatim. */
export async function reverseGeocode(p: LatLng): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lng}`;
  const data = await getJSON(url);
  return data.display_name ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

export function isLatLng(p: unknown): p is LatLng {
  return !!p && typeof (p as LatLng).lat === "number" && typeof (p as LatLng).lng === "number";
}