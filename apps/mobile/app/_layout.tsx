//We used ChatGPT to help us implement an Admin page that stores users account information as well as their Carbon Emissions data. This admin account is purposed as our additional functionality outside the scope of our requirement to further improve our application management.
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider } from '../src/store/auth';
import { THEME_COLORS, STRIPE_PUBLISHABLE_KEY } from '../src/constants/config';
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
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="edu.monash.moride">
      <AuthProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </PaperProvider>
      </AuthProvider>
    </StripeProvider>
  );
}
