import React from 'react';
import type { ModelMetrics } from '../types';

interface LearningPanelProps {
  model: ModelMetrics | null | undefined;
}

export const LearningPanel: React.FC<LearningPanelProps> = ({ model }) => {
  if (!model) return null;

  const pct = Math.min(100, Math.round((model.n / model.target) * 100));
  const ml = model.ml;

  return (
    <div className="card" id="model" style={{ marginTop: 16 }}>
      <h3>
        🧠 Learning from real landings{' '}
        {ml && ml.demo && <span className="badge">DEMO MODEL (synthetic data)</span>}
      </h3>
      <div style={{ color: 'var(--mut)', fontSize: 13 }}>
        Each flight's estimated arrival is logged and compared with when it really lands. The gap is the real
        delay used to train the model.
      </div>

      <div className="prog">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="row" style={{ marginTop: 0 }}>
        <div className="stat">
          <b>{model.n + ' / ' + model.target}</b>
          <small>Landings logged (goal for a good model)</small>
        </div>
        <div className="stat">
          <b>{model.tracking}</b>
          <small>Flights being tracked now</small>
        </div>
        <div className="stat">
          <b style={{ color: 'var(--warn)' }}>{model.n ? `${model.maeRule} min` : '-'}</b>
          <small>Rule model error (avg)</small>
        </div>
        <div className="stat">
          <b>{model.n ? `${model.maeZero} min` : '-'}</b>
          <small>"No delay" baseline error</small>
        </div>
        <div className="stat">
          <b style={ml ? { color: 'var(--ok)' } : undefined}>
            {ml ? `${ml.mae_ml} min` : 'not trained'}
          </b>
          <small>ML model error (held-out test)</small>
        </div>
      </div>

      {ml ? (
        <div style={{ color: 'var(--mut)', fontSize: 12, marginTop: 8 }}>
          Trained {ml.trained_at.replace('T', ' ')} on {ml.n} landings · top factors:{' '}
          {(ml.importance || []).slice(0, 4).map((x) => x[0]).join(', ')}
        </div>
      ) : (
        <div style={{ color: 'var(--mut)', fontSize: 12, marginTop: 8 }}>
          Run <code>python train.py</code> once you have 40+ landings to train the ML model.
        </div>
      )}

      <div className="rl">
        {model.recent && model.recent.length > 0 ? (
          model.recent.map((r, i) => (
            <div key={i}>
              <b>{r.callsign}</b> → {r.airport}
              <br />
              <small>
                predicted {r.predicted} min · actual {r.actual} min · extra{' '}
                <b style={{ color: r.slip > 5 ? 'var(--warn)' : 'var(--ok)' }}>
                  {r.slip > 0 ? '+' : ''}
                  {r.slip}
                </b>{' '}
                (rules said +{r.rule})
              </small>
            </div>
          ))
        ) : (
          <div>
            <small>Waiting for the first landings to be recorded…</small>
          </div>
        )}
      </div>
    </div>
  );
};
