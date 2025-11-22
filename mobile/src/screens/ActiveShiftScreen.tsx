import React, { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Button from '../components/Button';
import StatCard from '../components/StatCard';
import RideSummaryModal from './RideSummaryModal';
import { AppStateType, ShiftStats } from '../types';
import { Ride } from '../types';
import { getOverlayUrl } from '../api/client';

interface Props {
    state: AppStateType;
    stats: ShiftStats;
    onStartRide: () => void;
    onPickup: () => void;
    onEndRide: (fareCents: number) => void;
    onAddTip: (tipCents: number) => void;
    onEndShift: () => void;
    loading: boolean;
    lastRide?: Ride | null;
}

export function ActiveShiftScreen({
    state,
    stats,
    onStartRide,
    onPickup,
    onEndRide,
    onAddTip,
    onEndShift,
    loading,
    lastRide,
}: Props) {
    const [showSummary, setShowSummary] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const [tipValue, setTipValue] = useState('');

    MapboxGL.setAccessToken('');
    MapboxGL.setWellKnownTileServer('MapLibre');

    const rideStatusLabel =
        state === 'en_route'
            ? 'En route to pickup'
            : state === 'in_ride'
            ? 'Ride in progress'
            : 'Waiting for ride';

    const shareOverlay = async () => {
        try {
            const url = await getOverlayUrl();
            await Share.share({
                message: `Live rideshare map: ${url}`,
                title: 'Live rideshare map'
            });
        } catch (err) {
            Alert.alert('Share failed', err instanceof Error ? err.message : 'Could not share link');
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Shift Active</Text>
                <Text style={styles.subtitle}>{rideStatusLabel}</Text>

                <View style={styles.mapContainer}>
                    <MapboxGL.MapView
                        style={styles.map}
                        styleURL="https://demotiles.maplibre.org/style.json"
                    >
                        <MapboxGL.Camera zoomLevel={12} centerCoordinate={[-122.4194, 37.7749]} />
                    </MapboxGL.MapView>
                </View>

                <View style={styles.statsRow}>
                    <StatCard label="Rides" value={stats.rides.toString()} subtitle="This shift" />
                    <StatCard
                        label="Earnings"
                        value={`$${(stats.earnings / 100).toFixed(2)}`}
                        subtitle={`Tips $${(stats.tips / 100).toFixed(2)}`}
                    />
                </View>
                <View style={styles.statsRow}>
                    <StatCard
                        label="$ / hr"
                        value={`$${stats.ratePerHour.toFixed(2)}`}
                        subtitle={`Duration ${(stats.duration / 3600).toFixed(1)}h`}
                    />
                    <StatCard
                        label="Distance"
                        value={`${stats.distance.toFixed(1)} mi`}
                        subtitle="Tracked"
                    />
                </View>

                <View style={styles.actions}>
                    <Button title="Share live overlay" onPress={shareOverlay} variant="secondary" />
                    {state === 'shift_active' && (
                        <Button title="Start Ride" onPress={onStartRide} loading={loading} />
                    )}
                    {state === 'en_route' && (
                        <Button title="Rider Picked Up" onPress={onPickup} loading={loading} />
                    )}
                    {state === 'in_ride' && (
                        <>
                            <Button
                                title="End Ride"
                                onPress={() => setShowSummary(true)}
                                loading={loading}
                                variant="primary"
                            />
                            <Button
                                title="Add Tip"
                                onPress={() => setShowTip(true)}
                                loading={loading}
                                variant="secondary"
                            />
                        </>
                    )}
                    {state === 'shift_active' && lastRide && (
                        <Button
                            title="Add Tip to Last Ride"
                            onPress={() => setShowTip(true)}
                            loading={loading}
                            variant="secondary"
                        />
                    )}
                    <Button
                        title="End Shift"
                        onPress={onEndShift}
                        loading={loading}
                        variant="secondary"
                        style={{ marginTop: 12 }}
                    />
                </View>
            </ScrollView>

            <RideSummaryModal
                visible={showSummary}
                onCancel={() => setShowSummary(false)}
                onSubmit={(fare) => {
                    setShowSummary(false);
                    onEndRide(fare);
                }}
            />

            {showTip && (
                <RideSummaryModal
                    visible={showTip}
                    onCancel={() => {
                        setTipValue('');
                        setShowTip(false);
                    }}
                    onSubmit={(cents) => {
                        setTipValue('');
                        setShowTip(false);
                        onAddTip(cents);
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#060B16',
    },
    scroll: {
        padding: 16,
        paddingBottom: 32,
    },
    title: {
        color: '#F9FAFB',
        fontSize: 24,
        fontWeight: '800',
    },
    subtitle: {
        color: '#9CA3AF',
        marginBottom: 12,
    },
    mapContainer: {
        height: 220,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#111827',
        marginBottom: 16,
    },
    map: {
        flex: 1,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    actions: {
        marginTop: 12,
        gap: 12,
    },
});

export default ActiveShiftScreen;
