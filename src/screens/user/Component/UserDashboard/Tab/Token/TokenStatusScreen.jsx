// "My Token" - live queue status for the patient's appointments.
// Same data source and behaviour as the web TokenStatusPage:
//   GET /api/appointments/my-token-status  ->  { success, appointments: [
//     { appointment, token, current, queue, emergency } ] }
// refreshed on mount, every 10s while the app is foregrounded, and (debounced)
// on the `queueUpdated` socket event.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../../../components/TranslatedText';
import { PATIENT } from '../../../../../../theme/palette';
import api from '../../../../../../axiosConfig';
import socketService from '../../../../../../services/socketService';
import { formatTimer, getLiveTokenTiming } from './tokenTiming';

const TOKEN_STATUS_ENDPOINT = '/api/appointments/my-token-status';
const POLL_INTERVAL_MS = 10000;
const SOCKET_DEBOUNCE_MS = 500;

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

// Order appointments by whose turn comes first: expected turn time, then the
// appointment date/time, then the token number (#2 before #13).
const turnSortKey = (item) => {
  const turn = Date.parse(item?.queue?.estimatedTurnTime);
  if (Number.isFinite(turn)) return turn;
  const a = item?.appointment || {};
  const when = Date.parse(a.appointmentDate && a.appointmentTime ? `${a.appointmentDate}T${a.appointmentTime}` : a.appointmentDate);
  return Number.isFinite(when) ? when : Number.MAX_SAFE_INTEGER;
};
const tokenNumber = (item) => {
  const n = Number(item?.token?.myToken);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};
const sortByTurn = (list) =>
  [...list].sort((x, y) => (turnSortKey(x) - turnSortKey(y)) || (tokenNumber(x) - tokenNumber(y)));

const getAppointmentId = (item) =>
  item?.appointment?.appointmentId || item?.appointment?._id || item?._id || item?.id;

const show = (value, suffix = '') => (value != null ? `${value}${suffix}` : '--');

const TERMINAL_STATUSES = ['completed', 'cancelled', 'canceled', 'rejected', 'reject', 'no-show', 'no_show'];
const DOCTOR_STATUS_LABEL = { consulting: 'Consulting', paused: 'Paused', break: 'On break', waiting: 'Not started' };

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
  // Live timers (web parity): tick every second, synced to the server clock.
  const [now, setNow] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTokenStatus = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (!silent) setIsLoading(true);
      const response = await api.get(TOKEN_STATUS_ENDPOINT, { headers: { 'Cache-Control': 'no-cache' } });
      if (!mountedRef.current) return;
      const list = sortByTurn(Array.isArray(response.data?.appointments) ? response.data.appointments : []);
      setAppointments(list);
      const serverTime = Date.parse(list[0]?.current?.serverTime);
      if (Number.isFinite(serverTime)) setClockOffset(serverTime - Date.now());
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
  const isTerminalAppointment = TERMINAL_STATUSES.includes(appointment.status) || TERMINAL_STATUSES.includes(tokenData.queueStatus);
  const liveTiming = getLiveTokenTiming(currentData, queueData, now + clockOffset);
  const doctorStatusLabel = DOCTOR_STATUS_LABEL[currentData.doctorStatus] || 'Not started';
  const estimatedWait = liveTiming.waiting != null ? formatTimer(liveTiming.waiting) : show(queueData.estimatedWaitMinutes, ' min');

  const statusText = String(appointment.status || tokenData.queueStatus || 'pending');
  const myToken = tokenData.myToken;
  const nowServing = currentData.currentToken;
  const emergencyCount = Number(emergencyData.totalEmergencyPatients || 0);
  const aheadCount = Number(queueData.patientsAhead);
  const totalCount = Number(queueData.totalWaiting);
  const progress = currentData.isYourTurn
    ? 1
    : Number.isFinite(aheadCount) && totalCount > 0
      ? Math.min(0.97, Math.max(0.04, 1 - aheadCount / Math.max(totalCount, aheadCount + 1)))
      : 0.04;
  const liveQueue = buildQueueRows({ selectedItem, queueData, currentData, tokenData, emergencyData, now: now + clockOffset });
  const modeLabel = String(appointment.consultationMode || appointment.consultation_mode || '').toLowerCase().includes('video')
    ? 'Video' : String(appointment.consultationMode || appointment.consultation_mode || '').toLowerCase().includes('voice') ? 'Voice' : 'OPD';

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PATIENT.primary} colors={[PATIENT.primary]} />}
    >
      {/* Title */}
      <View style={s.titleRow}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>QUEUE STATUS</Text>
          <Text style={s.title}>My Token</Text>
        </View>
        <Pressable onPress={() => fetchTokenStatus({ silent: true })} style={({ pressed }) => [s.refreshBtn, pressed && s.pressed]} accessibilityLabel="Refresh token status">
          <Ionicons name="refresh" size={20} color={PATIENT.primary} />
        </Pressable>
      </View>

      {isLoading && (
        <View style={s.stateBox}>
          <ActivityIndicator color={PATIENT.primary} />
          <Text style={s.stateText}>Loading your token…</Text>
        </View>
      )}

      {!isLoading && !!error && (
        <View style={s.stateBox}>
          <Ionicons name={error.icon} size={28} color="#DC2626" />
          <Text style={s.stateTitle}>{error.title}</Text>
          <Text style={s.stateText}>{error.message}</Text>
          <Pressable onPress={() => fetchTokenStatus()} style={s.retryBtn}><Text style={s.retryText}>Try again</Text></Pressable>
        </View>
      )}

      {!isLoading && !error && staleNotice && appointments.length > 0 && (
        <Pressable onPress={() => fetchTokenStatus({ silent: true })} style={s.notice}>
          <Ionicons name="cloud-offline-outline" size={15} color="#92400E" />
          <Text style={s.noticeText}>Couldn't refresh — showing last status. Tap to retry.</Text>
        </Pressable>
      )}

      {!isLoading && !error && appointments.length === 0 && (
        <View style={s.stateBox}>
          <View style={s.emptyIcon}><Ionicons name="ticket-outline" size={24} color={PATIENT.primary} /></View>
          <Text style={s.stateTitle}>No active token</Text>
          <Text style={s.stateText}>Book an appointment with a doctor and your token will show here.</Text>
        </View>
      )}

      {!isLoading && !error && appointments.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {appointments.map((item) => {
            const id = getAppointmentId(item);
            const active = String(id) === String(selectedId);
            return (
              <Pressable key={String(id)} onPress={() => setSelectedId(id)} style={[s.chip, active && s.chipActive]}>
                <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                  {getDoctorName(item)}{item?.token?.myToken != null ? ` · #${item.token.myToken}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selectedItem && (
        <>
          {emergencyData.active && (
            <View style={s.alert}>
              <MaterialCommunityIcons name="ambulance" size={17} color="#C2410C" />
              <Text style={s.alertText}>{emergencyData.message || 'Emergency patient is in the queue. Your waiting time may change.'}</Text>
            </View>
          )}

          {/* Token card */}
          <LinearGradient colors={['#2E7D3A', '#4CAF50', '#7BD37A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tokenCard}>
            <View style={s.decoCircleLg} />
            <View style={s.decoCircleSm} />
            <View style={s.tokenTop}>
              <View style={s.grow}>
                <Text style={s.tokenLabel}>Token Number</Text>
                <Text style={s.tokenDoctor} numberOfLines={1}>{getDoctorName(selectedItem)}</Text>
              </View>
              <View style={s.waitPill}>
                <Text style={s.waitPillLabel}>ESTIMATED WAIT</Text>
                <Text style={s.waitPillValue}>{isTerminalAppointment ? '--' : estimatedWait}</Text>
              </View>
            </View>
            <Text style={s.tokenNumber}>{myToken != null ? `#${myToken}` : '--'}</Text>
            <View style={s.tokenBottom}>
              <View style={s.opdTag}>
                <View style={s.opdIcon}><MaterialCommunityIcons name="plus-thick" size={11} color="#2E7D3A" /></View>
                <Text style={s.opdText}>{modeLabel}</Text>
              </View>
              <Text style={s.tokenWhen} numberOfLines={1}>{formatAppointmentDateTime(appointment)}</Text>
            </View>
            {!isTerminalAppointment && (
              <>
                <View style={s.tear}>
                  <View style={s.tearNotchL} />
                  <View style={s.tearLine} />
                  <View style={s.tearNotchR} />
                </View>
                <View style={s.cardProgressRow}>
                  <Text style={s.cardProgressLabel}>Now #{nowServing ?? '--'}</Text>
                  <Text style={s.cardProgressLabel}>{currentData.isYourTurn ? "It's your turn!" : `${show(queueData.patientsAhead)} ahead`}</Text>
                  <Text style={s.cardProgressLabel}>You #{myToken ?? '--'}</Text>
                </View>
                <View style={s.cardTrack}>
                  <View style={[s.cardTrackFill, { width: `${Math.round(progress * 100)}%` }]} />
                  <View style={[s.cardTrackKnob, { left: `${Math.round(progress * 100)}%` }]} />
                </View>
              </>
            )}
          </LinearGradient>

          {isTerminalAppointment ? (
            <View style={s.stateBox}>
              <Ionicons name={appointment.status === 'completed' ? 'checkmark-circle' : 'close-circle'} size={28} color={appointment.status === 'completed' ? PATIENT.primary : '#DC2626'} />
              <Text style={s.stateTitle}>Appointment {statusText}</Text>
              <Text style={s.stateText}>This token is no longer in the live queue.</Text>
            </View>
          ) : (
            <>
              {/* 2 x 2 tiles */}
              <View style={s.grid}>
                <Tile tone="green" icon={<Ionicons name="hourglass-outline" size={18} color="#15803D" />} value={estimatedWait} label="Estimated wait" />
                <Tile tone="blue" icon={<Ionicons name="time" size={18} color="#1D4ED8" />} value={formatEstimatedTurnTime(queueData.estimatedTurnTime)} label="Expected turn" />
                <Tile tone="violet" icon={<Ionicons name="people" size={18} color="#6D28D9" />} value={show(queueData.patientsAhead)} label="People ahead" />
                <Tile tone="red" icon={<MaterialCommunityIcons name="ambulance" size={19} color="#DC2626" />} value={String(emergencyCount)} label="Emergency queue" danger={emergencyCount > 0} />
              </View>

              {/* Now serving */}
              <View style={s.servingCard}>
                <View style={s.servingIcon}>
                  <MaterialCommunityIcons name="account-voice" size={24} color={PATIENT.primary} />
                  <PulseDot style={s.servingPulse} />
                </View>
                <View style={s.grow}>
                  <Text style={s.servingLabel}>Now serving</Text>
                  <Text style={s.servingValue}>{nowServing != null ? `#${nowServing}` : '--'}</Text>
                </View>
                <View style={s.servingRight}>
                  <Text style={[s.doctorStatus, (currentData.doctorStatus === 'paused' || currentData.doctorStatus === 'break') && s.doctorStatusWarn]}>
                    {doctorStatusLabel}
                  </Text>
                  {!!currentData.consultationStartedAt && <Text style={s.servingTimer}>{formatTimer(liveTiming.elapsed)}</Text>}
                </View>
              </View>

              {/* Live queue */}
              {liveQueue.rows.length > 0 && (
                <View style={s.queueCard}>
                  <View style={s.queueHead}>
                    <Text style={s.queueTitle}>Live Queue</Text>
                    <View style={s.liveBadge}><PulseDot style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View>
                  </View>
                  <Text style={s.queueSub}>{show(queueData.totalWaiting)} waiting · your position {show(queueData.queuePosition)}</Text>
                  {liveQueue.rows.map((row, index) => (
                    <View key={row.key} style={s.qItem}>
                      <View style={s.timeline}>
                        <View style={[s.timelineDot, row.emergency && s.timelineDotEmergency, row.mine && s.timelineDotMine]} />
                        {index < liveQueue.rows.length - 1 && <View style={s.timelineLine} />}
                      </View>
                    <View style={[s.qRow, row.emergency && s.qRowEmergency, row.mine && s.qRowMine]}>
                      <View style={[s.qTag, row.emergency && s.qTagEmergency, row.mine && s.qTagMine]}>
                        <Text style={[s.qTagText, row.emergency && s.qTagTextEmergency, row.mine && s.qTagTextMine]}>{row.label}</Text>
                      </View>
                      <View style={s.grow}>
                        <Text style={[s.qTitle, row.mine && s.qTitleMine]} numberOfLines={2}>
                          {row.emergency ? 'Emergency Token' : 'Normal Token'}{row.mine ? ' • Your token' : ''}
                        </Text>
                        <Text style={s.qMeta}>{row.status}</Text>
                      </View>
                      <Text style={[s.qTime, row.emergency && s.qTimeEmergency]}>{row.time}</Text>
                    </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={s.info}>
                <Ionicons name="information-circle-outline" size={18} color={PATIENT.primary} />
                <Text style={s.infoText}>
                  {liveQueue.estimated
                    ? 'Queue times are estimated from the live queue and update automatically. Please arrive 15 minutes early.'
                    : 'Live queue updates automatically. Please arrive 15 minutes before your expected turn.'}
                </Text>
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const fmtClock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtWait = (mins) => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
};

// Queue rows: the API's own list when it sends one, otherwise estimated from
// the live numbers (now serving → your token → a few after).
function buildQueueRows({ selectedItem, queueData, currentData, tokenData, emergencyData, now }) {
  const apiList = queueData.tokens || queueData.items || queueData.list || selectedItem?.queueList;
  if (Array.isArray(apiList) && apiList.length) {
    const isEmergencyRow = (t) => Boolean(t.emergency || t.isEmergency || String(t.priority || '').toLowerCase() === 'emergency');
    const tokenOf = (t) => {
      const n = Number(t.token ?? t.tokenNumber ?? t.token_number ?? t.myToken);
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    };
    const ordered = [...apiList].sort((x, y) =>
      (Number(isEmergencyRow(y)) - Number(isEmergencyRow(x))) || (tokenOf(x) - tokenOf(y)));
    return {
      estimated: false,
      rows: ordered.slice(0, 20).map((t, i) => {
        const token = t.token ?? t.tokenNumber ?? t.token_number ?? t.myToken;
        const emergency = Boolean(t.emergency || t.isEmergency || String(t.priority || '').toLowerCase() === 'emergency');
        const turn = t.estimatedTurnTime || t.estimated_turn_time;
        const waitMin = t.estimatedWaitMinutes ?? t.waitMinutes;
        return {
          key: `api-${token ?? i}`,
          label: emergency ? `E${token ?? i + 1}` : `#${token ?? '--'}`,
          emergency,
          mine: Boolean(t.isYou || t.isMine || (token != null && String(token) === String(tokenData.myToken))),
          status: `${t.status || (emergency ? 'Priority' : 'Waiting')}${waitMin != null ? ` • ${fmtWait(waitMin)}` : ''}`,
          time: turn ? fmtClock(Date.parse(turn)) : '',
        };
      }),
    };
  }

  const my = Number(tokenData.myToken);
  const serving = Number(currentData.currentToken);
  if (!Number.isFinite(my)) return { estimated: true, rows: [] };
  const ahead = Number(queueData.patientsAhead);
  const myWait = Number(queueData.estimatedWaitMinutes);
  const turnMs = Date.parse(queueData.estimatedTurnTime);
  const perPatient = Number.isFinite(myWait) && Number.isFinite(ahead) && ahead > 0 ? myWait / ahead : 8;
  const myTurnMs = Number.isFinite(turnMs) ? turnMs : now + (Number.isFinite(myWait) ? myWait : 0) * 60000;
  const start = Number.isFinite(serving) ? serving + 1 : Math.max(1, my - (Number.isFinite(ahead) ? ahead : 3));
  const first = Math.max(start, my - 6);
  const last = my + 4;
  const rows = [];
  const emergencies = Number(emergencyData.totalEmergencyPatients || 0);
  for (let e = 1; e <= Math.min(emergencies, 3); e += 1) {
    rows.push({ key: `em-${e}`, label: `E${e}`, emergency: true, mine: false, status: 'Priority • ahead of normal tokens', time: 'Now' });
  }
  for (let t = first; t <= last; t += 1) {
    const offsetMin = (t - my) * perPatient;
    const waitMin = Math.max(0, (myTurnMs + offsetMin * 60000 - now) / 60000);
    rows.push({
      key: `t-${t}`,
      label: `#${t}`,
      emergency: false,
      mine: t === my,
      status: `Waiting • ${fmtWait(waitMin)}`,
      time: fmtClock(myTurnMs + offsetMin * 60000),
    });
  }
  return { estimated: true, rows };
}

// Small green dot that gently pulses to show live data.
function PulseDot({ style }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.6, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]} />;
}

function Tile({ icon, value, label, danger, tone = 'green' }) {
  return (
    <View style={s.tile}>
      <View style={[s.tileBadge, s[`tileBadge_${tone}`]]}>{icon}</View>
      <Text style={[s.tileValue, danger && s.tileValueDanger]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const GREEN_BORDER = '#D6EEDC';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6F7' },
  content: { padding: 16, paddingBottom: 32 },
  grow: { flex: 1 },
  pressed: { opacity: 0.7 },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  eyebrow: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1, color: '#2E7D3A' },
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginTop: 2 },
  refreshBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN_BORDER, alignItems: 'center', justifyContent: 'center' },

  stateBox: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: GREEN_BORDER, paddingVertical: 24, paddingHorizontal: 18, alignItems: 'center', gap: 7, marginBottom: 14 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECF8EF', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textTransform: 'capitalize' },
  stateText: { fontSize: 13, lineHeight: 19, color: '#6B7280', textAlign: 'center' },
  retryBtn: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: '#2E7D3A' },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, marginBottom: 14 },
  noticeText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600' },

  chips: { gap: 8, paddingBottom: 14 },
  chip: { maxWidth: 220, paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: GREEN_BORDER, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2E7D3A', borderColor: '#2E7D3A' },
  chipText: { fontSize: 12.5, fontWeight: '700', color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },

  alert: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFF7ED', borderRadius: 14, borderWidth: 1, borderColor: '#FED7AA', padding: 11, marginBottom: 14 },
  alertText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: '#9A3412', fontWeight: '600' },

  tokenCard: { borderRadius: 24, padding: 20, marginBottom: 16, minHeight: 200, overflow: 'hidden', shadowColor: '#2E7D3A', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  decoCircleLg: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, bottom: -90, backgroundColor: 'rgba(255,255,255,0.10)' },
  decoCircleSm: { position: 'absolute', width: 110, height: 110, borderRadius: 55, left: -40, top: -45, backgroundColor: 'rgba(255,255,255,0.08)' },
  tear: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginHorizontal: -20 },
  tearNotchL: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5F6F7', marginLeft: -9 },
  tearNotchR: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5F6F7', marginRight: -9 },
  tearLine: { flex: 1, height: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderStyle: 'dashed', marginHorizontal: 6 },
  cardProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  cardProgressLabel: { fontSize: 11.5, fontWeight: '800', color: 'rgba(255,255,255,0.92)' },
  cardTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)', marginTop: 8, justifyContent: 'center' },
  cardTrackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: '#FFFFFF' },
  cardTrackKnob: { position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#2E7D3A' },
  tokenTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tokenLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  tokenDoctor: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  waitPill: { backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  waitPillLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.9)' },
  waitPillValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  tokenNumber: { fontSize: 60, lineHeight: 68, fontWeight: '900', color: '#FFFFFF', marginTop: 18, letterSpacing: 0.5 },
  tokenBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  opdTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  opdIcon: { width: 18, height: 18, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  opdText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  tokenWhen: { flexShrink: 1, fontSize: 12, color: 'rgba(255,255,255,0.9)', textAlign: 'right' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 16 },
  tile: { width: '48.3%', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: GREEN_BORDER, paddingHorizontal: 14, paddingVertical: 14, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  tileBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileBadge_green: { backgroundColor: '#DCFCE7' },
  tileBadge_blue: { backgroundColor: '#DBEAFE' },
  tileBadge_violet: { backgroundColor: '#EDE9FE' },
  tileBadge_red: { backgroundColor: '#FEE2E2' },
  tileValue: { fontSize: 21, fontWeight: '900', color: '#111827', marginTop: 12 },
  tileValueDanger: { color: '#DC2626' },
  tileLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginTop: 4 },

  servingCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: GREEN_BORDER, padding: 16, marginBottom: 16 },
  servingIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E6F4EA', alignItems: 'center', justifyContent: 'center' },
  servingPulse: { position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFFFFF' },
  servingLabel: { fontSize: 13.5, fontWeight: '600', color: '#4B5563' },
  servingValue: { fontSize: 26, fontWeight: '900', color: '#111827', marginTop: 1 },
  servingRight: { alignItems: 'flex-end', gap: 4 },
  doctorStatus: { fontSize: 11.5, fontWeight: '800', color: '#2E7D3A', backgroundColor: '#E6F4EA', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  doctorStatusWarn: { color: '#B45309', backgroundColor: '#FEF3C7' },
  servingTimer: { fontSize: 13, fontWeight: '800', color: '#111827' },

  queueCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: GREEN_BORDER, padding: 14, marginBottom: 16 },
  queueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queueTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ECF8EF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  liveText: { fontSize: 10.5, fontWeight: '900', color: '#16A34A', letterSpacing: 0.5 },
  queueSub: { fontSize: 12.5, color: '#6B7280', marginTop: 3, marginBottom: 12 },
  qItem: { flexDirection: 'row', alignItems: 'stretch' },
  timeline: { width: 18, alignItems: 'center', paddingTop: 20 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#86C99A' },
  timelineDotEmergency: { backgroundColor: '#EF4444' },
  timelineDotMine: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#2E7D3A', borderWidth: 3, borderColor: '#BBF7D0' },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#E3EFE6', marginTop: 2 },
  qRow: { flex: 1, marginLeft: 6, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F8F9', borderRadius: 14, borderWidth: 1, borderColor: '#E3EFE6', paddingHorizontal: 12, paddingVertical: 12, marginBottom: 9 },
  qRowEmergency: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  qRowMine: { backgroundColor: '#E9F9EE', borderColor: '#2E7D3A', borderWidth: 2 },
  qTag: { minWidth: 58, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E6F4EA', alignItems: 'center' },
  qTagEmergency: { backgroundColor: '#FECACA' },
  qTagMine: { backgroundColor: '#2E7D3A' },
  qTagText: { fontSize: 13.5, fontWeight: '900', color: '#2E7D3A' },
  qTagTextEmergency: { color: '#B91C1C' },
  qTagTextMine: { color: '#FFFFFF' },
  qTitle: { fontSize: 14.5, fontWeight: '800', color: '#111827' },
  qTitleMine: { color: '#2E7D3A' },
  qMeta: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  qTime: { fontSize: 13.5, fontWeight: '800', color: '#111827', alignSelf: 'flex-start' },
  qTimeEmergency: { color: '#DC2626' },

  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#ECF8EF', borderRadius: 16, borderWidth: 1, borderColor: GREEN_BORDER, padding: 14 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#1F2937' },
});
