import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { ShiftStats } from '../types';
import { useTheme, Theme } from '../theme';

interface Props {
    stats: ShiftStats;
    onClose: () => void;
}

export function ShiftSummaryScreen({ stats, onClose }: Props) {
    const { theme } = useTheme();
    const styles = getStyles(theme);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Shift Complete</Text>
            <View style={styles.card}>
                <Row label="Rides" value={stats.rides.toString()} />
                <Row label="Earnings" value={`$${(stats.earnings / 100).toFixed(2)}`} />
                <Row label="Tips" value={`$${(stats.tips / 100).toFixed(2)}`} />
                <Row label="Distance" value={`${stats.distance.toFixed(1)} mi`} />
                <Row label="Duration" value={`${(stats.duration / 3600).toFixed(1)} hrs`} />
                <Row label="$ / hr" value={`$${stats.ratePerHour.toFixed(2)}`} />
            </View>
            <Button title="Back to Home" onPress={onClose} />
        </View>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    const { theme } = useTheme();
    const styles = getStyles(theme);
    return (
        <View style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </View>
    );
}

const getStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        color: theme.text,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
    },
    card: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    label: {
        color: theme.muted,
    },
    value: {
        color: theme.text,
        fontWeight: '700',
    },
});

export default ShiftSummaryScreen;
