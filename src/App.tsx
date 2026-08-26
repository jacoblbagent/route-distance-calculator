import { useCallback, useEffect, useMemo, useState } from "react";
import RouteMap from "./components/RouteMap";
import { geocode, reverseGeocode, route, type LatLng, type RouteResult } from "./lib/geo";

const DEPARTURE_COLORS = ["#e11d48", "#2563eb", "#16a34a"];
const DEPARTURE_COUNT = 3;

interface AddressState {
  value: string;
  coords: LatLng | null;
}

function emptyDepartures(): AddressState[] {
  return Array.from({ length: DEPARTURE_COUNT }, () => ({ value: "", coords: null }));
}

export default function App() {
  const [destination, setDestination] = useState<AddressState>({ value: "", coords: null });
  const [departures, setDepartures] = useState<AddressState[]>(emptyDepartures);
  const [results, setResults] = useState<RouteResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFilled = destination.value.trim() !== "" && departures.every((d) => d.value.trim() !== "");

  // Result summary shown in the sidebar.
  const totalKm = useMemo(
    () => (results ? results.reduce((s, r) => s + r.distanceKm, 0) : 0),
    [results]
  );
  const totalMin = useMemo(
    () => (results ? results.reduce((s, r) => s + r.durationMin, 0) : 0),
    [results]
  );

  // Map click -> set destination via reverse geocode.
  const handleMapPick = useCallback(async (lat: number, lng: number) => {
    setBusy(true);
    setError(null);
    try {
      const label = await reverseGeocode({ lat, lng });
      setDestination({ value: label, coords: { lat, lng } });
    } catch {
      setDestination({ value: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, coords: { lat, lng } });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const fn = (e: Event) => {
      const d = (e as CustomEvent).detail as { lat: number; lng: number };
      void handleMapPick(d.lat, d.lng);
    };
    window.addEventListener("route-map-pick", fn);
    return () => window.removeEventListener("route-map-pick", fn);
  }, [handleMapPick]);

  const setDeparture = (i: number, value: string) =>
    setDepartures((prev) => prev.map((d, idx) => (idx === i ? { ...d, value } : d)));

  const handleCalculate = async () => {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      // Geocode destination...
      const destCoords = destination.coords ?? (await geocode(destination.value.trim()));
      if (!destCoords) throw new Error(`Couldn't find the destination "${destination.value}".`);

      // Geocode each departure...
      const geocoded: { state: AddressState; coords: LatLng }[] = [];
      for (let i = 0; i < departures.length; i++) {
        const d = departures[i];
        const coords = d.coords ?? (await geocode(d.value.trim()));
        if (!coords) throw new Error(`Couldn't find departure ${i + 1} ("${d.value}").`);
        geocoded.push({ state: d, coords });
      }

      // Route each departure -> destination (in parallel).
      const routes = await Promise.all(
        geocoded.map(({ coords }) => route(coords, destCoords))
      );

      setDestination((prev) => ({ ...prev, coords: destCoords }));
      setDepartures((prev) => prev.map((d, i) => ({ ...d, coords: geocoded[i].coords })));
      setResults(
        routes.map((r, i) => ({
          ...r,
          from: geocoded[i].coords,
          to: destCoords,
          originAddress: geocoded[i].state.value,
          destAddress: destination.value.trim(),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const determine = (lng: number) =>
    lng >= 0 ? `E ${lng.toFixed(4)}°` : `W ${((-lng)).toFixed(4)}°`;
  const formatCoord = (p: LatLng) => `${p.lat.toFixed(4)}°N, ${determine(p.lng)}`;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="title">Route Distance Calculator</h1>
        <p className="subtitle">Distance &amp; ETA from each departure to the destination.</p>

        <label className="field">
          <span className="field__label">Destination</span>
          <input
            value={destination.value}
            onChange={(e) => setDestination({ ...destination, value: e.target.value })}
            placeholder="e.g. Asheville, NC"
          />
          <span className="hint">Tip: click anywhere on the map to set it.</span>
        </label>

        <div className="departures">
          {departures.map((d, i) => (
            <label className="field" key={i}>
              <span className="field__label">
                <i className="dot" style={{ background: DEPARTURE_COLORS[i] }} />
                Departure {i + 1}
              </span>
              <input
                value={d.value}
                onChange={(e) => setDeparture(i, e.target.value)}
                placeholder="Starting address"
              />
            </label>
          ))}
        </div>

        {error && <div className="error">{error}</div>}

        <button className="calculate" disabled={!allFilled || busy} onClick={handleCalculate}>
          {busy ? "Calculating…" : "Calculate Distance &amp; Time"}
        </button>

        {results && (
          <div className="results">
            <h2>Results</h2>
            <ul>
              {results.map((r, i) => (
                <li key={i} style={{ borderLeftColor: DEPARTURE_COLORS[i] }}>
                  <div className="results__route">
                    <span className="results__color" style={{ background: DEPARTURE_COLORS[i] }} />
                    <div className="results__text">
                      <strong>Departure {i + 1}</strong> → <span className="muted">Destination</span>
                      <div className="muted small">{r.originAddress}</div>
                    </div>
                  </div>
                  <div className="results__stats">
                    <span className="stat">
                      <b>{r.distanceKm.toFixed(1)}</b> km
                    </span>
                    <span className="stat">
                      <b>{r.durationMin >= 60 ? `${Math.floor(r.durationMin / 60)}h ${Math.round(r.durationMin % 60)}m` : `${Math.round(r.durationMin)}m`}</b> travel
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="total">
              Totals: <b>{totalKm.toFixed(1)} km</b> ·{" "}
              <b>{totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${Math.round(totalMin % 60)}m` : `${Math.round(totalMin)}m`}</b>
            </div>
            {destination.coords && (
              <div className="coords">
                Destination: <b>{formatCoord(destination.coords)}</b>
              </div>
            )}
          </div>
        )}
      </aside>

      <main className="map-wrap">
        <RouteMap
          destination={destination.coords}
          departures={departures.map((d) => d.coords).filter((c): c is LatLng => !!c)}
          routes={
            results
              ? results.map((r, i) => ({
                  geometry: r.geometry,
                  color: DEPARTURE_COLORS[i],
                }))
              : []
          }
        />
      </main>
    </div>
  );
}