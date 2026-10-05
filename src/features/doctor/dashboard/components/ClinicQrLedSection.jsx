// Clinic-wise walk-in QR + LED display ("screen connect"), same API and flow as
// the web doctor dashboard's AppointmentQR/AllQRcode.jsx:
//   GET   /api/qr/doctors/:doctorId/clinics       clinics with walkinQrCode + ledPath
//   PATCH /api/qr/walkin/:doctorClinicId/room     doctor's room number at a clinic
//   GET   /api/qr/walkin/:doctorClinicId/queue    the feed the LED page itself polls
// The LED page lives on the backend root at `ledPath` (/display/clinic/:id).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Image, Linking, Platform, Pressable, ScrollView, Share, TextInput, View,
} from 'react-native';
import Text from '../../../../components/TranslatedText';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance, { API_BASE_URL } from '../../../../axiosConfig';
import { getStoredDoctorUser } from '../api/doctorAppointments';

const SERVER_ROOT = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '');
// The LED page refreshes every 3s; the in-app preview only needs to look live.
const PREVIEW_POLL_MS = 5000;

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

// The backend only serves the signed-in doctor's own clinics, keyed by their
// Mongo _id (anything else is a 403 that hid this whole section). Stored user
// data can also carry a different `doctor_id`, so prefer an ObjectId.
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const resolveDoctorId = (user, fallback) => {
  const candidates = [
    user?.id, user?._id, user?.user?._id, user?.user?.id, user?.data?.user?._id, user?.data?._id,
    user?.doctor_id, user?.doctorId, user?.user_id, user?.userId, fallback,
  ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '').map(String);
  return candidates.find((v) => OBJECT_ID.test(v)) || candidates[0] || '';
};

export default function ClinicQrLedSection({ doctorId: doctorIdProp }) {
  const { showToast } = useToast();
  const [doctorId, setDoctorId] = useState('');
  const [idChecked, setIdChecked] = useState(false);
  useEffect(() => {
    let active = true;
    getStoredDoctorUser().then((user) => {
      if (!active) return;
      setDoctorId(resolveDoctorId(user, doctorIdProp));
      setIdChecked(true);
    });
    return () => { active = false; };
  }, [doctorIdProp]);
  const [clinics, setClinics] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomNotice, setRoomNotice] = useState(null);
  const [queue, setQueue] = useState(null);

  const loadClinics = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/api/qr/doctors/${encodeURIComponent(doctorId)}/clinics`);
      const items = response.data?.data?.clinics || [];
      setClinics(items);
      setSelectedId((current) =>
        items.some((c) => c.doctorClinicId === current) ? current : items[0]?.doctorClinicId || '');
    } catch (err) {
      setClinics([]);
      setError(errorMessage(err, 'Unable to load clinics. Please retry.'));
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { loadClinics(); }, [loadClinics]);
  useEffect(() => {
    if (idChecked && !doctorId) {
      setLoading(false);
      setError('Doctor ID not found. Please sign in again.');
    }
  }, [idChecked, doctorId]);

  const selected = clinics.find((c) => c.doctorClinicId === selectedId);
  const ledUrl = selected?.ledPath ? `${SERVER_ROOT}${selected.ledPath}` : '';

  useEffect(() => {
    setRoom(selected?.clinic?.room || '');
    setRoomNotice(null);
  }, [selectedId, selected?.clinic?.room]);

  // Live mini LED preview — polls the same queue feed as the LED page, only
  // while the app is in the foreground.
  const queueRequest = useRef(0);
  useEffect(() => {
    setQueue(null);
    if (!selectedId) return undefined;
    let cancelled = false;
    const poll = async () => {
      if (AppState.currentState !== 'active') return;
      const requestNo = ++queueRequest.current;
      try {
        const response = await axiosInstance.get(`/api/qr/walkin/${encodeURIComponent(selectedId)}/queue`);
        if (!cancelled && requestNo === queueRequest.current) setQueue(response.data || null);
      } catch {
        // The preview is decorative; the LED page keeps working regardless.
      }
    };
    poll();
    const timer = setInterval(poll, PREVIEW_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedId]);

  const saveRoom = async () => {
    if (!selected || savingRoom) return;
    const value = room.trim();
    if (!value || value.length > 100) {
      setRoomNotice({ error: true, text: 'Enter a room number between 1 and 100 characters' });
      return;
    }
    const targetId = selected.doctorClinicId;
    setSavingRoom(true);
    setRoomNotice(null);
    try {
      const response = await axiosInstance.patch(
        `/api/qr/walkin/${encodeURIComponent(targetId)}/room`, { roomNumber: value });
      const saved = response.data?.data?.roomNumber ?? value;
      setClinics((items) => items.map((c) =>
        c.doctorClinicId === targetId ? { ...c, clinic: { ...c.clinic, room: saved } } : c));
      setRoomNotice({ error: false, text: 'Room saved. The connected LED will update automatically.' });
    } catch (err) {
      setRoomNotice({ error: true, text: errorMessage(err, 'Unable to save room. Please retry.') });
    } finally {
      setSavingRoom(false);
    }
  };

  // walkinQrCode is a PNG data URL generated by the backend.
  const downloadQr = async () => {
    const base64 = String(selected?.walkinQrCode || '').split(',')[1];
    if (!base64) return;
    const safeName = String(selected.clinic?.name || 'clinic').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    try {
      await RNFS.writeFile(`${dir}/${safeName}-walkin-qr.png`, base64, 'base64');
      showToast(Platform.OS === 'android' ? 'QR saved to Downloads' : 'QR saved');
    } catch (err) {
      console.warn('Clinic QR download error:', err?.message);
      showToast('Could not save QR. Please share the link instead.');
    }
  };

  const shareQr = () => {
    if (!selected?.walkinQrUrl) return;
    Share.share({
      title: selected.clinic?.name,
      message: `Scan or open this link to join today's queue at ${selected.clinic?.name}.\n${selected.walkinQrUrl}`,
    }).catch(() => {});
  };

  const openUrl = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => showToast('Could not open link'));
  };

  // No clipboard module in this app — the share sheet offers "Copy".
  const shareLedLink = () => {
    if (!ledUrl) return;
    Share.share({
      title: 'Clinic LED display',
      message: `Open this on the computer or smart TV connected to the clinic LED:\n${ledUrl}`,
    }).catch(() => {});
  };

  return (
    <View style={s.wrap}>
      <View style={s.sectionHead}>
        <View style={s.sectionIcon}><AppIcon name="qr" size={17} color="#0D9488" /></View>
        <View style={s.flex}>
          <Text style={s.sectionTitle}>Clinic QR Code</Text>
          <Text style={s.sectionSub}>Select a clinic to view its appointment QR and live LED display.</Text>
        </View>
        <Pressable
          onPress={loadClinics}
          disabled={loading || savingRoom}
          hitSlop={8}
          style={({ pressed }) => [s.refresh, pressed && s.pressed]}
          accessibilityLabel="Refresh clinics"
        >
          <AppIcon name="refresh" size={17} color="#0D9488" />
        </Pressable>
      </View>

      {loading && (
        <View style={s.stateBox}><ActivityIndicator color="#0D9488" /><Text style={s.stateText}>Fetching clinics...</Text></View>
      )}
      {!loading && !!error && (
        <View style={s.stateBox}>
          <Text style={s.errorText}>{error}</Text>
          <Outline icon="refresh" text="Retry" onPress={loadClinics} />
        </View>
      )}
      {!loading && !error && !clinics.length && (
        <View style={s.stateBox}>
          <AppIcon name="pin" size={22} color="#98A2B3" />
          <Text style={s.stateText}>Add a clinic in Clinic Settings to view its QR.</Text>
        </View>
      )}

      {!loading && !error && clinics.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {clinics.map((c) => {
            const active = c.doctorClinicId === selectedId;
            return (
              <Pressable
                key={c.doctorClinicId}
                disabled={savingRoom}
                onPress={() => setSelectedId(c.doctorClinicId)}
                style={[s.chip, active && s.chipActive]}
              >
                <AppIcon name="pin" size={13} color={active ? '#FFF' : '#0D9488'} />
                <Text translate={false} numberOfLines={1} style={[s.chipText, active && s.chipTextActive]}>
                  {c.clinic?.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!loading && !error && !!selected && (
        <>
          <View style={s.qrCard}>
            <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.qrHeader}>
              <Text translate={false} style={s.clinicName} numberOfLines={2}>{selected.clinic?.name}</Text>
              <Text translate={false} style={s.doctorName}>{selected.doctor?.name}</Text>
              {!!selected.clinic?.room && (
                <View style={s.roomBadge}><Text style={s.roomBadgeText}>Room <Text translate={false}>{selected.clinic.room}</Text></Text></View>
              )}
            </LinearGradient>
            <View style={s.qrBody}>
              <View style={s.qrFrame}>
                {selected.walkinQrCode ? (
                  <Image source={{ uri: selected.walkinQrCode }} style={s.qrImage} resizeMode="contain" />
                ) : (
                  <ActivityIndicator color="#0D9488" />
                )}
              </View>
              <Text style={s.scanText}>Scan to join today's queue at <Text translate={false}>{selected.clinic?.name}</Text>.</Text>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>QR MANAGEMENT</Text>
            <Pressable style={s.primaryWrap} onPress={downloadQr}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
                <AppIcon name="download" size={17} color="#FFF" />
                <Text style={s.primaryText}>Download QR</Text>
              </LinearGradient>
            </Pressable>
            <View style={s.two}>
              <Outline icon="send" text="Share QR" onPress={shareQr} />
              <Outline icon="globe" text="Open Page" onPress={() => openUrl(selected.walkinQrUrl)} />
            </View>
          </View>

          <View style={s.card}>
            <View style={s.ledHead}>
              <AppIcon name="laptop" size={18} color="#0D9488" />
              <Text style={[s.cardLabel, s.ledTitle]}>CLINIC LED DISPLAY</Text>
              <View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View>
            </View>
            <Text style={s.helper}>Shows this doctor's current and waiting tokens at <Text translate={false}>{selected.clinic?.name}</Text>.</Text>

            <LedPreview queue={queue} room={selected.clinic?.room} />

            <Text style={s.inputLabel}>Doctor room number at this clinic</Text>
            <View style={s.roomRow}>
              <TextInput
                value={room}
                onChangeText={setRoom}
                maxLength={100}
                editable={!savingRoom}
                placeholder="e.g. 101 or OPD-2"
                placeholderTextColor="#98A2B3"
                returnKeyType="done"
                onSubmitEditing={saveRoom}
                style={s.roomInput}
              />
              <Pressable onPress={saveRoom} disabled={savingRoom} style={[s.saveBtn, savingRoom && s.disabled]}>
                {savingRoom ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.saveText}>Save</Text>}
              </Pressable>
            </View>
            {!!roomNotice && (
              <Text style={[s.notice, roomNotice.error && s.noticeError]}>{roomNotice.text}</Text>
            )}

            <Pressable style={[s.primaryWrap, s.ledOpen]} onPress={() => openUrl(ledUrl)}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
                <AppIcon name="laptop" size={17} color="#FFF" />
                <Text style={s.primaryText}>Open LED Screen</Text>
              </LinearGradient>
            </Pressable>
            <View style={s.two}>
              <Outline icon="send" text="Share LED Link" onPress={shareLedLink} />
            </View>
            <View style={s.linkBox}>
              <Text translate={false} selectable numberOfLines={2} style={s.linkText}>{ledUrl}</Text>
            </View>

            <Text style={s.stepsTitle}>How to connect the LED screen</Text>
            <Step n="1" text="Share the LED link to the laptop or smart TV connected to the outside LED (WhatsApp, email)." />
            <Step n="2" text="Open the link there and press F11 for full screen." />
            <Step n="3" text="Keep that device awake and connected to the internet." />
            <Step n="4" text="The LED refreshes every 3 seconds. Room changes saved here show up automatically." last />
          </View>
        </>
      )}

      {!selected && (
        <View style={s.card}>
          <View style={s.ledHead}>
            <AppIcon name="laptop" size={18} color="#0D9488" />
            <Text style={[s.cardLabel, s.ledTitle]}>CLINIC LED DISPLAY</Text>
          </View>
          <Text style={s.helper}>
            {loading
              ? 'Loading your clinics...'
              : error
                ? 'The LED display is set up per clinic. Load your clinics to connect it.'
                : 'Add a clinic in Clinic Settings, then connect its LED display here.'}
          </Text>
          <LedPreview queue={null} room="" />
          {!loading && !!error && (
            <View style={s.two}><Outline icon="refresh" text="Retry" onPress={loadClinics} /></View>
          )}
        </View>
      )}
    </View>
  );
}

function LedPreview({ queue, room }) {
  const current = queue?.current?.token;
  const next = queue?.nextTokens || [];
  return (
    <View style={s.led}>
      <View style={s.ledTop}>
        <Text style={s.ledCaption}>NOW SERVING</Text>
        {!!room && <Text translate={false} style={s.ledRoom}>ROOM {room}</Text>}
      </View>
      <Text translate={false} style={s.ledToken}>{current ?? '--'}</Text>
      <View style={s.ledNextRow}>
        <Text style={s.ledCaption}>NEXT</Text>
        {next.length ? next.map((token) => (
          <View key={String(token)} style={s.ledNextChip}>
            <Text translate={false} style={s.ledNextText}>{token}</Text>
          </View>
        )) : <Text style={s.ledMuted}>No one waiting</Text>}
      </View>
      <View style={s.ledStats}>
        <LedStat label="Waiting" value={queue?.waitingCount} />
        <LedStat label="Done" value={queue?.completedCount} />
        <LedStat label="Total" value={queue?.totalPatients} />
      </View>
    </View>
  );
}

function LedStat({ label, value }) {
  return (
    <View style={s.ledStat}>
      <Text translate={false} style={s.ledStatValue}>{value ?? 0}</Text>
      <Text style={s.ledStatLabel}>{label}</Text>
    </View>
  );
}

function Step({ n, text, last }) {
  return (
    <View style={[s.step, last && s.stepLast]}>
      <View style={s.stepNo}><Text translate={false} style={s.stepNoText}>{n}</Text></View>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

function Outline({ icon, text, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.outline, pressed && s.pressed]}>
      {!!icon && <AppIcon name={icon} size={15} color="#0D9488" />}
      <Text style={s.outlineText}>{text}</Text>
    </Pressable>
  );
}

const s = createDoctorStyles({
  wrap: { marginBottom: 22 },
  flex: { flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  sectionSub: { fontSize: 12.5, lineHeight: 17, color: '#667085', marginTop: 2 },
  refresh: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#B7E4DF', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 26, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#D8E3EA' },
  stateText: { fontSize: 14, color: '#526078', textAlign: 'center', paddingHorizontal: 16 },
  errorText: { fontSize: 14, color: '#D92D20', textAlign: 'center', paddingHorizontal: 16 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 220, height: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: '#B7E4DF', backgroundColor: '#FFF' },
  chipActive: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  chipText: { fontSize: 13.5, fontWeight: '600', color: '#0F766E' },
  chipTextActive: { color: '#FFF' },
  qrCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#C8D1DF', shadowColor: '#17243A', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  qrHeader: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, alignItems: 'center' },
  clinicName: { fontSize: 19, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  doctorName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
  roomBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)' },
  roomBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  qrBody: { alignItems: 'center', padding: 18 },
  qrFrame: { width: 214, height: 214, padding: 8, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#99F6E4', alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  qrImage: { width: 194, height: 194 },
  scanText: { fontSize: 13.5, color: '#526078', marginTop: 14, textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 12, padding: 15, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardLabel: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.7, color: '#344054', marginBottom: 12 },
  primaryWrap: { borderRadius: 9, shadowColor: '#2DD4BF', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  primary: { height: 48, borderRadius: 9, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  two: { flexDirection: 'row', gap: 10, marginTop: 10 },
  outline: { flex: 1, height: 44, flexDirection: 'row', gap: 7, borderWidth: 1, borderColor: '#B7E4DF', borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FDFC' },
  outlineText: { fontSize: 14, fontWeight: '600', color: '#0F766E' },
  ledHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ledTitle: { marginBottom: 0, flex: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#DCFCE7' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#15803D', letterSpacing: 0.6 },
  helper: { fontSize: 13, lineHeight: 18, color: '#667085', marginBottom: 12 },
  led: { backgroundColor: '#04181B', borderRadius: 12, padding: 14, borderWidth: 2, borderColor: '#0F3B3F' },
  ledTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ledCaption: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#5EEAD4' },
  ledRoom: { fontSize: 12, fontWeight: '800', color: '#FDE68A', letterSpacing: 0.8 },
  ledToken: { fontSize: 46, fontWeight: '900', color: '#FDE047', textAlign: 'center', marginVertical: 6, letterSpacing: 2 },
  ledNextRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  ledNextChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: '#0F3B3F' },
  ledNextText: { fontSize: 14, fontWeight: '800', color: '#E6FFFA' },
  ledMuted: { fontSize: 12.5, color: '#7FA8A4' },
  ledStats: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: '#0F3B3F', paddingTop: 10 },
  ledStat: { flex: 1, alignItems: 'center' },
  ledStatValue: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  ledStatLabel: { fontSize: 11, color: '#7FA8A4', marginTop: 1 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#344054', marginTop: 16, marginBottom: 7 },
  roomRow: { flexDirection: 'row', gap: 8 },
  roomInput: { flex: 1, height: 46, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 9, paddingHorizontal: 12, fontSize: 15, color: '#17243A', backgroundColor: '#FFF' },
  saveBtn: { width: 82, height: 46, borderRadius: 9, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
  notice: { fontSize: 12.5, color: '#15803D', marginTop: 7 },
  noticeError: { color: '#D92D20' },
  ledOpen: { marginTop: 16 },
  linkBox: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  linkText: { fontSize: 12, color: '#475467' },
  stepsTitle: { fontSize: 13.5, fontWeight: '700', color: '#344054', marginTop: 16, marginBottom: 6 },
  step: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  stepLast: { borderBottomWidth: 0 },
  stepNo: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#475467' },
});
