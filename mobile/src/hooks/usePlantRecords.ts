import { useSyncExternalStore } from 'react';
import { getRecordsSnapshot, subscribePlantRecords } from '../data/plantRecords';
export function usePlantRecords() {
  return useSyncExternalStore(subscribePlantRecords, getRecordsSnapshot, getRecordsSnapshot);
}
