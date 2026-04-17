import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/store/auth';
import type { SustainabilitySummary, SustainabilityRideItem } from '@moride/shared';
import {
  Leaf,
  Car,
  MapPin,
  Route,
  Trees,
  TrendingUp,
  CalendarDays,
} from 'lucide-react-native';

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
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#34A853" />
        </View>
      </SafeAreaView>
    );
  }

  const co2 = summary?.total_co2_saved_kg ?? 0;
  const totalRides = summary?.total_rides ?? 0;
  const totalKm = summary?.total_km ?? 0;
  const notDrivenKm = summary?.equivalent_km_not_driven ?? 0;
  const co2PerRide = ((summary?.total_co2_saved_kg ?? 0) / Math.max(totalRides, 1)).toFixed(2);
  const treeHours = summary?.equivalent_trees_hours ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerIconWrap}>
            <Leaf size={22} color="#2E7D32" />
          </View>
          <Text style={styles.headerTitle}>Eco Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Track your environmental impact through shared rides.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeafWrap}>
              <Leaf size={26} color="#FFFFFF" />
            </View>
            <View style={styles.heroChip}>
              <Trees size={14} color="#E8F5E9" />
              <Text style={styles.heroChipText}>{treeHours} tree-hours</Text>
            </View>
          </View>

          <Text style={styles.heroValue}>{co2.toFixed(2)} kg</Text>
          <Text style={styles.heroLabel}>CO₂ Saved</Text>
          <Text style={styles.heroEquiv}>
            Equivalent to avoiding unnecessary solo travel and reducing shared transport emissions.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon={<Car size={18} color="#34A853" />} value={totalRides} label="Shared Rides" />
          <StatCard icon={<MapPin size={18} color="#34A853" />} value={`${totalKm.toFixed(1)} km`} label="Total km" />
        </View>

        <View style={styles.statsRow}>
          <StatCard icon={<Route size={18} color="#34A853" />} value={`${notDrivenKm.toFixed(0)} km`} label="Km Not Driven Alone" />
          <StatCard icon={<Leaf size={18} color="#34A853" />} value={`${co2PerRide} kg`} label="CO₂ per Ride" />
        </View>

        {summary && summary.weekly_trend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly CO₂ Savings</Text>
            <View style={styles.sectionCard}>
              {summary.weekly_trend.slice(-6).map((week, i) => {
                const maxSaving = Math.max(
                  ...summary.weekly_trend.map((w) => w.co2_saved_kg),
                  0.01
                );
                const barWidth = (week.co2_saved_kg / maxSaving) * 100;

                return (
                  <View key={i} style={styles.barRow}>
                    <View style={styles.barDateWrap}>
                      <CalendarDays size={13} color="#6B7280" />
                      <Text style={styles.barLabel}>
                        {new Date(week.week).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>

                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${barWidth}%` as any }]} />
                    </View>

                    <Text style={styles.barValue}>{week.co2_saved_kg.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {rides.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Rides</Text>

            {rides.slice(0, 10).map((ride) => (
              <View key={ride.ride_id} style={styles.rideCard}>
                <View style={styles.rideHeader}>
                  <View style={styles.rideDateWrap}>
                    <CalendarDays size={13} color="#6B7280" />
                    <Text style={styles.rideDate}>
                      {new Date(ride.created_at).toLocaleDateString('en-AU')}
                    </Text>
                  </View>

                  <View style={styles.co2Badge}>
                    <Leaf size={12} color="#2E7D32" />
                    <Text style={styles.co2BadgeText}>
                      -{ride.co2_saved_kg.toFixed(3)} kg
                    </Text>
                  </View>
                </View>

                <Text style={styles.rideRoute}>
                  {ride.pickup_address || 'Unknown'} → {ride.dropoff_address || 'Unknown'}
                </Text>

                <View style={styles.rideMetaRow}>
                  <Text style={styles.rideDistance}>{ride.distance_km.toFixed(1)} km</Text>
                  <Text style={styles.rideMetaDot}>•</Text>
                  <Text style={styles.rideDistance}>{ride.passengers} passenger(s)</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {rides.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <TrendingUp size={34} color="#34A853" />
            </View>
            <Text style={styles.emptyTitle}>No eco data yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete your first shared ride to start tracking your CO₂ savings and environmental impact.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7FAF8',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scroll: {
    flex: 1,
  },

  container: {
    padding: 16,
    paddingBottom: 32,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 4,
  },

  headerSubtitle: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },

  heroCard: {
    backgroundColor: '#34A853',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#34A853',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },

  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  heroLeafWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  heroChipText: {
    color: '#E8F5E9',
    fontSize: 12,
    fontWeight: '700',
  },

  heroValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 18,
  },

  heroLabel: {
    fontSize: 16,
    color: '#E8F5E9',
    fontWeight: '700',
    marginTop: 2,
  },

  heroEquiv: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.86)',
    marginTop: 10,
    lineHeight: 19,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17321F',
    marginTop: 8,
  },

  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },

  section: {
    marginTop: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 10,
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },

  barDateWrap: {
    width: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  barLabel: {
    fontSize: 11,
    color: '#6B7280',
  },

  barBg: {
    flex: 1,
    height: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 7,
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    backgroundColor: '#34A853',
    borderRadius: 7,
  },

  barValue: {
    width: 40,
    fontSize: 11,
    color: '#34A853',
    fontWeight: '700',
    textAlign: 'right',
  },

  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },

  rideDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  rideDate: {
    fontSize: 12,
    color: '#6B7280',
  },

  co2Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  co2BadgeText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '700',
  },

  rideRoute: {
    fontSize: 14,
    color: '#17321F',
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
  },

  rideMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rideDistance: {
    fontSize: 12,
    color: '#6B7280',
  },

  rideMetaDot: {
    marginHorizontal: 6,
    color: '#9CA3AF',
    fontSize: 12,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 42,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#17321F',
  },

  emptySubtitle: {
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 24,
    fontSize: 14,
  },
});