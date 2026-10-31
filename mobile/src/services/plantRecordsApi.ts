import type { PlantRecord } from '../data/plantRecords';
export class RecordsAuthError extends Error {}
function validRecord(value: unknown): value is PlantRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as PlantRecord;
  return typeof r.plantId === 'string' && /^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(r.plantId)
    && ['commonName','scientificName','family','conservationStatus','description','habitatNotes'].every(key => typeof (r as unknown as Record<string, unknown>)[key] === 'string')
    && r.status === 'Synced' && typeof r.sample === 'boolean'
    && typeof r.createdAt === 'string' && Number.isFinite(Date.parse(r.createdAt))
    && typeof r.updatedAt === 'string' && Number.isFinite(Date.parse(r.updatedAt))
    && Array.isArray(r.photos) && r.photos.every(p => p && typeof p.id === 'string' && (p.uri === undefined || typeof p.uri === 'string'))
    && (r.location === null || (typeof r.location === 'object' && Number.isFinite(r.location.latitude) && Math.abs(r.location.latitude) <= 90 && Number.isFinite(r.location.longitude) && Math.abs(r.location.longitude) <= 180));
}
// Fetch every page before replacing the cache, so a failed later page cannot drop existing records.
export async function fetchPlantRecords(baseUrl: string, token: string): Promise<PlantRecord[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const result: PlantRecord[] = [];
  const seen = new Set<string>();
  try {
    for (let offset = 0; offset <= 100000; offset += 100) {
      let response: Response;
      try { response = await fetch(`${baseUrl}/plants?limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }); }
      catch { throw new Error('Could not load records. Check the backend and your connection, then retry.'); }
      if (response.status === 401) throw new RecordsAuthError('Your sign-in has expired. Please sign in again.');
      if (!response.ok) throw new Error('The server could not load your records. Please retry.');
      const data = await response.json();
      if (!Array.isArray(data.records) || data.records.length > 100 || !data.records.every(validRecord)) throw new Error('The server returned invalid plant records.');
      for (const record of data.records as PlantRecord[]) {
        if (seen.has(record.plantId)) throw new Error('Records changed during loading. Please refresh again.');
        seen.add(record.plantId); result.push(record);
      }
      if (data.records.length < 100) return result;
    }
    throw new Error('Too many records to load. Please contact your administrator.');
  } finally { clearTimeout(timer); }
}

export async function uploadPlantRecord(baseUrl: string, token: string, record: PlantRecord, photos: { id: string; data: string; caption: string }[]): Promise<PlantRecord> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  const { plantId, commonName, scientificName, family, conservationStatus, description, habitatNotes, heightMetres = '', morphology = '' } = record;
  const fix = record.location;
  const location = fix ? { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, capturedAt: fix.capturedAt } : null;
  try {
    let response: Response;
    try { response = await fetch(`${baseUrl}/plants`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ plantId, commonName, scientificName, family, conservationStatus, description, habitatNotes, heightMetres, morphology, location, photos }) }); }
    catch { throw new Error('Upload interrupted. Your record is kept on this device. Retry when connected.'); }
    if (response.status === 401) throw new RecordsAuthError('Sign out and sign in again to renew your session. Saved records will be kept.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed. Please retry.');
    if (!validRecord(data.record) || data.record.plantId !== plantId) throw new Error('The server did not confirm this record. Please retry.');
    return data.record;
  } finally { clearTimeout(timer); }
}
