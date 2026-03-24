import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS } from '../../src/constants/config';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.glowCircle} />

        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/carlogo.png')}
            style={styles.logo}
          />
        </View>

        <Text style={styles.title}>Mo-Ride</Text>

        <Text style={styles.subtitle}>
          Smart, sustainable ride-sharing for the Monash community.
        </Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Monash Students & Staffs</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Eco-friendly</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Affordable</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Get started</Text>

        <Text style={styles.cardDescription}>
          Join a safer, greener, and more convenient way to travel around Monash.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Create New Account"
            onPress={() => router.push('/(auth)/register')}
            style={styles.primaryBtn}
          />

          <Button
            label="I already have an account"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
            style={styles.secondaryBtn}
          />
        </View>

        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.helperText}>
            Only Monash University (@monash.edu) email addresses are accepted.
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAF8',
    justifyContent: 'space-between',
  },

  topSection: {
    backgroundColor: THEME_COLORS.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },

  glowCircle: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.2,
  },

  subtitle: {
    fontSize: 16,
    color: '#E8F5E9',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
    paddingHorizontal: 12,
  },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
  },

  badge: {
    margin: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  badgeText: {
    color: '#F1F8E9',
    fontSize: 11,
    fontWeight: '600',
  },

  card: {
    marginHorizontal: 20,
    marginTop: -18,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 8,
  },

  cardDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#5F6F65',
    marginBottom: 22,
  },

  actions: {
    gap: 12,
  },

  primaryBtn: {
    backgroundColor: THEME_COLORS.primary,
  },

  secondaryBtn: {
    borderColor: THEME_COLORS.primary,
  },

  helperText: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#7A8B81',
  },
});