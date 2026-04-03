/**
 * Entry point — redirects to (auth) or (tabs) based on auth state.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../src/store/auth';
import { View, ActivityIndicator } from 'react-native';
import { THEME_COLORS } from '../src/constants/config';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME_COLORS.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/intro'} />;
}
