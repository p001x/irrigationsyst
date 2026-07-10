// AgriAdapt — Auto-Monitor Engine (runs every 15 s)
import { state }                                  from './state.js';
import { CROP_DATA, KIREHE_SECTORS, MARKET_PRICE_RWF_T } from './constants.js';
import { computeBaselineWRSI, computeOptimizedWRSI }     from './wrsi.js';

export function startAutoMonitor() {
  if (state._autoMonitorRunning) return;
  state._autoMonitorRunning = true;
  _runMonitorCycle();
  state._autoMonitorTimer = setInterval(_runMonitorCycle, 15_000);
  console.log('[AGRIAdapt Monitor] District health monitoring active — cycling every 15s');
}

export function stopAutoMonitor() {
  state._autoMonitorRunning = false;
  if (state._autoMonitorTimer) { clearInterval(state._autoMonitorTimer); state._autoMonitorTimer = null; }
}

export function _runMonitorCycle() {
  if (!state.GLOBAL_MEMBERS?.length) return;
  let i;
  try { i = window.getInp?.(); if (!i) return; } catch (e) { return; }

  const baseWRSI = computeBaselineWRSI(i);
  const optWRSI  = computeOptimizedWRSI(baseWRSI, i);
  let atRisk = 0, critical = 0;

  state.GLOBAL_MEMBERS.forEach(m => {
    const crop     = CROP_DATA[m.crop] || CROP_DATA.Maize;
    const sProf    = KIREHE_SECTORS.find(s => s.n === m.sector) || { fert: 1.0 };
    const mOptWrsi = Math.min(100, Math.round(optWRSI / crop.weight));
    m.wrsi     = mOptWrsi;
    m.yield_rwf = m.ha * crop.yield * sProf.fert * (mOptWrsi / 100) * MARKET_PRICE_RWF_T;
    if (mOptWrsi < 70) critical++;
    else if (mOptWrsi < 80) atRisk++;
  });

  const badge = document.getElementById('monitor-badge');
  if (badge) {
    const ts = new Date().toLocaleTimeString();
    if (critical > 0) {
      badge.setAttribute('aria-label', `${critical} critical, ${atRisk} at risk`);
      badge.style.cssText += 'background:rgba(255,79,79,0.15);color:var(--red);border-color:rgba(255,79,79,0.3);';
      badge.innerHTML = `<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> ${critical} CRITICAL · ${atRisk} AT RISK · ${ts}`;
    } else if (atRisk > 0) {
      badge.setAttribute('aria-label', `${atRisk} members at risk`);
      badge.style.cssText += 'background:rgba(251,191,36,0.15);color:var(--gold);border-color:rgba(251,191,36,0.3);';
      badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${atRisk} AT RISK · MONITORING · ${ts}`;
    } else {
      badge.setAttribute('aria-label', `All ${state.GLOBAL_MEMBERS.length} members nominal`);
      badge.style.cssText += 'background:rgba(0,255,102,0.1);color:var(--green);border-color:rgba(0,255,102,0.2);';
      badge.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ALL ${state.GLOBAL_MEMBERS.length} MEMBERS NOMINAL · ${ts}`;
    }
  }

  if (document.getElementById('p-analysis')?.classList.contains('active')) window.renderAnalysisHub?.();
  if (document.getElementById('p-export')?.classList.contains('active'))   window.renderExportHub?.();
  if (document.getElementById('p-ledger')?.classList.contains('active'))   window.renderLedger?.();
  if (document.getElementById('p-model')?.classList.contains('active'))    window.renderShap?.();
}
