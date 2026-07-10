// AgriAdapt — WRSI Prediction Engine & Input Reader
import { TOTAL_PIVOTS, SOLAR_CAPACITY_MW, KIREHE_RF_MEAN, KIREHE_RF_STD } from './constants.js';

export function getInp() {
  return {
    rf_cumul:      parseFloat(document.getElementById('rf_cumul').value),
    cdd:           parseInt(document.getElementById('cdd').value),
    sm_rel:        parseFloat(document.getElementById('sm_rel').value),
    ndvi:          parseFloat(document.getElementById('ndvi').value),
    solar_mw:      parseFloat(document.getElementById('solar_mw').value),
    pivots_active: parseInt(document.getElementById('pivots_active').value),
    reservoir:     parseInt(document.getElementById('reservoir').value),
    dekad:         parseInt(document.getElementById('dekad').value),
    soil_ph:       parseFloat(document.getElementById('soil_ph').value),
  };
}

export function computeBaselineWRSI(i) {
  let wrsi = 100;
  const seasonFactor = i.dekad / 12;
  let climateStress = (i.cdd / 30) * 0.4 + (Math.max(0, 500 - i.rf_cumul) / 500) * 0.6;
  if (i.cdd > 14 && i.dekad >= 6 && i.dekad <= 9) climateStress *= 1.5;
  let cumulativePenalty = climateStress * 80 * seasonFactor;
  if (i.dekad >= 10) cumulativePenalty = climateStress * 80 * (9 / 12);
  wrsi -= cumulativePenalty;
  if (i.sm_rel < 0.7 && i.dekad <= 9)            wrsi -= 20 * seasonFactor;
  else if (i.dekad >= 10 && i.sm_rel > 0.8)      wrsi -= (i.sm_rel - 0.8) * 80;
  if (i.ndvi < 0.35)                              wrsi -= 15 * seasonFactor;
  if (i.soil_ph < 5.5 || i.soil_ph > 8.0)        wrsi -= 25;
  else if (i.soil_ph < 6.0 || i.soil_ph > 7.5)   wrsi -= 10;
  let finalBase = Math.max(15, Math.min(100, Math.round(wrsi)));
  if (i.soil_ph < 5.5 || i.soil_ph > 8.0)        finalBase = Math.min(finalBase, 65);
  else if (i.soil_ph < 6.0 || i.soil_ph > 7.5)   finalBase = Math.min(finalBase, 84);
  return finalBase;
}

export function computeOptimizedWRSI(base, i) {
  if (i.reservoir <= 0) return base;
  const loadStress      = (i.pivots_active / TOTAL_PIVOTS) * 0.1;
  const powerFactor     = Math.max(0, (i.solar_mw / SOLAR_CAPACITY_MW) - loadStress);
  const activeFactor    = i.pivots_active / TOTAL_PIVOTS;
  const reservoirFactor = Math.pow(i.reservoir / 100, 0.5);
  let gain = (100 - base) * (powerFactor * activeFactor * reservoirFactor);
  if (i.dekad >= 10) gain = 0;
  let opt = base + Math.round(gain);
  if (i.soil_ph < 5.5 || i.soil_ph > 8.0)       opt = Math.min(opt, 65);
  else if (i.soil_ph < 6.0 || i.soil_ph > 7.5)  opt = Math.min(opt, 84);
  return Math.min(98, Math.max(base, opt));
}

export function computeSPI(rf) {
  return (rf - KIREHE_RF_MEAN) / KIREHE_RF_STD;
}
