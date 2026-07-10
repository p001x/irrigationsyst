# AgriAdapt

Climate-resilient agriculture dashboard for Kirehe District, Rwanda. Monitors crop health, water stress, and district-level resilience using satellite data.

## Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework)
- **Backend**: Node.js + Express 5
- **Database**: PostgreSQL (Replit managed)
- **Geospatial**: Leaflet.js, Turf.js, Leaflet-Geoman, GeoTIFF.js
- **Earth Engine**: `@google/earthengine` SDK authenticated via service account

## How to run

```
npm start
```

Starts the Express server on port 5000. The frontend is served as static files from the project root.

## Key files

- `server.js` — Express API + static file server
- `index.html` — Main dashboard (Monitoring & Grid, WRSI Prediction, Member Analysis, etc.)
- `dashboard.html` — Secondary dashboard view
- `app.html` — App entry (alternative)
- `js/` — Frontend modules (main.js, map.js, members.js, monitor.js, finance.js, spectral.js, state.js, ui.js, wrsi.js, simulation.js, api.js, constants.js, geotiff-worker.js)
- `service-account.json` — Google Earth Engine service account credentials

## Environment

- `SESSION_SECRET` — Admin gate secret for the bulk-delete API route (`X-Admin-Key` header)
- `DATABASE_URL` — Managed automatically by Replit (PostgreSQL)

## Architecture notes

- JS modules use ES6 `import`/`export` syntax; `main.js` assigns exports to `window.*` so cross-module calls use `window.xxx()`
- GeoTIFF typed arrays must be `.slice()`'d before `postMessage` transfer to preserve band state for repeat runs
- The `/api/members` CRUD endpoints back the Member Analysis Hub
- The `/api/finance` endpoint runs financial calculations server-side
- Earth Engine is initialized at startup via the service account in `service-account.json`

## User preferences

(none yet)
