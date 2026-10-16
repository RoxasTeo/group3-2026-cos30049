import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deletePlantDraft } from '../data/plantRecords';
import { usePlantRecords } from '../hooks/usePlantRecords';
import { colors, ConfirmRecordAction, RecordBack, RecordBadge, RecordButton, RecordFrame, RecordIcon, RecordPhotos, RecordScroll, recordDate, ui } from '../components/records/RecordUI';

export default function PlantRecordDetailsScreen() {
  const { plantId } = useLocalSearchParams<{ plantId: string }>();
  const record = usePlantRecords().find(r => r.plantId === (plantId ?? '').toUpperCase());
  const [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const back = () => router.navigate('/navigation/botanist/records');
  function remove() {
    if (!record) return;
    try { deletePlantDraft(record.plantId); setConfirm(false); router.replace('/navigation/botanist/records'); }
    catch (e) { setConfirm(false); setError(e instanceof Error ? e.message : 'Could not remove this draft.'); }
  }
  return <RecordFrame><RecordScroll><RecordBack onPress={back} />{!record ? <><Text accessibilityRole="header" style={ui.title}>Record not found</Text><Text style={ui.paragraph}>It may have been deleted, or this session-only preview has restarted.</Text><RecordButton label="Back to Records" onPress={back} /></> : <>
    <View style={styles.top}><Text style={ui.caption}>{record.plantId}</Text><RecordBadge status={record.status} /></View>
    <View><Text accessibilityRole="header" style={ui.title}>{record.commonName}</Text><Text style={styles.scientific}>{record.scientificName || 'Species not identified yet'}</Text></View>
    <View style={[styles.statusNote, record.status === 'Failed' && styles.failed]}><RecordIcon name={record.status === 'Failed' ? 'alert' : 'clock'} /><Text style={styles.statusText}>{record.status === 'Draft' ? 'Incomplete observations can stay as drafts. Nothing has been uploaded.' : record.status === 'Pending sync' ? 'Marked ready. Upload belongs to the Sync page; no transfer happens here.' : record.status === 'Synced' ? 'Sample synced record. No real server upload has been performed in this prototype.' : `${record.syncError || 'Upload failed.'} This is a sample state; retry controls belong to Sync.`}</Text></View>
    <View style={ui.panel}><Text style={ui.sectionTitle}>Plant information</Text>{[
      ['Collected', recordDate(record.createdAt)], ['Last updated', recordDate(record.updatedAt)], ['Family', record.family || 'Not recorded'],
      ['Conservation status', record.conservationStatus || 'Not assessed'], ['Field observations', record.description || 'Not recorded'], ['Habitat notes', record.habitatNotes || 'Not recorded'],
    ].map(([label, value]) => <View key={label} style={styles.field}><Text style={ui.caption}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
    <RecordPhotos record={record} />
    <View style={ui.panel}><Text style={ui.sectionTitle}>GPS location</Text><Text style={styles.value}>{record.location ? `${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)}` : 'Not captured'}</Text><Text style={ui.caption}>{record.location?.sample ? 'Illustrative coordinates only; not a verified plant location.' : record.location ? `Accuracy: ${record.location.accuracy == null ? 'Not recorded' : `${record.location.accuracy} m`}` : 'GPS capture will connect in a separate integration.'}</Text></View>
    <Text style={ui.caption}>Storage: {record.sample ? 'Sample record in memory' : 'Current app session only'}. SQLite persistence is not connected yet.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {record.status === 'Draft' ? <><RecordButton label="Continue draft" primary onPress={() => router.push({ pathname: '/plant/new', params: { plantId: record.plantId, edit: 'true' } })} /><RecordButton label="Delete draft" onPress={() => setConfirm(true)} /></> : <Text style={ui.caption}>Read-only record. Only drafts can be edited or deleted in this version.</Text>}
    <ConfirmRecordAction visible={confirm} title="Delete this draft?" description={`${record.commonName}\n${record.plantId}\nIts notes and attachments will be removed from this session. This cannot be undone.`} confirmLabel="Delete draft" cancelLabel="Keep draft" onCancel={() => setConfirm(false)} onConfirm={remove} />
  </>}</RecordScroll></RecordFrame>;
}
const styles = StyleSheet.create({ top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, scientific: { color: colors.muted, fontSize: 14, fontStyle: 'italic', marginTop: 6 }, statusNote: { padding: 14, borderRadius: 10, backgroundColor: colors.soft, flexDirection: 'row', gap: 10 }, failed: { backgroundColor: '#FAEEE9' }, statusText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 20 }, field: { gap: 4 }, value: { color: colors.ink, fontSize: 14, lineHeight: 22 } });
