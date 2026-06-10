//We used ChatGPT to help us implement an Admin page that stores users account information as well as their Carbon Emissions data. This admin account is purposed as our additional functionality outside the scope of our requirement to further improve our application management . 
import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../src/store/auth';
import { THEME_COLORS } from '../../src/constants/config';

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  /**
   * Redirects unauthenticated users to the login screen
   * and non-admin users back to the main tab layout.
   * This ensures that admin routes remain protected.
   */
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else if (user.role !== 'admin') {
        router.replace('/(tabs)');
      }
    }
  }, [user, isLoading]);

  if (isLoading || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={styles.loadingText}>Checking access...</Text>
      </View>
    );
  }

  if (user.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <View style={styles.iconWrap}>
          <ShieldCheck size={32} color={THEME_COLORS.primary} />
        </View>
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.subtitle}>
          This area is only available to authorised Mo-Ride administrators.
        </Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});