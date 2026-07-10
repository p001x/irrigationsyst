// AgriAdapt — UI Helpers, Tab System, Main Update Loop
import { state }                             from './state.js';
import { SHAP }                              from './constants.js';
import { getInp, computeBaselineWRSI, computeOptimizedWRSI } from './wrsi.js';
import { fetchFinance }                      from './api.js';

// ── Crash-proof DOM helpers ──────────────────────────────────────────────────
export const safeSet   = (id, val)        => { const el = document.getElementById(id); if (el) el.textContent = val; };
export const safeHTML  = (id, html)       => { const el = document.getElementById(id); if (el) el.innerHTML  = html; };
export const safeStyle = (id, prop, val)  => { const el = document.getElementById(id); if (el) el.style[prop] = val; };

export function syncTrend(id, current, last) {
  const el = document.getElementById(id);
  if (!el) return;
  const diff = current - last;
  if (diff > 0)      el.innerHTML = `<i class="fa-solid fa-caret-up" aria-hidden="true"></i> +${diff.toFixed(1)}%`;
  else if (diff < 0) el.innerHTML = `<i class="fa-solid fa-caret-down" aria-hidden="true"></i> ${diff.toFixed(1)}%`;
  else               el.innerHTML = `<i class="fa-solid fa-equals" aria-hidden="true"></i> 0%`;
}

// ── Theme ────────────────────────────────────────────────────────────────────
export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  ['light','white','dark','black'].forEach(k =>
    document.getElementById('t-' + k)?.classList.toggle('active', k === t));
}

// ── Toast ────────────────────────────────────────────────────────────────────
export function showToast(msg, actionText = 'View', actionCallback = null) {
  let toast = document.getElementById('toast-container');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-container';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#111827;color:white;padding:12px 24px;border-radius:40px;display:flex;align-items:center;gap:15px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);font-family:var(--mono);font-size:13px;transition:all 0.3s ease;opacity:0;';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span style="color:var(--green)" aria-hidden="true">✓</span> ${msg}${actionCallback ? `<button id="toast-action" style="background:var(--green);border:none;color:#000;font-weight:900;padding:4px 12px;border-radius:12px;cursor:pointer;font-size:10px;text-transform:uppercase;">${actionText}</button>` : ''}`;
  toast.style.opacity = '1'; toast.style.bottom = '40px';
  const btn = document.getElementById('toast-action');
  if (btn && actionCallback) btn.onclick = () => { actionCallback(); hideToast(); };
  setTimeout(hideToast, 5000);
}
export function hideToast() {
  const t = document.getElementById('toast-container');
  if (t) { t.style.opacity = '0'; t.style.bottom = '30px'; }
}

// ── Tab System ───────────────────────────────────────────────────────────────
export function tab(id) {
  if (['analysis','export','ledger'].includes(id) && state.GLOBAL_MEMBERS.length === 0) window._ensureMembers?.();
  ['inputs','risk','ledger','finance','map','impact','model','export','analysis','spatial','faq'].forEach(t => {
    const pEl = document.getElementById('p-' + t);
    const nEl = document.getElementById('nb-' + t);
    if (pEl) { pEl.classList.toggle('active', t === id); pEl.style.display = t === id ? 'block' : 'none'; }
    if (nEl)   nEl.classList.toggle('active', t === id);
  });
  const hero = document.querySelector('.hero');
  if (hero) hero.style.display = ['inputs','risk','impact'].includes(id) ? 'flex' : 'none';
  try {
    if (id === 'map')      window.initLeafletMap?.();
    if (id === 'ledger')   { window._ensureMembers?.(); window.renderLedger?.(); }
    if (id === 'export')   { window._ensureMembers?.(); setTimeout(() => { try { window.renderExportHub?.(); } catch (e) { console.error('export render:', e); } }, 0); }
    if (id === 'analysis') { window._ensureMembers?.(); setTimeout(() => { try { window.renderAnalysisHub?.(); } catch (e) { console.error('analysis render:', e); } }, 0); }
    if (id === 'model')    setTimeout(() => { try { renderShap(); } catch (e) { console.error('shap render:', e); } }, 0);
    if (id === 'spatial')  window._onSpatialTabOpen?.();
  } catch (err) {
    console.error('Tab render error [' + id + ']:', err);
    const pEl = document.getElementById('p-' + id);
    if (pEl) {
      pEl.style.display = 'block'; pEl.classList.add('active');
      pEl.innerHTML = `<div style="padding:60px;text-align:center;color:white;background:rgba(255,79,79,0.1);border-radius:24px;border:1px solid var(--red);"><i class="fa-solid fa-triangle-exclamation fa-3x" style="color:var(--red);margin-bottom:20px;" aria-hidden="true"></i><h3 style="font-family:var(--cab);font-size:24px;margin-bottom:10px;">Render Error Detected</h3><p style="font-family:var(--mono);font-size:12px;opacity:0.7;margin-bottom:20px;">[Panel: ${id}] ${err.message}</p><div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-mini" onclick="location.reload()">Reload Dashboard</button><button class="btn btn-mini" onclick="fetch('/api/members',{method:'DELETE'}).then(()=>location.reload())" style="background:var(--red);color:white;border-color:var(--red);">Reset Data</button></div></div>`;
    }
  }
}

// ── Nutrient Lab ─────────────────────────────────────────────────────────────
export function updateNutrientLab(i) {
  const el = document.getElementById('nutrient-advice');
  if (!el) return;
  if      (i.soil_ph < 5.5)                      el.innerHTML = '🚨 <strong>ALERT:</strong> Highly acidic soil. Agricultural Lime required before N top-dressing.';
  else if (i.soil_ph < 6.0)                      el.innerHTML = '⚠️ <strong>CAUTION:</strong> Moderately acidic. Switch to nitrate-based fertilizers.';
  else if (i.soil_ph > 8.0)                      el.innerHTML = '🚨 <strong>ALERT:</strong> Highly alkaline soil. Severe Fe/Mn deficiency risk. Apply elemental sulfur.';
  else if (i.soil_ph > 7.5)                      el.innerHTML = '⚠️ <strong>CAUTION:</strong> Mildly alkaline. Phosphorus availability threatened. Use Ammonium Sulfate.';
  else if (i.sm_rel < 0.6 || i.reservoir < 15)  el.innerHTML = '🚨 <strong>ALERT:</strong> Hydraulic deficit. Urea suspended — switch to foliar micronutrient feeding.';
  else if (i.rf_cumul > 450)                     el.innerHTML = '⚠️ <strong>CAUTION:</strong> Nitrate leaching risk. Split N dose, use slow-release nitrification inhibitors.';
  else el.innerHTML = `✅ <strong>OPTIMAL:</strong> ${i.soil_ph === 6.5 ? 'Perfect neutral pH.' : 'Optimal pH zone.'} Combined fertigation recommended.`;
}

// ── Narrator & Recs ──────────────────────────────────────────────────────────
export function updateNarrator(i, base, opt) {
  const nt = document.getElementById('narrator-text');
  const nw = document.getElementById('narrator-why');
  if (!nt || !nw) return;
  nt.innerHTML = `Baseline WRSI: <strong>${base}%</strong> · Current (Optimized): <strong>${opt}%</strong><br>The ML model predicts a <strong>${base < 70 ? 'High' : 'Low'}</strong> baseline risk. Kirehe Infrastructure has closed the gap by <strong>${opt - base}%</strong>.`;
  const why = [];
  if (i.dekad >= 10)        why.push(`🌾 <strong>Harvest Phase Active:</strong> Crop is in dry-down. Low water is beneficial for yield preservation.`);
  else if (i.cdd > 14)      why.push(`🚨 <strong>CDD (${i.cdd}d)</strong> is the primary risk driver. Supplemental irrigation is mandatory.`);
  if (i.sm_rel < 0.7)       why.push(`💧 <strong>Soil Moisture</strong> below threshold. Increasing sprinkler pressure.`);
  if (i.soil_ph < 5.5)      why.push(`🧪 <strong>Toxic Acidity (${i.soil_ph} pH)</strong> causing nutrient lock-out. Irrigation recovery capped.`);
  else if (i.soil_ph > 8.0) why.push(`🧪 <strong>Toxic Alkalinity (${i.soil_ph} pH)</strong> preventing absorption. Irrigation recovery capped.`);
  else if (i.soil_ph < 6.0 || i.soil_ph > 7.5) why.push(`🧪 <strong>Sub-optimal pH (${i.soil_ph})</strong> limiting maximum crop vitality.`);
  nw.innerHTML = why.length ? why.join('<br>') : '✅ Conditions are currently within the optimized safety zone.';
}

export function updateRecs(i, wrsi) {
  const rlm = document.getElementById('rec-list-main');
  if (!rlm) return;
  const recs = [];
  if (i.dekad >= 10 && i.pivots_active > 5)
    recs.push({ icon:'<i class="fa-solid fa-wheat-awn-circle-exclamation" aria-hidden="true"></i>', cls:'ri-r', pri:'CRITICAL', title:'Suspend Irrigation (Dry-Down)', desc:'Crop has entered harvest stage. Active sprinklers are causing grain rot.' });
  else if (wrsi < 70 && i.dekad < 10)
    recs.push({ icon:'<i class="fa-solid fa-bolt" aria-hidden="true"></i>', cls:'ri-r', pri:'URGENT', title:'Increase Pumping Load', desc:'WRSI below 70 threshold. Activate nighttime pumping from battery reserves.' });
  if (i.sm_rel > 1.1)
    recs.push({ icon:'<i class="fa-solid fa-water-ladder" aria-hidden="true"></i>', cls:'ri-a', pri:'HIGH', title:'Soil Waterlogging Risk', desc:'Excess moisture detected. Suspend sprinklers in Sector 3 & 4.' });
  if (!recs.length)
    recs.push({ icon:'<i class="fa-solid fa-circle-check" aria-hidden="true"></i>', cls:'ri-g', pri:'NOMINAL', title:'Scientific Targets Met', desc:'Water requirement satisfaction is stable. Continue standard maintenance.' });
  rlm.setAttribute('role', 'list');
  rlm.innerHTML = recs.map(r => `
    <div class="rec-item" role="listitem">
      <div class="rec-ico ${r.cls}">${r.icon}</div>
      <div style="flex:1;">
        <div class="rec-title">${r.title} <span class="ptag ${r.cls === 'ri-r' ? 'pt-hi' : 'pt-lo'}">${r.pri}</span></div>
        <div class="rec-body" style="color:var(--ink-soft);font-family:var(--serif);margin-top:4px;">${r.desc}</div>
      </div>
    </div>`).join('');
}

// ── SHAP Chart ───────────────────────────────────────────────────────────────
export function renderShap() {
  const cont = document.getElementById('shap-summary');
  if (!cont) return;
  cont.innerHTML = '';
  cont.setAttribute('role', 'list');
  [...SHAP].sort((a, b) => b.imp - a.imp).forEach(d => {
    const row = document.createElement('div');
    row.style.marginBottom = '15px';
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;margin-bottom:5px;">
        ${d.name} <span style="float:right">${(d.imp * 100).toFixed(1)}% Impact</span>
      </div>
      <div role="progressbar" aria-valuenow="${Math.round(d.imp*100)}" aria-valuemin="0" aria-valuemax="100"
           aria-label="${d.name} importance ${(d.imp*100).toFixed(1)}%"
           style="height:4px;width:100%;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(100, d.imp*200)}%;background:${d.color};transition:width 0.5s ease-out;"></div>
      </div>`;
    cont.appendChild(row);
  });
}

// ── Finance ROI (calls server) ───────────────────────────────────────────────
export async function updateROI(baseWRSI, optWRSI, dekad) {
  try {
    const i    = getInp();
    const data = await fetchFinance(baseWRSI, optWRSI, state.GLOBAL_MEMBERS, i);
    if (data.members) state.GLOBAL_MEMBERS = data.members;

    const delta     = data.baseRevenue > 0 ? Math.round(((data.seasonalRevenue - data.baseRevenue) / data.baseRevenue) * 100) : 0;
    const memberAvg = state.GLOBAL_MEMBERS.length > 0 ? Math.round(data.seasonalRevenue / state.GLOBAL_MEMBERS.length) : 0;

    safeSet('imp-rwf',       Math.round(data.seasonalRevenue).toLocaleString() + ' RWF');
    safeSet('imp-rwf-base',  Math.round(data.baseRevenue).toLocaleString() + ' RWF');
    safeSet('imp-rwf-total', Math.round(data.seasonalRevenue).toLocaleString());
    safeSet('imp-kg',        data.totalTons.toLocaleString());
    safeSet('imp-weeks',     memberAvg.toLocaleString());
    safeSet('imp-delta',     '+' + delta + '% Surplus');

    updateSectorEconomy(data.sectorStats);
    safeHTML('community-health', `
      <div style="font-size:10px;color:var(--ink-mute);letter-spacing:0.1em;">COMMUNITY SUCCESS RATIO</div>
      <div style="font-size:20px;font-weight:800;color:var(--cyan);">${data.optimalCount} / ${state.GLOBAL_MEMBERS.length}</div>
      <div style="font-size:10px;color:var(--ink-soft);margin-top:2px;">Members in Optimal Range (&gt;80% WRSI)</div>`);

    safeSet('fin-gross-revenue', Math.round(data.seasonalRevenue).toLocaleString() + ' RWF');
    safeSet('fin-solar-cost',    data.solarCost.toLocaleString() + ' RWF');
    safeSet('fin-battery-cost',  data.batteryCost.toLocaleString() + ' RWF');
    safeSet('fin-pivot-cost',    data.pivotCost.toLocaleString() + ' RWF');
    safeSet('fin-total-opex',    data.totalOpEx.toLocaleString() + ' RWF');
    safeSet('fin-net-profit',    data.netProfit.toLocaleString() + ' RWF');
    safeSet('fin-per-household', data.perHH.toLocaleString() + ' RWF');
    window.renderLedger?.();
  } catch (e) { console.error('Finance API error', e); }
}

export function updateSectorEconomy(stats) {
  const cont = document.getElementById('sector-economy-stats');
  if (!cont) return;
  cont.innerHTML = '';
  Object.keys(stats).sort((a, b) => stats[b] - stats[a]).forEach(sName => {
    if (!stats[sName]) return;
    const block = document.createElement('div');
    block.className   = 'inner-glass';
    block.style.padding = '12px';
    block.innerHTML = `
      <div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;">${sName}</div>
      <div style="font-family:var(--mono);color:var(--cyan);font-weight:800;margin-top:4px;">${Math.round(stats[sName]).toLocaleString()}</div>
      <div style="font-size:9px;color:var(--ink-mute);">RWF Revenue</div>`;
    cont.appendChild(block);
  });
}

// ── Spectral gating ──────────────────────────────────────────────────────────
export function checkSpectralGating() {
  const hasArea = !!(state.currentStudyLayer || state.shpLayer || state.lastActiveArea);
  const overlay = document.getElementById('spectral-lock-overlay');
  if (overlay) { overlay.style.opacity = hasArea ? '0' : '1'; overlay.style.pointerEvents = hasArea ? 'none' : 'auto'; }
}

// ── Emergency reset ──────────────────────────────────────────────────────────
export function resetEmergency() {
  const ov = document.getElementById('emergency-overlay');
  if (ov) ov.style.display = 'none';
  document.body.classList.remove('emergency-pulse');
  const res = document.getElementById('reservoir');
  if (res) res.value = 50;
  update();
}

// ── Main update loop ─────────────────────────────────────────────────────────
export function update() {
  const i = getInp();

  // pH auto-drift
  if (!state.isUserDraggingPH) {
    let basePH = 6.5;
    if (i.rf_cumul > 300) basePH -= ((i.rf_cumul - 300) / 220) * 1.8;
    if (i.cdd > 10 && i.pivots_active > 20) basePH += ((i.cdd - 10) / 20) * 1.5 * (i.pivots_active / 63);
    const newPH = Math.max(4.5, Math.min(8.5, basePH));
    const phEl  = document.getElementById('soil_ph');
    if (phEl) phEl.value = newPH.toFixed(1);
    i.soil_ph = parseFloat(newPH.toFixed(1));
  }

  // Cloudy-day solar display
  if (i.rf_cumul > 450 && i.solar_mw > 1) {
    safeStyle('v_solar_mw', 'color', 'var(--gold)');
    safeSet('v_solar_mw', (i.solar_mw * 0.5).toFixed(1) + ' MW (CLOUDY)');
  } else {
    safeStyle('v_solar_mw', 'color', 'var(--cyan)');
    safeSet('v_solar_mw', i.solar_mw + ' MW');
  }

  const baseWRSI = computeBaselineWRSI(i);
  const optWRSI  = computeOptimizedWRSI(baseWRSI, i);

  // Emergency overlay
  const ov = document.getElementById('emergency-overlay');
  if (i.reservoir <= 0 && ov) { ov.style.display = 'flex'; document.body.classList.add('emergency-pulse'); }

  // Indicator labels
  safeSet('v_rf_cumul',     i.rf_cumul + ' mm');
  safeSet('v_cdd',          i.cdd + ' d');
  safeSet('v_sm_rel',       i.sm_rel);
  safeSet('v_ndvi',         i.ndvi);
  safeSet('v_pivots_active',i.pivots_active + ' Units');
  safeSet('v_reservoir',    i.reservoir + '%');
  safeSet('v_soil_ph',      i.soil_ph);
  safeSet('v_dekad',        'Dekad ' + i.dekad);
  const dCount = document.getElementById('day-counter');  if (dCount) dCount.textContent = i.dekad;
  const tProg  = document.getElementById('time-prog');    if (tProg)  tProg.style.width  = ((i.dekad / 12) * 100) + '%';

  // WRSI hero
  safeSet('h-wrsi-opt', optWRSI + '%');
  syncTrend('trend-wrsi', optWRSI, state.LAST_KPI_STATE.wrsi);
  state.LAST_KPI_STATE.wrsi = optWRSI;
  safeSet('h-wrsi-base', baseWRSI + '%');

  // Predictive panel
  safeSet('wrsi-base-big', baseWRSI + '%');  safeStyle('wrsi-base-fill', 'width', baseWRSI + '%');
  const tagBase = document.getElementById('tag-base');
  if (tagBase) { tagBase.textContent = baseWRSI < 75 ? 'PREDICTED FAILURE' : 'NOMINAL'; tagBase.className = 'ptag ' + (baseWRSI < 75 ? 'pt-hi' : 'pt-lo'); }
  safeSet('wrsi-opt-big', optWRSI + '%');    safeStyle('wrsi-opt-fill', 'width', optWRSI + '%');
  const tagOpt = document.getElementById('tag-opt');
  if (tagOpt) { tagOpt.textContent = optWRSI < 75 ? 'INSUFFICIENT RECOVERY' : 'STABILIZED'; tagOpt.className = 'ptag ' + (optWRSI < 75 ? 'pt-hi' : 'pt-lo'); }

  // Explain why irrigation shows zero benefit late in the season
  const optNote = document.getElementById('wrsi-opt-note');
  if (optNote) {
    if (i.dekad >= 10 && optWRSI === baseWRSI) {
      optNote.style.display = 'block';
      optNote.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> No irrigation benefit applied — by Dekad 10+, solar-irrigation can no longer recover a season-long water deficit, so the optimized index matches the baseline.';
    } else {
      optNote.style.display = 'none';
    }
  }

  // Sub-systems
  try {
    updateROI(baseWRSI, optWRSI, i.dekad);
    updateNarrator(i, baseWRSI, optWRSI);
    updateRecs(i, optWRSI);
    renderShap();
    updateNutrientLab(i);
  } catch (err) { console.error('Simulation Sub-system Error:', err); }

  // Orb visual
  const orbFill   = document.getElementById('orb-fill');
  const orbPct    = document.getElementById('orb-pct');
  const orbStatus = document.getElementById('orb-status');
  const circ = 2 * Math.PI * 108;
  if (orbFill) { orbFill.style.strokeDasharray = circ; orbFill.style.strokeDashoffset = circ * (1 - optWRSI / 100); }
  if (orbPct) orbPct.textContent = optWRSI + '%';
  if (orbStatus) {
    if (optWRSI < 70)      { orbStatus.textContent = 'Critical Risk';  orbStatus.setAttribute('fill', '#FF4F4F'); }
    else if (optWRSI < 85) { orbStatus.textContent = 'Stressed';       orbStatus.setAttribute('fill', '#FBBF24'); }
    else                   { orbStatus.textContent = 'Operational';    orbStatus.setAttribute('fill', '#00F0FF'); }
  }

  const imgH = document.getElementById('img-healthy');
  const imgS = document.getElementById('img-stressed');
  if (imgH && imgS) { imgH.style.opacity = optWRSI > 80 ? '1' : '0.15'; imgS.style.opacity = optWRSI < 75 ? '1' : '0.15'; }

  const crl = document.getElementById('comp-rf-live'); if (crl) crl.textContent = i.rf_cumul + ' mm';
  const cwb = document.getElementById('comp-wrsi-base'); if (cwb) cwb.textContent = baseWRSI + '%';
  const cwo = document.getElementById('comp-wrsi-opt');  if (cwo) cwo.textContent = optWRSI  + '%';

  const lEl = document.getElementById('imp-lead2'); if (lEl) lEl.textContent = Math.max(1, 12 - i.dekad) + ' weeks';
  const irp = document.getElementById('imp-risk-pct2'); if (irp) irp.textContent = optWRSI;

  checkSpectralGating();
  if (state.currentSpectralContext === 'sim') window.syncSpectralFromDashboard?.();
  if (document.getElementById('p-analysis')?.classList.contains('active')) window.renderAnalysisHub?.();
  if (document.getElementById('p-export')?.classList.contains('active'))   window.renderExportHub?.();
  if (document.getElementById('p-model')?.classList.contains('active'))    renderShap();
}
