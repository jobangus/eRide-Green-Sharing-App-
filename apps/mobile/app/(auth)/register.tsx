import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS, API_BASE_URL } from '../../src/constants/config';
import { MoRideApiClient } from '../../../packages/shared/src';

const api = new MoRideApiClient(API_BASE_URL);

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'rider' | 'driver' | 'both'>('rider');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.endsWith('@monash.edu')) e.email = 'Must be a @monash.edu email';
    if (password.length < 8) e.password = 'Min 8 characters';
    if (!/[A-Z]/.test(password)) e.password = 'Must contain uppercase letter';
    if (!/[0-9]/.test(password)) e.password = 'Must contain a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.register({ email: email.toLowerCase().trim(), password, name, phone: phone || undefined, role });
      router.push({ pathname: '/(auth)/verify-otp', params: { email: email.toLowerCase().trim(), devOtp: res.otp } });
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the Monash ride-sharing community.</Text>

        <Input label="Full Name" value={name} onChangeText={setName} placeholder="Jane Smith" error={errors.name} />
        <Input label="Monash Email" value={email} onChangeText={setEmail} placeholder="jane@monash.edu"
          keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <Input label="Password" value={password} onChangeText={setPassword} placeholder="Min 8 chars, 1 uppercase, 1 number"
          secureTextEntry error={errors.password} />
        <Input label="Phone (optional)" value={phone} onChangeText={setPhone}
          placeholder="+61400000000" keyboardType="phone-pad" />

        <Text style={styles.roleLabel}>I want to:</Text>
        <View style={styles.roleRow}>
          {(['rider', 'driver', 'both'] as const).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                {r === 'rider' ? '🙋 Ride' : r === 'driver' ? '🚗 Drive' : '🔄 Both'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button label="Create Account" onPress={handleRegister} loading={loading} style={styles.btn} />

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLink}>Already have an account? <Text style={styles.linkBold}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME_COLORS.background },
  container: { padding: 24, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: THEME_COLORS.primary, fontSize: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: THEME_COLORS.subtext, marginBottom: 24 },
  roleLabel: { fontSize: 14, fontWeight: '600', color: THEME_COLORS.text, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  roleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: THEME_COLORS.border, alignItems: 'center',
  },
  roleBtnActive: { backgroundColor: THEME_COLORS.primary, borderColor: THEME_COLORS.primary },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: THEME_COLORS.subtext },
  roleBtnTextActive: { color: '#fff' },
  btn: { marginTop: 8 },
  loginLink: { textAlign: 'center', marginTop: 16, color: THEME_COLORS.subtext, fontSize: 14 },
  linkBold: { color: THEME_COLORS.primary, fontWeight: '700' },
});
