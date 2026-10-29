// AgriAdapt — UI Helpers, 4-Tab System, Main Update Loop
import { state }                             from './state.js';
import { SHAP, KIREHE_SECTORS }              from './constants.js';
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

// ── Historical Scenario Loader ───────────────────────────────────────────────
export const HISTORICAL_SCENARIOS = {
  baseline_2024: {
    label: '2024 Season B Baseline',
    dekad: 6, rf_cumul: 285, cdd: 7, sm_rel: 0.70, ndvi: 0.45, soil_ph: 6.5, pivots_active: 25, solar_mw: 2.2, reservoir: 80,
    desc: '2024 Season B Baseline: Normal rainfall pattern with moderate mid-season conditions across Kirehe.'
  },
  drought_2016: {
    label: '2016 Historic Akagera Drought',
    dekad: 8, rf_cumul: 175, cdd: 18, sm_rel: 0.32, ndvi: 0.28, soil_ph: 5.8, pivots_active: 63, solar_mw: 3.3, reservoir: 45,
    desc: '2016 Historic Drought: Severe 18-day dry spell at flowering stage with root-zone soil moisture drop to 0.32. Full 63 center pivots deployed.'
  },
  desiccation_2004: {
    label: '2004 Thermal Flash Desiccation',
    dekad: 6, rf_cumul: 140, cdd: 22, sm_rel: 0.26, ndvi: 0.24, soil_ph: 5.4, pivots_active: 50, solar_mw: 3.1, reservoir: 35,
    desc: '2004 Heat Anomaly: Extreme consecutive dry days (22 days) combined with high LST thermal stress across eastern lowlands.'
  },
  bumper_2020: {
    label: '2020 High-Yield Bumper Season',
    dekad: 6, rf_cumul: 420, cdd: 3, sm_rel: 0.82, ndvi: 0.62, soil_ph: 6.8, pivots_active: 10, solar_mw: 1.5, reservoir: 95,
    desc: '2020 High Yield: Abundant precipitation (420 mm) and optimal soil moisture, requiring only minimal supplemental pumping.'
  }
};

export function loadScenario(key) {
  const scen = HISTORICAL_SCENARIOS[key];
  if (!scen) return;
  
  const fields = ['dekad','rf_cumul','cdd','sm_rel','ndvi','soil_ph','pivots_active','solar_mw','reservoir'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && scen[f] !== undefined) el.value = scen[f];
  });

  Object.keys(HISTORICAL_SCENARIOS).forEach(k => {
    const suffix = k.split('_')[1];
    const btn = document.getElementById(`scen-${suffix}`);
    if (btn) btn.classList.toggle('active', k === key);
  });

  const alertEl = document.getElementById('sim-alert-text');
  if (alertEl) {
    alertEl.innerHTML = `<strong>Active Scenario:</strong> ${scen.label}. ${scen.desc}`;
  }

  update();
  showToast(`📍 Loaded Scenario: ${scen.label}`);
}

// ── Low-Bandwidth Mode ────────────────────────────────────────────────────────
export function toggleLowBandwidth() {
  const video = document.getElementById('bg-video');
  const btn = document.getElementById('btn-low-bandwidth');
  const isReduced = document.body.classList.toggle('low-bandwidth-mode');
  
  if (video) {
    if (isReduced) {
      video.pause();
      video.style.display = 'none';
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-leaf"></i> Data Saver ON';
        btn.style.color = 'var(--green)';
        btn.style.borderColor = 'var(--green)';
      }
      showToast('⚡ Low-Bandwidth Mode Enabled: Background video paused and unloaded.');
    } else {
      video.style.display = 'block';
      video.play().catch(() => {});
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-leaf"></i> Data Saver';
        btn.style.color = '';
        btn.style.borderColor = '';
      }
      showToast('🎬 Standard Mode Enabled: Background video restored.');
    }
  }
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
  toast.innerHTML = `<span style="color:var(--green)" aria-hidden="true">✓</span> ${msg}${actionCallback ? `<button id="toast-action" style="background:var(--green);border:none;color:#000;font-weight:900;padding:4px 12px;border-radius:12px;cursor:pointer;font-size:10px;text-transform:uppercase;margin-left:10px;">${actionText}</button>` : ''}`;
  toast.style.opacity = '1'; toast.style.bottom = '40px';
  const btn = document.getElementById('toast-action');
  if (btn && actionCallback) btn.onclick = () => { actionCallback(); hideToast(); };
  setTimeout(hideToast, 5000);
}
export function hideToast() {
  const t = document.getElementById('toast-container');
  if (t) { t.style.opacity = '0'; t.style.bottom = '30px'; }
}

// ── Consolidated 4-Tab Architecture ──────────────────────────────────────────
export function tab(id) {
  // Alias mapping from 10 legacy tabs to the clean 4-tab model
  let targetTab = id;
  let targetSub = null;

  if (['inputs', 'risk', 'map', 'spatial'].includes(id)) {
    targetTab = 'early';
    if (id === 'inputs' || id === 'risk') targetSub = 'clim';
    else if (id === 'map') targetSub = 'map';
    else if (id === 'spatial') targetSub = 'spatial';
  } else if (['action', 'infrastructure'].includes(id)) {
    targetTab = 'action';
  } else if (['impact', 'ledger', 'finance', 'analysis', 'export'].includes(id)) {
    targetTab = 'impact';
    if (id === 'ledger') targetSub = 'ledger';
    else if (id === 'export' || id === 'analysis') targetSub = 'export';
    else targetSub = 'roi';
  } else if (['validation', 'model', 'faq'].includes(id)) {
    targetTab = 'validation';
    if (id === 'faq') targetSub = 'faq';
    else targetSub = 'model';
  }

  // Ensure members data initialized
  if (['impact', 'ledger', 'export', 'analysis'].includes(id) && state.GLOBAL_MEMBERS.length === 0) {
    window._ensureMembers?.();
  }

  // Toggle main panel visibility
  const mainTabs = ['early', 'action', 'impact', 'validation'];
  mainTabs.forEach(t => {
    const pEl = document.getElementById('p-' + t);
    const nEl = document.getElementById('nb-' + t);
    const isActive = (t === targetTab);
    if (pEl) {
      pEl.classList.toggle('active', isActive);
      pEl.style.display = isActive ? 'block' : 'none';
    }
    if (nEl) nEl.classList.toggle('active', isActive);
  });

  // Hero section visibility (Early Warning & Solar Action benefit from the hero stats)
  const hero = document.querySelector('.hero');
  if (hero) hero.style.display = (targetTab === 'early' || targetTab === 'action') ? 'flex' : 'none';

  // Trigger sub-view switch if requested
  if (targetSub) {
    if (targetTab === 'early') switchEarlySub(targetSub);
    else if (targetTab === 'impact') switchImpactSub(targetSub);
    else if (targetTab === 'validation') switchValSub(targetSub);
  }

  // Lifecycle initializations
  try {
    if (targetTab === 'early') {
      setTimeout(() => { window.initLeafletMap?.(); }, 100);
      window._onSpatialTabOpen?.();
    }
    if (targetTab === 'impact') {
      window._ensureMembers?.();
      window.renderLedger?.();
      setTimeout(() => { try { window.renderAnalysisHub?.(); } catch (e) {} }, 50);
      setTimeout(() => { try { window.renderExportHub?.(); } catch (e) {} }, 100);
    }
    if (targetTab === 'validation') {
      setTimeout(() => { try { renderShap(); } catch (e) {} }, 50);
    }
  } catch (err) {
    console.error('Tab render error [' + id + ']:', err);
  }
}

// ── Tab 1 Sub-Navigation (Early Warning Hub) ──────────────────────────────────
export function switchEarlySub(subId) {
  const views = ['clim', 'map', 'spatial'];
  views.forEach(v => {
    const viewEl = document.getElementById('early-' + v + '-view');
    const btnEl  = document.getElementById('sub-early-' + v);
    const isActive = (v === subId);
    if (viewEl) viewEl.style.display = isActive ? 'block' : 'none';
    if (btnEl)  btnEl.classList.toggle('active', isActive);
  });
  if (subId === 'map') {
    setTimeout(() => { window.initLeafletMap?.(); }, 150);
  }
  if (subId === 'spatial') {
    window._onSpatialTabOpen?.();
  }
}

// ── Tab 3 Sub-Navigation (Farmer ROI & Impact Hub) ───────────────────────────
export function switchImpactSub(subId) {
  const views = ['roi', 'ledger', 'export', 'sms'];
  views.forEach(v => {
    const viewEl = document.getElementById('imp-' + v + '-view');
    const btnEl  = document.getElementById('sub-imp-' + v);
    const isActive = (v === subId);
    if (viewEl) viewEl.style.display = isActive ? 'block' : 'none';
    if (btnEl)  btnEl.classList.toggle('active', isActive);
  });
  if (subId === 'ledger') window.renderLedger?.();
  if (subId === 'export') window.renderExportHub?.();
}

// ── Tab 4 Sub-Navigation (Validation Lab & FAQ) ──────────────────────────────
export function switchValSub(subId) {
  const views = ['model', 'faq', 'nisr'];
  views.forEach(v => {
    const viewEl = document.getElementById('val-' + v + '-view');
    const btnEl  = document.getElementById('sub-val-' + v);
    const isActive = (v === subId);
    if (viewEl) viewEl.style.display = isActive ? 'block' : 'none';
    if (btnEl)  btnEl.classList.toggle('active', isActive);
  });
  if (subId === 'model') renderShap();
}

// ── Grassroots Feature Phone SMS Simulation (Kinyarwanda & English) ──────────
const SMS_TEMPLATES = {
  Mahama: {
    rw: 'AgriAdapt Kirehe Alert: Umurenge wa Mahama uri mu kaga k\'amapfa (76.5%). Ubuhehere bw\'ubutaka buri munsi ya 35%. Imvura izabura muri Dekad 6–8. Inama: Sasira ibishingwe ku butaka (mulching) kandi witabaze gahunda y\'amazi yihuse. Guhamagara Agronome: *105# cyangwa 0788-383-103.',
    en: 'AgriAdapt Kirehe Alert: Mahama Sector is at Extreme Drought Risk (76.5%). Root-zone soil moisture is critically low (<35%). Urgent: Apply soil mulching and mobilize emergency supplemental irrigation. Local Agronomist Hotline: *105# / 0788-383-103.',
    risk: 'EXTREME RISK (76.5%)'
  },
  Mpanga: {
    rw: 'AgriAdapt Kirehe Alert: Umurenge wa Mpanga wugarijwe n\'amapfa (71.2%). Ubuhehere bw\'ubutaka buri hasi cyane. Inama: Gabanya gukata ibibabi, hunga izuba ku bihingwa bito, tanga amakuru ku mushinga wa Nasho wo kuhira. Nimero: *105#.',
    en: 'AgriAdapt Kirehe Alert: Mpanga Sector is facing Severe Drought (71.2%). High thermal stress detected on MODIS. Request cooperative solar water transfer. Agronomist Hotline: *105#.',
    risk: 'EXTREME RISK (71.2%)'
  },
  Nasho: {
    rw: 'AgriAdapt Nasho Nexus: Gahunda yo kuhira irakora neza ku ma pivots 63. Amashanyarazi y\'imirasire y\'izuba aratanga 3.3 MW. Amazi y\'ikigega ageze kuri 95%. Icyitonderwa: Muri Dekad 10 kuhira bizahagarikwa mu gihe cy\'isarura.',
    en: 'AgriAdapt Nasho Hub: 63 center pivots operational via 3.3 MW solar power. Reservoir capacity at 95%. Note: Irrigation suspension scheduled for Dekad 10 grain dry-down phase.',
    risk: 'STABILIZED (PIVOT IRRIGATED)'
  },
  Gatore: {
    rw: 'AgriAdapt Kirehe Alert: Umurenge wa Gatore uratekanye (Ubuhehere buri hejuru ya 75%). Imyaka imeze neza. Inama: Tegura ifumbire ya NPK ku gihe cy\'imikurire.',
    en: 'AgriAdapt Kirehe Alert: Gatore Sector is in the Optimal Moisture Zone (>75% WRSI). Nominal crop development. Apply standard nitrogen top-dressing.',
    risk: 'OPTIMAL / RESILIENT (22.1%)'
  },
  Nyamugari: {
    rw: 'AgriAdapt Kirehe Alert: Nyamugari iri mu kaga gakomeye k\'amapfa (65.5%). Ubutaka burumagaye. Witabaze gahunda yo kuhira y\'akarere. Guhamagara: *105#.',
    en: 'AgriAdapt Kirehe Alert: Nyamugari Sector under High Drought Stress (65.5%). Immediate moisture conservation required.',
    risk: 'HIGH RISK (65.5%)'
  }
};

export function updateSmsPreview() {
  const sel = document.getElementById('sms-sector-select');
  const sector = sel?.value || 'Mahama';
  const tmpl = SMS_TEMPLATES[sector] || SMS_TEMPLATES.Mahama;

  safeSet('sms-preview-body-rw', `"${tmpl.rw}"`);
  safeSet('sms-preview-body-en', `"${tmpl.en}"`);
  safeSet('sms-risk-badge', tmpl.risk);
}

export function simulateSmsDispatch() {
  const sel = document.getElementById('sms-sector-select');
  const sector = sel?.value || 'Mahama';
  const count = sector === 'Mahama' ? '4,820' : sector === 'Mpanga' ? '3,410' : '2,150';
  showToast(`✅ Dispatched Kinyarwanda SMS early warning to ${count} registered smallholders in ${sector}!`);
  safeSet('sms-dispatch-status', `🚀 Sent to ${count} feature phones via Africa's Talking gateway at ${new Date().toLocaleTimeString()}`);
}

export function triggerMemberSms(name, sector, wrsi) {
  tab('impact');
  switchImpactSub('sms');
  const sel = document.getElementById('sms-sector-select');
  if (sel) {
    sel.value = sector;
    updateSmsPreview();
  }
  showToast(`📱 Configured Kinyarwanda SMS early warning alert for ${name} (${sector}, WRSI: ${wrsi}%)`);
  const card = document.getElementById('sms-gateway-card');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.style.outline = '2px solid var(--gold)';
    setTimeout(() => { card.style.outline = ''; }, 2500);
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
        ${d.name} <span style="float:right">${(d.imp * 100).toFixed(1)}% Relative Importance</span>
      </div>
      <div role="progressbar" aria-valuenow="${Math.round(d.imp*100)}" aria-valuemin="0" aria-valuemax="100"
           aria-label="${d.name} importance ${(d.imp*100).toFixed(1)}%"
           style="height:6px;width:100%;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(100, d.imp*220)}%;background:${d.color};transition:width 0.5s ease-out;"></div>
      </div>`;
    cont.appendChild(row);
  });
}

// ── Finance ROI (Instant Client-Side with Real Benchmarks) ────────────────────
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
  } catch (e) { console.error('Finance calculation error', e); }
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
      <div style="font-size:9px;color:var(--ink-mute);">RWF Value</div>`;
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
  if (tagBase) { tagBase.textContent = baseWRSI < 75 ? 'PREDICTED DROUGHT DEFICIT' : 'NOMINAL'; tagBase.className = 'ptag ' + (baseWRSI < 75 ? 'pt-hi' : 'pt-lo'); }
  safeSet('wrsi-opt-big', optWRSI + '%');    safeStyle('wrsi-opt-fill', 'width', optWRSI + '%');
  const tagOpt = document.getElementById('tag-opt');
  if (tagOpt) { tagOpt.textContent = optWRSI < 75 ? 'INSUFFICIENT RECOVERY' : 'STABILIZED (SOLAR-IRRIGATED)'; tagOpt.className = 'ptag ' + (optWRSI < 75 ? 'pt-hi' : 'pt-lo'); }

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
  if (document.getElementById('imp-export-view')?.style.display !== 'none') window.renderExportHub?.();
}
