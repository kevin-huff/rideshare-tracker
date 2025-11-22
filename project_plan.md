# Rideshare Tracker Project Plan (Android Only)
Version: 0.5

## 1. Project Overview
**Rideshare Tracker** is a private, self-hosted system for a single Android driver to track shifts, rides, earnings, tips, expenses, mileage, and routes. It also provides an OBS overlay for streaming.

> Roadmap tracking lives in `progress.md` (source of truth). This document is a reference for scope and architecture.

**Core Philosophy**
- **Single User**: no multi-tenancy, no complex auth flows.
- **Self-Hosted**: server runs on Railway; user owns data.
- **Driver-First**: large controls, minimal taps, clear state.

**Surfaces**
- **Android App** (Driver Mode) - reliable background GPS, shift/ride controls, live session map.
- **Web Dashboard** (Desktop) - analytics, history, heatmaps, data management.
- **OBS Overlay** (Browser Source) - real-time stats for streams.

---

## 2. Core Workflows

### 2.1 Active Shift Loop (State Machine)
1) **Start Shift**
   - Action: one tap.
   - System: logs start time, starts Foreground Service for GPS.
   - UI: state = Waiting for Ride.

2) **Start Ride**
   - Action: tap when request is accepted.
   - System: logs ride start time; record pickup coordinate snapshot.
   - UI: state = En Route to Pickup.

3) **Rider Picked Up**
   - Action: tap when rider onboard or order collected.
   - System: logs pickup time.
   - UI: state = In Ride.

4) **End Ride**
   - Action: tap when done.
   - Input: fare amount.
   - System: logs drop-off time and fare; computes per-ride distance from pings; optional route polyline.
   - UI: brief Ride Summary then back to Waiting for Ride.

5) **Add Tip**
   - Action: tap on ride detail to add later.
   - System: updates ride record.

6) **End Shift**
   - Action: tap to finish day.
   - System: stops GPS service; shows Shift Summary (total earnings, time, $/hr, distance).

### 2.2 Expense Tracking
- Quick Add: category, amount, date, notes, optional receipt image.

---

## 3. User Interface (Surfaces)

### 3.1 Android Driver Mode
- Large touch targets, high contrast, dark theme, haptic feedback.
- **Live map**: session route polyline; markers for pickup and drop-off.
- Heads-up stats: rides, earnings, $/hr, on-shift duration, current state.
- Privacy toggle: suppress location from overlay; redact coordinates in exports if enabled.

### 3.2 Desktop Dashboard
- Analytics: day, week, month, custom ranges.
- Heatmaps: pickup and drop-off hotspots with date filters.
- Data management: edit, delete, export CSV; receipts gallery.

### 3.3 OBS Overlay
- Transparent web page used as Browser Source in OBS.
- Shows: shift active, ride count, total earnings, $/hr, last ride summary.
- Live Map: session route polyline; markers for pickup and drop-off.
- Configurable via querystring or JSON. Protected by a channel token.

---

## 4. Technical Architecture

### 4.1 Stack
- **Android App**: **React Native** (JS/TS) with a native module for background location.
  - *Decision*: Allows code sharing with the web dashboard/server (JS/TS) while maintaining native performance for critical GPS services.
- **Server**: Node.js (Fastify or Express) with REST + WebSocket.
- **DB**: SQLite on a Railway Volume.
  - *Decision*: Sufficient for single-user scale, easy to backup, zero maintenance.
- **Maps**: 
  - Android app: **MapLibre Native** (Free, Open Source, vector tiles).
  - Web dashboard: **MapLibre GL JS**.

### 4.2 Data Model (high level)
- **Shift**: id, started_at, ended_at, totals (earnings_cents, tips_cents, distance_miles, ride_count).
- **Ride**: id, shift_id, status, started_at, pickup_at, dropoff_at, ended_at, gross_cents, tip_cents, distance_miles, pickup_lat/lng, dropoff_lat/lng.
- **LocationPing**: id, shift_id, ride_id?, ts, lat, lng, speed_mps, heading_deg, accuracy_m, source.
- **Expense**: id, ts, category, amount_cents, receipt_url?.
- **Event**: id, kind, ts, shift_id?, ride_id?, lat/lng?, value.
- **Settings**: overlay config, cost model fields (future), tokens.

### 4.3 Data Flow
- Phone records pings to **local SQLite** continuously.
- Phone batches to server via HTTPS when online; retries with exponential backoff.
- Server persists to SQLite; pushes **SSE** updates to the overlay.

### 4.4 Deployment
- **Railway**: one service for API + WS; one Volume for SQLite file.
- **Backups**: scheduled dump or Litestream-style continuous replication to an S3-compatible bucket.
- **Static assets**: overlay page and dashboard assets served by the Node app.

### 4.5 Security
- **Device Pairing**: Initial setup involves scanning a QR code on the dashboard to exchange the `device_token`.
- **Device Token**: Used for all API ingest endpoints.
- **Overlay**: Public SSE overlay; data intended for streaming.
- **Encryption**: TLS for all transport; tokens stored in Android Keystore.

### 4.6 Build & CI/CD
- **Android**: GitHub Actions to build APK/AAB and release to GitHub Releases or internal distribution.
- **Server**: Dockerfile for Railway automatic builds.

---

## 5. Testing Strategy

### 5.1 Unit & Integration
- **Backend**: Jest/Vitest for business logic and API endpoints.
- **Android**: Jest (React Native) for logic and state machine verification.

### 5.2 End-to-End (E2E)
- **Maestro**: For Android UI testing (mocking GPS and API).
- **Playwright**: For Web Dashboard and OBS Overlay verification.

---

## 6. Android Background Location

**Permissions (AndroidManifest.xml)**
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

**Foreground Service Implementation**
- **Persistent Notification**: Shows "Shift Active" or "Ride Active".
- **Service Lifecycle**: Starts on "Start Shift", stops on "End Shift".
- **Location Provider**: `FusedLocationProviderClient`.
  - Priority: `PRIORITY_HIGH_ACCURACY` (In Ride) / `BALANCED_POWER_ACCURACY` (Idle).
  - Interval: 2-5s (Moving) / 10-30s (Slow) / 60s (Stationary).
  - Displacement: 5-15m.
- **Battery Optimization**:
  - Request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` on first run.
  - Handle `BOOT_COMPLETED` to restart service if a shift was active.

---

## 7. API and Overlay

**REST API (minimal)**
- `POST /v1/shifts` - start shift returns shift_id.
- `PATCH /v1/shifts/:id/end`
- `POST /v1/rides` - start ride returns ride_id.
- `PATCH /v1/rides/:id/end` - accepts gross cents and optional dropoff coords.
- `POST /v1/rides/:id/tips`
- `POST /v1/location` - batch of pings.
- `GET /v1/heatmap?type=pickup|dropoff&from=...&to=...` - FeatureCollection.
- **Auth**: `Authorization: Bearer <device-token>`.

**Overlay**
- OBS loads `/overlay`.
- Overlay connects to `GET /overlay/stream` (Server-Sent Events).
- Payload: shift/ride stats, path polyline, and pickup/dropoff markers.

---

## 8. Roadmap

**Phase 1: Foundation & Server (Complete)**  
Server/API, auth, SQLite schema, tests, and initial OBS overlay shell.

**Phase 2: Mobile Core + Live Overlay (Current)**  
Android shift/ride state machine, background location + batching, offline queue, app UI, and live OBS overlay wiring (stats + map).

**Phase 3: Dashboard & Heatmaps (Next)**  
Desktop dashboard with history/analytics, pickup/drop-off heatmaps, and CSV export.

**Phase 4: Expenses, Backups, Polish (Future)**  
Expenses with receipts, automated DB backups, privacy redaction, and theming.

---

## 9. Technical Decisions & Implementation Strategy

**1. Android Stack Choice**
- **Decision**: **React Native**.
- **Reasoning**: Since the backend is Node.js, using React Native allows for a unified JavaScript/TypeScript codebase. Critical background location features will be handled via a **Native Module** (or a library like `react-native-background-actions` wrapping native services) to ensure reliability comparable to Kotlin, while speeding up UI development.

**2. Foreground Service & Battery Optimizations**
- **Strategy**:
  - Use a **Foreground Service** with a persistent notification to prevent the OS from killing the app.
  - Request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission from the user explicitly.
  - Implement a `BootReceiver` to check for an active shift state in local storage and restart the service automatically upon device reboot.

**3. Map SDK & Heatmaps**
- **Android**: **MapLibre Native** (or Mapbox GL if preferred) for vector maps. It is open-source and cost-effective for self-hosting.
- **Web Heatmap**: **MapLibre GL JS** with a heatmap layer. It renders efficiently using WebGL and handles large datasets (10k+ points) smoothly.

**4. Database Strategy**
- **Decision**: **SQLite**.
- **Reasoning**: For a single-user application, SQLite is performant, zero-configuration, and easy to back up (it's just a file).
- **Migration**: If the user ever outgrows SQLite (unlikely for a single driver), migration to Postgres is straightforward via standard ETL tools, but not required for MVP.

**5. Railway Deployment**
- **Build**: Use a `Dockerfile` to build the Node.js server.
- **Storage**: Mount a **Railway Volume** to `/app/data` to store the `db.sqlite` file. This ensures data persists across deployments.
- **Backups**: Use a cron job within the container or a sidecar service (like Litestream) to replicate the SQLite database to an external S3 bucket for disaster recovery.

**6. Timeline & Cost (Estimate)**
- **Phase 1 (Foundation)**: Complete.
- **Phase 2 (Mobile Core + Live Overlay)**: 2-3 weeks (state machine, background location, offline queue, overlay wiring).
- **Phase 3 (Dashboard & Heatmaps)**: 1-2 weeks (analytics + map layers).
- **Phase 4 (Expenses/Backups/Polish)**: ~1 week.
- **Total (remaining)**: ~3-6 weeks.
