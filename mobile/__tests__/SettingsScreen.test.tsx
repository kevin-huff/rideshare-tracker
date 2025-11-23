import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { ThemeProvider } from '../src/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mocks
jest.mock('../src/api/client', () => ({
    getApiBaseUrl: jest.fn(() => Promise.resolve('https://api.test.com')),
    setApiBaseUrl: jest.fn(() => Promise.resolve()),
    getDeviceToken: jest.fn(() => Promise.resolve('test-token')),
    setDeviceToken: jest.fn(() => Promise.resolve()),
    fetchSettings: jest.fn(() => Promise.resolve({
        overlay_privacy_radius_m: 100,
        overlay_hide_location: false,
        overlay_theme: 'midnight',
    })),
    updateSettings: jest.fn(() => Promise.resolve()),
}));

const mockOnClose = jest.fn();

describe('SettingsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads and displays current settings', async () => {
        const { getByPlaceholderText, getByDisplayValue } = render(
            <ThemeProvider>
                <SettingsScreen onClose={mockOnClose} />
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(getByDisplayValue('https://api.test.com')).toBeTruthy();
            expect(getByDisplayValue('test-token')).toBeTruthy();
            expect(getByDisplayValue('100')).toBeTruthy();
        });
    });

    it('updates settings on save', async () => {
        const { getByText, getByPlaceholderText } = render(
            <ThemeProvider>
                <SettingsScreen onClose={mockOnClose} />
            </ThemeProvider>
        );

        // Wait for load
        await waitFor(() => getByPlaceholderText('https://api.example.com'));

        // Change values
        fireEvent.changeText(getByPlaceholderText('https://api.example.com'), 'https://new-api.com');
        fireEvent.changeText(getByPlaceholderText('0'), '500');

        fireEvent.press(getByText('Save'));

        await waitFor(() => {
            const { updateSettings, setApiBaseUrl } = require('../src/api/client');
            expect(setApiBaseUrl).toHaveBeenCalledWith('https://new-api.com');
            expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
                overlay_privacy_radius_m: 500,
            }));
        });
    });
});
