import { SessionProvider } from '../auth/SessionProvider';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return <SessionProvider><SafeAreaProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider></SessionProvider>;
}
