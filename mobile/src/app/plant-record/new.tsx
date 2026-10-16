import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Destination for the Home action until the plant-record form is integrated.
export default function NewPlantRecord() {
  return <SafeAreaView style={s.root}><StatusBar style="dark" /><View style={s.body}>
    <Pressable accessibilityRole="button" style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/navigation/botanist/home')}><Text style={s.link}>← Back to Home</Text></Pressable>
    <Text accessibilityRole="header" style={s.title}>New plant record</Text>
    <Text style={s.message}>The plant entry form is not available yet. This page is ready for the record-entry feature to be added.</Text>
    <Text style={s.note}>No record has been created or saved.</Text>
  </View></SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9F4', alignItems: 'center' },
  body: { width: '100%', maxWidth: 480, padding: 24 },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: '#34664B', fontSize: 14, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '600', color: '#173F35', marginTop: 24 },
  message: { color: '#65736A', fontSize: 15, lineHeight: 24, marginTop: 16 },
  note: { color: '#65736A', fontSize: 12, lineHeight: 20, marginTop: 18 },
});
