import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppProvider, useAppContext } from '../src/context/AppContext';
import * as ShiftDB from '../src/db/shifts';
import * as RideDB from '../src/db/rides';
import * as API from '../src/api/client';
import * as Sync from '../src/api/sync';
import * as LocationService from '../src/services/LocationService';

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
    AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
}));

jest.mock('@mauron85/react-native-background-geolocation', () => ({
    HIGH_ACCURACY: 0,
    MEDIUM_ACCURACY: 1,
    ACTIVITY_PROVIDER: 1,
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    configure: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    startTask: jest.fn((cb: Function) => cb(1)),
    endTask: jest.fn(),
}));

jest.mock('../src/db/index', () => ({
    initDatabase: jest.fn(),
}));

jest.mock('../src/db/shifts');
jest.mock('../src/db/rides');
jest.mock('../src/api/client');
jest.mock('../src/api/sync');
jest.mock('../src/services/LocationService');

function TestHarness() {
    const ctx = useAppContext();
    (global as any).__CTX__ = ctx;
    return null;
}

describe('AppContext workflow', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.useFakeTimers();
        (ShiftDB.getActiveShift as jest.Mock).mockResolvedValue(null);
        (RideDB.getActiveRide as jest.Mock).mockResolvedValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('runs shift -> ride -> end flow and updates states', async () => {
        (ShiftDB.createShift as jest.Mock).mockResolvedValue({
            id: 'local-shift',
            started_at: 'now',
            ended_at: null,
            earnings_cents: 0,
            tips_cents: 0,
            distance_miles: 0,
            ride_count: 0,
            synced: false,
        });
        (RideDB.createRide as jest.Mock).mockResolvedValue({
            id: 'local-ride',
            shift_id: 'local-shift',
            status: 'en_route',
            started_at: 'now',
            pickup_at: null,
            dropoff_at: null,
            ended_at: null,
            gross_cents: 0,
            tip_cents: 0,
            distance_miles: 0,
            pickup_lat: null,
            pickup_lng: null,
            dropoff_lat: null,
            dropoff_lng: null,
            synced: false,
        });
        (ShiftDB.getShiftById as jest.Mock).mockResolvedValue({
            id: 'local-shift',
            started_at: 'now',
            ended_at: null,
            earnings_cents: 0,
            tips_cents: 0,
            distance_miles: 0,
            ride_count: 0,
            synced: false,
        });
        (RideDB.getRideById as jest.Mock).mockResolvedValue({
            id: 'local-ride',
            shift_id: 'local-shift',
            status: 'in_progress',
            started_at: 'now',
            pickup_at: 'now',
            dropoff_at: null,
            ended_at: null,
            gross_cents: 0,
            tip_cents: 0,
            distance_miles: 0,
            pickup_lat: null,
            pickup_lng: null,
            dropoff_lat: null,
            dropoff_lng: null,
            synced: false,
        });

        (API.startShift as jest.Mock).mockResolvedValue({ id: 'server-shift', started_at: 'now' });
        (API.startRide as jest.Mock).mockResolvedValue({ id: 'server-ride', started_at: 'now' });
        (API.endRide as jest.Mock).mockResolvedValue({});
        (API.endShift as jest.Mock).mockResolvedValue({});

        await act(async () => {
            TestRenderer.create(
                <AppProvider>
                    <TestHarness />
                </AppProvider>
            );
        });
        let ctx = (global as any).__CTX__;

        await act(async () => {
            await ctx.startShift();
        });
        ctx = (global as any).__CTX__;
        expect(ctx.state).toBe('shift_active');
        expect(LocationService.start).toHaveBeenCalled();

        await act(async () => {
            await ctx.startRide();
        });
        ctx = (global as any).__CTX__;
        expect(ctx.state).toBe('en_route');

        await act(async () => {
            await ctx.markPickup();
        });
        ctx = (global as any).__CTX__;
        expect(ctx.state).toBe('in_ride');

        (ShiftDB.getShiftById as jest.Mock).mockResolvedValue({
            id: 'local-shift',
            started_at: 'now',
            ended_at: null,
            earnings_cents: 1500,
            tips_cents: 0,
            distance_miles: 0,
            ride_count: 1,
            synced: false,
        });

        await act(async () => {
            await ctx.endRide(1500);
        });
        ctx = (global as any).__CTX__;
        expect(ctx.state).toBe('shift_active');

        await act(async () => {
            await ctx.endShift();
        });

        ctx = (global as any).__CTX__;
        expect(ctx.state).toBe('shift_ended');
        expect(Sync.stopSync).toHaveBeenCalled();
        expect(LocationService.stop).toHaveBeenCalled();

        // Flush timeout that would reset to idle
        await act(async () => {
            jest.runAllTimers();
        });
    });
});
