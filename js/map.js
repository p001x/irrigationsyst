// AgriAdapt — Leaflet Asset Map & Geospatial Engine
import { state }          from './state.js';
import { KIREHE_SECTORS, CROP_DATA } from './constants.js';
import { computeBaselineWRSI }       from './wrsi.js';

export function getActiveStudyBounds() {
  if (state.shpLayer?.getLayers().length > 0) return state.shpLayer.getBounds();
  if (state.currentStudyLayer) {
    if (state.currentStudyLayer instanceof L.Circle) return state.currentStudyLayer.getBounds();
    if (state.currentStudyLayer.getBounds) return state.currentStudyLayer.getBounds();
  }
  if (state.lastActiveArea) {
    if (state.lastActiveArea instanceof L.Circle) return state.lastActiveArea.getBounds();
    if (state.lastActiveArea.getBounds) return state.lastActiveArea.getBounds();
  }
  return null;
}

export function detectSectorFromCoord(coord) {
  let best = 'Kirehe Rural', minDist = 999;
  KIREHE_SECTORS.forEach(s => {
    const d = turf.distance(coord, [s.c[1], s.c[0]]);
    if (d < minDist) { minDist = d; best = s.n; }
  });
  return best;
}

export function saveStudyToLedger() {
  const name = document.getElementById('study-name').value;
  const crop = document.getElementById('study-crop').value;
  if (!name) { alert('Please enter Stakeholder Name'); return; }
  window.addMember?.(name, state.lastStudySector, crop, 'K-GEO');
  if (state.currentStudyLayer) {
    state.lastActiveArea = state.currentStudyLayer;
    state.currentStudyLayer.bindPopup(`
      <div style="min-width:180px;">
        <div style="font-size:10px;color:var(--ink-mute);text-transform:uppercase;">STAKEHOLDER: ${name}</div>
        <div style="font-size:18px;font-weight:700;color:white;margin:4px 0;">${crop} Estate</div>
        <div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">${state.lastStudyHa} ha in ${state.lastStudySector}</div>
        <button class="btn-mini" style="width:100%;margin-top:15px;background:rgba(0,255,102,0.1);border-color:var(--green);color:white;" onclick="tab('ledger')">View ROI in Success Ledger</button>
      </div>`).openPopup();
  }
  window.showToast?.(`Registered ${name} to Member Success`, 'View', () => window.tab?.('ledger'));
  state.currentStudyLayer = null;
  document.getElementById('gis-study-nexus').style.display = 'none';
  document.getElementById('study-name').value = '';
}

export function cancelStudy() {
  if (state.currentStudyLayer && state.map) state.map.removeLayer(state.currentStudyLayer);
  state.currentStudyLayer = null;
  document.getElementById('gis-study-nexus').style.display = 'none';
}

export async function handleMapUpload(event) {
  const file = event.target.files[0];
  if (!file || !state.map) return;
  const status = document.getElementById('map-status');
  status.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Processing ${file.name}...`;
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const geojson = await shp(e.target.result);
      if (state.shpLayer) state.map.removeLayer(state.shpLayer);
      state.shpLayer = L.geoJSON(geojson, {
        style: { color: 'var(--gold)', weight: 2, fillOpacity: 0.3 },
        onEachFeature: (f, layer) => {
          const hectares    = (turf.area(f) / 10_000).toFixed(2);
          const center      = turf.centroid(f).geometry.coordinates;
          let bestSector    = 'Kirehe District (Rural)', minD = 999;
          KIREHE_SECTORS.forEach(s => { const d = turf.distance(center, [s.c[1], s.c[0]]); if (d < minD) { minD = d; bestSector = s.n; } });
          const crop        = document.getElementById('study-crop')?.value || 'Maize';
          const weight      = (CROP_DATA[crop] || CROP_DATA.Maize).weight;
          const cropWRSI    = Math.max(0, Math.min(100, Math.round(computeBaselineWRSI(window.getInp?.() || {}) / weight)));
          state.lastStudyHa = hectares; state.lastStudySector = bestSector;
          document.getElementById('study-area-stats').innerHTML = `${hectares} ha (Imported)`;
          document.getElementById('gis-study-nexus').style.display = 'block';
          layer.bindPopup(`
            <div style="min-width:180px;">
              <div class="sec-label" style="color:var(--cyan);font-size:10px;">SECTOR: ${bestSector.toUpperCase()}</div>
              <div style="font-family:var(--cab);font-size:18px;margin-top:5px;">Area: ${hectares} ha</div>
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:10px;color:var(--ink-soft);">LIVE CROP VITALITY</div>
                <div style="font-size:20px;font-weight:900;color:${cropWRSI > 80 ? 'var(--green)' : 'var(--red)'}">${cropWRSI}% WRSI</div>
              </div>
            </div>`);
        },
      }).addTo(state.map);
      state.map.fitBounds(state.shpLayer.getBounds());
      status.innerHTML = `✅ Successfully imported ${file.name}`;
    };
    reader.readAsArrayBuffer(file);
  } catch (err) { console.error(err); status.innerHTML = `❌ Error parsing Shapefile ZIP.`; }
}

export function initLeafletMap() {
  if (state.map) { setTimeout(() => state.map.invalidateSize(), 200); return; }
  state.map = L.map('map', { attributionControl: true }).setView([-2.20, 30.65], 11);

  const streets   = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
  const terrain   = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 });
  satellite.addTo(state.map);
  L.control.layers({ 'Satellite (High-Res)': satellite, 'Standard Streets': streets, 'Topographic Terrain': terrain }).addTo(state.map);

  state.map.pm.addControls({ position: 'topleft', drawCircle: true, drawMarker: false, drawPolyline: false, drawRectangle: true, drawPolygon: true, drawCircleMarker: false, rotateMode: false });
  state.map.pm.setGlobalOptions({ measurements: { measurement: true, displayFormat: 'metric' }, templineStyle: { color: 'var(--gold)', dashArray: '5, 5' }, hintlineStyle: { color: 'var(--gold)', dashArray: '5, 5' } });

  state.map.on('pm:create', (e) => {
    state.currentStudyLayer = e.layer;
    let statsHtml, ha;
    if (e.layer instanceof L.Circle) {
      const r = e.layer.getRadius();
      ha = (Math.PI * r * r / 10_000).toFixed(2);
      statsHtml = `<span style="color:var(--gold)">${ha} ha</span><br><span style="font-size:11px;color:var(--ink-soft)">Radius: ${r.toFixed(1)}m</span>`;
    } else {
      ha = (turf.area(e.layer.toGeoJSON()) / 10_000).toFixed(2);
      statsHtml = `${ha} ha`;
    }
    state.lastStudyHa = ha;
    const center = e.layer instanceof L.Circle ? [e.layer.getLatLng().lng, e.layer.getLatLng().lat] : turf.centroid(e.layer.toGeoJSON()).geometry.coordinates;
    state.lastStudySector = detectSectorFromCoord(center);
    document.getElementById('study-area-stats').innerHTML = statsHtml;
    document.getElementById('gis-study-nexus').style.display = 'block';
  });

  const geocoder = L.Control.geocoder({ defaultMarkGeocode: true, placeholder: "Search name or '-2.27, 30.65'..." })
    .on('markgeocode', (e) => {
      state.map.fitBounds(e.geocode.bbox);
      state.lastStudyHa = (turf.area(turf.bboxPolygon(e.geocode.bbox)) / 10_000).toFixed(2);
      state.lastStudySector = detectSectorFromCoord([e.geocode.center.lng, e.geocode.center.lat]);
      document.getElementById('study-area-stats').innerHTML = `${state.lastStudyHa} ha (Searched Area)`;
      document.getElementById('gis-study-nexus').style.display = 'block';
    }).addTo(state.map);

  const wrapper = document.getElementById('geocoder-input-wrapper');
  const gElem   = geocoder.getContainer();
  if (wrapper && gElem) {
    wrapper.appendChild(gElem);
    const inp = gElem.querySelector('input');
    inp?.setAttribute('aria-label', 'Search location or coordinates');
    inp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const parts = inp.value.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          state.map.setView(parts, 15);
          L.marker(parts).addTo(state.map).bindPopup(`Location: ${parts[0]}, ${parts[1]}`).openPopup();
        }
      }
    });
  }

  const kireheBounds = [[-2.45,30.45],[-2.35,30.85],[-2.15,30.95],[-2.05,30.65],[-2.15,30.45]];
  L.polygon(kireheBounds, { color: 'var(--cyan)', weight: 1, fillOpacity: 0.1 }).addTo(state.map);
}
