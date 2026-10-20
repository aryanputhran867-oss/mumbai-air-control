# Mumbai Air Control (BOM + NMI)

Live flights, weather and delay prediction for Mumbai (BOM) and Navi Mumbai (NMI).

## Run
1. Install Node.js 18+
2. In this folder: `node server.js`
3. Open http://localhost:3000

No npm install, no API keys.

## What it does
- Live map + table of all aircraft within 100 nm: air, ground, arriving, departing, ETA, route, live GPS, follow mode, trails
- Per airport: live weather (Open-Meteo), METAR, flight category, likely runway + crosswind, delay-risk score (0-100)
- Predictions: 8-hour weather risk forecast, arrivals expected in the next 2 hours, estimated delay per flight
- Risk model: weighted rules on visibility, gusts, crosswind, rain, thunderstorms + live traffic congestion (not a trained ML model; history is saved to data/history.json for later training)

Options: `RADIUS_NM=150 node server.js`
