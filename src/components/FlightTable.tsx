import React from 'react';
import type { Flight, LocationCoord } from '../types';
import { fmtT, minsTo, distNm } from '../utils';

interface FlightTableProps {
  flights: Flight[];
  followHex: string | null;
  userLocation: LocationCoord | null;
  onSelectFlight: (hex: string) => void;
}

export const FlightTable: React.FC<FlightTableProps> = ({
  flights,
  followHex,
  userLocation,
  onSelectFlight,
}) => {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>All aircraft ({flights.length})</h3>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Flight</th>
              <th>Airline</th>
              <th>Reg</th>
              <th>Type</th>
              <th>Status</th>
              <th>From → To</th>
              <th>Alt (ft)</th>
              <th>Speed (kt)</th>
              <th>V/S</th>
              <th>GPS</th>
              <th>From BOM</th>
              <th>From me</th>
              <th>Est. arrival</th>
              <th>Pred. delay</th>
              <th>Adjusted</th>
              <th>ML delay</th>
              <th>Squawk</th>
            </tr>
          </thead>
          <tbody>
            {flights.length > 0 ? (
              flights.map((f) => {
                const isSelected = followHex === f.hex;
                const statusTagClass = f.onGround ? 'ground' : f.status.split(' ')[0];
                const statusDisplay = f.onGround
                  ? `${f.status}${f.airport ? ' · ' + f.airport.split(' ')[0] : ''}`
                  : f.status;

                const distFromMe = userLocation
                  ? `${distNm(userLocation.lat, userLocation.lon, f.lat, f.lon).toFixed(1)} nm`
                  : '-';

                return (
                  <tr
                    key={f.hex}
                    className={isSelected ? 'sel' : ''}
                    onClick={() => onSelectFlight(f.hex)}
                  >
                    <td>
                      <b>{f.callsign || f.hex}</b>
                    </td>
                    <td>{f.airline || '-'}</td>
                    <td>{f.reg || '-'}</td>
                    <td>{f.type || '-'}</td>
                    <td>
                      <span className={`tag ${statusTagClass}`}>{statusDisplay}</span>
                    </td>
                    <td>
                      {f.origin ? f.origin.code : '?'} → {f.destination ? f.destination.code : '?'}
                    </td>
                    <td>{f.onGround ? 'Ground' : f.alt != null ? f.alt.toLocaleString() : '-'}</td>
                    <td>{f.gs != null ? `${f.gs} kt` : '-'}</td>
                    <td>{f.vs != null ? `${f.vs > 0 ? '+' : ''}${f.vs}` : '-'}</td>
                    <td>
                      {f.lat.toFixed(4)}, {f.lon.toFixed(4)}
                    </td>
                    <td>{f.distNm} nm</td>
                    <td>{distFromMe}</td>
                    <td>
                      {f.eta ? `${fmtT(f.eta)} (${minsTo(f.eta)}m) → ${f.etaTo || 'BOM'}` : '-'}
                    </td>
                    <td>
                      {f.predDelay != null ? (
                        <span className="late">+{f.predDelay} min</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{f.adjEta ? fmtT(f.adjEta) : '-'}</td>
                    <td>
                      {f.mlDelay != null ? (
                        <span className="late">+{f.mlDelay} min</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{f.squawk || '-'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={17} style={{ textAlign: 'center', padding: '24px', color: 'var(--mut)' }}>
                  No flights match the current filter or search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
