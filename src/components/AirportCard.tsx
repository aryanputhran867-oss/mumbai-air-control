import React from 'react';
import type { AirportData } from '../types';
import { riskColor } from '../utils';

interface AirportCardProps {
  airport: AirportData;
}

export const AirportCard: React.FC<AirportCardProps> = ({ airport }) => {
  const w = airport.weather;
  const r = airport.risk;
  const t = airport.traffic;

  const lb = ['0', '15', '30', '45', '60', '75', '90', '105'];
  const maxArr = Math.max(3, ...(airport.arrivalsNext2h || [0]));

  return (
    <div className="card">
      <div className="ap-head">
        <div
          className="ring"
          style={
            {
              '--v': r.score,
              '--c': riskColor(r.score),
            } as React.CSSProperties
          }
        >
          <div>
            <span>
              <b>{r.score}</b>
              <br />
              <small>{r.label} risk</small>
            </span>
          </div>
        </div>

        <div className="ap-title">
          <h2>
            {airport.code} · {airport.short}
          </h2>
          <div className="sub">
            {airport.name} ({airport.icao})
          </div>
          <div style={{ marginTop: 6 }}>
            {airport.category && <span className={`chip ${airport.category}`}>{airport.category}</span>}
            <span className="chip" style={{ background: '#1f3050', color: '#cfe0f7' }}>
              Weather {r.weather} + Traffic {r.congestion}
            </span>
          </div>
        </div>
      </div>

      <div className="insight">{airport.insight}</div>

      {w ? (
        <div className="wgrid">
          <div className="tile">
            <small>{w.icon} Weather</small>
            <b style={{ fontSize: 13 }}>{w.desc}</b>
          </div>
          <div className="tile">
            <small>Temperature</small>
            <b>{Math.round(w.temp)}°C</b> <small style={{ display: 'inline' }}>feels {Math.round(w.feels)}°</small>
          </div>
          <div className="tile">
            <small>Wind</small>
            <b>
              <span className="arrow" style={{ transform: `rotate(${(w.dir || 0) + 180}deg)` }}>
                ⬆
              </span>{' '}
              {Math.round(w.wind)} kt
            </b>{' '}
            <small style={{ display: 'inline' }}>
              G{Math.round(w.gust || 0)} · {Math.round(w.dir || 0)}°
            </small>
          </div>
          <div className="tile">
            <small>Visibility</small>
            <b>{w.vis != null ? (w.vis >= 10000 ? '10+ km' : (w.vis / 1000).toFixed(1) + ' km') : '-'}</b>
          </div>
          <div className="tile">
            <small>Rain now</small>
            <b>{(w.precip || 0).toFixed(1)} mm</b>
          </div>
          <div className="tile">
            <small>Cloud / Humidity</small>
            <b>
              {Math.round(w.cloud)}% / {Math.round(w.hum)}%
            </b>
          </div>
          <div className="tile">
            <small>Pressure (QNH)</small>
            <b>{Math.round(w.pressure)} hPa</b>
          </div>
          <div className="tile">
            <small>Likely runway</small>
            <b>{airport.runway ? 'RWY ' + airport.runway.id : '-'}</b>{' '}
            <small style={{ display: 'inline' }}>
              {airport.runway ? `hw ${airport.runway.headwind} · xw ${airport.runway.crosswind} kt` : ''}
            </small>
          </div>
        </div>
      ) : (
        <div className="insight">Weather unavailable: {airport.weatherError || ''}</div>
      )}

      <div className="row">
        <div className="stat">
          <b style={{ color: 'var(--ok)' }}>{t.arriving}</b>
          <small>Arriving</small>
        </div>
        <div className="stat">
          <b style={{ color: 'var(--warn)' }}>{t.departing}</b>
          <small>Departing</small>
        </div>
        <div className="stat">
          <b>{t.onGround}</b>
          <small>On ground</small>
        </div>
        <div className="stat">
          <b>{t.taxiing}</b>
          <small>Taxiing</small>
        </div>
        <div className="stat">
          <b className="late">{airport.delay.arrivals} min</b>
          <small>Est. arrival delay</small>
        </div>
        <div className="stat">
          <b className="late">{airport.delay.departures} min</b>
          <small>Est. departure delay</small>
        </div>
      </div>

      <div className="charts">
        {airport.forecast && airport.forecast.length > 0 ? (
          <div className="ch">
            <h4>Weather delay risk, next hours (IST)</h4>
            <div className="bars">
              {airport.forecast.map((item, idx) => (
                <div key={idx} className="bar" title={`${item.time}: ${item.score} (${item.desc})`}>
                  <i
                    style={{
                      height: `${Math.max(4, item.score)}%`,
                      background: riskColor(item.score),
                    }}
                  />
                  <span>{item.time.slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="ch">
          <h4>Predicted arrivals by estimated time (15-min slots)</h4>
          <div className="bars">
            {(airport.arrivalsNext2h || []).map((count, idx) => (
              <div key={idx} className="bar" title={`+${lb[idx]}m: ${count} flights`}>
                <i
                  style={{
                    height: `${Math.max(4, (count / maxArr) * 100)}%`,
                    background: 'var(--acc)',
                  }}
                />
                <span>{lb[idx]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {airport.metar?.raw && <div className="metar">METAR {airport.metar.raw}</div>}
    </div>
  );
};
