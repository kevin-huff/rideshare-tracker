/**
 * API client for communicating with the Rideshare Tracker server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    StartShiftResponse,
    StartRideResponse,
    LocationBatch,
    StartRideRequest,
    EndRideRequest,
    AddTipRequest,
} from '../types';

const API_BASE_URL_KEY = '@api_base_url';
const DEVICE_TOKEN_KEY = '@device_token';

/**
 * Get the API base URL from storage.
 */
export async function getApiBaseUrl(): Promise<string> {
    const url = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (!url) {
        throw new Error('API base URL not configured. Please set it in settings.');
    }
    return url;
}

/**
 * Set the API base URL.
 */
export async function setApiBaseUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(API_BASE_URL_KEY, url);
}

/**
 * Get the device token from storage.
 */
export async function getDeviceToken(): Promise<string> {
    const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
        throw new Error('Device token not set. Please pair with server first.');
    }
    return token;
}

/**
 * Set the device token (from QR code pairing or manual entry).
 */
export async function setDeviceToken(token: string): Promise<void> {
    await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
}

/**
 * Compute the public overlay URL for sharing/OBS.
 */
export async function getOverlayUrl(): Promise<string> {
    const baseUrl = await getApiBaseUrl();
    return `${baseUrl.replace(/\/$/, '')}/overlay`;
}

/**
 * Make an authenticated API request with retry logic.
 */
async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: object,
    retries: number = 3
): Promise<T> {
    const baseUrl = await getApiBaseUrl();
    const token = await getDeviceToken();
    const url = `${baseUrl}${path}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Handle empty responses (e.g., from PATCH endpoints)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json();
            } else {
                return {} as T;
            }
        } catch (error) {
            lastError = error as Error;

            // Don't retry on client errors (4xx)
            if (error instanceof Error && error.message.includes('HTTP 4')) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            if (attempt < retries - 1) {
                const delayMs = 1000 * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError || new Error('API request failed after retries');
}

// ============================================================================
// Shift Endpoints
// ============================================================================

export async function startShift(): Promise<StartShiftResponse> {
    return apiRequest<StartShiftResponse>('POST', '/v1/shifts');
}

export async function endShift(shiftId: string): Promise<void> {
    return apiRequest<void>('PATCH', `/v1/shifts/${shiftId}/end`);
}

// ============================================================================
// Ride Endpoints
// ============================================================================

export async function startRide(request: StartRideRequest): Promise<StartRideResponse> {
    return apiRequest<StartRideResponse>('POST', '/v1/rides', request);
}

export async function endRide(rideId: string, request: EndRideRequest): Promise<void> {
    return apiRequest<void>('PATCH', `/v1/rides/${rideId}/end`, request);
}

export async function addTip(rideId: string, request: AddTipRequest): Promise<void> {
    return apiRequest<void>('POST', `/v1/rides/${rideId}/tips`, request);
}

// ============================================================================
// Location Endpoints
// ============================================================================

export async function uploadLocationBatch(batch: LocationBatch): Promise<void> {
    return apiRequest<void>('POST', '/v1/location', batch);
}
