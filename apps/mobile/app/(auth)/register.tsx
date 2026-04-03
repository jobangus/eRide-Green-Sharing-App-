import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS, API_BASE_URL } from '../../src/constants/config';
import { MoRideApiClient } from '@moride/shared';
import {
  User,
  Car,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Lock,
  Check,
} from 'lucide-react-native';

const api = new MoRideApiClient(API_BASE_URL);

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'rider' | 'driver'>('rider');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const riderCheckOpacity = useRef(new Animated.Value(1)).current;
  const riderCheckTranslate = useRef(new Animated.Value(0)).current;
  const driverCheckOpacity = useRef(new Animated.Value(0)).current;
  const driverCheckTranslate = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (role === 'rider') {
      Animated.parallel([
        Animated.timing(riderCheckOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(riderCheckTranslate, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(driverCheckOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(driverCheckTranslate, {
          toValue: 12,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(driverCheckOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(driverCheckTranslate, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(riderCheckOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(riderCheckTranslate, {
          toValue: -12,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [role, riderCheckOpacity, riderCheckTranslate, driverCheckOpacity, driverCheckTranslate]);

  const formatPhoneNumber = (input: string) => {
    const digits = input.replace(/\D/g, '').slice(0, 10);

    if (digits.length === 0) return '';
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  };

  const validate = () => {
    const e: Record<string, string> = {};

    if (!name.trim()) e.name = 'Name is required';
    if (!email.toLowerCase().trim().endsWith('@monash.edu')) {
      e.email = 'Must be a @monash.edu email';
    }

    if (password.length < 8) {
      e.password = 'Min 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      e.password = 'Must contain uppercase letter';
    } else if (!/[0-9]/.test(password)) {
      e.password = 'Must contain a number';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const cleanedPhone = phone.replace(/\s/g, '');

      const res = await api.register({
        email: email.toLowerCase().trim(),
        password,
        name: name.trim(),
        phone: cleanedPhone ? cleanedPhone : undefined,
        role,
      });

      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          email: email.toLowerCase().trim(),
          devOtp: res.otp,
        },
      });
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Join the Monash ride-sharing community
        </Text>

        <Text style={styles.label}>I want to join as</Text>

        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'rider' && styles.roleCardActive]}
            onPress={() => setRole('rider')}
            activeOpacity={0.85}
          >
            <Animated.View
              style={[
                styles.checkBadge,
                {
                  opacity: riderCheckOpacity,
                  transform: [{ translateX: riderCheckTranslate }],
                },
              ]}
            >
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>

            <View style={styles.iconWrap}>
              <User
                size={22}
                color={role === 'rider' ? THEME_COLORS.primary : '#6B7280'}
              />
            </View>
            <Text style={styles.roleTitle}>Rider</Text>
            <Text style={styles.roleDesc}>Find affordable rides</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, role === 'driver' && styles.roleCardActive]}
            onPress={() => setRole('driver')}
            activeOpacity={0.85}
          >
            <Animated.View
              style={[
                styles.checkBadge,
                {
                  opacity: driverCheckOpacity,
                  transform: [{ translateX: driverCheckTranslate }],
                },
              ]}
            >
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>

            <View style={styles.iconWrap}>
              <Car
                size={22}
                color={role === 'driver' ? THEME_COLORS.primary : '#6B7280'}
              />
            </View>
            <Text style={styles.roleTitle}>Driver</Text>
            <Text style={styles.roleDesc}>Earn by driving</Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
          LeftIcon={User}
          error={errors.name}
        />

        <Input
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="john@monash.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          LeftIcon={Mail}
          error={errors.email}
        />

        <Input
          label="Phone Number"
          value={phone}
          onChangeText={(text) => setPhone(formatPhoneNumber(text))}
          placeholder="0412 345 678"
          keyboardType="phone-pad"
          LeftIcon={Phone}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a strong password"
          secureTextEntry={!showPassword}
          LeftIcon={Lock}
          RightIcon={showPassword ? EyeOff : Eye}
          onRightIconPress={() => setShowPassword(!showPassword)}
          error={errors.password}
        />

        <Button
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          style={styles.btn}
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.loginAction}>Sign in</Text>
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

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 28,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },

  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },

  roleCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    paddingTop: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },

  roleCardActive: {
    borderColor: THEME_COLORS.primary,
    backgroundColor: '#E8F5E9',
  },

  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34A853',
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconWrap: {
    marginBottom: 10,
  },

  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  roleDesc: {
    fontSize: 13,
    color: '#6B7280',
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

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    gap: 4,
  },

  loginText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },

  loginAction: {
    fontSize: 14,
    color: '#34A853',
    fontWeight: '700',
  },
});