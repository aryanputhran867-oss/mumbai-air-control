"""Creates SYNTHETIC data/training_demo.csv so you can test the training pipeline before real data exists."""
import numpy as np, pandas as pd, os
rng = np.random.default_rng(1)
n = 400
d = pd.DataFrame({
  'pred_eta_min': rng.uniform(10, 60, n), 'dist_nm': rng.uniform(10, 90, n), 'alt': rng.uniform(2000, 30000, n),
  'gs': rng.uniform(180, 450, n), 'vs': rng.uniform(-2500, 0, n), 'hour': rng.integers(0, 24, n), 'dow': rng.integers(0, 7, n),
  'is_nmi': rng.integers(0, 2, n), 'risk': rng.uniform(0, 80, n), 'vis_km': rng.uniform(1, 10, n), 'gust': rng.uniform(5, 40, n),
  'xwind': rng.uniform(0, 25, n), 'precip': rng.exponential(1.5, n), 'inbound40': rng.integers(0, 14, n), 'ground_busy': rng.integers(0, 12, n)})
d['wx_risk'] = d.risk * 0.8; d['cong'] = d.risk * 0.2; d['thunder'] = (d.risk > 65).astype(int)
d['slip'] = 1 + 0.12 * d.risk + 0.9 * np.maximum(0, d.inbound40 - 5) + 0.15 * d.xwind + rng.normal(0, 2, n)
d['rule_pred'] = (d.risk / 100) ** 1.3 * 30 * 0.6 + np.maximum(0, d.inbound40 - 4) * 1.2
d['actual_min'] = d.pred_eta_min + d.slip
d['ts'] = pd.Timestamp.now().isoformat(); d['callsign'] = 'DEMO'; d['airport'] = np.where(d.is_nmi == 1, 'NMI', 'BOM')
cols = ['ts','callsign','airport','rule_pred','pred_eta_min','dist_nm','alt','gs','vs','hour','dow','is_nmi','risk','wx_risk','cong','vis_km','gust','xwind','precip','thunder','inbound40','ground_busy','actual_min','slip']
os.makedirs('data', exist_ok=True); d[cols].round(3).to_csv('data/training_demo.csv', index=False)
print('Wrote data/training_demo.csv (SYNTHETIC)')