import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Flight, AirportData, LocationCoord } from '../types';
import {
  catF,
  flightColor,
  fmtLL,
  fmtT,
  minsTo,
  distNm,
  riskHex,
  posDeadReckoning,
} from '../utils';

interface MapCardProps {
  flights: Flight[];
  airports: Record<string, AirportData>;
  followHex: string | null;
  showTrails: boolean;
  searchQuery: string;
  userLocation: LocationCoord | null;
  locationAccuracy: number | null;
  isTrackingGps: boolean;
  gpsStatusText: string;
  onSearchChange: (q: string) => void;
  onToggleGps: () => void;
  onResetView: () => void;
  onToggleTrails: () => void;
  onSelectFlight: (hex: string | null) => void;
}

interface LiveState {
  f: Flight;
  lat: number;
  lon: number;
  t0: number;
  trail: [number, number][];
  marker: L.Marker | null;
  line: L.Polyline | null;
}

export const MapCard: React.FC<MapCardProps> = ({
  flights,
  airports,
  followHex,
  showTrails,
  searchQuery,
  userLocation,
  locationAccuracy,
  isTrackingGps,
  gpsStatusText,
  onSearchChange,
  onToggleGps,
  onResetView,
  onToggleTrails,
  onSelectFlight,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const liveRef = useRef<Map<string, LiveState>>(new Map());
  const apMarkersRef = useRef<Record<string, { circle: L.Circle; marker: L.Marker }>>({});
  const meMarkerRef = useRef<L.Marker | null>(null);
  const meCircleRef = useRef<L.Circle | null>(null);
  const initialFittedRef = useRef<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.05, 72.95],
      zoom: 10,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Airport circles & markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const a of Object.values(airports)) {
      const color = riskHex(a.risk.score);
      const existing = apMarkersRef.current[a.code];

      if (!existing) {
        const circle = L.circle([a.lat, a.lon], {
          radius: 4000,
          color,
          weight: 1.5,
          fillOpacity: 0.08,
        }).addTo(map);

        const marker = L.marker([a.lat, a.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="color:#fff;font-weight:700;font-size:11px;background:#0f1a2ecc;padding:1px 6px;border-radius:6px;border:1px solid #38bdf8;white-space:nowrap;transform:translate(-50%,-30px)">${a.code}</div>`,
            iconSize: [0, 0],
          }),
          interactive: false,
        }).addTo(map);

        apMarkersRef.current[a.code] = { circle, marker };
      } else {
        existing.circle.setStyle({ color });
      }
    }
  }, [airports]);

  // Ingest flights into live state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const live = liveRef.current;
    const seen = new Set<string>();

    for (const f of flights) {
      seen.add(f.hex);
      let s = live.get(f.hex);
      if (!s) {
        s = {
          f,
          lat: f.lat,
          lon: f.lon,
          t0: Date.now(),
          trail: [],
          marker: null,
          line: null,
        };
        live.set(f.hex, s);
      }
      s.f = f;
      s.lat = f.lat;
      s.lon = f.lon;
      s.t0 = Date.now();

      if (!f.onGround) {
        const last = s.trail[s.trail.length - 1];
        if (!last || last[0] !== f.lat || last[1] !== f.lon) {
          s.trail.push([f.lat, f.lon]);
          if (s.trail.length > 40) s.trail.shift();
        }
      }
    }

    // Clean up removed aircraft
    for (const [hex, s] of live) {
      if (!seen.has(hex)) {
        if (s.marker) map.removeLayer(s.marker);
        if (s.line) map.removeLayer(s.line);
        live.delete(hex);
        if (followHex === hex) {
          onSelectFlight(null);
        }
      }
    }

    // Fit view once initially
    if (!initialFittedRef.current && flights.length > 0) {
      initialFittedRef.current = true;
      const pts = flights.filter((f) => f.distNm < 60).map((f) => [f.lat, f.lon] as [number, number]);
      if (pts.length > 1) {
        map.fitBounds(pts, { padding: [30, 30], maxZoom: 11 });
      }
    }
  }, [flights, followHex, onSelectFlight]);

  // Tick loop: Update aircraft positions, trails, and follow mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const interval = setInterval(() => {
      const live = liveRef.current;

      for (const [hex, s] of live) {
        const p = posDeadReckoning(s.lat, s.lon, s.f.gs, s.f.heading, s.f.onGround, s.t0);
        const cat = catF(s.f);
        const color = flightColor[cat] || '#fff';

        const iconHtml = `<div class="plane" style="color:${color};transform:rotate(${(s.f.heading || 0) - 45}deg)">✈</div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [18, 18] });
        const tooltip = `<b>${s.f.callsign || s.f.hex}</b><br>${s.f.type || ''} ${s.f.reg || ''}<br>${
          s.f.origin ? s.f.origin.code : '?'
        } → ${s.f.destination ? s.f.destination.code : '?'}<br>${s.f.status}<br>${
          s.f.onGround ? 'On ground' : (s.f.alt ?? '?') + ' ft'
        } · ${s.f.gs ?? '?'} kt`;

        if (!s.marker) {
          const marker = L.marker(p, { icon })
            .bindTooltip(tooltip)
            .on('click', () => {
              onSelectFlight(hex);
            })
            .addTo(map);
          s.marker = marker;
        } else {
          s.marker.setLatLng(p).setIcon(icon).setTooltipContent(tooltip);
        }

        // Trails
        if (showTrails && s.trail.length > 1 && !s.f.onGround) {
          const pts = s.trail.concat([p]);
          if (!s.line) {
            s.line = L.polyline(pts, { color, weight: 2, opacity: 0.55 }).addTo(map);
          } else {
            s.line.setLatLngs(pts);
          }
        } else if (s.line) {
          map.removeLayer(s.line);
          s.line = null;
        }
      }

      // If following a specific flight, pan map
      if (followHex && live.has(followHex)) {
        const s = live.get(followHex)!;
        const p = posDeadReckoning(s.lat, s.lon, s.f.gs, s.f.heading, s.f.onGround, s.t0);
        map.panTo(p, { animate: true, duration: 0.8 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [showTrails, followHex, onSelectFlight]);

  // Center on followed flight when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followHex) return;
    const s = liveRef.current.get(followHex);
    if (s) {
      const p = posDeadReckoning(s.lat, s.lon, s.f.gs, s.f.heading, s.f.onGround, s.t0);
      map.setView(p, Math.max(map.getZoom(), 11));
    }
  }, [followHex]);

  // Update user GPS location on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation) {
      const ll: [number, number] = [userLocation.lat, userLocation.lon];
      const acc = locationAccuracy || 20;

      if (!meMarkerRef.current) {
        meMarkerRef.current = L.marker(ll, {
          icon: L.divIcon({
            className: '',
            html: '<div class="me"></div>',
            iconSize: [14, 14],
          }),
        })
          .bindTooltip('You are here')
          .addTo(map);

        meCircleRef.current = L.circle(ll, {
          radius: acc,
          color: '#38bdf8',
          weight: 1,
          fillOpacity: 0.1,
        }).addTo(map);

        map.setView(ll, 11);
      } else {
        meMarkerRef.current.setLatLng(ll);
        if (meCircleRef.current) {
          meCircleRef.current.setLatLng(ll).setRadius(acc);
        }
      }
    } else {
      if (meMarkerRef.current) {
        map.removeLayer(meMarkerRef.current);
        meMarkerRef.current = null;
      }
      if (meCircleRef.current) {
        map.removeLayer(meCircleRef.current);
        meCircleRef.current = null;
      }
    }
  }, [userLocation, locationAccuracy]);

  // Currently followed flight details
  const followedState = followHex ? liveRef.current.get(followHex) : null;
  const followedFlight = followedState?.f || flights.find((f) => f.hex === followHex);
  const currentPos = followedState
    ? posDeadReckoning(
        followedState.lat,
        followedState.lon,
        followedFlight?.gs || null,
        followedFlight?.heading || null,
        followedFlight?.onGround || false,
        followedState.t0,
      )
    : followedFlight
      ? [followedFlight.lat, followedFlight.lon]
      : null;

  return (
    <div className="card">
      <div className="bar2">
        <input
          id="q"
          placeholder="Search callsign, reg, type, route…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          id="btnMe"
          className={isTrackingGps ? 'on' : ''}
          onClick={onToggleGps}
        >
          📍 My live GPS
        </button>
        <button id="btnFit" onClick={onResetView}>
          Reset view
        </button>
        <button
          id="btnTrails"
          className={showTrails ? 'on' : ''}
          onClick={onToggleTrails}
        >
          Trails: {showTrails ? 'on' : 'off'}
        </button>
        {followHex && (
          <button id="btnStop" onClick={() => onSelectFlight(null)}>
            Stop following
          </button>
        )}
        {gpsStatusText && (
          <span style={{ color: 'var(--mut)', fontSize: 12 }}>{gpsStatusText}</span>
        )}
      </div>

      <div id="map" ref={mapContainerRef} />

      {followedFlight && currentPos && (
        <div id="detail">
          <b style={{ fontSize: 16 }}>{followedFlight.callsign || followedFlight.hex}</b>
          {' · '}
          {followedFlight.airline || ''}
          {' · '}
          {followedFlight.type || ''} {followedFlight.reg || ''}
          {' · '}
          <span className={`tag ${followedFlight.onGround ? 'ground' : followedFlight.status.split(' ')[0]}`}>
            {followedFlight.status}
          </span>

          <div className="g">
            <div>
              <small>Route</small>
              {(followedFlight.origin ? followedFlight.origin.code : '?') +
                ' → ' +
                (followedFlight.destination ? followedFlight.destination.code : '?')}
            </div>
            <div>
              <small>Live GPS</small>
              {fmtLL(currentPos[0], currentPos[1])}
            </div>
            <div>
              <small>Altitude</small>
              {followedFlight.onGround
                ? 'On ground'
                : followedFlight.alt != null
                  ? `${followedFlight.alt.toLocaleString()} ft`
                  : '-'}
            </div>
            <div>
              <small>Ground speed</small>
              {followedFlight.gs != null ? `${followedFlight.gs} kt` : '-'}
            </div>
            <div>
              <small>Heading</small>
              {followedFlight.heading != null ? `${Math.round(followedFlight.heading)}°` : '-'}
            </div>
            <div>
              <small>Vertical speed</small>
              {followedFlight.vs != null
                ? `${followedFlight.vs > 0 ? '+' : ''}${followedFlight.vs} fpm`
                : '-'}
            </div>
            <div>
              <small>Est. arrival</small>
              {followedFlight.eta
                ? `${fmtT(followedFlight.eta)} IST (${minsTo(followedFlight.eta)} min) → ${
                    followedFlight.etaTo || 'BOM'
                  }`
                : '-'}
            </div>
            <div>
              <small>Predicted delay (rules)</small>
              {followedFlight.predDelay != null
                ? `+${followedFlight.predDelay} min` +
                  (followedFlight.adjEta ? ` → ${fmtT(followedFlight.adjEta)}` : '')
                : '-'}
            </div>
            <div>
              <small>Predicted delay (ML)</small>
              {followedFlight.mlDelay != null
                ? `+${followedFlight.mlDelay} min` +
                  (followedFlight.mlAdjEta ? ` → ${fmtT(followedFlight.mlAdjEta)}` : '')
                : '-'}
            </div>
            <div>
              <small>Squawk</small>
              {followedFlight.squawk || '-'}
            </div>
            {userLocation && (
              <div>
                <small>From me</small>
                {`${distNm(userLocation.lat, userLocation.lon, currentPos[0], currentPos[1]).toFixed(1)} nm`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
