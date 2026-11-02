import { Redirect, Slot } from 'expo-router';
import { useSession } from '../../auth/SessionProvider';
export default function PlantLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/" />;
  if (session.user.role !== 'botanist') return <Redirect href="/navigation/conservation_officer/home" />;
  return <Slot />;
}
