import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Demo records only: no device storage, network status, or server sync is implied.
const sampleRecords = [
  { id: 'NIAH-005', name: 'Unidentified plant', date: '16 Oct 2026 · 10:15', status: 'Draft' },
  { id: 'NIAH-004', name: 'Forest fern', date: '16 Oct 2026 · 09:50', status: 'Pending sync' },
  { id: 'NIAH-003', name: 'Unidentified seedling', date: '15 Oct 2026 · 14:20', status: 'Pending sync' },
];
const green = '#173F35';
const goTo = (tab: 'scan' | 'records' | 'sync') => router.push({ pathname: '/navigation/[role]/[tab]', params: { role: 'botanist', tab } });

function HomeIcon({ kind, color = green }: { kind: 'leaf' | 'plus' | 'scan' | 'sync'; color?: string }) {
  const paths = {
    leaf: 'M5 21C5 12 10 5 21 3c0 12-5 17-12 15M5 21L15 10',
    plus: 'M12 4v16M4 12h16',
    scan: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 12h10',
    sync: 'M20 8a8 8 0 00-14-2L3 9M3 4v5h5M4 16a8 8 0 0014 2l3-3M16 15h5v5',
  };
  return <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden={true}><Path d={paths[kind]} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export default function BotanistHomeScreen() {
  // Derive counts from the same data shown below so the summary stays consistent.
  const drafts = sampleRecords.filter(record => record.status === 'Draft').length;
  const pending = sampleRecords.filter(record => record.status === 'Pending sync').length;
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>NIAH NATIONAL PARK</Text>
      <Text accessibilityRole="header" style={s.title}>Welcome back.</Text>
      <Text style={s.subtitle}>Ready for your next field discovery?</Text>

      <View style={s.preview}>
        <Text style={s.previewLabel}>SAMPLE DATA</Text>
        <Text style={s.previewText}>Preview records below. Connection status and last sync are not available yet.</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/plant-record/new')}
        style={({ pressed }) => [s.primary, pressed && s.pressed]}>
        <View style={s.primaryIcon}><HomeIcon kind="plus" color="#D8E8AD" /></View>
        <View style={s.actionCopy}><Text style={s.primaryTitle}>New plant record</Text><Text style={s.primarySubtitle}>Start documenting a discovery</Text></View>
        <Text style={s.primaryArrow}>→</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => goTo('scan')} style={({ pressed }) => [s.scan, pressed && s.pressed]}>
        <HomeIcon kind="scan" /><Text style={s.scanLabel}>Scan QR code</Text><Text style={s.arrow}>→</Text>
      </Pressable>

      <View style={s.sectionHeading}><Text accessibilityRole="header" style={s.sectionTitle}>Your field records</Text><Text style={s.smallLabel}>SAMPLE</Text></View>
      <View style={s.stats}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${drafts} sample draft records. Open Records`} onPress={() => goTo('records')} style={({ pressed }) => [s.stat, pressed && s.pressed]}>
          <Text style={s.count}>{drafts.toString().padStart(2, '0')}</Text><Text style={s.statLabel}>Drafts</Text><Text style={s.statHint}>Continue in Records →</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${pending} sample records pending sync. Open Sync`} onPress={() => goTo('sync')} style={({ pressed }) => [s.stat, s.pendingStat, pressed && s.pressed]}>
          <Text style={s.count}>{pending.toString().padStart(2, '0')}</Text><Text style={s.statLabel}>Pending sync</Text><Text style={s.statHint}>Review in Sync →</Text>
        </Pressable>
      </View>

      <View style={s.sectionHeading}><Text accessibilityRole="header" style={s.sectionTitle}>Recent records</Text><Pressable accessibilityRole="button" onPress={() => goTo('records')} style={s.textButton}><Text style={s.link}>View all →</Text></Pressable></View>
      <View style={s.records}>
        {sampleRecords.map((record, index) => (
          <View key={record.id} style={[s.record, index > 0 && s.recordBorder]}>
            <View style={s.leafIcon}><HomeIcon kind="leaf" /></View>
            <View style={s.recordBody}>
              <Text style={s.recordName}>{record.name}</Text>
              <Text style={s.recordMeta}>{record.id} · {record.date}</Text>
              <View style={[s.badge, record.status === 'Draft' ? s.draftBadge : s.pendingBadge]}><Text style={s.badgeText}>{record.status}</Text></View>
            </View>
          </View>
        ))}
      </View>

      <View style={s.syncCard}>
        <HomeIcon kind="sync" />
        <View style={s.actionCopy}><Text style={s.syncTitle}>Bring your discoveries together</Text><Text style={s.syncText}>{pending} sample records are waiting to sync. Open Sync to view the page preview.</Text><Pressable accessibilityRole="button" onPress={() => goTo('sync')} style={s.syncButton}><Text style={s.link}>Open Sync →</Text></Pressable></View>
      </View>
      <Text style={s.footer}>Every record is a step towards protecting biodiversity.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 28 },
  eyebrow: { fontSize: 9, letterSpacing: 1.8, fontWeight: '700', color: '#657763' },
  title: { fontSize: 30, fontWeight: '600', color: green, letterSpacing: -0.9, marginTop: 10 },
  subtitle: { fontSize: 14, color: '#65736A', lineHeight: 21, marginTop: 5 },
  preview: { marginTop: 19, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E1E5D9', backgroundColor: '#F0F2E9', gap: 5 },
  previewLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#526448' },
  previewText: { fontSize: 11, lineHeight: 17, color: '#59654F' },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: green, borderRadius: 16, padding: 18, marginTop: 20, minHeight: 88 },
  primaryIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#577356', borderRadius: 12 },
  actionCopy: { flex: 1, minWidth: 0 },
  primaryTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  primarySubtitle: { color: '#CDDCC9', fontSize: 11, lineHeight: 17, marginTop: 5 },
  primaryArrow: { color: '#D8E8AD', fontSize: 22 },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#D8E0D3', borderRadius: 13, backgroundColor: '#FFFFFF', minHeight: 56, paddingHorizontal: 18, marginTop: 10 },
  scanLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: green },
  arrow: { fontSize: 20, color: green },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 24, marginBottom: 12, minHeight: 32 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: green, flexShrink: 1 },
  smallLabel: { fontSize: 8, letterSpacing: 1.2, color: '#65736A' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderWidth: 1, borderColor: '#E0E5D9', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 },
  pendingStat: { backgroundColor: '#F1F3E7' },
  count: { fontSize: 31, fontWeight: '500', color: green, letterSpacing: -1 },
  statLabel: { fontSize: 13, color: green, fontWeight: '600', marginTop: 3 },
  statHint: { fontSize: 10, color: '#697660', lineHeight: 16, marginTop: 8 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
  link: { fontSize: 12, color: '#34664B', fontWeight: '600' },
  records: { borderWidth: 1, borderColor: '#E0E5D9', borderRadius: 14, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  record: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15 },
  recordBorder: { borderTopWidth: 1, borderTopColor: '#EDF0E8' },
  leafIcon: { width: 36, height: 42, backgroundColor: '#F0F3E8', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  recordBody: { flex: 1 },
  recordName: { color: green, fontWeight: '600', fontSize: 13, lineHeight: 19 },
  recordMeta: { color: '#748071', fontSize: 10, lineHeight: 16, marginTop: 3 },
  badge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginTop: 8 },
  draftBadge: { backgroundColor: '#EDF0EB' },
  pendingBadge: { backgroundColor: '#F6EED8' },
  badgeText: { color: '#615B3C', fontSize: 9, fontWeight: '600' },
  syncCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#E8EEDC', borderRadius: 14, padding: 16, marginTop: 20 },
  syncTitle: { fontSize: 13, fontWeight: '600', color: green, lineHeight: 19 },
  syncText: { fontSize: 11, color: '#5B6950', lineHeight: 18, marginTop: 6 },
  syncButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  footer: { fontSize: 10, color: '#748071', lineHeight: 17, textAlign: 'center', marginTop: 22 },
  pressed: { opacity: 0.75 },
});
