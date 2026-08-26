import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "../lib/geo";

const DEPARTURE_COLORS = ["#e11d48", "#2563eb", "#16a34a"];

interface RouteMapProps {
  destination: LatLng | null;
  departures: LatLng[]; // aligned with DEPARTURE_COLORS
  routes: { geometry: [number, number][]; color: string }[];
}

export default function RouteMap({ destination, departures, routes }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true });
    // OSM standard tiles: keyless, but OSM's tile policy requires a Referer.
    // referrerPolicy:'origin' sends the site origin so tiles load in a normal
    // browser (CARTO's old keyless CDN now needs an API key).
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      subdomains: "abc",
      referrerPolicy: "origin",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.setView([39.8283, -98.5795], 4); // US overview
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Re-draw all markers/lines when data changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const pts: L.LatLng[] = [];

    const destIcon = L.divIcon({
      className: "",
      html: `<div class="route-pin route-pin--dest">D</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const depIcon = (i: number) =>
      L.divIcon({
        className: "",
        html: `<div class="route-pin route-pin--dep" style="--dep:${DEPARTURE_COLORS[i]}">${i + 1}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

    // Routes first (under markers).
    routes.forEach((r, i) => {
      const line = L.polyline(r.geometry as L.LatLngExpression[], {
        color: r.color,
        weight: 4,
        opacity: 0.85,
      }).addTo(layer);
      line.bindTooltip(`Departure ${i + 1}`, { direction: "top" });
      (r.geometry as [number, number][]).forEach((p) => pts.push(L.latLng(p[0], p[1])));
    });

    departures.forEach((p, i) => {
      if (!p) return;
      L.marker([p.lat, p.lng], { icon: depIcon(i) }).addTo(layer);
      pts.push(L.latLng(p.lat, p.lng));
    });

    if (destination) {
      L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(layer);
      pts.push(L.latLng(destination.lat, destination.lng));
    }

    if (pts.length > 0) map.fitBounds(L.latLngBounds(pts).pad(0.15));
  }, [destination, departures, routes]);

  // Map click -> fire a callback through a ref so we can add a click handler without
  // recreating the listener. (Handled by onMapPick below via custom event.)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      window.dispatchEvent(
        new CustomEvent("route-map-pick", { detail: { lat: e.latlng.lat, lng: e.latlng.lng } })
      );
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, []);

  return <div className="route-map" ref={containerRef} />;
}