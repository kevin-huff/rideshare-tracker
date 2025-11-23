import React from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { ShiftStats } from '../types';
import { getOverlayUrl } from '../api/client';
import { useTheme, Theme } from '../theme';

interface Props {
    onStartShift: () => void;
    loading: boolean;
    lastShift?: ShiftStats | null;
    onAddExpense?: () => void;
}

export function IdleScreen({ onStartShift, loading, lastShift, onAddExpense }: Props) {
    const { theme } = useTheme();
    const styles = getStyles(theme);

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
            <Text style={styles.title}>Ready to drive</Text>
            <Text style={styles.subtitle}>Start your shift to begin tracking rides and earnings.</Text>

            <Button title="Start Shift" onPress={onStartShift} loading={loading} />
            <Button
                title="Share live overlay"
                onPress={shareOverlay}
                variant="secondary"
                style={{ marginTop: 12, width: '100%' }}
            />
            {onAddExpense ? (
                <Button
                    title="Log Expense"
                    onPress={onAddExpense}
                    variant="secondary"
                    style={{ marginTop: 12, width: '100%' }}
                />
            ) : null}

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

const getStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: theme.text,
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        color: theme.muted,
        textAlign: 'center',
        marginBottom: 24,
    },
    summary: {
        marginTop: 24,
        backgroundColor: theme.surface,
        padding: 16,
        borderRadius: 14,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.border,
    },
    summaryTitle: {
        color: theme.text,
        fontWeight: '700',
        marginBottom: 6,
        fontSize: 16,
    },
    summaryText: {
        color: theme.muted,
        marginBottom: 2,
    },
});

export default IdleScreen;
