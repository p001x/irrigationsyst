// AgriAdapt — Reporting, Export & Analysis Hub
import { state }                             from './state.js';
import { CROP_DATA, KIREHE_SECTORS, MARKET_PRICE_RWF_T, KIREHE_RF_MEAN, KIREHE_RF_STD } from './constants.js';

let _exportRetrying  = false;
let _analysisRetrying = false;

export function renderExportHub() {
  const grid = document.getElementById('export-grid');
  if (!grid) return;
  if (!state.GLOBAL_MEMBERS.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:80px;text-align:center;color:var(--ink-soft);">Loading member data…</div>';
    if (!_exportRetrying) {
      _exportRetrying = true;
      window._seedMembers?.();
      setTimeout(() => { _exportRetrying = false; renderExportHub(); }, 800);
    }
    return;
  }
  grid.innerHTML = '';
  state.GLOBAL_MEMBERS.forEach(m => {
    const div = document.createElement('div');
    div.className = 'inner-glass';
    div.style.cssText = 'padding:20px;border-left:4px solid var(--cyan);';
    const hasSat = m.ndvi !== 0.45;
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <div style="font-size:16px;font-weight:900;">${m.name}</div>
          <div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;">${m.sector || 'Kirehe'} · ${m.crop}</div>
        </div>
        <div style="font-size:12px;font-family:var(--mono);color:var(--cyan);">${m.ha} ha</div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;">
        <div style="flex:1;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
          <div style="font-size:9px;color:var(--ink-mute);">Verified NDVI</div>
          <div style="font-weight:bold;">${(m.ndvi ?? 0.45).toFixed(2)}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
          <div style="font-size:9px;color:var(--ink-mute);">Status</div>
          <div style="color:${hasSat ? 'var(--green)' : 'var(--gold)'};font-size:10px;font-weight:bold;">${hasSat ? 'SATELLITE SYNC' : 'OFFLINE'}</div>
        </div>
      </div>
      <button class="btn btn-mini" style="width:100%;margin-top:20px;background:var(--green);color:#000;border:none;font-weight:800;"
              onclick="generateIndividualReport('${m.id}')" aria-label="Export analysis report for ${m.name}">
        <i class="fa-solid fa-file-export" aria-hidden="true"></i> Export Analysis Report
      </button>`;
    grid.appendChild(div);
  });
}

export function generateIndividualReport(mid) {
  const m = state.GLOBAL_MEMBERS.find(gm => gm.id === mid);
  if (!m) return;
  window.safeSet?.('rpt-id',     `K-CERT-${m.id}`);
  window.safeSet?.('rpt-name',   m.name);
  window.safeSet?.('rpt-sector', (m.sector || 'Kirehe') + ' Sector');
  window.safeSet?.('rpt-ha',     m.ha + ' ha');
  window.safeSet?.('rpt-crop',   m.crop + ' Field');
  window.safeSet?.('rpt-ndvi',   (m.ndvi ?? 0.45).toFixed(2));
  window.safeSet?.('rpt-spi',    (m.spi  ?? 0.00).toFixed(2));
  window.safeSet?.('rpt-wrsi',   (m.wrsi || 0) + '%');
  window.safeSet?.('rpt-rev',    Math.round(m.yield_rwf || 0).toLocaleString() + ' RWF');
  window.safeSet?.('rpt-ai',     m.ai_interp || 'Baseline simulation data. Direct satellite verification recommended.');
  const printArea = document.getElementById('print-area');
  if (printArea) printArea.style.display = 'block';
  window.print();
  if (printArea) printArea.style.display = 'none';
}

export function renderAnalysisHub() {
  const grid       = document.getElementById('analysis-grid');
  const summaryHub = document.getElementById('analysis-summary-hub');
  if (!grid) return;
  Object.assign(grid.style, { display: 'grid', minHeight: '400px', width: '100%' });

  const search       = document.getElementById('analysis-search')?.value.toLowerCase() || '';
  const filterSector = document.getElementById('analysis-filter-sector')?.value || 'all';
  const filterRisk   = document.getElementById('analysis-filter-risk')?.value || 'all';

  const _raw     = window.getInp?.() || {};
  const i        = {
    dekad:         _raw.dekad         ?? 6,
    soil_ph:       _raw.soil_ph       ?? 6.5,
    rf_cumul:      _raw.rf_cumul      ?? 285,
    cdd:           _raw.cdd           ?? 7,
    sm_rel:        _raw.sm_rel        ?? 0.70,
    ndvi:          _raw.ndvi          ?? 0.45,
    solar_mw:      _raw.solar_mw      ?? 0,
    pivots_active: _raw.pivots_active ?? 0,
    reservoir:     _raw.reservoir     ?? 0,
  };
  const baseWRSI = window.computeBaselineWRSI?.(i) || 75;
  const optWRSI  = window.computeOptimizedWRSI?.(baseWRSI, i) || 85;

  if (!state.GLOBAL_MEMBERS.length) {
    grid.innerHTML = '<div style="padding:80px;text-align:center;color:var(--ink-soft);">No members found. Seeding data…</div>';
    if (!_analysisRetrying) {
      _analysisRetrying = true;
      window._seedMembers?.();
      setTimeout(() => { _analysisRetrying = false; renderAnalysisHub(); }, 1000);
    }
    return;
  }

  const filtered = state.GLOBAL_MEMBERS.filter(m => {
    if (!m.name.toLowerCase().includes(search))              return false;
    if (filterSector !== 'all' && m.sector !== filterSector) return false;
    const mW = Math.min(100, Math.round(optWRSI / (CROP_DATA[m.crop] || CROP_DATA.Maize).weight));
    if (filterRisk === 'high' && mW < 80)                    return false;
    if (filterRisk === 'med'  && (mW < 70 || mW >= 80))      return false;
    if (filterRisk === 'low'  && mW >= 70)                   return false;
    return true;
  });

  let totalHa = 0, totalRev = 0, sumWrsi = 0, critCount = 0;
  filtered.forEach(m => {
    const crop  = CROP_DATA[m.crop] || CROP_DATA.Maize;
    const sProf = KIREHE_SECTORS.find(s => s.n === m.sector) || { fert: 1.0 };
    const mW    = Math.min(100, Math.round(optWRSI / crop.weight));
    totalHa  += m.ha;
    totalRev += m.ha * crop.yield * sProf.fert * (mW / 100) * MARKET_PRICE_RWF_T;
    sumWrsi  += mW;
    if (mW < 70) critCount++;
  });
  const avgWrsi = filtered.length ? Math.round(sumWrsi / filtered.length) : 0;

  if (summaryHub) {
    const wColor = avgWrsi > 75 ? 'var(--green)' : 'var(--gold)';
    const cColor = critCount  > 0 ? 'var(--red)'  : 'var(--green)';
    summaryHub.innerHTML = `
      <div class="stat-pill" style="border-left:4px solid var(--cyan);">
        <div style="font-size:10px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Registered Stakeholders</div>
        <div style="font-size:28px;font-family:var(--cab);font-weight:900;color:white;margin-top:8px;">${filtered.length}
          <span style="font-size:12px;font-weight:400;color:var(--ink-mute);font-family:var(--mono);">Filtered Active</span></div>
      </div>
      <div class="stat-pill" style="border-left:4px solid ${wColor};">
        <div style="font-size:10px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Overall Vitality (WRSI)</div>
        <div style="font-size:28px;font-family:var(--cab);font-weight:900;color:${wColor};margin-top:8px;">${avgWrsi}%</div>
      </div>
      <div class="stat-pill" style="border-left:4px solid var(--green);">
        <div style="font-size:10px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Community Economic Yield</div>
        <div style="font-size:28px;font-family:var(--cab);font-weight:900;color:var(--green);margin-top:8px;">${Math.round(totalRev).toLocaleString()}
          <span style="font-size:14px;font-family:var(--mono);">RWF</span></div>
      </div>
      <div class="stat-pill" style="border-left:4px solid ${cColor};">
        <div style="font-size:10px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Critical Risk Alerts</div>
        <div style="font-size:28px;font-family:var(--cab);font-weight:900;color:${cColor};margin-top:8px;">${critCount}
          <span style="font-size:12px;font-weight:400;color:var(--ink-mute);font-family:var(--mono);">Fields</span></div>
      </div>`;
  }

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:80px;text-align:center;color:var(--ink-mute);">No stakeholders match your filter criteria.</div>';
    return;
  }
  Object.assign(grid.style, { gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' });

  grid.innerHTML = filtered.map(m => {
    const crop      = CROP_DATA[m.crop] || CROP_DATA.Maize;
    const sProf     = KIREHE_SECTORS.find(s => s.n === m.sector) || { fert: 1.0 };
    const mBaseWrsi = Math.min(100, Math.round(baseWRSI / crop.weight));
    const mOptWrsi  = Math.min(100, Math.round(optWRSI  / crop.weight));
    const potTons   = m.ha * crop.yield * sProf.fert;
    const optRev    = potTons * (mOptWrsi / 100) * MARKET_PRICE_RWF_T;
    const phImpact  = (i.soil_ph < 5.5 || i.soil_ph > 8.0) ? 'Critical Lockout' : (i.soil_ph < 6.0 || i.soil_ph > 7.5) ? 'Acid Stress' : 'Optimal Intake';
    const riskColor = mOptWrsi > 80 ? 'var(--green)' : mOptWrsi > 70 ? 'var(--gold)' : 'var(--red)';
    const ptagCls   = mOptWrsi > 80 ? 'pt-lo' : mOptWrsi > 70 ? 'pt-med' : 'pt-hi';
    const status    = mOptWrsi > 80 ? 'STABLE' : mOptWrsi > 70 ? 'RECOVERING' : 'CRITICAL';
    const dekad     = i.dekad || 6;
    const sparks    = Array.from({ length: 12 }, (_, k) => {
      const h   = k < dekad ? Math.max((mOptWrsi * ((k+1)/12) * 0.4), 4) : 4;
      const cur = k === dekad - 1;
      return `<div class="spark-bar ${k < dekad ? 'opt-fill' : ''}" style="height:${h}px;background:${k < dekad ? riskColor : 'rgba(255,255,255,0.05)'};box-shadow:${cur ? '0 0 15px ' + riskColor : 'none'};opacity:${k < dekad ? '1' : '0.3'};${cur ? 'border:1px solid white;' : ''}"></div>`;
    }).join('');

    return `
      <div class="inner-glass analysis-card" role="article" aria-label="${m.name} field report"
           style="padding:28px;border-top:4px solid ${riskColor};display:flex;flex-direction:column;justify-content:space-between;overflow:visible;height:100%;min-height:420px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:10px;color:var(--cyan);font-family:var(--mono);text-transform:uppercase;font-weight:700;margin-bottom:4px;">${m.id}</div>
            <div style="font-size:20px;font-weight:900;line-height:1.2;color:var(--ink);">${m.name}</div>
            <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">
              <i class="fa-solid fa-location-dot" aria-hidden="true" style="opacity:0.6;"></i> ${m.sector}
              <span style="margin:0 4px;opacity:0.3;">|</span>
              <i class="fa-solid fa-seedling" aria-hidden="true" style="opacity:0.6;"></i> ${m.crop}
              <span style="margin:0 4px;opacity:0.3;">|</span> ${m.ha} HA
            </div>
          </div>
          <div class="ptag ${ptagCls}" role="status" aria-label="Field status: ${status}">${status}</div>
        </div>
        <div style="margin-top:20px;padding:8px 12px;border-radius:7px;background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.18);display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 6px var(--cyan);flex-shrink:0;animation:pulse 1.8s infinite;"></span>
          <span style="font-size:9px;font-family:var(--mono);color:var(--cyan);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Spectral Intelligence · Live Feed</span>
          <span style="margin-left:auto;font-size:9px;font-family:var(--mono);color:var(--ink-mute);">ERA5-Land · CHIRPS · MODIS</span>
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:8px;">
          <div class="stat-pill"><div style="font-size:8px;color:var(--ink-mute);font-family:var(--mono);text-transform:uppercase;">RF_CUMUL</div><div style="font-size:14px;font-family:var(--mono);font-weight:800;color:#60A5FA;margin-top:4px;">${i.rf_cumul}<span style="font-size:8px;opacity:.6;"> mm</span></div></div>
          <div class="stat-pill"><div style="font-size:8px;color:var(--ink-mute);font-family:var(--mono);text-transform:uppercase;">CDD</div><div style="font-size:14px;font-family:var(--mono);font-weight:800;color:${i.cdd > 14 ? 'var(--red)' : i.cdd > 7 ? 'var(--gold)' : 'var(--green)'};margin-top:4px;">${i.cdd}<span style="font-size:8px;opacity:.6;"> d</span></div></div>
          <div class="stat-pill"><div style="font-size:8px;color:var(--ink-mute);font-family:var(--mono);text-transform:uppercase;">SM_D8</div><div style="font-size:14px;font-family:var(--mono);font-weight:800;color:${i.sm_rel >= 0.7 ? '#60A5FA' : 'var(--gold)'};margin-top:4px;">${i.sm_rel.toFixed(2)}</div></div>
          <div class="stat-pill"><div style="font-size:8px;color:var(--ink-mute);font-family:var(--mono);text-transform:uppercase;">NDVI</div><div style="font-size:14px;font-family:var(--mono);font-weight:800;color:${i.ndvi >= 0.55 ? '#7FDB00' : i.ndvi >= 0.35 ? 'var(--gold)' : 'var(--red)'};margin-top:4px;">${i.ndvi.toFixed(3)}</div></div>
        </div>
        <div class="stat-grid" style="margin-top:8px;">
          <div class="stat-pill"><div style="font-size:9px;color:var(--ink-mute);font-family:var(--mono);text-transform:uppercase;">Optimized Income</div><div style="font-size:16px;font-family:var(--mono);font-weight:800;color:var(--green);margin-top:4px;">${(optRev||0).toLocaleString()} RWF</div></div>
          <div class="stat-pill"><div style="font-size:9px;color:var(--ink-mute);font-family:var(--mono);text-transform:uppercase;">Soil Biome</div><div style="font-size:13px;font-weight:800;color:var(--ink);margin-top:4px;">${phImpact}</div></div>
        </div>
        <div style="margin-top:25px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:10px;margin-bottom:8px;">
            <span style="color:var(--ink-soft);font-family:var(--mono);text-transform:uppercase;">Seasonal Growth Curve</span>
            <span style="color:${riskColor};font-weight:900;font-family:var(--cab);font-size:16px;" aria-label="Vitality ${mOptWrsi}%">${mOptWrsi}% VITALITY</span>
          </div>
          <div class="spark-box" role="img" aria-label="Seasonal growth sparkline"
               style="height:45px;display:flex;align-items:flex-end;gap:4px;padding:8px 10px;border-radius:8px;">${sparks}</div>
        </div>
        <div class="insight-tag" style="margin-top:20px;padding:14px;border-radius:10px;background:var(--paper);border:1px dashed var(--border);display:flex;gap:12px;align-items:flex-start;">
          <i class="fa-solid fa-microchip" aria-hidden="true" style="color:var(--cyan);font-size:14px;margin-top:2px;"></i>
          <span style="font-size:12px;color:var(--ink-soft);font-family:var(--serif);line-height:1.5;">${_memberInsight(m, mOptWrsi, dekad, i)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:25px;">
          <button class="btn-mini" onclick="generateIndividualReport('${m.id}')" aria-label="Download PDF for ${m.name}"
                  style="background:var(--paper);border:1px solid var(--border);color:var(--ink-soft);width:100%;padding:10px;">
            <i class="fa-regular fa-file-pdf" aria-hidden="true"></i> Download PDF
          </button>
          <button class="btn-mini" onclick="generateIndividualReport('${m.id}')" aria-label="Print field report for ${m.name}"
                  style="background:var(--cyan-pale);color:var(--cyan);border-color:var(--cyan);width:100%;padding:10px;">
            <i class="fa-solid fa-print" aria-hidden="true"></i> Field Report
          </button>
        </div>
      </div>`;
  }).join('');
}

function _memberInsight(m, wrsi, dekad, inp) {
  // Use stored ai_interp only when genuinely personalised
  const PLACEHOLDERS = ['Baseline simulation data', 'Newly registered'];
  if (m.ai_interp && !PLACEHOLDERS.some(p => m.ai_interp.includes(p)))
    return m.ai_interp.split('<br>')[0].replace(/<\/?[^>]+(>|$)/g, '');

  // Live spectral readings — all from getInp() / Spectral Intelligence Hub
  const rf   = inp?.rf_cumul ?? 285;
  const cdd  = inp?.cdd      ?? 7;
  const sm   = inp?.sm_rel   ?? 0.7;
  const ndvi = inp?.ndvi     ?? 0.45;
  const spi  = parseFloat(((rf - KIREHE_RF_MEAN) / KIREHE_RF_STD).toFixed(2));

  // Derived labels from live sensor values
  const spiLabel  = spi >= 0.5  ? 'above-average rainfall'  : spi <= -0.5 ? 'below-average rainfall' : 'near-normal rainfall';
  const ndviLabel = ndvi >= 0.55 ? 'strong canopy'           : ndvi >= 0.45 ? 'healthy canopy'         : 'stressed canopy';
  const smLabel   = sm   >= 0.7  ? 'adequate soil moisture'  : sm   >= 0.5  ? 'marginal soil moisture' : 'low soil moisture';
  const cddNote   = cdd  > 14    ? `⚠ ${cdd}-day dry streak — critical`
                  : cdd  > 7     ? `${cdd} consecutive dry days — watch`
                  : `${cdd} CDD — within safe range`;

  // Member financials
  const cropDef  = CROP_DATA[m.crop]  || CROP_DATA.Maize;
  const sectProf = KIREHE_SECTORS.find(s => s.n === m.sector) || { fert: 1.0 };
  const yieldT   = parseFloat((m.ha * cropDef.yield * sectProf.fert * (wrsi / 100)).toFixed(2));
  const incomeK  = Math.round(yieldT * MARKET_PRICE_RWF_T / 1000);

  if (dekad >= 10) {
    return `<strong>Harvest Window:</strong> ${m.name.split(' ')[0]}'s ${m.ha} ha ${m.crop} in ${m.sector} — WRSI ${wrsi}%, ${ndviLabel} (NDVI ${ndvi.toFixed(3)}), SPI ${spi.toFixed(2)} (${spiLabel}). Projected yield ≈ ${yieldT} t — est. income <strong>${incomeK.toLocaleString()} K RWF</strong>.`;
  }
  if (wrsi < 70) {
    return `<strong>Critical — Water Deficit:</strong> WRSI ${wrsi}% on ${m.ha} ha ${m.crop}, ${m.sector}. Live spectral: RF_CUMUL ${rf} mm, ${cddNote}, SM_D8 ${sm.toFixed(2)} (${smLabel}), NDVI ${ndvi.toFixed(3)}. Daily solar-pivot irrigation required. Projected income: <strong>${incomeK.toLocaleString()} K RWF</strong>.`;
  }
  if (wrsi < 80) {
    return `<strong>Moisture Stress:</strong> WRSI ${wrsi}% — marginal deficit on ${m.ha} ha ${m.crop}, ${m.sector}. Spectral hub: ${rf} mm cumulative rain (SPI ${spi.toFixed(2)}, ${spiLabel}), ${cddNote}, SM_D8 ${sm.toFixed(2)}, NDVI ${ndvi.toFixed(3)} (${ndviLabel}). Supplemental irrigation recommended. Est. yield ${yieldT} t — <strong>${incomeK.toLocaleString()} K RWF</strong>.`;
  }
  if (m.ha > 7) {
    return `<strong>High-Value Asset:</strong> ${m.ha} ha ${m.crop}, ${m.sector} at WRSI ${wrsi}%. Live feed: RF ${rf} mm (SPI ${spi.toFixed(2)}), NDVI ${ndvi.toFixed(3)} (${ndviLabel}), SM ${sm.toFixed(2)}. Sector fertility ${sectProf.fert.toFixed(2)}×. Projected yield ${yieldT} t — <strong>${incomeK.toLocaleString()} K RWF</strong>.`;
  }
  return `<strong>Operational Nominal:</strong> ${m.sector} ${m.crop} (${m.ha} ha), WRSI ${wrsi}%. Spectral engine reads RF_CUMUL ${rf} mm, ${cddNote}, SM_D8 ${sm.toFixed(2)} (${smLabel}), NDVI ${ndvi.toFixed(3)} (${ndviLabel}), SPI ${spi.toFixed(2)}. Projected yield ≈ ${yieldT} t — est. income <strong>${incomeK.toLocaleString()} K RWF</strong>.`;
}

export function exportAnalysisFull(format) {
  const rows = state.GLOBAL_MEMBERS.map(m => ({
    id: m.id, name: m.name, sector: m.sector, ha: m.ha, crop: m.crop,
    wrsi: m.wrsi, income_rwf: Math.round(m.yield_rwf || 0),
  }));
  let content, mimeType;
  if (format === 'csv') {
    content  = 'ID,Name,Sector,Hectares,Crop,WRSI (%),Est. Income (RWF)\n'
             + rows.map(r => `${r.id},"${r.name}",${r.sector},${r.ha},${r.crop},${r.wrsi},${r.income_rwf}`).join('\n');
    mimeType = 'text/csv';
  } else {
    content  = JSON.stringify(rows, null, 2);
    mimeType = 'application/json';
  }
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([content], { type: mimeType })),
    download: `AgriAdapt_Analysis_Export_${new Date().toISOString().split('T')[0]}.${format}`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  window.showToast?.(`Full District ${format.toUpperCase()} Exported`, 'OK');
}
