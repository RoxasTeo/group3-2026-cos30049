export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const GPS_ACCURACY_TARGET = 30;
export function photoValidation(asset: { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number; base64?: string | null; file?: { size: number } }): string | null {
  if (!asset.uri) return 'The selected photograph could not be read.';
  const mime = asset.mimeType?.toLowerCase();
  const extension = asset.fileName?.split('.').pop()?.toLowerCase();
  if (mime ? !['image/jpeg', 'image/png', 'image/webp'].includes(mime) : !extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return 'Choose a JPG, PNG or WebP photograph.';
  const estimated = asset.base64 ? Math.floor(asset.base64.length * 3 / 4) - (asset.base64.endsWith('==') ? 2 : asset.base64.endsWith('=') ? 1 : 0) : undefined;
  const size = asset.fileSize ?? asset.file?.size ?? estimated;
  if (size == null) return 'The photograph size could not be checked. Please choose another.';
  if (size > MAX_PHOTO_BYTES) return 'Choose a photograph up to 5 MB.';
  return null;
}
