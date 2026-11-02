import * as FileSystem from 'expo-file-system/legacy';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import type { PlantPhoto } from '../data/plantRecords';
import { deviceKeyBytes } from './localEncryption';

// Saved photos are encrypted files (.enc: AES-256-GCM with the device key), readable only by this app install.
async function encryptionKey() {
  const bytes = deviceKeyBytes();
  if (!bytes) throw new Error('The device encryption key is unavailable. Sign in again.');
  return AESEncryptionKey.import(bytes);
}
export async function preservePhotos(photos: PlantPhoto[]): Promise<PlantPhoto[]> {
  const folder = `${FileSystem.documentDirectory}plant-photos/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const key = await encryptionKey();
  return Promise.all(photos.map(async photo => {
    if (!photo.uri || photo.uri.startsWith(folder) || photo.uri.startsWith('data:')) return photo;
    const uri = `${folder}${photo.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.enc`;
    const plain = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
    const sealed = await aesEncryptAsync(plain, key);
    await FileSystem.writeAsStringAsync(uri, String(await sealed.combined('base64')));
    return { ...photo, uri };
  }));
}
export async function photoData(photo: PlantPhoto): Promise<string> {
  if (!photo.uri) throw new Error('A photograph is missing. Return this record to a draft and replace it.');
  if (photo.uri.startsWith('data:')) return photo.uri;
  const mime = photo.mimeType || 'image/jpeg';
  if (photo.uri.endsWith('.enc')) {
    const sealed = AESSealedData.fromCombined(await FileSystem.readAsStringAsync(photo.uri));
    return `data:${mime};base64,${String(await aesDecryptAsync(sealed, await encryptionKey(), { output: 'base64' }))}`;
  }
  // Unsaved captures and photos saved before encryption are plain files.
  return `data:${mime};base64,${await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 })}`;
}
// Encrypted files cannot be shown by <Image> directly; decrypt them for display.
export const isEncryptedPhoto = (photo: PlantPhoto) => !!photo.uri?.endsWith('.enc');
