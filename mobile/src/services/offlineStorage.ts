import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { fromBase64, toBase64 } from './localEncryption';
export const readRecords = (key: string) => Storage.getItemSync(key);
export const writeRecords = (key: string, value: string) => Storage.setItemSync(key, value);
export const readSession = () => SecureStore.getItemAsync('niah.session');
export const writeSession = (value: string) => SecureStore.setItemAsync('niah.session', value);
export const clearSession = () => SecureStore.deleteItemAsync('niah.session');
// One random 256-bit key per installation, kept only in the platform keychain.
// It survives sign-out so saved fieldwork stays readable for the next sign-in.
export async function loadDeviceKey(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync('niah.device-key');
  if (stored) return fromBase64(stored);
  const key = await getRandomBytesAsync(32);
  await SecureStore.setItemAsync('niah.device-key', toBase64(key));
  return key;
}
