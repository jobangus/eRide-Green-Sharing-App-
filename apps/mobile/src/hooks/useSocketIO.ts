/**
 * Socket.IO hook for real-time ride updates and location streaming.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';
import type { WsRideStatusUpdate, WsLocationUpdate, WsRideCancel, WsRideRequest } from '@moride/shared';

const SOCKET_URL = API_BASE_URL;

export type SocketEventHandlers = {
  onRideRequest?: (data: WsRideRequest) => void;
  onRideStatusUpdate?: (data: WsRideStatusUpdate) => void;
  onLocationUpdate?: (data: WsLocationUpdate) => void;
  onRideCancel?: (data: WsRideCancel) => void;
};

export function useSocketIO(handlers: SocketEventHandlers, rideId?: string) {
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(async () => {
    const token = await SecureStore.getItemAsync('moride_access_token');
    if (!token) return;

    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      query: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[socket] Connected:', socket.id);
      if (rideId) {
        socket.emit('join_ride_room', { ride_id: rideId });
      }
      // Register driver room
      socket.emit('join_driver_room', {});
    });

    socket.on('ride_request', (data: WsRideRequest) => {
      handlers.onRideRequest?.(data);
    });

    socket.on('ride_status_update', (data: WsRideStatusUpdate) => {
      handlers.onRideStatusUpdate?.(data);
    });

    socket.on('location_update', (data: WsLocationUpdate) => {
      handlers.onLocationUpdate?.(data);
    });

    socket.on('ride_cancel', (data: WsRideCancel) => {
      handlers.onRideCancel?.(data);
    });

    socket.on('disconnect', () => console.log('[socket] Disconnected'));
    socket.on('connect_error', (err) => console.error('[socket] Error:', err.message));

    socketRef.current = socket;
  }, [rideId]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const joinRide = useCallback((rid: string) => {
    socketRef.current?.emit('join_ride_room', { ride_id: rid });
  }, []);

  const acceptRide = useCallback((rid: string) => {
    socketRef.current?.emit('ride_accept', { ride_id: rid });
  }, []);

  const declineRide = useCallback((rid: string) => {
    socketRef.current?.emit('ride_decline', { ride_id: rid });
  }, []);

  const sendLocation = useCallback((lat: number, lng: number, rid?: string) => {
    socketRef.current?.emit('driver_location', { lat, lng, ride_id: rid });
  }, []);

  return { emit, joinRide, acceptRide, declineRide, sendLocation };
}
