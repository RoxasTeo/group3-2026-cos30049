import Constants from 'expo-constants';
import { Platform } from 'react-native';
// The shared PHP backend (Biodiversity-Web/backend/public) serves the mobile API under /api/mobile.
export function apiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (!__DEV__) throw new Error('The API address has not been configured for this build.');
  const host = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) throw new Error('Set EXPO_PUBLIC_API_URL to your computer’s API address.');
  const port = process.env.EXPO_PUBLIC_API_PORT?.trim() || '8080';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('EXPO_PUBLIC_API_PORT must be a valid port number.');
  return `http://${host}:${port}/api`;
}
