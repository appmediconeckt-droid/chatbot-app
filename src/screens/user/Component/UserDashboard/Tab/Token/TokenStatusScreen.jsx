// "My Token" - live queue status for the patient's appointments.
// Same data source and behaviour as the web TokenStatusPage:
//   GET /api/appointments/my-token-status  ->  { success, appointments: [
//     { appointment, token, current, queue, emergency } ] }
// refreshed on mount, every 10s while the app is foregrounded, and (debounced)
// on the `queueUpdated` socket event.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../../../components/TranslatedText';
import { PATIENT, PATIENT_GRADIENT } from '../../../../../../theme/palette';
import api from '../../../../../../axiosConfig';
import socketService from '../../../../../../services/socketService';

const TOKEN_STATUS_ENDPOINT = '/api/appointments/my-token-status';
const POLL_INTERVAL_MS = 10000;
const SOCKET_DEBOUNCE_MS = 500;

const CARD_SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
};

const formatAppointmentDateTime = (appointment) => {
  if (!appointment) return '';
  const { appointmentDate: date, appointmentTime: time } = appointment;
  if (date && time) {
    const value = new Date(`${date}T${time}`);
    if (!Number.isNaN(value.getTime())) {
      return value.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  if (date) {
    const value = new Date(date);
    if (!Number.isNaN(value.getTime())) {
      return value.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return '';
};

const formatEstimatedTurnTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const getDoctorName = (item) => {
  const doctor = item?.appointment?.doctor;
  return (
    doctor?.fullName ||
    doctor?.name ||
    [doctor?.firstName, doctor?.lastName].filter(Boolean).join(' ') ||
    'Doctor'
  );
};

const getAppointmentId = (item) =>
  item?.appointment?.appointmentId || item?.appointment?._id || item?._id || item?.id;

const show = (value, suffix = '') => (value != null ? `${value}${suffix}` : '--');

// Turns a raw axios error into something a patient can actually act on,
// instead of a flat "Could not load token status." for every failure —
// no internet, a down server, and a real API error message all read very
// differently and call for different next steps.
const getFriendlyError = (err) => {
  if (err?.message === 'Network Error' || !err?.response) {
    return {
      icon: 'cloud-offline-outline',
      title: 'No internet connection',
      message: 'Check your connection and try again.',
    };
  }
  const status = err.response.status;
  if (status >= 500) {
    return {
      icon: 'server-outline',
      title: "Server's having trouble",
      message: err.response?.data?.message || 'Something went wrong on our end. Please try again in a moment.',
    };
  }
  return {
    icon: 'alert-circle-outline',
    title: 'Could not load token status',
    message: err?.response?.data?.message || 'Please try again.',
  };
};

export default function TokenStatusScreen() {
  const [appointments, setAppointments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // A background poll/socket-triggered refresh failing (flaky signal, one
  // dropped request) shouldn't blank out an already-loaded token card with a
  // scary full-screen error — this just flags the shown data as possibly
  // stale without hiding it.
  const [staleNotice, setStaleNotice] = useState(false);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchTokenStatus = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (!silent) setIsLoading(true);
      const response = await api.get(TOKEN_STATUS_ENDPOINT, { headers: { 'Cache-Control': 'no-cache' } });
      if (!mountedRef.current) return;
      const list = Array.isArray(response.data?.appointments) ? response.data.appointments : [];
      setAppointments(list);
      setError(null);
      setStaleNotice(false);
      setSelectedId((previousId) => {
        if (!list.length) return null;
        const stillExists = list.some((item) => String(getAppointmentId(item)) === String(previousId));
        return previousId && stillExists ? previousId : getAppointmentId(list[0]);
      });
    } catch (err) {
      if (!mountedRef.current) return;
      console.warn('Failed to fetch token status:', err?.response?.data || err?.message);
      if (silent) {
        // Keep showing the last known-good status; just flag it as unrefreshed.
        setStaleNotice(true);
      } else {
        setError(getFriendlyError(err));
        setAppointments([]);
      }
    } finally {
      inFlightRef.current = false;
      if (!silent && mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    let debounceId = null;
    let unsubscribe = null;

    fetchTokenStatus();

    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') fetchTokenStatus({ silent: true });
    }, POLL_INTERVAL_MS);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchTokenStatus({ silent: true });
    });

    const onQueueUpdated = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => fetchTokenStatus({ silent: true }), SOCKET_DEBOUNCE_MS);
    };

    (async () => {
      try {
        await socketService.connect();
        const off = await socketService.on('queueUpdated', onQueueUpdated);
        if (cancelled) off?.(); else unsubscribe = off;
      } catch (err) {
        console.warn('[TokenStatus] Socket unavailable:', err?.message || err);
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(intervalId);
      clearTimeout(debounceId);
      appStateSub?.remove?.();
      try { unsubscribe?.(); } catch (e) { /* ignore */ }
    };
  }, [fetchTokenStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTokenStatus({ silent: true });
    if (mountedRef.current) setRefreshing(false);
  }, [fetchTokenStatus]);

  const selectedItem = useMemo(
    () => appointments.find((item) => String(getAppointmentId(item)) === String(selectedId)) || null,
    [appointments, selectedId],
  );

  const appointment = selectedItem?.appointment || {};
  const tokenData = selectedItem?.token || {};
  const currentData = selectedItem?.current || {};
  const queueData = selectedItem?.queue || {};
  const emergencyData = selectedItem?.emergency || {};

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PATIENT.primary} colors={[PATIENT.primary]} />}
    >
      <View style={s.titleRow}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>QUEUE STATUS</Text>
          <Text style={s.title}>Your Token Status</Text>
        </View>
        <Pressable onPress={() => fetchTokenStatus({ silent: true })} style={({ pressed }) => [s.refreshBtn, pressed && s.refreshBtnPressed]}>
          <Ionicons name="refresh" size={19} color={PATIENT.primary} />
        </Pressable>
      </View>

      {isLoading && (
        <View style={s.stateBox}>
          <ActivityIndicator size="small" color={PATIENT.primary} />
          <Text style={s.stateText}>Loading...</Text>
        </View>
      )}

      {!isLoading && !!error && (
        <View style={s.stateBox}>
          <View style={s.errorIconCircle}>
            <Ionicons name={error.icon} size={26} color="#DC2626" />
          </View>
          <Text style={s.errorTitle}>{error.title}</Text>
          <Text style={s.stateText}>{error.message}</Text>
          <Pressable onPress={() => fetchTokenStatus()} style={s.retryBtn}>
            <Ionicons name="refresh" size={15} color="#FFFFFF" />
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Non-blocking: data on screen is still the last good fetch, this just
          says a background refresh didn't go through. */}
      {!isLoading && !error && staleNotice && appointments.length > 0 && (
        <Pressable onPress={() => fetchTokenStatus({ silent: true })} style={s.staleBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color="#92400E" />
          <Text style={s.staleBannerText}>Couldn't refresh just now — showing last known status. Tap to retry.</Text>
        </Pressable>
      )}

      {!isLoading && !error && appointments.length === 0 && (
        <View style={s.stateBox}>
          <Ionicons name="ticket-outline" size={22} color="#64748B" />
          <Text style={s.stateText}>You do not have any active appointments.</Text>
        </View>
      )}

      {!isLoading && !error && appointments.length > 0 && (
        <>
          <Text style={s.sectionLabel}>My Appointments</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pickerRow}>
            {appointments.map((item) => {
              const id = getAppointmentId(item);
              const isSelected = String(id) === String(selectedId);
              const itemAppointment = item?.appointment || {};
              return (
                <Pressable key={String(id)} onPress={() => setSelectedId(id)} style={[s.pickerItem, isSelected && s.pickerItemSelected]}>
                  <Text style={[s.pickerDoctor, isSelected && s.pickerDoctorSelected]} numberOfLines={1}>{getDoctorName(item)}</Text>
                  <Text style={s.pickerMeta} numberOfLines={1}>{formatAppointmentDateTime(itemAppointment)}</Text>
                  <View style={s.pickerFooter}>
                    <View style={s.pickerStatusPill}>
                      <Text style={s.pickerStatusText}>{itemAppointment.status || 'pending'}</Text>
                    </View>
                    {item?.token?.myToken != null && <Text style={s.pickerToken}>Token #{item.token.myToken}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {selectedItem && (
        <>
          {emergencyData.active && (
            <View style={s.emergencyBanner}>
              <MaterialCommunityIcons name="ambulance" size={18} color="#B45309" />
              <Text style={s.emergencyBannerText}>
                {emergencyData.message || 'Emergency patient is present in the queue. Your waiting time may change.'}
              </Text>
            </View>
          )}

          <LinearGradient colors={PATIENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tokenCard}>
            <View style={s.tokenGlowTop} />
            <View style={s.tokenGlowBottom} />
            <View style={s.tokenCardTop}>
              <View style={s.grow}>
                <Text style={s.tokenLabel}>Your Token</Text>
                <Text style={s.tokenDoctor} numberOfLines={1}>{getDoctorName(selectedItem)}</Text>
              </View>
              <View style={s.waitPill}>
                <Text style={s.waitPillLabel}>ESTIMATED WAIT</Text>
                <Text style={s.waitPillValue}>{show(queueData.estimatedWaitMinutes, ' min')}</Text>
              </View>
            </View>
            <Text style={s.tokenNumber}>{tokenData.myToken != null ? `#${tokenData.myToken}` : '--'}</Text>
            <Text style={s.tokenWhen}>{formatAppointmentDateTime(appointment)}</Text>
          </LinearGradient>

          <View style={s.statsGrid}>
            <StatBox icon="megaphone-outline" tint="#DCFCE7" color={PATIENT.primary} value={show(currentData.currentToken)} label="Now serving" />
            <StatBox icon="people-outline" tint="#DCFCE7" color={PATIENT.primary} value={show(queueData.totalWaiting)} label="Waiting" />
            <StatBox icon="walk-outline" tint="#DCFCE7" color={PATIENT.primary} value={show(queueData.patientsAhead)} label="Patients ahead" />
            <StatBox icon="list-outline" tint="#DCFCE7" color={PATIENT.primary} value={show(queueData.queuePosition)} label="Queue position" />
            <StatBox icon="time" tint="#DCFCE7" color={PATIENT.primary} value={formatEstimatedTurnTime(queueData.estimatedTurnTime)} label="Expected turn" />
            <StatBox icon="medkit-outline" tint="#DCFCE7" color={PATIENT.primary} value={currentData.doctorStatus === 'consulting' ? 'Consulting' : 'Waiting'} label="Doctor status" />
          </View>

          <View style={[s.card, CARD_SHADOW]}>
            <InfoRow label="Queue status" value={tokenData.queueStatus || '--'} last={!emergencyData.active} />
            {emergencyData.active && (
              <>
                <InfoRow label="Emergency waiting" value={String(emergencyData.totalEmergencyPatients ?? 0)} danger />
                <InfoRow label="Emergency ahead of you" value={String(emergencyData.emergencyPatientsAhead ?? 0)} danger last />
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function StatBox({ icon, iconSet, tint, color, value, label }) {
  const IconCmp = iconSet === 'mci' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={[s.statBox, CARD_SHADOW]}>
      <View style={[s.statIconCircle, { backgroundColor: tint }]}>
        <IconCmp name={icon} size={18} color={color} />
      </View>
      <Text style={[s.statValue, { color: color === PATIENT.primary ? '#0F172A' : color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, danger, last }) {
  return (
    <View style={[is.row, last && is.rowLast]}>
      <Text style={is.label}>{label}</Text>
      <Text style={[is.value, danger && is.valueDanger]}>{value}</Text>
    </View>
  );
}

const is = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  value: { fontSize: 15, color: '#1E293B', fontWeight: '800' },
  valueDanger: { color: '#DC2626' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F9FB' },
  content: { padding: 14, paddingBottom: 26 },
  grow: { flex: 1 },
  stateBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, marginBottom: 12 },
  stateText: { fontSize: 13.5, color: '#475569', textAlign: 'center', lineHeight: 19 },
  errorIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  errorTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: PATIENT.primary },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  staleBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 11, marginBottom: 12 },
  staleBannerText: { flex: 1, fontSize: 12, lineHeight: 16.5, color: '#92400E', fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  pickerRow: { gap: 9, paddingBottom: 12 },
  pickerItem: { width: 190, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  pickerItemSelected: { borderColor: PATIENT.primary, backgroundColor: '#ECFDF3' },
  pickerDoctor: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  pickerDoctorSelected: { color: PATIENT.primary },
  pickerMeta: { fontSize: 11.5, color: '#64748B', marginTop: 3 },
  pickerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pickerStatusPill: { backgroundColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  pickerStatusText: { fontSize: 10, fontWeight: '800', color: '#475569', textTransform: 'capitalize' },
  pickerToken: { fontSize: 11.5, fontWeight: '800', color: PATIENT.primary },
  emergencyBanner: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 12 },
  emergencyBannerText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#92400E' },
  tokenDoctor: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },
  tokenWhen: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 6 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  eyebrow: { fontSize: 11.5, fontWeight: '800', color: PATIENT.primary, letterSpacing: 0.6 },
  title: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 1 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 },
  refreshBtnPressed: { backgroundColor: '#F0FDF4' },

  tokenCard: { borderRadius: 18, padding: 16, marginBottom: 12, overflow: 'hidden', shadowColor: PATIENT.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  tokenGlowTop: { position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  tokenGlowBottom: { position: 'absolute', bottom: -50, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
  tokenCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tokenLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.92)' },
  waitPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  waitPillLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.4 },
  waitPillValue: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginTop: 1 },
  tokenNumber: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', marginTop: 12, letterSpacing: 0.5 },
  ticketDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginHorizontal: -16 },
  ticketNotchLeft: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F7F9FB', marginLeft: -6 },
  ticketNotchRight: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F7F9FB', marginRight: -6 },
  ticketDashLine: { flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', marginHorizontal: 4 },
  opdTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  opdIcon: { width: 16, height: 16, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  opdText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 12 },
  statBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12 },
  statIconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, marginBottom: 12 },

  nowServingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowServingIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center' },
  nowServingPulseDot: { position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#FFFFFF' },
  nowServingLabel: { fontSize: 12.5, color: '#64748B', fontWeight: '600' },
  nowServingValue: { fontSize: 19, fontWeight: '900', color: '#0F172A', marginTop: 1 },

  queueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  queueHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15.5, fontWeight: '800', color: '#0F172A' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF3', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#16A34A' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#16A34A', letterSpacing: 0.4 },
  queueSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 10 },

  queueMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  statusPillEmergency: { backgroundColor: '#FECACA' },
  statusPillServing: { backgroundColor: '#BBF7D0' },
  statusPillWaiting: { backgroundColor: '#E2E8F0' },
  statusPillTextEmergency: { fontSize: 10, fontWeight: '800', color: '#B91C1C' },
  statusPillTextServing: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  statusPillTextWaiting: { fontSize: 10, fontWeight: '800', color: '#475569' },

  queueRowEmergency: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 11, padding: 10, marginBottom: 7 },
  queueTagEmergency: { backgroundColor: '#FECACA', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  queueTagEmergencyText: { fontSize: 12, fontWeight: '800', color: '#B91C1C' },
  queueRowTitleEmergency: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  queueRowSubtitle: { fontSize: 11.5, color: '#64748B' },
  queueRowTimeEmergency: { fontSize: 12.5, fontWeight: '800', color: '#DC2626' },

  queueRowNormal: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 11, padding: 10, marginBottom: 7 },
  queueRowYours: { backgroundColor: '#ECFDF3', borderWidth: 2, borderColor: PATIENT.primary },
  queueTagNormal: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  queueTagYours: { backgroundColor: PATIENT.primary },
  queueTagNormalText: { fontSize: 12, fontWeight: '800', color: '#15803D' },
  queueTagYoursText: { color: '#FFFFFF' },
  queueRowTitleNormal: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  queueRowTitleYours: { color: PATIENT.primary },
  queueRowTimeNormal: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },

  infoBanner: { flexDirection: 'row', gap: 9, backgroundColor: '#ECFDF3', borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  infoBannerText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#166534' },
});
