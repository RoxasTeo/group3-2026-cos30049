import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { resetPlantRecords, openPlantRecords, replaceServerRecords, recordsRevision } from '../data/plantRecords';
import { readRecords, writeRecords, readSession, writeSession, clearSession } from '../services/offlineStorage';
import { fetchPlantRecords } from '../services/plantRecordsApi';
import { apiBaseUrl, previousApiBaseUrl } from './apiConfig';
import type { Session } from './loginRequest';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const SessionContext = createContext<{ session: Session | null; signIn: (value: Session) => Promise<void>; signOut: () => void; recordsState: LoadState; recordsError: string; refreshRecords: () => Promise<void> } | null>(null);
function readAccount(value: Session) {
  const key = `niah.records.v1:${apiBaseUrl()}:${value.user.id}:${value.user.email}`;
  let raw = readRecords(key);
  const previous = previousApiBaseUrl();
  if (!raw && previous) {
    raw = readRecords(`niah.records.v1:${previous}:${value.user.id}:${value.user.email}`);
    if (raw) {
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored.records) || !Array.isArray(stored.remoteIds)) throw new Error('Cannot migrate saved records. Original data was kept.');
      writeRecords(key, raw); // Copy before use; keep the original cache as a fallback.
    }
  }
  return { key, raw };
}
function openAccount(value: Session) {
  const { key, raw } = readAccount(value);
  openPlantRecords(raw, data => writeRecords(key, data));
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
        if (stored.baseUrl !== apiBaseUrl() && stored.baseUrl !== previousApiBaseUrl()) return;
        const value = stored.session as Session;
        if (!value?.user?.id || !value.token || !['botanist', 'conservation-officer'].includes(value.user.role)) return;
        openAccount(value);
        if (stored.baseUrl !== apiBaseUrl()) await writeSession(JSON.stringify({ baseUrl: apiBaseUrl(), session: value }));
        if (!active) return;
        setSession(value); setRecordsState('ready');
      } catch { if (active) setRecordsError('Could not restore saved data. Sign in again. Existing records have been kept.'); }
      finally { if (active) setHydrated(true); }
    })();
    return () => { active = false; };
  }, []);
  const signOut = useCallback(() => {
    // Clear credentials first. If secure storage fails, do not claim logout succeeded.
    void clearSession().then(() => { requestId.current++; resetPlantRecords(); setSession(null); setRecordsState('idle'); setRecordsError(''); }).catch(() => setRecordsError('Could not sign out. Please retry.'));
  }, []);
  const refreshRecords = useCallback(async () => {
    if (!session) return;
    const current = ++requestId.current;
    const revision = recordsRevision();
    setRecordsState('loading'); setRecordsError('');
    try {
      if (Date.now() >= session.expiresAt) throw new Error('Offline access is available. Sign out and sign in again before syncing; your saved records will be kept.');
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
    const { raw } = readAccount(value);
    if (raw) JSON.parse(raw);
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
