import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationItem, TabName } from '../navigation/roles';

const paths: Record<TabName, string> = {
  home: 'M3 10L12 3l9 7v11h-6v-7H9v7H3Z',
  scan: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 12h10',
  records: 'M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5',
  sync: 'M20 8a8 8 0 00-14-2L3 9M3 4v5h5M4 16a8 8 0 0014 2l3-3M16 15h5v5',
  profile: 'M16 7a4 4 0 11-8 0 4 4 0 018 0ZM4 21v-2a8 8 0 0116 0v2',
  species: 'M5 21C5 12 10 5 21 3c0 12-5 17-12 15M5 21L15 10',
  review: 'M9 4H5v17h14V4h-4M9 3h6v4H9ZM8 14l3 3 5-6',
  reports: 'M4 3v18h17M8 17v-5M13 17V7M18 17v-8',
};

type Props = { items: NavigationItem[]; activeTab: TabName; onSelect: (tab: TabName) => void };

export default function RoleNavigationBar({ items, activeTab, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {items.map(item => {
        const selected = activeTab === item.id;
        const color = selected ? '#173F35' : '#6A7870';
        return (
          <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label}
            accessibilityState={{ selected }} aria-selected={selected} onPress={() => onSelect(item.id)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            <View style={[styles.icon, selected && styles.selected]}>
              <Svg width={23} height={23} viewBox="0 0 24 24" aria-hidden={true}>
                <Path d={paths[item.id]} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.label, { color }, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E6DD', paddingTop: 10, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58, gap: 4, borderRadius: 12 },
  icon: { width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#E3ECD8' },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  selectedLabel: { fontWeight: '700' },
  pressed: { backgroundColor: '#F1F4EC' },
});


