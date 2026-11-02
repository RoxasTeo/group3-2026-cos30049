import { Redirect, Slot } from 'expo-router';
import { useSession } from '../../auth/SessionProvider';
export default function NavigationLayout() {
  const { session } = useSession();
  return session ? <Slot /> : <Redirect href="/" />;
}
