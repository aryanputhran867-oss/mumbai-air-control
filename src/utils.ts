import type { Flight } from './types';

export const fmtT = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return '-';
  }
};

export const toRad = (d: number): number => (d * Math.PI) / 180;

export const distNm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const x =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(x));
};

export const fmtLL = (lat: number, lon: number): string => {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
};

export const riskColor = (s: number): string => {
  return s >= 75 ? 'var(--sev)' : s >= 50 ? 'var(--bad)' : s >= 25 ? 'var(--warn)' : 'var(--ok)';
};

export const riskHex = (s: number): string => {
  return s >= 75 ? '#ef4444' : s >= 50 ? '#f87171' : s >= 25 ? '#fbbf24' : '#34d399';
};

export const catF = (f: Flight): string => {
  if (f.onGround) return 'On ground';
  if (f.status === 'Passing through') return 'Passing';
  if (f.status.startsWith('Arriving')) return 'Arriving';
  if (f.status.startsWith('Departing')) return 'Departing';
  return f.status;
};

export const flightColor: Record<string, string> = {
  Arriving: '#4ade80',
  Departing: '#fbbf24',
  'On ground': '#cbd5e1',
  Passing: '#93c5fd',
};

export const minsTo = (iso: string | null | undefined): number => {
  if (!iso) return 0;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
};

export const posDeadReckoning = (
  lat: number,
  lon: number,
  gs: number | null,
  heading: number | null,
  onGround: boolean,
  t0: number,
): [number, number] => {
  if (onGround || !gs || gs < 30 || heading == null) return [lat, lon];
  const dt = Math.min((Date.now() - t0) / 1000, 30);
  const nm = (gs * dt) / 3600;
  const h = toRad(heading);
  return [
    lat + (nm * Math.cos(h)) / 60,
    lon + (nm * Math.sin(h)) / (60 * Math.cos(toRad(lat))),
  ];
};
