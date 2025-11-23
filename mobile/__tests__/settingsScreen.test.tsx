jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import SettingsScreen from '../src/screens/SettingsScreen';
import * as client from '../src/api/client';
import { ThemeProvider } from '../src/theme';

jest.mock('../src/api/client', () => ({
    getApiBaseUrl: jest.fn(() => Promise.resolve('https://api.example.com')),
    setApiBaseUrl: jest.fn(),
    getDeviceToken: jest.fn(() => Promise.resolve('device-token')),
    setDeviceToken: jest.fn(),
    fetchSettings: jest.fn(() => Promise.resolve({
        overlay_privacy_radius_m: 100,
        overlay_hide_location: false,
        overlay_theme: 'midnight',
    })),
    updateSettings: jest.fn(() => Promise.resolve({
        overlay_privacy_radius_m: 100,
        overlay_hide_location: false,
        overlay_theme: 'midnight',
    })),
}));

describe('SettingsScreen', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    beforeEach(() => {
        alertSpy.mockClear();
    });

    it('loads stored settings and saves new values', async () => {
        const onClose = jest.fn();
        let tree: any;
        await act(async () => {
            tree = TestRenderer.create(
                <ThemeProvider>
                    <SettingsScreen onClose={onClose} />
                </ThemeProvider>
            );
        });

        const inputs = tree.root.findAllByType('TextInput');
        expect(inputs[0].props.value).toBe('https://api.example.com');
        expect(inputs[1].props.value).toBe('device-token');
        expect(inputs[2].props.value).toBe('100');

        await act(async () => {
            inputs[0].props.onChangeText('https://prod.example.com');
            inputs[1].props.onChangeText('new-token');
            inputs[2].props.onChangeText('250');
        });

        const buttons = tree.root.findAllByProps({ title: 'Save' });
        await act(async () => {
            buttons[0].props.onPress();
        });

        expect(client.setApiBaseUrl).toHaveBeenCalledWith('https://prod.example.com');
        expect(client.setDeviceToken).toHaveBeenCalledWith('new-token');
        expect(onClose).toHaveBeenCalled();
        expect(client.updateSettings).toHaveBeenCalledWith({
            overlay_privacy_radius_m: 250,
            overlay_hide_location: false,
            overlay_theme: 'midnight',
        });
    });

    it('shows validation error for bad URL', async () => {
        const onClose = jest.fn();
        let tree: any;
        await act(async () => {
            tree = TestRenderer.create(
                <ThemeProvider>
                    <SettingsScreen onClose={onClose} />
                </ThemeProvider>
            );
        });

        const inputs = tree.root.findAllByType('TextInput');
        await act(async () => {
            inputs[0].props.onChangeText('ftp://invalid');
            inputs[1].props.onChangeText('tok');
        });

        const buttons = tree.root.findAllByProps({ title: 'Save' });
        await act(async () => {
            buttons[0].props.onPress();
        });

        expect(alertSpy).toHaveBeenCalledWith('Error', 'API URL must start with http:// or https://');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('shows validation error for empty token', async () => {
        const onClose = jest.fn();
        let tree: any;
        await act(async () => {
            tree = TestRenderer.create(
                <ThemeProvider>
                    <SettingsScreen onClose={onClose} />
                </ThemeProvider>
            );
        });

        const inputs = tree.root.findAllByType('TextInput');
        await act(async () => {
            inputs[0].props.onChangeText('https://api.example.com');
            inputs[1].props.onChangeText('');
        });

        const buttons = tree.root.findAllByProps({ title: 'Save' });
        await act(async () => {
            buttons[0].props.onPress();
        });

        expect(alertSpy).toHaveBeenCalledWith('Error', 'Device token required');
        expect(onClose).not.toHaveBeenCalled();
    });
});
