import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/store/auth';
import { THEME_COLORS } from '../../src/constants/config';

export default function HomeScreen() {
  const { user } = useAuth();
  const isDriver = user?.role === 'driver' || user?.role === 'both';
  const isRider = user?.role === 'rider' || user?.role === 'both';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subgreeting}>Welcome to Mo-Ride</Text>
        </View>

        <View style={styles.cards}>
          {isRider && (
            <TouchableOpacity style={[styles.card, styles.riderCard]} onPress={() => router.push('/(tabs)/rider')}>
              <Text style={styles.cardEmoji}>🙋</Text>
              <Text style={styles.cardTitle}>Request a Ride</Text>
              <Text style={styles.cardDesc}>Find a driver going your way between Monash campuses.</Text>
            </TouchableOpacity>
          )}

          {isDriver && (
            <TouchableOpacity style={[styles.card, styles.driverCard]} onPress={() => router.push('/(tabs)/driver')}>
              <Text style={styles.cardEmoji}>🚗</Text>
              <Text style={styles.cardTitle}>Start Driving</Text>
              <Text style={styles.cardDesc}>Go online and help fellow Monash students get around.</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.card, styles.ecoCard]} onPress={() => router.push('/(tabs)/dashboard')}>
            <Text style={styles.cardEmoji}>🌿</Text>
            <Text style={styles.cardTitle}>Eco Dashboard</Text>
            <Text style={styles.cardDesc}>See your CO₂ savings and environmental impact.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>🎓 Monash University · Melbourne Campuses</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME_COLORS.background },
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 28, marginTop: 8 },
  greeting: { fontSize: 26, fontWeight: 'bold', color: THEME_COLORS.text },
  subgreeting: { fontSize: 15, color: THEME_COLORS.subtext, marginTop: 2 },
  cards: { gap: 14 },
  card: {
    padding: 20, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  riderCard: { backgroundColor: '#E8F5E9' },
  driverCard: { backgroundColor: '#E3F2FD' },
  ecoCard: { backgroundColor: '#F1F8E9' },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: THEME_COLORS.text, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: THEME_COLORS.subtext, lineHeight: 20 },
  badge: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: 10,
  },
  badgeText: { fontSize: 12, color: THEME_COLORS.subtext },
});
