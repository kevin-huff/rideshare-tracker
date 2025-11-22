/**
 * Database operations for shifts.
 */

import { getDatabase } from './index';
import { Shift } from '../types';
import uuid from 'react-native-uuid';
import { saveIdMapping } from './util';

/**
 * Create a new shift.
 */
export async function createShift(): Promise<Shift> {
    const db = getDatabase();
    const id = uuid.v4() as string;
    const started_at = new Date().toISOString();

    await db.executeSql(
        'INSERT INTO shifts (id, started_at, synced) VALUES (?, ?, ?)',
        [id, started_at, 0]
    );

    const shift: Shift = {
        id,
        started_at,
        ended_at: null,
        earnings_cents: 0,
        tips_cents: 0,
        distance_miles: 0,
        ride_count: 0,
        synced: false,
    };

    return shift;
}

/**
 * Get the currently active shift (not ended).
 */
export async function getActiveShift(): Promise<Shift | null> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
        return null;
    }

    return rowToShift(result.rows.item(0));
}

/**
 * End a shift.
 */
export async function endShift(shiftId: string): Promise<void> {
    const db = getDatabase();
    const ended_at = new Date().toISOString();

    await db.executeSql(
        'UPDATE shifts SET ended_at = ?, synced = 0 WHERE id = ?',
        [ended_at, shiftId]
    );
}

/**
 * Update shift totals (earnings, tips, distance, ride count).
 */
export async function updateShiftTotals(
    shiftId: string,
    updates: Partial<Pick<Shift, 'earnings_cents' | 'tips_cents' | 'distance_miles' | 'ride_count'>>
): Promise<void> {
    const db = getDatabase();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.earnings_cents !== undefined) {
        fields.push('earnings_cents = ?');
        values.push(updates.earnings_cents);
    }
    if (updates.tips_cents !== undefined) {
        fields.push('tips_cents = ?');
        values.push(updates.tips_cents);
    }
    if (updates.distance_miles !== undefined) {
        fields.push('distance_miles = ?');
        values.push(updates.distance_miles);
    }
    if (updates.ride_count !== undefined) {
        fields.push('ride_count = ?');
        values.push(updates.ride_count);
    }

    if (fields.length === 0) return;

    fields.push('synced = 0');
    values.push(shiftId);

    await db.executeSql(
        `UPDATE shifts SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
}

/**
 * Mark shift as synced.
 */
export async function markShiftSynced(shiftId: string): Promise<void> {
    const db = getDatabase();
    await db.executeSql('UPDATE shifts SET synced = 1 WHERE id = ?', [shiftId]);
}

/**
 * Update shift ID (replace local UUID with server ID after sync).
 * Also updates all related rides to maintain foreign key integrity.
 */
export async function updateShiftId(oldId: string, newId: string): Promise<void> {
    const db = getDatabase();

    await db.transaction(async (tx) => {
        // Update rides first (foreign key dependency)
        await tx.executeSql('UPDATE rides SET shift_id = ? WHERE shift_id = ?', [newId, oldId]);

        // Update location pings
        await tx.executeSql('UPDATE location_pings SET shift_id = ? WHERE shift_id = ?', [newId, oldId]);

        // Update shift itself
        await tx.executeSql('UPDATE shifts SET id = ? WHERE id = ?', [newId, oldId]);

        // Record mapping for queued requests rewrites
        await saveIdMapping('shift', oldId, newId, tx);
    });
}

/**
 * Get shift by ID.
 */
export async function getShiftById(shiftId: string): Promise<Shift | null> {
    const db = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM shifts WHERE id = ?', [shiftId]);

    if (result.rows.length === 0) {
        return null;
    }

    return rowToShift(result.rows.item(0));
}

/**
 * Get recent shift history (last N shifts).
 */
export async function getShiftHistory(limit: number = 10): Promise<Shift[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM shifts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?',
        [limit]
    );

    const shifts: Shift[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        shifts.push(rowToShift(result.rows.item(i)));
    }
    return shifts;
}

/**
 * Convert database row to Shift object.
 */
function rowToShift(row: any): Shift {
    return {
        id: row.id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        earnings_cents: row.earnings_cents,
        tips_cents: row.tips_cents,
        distance_miles: row.distance_miles,
        ride_count: row.ride_count,
        synced: row.synced === 1,
    };
}
