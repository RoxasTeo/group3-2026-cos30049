import Constants from 'expo-constants';
import { Platform } from 'react-native';
export function apiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (!__DEV__) throw new Error('The API address has not been configured for this build.');
  const host = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) throw new Error('Set EXPO_PUBLIC_API_URL to your computer’s API address.');
  return `http://${host}:3000/api`;
}
