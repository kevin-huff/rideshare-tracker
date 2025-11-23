import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme, Theme } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

const getVariantStyles = (variant: Variant, theme: Theme) => {
    const variants: Record<Variant, { backgroundColor: string; textColor: string }> = {
        primary: { backgroundColor: theme.accent, textColor: theme.accentText },
        secondary: { backgroundColor: theme.surfaceAlt, textColor: theme.text },
        danger: { backgroundColor: theme.danger, textColor: '#fff' },
    };
    return variants[variant];
};

interface Props {
    title: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    variant?: Variant;
    style?: ViewStyle;
}

export function Button({ title, onPress, disabled, loading, variant = 'primary', style }: Props) {
    const { theme } = useTheme();
    const colors = getVariantStyles(variant, theme);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                {
                    backgroundColor: colors.backgroundColor,
                    opacity: pressed ? 0.85 : 1,
                    shadowColor: theme.isDark ? '#000' : '#111',
                },
                disabled ? styles.disabled : null,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={colors.textColor} />
            ) : (
                <Text style={[styles.text, { color: colors.textColor }]}>{title}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});

export default Button;
