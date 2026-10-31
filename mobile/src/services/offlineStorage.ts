import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
export const readRecords = (key: string) => Storage.getItemSync(key);
export const writeRecords = (key: string, value: string) => Storage.setItemSync(key, value);
export const readSession = () => SecureStore.getItemAsync('niah.session');
export const writeSession = (value: string) => SecureStore.setItemAsync('niah.session', value);
export const clearSession = () => SecureStore.deleteItemAsync('niah.session');
