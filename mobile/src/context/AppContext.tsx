/**
 * App Context - Global state management and state machine logic.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateType, Shift, Ride, ShiftStats } from '../types';
import { initDatabase } from '../db';
import * as ShiftDB from '../db/shifts';
import * as RideDB from '../db/rides';
import { enqueueRequest } from '../db/queue';
import * as API from '../api/client';
import { startSync, stopSync, triggerImmediateSync } from '../api/sync';

interface AppContextValue {
    // State
    state: AppStateType;
    activeShift: Shift | null;
    activeRide: Ride | null;
    stats: ShiftStats;

    // Actions
    startShift: () => Promise<void>;
    endShift: () => Promise<void>;
    startRide: (pickupLat?: number, pickupLng?: number) => Promise<void>;
    markPickup: () => Promise<void>;
    endRide: (grossCents: number, dropoffLat?: number, dropoffLng?: number) => Promise<void>;
    addTip: (tipCents: number) => Promise<void>;

    // UI helpers
    isLoading: boolean;
    error: string | null;
    clearError: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AppStateType>('idle');
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [activeRide, setActiveRide] = useState<Ride | null>(null);
    const [stats, setStats] = useState<ShiftStats>({
        rides: 0,
        earnings: 0,
        tips: 0,
        duration: 0,
        ratePerHour: 0,
        distance: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Restore active shift on mount
    useEffect(() => {
        initializeApp();
    }, []);

    /**
     * Initialize the app: database and restore active shift.
     */
    const initializeApp = async () => {
        try {
            // Initialize database first
            await initDatabase();
            console.log('[AppContext] Database initialized');

            // Then restore active shift
            await restoreActiveShift();
        } catch (err) {
            console.error('[AppContext] Failed to initialize app:', err);
            setError('Failed to initialize app. Please restart.');
        }
    };

    // Update stats whenever activeShift changes
    useEffect(() => {
        if (activeShift) {
            updateStats(activeShift);
        }
    }, [activeShift]);

    /**
     * Restore active shift from database on app launch.
     */
    const restoreActiveShift = async () => {
        try {
            const shift = await ShiftDB.getActiveShift();
            if (shift) {
                setActiveShift(shift);
                const ride = await RideDB.getActiveRide(shift.id);
                setActiveRide(ride);

                if (ride) {
                    setState(ride.status === 'en_route' ? 'en_route' : 'in_ride');
                } else {
                    setState('shift_active');
                }

                // Resume sync
                startSync();
            } else {
                setState('idle');
            }
        } catch (err) {
            console.error('[AppContext] Failed to restore active shift:', err);
            setState('idle');
        }
    };

    /**
     * Update stats from shift data.
     */
    const updateStats = (shift: Shift) => {
        const duration = shift.ended_at
            ? (new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 1000
            : (Date.now() - new Date(shift.started_at).getTime()) / 1000;

        const hours = duration / 3600;
        const ratePerHour = hours > 0 ? (shift.earnings_cents / 100) / hours : 0;

        setStats({
            rides: shift.ride_count,
            earnings: shift.earnings_cents,
            tips: shift.tips_cents,
            duration: Math.floor(duration),
            ratePerHour,
            distance: shift.distance_miles,
        });
    };

    /**
     * Start a new shift.
     */
    const startShift = useCallback(async () => {
        if (state !== 'idle') {
            throw new Error('Cannot start shift: Already in an active shift');
        }

        setIsLoading(true);
        setError(null);

        try {
            // Create local shift with temporary UUID
            const tempShift = await ShiftDB.createShift();
            setActiveShift(tempShift);
            setState('shift_active');

            // Start background sync
            startSync();

            // Sync to server
            try {
                const response = await API.startShift();
                console.log('[AppContext] Shift started on server:', response.id);

                // Replace local UUID with server ID
                await ShiftDB.updateShiftId(tempShift.id, response.id);

                // Reload shift with new ID
                const updatedShift = await ShiftDB.getShiftById(response.id);
                setActiveShift(updatedShift);
                await ShiftDB.markShiftSynced(response.id);
            } catch (apiError) {
                console.warn('[AppContext] Failed to sync shift to server:', apiError);
                // Enqueue for retry with mapping metadata
                await enqueueRequest('POST', '/v1/shifts', {}, {
                    type: 'shift_create',
                    localId: tempShift.id,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start shift');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [state]);

    /**
     * End the current shift.
     */
    const endShift = useCallback(async () => {
        if (!activeShift || state === 'idle') {
            throw new Error('No active shift to end');
        }
        if (activeRide) {
            throw new Error('Cannot end shift: Ride in progress');
        }

        setIsLoading(true);
        setError(null);

        try {
            // Update local shift
            await ShiftDB.endShift(activeShift.id);
            const updatedShift = await ShiftDB.getShiftById(activeShift.id);
            setActiveShift(updatedShift);
            setState('shift_ended');

            // Sync to server
            try {
                await API.endShift(activeShift.id);
                await ShiftDB.markShiftSynced(activeShift.id);
            } catch (apiError) {
                console.warn('[AppContext] Failed to sync shift end to server:', apiError);
                // Enqueue for retry
                await enqueueRequest('PATCH', `/v1/shifts/${activeShift.id}/end`, {}, {
                    type: 'shift_end',
                    shiftId: activeShift.id,
                });
            }

            // Trigger final sync
            await triggerImmediateSync();

            // Stop sync service
            stopSync();

            // Transition to idle after showing summary
            setTimeout(() => {
                setState('idle');
                setActiveShift(null);
                setActiveRide(null);
            }, 5000); // 5s delay for summary screen
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to end shift');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [activeShift, activeRide, state]);

    /**
     * Start a new ride.
     */
    const startRide = useCallback(async (pickupLat?: number, pickupLng?: number) => {
        if (!activeShift) {
            throw new Error('Cannot start ride: No active shift');
        }
        if (state !== 'shift_active') {
            throw new Error('Cannot start ride: Invalid state');
        }

        setIsLoading(true);
        setError(null);

        try {
            // Create local ride with temporary UUID
            const tempRide = await RideDB.createRide(activeShift.id, pickupLat, pickupLng);
            setActiveRide(tempRide);
            setState('en_route');

            // Sync to server
            try {
                const response = await API.startRide({
                    shift_id: activeShift.id,
                    pickup_lat: pickupLat,
                    pickup_lng: pickupLng,
                });
                console.log('[AppContext] Ride started on server:', response.id);

                // Replace local UUID with server ID
                await RideDB.updateRideId(tempRide.id, response.id);

                // Reload ride with new ID
                const updatedRide = await RideDB.getRideById(response.id);
                setActiveRide(updatedRide);
                await RideDB.markRideSynced(response.id);
            } catch (apiError) {
                console.warn('[AppContext] Failed to sync ride to server:', apiError);
                // Enqueue for retry
                await enqueueRequest('POST', '/v1/rides', {
                    shift_id: activeShift.id,
                    pickup_lat: pickupLat,
                    pickup_lng: pickupLng,
                }, {
                    type: 'ride_create',
                    localId: tempRide.id,
                    shiftId: activeShift.id,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start ride');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [activeShift, state]);

    /**
     * Mark rider as picked up.
     */
    const markPickup = useCallback(async () => {
        if (!activeRide || state !== 'en_route') {
            throw new Error('Cannot mark pickup: No active ride en route');
        }

        setIsLoading(true);
        setError(null);

        try {
            await RideDB.markRiderPickedUp(activeRide.id);
            const updatedRide = await RideDB.getRideById(activeRide.id);
            setActiveRide(updatedRide);
            setState('in_ride');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark pickup');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [activeRide, state]);

    /**
     * End the current ride.
     */
    const endRide = useCallback(async (grossCents: number, dropoffLat?: number, dropoffLng?: number) => {
        if (!activeRide || !activeShift) {
            throw new Error('Cannot end ride: No active ride');
        }
        if (state !== 'in_ride') {
            throw new Error('Cannot end ride: Invalid state');
        }

        setIsLoading(true);
        setError(null);

        try {
            // Update local ride
            await RideDB.endRide(activeRide.id, grossCents, dropoffLat, dropoffLng);

            // Update shift totals
            await ShiftDB.updateShiftTotals(activeShift.id, {
                earnings_cents: activeShift.earnings_cents + grossCents,
                ride_count: activeShift.ride_count + 1,
            });

            // Refresh shift and ride
            const updatedShift = await ShiftDB.getShiftById(activeShift.id);
            setActiveShift(updatedShift);
            setActiveRide(null);
            setState('shift_active');

            // Sync to server
            try {
                await API.endRide(activeRide.id, {
                    gross_cents: grossCents,
                    dropoff_lat: dropoffLat,
                    dropoff_lng: dropoffLng,
                });
                await RideDB.markRideSynced(activeRide.id);
                await ShiftDB.markShiftSynced(activeShift.id);
            } catch (apiError) {
                console.warn('[AppContext] Failed to sync ride end to server:', apiError);
                // Enqueue for retry
                await enqueueRequest('PATCH', `/v1/rides/${activeRide.id}/end`, {
                    gross_cents: grossCents,
                    dropoff_lat: dropoffLat,
                    dropoff_lng: dropoffLng,
                }, {
                    type: 'ride_end',
                    rideId: activeRide.id,
                    shiftId: activeShift.id,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to end ride');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [activeRide, activeShift, state]);

    /**
     * Add tip to the last completed ride.
     */
    const addTip = useCallback(async (tipCents: number) => {
        if (!activeShift) {
            throw new Error('No active shift');
        }

        setIsLoading(true);
        setError(null);

        try {
            // Get the last completed ride
            const rides = await RideDB.getRidesForShift(activeShift.id);
            const lastRide = rides[rides.length - 1];

            if (!lastRide) {
                throw new Error('No rides found');
            }

            // Update local ride
            await RideDB.addTipToRide(lastRide.id, tipCents);

            // Update shift tip total
            await ShiftDB.updateShiftTotals(activeShift.id, {
                tips_cents: activeShift.tips_cents + tipCents,
            });

            // Refresh shift
            const updatedShift = await ShiftDB.getShiftById(activeShift.id);
            setActiveShift(updatedShift);

            // Sync to server
            try {
                await API.addTip(lastRide.id, { tip_cents: tipCents });
                await RideDB.markRideSynced(lastRide.id);
                await ShiftDB.markShiftSynced(activeShift.id);
            } catch (apiError) {
                console.warn('[AppContext] Failed to sync tip to server:', apiError);
                // Enqueue for retry
                await enqueueRequest('POST', `/v1/rides/${lastRide.id}/tips`, { tip_cents: tipCents }, {
                    type: 'ride_tip',
                    rideId: lastRide.id,
                    shiftId: activeShift.id,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add tip');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [activeShift]);

    const clearError = useCallback(() => setError(null), []);

    const value: AppContextValue = {
        state,
        activeShift,
        activeRide,
        stats,
        startShift,
        endShift,
        startRide,
        markPickup,
        endRide,
        addTip,
        isLoading,
        error,
        clearError,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
}
