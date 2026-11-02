import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { PlantLocation, PlantPhoto } from '../data/plantRecords';
import { photoValidation } from './capturePolicy';

export class CaptureError extends Error {
  constructor(message: string, public kind: 'denied' | 'services-off' | 'timeout' | 'unavailable' | 'invalid', public settings = false) { super(message); }
}
export async function captureLocation(): Promise<PlantLocation> {
  if (Platform.OS !== 'web' && !await Location.hasServicesEnabledAsync()) throw new CaptureError('Location services are off. Turn them on and retry.', 'services-off');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new CaptureError('Location access was denied. Allow it in device or browser settings, then retry.', 'denied', !permission.canAskAgain);
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const { latitude, longitude, accuracy } = fix.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new CaptureError('The device did not provide a valid GPS fix. Please retry.', 'unavailable');
  return { latitude, longitude, accuracy: accuracy ?? undefined, capturedAt: new Date(fix.timestamp).toISOString(), sample: false };
}
let photoSequence = 0;
export async function capturePhoto(source: 'camera' | 'gallery'): Promise<PlantPhoto | null> {
  // Keep the browser picker call within the user's activation: no permission await on web.
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CaptureError('Camera access was denied. Allow camera access in settings or choose a photograph.', 'denied', !permission.canAskAgain);
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1, base64: true, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new CaptureError('No photograph was returned. Please try again.', 'unavailable');
  const error = photoValidation(asset);
  if (error) throw new CaptureError(error, 'invalid');
  return { id: `photo-${Date.now()}-${++photoSequence}`, uri: asset.uri, caption: '', source, fileName: asset.fileName ?? undefined, mimeType: asset.mimeType ?? undefined, capturedAt: new Date().toISOString() };
}
