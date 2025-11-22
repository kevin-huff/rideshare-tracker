/**
 * SQLite database initialization and schema management.
 */

import SQLite from 'react-native-sqlite-storage';

// Enable debugging in development
SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

const DB_NAME = 'rideshare.db';
const DB_VERSION = 2;

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database and run migrations.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (dbInstance) {
        return dbInstance;
    }

    const db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
    });

    await runMigrations(db);
    dbInstance = db;
    return db;
}

/**
 * Get the current database instance (must be initialized first).
 */
export function getDatabase(): SQLite.SQLiteDatabase {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return dbInstance;
}

/**
 * Run database migrations.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
    // Check current schema version
    const [versionResult] = await db.executeSql('PRAGMA user_version');
    const currentVersion = versionResult.rows.item(0).user_version;

    if (currentVersion < 1) {
        await migrateToV1(db);
    }

    if (currentVersion < 2) {
        await migrateToV2(db);
    }
}

/**
 * Initial schema (v1).
 */
async function migrateToV1(db: SQLite.SQLiteDatabase): Promise<void> {
    console.log('[DB] Running migration to v1...');

    await db.transaction(async (tx) => {
        // Enable foreign keys
        await tx.executeSql('PRAGMA foreign_keys = ON');

        // Shifts table
        await tx.executeSql(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        earnings_cents INTEGER NOT NULL DEFAULT 0,
        tips_cents INTEGER NOT NULL DEFAULT 0,
        distance_miles REAL NOT NULL DEFAULT 0.0,
        ride_count INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0
      )
    `);

        // Rides table
        await tx.executeSql(`
      CREATE TABLE IF NOT EXISTS rides (
        id TEXT PRIMARY KEY NOT NULL,
        shift_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('en_route', 'in_progress', 'completed')),
        started_at TEXT NOT NULL,
        pickup_at TEXT,
        dropoff_at TEXT,
        ended_at TEXT,
        gross_cents INTEGER NOT NULL DEFAULT 0,
        tip_cents INTEGER NOT NULL DEFAULT 0,
        distance_miles REAL NOT NULL DEFAULT 0.0,
        pickup_lat REAL,
        pickup_lng REAL,
        dropoff_lat REAL,
        dropoff_lng REAL,
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
      )
    `);

        // Location pings table
        await tx.executeSql(`
      CREATE TABLE IF NOT EXISTS location_pings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id TEXT NOT NULL,
        ride_id TEXT,
        ts TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        speed_mps REAL,
        heading_deg REAL,
        accuracy_m REAL NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('gps', 'network', 'fused')),
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
      )
    `);

        // Pending API requests queue
        await tx.executeSql(`
      CREATE TABLE IF NOT EXISTS pending_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL CHECK(method IN ('POST', 'PATCH')),
        url TEXT NOT NULL,
        body TEXT NOT NULL,
        meta TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_attempt_at TEXT
      )
    `);

        // Indexes for common queries
        await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_shifts_ended ON shifts(ended_at)');
        await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_rides_shift ON rides(shift_id)');
        await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_rides_synced ON rides(synced)');
        await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_location_shift ON location_pings(shift_id)');
        await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_location_synced ON location_pings(synced)');
        await tx.executeSql('CREATE INDEX IF NOT EXISTS idx_pending_retry ON pending_requests(retry_count)');

        // Set schema version
        await tx.executeSql('PRAGMA user_version = 1');
    });

    console.log('[DB] Migration to v1 complete.');
}

/**
 * Migration to v2: add meta to pending_requests and id_mappings table.
 */
async function migrateToV2(db: SQLite.SQLiteDatabase): Promise<void> {
    console.log('[DB] Running migration to v2...');

    await db.transaction(async (tx) => {
        // Add meta column if it doesn't exist
        try {
            await tx.executeSql('ALTER TABLE pending_requests ADD COLUMN meta TEXT');
        } catch (err) {
            // Ignore if column already exists
            console.log('[DB] meta column already exists on pending_requests');
        }

        // ID mapping table
        await tx.executeSql(`
      CREATE TABLE IF NOT EXISTS id_mappings (
        local_id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT NOT NULL,
        entity TEXT NOT NULL
      )
    `);

        await tx.executeSql('PRAGMA user_version = 2');
    });

    console.log('[DB] Migration to v2 complete.');
}

/**
 * Close the database connection (for cleanup/testing).
 */
export async function closeDatabase(): Promise<void> {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
}
