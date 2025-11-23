import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, Switch, TouchableOpacity } from 'react-native';
import Button from '../components/Button';
import {
    getApiBaseUrl,
    setApiBaseUrl,
    getDeviceToken,
    setDeviceToken,
    fetchSettings,
    updateSettings,
} from '../api/client';
import { useTheme, Theme, themeOptions } from '../theme';
import { ThemeName } from '../types';

interface Props {
    onClose: () => void;
}

export function SettingsScreen({ onClose }: Props) {
    const [apiUrl, setApiUrl] = useState('');
    const [deviceToken, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [privacyRadius, setPrivacyRadius] = useState('0');
    const [hideLocation, setHideLocation] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState<ThemeName>('midnight');
    const { theme, setTheme, name: currentTheme } = useTheme();
    const styles = getStyles(theme);

    useEffect(() => {
        const load = async () => {
            try {
                const url = await getApiBaseUrl().catch(() => '');
                const token = await getDeviceToken().catch(() => '');
                setApiUrl(url);
                setToken(token);
                setSelectedTheme(currentTheme);

                if (url && token) {
                    try {
                        const serverSettings = await fetchSettings();
                        setPrivacyRadius(serverSettings.overlay_privacy_radius_m.toString());
                        setHideLocation(serverSettings.overlay_hide_location);
                        if (serverSettings.overlay_theme) {
                            setSelectedTheme(serverSettings.overlay_theme as ThemeName);
                            await setTheme(serverSettings.overlay_theme as ThemeName);
                        }
                    } catch (err) {
                        console.warn('[Settings] Unable to fetch server settings', err);
                    }
                }
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
            const radiusValue = parseInt(privacyRadius, 10);
            if (isNaN(radiusValue) || radiusValue < 0) {
                throw new Error('Privacy radius must be a positive number (meters)');
            }
            await setApiBaseUrl(apiUrl.trim());
            await setDeviceToken(deviceToken.trim());
            await updateSettings({
                overlay_privacy_radius_m: radiusValue,
                overlay_hide_location: hideLocation,
                overlay_theme: selectedTheme,
            });
            await setTheme(selectedTheme);
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
                placeholderTextColor={theme.muted}
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
                placeholderTextColor={theme.muted}
                value={deviceToken}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <View style={styles.section}>
                <Text style={styles.label}>Privacy</Text>
                <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Hide location on overlay</Text>
                    <Switch
                        value={hideLocation}
                        onValueChange={setHideLocation}
                        trackColor={{ true: theme.accent, false: theme.border }}
                        thumbColor={hideLocation ? theme.accent : theme.surfaceAlt}
                    />
                </View>
                <Text style={styles.label}>Redaction radius (meters)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.muted}
                    keyboardType="numeric"
                    value={privacyRadius}
                    onChangeText={setPrivacyRadius}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Overlay & App Theme</Text>
                <View style={styles.themeRow}>
                    {themeOptions.map((option) => (
                        <TouchableOpacity
                            key={option}
                            onPress={() => setSelectedTheme(option as ThemeName)}
                            style={[
                                styles.themePill,
                                selectedTheme === option && { borderColor: theme.accent, backgroundColor: theme.surfaceAlt },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.themeText,
                                    selectedTheme === option && { color: theme.accent },
                                ]}
                            >
                                {option}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <Button title="Save" onPress={handleSave} loading={loading} />
            <Button title="Close" onPress={onClose} variant="secondary" style={{ marginTop: 8 }} />
        </View>
    );
}

const getStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
        padding: 24,
    },
    title: {
        color: theme.text,
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 16,
    },
    label: {
        color: theme.muted,
        marginTop: 12,
        marginBottom: 6,
        fontSize: 13,
    },
    input: {
        backgroundColor: theme.inputBackground,
        color: theme.text,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: theme.border,
    },
    hint: {
        color: theme.muted,
        fontSize: 12,
        marginTop: 4,
    },
    section: {
        marginTop: 12,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    switchLabel: {
        color: theme.text,
        fontSize: 14,
    },
    themeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    themePill: {
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    themeText: {
        color: theme.text,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
});

export default SettingsScreen;
