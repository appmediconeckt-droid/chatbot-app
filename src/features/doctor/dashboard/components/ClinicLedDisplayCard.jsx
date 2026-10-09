// "Clinic LED Display" (screen connect) for one clinic — same API and flow as
// the web doctor dashboard's AppointmentQR/AllQRcode.jsx LED panel:
//   PATCH /api/qr/walkin/:doctorClinicId/room     doctor's room number at a clinic
//   GET   /api/qr/walkin/:doctorClinicId/queue    the feed the LED page itself polls
// The LED page lives on the backend root at /display/clinic/:doctorClinicId.
// The preview below is a small replica of that big-screen page.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Share, TextInput, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance, { API_BASE_URL } from '../../../../axiosConfig';
import ClinicQueueDisplay from './ClinicQueueDisplay';

const SERVER_ROOT = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '');
// The LED page refreshes every 3s; the in-app preview only needs to look live.
const PREVIEW_POLL_MS = 5000;

const STEPS = [
  { icon: 'send', title: 'Send the LED link', text: 'Send it to the laptop or smart TV connected to the clinic LED (WhatsApp, email).' },
  { icon: 'globe', title: 'Open it on that screen', text: 'Open the link in the browser on the big screen and tap "Full screen".' },
  { icon: 'check', title: 'Keep it on', text: 'Keep that device awake and online. It updates every 3 seconds by itself.' },
  { icon: 'smartphone', title: 'No laptop or smart TV?', text: 'Connect this phone/tablet to the TV (HDMI or screen cast) and tap "Start Queue Display".' },
];

export default function ClinicLedDisplayCard({ doctorClinicId, clinicName, room: savedRoom, onRoomSaved, loading }) {
  const [room, setRoom] = useState(savedRoom || '');
  const [savingRoom, setSavingRoom] = useState(false);
  const [notice, setNotice] = useState(null);
  const [queue, setQueue] = useState(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const ledUrl = doctorClinicId ? `${SERVER_ROOT}/display/clinic/${doctorClinicId}` : '';
  const roomChanged = room.trim() !== String(savedRoom || '').trim();

  useEffect(() => { setRoom(savedRoom || ''); setNotice(null); }, [doctorClinicId, savedRoom]);

  // Live mini preview, only while the app is in the foreground.
  const requestNo = useRef(0);
  useEffect(() => {
    setQueue(null);
    if (!doctorClinicId) return undefined;
    let cancelled = false;
    const poll = async () => {
      if (AppState.currentState !== 'active') return;
      const mine = ++requestNo.current;
      try {
        const res = await axiosInstance.get(`/api/qr/walkin/${encodeURIComponent(doctorClinicId)}/queue`);
        if (!cancelled && mine === requestNo.current) setQueue(res.data || null);
      } catch {
        // Decorative preview; the LED page keeps working regardless.
      }
    };
    poll();
    const timer = setInterval(poll, PREVIEW_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [doctorClinicId]);

  const saveRoom = async () => {
    if (!doctorClinicId || savingRoom) return;
    const value = room.trim();
    if (!value || value.length > 100) {
      setNotice({ error: true, text: 'Enter a room number between 1 and 100 characters' });
      return;
    }
    setSavingRoom(true);
    setNotice(null);
    try {
      const res = await axiosInstance.patch(
        `/api/qr/walkin/${encodeURIComponent(doctorClinicId)}/room`, { roomNumber: value });
      const saved = res.data?.data?.roomNumber ?? value;
      onRoomSaved?.(saved);
      setNotice({ error: false, text: 'Room saved. The LED screen updates automatically.' });
    } catch (err) {
      setNotice({ error: true, text: err?.response?.data?.message || 'Unable to save room. Please retry.' });
    } finally {
      setSavingRoom(false);
    }
  };

  // No clipboard module in this app — the share sheet offers "Copy".
  const shareLed = () => {
    if (!ledUrl) return;
    Share.share({
      title: 'Clinic LED display',
      message: `Open this on the computer or smart TV connected to the clinic LED, then tap "Full screen & sound":\n${ledUrl}`,
    }).catch(() => {});
  };

  return (
    <View style={s.card}>
      <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroDecoLg} />
        <View style={s.heroDecoSm} />
        <View style={s.heroRow}>
          <View style={s.heroIcon}><AppIcon name="laptop" size={20} color="#FFF" /></View>
          <View style={s.flex}>
            <Text style={s.heroTitle}>Clinic LED Display</Text>
            <Text style={s.heroSub} numberOfLines={2}>
              Show your live token queue on the big screen at <Text translate={false}>{clinicName}</Text>.
            </Text>
          </View>
          {!!doctorClinicId && (
            <View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View>
          )}
        </View>
      </LinearGradient>

      <View style={s.body}>
        {loading ? (
          <View style={s.state}><ActivityIndicator color="#0D9488" /></View>
        ) : !doctorClinicId ? (
          <View style={s.state}>
            <AppIcon name="info" size={22} color="#98A2B3" />
            <Text style={s.stateText}>The LED display for this clinic isn't ready yet. Tap Refresh above to try again.</Text>
          </View>
        ) : (
          <>
            <Text style={s.overline}>LIVE PREVIEW</Text>
            <TvPreview queue={queue} room={savedRoom} clinicName={clinicName} />

            <Text style={s.overline}>ROOM NUMBER</Text>
            <View style={s.roomRow}>
              <View style={s.roomField}>
                <AppIcon name="pin" size={16} color="#0D9488" />
                <TextInput
                  value={room}
                  onChangeText={(v) => { setRoom(v); setNotice(null); }}
                  maxLength={100}
                  editable={!savingRoom}
                  placeholder="e.g. 101 or OPD-2"
                  placeholderTextColor="#98A2B3"
                  returnKeyType="done"
                  onSubmitEditing={saveRoom}
                  style={s.roomInput}
                />
              </View>
              <Pressable
                onPress={saveRoom}
                disabled={savingRoom || !roomChanged}
                style={[s.saveBtn, (savingRoom || !roomChanged) && s.disabled]}
              >
                {savingRoom ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.saveText}>Save</Text>}
              </Pressable>
            </View>
            <Text style={[s.hint, notice && (notice.error ? s.noticeError : s.noticeOk)]}>
              {notice ? notice.text : 'Patients see "Please proceed to Room …" on the screen.'}
            </Text>

            <Text style={s.overline}>CONNECT THE SCREEN</Text>
            <Pressable onPress={shareLed} style={({ pressed }) => [s.primaryWrap, pressed && s.pressed]}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
                <AppIcon name="send" size={17} color="#FFF" />
                <Text style={s.primaryText}>Send LED link to the screen</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={shareLed} style={s.linkBox}>
              <Text translate={false} selectable numberOfLines={3} style={s.linkText}>{ledUrl}</Text>
              <View style={s.copyChip}><Text style={s.copyText}>Copy</Text></View>
            </Pressable>
            <Pressable onPress={() => setDisplayOpen(true)} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
              <AppIcon name="smartphone" size={15} color="#0F766E" />
              <View style={s.flex}>
                <Text style={s.secondaryTitle}>Start Queue Display on this device</Text>
                <Text style={s.secondaryText}>For a TV connected to this phone/tablet (HDMI or screen cast)</Text>
              </View>
              <AppIcon name="chevron-right" size={16} color="#98A2B3" />
            </Pressable>

            <Pressable onPress={() => setStepsOpen((v) => !v)} style={s.stepsHead}>
              <View style={s.stepsIcon}><AppIcon name="info" size={15} color="#0D9488" /></View>
              <Text style={s.stepsTitle}>How to connect the LED screen</Text>
              <View style={stepsOpen && s.chevronOpen}>
                <AppIcon name="chevron-down" size={18} color="#667085" />
              </View>
            </Pressable>
            {stepsOpen && STEPS.map((step, i) => (
              <View key={step.title} style={s.step}>
                <View style={s.stepRail}>
                  <View style={s.stepNo}><Text translate={false} style={s.stepNoText}>{i + 1}</Text></View>
                  {i < STEPS.length - 1 && <View style={s.stepLine} />}
                </View>
                <View style={s.stepBody}>
                  <View style={s.stepTitleRow}>
                    <AppIcon name={step.icon} size={14} color="#0D9488" />
                    <Text style={s.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
      <ClinicQueueDisplay
        visible={displayOpen}
        onClose={() => setDisplayOpen(false)}
        doctorClinicId={doctorClinicId}
        clinicName={clinicName}
      />
    </View>
  );
}

// Miniature of the big-screen page (same layout and colours).
function TvPreview({ queue, room, clinicName }) {
  const current = queue?.current?.token;
  const next = (queue?.nextTokens || []).slice(0, 3);
  return (
    <View style={s.tvWrap}>
      <View style={s.tv}>
        <View style={s.tvTop}>
          <Text translate={false} numberOfLines={1} style={s.tvClinic}>{String(clinicName || '').toUpperCase()}</Text>
          <View style={s.tvLive}><View style={s.tvLiveDot} /><Text style={s.tvLiveText}>Live</Text></View>
        </View>
        <View style={s.tvMain}>
          <View style={s.tvServing}>
            <Text style={s.tvLabel}>NOW SERVING</Text>
            <View style={s.tvRing}>
              <Text translate={false} style={s.tvToken} numberOfLines={1} adjustsFontSizeToFit>{current ?? '—'}</Text>
            </View>
            <Text style={s.tvProceed} numberOfLines={1}>
              {room ? <>Room <Text translate={false}>{room}</Text></> : 'Room not set'}
            </Text>
          </View>
          <View style={s.tvNext}>
            <Text style={s.tvLabel}>UP NEXT</Text>
            {next.length ? next.map((token, i) => (
              <View key={String(token)} style={[s.tvNextRow, i === 0 && s.tvNextFirst]}>
                <Text style={[s.tvNextPos, i === 0 && s.tvNextPosFirst]}>{i === 0 ? 'NEXT' : String(i + 1)}</Text>
                <Text translate={false} style={s.tvNextToken}>{token}</Text>
              </View>
            )) : <Text style={s.tvEmpty}>No one waiting</Text>}
            <View style={s.tvCounts}>
              <TvCount value={queue?.waitingCount} label="Waiting" tone="#FBBF24" />
              <TvCount value={queue?.completedCount} label="Done" tone="#34D399" />
              <TvCount value={queue?.totalPatients} label="Total" tone="#EEF8FB" />
            </View>
          </View>
        </View>
      </View>
      <View style={s.tvNeck} />
      <View style={s.tvBase} />
    </View>
  );
}

function TvCount({ value, label, tone }) {
  return (
    <View style={s.tvCount}>
      <Text translate={false} style={[s.tvCountValue, { color: tone }]}>{value ?? 0}</Text>
      <Text style={s.tvCountLabel}>{label}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  flex: { flex: 1 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 16, marginTop: 16, overflow: 'hidden', shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  hero: { paddingHorizontal: 16, paddingVertical: 16, overflow: 'hidden' },
  heroDecoLg: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -50, top: -70, backgroundColor: 'rgba(255,255,255,0.10)' },
  heroDecoSm: { position: 'absolute', width: 80, height: 80, borderRadius: 40, left: -30, bottom: -40, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#15803D', letterSpacing: 0.6 },
  body: { padding: 15 },
  state: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  stateText: { fontSize: 13, color: '#667085', textAlign: 'center' },
  overline: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: '#98A2B3', marginBottom: 8, marginTop: 4 },

  tvWrap: { alignItems: 'center', marginBottom: 16 },
  tv: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, padding: 10, backgroundColor: '#04131C', borderWidth: 4, borderColor: '#1F2937' },
  tvTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tvClinic: { flex: 1, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: '#2DD4BF' },
  tvLive: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: 'rgba(52,211,153,0.15)' },
  tvLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34D399' },
  tvLiveText: { fontSize: 8.5, fontWeight: '700', color: '#A7F3D0' },
  tvMain: { flex: 1, flexDirection: 'row', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(124,224,210,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 8 },
  tvServing: { flex: 1.4, alignItems: 'center', justifyContent: 'space-between' },
  tvLabel: { fontSize: 7.5, fontWeight: '800', letterSpacing: 1.4, color: '#8FB0BD' },
  tvRing: { width: '62%', aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(45,212,191,0.55)', backgroundColor: 'rgba(45,212,191,0.10)', alignItems: 'center', justifyContent: 'center' },
  tvToken: { fontSize: 34, fontWeight: '900', color: '#FCD34D', paddingHorizontal: 6 },
  tvProceed: { fontSize: 9.5, fontWeight: '700', color: '#A7F3D0' },
  tvNext: { flex: 1, gap: 4, borderLeftWidth: 1, borderLeftColor: 'rgba(124,224,210,0.18)', paddingLeft: 8 },
  tvNextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)' },
  tvNextFirst: { backgroundColor: 'rgba(45,212,191,0.25)' },
  tvNextPos: { fontSize: 7.5, fontWeight: '700', color: '#8FB0BD' },
  tvNextPosFirst: { color: '#A7F3D0' },
  tvNextToken: { fontSize: 12, fontWeight: '900', color: '#EEF8FB' },
  tvEmpty: { flex: 1, fontSize: 9, color: '#8FB0BD', textAlign: 'center', textAlignVertical: 'center', paddingTop: 10 },
  tvCounts: { flexDirection: 'row', marginTop: 'auto', gap: 3 },
  tvCount: { flex: 1, alignItems: 'center', paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  tvCountValue: { fontSize: 11, fontWeight: '900' },
  tvCountLabel: { fontSize: 6.5, color: '#8FB0BD' },
  tvNeck: { width: 26, height: 8, backgroundColor: '#1F2937' },
  tvBase: { width: 90, height: 5, borderRadius: 3, backgroundColor: '#1F2937' },

  roomRow: { flexDirection: 'row', gap: 8 },
  roomField: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 11, paddingHorizontal: 12, backgroundColor: '#F8FAFC' },
  roomInput: { flex: 1, fontSize: 15, color: '#17243A', paddingVertical: 0 },
  saveBtn: { width: 84, height: 48, borderRadius: 11, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
  hint: { fontSize: 12.5, color: '#667085', marginTop: 7, marginBottom: 14 },
  noticeOk: { color: '#15803D' },
  noticeError: { color: '#D92D20' },

  primaryWrap: { borderRadius: 11, shadowColor: '#2DD4BF', shadowOpacity: 0.22, shadowRadius: 5, elevation: 2 },
  primary: { height: 50, borderRadius: 11, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  secondary: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B7E4DF' },
  secondaryTitle: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
  secondaryText: { fontSize: 11.5, color: '#667085', marginTop: 1 },
  outline: { marginTop: 10, height: 46, flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#B7E4DF', borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FDFC' },
  pressed: { opacity: 0.75 },
  outlineText: { fontSize: 14, fontWeight: '700', color: '#0F766E' },
  linkBox: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  linkText: { flex: 1, fontSize: 12, color: '#475467' },
  copyChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E6F7F5' },
  copyText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },

  stepsHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  stepsIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  stepsTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#344054' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  step: { flexDirection: 'row', gap: 12, paddingHorizontal: 6, marginTop: 10 },
  stepRail: { alignItems: 'center' },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  stepLine: { flex: 1, width: 2, backgroundColor: '#CCFBF1', marginTop: 4 },
  stepBody: { flex: 1, paddingBottom: 4 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontSize: 13.5, fontWeight: '700', color: '#17243A' },
  stepText: { fontSize: 12.5, lineHeight: 17, color: '#667085', marginTop: 2 },
});
