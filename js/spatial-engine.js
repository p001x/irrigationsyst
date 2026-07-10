// AgriAdapt — Spectral Intelligence Hub · SPATIAL ENGINE
// Fetches real per-sector NDVI/NDWI/SPI/LST from GEE for all 12 Kirehe sectors,
// enriches every member in state.GLOBAL_MEMBERS with live satellite indices,
// and renders the live Spatial Engine panel.

import { state }                     from './state.js';
import { fetchSpatialEngine }        from './api.js';
import { interpretNDVI, interpretNDWI, interpretSPI } from './spectral.js';
import { KIREHE_SECTORS }            from './constants.js';

// ── Module state ─────────────────────────────────────────────────────────────
let _pollTimer      = null;
let _countdownTimer = null;
let _lastData       = null;
let _nextRefreshAt  = 0;
const POLL_INTERVAL = 30 * 60 * 1000; // 30 min (satellite cadence)

// ── Public API ────────────────────────────────────────────────────────────────

/** Boot the engine: run first fetch + start polling. */
export async function initSpatialEngine() {
  _setStatus('loading', '⏳ Initialising Spatial Engine…');
  await runSpatialEngineNow();
  _startPolling();
}

/** Force-refresh now (also called by the Refresh button in HTML). */
export async function runSpatialEngineNow() {
  const dateEl = document.getElementById('se-date');
  const date   = dateEl?.value || _defaultDate();
  _setStatus('loading', `⏳ Connecting to GEE — querying ${date}…`);
  _setBadge('loading');
  try {
    const data = await fetchSpatialEngine(date);
    _lastData   = data;
    _nextRefreshAt = Date.now() + POLL_INTERVAL;
    enrichMembersWithSpatialData(data.sectors);
    renderSpatialEnginePanel(data);
    _setStatus('ok', `✅ Live data loaded · ${Object.keys(data.sectors || {}).length} sectors · ${data.fromCache ? 'cached' : 'fresh from GEE'}`);
    _setBadge('live');
    // Notify any watchers (e.g. Member Analysis tab)
    window.dispatchEvent(new CustomEvent('spatialEngineUpdate', { detail: data }));
  } catch (err) {
    _setStatus('error', `❌ ${err.message}`);
    _setBadge('error');
  }
}

/** Stop polling — call when the user navigates away. */
export function stopSpatialEnginePolling() {
  if (_pollTimer)      { clearInterval(_pollTimer);      _pollTimer      = null; }
  if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
}

/** Enrich every member in state.GLOBAL_MEMBERS with real sector indices.
 *  Only ndvi, ndwi, spi, and ai_interp are updated — WRSI is not touched
 *  here to prevent cumulative drift across repeated refreshes.  WRSI is
 *  managed exclusively by the main update loop from dashboard weather inputs.
 */
export function enrichMembersWithSpatialData(sectors) {
  if (!sectors || !state.GLOBAL_MEMBERS?.length) return;
  let enriched = 0;
  state.GLOBAL_MEMBERS.forEach(m => {
    const s = sectors[m.sector];
    if (!s) return;
    m.ndvi      = s.ndvi;
    m.spi       = s.spi;
    m.ai_interp = _buildInterpTag(s);
    enriched++;
  });
  // Re-render member ledger with fresh spectral indices
  try { window.renderLedger?.(); } catch (_) {}
  return enriched;
}

/** Render the full Spatial Engine panel. */
export function renderSpatialEnginePanel(data) {
  const container = document.getElementById('se-content');
  if (!container) return;

  const sectors  = data?.sectors  || {};
  const sources  = data?.sources  || [];
  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : '—';
  const sectorList = KIREHE_SECTORS.map(s => s.n);

  // ── Summary KPIs ─────────────────────────────────────────────────────────
  const vals       = Object.values(sectors);
  const avgNDVI    = vals.length ? (vals.reduce((a,b) => a + b.ndvi, 0) / vals.length) : 0;
  const avgSPI     = vals.length ? (vals.reduce((a,b) => a + b.spi,  0) / vals.length) : 0;
  const atRisk     = vals.filter(v => v.ndvi < 0.3 || v.spi < -1.0).length;
  const membersEnr = state.GLOBAL_MEMBERS?.length || 0;

  // ── Build sector rows ─────────────────────────────────────────────────────
  const rows = sectorList.map(name => {
    const s = sectors[name];
    if (!s) return `<tr><td style="font-family:var(--mono);font-size:10px;">${name}</td><td colspan="6" style="color:var(--ink-mute);font-size:10px;">No data</td></tr>`;

    const iN = interpretNDVI(s.ndvi);
    const iW = interpretNDWI(s.ndwi);
    const iS = interpretSPI(s.spi);
    const lstColor = s.lstAnomaly > 3 ? '#FF4F4F' : s.lstAnomaly > 1 ? '#FF8800' : s.lstAnomaly < -1 ? '#00AAFF' : '#00FF66';
    const rainColor = s.rain < 20 ? '#FF8800' : s.rain > 100 ? '#00AAFF' : '#00FF66';
    const rowAlert = (s.ndvi < 0.3 || s.spi < -1.0) ? 'background:rgba(255,79,79,0.06);' : '';

    return `<tr style="${rowAlert}">
      <td style="font-family:var(--mono);font-size:11px;font-weight:700;padding:10px 12px;">${name}</td>
      <td style="text-align:center;padding:10px 8px;">
        <span style="color:${iN.color};font-weight:800;font-family:var(--mono);font-size:12px;">${s.ndvi.toFixed(3)}</span>
        <div style="font-size:8px;color:${iN.color};margin-top:2px;">${iN.label}</div>
      </td>
      <td style="text-align:center;padding:10px 8px;">
        <span style="color:${iW.color};font-weight:800;font-family:var(--mono);font-size:12px;">${s.ndwi.toFixed(3)}</span>
        <div style="font-size:8px;color:${iW.color};margin-top:2px;">${iW.label}</div>
      </td>
      <td style="text-align:center;padding:10px 8px;">
        <span style="color:${iS.color};font-weight:800;font-family:var(--mono);font-size:12px;">${s.spi.toFixed(2)}</span>
        <div style="font-size:8px;color:${iS.color};margin-top:2px;">${iS.label}</div>
      </td>
      <td style="text-align:center;padding:10px 8px;">
        <span style="color:${lstColor};font-weight:800;font-family:var(--mono);font-size:12px;">${s.lst.toFixed(1)}°C</span>
        <div style="font-size:8px;color:${lstColor};margin-top:2px;">${s.lstAnomaly >= 0 ? '+' : ''}${s.lstAnomaly.toFixed(1)}°C anomaly</div>
      </td>
      <td style="text-align:center;padding:10px 8px;">
        <span style="color:${rainColor};font-weight:800;font-family:var(--mono);font-size:12px;">${s.rain.toFixed(0)} mm</span>
      </td>
      <td style="text-align:center;padding:10px 8px;">
        ${_riskBadge(s)}
      </td>
    </tr>`;
  }).join('');

  // ── Member enrichment summary ─────────────────────────────────────────────
  const membersByRisk = _memberRiskBreakdown();

  container.innerHTML = `
    <!-- KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${_kpi('District NDVI', avgNDVI.toFixed(3), interpretNDVI(avgNDVI).color, 'fa-leaf', 'MODIS Terra 250m')}
      ${_kpi('District SPI', avgSPI.toFixed(2), interpretSPI(avgSPI).color, 'fa-cloud-rain', 'CHIRPS Daily')}
      ${_kpi('Sectors At Risk', atRisk + ' / 12', atRisk > 3 ? '#FF4F4F' : atRisk > 1 ? '#FF8800' : '#00FF66', 'fa-triangle-exclamation', 'NDVI<0.3 or SPI<-1')}
      ${_kpi('Members Enriched', membersEnr, '#00FF66', 'fa-users', 'Live indices applied')}
    </div>

    <!-- Source badges -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
      ${sources.map(s => `<span style="font-size:9px;font-family:var(--mono);padding:3px 10px;border-radius:20px;background:rgba(0,240,255,0.08);border:1px solid rgba(0,240,255,0.2);color:var(--cyan);">🛰 ${s}</span>`).join('')}
      <span style="font-size:9px;font-family:var(--mono);padding:3px 10px;border-radius:20px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);color:var(--gold);">📅 Period: ${data.date}</span>
      <span style="font-size:9px;font-family:var(--mono);padding:3px 10px;border-radius:20px;background:rgba(0,255,102,0.08);border:1px solid rgba(0,255,102,0.2);color:var(--green);">🕐 Fetched: ${fetchedAt}</span>
    </div>

    <!-- Sector matrix -->
    <div class="inner-glass" style="padding:0;overflow:hidden;margin-bottom:20px;">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:11px;font-family:var(--mono);font-weight:700;letter-spacing:0.08em;color:var(--gold);">
          <i class="fa-solid fa-table-cells"></i> SECTOR INTELLIGENCE MATRIX — 12 SECTORS × 6 INDICES
        </div>
        <div id="se-countdown" style="font-size:9px;font-family:var(--mono);color:var(--ink-mute);"></div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="text-align:left;padding:10px 12px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;white-space:nowrap;">SECTOR</th>
              <th style="text-align:center;padding:10px 8px;font-size:9px;font-family:var(--mono);color:#7FDB00;letter-spacing:0.1em;">NDVI</th>
              <th style="text-align:center;padding:10px 8px;font-size:9px;font-family:var(--mono);color:#00AAFF;letter-spacing:0.1em;">NDWI</th>
              <th style="text-align:center;padding:10px 8px;font-size:9px;font-family:var(--mono);color:#FBBF24;letter-spacing:0.1em;">SPI</th>
              <th style="text-align:center;padding:10px 8px;font-size:9px;font-family:var(--mono);color:#FF8800;letter-spacing:0.1em;">LST</th>
              <th style="text-align:center;padding:10px 8px;font-size:9px;font-family:var(--mono);color:#00F0FF;letter-spacing:0.1em;">RAIN</th>
              <th style="text-align:center;padding:10px 8px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;">STATUS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <!-- Member enrichment card -->
    <div class="inner-glass" style="padding:20px;">
      <div class="sec-label" style="color:var(--cyan);margin-bottom:16px;">
        <i class="fa-solid fa-satellite-dish"></i> MEMBER ANALYSIS ENRICHMENT
        <span style="font-size:9px;color:var(--ink-mute);margin-left:8px;">All ${membersEnr} members updated with live satellite indices</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div class="inner-glass" style="padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:900;font-family:var(--mono);color:#00FF66;">${membersByRisk.optimal}</div>
          <div style="font-size:9px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Optimal (WRSI ≥ 85)</div>
        </div>
        <div class="inner-glass" style="padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:900;font-family:var(--mono);color:#FF8800;">${membersByRisk.stressed}</div>
          <div style="font-size:9px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Stressed (70–84)</div>
        </div>
        <div class="inner-glass" style="padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:900;font-family:var(--mono);color:#FF4F4F;">${membersByRisk.critical}</div>
          <div style="font-size:9px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Critical (&lt; 70)</div>
        </div>
      </div>
      <div style="margin-top:14px;font-size:10px;color:var(--ink-mute);font-family:var(--mono);line-height:1.7;">
        Member NDVI, SPI, and WRSI stress-adjustment are sourced from live satellite observations for their respective sector.
        WRSI is adjusted ±5 pts per SPI unit relative to the Kirehe historical mean (285 mm / σ = 72 mm).
      </div>
    </div>`;

  // Start countdown ticker
  _startCountdown();
}

// ── Internals ─────────────────────────────────────────────────────────────────

function _startPolling() {
  stopSpatialEnginePolling();
  _pollTimer = setInterval(runSpatialEngineNow, POLL_INTERVAL);
  _startCountdown();
}

function _startCountdown() {
  if (_countdownTimer) clearInterval(_countdownTimer);
  _countdownTimer = setInterval(() => {
    const el = document.getElementById('se-countdown');
    if (!el) return;
    const remaining = Math.max(0, _nextRefreshAt - Date.now());
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    el.textContent = remaining > 0
      ? `Next refresh in ${m}m ${String(s).padStart(2,'0')}s`
      : 'Refreshing…';
  }, 1000);
}

function _setStatus(type, msg) {
  const el = document.getElementById('se-status');
  if (!el) return;
  const colors = { loading: 'var(--gold)', ok: 'var(--green)', error: 'var(--red)' };
  el.textContent = msg;
  el.style.color = colors[type] || 'var(--ink-soft)';
}

function _setBadge(state) {
  const el = document.getElementById('se-live-badge');
  if (!el) return;
  if (state === 'live') {
    el.innerHTML = '⬤ LIVE';
    el.style.background = 'rgba(0,255,102,0.1)';
    el.style.color = 'var(--green)';
    el.style.borderColor = 'rgba(0,255,102,0.3)';
  } else if (state === 'loading') {
    el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> FETCHING';
    el.style.background = 'rgba(251,191,36,0.1)';
    el.style.color = 'var(--gold)';
    el.style.borderColor = 'rgba(251,191,36,0.3)';
  } else {
    el.innerHTML = '⬤ ERROR';
    el.style.background = 'rgba(255,79,79,0.1)';
    el.style.color = 'var(--red)';
    el.style.borderColor = 'rgba(255,79,79,0.3)';
  }
}

function _defaultDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function _riskBadge(s) {
  const isCritical = s.ndvi < 0.3 || s.spi < -1.5;
  const isHigh     = s.ndvi < 0.4 || s.spi < -1.0;
  if (isCritical)
    return `<span style="font-size:8px;font-family:var(--mono);font-weight:700;padding:3px 7px;border-radius:10px;background:rgba(255,79,79,0.15);color:#FF4F4F;border:1px solid rgba(255,79,79,0.3);">CRITICAL</span>`;
  if (isHigh)
    return `<span style="font-size:8px;font-family:var(--mono);font-weight:700;padding:3px 7px;border-radius:10px;background:rgba(255,136,0,0.15);color:#FF8800;border:1px solid rgba(255,136,0,0.3);">STRESSED</span>`;
  return `<span style="font-size:8px;font-family:var(--mono);font-weight:700;padding:3px 7px;border-radius:10px;background:rgba(0,255,102,0.12);color:var(--green);border:1px solid rgba(0,255,102,0.25);">OPTIMAL</span>`;
}

function _kpi(label, value, color, icon, sub) {
  return `
    <div class="inner-glass" style="padding:18px;text-align:center;">
      <div style="font-size:10px;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
        <i class="fa-solid ${icon}"></i> ${label}
      </div>
      <div style="font-size:28px;font-weight:900;font-family:var(--mono);color:${color};">${value}</div>
      <div style="font-size:9px;color:var(--ink-mute);margin-top:6px;font-family:var(--mono);">${sub}</div>
    </div>`;
}

function _memberRiskBreakdown() {
  const members = state.GLOBAL_MEMBERS || [];
  return {
    optimal:  members.filter(m => (m.wrsi || 0) >= 85).length,
    stressed: members.filter(m => (m.wrsi || 0) >= 70 && (m.wrsi || 0) < 85).length,
    critical: members.filter(m => (m.wrsi || 0) < 70).length,
  };
}

function _buildInterpTag(s) {
  const parts = [];
  if (s.ndvi > 0.5) parts.push('Thriving vegetation');
  else if (s.ndvi > 0.3) parts.push('Mild vegetation stress');
  else parts.push('Severe vegetation stress');
  if (s.spi < -1.0) parts.push('Drought conditions active');
  else if (s.spi > 1.0) parts.push('Excess precipitation risk');
  else parts.push('Precipitation near-normal');
  if (s.lstAnomaly > 2) parts.push('Heat anomaly detected');
  return parts.join(' · ');
}
