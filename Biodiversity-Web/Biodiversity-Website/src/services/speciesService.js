import { ref } from 'vue'
import { seedSpecies, statuses } from '../data/mockSpecies'
const KEY = 'niah-species-demo-v1'
export const storageWarning = ref('')
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return structuredClone(seedSpecies)
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows) || rows.some(r => !r || typeof r.id !== 'string' || typeof r.scientificName !== 'string' || typeof r.commonName !== 'string' || typeof r.family !== 'string' || !statuses.includes(r.status))) throw Error()
    return rows
  } catch { storageWarning.value = 'Saved demo data could not be read. Sample records are shown; saving may replace the unreadable data.'; return structuredClone(seedSpecies) }
}
export const species = ref(load())
function persist(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)) }
  catch { throw new Error('Could not save in this browser. Storage may be full or disabled. Try a smaller photo, or enable browser storage.') }
  species.value = next
  storageWarning.value = ''
}
export function saveSpecies(record) {
  const clean = Object.fromEntries(Object.entries(record).map(([k,v]) => [k, typeof v === 'string' ? v.trim() : v]))
  if (!clean.scientificName || !clean.commonName || !clean.family || !clean.description || !statuses.includes(clean.status)) throw new Error('Complete all required fields.')
  if (species.value.some(r => r.id !== clean.id && r.scientificName.toLowerCase() === clean.scientificName.toLowerCase())) throw new Error('A species with this scientific name already exists.')
  const saved = { ...clean, id: clean.id || crypto.randomUUID(), updatedAt: new Date().toISOString() }
  persist(clean.id ? species.value.map(r => r.id === clean.id ? saved : r) : [saved, ...species.value])
  return saved
}
export function deleteSpecies(id) { persist(species.value.filter(r => r.id !== id)) }
