import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
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
  LeftIcon?: React.ComponentType<any>;
  RightIcon?: React.ComponentType<any>;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  error,
  autoCapitalize,
  LeftIcon,
  RightIcon,
  onRightIconPress,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = !!secureTextEntry;

  const handleRightPress = () => {
    if (onRightIconPress) {
      onRightIconPress();
    } else if (isPassword) {
      setShowPassword((s) => !s);
    }
  };

  const ResolvedRightIcon =
    RightIcon ?? (isPassword ? (showPassword ? EyeOff : Eye) : undefined);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputWrapper, error ? styles.errorBorder : styles.normalBorder]}>
        {LeftIcon ? (
          <View style={styles.leftIconWrap}>
            <LeftIcon size={18} color={THEME_COLORS.subtext} />
          </View>
        ) : null}

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

        {ResolvedRightIcon ? (
          <TouchableOpacity
            onPress={handleRightPress}
            style={styles.rightIconWrap}
            activeOpacity={0.7}
          >
            <ResolvedRightIcon size={18} color={THEME_COLORS.subtext} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    minHeight: 56,
  },

  normalBorder: {
    borderColor: '#E5E7EB',
  },

  errorBorder: {
    borderColor: THEME_COLORS.error,
  },

  leftIconWrap: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: THEME_COLORS.text,
    paddingVertical: 14,
  },

  rightIconWrap: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorText: {
    color: THEME_COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
});