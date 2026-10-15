// Fictional demonstration records, not verified park inventory or conservation assessments.
export const statuses = ['Not Evaluated', 'Data Deficient', 'Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Extinct in the Wild', 'Extinct']
export const seedSpecies = [
  ['Demo Shorea', 'Shorea demoensis', 'Dipterocarpaceae', 'Endangered', 'Lowland forest'],
  ['Demo Fig', 'Ficus exemplaris', 'Moraceae', 'Least Concern', 'Forest edge'],
  ['Demo Orchid', 'Bulbophyllum specimen', 'Orchidaceae', 'Vulnerable', 'Limestone forest'],
  ['Demo Palm', 'Licuala exemplaris', 'Arecaceae', 'Near Threatened', 'Understorey'],
  ['Demo Fern', 'Asplenium demoensis', 'Aspleniaceae', 'Not Evaluated', 'Limestone forest'],
  ['Demo Pitcher Plant', 'Nepenthes exemplaris', 'Nepenthaceae', 'Vulnerable', 'Lowland forest'],
].map(([commonName, scientificName, family, status, habitat], i) => ({
  id: `demo-${i+1}`, commonName, scientificName, family, status, habitat,
  genus: scientificName.split(' ')[0], description: 'Fictional species record for demonstrating the conservation officer workflow. Replace with verified species information.',
  ecologicalNotes: '', culturalNotes: '', photo: '', photoName: '',
  updatedAt: `2026-09-${25-i}T08:00:00.000Z`
}))
