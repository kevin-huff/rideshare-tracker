import BackgroundGeolocation from '@mauron85/react-native-background-geolocation';
import { Platform } from 'react-native';
import { savePing } from '../db/location';

type TrackingMode = 'waiting' | 'ride';

interface TrackingState {
    shiftId: string | null;
    rideId: string | null;
    running: boolean;
    mode: TrackingMode;
}

const state: TrackingState = {
    shiftId: null,
    rideId: null,
    running: false,
    mode: 'waiting',
};

function getConfig(mode: TrackingMode) {
    const isRide = mode === 'ride';
    return {
        desiredAccuracy: isRide
            ? BackgroundGeolocation.HIGH_ACCURACY
            : BackgroundGeolocation.MEDIUM_ACCURACY,
        stationaryRadius: isRide ? 5 : 15,
        distanceFilter: isRide ? 5 : 15,
        interval: isRide ? 4000 : 15000,
        fastestInterval: isRide ? 3000 : 10000,
        activitiesInterval: isRide ? 4000 : 15000,
        notificationTitle: isRide ? 'Ride in progress' : 'Shift active',
        notificationText: 'Location tracking enabled',
        startOnBoot: true,
        stopOnTerminate: false,
        saveBatteryOnBackground: false,
        debug: false,
        stopOnStillActivity: false,
        startForeground: true,
        locationProvider: BackgroundGeolocation.ACTIVITY_PROVIDER,
    };
}

function attachListeners() {
    // Prevent duplicate listeners when reconfiguring
    BackgroundGeolocation.removeAllListeners();

    BackgroundGeolocation.on('location', async (location) => {
        if (!state.shiftId) return;

        // Required on iOS, safe on Android
        BackgroundGeolocation.startTask(async (taskKey: number) => {
            try {
                await savePing(
                    state.shiftId!,
                    location.latitude,
                    location.longitude,
                    location.accuracy ?? 0,
                    Platform.OS === 'android' ? 'gps' : 'fused',
                    state.rideId ?? undefined,
                    location.speed ?? undefined,
                    location.bearing ?? undefined
                );
            } catch (err) {
                // Swallow errors; sync will retry later
                console.warn('[LocationService] Failed to save ping', err);
            } finally {
                BackgroundGeolocation.endTask(taskKey);
            }
        });
    });

    BackgroundGeolocation.on('error', (error) => {
        console.warn('[LocationService] Error', error);
    });
}

/**
 * Start tracking for the current shift/ride.
 */
export async function start(shiftId: string, rideId?: string, mode: TrackingMode = 'waiting') {
    state.shiftId = shiftId;
    state.rideId = rideId ?? null;
    state.mode = mode;

    BackgroundGeolocation.configure(getConfig(mode));

    if (!state.running) {
        attachListeners();
        BackgroundGeolocation.start();
        state.running = true;
    } else {
        BackgroundGeolocation.start();
    }
}

/**
 * Update tracking parameters when ride state changes.
 */
export function setMode(mode: TrackingMode, rideId?: string) {
    if (!state.running) return;
    state.mode = mode;
    state.rideId = rideId ?? null;
    BackgroundGeolocation.configure(getConfig(mode));
}

/**
 * Stop tracking entirely.
 */
export function stop() {
    if (!state.running) return;
    BackgroundGeolocation.removeAllListeners();
    BackgroundGeolocation.stop();
    state.shiftId = null;
    state.rideId = null;
    state.running = false;
}
