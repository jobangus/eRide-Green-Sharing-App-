import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/store/auth';
import { THEME_COLORS } from '../../src/constants/config';
import type { SustainabilitySummary, SustainabilityRideItem } from '../../../packages/shared/src';

export default function DashboardScreen() {
  const { api } = useAuth();
  const [summary, setSummary] = useState<SustainabilitySummary | null>(null);
  const [rides, setRides] = useState<SustainabilityRideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [sum, rideData] = await Promise.all([
        api.getSustainabilitySummary(),
        api.getSustainabilityRides(),
      ]);
      setSummary(sum);
      setRides(rideData.rides);
    } catch (e) {
      console.error('Dashboard load error', e);
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={THEME_COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const co2 = summary?.total_co2_saved_kg ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌿 Eco Dashboard</Text>
          <Text style={styles.headerSubtitle}>Your environmental impact from Mo-Ride</Text>
        </View>

        {/* Big CO2 Stat */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>🌍</Text>
          <Text style={styles.heroValue}>{co2.toFixed(2)} kg</Text>
          <Text style={styles.heroLabel}>CO₂ Saved</Text>
          <Text style={styles.heroEquiv}>
            ≈ {summary?.equivalent_trees_hours ?? 0} tree-hours of absorption
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard emoji="🚗" value={summary?.total_rides ?? 0} label="Shared Rides" />
          <StatCard emoji="📍" value={`${(summary?.total_km ?? 0).toFixed(1)} km`} label="Total km Shared" />
          <StatCard emoji="⛽" value={`${(summary?.equivalent_km_not_driven ?? 0).toFixed(0)} km`} label="Km Not Driven Alone" />
          <StatCard emoji="🌱" value={`${((summary?.total_co2_saved_kg ?? 0) / Math.max(summary?.total_rides ?? 1, 1)).toFixed(2)} kg`} label="CO₂ per Ride" />
        </View>

        {/* Weekly Bar Chart (simple text-based) */}
        {summary && summary.weekly_trend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly CO₂ Savings</Text>
            {summary.weekly_trend.slice(-6).map((week, i) => {
              const maxSaving = Math.max(...summary.weekly_trend.map(w => w.co2_saved_kg), 0.01);
              const barWidth = (week.co2_saved_kg / maxSaving) * 100;
              return (
                <View key={i} style={styles.barRow}>
                  <Text style={styles.barLabel}>{new Date(week.week).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${barWidth}%` as any }]} />
                  </View>
                  <Text style={styles.barValue}>{week.co2_saved_kg.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Rides */}
        {rides.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Rides</Text>
            {rides.slice(0, 10).map(ride => (
              <View key={ride.ride_id} style={styles.rideCard}>
                <View style={styles.rideHeader}>
                  <Text style={styles.rideDate}>{new Date(ride.created_at).toLocaleDateString('en-AU')}</Text>
                  <View style={styles.co2Badge}>
                    <Text style={styles.co2BadgeText}>-{ride.co2_saved_kg.toFixed(3)} kg CO₂</Text>
                  </View>
                </View>
                <Text style={styles.rideRoute}>
                  {ride.pickup_address || 'Unknown'} → {ride.dropoff_address || 'Unknown'}
                </Text>
                <Text style={styles.rideDistance}>{ride.distance_km.toFixed(1)} km · {ride.passengers} passenger(s)</Text>
              </View>
            ))}
          </View>
        )}

        {rides.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptySubtitle}>Complete your first shared ride to start tracking your CO₂ savings!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.emoji}>{emoji}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  emoji: { fontSize: 24, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: 'bold', color: THEME_COLORS.primary },
  label: { fontSize: 11, color: THEME_COLORS.subtext, textAlign: 'center', marginTop: 2 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME_COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: THEME_COLORS.text },
  headerSubtitle: { color: THEME_COLORS.subtext, marginTop: 2 },
  heroCard: {
    backgroundColor: THEME_COLORS.primary, borderRadius: 18, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroValue: { fontSize: 42, fontWeight: 'bold', color: '#fff' },
  heroLabel: { fontSize: 16, color: '#A5D6A7', fontWeight: '600' },
  heroEquiv: { fontSize: 12, color: '#81C784', marginTop: 4, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 54, fontSize: 11, color: THEME_COLORS.subtext },
  barBg: { flex: 1, height: 14, backgroundColor: '#E8F5E9', borderRadius: 7, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: THEME_COLORS.primary, borderRadius: 7 },
  barValue: { width: 36, fontSize: 11, color: THEME_COLORS.primary, fontWeight: '600', textAlign: 'right' },
  rideCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rideDate: { fontSize: 12, color: THEME_COLORS.subtext },
  co2Badge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  co2BadgeText: { fontSize: 11, color: THEME_COLORS.primary, fontWeight: '700' },
  rideRoute: { fontSize: 14, color: THEME_COLORS.text, fontWeight: '500', marginBottom: 2 },
  rideDistance: { fontSize: 12, color: THEME_COLORS.subtext },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: THEME_COLORS.text },
  emptySubtitle: { color: THEME_COLORS.subtext, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
