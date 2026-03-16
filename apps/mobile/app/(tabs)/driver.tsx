import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Alert, Modal,
  TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../src/store/auth';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS, DEFAULT_MAP_REGION } from '../../src/constants/config';
import { useSocketIO } from '../../src/hooks/useSocketIO';
import type { WsRideRequest, WsRideStatusUpdate, RideStatus } from '@moride/shared';

type DriverAppState = 'offline' | 'online' | 'request_incoming' | 'active_ride' | 'completed';

export default function DriverScreen() {
  const { api, user } = useAuth();
  const [appState, setAppState] = useState<DriverAppState>('offline');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<WsRideRequest | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  const { acceptRide, declineRide, sendLocation } = useSocketIO({
    onRideRequest: (data: WsRideRequest) => {
      setPendingRequest(data);
      setAppState('request_incoming');
      startCountdown(data.timeout_seconds);
    },
    onRideStatusUpdate: (data: WsRideStatusUpdate) => {
      if (data.ride_id !== rideId) return;
      setRideStatus(data.status as RideStatus);
      if (data.status === 'completed') {
        setAppState('completed');
        setShowRating(true);
      } else if (data.status === 'cancelled') {
        Alert.alert('Ride Cancelled', 'The rider cancelled the ride.');
        setAppState('online');
        setRideId(null);
      }
    },
  }, rideId || undefined);

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const goOnline = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Location permission needed to drive.'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    setCurrentLocation({ lat, lng });

    setLoading(true);
    try {
      await api.goOnline({ lat, lng });
      setAppState('online');

      // Start location watch
      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 },
        (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          sendLocation(latitude, longitude, rideId || undefined);
          api.updateDriverLocation(latitude, longitude).catch(() => {});
        }
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const goOffline = async () => {
    locationWatchRef.current?.remove();
    try { await api.goOffline(); } catch {}
    setAppState('offline');
  };

  const handleAccept = async () => {
    if (!pendingRequest) return;
    clearInterval(countdownRef.current!);
    acceptRide(pendingRequest.ride_id);
    setRideId(pendingRequest.ride_id);
    setRideStatus('matched');
    setAppState('active_ride');
    setPendingRequest(null);
  };

  const handleDecline = () => {
    if (!pendingRequest) return;
    clearInterval(countdownRef.current!);
    declineRide(pendingRequest.ride_id);
    setPendingRequest(null);
    setAppState('online');
  };

  const updateStatus = async (status: 'enroute' | 'arrived' | 'in_progress') => {
    if (!rideId) return;
    try {
      await api.updateRideStatus(rideId, { status });
      setRideStatus(status);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const completeRide = async () => {
    if (!rideId) return;
    try {
      const res = await api.completeRide(rideId);
      setRideStatus('completed');
      setAppState('completed');
      setShowRating(true);
      Alert.alert('Ride Complete! 🎉', `CO₂ saved: ${res.co2_saved_kg} kg`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const submitRating = async () => {
    if (!rideId) return;
    try {
      await api.rateRide(rideId, { score: rating as 1|2|3|4|5 });
      setShowRating(false);
      setRideId(null);
      setAppState('online');
      Alert.alert('Thank you!', 'Your rating has been submitted.');
    } catch {}
  };

  useEffect(() => {
    return () => {
      locationWatchRef.current?.remove();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_MAP_REGION}
          showsUserLocation
          region={currentLocation ? {
            latitude: currentLocation.lat, longitude: currentLocation.lng,
            latitudeDelta: 0.02, longitudeDelta: 0.02,
          } : undefined}
        >
          {pendingRequest && (
            <Marker
              coordinate={{ latitude: pendingRequest.pickup_lat, longitude: pendingRequest.pickup_lng }}
              title="Rider Pickup"
              pinColor={THEME_COLORS.primary}
            />
          )}
        </MapView>

        <ScrollView style={styles.sheet}>
          {appState === 'offline' && (
            <View style={styles.centeredContent}>
              <Text style={styles.offlineEmoji}>🚗</Text>
              <Text style={styles.sheetTitle}>Ready to Drive?</Text>
              <Text style={styles.subtitle}>Go online to start receiving ride requests from Monash students.</Text>
              <Button label="Go Online" onPress={goOnline} loading={loading} style={styles.btn} />
            </View>
          )}

          {appState === 'online' && (
            <View style={styles.centeredContent}>
              <View style={styles.onlineBadge}><Text style={styles.onlineText}>● ONLINE</Text></View>
              <Text style={styles.sheetTitle}>Waiting for Requests</Text>
              <Text style={styles.subtitle}>You'll be notified when a nearby rider requests a ride.</Text>
              <Button label="Go Offline" onPress={goOffline} variant="outline" style={styles.btn} />
            </View>
          )}

          {appState === 'active_ride' && (
            <View>
              <Text style={styles.sheetTitle}>Active Ride</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{rideStatus?.toUpperCase().replace('_', ' ')}</Text>
              </View>
              <View style={styles.actionBtns}>
                {rideStatus === 'matched' && (
                  <Button label="🚗 Start Driving to Pickup" onPress={() => updateStatus('enroute')} style={styles.btn} />
                )}
                {rideStatus === 'enroute' && (
                  <Button label="📍 I've Arrived at Pickup" onPress={() => updateStatus('arrived')} style={styles.btn} />
                )}
                {rideStatus === 'arrived' && (
                  <Button label="▶️ Begin Ride" onPress={() => updateStatus('in_progress')} style={styles.btn} />
                )}
                {rideStatus === 'in_progress' && (
                  <Button label="✅ Complete Ride" onPress={completeRide} style={styles.btn} />
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Incoming Request Modal */}
        <Modal visible={appState === 'request_incoming'} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.countdownCircle}>
                <Text style={styles.countdownText}>{countdown}s</Text>
              </View>
              <Text style={styles.modalTitle}>New Ride Request! 🔔</Text>
              {pendingRequest && (
                <>
                  <View style={styles.requestInfo}>
                    <Text style={styles.reqLabel}>📍 Pickup</Text>
                    <Text style={styles.reqValue}>
                      {pendingRequest.pickup_lat.toFixed(4)}, {pendingRequest.pickup_lng.toFixed(4)}
                    </Text>
                  </View>
                  <View style={styles.btnRow}>
                    <Button label="✓ Accept" onPress={handleAccept} style={[styles.modalBtn, { backgroundColor: THEME_COLORS.primary }]} />
                    <Button label="✗ Decline" onPress={handleDecline} variant="danger" style={styles.modalBtn} />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Rating Modal */}
        <Modal visible={showRating} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rate Your Rider</Text>
              <View style={styles.stars}>
                {[1,2,3,4,5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Text style={[styles.star, s <= rating && styles.starActive]}>{s <= rating ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button label="Submit" onPress={submitRating} style={styles.btn} />
              <Button label="Skip" onPress={() => { setShowRating(false); setRideId(null); setAppState('online'); }} variant="outline" style={{ marginTop: 8 }} />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  map: { flex: 1, minHeight: 280 },
  sheet: { maxHeight: '45%', backgroundColor: '#fff', padding: 20 },
  centeredContent: { alignItems: 'center', paddingVertical: 8 },
  offlineEmoji: { fontSize: 48, marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 8 },
  subtitle: { color: THEME_COLORS.subtext, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  btn: { width: '100%', marginTop: 8 },
  onlineBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  onlineText: { color: THEME_COLORS.primary, fontWeight: 'bold', fontSize: 12 },
  statusBadge: {
    backgroundColor: THEME_COLORS.primary, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12,
  },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  actionBtns: { gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center' },
  countdownCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: THEME_COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  countdownText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  requestInfo: { width: '100%', backgroundColor: THEME_COLORS.background, padding: 12, borderRadius: 10, marginBottom: 16 },
  reqLabel: { fontSize: 12, color: THEME_COLORS.subtext, fontWeight: '600' },
  reqValue: { fontSize: 14, color: THEME_COLORS.text, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1 },
  stars: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  star: { fontSize: 36, opacity: 0.3 },
  starActive: { opacity: 1 },
});
