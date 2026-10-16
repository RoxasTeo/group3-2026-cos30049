import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RoleNavigationBar from '../components/RoleNavigationBar';
import { isRole, roleNavigation } from '../navigation/roles';
import QRScannerScreen from './QRScannerScreen';

export default function NavigationShell() {
  const { role, tab } = useLocalSearchParams<{ role: string; tab: string }>();
  const insets = useSafeAreaInsets();

  // Unknown roles return to login. Tabs outside this role return to its Home page.
  if (!isRole(role)) return <Redirect href="/" />;
  const navigation = roleNavigation[role];
  const active = navigation.tabs.find(item => item.id === tab);
  if (!active) return <Redirect href={{ pathname: '/navigation/[role]/[tab]', params: { role, tab: 'home' } }} />;

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), paddingLeft: Math.max(insets.left, 24), paddingRight: Math.max(insets.right, 24) }]}>
          <View><Text style={styles.brand}>Niah</Text><Text style={styles.brandCaption}>BIODIVERSITY</Text></View>
          <View style={styles.roleBadge}><View style={styles.dot} /><Text style={styles.role}>{navigation.label}</Text></View>
        </View>
        <View style={styles.content}>{role === 'botanist' && active.id === 'scan' ? <QRScannerScreen /> : <Text accessibilityRole="header" style={styles.title}>{active.label}</Text>}</View>
        <RoleNavigationBar items={navigation.tabs} activeTab={active.id}
          onSelect={next => router.replace({ pathname: '/navigation/[role]/[tab]', params: { role, tab: next } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECE5', alignItems: 'center' },
  screen: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#FAF9F4' },
  header: { backgroundColor: '#173F35', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 22 },
  brand: { color: '#FFFFFF', fontSize: 25, fontWeight: '600', letterSpacing: -0.7 },
  brandCaption: { color: '#D8E8AD', fontSize: 8, letterSpacing: 2, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#547063', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D8E8AD' },
  role: { color: '#E3EBD9', fontSize: 11, flexShrink: 1 },
  content: { flex: 1, padding: 24 },
  title: { color: '#203C33', fontSize: 26, fontWeight: '600', letterSpacing: -0.6 },
});
