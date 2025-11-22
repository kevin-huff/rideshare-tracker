# Project Progress Tracker

## 🟢 Phase 1: Foundation & Server (Complete)
**Goal**: Establish the monorepo, server infrastructure, and core data models.

- [x] **Monorepo Setup**: Root `package.json`, workspaces for `server` and `mobile`.
- [x] **Server Initialization**: Fastify, TypeScript, SQLite.
- [x] **Database**: Schema designed, migrations (schema.sql), foreign keys enabled.
- [x] **API - Shifts**: Start/End shift, single active shift enforcement.
- [x] **API - Rides**: Start/End ride, tip addition, transaction support.
- [x] **API - Location**: Batch ingest of GPS pings.
- [x] **Auth**: Basic Bearer token authentication (`DEVICE_TOKEN` required; add to `.env`/`.env.example`).
- [x] **Testing**: Unit/Integration tests for all endpoints (`vitest`); GitHub Actions workflow runs server tests on push/PR.
- [x] **Mobile Scaffold**: React Native project initialized (Android starter screen; core app/state/services still TODO).
- [x] **OBS Overlay**: Transparent HUD overlay with stats grid and map slot for OBS (live data hookup pending).

## 🟡 Phase 2: Mobile Core + Live Overlay (Current)
**Goal**: Build the Android app with background location, client state machine, and wire the OBS overlay to live data.

- [ ] **State Machine**: Implement Shift/Ride logic on the client.
- [ ] **UI Implementation**:
  - [ ] "Start Shift" Screen.
  - [ ] "Active Shift" / Map View.
  - [ ] "Ride in Progress" View.
- [ ] **Location Service**: Foreground Service for reliable GPS tracking.
- [ ] **API Integration**: Connect app to server endpoints.
- [ ] **Offline Queue**: Handle network drops (store pings locally, retry later).
- [ ] **OBS Overlay (Live)**: WebSocket/REST hookup for shift/ride stats; render map tiles + route.

## ⚪ Phase 3: Dashboard & Heatmaps (Next)
**Goal**: Desktop analytics and spatial views.

- [ ] **Web Dashboard**: History views, earnings analytics, filtering.
- [ ] **Heatmaps**: Pickup/drop-off heatmaps with date filters.
- [ ] **Data Management**: Edit/delete records and CSV export.

## ⚪ Phase 4: Expenses, Backups, Polish (Future)
**Goal**: Refinements and extra tooling.

- [ ] **Expenses**: Receipt capture and logging.
- [ ] **Backups**: Automated S3 replication.
- [ ] **Privacy & Theming**: Location redaction radius, dark mode refinement.
