import { findSpecies } from '../data/speciesReference';
import { preservePhotos } from '../services/photoStorage';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { createTemporaryPlantId, getPlantRecord, savePlantRecord, type PlantRecordInput } from '../data/plantRecords';
import { colors, ConfirmRecordAction, RecordBack, RecordButton, RecordFrame, RecordIcon, RecordScroll, ui } from '../components/records/RecordUI';
import CaptureFields from '../components/records/CaptureFields';
type TextKey = Exclude<keyof PlantRecordInput, 'photos' | 'location'>;

export default function PlantRecordFormScreen() {
  const params = useLocalSearchParams<{ plantId?: string; edit?: string; reference?: string }>();
  const reference = findSpecies(params.reference);
  const navigation = useNavigation();
  const editing = params.edit === 'true';
  const [id] = useState(() => (params.plantId || createTemporaryPlantId()).trim().toUpperCase());
  const existing = getPlantRecord(id);
  const [form, setForm] = useState<PlantRecordInput>(() => ({ plantId: id, commonName: existing?.commonName === 'Unidentified plant' ? '' : existing?.commonName ?? reference?.commonName ?? '', scientificName: existing?.scientificName ?? reference?.scientificName ?? '', family: existing?.family ?? reference?.family ?? '', conservationStatus: existing?.conservationStatus ?? reference?.conservationStatus ?? 'Not assessed', description: existing?.description ?? '', habitatNotes: existing?.habitatNotes ?? '', heightMetres: existing?.heightMetres ?? '', morphology: existing?.morphology ?? '' }));
  const [photos, setPhotos] = useState(existing?.photos ?? []), [location, setLocation] = useState(existing?.location ?? null);
  const [capturing, setCapturing] = useState(false);
  const [initial] = useState(() => JSON.stringify({ form, photos, location }));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [finishedId, setFinishedId] = useState<string | null>(null);
  const [discardVisible, setDiscardVisible] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  // The exit the user asked for (Back button or a tab). Re-run it after discarding: replaying the
  // intercepted action is not handled reliably inside the plant Slot layout.
  const requestedExit = useRef<(() => void) | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const dirty = (JSON.stringify({ form, photos, location }) !== initial || capturing) && !finishedId && !discarding;
  usePreventRemove(!!dirty, ({ data }) => { pendingLeave.current = requestedExit.current ?? (() => navigation.dispatch(data.action)); requestedExit.current = null; setDiscardVisible(true); });
  // Leave only after the re-render that turns prevention off.
  useEffect(() => {
    if (!discarding) return;
    const go = pendingLeave.current; pendingLeave.current = null;
    (go ?? leave)();
  }, [discarding]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (finishedId) router.replace({ pathname: '/plant/[plantId]', params: { plantId: finishedId } });
  }, [finishedId]);
  const locked = (editing && (!existing || existing.status !== 'Draft')) || (!editing && !!existing);
  function set(key: TextKey, value: string) { setForm(previous => ({ ...previous, [key]: value })); setError(''); }
  // New records started from the species reference return Home; edits return to the record.
  const backTo = editing ? 'record details' : params.reference ? 'Home' : 'Records';
  function exit(go: () => void) { requestedExit.current = go; go(); }
  function leave() { router.replace(editing ? { pathname: '/plant/[plantId]', params: { plantId: id } } : params.reference ? '/navigation/botanist/home' : '/navigation/botanist/records'); }
  async function save(ready: boolean) {
    if (saving || finishedId || capturing) return;
    setSaving(true); setError('');
    try { const record = savePlantRecord({ ...form, photos: await preservePhotos(photos), location }, ready, editing ? 'edit' : 'create'); setFinishedId(record.plantId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this draft.'); setSaving(false); }
  }
  function field(key: TextKey, label: string, placeholder: string, multiline = false) {
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={form[key]} keyboardType={key === 'heightMetres' ? 'decimal-pad' : 'default'} onChangeText={value => set(key, value)} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline} maxLength={multiline ? 2000 : 140} autoCapitalize={key === 'scientificName' ? 'none' : 'sentences'} style={[styles.input, multiline && styles.multiline]} /></View>;
  }
  return <RecordFrame onTab={destination => exit(() => router.replace(destination))}><KeyboardAvoidingView style={ui.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><RecordScroll>
    <RecordBack label={backTo} onPress={() => exit(leave)} />
    {locked ? <><Text accessibilityRole="header" style={ui.title}>{existing ? 'Record is read-only' : 'Draft not found'}</Text><Text style={ui.paragraph}>Only existing drafts can be edited. A new record must use a unique plant ID.</Text><RecordButton label="Back to Records" onPress={() => router.replace('/navigation/botanist/records')} /></> : <>
      <View><Text style={ui.eyebrow}>FIELD DOCUMENTATION</Text><Text accessibilityRole="header" style={ui.title}>{editing ? 'Continue draft' : 'New plant record'}</Text><Text style={ui.subtitle}>Save incomplete observations as a draft.</Text></View>
      <View style={styles.field}><Text style={styles.label}>Plant / temporary ID</Text><Text selectable style={[styles.input, styles.readonly]}>{id}</Text><Text style={ui.caption}>Assigned once. An unidentified plant can keep a temporary ID.</Text></View>
      {field('commonName', 'Common name', 'Leave blank if unknown')}
      {field('scientificName', 'Scientific name', 'Optional until identification')}
      {field('family', 'Family', 'Optional')}
      {field('heightMetres', 'Height (metres)', 'Optional, e.g. 2.5')}
      {field('morphology', 'Morphological characteristics', 'Leaf shape, bark, flowers, fruit and growth form…', true)}
      {field('conservationStatus', 'Conservation status', 'Not assessed')}
      {field('description', 'Field observations', 'Describe leaves, bark, height or habitat…', true)}
      {field('habitatNotes', 'Habitat notes', 'Describe where you found the plant…', true)}
      <CaptureFields photos={photos} location={location} onPhotos={setPhotos} onLocation={setLocation} onBusyChange={setCapturing} />
      <View style={styles.readiness}><Text style={ui.sectionTitle}>Before marking ready</Text>{[
        ['Plant ID assigned', true], ['Field observations recorded', !!form.description.trim()], ['GPS location captured', !!location],
      ].map(([label, complete]) => <View key={String(label)} style={styles.check}><RecordIcon name={complete ? 'check' : 'clock'} /><Text style={ui.paragraph}>{label}</Text></View>)}<Text style={ui.caption}>An unidentified species can still be marked ready. This draft validation policy is provisional; marking ready does not upload data.</Text></View>
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text>}
      <RecordButton label={saving ? 'Saving…' : 'Save draft'} primary disabled={saving || capturing} onPress={() => save(false)} />
      <RecordButton label="Mark ready to sync" disabled={saving || capturing} onPress={() => save(true)} />
      <Text style={ui.caption}>Saved records and photographs remain on this device. Mark ready, then use Sync when you have a connection.</Text>
    </>}
    <ConfirmRecordAction visible={discardVisible} title="Discard unsaved changes?" description="Your last saved draft will be kept. Changes made since then will be discarded." confirmLabel="Discard changes" onCancel={() => { setDiscardVisible(false); pendingLeave.current = null; }} onConfirm={() => { setDiscardVisible(false); setDiscarding(true); }} />
  </RecordScroll></KeyboardAvoidingView></RecordFrame>;
}
const styles = StyleSheet.create({ field: { gap: 8 }, label: { fontSize: 13, fontWeight: '600', color: colors.ink }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.paper, padding: 14, minHeight: 52, fontSize: 16, color: colors.ink }, readonly: { backgroundColor: colors.soft, fontSize: 13 }, multiline: { minHeight: 110, textAlignVertical: 'top' }, readiness: { padding: 16, backgroundColor: colors.soft, borderRadius: 12, gap: 10 }, check: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
