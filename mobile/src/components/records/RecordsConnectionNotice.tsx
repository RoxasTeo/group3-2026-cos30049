import { Text, View } from 'react-native';
import { useSession } from '../../auth/SessionProvider';
import { RecordButton, ui } from './RecordUI';
export default function RecordsConnectionNotice() {
  const { recordsState, recordsError, refreshRecords } = useSession();
  return <View style={{ gap: 8, marginVertical: 10 }}>
    <Text accessibilityLiveRegion="polite" style={recordsState === 'error' ? ui.error : ui.caption}>
      {recordsState === 'loading' ? 'Loading your server records...' : recordsState === 'error' ? `${recordsError} Previously loaded records and local drafts are kept.` : 'Server records loaded. Mark drafts ready and open Sync to upload.'}
    </Text>
    <RecordButton label={recordsState === 'error' ? 'Retry loading records' : 'Refresh records'} disabled={recordsState === 'loading'} onPress={() => { void refreshRecords(); }} />
  </View>;
}
