/**
 * Database operations for rides.
 */

import { getDatabase } from './index';
import { Ride } from '../types';
import uuid from 'react-native-uuid';
import { saveIdMapping } from './util';

/**
 * Create a new ride.
 */
export async function createRide(
    shiftId: string,
    pickupLat?: number,
    pickupLng?: number
): Promise<Ride> {
    const db = getDatabase();
    const id = uuid.v4() as string;
    const started_at = new Date().toISOString();

    await db.executeSql(
        `INSERT INTO rides (id, shift_id, status, started_at, pickup_lat, pickup_lng, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, shiftId, 'en_route', started_at, pickupLat ?? null, pickupLng ?? null, 0]
    );

    const ride: Ride = {
        id,
        shift_id: shiftId,
        status: 'en_route',
        started_at,
        pickup_at: null,
        dropoff_at: null,
        ended_at: null,
        gross_cents: 0,
        tip_cents: 0,
        distance_miles: 0,
        pickup_lat: pickupLat ?? null,
        pickup_lng: pickupLng ?? null,
        dropoff_lat: null,
        dropoff_lng: null,
        synced: false,
    };

    return ride;
}

/**
 * Mark rider as picked up.
 */
export async function markRiderPickedUp(rideId: string): Promise<void> {
    const db = getDatabase();
    const pickup_at = new Date().toISOString();

    await db.executeSql(
        'UPDATE rides SET status = ?, pickup_at = ?, synced = 0 WHERE id = ?',
        ['in_progress', pickup_at, rideId]
    );
}

/**
 * End a ride.
 */
export async function endRide(
    rideId: string,
    grossCents: number,
    dropoffLat?: number,
    dropoffLng?: number
): Promise<void> {
    const db = getDatabase();
    const ended_at = new Date().toISOString();
    const dropoff_at = ended_at;

    await db.executeSql(
        `UPDATE rides 
     SET status = ?, ended_at = ?, dropoff_at = ?, gross_cents = ?, 
         dropoff_lat = ?, dropoff_lng = ?, synced = 0 
     WHERE id = ?`,
        [
            'completed',
            ended_at,
            dropoff_at,
            grossCents,
            dropoffLat ?? null,
            dropoffLng ?? null,
            rideId,
        ]
    );
}

/**
 * Add tip to a ride (accumulates with existing tips).
 */
export async function addTipToRide(rideId: string, tipCents: number): Promise<void> {
    const db = getDatabase();

    // Increment tip_cents instead of replacing
    await db.executeSql(
        'UPDATE rides SET tip_cents = tip_cents + ?, synced = 0 WHERE id = ?',
        [tipCents, rideId]
    );
}

/**
 * Get active ride (not completed).
 */
export async function getActiveRide(shiftId: string): Promise<Ride | null> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        `SELECT * FROM rides 
     WHERE shift_id = ? AND status != 'completed' 
     ORDER BY started_at DESC LIMIT 1`,
        [shiftId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return rowToRide(result.rows.item(0));
}

/**
 * Get ride by ID.
 */
export async function getRideById(rideId: string): Promise<Ride | null> {
    const db = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM rides WHERE id = ?', [rideId]);

    if (result.rows.length === 0) {
        return null;
    }

    return rowToRide(result.rows.item(0));
}

/**
 * Get all rides for a shift.
 */
export async function getRidesForShift(shiftId: string): Promise<Ride[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM rides WHERE shift_id = ? ORDER BY started_at ASC',
        [shiftId]
    );

    const rides: Ride[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        rides.push(rowToRide(result.rows.item(i)));
    }
    return rides;
}

/**
 * Mark ride as synced.
 */
export async function markRideSynced(rideId: string): Promise<void> {
    const db = getDatabase();
    await db.executeSql('UPDATE rides SET synced = 1 WHERE id = ?', [rideId]);
}

/**
 * Get the most recent ride for a shift.
 */
export async function getLastRideForShift(shiftId: string): Promise<Ride | null> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM rides WHERE shift_id = ? ORDER BY started_at DESC LIMIT 1',
        [shiftId]
    );

    if (result.rows.length === 0) {
        return null;
    }
    return rowToRide(result.rows.item(0));
}

/**
 * Update ride ID (replace local UUID with server ID after sync).
 * Also updates all related location pings to maintain foreign key integrity.
 */
export async function updateRideId(oldId: string, newId: string): Promise<void> {
    const db = getDatabase();

    await db.transaction(async (tx) => {
        // Update location pings first (foreign key dependency)
        await tx.executeSql('UPDATE location_pings SET ride_id = ? WHERE ride_id = ?', [newId, oldId]);

        // Update ride itself
        await tx.executeSql('UPDATE rides SET id = ? WHERE id = ?', [newId, oldId]);

        // Record mapping for queued requests rewrites
        await saveIdMapping('ride', oldId, newId, tx);
    });
}

/**
 * Convert database row to Ride object.
 */
function rowToRide(row: any): Ride {
    return {
        id: row.id,
        shift_id: row.shift_id,
        status: row.status,
        started_at: row.started_at,
        pickup_at: row.pickup_at,
        dropoff_at: row.dropoff_at,
        ended_at: row.ended_at,
        gross_cents: row.gross_cents,
        tip_cents: row.tip_cents,
        distance_miles: row.distance_miles,
        pickup_lat: row.pickup_lat,
        pickup_lng: row.pickup_lng,
        dropoff_lat: row.dropoff_lat,
        dropoff_lng: row.dropoff_lng,
        synced: row.synced === 1,
    };
}
