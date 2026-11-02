import { useSession } from '../auth/SessionProvider';
import RecordsConnectionNotice from '../components/records/RecordsConnectionNotice';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { recordStatuses, selectPlantRecords, type PlantRecord, type RecordFilter } from '../data/plantRecords';
import { usePlantRecords } from '../hooks/usePlantRecords';
import { colors, RecordBadge, RecordButton, RecordIcon, SampleNotice, recordDate, ui } from '../components/records/RecordUI';

export default function RecordsScreen() {
  const records = usePlantRecords();
  const { recordsState, refreshRecords } = useSession();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RecordFilter>('All');
  const filtered = useMemo(() => selectPlantRecords(records, search, filter), [records, search, filter]);
  function open(record: PlantRecord) { router.push({ pathname: '/plant/[plantId]', params: { plantId: record.plantId } }); }
  const newRecord = () => router.push('/plant/new');
  return <View style={styles.root}><SampleNotice /><FlatList refreshing={recordsState === 'loading'} onRefresh={() => { void refreshRecords(); }} data={filtered} keyExtractor={r => r.plantId} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
    ListHeaderComponent={<View style={styles.header}>
      <Text style={ui.eyebrow}>YOUR FIELD COLLECTION</Text>
      <View style={styles.heading}><Text accessibilityRole="header" style={ui.title}>Records</Text><RecordButton label="+ New record" primary onPress={newRecord} /></View>
      <Text style={ui.subtitle}>Your server records and unsent local drafts.</Text><RecordsConnectionNotice />
      <View style={styles.search}><RecordIcon name="search" /><TextInput accessibilityLabel="Search records by plant name or ID" placeholder="Search plant name or ID" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} style={styles.input} />{search !== '' && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={styles.clear}><Text style={ui.muted}>×</Text></Pressable>}</View>
      <View accessibilityLabel="Filter records by status" style={styles.filters}>{(['All', ...recordStatuses] as const).map(status => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: status === filter }} onPress={() => setFilter(status)} style={[styles.filter, status === filter && styles.filterActive]}><Text style={[styles.filterText, status === filter && styles.filterTextActive]}>{status === 'Draft' ? `Drafts · ${records.filter(r => r.status === 'Draft').length}` : status}</Text></Pressable>)}</View>
      <View style={styles.count}><Text accessibilityLiveRegion="polite" style={ui.caption}>{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</Text><Text style={ui.caption}>Most recent first</Text></View>
    </View>}
    ListEmptyComponent={recordsState === 'loading' || recordsState === 'error' ? undefined : <View style={styles.empty}><RecordIcon name="search" size={28} /><Text style={ui.sectionTitle}>{records.length ? 'No records found' : 'No records yet'}</Text><Text style={ui.paragraph}>{records.length ? 'Try a different plant name, ID or status.' : 'Create a draft to begin your field collection.'}</Text>{records.length ? <RecordButton label="Reset search & filters" onPress={() => { setSearch(''); setFilter('All'); }} /> : <RecordButton label="Create first record" primary onPress={newRecord} />}</View>}
    renderItem={({ item }) => <View style={styles.card}>
      <View style={styles.rowTop}><Text style={styles.id}>{item.plantId}</Text><RecordBadge status={item.status} /></View>
      <View style={styles.recordBody}><View style={styles.thumb}><RecordIcon name={item.photos.length ? 'photo' : 'leaf'} size={23} /></View><View style={styles.names}><Text style={styles.name}>{item.commonName || 'Unidentified plant'}</Text><Text style={styles.latin}>{item.scientificName || 'Not identified yet'}</Text><View style={styles.meta}><Text style={ui.caption}>{recordDate(item.updatedAt)}</Text><Text style={ui.caption}>{item.location ? 'GPS attached' : 'GPS missing'}</Text></View></View></View>
      <View style={styles.rowBottom}><Text style={styles.context}>{item.status === 'Draft' ? 'Continue collecting details' : item.status === 'Failed' ? 'Upload failed · Copy retained' : item.status === 'Synced' ? (item.sample ? 'Demo server record' : `Review: ${item.reviewStatus ?? 'Pending'}`) : 'Awaiting upload'}</Text><Pressable accessibilityRole="button" accessibilityLabel={`View details for ${item.commonName}, ${item.plantId}`} onPress={() => open(item)} style={styles.link}><Text style={styles.linkText}>View details →</Text></Pressable></View>
      {item.status === 'Draft' && <RecordButton label="Continue draft" onPress={() => router.push({ pathname: '/plant/new', params: { plantId: item.plantId, edit: 'true' } })} />}
    </View>} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, list: { padding: 20, paddingBottom: 28, gap: 12 }, header: { gap: 10, marginBottom: 2 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 11, marginTop: 8 }, input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 12, paddingRight: 10, color: colors.ink, fontSize: 16 }, clear: { padding: 12, minWidth: 44, alignItems: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }, filter: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 24, justifyContent: 'center' }, filterActive: { backgroundColor: colors.forest, borderColor: colors.forest }, filterText: { color: colors.ink, fontSize: 12 }, filterTextActive: { color: '#FFFFFF' }, count: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  card: { ...ui.panel, gap: 12 }, rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, id: { color: colors.muted, fontSize: 10, flexShrink: 1 }, recordBody: { flexDirection: 'row', gap: 12 }, thumb: { backgroundColor: colors.soft, width: 44, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, names: { flex: 1 }, name: { fontSize: 16, fontWeight: '600', color: colors.ink }, latin: { fontSize: 12, fontStyle: 'italic', color: colors.muted, marginTop: 3 }, meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 9 },
  rowBottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 6, gap: 8 }, context: { color: colors.muted, fontSize: 11, flexShrink: 1 }, link: { minHeight: 44, justifyContent: 'center' }, linkText: { color: colors.forest, fontSize: 12, fontWeight: '600' }, empty: { alignItems: 'center', gap: 14, paddingVertical: 32 },
});
