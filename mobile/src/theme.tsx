import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName } from './types';

export interface Theme {
    name: ThemeName;
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    danger: string;
    success: string;
    inputBackground: string;
    isDark: boolean;
}

export const themes: Record<ThemeName, Theme> = {
    midnight: {
        name: 'midnight',
        background: '#060B16',
        surface: '#0B1220',
        surfaceAlt: '#111827',
        border: '#1F2937',
        text: '#F9FAFB',
        muted: '#9CA3AF',
        accent: '#7dd3fc',
        accentText: '#041017',
        danger: '#b91c1c',
        success: '#22c55e',
        inputBackground: '#0F172A',
        isDark: true,
    },
    ember: {
        name: 'ember',
        background: '#1b0f08',
        surface: '#2a120d',
        surfaceAlt: '#3b1b12',
        border: '#4b1f14',
        text: '#ffedd5',
        muted: '#f4b17a',
        accent: '#f97316',
        accentText: '#2b0a02',
        danger: '#e11d48',
        success: '#f59e0b',
        inputBackground: '#3a1a12',
        isDark: true,
    },
    glacier: {
        name: 'glacier',
        background: '#0b1220',
        surface: '#0f172a',
        surfaceAlt: '#111827',
        border: '#1f2937',
        text: '#e0f2fe',
        muted: '#9ca3af',
        accent: '#67e8f9',
        accentText: '#072f49',
        danger: '#fb7185',
        success: '#34d399',
        inputBackground: '#0b1220',
        isDark: true,
    },
};

interface ThemeContextValue {
    theme: Theme;
    name: ThemeName;
    setTheme: (name: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: themes.midnight,
    name: 'midnight',
    setTheme: async () => {},
});

const STORAGE_KEY = '@theme_preference';

function isThemeName(value: string): value is ThemeName {
    return value in themes;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [name, setName] = useState<ThemeName>('midnight');

    useEffect(() => {
        (async () => {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored && isThemeName(stored)) {
                setName(stored);
            }
        })();
    }, []);

    const setTheme = useCallback(async (next: ThemeName) => {
        setName(next);
        await AsyncStorage.setItem(STORAGE_KEY, next);
    }, []);

    const value = useMemo(
        () => ({
            theme: themes[name],
            name,
            setTheme,
        }),
        [name, setTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}

export const themeOptions: ThemeName[] = ['midnight', 'ember', 'glacier'];
