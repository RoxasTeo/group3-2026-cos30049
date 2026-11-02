type Storage = { read: (key: string) => string | null; write: (key: string, value: string) => void };
export function readAccountRecords(user: { id: number; email: string }, baseUrl: string, previousBaseUrl: string | null, storage: Storage) {
  const accountKey = (url: string) => `niah.records.v1:${url}:${user.id}:${user.email}`;
  const key = accountKey(baseUrl);
  let raw = storage.read(key);
  if (raw === null && previousBaseUrl && previousBaseUrl !== baseUrl) {
    raw = storage.read(accountKey(previousBaseUrl));
    if (raw !== null) {
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored.records) || !Array.isArray(stored.remoteIds)) throw new Error('Cannot migrate saved records. Original data was kept.');
      storage.write(key, raw); // Persist the copy first; preserve the original cache.
    }
  }
  return { key, raw };
}
