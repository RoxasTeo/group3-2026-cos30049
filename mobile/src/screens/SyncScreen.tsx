import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, RecordBadge, RecordIcon, recordDate } from '../components/records/RecordUI';
import { selectPlantRecords } from '../data/plantRecords';
import { usePlantRecords } from '../hooks/usePlantRecords';

const filters = ['Queue', 'Failed', 'Synced'] as const;
type SyncFilter = typeof filters[number];

export default function SyncScreen() {
  const records = usePlantRecords();
  const [filter, setFilter] = useState<SyncFilter>('Queue');
  const pending = records.filter(record => record.status === 'Pending sync').length;
  const failed = records.filter(record => record.status === 'Failed').length;
  const synced = records.filter(record => record.status === 'Synced').length;
  const drafts = records.filter(record => record.status === 'Draft').length;
  // Read the same store as Home and Records. Never simulate a successful upload.
  const visibleRecords = selectPlantRecords(records).filter(record => filter === 'Queue'
    ? record.status === 'Pending sync' || record.status === 'Failed'
    : record.status === filter);
  const openRecords = () => router.push({ pathname: '/navigation/[role]/[tab]', params: { role: 'botanist', tab: 'records' } });

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>YOUR FIELDWORK, CONNECTED</Text>
      <Text accessibilityRole="header" style={s.title}>Sync records</Text>
      <Text style={s.subtitle}>Review your records before they reach the cloud.</Text>

      <View style={s.connectionCard}>
        <View style={s.connectionHeading}>
          <View style={s.icon}><RecordIcon name="clock" size={23} color={colors.forest} /></View>
          <View style={s.flex}><Text style={s.sectionTitle}>Cloud sync unavailable</Text><Text style={s.caption}>Service not connected yet</Text></View>
        </View>
        <Text style={s.description}>You can review the queue here. Uploading and retrying will be available when cloud sync is connected.</Text>
        <View style={s.lastSync}><Text style={s.caption}>Last successful sync</Text><Text style={s.lastValue}>Not available</Text></View>
      </View>

      <View style={s.stats}>
        {[{ label: 'Pending', count: pending }, { label: 'Failed', count: failed }, { label: 'Synced', count: synced }].map(item => (
          <View key={item.label} style={s.stat}><Text style={[s.count, item.label === 'Failed' && failed > 0 && s.errorText]}>{item.count.toString().padStart(2, '0')}</Text><Text style={s.statLabel}>{item.label}</Text></View>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={s.disabledButton}>
        <Text style={s.buttonText}>Sync all records</Text>
      </Pressable>
      <Text style={s.buttonHint}>Uploads are unavailable in this preview.</Text>

      <Text accessibilityRole="header" style={[s.sectionTitle, s.queueHeading]}>Sync activity</Text>
      <View style={s.filters}>
        {filters.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[s.filter, filter === item && s.selectedFilter]}><Text style={[s.filterText, filter === item && s.selectedFilterText]}>{item}{item === 'Queue' ? ` (${pending + failed})` : ''}</Text></Pressable>)}
      </View>
      <View style={s.list}>
        {visibleRecords.length === 0 ? <View style={s.empty}><RecordIcon name="check" size={26} color={colors.forest} /><Text style={s.sectionTitle}>{filter === 'Queue' ? 'No records in the queue' : filter === 'Failed' ? 'No failed records' : 'No synced records'}</Text><Text style={s.emptyCopy}>{filter === 'Queue' ? 'Complete a draft and mark it ready to add it here.' : 'Records with this status will appear here.'}</Text></View>
          : visibleRecords.map((record, index) => (
            <Pressable key={record.plantId} accessibilityRole="button" accessibilityLabel={`Open ${record.commonName}, ${record.status}`} onPress={() => router.push({ pathname: '/plant/[plantId]', params: { plantId: record.plantId } })} style={({ pressed }) => [s.record, index > 0 && s.divider, pressed && s.pressed]}>
              <View style={s.recordHeading}><Text style={s.recordName}>{record.commonName || 'Unidentified plant'}</Text><Text style={s.arrow}>→</Text></View>
              <Text style={s.recordMeta}>{record.plantId}{record.sample ? ' · SAMPLE' : ''}</Text>
              <View style={s.recordStatus}><RecordBadge status={record.status} /><Text style={s.recordMeta}>Updated {recordDate(record.updatedAt)}</Text></View>
              {record.status === 'Failed' && <Text style={s.failure}>{record.syncError || 'This record needs another upload attempt.'} Retry is unavailable until cloud sync is connected.</Text>}
            </Pressable>
          ))}
      </View>

      <Pressable accessibilityRole="button" onPress={openRecords} style={({ pressed }) => [s.draftsCard, pressed && s.pressed]}>
        <RecordIcon name="edit" color={colors.forest} size={21} /><View style={s.flex}><Text style={s.sectionTitle}>{drafts} {drafts === 1 ? 'draft' : 'drafts'} outside the queue</Text><Text style={s.description}>Finish your observations and mark them ready in Records.</Text></View><Text style={s.arrow}>→</Text>
      </Pressable>
      <View style={s.notice}><Text style={s.noticeLabel}>SESSION-ONLY PREVIEW</Text><Text style={s.noticeText}>Includes sample statuses, not confirmed uploads. Records reset when the app reloads. No data is uploaded from this page.</Text></View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 28 },
  eyebrow: { fontSize: 9, letterSpacing: 1.8, fontWeight: '700', color: '#657763' },
  title: { fontSize: 30, fontWeight: '600', color: colors.forest, letterSpacing: -0.9, marginTop: 10 },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 5 },
  connectionCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 18, marginTop: 22 },
  connectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 16, lineHeight: 22, color: colors.forest, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 3 },
  description: { fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 8 },
  lastSync: { borderTopWidth: 1, borderTopColor: '#EDF0E8', marginTop: 16, paddingTop: 12, gap: 3 },
  lastValue: { fontSize: 12, color: colors.ink, fontWeight: '500' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 10 },
  count: { color: colors.forest, fontSize: 28, fontWeight: '500', letterSpacing: -1 },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  errorText: { color: colors.red },
  disabledButton: { minHeight: 54, borderRadius: 13, backgroundColor: '#DCE3D9', alignItems: 'center', justifyContent: 'center', padding: 14, marginTop: 16 },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#596B5D' },
  buttonHint: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 7 },
  queueHeading: { marginTop: 24 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
  filter: { borderWidth: 1, borderColor: colors.border, borderRadius: 22, minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: colors.paper },
  selectedFilter: { backgroundColor: colors.forest, borderColor: colors.forest },
  filterText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  selectedFilterText: { color: colors.paper },
  list: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, overflow: 'hidden' },
  record: { padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: '#EDF0E8' },
  recordHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordName: { flex: 1, color: colors.forest, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  arrow: { color: colors.forest, fontSize: 20 },
  recordMeta: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 4 },
  recordStatus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  failure: { color: colors.red, backgroundColor: '#FAEEE9', borderRadius: 8, padding: 10, marginTop: 12, fontSize: 11, lineHeight: 18 },
  empty: { padding: 24, alignItems: 'center', gap: 10 },
  emptyCopy: { fontSize: 12, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  draftsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.soft, borderRadius: 14, padding: 16, marginTop: 20 },
  notice: { marginTop: 22, gap: 6 },
  noticeLabel: { color: '#657763', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  noticeText: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
