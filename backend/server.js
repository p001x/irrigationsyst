'use strict';
const ee         = require('@google/earthengine');
const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const { Pool }   = require('pg');
const privateKey = require('./service-account.json');

// Default fallback secret for admin authentication if none is configured
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'agriadapt_secret';
  console.log('No SESSION_SECRET environment variable found. Defaulting to: agriadapt_secret');
}

const app = express();

// ── CORS — restrict to the Replit preview origin only ───────────────────────
// External callers cannot mutate member data from a different origin.
const DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? 'https://' + process.env.REPLIT_DEV_DOMAIN
  : null;
const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  ...(DEV_DOMAIN ? [DEV_DOMAIN] : []),
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / server-side requests where origin is undefined
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
}));
app.use(express.json({ limit: '2mb' }));

// ── Admin session helpers ────────────────────────────────────────────────────
// A session token is only issued by POST /api/admin/login after the caller
// proves knowledge of SESSION_SECRET. The token is signed with SESSION_SECRET
// so it cannot be forged; all operations fail closed when the secret is unset.

const SESSION_COOKIE = 'agriadapt_admin';

function generateAdminToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const nonce = crypto.randomBytes(16).toString('hex');
  // Prefix distinguishes authenticated tokens from any legacy/anonymous ones.
  const payload = 'auth:' + nonce;
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function validateAdminToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload  = token.slice(0, dot);
  const sig      = token.slice(dot + 1);
  // Require the authenticated prefix — anonymous nonces are never accepted.
  if (!payload.startsWith('auth:')) return false;
  if (sig.length !== 64) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); }
  catch { return false; }
}

function getAdminCookie(req) {
  const raw = req.headers.cookie || '';
  for (const pair of raw.split(';')) {
    const eq = pair.trim().indexOf('=');
    if (eq < 0) continue;
    if (pair.trim().slice(0, eq) === SESSION_COOKIE)
      return decodeURIComponent(pair.trim().slice(eq + 1));
  }
  return null;
}

// ── Admin gate — requires either an authenticated session cookie or X-Admin-Key
// Never fails open; returns 503 when SESSION_SECRET is not configured.
function requireAdmin(req, res, next) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return res.status(503).json({ error: 'Admin secret not configured' });
  if (req.headers['x-admin-key'] === secret) return next();
  if (validateAdminToken(getAdminCookie(req)))  return next();
  res.status(403).json({ error: 'Forbidden' });
}

// ── Admin login — validates the admin password then issues a signed cookie ───
app.post('/api/admin/login', (req, res) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return res.status(503).json({ error: 'Admin secret not configured' });
  const { password } = req.body || {};
  if (!password || typeof password !== 'string')
    return res.status(400).json({ error: 'password required' });
  // Constant-time compare to resist timing attacks.
  let match = false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(secret);
    match = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { match = false; }
  if (!match) return res.status(403).json({ error: 'Invalid password' });
  const token = generateAdminToken();
  if (!token) return res.status(503).json({ error: 'Admin secret not configured' });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge:   8 * 60 * 60 * 1000,   // 8-hour admin session
    path:     '/',
  });
  res.json({ ok: true });
});

// ── Admin logout ─────────────────────────────────────────────────────────────
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// ── Admin status — lets the UI know whether an admin session is active ────────
app.get('/api/admin/status', (req, res) => {
  res.json({ admin: validateAdminToken(getAdminCookie(req)) });
});

// ── Connection pool or local JSON database fallback ──────────────────────────
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Ensure the members table exists at startup
  pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      sector      TEXT,
      ha          REAL        DEFAULT 1.5,
      crop        TEXT        DEFAULT 'Maize',
      wrsi        REAL        DEFAULT 0,
      ndvi        REAL        DEFAULT 0.45,
      spi         REAL        DEFAULT 0,
      ai_interp   TEXT        DEFAULT '',
      yield_rwf   REAL        DEFAULT 0,
      status      TEXT        DEFAULT 'Active',
      irrigation_active BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `).then(() => pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS irrigation_active BOOLEAN DEFAULT FALSE;`))
    .then(() => console.log('Members table ready.'))
    .catch(e  => console.error('DB init error:', e.message));
} else {
  // Use file-based fallback database
  console.log('No DATABASE_URL found. Using local JSON file-based database fallback.');
  const fs = require('fs');
  const path = require('path');
  const dbFile = path.join(__dirname, 'members_db.json');
  
  // Helper to load members
  const readMembers = () => {
    try {
      if (fs.existsSync(dbFile)) {
        return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      }
    } catch (e) {
      console.error('Error reading local db file:', e.message);
    }
    return [];
  };
  
  // Helper to save members
  const writeMembers = (data) => {
    try {
      fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error writing local db file:', e.message);
    }
  };

  // Mock pool object to support vanilla query format used in server.js
  pool = {
    query: async (text, params) => {
      // Normalize query whitespace
      const sql = text.trim().replace(/\s+/g, ' ');
      
      if (sql.startsWith('CREATE TABLE') || sql.startsWith('ALTER TABLE')) {
        // Table initialization queries - do nothing
        return { rows: [] };
      }
      
      if (sql.startsWith('SELECT * FROM members')) {
        const members = readMembers();
        // Sort by created_at DESC (which is our fallback behavior)
        members.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        return { rows: members };
      }
      
      if (sql.startsWith('INSERT INTO members')) {
        const [id, name, sector, ha, crop, wrsi, ndvi, spi, ai_interp, yield_rwf, status, irrigation_active] = params;
        const members = readMembers();
        const existingIdx = members.findIndex(m => m.id === id);
        const newMember = {
          id,
          name,
          sector,
          ha: ha !== undefined ? parseFloat(ha) : 1.5,
          crop: crop !== undefined ? crop : 'Maize',
          wrsi: wrsi !== undefined ? parseFloat(wrsi) : 0,
          ndvi: ndvi !== undefined ? parseFloat(ndvi) : 0.45,
          spi: spi !== undefined ? parseFloat(spi) : 0,
          ai_interp: ai_interp !== undefined ? ai_interp : '',
          yield_rwf: yield_rwf !== undefined ? parseFloat(yield_rwf) : 0,
          status: status !== undefined ? status : 'Active',
          irrigation_active: irrigation_active !== undefined ? !!irrigation_active : false,
          created_at: existingIdx >= 0 ? (members[existingIdx].created_at || new Date().toISOString()) : new Date().toISOString()
        };
        if (existingIdx >= 0) {
          members[existingIdx] = newMember;
        } else {
          members.push(newMember);
        }
        writeMembers(members);
        return { rows: [] };
      }
      
      if (sql.startsWith('UPDATE members SET')) {
        const id = params[params.length - 1];
        const members = readMembers();
        const existingIdx = members.findIndex(m => m.id === id);
        if (existingIdx >= 0) {
          const member = members[existingIdx];
          const setIndex = sql.indexOf('SET');
          const whereIndex = sql.indexOf('WHERE');
          if (setIndex !== -1 && whereIndex !== -1) {
            const setPart = sql.substring(setIndex + 3, whereIndex).trim();
            const assignments = setPart.split(',').map(s => s.trim());
            assignments.forEach((assign, index) => {
              const parts = assign.split('=');
              if (parts.length === 2) {
                const field = parts[0].trim();
                const val = params[index];
                if (field === 'ha' || field === 'wrsi' || field === 'ndvi' || field === 'spi' || field === 'yield_rwf') {
                  member[field] = val !== null && val !== undefined ? parseFloat(val) : 0;
                } else if (field === 'irrigation_active') {
                  member[field] = !!val;
                } else {
                  member[field] = val;
                }
              }
            });
            members[existingIdx] = member;
            writeMembers(members);
          }
        }
        return { rows: [] };
      }
      
      if (sql.startsWith('DELETE FROM members WHERE id=')) {
        const id = params[0];
        const members = readMembers();
        const filtered = members.filter(m => m.id !== id);
        writeMembers(filtered);
        return { rows: [] };
      }
      
      if (sql === 'DELETE FROM members') {
        writeMembers([]);
        return { rows: [] };
      }
      
      throw new Error('Unsupported SQL command in local fallback DB: ' + sql);
    }
  };
  console.log('Local JSON database fallback ready.');
}

// ── Member CRUD ───────────────────────────────────────────────────────────────
app.get('/api/members', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM members ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/members', requireAdmin, async (req, res) => {
  const {
    id, name, sector, ha, crop,
    wrsi = 0, ndvi = 0.45, spi = 0,
    ai_interp = '', yield_rwf = 0, status = 'Active',
    irrigation_active = false,
  } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
  if (typeof irrigation_active !== 'boolean') {
    return res.status(400).json({ error: 'irrigation_active must be a boolean' });
  }
  try {
    await pool.query(
      `INSERT INTO members (id, name, sector, ha, crop, wrsi, ndvi, spi, ai_interp, yield_rwf, status, irrigation_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, sector=EXCLUDED.sector, ha=EXCLUDED.ha, crop=EXCLUDED.crop,
         wrsi=EXCLUDED.wrsi, ndvi=EXCLUDED.ndvi, spi=EXCLUDED.spi,
         ai_interp=EXCLUDED.ai_interp, yield_rwf=EXCLUDED.yield_rwf, status=EXCLUDED.status,
         irrigation_active=EXCLUDED.irrigation_active`,
      [id, name, sector, ha, crop, wrsi, ndvi, spi, ai_interp, yield_rwf, status, irrigation_active]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/members/:id', requireAdmin, async (req, res) => {
  const allowed = ['wrsi','ndvi','spi','ai_interp','yield_rwf','status','name','sector','ha','crop','irrigation_active'];
  const sets    = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
  if ('irrigation_active' in req.body && typeof req.body.irrigation_active !== 'boolean') {
    return res.status(400).json({ error: 'irrigation_active must be a boolean' });
  }
  // Build "field=$N, ..." using string concat — avoids ${ template-expression stripping.
  const setClauses  = sets.map((k, i) => k + '=$' + (i + 1)).join(', ');
  const whereClause = '$' + (sets.length + 1);
  try {
    await pool.query(
      'UPDATE members SET ' + setClauses + ' WHERE id=' + whereClause,
      [...sets.map(k => req.body[k]), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/members/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM members WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk delete — requires X-Admin-Key header matching SESSION_SECRET
app.delete('/api/members', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM members');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Constants (server-side copy) ─────────────────────────────────────────────
const CROP_DATA = {
  Maize:      { weight: 1.0,  yield: 4.5 },
  Beans:      { weight: 1.15, yield: 2.1 },
  Coffee:     { weight: 0.85, yield: 1.2 },
  Vegetables: { weight: 1.3,  yield: 8.5 },
};
const MARKET_PRICE_RWF_T = 350_000;

const KIREHE_SECTORS = [
  { n:'Nasho',     c:[-2.08,30.73], fert:1.15 }, { n:'Mpanga',    c:[-2.25,30.78], fert:0.95 },
  { n:'Gahara',    c:[-2.35,30.60], fert:0.85 }, { n:'Gatore',    c:[-2.25,30.55], fert:1.05 },
  { n:'Kigarama',  c:[-2.15,30.52], fert:0.90 }, { n:'Kigina',    c:[-2.18,30.68], fert:1.00 },
  { n:'Mahama',    c:[-2.32,30.85], fert:0.80 }, { n:'Musaza',    c:[-2.28,30.92], fert:0.85 },
  { n:'Mushikiri', c:[-2.12,30.62], fert:1.10 }, { n:'Nyamugari', c:[-2.15,30.85], fert:0.95 },
  { n:'Nyarubuye', c:[-2.22,30.82], fert:0.90 }, { n:'Kirehe',    c:[-2.27,30.65], fert:1.00 },
];

// ── Google Earth Engine ───────────────────────────────────────────────────────
ee.data.authenticateViaPrivateKey(
  privateKey,
  () => {
    console.log('Authentication successful.');
    ee.initialize(null, null,
      ()    => { console.log('Earth Engine client library initialized.'); },
      (err) => { console.error('EE init error:', err); }
    );
  },
  (err) => { console.error('Authentication failed:', err); }
);

// ── Spatial Engine cache (30-min TTL) ────────────────────────────────────────
const _spatialCache = new Map(); // key → { data, ts }
const SPATIAL_CACHE_TTL = 30 * 60 * 1000; // 30 min

// ── Spatial Intelligence Hub: per-sector real data from GEE ──────────────────
// Returns NDVI (MODIS), precipitation/SPI (CHIRPS), LST (MODIS MOD11A2)
// and derived NDWI for all 12 Kirehe sectors simultaneously via reduceRegions.
app.get('/api/spatial-engine', (req, res) => {
  // Default to previous month so data always exists
  let date = req.query.date;
  if (!date) {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  // Validate YYYY-MM format and reject future dates
  if (!/^\d{4}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM' });
  const [reqYear, reqMonth] = date.split('-').map(Number);
  const now = new Date();
  if (reqYear > now.getFullYear() || (reqYear === now.getFullYear() && reqMonth > now.getMonth())) {
    return res.status(400).json({ error: 'Cannot request future satellite data' });
  }

  // Serve from cache if fresh
  const cached = _spatialCache.get(date);
  if (cached && Date.now() - cached.ts < SPATIAL_CACHE_TTL) {
    return res.json({ ...cached.data, fromCache: true });
  }

  // Evict oldest cache entry if cap exceeded (prevent unbounded memory growth)
  if (_spatialCache.size >= 50) {
    _spatialCache.delete(_spatialCache.keys().next().value);
  }

  try {
    const [year, month] = date.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nd = new Date(year, month, 1);          // first of next month
    const endDate = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-01`;

    // Build a FeatureCollection: one 5 km buffer per sector
    const sectorFeatures = ee.FeatureCollection(
      KIREHE_SECTORS.map(s =>
        ee.Feature(
          ee.Geometry.Point([s.c[1], s.c[0]]).buffer(5000),
          { sector: s.n }
        )
      )
    );

    // MODIS NDVI (250 m)
    const modisNDVI = ee.ImageCollection('MODIS/061/MOD13Q1')
      .filterDate(startDate, endDate)
      .select('NDVI').mean().multiply(0.0001).rename('ndvi');

    // CHIRPS precipitation total (mm)
    const chirpsRain = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
      .filterDate(startDate, endDate)
      .select('precipitation').sum().rename('rain');

    // MODIS LST day (1 km) – convert raw DN to °C: scale 0.02, offset −273.15
    const modisLST = ee.ImageCollection('MODIS/061/MOD11A2')
      .filterDate(startDate, endDate)
      .select('LST_Day_1km').mean().multiply(0.02).subtract(273.15).rename('lst');

    // Combine and reduce over all sectors in one server round-trip
    const combined = modisNDVI.addBands(chirpsRain).addBands(modisLST);
    const reduced  = combined.reduceRegions({
      collection: sectorFeatures,
      reducer:    ee.Reducer.mean(),
      scale:      1000,
    });

    reduced.evaluate((result, err) => {
      if (err) {
        console.error('Spatial Engine GEE error:', err);
        return res.status(500).json({ error: err.message });
      }

      const sectors = {};
      (result.features || []).forEach(f => {
        const p    = f.properties;
        const name = p.sector;
        if (!name) return;
        const ndvi = typeof p.ndvi === 'number' ? p.ndvi : 0.45;
        const rain = typeof p.rain === 'number' ? p.rain : 0;
        const lst  = typeof p.lst  === 'number' ? p.lst  : 24;
        const spi  = Math.max(-3, Math.min(3, (rain - 285) / 72));
        const ndwi = Math.max(-1, Math.min(1, (ndvi - 0.4) / 2 + spi * 0.1));
        const lstAnomaly = parseFloat((lst - 24).toFixed(2)); // baseline 24 °C
        sectors[name] = {
          ndvi: parseFloat(ndvi.toFixed(4)),
          ndwi: parseFloat(ndwi.toFixed(4)),
          spi:  parseFloat(spi.toFixed(3)),
          rain: parseFloat(rain.toFixed(1)),
          lst:  parseFloat(lst.toFixed(2)),
          lstAnomaly,
        };
      });

      const payload = { date, sectors, fetchedAt: Date.now(), sources: ['MODIS/061/MOD13Q1','UCSB-CHG/CHIRPS/DAILY','MODIS/061/MOD11A2'] };
      _spatialCache.set(date, { data: payload, ts: Date.now() });
      res.json(payload);
    });
  } catch (e) {
    console.error('Spatial Engine error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Spectral data from GEE ────────────────────────────────────────────────────
app.get('/api/spectral-data', (req, res) => {
  const { date, bounds } = req.query;
  if (!date || !bounds) return res.status(400).json({ error: 'Missing date or bounds parameter' });
  try {
    const boundsCoords = JSON.parse(bounds);
    const region       = ee.Geometry.Polygon(boundsCoords);
    const [year, month] = date.split('-');
    const startDate    = year + '-' + month + '-01';
    const d            = new Date(Number(year), Number(month), 1);
    const endDate      = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';

    const modis = ee.ImageCollection('MODIS/061/MOD13Q1')
      .filterDate(startDate, endDate).filterBounds(region).select('NDVI');
    const image = modis.mean().multiply(0.0001);

    const chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
      .filterDate(startDate, endDate).filterBounds(region).select('precipitation');
    const rainTotal = chirps.sum();

    const meanNdvi = image.reduceRegion({ reducer: ee.Reducer.mean(), geometry: region, scale: 250,  bestEffort: true });
    const meanRain = rainTotal.reduceRegion({ reducer: ee.Reducer.mean(), geometry: region, scale: 5000, bestEffort: true });

    ee.Dictionary(['ndvi', meanNdvi.get('NDVI'), 'rain', meanRain.get('precipitation')])
      .evaluate((result, err) => {
        if (err) { console.error('GEE Evaluate Error:', err); return res.status(500).json({ error: err.message }); }
        const ndvi = result.ndvi || 0.45;
        const rain = result.rain || 0;
        const spi  = (rain - 285) / 72;
        const ndwi = (ndvi - 0.4) / 2 + (spi * 0.1);
        res.json({ ndvi, ndwi: Math.max(-1, Math.min(1, ndwi)), spi: Math.max(-3, Math.min(3, spi)), rain });
      });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── Financial calculations (server-side) ─────────────────────────────────────
app.post('/api/finance', (req, res) => {
  const { baseWRSI, optWRSI, members, inputs } = req.body;
  if (!members || !members.length) {
    return res.json({ seasonalRevenue:0, baseRevenue:0, totalTons:0, solarCost:0,
                      batteryCost:0, pivotCost:0, totalOpEx:0, netProfit:0, perHH:0,
                      sectorStats:{}, optimalCount:0 });
  }

  let seasonalRevenue = 0, baseRevenue = 0, totalHa = 0, optimalCount = 0;
  const sectorStats = {};
  KIREHE_SECTORS.forEach(s => { sectorStats[s.n] = 0; });

  const updatedMembers = members.map(m => {
    const crop   = CROP_DATA[m.crop] || CROP_DATA.Maize;
    const sProf  = KIREHE_SECTORS.find(s => s.n === m.sector) || { fert: 1.0 };
    const mBase  = Math.min(100, Math.round(baseWRSI / crop.weight));
    const mOpt   = Math.min(100, Math.round(optWRSI  / crop.weight));
    const potTons = m.ha * crop.yield * sProf.fert;
    const baseRev = potTons * (mBase / 100) * MARKET_PRICE_RWF_T;
    const optRev  = potTons * (mOpt  / 100) * MARKET_PRICE_RWF_T;
    baseRevenue     += baseRev;
    seasonalRevenue += optRev;
    totalHa         += parseFloat(m.ha);
    sectorStats[m.sector] = (sectorStats[m.sector] || 0) + optRev;
    if (mOpt > 80) optimalCount++;
    return { ...m, wrsi: mOpt, yield_rwf: optRev };
  });

  const totalTons  = Math.round(totalHa * 4.2 * (optWRSI / 100));
  const inp        = inputs || {};
  const solarCost  = Math.round(((inp.solar_mw    || 0) / 3.3)  * 450_000);
  const pivotCost  = Math.round(((inp.pivots_active|| 0) / 63)  * 620_000);
  const batteryCost = 280_000;
  const totalOpEx  = solarCost + batteryCost + pivotCost;
  const netProfit  = seasonalRevenue - totalOpEx;
  const perHH      = members.length ? Math.round(netProfit / members.length) : 0;

  res.json({ seasonalRevenue, baseRevenue, totalTons, solarCost, batteryCost,
             pivotCost, totalOpEx, netProfit, perHH, sectorStats, optimalCount,
             members: updatedMembers });
});

// ── Static files ──────────────────────────────────────────────────────────────
// Block sensitive files before the static handler.
// Normalize the URL path to defeat encoding tricks (%2e, %2f, mixed-case, etc.)
// so that no variant of these names can reach the filesystem.
const path = require('path');
const SENSITIVE_FILES = new Set([
  'service-account.json',
  '.env',
  '.env.local',
  '.env.production',
  'package-lock.json',
]);

app.use((req, res, next) => {
  // Decode percent-encoding and resolve any ".." components, then take the basename.
  let decoded;
  try { decoded = decodeURIComponent(req.path); } catch { decoded = req.path; }
  const base = path.basename(path.normalize(decoded)).toLowerCase();
  if (SENSITIVE_FILES.has(base)) return res.status(404).end();
  next();
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => { console.log('Server listening on port ' + PORT); });
