import { useEffect, useState, type PropsWithChildren } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import RoleNavigationBar from '../RoleNavigationBar';
import { roleNavigation } from '../../navigation/roles';
import type { PlantPhoto, PlantRecord, RecordStatus } from '../../data/plantRecords';
import { useSession } from '../../auth/SessionProvider';
import { apiBaseUrl } from '../../auth/apiConfig';
import { isEncryptedPhoto, photoData } from '../../services/photoStorage';
import type { ImageStyle, StyleProp } from 'react-native';

export const colors = { forest: '#173F35', cream: '#FAF9F4', ink: '#203C33', muted: '#64756C', lime: '#D8E8AD', border: '#DCE2D9', soft: '#E8F0E2', paper: '#FFFFFF', red: '#A1382C' };
const paths = { back: 'M15 5l-7 7 7 7M8 12h13', plus: 'M12 4v16M4 12h16', search: 'M20 20l-5-5M17 10a7 7 0 11-14 0 7 7 0 0114 0', leaf: 'M5 21C5 12 10 5 21 3c0 12-5 17-12 15M5 21L15 10', photo: 'M3 4h18v16H3ZM3 16l5-5 4 4 3-3 6 6M8 8h.01', pin: 'M12 22S4 15 4 9a8 8 0 0116 0c0 6-8 13-8 13ZM15 9a3 3 0 11-6 0 3 3 0 016 0', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', check: 'M4 12l5 5L20 6', clock: 'M12 7v5l3 2M22 12a10 10 0 11-20 0 10 10 0 0120 0', edit: 'M4 16l-1 5 5-1L21 7l-5-5ZM14 4l6 6', alert: 'M12 8v5M12 17h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0' };
export function RecordIcon({ name, color = colors.muted, size = 18 }: { name: keyof typeof paths; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={true}><Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function RecordButton({ label, onPress, primary = false, danger = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, primary && ui.primary, danger && ui.danger, pressed && ui.pressed, disabled && ui.disabled]}><Text style={[ui.buttonText, (primary || danger) && ui.light]}>{label}</Text></Pressable>;
}
export function RecordBadge({ status }: { status: RecordStatus }) {
  const color = status === 'Failed' ? colors.red : status === 'Pending sync' ? '#805B1D' : colors.forest;
  return <View style={[ui.badge, { backgroundColor: status === 'Failed' ? '#FAEEE9' : status === 'Pending sync' ? '#F7EDDA' : colors.soft }]}><RecordIcon name={status === 'Draft' ? 'edit' : status === 'Synced' ? 'check' : status === 'Failed' ? 'alert' : 'clock'} color={color} size={12} /><Text style={[ui.badgeText, { color }]}>{status}</Text></View>;
}
export function SampleNotice() { return <Text style={ui.sample}>OFFLINE FIELDWORK · SYNC WHEN CONNECTED</Text>; }
export function RecordFrame({ children, onTab }: PropsWithChildren<{ onTab?: (destination: string) => void }>) {
  const insets = useSafeAreaInsets();
  return <View style={ui.outer}><View style={ui.frame}><View style={[ui.header, { paddingTop: Math.max(insets.top, 20), paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) }]}><View><Text style={ui.brand}>Niah</Text><Text style={ui.brandCaption}>BIODIVERSITY</Text></View><Text style={ui.role}>Botanist</Text></View><SampleNotice /><View style={ui.body}>{children}</View><RoleNavigationBar items={roleNavigation.botanist.tabs} activeTab="records" onSelect={tab => { const destination = `/navigation/botanist/${tab}`; if (onTab) onTab(destination); else router.navigate(destination); }} /></View></View>;
}
export function RecordBack({ onPress, label = 'Records' }: { onPress: () => void; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${label}`} onPress={onPress} style={ui.back}><RecordIcon name="back" /><Text style={ui.muted}>{label}</Text></Pressable>;
}
export function ConfirmRecordAction({ visible, title, description, confirmLabel, cancelLabel = 'Keep editing', onCancel, onConfirm }: { visible: boolean; title: string; description: string; confirmLabel: string; cancelLabel?: string; onCancel: () => void; onConfirm: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}><View style={ui.overlay}><View accessibilityViewIsModal accessibilityRole="alert" style={ui.dialog}><RecordIcon name="alert" color={colors.red} size={28} /><Text accessibilityRole="header" style={ui.confirmTitle}>{title}</Text><Text style={ui.paragraph}>{description}</Text><RecordButton label={cancelLabel} onPress={onCancel} /><RecordButton label={confirmLabel} danger onPress={onConfirm} /></View></View></Modal>;
}
// Photos synced from another device are private: download them with the account token
// (Image source headers are ignored on web) and show them as data URLs for this session.
// Decoded photos are several MB each, so keep only the most recent few in memory.
const CACHE_LIMIT = 8;
function remember(cache: Map<string, string>, key: string, value: string) {
  cache.delete(key); cache.set(key, value);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}
const remotePhotos = new Map<string, string>();
function RemotePhoto({ plantId, index, label }: { plantId: string; index: number; label: string }) {
  const { session } = useSession();
  const url = `${apiBaseUrl()}/mobile/photo.php?plantId=${encodeURIComponent(plantId)}&index=${index}`;
  const [uri, setUri] = useState(() => remotePhotos.get(url));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (uri || !session) return;
    let active = true;
    void fetch(url, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(response => { if (!response.ok) throw new Error(); return response.blob(); })
      .then(blob => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); }))
      .then(data => { remember(remotePhotos, url, data); if (active) setUri(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [url, uri, session]);
  if (uri) return <Image source={{ uri }} style={ui.photo} accessibilityLabel={label} />;
  return <View style={ui.photoEmpty}><RecordIcon name="photo" size={24} /><Text style={ui.caption}>{failed ? 'Photograph unavailable offline. Connect and reopen this record.' : 'Downloading photograph…'}</Text></View>;
}
// Saved photos are encrypted on the device; decrypt them in memory for display only.
const decrypted = new Map<string, string>();
export function PhotoImage({ photo, style, label, resizeMode }: { photo: PlantPhoto; style: StyleProp<ImageStyle>; label: string; resizeMode?: 'cover' | 'contain' }) {
  const encrypted = isEncryptedPhoto(photo);
  const [, setLoaded] = useState(0);
  const uri = encrypted ? decrypted.get(photo.uri as string) : photo.uri;
  useEffect(() => {
    if (!encrypted || decrypted.has(photo.uri as string)) return;
    let active = true;
    void photoData(photo).then(data => { remember(decrypted, photo.uri as string, data); if (active) setLoaded(n => n + 1); }).catch(() => undefined);
    return () => { active = false; };
  }, [photo, encrypted]);
  return uri ? <Image source={{ uri }} style={style} resizeMode={resizeMode} accessibilityLabel={label} /> : <View style={[style as object, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }]}><RecordIcon name="photo" size={20} /></View>;
}
export function RecordPhotos({ record }: { record: PlantRecord }) {
  return <View style={ui.panel}><Text style={ui.sectionTitle}>Photographs</Text>{record.photos.length ? record.photos.map(photo => <View key={photo.id} style={{ gap: 6 }}>{!photo.uri && photo.remoteIndex !== undefined ? <RemotePhoto plantId={record.plantId} index={photo.remoteIndex} label={photo.caption || 'Collected plant photograph'} /> : photo.uri ? <PhotoImage photo={photo} style={ui.photo} label={photo.caption || 'Collected plant photograph'} /> : <View style={ui.photoEmpty}><RecordIcon name="photo" size={24} /><Text style={ui.caption}>{photo.sampleLabel || 'Sample photograph placeholder'}</Text></View>}{!!photo.caption && <Text style={ui.paragraph}>{photo.caption}</Text>}</View>) : <Text style={ui.paragraph}>No photographs attached.</Text>}</View>;
}
export function RecordScroll({ children }: PropsWithChildren) { return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.scroll}>{children}</ScrollView>; }
export function recordDate(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
export const ui = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#E8ECE5', alignItems: 'center' }, frame: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.cream }, body: { flex: 1, minHeight: 0 },
  header: { backgroundColor: colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 22, gap: 12 }, brand: { color: '#FFFFFF', fontSize: 25, fontWeight: '600', letterSpacing: -.7 }, brandCaption: { color: colors.lime, fontSize: 9, letterSpacing: 2, marginTop: 2 }, role: { color: '#E3EBD9', borderWidth: 1, borderColor: '#547063', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, fontSize: 11 },
  sample: { color: colors.muted, backgroundColor: colors.cream, fontSize: 10, letterSpacing: .5, textAlign: 'center', padding: 9, borderBottomWidth: 1, borderColor: colors.border },
  scroll: { padding: 20, paddingBottom: 32, gap: 16 }, title: { color: colors.ink, fontSize: 28, fontWeight: '600', letterSpacing: -.6 }, eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 1.2 }, subtitle: { fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 5 },
  panel: { padding: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 13, gap: 12 }, sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink }, paragraph: { fontSize: 14, lineHeight: 22, color: colors.muted }, caption: { fontSize: 11, lineHeight: 17, color: colors.muted }, muted: { color: colors.muted, fontSize: 13 },
  button: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.forest, fontWeight: '600', fontSize: 14 }, primary: { backgroundColor: colors.forest, borderColor: colors.forest }, danger: { backgroundColor: colors.red, borderColor: colors.red }, light: { color: '#FFFFFF' }, pressed: { opacity: .75 }, disabled: { opacity: .5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, badgeText: { fontSize: 11, fontWeight: '500' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, alignSelf: 'flex-start' }, photoEmpty: { minHeight: 110, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }, photo: { width: '100%', height: 210, borderRadius: 10 },
  overlay: { flex: 1, backgroundColor: '#10261D88', justifyContent: 'center', alignItems: 'center', padding: 24 }, dialog: { width: '100%', maxWidth: 400, backgroundColor: colors.paper, padding: 24, borderRadius: 18, gap: 16 }, confirmTitle: { fontSize: 22, color: colors.ink, fontWeight: '600' }, error: { color: colors.red, fontSize: 13, lineHeight: 20 },
});
