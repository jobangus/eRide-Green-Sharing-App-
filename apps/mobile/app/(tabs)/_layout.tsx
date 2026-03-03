import { Tabs } from 'expo-router';
import { THEME_COLORS } from '../../src/constants/config';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME_COLORS.primary,
        tabBarInactiveTintColor: THEME_COLORS.subtext,
        tabBarStyle: { borderTopColor: THEME_COLORS.border },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="rider"
        options={{ title: 'Ride', tabBarIcon: ({ color }) => <TabIcon emoji="🙋" color={color} /> }}
      />
      <Tabs.Screen
        name="driver"
        options={{ title: 'Drive', tabBarIcon: ({ color }) => <TabIcon emoji="🚗" color={color} /> }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Eco', tabBarIcon: ({ color }) => <TabIcon emoji="🌿" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}
