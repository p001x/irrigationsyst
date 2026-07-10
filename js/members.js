// AgriAdapt — Member / Ledger Management
import { state }                        from './state.js';
import { fetchMembers, postMember, deleteMember, patchMember } from './api.js';
import { _runMonitorCycle }             from './monitor.js';
import { SECTOR_HA, CROP_DATA, KIREHE_SECTORS, MARKET_PRICE_RWF_T, KIREHE_RF_MEAN, KIREHE_RF_STD } from './constants.js';
import { computeBaselineWRSI, computeOptimizedWRSI } from './wrsi.js';

const FIRST_NAMES  = ['Jean','Marie','Basile','Claudine','Bosco','Alice','Emmanuel','Pascasie','Theophile','Bernadette'];
const LAST_NAMES   = ['Mukasa','Uwimana','Habimana','Ndayisaba','Gakwaya','Murenzi','Rugira','Kamanzi','Sebahutu','Bigirimana'];
const SECTORS_LIST = ['Nasho','Mpanga','Gahara','Gatore','Kigarama','Kigina','Mahama','Musaza','Mushikiri','Nyamugari','Nyarubuye'];
const CROPS_LIST   = ['Maize','Beans','Coffee','Vegetables'];

// Base irrigation frequency per crop under normal (non-stressed) conditions.
const CROP_IRRIGATION_BASE = {
  Maize:      '1x / week',
  Beans:      '1x / week',
  Coffee:     '2x / week',
  Vegetables: '3x / week',
};

// Crop-specific input recommended when a top-dress/fertigation is needed.
const CROP_INPUT = {
  Maize:      'NPK top-dress',
  Beans:      'Phosphorus-rich fertilizer',
  Coffee:     'Potassium-rich fertilizer',
  Vegetables: 'Balanced NPK + micronutrients',
};

export function getIrrigationPlan(wrsi, crop) {
  const base = CROP_IRRIGATION_BASE[crop] || CROP_IRRIGATION_BASE.Maize;
  const input = CROP_INPUT[crop] || CROP_INPUT.Maize;
  if (wrsi >= 85) {
    return { schedule: `Standard — ${base}`, inputs: 'None — monitor only' };
  }
  if (wrsi >= 70) {
    return { schedule: `Supplemental — ${base.replace(/^\d+x/, m => (parseInt(m) + 1) + 'x')} (solar pivot)`, inputs: `${input} recommended` };
  }
  return { schedule: 'Critical — Daily solar pumping', inputs: `Urgent: ${input} + soil pH correction` };
}

export function _seedMembers() {
  state.GLOBAL_MEMBERS = [];
  for (let k = 1; k <= 100; k++) {
    const sector   = SECTORS_LIST[k % SECTORS_LIST.length];
    const crop     = CROPS_LIST[k % CROPS_LIST.length];
    const ha       = SECTOR_HA[sector] ?? 2.0;
    const wrsi     = Math.round(70 + (k % 25));
    const cropDef  = CROP_DATA[crop]  || CROP_DATA.Maize;
    const sectProf = KIREHE_SECTORS.find(s => s.n === sector) || { fert: 1.0 };
    const yieldT   = ha * cropDef.yield * sectProf.fert * (wrsi / 100);
    state.GLOBAL_MEMBERS.push({
      id:        'K-' + String(k).padStart(3, '0'),
      name:      FIRST_NAMES[k % 10] + ' ' + LAST_NAMES[(k + 3) % 10],
      sector,
      ha,
      crop,
      wrsi,
      ndvi:      parseFloat((0.35 + (k % 10) * 0.04).toFixed(2)),
      spi:       parseFloat(((k % 5) / 2.5 - 1).toFixed(1)),
      ai_interp: '',
      yield_rwf: parseFloat((yieldT * MARKET_PRICE_RWF_T).toFixed(0)),
    });
  }
}

export function _ensureMembers() {
  if (state.GLOBAL_MEMBERS.length > 0) return;
  _seedMembers();
  try { window.update?.(); } catch (e) { /* sync financials */ }
}

export async function fillLedger() {
  // 1. Try PostgreSQL database first
  try {
    const dbMembers = await fetchMembers();
    if (dbMembers && dbMembers.length > 0) {
      state.GLOBAL_MEMBERS = dbMembers;
      renderLedger();
      window.update?.();
      return;
    }
  } catch (e) { /* fall through */ }

  // 2. Migrate localStorage data to DB if present
  const saved = localStorage.getItem('agriadapt_members');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.length > 0) {
        state.GLOBAL_MEMBERS = parsed;
        for (const m of parsed) { try { await postMember(m); } catch (e) {} }
        localStorage.removeItem('agriadapt_members');
        renderLedger();
        window.update?.();
        return;
      }
    } catch (e) {}
  }

  // 3. Seed 100 demo members and persist
  _seedMembers();
  for (const m of state.GLOBAL_MEMBERS) { try { await postMember(m); } catch (e) {} }
  renderLedger();
  window.update?.();
}

export function registerMember() {
  const name   = document.getElementById('reg-name')?.value?.trim();
  const sector = document.getElementById('reg-sector')?.value;
  const crop   = document.getElementById('reg-crop')?.value || 'Maize';
  if (!name) { alert('Please enter Stakeholder Name'); return; }
  addMember(name, sector, crop, 'K-REG');
  const regName = document.getElementById('reg-name'); if (regName) regName.value = '';
}

export function addMember(name, sector, crop, typePrefix = 'K-USR') {
  // Auto-assign ha from sector land profile; fall back to district average if unknown
  const ha = SECTOR_HA[sector] ?? 2.0;

  // Initialise WRSI from current live dashboard inputs so the member shows
  // meaningful data immediately instead of defaulting to 0.
  let initWrsi = 75;   // district-average fallback
  let initNdvi = 0.45;
  let initSpi  = 0.0;
  try {
    const inp = window.getInp?.();
    if (inp) {
      const base    = computeBaselineWRSI(inp);
      const opt     = computeOptimizedWRSI(base, inp);
      const cropDef = CROP_DATA[crop] || CROP_DATA.Maize;
      const sProf   = KIREHE_SECTORS.find(s => s.n === sector) || { fert: 1.0 };
      initWrsi = Math.min(100, Math.round(opt / cropDef.weight));
      initNdvi = inp.ndvi ?? 0.45;
      initSpi  = parseFloat(((inp.rf_cumul - KIREHE_RF_MEAN) / KIREHE_RF_STD).toFixed(2));
    }
  } catch (e) { /* inputs not ready — use fallback */ }

  const m = {
    id:        typePrefix + '-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
    name, sector,
    ha,
    crop,
    wrsi:      initWrsi,
    status:    'Active',
    ndvi:      initNdvi,
    spi:       initSpi,
    ai_interp: 'Newly registered. Live satellite analysis will update on next monitor cycle.',
    yield_rwf: parseFloat((ha * (CROP_DATA[crop]?.yield ?? 4.5) *
                  (KIREHE_SECTORS.find(s => s.n === sector)?.fert ?? 1.0) *
                  (initWrsi / 100) * MARKET_PRICE_RWF_T).toFixed(0)),
  };
  state.GLOBAL_MEMBERS.unshift(m);
  postMember(m).catch(console.error);
  if (state.currentStudyLayer && state.map) {
    state.currentStudyLayer
      .bindTooltip(name, { permanent: true, direction: 'center', className: 'map-label' })
      .addTo(state.map);
  }
  // Run an immediate monitor cycle so the new member's WRSI/yield reflect
  // current Monitoring & Grid inputs right away, instead of waiting up to
  // 15s for the next scheduled auto-monitor tick.
  try { _runMonitorCycle(); } catch (e) { /* monitor not ready yet */ }
  renderLedger();
  window.update?.();
  return m;
}

export async function toggleIrrigation(mid) {
  const m = state.GLOBAL_MEMBERS.find(x => x.id === mid);
  if (!m) return;
  const previous = !!m.irrigation_active;
  m.irrigation_active = !previous;
  renderLedger();
  try {
    await patchMember(mid, { irrigation_active: m.irrigation_active });
  } catch (e) {
    console.error('Failed to update irrigation status, reverting UI:', e);
    m.irrigation_active = previous;
    renderLedger();
    try { window.showToast?.('Could not update irrigation status — please retry.'); } catch (err) {}
  }
}

export async function removeMember(mid) {
  state.GLOBAL_MEMBERS = state.GLOBAL_MEMBERS.filter(m => m.id !== mid);
  await deleteMember(mid).catch(console.error);
  renderLedger();
  window.update?.();
}

export function renderLedger() {
  const body = document.getElementById('ledger-body');
  if (!body) return;
  body.innerHTML = '';
  state.GLOBAL_MEMBERS.forEach(m => {
    const tr    = document.createElement('tr');
    tr.style.background = 'rgba(255,255,255,0.02)';
    const color = m.wrsi > 85 ? 'var(--green)' : m.wrsi > 70 ? 'var(--gold)' : 'var(--red)';
    const plan  = getIrrigationPlan(m.wrsi || 0, m.crop);
    tr.innerHTML = `
      <td><span style="font-weight:700;color:white;font-size:14px;">${m.name}</span><br>
          <span style="font-size:10px;color:var(--ink-mute)">ID: ${m.id}</span></td>
      <td style="color:var(--ink-soft);">${m.sector}</td>
      <td>${m.ha} ha <span style="font-size:10px;color:var(--ink-mute)">(${m.crop})</span></td>
      <td style="font-family:var(--mono);">${Math.round(m.ha * 120).toLocaleString()}</td>
      <td style="color:${color};font-weight:900;font-size:16px;" aria-label="WRSI ${m.wrsi}%">${m.wrsi}%</td>
      <td style="font-size:11px;color:var(--ink-soft);">${plan.schedule}</td>
      <td style="font-size:11px;color:${color};">${plan.inputs}</td>
      <td>
        <button class="btn-mini" onclick="toggleIrrigation('${m.id}')"
              style="${m.irrigation_active
                ? 'color:var(--green);border-color:var(--green);background:rgba(60,200,120,0.12);'
                : 'color:var(--ink-mute);border-color:var(--ink-mute);background:rgba(255,255,255,0.04);'}"
              aria-label="${m.irrigation_active ? 'Deactivate' : 'Activate'} irrigation for ${m.name}">
          ${m.irrigation_active ? '● Active' : '○ Activate Irrigation'}
        </button>
      </td>
      <td style="color:var(--green);font-weight:700;font-family:var(--mono);">${Math.round(m.yield_rwf || 0).toLocaleString()}</td>
      <td><button class="btn-mini" onclick="removeMember('${m.id}')"
            style="color:var(--red);border-color:var(--red-pale);background:rgba(255,100,100,0.1);"
            aria-label="Remove ${m.name}">Delete</button></td>`;
    body.appendChild(tr);
  });
}
