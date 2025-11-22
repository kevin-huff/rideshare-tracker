# Rideshare Tracker

> 🚗 Self-hosted shift, ride, and earnings tracker for rideshare drivers with live OBS overlay and Android app.

**Status**: Phase 2 Complete — Mobile Core + Live Overlay ✅

---

## ✨ Features

- **📊 Shift & Ride Tracking**: Start/end shifts and rides, track earnings, tips, mileage, and ride details
- **📍 Background Location**: Continuous GPS tracking with route visualization and pickup/dropoff markers
- **🎥 Live OBS Overlay**: Real-time stats via Server-Sent Events at `/overlay` — perfect for streaming
- **📱 React Native App**: Android-first client for starting/ending shifts/rides and sharing the overlay link
- **🗺️ MapLibre Integration**: Beautiful route visualization on both mobile and overlay

---

## 🏗️ Tech Stack

- **Server**: Fastify + TypeScript + SQLite
- **Mobile**: React Native + MapLibre Native
- **Overlay**: MapLibre GL JS + SSE
- **Maps**: OpenStreetMap via MapLibre (free, no API key required)

---

## 📁 Project Structure

```
rideshare-tracker/
├── server/          # Fastify API, SQLite database, OBS overlay (SSE)
├── mobile/          # React Native Android app with background location
├── docs/            # Documentation and guides
├── project_plan.md  # Technical architecture and roadmap
└── progress.md      # Development status tracker
```

**Key Documentation**:
- [Project Plan](./project_plan.md) — Architecture, data model, and technical decisions
- [Progress Tracker](./progress.md) — Current phase status and completed features
- [Device Testing Guide](./docs/device_testing_guide.md) — Mobile app testing procedures

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm
- Android SDK/Java toolchain (for mobile development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Export env vars or create a `.env` in `server/`:
```
DEVICE_TOKEN=your-secure-token-here      # required
DB_PATH=./rideshare.db                   # optional
PORT=3000                                # optional
```

### 3. Run the Server
```bash
# Development (hot reload)
npm run --workspace server dev

# Production
npm run --workspace server build
npm run --workspace server start
```

Server runs at `http://localhost:3000`  
Overlay available at `http://localhost:3000/overlay`

### 4. Run Tests
```bash
npm test --workspace server
```

---

## 📱 Mobile App (Android)

### Setup
1. Ensure Android SDK/emulator or connected device is ready
2. Start Metro bundler:
   ```bash
   npm run --workspace mobile start
   ```
3. Install on device/emulator:
   ```bash
   npm run --workspace mobile android
   ```

### Configuration
- Open app settings
- Set **API Base URL**: `http://<server-ip>:3000`
- Set **Device Token**: match your `DEVICE_TOKEN` from server `.env`

### Features
- **Share Overlay**: Tap "Share live overlay" to send the public overlay URL
- **On-device history**: Shows last shift/ride stats from local SQLite

---

## 🎥 OBS Overlay Setup

The overlay is **public** and requires **no authentication** — perfect for streaming!

### Browser Source Settings
1. In OBS, add a **Browser Source**
2. Set URL: `http://<your-server>:3000/overlay`
3. Width: `1920`, Height: `1080` (or match your canvas)
4. FPS: `30`
5. Check: ✅ Shutdown source when not visible
6. Check: ✅ Refresh browser when scene becomes active

### Features
- **Real-time Stats**: Rides, earnings (incl. tips), $/hr, shift duration
- **Live Map**: Session route polyline with auto-bounds fitting
- **Markers**: Green (start/pickup), Red (end/dropoff)
- **SSE Updates**: Instant updates when rides/shifts change

---

## 🌐 Deployment

### Railway (Recommended)
1. Connect your GitHub repository
2. Add a **Volume** at `/app/data` for SQLite persistence
3. Set env vars: `DEVICE_TOKEN`, `DB_PATH=/app/data/rideshare.db`, optional `PORT`
4. Deploy! 🚀

### Environment Variables
- `DEVICE_TOKEN` (required) — Bearer token for mobile app API access
- `DB_PATH` (optional) — Defaults to `rideshare.db` in working directory
- `PORT` (optional) — Defaults to `3000`

---

## 📖 API Documentation

### Core Endpoints
- `POST /v1/shifts` — Start a new shift
- `PATCH /v1/shifts/:id/end` — End active shift
- `POST /v1/rides` — Start a new ride
- `PATCH /v1/rides/:id/end` — End ride (with earnings)
- `POST /v1/rides/:id/tips` — Add tip to completed ride
- `POST /v1/location` — Batch GPS ping upload

**Auth**: All data ingest endpoints require `Authorization: Bearer <DEVICE_TOKEN>`

### Overlay Endpoints (Public)
- `GET /overlay` — HTML overlay page
- `GET /overlay/data` — JSON snapshot of current shift
- `GET /overlay/stream` — Server-Sent Events stream

---

## 🗺️ Roadmap

- ✅ **Phase 1**: Foundation & Server — Complete
- ✅ **Phase 2**: Mobile Core + Live Overlay — Complete
- ⬜ **Phase 3**: Dashboard & Heatmaps — Next
- ⬜ **Phase 4**: Expenses, Backups, Polish — Future

See [progress.md](./progress.md) for detailed status.

---

## 🧪 Testing
- Server: `npm test --workspace server`
- Mobile: `npm test --workspace mobile` (Jest)

---

## 📄 License

This project is for personal use. See repository for details.

---

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt for your own use!
