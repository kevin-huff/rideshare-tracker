/**
 * Database operations for location pings.
 */

import { getDatabase } from './index';
import { LocationPing } from '../types';

/**
 * Save a location ping.
 */
export async function savePing(
    shiftId: string,
    lat: number,
    lng: number,
    accuracy: number,
    source: 'gps' | 'network' | 'fused',
    rideId?: string,
    speed?: number,
    heading?: number
): Promise<void> {
    const db = getDatabase();
    const ts = new Date().toISOString();

    await db.executeSql(
        `INSERT INTO location_pings 
     (shift_id, ride_id, ts, lat, lng, speed_mps, heading_deg, accuracy_m, source, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            shiftId,
            rideId ?? null,
            ts,
            lat,
            lng,
            speed ?? null,
            heading ?? null,
            accuracy,
            source,
            0,
        ]
    );
}

/**
 * Get pending (unsynced) location pings, oldest first.
 * @param limit Maximum number of pings to return
 */
export async function getPendingPings(limit: number = 100): Promise<LocationPing[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM location_pings WHERE synced = 0 ORDER BY ts ASC LIMIT ?',
        [limit]
    );

    const pings: LocationPing[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        pings.push(rowToPing(result.rows.item(i)));
    }
    return pings;
}

/**
 * Mark location pings as synced (uploaded to server).
 */
export async function markPingsSynced(pingIds: number[]): Promise<void> {
    if (pingIds.length === 0) return;

    const db = getDatabase();
    const placeholders = pingIds.map(() => '?').join(',');

    await db.executeSql(
        `UPDATE location_pings SET synced = 1 WHERE id IN (${placeholders})`,
        pingIds
    );
}

/**
 * Delete old synced location pings (cleanup to save storage).
 * Keeps pings from the last N days.
 */
export async function deleteOldPings(daysToKeep: number = 30): Promise<number> {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    const [result] = await db.executeSql(
        'DELETE FROM location_pings WHERE synced = 1 AND ts < ?',
        [cutoffISO]
    );

    return result.rowsAffected;
}

/**
 * Get location pings for a specific shift (for map visualization).
 */
export async function getPingsForShift(shiftId: string): Promise<LocationPing[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM location_pings WHERE shift_id = ? ORDER BY ts ASC',
        [shiftId]
    );

    const pings: LocationPing[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        pings.push(rowToPing(result.rows.item(i)));
    }
    return pings;
}

/**
 * Get location pings for a specific ride (for map visualization).
 */
export async function getPingsForRide(rideId: string): Promise<LocationPing[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM location_pings WHERE ride_id = ? ORDER BY ts ASC',
        [rideId]
    );

    const pings: LocationPing[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        pings.push(rowToPing(result.rows.item(i)));
    }
    return pings;
}

/**
 * Convert database row to LocationPing object.
 */
function rowToPing(row: any): LocationPing {
    return {
        id: row.id,
        shift_id: row.shift_id,
        ride_id: row.ride_id,
        ts: row.ts,
        lat: row.lat,
        lng: row.lng,
        speed_mps: row.speed_mps,
        heading_deg: row.heading_deg,
        accuracy_m: row.accuracy_m,
        source: row.source,
        synced: row.synced === 1,
    };
}
