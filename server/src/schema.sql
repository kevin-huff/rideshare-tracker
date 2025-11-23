CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  earnings_cents INTEGER DEFAULT 0,
  tips_cents INTEGER DEFAULT 0,
  distance_miles REAL DEFAULT 0,
  ride_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  pickup_at TEXT,
  dropoff_at TEXT,
  ended_at TEXT,
  gross_cents INTEGER DEFAULT 0,
  tip_cents INTEGER DEFAULT 0,
  distance_miles REAL DEFAULT 0,
  pickup_lat REAL,
  pickup_lng REAL,
  dropoff_lat REAL,
  dropoff_lng REAL,
  FOREIGN KEY(shift_id) REFERENCES shifts(id)
);

CREATE TABLE IF NOT EXISTS location_pings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id TEXT NOT NULL,
  ride_id TEXT,
  ts TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed_mps REAL,
  heading_deg REAL,
  accuracy_m REAL,
  source TEXT,
  FOREIGN KEY(shift_id) REFERENCES shifts(id),
  FOREIGN KEY(ride_id) REFERENCES rides(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  note TEXT,
  receipt_url TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  overlay_privacy_radius_m INTEGER DEFAULT 0,
  overlay_hide_location INTEGER DEFAULT 0,
  overlay_theme TEXT DEFAULT 'midnight'
);
