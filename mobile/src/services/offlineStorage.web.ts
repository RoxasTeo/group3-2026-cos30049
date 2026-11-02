// Browser preview storage; native devices use SQLite and SecureStore instead.
export const readRecords = (key: string) => localStorage.getItem(key);
export const writeRecords = (key: string, value: string) => localStorage.setItem(key, value);
export const readSession = async () => sessionStorage.getItem('niah.session');
export const writeSession = async (value: string) => sessionStorage.setItem('niah.session', value);
export const clearSession = async () => sessionStorage.removeItem('niah.session');
// Browsers have no keychain, so the preview does not encrypt local data.
export const loadDeviceKey = async (): Promise<Uint8Array | null> => null;
