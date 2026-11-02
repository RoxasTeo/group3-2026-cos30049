import { Redirect } from 'expo-router';

// Keep older Home links working after merging the Records feature.
export default function NewPlantRecordRedirect() {
  return <Redirect href="/plant/new" />;
}
