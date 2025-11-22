import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'rideshare.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export default db;

export function initDb() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    // In production/dist, schema.sql might be in the same dir as this file
    // But during dev (tsx), it's in src.
    // Let's try to read it relative to __dirname

    let schema: string;
    try {
        schema = fs.readFileSync(schemaPath, 'utf-8');
    } catch (e) {
        // Fallback for when running from dist/ where schema.sql might not be copied yet
        // Or just embed it for now to be safe? 
        // Embedding is safer for this MVP phase to avoid build complexity.
        schema = `
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
      `;
    }

    db.exec(schema);
    console.log('Database initialized');
}
