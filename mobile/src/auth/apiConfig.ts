import Constants from 'expo-constants';
import { Platform } from 'react-native';
export function apiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (!__DEV__) throw new Error('The API address has not been configured for this build.');
  const host = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) throw new Error('Set EXPO_PUBLIC_API_URL to your computer’s API address.');
  const port = process.env.EXPO_PUBLIC_API_PORT?.trim() || '3000';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('EXPO_PUBLIC_API_PORT must be a valid port number.');
  return `http://${host}:${port}/api`;
}

// Explicit development migration only: the old demo database was imported into MySQL.
// Do not enable this when switching to an unrelated server or production database.
export function previousApiBaseUrl(): string | null {
  const port = process.env.EXPO_PUBLIC_MIGRATE_FROM_API_PORT?.trim();
  if (!__DEV__ || !port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) return null;
  const current = new URL(apiBaseUrl());
  if (current.port === port) return null;
  current.port = port;
  return current.toString().replace(/\/+$/, '');
}
