import { router } from 'expo-router';
import { usePlantRecords } from '../hooks/usePlantRecords';
import { StyleSheet, ScrollView, Text, View, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const records = usePlantRecords();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#121212' }} contentContainerStyle={s.container}>
      <View style={s.headerCard}>
        <View style={s.avatarContainer}>
          <Text style={s.avatarText}>BO</Text>
        </View>
        <Text style={s.userName}>Demo Botanist</Text>
        <Text style={s.userRole}>Botanist</Text>
      </View>

      <Text style={s.sectionTitle}>Account Details (preview)</Text>
      <View style={s.infoMenu}>
        <View style={s.menuItem}>
          <Text style={s.menuLabel}>Email</Text>
          <Text style={s.menuValue}>botanist@example.com</Text>
        </View>
        <View style={s.menuItem}>
          <Text style={s.menuLabel}>Session records</Text>
          <Text style={s.menuValue}>{records.length} records</Text>
        </View>
      </View>

      <TouchableOpacity accessibilityRole="button" style={s.scanHistoryButton} onPress={() => router.push({ pathname: '/navigation/[role]/[tab]', params: { role: 'botanist', tab: 'records' } })}>
        <Text style={s.buttonText}>View Plant Records</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#121212', // Matches your dark status bar theme
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 24,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF', // Clean iOS blue accent
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userRole: {
    fontSize: 14,
    color: '#8e8e93',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 10,
    paddingLeft: 4,
  },
  infoMenu: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 25,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2c',
  },
  menuLabel: {
    color: '#8e8e93',
    fontSize: 16,
  },
  menuValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  scanHistoryButton: {
    backgroundColor: '#3a3a3c',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
