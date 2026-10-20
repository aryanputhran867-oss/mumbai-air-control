export interface LocationCoord {
  lat: number;
  lon: number;
}

export interface AirportLocation extends LocationCoord {
  code: string;
  name: string;
}

export interface FlightRoutePoint {
  code: string;
  name: string;
  lat?: number | null;
  lon?: number | null;
}

export interface Flight {
  hex: string;
  callsign: string;
  reg: string | null;
  type: string | null;
  lat: number;
  lon: number;
  alt: number | null;
  gs: number | null;
  heading: number | null;
  vs: number | null;
  squawk: string | null;
  onGround: boolean;
  status: string;
  airport: string | null;
  distNm: number;
  origin: FlightRoutePoint | null;
  destination: FlightRoutePoint | null;
  airline: string | null;
  eta: string | null;
  etaTo: string | null;
  military: boolean;
  toApt: string | null;
  fromApt: string | null;
  gndApt: string | null;
  predDelay?: number | null;
  adjEta?: string | null;
  mlDelay?: number | null;
  mlAdjEta?: string | null;
}

export interface RunwayInfo {
  id: string;
  headwind: number;
  crosswind: number;
  gustCross: number;
}

export interface WeatherNow {
  temp: number;
  feels: number;
  hum: number;
  precip: number;
  code: number;
  cloud: number;
  pressure: number;
  wind: number;
  dir: number;
  gust: number;
  vis: number;
  desc?: string;
  icon?: string;
}

export interface WeatherHourlyForecast {
  time: string;
  score: number;
  prob: number;
  gust: number;
  vis: number;
  precip: number;
  desc: string;
  icon: string;
}

export interface AirportData {
  code: string;
  icao: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  weather: WeatherNow | null;
  weatherError: string | null;
  runway: RunwayInfo | null;
  category: string | null;
  metar: { raw: string; cat?: string | null; time?: string | null } | null;
  risk: {
    score: number;
    label: string;
    weather: number;
    congestion: number;
    reasons: string[];
  };
  delay: {
    arrivals: number;
    departures: number;
  };
  traffic: {
    arriving: number;
    inbound40: number;
    departing: number;
    onGround: number;
    taxiing: number;
    holding: number;
  };
  forecast: WeatherHourlyForecast[];
  arrivalsNext2h: number[];
  insight: string;
}

export interface ModelMetrics {
  n: number;
  target: number;
  tracking: number;
  maeRule: number | null;
  maeZero: number | null;
  ml: {
    n: number;
    mae_ml: number;
    mae_rule: number;
    mae_zero: number;
    trained_at: string;
    demo?: boolean;
    importance?: [string, number][];
  } | null;
  recent: {
    callsign: string;
    airport: string;
    predicted: number;
    actual: number;
    slip: number;
    rule: number;
  }[];
}

export interface HistoryPoint {
  t: string;
  BOM?: { risk: number; arr: number; dep: number; gnd: number };
  NMI?: { risk: number; arr: number; dep: number; gnd: number };
}

export interface DashboardResponse {
  updated: string;
  source: string;
  center: LocationCoord;
  flights: Flight[];
  airports: Record<string, AirportData>;
  history: HistoryPoint[];
  model: ModelMetrics;
  error?: string;
}
