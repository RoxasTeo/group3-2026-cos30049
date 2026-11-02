import type { PlantPhoto } from '../data/plantRecords';
export async function photoData(photo: PlantPhoto): Promise<string> {
  if (!photo.uri) throw new Error('A photograph is missing. Replace it in the draft.');
  if (photo.uri.startsWith('data:')) return photo.uri;
  const response = await fetch(photo.uri);
  if (!response.ok) throw new Error('Could not read the photograph.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not preserve photograph.')); reader.readAsDataURL(blob); });
}
export async function preservePhotos(photos: PlantPhoto[]): Promise<PlantPhoto[]> {
  return Promise.all(photos.map(async photo => ({ ...photo, uri: await photoData(photo) })));
}
