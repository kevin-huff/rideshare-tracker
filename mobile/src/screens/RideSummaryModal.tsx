import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../components/Button';

interface Props {
    visible: boolean;
    onSubmit: (fareCents: number) => void;
    onCancel: () => void;
}

export function RideSummaryModal({ visible, onSubmit, onCancel }: Props) {
    const [fare, setFare] = useState<string>('');

    const handleSubmit = () => {
        const value = parseFloat(fare);
        if (isNaN(value) || value < 0) {
            return;
        }
        onSubmit(Math.round(value * 100));
        setFare('');
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>End Ride</Text>
                    <Text style={styles.subtitle}>Enter fare amount</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="$0.00"
                        placeholderTextColor="#6B7280"
                        keyboardType="decimal-pad"
                        value={fare}
                        onChangeText={setFare}
                    />
                    <Button title="Submit" onPress={handleSubmit} />
                    <Button title="Cancel" onPress={onCancel} variant="secondary" style={{ marginTop: 8 }} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#0B1220',
        width: '100%',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#111827',
    },
    title: {
        color: '#F9FAFB',
        fontSize: 20,
        fontWeight: '800',
    },
    subtitle: {
        color: '#9CA3AF',
        marginTop: 4,
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#111827',
        color: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#1F2937',
        marginBottom: 12,
    },
});

export default RideSummaryModal;
