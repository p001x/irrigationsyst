// AgriAdapt — ES6 Module Entry Point
// Imports all modules and wires them to window for HTML inline handlers.

import { state }                             from './state.js';
import { getInp, computeBaselineWRSI, computeOptimizedWRSI, computeSPI } from './wrsi.js';
import {
  tab, setTheme, showToast, hideToast, safeSet, safeHTML, safeStyle,
  update, renderShap, resetEmergency, checkSpectralGating,
  updateROI, updateSectorEconomy,
} from './ui.js';
import {
  fillLedger, renderLedger, addMember, removeMember, registerMember,
  _seedMembers, _ensureMembers, getIrrigationPlan, toggleIrrigation,
} from './members.js';
import {
  initLeafletMap, detectSectorFromCoord, saveStudyToLedger,
  cancelStudy, handleMapUpload, getActiveStudyBounds,
} from './map.js';
import {
  setSpectralMode, onSpectralSlider, resetSpectralToSim, runSpectralSim,
  loadBand, computeBandIndex, fetchOnlineNDVI, displaySpectralResults,
  syncSpectralFromDashboard,
} from './spectral.js';
import { startAutoMonitor, stopAutoMonitor, _runMonitorCycle } from './monitor.js';
import {
  renderExportHub, renderAnalysisHub, generateIndividualReport, exportAnalysisFull,
} from './finance.js';
import { toggleSim } from './simulation.js';
import { adminLogin, adminLogout, adminStatus } from './api.js';
import {
  initSpatialEngine, runSpatialEngineNow, stopSpatialEnginePolling,
  enrichMembersWithSpatialData, renderSpatialEnginePanel,
} from './spatial-engine.js';

// ── Admin session UI ──────────────────────────────────────────────────────────
async function refreshAdminButton() {
  const btn = document.getElementById('btn-admin');
  if (!btn) return;
  const isAdmin = await adminStatus();
  if (isAdmin) {
    btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Admin';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
    btn.title = 'Logged in as admin — click to lock';
  } else {
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin';
    btn.style.color = 'var(--ink-mute)';
    btn.style.borderColor = '';
    btn.title = 'Unlock admin mode to edit member data';
  }
}

async function toggleAdminMode() {
  const isAdmin = await adminStatus();
  if (isAdmin) {
    await adminLogout();
  } else {
    const pw = window.prompt('Enter admin password:');
    if (!pw) return;
    const ok = await adminLogin(pw);
    if (!ok) { window.alert('Incorrect password.'); return; }
  }
  refreshAdminButton();
}

// ── Expose all functions needed by HTML inline handlers ──────────────────────
Object.assign(window, {
  // Core
  getInp, computeBaselineWRSI, computeOptimizedWRSI, computeSPI,
  // UI
  tab, setTheme, showToast, hideToast, safeSet, safeHTML, safeStyle,
  update, renderShap, resetEmergency, checkSpectralGating,
  updateROI, updateSectorEconomy,
  // Members
  fillLedger, renderLedger, addMember, removeMember, registerMember,
  _seedMembers, _ensureMembers, getIrrigationPlan, toggleIrrigation,
  // Map
  initLeafletMap, detectSectorFromCoord, saveStudyToLedger,
  cancelStudy, handleMapUpload, getActiveStudyBounds,
  // Spectral
  setSpectralMode, onSpectralSlider, resetSpectralToSim, runSpectralSim,
  loadBand, computeBandIndex, fetchOnlineNDVI, displaySpectralResults,
  syncSpectralFromDashboard,
  // Monitor
  startAutoMonitor, stopAutoMonitor, _runMonitorCycle,
  // Finance
  renderExportHub, renderAnalysisHub, generateIndividualReport, exportAnalysisFull,
  // Simulation
  toggleSim,
  // Admin
  toggleAdminMode,
  // Spatial Engine
  runSpatialEngineNow, stopSpatialEnginePolling,
  enrichMembersWithSpatialData, renderSpatialEnginePanel,
});

// ── Bootstrap on page load ───────────────────────────────────────────────────
window.onload = async function () {
  // Track manual pH dragging so auto-drift doesn't fight the user
  const phSlider = document.getElementById('soil_ph');
  if (phSlider) {
    phSlider.addEventListener('mousedown',  () => { state.isUserDraggingPH = true;  });
    phSlider.addEventListener('mouseup',    () => { state.isUserDraggingPH = false; });
    phSlider.addEventListener('touchstart', () => { state.isUserDraggingPH = true;  }, { passive: true });
    phSlider.addEventListener('touchend',   () => { state.isUserDraggingPH = false; }, { passive: true });
  }

  await fillLedger();   // Load members from DB → localStorage → seed
  update();             // Compute WRSI + financial values
  startAutoMonitor();   // Background district health monitoring (15 s cycle)
  refreshAdminButton(); // Reflect current admin session state in the UI

  // Auto-run spectral analysis immediately with current slider defaults so
  // the results panel is populated on first load without any user action.
  try {
    if (typeof onSpectralSlider === 'function') {
      onSpectralSlider();
      // Reset manual flag so dashboard sync (syncSpectralFromDashboard) still works
      state.isSpectralManual = false;
    }
    const sr = document.getElementById('spectral-results');
    if (sr) sr.style.display = 'block';
  } catch (_) {}

  // Pre-warm hidden tabs so content is ready before first click.
  setTimeout(() => { try { renderAnalysisHub(); } catch (_) {} }, 200);
  setTimeout(() => { try { renderExportHub();   } catch (_) {} }, 400);
  setTimeout(() => { try { renderShap();        } catch (_) {} }, 100);

  // Set default date for Spatial Engine to previous month
  const _seDate = document.getElementById('se-date');
  if (_seDate) {
    const _d = new Date(); _d.setMonth(_d.getMonth() - 1);
    _seDate.value = _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0');
  }

  // Spatial Engine: lazy-init on first tab open, then self-polls every 30 min
  let _spatialInited = false;
  window._onSpatialTabOpen = async () => {
    if (!_spatialInited) {
      _spatialInited = true;
      await initSpatialEngine();
    }
  };
};
