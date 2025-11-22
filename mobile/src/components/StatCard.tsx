import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatCardProps } from '../types';

export function StatCard({ label, value, subtitle }: StatCardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#0B1220',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1F2937',
        flex: 1,
    },
    label: {
        color: '#9CA3AF',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
    },
    value: {
        color: '#F9FAFB',
        fontSize: 32,
        fontWeight: '800',
    },
    subtitle: {
        color: '#9CA3AF',
        marginTop: 6,
        fontSize: 13,
    },
});

export default StatCard;
