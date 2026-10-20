// Mumbai live flights dashboard. No dependencies. Needs Node 18+.
const http = require('http');
const fs = require('fs');
const path = require('path');
const analytics = require('./analytics');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;
const CENTER = { lat: 19.0896, lon: 72.8656 }; // Mumbai (VABB)
const R = Number(process.env.RADIUS_NM || 100);
const dLat = R / 60, dLon = R / (60 * Math.cos((CENTER.lat * Math.PI) / 180));
const TEST = !!process.env.TEST_MODE;

const FR24_URL = process.env.FR24_URL ||
  `https://data-cloud.flightradar24.com/zones/fcgi/feed.js?faa=1&bounds=${CENTER.lat + dLat},${CENTER.lat - dLat},${CENTER.lon - dLon},${CENTER.lon + dLon}` +
  `&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=0&estimated=1&maxage=14400&gliders=0&stats=0`;
const ADSB_SOURCES = TEST ? [] : [
  { name: 'adsb.lol', url: `https://api.adsb.lol/v2/lat/${CENTER.lat}/lon/${CENTER.lon}/dist/${R}` },
  { name: 'airplanes.live', url: `https://api.airplanes.live/v2/point/${CENTER.lat}/${CENTER.lon}/${R}` },
  { name: 'adsb.fi', url: `https://opendata.adsb.fi/api/v2/lat/${CENTER.lat}/lon/${CENTER.lon}/dist/${R}` },
  { name: 'adsb.one', url: `https://api.adsb.one/v2/point/${CENTER.lat}/${CENTER.lon}/${R}` },
];
const OPENSKY_URL = `https://opensky-network.org/api/states/all?lamin=${CENTER.lat - dLat}&lamax=${CENTER.lat + dLat}&lomin=${CENTER.lon - dLon}&lomax=${CENTER.lon + dLon}`;

const AIRPORTS = [
  { code: 'BOM', name: 'Mumbai (CSMIA)', lat: 19.0896, lon: 72.8656, mumbai: true },
  { code: 'NMI', name: 'Navi Mumbai (NMIA)', lat: 18.9967, lon: 73.0700, mumbai: true },
  { code: 'JUH', name: 'Juhu', lat: 19.0979, lon: 72.8343 },
  { code: 'PNQ', name: 'Pune', lat: 18.5821, lon: 73.9197 },
  { code: 'ISK', name: 'Nashik', lat: 20.1192, lon: 73.9129 },
];
// approx coordinates, used only for estimated arrival time
const COORD = {
  DEL: [28.556, 77.1], BLR: [13.198, 77.706], HYD: [17.24, 78.429], MAA: [12.994, 80.171], CCU: [22.655, 88.447],
  GOI: [15.381, 73.831], GOX: [15.744, 73.871], AMD: [23.077, 72.635], COK: [10.152, 76.402], JAI: [26.824, 75.812],
  LKO: [26.761, 80.889], NAG: [21.092, 79.047], IDR: [22.722, 75.801], VNS: [25.452, 82.859], GOP: [26.74, 83.45],
  ATQ: [31.71, 74.797], CCJ: [11.137, 75.955], TRV: [8.482, 76.92], PAT: [25.591, 85.088], BBI: [20.244, 85.818],
  RPR: [21.18, 81.739], IXC: [30.674, 76.789], SXR: [34.009, 74.774], STV: [21.114, 72.742], BDQ: [22.336, 73.226],
  UDR: [24.618, 73.896], BHO: [23.288, 77.337], IXE: [12.961, 74.89], GAU: [26.106, 91.586], HBX: [15.362, 75.085],
  VGA: [16.53, 80.797], VTZ: [17.721, 83.225], CJB: [11.03, 77.043], IXR: [23.314, 85.322], PNQ: [18.582, 73.92],
  DXB: [25.253, 55.364], AUH: [24.433, 54.651], SHJ: [25.329, 55.517], DOH: [25.273, 51.608], MCT: [23.593, 58.284],
  RUH: [24.958, 46.699], JED: [21.68, 39.157], KWI: [29.227, 47.969], BAH: [26.271, 50.634], SIN: [1.364, 103.992],
  BKK: [13.69, 100.75], KUL: [2.746, 101.71], LHR: [51.47, -0.454], CMB: [7.181, 79.884], DAC: [23.843, 90.398],
  KTM: [27.697, 85.359], MLE: [4.192, 73.529], FRA: [50.038, 8.562], CDG: [49.01, 2.548], BOM: [19.0896, 72.8656], NMI: [18.9967, 73.07],
};
const AIRLINES = { IGO: 'IndiGo', AIC: 'Air India', AXB: 'Air India Express', VTI: 'Vistara', SEJ: 'SpiceJet', IAD: 'AIX Connect',
  AKJ: 'Akasa Air', UAE: 'Emirates', QTR: 'Qatar Airways', ETD: 'Etihad', SIA: 'Singapore Airlines', BAW: 'British Airways',
  DLH: 'Lufthansa', FDB: 'flydubai', GFA: 'Gulf Air', OMA: 'Oman Air', SVA: 'Saudia', ABY: 'Air Arabia', ALK: 'SriLankan', FIA: 'Fly Alliance' };

const toRad = (d) => (d * Math.PI) / 180;
function distNm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(a));
}
function nearest(lat, lon, list) {
  let best = null;
  for (const a of list) {
    const d = distNm(lat, lon, a.lat, a.lon);
    if (!best || d < best.d) best = { airport: a, d };
  }
  return best;
}
const apt = (code) => (code ? { code, name: code, lat: COORD[code] ? COORD[code][0] : null, lon: COORD[code] ? COORD[code][1] : null } : null);

// ---- route lookup fallback (adsbdb.com) ----
const routeCache = new Map();
const pending = new Set();
let active = 0;
const queue = [];
const ROUTE_TTL = 6 * 3600e3;
function lookupRoute(cs) {
  const c = routeCache.get(cs);
  if ((c && Date.now() - c.at < ROUTE_TTL) || pending.has(cs)) return;
  pending.add(cs);
  queue.push(cs);
  pump();
}
function pump() {
  while (active < 3 && queue.length) {
    const cs = queue.shift();
    active++;
    fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const fr = j && j.response && j.response.flightroute;
        const pick = (p) => p && { code: p.iata_code, name: p.municipality || p.name, lat: p.latitude, lon: p.longitude };
        routeCache.set(cs, { at: Date.now(), route: fr ? { origin: pick(fr.origin), destination: pick(fr.destination), airline: fr.airline && fr.airline.name } : null });
      })
      .catch(() => routeCache.set(cs, { at: Date.now() - ROUTE_TTL + 300e3, route: null }))
      .finally(() => { active--; pending.delete(cs); pump(); });
  }
}

// ---- data sources ----
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'application/json', origin: 'https://www.flightradar24.com', referer: 'https://www.flightradar24.com/',
};

async function srcFr24() {
  const r = await fetch(FR24_URL, { signal: AbortSignal.timeout(12000), headers: HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const list = [];
  for (const [k, v] of Object.entries(j)) {
    if (!Array.isArray(v) || v.length < 17) continue;
    const gnd = v[14] === 1;
    list.push({
      hex: String(v[0] || k).toLowerCase(), lat: v[1], lon: v[2], track: v[3],
      alt_baro: gnd ? 'ground' : v[4], gs: v[5], squawk: v[6] ? String(v[6]).padStart(4, '0') : null,
      t: v[8] || null, r: v[9] || null, flight: v[16] || v[13] || '', baro_rate: v[15],
      _route: v[11] || v[12] ? { origin: apt(v[11]), destination: apt(v[12]) } : null,
    });
  }
  return list;
}
async function srcAdsb(s) {
  const r = await fetch(s.url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': HEADERS['user-agent'] } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.ac || j.aircraft || [];
}
let osCache = { at: 0, list: [], err: null };
async function srcOpenSky() {
  if (Date.now() - osCache.at < 120000) { if (osCache.err) throw osCache.err; return osCache.list; }
  osCache.at = Date.now();
  try {
    const r = await fetch(OPENSKY_URL, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    osCache.err = null;
    osCache.list = (j.states || []).map((s) => ({
      hex: s[0], flight: (s[1] || '').trim(), lon: s[5], lat: s[6],
      alt_baro: s[8] ? 'ground' : s[7] != null ? Math.round(s[7] * 3.28084) : null,
      gs: s[9] != null ? s[9] * 1.94384 : null, track: s[10],
      baro_rate: s[11] != null ? Math.round(s[11] * 196.85) : null, squawk: s[14],
    }));
  } catch (e) { osCache.err = e; throw e; }
  return osCache.list;
}

let cache = { at: 0, data: null };
async function fetchAll() {
  const jobs = [['flightradar24', srcFr24()]];
  for (const s of ADSB_SOURCES) jobs.push([s.name, srcAdsb(s)]);
  if (!TEST) jobs.push(['opensky', srcOpenSky()]);
  const res = await Promise.allSettled(jobs.map((j) => j[1]));
  const merged = new Map();
  const status = [];
  res.forEach((x, i) => {
    const name = jobs[i][0];
    if (x.status !== 'fulfilled') { status.push(`${name}: ${x.reason && x.reason.message || 'failed'}`); return; }
    status.push(`${name}(${x.value.length})`);
    for (const a of x.value) {
      if (!a.hex || typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
      if (a.seen_pos != null && a.seen_pos > 120) continue;
      const k = a.hex.toLowerCase();
      const old = merged.get(k);
      if (!old) merged.set(k, { ...a });
      else for (const f of ['flight', 'r', 't', 'desc', 'squawk', 'gs', 'track', 'baro_rate', '_route']) if (old[f] == null || old[f] === '') old[f] = a[f];
    }
  });
  const line = status.join(' | ');
  console.log(new Date().toLocaleTimeString(), line, '=> total', merged.size);
  if (!merged.size && status.every((s) => s.includes(': '))) throw new Error('All sources failed -> ' + line);
  return { aircraft: [...merged.values()], source: line };
}

function build(ac) {
  const now = Date.now();
  const out = [];
  let looked = 0;
  for (const a of ac) {
    const callsign = (a.flight || '').trim();
    const onGround = a.alt_baro === 'ground';
    const alt = onGround ? 0 : typeof a.alt_baro === 'number' ? a.alt_baro : null;
    const gs = typeof a.gs === 'number' ? a.gs : null;
    const vs = a.baro_rate ?? a.geom_rate ?? null;
    const near = nearest(a.lat, a.lon, AIRPORTS);
    const mum = nearest(a.lat, a.lon, AIRPORTS.filter((x) => x.mumbai));

    let route = a._route ? { origin: a._route.origin, destination: a._route.destination } : null;
    if (!route && callsign) {
      const c = routeCache.get(callsign);
      if (c) route = c.route;
      if ((!c || now - c.at > ROUTE_TTL) && looked < 30 && (mum.d < 60 || onGround)) { lookupRoute(callsign); looked++; }
    }
    const O = route && route.origin, D = route && route.destination;
    const isMum = (p) => p && (p.code === 'BOM' || p.code === 'NMI');

    let status, airport = null;
    if (onGround) {
      airport = near.d < 8 ? near.airport.name : null;
      status = gs != null && gs > 40 ? 'Takeoff/landing roll' : gs != null && gs > 3 ? 'Taxiing' : 'Parked / holding';
      if (gs != null && gs > 3 && gs <= 40) { if (isMum(D)) status = 'Taxiing in (arrived)'; else if (isMum(O)) status = 'Taxiing out (departing)'; }
    } else if (isMum(D)) status = 'Arriving';
    else if (isMum(O) && (alt == null || alt < 25000)) status = 'Departing';
    else if (vs != null && vs < -300 && alt != null && alt < 12000 && mum.d < 60) status = 'Arriving';
    else if (vs != null && vs > 300 && alt != null && alt < 12000 && mum.d < 40) status = 'Departing';
    else status = 'Passing through';

    let eta = null, etaTo = null;
    if (!onGround && gs && gs > 60) {
      const target = D && D.lat != null ? D : status === 'Arriving' ? mum.airport : null;
      if (target) {
        const mins = (distNm(a.lat, a.lon, target.lat, target.lon) / gs) * 60;
        if (mins < 900) { eta = new Date(now + mins * 60e3).toISOString(); etaTo = target.code || target.name; }
      }
    }

    out.push({
      hex: a.hex, callsign, reg: a.r || null, type: a.t || a.desc || null,
      lat: a.lat, lon: a.lon, alt, gs: gs != null ? Math.round(gs) : null,
      heading: a.track ?? a.true_heading ?? null, vs, squawk: a.squawk || null,
      onGround, status, airport,
      distNm: Math.round(mum.d * 10) / 10,
      origin: O ? { code: O.code, name: O.name } : null,
      destination: D ? { code: D.code, name: D.name } : null,
      airline: (route && route.airline) || AIRLINES[callsign.slice(0, 3)] || null,
      eta, etaTo, military: !!(a.dbFlags & 1),
      toApt: !onGround ? (isMum(D) ? D.code : status === 'Arriving' ? mum.airport.code : null) : null,
      fromApt: isMum(O) ? O.code : status === 'Departing' ? mum.airport.code : null,
      gndApt: onGround && near.d < 8 && near.airport.mumbai ? near.airport.code : null,
    });
  }
  out.sort((x, y) => x.distNm - y.distNm);
  return out;
}

async function getFlights() {
  if (cache.data && Date.now() - cache.at < 5000) return cache.data;
  const { aircraft, source } = await fetchAll();
  cache = { at: Date.now(), data: { updated: new Date().toISOString(), source, center: CENTER, flights: build(aircraft) } };
  return cache.data;
}

// ---- history (risk + traffic over time), saved to data/history.json ----
const HIST_FILE = path.join(__dirname, 'data', 'history.json');
let history = [];
try { history = JSON.parse(fs.readFileSync(HIST_FILE, 'utf8')); } catch (e) { history = []; }
let lastHist = 0, lastSave = 0;
function recordHistory(airports) {
  if (Date.now() - lastHist < 60000) return;
  lastHist = Date.now();
  const p = { t: new Date().toISOString() };
  for (const c of Object.keys(airports)) p[c] = { risk: airports[c].risk.score, arr: airports[c].traffic.arriving, dep: airports[c].traffic.departing, gnd: airports[c].traffic.onGround };
  history.push(p);
  if (history.length > 360) history.shift();
  if (Date.now() - lastSave > 300000) {
    lastSave = Date.now();
    try { fs.mkdirSync(path.dirname(HIST_FILE), { recursive: true }); fs.writeFileSync(HIST_FILE, JSON.stringify(history)); } catch (e) { /* ignore */ }
  }
}

let dash = { at: 0, data: null };
async function getDashboard() {
  if (dash.data && Date.now() - dash.at < 5000) return dash.data;
  const base = await getFlights();
  const flights = base.flights.map((f) => ({ ...f }));
  const [wBOM, wNMI, metars] = await Promise.all([analytics.getWeather('BOM'), analytics.getWeather('NMI'), analytics.getMetars()]);
  const airports = analytics.compute(flights, { BOM: wBOM, NMI: wNMI }, metars);
  recordHistory(airports);
  try { logger.update(flights, airports); } catch (e) { console.log('logger error', e.message); }
  dash = { at: Date.now(), data: { updated: base.updated, source: base.source, center: base.center, flights, airports, history: history.slice(-120), model: logger.summary() } };
  return dash.data;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/dashboard') {
    try {
      const d = await getDashboard();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(d));
    } catch (e) {
      console.log('ERROR', e.message);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  if (url.pathname === '/api/flights') {
    try {
      const d = await getFlights();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(d));
    } catch (e) {
      console.log('ERROR', e.message);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Mumbai flights dashboard: http://localhost:${PORT}`));