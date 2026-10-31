import * as FileSystem from 'expo-file-system/legacy';
import type { PlantPhoto } from '../data/plantRecords';
export async function preservePhotos(photos: PlantPhoto[]): Promise<PlantPhoto[]> {
  const folder = `${FileSystem.documentDirectory}plant-photos/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  return Promise.all(photos.map(async photo => {
    if (!photo.uri || photo.uri.startsWith(folder) || photo.uri.startsWith('data:')) return photo;
    const uri = `${folder}${photo.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await FileSystem.copyAsync({ from: photo.uri, to: uri });
    return { ...photo, uri };
  }));
}
export async function photoData(photo: PlantPhoto): Promise<string> {
  if (!photo.uri) throw new Error('A photograph is missing. Return this record to a draft and replace it.');
  if (photo.uri.startsWith('data:')) return photo.uri;
  return `data:${photo.mimeType || 'image/jpeg'};base64,${await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 })}`;
}
