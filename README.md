# Route Distance Calculator

Enter a **Destination** and up to **3 Departure** addresses — instantly get the driving distance and travel time (ETA) for each route, drawn on an interactive map.

**🔗 Live demo:** https://jacoblbagent.github.io/route-distance-calculator/

## Features

- 📍 Destination + 3 Departure address inputs
- 🗺️ **Real driving routes** drawn on a Leaflet map (CARTO tiles), auto-fitted to fit all routes
- ⏱️ Per-route **distance (km)** and **travel time**, color-coded to match each departure's marker
- ➕ Running **totals** across all routes
- 🖱️ **Click anywhere on the map** to set the destination directly
- 🚦 Two departure pins with distinct colors; destination shown as a grey "D" pin

## Tech Stack

- **React 19 + Vite + TypeScript**
- **Leaflet** with CARTO basemaps
- Free, keyless APIs: **Nominatim** (geocoding + reverse-geocoding) and **OSRM** (driving distance/duration + route geometry)

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build / Deploy

```bash
npm run build      # outputs to dist/, base set to /route-distance-calculator/
```

GitHub Pages is configured to serve the `/docs` folder on `main`. To redeploy:

```bash
npm run build && rm -rf docs && cp -r dist docs
git add -A && git commit -m "update" && git push
```

## Project Structure

```
src/
  App.tsx              # Inputs, geocoding/routing orchestration, results
  components/RouteMap.tsx  # Leaflet map + markers + polylines
  lib/geo.ts           # Nominatim + OSRM logic
```