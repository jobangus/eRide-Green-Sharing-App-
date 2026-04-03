import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/store/auth';
import {
  Hand,
  Navigation,
  Car,
  Leaf,
  GraduationCap,
  MapPin,
} from 'lucide-react-native';

export default function HomeScreen() {
  const { user } = useAuth();

  const firstName = user?.name?.split(' ')[0] || 'there';
  const isDriver = user?.role === 'driver' || user?.role === 'both';
  const isRider = user?.role === 'rider' || user?.role === 'both';

  const primaryTitle = isRider ? 'Request a Ride' : 'Start Driving';
  const primaryDesc = isRider
    ? 'Find a driver heading your way between Monash campuses.'
    : 'Go online and help fellow Monash students get around.';
  const primaryRoute = isRider ? '/(tabs)/rider' : '/(tabs)/driver';
  const PrimaryIcon = isRider ? Navigation : Car;
  const primaryIconColor = isRider ? '#34A853' : '#1E88E5';
  const primaryCardStyle = isRider ? styles.primaryRideCard : styles.primaryDriveCard;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
            <Hand size={20} color="#34A853" style={styles.waveIcon} />
          </View>
          <Text style={styles.subgreeting}>Welcome back to Mo-Ride</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Navigation size={18} color="#34A853" />
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>

          <View style={styles.statCard}>
            <Leaf size={18} color="#34A853" />
            <Text style={styles.statValue}>2.4kg</Text>
            <Text style={styles.statLabel}>CO₂ saved</Text>
          </View>

          <View style={styles.statCard}>
            <MapPin size={18} color="#34A853" />
            <Text style={styles.statValue}>Clayton</Text>
            <Text style={styles.statLabel}>Campus</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryCard, primaryCardStyle]}
          onPress={() => router.push(primaryRoute as any)}
          activeOpacity={0.88}
        >
          <View style={styles.primaryIconWrap}>
            <PrimaryIcon size={26} color={primaryIconColor} />
          </View>

          <View style={styles.primaryTextWrap}>
            <Text style={styles.primaryTitle}>{primaryTitle}</Text>
            <Text style={styles.primaryDesc}>{primaryDesc}</Text>
          </View>

          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.badge}>
          <GraduationCap size={16} color="#34A853" />
          <Text style={styles.badgeText}>Monash University · Melbourne Campuses</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7FAF8',
  },

  container: {
    flex: 1,
    padding: 20,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginTop: 8,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#17321F',
  },

  waveIcon: {
    marginLeft: 8,
  },

  subgreeting: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17321F',
    marginTop: 8,
  },

  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },

  primaryCard: {
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  primaryRideCard: {
    backgroundColor: '#E8F5E9',
  },

  primaryDriveCard: {
    backgroundColor: '#E3F2FD',
  },

  primaryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  primaryTextWrap: {
    flex: 1,
  },

  primaryTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 4,
  },

  primaryDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5F6F65',
  },

  arrow: {
    fontSize: 22,
    color: '#7A8B81',
    marginLeft: 10,
    fontWeight: '700',
  },

  badge: {
    marginTop: 'auto',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  badgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});