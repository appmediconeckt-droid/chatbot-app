// Clinic LED display — the web ReceptionistLedDisplay: pick one of the doctor's
// clinic displays, open / share its LED link, and watch a live preview of the
// same token feed the LED shows (re-read every 3s while the app is open).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// React Native's own clipboard (its Android module ships with the app). The
// top-level export logs a deprecation warning on every use, so import it directly.
// eslint-disable-next-line @react-native/no-deep-imports
import Clipboard from 'react-native/Libraries/Components/Clipboard/Clipboard';
import Text from '../../../components/TranslatedText';
import { API_BASE_URL } from '../../../axiosConfig';
import {
  AlertBox, Card, CardHeading, Empty, LiveLabel, Notice, NoticeText, OptionSheet, REC, RecButton, SelectField,
} from '../receptionistUi';
import { apiError, fetchDisplayQueue, fetchDoctorDisplays } from '../receptionistApi';
import { assignedClinicId, assignedDoctorId, clinicDisplayUrl, displayTime, selectDisplayClinic, statusLabel } from '../receptionistUtils';

export default function LedDisplaySection({ profile, clinic, onNavigate }) {
  const doctorId = assignedDoctorId(profile);
  const [displays, setDisplays] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState(null);
  const [queueError, setQueueError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setNotice(''); setQueue(null);
    if (!doctorId) {
      setDisplays([]);
      setError('Your doctor assignment is missing. Contact your doctor.');
      setLoading(false);
      return undefined;
    }
    fetchDoctorDisplays(doctorId)
      .then((rows) => {
        if (cancelled) return;
        const usable = rows.filter((row) => clinicDisplayUrl(API_BASE_URL, row.doctorClinicId));
        setDisplays(usable);
        setSelectedId((current) => selectDisplayClinic(usable, current, clinic || assignedClinicId(profile)));
      })
      .catch((err) => {
        if (cancelled) return;
        setDisplays([]);
        setSelectedId('');
        setError(apiError(err, 'Unable to load LED displays. Please retry.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doctorId, clinic, profile, refresh]);

  useEffect(() => {
    if (!selectedId || loading) return undefined;
    let cancelled = false;
    let timer;
    setQueue(null);
    setQueueError('');
    const load = async () => {
      try {
        if (AppState.currentState === 'active') {
          const data = await fetchDisplayQueue(selectedId);
          if (!cancelled) { setQueue({ ...data, fetchedAt: new Date().toISOString() }); setQueueError(''); }
        }
      } catch (err) {
        if (!cancelled) {
          setQueueError(apiError(err, 'Live display data could not be refreshed.'));
          if ([401, 403, 404, 410].includes(err?.response?.status)) setQueue(null);
        }
      } finally {
        if (!cancelled) timer = setTimeout(load, 3000);
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedId, loading, refresh]);

  const selected = displays.find((row) => row.doctorClinicId === selectedId);
  const url = !loading && selected ? clinicDisplayUrl(API_BASE_URL, selectedId) : '';
  const room = queue?.roomId || selected?.clinic?.room;

  const openScreen = () => Linking.openURL(url).catch(() => setNotice('Could not open the link. Share it and open it on the LED or TV browser.'));
  const copyLink = () => {
    try {
      Clipboard.setString(url);
      setNotice('LED display link copied. Open it on your connected TV or display.');
    } catch {
      setNotice('Copy is unavailable. Select the display link below and copy it manually.');
    }
  };
  const shareLink = () => Share.share({ title: 'Clinic LED display', message: `Open this on the computer or smart TV connected to the clinic LED:\n${url}` })
    .catch(() => setNotice('Sharing is unavailable. Copy the display link below manually.'));

  return (
    <>
      <Card>
        <CardHeading
          title="Clinic LED Display"
          right={(
            <Pressable onPress={() => onNavigate('live-queue')} style={s.textButton} hitSlop={6}>
              <Ionicons name="list-outline" size={16} color={REC.primary} />
              <Text style={s.textButtonText}>Live Queue</Text>
            </Pressable>
          )}
        />
        <SelectField
          label="Display clinic / hospital"
          icon="business-outline"
          disabled={loading || !displays.length}
          valueLabel={selected ? `${selected.clinic?.name}${selected.clinic?.room ? ` - Room ${selected.clinic.room}` : ''}` : 'Select a clinic'}
          onPress={() => setPicking(true)}
        />
        <RecButton icon="refresh" label="Reload displays" disabled={loading} onPress={() => setRefresh((value) => value + 1)} />
        {loading && <View style={s.loading}><ActivityIndicator color={REC.primary} /><Text style={s.muted}>Loading your doctor's displays...</Text></View>}
        <View style={s.gap}><AlertBox text={error} /></View>
        {!loading && !error && !displays.length && (
          <Empty icon="tv-outline" title="No clinic display available" description="Ask your doctor to add an active clinic or hospital. Its LED display will appear here." />
        )}
        {!!url && (
          <>
            <View style={s.actions}>
              <RecButton primary icon="tv-outline" label="Open LED screen" onPress={openScreen} style={s.flex} />
              <RecButton icon="copy-outline" label="Copy LED link" onPress={copyLink} style={s.flex} />
            </View>
            <RecButton icon="share-social-outline" label="Share LED link" onPress={shareLink} style={s.share} />
            <Text style={s.linkLabel}>LED screen link</Text>
            <Text translate={false} selectable style={s.link}>{url}</Text>
            <Text style={s.caption}>The display updates every 3 seconds with current and next tokens, waiting count, room and doctor status.</Text>
          </>
        )}
        {!!notice && <Notice><NoticeText translate={false}>{notice}</NoticeText></Notice>}
      </Card>

      {!!url && (
        <>
          <Card>
            <CardHeading
              title="Live display preview"
              subtitle={`${selected?.clinic?.name || ''}${room ? ` / Room ${room}` : ''}`}
              right={<LiveLabel warning={Boolean(queueError)} text={queue ? `Updated ${displayTime(queue.fetchedAt)}` : 'Connecting'} />}
            />
            {!!queueError && <AlertBox text={`${queueError}${queue ? ' Showing the last successful update.' : ''}`} />}
            {!queue && !queueError && <View style={s.loading}><ActivityIndicator color={REC.primary} /><Text style={s.muted}>Loading live tokens...</Text></View>}
            {!!queue && (
              <>
                <View style={s.current}>
                  <Text style={s.eyebrow}>CURRENT TOKEN</Text>
                  <Text translate={false} style={s.currentToken}>{queue.current?.token ?? '--'}</Text>
                  <Text translate={false} style={s.muted}>{queue.current ? statusLabel(queue.current.status) : 'No patient currently called'}</Text>
                  <Text translate={false} style={s.doctor}>{queue.doctor?.name || selected?.doctor?.name || profile.assignedDoctorName}</Text>
                </View>
                <View style={s.nextRow}>
                  <View style={s.nextItem}>
                    <Text style={s.nextLabel}>Next tokens</Text>
                    <Text translate={false} style={s.nextValue}>{queue.nextTokens?.length ? queue.nextTokens.map((token) => `#${token}`).join(' / ') : 'Queue is clear'}</Text>
                  </View>
                  <View style={s.nextItem}>
                    <Text style={s.nextLabel}>Waiting</Text>
                    <Text translate={false} style={s.nextValue}>{queue.waitingCount ?? 0}</Text>
                  </View>
                  <View style={s.nextItem}>
                    <Text style={s.nextLabel}>Completed</Text>
                    <Text translate={false} style={s.nextValue}>{queue.completedCount ?? 0}</Text>
                  </View>
                </View>
                <Notice icon="time-outline">
                  <NoticeText strong translate={false}>{queue.breakInfo?.headline || statusLabel(queue.doctorStatus || 'Live queue')}</NoticeText>
                  <NoticeText translate={false}>
                    Estimated wait: {queue.estimatedWaitLabel || (queue.estimatedWaitMinutes != null ? `${queue.estimatedWaitMinutes} min` : 'Updating estimate')}
                  </NoticeText>
                </Notice>
              </>
            )}
          </Card>

          <Card>
            <CardHeading title="Show it on your LED / TV" right={<Ionicons name="tv-outline" size={20} color={REC.muted} />} />
            {[
              'Connect the LED or TV to your laptop with HDMI, or open the link in the TV browser.',
              'On the laptop, press Win + P and select Extend.',
              'Open the LED link in a separate window and move it to the LED with Win + Shift + Left / Right Arrow.',
              "Press F11 or use the display's Full screen button.",
            ].map((step, index) => (
              <View key={step} style={s.step}>
                <Text translate={false} style={s.stepNo}>{index + 1}</Text>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
            <Text style={s.caption}>Keep the laptop awake and connected to the internet. You can also share the link and open it directly in a TV browser.</Text>
          </Card>
        </>
      )}

      <OptionSheet
        visible={picking}
        title="Display clinic / hospital"
        value={selectedId}
        options={displays.map((row) => ({ value: row.doctorClinicId, label: `${row.clinic?.name}${row.clinic?.room ? ` - Room ${row.clinic.room}` : ''}` }))}
        onSelect={(value) => { setSelectedId(value); setQueue(null); setNotice(''); }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { marginTop: 12 },
  muted: { fontSize: 12.5, color: REC.muted, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textButtonText: { fontSize: 13, fontWeight: '700', color: REC.primary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  share: { marginTop: 10 },
  linkLabel: { fontSize: 12, fontWeight: '600', color: REC.muted, marginTop: 14, marginBottom: 6 },
  link: { fontSize: 12.5, color: REC.ink, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 9, padding: 11, backgroundColor: '#F7F9FB' },
  caption: { fontSize: 12, lineHeight: 18, color: '#7A8E9A', marginTop: 10 },
  current: { backgroundColor: '#EFF8F3', borderWidth: 1, borderColor: '#D8EBE0', borderRadius: 12, paddingVertical: 20, paddingHorizontal: 14, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: REC.primary },
  currentToken: { fontSize: 64, lineHeight: 76, fontWeight: '800', color: REC.primary, marginVertical: 4 },
  doctor: { fontSize: 17, fontWeight: '700', color: REC.ink, marginTop: 12 },
  nextRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 10, paddingTop: 18 },
  nextItem: { alignItems: 'center', flex: 1 },
  nextLabel: { fontSize: 11, color: '#7A8E9A' },
  nextValue: { fontSize: 16, fontWeight: '700', color: '#476072', marginTop: 6, textAlign: 'center' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNo: { width: 22, height: 22, borderRadius: 11, backgroundColor: REC.soft, color: REC.softText, fontSize: 12, fontWeight: '800', textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#5B6B7B' },
});
