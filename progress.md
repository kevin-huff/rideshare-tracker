# Project Progress Tracker

## 🟢 Phase 1: Foundation & Server (Current)
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

## 🟡 Phase 2: Mobile Core (Next Up)
**Goal**: Build the Android app with background location and state management.

- [ ] **State Machine**: Implement Shift/Ride logic on the client.
- [ ] **UI Implementation**:
  - [ ] "Start Shift" Screen.
  - [ ] "Active Shift" / Map View.
  - [ ] "Ride in Progress" View.
- [ ] **Location Service**: Foreground Service for reliable GPS tracking.
- [ ] **API Integration**: Connect app to server endpoints.
- [ ] **Offline Queue**: Handle network drops (store pings locally, retry later).
- [ ] **OBS Overlay**: Wire live data + map tiles into overlay; animate updates for OBS.

## ⚪ Phase 3: Overlay & Dashboard (Future)
**Goal**: Visualizations for streaming and analytics.

- [ ] **OBS Overlay**: Real-time stats and map for streamers.
- [ ] **Web Dashboard**: Heatmaps, ride history, earnings analytics.
- [ ] **Data Management**: Export to CSV, edit records.

## ⚪ Phase 4: Polish & Advanced Features (Future)
**Goal**: Refinements and extra tooling.

- [ ] **Expenses**: Receipt capture and logging.
- [ ] **Backups**: Automated S3 replication.
- [ ] **Theming**: Dark mode refinement.
