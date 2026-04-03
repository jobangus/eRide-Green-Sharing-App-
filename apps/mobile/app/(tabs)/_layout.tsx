import { Tabs } from 'expo-router';
import { THEME_COLORS } from '../../src/constants/config';
import {
  Home,
  Car,
  User,
  Leaf,
  UserCircle,
} from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#34A853',
        tabBarInactiveTintColor: THEME_COLORS.subtext,
        headerShown: false,

        tabBarStyle: {
          borderTopColor: THEME_COLORS.border,
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
          backgroundColor: '#FFFFFF',
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Home size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="rider"
        options={{
          title: 'Ride',
          tabBarIcon: ({ color }) => (
            <User size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="driver"
        options={{
          title: 'Drive',
          tabBarIcon: ({ color }) => (
            <Car size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Eco',
          tabBarIcon: ({ color }) => (
            <Leaf size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <UserCircle size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}