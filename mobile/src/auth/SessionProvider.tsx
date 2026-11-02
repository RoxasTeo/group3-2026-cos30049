import { readAccountRecords } from '../services/accountRecordsCache';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { resetPlantRecords, openPlantRecords, replaceServerRecords, recordsRevision } from '../data/plantRecords';
import { openSpeciesCache, refreshSpecies, resetSpecies } from '../data/speciesReference';
import { readRecords, writeRecords, readSession, writeSession, clearSession, loadDeviceKey } from '../services/offlineStorage';
import { isSealed, openText, sealText, setDeviceKey } from '../services/localEncryption';
import { fetchPlantRecords } from '../services/plantRecordsApi';
import { apiBaseUrl } from './apiConfig';
import { logoutRequest, type Session } from './loginRequest';
import { isRole } from '../navigation/roles';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const SessionContext = createContext<{ session: Session | null; signIn: (value: Session) => Promise<void>; signOut: () => void; recordsState: LoadState; recordsError: string; refreshRecords: () => Promise<void> } | null>(null);
function readAccount(value: Session) {
  return readAccountRecords(value.user, apiBaseUrl(), null, { read: readRecords, write: writeRecords });
}
// Offline records (GPS, notes, identifications) are stored encrypted with the device key.
function openAccount(value: Session) {
  const { key, raw } = readAccount(value);
  const plain = raw === null ? null : openText(raw);
  openPlantRecords(plain, data => writeRecords(key, sealText(data)));
  // Records saved by an earlier app version are re-saved encrypted immediately.
  if (raw !== null && plain !== null && !isSealed(raw)) writeRecords(key, sealText(plain));
  openSpeciesCache(apiBaseUrl(), { read: readRecords, write: writeRecords });
}
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [recordsState, setRecordsState] = useState<LoadState>('idle');
  const [recordsError, setRecordsError] = useState('');
  const requestId = useRef(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await readSession();
        if (!active || !raw) return;
        const stored = JSON.parse(raw);
        if (stored.baseUrl !== apiBaseUrl()) return;
        const value = stored.session as Session;
        if (!value?.user?.id || !value.token || !isRole(value.user.role)) return;
        setDeviceKey(await loadDeviceKey());
        openAccount(value);
        if (!active) return;
        setSession(value); setRecordsState('ready');
      } catch { if (active) setRecordsError('Could not restore saved data. Sign in again. Existing records have been kept.'); }
      finally { if (active) setHydrated(true); }
    })();
    return () => { active = false; };
  }, []);
  const signOut = useCallback(() => {
    const token = session?.token;
    // Clear credentials first. If secure storage fails, do not claim logout succeeded.
    void clearSession().then(() => {
      if (token) void logoutRequest(apiBaseUrl(), token);
      requestId.current++; resetPlantRecords(); resetSpecies(); setSession(null); setRecordsState('idle'); setRecordsError('');
    }).catch(() => setRecordsError('Could not sign out. Please retry.'));
  }, [session]);
  const refreshRecords = useCallback(async () => {
    if (!session) return;
    const current = ++requestId.current;
    const revision = recordsRevision();
    setRecordsState('loading'); setRecordsError('');
    try {
      if (Date.now() >= session.expiresAt) throw new Error('Offline access is available. Sign out and sign in again before syncing; your saved records will be kept.');
      // The species list is a reference only; failing to refresh it keeps the cached copy.
      void refreshSpecies(apiBaseUrl(), session.token).catch(() => undefined);
      const records = await fetchPlantRecords(apiBaseUrl(), session.token);
      if (current !== requestId.current) return;
      if (revision !== recordsRevision()) throw new Error('Fieldwork changed while refreshing. Refresh again to load server changes.');
      replaceServerRecords(records); setRecordsState('ready');
    } catch (error) {
      if (current !== requestId.current) return;
      setRecordsError(error instanceof Error ? error.message : 'Could not load records.'); setRecordsState('error');
    }
  }, [session]);
  const cancelRequests = useCallback(() => { requestId.current++; }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void refreshRecords(); }, 0);
    return () => { clearTimeout(timer); cancelRequests(); };
  }, [refreshRecords, cancelRequests]);
  async function signIn(value: Session) {
    // Validate the cache before saving credentials or changing the visible account.
    setDeviceKey(await loadDeviceKey());
    const { raw } = readAccount(value);
    if (raw) JSON.parse(openText(raw));
    await writeSession(JSON.stringify({ baseUrl: apiBaseUrl(), session: value }));
    requestId.current++; openAccount(value); setRecordsState('ready'); setRecordsError(''); setSession(value);
  }
  if (!hydrated) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Opening your saved fieldwork…</Text></View>;
  return <SessionContext.Provider value={{ session, recordsState, recordsError, refreshRecords, signIn, signOut }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing.');
  return context;
}
