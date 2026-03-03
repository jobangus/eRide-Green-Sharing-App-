/**
 * Auth state management using React context + SecureStore.
 * SecureStore uses iOS Keychain / Android Keystore under the hood.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { MoRideApiClient, initApiClient, UserProfile } from '../../../packages/shared/src';
import { API_BASE_URL } from '../constants/config';

const ACCESS_TOKEN_KEY = 'moride_access_token';
const REFRESH_TOKEN_KEY = 'moride_refresh_token';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  api: MoRideApiClient;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const api = initApiClient(API_BASE_URL);

  // Restore tokens on app start
  useEffect(() => {
    (async () => {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        ]);
        if (accessToken && refreshToken) {
          api.setTokens(accessToken, refreshToken);
          api.onTokenRefresh(async (at, rt) => {
            await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, at);
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, rt);
          });
          api.onAuthFailure(async () => {
            setUser(null);
            await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
          });
          const profile = await api.getMe();
          setUser(profile);
        }
      } catch {
        // Token invalid or expired on boot
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refresh_token);
    api.onTokenRefresh(async (at, rt) => {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, at);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, rt);
    });
    const profile = await api.getMe();
    setUser(profile);
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    api.clearTokens();
    setUser(null);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  };

  const refreshProfile = async () => {
    const profile = await api.getMe();
    setUser(profile);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      api, login, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
