import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../src/store/auth';
import { Button } from '../src/components/ui/Button';
import { THEME_COLORS } from '../src/constants/config';
import { ArrowLeft, CreditCard, CheckCircle2, XCircle, Clock } from 'lucide-react-native';

// Seeded completed ride — log in as carol.rider@monash.edu to use this
const SEEDED_RIDE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

type PaymentResult = 'idle' | 'success' | 'failed' | 'cancelled';

export default function PaymentTestScreen() {
  const { api } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [rideId, setRideId] = useState(SEEDED_RIDE_ID);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult>('idle');
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [intentInfo, setIntentInfo] = useState<{ amount: number; amountPerRider: number; passengerCount: number; devMode: boolean } | null>(null);

  const checkStatus = async () => {
    if (!rideId.trim()) { Alert.alert('Error', 'Enter a ride ID first'); return; }
    setStatusLoading(true);
    try {
      const status = await api.getPaymentStatus(rideId.trim());
      setPaymentStatus(status);
    } catch (err: any) {
      setPaymentStatus(null);
      Alert.alert('Status Error', err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePay = async () => {
    if (!rideId.trim()) { Alert.alert('Error', 'Enter a ride ID first'); return; }
    setLoading(true);
    setPaymentResult('idle');
    try {
      const intent = await api.createPaymentIntent({ ride_id: rideId.trim() });
      setIntentInfo({
        amount: intent.amount_aud,
        amountPerRider: intent.amount_per_rider ?? intent.amount_aud,
        passengerCount: intent.passenger_count ?? 1,
        devMode: !!intent.dev_mode,
      });

      if (intent.dev_mode) {
        await api.capturePayment(rideId.trim());
        setPaymentResult('success');
        setPaymentStatus({ status: 'captured', amount_final: intent.amount_aud, currency: 'aud' });
        return;
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intent.client_secret,
        merchantDisplayName: 'Mo-Ride',
        applePay: { merchantCountryCode: 'AU' },
        googlePay: { merchantCountryCode: 'AU', testEnv: true },
      });
      if (initError) {
        Alert.alert('Init Error', initError.message);
        setPaymentResult('failed');
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') {
          setPaymentResult('cancelled');
        } else {
          Alert.alert('Payment Failed', presentError.message);
          setPaymentResult('failed');
        }
        return;
      }

      await api.capturePayment(rideId.trim());
      setPaymentResult('success');
      await checkStatus();
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setPaymentResult('failed');
    } finally {
      setLoading(false);
    }
  };

  const resultConfig: Record<PaymentResult, { color: string; label: string; icon: React.ReactNode } | null> = {
    idle: null,
    success: { color: '#2E7D32', label: 'Payment captured successfully', icon: <CheckCircle2 size={20} color="#2E7D32" /> },
    failed: { color: '#B00020', label: 'Payment failed', icon: <XCircle size={20} color="#B00020" /> },
    cancelled: { color: '#6B7280', label: 'Payment cancelled by user', icon: <Clock size={20} color="#6B7280" /> },
  };

  const result = resultConfig[paymentResult];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.8}>
          <ArrowLeft size={22} color={THEME_COLORS.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <CreditCard size={28} color={THEME_COLORS.primary} />
          <Text style={styles.title}>Stripe Payment Test</Text>
        </View>
        <Text style={styles.subtitle}>
          Test the payment flow without needing a completed ride. Must be logged in as{' '}
          <Text style={styles.bold}>carol.rider@monash.edu</Text> to use the seeded ride.
        </Text>

        {/* Ride ID input */}
        <View style={styles.section}>
          <Text style={styles.label}>Ride ID</Text>
          <TextInput
            style={styles.input}
            value={rideId}
            onChangeText={setRideId}
            placeholder="Enter ride ID"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setRideId(SEEDED_RIDE_ID)} activeOpacity={0.8}>
            <Text style={styles.hint}>← Use seeded ride ID</Text>
          </TouchableOpacity>
        </View>

        {/* Payment status */}
        {paymentStatus && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Current Payment Status</Text>
            <StatusRow label="Status" value={paymentStatus.status} highlight />
            {paymentStatus.amount_estimated != null && (
              <StatusRow label="Estimated" value={`A$${Number(paymentStatus.amount_estimated).toFixed(2)}`} />
            )}
            {paymentStatus.amount_final != null && (
              <StatusRow label="Final" value={`A$${Number(paymentStatus.amount_final).toFixed(2)}`} />
            )}
            <StatusRow label="Currency" value={paymentStatus.currency?.toUpperCase()} />
          </View>
        )}

        {/* Intent info */}
        {intentInfo && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {intentInfo.passengerCount > 1
                ? `Intent created • A$${intentInfo.amount.toFixed(2)} total ÷ ${intentInfo.passengerCount} riders = A$${intentInfo.amountPerRider.toFixed(2)}/rider`
                : `Intent created • A$${intentInfo.amount.toFixed(2)}`}
              {intentInfo.devMode ? '\n⚠️ Dev mode (no real Stripe call)' : '\n✓ Real Stripe intent'}
            </Text>
          </View>
        )}

        {/* Result banner */}
        {result && (
          <View style={[styles.resultBanner, { borderColor: result.color }]}>
            {result.icon}
            <Text style={[styles.resultText, { color: result.color }]}>{result.label}</Text>
          </View>
        )}

        {/* Actions */}
        <Button
          label="Check Payment Status"
          onPress={checkStatus}
          loading={statusLoading}
          variant="outline"
          style={styles.btn}
        />

        <Button
          label="Create Intent & Pay"
          onPress={handlePay}
          loading={loading}
          style={[styles.btn, styles.payBtn]}
        />

        {/* Test card hint */}
        <View style={styles.testCardBox}>
          <Text style={styles.testCardTitle}>Stripe test cards</Text>
          <TestCard number="4242 4242 4242 4242" result="Success" />
          <TestCard number="4000 0000 0000 0069" result="Declined" />
          <Text style={styles.testCardNote}>Any future expiry • Any 3-digit CVC</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, highlight && styles.statusHighlight]}>{value}</Text>
    </View>
  );
}

function TestCard({ number, result }: { number: string; result: string }) {
  return (
    <View style={styles.testCardRow}>
      <Text style={styles.testCardNumber}>{number}</Text>
      <Text style={[styles.testCardResult, result === 'Success' ? styles.successText : styles.failText]}>
        {result}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { padding: 24, paddingBottom: 48 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 24 },
  backText: { color: THEME_COLORS.primary, fontSize: 16, fontWeight: '500' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },

  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28, lineHeight: 20 },
  bold: { fontWeight: '700', color: '#374151' },

  section: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    fontFamily: 'monospace',
  },
  hint: { fontSize: 12, color: THEME_COLORS.primary, marginTop: 6, fontWeight: '600' },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statusLabel: { fontSize: 13, color: '#6B7280' },
  statusValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  statusHighlight: { color: THEME_COLORS.primary, textTransform: 'capitalize' },

  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: { fontSize: 13, color: '#1D4ED8' },

  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  resultText: { fontSize: 14, fontWeight: '600' },

  btn: { marginBottom: 12 },
  payBtn: { backgroundColor: '#34A853' },

  testCardBox: {
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 16,
  },
  testCardTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  testCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  testCardNumber: { fontSize: 13, fontFamily: 'monospace', color: '#111827' },
  testCardResult: { fontSize: 13, fontWeight: '600' },
  successText: { color: '#2E7D32' },
  failText: { color: '#B00020' },
  testCardNote: { fontSize: 12, color: '#6B7280', marginTop: 6 },
});
