import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PlantLocation, PlantPhoto } from '../../data/plantRecords';
import { captureLocation, capturePhoto, CaptureError } from '../../services/deviceCapture';
import { GPS_ACCURACY_TARGET, MAX_PHOTOS } from '../../services/capturePolicy';
import { colors, PhotoImage, RecordButton, RecordIcon, ui } from './RecordUI';

type Props = { photos: PlantPhoto[]; location: PlantLocation | null; onPhotos: (photos: PlantPhoto[]) => void; onLocation: (location: PlantLocation) => void; onBusyChange: (busy: boolean) => void };
type Preview = { photo: PlantPhoto; pending: boolean; replacing?: string; remove?: boolean };
export default function CaptureFields({ photos, location, onPhotos, onLocation, onBusyChange }: Props) {
  const [busy, setBusy] = useState<'gps' | 'photo' | null>(null), [gpsError, setGpsError] = useState(''), [photoError, setPhotoError] = useState('');
  const [settings, setSettings] = useState(false), [preview, setPreview] = useState<Preview | null>(null);
  const generation = useRef(0), running = useRef(false);
  useEffect(() => { onBusyChange(!!busy); }, [busy, onBusyChange]);
  useEffect(() => () => { generation.current++; running.current = false; }, []);
  function cancel() { generation.current++; running.current = false; setBusy(null); }
  async function locate() {
    if (running.current) return;
    running.current = true; const token = ++generation.current;
    setBusy('gps'); setGpsError(''); setSettings(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const fix = await Promise.race([captureLocation(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new CaptureError('Could not get a GPS fix within 20 seconds. Move to a clearer area and retry, or save a draft.', 'timeout')), 20000); })]);
      if (generation.current === token) onLocation(fix);
    } catch (error) { if (generation.current === token) { setGpsError(error instanceof Error ? error.message : 'Location is unavailable. Please retry.'); setSettings(error instanceof CaptureError && error.settings); } }
    finally { clearTimeout(timer); if (generation.current === token) { running.current = false; setBusy(null); } }
  }
  async function pick(source: 'camera' | 'gallery', replacing?: string) {
    if (running.current || (photos.length >= MAX_PHOTOS && !replacing)) return;
    running.current = true; const token = ++generation.current;
    setBusy('photo'); setPhotoError(''); setSettings(false); setPreview(null);
    try { const photo = await capturePhoto(source); if (generation.current === token && photo) setPreview({ photo, pending: true, replacing }); }
    catch (error) { if (generation.current === token) { setPhotoError(error instanceof Error ? error.message : 'Camera or photo library unavailable. Please retry.'); setSettings(error instanceof CaptureError && error.settings); } }
    finally { if (generation.current === token) { running.current = false; setBusy(null); } }
  }
  function usePhoto() {
    if (!preview) return;
    if (preview.replacing) onPhotos(photos.map(p => p.id === preview.replacing ? { ...preview.photo, id: p.id } : p));
    else if (photos.length < MAX_PHOTOS) onPhotos([...photos, { ...preview.photo }]);
    setPreview(null);
  }
  async function openSettings() { try { await Linking.openSettings(); } catch { setPhotoError('Open your device settings manually to allow access.'); } }
  const weak = location?.accuracy != null && location.accuracy > GPS_ACCURACY_TARGET;
  return <>
    <View style={ui.panel}><View style={styles.heading}><RecordIcon name="pin" color={colors.forest} size={22} /><Text style={ui.sectionTitle}>GPS location</Text></View><Text style={ui.caption}>Tag the plant where you found it. Foreground location only.</Text>
      <View style={[styles.status, (weak || !!gpsError) && styles.warning]}><Text accessibilityLiveRegion="polite" style={ui.paragraph}>{busy === 'gps' ? 'Finding your location…' : gpsError || (location ? weak ? 'Low accuracy. Try again in a clearer area.' : location.sample ? 'Illustrative sample location' : 'Location captured' : 'No location captured')}</Text></View>
      {location && <><View style={styles.coordinates}><View><Text style={ui.caption}>Latitude</Text><Text selectable style={styles.coordinate}>{location.latitude.toFixed(5)}</Text></View><View><Text style={ui.caption}>Longitude</Text><Text selectable style={styles.coordinate}>{location.longitude.toFixed(5)}</Text></View></View><Text style={ui.caption}>Accuracy: {location.accuracy == null ? 'Not provided' : `±${Math.round(location.accuracy)} m`}{location.capturedAt ? ` · ${new Date(location.capturedAt).toLocaleTimeString()}` : ''}{location.sample ? ' · Sample data' : ''}</Text>{!!gpsError && <Text style={ui.caption}>Your earlier location is kept until a new fix succeeds.</Text>}</>}
      <RecordButton label={busy === 'gps' ? 'Cancel locating' : location ? 'Update GPS location' : 'Get current location'} disabled={busy === 'photo'} onPress={busy === 'gps' ? cancel : locate} />
      <Text style={ui.caption}>GPS does not require a downloaded map. You can save a draft if a location is unavailable. Ready target: ±30 m (provisional).</Text>
    </View>
    <View style={ui.panel}><View style={styles.heading}><RecordIcon name="photo" color={colors.forest} size={22} /><Text style={[ui.sectionTitle, styles.flex]}>Plant photographs</Text><Text style={ui.caption}>{photos.length} / {MAX_PHOTOS}</Text></View><Text style={ui.caption}>Whole plant, leaves and identifying details.</Text>
      {photos.length ? <View style={styles.photos}>{photos.map(photo => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`Preview photo ${photo.caption || photo.fileName || photo.id}`} onPress={() => setPreview({ photo: { ...photo }, pending: false })} style={styles.thumbnail}>{photo.uri ? <PhotoImage photo={photo} style={styles.thumbImage} label={photo.caption || 'Plant photograph'} /> : <View style={styles.placeholder}><RecordIcon name="photo" /><Text style={ui.caption}>{photo.sampleLabel}</Text></View>}<Text numberOfLines={2} style={styles.photoName}>{photo.caption || photo.fileName || 'Plant photograph'}</Text></Pressable>)}</View> : <View style={ui.photoEmpty}><RecordIcon name="photo" size={28} /><Text style={ui.paragraph}>No photographs yet</Text><Text style={ui.caption}>Add a whole-plant photo, then close-up details.</Text></View>}
      <RecordButton label="Take photo" primary disabled={!!busy || photos.length >= MAX_PHOTOS} onPress={() => pick('camera')} /><RecordButton label="Choose photo" disabled={!!busy || photos.length >= MAX_PHOTOS} onPress={() => pick('gallery')} />
      {busy === 'photo' && <><Text accessibilityLiveRegion="polite" style={ui.caption}>Waiting for your photo selection…</Text><RecordButton label="Cancel selection" onPress={cancel} /></>}
      <Text style={ui.caption}>Up to 4 photographs · JPG, PNG or WebP · 5 MB each. Photographs are stored on this device when you save the record.</Text>
      {!!photoError && <Text accessibilityRole="alert" style={ui.error}>{photoError}</Text>}
    </View>
    {settings && Platform.OS !== 'web' && <RecordButton label="Open device settings" onPress={openSettings} />}
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}><View style={ui.overlay}><View style={styles.dialog}><ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={ui.confirmTitle}>{preview?.remove ? 'Remove this photograph?' : preview?.pending ? 'Review photograph' : 'Photograph preview'}</Text>
      {preview?.photo.uri ? <PhotoImage photo={preview.photo} style={styles.previewImage} resizeMode="contain" label="Photograph preview" /> : <View style={ui.photoEmpty}><RecordIcon name="photo" /><Text style={ui.caption}>{preview?.photo.sampleLabel || 'No photograph'}</Text></View>}
      {preview?.remove ? <><Text style={ui.paragraph}>The attachment will be removed from this draft. The original photo in your library is not deleted.</Text><RecordButton label="Keep photo" onPress={() => setPreview(p => p ? { ...p, remove: false } : null)} /><RecordButton label="Remove photo" danger onPress={() => { onPhotos(photos.filter(p => p.id !== preview.photo.id)); setPreview(null); }} /></> : preview?.pending ? <>
        <Text style={ui.paragraph}>Check that identifying details are clear.</Text><Text style={ui.caption}>Photo caption (optional)</Text><TextInput accessibilityLabel="Photo caption" value={preview.photo.caption || ''} onChangeText={caption => setPreview(p => p ? { ...p, photo: { ...p.photo, caption } } : null)} maxLength={120} style={styles.captionInput} />
        <RecordButton label="Use photo" primary onPress={usePhoto} /><RecordButton label={preview.photo.source === 'camera' ? 'Retake' : 'Choose another'} onPress={() => pick(preview.photo.source || 'gallery', preview.replacing)} /><RecordButton label="Cancel" onPress={() => setPreview(null)} />
      </> : <><Text style={ui.caption}>{preview?.photo.caption || preview?.photo.fileName || 'Sample attachment'}</Text><RecordButton label="Retake / replace" onPress={() => pick('camera', preview?.photo.id)} /><RecordButton label="Remove photo" onPress={() => setPreview(p => p ? { ...p, remove: true } : null)} /><RecordButton label="Back to record" onPress={() => setPreview(null)} /></>}
    </ScrollView></View></View></Modal>
  </>;
}
const styles = StyleSheet.create({ heading: { flexDirection: 'row', gap: 9, alignItems: 'center' }, flex: { flex: 1 }, status: { padding: 12, backgroundColor: colors.soft, borderRadius: 9 }, warning: { backgroundColor: '#F7EDDA' }, coordinates: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 }, coordinate: { fontSize: 20, color: colors.ink, marginTop: 5 }, photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, thumbnail: { width: '47%', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }, thumbImage: { width: '100%', height: 110 }, placeholder: { height: 110, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: colors.soft }, photoName: { fontSize: 11, padding: 8, color: colors.ink }, dialog: { maxHeight: '90%', width: '100%', maxWidth: 420, backgroundColor: colors.paper, borderRadius: 16 }, modalContent: { padding: 20, gap: 14 }, previewImage: { width: '100%', height: 220, backgroundColor: colors.soft, borderRadius: 10 }, captionInput: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 9, color: colors.ink, fontSize: 16 } });
