/** Replace this session-only sample repository with Ivan's persistent adapter later. */
export const recordStatuses = ['Draft', 'Pending sync', 'Synced', 'Failed'] as const;
export type RecordStatus = typeof recordStatuses[number];
export type PlantPhoto = { id: string; uri?: string; sampleLabel?: string };
export type PlantLocation = { latitude: number; longitude: number; accuracy?: number; sample?: boolean };
export type PlantRecord = {
  plantId: string;
  commonName: string;
  scientificName: string;
  family: string;
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
};
export type PlantRecordInput = Pick<PlantRecord, 'plantId' | 'commonName' | 'scientificName' | 'family' | 'conservationStatus' | 'description' | 'habitatNotes'>;
export type RecordFilter = 'All' | RecordStatus;
const sampleLocation: PlantLocation = { latitude: 3.81, longitude: 113.78, sample: true };
const makeSample = (plantId: string, commonName: string, status: RecordStatus, time: string, extra: Partial<PlantRecord> = {}): PlantRecord => ({
  plantId, commonName, status, scientificName: '', family: '', conservationStatus: 'Not assessed',
  description: '', habitatNotes: '', createdAt: time, updatedAt: time,
  photos: [], location: null, sample: true, ...extra,
});
let snapshot: readonly PlantRecord[] = [
  makeSample('NIAH-TEMP-004', 'Unidentified plant', 'Draft', '2026-10-16T10:42:00+08:00', { location: sampleLocation, photos: [{ id: 'sample-draft', sampleLabel: 'Sample photograph placeholder' }] }),
  makeSample('NIAH-PLANT-001', 'Meranti observation', 'Pending sync', '2026-10-16T09:15:00+08:00', { scientificName: 'Shorea sp. (unverified)', family: 'Dipterocarpaceae', description: 'Sample canopy tree observation; winged fruit near the base.', habitatNotes: 'Illustrative trail observation, not verified park inventory.', location: sampleLocation, photos: [{ id: 'sample-meranti', sampleLabel: 'Sample photograph placeholder' }] }),
  makeSample('NIAH-PLANT-009', 'Forest fern', 'Synced', '2026-10-15T14:30:00+08:00', { description: 'Sample fern observation on shaded limestone.', location: sampleLocation }),
  makeSample('NIAH-PLANT-011', 'Understorey palm', 'Failed', '2026-10-15T13:06:00+08:00', { description: 'Sample palm observation in damp understorey.', location: sampleLocation, syncError: 'Sample upload failure: connection interrupted.' }),
];
const listeners = new Set<() => void>();
const key = (id: string) => id.trim().toUpperCase();
const copy = (record: PlantRecord): PlantRecord => ({ ...record, photos: record.photos.map(p => ({ ...p })), location: record.location ? { ...record.location } : null });
export const getRecordsSnapshot = () => snapshot;
export function subscribePlantRecords(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getPlantRecord(id: string) { const record = snapshot.find(r => r.plantId === key(id)); return record ? copy(record) : undefined; }
export function selectPlantRecords(records: readonly PlantRecord[], search = '', filter: RecordFilter = 'All') {
  const term = search.trim().toLowerCase();
  return records.filter(r => (filter === 'All' || r.status === filter) && `${r.commonName} ${r.scientificName} ${r.plantId}`.toLowerCase().includes(term))
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
  return issues;
}
function publish(record?: PlantRecord) {
  snapshot = record ? [copy(record), ...snapshot.filter(r => r.plantId !== record.plantId)] : [...snapshot];
  listeners.forEach(listener => listener());
}
/** No client caller can set Synced/Failed. Only a future server-confirmed sync adapter may do that. */
export function savePlantRecord(input: PlantRecordInput, ready = false, mode: 'create' | 'edit' = 'create') {
  const plantId = key(input.plantId), existing = getPlantRecord(plantId);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(plantId)) throw new Error('Enter a valid plant ID (3-64 letters, numbers, hyphens or underscores).');
  if (mode === 'create' && existing) throw new Error('This plant ID already exists. Open the existing record instead.');
  if (mode === 'edit' && !existing) throw new Error('This draft no longer exists. Return to Records.');
  if (existing && existing.status !== 'Draft') throw new Error('Only drafts can be edited. This record is read-only.');
  const now = new Date().toISOString();
  const saved: PlantRecord = {
    ...input, plantId, commonName: input.commonName.trim() || 'Unidentified plant', scientificName: input.scientificName.trim(),
    family: input.family.trim(), conservationStatus: input.conservationStatus.trim(), description: input.description.trim(), habitatNotes: input.habitatNotes.trim(),
    status: ready ? 'Pending sync' : 'Draft', createdAt: existing?.createdAt ?? now, updatedAt: now,
    photos: existing?.photos ?? [], location: existing?.location ?? null, sample: existing?.sample ?? false,
  };
  if (ready) { const issues = readinessIssues(saved); if (issues.length) throw new Error(issues.join('\n')); }
  publish(saved);
  return copy(saved);
}
export function deletePlantDraft(id: string) {
  const record = getPlantRecord(id);
  if (!record) throw new Error('This draft no longer exists.');
  if (record.status !== 'Draft') throw new Error('Only drafts can be deleted.');
  snapshot = snapshot.filter(r => r.plantId !== record.plantId);
  publish();
}
