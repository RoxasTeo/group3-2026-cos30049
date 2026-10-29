import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, RecordIcon } from '../components/records/RecordUI';
import { usePlantRecords } from '../hooks/usePlantRecords';
import { useSession } from '../auth/SessionProvider';
import { roleNavigation } from '../navigation/roles';

export default function ProfileScreen() {
  const records = usePlantRecords();
  const { session } = useSession();
  if (!session) return null;
  const user = session.user;
  const roleLabel = roleNavigation[user.role].label;
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>YOUR FIELD ACCOUNT</Text>
      <Text accessibilityRole="header" style={s.title}>Profile</Text>
      <Text style={s.subtitle}>Your details, connected to your fieldwork.</Text>
      <View style={s.profileCard}>
        <View style={s.avatar}><Text style={s.initials}>{user.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</Text></View>
        <Text style={s.name}>{user.name}</Text>
        <View style={s.roleBadge}><RecordIcon name="leaf" color={colors.forest} size={14} /><Text style={s.role}>{roleLabel}</Text></View>
        <Text style={s.caption}>Niah Biodiversity</Text>
      </View>
      <View style={s.sectionHeading}><Text accessibilityRole="header" style={s.sectionTitle}>Account details</Text><Text style={s.previewLabel}>SIGNED IN</Text></View>
      <View style={s.detailsCard}>
        <View style={s.detailRow}><Text style={s.label}>Email address</Text><Text selectable style={s.value}>{user.email}</Text></View>
        <View style={[s.detailRow, s.divider]}><Text style={s.label}>Account role</Text><Text style={s.value}>{roleLabel}</Text></View>
      </View>
      {user.role === 'botanist' && <>
        <View style={s.recordsCard}>
          <View style={s.recordIcon}><RecordIcon name="leaf" color={colors.forest} size={24} /></View>
          <View style={s.recordCopy}><Text style={s.sectionTitle}>Your field records</Text><Text style={s.recordHint}>Records in this session</Text></View>
          <Text style={s.count}>{records.length.toString().padStart(2, '0')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/navigation/[role]/[tab]', params: { role: 'botanist', tab: 'records' } })} style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Text style={s.buttonText}>View plant records</Text><Text style={s.arrow}>→</Text>
        </Pressable>
      </>}
      <View style={s.notice}><Text style={s.noticeTitle}>SESSION ACCOUNT</Text><Text style={s.noticeText}>Account details come from your sign-in. Field records remain a local preview; backend records and cloud sync are not connected yet. Signing out clears local preview changes.</Text></View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 28 },
  eyebrow: { color: '#657763', fontSize: 9, fontWeight: '700', letterSpacing: 1.8 },
  title: { color: colors.forest, fontSize: 30, fontWeight: '600', letterSpacing: -0.9, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  profileCard: { alignItems: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 24, marginTop: 22 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.soft, borderWidth: 1, borderColor: '#D5DFC8', alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.forest, fontSize: 26, fontWeight: '600', letterSpacing: -0.5 },
  name: { color: colors.forest, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, marginTop: 14, textAlign: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.soft, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  role: { color: colors.forest, fontSize: 11, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 11, marginTop: 12 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: colors.forest, fontSize: 16, fontWeight: '600' },
  previewLabel: { color: colors.muted, fontSize: 8, letterSpacing: 1.2 },
  detailsCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  detailRow: { padding: 16, gap: 6 },
  divider: { borderTopWidth: 1, borderTopColor: '#EDF0E8' },
  label: { color: colors.muted, fontSize: 11 },
  value: { color: colors.ink, fontSize: 14, fontWeight: '500', lineHeight: 21, flexShrink: 1 },
  recordsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0F3E8', borderRadius: 14, padding: 16, marginTop: 20 },
  recordIcon: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  recordCopy: { flex: 1, minWidth: 0 },
  recordHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  count: { color: colors.forest, fontSize: 28, fontWeight: '500', letterSpacing: -1, flexShrink: 1 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 54, backgroundColor: colors.forest, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 14, marginTop: 12 },
  buttonText: { color: colors.paper, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  arrow: { color: colors.lime, fontSize: 22 },
  notice: { marginTop: 22, gap: 6, paddingHorizontal: 2 },
  noticeTitle: { color: '#657763', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  noticeText: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
