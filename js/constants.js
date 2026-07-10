// AgriAdapt — Shared Constants
export const TOTAL_PIVOTS       = 63;
export const COOP_PROFIT_BMRK   = 1_300_000_000;
export const SOLAR_CAPACITY_MW  = 3.3;
export const MARKET_PRICE_RWF_T = 350_000;
export const KIREHE_RF_MEAN     = 285;
export const KIREHE_RF_STD      = 72;

export const SHAP = [
  { name: 'CDD (Dry Days)', imp: 0.24, color: '#FF4F4F' },
  { name: 'SM_D8_rel',      imp: 0.21, color: '#00F0FF' },
  { name: 'RF_CUMUL',       imp: 0.18, color: '#0080FF' },
  { name: 'NDVI_Peak',      imp: 0.15, color: '#00FF66' },
  { name: 'LST_Anomaly',    imp: 0.12, color: '#FF8000' },
];

export const CROP_DATA = {
  Maize:      { weight: 1.0,  yield: 4.5 },
  Beans:      { weight: 1.15, yield: 2.1 },
  Coffee:     { weight: 0.85, yield: 1.2 },
  Vegetables: { weight: 1.3,  yield: 8.5 },
};

export const KIREHE_SECTORS = [
  { n: 'Nasho',     c: [-2.08, 30.73], fert: 1.15 },
  { n: 'Mpanga',    c: [-2.25, 30.78], fert: 0.95 },
  { n: 'Gahara',    c: [-2.35, 30.60], fert: 0.85 },
  { n: 'Gatore',    c: [-2.25, 30.55], fert: 1.05 },
  { n: 'Kigarama',  c: [-2.15, 30.52], fert: 0.90 },
  { n: 'Kigina',    c: [-2.18, 30.68], fert: 1.00 },
  { n: 'Mahama',    c: [-2.32, 30.85], fert: 0.80 },
  { n: 'Musaza',    c: [-2.28, 30.92], fert: 0.85 },
  { n: 'Mushikiri', c: [-2.12, 30.62], fert: 1.10 },
  { n: 'Nyamugari', c: [-2.15, 30.85], fert: 0.95 },
  { n: 'Nyarubuye', c: [-2.22, 30.82], fert: 0.90 },
  { n: 'Kirehe',    c: [-2.27, 30.65], fert: 1.00 },
];

// Typical smallholder plot size per sector (ha).
// Derived from Kirehe District land-use profiles: larger in high-fertility
// pivot-served zones (Nasho, Mushikiri), smaller in rain-fed hillside sectors.
export const SECTOR_HA = {
  Nasho:     2.8,
  Mpanga:    1.8,
  Gahara:    1.5,
  Gatore:    2.0,
  Kigarama:  1.7,
  Kigina:    2.1,
  Mahama:    1.4,
  Musaza:    1.5,
  Mushikiri: 2.4,
  Nyamugari: 1.8,
  Nyarubuye: 1.7,
  Kirehe:    2.0,
};
