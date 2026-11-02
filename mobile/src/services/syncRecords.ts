import { confirmPlantUpload, failPlantUpload, getRecordsSnapshot, getPlantRecord, recordsGeneration, lockUpload, unlockUpload } from '../data/plantRecords';
import { photoData } from './photoStorage';
import { uploadPlantRecord, RecordsAuthError } from './plantRecordsApi';
let running = false;
export async function syncRecords(baseUrl: string, token: string): Promise<string> {
  if (running) return 'A sync is already running.';
  running = true;
  const generation = recordsGeneration();
  let sent = 0, failed = 0;
  try {
    const queue = getRecordsSnapshot().filter(r => r.status === 'Pending sync' || r.status === 'Failed');
    for (const queued of queue) {
      const record = getPlantRecord(queued.plantId);
      if (!record || !['Pending sync', 'Failed'].includes(record.status)) continue;
      if (generation !== recordsGeneration()) return 'Account changed; sync stopped.';
      lockUpload(record.plantId);
      try {
        const photos = await Promise.all(record.photos.map(async p => ({ id: p.id, caption: p.caption || '', data: await photoData(p) })));
        if (generation !== recordsGeneration()) return 'Account changed; sync stopped.';
        const saved = await uploadPlantRecord(baseUrl, token, record, photos);
        if (generation !== recordsGeneration()) return 'Account changed; sync stopped.';
        // Keep this device's photo files so the synced copy displays offline without downloading.
        const local = new Map(record.photos.map(p => [p.id, p]));
        confirmPlantUpload({ ...saved, photos: saved.photos.map(p => ({ ...local.get(p.id), ...p, uri: local.get(p.id)?.uri ?? p.uri })) }); sent++;
      } catch (error) {
        if (generation !== recordsGeneration()) return 'Account changed; sync stopped.';
        const message = error instanceof Error ? error.message : 'Upload failed.';
        failPlantUpload(record.plantId, message); failed++;
        if (error instanceof RecordsAuthError) return message;
      } finally { if (generation === recordsGeneration()) unlockUpload(record.plantId); }
    }
    return `${sent} uploaded. ${failed} failed. ${failed ? 'Retry failed records when connected.' : 'Your queue is up to date.'}`;
  } finally { running = false; }
}
