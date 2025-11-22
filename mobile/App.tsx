import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { requestMultiple, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { AppProvider, useAppContext } from './src/context/AppContext';
import IdleScreen from './src/screens/IdleScreen';
import ActiveShiftScreen from './src/screens/ActiveShiftScreen';
import ShiftSummaryScreen from './src/screens/ShiftSummaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ShiftStats, Shift } from './src/types';
import * as ShiftDB from './src/db/shifts';
import * as RideDB from './src/db/rides';

function RootApp() {
    const {
        state,
        stats,
        startShift,
        startRide,
        markPickup,
        endRide,
        endShift,
        resetToIdle,
        addTip,
        isLoading,
        error,
        clearError,
    } = useAppContext();
    const [permissionsReady, setPermissionsReady] = useState(false);
    const [lastShift, setLastShift] = useState<ShiftStats | null>(null);
    const [lastRide, setLastRide] = useState<Ride | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        requestPermissions();
    }, []);

    useEffect(() => {
        if (error) {
            Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
        }
    }, [error, clearError]);

    const requestPermissions = async () => {
        const result = await requestMultiple([
            PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
            PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
            PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
            PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
        ]);

        const denied = Object.values(result).some(
            (status) => status !== RESULTS.GRANTED && status !== RESULTS.LIMITED
        );

        if (denied) {
            Alert.alert('Permissions needed', 'Location and notifications are required for tracking.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]);
        }
        setPermissionsReady(true);
    };

    // Load last ended shift for idle screen
    useEffect(() => {
        const loadLastShift = async () => {
            try {
                const history = await ShiftDB.getShiftHistory(1);
                const last: Shift | undefined = history[0];
                if (!last) {
                    setLastShift(null);
                    setLastRide(null);
                    return;
                }
                const durationSeconds =
                    last.ended_at && last.started_at
                        ? (new Date(last.ended_at).getTime() - new Date(last.started_at).getTime()) / 1000
                        : 0;
                setLastShift({
                    rides: last.ride_count,
                    earnings: last.earnings_cents,
                    tips: last.tips_cents,
                    duration: durationSeconds,
                    ratePerHour: durationSeconds > 0 ? (last.earnings_cents / 100) / (durationSeconds / 3600) : 0,
                    distance: last.distance_miles,
                });

                const ride = await RideDB.getLastRideForShift(last.id);
                setLastRide(ride ?? null);
            } catch (err) {
                // ignore if DB not ready yet
                setLastShift(null);
                setLastRide(null);
            }
        };
        loadLastShift();
    }, [state]);

    if (!permissionsReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F9FAFB" />
            </View>
        );
    }

    let screen = null;
    if (state === 'idle') {
        screen = (
            <View style={{ flex: 1 }}>
                <IdleScreen onStartShift={startShift} loading={isLoading} lastShift={lastShift} />
                <View style={styles.settingsButton}>
                    <Button title="Settings" onPress={() => setShowSettings(true)} variant="secondary" />
                </View>
            </View>
        );
    } else if (state === 'shift_ended') {
        screen = <ShiftSummaryScreen stats={stats} onClose={resetToIdle} />;
    } else {
        screen = (
            <ActiveShiftScreen
                state={state}
                stats={stats}
                onStartRide={() => startRide()}
                onPickup={markPickup}
                onEndRide={endRide}
                onAddTip={addTip}
                onEndShift={endShift}
                loading={isLoading}
                lastRide={lastRide}
            />
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#060B16" />
            {showSettings ? <SettingsScreen onClose={() => setShowSettings(false)} /> : screen}
        </SafeAreaView>
    );
}

export default function App() {
    return (
        <AppProvider>
            <RootApp />
        </AppProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#060B16',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#060B16',
    },
    settingsButton: {
        position: 'absolute',
        bottom: 24,
        right: 24,
    },
});
