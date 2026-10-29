import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { resetPlantRecords } from '../data/plantRecords';
import type { Session } from './loginRequest';
const SessionContext = createContext<{ session: Session | null; signIn: (value: Session) => void; signOut: () => void } | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  // Tokens stay in memory only. Reloading requires sign-in; passwords are never saved.
  const [session, setSession] = useState<Session | null>(null);
  const signOut = () => { resetPlantRecords(); setSession(null); };
  useEffect(() => {
    if (!session) return;
    const expire = () => { if (Date.now() >= session.expiresAt) { resetPlantRecords(); setSession(null); } };
    const timer = setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
    const listener = AppState.addEventListener('change', state => { if (state === 'active') expire(); });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [session]);
  return <SessionContext.Provider value={{ session, signIn: value => { resetPlantRecords(); setSession(value); }, signOut }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing.');
  return context;
}
