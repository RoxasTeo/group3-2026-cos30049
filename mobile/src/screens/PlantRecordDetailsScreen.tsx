import QRCode from 'react-native-qrcode-svg';
import { useSession } from '../auth/SessionProvider';
import RecordsConnectionNotice from '../components/records/RecordsConnectionNotice';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deletePlantDraft, isServerRecord, returnToDraft } from '../data/plantRecords';
import { usePlantRecords } from '../hooks/usePlantRecords';
import { colors, ConfirmRecordAction, RecordBack, RecordBadge, RecordButton, RecordFrame, RecordIcon, RecordPhotos, RecordScroll, recordDate, ui } from '../components/records/RecordUI';

export default function PlantRecordDetailsScreen() {
  const { plantId } = useLocalSearchParams<{ plantId: string }>();
  const record = usePlantRecords().find(r => r.plantId === (plantId ?? '').toUpperCase());
  const [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const { recordsState } = useSession();
  const back = () => router.navigate('/navigation/botanist/records');
  function remove() {
    if (!record) return;
    try { deletePlantDraft(record.plantId); setConfirm(false); router.replace('/navigation/botanist/records'); }
    catch (e) { setConfirm(false); setError(e instanceof Error ? e.message : 'Could not remove this draft.'); }
  }
  return <RecordFrame><RecordScroll><RecordBack onPress={back} />{!record && (recordsState === 'loading' || recordsState === 'error') ? <RecordsConnectionNotice /> : !record ? <><Text accessibilityRole="header" style={ui.title}>Record not found</Text><Text style={ui.paragraph}>It may not be downloaded to this device, or your account may not have access.</Text><RecordButton label="Back to Records" onPress={back} /></> : <>
    <View style={styles.top}><Text style={ui.caption}>{record.plantId}</Text><RecordBadge status={record.status} /></View>
    <View><Text accessibilityRole="header" style={ui.title}>{record.commonName}</Text><Text style={styles.scientific}>{record.scientificName || 'Species not identified yet'}</Text></View>
    <View style={[styles.statusNote, record.status === 'Failed' && styles.failed]}><RecordIcon name={record.status === 'Failed' ? 'alert' : 'clock'} /><Text style={styles.statusText}>{record.status === 'Draft' ? 'Incomplete observations can stay as drafts. Nothing has been uploaded.' : record.status === 'Pending sync' ? 'Marked ready. Upload belongs to the Sync page; no transfer happens here.' : record.status === 'Synced' ? (record.sample ? 'Fictional record loaded from the demo backend. This is not a verified park observation.' : 'Record loaded from the server.') : `${record.syncError || 'Upload failed.'} Use Sync to retry, or return the record to a draft to correct it.`}</Text></View>
    <View style={ui.panel}><Text style={ui.sectionTitle}>Plant information</Text>{[
      ['Collected', recordDate(record.createdAt)], ['Last updated', recordDate(record.updatedAt)], ['Family', record.family || 'Not recorded'],
      ['Height (metres)', record.heightMetres || 'Not recorded'], ['Morphology', record.morphology || 'Not recorded'],
      ['Conservation status', record.conservationStatus || 'Not assessed'], ['Field observations', record.description || 'Not recorded'], ['Habitat notes', record.habitatNotes || 'Not recorded'],
    ].map(([label, value]) => <View key={label} style={styles.field}><Text style={ui.caption}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
    <View style={ui.panel}><Text style={ui.sectionTitle}>Plant QR tag</Text><View style={{ alignSelf: 'center', padding: 20, backgroundColor: 'white' }}><QRCode value={`plant:${record.plantId}`} size={200} /></View><Text selectable style={ui.caption}>{record.plantId}</Text><Text style={ui.caption}>Scan this tag in Niah to open the record. Sync first to make it available to authorized users on another device.</Text></View>
    <RecordPhotos record={record} />
    <View style={ui.panel}><Text style={ui.sectionTitle}>GPS location</Text><Text style={styles.value}>{record.location ? `${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)}` : 'Not captured'}</Text><Text style={ui.caption}>{record.location?.sample ? 'Illustrative coordinates only; not a verified plant location.' : record.location ? `Accuracy: ${record.location.accuracy == null ? 'Not recorded' : `${record.location.accuracy} m`}` : 'Continue this draft to capture GPS.'}</Text>{!!record.location?.capturedAt && <Text style={ui.caption}>Captured {new Date(record.location.capturedAt).toLocaleString()}</Text>}</View>
    <Text style={ui.caption}>Storage: {isServerRecord(record.plantId) ? 'Server record with an offline copy on this device' : 'Saved on this device; not yet uploaded'}.</Text>
    {['Failed', 'Pending sync'].includes(record.status) && <RecordButton label="Return to draft" onPress={() => { try { returnToDraft(record.plantId); } catch (e) { setError(e instanceof Error ? e.message : 'Cannot update record.'); } }} />}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {record.status === 'Draft' ? <><RecordButton label="Continue draft" primary onPress={() => router.push({ pathname: '/plant/new', params: { plantId: record.plantId, edit: 'true' } })} /><RecordButton label="Delete draft" onPress={() => setConfirm(true)} /></> : <Text style={ui.caption}>Read-only record. Only drafts can be edited or deleted in this version.</Text>}
    <ConfirmRecordAction visible={confirm} title="Delete this draft?" description={`${record.commonName}\n${record.plantId}\nIts notes and attachments will be removed from this device. This cannot be undone.`} confirmLabel="Delete draft" cancelLabel="Keep draft" onCancel={() => setConfirm(false)} onConfirm={remove} />
  </>}</RecordScroll></RecordFrame>;
}
const styles = StyleSheet.create({ top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, scientific: { color: colors.muted, fontSize: 14, fontStyle: 'italic', marginTop: 6 }, statusNote: { padding: 14, borderRadius: 10, backgroundColor: colors.soft, flexDirection: 'row', gap: 10 }, failed: { backgroundColor: '#FAEEE9' }, statusText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 20 }, field: { gap: 4 }, value: { color: colors.ink, fontSize: 14, lineHeight: 22 } });
