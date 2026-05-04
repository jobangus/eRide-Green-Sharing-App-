import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  ShieldCheck,
  Users,
  CarFront,
  Route,
  Leaf,
  TriangleAlert,
  ChartColumn,
  Clock3,
  LogOut,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react-native';
import { useAuth } from '../../src/store/auth';
import { THEME_COLORS } from '../../src/constants/config';

export default function AdminDashboardScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const showComingSoon = (label: string) => {
    Alert.alert(label, 'This admin feature can be connected to live backend data next.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.kicker}>Mo-Ride Administration</Text>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              Monitor platform activity, review key areas, and manage the system
              from one place.
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={18} color={THEME_COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <ShieldCheck size={24} color={THEME_COLORS.primary} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Administrator'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          <View style={styles.roleBadge}>
            <BadgeCheck size={14} color={THEME_COLORS.primary} />
            <Text style={styles.roleText}>ADMIN</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Users size={20} color={THEME_COLORS.primary} />
            </View>
            <Text style={styles.statValue}>Users</Text>
            <Text style={styles.statLabel}>Manage registered riders, drivers, and access roles.</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <CarFront size={20} color={THEME_COLORS.primary} />
            </View>
            <Text style={styles.statValue}>Drivers</Text>
            <Text style={styles.statLabel}>Review driver-related operations and ride availability.</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Route size={20} color={THEME_COLORS.primary} />
            </View>
            <Text style={styles.statValue}>Rides</Text>
            <Text style={styles.statLabel}>Track matching flow, ride activity, and service health.</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Leaf size={20} color={THEME_COLORS.primary} />
            </View>
            <Text style={styles.statValue}>Impact</Text>
            <Text style={styles.statLabel}>Monitor sustainability outcomes and CO₂ savings goals.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Overview</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <ChartColumn size={18} color={THEME_COLORS.primary} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Administrative visibility</Text>
                <Text style={styles.infoSubtitle}>
                  This dashboard is intended to give supervisors or platform admins
                  a high-level view of Mo-Ride operations.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Clock3 size={18} color={THEME_COLORS.primary} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Next integration step</Text>
                <Text style={styles.infoSubtitle}>
                  Connect this page to live backend metrics such as total users,
                  completed rides, cancellations, active drivers, and ride demand.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority Attention</Text>

          <View style={styles.alertCard}>
            <TriangleAlert size={18} color="#9A6700" />
            <Text style={styles.alertText}>
              Admin features are currently set up and access-controlled. The next
              phase is connecting real system metrics and management actions.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => showComingSoon('User Management')}
            activeOpacity={0.85}
          >
            <View style={styles.actionLeft}>
              <View style={styles.actionIconWrap}>
                <Users size={18} color={THEME_COLORS.primary} />
              </View>
              <View>
                <Text style={styles.actionTitle}>User Management</Text>
                <Text style={styles.actionSubtitle}>
                  Review riders, drivers, and account roles.
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => showComingSoon('Ride Monitoring')}
            activeOpacity={0.85}
          >
            <View style={styles.actionLeft}>
              <View style={styles.actionIconWrap}>
                <Route size={18} color={THEME_COLORS.primary} />
              </View>
              <View>
                <Text style={styles.actionTitle}>Ride Monitoring</Text>
                <Text style={styles.actionSubtitle}>
                  Review trip activity, match flow, and ride status trends.
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => showComingSoon('Sustainability Analytics')}
            activeOpacity={0.85}
          >
            <View style={styles.actionLeft}>
              <View style={styles.actionIconWrap}>
                <Leaf size={18} color={THEME_COLORS.primary} />
              </View>
              <View>
                <Text style={styles.actionTitle}>Sustainability Analytics</Text>
                <Text style={styles.actionSubtitle}>
                  View environmental metrics and shared transport impact.
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
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
    padding: 20,
    paddingBottom: 36,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  headerLeft: {
    flex: 1,
    paddingRight: 14,
  },

  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },

  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },

  profileIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },

  profileEmail: {
    fontSize: 13,
    color: '#6B7280',
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  roleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E7D32',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 22,
  },

  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },

  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },

  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoTextWrap: {
    flex: 1,
    marginLeft: 10,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  infoSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: '#EEF2F7',
    marginVertical: 14,
  },

  alertCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },

  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },

  actionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});