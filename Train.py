"""Train a Random Forest on logged landings and export data/model.json for the dashboard.
Usage:  python train.py                (uses data/training.csv)
        python train.py data/training_demo.csv   (demo data, flagged DEMO on the dashboard)
Needs:  pip install pandas scikit-learn
"""
import json, sys, datetime
import numpy as np, pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

path = sys.argv[1] if len(sys.argv) > 1 else "data/training.csv"
FEATURES = ['pred_eta_min', 'dist_nm', 'alt', 'gs', 'vs', 'hour', 'dow', 'is_nmi', 'risk', 'wx_risk', 'cong',
            'vis_km', 'gust', 'xwind', 'precip', 'thunder', 'inbound40', 'ground_busy']

df = pd.read_csv(path)
n = len(df)
print(f"Loaded {n} landings from {path}")
if n < 40:
    sys.exit("Need at least 40 landings. Keep the server running longer, then try again.")

X, y = df[FEATURES].values, df['slip'].values
Xtr, Xte, ytr, yte, rtr, rte = train_test_split(X, y, df['rule_pred'].values, test_size=0.2, random_state=42)

rf = RandomForestRegressor(n_estimators=60, max_depth=6, min_samples_leaf=3, random_state=42).fit(Xtr, ytr)
mae_ml = float(np.mean(np.abs(rf.predict(Xte) - yte)))
mae_rule = float(np.mean(np.abs(rte - yte)))
mae_zero = float(np.mean(np.abs(yte)))
print(f"Test error (avg minutes off):  ML model {mae_ml:.1f} | rule model {mae_rule:.1f} | 'no delay' baseline {mae_zero:.1f}")

# final model on all data
rf = RandomForestRegressor(n_estimators=60, max_depth=6, min_samples_leaf=3, random_state=42).fit(X, y)
imp = sorted(zip(FEATURES, rf.feature_importances_), key=lambda t: -t[1])[:6]
print("Most important factors:", ", ".join(f"{k} ({v:.2f})" for k, v in imp))

trees = []
for est in rf.estimators_:
    t = est.tree_
    trees.append({
        'left': t.children_left.tolist(), 'right': t.children_right.tolist(),
        'feat': t.feature.tolist(), 'thr': [round(float(v), 6) for v in t.threshold],
        'val': [round(float(v[0][0]), 4) for v in t.value],
    })
out = {'features': FEATURES, 'trees': trees,
       'metrics': {'n': n, 'mae_ml': round(mae_ml, 1), 'mae_rule': round(mae_rule, 1), 'mae_zero': round(mae_zero, 1),
                   'trained_at': datetime.datetime.now().isoformat(timespec='seconds'), 'demo': 'demo' in path.lower(),
                   'importance': [[k, round(float(v), 3)] for k, v in imp]}}
json.dump(out, open('data/model.json', 'w'))
print("Saved data/model.json  (server reloads it automatically within a minute)")