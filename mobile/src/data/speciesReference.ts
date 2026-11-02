/** Species from the Web knowledge system, cached on the device so identification works offline. */
export type SpeciesEntry = {
  id: number; commonName: string; scientificName: string; family: string; genus: string; conservationStatus: string;
  habitat: string; description: string; ecologicalInfo: string; culturalSignificance: string;
};
type Storage = { read: (key: string) => string | null; write: (key: string, value: string) => void };
type Snapshot = { species: readonly SpeciesEntry[]; downloadedAt: string | null };
let snapshot: Snapshot = { species: [], downloadedAt: null };
let persist: ((value: string) => void) | undefined;
const listeners = new Set<() => void>();
const textKeys = ['commonName', 'scientificName', 'family', 'genus', 'conservationStatus', 'habitat', 'description', 'ecologicalInfo', 'culturalSignificance'] as const;

function validEntry(value: unknown): value is SpeciesEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return Number.isInteger(entry.id) && textKeys.every(key => typeof entry[key] === 'string');
}
function publish(next: Snapshot) { snapshot = next; listeners.forEach(listener => listener()); }

export function openSpeciesCache(baseUrl: string, storage: Storage) {
  const key = `niah.species.v1:${baseUrl}`;
  persist = value => storage.write(key, value);
  try {
    const stored = JSON.parse(storage.read(key) ?? 'null');
    publish(stored && Array.isArray(stored.species) && stored.species.every(validEntry) ? stored : { species: [], downloadedAt: null });
  } catch { publish({ species: [], downloadedAt: null }); }
}
export function resetSpecies() { persist = undefined; publish({ species: [], downloadedAt: null }); }

export async function refreshSpecies(baseUrl: string, token: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${baseUrl}/mobile/species.php`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (!response.ok) throw new Error('Could not download the species list.');
    const data = await response.json();
    if (!Array.isArray(data.species) || !data.species.every(validEntry)) throw new Error('The server returned an invalid species list.');
    const next = { species: data.species as SpeciesEntry[], downloadedAt: new Date().toISOString() };
    persist?.(JSON.stringify(next));
    publish(next);
  } finally { clearTimeout(timer); }
}

export const getSpeciesSnapshot = () => snapshot;
export function subscribeSpecies(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const findSpecies = (id: string | undefined) => snapshot.species.find(entry => String(entry.id) === id);
export function searchSpecies(species: readonly SpeciesEntry[], query: string) {
  const term = query.trim().toLowerCase();
  return species.filter(s => `${s.commonName} ${s.scientificName} ${s.family} ${s.genus}`.toLowerCase().includes(term));
}
