import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS } from '../../src/constants/config';
import { useAuth } from '../../src/store/auth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password'); return; }
    setLoading(true);
    try {
      await login(email.toLowerCase().trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
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

        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your Mo-Ride account.</Text>

        <Input label="Monash Email" value={email} onChangeText={setEmail}
          placeholder="you@monash.edu" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={password} onChangeText={setPassword}
          placeholder="Your password" secureTextEntry />

        <Button label="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

        <View style={styles.divider}><Text style={styles.dividerText}>or</Text></View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.link}>Don't have an account? <Text style={styles.linkBold}>Sign up</Text></Text>
        </TouchableOpacity>

        <View style={styles.devHint}>
          <Text style={styles.devText}>Dev seed accounts (Password123!):</Text>
          {['alice.driver@monash.edu', 'carol.rider@monash.edu'].map(e => (
            <TouchableOpacity key={e} onPress={() => { setEmail(e); setPassword('Password123!'); }}>
              <Text style={styles.devEmail}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME_COLORS.background },
  container: { padding: 24, paddingBottom: 40 },
  back: { marginBottom: 8 },
  backText: { color: THEME_COLORS.primary, fontSize: 16 },
  emoji: { fontSize: 48, marginVertical: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 4 },
  subtitle: { color: THEME_COLORS.subtext, fontSize: 15, marginBottom: 24 },
  btn: { marginTop: 8 },
  divider: { alignItems: 'center', marginVertical: 16 },
  dividerText: { color: THEME_COLORS.subtext },
  link: { textAlign: 'center', color: THEME_COLORS.subtext, fontSize: 14 },
  linkBold: { color: THEME_COLORS.primary, fontWeight: '700' },
  devHint: { marginTop: 32, backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8 },
  devText: { fontSize: 12, color: THEME_COLORS.subtext, marginBottom: 4 },
  devEmail: { color: THEME_COLORS.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
});
