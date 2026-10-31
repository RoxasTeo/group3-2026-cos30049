import { useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { searchSpecies } from '../data/speciesReference';
import { colors, RecordBack, RecordButton, RecordFrame, RecordScroll, ui } from '../components/records/RecordUI';
export default function SpeciesReferenceScreen() {
  const [query, setQuery] = useState(''), [error, setError] = useState('');
  const entries = searchSpecies(query);
  return <RecordFrame><RecordScroll>
    <RecordBack label="Home" onPress={() => router.navigate('/navigation/botanist/home')} />
    <Text style={ui.eyebrow}>OFFLINE REFERENCE</Text><Text style={ui.title}>Plant species</Text>
    <Text style={ui.paragraph}>A starter reference of three plants. These entries support comparison; they are not a verified Niah inventory or an automatic identification. Confirm your identification before submitting it.</Text>
    <TextInput accessibilityLabel="Search species by name or family" value={query} onChangeText={setQuery} placeholder="Search name, family or growth form" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, borderRadius: 12, padding: 14, color: colors.ink, fontSize: 16 }} />
    <Text style={ui.caption}>{entries.length} matching entries · available offline</Text>
    {!entries.length && <Text style={ui.paragraph}>No match. Try a common name, scientific name, family or growth form.</Text>}
    {entries.map(entry => <View key={entry.id} style={ui.panel}>
      <Text style={ui.sectionTitle}>{entry.commonName}</Text><Text style={ui.paragraph}>{entry.scientificName}</Text>
      <Text style={ui.caption}>{entry.family} · {entry.growthForm}</Text>
      <Text style={ui.paragraph}>{entry.traits}</Text><Text style={ui.paragraph}>Habitat: {entry.habitat}</Text>
      <RecordButton label="Start observation with this name" onPress={() => router.push({ pathname: '/plant/new', params: { reference: entry.id } })} />
      <RecordButton label="Read NParks source (internet required)" onPress={() => { void Linking.openURL(entry.source).catch(() => setError('Could not open the reference. Try again when online.')); }} />
    </View>)}
    {!!error && <Text style={ui.error}>{error}</Text>}
    <Text style={ui.caption}>Summarized from NParks Flora & Fauna Web, checked 31 October 2026. Reference descriptions are not copied into your field observations.</Text>
  </RecordScroll></RecordFrame>;
}
