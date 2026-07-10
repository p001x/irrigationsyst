// AgriAdapt — Spectral Intelligence Hub (NDVI / NDWI / SPI)
import { state }            from './state.js';
import { KIREHE_RF_MEAN }   from './constants.js';
import { computeSPI }       from './wrsi.js';
import { fetchSpectralData } from './api.js';

// ── Interpretation tables ────────────────────────────────────────────────────
export function interpretNDVI(v) {
  if (v > 0.7) return { label: 'Dense Vegetation',       color: '#00FF66' };
  if (v > 0.5) return { label: 'Healthy Vegetation',      color: '#7FDB00' };
  if (v > 0.3) return { label: 'Moderate Stress',         color: '#FBBF24' };
  if (v > 0.1) return { label: 'Sparse / Stressed',       color: '#FF8800' };
  return            { label: 'Bare Soil / Crop Failure', color: '#FF4F4F' };
}
export function interpretNDWI(v) {
  if (v > 0.3)  return { label: 'High Water Content',      color: '#00F0FF' };
  if (v > 0.0)  return { label: 'Adequate Moisture',       color: '#00AAFF' };
  if (v > -0.2) return { label: 'Mild Water Deficit',      color: '#FBBF24' };
  if (v > -0.4) return { label: 'Moderate Drought Stress', color: '#FF8800' };
  return              { label: 'Severe Water Deficit',     color: '#FF4F4F' };
}
export function interpretSPI(v) {
  if (v >  2.0) return { label: 'Extremely Wet',   color: '#00F0FF' };
  if (v >  1.5) return { label: 'Very Wet',         color: '#00AAFF' };
  if (v >  1.0) return { label: 'Moderately Wet',   color: '#0080FF' };
  if (v > -1.0) return { label: 'Near Normal',      color: '#00FF66' };
  if (v > -1.5) return { label: 'Moderate Drought', color: '#FBBF24' };
  if (v > -2.0) return { label: 'Severe Drought',   color: '#FF8800' };
  return              { label: 'Extreme Drought',   color: '#FF4F4F' };
}

// ── Mode toggle ──────────────────────────────────────────────────────────────
export function setSpectralMode(mode) {
  state.currentSpectralContext = mode;
  ['sim','upload','online'].forEach(m => {
    const panel = document.getElementById(`spectral-${m}`);
    const btn   = document.getElementById(`mode-${m}`);
    if (panel) panel.style.display = m === mode ? 'block' : 'none';
    if (btn)   btn.classList.toggle('active', m === mode);
  });
  state.isSpectralManual = false;
  if (mode === 'sim') resetSpectralToSim();
}

export function onSpectralSlider() {
  state.isSpectralManual = true;
  const ndvi = parseFloat(document.getElementById('sp-ndvi')?.value ?? 0.48);
  const ndwi = parseFloat(document.getElementById('sp-ndwi')?.value ?? 0.05);
  const spi  = parseFloat(document.getElementById('sp-spi')?.value  ?? -0.4);
  const iN   = interpretNDVI(ndvi), iW = interpretNDWI(ndwi), iS = interpretSPI(Math.max(-3, Math.min(3, spi)));
  window.safeSet?.('sp-ndvi-val', ndvi.toFixed(3)); window.safeStyle?.('sp-ndvi-val', 'color', iN.color);
  window.safeSet?.('sp-ndwi-val', ndwi.toFixed(3)); window.safeStyle?.('sp-ndwi-val', 'color', iW.color);
  window.safeSet?.('sp-spi-val',  spi.toFixed(2));  window.safeStyle?.('sp-spi-val',  'color', iS.color);
  const badge = document.getElementById('spectral-live-badge');
  if (badge) {
    const lbl = state.currentSpectralContext === 'online' ? 'ADJUSTING NASA DATA' : state.currentSpectralContext === 'upload' ? 'ADJUSTING UPLOADED DATA' : 'MANUAL OVERRIDE';
    badge.innerHTML = `⬤ ${lbl}`;
    badge.style.background = 'rgba(251,191,36,0.1)'; badge.style.color = 'var(--gold)'; badge.style.borderColor = 'rgba(251,191,36,0.3)';
  }
  displaySpectralResults(ndvi, ndwi, spi, state.currentSpectralContext);
}

export function resetSpectralToSim() { syncSpectralFromDashboard(); onSpectralSlider(); }
export function runSpectralSim()     { resetSpectralToSim(); }

export function syncSpectralFromDashboard() {
  if (state.isSpectralManual) return;
  if (!state.currentStudyLayer && !state.shpLayer) return;
  try {
    const i    = window.getInp?.(); if (!i) return;
    const ndvi = Math.max(-1, Math.min(1, i.ndvi));
    const ndwi = Math.max(-1, Math.min(1, (i.sm_rel - 0.75) * 1.8));
    const spi  = Math.max(-3, Math.min(3, computeSPI(i.rf_cumul)));
    const sp   = { ndvi: document.getElementById('sp-ndvi'), ndwi: document.getElementById('sp-ndwi'), spi: document.getElementById('sp-spi') };
    if (sp.ndvi) sp.ndvi.value = ndvi.toFixed(2);
    if (sp.ndwi) sp.ndwi.value = ndwi.toFixed(2);
    if (sp.spi)  sp.spi.value  = spi.toFixed(1);
    window.safeSet?.('sp-ndvi-val', ndvi.toFixed(3)); window.safeStyle?.('sp-ndvi-val', 'color', interpretNDVI(ndvi).color);
    window.safeSet?.('sp-ndwi-val', ndwi.toFixed(3)); window.safeStyle?.('sp-ndwi-val', 'color', interpretNDWI(ndwi).color);
    window.safeSet?.('sp-spi-val',  spi.toFixed(2));  window.safeStyle?.('sp-spi-val',  'color', interpretSPI(spi).color);
    const results = document.getElementById('spectral-results');
    if (results?.style.display !== 'none') displaySpectralResults(ndvi, ndwi, spi, 'sim');
  } catch (e) { /* panel not rendered yet */ }
}

// ── GeoTIFF band loading ─────────────────────────────────────────────────────
export async function loadBand(file, type) {
  if (!file) return;
  const statusEl = document.getElementById(`band-${type}-status`);
  if (statusEl) { statusEl.textContent = 'Loading…'; statusEl.style.color = 'var(--gold)'; }
  try {
    const tiff  = await GeoTIFF.fromArrayBuffer(await file.arrayBuffer());
    const image = await tiff.getImage();
    const data  = await image.readRasters();
    const band  = { data: data[0], width: image.getWidth(), height: image.getHeight(), bbox: image.getBoundingBox() };
    if (type === 'red')   state.bandRed   = band;
    if (type === 'nir')   state.bandNIR   = band;
    if (type === 'green') state.bandGreen = band;
    if (statusEl) { statusEl.textContent = `✅ ${file.name} (${band.width}×${band.height})`; statusEl.style.color = 'var(--green)'; }
  } catch (err) {
    if (statusEl) { statusEl.textContent = `❌ ${err.message}`; statusEl.style.color = 'var(--red)'; }
  }
}

// ── Band-index computation via Web Worker ────────────────────────────────────
export function computeBandIndex() {
  if (!state.bandRed || !state.bandNIR) { alert('Please upload at least the Red (B04) and NIR (B08) bands.'); return; }
  const { width, height, bbox } = state.bandRed;
  // Clone typed arrays before posting so state.band* remain usable for repeat runs
  const redData   = state.bandRed.data.slice();
  const nirData   = state.bandNIR.data.slice();
  const greenData = state.bandGreen ? state.bandGreen.data.slice() : null;

  const transferList = greenData
    ? [redData.buffer, nirData.buffer, greenData.buffer]
    : [redData.buffer, nirData.buffer];

  const worker = new Worker('/js/geotiff-worker.js');
  worker.postMessage({ redData, nirData, greenData, width, height }, transferList);

  worker.onmessage = ({ data }) => {
    const { pixelData, meanNDVI, meanNDWI } = data;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    img.data.set(pixelData);
    ctx.putImageData(img, 0, 0);

    if (state.map && bbox) {
      const bounds = [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
      if (state.spectralOverlay) state.map.removeLayer(state.spectralOverlay);
      state.spectralOverlay = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.75 }).addTo(state.map);
      state.map.fitBounds(bounds);
    }
    displaySpectralResults(meanNDVI, meanNDWI, computeSPI(window.getInp?.()?.rf_cumul ?? 285), 'band');
    worker.terminate();
  };
  worker.onerror = (err) => { console.error('GeoTIFF worker error:', err); worker.terminate(); };
}

// ── Online NASA GIBS + GEE ───────────────────────────────────────────────────
export async function fetchOnlineNDVI() {
  const dateVal = document.getElementById('online-date')?.value;
  const layer   = document.getElementById('online-layer')?.value || 'MODIS_Terra_L3_NDVI_Monthly';
  if (!dateVal) { alert('Please select a date.'); return; }
  const [year, month] = dateVal.split('-').map(Number);
  if (new Date(year, month - 1) > new Date()) { alert(`🚨 FUTURE DATA ERROR: Data for ${dateVal} does not exist yet.`); return; }
  if (layer.includes('Landsat9') && year < 2021) { alert(`🛰 Landsat 9 launched Sept 2021.`); return; }
  if (layer.includes('Landsat8') && year < 2013) { alert(`🛰 Landsat 8 launched Feb 2013.`);  return; }
  if (layer.includes('MODIS')    && year < 2000) { alert(`🛰 MODIS Terra begins Feb 2000.`);   return; }
  window.safeSet?.('online-status', '⏳ Connecting to NASA GIBS WMS…');
  try {
    if (!state.map) { window.safeSet?.('online-status', '❌ Asset Map uninitialized.'); return; }
    const bounds = window.getActiveStudyBounds?.();
    if (!bounds) { window.safeSet?.('online-status', '❌ Define a study area on map first.'); alert('🚨 SPATIAL LOCK: Define a study area first.'); return; }
    if (state.ndviWMSLayer) state.map.removeLayer(state.ndviWMSLayer);
    state.ndviWMSLayer = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
      layers: layer, format: 'image/png', transparent: true, version: '1.3.0',
      time: `${dateVal}-01`, opacity: 0.80, bounds, attribution: 'NASA GIBS / MODIS Terra',
    }).addTo(state.map);
    state.map.fitBounds(bounds, { padding: [50, 50] });
    state.currentSpectralContext = 'online'; state.isSpectralManual = false;
    const { _northEast: ne, _southWest: sw } = bounds;
    const coords = [[[sw.lng,sw.lat],[ne.lng,sw.lat],[ne.lng,ne.lat],[sw.lng,ne.lat],[sw.lng,sw.lat]]];
    window.safeSet?.('online-status', `⏳ Fetching GEE data for ${dateVal}...`);
    const { ndvi, ndwi, spi } = await fetchSpectralData(dateVal, coords);
    ['ndvi','ndwi','spi'].forEach((k, idx) => {
      const el = document.getElementById('sp-' + k);
      if (el) el.value = [ndvi, ndwi, spi][idx].toFixed(k === 'spi' ? 1 : 2);
    });
    const src = layer.includes('Landsat') ? 'Earth Engine Landsat 8/9' : 'Earth Engine MODIS Terra + CHIRPS';
    displaySpectralResults(ndvi, ndwi, spi, `${src} (Real Data) · ${dateVal}`);
    window.safeSet?.('online-status', `✅ Real GEE data loaded for ${dateVal}`);
  } catch (err) { window.safeSet?.('online-status', `❌ ${err.message}`); }
}

// ── Results display ──────────────────────────────────────────────────────────
export function displaySpectralResults(ndvi, ndwi, spi, source) {
  const iN = interpretNDVI(ndvi), iW = interpretNDWI(ndwi);
  const sc = Math.max(-3, Math.min(3, spi)), iS = interpretSPI(sc);
  const interp    = _generateInterpretation(ndvi, ndwi, spi, iN, iW, iS);
  const irrigation = _generateIrrigationPlan(ndvi, ndwi, spi);
  const srcLabel = source === 'sim'  ? 'Simulation — dashboard sliders'
    : source === 'band' ? 'Computed from uploaded GeoTIFF bands'
    : source.includes('Real Data') ? source : 'NASA GIBS WMS';
  window.safeHTML?.('spectral-results-content', `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
      ${_gauge('NDVI', ndvi, -1, 1, iN)}${_gauge('NDWI', ndwi, -1, 1, iW)}${_gauge('SPI', sc, -3, 3, iS)}
    </div>
    <div class="inner-glass" style="padding:20px;margin-bottom:14px;">
      <div class="sec-label" style="margin-bottom:14px;color:var(--gold);">
        <i class="fa-solid fa-brain" aria-hidden="true"></i> AI Field Interpretation
      </div>
      <div style="font-family:var(--serif);font-size:13px;line-height:1.9;color:rgba(255,255,255,0.85);" aria-live="polite">${interp}</div>
      <div style="margin-top:15px;padding-top:12px;border-top:1px solid var(--border);font-size:10px;color:var(--ink-mute);font-family:var(--mono);">
        ${srcLabel} · ${new Date().toLocaleString()}
      </div>
    </div>
    ${irrigation}`);
  window.safeStyle?.('spectral-results', 'display', 'block');
  window.safeSet?.('spectral-interpretation', interp);

  // Sync spectral data to the active member's profile
  if (state.lastActiveArea) {
    const popup = state.lastActiveArea.getPopup?.();
    const match = popup?.getContent().match(/STAKEHOLDER: (.*?)<\/div>/);
    if (match) {
      const member = state.GLOBAL_MEMBERS.find(m => m.name.trim() === match[1].trim());
      if (member) { member.ndvi = ndvi; member.spi = spi; member.ai_interp = interp; }
    }
  }
}

function _gauge(name, value, min, max, interp) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return `
    <div class="inner-glass" style="padding:16px;text-align:center;">
      <div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">${name}</div>
      <div style="font-size:30px;font-weight:900;color:${interp.color};font-family:var(--mono);" aria-label="${name} ${value.toFixed(3)}">${value.toFixed(3)}</div>
      <div role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${name} gauge"
           style="margin:12px 0 8px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${interp.color};transition:width 0.6s ease;"></div>
      </div>
      <div style="font-size:11px;color:${interp.color};font-weight:700;">${interp.label}</div>
    </div>`;
}

// ── Irrigation prescription engine ───────────────────────────────────────────
function _generateIrrigationPlan(ndvi, ndwi, spi) {
  // Derive stress tier from indices
  const isCritical   = ndvi < 0.3  || ndwi < -0.3 || spi < -1.5;
  const isElevated   = ndvi < 0.45 || ndwi < 0.05 || spi < -0.8;
  const isMonitor    = ndvi < 0.55 || spi < -0.3;

  const tier = isCritical ? 'critical' : isElevated ? 'elevated' : isMonitor ? 'monitor' : 'optimal';

  const tierMeta = {
    critical: { label: 'CRITICAL — Emergency Irrigation Required', color: '#FF4F4F', bg: 'rgba(255,79,79,0.08)', border: 'rgba(255,79,79,0.25)', icon: 'fa-circle-exclamation' },
    elevated: { label: 'ELEVATED — Supplemental Irrigation Active', color: '#FF8800', bg: 'rgba(255,136,0,0.08)', border: 'rgba(255,136,0,0.25)', icon: 'fa-triangle-exclamation' },
    monitor:  { label: 'PRECAUTIONARY — Light Supplemental Advised', color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', icon: 'fa-droplet' },
    optimal:  { label: 'OPTIMAL — Standard Protocol', color: '#00FF66', bg: 'rgba(0,255,102,0.06)', border: 'rgba(0,255,102,0.2)', icon: 'fa-circle-check' },
  };
  const m = tierMeta[tier];

  // Per-crop schedule (frequency, volume ml/m², timing, method)
  const crops = [
    { name: 'Maize',      icon: '🌽', base: { freq: 2, vol: 28, timing: '05:30–07:00', method: 'Pivot sprinkler' } },
    { name: 'Beans',      icon: '🫘', base: { freq: 2, vol: 22, timing: '05:30–07:00', method: 'Drip line' } },
    { name: 'Coffee',     icon: '☕', base: { freq: 1, vol: 18, timing: '06:00–07:30', method: 'Drip ring' } },
    { name: 'Vegetables', icon: '🥬', base: { freq: 3, vol: 16, timing: '05:00–06:30', method: 'Micro-spray' } },
  ];

  // Multipliers by tier
  const freqMult = { critical: 1.5, elevated: 1.25, monitor: 1.0, optimal: 0.75 };
  const volMult  = { critical: 1.4, elevated: 1.2,  monitor: 1.05, optimal: 0.9  };

  const rows = crops.map(c => {
    const freq = Math.min(7, Math.round(c.base.freq * freqMult[tier]));
    const vol  = Math.round(c.base.vol * volMult[tier]);
    const freqLabel = freq >= 7 ? 'Daily' : `${freq}× / week`;
    const urgColor  = tier === 'critical' ? '#FF4F4F' : tier === 'elevated' ? '#FF8800' : tier === 'monitor' ? '#FBBF24' : '#00FF66';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px 12px;font-size:12px;">${c.icon} <strong>${c.name}</strong></td>
      <td style="padding:10px 8px;text-align:center;font-family:var(--mono);font-size:11px;color:${urgColor};font-weight:700;">${freqLabel}</td>
      <td style="padding:10px 8px;text-align:center;font-family:var(--mono);font-size:11px;">${vol} mm/app</td>
      <td style="padding:10px 8px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--ink-soft);">${c.base.timing}</td>
      <td style="padding:10px 8px;text-align:center;font-size:10px;color:var(--ink-soft);">${c.base.method}</td>
    </tr>`;
  }).join('');

  // Sector priority order: highest-fert / most stressed first
  const sectorPriority = spi < -0.5
    ? 'Nasho → Mushikiri → Gatore → Kigina → Kirehe (standard rotation)'
    : 'Standard rotation: Nasho → Mushikiri → all other sectors';

  // Water budget note
  const dailyMmEst = tier === 'critical' ? '35–45 mm/day' : tier === 'elevated' ? '25–35 mm/day' : tier === 'monitor' ? '15–25 mm/day' : '10–15 mm/day';
  const solarNote  = tier === 'critical'
    ? '⚡ Run all 63 pivots. Engage battery backup between 18:00–06:00.'
    : tier === 'elevated'
    ? '⚡ Activate 75 % pivot capacity (≈47 pivots). Monitor reservoir daily.'
    : '⚡ Standard 50 % pivot rotation (≈32 pivots). Solar surplus available.';

  return `
  <div class="inner-glass" style="padding:20px;border:1px solid ${m.border};background:${m.bg};">
    <div class="sec-label" style="margin-bottom:16px;color:${m.color};">
      <i class="fa-solid ${m.icon}" aria-hidden="true"></i> Irrigation Prescription — ${m.label}
    </div>

    <!-- Per-crop schedule table -->
    <div style="overflow-x:auto;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:8px 12px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;">CROP</th>
            <th style="text-align:center;padding:8px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;">FREQUENCY</th>
            <th style="text-align:center;padding:8px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;">VOLUME</th>
            <th style="text-align:center;padding:8px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;">WINDOW</th>
            <th style="text-align:center;padding:8px;font-size:9px;font-family:var(--mono);color:var(--ink-mute);letter-spacing:0.1em;">METHOD</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Operational guidance -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      <div class="inner-glass" style="padding:12px;">
        <div style="font-size:9px;font-family:var(--mono);color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">💧 Water Budget</div>
        <div style="font-size:12px;font-weight:700;color:${m.color};font-family:var(--mono);">${dailyMmEst}</div>
        <div style="font-size:10px;color:var(--ink-soft);margin-top:4px;">district-wide daily target</div>
      </div>
      <div class="inner-glass" style="padding:12px;">
        <div style="font-size:9px;font-family:var(--mono);color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">🗺️ Sector Priority</div>
        <div style="font-size:10px;color:var(--ink-soft);line-height:1.5;">${sectorPriority}</div>
      </div>
    </div>

    <!-- Solar-pivot note -->
    <div style="padding:10px 14px;border-radius:10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);font-size:11px;color:var(--ink-soft);font-family:var(--mono);">
      ${solarNote}
    </div>

    <!-- Index rationale -->
    <div style="margin-top:12px;font-size:10px;color:var(--ink-mute);font-family:var(--mono);line-height:1.8;border-top:1px solid var(--border);padding-top:10px;">
      Prescription basis: NDVI ${ndvi.toFixed(3)} · NDWI ${ndwi.toFixed(3)} · SPI ${spi.toFixed(2)} · Updated ${new Date().toLocaleTimeString()}
    </div>
  </div>`;
}

function _generateInterpretation(ndvi, ndwi, spi, iN, iW, iS) {
  const p = [];
  if (ndvi > 0.5)       p.push(`🌿 <strong>Vegetation is thriving</strong> (NDVI: ${ndvi.toFixed(2)}). Chlorophyll density is high, indicating robust photosynthetic activity.`);
  else if (ndvi > 0.3)  p.push(`⚠️ <strong>Vegetation shows mild stress</strong> (NDVI: ${ndvi.toFixed(2)}). Canopy density below optimal — emerging water or nutrient deficiency.`);
  else                  p.push(`🚨 <strong>Severe vegetation stress</strong> (NDVI: ${ndvi.toFixed(2)}). Significant yield reduction probable without immediate intervention.`);
  if (ndwi > 0.0)       p.push(`💧 <strong>Water content adequate</strong> (NDWI: ${ndwi.toFixed(2)}). Soil and canopy water within healthy threshold.`);
  else if (ndwi > -0.3) p.push(`⚠️ <strong>Mild water deficit</strong> (NDWI: ${ndwi.toFixed(2)}). Recommend increased irrigation frequency.`);
  else                  p.push(`🚨 <strong>Significant water stress</strong> (NDWI: ${ndwi.toFixed(2)}). Emergency supplemental irrigation advised.`);
  if (Math.abs(spi) < 1.0) p.push(`☁️ <strong>Precipitation near-normal</strong> (SPI: ${spi.toFixed(2)}). Rainfall within ±1 SD of CHIRPS historical mean (${KIREHE_RF_MEAN}mm).`);
  else if (spi < -1.5)     p.push(`🌵 <strong>Meteorological drought confirmed</strong> (SPI: ${spi.toFixed(2)}). Solar-powered irrigation grid is the critical buffer.`);
  else if (spi > 1.5)      p.push(`🌊 <strong>Excess precipitation risk</strong> (SPI: ${spi.toFixed(2)}). Monitor drainage in low-lying sectors.`);
  const isCritical = [iN.color, iW.color, iS.color].includes('#FF4F4F');
  const isHigh     = [iN.color, iW.color, iS.color].includes('#FF8800');
  if (isCritical) p.push(`📋 <strong>RECOMMENDATION:</strong> <span style="color:var(--red);font-weight:800;">CRITICAL agricultural stress event.</span> Activate full irrigation grid; escalate to district agronomist.`);
  else if (isHigh) p.push(`📋 <strong>RECOMMENDATION:</strong> <span style="color:#FF8800;font-weight:800;">Elevated stress.</span> Increase irrigation output by 30%.`);
  else             p.push(`📋 <strong>RECOMMENDATION:</strong> Conditions within <span style="color:var(--green);font-weight:800;">manageable range.</span> Continue standard AGRIAdapt protocol.`);
  return p.join('<br><br>');
}
