import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME_COLORS } from '../../constants/config';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  error?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}

export const Input: React.FC<InputProps> = ({
  label, value, onChangeText, placeholder, secureTextEntry,
  keyboardType = 'default', error, autoCapitalize,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.errorBorder : styles.normalBorder]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={THEME_COLORS.subtext}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? (isPassword ? 'none' : 'sentences')}
          autoCorrect={false}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: THEME_COLORS.text, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  normalBorder: { borderColor: THEME_COLORS.border },
  errorBorder: { borderColor: THEME_COLORS.error },
  input: { flex: 1, height: 48, fontSize: 16, color: THEME_COLORS.text },
  eyeBtn: { padding: 4 },
  eyeText: { fontSize: 18 },
  errorText: { color: THEME_COLORS.error, fontSize: 12, marginTop: 4 },
});
