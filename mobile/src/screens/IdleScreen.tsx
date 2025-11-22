import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { ShiftStats } from '../types';

interface Props {
    onStartShift: () => void;
    loading: boolean;
    lastShift?: ShiftStats | null;
}

export function IdleScreen({ onStartShift, loading, lastShift }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ready to drive</Text>
            <Text style={styles.subtitle}>Start your shift to begin tracking rides and earnings.</Text>

            <Button title="Start Shift" onPress={onStartShift} loading={loading} />

            {lastShift ? (
                <View style={styles.summary}>
                    <Text style={styles.summaryTitle}>Previous shift</Text>
                    <Text style={styles.summaryText}>Rides: {lastShift.rides}</Text>
                    <Text style={styles.summaryText}>
                        Earnings: ${(lastShift.earnings / 100).toFixed(2)} • Tips: $
                        {(lastShift.tips / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.summaryText}>Distance: {lastShift.distance.toFixed(1)} mi</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#060B16',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: '#F9FAFB',
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
    },
    summary: {
        marginTop: 24,
        backgroundColor: '#0B1220',
        padding: 16,
        borderRadius: 14,
        width: '100%',
        borderWidth: 1,
        borderColor: '#111827',
    },
    summaryTitle: {
        color: '#E5E7EB',
        fontWeight: '700',
        marginBottom: 6,
        fontSize: 16,
    },
    summaryText: {
        color: '#9CA3AF',
        marginBottom: 2,
    },
});

export default IdleScreen;
