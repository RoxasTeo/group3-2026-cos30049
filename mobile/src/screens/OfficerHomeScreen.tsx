import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '../auth/SessionProvider';
import { RecordButton, RecordScroll, ui } from '../components/records/RecordUI';

// Officers manage species, review field submissions and export reports on the Web portal,
// which reads the same database the Botanist app uploads to.
export default function OfficerHomeScreen() {
  const { session } = useSession();
  return <RecordScroll>
    <Text style={ui.eyebrow}>CONSERVATION OFFICER</Text>
    <Text accessibilityRole="header" style={ui.title}>Welcome, {session?.user.name}</Text>
    <View style={ui.panel}>
      <Text style={ui.sectionTitle}>Review and management</Text>
      <Text style={ui.paragraph}>Botanist uploads from this app appear in the Web portal’s Observations queue. Approve submissions, edit species records and export biodiversity reports there.</Text>
    </View>
    <View style={ui.panel}>
      <Text style={ui.sectionTitle}>In the field</Text>
      <Text style={ui.paragraph}>Browse the species knowledge system offline to support identification and visitor education.</Text>
      <RecordButton label="Open species reference" primary onPress={() => router.replace({ pathname: '/navigation/[role]/[tab]', params: { role: 'conservation_officer', tab: 'species' } })} />
    </View>
  </RecordScroll>;
}
