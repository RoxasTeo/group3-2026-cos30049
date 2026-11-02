import { useSyncExternalStore } from 'react';
import { getSpeciesSnapshot, subscribeSpecies } from '../data/speciesReference';
export function useSpeciesReference() {
  return useSyncExternalStore(subscribeSpecies, getSpeciesSnapshot, getSpeciesSnapshot);
}
