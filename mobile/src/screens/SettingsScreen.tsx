import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../components/Button';
import { getApiBaseUrl, setApiBaseUrl, getDeviceToken, setDeviceToken } from '../api/client';

interface Props {
    onClose: () => void;
}

export function SettingsScreen({ onClose }: Props) {
    const [apiUrl, setApiUrl] = useState('');
    const [deviceToken, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const url = await getApiBaseUrl().catch(() => '');
                const token = await getDeviceToken().catch(() => '');
                setApiUrl(url);
                setToken(token);
            } catch (err) {
                // ignore
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            if (apiUrl.trim().length === 0) throw new Error('API URL required');
            if (!apiUrl.startsWith('http')) throw new Error('API URL must start with http:// or https://');
            if (deviceToken.trim().length === 0) throw new Error('Device token required');
            await setApiBaseUrl(apiUrl.trim());
            await setDeviceToken(deviceToken.trim());
            Alert.alert('Saved', 'Settings updated');
            onClose();
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.label}>API Base URL</Text>
            <TextInput
                style={styles.input}
                placeholder="https://api.example.com"
                placeholderTextColor="#6B7280"
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <Text style={styles.hint}>Example: https://your-server.com or http://192.168.1.100:3000</Text>
            <Text style={styles.label}>Device Token</Text>
            <TextInput
                style={styles.input}
                placeholder="Device token"
                placeholderTextColor="#6B7280"
                value={deviceToken}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <Button title="Save" onPress={handleSave} loading={loading} />
            <Button title="Close" onPress={onClose} variant="secondary" style={{ marginTop: 8 }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#060B16',
        padding: 24,
    },
    title: {
        color: '#F9FAFB',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 16,
    },
    label: {
        color: '#9CA3AF',
        marginTop: 12,
        marginBottom: 6,
        fontSize: 13,
    },
    input: {
        backgroundColor: '#0B1220',
        color: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#1F2937',
    },
    hint: {
        color: '#6B7280',
        fontSize: 12,
        marginTop: 4,
    },
});

export default SettingsScreen;
