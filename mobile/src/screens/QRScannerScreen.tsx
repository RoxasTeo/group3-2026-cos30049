import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../auth/SessionProvider';
import { findPlantByQr } from '../data/plantRecords';
import { plantIdFromQr } from '../services/qrScannerAdapter';

export default function QRScannerScreen() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const handling = useRef(false);
  const lastValue = useRef('');
  const { recordsState } = useSession();

  // Release the camera when navigating to a record, another tab, or another app.
  useFocusEffect(useCallback(() => {
    handling.current = false;
    lastValue.current = '';
    setFocused(true);
    setMessage('');
    return () => { setFocused(false); };
  }, []));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') void getPermission().catch(() => setMessage('Could not check camera permission. Please try again.'));
    });
    return () => listener.remove();
  }, [getPermission]);

  async function enableCamera() {
    if (requesting) return;
    setRequesting(true);
    setMessage('');
    try {
      if (permission && !permission.granted && !permission.canAskAgain && Platform.OS !== 'web') {
        await Linking.openSettings();
        return;
      }
      const result = await requestPermission();
      if (!result.granted) setMessage(Platform.OS === 'web' ? 'Allow camera access in your browser settings, or use manual entry.' : 'Camera access was denied. You can still enter a plant ID manually.');
      setCameraError(false);
      setCameraKey(value => value + 1);
    } catch { setMessage('Could not access the camera. Check permissions or use manual entry.'); }
    finally { setRequesting(false); }
  }
  function scan(value: string, fromCamera = false) {
    if (handling.current) return;
    if (fromCamera && lastValue.current === value) return;
    const id = plantIdFromQr(value);
    if (!id) {
      if (fromCamera) lastValue.current = value;
      setMessage('This QR code does not contain a valid plant ID. Try another tag or enter its ID below.');
      return;
    }
    if (recordsState === 'loading' && !findPlantByQr(id)) {
      setMessage('Load your records from Home or Records before scanning, so existing plants can be matched correctly.');
      return;
    }
    if (id.startsWith('OBS:') && !findPlantByQr(id)) {
      setMessage('This observation is not downloaded yet. Refresh Records while connected, then scan again.');
      return;
    }
    handling.current = true;
    setFocused(false);
    router.push({ pathname: findPlantByQr(id) ? '/plant/[plantId]' : '/plant/new', params: { plantId: findPlantByQr(id)?.plantId ?? id } });
  }
  const showCamera = focused && foreground && permission?.granted && !cameraError;
  const settingsNeeded = permission && !permission.granted && !permission.canAskAgain && Platform.OS !== 'web';
  return <View style={s.root}>
    <Text accessibilityRole="header" style={s.title}>Scan plant tag</Text>
    <Text style={s.copy}>Point your camera at a plant QR code.</Text>
    <View accessibilityLabel="Plant QR camera preview" style={s.preview}>
      {showCamera && <CameraView key={cameraKey} style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => scan(data, true)} onMountError={() => { setCameraError(true); setMessage('Camera could not start. Close other camera apps and retry. In a browser, use HTTPS or localhost, or scan in Expo Go.'); }} />}
      <View pointerEvents="none" style={s.frame}><Text style={s.frameText}>{showCamera ? 'ALIGN QR TAG' : 'CAMERA PREVIEW'}</Text></View>
    </View>
    {(!permission || requesting) && <ActivityIndicator style={s.loader} />}
    <Text accessibilityLiveRegion="polite" style={s.notice}>{message || (permission?.granted ? 'Scan an existing tag to view its record, or a new tag to start a draft.' : 'Allow camera access to scan plant tags. Manual entry is always available.')}</Text>
    {(!permission?.granted || cameraError) && <Pressable accessibilityRole="button" disabled={requesting} accessibilityState={{ disabled: requesting }} style={s.outline} onPress={enableCamera}><Text style={s.outlineText}>{requesting ? 'Requesting access...' : settingsNeeded ? 'Open camera settings' : cameraError ? 'Retry camera' : 'Enable camera'}</Text></Pressable>}
    <Text style={s.manual}>Enter plant ID manually</Text>
    <TextInput accessibilityLabel="Plant QR value" style={s.input} placeholder="DEMO-PLANT-001" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} onSubmitEditing={() => scan(code)} />
    <Pressable accessibilityRole="button" style={s.button} onPress={() => scan(code)}><Text style={s.buttonText}>Look up plant record</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, title: { fontSize: 28, fontWeight: '700', color: '#203C33' }, copy: { color: '#64756C', marginTop: 7, fontSize: 15 },
  preview: { height: 280, backgroundColor: '#274C42', borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  frame: { width: '68%', aspectRatio: 1, borderWidth: 3, borderColor: '#D8E8AD', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  frameText: { color: '#fff', backgroundColor: '#173F35', padding: 8, fontWeight: '700', letterSpacing: 1 }, loader: { marginTop: 12 },
  notice: { backgroundColor: '#E8F0E2', color: '#203C33', padding: 13, borderRadius: 12, marginTop: 12, lineHeight: 19 },
  outline: { minHeight: 50, borderWidth: 1, borderColor: '#49685C', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, outlineText: { color: '#173F35', fontWeight: '700' },
  manual: { fontSize: 18, fontWeight: '700', color: '#203C33', marginTop: 22 }, input: { minHeight: 54, backgroundColor: '#fff', borderWidth: 1, borderColor: '#B9C8BF', borderRadius: 12, paddingHorizontal: 14, marginTop: 10, fontSize: 16 },
  button: { minHeight: 55, backgroundColor: '#173F35', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
