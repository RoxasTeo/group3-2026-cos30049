export type PlantRecord = { plantId: string; commonName: string; scientificName: string; family: string; conservationStatus: string; description: string; habitatNotes: string };
const records = new Map<string, PlantRecord>([['NIAH-PLANT-001', { plantId: 'NIAH-PLANT-001', commonName: 'Meranti', scientificName: 'Shorea spp.', family: 'Dipterocarpaceae', conservationStatus: 'Vulnerable', description: 'Tall rainforest tree with winged fruit.', habitatNotes: 'Niah National Park, trail marker 4.' }]]);
const key = (id: string) => id.trim().toUpperCase();
export const getPlantRecord = (id: string) => records.get(key(id));
export const savePlantRecord = (record: PlantRecord) => { const saved = { ...record, plantId: key(record.plantId) }; records.set(saved.plantId, saved); return saved; };
