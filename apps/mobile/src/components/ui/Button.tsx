import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { THEME_COLORS } from '../../constants/config';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', loading, disabled, style,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={variant === 'outline' ? THEME_COLORS.primary : '#fff'} />
        : <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>{label}</Text>
      }
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primary: { backgroundColor: THEME_COLORS.primary },
  secondary: { backgroundColor: THEME_COLORS.secondary },
  danger: { backgroundColor: THEME_COLORS.error },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: THEME_COLORS.primary,
  },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
  outlineText: { color: THEME_COLORS.primary },
});
