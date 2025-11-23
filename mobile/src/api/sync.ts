/**
 * Background sync service for offline queue and location pings.
 */

import { AppState as RNAppState } from 'react-native';
import { getPendingRequests, markRequestComplete, incrementRetryCount, deleteFailedRequests, updateQueuedRequest } from '../db/queue';
import { getPendingPings, markPingsSynced } from '../db/location';
import { uploadLocationBatch, getApiBaseUrl, getDeviceToken } from './client';
import { resolveServerId } from '../db/util';
import * as ShiftDB from '../db/shifts';
import * as RideDB from '../db/rides';
import * as ExpenseDB from '../db/expenses';

const SYNC_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRIES = 10;
const MAX_PINGS_PER_BATCH = 100;

let syncIntervalId: NodeJS.Timeout | null = null;
let isOnline = true;
let appStateSubscription: any = null; // Store subscription reference for cleanup

/**
 * Start the background sync service.
 */
export function startSync(): void {
    if (syncIntervalId) {
        return; // Already running
    }

    console.log('[Sync] Starting background sync service...');

    // Initial sync
    performSync();

    // Set up periodic sync
    syncIntervalId = setInterval(performSync, SYNC_INTERVAL_MS);

    // Listen for app state changes (store reference for cleanup)
    appStateSubscription = RNAppState.addEventListener('change', handleAppStateChange);
}

/**
 * Stop the background sync service.
 */
export function stopSync(): void {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }

    // Remove AppState listener to prevent leak
    if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
    }

    console.log('[Sync] Stopped background sync service.');
}

/**
 * Handle app state changes (to trigger sync when coming online).
 */
function handleAppStateChange(nextAppState: string): void {
    if (nextAppState === 'active') {
        console.log('[Sync] App became active, triggering sync...');
        performSync();
    }
}

/**
 * Perform a sync cycle: process pending requests and upload location pings.
 */
async function performSync(): Promise<void> {
    try {
        // Process pending API requests
        await processPendingRequests();

        // Upload pending location pings
        await uploadPendingPings();

        // Clean up old failed requests
        const deleted = await deleteFailedRequests(MAX_RETRIES);
        if (deleted > 0) {
            console.log(`[Sync] Deleted ${deleted} failed requests exceeding max retries.`);
        }

        isOnline = true;
    } catch (error) {
        console.error('[Sync] Sync cycle failed:', error);
        isOnline = false;
    }
}

/**
 * Process pending API requests from the queue.
 */
async function processPendingRequests(): Promise<void> {
    const requests = await getPendingRequests(50);

    if (requests.length === 0) {
        return;
    }

    console.log(`[Sync] Processing ${requests.length} pending requests...`);

    // Get auth credentials for replay
    let baseUrl: string;
    let token: string;
    try {
        baseUrl = await getApiBaseUrl();
        token = await getDeviceToken();
    } catch (err) {
        console.error('[Sync] Cannot process requests: missing API config or token', err);
        return;
    }

    for (const request of requests) {
        const meta = request.meta ? safeParseMeta(request.meta) : null;

        // If request references local IDs that have since been mapped, rewrite before send
        const rewritten = await rewriteRequestIdsIfNeeded(request, meta);
        const urlToUse = rewritten.url ?? request.url;
        const bodyToUse = rewritten.body ?? request.body;
        const metaToUse = rewritten.meta ?? request.meta;

        try {
            // Construct full URL (request.url might be relative path)
            const url = urlToUse.startsWith('http') ? urlToUse : `${baseUrl}${urlToUse}`;

            // Re-execute the request with auth
            const response = await fetch(url, {
                method: request.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: bodyToUse,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Handle creation responses to map IDs
            if (meta) {
                await handlePostSuccessMappings(meta, response.clone());
            }

            // Success: mark as complete
            await markRequestComplete(request.id);
            console.log(`[Sync] Request ${request.id} completed successfully.`);
        } catch (error) {
            // Failure: increment retry count
            await incrementRetryCount(request.id);
            console.warn(`[Sync] Request ${request.id} failed (retry ${request.retry_count + 1}):`, error);
        }
    }
}

/**
 * Parse meta JSON safely.
 */
function safeParseMeta(meta: string): any | null {
    try {
        return JSON.parse(meta);
    } catch {
        return null;
    }
}

/**
 * Rewrite queued request IDs if mappings exist (local -> server).
 */
async function rewriteRequestIdsIfNeeded(
    request: { id: number; url: string; body: string; meta?: string | null },
    meta: any
): Promise<{ url?: string; body?: string; meta?: string | null }> {
    let newUrl: string | undefined;
    let newBody: string | undefined;
    let newMeta: any = meta ?? null;

    const mappings: Array<{ local: string; server: string }> = [];

    // Check meta for shift/ride IDs that might need mapping
    const idsToCheck: string[] = [];
    if (meta?.shiftId) idsToCheck.push(meta.shiftId);
    if (meta?.rideId) idsToCheck.push(meta.rideId);
    if (meta?.localId) idsToCheck.push(meta.localId);

    for (const id of idsToCheck) {
        const serverId = await resolveServerId(id);
        if (serverId && serverId !== id) {
            mappings.push({ local: id, server: serverId });
        }
    }

    if (mappings.length === 0) {
        return {};
    }

    // Replace IDs in url/body/meta
    newUrl = request.url;
    newBody = request.body;

    for (const { local, server } of mappings) {
        newUrl = newUrl.replace(local, server);
        newBody = newBody?.replaceAll(local, server);

        if (newMeta) {
            if (newMeta.shiftId === local) newMeta.shiftId = server;
            if (newMeta.rideId === local) newMeta.rideId = server;
            if (newMeta.localId === local) newMeta.localId = server;
        }
    }

    // Persist the rewrite so future retries use updated IDs
    await updateQueuedRequest(request.id, {
        url: newUrl,
        body: newBody,
        meta: newMeta ? JSON.stringify(newMeta) : null,
    });

    return { url: newUrl, body: newBody, meta: newMeta ? JSON.stringify(newMeta) : null };
}

/**
 * Handle successful POSTs that return IDs, updating local DB and mappings.
 */
async function handlePostSuccessMappings(meta: any, response: any): Promise<void> {
    if (!meta?.type) {
        return;
    }

    // Only handle JSON responses with ids
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return;
    }

    const json = await response.json();
    const serverId = json.id as string | undefined;
    if (!serverId) {
        return;
    }

    if (meta.type === 'shift_create' && meta.localId) {
        await ShiftDB.updateShiftId(meta.localId, serverId);
        await ShiftDB.markShiftSynced(serverId);
    }

    if (meta.type === 'ride_create' && meta.localId) {
        await RideDB.updateRideId(meta.localId, serverId);
        await RideDB.markRideSynced(serverId);
    }

    if (meta.type === 'expense_create' && meta.localId) {
        await ExpenseDB.markExpenseSynced(meta.localId, serverId, json.receipt_url ?? null);
    }
}

/**
 * Upload pending location pings in batches.
 */
async function uploadPendingPings(): Promise<void> {
    const pings = await getPendingPings(MAX_PINGS_PER_BATCH);

    if (pings.length === 0) {
        return;
    }

    console.log(`[Sync] Uploading ${pings.length} pending location pings...`);

    try {
        const batchPings = await Promise.all(
            pings.map(async (p) => ({
                shift_id: (await resolveServerId(p.shift_id)) ?? p.shift_id,
                ride_id: p.ride_id ? (await resolveServerId(p.ride_id)) ?? p.ride_id : undefined,
                ts: p.ts,
                lat: p.lat,
                lng: p.lng,
                speed_mps: p.speed_mps ?? undefined,
                heading_deg: p.heading_deg ?? undefined,
                accuracy_m: p.accuracy_m,
                source: p.source,
            }))
        );

        const batch = { pings: batchPings };

        await uploadLocationBatch(batch);

        // Mark pings as synced
        const pingIds = pings.map(p => p.id);
        await markPingsSynced(pingIds);

        console.log(`[Sync] Successfully uploaded ${pings.length} pings.`);
    } catch (error) {
        console.warn('[Sync] Failed to upload location pings:', error);
    }
}

/**
 * Trigger an immediate sync (useful after ending shift/ride).
 */
export async function triggerImmediateSync(): Promise<void> {
    console.log('[Sync] Immediate sync triggered.');
    await performSync();
}

// Exports for testing
export const __test = {
    safeParseMeta,
    rewriteRequestIdsIfNeeded,
    handlePostSuccessMappings,
};
