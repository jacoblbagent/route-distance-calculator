import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RouteMap from "./components/RouteMap";
import AddressAutocomplete from "./components/AddressAutocomplete";
import { reverseGeocode, route, type LatLng, type RouteResult } from "./lib/geo";

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
  // Which field the map click targets: null = destination, 0..2 = departure index.
  const [activeField, setActiveFieldState] = useState<number | null>(null);
  const activeFieldRef = useRef<number | null>(null);
  const [results, setResults] = useState<(RouteResult | null)[]>(Array(DEPARTURE_COUNT).fill(null));
  const [error, setError] = useState<string | null>(null);

  // Mirror activeField into a ref so the map-click handler (registered once) sees the latest value.
  const setActiveField = (v: number | null) => {
    activeFieldRef.current = v;
    setActiveFieldState(v);
  };

  const setDeparture = (i: number, value: string) =>
    setDepartures((prev) => prev.map((d, idx) => (idx === i ? { value, coords: null } : d)));

  const setDepartureCoords = (i: number, value: string, coords: LatLng) =>
    setDepartures((prev) => prev.map((d, idx) => (idx === i ? { value, coords } : d)));

  // Slots that actually have a computed route (aligned by departure index).
  const resultEntries = useMemo(
    () =>
      departures
        .map((_, i) => ({ i, r: results[i] }))
        .filter((x): x is { i: number; r: RouteResult } => !!x.r),
    [departures, results]
  );
  const totalKm = useMemo(() => resultEntries.reduce((s, x) => s + x.r.distanceKm, 0), [resultEntries]);
  const totalMin = useMemo(() => resultEntries.reduce((s, x) => s + x.r.durationMin, 0), [resultEntries]);

  // Map click -> set the active field (reverse-geocoded), defaulting to destination.
  const handleMapPick = useCallback(async (lat: number, lng: number) => {
    setError(null);
    const coords: LatLng = { lat, lng };
    let label: string;
    try {
      label = await reverseGeocode(coords);
    } catch {
      label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    const target = activeFieldRef.current;
    if (target === null) {
      setDestination({ value: label, coords });
    } else {
      setDepartureCoords(target, label, coords);
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

  // Live routing: recompute whenever destination/departures change.
  const coordsKey = useMemo(
    () => JSON.stringify({ destination, departures }),
    [destination, departures]
  );

  useEffect(() => {
    let cancelled = false;
    const dest = destination.coords;
    const next: (RouteResult | null)[] = Array(DEPARTURE_COUNT).fill(null);
    if (!dest) {
      setResults(next);
      return;
    }
    const slots = departures
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.coords);
    if (slots.length === 0) {
      setResults(next);
      return;
    }
    void (async () => {
      try {
        const routes = await Promise.all(slots.map(({ d }) => route(d.coords!, dest)));
        if (cancelled) return;
        routes.forEach((r, k) => {
          const s = slots[k];
          next[s.i] = {
            ...r,
            from: s.d.coords!,
            to: dest,
            originAddress: s.d.value,
            destAddress: destination.value.trim(),
          };
        });
        setResults(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't calculate routes.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coordsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const determine = (lng: number) =>
    lng >= 0 ? `E ${lng.toFixed(4)}°` : `W ${((-lng)).toFixed(4)}°`;
  const formatCoord = (p: LatLng) => `${p.lat.toFixed(4)}°N, ${determine(p.lng)}`;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="title">Route Distance Calculator</h1>
        <p className="subtitle">Distance &amp; ETA from each departure to the destination.</p>

        <div className="pick-status">
          Click map to set: <b>{activeField === null ? "Destination" : `Departure ${activeField + 1}`}</b>
        </div>

        <label className="field">
          <span className="field__label">Destination</span>
          <AddressAutocomplete
            value={destination.value}
            onChange={(v) => setDestination({ value: v, coords: null })}
            onSelect={(v, c) => setDestination({ value: v, coords: c })}
            onFocus={() => setActiveField(null)}
            active={activeField === null}
            placeholder="e.g. Asheville, NC"
          />
          <span className="hint">Tip: focus a field, then click the map to set that address.</span>
        </label>

        <div className="departures">
          {departures.map((d, i) => (
            <label className="field" key={i}>
              <span className="field__label">
                <i className="dot" style={{ background: DEPARTURE_COLORS[i] }} />
                Departure {i + 1}
              </span>
              <AddressAutocomplete
                value={d.value}
                onChange={(v) => setDeparture(i, v)}
                onSelect={(v, c) => setDepartureCoords(i, v, c)}
                onFocus={() => setActiveField(i)}
                active={activeField === i}
                placeholder="Starting address"
              />
            </label>
          ))}
        </div>

        {error && <div className="error">{error}</div>}

        {resultEntries.length > 0 && (
          <div className="results">
            <h2>Results</h2>
            <ul>
              {resultEntries.map(({ i, r }) => (
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
          routes={resultEntries.map(({ i, r }) => ({
            geometry: r.geometry,
            color: DEPARTURE_COLORS[i],
            index: i,
          }))}
        />
      </main>
    </div>
  );
}