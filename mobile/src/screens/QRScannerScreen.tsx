import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../auth/SessionProvider';
import { getPlantRecord } from '../data/plantRecords';
import { plantIdFromQr } from '../services/qrScannerAdapter';

export default function QRScannerScreen() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const handling = useRef(false);
  const lastValue = useRef('');
  const { recordsState } = useSession();

  // Release the camera when navigating to a record, another tab, or another app.
  useFocusEffect(useCallback(() => {
    handling.current = false;
    lastValue.current = '';
    setLookingUp(false);
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
      if (!result.granted) setMessage(Platform.OS === 'web' ? 'Camera access is blocked in this browser. Allow it in browser settings, then retry.' : 'Camera access was denied. Allow it in Settings to scan plant tags.');
      setCameraError(false);
      setCameraKey(value => value + 1);
    } catch { setMessage('Camera access could not be requested. Check permissions and try again.'); }
    finally { setRequesting(false); }
  }
  function scan(value: string) {
    if (handling.current || lookingUp || lastValue.current === value) return;
    lastValue.current = value;
    const id = plantIdFromQr(value);
    if (!id) {
      setMessage('Invalid QR code. Scan a Niah plant tag (plant:record-id).');
      return;
    }
    handling.current = true;
    setLookingUp(true);
    setMessage('Looking up the downloaded plant record…');
    try {
      const record = getPlantRecord(id);
      if (record) {
        setFocused(false);
        router.push({ pathname: '/plant/[plantId]', params: { plantId: record.plantId } });
        return;
      }
      if (recordsState === 'loading') setMessage('Your records are still loading. Wait for the refresh to finish, then scan again.');
      else if (recordsState === 'error') setMessage('This record is not stored on this device. Connect and refresh Records to download it before viewing it offline.');
      else setMessage('Record not found on this device. If this tag belongs to your account, connect and refresh Records before scanning it again.');
    } catch { setMessage('The scan could not be completed. Keep the tag in the frame and try again.'); }
    finally { handling.current = false; setLookingUp(false); }
  }
  const showCamera = focused && foreground && permission?.granted && !cameraError && !lookingUp;
  const settingsNeeded = permission && !permission.granted && !permission.canAskAgain && Platform.OS !== 'web';
  return <View style={s.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to botanist home" style={s.back} onPress={() => router.replace('/navigation/botanist/home')}><Text style={s.backText}>‹ Back</Text></Pressable>
    <Text accessibilityRole="header" style={s.title}>Scan plant tag</Text>
    <Text style={s.copy}>Use the camera to find an existing plant record.</Text>
    <View accessibilityLabel="Plant QR camera preview" style={s.preview}>
      {showCamera && <CameraView key={cameraKey} style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }: { data: string }) => scan(data)} onMountError={() => { setCameraError(true); setMessage('Camera unavailable. Close other camera apps and retry. Browser preview requires HTTPS or localhost and a camera-enabled browser.'); }} />}
      <View pointerEvents="none" style={s.frame}><Text style={s.frameText}>{lookingUp ? 'CHECKING RECORD' : showCamera ? 'ALIGN QR TAG' : 'CAMERA PREVIEW'}</Text></View>
      {lookingUp && <ActivityIndicator color="#FFFFFF" size="large" style={s.previewLoader} />}
    </View>
    {(!permission || requesting) && <ActivityIndicator style={s.loader} />}
    <Text accessibilityLiveRegion="polite" style={s.notice}>{message || (permission?.granted ? 'Centre an existing Niah plant tag in the frame. Only downloaded records can be opened offline.' : 'Allow camera access to scan an existing Niah plant tag.')}</Text>
    {(!permission?.granted || cameraError) && <Pressable accessibilityRole="button" disabled={requesting} accessibilityState={{ disabled: requesting }} style={s.outline} onPress={enableCamera}><Text style={s.outlineText}>{requesting ? 'Requesting access...' : settingsNeeded ? 'Open camera settings' : cameraError ? 'Retry camera' : 'Enable camera'}</Text></Pressable>}
    {permission?.granted && !cameraError && <Text style={s.help}>Scanning uses the live camera only. For safety and privacy, QR images and manual code entry are not supported.</Text>}
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, paddingBottom: 12 }, back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12 }, backText: { color: '#173F35', fontWeight: '700', fontSize: 16 }, title: { fontSize: 28, fontWeight: '700', color: '#203C33' }, copy: { color: '#64756C', marginTop: 7, fontSize: 15 },
  preview: { height: 280, backgroundColor: '#274C42', borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  frame: { width: '68%', aspectRatio: 1, borderWidth: 3, borderColor: '#D8E8AD', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  frameText: { color: '#fff', backgroundColor: '#173F35', padding: 8, fontWeight: '700', letterSpacing: 1 }, previewLoader: { position: 'absolute' }, loader: { marginTop: 12 },
  notice: { backgroundColor: '#E8F0E2', color: '#203C33', padding: 13, borderRadius: 12, marginTop: 12, lineHeight: 19 },
  outline: { minHeight: 50, borderWidth: 1, borderColor: '#49685C', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, outlineText: { color: '#173F35', fontWeight: '700' }, help: { color: '#64756C', marginTop: 14, fontSize: 12, lineHeight: 18 },
});
