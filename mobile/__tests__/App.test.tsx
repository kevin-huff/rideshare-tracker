/**
 * @format
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'ACCESS_COARSE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'ACCESS_BACKGROUND_LOCATION',
      POST_NOTIFICATIONS: 'POST_NOTIFICATIONS',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    LIMITED: 'limited',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  requestMultiple: jest.fn(() =>
    Promise.resolve({
      ACCESS_FINE_LOCATION: 'granted',
      ACCESS_COARSE_LOCATION: 'granted',
      ACCESS_BACKGROUND_LOCATION: 'granted',
      POST_NOTIFICATIONS: 'granted',
    })
  ),
}));

jest.mock('../src/context/AppContext', () => {
  const ctx = {
    state: 'idle',
    stats: { rides: 0, earnings: 0, tips: 0, duration: 0, ratePerHour: 0, distance: 0 },
    startShift: jest.fn(),
    startRide: jest.fn(),
    markPickup: jest.fn(),
    endRide: jest.fn(),
    endShift: jest.fn(),
    resetToIdle: jest.fn(),
    addTip: jest.fn(),
    isLoading: false,
    error: null,
    clearError: jest.fn(),
  };
  return {
    AppProvider: ({ children }: any) => children,
    useAppContext: () => ctx,
  };
});

jest.mock('../src/theme', () => {
  const theme = {
    name: 'midnight',
    theme: {
      name: 'midnight',
      background: '#000',
      surface: '#000',
      surfaceAlt: '#000',
      border: '#000',
      text: '#fff',
      muted: '#aaa',
      accent: '#fff',
      accentText: '#000',
      danger: '#f00',
      success: '#0f0',
      inputBackground: '#000',
      isDark: true,
    },
    setTheme: jest.fn(),
  };
  return {
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => theme,
    themes: {},
    themeOptions: ['midnight'],
  };
});

jest.mock('../src/screens/IdleScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/ActiveShiftScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/ShiftSummaryScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/SettingsScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/ExpensesScreen', () => ({ __esModule: true, default: () => null }));

import 'react-native';
import React from 'react';
import App from '../App';
// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

it('renders correctly', async () => {
  await act(async () => {
    renderer.create(<App />);
  });
});
