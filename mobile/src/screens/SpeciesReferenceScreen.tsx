import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { searchSpecies } from '../data/speciesReference';
import { useSpeciesReference } from '../hooks/useSpeciesReference';
import { useSession } from '../auth/SessionProvider';
import { colors, RecordBack, RecordButton, RecordFrame, RecordScroll, recordDate, ui } from '../components/records/RecordUI';

// Shared by the Botanist reference page and the Conservation Officer Species tab.
export function SpeciesReferenceList({ onStart }: { onStart?: (speciesId: number) => void }) {
  const [query, setQuery] = useState('');
  const { species, downloadedAt } = useSpeciesReference();
  const { recordsState, refreshRecords } = useSession();
  const entries = searchSpecies(species, query);
  return <>
    <Text style={ui.eyebrow}>KNOWLEDGE SYSTEM · AVAILABLE OFFLINE</Text><Text accessibilityRole="header" style={ui.title}>Plant species</Text>
    <Text style={ui.paragraph}>Species maintained by conservation officers on the Web portal. Compare features before you record an identification.</Text>
    <RecordButton label={recordsState === 'loading' ? 'Refreshing…' : 'Refresh from server'} disabled={recordsState === 'loading'} onPress={() => { void refreshRecords(); }} />
    <TextInput accessibilityLabel="Search species by name, family or genus" value={query} onChangeText={setQuery} placeholder="Search common or scientific name" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, borderRadius: 12, padding: 14, color: colors.ink, fontSize: 16 }} />
    <Text style={ui.caption}>{entries.length} matching species · {downloadedAt ? `downloaded ${recordDate(downloadedAt)}` : 'not downloaded yet — connect and refresh'}</Text>
    {!entries.length && <Text style={ui.paragraph}>{species.length ? 'No match. Try a common name, scientific name, family or genus.' : 'No species are saved on this device yet.'}</Text>}
    {entries.map(entry => <View key={entry.id} style={ui.panel}>
      <Text style={ui.sectionTitle}>{entry.commonName}</Text><Text style={[ui.paragraph, { fontStyle: 'italic' }]}>{entry.scientificName}</Text>
      <Text style={ui.caption}>{[entry.family, entry.genus].filter(Boolean).join(' · ')} · {entry.conservationStatus}</Text>
      <Text style={ui.paragraph}>{entry.description}</Text>
      {!!entry.habitat && <Text style={ui.paragraph}>Habitat: {entry.habitat}</Text>}
      {!!entry.ecologicalInfo && <Text style={ui.paragraph}>Ecology: {entry.ecologicalInfo}</Text>}
      {!!entry.culturalSignificance && <Text style={ui.paragraph}>Cultural significance: {entry.culturalSignificance}</Text>}
      {onStart && <RecordButton label="Start observation with this species" onPress={() => onStart(entry.id)} />}
    </View>)}
  </>;
}

export default function SpeciesReferenceScreen() {
  return <RecordFrame><RecordScroll>
    <RecordBack label="Home" onPress={() => router.navigate('/navigation/botanist/home')} />
    <SpeciesReferenceList onStart={id => router.push({ pathname: '/plant/new', params: { reference: String(id) } })} />
  </RecordScroll></RecordFrame>;
}
