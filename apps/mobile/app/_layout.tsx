import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider } from '../src/store/auth';
import { THEME_COLORS } from '../src/constants/config';
import { StatusBar } from 'expo-status-bar';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: THEME_COLORS.primary,
    secondary: THEME_COLORS.secondary,
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </AuthProvider>
  );
}
