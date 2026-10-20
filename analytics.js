// Weather + delay-risk analytics for BOM and NMI. No dependencies.
const INFO = {
  BOM: { icao: 'VABB', name: 'Chhatrapati Shivaji Maharaj Intl', short: 'Mumbai', lat: 19.0896, lon: 72.8656, ends: [['09', 90], ['27', 270], ['14', 140], ['32', 320]] },
  NMI: { icao: 'VANM', name: 'Navi Mumbai Intl', short: 'Navi Mumbai', lat: 18.9967, lon: 73.07, ends: [['08', 80], ['26', 260]] },
};
const WX = { 0: ['Clear', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'], 45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'], 61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  80: ['Light showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'], 95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Severe thunderstorm', '⛈️'] };
const wxText = (c) => (WX[c] || ['Unknown', '❔']);

const rad = (d) => (d * Math.PI) / 180;
function bestRunway(code, dir, spd, gust) {
  if (dir == null || spd == null) return null;
  let best = null;
  for (const [id, hdg] of INFO[code].ends) {
    const head = spd * Math.cos(rad(dir - hdg));
    if (!best || head > best.headwind) best = { id, headwind: head, crosswind: Math.abs(spd * Math.sin(rad(dir - hdg))), gustCross: Math.abs((gust || spd) * Math.sin(rad(dir - hdg))) };
  }
  return { id: best.id, headwind: Math.round(best.headwind), crosswind: Math.round(best.crosswind), gustCross: Math.round(best.gustCross) };
}

function flightCategory(vis) {
  if (vis == null) return null;
  return vis >= 8000 ? 'VFR' : vis >= 4800 ? 'MVFR' : vis >= 1600 ? 'IFR' : 'LIFR';
}

// weather -> 0..100 delay risk + human reasons
function weatherRisk(code, w) {
  let s = 0; const why = [];
  const rw = bestRunway(code, w.dir, w.wind, w.gust);
  const xw = rw ? rw.gustCross : 0;
  if (w.vis != null) {
    if (w.vis < 800) { s += 40; why.push(`very low visibility (${(w.vis / 1000).toFixed(1)} km)`); }
    else if (w.vis < 1500) { s += 30; why.push(`low visibility (${(w.vis / 1000).toFixed(1)} km)`); }
    else if (w.vis < 3000) { s += 20; why.push(`reduced visibility (${(w.vis / 1000).toFixed(1)} km)`); }
    else if (w.vis < 5000) { s += 10; why.push(`hazy (${(w.vis / 1000).toFixed(1)} km)`); }
  }
  const g = w.gust || w.wind || 0;
  if (g >= 40) { s += 28; why.push(`strong gusts (${Math.round(g)} kt)`); }
  else if (g >= 30) { s += 20; why.push(`gusty (${Math.round(g)} kt)`); }
  else if (g >= 22) { s += 12; why.push(`breezy gusts (${Math.round(g)} kt)`); }
  else if (g >= 16) s += 5;
  if (xw >= 30) { s += 25; why.push(`crosswind ${xw} kt`); }
  else if (xw >= 20) { s += 14; why.push(`crosswind ${xw} kt`); }
  else if (xw >= 12) s += 6;
  if ([95, 96, 99].includes(w.code)) { s += 30; why.push('thunderstorm'); }
  if ([45, 48].includes(w.code)) { s += 15; why.push('fog'); }
  const p = w.precip || 0;
  if (p >= 7.6) { s += 18; why.push('heavy rain'); } else if (p >= 2.5) { s += 10; why.push('moderate rain'); } else if (p >= 0.5) s += 4;
  return { score: Math.min(100, s), why, runway: rw };
}
const label = (s) => (s >= 75 ? 'Severe' : s >= 50 ? 'High' : s >= 25 ? 'Moderate' : 'Low');

// ---- weather fetch (Open-Meteo, no key) cached 10 min ----
const wxCache = {};
async function getWeather(code) {
  const c = wxCache[code];
  if (c && Date.now() - c.at < 600e3) return c.data;
  const a = INFO[code];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility` +
    `&hourly=precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover` +
    `&wind_speed_unit=kn&timezone=Asia%2FKolkata&forecast_days=2`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const cu = j.current, h = j.hourly;
    const now = { temp: cu.temperature_2m, feels: cu.apparent_temperature, hum: cu.relative_humidity_2m, precip: cu.precipitation, code: cu.weather_code,
      cloud: cu.cloud_cover, pressure: cu.pressure_msl, wind: cu.wind_speed_10m, dir: cu.wind_direction_10m, gust: cu.wind_gusts_10m, vis: cu.visibility };
    let i0 = h.time.findIndex((t) => t >= cu.time.slice(0, 13));
    if (i0 < 0) i0 = 0;
    const hourly = [];
    for (let i = i0; i < Math.min(i0 + 9, h.time.length); i++) {
      hourly.push({ time: h.time[i].slice(11, 16), prob: h.precipitation_probability[i], precip: h.precipitation[i], code: h.weather_code[i],
        wind: h.wind_speed_10m[i], dir: h.wind_direction_10m[i], gust: h.wind_gusts_10m[i], vis: h.visibility[i], cloud: h.cloud_cover[i] });
    }
    const data = { now, hourly, ok: true };
    wxCache[code] = { at: Date.now(), data };
    return data;
  } catch (e) {
    if (c) return c.data;
    return { ok: false, error: e.message };
  }
}

// ---- METAR (aviationweather.gov) cached 10 min ----
let metarCache = { at: 0, data: {} };
async function getMetars() {
  if (Date.now() - metarCache.at < 600e3) return metarCache.data;
  metarCache.at = Date.now();
  try {
    const r = await fetch('https://aviationweather.gov/api/data/metar?ids=VABB,VANM&format=json', { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'mumbai-flights-dashboard' } });
    const t = await r.text();
    const arr = t ? JSON.parse(t) : [];
    const out = {};
    for (const m of arr) out[m.icaoId] = { raw: m.rawOb, cat: m.fltCat || null, time: m.reportTime || null };
    metarCache.data = out;
  } catch (e) { /* keep old */ }
  return metarCache.data;
}

// ---- main: flights + weather -> airport analytics, annotate flights with predicted delay ----
function compute(flights, wx, metars) {
  const airports = {};
  for (const code of Object.keys(INFO)) {
    const i = INFO[code], w = wx[code];
    const arr = flights.filter((f) => !f.onGround && f.toApt === code);
    const dep = flights.filter((f) => !f.onGround && f.fromApt === code && f.status === 'Departing');
    const gnd = flights.filter((f) => f.gndApt === code);
    const taxi = gnd.filter((f) => f.gs != null && f.gs > 3 && f.gs <= 40);
    const hold = gnd.filter((f) => f.gs == null || f.gs <= 3);
    const inbound40 = arr.filter((f) => f.distNm < 40);

    let wRisk = { score: 0, why: [], runway: null }, forecast = [];
    if (w && w.ok) {
      const n = w.now;
      wRisk = weatherRisk(code, { vis: n.vis, wind: n.wind, dir: n.dir, gust: n.gust, precip: n.precip, code: n.code });
      forecast = w.hourly.map((h) => {
        const r = weatherRisk(code, { vis: h.vis, wind: h.wind, dir: h.dir, gust: h.gust, precip: h.precip, code: h.code });
        return { time: h.time, score: r.score, prob: h.prob, gust: Math.round(h.gust || 0), vis: h.vis, precip: h.precip, desc: wxText(h.code)[0], icon: wxText(h.code)[1] };
      });
    }
    // congestion adds to risk
    let cong = 0; const why = [...wRisk.why];
    if (inbound40.length >= 9) { cong += 15; why.push(`heavy arrival traffic (${inbound40.length} inbound)`); }
    else if (inbound40.length >= 6) { cong += 8; why.push(`busy arrivals (${inbound40.length} inbound)`); }
    if (taxi.length + hold.length >= 8) { cong += 10; why.push(`crowded apron (${taxi.length + hold.length} on ground)`); }
    const score = Math.min(100, wRisk.score + cong);

    const baseDelay = Math.pow(score / 100, 1.3) * 30;
    const arrDelay = Math.round(baseDelay + Math.max(0, inbound40.length - 4) * 1.2);
    const depDelay = Math.round(baseDelay * 0.6 + Math.max(0, taxi.length - 4) * 1.5);

    // arrivals bucketed by estimated arrival (15 min slots, next 2h)
    const buckets = Array(8).fill(0);
    for (const f of arr) { if (!f.eta) continue; const m = (new Date(f.eta) - Date.now()) / 60000; const b = Math.floor(m / 15); if (b >= 0 && b < 8) buckets[b]++; }

    const m = metars[i.icao] || null;
    const cat = (m && m.cat) || flightCategory(w && w.ok ? w.now.vis : null);
    let insight;
    if (!(w && w.ok)) insight = `Weather data unavailable right now, so risk is based on traffic only (${label(score)}).`;
    else if (!why.length) insight = 'Conditions are good. No significant weather or traffic delays expected.';
    else insight = `${label(score)} delay risk: ${why.slice(0, 3).join(', ')}. Expect roughly ${arrDelay} min on arrivals and ${depDelay} min on departures.`;

    airports[code] = {
      code, icao: i.icao, name: i.name, short: i.short, lat: i.lat, lon: i.lon,
      weather: w && w.ok ? { ...w.now, desc: wxText(w.now.code)[0], icon: wxText(w.now.code)[1] } : null,
      weatherError: w && !w.ok ? w.error : null,
      runway: wRisk.runway, category: cat, metar: m,
      risk: { score, label: label(score), weather: wRisk.score, congestion: cong, reasons: why },
      delay: { arrivals: arrDelay, departures: depDelay },
      traffic: { arriving: arr.length, inbound40: inbound40.length, departing: dep.length, onGround: gnd.length, taxiing: taxi.length, holding: hold.length },
      forecast, arrivalsNext2h: buckets, insight,
    };
  }
  // per-flight predicted delay + adjusted ETA
  for (const f of flights) {
    f.predDelay = null; f.adjEta = null;
    if (!f.onGround && f.toApt && airports[f.toApt] && f.status === 'Arriving') {
      f.predDelay = airports[f.toApt].delay.arrivals;
      if (f.eta) f.adjEta = new Date(new Date(f.eta).getTime() + f.predDelay * 60000).toISOString();
    } else if (f.onGround && f.gndApt && airports[f.gndApt] && f.status.startsWith('Taxiing out')) f.predDelay = airports[f.gndApt].delay.departures;
    else if (f.status === 'Departing' && f.fromApt && airports[f.fromApt]) f.predDelay = airports[f.fromApt].delay.departures;
  }
  return airports;
}

module.exports = { INFO, getWeather, getMetars, compute };
