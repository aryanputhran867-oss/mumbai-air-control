# Mumbai Air Control · Live (BOM + NMI)

A modern full-stack React and TypeScript application for real-time flight tracking, weather observation, runway analysis, and arrival delay predictions around Mumbai (CSMIA) and Navi Mumbai (NMIA) airports.

## Features

- **Live Radar Map**: Interactive Leaflet-powered radar map with inverted high-contrast tiles, real-time aircraft dead-reckoning extrapolation, aircraft heading rotation, flight trails, and 4km airport perimeter zones.
- **Dual Airport Monitoring**: Live meteorological conditions (Open-Meteo), METAR reports (aviationweather.gov), active flight category (VFR, MVFR, IFR, LIFR), intelligent runway selection, headwind/crosswind calculation, and 0–100 delay risk scoring.
- **Delay Risk & Traffic Forecasts**: Hourly weather risk score projections and 15-minute arrival time distribution buckets for the upcoming 2 hours.
- **Multi-Source Ingestion**: Aggregates live ADS-B data from Flightradar24, ADS-B community feeds (adsb.lol, airplanes.live, adsb.fi, adsb.one), and OpenSky Network, with flight route resolution via adsbdb.
- **Flight Detail & Follow Mode**: Select any aircraft to lock view, track its live position, and view detailed metrics (route, altitude, ground speed, vertical speed, squawk, estimated arrival, and distance).
- **Geolocation Integration**: Live device GPS lock showing your location on the radar with accuracy radius and dynamic distance from you to any aircraft.
- **Landing Tracker & ML Delay Model**: Logs flight estimations and actual landing timestamps to `data/training.csv` to calculate prediction slip and track delay patterns.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Leaflet
- **Backend**: Express, TypeScript, Vite middleware (`server.ts`)
- **Data Stores**: File-backed history (`data/history.json`) and landing logs (`data/training.csv`)

## Running the App

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```
