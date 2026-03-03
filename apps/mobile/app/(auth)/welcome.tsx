import React from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS } from '../../src/constants/config';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🚗</Text>
        <Text style={styles.title}>Mo-Ride</Text>
        <Text style={styles.subtitle}>Monash University's sustainable ride-sharing platform.</Text>
        <Text style={styles.tagline}>@monash.edu only · Eco-friendly · Affordable</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Get Started — Sign Up"
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

      <Text style={styles.footer}>
        Only Monash University (@monash.edu) email addresses are accepted.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.primary,
    justifyContent: 'space-between',
    padding: 24,
  },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 42, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 18, color: '#A5D6A7', textAlign: 'center', marginTop: 8, lineHeight: 26 },
  tagline: { fontSize: 13, color: '#81C784', marginTop: 12, textAlign: 'center' },
  actions: { gap: 12, marginBottom: 16 },
  primaryBtn: { backgroundColor: '#fff' },
  secondaryBtn: { borderColor: '#fff' },
  footer: { color: '#81C784', textAlign: 'center', fontSize: 12, marginBottom: 8 },
});
