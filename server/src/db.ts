import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | undefined;
let currentDbPath: string | undefined;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

export function initDb(customPath?: string) {
  if (db) {
    console.warn('Database already initialized, closing old connection.');
    closeDb();
  }

  const dbPath = customPath || process.env.DB_PATH || path.join(process.cwd(), 'rideshare.db');
  db = new Database(dbPath);
  currentDbPath = dbPath;

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  // Enable Foreign Keys
  db.pragma('foreign_keys = ON');

  // In production/dist, schema.sql might be in the same dir as this file
  // But during dev (tsx), it's in src.
  const schemaPath = path.join(__dirname, 'schema.sql');

  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    // Seed settings row if missing
    db.prepare(
      `INSERT OR IGNORE INTO settings (id, overlay_privacy_radius_m, overlay_hide_location, overlay_theme)
       VALUES (1, 0, 0, 'midnight')`
    ).run();
    // console.log(`Database initialized at ${dbPath}`);
  } catch (e) {
    console.error('Failed to load schema.sql', e);
    throw e;
  }
}

export function getDbPath() {
  if (!currentDbPath) {
    throw new Error('Database path not set');
  }
  return currentDbPath;
}
