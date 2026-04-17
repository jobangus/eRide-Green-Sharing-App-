import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../src/store/auth';
import { Button } from '../../src/components/ui/Button';
import {
  UserCircle2,
  Mail,
  Phone,
  CalendarDays,
  BadgeCheck,
  Car,
  CircleDot,
  Star,
  ShieldCheck,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  const roleLabel =
    user?.role === 'both'
      ? 'Driver & Rider'
      : user?.role === 'driver'
        ? 'Driver'
        : 'Rider';

  const riderCount = user?.ratings?.as_rider?.count ?? 0;
  const riderRating = user?.ratings?.as_rider?.average;
  const driverRating = user?.ratings?.as_driver?.average;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{user?.name ?? 'Unknown User'}</Text>
          <Text style={styles.email}>{user?.email ?? 'No email available'}</Text>

          <View style={styles.roleBadge}>
            <UserCircle2 size={14} color="#2E7D32" />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Car size={18} color="#34A853" />
            <Text style={styles.statValue}>{riderCount}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>

          <View style={styles.statCard}>
            <Star size={18} color="#F5B301" />
            <Text style={styles.statValue}>
              {riderRating ? riderRating.toFixed(1) : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Rider Rating</Text>
          </View>

          {(user?.role === 'driver' || user?.role === 'both') && (
            <View style={styles.statCard}>
              <ShieldCheck size={18} color="#34A853" />
              <Text style={styles.statValue}>
                {driverRating ? driverRating.toFixed(1) : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Driver Rating</Text>
            </View>
          )}
        </View>

        {user?.driver_profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Details</Text>
            <View style={styles.infoCard}>
              <InfoRow
                icon={<Car size={16} color="#6B7280" />}
                label="Make"
                value={user.driver_profile.car_make ?? 'Not set'}
              />
              <InfoRow
                icon={<Car size={16} color="#6B7280" />}
                label="Model"
                value={user.driver_profile.car_model ?? 'Not set'}
              />
              <InfoRow
                icon={<CircleDot size={16} color="#6B7280" />}
                label="Color"
                value={user.driver_profile.car_color ?? 'Not set'}
              />
              <InfoRow
                icon={<BadgeCheck size={16} color="#6B7280" />}
                label="Plate"
                value={user.driver_profile.car_plate ?? 'Not set'}
              />
              <InfoRow
                icon={<CircleDot size={16} color="#6B7280" />}
                label="Status"
                value={user.driver_profile.is_online ? 'Online' : 'Offline'}
                valueStyle={
                  user.driver_profile.is_online
                    ? styles.onlineValue
                    : styles.offlineValue
                }
                isLast
              />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon={<Phone size={16} color="#6B7280" />}
              label="Phone"
              value={user?.phone ?? 'Not set'}
            />
            <InfoRow
              icon={<CalendarDays size={16} color="#6B7280" />}
              label="Member Since"
              value={
                user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-AU')
                  : 'Not available'
              }
            />
            <InfoRow
              icon={<Mail size={16} color="#6B7280" />}
              label="Email"
              value={user?.email ?? 'Not available'}
            />
            <InfoRow
              icon={<BadgeCheck size={16} color="#6B7280" />}
              label="Verified"
              value={user?.is_verified ? 'Yes' : 'No'}
              valueStyle={user?.is_verified ? styles.onlineValue : styles.offlineValue}
              isLast
            />
          </View>
        </View>

        <Button
          label="Log Out"
          onPress={handleLogout}
          loading={loggingOut}
          variant="outline"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueStyle,
  isLast = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueStyle?: object;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <View style={styles.infoLeft}>
        {icon}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7FAF8',
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  avatarWrap: {
    marginBottom: 14,
  },

  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#34A853',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34A853',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },

  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 4,
    textAlign: 'center',
  },

  email: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },

  roleBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  roleText: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 13,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
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
    fontSize: 16,
    fontWeight: '800',
    color: '#17321F',
    marginTop: 8,
  },

  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
    textAlign: 'center',
  },

  section: {
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 10,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },

  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  infoLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },

  infoValue: {
    color: '#17321F',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },

  onlineValue: {
    color: '#2E7D32',
  },

  offlineValue: {
    color: '#6B7280',
  },

  logoutBtn: {
    marginTop: 28,
    borderColor: '#34A853',
  },
});