/** Account-scoped records. Commit to durable storage before notifying the UI. */
export const recordStatuses = ['Draft', 'Pending sync', 'Synced', 'Failed'] as const;
export type RecordStatus = typeof recordStatuses[number];
// remoteIndex: the photograph is stored on the server and downloaded on demand (records synced from another device).
export type PlantPhoto = { id: string; uri?: string; remoteIndex?: number; sampleLabel?: string; caption?: string; source?: 'camera' | 'gallery'; fileName?: string; mimeType?: string; capturedAt?: string };
export type PlantLocation = { latitude: number; longitude: number; accuracy?: number; sample?: boolean; capturedAt?: string };
export type PlantRecord = {
  plantId: string;
  /** Original tag; shared observations use a separate internal key to avoid collisions. */
  plantTag?: string;
  observationId?: number;
  collectorId?: number;
  isOwnRecord?: boolean;
  commonName: string;
  scientificName: string;
  family: string;
  heightMetres?: string;
  morphology?: string;
  conservationStatus: string;
  description: string;
  habitatNotes: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  photos: PlantPhoto[];
  location: PlantLocation | null;
  sample: boolean;
  syncError?: string;
  /** Server-only: officer review of a synced record on the Web portal. */
  reviewStatus?: 'Pending' | 'Changes requested' | 'Approved' | 'Rejected';
  reviewNotes?: string;
  reference?: string;
};
export type PlantRecordInput = Pick<PlantRecord, 'plantId' | 'commonName' | 'scientificName' | 'family' | 'conservationStatus' | 'description' | 'habitatNotes' | 'heightMetres' | 'morphology'> & { photos?: PlantPhoto[]; location?: PlantLocation | null };
export type RecordFilter = 'All' | 'Recorded by me' | RecordStatus;
let snapshot: readonly PlantRecord[] = [];
let remoteIds = new Set<string>();
let persist: ((value: string) => void) | undefined;
let generation = 0;
let revision = 0;
const uploading = new Set<string>();
export const recordsRevision = () => revision;
export function lockUpload(id: string) { uploading.add(id); }
export function unlockUpload(id: string) { uploading.delete(id); }
export const recordsGeneration = () => generation;
export function openPlantRecords(raw: string | null, writer: (value: string) => void) {
  const stored = raw ? JSON.parse(raw) : { records: [], remoteIds: [] };
  if (!Array.isArray(stored.records) || !Array.isArray(stored.remoteIds)) throw new Error('Cannot read saved records. Your stored data has been kept.');
  generation++; uploading.clear(); persist = writer; snapshot = stored.records.map(copy); remoteIds = new Set(stored.remoteIds);
  listeners.forEach(listener => listener());
}
export function resetPlantRecords() { generation++; uploading.clear(); persist = undefined; snapshot = []; remoteIds = new Set(); listeners.forEach(listener => listener()); }
function commit(records: readonly PlantRecord[], ids = remoteIds) {
  // A full disk or browser quota error must never pretend that a save succeeded.
  persist?.(JSON.stringify({ records, remoteIds: [...ids] }));
  revision++; snapshot = records; remoteIds = ids; listeners.forEach(listener => listener());
}
export function replaceServerRecords(records: readonly PlantRecord[]) {
  const local = snapshot.filter(record => !remoteIds.has(record.plantId));
  if (records.some(record => local.some(draft => draft.plantId === record.plantId))) throw new Error('A local record has the same ID as a server record. Your local changes were kept. Sync the queue before refreshing.');
  commit([...local, ...records.map(copy)], new Set(records.map(record => record.plantId)));
}
export function confirmPlantUpload(record: PlantRecord) {
  commit([copy(record), ...snapshot.filter(r => r.plantId !== record.plantId)], new Set([...remoteIds, record.plantId]));
}
export function failPlantUpload(id: string, message: string) {
  const record = getPlantRecord(id);
  if (record && !remoteIds.has(id)) publish({ ...record, status: 'Failed', syncError: message });
}
export function returnToDraft(id: string) {
  if (uploading.has(id)) throw new Error('This record is uploading. Wait for sync to finish.');
  const record = getPlantRecord(id);
  if (!record || remoteIds.has(id) || !['Failed', 'Pending sync'].includes(record.status)) throw new Error('Only unsent records can return to a draft.');
  publish({ ...record, status: 'Draft', syncError: undefined });
}
export function isServerRecord(id: string) { return remoteIds.has(id); }
const listeners = new Set<() => void>();
const key = (id: string) => id.trim().toUpperCase();
const copy = (record: PlantRecord): PlantRecord => ({ ...record, photos: record.photos.map(p => ({ ...p })), location: record.location ? { ...record.location } : null });
export const getRecordsSnapshot = () => snapshot;
export function subscribePlantRecords(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getPlantRecord(id: string) { const record = snapshot.find(r => r.plantId === key(id)); return record ? copy(record) : undefined; }
export function findPlantByQr(id: string) {
  const normalized = key(id);
  // New QR tags identify the exact server observation, even if collectors reused a tag.
  const server = /^OBS:(\d+)$/.exec(normalized);
  const record = server ? snapshot.find(r => r.observationId === Number(server[1]))
    : snapshot.find(r => r.plantId === normalized) ?? snapshot.find(r => r.plantTag === normalized);
  return record ? copy(record) : undefined;
}
export function selectPlantRecords(records: readonly PlantRecord[], search = '', filter: RecordFilter = 'All') {
  const term = search.trim().toLowerCase();
  return records.filter(r => (filter === 'All' || (filter === 'Recorded by me' ? r.isOwnRecord !== false : r.status === filter)) && `${r.commonName} ${r.scientificName} ${r.plantId} ${r.plantTag ?? ''}`.toLowerCase().includes(term))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
let sequence = 0;
export function createTemporaryPlantId() {
  let id: string;
  do { id = `NIAH-TEMP-${Date.now().toString(36)}-${(++sequence).toString(36)}`.toUpperCase(); } while (getPlantRecord(id));
  return id;
}
export function readinessIssues(record: Pick<PlantRecord, 'plantId' | 'description' | 'location'>): string[] {
  const issues: string[] = [];
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(key(record.plantId))) issues.push('Enter a valid plant ID (3-64 letters, numbers, hyphens or underscores).');
  if (!record.description.trim()) issues.push('Add field observations before marking ready.');
  const location = record.location;
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) issues.push('Capture a GPS location before marking ready.');
  else if (location.accuracy != null && (!Number.isFinite(location.accuracy) || location.accuracy < 0 || location.accuracy > 30)) issues.push('GPS accuracy is low. Update the location before marking ready (target ±30 m).');
  return issues;
}
function publish(record?: PlantRecord) {
  commit(record ? [copy(record), ...snapshot.filter(r => r.plantId !== record.plantId)] : [...snapshot]);
}
/** Form saves cannot set Synced; only the upload adapter confirms server acceptance. */
export function savePlantRecord(input: PlantRecordInput, ready = false, mode: 'create' | 'edit' = 'create') {
  const plantId = key(input.plantId), existing = getPlantRecord(plantId);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(plantId)) throw new Error('Enter a valid plant ID (3-64 letters, numbers, hyphens or underscores).');
  if (mode === 'create' && existing) throw new Error('This plant ID already exists. Open the existing record instead.');
  if (mode === 'edit' && !existing) throw new Error('This draft no longer exists. Return to Records.');
  if (existing && existing.status !== 'Draft') throw new Error('Only drafts can be edited. This record is read-only.');
  if (input.heightMetres?.trim() && (!Number.isFinite(Number(input.heightMetres)) || Number(input.heightMetres) < 0 || Number(input.heightMetres) > 150)) throw new Error('Height must be between 0 and 150 metres.');
  const now = new Date().toISOString();
  const saved: PlantRecord = {
    ...input, plantId, commonName: input.commonName.trim() || 'Unidentified plant', scientificName: input.scientificName.trim(),
    family: input.family.trim(), conservationStatus: input.conservationStatus.trim(), description: input.description.trim(), habitatNotes: input.habitatNotes.trim(),
    status: ready ? 'Pending sync' : 'Draft', createdAt: existing?.createdAt ?? now, updatedAt: now,
    photos: input.photos?.map(photo => ({ ...photo })) ?? existing?.photos ?? [], location: input.location === undefined ? existing?.location ?? null : input.location ? { ...input.location } : null, sample: existing?.sample ?? false,
  };
  if (saved.photos.length > 4) throw new Error('Attach up to 4 photographs.');
  if (ready) { const issues = readinessIssues(saved); if (issues.length) throw new Error(issues.join('\n')); }
  publish(saved);
  return copy(saved);
}
export function deletePlantDraft(id: string) {
  const record = getPlantRecord(id);
  if (!record) throw new Error('This draft no longer exists.');
  if (record.status !== 'Draft') throw new Error('Only drafts can be deleted.');
  commit(snapshot.filter(r => r.plantId !== record.plantId));
}
