import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS, API_BASE_URL } from '../../src/constants/config';
import { MoRideApiClient } from '../../../packages/shared/src';

const api = new MoRideApiClient(API_BASE_URL);

export default function VerifyOtpScreen() {
  const { email, devOtp } = useLocalSearchParams<{ email: string; devOtp?: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  // In dev mode, auto-fill OTP
  useEffect(() => {
    if (devOtp && devOtp.length === 6) {
      const chars = devOtp.split('');
      setOtp(chars);
    }
  }, [devOtp]);

  const handleChange = (val: string, index: number) => {
    const digits = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < 5) inputs.current[index + 1]?.focus();
    if (!digits && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) { Alert.alert('Invalid', 'Please enter all 6 digits'); return; }
    setLoading(true);
    try {
      await api.verifyOtp({ email: email!, otp: code });
      Alert.alert('Success!', 'Email verified. Please log in.', [
        { text: 'Log In', onPress: () => router.replace('/(auth)/login') }
      ]);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.emoji}>✉️</Text>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}<Text style={styles.email}>{email}</Text>
        </Text>
        {devOtp && (
          <View style={styles.devBanner}>
            <Text style={styles.devText}>🛠 Dev mode: OTP auto-filled ({devOtp})</Text>
          </View>
        )}

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r; }}
              style={[styles.otpInput, digit ? styles.otpFilled : null]}
              value={digit}
              onChangeText={v => handleChange(v, i)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        <Button label="Verify Email" onPress={handleVerify} loading={loading} style={styles.btn} />

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Go back and re-register</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME_COLORS.background },
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: THEME_COLORS.subtext, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  email: { color: THEME_COLORS.primary, fontWeight: '700' },
  devBanner: { backgroundColor: '#FFF9C4', padding: 10, borderRadius: 8, marginBottom: 16, width: '100%' },
  devText: { color: '#F57F17', fontSize: 13 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  otpInput: {
    width: 48, height: 56, borderWidth: 2, borderColor: THEME_COLORS.border,
    borderRadius: 10, fontSize: 24, fontWeight: 'bold', backgroundColor: '#fff',
  },
  otpFilled: { borderColor: THEME_COLORS.primary },
  btn: { width: '100%', marginBottom: 16 },
  back: { color: THEME_COLORS.subtext, fontSize: 14 },
});
