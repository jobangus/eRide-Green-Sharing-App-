import { Stack } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '../../src/constants/config';

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </StripeProvider>
  );
}