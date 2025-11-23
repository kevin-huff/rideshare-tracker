import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatCardProps } from '../types';
import { useTheme, Theme } from '../theme';

export function StatCard({ label, value, subtitle }: StatCardProps) {
    const { theme } = useTheme();
    const styles = getStyles(theme);

    return (
        <View style={styles.card}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
    );
}

const getStyles = (theme: Theme) => StyleSheet.create({
    card: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.border,
        flex: 1,
    },
    label: {
        color: theme.muted,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
    },
    value: {
        color: theme.text,
        fontSize: 32,
        fontWeight: '800',
    },
    subtitle: {
        color: theme.muted,
        marginTop: 6,
        fontSize: 13,
    },
});

export default StatCard;
