---
name: ES6 Module Architecture
description: How AgriAdapt's 13 ES6 modules wire together and expose functions to HTML inline handlers.
---

## Rule
All modules live under `js/`. Cross-module calls use `window.functionName()` instead of direct imports, to avoid circular dependencies. `js/main.js` assigns every exported function to `window` via `Object.assign(window, { ... })` after importing all modules.

**Why:** The original codebase has ~20 functions called from HTML `onclick=""` attributes and another ~15 called cross-module. ES6 modules can't be imported from inline handlers. The window-assignment pattern in main.js is the single source of truth for what's globally callable.

**How to apply:** Whenever you add a new function that needs to be called from HTML or from another module without a direct import, export it from its module and add it to the `Object.assign(window, {...})` block in `js/main.js`.

## Module map
| Module | Responsibility |
|--------|---------------|
| constants.js | Pure constants (CROP_DATA, KIREHE_SECTORS, SHAP, etc.) |
| state.js | Single shared mutable object — all global state lives here |
| api.js | All fetch() calls to /api/* endpoints |
| wrsi.js | WRSI engine: getInp(), computeBaselineWRSI(), computeOptimizedWRSI(), computeSPI() |
| ui.js | tab(), update(), DOM helpers, SHAP, narrator, recs, ROI calls |
| members.js | fillLedger(), renderLedger(), addMember(), removeMember(), registerMember() |
| map.js | initLeafletMap(), shapefile upload, GeoJSON study area tools |
| spectral.js | GeoTIFF band loading, NDVI/NDWI/SPI interpretation, NASA GIBS, GEE fetch |
| monitor.js | 15s auto-monitor cycle, startAutoMonitor(), stopAutoMonitor() |
| finance.js | renderAnalysisHub(), renderExportHub(), exportAnalysisFull(), generateIndividualReport() |
| simulation.js | toggleSim() — season auto-play |
| geotiff-worker.js | Web Worker — pixel-level band processing (zero-copy buffer transfer) |
| main.js | Entry point: imports all, assigns to window, bootstraps onload |
