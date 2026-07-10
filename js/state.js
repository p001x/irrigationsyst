// AgriAdapt — Shared Mutable State
// All modules import and mutate this single object to avoid circular dependencies.
export const state = {
  // Member data
  GLOBAL_MEMBERS:    [],
  LAST_KPI_STATE:    { wrsi: 0 },
  // Auto-monitor
  _autoMonitorTimer:   null,
  _autoMonitorRunning: false,
  // Leaflet map
  map:                null,
  shpLayer:           null,
  currentStudyLayer:  null,
  lastStudyHa:        0,
  lastStudySector:    '',
  // Spectral / GeoTIFF
  bandRed:            null,
  bandNIR:            null,
  bandGreen:          null,
  spectralOverlay:    null,
  ndviWMSLayer:       null,
  lastActiveArea:     null,
  currentSpectralContext: 'sim',
  isSpectralManual:   false,
  // Season simulation
  simRunning:  false,
  simInterval: null,
  // UI
  isUserDraggingPH: false,
};
