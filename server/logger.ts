// Logs predictions vs what actually happened, and applies a trained model (data/model.json) if present.
import fs from 'fs';
import path from 'path';
import type { Flight, AirportData, ModelMetrics } from '../src/types';

const DIR = path.join(process.cwd(), 'data');
const CSV = path.join(DIR, 'training.csv');
const MODEL = path.join(DIR, 'model.json');
const COORD: Record<string, [number, number]> = { BOM: [19.0896, 72.8656], NMI: [18.9967, 73.07] };

export const FEATURES = [
  'pred_eta_min', 'dist_nm', 'alt', 'gs', 'vs', 'hour', 'dow', 'is_nmi', 'risk', 'wx_risk', 'cong',
  'vis_km', 'gust', 'xwind', 'precip', 'thunder', 'inbound40', 'ground_busy',
];
const HEAD = ['ts', 'callsign', 'airport', 'rule_pred', ...FEATURES, 'actual_min', 'slip'];

const toRad = (d: number) => (d * Math.PI) / 180;
function distNm(a: number, b: number, c: number, d: number) {
  const x = Math.sin(toRad(c - a) / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(toRad(d - b) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(x));
}

export function featuresFor(f: Flight, ap: AirportData): Record<string, number> {
  const w = ap.weather || ({} as any);
  const ist = new Date(Date.now() + 5.5 * 3600e3);
  const c = COORD[f.toApt || 'BOM'] || COORD.BOM;
  return {
    pred_eta_min: f.eta ? (new Date(f.eta).getTime() - Date.now()) / 60000 : 0,
    dist_nm: distNm(f.lat, f.lon, c[0], c[1]),
    alt: f.alt || 0,
    gs: f.gs || 0,
    vs: f.vs || 0,
    hour: ist.getUTCHours(),
    dow: ist.getUTCDay(),
    is_nmi: f.toApt === 'NMI' ? 1 : 0,
    risk: ap.risk.score,
    wx_risk: ap.risk.weather,
    cong: ap.risk.congestion,
    vis_km: w.vis != null ? w.vis / 1000 : 10,
    gust: w.gust || 0,
    xwind: ap.runway ? ap.runway.gustCross : 0,
    precip: w.precip || 0,
    thunder: w.code && [95, 96, 99].includes(w.code) ? 1 : 0,
    inbound40: ap.traffic.inbound40,
    ground_busy: ap.traffic.taxiing + ap.traffic.holding,
  };
}

// ---- stored rows ----
let rows: any[] = [];
export function loadRows() {
  try {
    const content = fs.readFileSync(CSV, 'utf8').trim();
    if (!content) { rows = []; return; }
    const lines = content.split('\n');
    const head = lines.shift()!.split(',');
    rows = lines.map((l) => {
      const v = l.split(',');
      const o: Record<string, any> = {};
      head.forEach((h, i) => {
        o[h] = isNaN(+v[i]) || h === 'callsign' || h === 'ts' || h === 'airport' ? v[i] : +v[i];
      });
      return o;
    });
  } catch (e) {
    rows = [];
  }
}
loadRows();

export function saveRow(r: Record<string, any>) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, HEAD.join(',') + '\n');
    fs.appendFileSync(
      CSV,
      HEAD.map((h) => (typeof r[h] === 'number' ? Math.round(r[h] * 1000) / 1000 : r[h])).join(',') + '\n',
    );
  } catch (e) {
    // ignore
  }
  rows.push(r);
}

// ---- model (random forest exported by train.py) ----
let model: any = null;
let modelMtime = 0;
let lastCheck = 0;

export function loadModel() {
  if (Date.now() - lastCheck < 60000) return;
  lastCheck = Date.now();
  try {
    const stat = fs.statSync(MODEL);
    const m = stat.mtimeMs;
    if (m !== modelMtime) {
      model = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
      modelMtime = m;
      console.log('Loaded ML model', model.metrics);
    }
  } catch (e) {
    model = null;
  }
}

function predictTree(t: any, x: number[]): number {
  let i = 0;
  while (t.left[i] !== -1) {
    i = x[t.feat[i]] <= t.thr[i] ? t.left[i] : t.right[i];
  }
  return t.val[i];
}

export function predict(feat: Record<string, number>): number {
  if (!model || !model.features || !model.trees) return 0;
  const x = model.features.map((n: string) => feat[n] ?? 0);
  let s = 0;
  for (const t of model.trees) s += predictTree(t, x);
  return s / model.trees.length;
}

// ---- tracking ----
interface TrackRecord {
  callsign: string;
  airport: string;
  t0: number;
  feat: Record<string, number>;
  rule_pred: number;
  last: { t: number; dist: number; alt: number };
}

const tracked = new Map<string, TrackRecord>(); // hex -> record
const cooldown = new Map<string, number>(); // hex -> time

function finalize(r: TrackRecord, landT: number) {
  const actual = (landT - r.t0) / 60000;
  const slip = actual - r.feat.pred_eta_min;
  if (actual > 0 && actual < 150 && slip > -20 && slip < 90) {
    saveRow({
      ts: new Date(landT).toISOString(),
      callsign: r.callsign,
      airport: r.airport,
      rule_pred: r.rule_pred,
      ...r.feat,
      actual_min: actual,
      slip,
    });
  }
}

export function update(flights: Flight[], airports: Record<string, AirportData>) {
  loadModel();
  const now = Date.now();
  const byHex = new Map(flights.map((f) => [f.hex, f]));

  for (const f of flights) {
    f.mlDelay = null;
    f.mlAdjEta = null;
    const ap = f.toApt && airports[f.toApt];
    if (!ap || f.onGround || !f.eta || f.status !== 'Arriving') continue;
    const m = (new Date(f.eta).getTime() - now) / 60000;
    if (model && m > 3 && m < 90) {
      try {
        f.mlDelay = Math.max(0, Math.round(predict(featuresFor(f, ap))));
        f.mlAdjEta = new Date(new Date(f.eta).getTime() + f.mlDelay * 60000).toISOString();
      } catch (e) {
        // ignore
      }
    }
    // start tracking when 10-60 min out and clearly in flight
    if (
      !tracked.has(f.hex) &&
      m >= 10 &&
      m <= 60 &&
      (f.gs || 0) > 100 &&
      (f.alt || 0) > 500 &&
      (!cooldown.has(f.hex) || now - cooldown.get(f.hex)! > 3 * 3600e3)
    ) {
      tracked.set(f.hex, {
        callsign: f.callsign || f.hex,
        airport: f.toApt,
        t0: now,
        feat: featuresFor(f, ap),
        rule_pred: ap.delay.arrivals,
        last: { t: now, dist: 999, alt: f.alt || 0 },
      });
      cooldown.set(f.hex, now);
    }
  }

  for (const [hex, r] of tracked) {
    const f = byHex.get(hex);
    const c = COORD[r.airport] || COORD.BOM;
    if (now - r.t0 > 150 * 60000) {
      tracked.delete(hex);
      continue;
    }
    if (f) {
      if (f.onGround) {
        if (f.gndApt === r.airport) finalize(r, now);
        tracked.delete(hex);
      } else {
        r.last = { t: now, dist: distNm(f.lat, f.lon, c[0], c[1]), alt: f.alt || 0 };
      }
    } else if (now - r.last.t > 120000) {
      if (r.last.dist < 8 && r.last.alt < 3000) finalize(r, r.last.t);
      tracked.delete(hex);
    }
  }
}

export function summary(): ModelMetrics {
  const n = rows.length;
  const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);
  return {
    n,
    target: 200,
    tracking: tracked.size,
    maeRule: r1(mean(rows.map((r) => Math.abs(r.slip - r.rule_pred)))),
    maeZero: r1(mean(rows.map((r) => Math.abs(r.slip)))),
    ml: model ? { ...model.metrics } : null,
    recent: rows.slice(-6).reverse().map((r) => ({
      callsign: r.callsign,
      airport: r.airport,
      predicted: Math.round(r.pred_eta_min),
      actual: Math.round(r.actual_min),
      slip: Math.round(r.slip),
      rule: Math.round(r.rule_pred),
    })),
  };
}
