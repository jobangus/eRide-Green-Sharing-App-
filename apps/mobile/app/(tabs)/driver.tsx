import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
  type LatLng,
} from 'react-native-maps';
import * as Location from 'expo-location';
import {
  CarFront,
  MapPin,
  Star,
  Flag,
  Route,
  LocateFixed,
  CheckCircle2,
} from 'lucide-react-native';

import { useAuth } from '../../src/store/auth';
import { Button } from '../../src/components/ui/Button';
import { THEME_COLORS, DEFAULT_MAP_REGION } from '../../src/constants/config';
import { useSocketIO } from '../../src/hooks/useSocketIO';
import { computeRoute, formatDistance, formatDuration } from '../../src/services/route.service';
import type { WsRideRequest, WsRideStatusUpdate, RideStatus } from '@moride/shared';

type DriverAppState =
  | 'offline'
  | 'online'
  | 'request_incoming'
  | 'active_ride'
  | 'completed';

interface RouteSummary {
  distanceText: string;
  durationText: string;
}

interface RidePoint {
  lat: number;
  lng: number;
  address?: string;
}

const USE_TEST_LOCATION = true;

const TEST_DRIVER_LOCATION = {
  lat: -37.9105,
  lng: 145.1362,
  label: 'Monash Clayton Test Location',
};

export default function DriverScreen() {
  const { api } = useAuth();

  const [appState, setAppState] = useState<DriverAppState>('offline');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<WsRideRequest | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);

  const [activePickup, setActivePickup] = useState<RidePoint | null>(null);
  const [activeDropoff, setActiveDropoff] = useState<RidePoint | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  /**
   * Clears ride-related markers, route lines, and route summary
   * from the map and driver interface.
   *
   * @returns {void}
   */
  const clearRideVisuals = () => {
    setActivePickup(null);
    setActiveDropoff(null);
    setRouteCoords([]);
    setRouteSummary(null);
  };

  /**
   * Extracts pickup and dropoff information from an incoming ride request
   * and stores it for use in the map view and ride guidance UI.
   *
   * @param {WsRideRequest | null} requestData - ride request payload received from Socket.IO
   * @returns {void}
   */
  const extractRidePoints = (requestData: WsRideRequest | null) => {
    if (!requestData) return;

    const raw = requestData as any;

    setActivePickup({
      lat: raw.pickup_lat,
      lng: raw.pickup_lng,
      address: raw.pickup_address || 'Pickup Location',
    });

    if (
      typeof raw.dropoff_lat === 'number' &&
      typeof raw.dropoff_lng === 'number'
    ) {
      setActiveDropoff({
        lat: raw.dropoff_lat,
        lng: raw.dropoff_lng,
        address: raw.dropoff_address || 'Dropoff Location',
      });
    } else {
      setActiveDropoff(null);
    }
  };

  /**
   * Declines the currently pending ride request, stops the countdown timer,
   * clears ride visuals, and returns the driver to the online waiting state.
   *
   * @returns {void}
   */
  const handleDecline = () => {
    if (!pendingRequest) return;

    if (countdownRef.current) clearInterval(countdownRef.current);
    declineRide(pendingRequest.ride_id);
    setPendingRequest(null);
    clearRideVisuals();
    setAppState('online');
  };

  const { acceptRide, declineRide, sendLocation } = useSocketIO(
    {
      onRideRequest: (data: WsRideRequest) => {
        setPendingRequest(data);
        extractRidePoints(data);
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
          clearRideVisuals();
        }
      },
    },
    rideId || undefined
  );

  /**
   * Starts the accept/decline countdown for an incoming ride request.
   * Automatically declines the request when the timer reaches zero.
   *
   * @param {number} seconds - number of seconds before request timeout
   * @returns {void}
   */
  const startCountdown = (seconds: number) => {
    setCountdown(seconds);

    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * Places the driver online by requesting location permission,
   * setting the initial location, notifying the backend, and
   * starting live location updates when not using test mode.
   *
   * @returns {Promise<void>} resolves when online flow is completed
   */
  const goOnline = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is needed to drive.');
      return;
    }

    let lat: number;
    let lng: number;

    if (USE_TEST_LOCATION) {
      lat = TEST_DRIVER_LOCATION.lat;
      lng = TEST_DRIVER_LOCATION.lng;
    } else {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    }

    setCurrentLocation({ lat, lng });

    setLoading(true);
    try {
      await api.goOnline({ lat, lng });
      setAppState('online');

      if (!USE_TEST_LOCATION) {
        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 20,
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            setCurrentLocation({ lat: latitude, lng: longitude });

            sendLocation(latitude, longitude, rideId || undefined);
            api.updateDriverLocation(latitude, longitude).catch(() => {});
          }
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Places the driver offline, removes live location tracking,
   * clears ride visuals, and notifies the backend.
   *
   * @returns {Promise<void>} resolves when offline flow is completed
   */
  const goOffline = async () => {
    locationWatchRef.current?.remove();

    try {
      await api.goOffline();
    } catch {}

    clearRideVisuals();
    setAppState('offline');
  };

  /**
   * Accepts the pending ride request, stops the countdown,
   * stores ride information, and transitions the driver into
   * the active ride state.
   *
   * @returns {Promise<void>} resolves when accept flow completes
   */
  const handleAccept = async () => {
    if (!pendingRequest) return;

    if (countdownRef.current) clearInterval(countdownRef.current);

    extractRidePoints(pendingRequest);
    acceptRide(pendingRequest.ride_id);
    setRideId(pendingRequest.ride_id);
    setRideStatus('matched');
    setAppState('active_ride');
    setPendingRequest(null);
  };

  /**
   * Updates the current ride status through the backend
   * and reflects the new state in the driver UI.
   *
   * @param {'enroute' | 'arrived' | 'in_progress'} status - next ride stage to apply
   * @returns {Promise<void>} resolves when the status update completes
   */
  const updateStatus = async (status: 'enroute' | 'arrived' | 'in_progress') => {
    if (!rideId) return;

    try {
      await api.updateRideStatus(rideId, { status });
      setRideStatus(status);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  /**
   * Completes the active ride, updates ride state,
   * shows rider rating modal, and reports saved CO₂.
   *
   * @returns {Promise<void>} resolves when ride completion finishes
   */
  const completeRide = async () => {
    if (!rideId) return;

    try {
      const res = await api.completeRide(rideId);
      setRideStatus('completed');
      setAppState('completed');
      setShowRating(true);
      Alert.alert('Ride Complete', `CO₂ saved: ${res.co2_saved_kg} kg`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  /**
   * Submits the driver's rating for the rider after trip completion
   * and resets the driver back to the online waiting state.
   *
   * @returns {Promise<void>} resolves when rating submission finishes
   */
  const submitRating = async () => {
    if (!rideId) return;

    try {
      await api.rateRide(rideId, { score: rating as 1 | 2 | 3 | 4 | 5 });
      setShowRating(false);
      setRideId(null);
      setAppState('online');
      clearRideVisuals();
      Alert.alert('Thank you', 'Your rating has been submitted.');
    } catch {}
  };

  /**
   * Decodes an encoded Google polyline string into
   * a list of latitude and longitude points for map rendering.
   *
   * @param {string} encoded - encoded polyline string
   * @returns {LatLng[]} decoded coordinate list
   */
  const decodePolyline = (encoded: string): LatLng[] => {
    const points: LatLng[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  /**
   * Recomputes the live route guidance shown to the driver
   * based on the current ride stage and current GPS location.
   * Pickup is targeted before ride start, and dropoff after ride begins.
   */
  useEffect(() => {
    const updateRoute = async () => {
      if (!currentLocation || appState !== 'active_ride') {
        setRouteCoords([]);
        setRouteSummary(null);
        return;
      }

      let destination: RidePoint | null = null;

      if (rideStatus === 'matched' || rideStatus === 'enroute' || rideStatus === 'arrived') {
        destination = activePickup;
      } else if (rideStatus === 'in_progress') {
        destination = activeDropoff;
      }

      if (!destination) {
        setRouteCoords([]);
        setRouteSummary(null);
        return;
      }

      setRouteLoading(true);
      try {
        const route = await computeRoute({
          origin: {
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
          },
          destination: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
          travelMode: 'DRIVE',
        });

        if ('error' in route) {
          setRouteCoords([]);
          setRouteSummary(null);
        } else {
          setRouteCoords(decodePolyline(route.encodedPolyline));
          setRouteSummary({
            distanceText: formatDistance(route.distanceMeters),
            durationText: formatDuration(route.durationSeconds),
          });
        }
      } catch {
        setRouteCoords([]);
        setRouteSummary(null);
      } finally {
        setRouteLoading(false);
      }
    };

    updateRoute();
  }, [currentLocation, rideStatus, activePickup, activeDropoff, appState]);

  /**
   * Fits the map camera to relevant coordinates whenever the ride stage changes,
   * ensuring the driver and current destination remain visible on screen.
   */
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;

    let points: LatLng[] = [{ latitude: currentLocation.lat, longitude: currentLocation.lng }];

    if (appState === 'request_incoming' && activePickup) {
      points.push({ latitude: activePickup.lat, longitude: activePickup.lng });
    }

    if (appState === 'active_ride') {
      if (rideStatus === 'matched' || rideStatus === 'enroute' || rideStatus === 'arrived') {
        if (activePickup) {
          points.push({ latitude: activePickup.lat, longitude: activePickup.lng });
        }
      } else if (rideStatus === 'in_progress') {
        if (activeDropoff) {
          points.push({ latitude: activeDropoff.lat, longitude: activeDropoff.lng });
        }
      }
    }

    if (points.length >= 2) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
    }
  }, [currentLocation, activePickup, activeDropoff, rideStatus, appState]);

  /**
   * Removes active location tracking and countdown timers
   * when the driver screen unmounts.
   */
  useEffect(() => {
    return () => {
      locationWatchRef.current?.remove();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  /**
   * Returns a guidance message for the driver
   * based on the current ride status.
   *
   * @returns {string} stage-specific guidance text
   */
  const getStageText = () => {
    if (rideStatus === 'matched') return 'Ride accepted. Start driving to the pickup point.';
    if (rideStatus === 'enroute') return 'You are currently heading to the rider’s pickup location.';
    if (rideStatus === 'arrived') return 'You have arrived at pickup. Wait for the rider to board.';
    if (rideStatus === 'in_progress') return 'Ride is active. Continue driving to the destination.';
    return 'Waiting for the next trip stage.';
  };

  /**
   * Returns the label of the current destination
   * based on whether the driver is heading to pickup or dropoff.
   *
   * @returns {string | null} destination label for display
   */
  const getTargetLabel = () => {
    if (rideStatus === 'matched' || rideStatus === 'enroute' || rideStatus === 'arrived') {
      return activePickup?.address || 'Pickup Location';
    }
    if (rideStatus === 'in_progress') {
      return activeDropoff?.address || 'Dropoff Location';
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_MAP_REGION}
          showsUserLocation
        >
          {activePickup && (
            <Marker
              coordinate={{
                latitude: activePickup.lat,
                longitude: activePickup.lng,
              }}
              title="Pickup"
              pinColor={THEME_COLORS.primary}
            />
          )}

          {activeDropoff && (
            <Marker
              coordinate={{
                latitude: activeDropoff.lat,
                longitude: activeDropoff.lng,
              }}
              title="Dropoff"
              pinColor={THEME_COLORS.error}
            />
          )}

          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={THEME_COLORS.primary}
              strokeWidth={5}
            />
          )}
        </MapView>

        <ScrollView style={styles.sheet} showsVerticalScrollIndicator={false}>
          {appState === 'offline' && (
            <View style={styles.centeredContent}>
              <View style={styles.iconCircle}>
                <CarFront size={34} color={THEME_COLORS.primary} strokeWidth={2.2} />
              </View>

              <Text style={styles.sheetTitle}>Ready to Drive?</Text>
              <Text style={styles.subtitle}>
                Go online to start receiving ride requests from Monash students.
              </Text>

              <Button
                label="Go Online"
                onPress={goOnline}
                loading={loading}
                style={styles.btn}
              />
            </View>
          )}

          {appState === 'online' && (
            <View style={styles.centeredContent}>
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineText}>● ONLINE</Text>
              </View>

              <Text style={styles.sheetTitle}>Waiting for Requests</Text>
              <Text style={styles.subtitle}>
                You&apos;ll be notified when a nearby rider requests a ride.
              </Text>

              <Button
                label="Go Offline"
                onPress={goOffline}
                variant="outline"
                style={styles.btn}
              />
            </View>
          )}

          {appState === 'active_ride' && (
            <View>
              <Text style={styles.sheetTitle}>Active Ride</Text>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {rideStatus?.toUpperCase().replace('_', ' ')}
                </Text>
              </View>

              <View style={styles.liveCard}>
                <View style={styles.liveCardHeader}>
                  <LocateFixed size={16} color={THEME_COLORS.primary} />
                  <Text style={styles.liveCardTitle}>Live Trip Guidance</Text>
                </View>

                <Text style={styles.liveCardText}>{getStageText()}</Text>

                {getTargetLabel() && (
                  <View style={styles.targetRow}>
                    <MapPin size={14} color={THEME_COLORS.primary} />
                    <Text style={styles.targetText}>{getTargetLabel()}</Text>
                  </View>
                )}

                {routeLoading ? (
                  <Text style={styles.routeMetaText}>Updating route...</Text>
                ) : routeSummary ? (
                  <View style={styles.routeMetaRow}>
                    <View style={styles.routeMetaPill}>
                      <Route size={14} color={THEME_COLORS.primary} />
                      <Text style={styles.routeMetaText}>{routeSummary.distanceText}</Text>
                    </View>

                    <View style={styles.routeMetaPill}>
                      <Flag size={14} color={THEME_COLORS.primary} />
                      <Text style={styles.routeMetaText}>{routeSummary.durationText}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionBtns}>
                {rideStatus === 'matched' && (
                  <Button
                    label="Start Driving to Pickup"
                    onPress={() => updateStatus('enroute')}
                    style={styles.btn}
                  />
                )}

                {rideStatus === 'enroute' && (
                  <Button
                    label="I've Arrived at Pickup"
                    onPress={() => updateStatus('arrived')}
                    style={styles.btn}
                  />
                )}

                {rideStatus === 'arrived' && (
                  <Button
                    label="Begin Ride"
                    onPress={() => updateStatus('in_progress')}
                    style={styles.btn}
                  />
                )}

                {rideStatus === 'in_progress' && (
                  <Button
                    label="Complete Ride"
                    onPress={completeRide}
                    style={styles.btn}
                  />
                )}
              </View>
            </View>
          )}
        </ScrollView>

        <Modal visible={appState === 'request_incoming'} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.countdownCircle}>
                <Text style={styles.countdownText}>{countdown}s</Text>
              </View>

              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <CarFront size={22} color={THEME_COLORS.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.modalTitle}>New Ride Request</Text>
              </View>

              {pendingRequest && (
                <>
                  <View style={styles.requestInfo}>
                    <View style={styles.reqLabelRow}>
                      <MapPin size={14} color={THEME_COLORS.primary} strokeWidth={2.2} />
                      <Text style={styles.reqLabel}>Pickup</Text>
                    </View>

                    <Text style={styles.reqValue}>
                      {activePickup?.address ||
                        `${pendingRequest.pickup_lat.toFixed(4)}, ${pendingRequest.pickup_lng.toFixed(4)}`}
                    </Text>

                    {activeDropoff && (
                      <>
                        <View style={[styles.reqLabelRow, { marginTop: 10 }]}>
                          <Flag size={14} color={THEME_COLORS.primary} strokeWidth={2.2} />
                          <Text style={styles.reqLabel}>Dropoff</Text>
                        </View>
                        <Text style={styles.reqValue}>
                          {activeDropoff.address ||
                            `${activeDropoff.lat.toFixed(4)}, ${activeDropoff.lng.toFixed(4)}`}
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={styles.btnRow}>
                    <Button
                      label="Accept"
                      onPress={handleAccept}
                      style={[styles.modalBtn, { backgroundColor: THEME_COLORS.primary }]}
                    />
                    <Button
                      label="Decline"
                      onPress={handleDecline}
                      variant="danger"
                      style={styles.modalBtn}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showRating} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rate Your Rider</Text>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                    <Star
                      size={30}
                      color={s <= rating ? THEME_COLORS.primary : '#C7D2CC'}
                      fill={s <= rating ? THEME_COLORS.primary : 'transparent'}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Button label="Submit" onPress={submitRating} style={styles.btn} />
              <Button
                label="Skip"
                onPress={() => {
                  setShowRating(false);
                  setRideId(null);
                  setAppState('online');
                  clearRideVisuals();
                }}
                variant="outline"
                style={{ marginTop: 8, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  map: {
    flex: 1,
    minHeight: 280,
  },
  sheet: {
    maxHeight: '48%',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  centeredContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    color: THEME_COLORS.subtext,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  btn: {
    width: '100%',
    marginTop: 8,
  },
  onlineBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  onlineText: {
    color: THEME_COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  statusBadge: {
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  liveCard: {
    backgroundColor: '#F6FBF7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCEFE0',
  },
  liveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  liveCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  liveCardText: {
    fontSize: 13,
    lineHeight: 19,
    color: THEME_COLORS.subtext,
    marginBottom: 10,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  targetText: {
    flex: 1,
    fontSize: 13,
    color: THEME_COLORS.text,
    fontWeight: '600',
  },
  routeMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  routeMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#E8F5E9',
  },
  routeMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B5E20',
  },
  actionBtns: {
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
  },
  countdownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: THEME_COLORS.text,
  },
  requestInfo: {
    width: '100%',
    backgroundColor: THEME_COLORS.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  reqLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqLabel: {
    fontSize: 12,
    color: THEME_COLORS.subtext,
    fontWeight: '600',
  },
  reqValue: {
    fontSize: 14,
    color: THEME_COLORS.text,
    marginTop: 6,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
  },
  stars: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 18,
  },
});