import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Alert, Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../src/store/auth';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { THEME_COLORS, DEFAULT_MAP_REGION } from '../../src/constants/config';
import { useSocketIO } from '../../src/hooks/useSocketIO';
import type { RideStatus, WsRideStatusUpdate, WsLocationUpdate } from '../../../packages/shared/src';

type AppState = 'idle' | 'selecting' | 'estimate' | 'matching' | 'active' | 'completed';

interface LocationPoint { lat: number; lng: number; address?: string }

export default function RiderScreen() {
  const { api, user } = useAuth();
  const [appState, setAppState] = useState<AppState>('idle');
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [dropoff, setDropoff] = useState<LocationPoint | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);
  const mapRef = useRef<MapView>(null);

  const socketHandlers = {
    onRideStatusUpdate: (data: WsRideStatusUpdate) => {
      if (data.ride_id !== rideId) return;
      setRideStatus(data.status as RideStatus);
      if (data.status === 'matched' || data.status === 'confirmed') {
        setAppState('active');
      } else if (data.status === 'completed') {
        setAppState('completed');
        setShowRating(true);
      } else if (data.status === 'cancelled') {
        Alert.alert('Ride Cancelled', 'Your ride was cancelled.');
        setAppState('idle');
        setRideId(null);
      } else if (data.status === 'no_drivers') {
        Alert.alert('No Drivers', data.message || 'No drivers available right now. We\'ll keep trying...');
      }
    },
    onLocationUpdate: (data: WsLocationUpdate) => {
      if (data.ride_id !== rideId) return;
      setDriverLocation({ lat: data.lat, lng: data.lng });
    },
  };

  const socket = useSocketIO(socketHandlers, rideId || undefined);

  useEffect(() => {
    if (rideId) socket.joinRide(rideId);
  }, [rideId]);

  const requestMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is needed to find your pickup.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setPickup({ lat: loc.coords.latitude, lng: loc.coords.longitude, address: 'Current Location' });
  };

  const getEstimate = async () => {
    if (!pickup || !dropoff) { Alert.alert('Error', 'Select pickup and dropoff locations'); return; }
    setLoading(true);
    try {
      const est = await api.estimateRide({
        pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      });
      setEstimate(est);
      setAppState('estimate');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestRide = async () => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    try {
      const res = await api.requestRide({
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_address: pickup.address,
        dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_address: dropoff.address,
      });
      setRideId(res.ride_id);
      setRideStatus('matching');
      setAppState('matching');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async () => {
    if (!rideId) return;
    Alert.alert('Cancel Ride', 'Are you sure?', [
      { text: 'Keep Ride', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive', onPress: async () => {
          try {
            await api.cancelRide(rideId, { reason: 'Cancelled by rider' });
            setAppState('idle');
            setRideId(null);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        }
      }
    ]);
  };

  const submitRating = async () => {
    if (!rideId) return;
    try {
      await api.rateRide(rideId, { score: rating as 1|2|3|4|5 });
      setShowRating(false);
      setAppState('idle');
      setRideId(null);
      Alert.alert('Thank you!', 'Your rating has been submitted. 🌿');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const setMonashPickup = (name: string, lat: number, lng: number) => {
    setPickup({ lat, lng, address: name });
  };

  const setMonashDropoff = (name: string, lat: number, lng: number) => {
    setDropoff({ lat, lng, address: name });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_MAP_REGION}
          showsUserLocation
        >
          {pickup && <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Pickup" pinColor={THEME_COLORS.primary} />}
          {dropoff && <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} title="Dropoff" pinColor={THEME_COLORS.error} />}
          {driverLocation && <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} title="Driver" >
            <Text style={{ fontSize: 28 }}>🚗</Text>
          </Marker>}
        </MapView>

        {/* Bottom Sheet */}
        <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">

          {appState === 'idle' && (
            <View>
              <Text style={styles.sheetTitle}>Book a Ride</Text>
              <Text style={styles.label}>📍 Pickup (quick select):</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setMonashPickup('Clayton Campus', -37.9105, 145.1362)}>
                  <Text style={styles.quickText}>🎓 Clayton</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setMonashPickup('Caulfield Campus', -37.8777, 145.0452)}>
                  <Text style={styles.quickText}>🎓 Caulfield</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={requestMyLocation}>
                  <Text style={styles.quickText}>📍 My Location</Text>
                </TouchableOpacity>
              </View>
              {pickup && <Text style={styles.selectedText}>✓ Pickup: {pickup.address}</Text>}

              <Text style={styles.label}>🏁 Dropoff (quick select):</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setMonashDropoff('Clayton Campus', -37.9105, 145.1362)}>
                  <Text style={styles.quickText}>🎓 Clayton</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setMonashDropoff('Caulfield Campus', -37.8777, 145.0452)}>
                  <Text style={styles.quickText}>🎓 Caulfield</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setMonashDropoff('Melbourne CBD', -37.8136, 144.9631)}>
                  <Text style={styles.quickText}>🌆 CBD</Text>
                </TouchableOpacity>
              </View>
              {dropoff && <Text style={styles.selectedText}>✓ Dropoff: {dropoff.address}</Text>}

              <Button label="Get Fare Estimate" onPress={getEstimate} loading={loading} style={styles.btn} />
            </View>
          )}

          {appState === 'estimate' && estimate && (
            <View>
              <Text style={styles.sheetTitle}>Ride Summary</Text>
              <View style={styles.fareCard}>
                <View style={styles.fareRow}><Text style={styles.fareLabel}>Distance</Text><Text style={styles.fareValue}>{estimate.distance_km} km</Text></View>
                <View style={styles.fareRow}><Text style={styles.fareLabel}>ETA</Text><Text style={styles.fareValue}>{estimate.eta_minutes} min</Text></View>
                <View style={styles.fareRow}><Text style={styles.fareLabel}>Base Fare</Text><Text style={styles.fareValue}>${estimate.fare.base_fare.toFixed(2)}</Text></View>
                {estimate.fare.surge_multiplier > 1 && (
                  <View style={styles.fareRow}><Text style={styles.fareLabel}>Surge ({estimate.fare.surge_multiplier}x)</Text><Text style={[styles.fareValue, { color: THEME_COLORS.error }]}>⚡</Text></View>
                )}
                {estimate.fare.is_peak && (
                  <View style={styles.fareRow}><Text style={styles.fareLabel}>Peak Hour ({estimate.fare.time_multiplier}x)</Text><Text style={styles.fareValue}>⏰</Text></View>
                )}
                <View style={[styles.fareRow, styles.fareTotalRow]}>
                  <Text style={styles.fareTotalLabel}>Total Fare</Text>
                  <Text style={styles.fareTotalValue}>${estimate.fare.final_fare.toFixed(2)}</Text>
                </View>
              </View>
              <Button label="Request Ride" onPress={requestRide} loading={loading} style={styles.btn} />
              <Button label="← Change Locations" onPress={() => setAppState('idle')} variant="outline" style={{ marginTop: 8 }} />
            </View>
          )}

          {appState === 'matching' && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={THEME_COLORS.primary} />
              <Text style={styles.matchingTitle}>Finding your driver…</Text>
              <Text style={styles.matchingSubtext}>We're searching for nearby drivers. This may take a moment.</Text>
              <Button label="Cancel Request" onPress={cancelRide} variant="danger" style={{ marginTop: 20 }} />
            </View>
          )}

          {appState === 'active' && (
            <View>
              <Text style={styles.sheetTitle}>Ride in Progress</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{rideStatus?.toUpperCase().replace('_', ' ')}</Text>
              </View>
              {rideStatus === 'enroute' && <Text style={styles.statusDesc}>🚗 Driver is on the way to pick you up</Text>}
              {rideStatus === 'arrived' && <Text style={styles.statusDesc}>📍 Driver has arrived at your pickup point!</Text>}
              {rideStatus === 'in_progress' && <Text style={styles.statusDesc}>🛣️ Enjoy your ride to {dropoff?.address}</Text>}
              <Button label="Cancel Ride" onPress={cancelRide} variant="danger" style={{ marginTop: 12 }} />
            </View>
          )}

          {appState === 'completed' && (
            <View style={styles.centerContent}>
              <Text style={styles.completedEmoji}>✅</Text>
              <Text style={styles.matchingTitle}>Ride Complete!</Text>
              <Text style={styles.matchingSubtext}>Thanks for riding with Mo-Ride. Rate your driver below.</Text>
            </View>
          )}
        </ScrollView>

        {/* Rating Modal */}
        <Modal visible={showRating} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rate Your Driver</Text>
              <Text style={styles.modalSubtitle}>How was your ride?</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Text style={[styles.star, s <= rating && styles.starActive]}>{s <= rating ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button label="Submit Rating" onPress={submitRating} style={styles.btn} />
              <Button label="Skip" onPress={() => { setShowRating(false); setAppState('idle'); setRideId(null); }} variant="outline" style={{ marginTop: 8 }} />
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
  sheet: { maxHeight: '55%', backgroundColor: '#fff', padding: 20 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', color: THEME_COLORS.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: THEME_COLORS.subtext, marginBottom: 8 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  quickBtn: {
    backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: THEME_COLORS.primaryLight,
  },
  quickText: { fontSize: 12, color: THEME_COLORS.primary, fontWeight: '600' },
  selectedText: { color: THEME_COLORS.primary, fontSize: 13, marginBottom: 12 },
  btn: { marginTop: 8 },
  fareCard: { backgroundColor: THEME_COLORS.background, borderRadius: 12, padding: 16, marginBottom: 8 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fareLabel: { color: THEME_COLORS.subtext, fontSize: 14 },
  fareValue: { color: THEME_COLORS.text, fontSize: 14, fontWeight: '500' },
  fareTotalRow: { borderTopWidth: 1, borderTopColor: THEME_COLORS.border, paddingTop: 10, marginTop: 4 },
  fareTotalLabel: { fontSize: 16, fontWeight: 'bold', color: THEME_COLORS.text },
  fareTotalValue: { fontSize: 20, fontWeight: 'bold', color: THEME_COLORS.primary },
  centerContent: { alignItems: 'center', paddingVertical: 16 },
  matchingTitle: { fontSize: 18, fontWeight: 'bold', color: THEME_COLORS.text, marginTop: 12 },
  matchingSubtext: { color: THEME_COLORS.subtext, textAlign: 'center', marginTop: 6 },
  completedEmoji: { fontSize: 48 },
  statusBadge: {
    backgroundColor: THEME_COLORS.primary, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8,
  },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  statusDesc: { color: THEME_COLORS.subtext, fontSize: 14, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { color: THEME_COLORS.subtext, textAlign: 'center', marginBottom: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  star: { fontSize: 36, opacity: 0.3 },
  starActive: { opacity: 1 },
});
