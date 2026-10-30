// Clinic LED display — the web ReceptionistLedDisplay: pick one of the doctor's
// clinic displays, open / share its LED link, and watch a live preview of the
// same token feed the LED shows (re-read every 3s while the app is open).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
// React Native's own clipboard (its Android module ships with the app). The
// top-level export logs a deprecation warning on every use, so import it directly.
// eslint-disable-next-line @react-native/no-deep-imports
import Clipboard from 'react-native/Libraries/Components/Clipboard/Clipboard';
import Text from '../../../components/TranslatedText';
import { API_BASE_URL } from '../../../axiosConfig';
import { useResponsiveLayout } from '../../../components/common/ResponsiveLayout';
import {
  AlertBox, Card, CardHeading, Empty, LiveLabel, Notice, NoticeText, OptionSheet, REC, RecButton,
} from '../receptionistUi';
import { apiError, fetchDisplayQueue, fetchDoctorDisplays } from '../receptionistApi';
import { assignedClinicId, assignedDoctorId, clinicDisplayUrl, displayTime, selectDisplayClinic, statusLabel } from '../receptionistUtils';

const clinicLabel = (row) => `${row.clinic?.name}${row.clinic?.room ? ` - Room ${row.clinic.room}` : ''}`;

export default function LedDisplaySection({ profile, clinic, onNavigate }) {
  const { gutter } = useResponsiveLayout();
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

  const doctorName = queue?.doctor?.name || selected?.doctor?.name || profile.assignedDoctorName;
  const wait = queue?.estimatedWaitLabel || (queue?.estimatedWaitMinutes != null ? `${queue.estimatedWaitMinutes} min` : '--');
  const statusLine = queue?.breakInfo?.headline || statusLabel(queue?.doctorStatus || 'Live queue');
  const nextTokens = (queue?.nextTokens || []).slice(0, 5);
  const reload = () => setRefresh((value) => value + 1);

  return (
    <View style={[s.page, { paddingHorizontal: gutter }]}>
      <LinearGradient colors={['#0D6A62', '#1A9483']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroGlow} />
        <View style={s.heroTop}>
          <View style={s.heroIcon}><Ionicons name="tv-outline" size={22} color="#FFFFFF" /></View>
          <View style={s.flex}>
            <Text style={s.heroEyebrow}>CLINIC LED DISPLAY</Text>
            <Text style={s.heroTitle}>Waiting room screen</Text>
          </View>
          <Pressable onPress={() => onNavigate('live-queue')} style={s.heroLink} hitSlop={6} accessibilityRole="button">
            <Ionicons name="list-outline" size={14} color="#FFFFFF" />
            <Text style={s.heroLinkText}>Live Queue</Text>
          </Pressable>
        </View>
        <Text style={s.heroText}>Show the current and next tokens on the clinic LED or TV. It refreshes every 3 seconds.</Text>
        <Pressable
          onPress={() => setPicking(true)}
          disabled={loading || !displays.length}
          style={({ pressed }) => [s.clinicPicker, pressed && s.clinicPickerPressed]}
          accessibilityRole="button"
          accessibilityLabel="Display clinic / hospital"
        >
          <View style={s.clinicPickerIcon}><Ionicons name="business" size={16} color={REC.primary} /></View>
          <View style={s.flex}>
            <Text style={s.clinicPickerLabel}>Display for</Text>
            <Text translate={false} style={s.clinicPickerValue} numberOfLines={1}>
              {loading ? 'Loading displays...' : selected ? clinicLabel(selected) : 'No clinic selected'}
            </Text>
          </View>
          {!loading && displays.length > 0 && <Ionicons name="chevron-down" size={18} color={REC.muted} />}
        </Pressable>
      </LinearGradient>

      {loading && (
        <Card><View style={s.loading}><ActivityIndicator color={REC.primary} /><Text style={s.muted}>Loading your doctor's displays...</Text></View></Card>
      )}
      {!loading && !!error && (
        <Card>
          <AlertBox text={error} />
          <RecButton full icon="refresh" label="Retry" onPress={reload} />
        </Card>
      )}
      {!loading && !error && !displays.length && (
        <Card>
          <Empty icon="tv-outline" title="No clinic display available" description="Ask your doctor to add an active clinic or hospital. Its LED display will appear here." />
          <RecButton full icon="refresh" label="Reload displays" onPress={reload} />
        </Card>
      )}

      {!!url && (
        <>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Live preview</Text>
            <LiveLabel warning={Boolean(queueError)} text={queue ? `Updated ${displayTime(queue.fetchedAt)}` : 'Connecting'} />
          </View>

          {/* Drawn like the TV in the waiting room: the same feed the LED shows. */}
          <View style={s.tv}>
            <View style={s.tvScreen}>
              {!queue ? (
                <View style={s.tvLoading}>
                  <ActivityIndicator color="#5EEAD4" />
                  <Text style={s.tvMuted}>{queueError ? 'Waiting for the display feed...' : 'Loading live tokens...'}</Text>
                </View>
              ) : (
                <>
                  <View style={s.tvTop}>
                    <View style={s.flex}>
                      <Text translate={false} style={s.tvClinic} numberOfLines={1}>{selected?.clinic?.name || 'Clinic'}</Text>
                      <Text translate={false} style={s.tvDoctor} numberOfLines={1}>{[doctorName, room && `Room ${room}`].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={s.tvLive}>
                      <View style={[s.tvLiveDot, !!queueError && s.tvLiveDotWarning]} />
                      <Text style={s.tvLiveText}>LIVE</Text>
                    </View>
                  </View>

                  <View style={s.tvCurrent}>
                    <Text style={s.tvEyebrow}>NOW SERVING</Text>
                    <Text translate={false} style={s.tvToken} numberOfLines={1} adjustsFontSizeToFit>{queue.current?.token ?? '--'}</Text>
                    <Text translate={false} style={s.tvStatus}>{queue.current ? statusLabel(queue.current.status) : 'No patient currently called'}</Text>
                  </View>

                  <Text style={s.tvNextLabel}>NEXT TOKENS</Text>
                  {nextTokens.length ? (
                    <View style={s.tvNextRow}>
                      {nextTokens.map((token, index) => (
                        <View key={`${token}-${index}`} style={[s.tvNextChip, index === 0 && s.tvNextChipFirst]}>
                          <Text translate={false} style={[s.tvNextText, index === 0 && s.tvNextTextFirst]}>{token}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.tvMuted}>Queue is clear</Text>
                  )}

                  <View style={s.tvStats}>
                    {[
                      ['Waiting', queue.waitingCount ?? 0],
                      ['Completed', queue.completedCount ?? 0],
                      ['Est. wait', wait],
                    ].map(([label, value], index) => (
                      <View key={label} style={[s.tvStat, index > 0 && s.tvStatDivider]}>
                        <Text translate={false} style={s.tvStatValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                        <Text style={s.tvStatLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[s.tvFooter, !!queue.breakInfo?.headline && s.tvFooterBreak]}>
                    <Ionicons name={queue.breakInfo?.headline ? 'cafe-outline' : 'pulse-outline'} size={14} color={queue.breakInfo?.headline ? '#FBBF24' : '#5EEAD4'} />
                    <Text translate={false} style={[s.tvFooterText, !!queue.breakInfo?.headline && s.tvFooterTextBreak]} numberOfLines={2}>{statusLine}</Text>
                  </View>
                </>
              )}
            </View>
            <View style={s.tvNeck} />
            <View style={s.tvBase} />
          </View>
          {!!queueError && <View style={s.gap}><AlertBox text={`${queueError}${queue ? ' Showing the last successful update.' : ''}`} /></View>}

          <Card style={s.actionsCard}>
            <CardHeading
              title="Open on your LED"
              subtitle="Open the screen here, or send the link to the TV or laptop."
              right={(
                <Pressable onPress={reload} style={s.iconButton} hitSlop={6} accessibilityLabel="Reload displays">
                  <Ionicons name="refresh" size={18} color={REC.primary} />
                </Pressable>
              )}
            />
            <RecButton primary icon="tv-outline" label="Open LED screen" onPress={openScreen} />
            <View style={s.actions}>
              <RecButton icon="copy-outline" label="Copy link" onPress={copyLink} style={s.flex} />
              <RecButton icon="share-social-outline" label="Share link" onPress={shareLink} style={s.flex} />
            </View>
            <View style={s.linkBox}>
              <Ionicons name="link-outline" size={16} color={REC.primary} />
              <Text translate={false} selectable style={s.link} numberOfLines={2}>{url}</Text>
            </View>
            {!!notice && <Notice style={s.gap}><NoticeText translate={false}>{notice}</NoticeText></Notice>}
          </Card>

          <Card>
            <CardHeading title="Set up the LED / TV" subtitle="One-time setup on the laptop connected to the screen" />
            {SETUP_STEPS.map(([icon, step], index) => (
              <View key={step} style={s.step}>
                <View style={s.stepRail}>
                  <View style={s.stepNo}><Text translate={false} style={s.stepNoText}>{index + 1}</Text></View>
                  {index < SETUP_STEPS.length - 1 && <View style={s.stepLine} />}
                </View>
                <View style={s.stepBody}>
                  <Ionicons name={icon} size={16} color={REC.primary} style={s.stepIcon} />
                  <Text style={s.stepText}>{step}</Text>
                </View>
              </View>
            ))}
            <View style={s.tip}>
              <Ionicons name="bulb-outline" size={16} color="#B54708" />
              <Text style={s.tipText}>Keep the laptop awake and online. You can also open the link directly in a smart TV browser.</Text>
            </View>
          </Card>
        </>
      )}

      <OptionSheet
        visible={picking}
        title="Display clinic / hospital"
        value={selectedId}
        options={displays.map((row) => ({ value: row.doctorClinicId, label: clinicLabel(row) }))}
        onSelect={(value) => { setSelectedId(value); setQueue(null); setNotice(''); }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const SETUP_STEPS = [
  ['tv-outline', 'Connect the LED or TV to your laptop with HDMI, or open the link in the TV browser.'],
  ['desktop-outline', 'On the laptop, press Win + P and select Extend.'],
  ['move-outline', 'Open the LED link in a separate window and move it to the LED with Win + Shift + Left / Right Arrow.'],
  ['expand-outline', "Press F11 or use the display's Full screen button."],
];

const s = StyleSheet.create({
  page: { minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  gap: { marginTop: 12 },
  muted: { fontSize: 12.5, color: REC.muted, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 20 },

  hero: {
    padding: 18, borderRadius: 18, marginBottom: 18, overflow: 'hidden',
    shadowColor: '#0D6A62', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  heroGlow: { position: 'absolute', top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(255,255,255,0.72)' },
  heroTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroLinkText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  heroText: { fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.86)', marginTop: 12 },
  clinicPicker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 10, paddingRight: 12, borderRadius: 13, backgroundColor: '#FFFFFF' },
  clinicPickerPressed: { backgroundColor: '#EEF8F4' },
  clinicPickerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  clinicPickerLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: REC.muted },
  clinicPickerValue: { fontSize: 14, fontWeight: '700', color: REC.ink, marginTop: 1 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: REC.ink },

  tv: { alignItems: 'center', marginBottom: 6 },
  tvScreen: {
    alignSelf: 'stretch', padding: 16, borderRadius: 18, backgroundColor: '#0B1A1F', borderWidth: 6, borderColor: '#1C2B31',
    shadowColor: '#0B1A1F', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  tvNeck: { width: 18, height: 12, backgroundColor: '#1C2B31' },
  tvBase: { width: 110, height: 6, borderRadius: 3, backgroundColor: '#1C2B31' },
  tvLoading: { alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 220 },
  tvTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tvClinic: { fontSize: 14, fontWeight: '800', color: '#F1F5F9' },
  tvDoctor: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  tvLive: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(52,211,153,0.14)' },
  tvLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  tvLiveDotWarning: { backgroundColor: '#FBBF24' },
  tvLiveText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#6EE7B7' },
  tvCurrent: { alignItems: 'center', marginTop: 14, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(20,184,166,0.10)', borderWidth: 1, borderColor: 'rgba(94,234,212,0.22)' },
  tvEyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 2, color: '#5EEAD4' },
  tvToken: { fontSize: 68, lineHeight: 80, fontWeight: '900', color: '#FFFFFF', paddingHorizontal: 12 },
  tvStatus: { fontSize: 12.5, fontWeight: '600', color: '#99F6E4' },
  tvNextLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, color: '#94A3B8', marginTop: 16, marginBottom: 8 },
  tvNextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tvNextChip: { minWidth: 48, height: 38, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  tvNextChipFirst: { backgroundColor: 'rgba(251,191,36,0.14)', borderColor: 'rgba(251,191,36,0.40)' },
  tvNextText: { fontSize: 17, fontWeight: '800', color: '#E2E8F0' },
  tvNextTextFirst: { color: '#FCD34D' },
  tvMuted: { fontSize: 12.5, color: '#94A3B8' },
  tvStats: { flexDirection: 'row', marginTop: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  tvStat: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 6 },
  tvStatDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' },
  tvStatValue: { fontSize: 18, fontWeight: '800', color: '#F8FAFC' },
  tvStatLabel: { fontSize: 10.5, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  tvFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  tvFooterBreak: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(251,191,36,0.10)' },
  tvFooterText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#99F6E4' },
  tvFooterTextBreak: { color: '#FCD34D' },

  actionsCard: { marginTop: 16 },
  iconButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 11, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BCD9D2', backgroundColor: '#F6FBF9' },
  link: { flex: 1, fontSize: 12.5, color: REC.ink },

  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 26 },
  stepNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: REC.primary, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  stepLine: { flex: 1, width: 2, minHeight: 12, marginVertical: 3, backgroundColor: '#D5EDE3' },
  stepBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 3, paddingBottom: 14 },
  stepIcon: { marginTop: 1 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#475467' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 11, backgroundColor: '#FFF8EC', borderWidth: 1, borderColor: '#F6DDAE' },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#7A4A0B' },
});
