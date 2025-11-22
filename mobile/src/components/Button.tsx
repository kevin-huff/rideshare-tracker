import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';

const VARIANT_STYLES: Record<Variant, { backgroundColor: string; textColor: string }> = {
    primary: { backgroundColor: '#111827', textColor: '#F9FAFB' },
    secondary: { backgroundColor: '#1F2937', textColor: '#E5E7EB' },
    danger: { backgroundColor: '#7F1D1D', textColor: '#FEE2E2' },
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
    const colors = VARIANT_STYLES[variant];

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                { backgroundColor: colors.backgroundColor, opacity: pressed ? 0.85 : 1 },
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
