// AgriAdapt — Season Simulation Engine
import { state }                                  from './state.js';
import { TOTAL_PIVOTS }                           from './constants.js';
import { computeBaselineWRSI, computeOptimizedWRSI } from './wrsi.js';

export function toggleSim() {
  state.simRunning = !state.simRunning;
  const btn = document.getElementById('btn-play');

  if (state.simRunning) {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true"></i> Pause Metabolism';
    state.simInterval = setInterval(() => {
      const i = window.getInp?.();
      if (!i) return;
      const dSlider    = document.getElementById('dekad');
      const resSlider  = document.getElementById('reservoir');
      const ndviSlider = document.getElementById('ndvi');
      const wrsi = computeOptimizedWRSI(computeBaselineWRSI(i), i);
      let val = parseInt(dSlider.value);
      if (val < 12) {
        dSlider.value = val + 1;
        resSlider.value = Math.max(0, parseInt(resSlider.value) - (i.pivots_active / TOTAL_PIVOTS) * 8);
        if (val + 1 >= 10) {
          const ps = document.getElementById('pivots_active');
          ps.value = Math.max(0, Math.floor(parseInt(ps.value) * 0.4));
        }
        let ndvi = parseFloat(ndviSlider.value);
        if (wrsi > 85)      ndvi = Math.min(0.9, ndvi + 0.05);
        else if (wrsi < 65) ndvi = Math.max(0.1, ndvi - 0.08);
        ndviSlider.value = ndvi.toFixed(2);
      } else {
        toggleSim();
      }
      window.update?.();
    }, 1200);
  } else {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> Auto-Play Season';
    clearInterval(state.simInterval);
  }
}
