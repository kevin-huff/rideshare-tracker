/**
 * Database operations for the offline request queue.
 */

import { getDatabase } from './index';
import { PendingRequest } from '../types';

/**
 * Enqueue a failed API request for retry.
 */
export async function enqueueRequest(
    method: 'POST' | 'PATCH',
    url: string,
    body: object,
    meta?: object
): Promise<void> {
    const db = getDatabase();
    const created_at = new Date().toISOString();
    const bodyJson = JSON.stringify(body);
    const metaJson = meta ? JSON.stringify(meta) : null;

    await db.executeSql(
        'INSERT INTO pending_requests (method, url, body, meta, retry_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [method, url, bodyJson, metaJson, 0, created_at]
    );
}

/**
 * Get pending requests (ordered by retry count, then creation time).
 * Prioritizes requests with fewer retries.
 */
export async function getPendingRequests(limit: number = 50): Promise<PendingRequest[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM pending_requests ORDER BY retry_count ASC, created_at ASC LIMIT ?',
        [limit]
    );

    const requests: PendingRequest[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        requests.push(rowToRequest(result.rows.item(i)));
    }
    return requests;
}

/**
 * Mark a request as successfully processed and delete it.
 */
export async function markRequestComplete(requestId: number): Promise<void> {
    const db = getDatabase();
    await db.executeSql('DELETE FROM pending_requests WHERE id = ?', [requestId]);
}

/**
 * Update a queued request (used when rewriting IDs after server assigns them).
 */
export async function updateQueuedRequest(
    requestId: number,
    updates: Partial<Pick<PendingRequest, 'url' | 'body' | 'meta'>>
): Promise<void> {
    const db = getDatabase();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.url !== undefined) {
        fields.push('url = ?');
        values.push(updates.url);
    }
    if (updates.body !== undefined) {
        fields.push('body = ?');
        values.push(updates.body);
    }
    if (updates.meta !== undefined) {
        fields.push('meta = ?');
        values.push(updates.meta);
    }

    if (fields.length === 0) {
        return;
    }

    values.push(requestId);

    await db.executeSql(
        `UPDATE pending_requests SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
}

/**
 * Increment retry count for a failed request.
 */
export async function incrementRetryCount(requestId: number): Promise<void> {
    const db = getDatabase();
    const last_attempt_at = new Date().toISOString();

    await db.executeSql(
        'UPDATE pending_requests SET retry_count = retry_count + 1, last_attempt_at = ? WHERE id = ?',
        [last_attempt_at, requestId]
    );
}

/**
 * Delete requests that have exceeded max retries.
 */
export async function deleteFailedRequests(maxRetries: number = 10): Promise<number> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'DELETE FROM pending_requests WHERE retry_count > ?',
        [maxRetries]
    );

    return result.rowsAffected;
}

/**
 * Convert database row to PendingRequest object.
 */
function rowToRequest(row: any): PendingRequest {
    return {
        id: row.id,
        method: row.method,
        url: row.url,
        body: row.body,
        meta: row.meta,
        retry_count: row.retry_count,
        created_at: row.created_at,
        last_attempt_at: row.last_attempt_at,
    };
}
