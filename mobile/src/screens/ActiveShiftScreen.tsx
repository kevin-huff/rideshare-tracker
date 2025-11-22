import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import StatCard from '../components/StatCard';
import RideSummaryModal from './RideSummaryModal';
import { AppStateType, ShiftStats } from '../types';

interface Props {
    state: AppStateType;
    stats: ShiftStats;
    onStartRide: () => void;
    onPickup: () => void;
    onEndRide: (fareCents: number) => void;
    onAddTip: (tipCents: number) => void;
    onEndShift: () => void;
    loading: boolean;
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
}: Props) {
    const [showSummary, setShowSummary] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const [tipValue, setTipValue] = useState('');

    const rideStatusLabel =
        state === 'en_route'
            ? 'En route to pickup'
            : state === 'in_ride'
            ? 'Ride in progress'
            : 'Waiting for ride';

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Shift Active</Text>
                <Text style={styles.subtitle}>{rideStatusLabel}</Text>

                <View style={styles.mapPlaceholder}>
                    <Text style={styles.mapText}>Map placeholder</Text>
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
    mapPlaceholder: {
        backgroundColor: '#0B1220',
        borderRadius: 16,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#111827',
        marginBottom: 16,
    },
    mapText: {
        color: '#6B7280',
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
