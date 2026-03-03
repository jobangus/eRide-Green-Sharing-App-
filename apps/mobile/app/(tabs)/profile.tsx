import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useAuth } from '../../src/store/auth';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS } from '../../src/constants/config';

export default function ProfileScreen() {
  const { user, logout, api, refreshProfile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          setLoggingOut(true);
          await logout();
        }
      }
    ]);
  };

  const roleLabel = user?.role === 'both' ? '🔄 Driver & Rider'
    : user?.role === 'driver' ? '🚗 Driver'
    : '🙋 Rider';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{roleLabel}</Text></View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.ratings.as_rider.count ?? 0}</Text>
            <Text style={styles.statLabel}>Rides as Rider</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user?.ratings.as_rider.average ? `⭐ ${user.ratings.as_rider.average.toFixed(1)}` : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Rider Rating</Text>
          </View>
          {(user?.role === 'driver' || user?.role === 'both') && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {user?.ratings.as_driver.average ? `⭐ ${user.ratings.as_driver.average.toFixed(1)}` : 'N/A'}
                </Text>
                <Text style={styles.statLabel}>Driver Rating</Text>
              </View>
            </>
          )}
        </View>

        {/* Driver profile details */}
        {user?.driver_profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle</Text>
            <View style={styles.infoCard}>
              <InfoRow label="Make" value={user.driver_profile.car_make ?? 'Not set'} />
              <InfoRow label="Model" value={user.driver_profile.car_model ?? 'Not set'} />
              <InfoRow label="Color" value={user.driver_profile.car_color ?? 'Not set'} />
              <InfoRow label="Plate" value={user.driver_profile.car_plate ?? 'Not set'} />
              <InfoRow label="Status" value={user.driver_profile.is_online ? '🟢 Online' : '⚫ Offline'} />
            </View>
          </View>
        )}

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Phone" value={user?.phone ?? 'Not set'} />
            <InfoRow label="Member since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-AU') : ''} />
            <InfoRow label="Verified" value={user?.is_verified ? '✅ Yes' : '❌ No'} />
          </View>
        </View>

        <Button label="Log Out" onPress={handleLogout} loading={loggingOut} variant="outline" style={styles.logoutBtn} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.border },
  label: { color: THEME_COLORS.subtext, fontSize: 14 },
  value: { color: THEME_COLORS.text, fontSize: 14, fontWeight: '500' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME_COLORS.background },
  container: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: THEME_COLORS.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: THEME_COLORS.text },
  email: { color: THEME_COLORS.subtext, fontSize: 14, marginTop: 2 },
  roleBadge: {
    backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 16, marginTop: 8,
  },
  roleText: { color: THEME_COLORS.primary, fontWeight: '700', fontSize: 13 },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 20, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: THEME_COLORS.text },
  statLabel: { fontSize: 11, color: THEME_COLORS.subtext, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: THEME_COLORS.border },
  section: { width: '100%', marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 8 },
  infoCard: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  logoutBtn: { marginTop: 32, width: '100%' },
});
