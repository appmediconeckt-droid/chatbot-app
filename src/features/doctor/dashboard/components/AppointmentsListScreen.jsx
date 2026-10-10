// Doctor's appointment list (web AppointmentList layout): All / Online /
// Walk-in tabs with counts, date filter, summary cards (total, online, walk-in,
// average consultation time) and one card per appointment with a clear
// Online / Walk-in type badge and the patient's photo + basic info.
//
// Data: loadDoctorAppointmentFeed — GET /api/appointments (+ completed) and
// GET /api/walkin-appointments for this doctor, merged. Delete goes to the
// matching table (getAppointmentApiPath).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles, doctorGradient, gradientDirection, shadow } from '../theme';
import axiosInstance from '../../../../axiosConfig';
import {
  formatAppointment,
  formatLocalDateKey,
  getAppointmentApiPath,
  getDoctorIdFromUser,
  getStoredDoctorUser,
  loadDoctorAppointmentFeed,
  pickFirst,
} from '../api/doctorAppointments';

const STATUS_META = {
  Pending: { color: '#64748B', bg: '#F1F5F9' },
  'In Consultation': { color: '#15803D', bg: '#DCFCE7' },
  Completed: { color: '#0F766E', bg: '#CCFBF1' },
  Cancelled: { color: '#DC2626', bg: '#FEF2F2' },
};

// normalizeAppointmentStatus values → labels shown here.
const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Pending',
  'in-progress': 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TYPE_META = {
  online: { label: 'Online', icon: 'globe', color: '#0F766E', bg: '#CCFBF1' },
  walkin: { label: 'Walk-in', icon: 'walk', color: '#EA580C', bg: '#FFEDD5' },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'walkin', label: 'Walk-in' },
];

// In visit order: not seen yet → being seen → done (or cancelled).
const STATUS_FILTERS = ['All', 'Pending', 'In Consultation', 'Completed', 'Cancelled'];

// Patient-booked QR walk-ins are stored as appointments (booking_source 'qr'),
// so they count as walk-ins too.
const getVisitType = (appt, raw) => {
  const bookingSource = String(pickFirst(raw?.booking_source, raw?.bookingSource, '')).toLowerCase();
  return appt.appointmentSource === 'walkin' || ['qr', 'walkin', 'walk-in'].includes(bookingSource)
    ? 'walkin'
    : 'online';
};

// Consultation length: the duration field, else consultation_started_at →
// consultation_ended_at (what the doctor's Start / Complete buttons record).
const getConsultMinutes = (appt, raw) => {
  const start = pickFirst(raw?.consultation_started_at, raw?.consultationStartedAt, appt.startTime);
  const end = pickFirst(raw?.consultation_ended_at, raw?.consultationEndedAt, appt.endTime);
  const ms = appt.durationMs || (Date.parse(end) - Date.parse(start));
  // Ignore missing/implausible values (no Start pressed, > 4 h left open).
  return Number.isFinite(ms) && ms > 0 && ms < 4 * 3600000 ? ms / 60000 : 0;
};

const mapAppointment = (raw) => {
  const appt = formatAppointment(raw);
  const patient = raw?.patient && typeof raw.patient === 'object' ? raw.patient : {};
  const mode = appt.consultationMode;
  // QR / walk-in bookings put the real patient in the notes
  // ("Patient: Name | Phone: … | Gender: male") — the account that booked can
  // be someone else's, so prefer those details.
  const notes = String(raw?.notes || '');
  const notesName = (/Patient:\s*([^|.\r\n]+)/i.exec(notes)?.[1] || '').trim();
  const notesGender = (/Gender:\s*([A-Za-z]+)/i.exec(notes)?.[1] || '').trim();
  const gender = String(notesGender || appt.gender || '');
  const name = notesName || appt.name;
  return {
    key: appt.id,
    id: appt.apiId,
    rawId: String(pickFirst(raw?._id, raw?.id, '') || ''),
    apiPath: getAppointmentApiPath(appt),
    doctorId: pickFirst(raw?.doctor_id, raw?.doctorId, raw?.doctor?.id, raw?.doctor?._id),
    name,
    age: pickFirst(raw?.age, raw?.patient_age, raw?.patientAge, patient?.age),
    gender: /not specified/i.test(gender) ? '' : gender,
    token: appt.tokenNumber != null ? String(appt.tokenNumber) : '',
    time: appt.scheduledTime,
    isEmergency: appt.isEmergency,
    createdMs: Date.parse(pickFirst(raw?.created_at, raw?.createdAt)) || 0,
    rawDate: formatLocalDateKey(appt.appointmentDate),
    status: STATUS_LABEL[appt.status] || 'Pending',
    reason: appt.issue,
    type: getVisitType(appt, raw),
    mode: mode.includes('video') ? 'Video' : mode.includes('voice') || mode.includes('phone') ? 'Voice' : 'In-clinic',
    consultMinutes: getConsultMinutes(appt, raw),
  };
};

const shiftDateKey = (key, days) => {
  const d = key ? new Date(`${key}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDateKey(d);
};

const formatDateLabel = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const percent = (part, total) => `${total ? Math.round((part / total) * 100) : 0}% of total`;

// Same day: by token; otherwise keep the API order.
const byToken = (x, y) => {
  const tx = Number(x.apt.token);
  const ty = Number(y.apt.token);
  if (x.apt.rawDate === y.apt.rawDate && x.apt.token && y.apt.token && Number.isFinite(tx) && Number.isFinite(ty)) {
    return tx - ty;
  }
  return x.index - y.index;
};

// focusAppointmentId: opened from a notification — scroll to that appointment
// and highlight it (filters start cleared, so it is always in the list).
export default function AppointmentsListScreen({ onBack, focusAppointmentId = null }) {
  const { showToast } = useToast();
  const scrollRef = useRef(null);
  const focusScrolledRef = useRef(false);
  const focusId = focusAppointmentId ? String(focusAppointmentId) : '';
  const isFocused = (item) => !!focusId && (String(item.id) === focusId || item.rawId === focusId);
  const today = formatLocalDateKey();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('All');
  // Today by default (like the web list); all dates when opened from a notification.
  const [selectedDate, setSelectedDate] = useState(focusId ? '' : today);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchAppointments = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError('');
      const doctorId = getDoctorIdFromUser(await getStoredDoctorUser());
      if (!doctorId) {
        setLoadError('Doctor id not found. Please login again.');
        return;
      }
      const rows = await loadDoctorAppointmentFeed(doctorId);
      setAppointments(
        rows
          .map(mapAppointment)
          .filter((apt) => !apt.doctorId || String(apt.doctorId) === String(doctorId))
          // Open emergencies on top (oldest request first), then by token.
          .map((apt, index) => ({ apt, index }))
          .sort((x, y) => {
            const ex = x.apt.isEmergency && x.apt.status === 'Pending';
            const ey = y.apt.isEmergency && y.apt.status === 'Pending';
            if (ex !== ey) return ex ? -1 : 1;
            if (ex && ey) return x.apt.createdMs - y.apt.createdMs;
            return byToken(x, y);
          })
          .map(({ apt }) => apt),
      );
    } catch (err) {
      console.error('Error fetching doctor appointments:', err?.message);
      setLoadError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to load appointments');
      if (!silent) setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Opened from a notification whose appointment is gone (deleted/cancelled
  // and removed): say so once instead of silently showing the full list.
  const focusCheckedRef = useRef(false);
  useEffect(() => {
    if (!focusId || loading || focusCheckedRef.current) return;
    focusCheckedRef.current = true;
    if (!appointments.some(isFocused)) showToast('This appointment is no longer available');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, loading, appointments]);

  // Scroll the focused card into view once it has been laid out.
  const onCardLayout = (item, y) => {
    if (!isFocused(item) || focusScrolledRef.current) return;
    focusScrolledRef.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments(true);
  };

  const deleteAppointment = useCallback((item) => {
    Alert.alert('Delete Appointment', `Delete appointment for ${item.name}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setAppointments((prev) => prev.filter((a) => a.key !== item.key));
          try {
            await axiosInstance.delete(item.apiPath);
            showToast('Appointment deleted');
          } catch (err) {
            console.error('Error deleting appointment:', err?.message);
            showToast('Delete failed');
            fetchAppointments(true);
          }
        },
      },
    ]);
  }, [fetchAppointments, showToast]);

  // Tab counts and summary cards follow the selected date only.
  const forDate = appointments.filter((item) => !selectedDate || !item.rawDate || item.rawDate === selectedDate);
  const counts = {
    all: forDate.length,
    online: forDate.filter((a) => a.type === 'online').length,
    walkin: forDate.filter((a) => a.type === 'walkin').length,
  };
  const timed = forDate.filter((a) => a.consultMinutes > 0);
  const avgConsult = timed.length
    ? Math.max(1, Math.round(timed.reduce((sum, a) => sum + a.consultMinutes, 0) / timed.length))
    : null;

  const visible = forDate.filter((item) => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (tab !== 'all' && item.type !== tab) return false;
    if (q && !item.name.toLowerCase().includes(q) && item.token.toLowerCase() !== q) return false;
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    return true;
  });

  const dateTitle = !selectedDate ? 'All dates' : selectedDate === today ? `Today (${formatDateLabel(today)})` : formatDateLabel(selectedDate);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Appointments</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9488']} tintColor="#0D9488" />}
      >
        {/* Date filter — counts below follow it. Tap the date for all dates / today. */}
        <View style={s.datePicker}>
          <Pressable hitSlop={8} style={s.dateArrowBtn} onPress={() => setSelectedDate((d) => shiftDateKey(d, -1))}>
            <AppIcon name="chevron-left" size={16} color="#475569" strokeWidth={2.2} />
          </Pressable>
          <Pressable style={s.dateCenter} onPress={() => setSelectedDate((d) => (d ? '' : today))}>
            <AppIcon name="calendar" size={14} color="#0D9488" strokeWidth={2.1} />
            <Text style={s.dateText}>{selectedDate ? formatDateLabel(selectedDate) : 'All dates'}</Text>
          </Pressable>
          <Pressable hitSlop={8} style={s.dateArrowBtn} onPress={() => setSelectedDate((d) => shiftDateKey(d, 1))}>
            <AppIcon name="chevron-right" size={16} color="#475569" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* All / Online / Walk-in tabs with counts. */}
        <View style={s.tabs}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const content = (
              <>
                <Text style={[s.tabLabel, active && s.tabLabelActive]} numberOfLines={1}>{t.label}</Text>
                <View style={[s.tabCount, active && s.tabCountActive]}>
                  <Text translate={false} style={[s.tabCountText, active && s.tabCountTextActive]}>{counts[t.key]}</Text>
                </View>
              </>
            );
            // Active tab: the dashboard's teal gradient.
            return (
              <Pressable key={t.key} style={s.tabSlot} onPress={() => setTab(t.key)}>
                {active ? (
                  <LinearGradient colors={doctorGradient} {...gradientDirection} style={s.tab}>{content}</LinearGradient>
                ) : (
                  <View style={s.tab}>{content}</View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Summary cards. */}
        <View style={s.cards}>
          <SummaryCard hero icon="users" value={counts.all} label="Total Appointments" sub={dateTitle} />
          <SummaryCard icon="globe" value={counts.online} label="Online Appointments" sub={percent(counts.online, counts.all)} />
          <SummaryCard icon="walk" value={counts.walkin} label="Walk-in Appointments" sub={percent(counts.walkin, counts.all)} />
          <SummaryCard icon="clock" value={avgConsult ? `${avgConsult} min` : '—'} label="Avg. Consultation" sub="Per patient" />
        </View>

        <Text style={s.listTitle}>
          {selectedDate === today ? "Today's Appointments" : 'Appointments'} ({visible.length})
        </Text>

        <View style={s.search}>
          <AppIcon name="search" size={15} color="#94A3B8" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by name or token" placeholderTextColor="#94A3B8" style={s.searchInput} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.segmentScroll} contentContainerStyle={s.segment}>
          {STATUS_FILTERS.map((label) => {
            const active = statusFilter === label;
            return (
              <Pressable key={label} style={[s.segmentItem, active && s.segmentItemActive]} onPress={() => setStatusFilter(label)}>
                <Text style={[s.segmentLabel, active && s.segmentLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!!loadError && !loading && (
          <View style={s.empty}>
            <Text style={s.emptyText}>{loadError}</Text>
          </View>
        )}
        {loading ? (
          <View style={s.empty}>
            <AppIcon name="clock" size={26} color="#B7C0CE" strokeWidth={1.6} />
            <Text style={s.emptyText}>Loading appointments...</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <AppIcon name="calendar" size={26} color="#B7C0CE" strokeWidth={1.6} />
            <Text style={s.emptyText}>
              {forDate.length === 0 ? 'No appointments for this date.' : 'No appointments match your filters.'}
            </Text>
          </View>
        ) : (
          visible.map((item, index) => (
            <AppointmentListCard
              key={item.key}
              item={item}
              serial={index + 1}
              highlighted={isFocused(item)}
              onLayout={(e) => onCardLayout(item, e.nativeEvent.layout.y)}
              onDelete={deleteAppointment}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Dashboard overview look: white cards with a teal icon; the total is the
// gradient hero card.
function SummaryCard({ hero, icon, value, label, sub }) {
  const body = (
    <>
      <View style={[s.summaryIcon, hero && s.summaryIconHero]}>
        <AppIcon name={icon} size={18} color={hero ? '#FFFFFF' : colors.blue} strokeWidth={2.1} />
      </View>
      <Text translate={false} style={[s.summaryValue, hero && s.textOnGradient]}>{value}</Text>
      <Text style={[s.summaryLabel, hero && s.textOnGradient]} numberOfLines={1}>{label}</Text>
      <Text style={[s.summarySub, hero && s.subOnGradient]} numberOfLines={1}>{sub}</Text>
    </>
  );
  return hero ? (
    <LinearGradient colors={doctorGradient} {...gradientDirection} style={[s.summaryCard, s.summaryHero]}>{body}</LinearGradient>
  ) : (
    <View style={s.summaryCard}>{body}</View>
  );
}

const getInitials = (name) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function AppointmentListCard({ item, serial, highlighted, onLayout, onDelete }) {
  const status = STATUS_META[item.status] || STATUS_META.Pending;
  const type = TYPE_META[item.type];
  const muted = item.status === 'Completed' || item.status === 'Cancelled';
  const info = [item.age ? `${item.age} yrs` : '', item.gender].filter(Boolean).join(' | ');

  return (
    <View onLayout={onLayout} style={[s.card, item.isEmergency && s.cardEmergency, highlighted && s.cardHighlighted]}>
      {highlighted && (
        <View style={s.fromNotification}>
          <AppIcon name="bell" size={11} color="#0D9488" strokeWidth={2.2} />
          <Text style={s.fromNotificationText}>From notification</Text>
        </View>
      )}
      <View style={s.cardTop}>
        <View style={s.tokenCol}>
          <Text translate={false} style={s.serial}>{serial}</Text>
          <Text translate={false} style={s.tokenText}>
            {item.isEmergency ? 'SOS' : item.token ? `#${item.token}` : '—'}
          </Text>
        </View>
        {/* Patients only have cartoon avatars (never a real photo), which often
            don't match their gender — show initials in a gender colour instead. */}
        <View style={[s.avatar, /^f/i.test(item.gender) ? s.avatarFemale : /^m/i.test(item.gender) ? s.avatarMale : null]}>
          <Text translate={false} style={s.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={s.grow}>
          <Text translate={false} style={[s.name, muted && s.nameMuted]} numberOfLines={1}>{item.name}</Text>
          {!!info && <Text translate={false} style={s.metaLine} numberOfLines={1}>{info}</Text>}
        </View>
        <View style={[s.typeBadge, { backgroundColor: type.bg }]}>
          <AppIcon name={type.icon} size={12} color={type.color} strokeWidth={2.2} />
          <Text style={[s.typeText, { color: type.color }]}>{type.label}</Text>
        </View>
      </View>

      {!!item.reason && <Text translate={false} style={s.reasonText} numberOfLines={2}>{item.reason}</Text>}

      <View style={s.cardBottom}>
        <AppIcon name="clock" size={13} color="#64748B" strokeWidth={2} />
        <Text translate={false} style={s.timeText} numberOfLines={1}>
          {item.rawDate ? formatDateLabel(item.rawDate) : 'Date N/A'}
          {!item.isEmergency && item.time ? `  ·  ${item.time}` : ''}
          {item.mode !== 'In-clinic' ? `  ·  ${item.mode}` : ''}
        </Text>
        <View style={[s.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[s.statusText, { color: status.color }]}>{item.status}</Text>
        </View>
        <Pressable style={s.iconButton} onPress={() => onDelete(item)} hitSlop={6}>
          <AppIcon name="trash" size={14} color="#94A3B8" strokeWidth={1.9} />
        </Pressable>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  content: { padding: 14, paddingBottom: 28 },

  datePicker: { height: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  dateArrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  tabs: { flexDirection: 'row', marginTop: 12, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#CCFBF1', padding: 4, ...shadow },
  tabSlot: { flex: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabLabel: { fontSize: 13.5, fontWeight: '700', color: '#475569', flexShrink: 1 },
  tabLabelActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CCFBF1' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontSize: 11.5, fontWeight: '800', color: colors.navy },
  tabCountTextActive: { color: '#FFFFFF' },

  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  summaryCard: { width: '48.5%', borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, ...shadow },
  summaryHero: { borderWidth: 0 },
  summaryIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: '#E6F7F5' },
  summaryIconHero: { backgroundColor: 'rgba(255,255,255,0.22)' },
  textOnGradient: { color: '#FFFFFF' },
  subOnGradient: { color: 'rgba(255,255,255,0.85)' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  summaryLabel: { fontSize: 12.5, fontWeight: '600', color: '#334155', marginTop: 2 },
  summarySub: { fontSize: 11.5, color: '#64748B', marginTop: 2 },

  listTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 6, marginBottom: 10 },
  search: { height: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 0, marginLeft: 8 },

  segmentScroll: { marginTop: 10, marginBottom: 12, marginHorizontal: -14, flexGrow: 0 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  segmentItem: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  segmentItemActive: { backgroundColor: '#F0FDFA', borderColor: '#5EEAD4' },
  segmentLabel: { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  segmentLabelActive: { color: '#0F766E', fontWeight: '700' },

  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCFBF1', borderRadius: 14, padding: 12, marginBottom: 10, ...shadow },
  cardEmergency: { borderColor: '#FECACA' },
  cardHighlighted: { borderColor: '#0D9488', borderWidth: 2, backgroundColor: '#F0FDFA' },
  fromNotification: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E6F7F5', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 9 },
  fromNotificationText: { fontSize: 11, fontWeight: '700', color: '#0D9488' },
  grow: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tokenCol: { width: 34, alignItems: 'center' },
  serial: { fontSize: 10.5, color: '#94A3B8', fontWeight: '600' },
  tokenText: { fontSize: 14, fontWeight: '800', color: colors.navy },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  avatarMale: { backgroundColor: '#3B82F6' },
  avatarFemale: { backgroundColor: '#EC4899' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  nameMuted: { color: '#475569' },
  metaLine: { fontSize: 12, color: '#64748B', marginTop: 2 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  typeText: { fontSize: 12, fontWeight: '700' },
  reasonText: { fontSize: 13, lineHeight: 18, color: '#334155', marginTop: 9, marginLeft: 44 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  timeText: { flex: 1, fontSize: 12, color: '#64748B' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  iconButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: '#94A3B8' },
});
