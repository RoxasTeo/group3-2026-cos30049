/** Small offline starter reference; not a verified Niah species inventory. Sources checked 2026-10-31. */
export const speciesReference = [
  { id: 'asplenium-nidus', commonName: "Bird’s nest fern", scientificName: 'Asplenium nidus var. nidus', family: 'Aspleniaceae', growthForm: 'Fern', traits: 'Fronds form a rosette on a stout rhizome. Narrow sori follow veins on the upper half of the frond.', habitat: 'An epiphytic fern found from low elevations to about 1,700 metres.', source: 'https://www.nparks.gov.sg/florafaunaweb/flora/1/5/1541' },
  { id: 'dillenia-suffruticosa', commonName: 'Simpoh air', scientificName: 'Dillenia suffruticosa', family: 'Dilleniaceae', growthForm: 'Shrub', traits: 'Large leaves with prominent parallel secondary veins. Flowers have five yellow petals; ripe fruit opens into a star shape.', habitat: 'Forest margins, stream edges, marshes and secondary forest.', source: 'https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2847' },
  { id: 'dillenia-indica', commonName: 'Elephant apple', scientificName: 'Dillenia indica', family: 'Dilleniaceae', growthForm: 'Tree', traits: 'Toothed leaves with parallel secondary veins, reddish peeling bark, and large white flowers opening at night.', habitat: 'Stream and river margins in forest, up to about 500 metres.', source: 'https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2842' },
] as const;
export function searchSpecies(query: string) {
  const term = query.trim().toLowerCase();
  return speciesReference.filter(s => `${s.commonName} ${s.scientificName} ${s.family} ${s.growthForm}`.toLowerCase().includes(term));
}
