import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS } from '../../src/constants/config';
import { useAuth } from '../../src/store/auth';
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react-native';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

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

  const fillDevAccount = (devEmail: string) => {
    setEmail(devEmail);
    setPassword('Password123!');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          activeOpacity={0.8}
        >
          <ArrowLeft size={22} color="#2E7D32" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to your Mo-Ride account
        </Text>

        <Input
          label="Monash Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@monash.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          LeftIcon={Mail}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry={!showPassword}
          LeftIcon={Lock}
          RightIcon={showPassword ? EyeOff : Eye}
          onRightIconPress={() => setShowPassword(!showPassword)}
        />

        <Button
          label="Sign In"
          onPress={handleLogin}
          loading={loading}
          style={styles.btn}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don&apos;t have an account?</Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.signupAction}>Sign up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.devHint}>
          <Text style={styles.devTitle}>Dev seed accounts</Text>
          <Text style={styles.devSubtitle}>Password: Password123!</Text>

          <TouchableOpacity
            onPress={() => fillDevAccount('alice.driver@monash.edu')}
            activeOpacity={0.8}
          >
            <Text style={styles.devEmail}>alice.driver@monash.edu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => fillDevAccount('carol.rider@monash.edu')}
            activeOpacity={0.8}
          >
            <Text style={styles.devEmail}>carol.rider@monash.edu</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  container: {
    padding: 24,
    paddingBottom: 40,
  },

  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 28,
    gap: 6,
  },

  backText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '500',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 28,
  },

  btn: {
    marginTop: 12,
    backgroundColor: '#34A853',
    borderRadius: 14,
    shadowColor: '#34A853',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 22,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },

  signupText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },

  signupAction: {
    fontSize: 14,
    color: '#34A853',
    fontWeight: '700',
  },

  devHint: {
    marginTop: 28,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
  },

  devTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2F5D34',
    marginBottom: 4,
  },

  devSubtitle: {
    fontSize: 13,
    color: '#5F6B63',
    marginBottom: 10,
  },

  devEmail: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
});