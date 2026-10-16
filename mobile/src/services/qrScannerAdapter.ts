/** Scanner boundary: replace with expo-camera's CameraView when native scanning is scheduled. */
export type CameraState = 'loading' | 'denied' | 'unavailable' | 'error';
export const scannerAdapter = { requestCamera: async (): Promise<CameraState> => 'unavailable' };
export function plantIdFromQr(raw: string) { const value = raw.trim().split('/').filter(Boolean).pop()?.replace(/^plant:/i, '') ?? ''; return /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value) ? value.toUpperCase() : null; }
