import React from 'react';
import type { Flight } from '../types';
import { fmtT, minsTo } from '../utils';

interface NextArrivalsProps {
  flights: Flight[];
  followHex: string | null;
  onSelectFlight: (hex: string) => void;
}

export const NextArrivals: React.FC<NextArrivalsProps> = ({ flights, followHex, onSelectFlight }) => {
  const arrivals = flights
    .filter((f) => !f.onGround && f.status === 'Arriving' && f.eta)
    .sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime())
    .slice(0, 12);

  return (
    <div className="card side">
      <h3>Next arrivals (with predicted delay)</h3>
      <div id="next">
        {arrivals.length > 0 ? (
          arrivals.map((f) => {
            const isSelected = followHex === f.hex;
            return (
              <div
                key={f.hex}
                className={`nx ${isSelected ? 'sel' : ''}`}
                onClick={() => onSelectFlight(f.hex)}
              >
                <b>{f.callsign || f.hex}</b>
                <div>
                  <small>
                    {f.origin ? f.origin.code : '?'} → {f.toApt || f.etaTo}
                  </small>
                  {f.airline || f.type || ''}
                </div>
                <div className="t">
                  <b style={{ minWidth: 0 }}>{fmtT(f.adjEta || f.eta)}</b>
                  <small>
                    {minsTo(f.eta)} min
                    {f.predDelay ? (
                      <>
                        {' · '}
                        <span className="late">+{f.predDelay}</span>
                      </>
                    ) : null}
                  </small>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ color: 'var(--mut)' }}>No arrivals with an estimate yet.</div>
        )}
      </div>
    </div>
  );
};
