// AgriAdapt — Shared Constants & NISR Official Statistics Benchmarks
// Calibrated against NISR Seasonal Agriculture Survey (SAS 2024) & Census 2022

export const TOTAL_PIVOTS       = 63;
export const COOP_PROFIT_BMRK   = 1_300_000_000;
export const SOLAR_CAPACITY_MW  = 3.3;
export const MARKET_PRICE_RWF_T = 350_000; // Official MINICOM/MINAGRI commodity price (RWF / ton)
export const KIREHE_RF_MEAN     = 285;     // Long-term Season B historical mean (mm)
export const KIREHE_RF_STD      = 72;      // Standard deviation (mm)

// Official NISR SAS 2024 Crop Yield Benchmarks (Tons / Hectare)
export const NISR_YIELD_BENCHMARKS = {
  maize_rainfed_baseline:  1.85,  // NISR SAS 2023-2024 Season B Kirehe District Mean
  maize_drought_stressed:  0.75,  // Yield during extreme water-stress years (WRSI < 70)
  maize_irrigated_target:  4.85,  // Verified yield under center-pivot solar irrigation (Nasho)
  district_smallholder_ha: 0.65,  // Average household plot size (NISR RAHS 2024)
};

// TreeSHAP Feature Attributions from 23-Season (2001-2023) Random Forest Pipeline
export const SHAP = [
  { name: 'SM_D8_rel (Grain-fill Soil Moisture)', imp: 0.28, color: '#00F0FF' },
  { name: 'SM_D4 (Early Vegetative Soil Water)', imp: 0.22, color: '#0080FF' },
  { name: 'RF_CUMUL_rel (Rainfall Anomaly)',     imp: 0.18, color: '#2ECC71' },
  { name: 'CDD (Consecutive Dry Spell Days)',    imp: 0.14, color: '#FF4F4F' },
  { name: 'NDVI_D6_rel (Canopy Greenness)',      imp: 0.10, color: '#FBBF24' },
  { name: 'LST_ANOM (Thermal Surface Stress)',   imp: 0.08, color: '#FF8000' },
];

export const CROP_DATA = {
  Maize:      { weight: 1.0,  yield: 4.85 }, // NISR SAS benchmark for irrigated maize
  Beans:      { weight: 1.15, yield: 2.10 },
  Coffee:     { weight: 0.85, yield: 1.25 },
  Vegetables: { weight: 1.3,  yield: 8.50 },
};

// 12 Administrative Sectors of Kirehe District (NISR Census 2022 Population & GAUL Centroids)
export const KIREHE_SECTORS = [
  { n: 'Nasho',     c: [-2.08, 30.73], fert: 1.15, pop: 32450, risk: 'High (55.4%)' },
  { n: 'Mpanga',    c: [-2.25, 30.78], fert: 0.95, pop: 39120, risk: 'Extreme (71.2%)' },
  { n: 'Gahara',    c: [-2.35, 30.60], fert: 0.85, pop: 44210, risk: 'Moderate (36.8%)' },
  { n: 'Gatore',    c: [-2.25, 30.55], fert: 1.05, pop: 48930, risk: 'Resilient (22.1%)' },
  { n: 'Kigarama',  c: [-2.15, 30.52], fert: 0.90, pop: 38100, risk: 'High (48.2%)' },
  { n: 'Kigina',    c: [-2.18, 30.68], fert: 1.00, pop: 33450, risk: 'Moderate (27.4%)' },
  { n: 'Mahama',    c: [-2.32, 30.85], fert: 0.80, pop: 112400, risk: 'Extreme (76.5%)' }, // includes refugee settlement zone
  { n: 'Musaza',    c: [-2.28, 30.92], fert: 0.85, pop: 36720, risk: 'Moderate (31.5%)' },
  { n: 'Mushikiri', c: [-2.12, 30.62], fert: 1.10, pop: 31200, risk: 'Resilient (17.6%)' },
  { n: 'Nyamugari', c: [-2.15, 30.85], fert: 0.95, pop: 41800, risk: 'Extreme (65.5%)' },
  { n: 'Nyarubuye', c: [-2.22, 30.82], fert: 0.90, pop: 28900, risk: 'High (44.1%)' },
  { n: 'Kirehe',    c: [-2.27, 30.65], fert: 1.00, pop: 34100, risk: 'Resilient (18.0%)' },
];

// Average smallholder holding size per sector (NISR RAHS 2024 calibrated)
export const SECTOR_HA = {
  Nasho:     2.1,  // Cooperative consolidated pivot blocks
  Mpanga:    0.85, // Hillside smallholders
  Gahara:    0.70,
  Gatore:    0.90,
  Kigarama:  0.75,
  Kigina:    0.80,
  Mahama:    0.55,
  Musaza:    0.65,
  Mushikiri: 1.10,
  Nyamugari: 0.75,
  Nyarubuye: 0.65,
  Kirehe:    0.85,
};
