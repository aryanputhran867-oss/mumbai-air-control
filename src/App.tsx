import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Flight, AirportData, ModelMetrics, LocationCoord, DashboardResponse } from './types';
import { Header } from './components/Header';
import { AirportCard } from './components/AirportCard';
import { LearningPanel } from './components/LearningPanel';
import { MapCard } from './components/MapCard';
import { NextArrivals } from './components/NextArrivals';
import { FlightTable } from './components/FlightTable';
import { catF, fmtT, fmtLL } from './utils';

const REFRESH_MS = 8000;

export const App: React.FC = () => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [airports, setAirports] = useState<Record<string, AirportData>>({});
  const [model, setModel] = useState<ModelMetrics | null>(null);
  const [statusText, setStatusText] = useState<string>('connecting…');
  const [sourceTooltip, setSourceTooltip] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [followHex, setFollowHex] = useState<string | null>(null);
  const [showTrails, setShowTrails] = useState<boolean>(true);

  // GPS Location state
  const [userLocation, setUserLocation] = useState<LocationCoord | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isTrackingGps, setIsTrackingGps] = useState<boolean>(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>('');
  const [watchId, setWatchId] = useState<number | null>(null);

  // Fetch Dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: DashboardResponse = await res.json();
      if (data.error) throw new Error(data.error);

      setFlights(data.flights || []);
      setAirports(data.airports || {});
      setModel(data.model || null);
      setIsOnline(true);
      setErrorMessage('');
      setStatusText(`Live · updated ${fmtT(data.updated)} · ${(data.flights || []).length} aircraft`);
      setSourceTooltip(data.source || '');
    } catch (err: any) {
      console.error('Fetch error:', err);
      setIsOnline(false);
      setStatusText('Offline');
      setErrorMessage('Could not load data: ' + (err.message || 'Server error'));
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  // High risk alerts banner
  const highRiskAirports = useMemo(() => {
    return Object.values(airports).filter((a) => a.risk.score >= 50);
  }, [airports]);

  // Filter category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: flights.length };
    for (const f of flights) {
      const k = catF(f);
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [flights]);

  // Filtered flights for map & table
  const filteredFlights = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return flights.filter((f) => {
      const categoryMatch = filter === 'All' || catF(f) === filter;
      if (!categoryMatch) return false;
      if (!q) return true;
      const searchable = [
        f.callsign,
        f.reg,
        f.type,
        f.origin?.code,
        f.origin?.name,
        f.destination?.code,
        f.destination?.name,
        f.airline,
        f.hex,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [flights, filter, searchQuery]);

  // Handle GPS toggle
  const handleToggleGps = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setUserLocation(null);
      setLocationAccuracy(null);
      setIsTrackingGps(false);
      setGpsStatusText('');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatusText('GPS not supported');
      return;
    }

    setGpsStatusText('Waiting for GPS… allow location access');
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setLocationAccuracy(pos.coords.accuracy);
        setIsTrackingGps(true);
        setGpsStatusText(
          `You: ${fmtLL(coords.lat, coords.lon)} (±${Math.round(pos.coords.accuracy)} m)`,
        );
      },
      (err) => {
        setGpsStatusText('GPS error: ' + err.message);
        setWatchId(null);
        setIsTrackingGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    setWatchId(id);
  };

  const handleSelectFlight = (hex: string | null) => {
    setFollowHex(hex);
    if (hex) {
      const mapEl = document.getElementById('map');
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleResetView = () => {
    setFollowHex(null);
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <>
      <Header statusText={statusText} isOnline={isOnline} sourceTooltip={sourceTooltip} />

      <main>
        {highRiskAirports.length > 0 && (
          <div className="alert-banner">
            ⚠{' '}
            {highRiskAirports.map((a, i) => (
              <span key={a.code}>
                {i > 0 && <br />}
                <b>{a.code}</b>: {a.insight}
              </span>
            ))}
          </div>
        )}

        {errorMessage && <div className="err-banner">{errorMessage}</div>}

        <div className="grid2" id="airports">
          {Object.values(airports).map((a) => (
            <AirportCard key={a.code} airport={a} />
          ))}
        </div>

        <LearningPanel model={model} />

        <div className="cards">
          {['All', 'Arriving', 'Departing', 'On ground', 'Passing'].map((k) => (
            <div
              key={k}
              className={`fc ${filter === k ? 'on' : ''}`}
              onClick={() => setFilter(k)}
            >
              <b>{categoryCounts[k] || 0}</b>
              <span>{k === 'Passing' ? 'Passing through' : k}</span>
            </div>
          ))}
        </div>

        <div className="layout">
          <MapCard
            flights={filteredFlights}
            airports={airports}
            followHex={followHex}
            showTrails={showTrails}
            searchQuery={searchQuery}
            userLocation={userLocation}
            locationAccuracy={locationAccuracy}
            isTrackingGps={isTrackingGps}
            gpsStatusText={gpsStatusText}
            onSearchChange={setSearchQuery}
            onToggleGps={handleToggleGps}
            onResetView={handleResetView}
            onToggleTrails={() => setShowTrails((prev) => !prev)}
            onSelectFlight={handleSelectFlight}
          />

          <NextArrivals
            flights={flights}
            followHex={followHex}
            onSelectFlight={handleSelectFlight}
          />
        </div>

        <FlightTable
          flights={filteredFlights}
          followHex={followHex}
          userLocation={userLocation}
          onSelectFlight={handleSelectFlight}
        />

        <div className="foot">
          Data: Flightradar24 feed, ADS-B community feeds, OpenSky, Open-Meteo, aviationweather.gov.
          Delay figures are estimates from a weather + traffic risk model, not official airline or
          airport information.
        </div>
      </main>
    </>
  );
};
export default App;
