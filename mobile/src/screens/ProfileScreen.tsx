import React from 'react';
import { sheet, Text, View, Image, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={s.container}>
      <View style={s.headerCard}>
        <View style={s.avatarContainer}>
          <Text style={s.avatarText}>BO</Text>
        </View>
        <Text style={s.userName}>Username</Text>
        <Text style={s.userRole}>Botanist</Text>
      </View>

      <Text style={s.sectionTitle}>Account Details</Text>
      <View style={s.infoMenu}>
        <View style={s.menuItem}>
          <Text style={s.menuLabel}>Email</Text>
          <Text style={s.menuValue}>botanist@example.com</Text>
        </View>
        <View style={s.menuItem}>
          <Text style={s.menuLabel}>Total Scans</Text>
          <Text style={s.menuValue}>10 Scans</Text>
        </View>
      </View>

      <TouchableOpacity style={s.scanHistoryButton}>
        <Text style={s.buttonText}>View Scan History</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Matches your dark status bar theme
    paddingHorizontal: 20,
    paddingTop: 50,
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
