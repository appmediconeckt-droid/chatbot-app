// Ported from MediconecktApp's AppointmentsListScreen. Same data + actions as
// the web AppointmentList: GET /api/appointments?doctor_id=<id> (rows filtered
// to this doctor), DELETE /api/appointments/:id, and status /
// date / search / hide-visited filters.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import axiosInstance from '../../../../axiosConfig';
import {
  formatAppointment,
  formatLocalDateKey,
  getDoctorIdFromUser,
  getStoredDoctorUser,
  normalizeApiList,
  pickFirst,
} from '../api/doctorAppointments';

// Colour is used sparingly: a small dot + label per status, nothing else.
const STATUS_META = {
  Pending: { color: '#D97706' },
  Confirmed: { color: '#0D9488' },
  Visited: { color: '#64748B' },
  Cancelled: { color: '#DC2626' },
};

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  'in-progress': 'Confirmed',
  completed: 'Visited',
  cancelled: 'Cancelled',
};

const mapAppointment = (raw) => {
  const appt = formatAppointment(raw);
  const mode = appt.consultationMode;
  return {
    id: appt.apiId,
    doctorId: pickFirst(raw?.doctor_id, raw?.doctorId, raw?.doctor?.id, raw?.doctor?._id),
    name: appt.name,
    phone: appt.phone,
    token: appt.tokenNumber != null ? String(appt.tokenNumber) : '',
    time: appt.scheduledTime,
    isEmergency: appt.isEmergency,
    createdMs: Date.parse(pickFirst(raw?.created_at, raw?.createdAt)) || 0,
    rawDate: formatLocalDateKey(appt.appointmentDate),
    status: STATUS_LABEL[appt.status] || 'Pending',
    reason: appt.issue,
    visitType: mode.includes('video') ? 'Video Consultation'
      : mode.includes('voice') || mode.includes('phone') ? 'Voice Consultation'
        : 'In Person Visit',
    place: pickFirst(raw?.clinic_name, raw?.clinic?.name, raw?.clinic?.clinic_name),
  };
};

const shiftDateKey = (key, days) => {
  const d = key ? new Date(`${key}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDateKey(d);
};

const formatDateLabel = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const STATUS_FILTERS = ['All', 'Pending', 'Confirmed', 'Visited', 'Cancelled'];

export default function AppointmentsListScreen({ onBack }) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState(''); // '' = all dates (web default)
  const [hideVisited, setHideVisited] = useState(false);
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
      const response = await axiosInstance.get('/api/appointments', { params: { doctor_id: doctorId } });
      setAppointments(
        normalizeApiList(response.data)
          .map(mapAppointment)
          .filter((apt) => !apt.doctorId || String(apt.doctorId) === String(doctorId))
          // Open emergencies on top (oldest request first); the rest keep API order.
          .map((apt, index) => ({ apt, index }))
          .sort((x, y) => {
            const ex = x.apt.isEmergency && ['Pending', 'Confirmed'].includes(x.apt.status);
            const ey = y.apt.isEmergency && ['Pending', 'Confirmed'].includes(y.apt.status);
            if (ex !== ey) return ex ? -1 : 1;
            if (ex && ey) return x.apt.createdMs - y.apt.createdMs;
            return x.index - y.index;
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments(true);
  };

  // Same as web handleDeleteAppointment: DELETE /api/appointments/:id.
  const deleteAppointment = useCallback((id, name) => {
    Alert.alert('Delete Appointment', `Delete appointment for ${name}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setAppointments((prev) => prev.filter((item) => item.id !== id));
          try {
            await axiosInstance.delete(`/api/appointments/${id}`);
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

  const visible = appointments.filter((item) => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (q && !item.name.toLowerCase().includes(q) && item.token.toLowerCase() !== q) return false;
    if (hideVisited && item.status === 'Visited') return false;
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (selectedDate && item.rawDate && item.rawDate !== selectedDate) return false;
    return true;
  });

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Appointments</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9488']} tintColor="#0D9488" />}
      >
        <View style={s.toolbar}>
          <View style={s.datePicker}>
            <Pressable hitSlop={8} style={s.dateArrowBtn} onPress={() => setSelectedDate((d) => shiftDateKey(d, -1))}>
              <AppIcon name="chevron-left" size={16} color="#475569" strokeWidth={2.2} />
            </Pressable>
            <Pressable style={s.dateCenter} onPress={() => setSelectedDate((d) => (d ? '' : formatLocalDateKey()))}>
              <AppIcon name="calendar" size={14} color="#0D9488" strokeWidth={2.1} />
              <Text style={s.dateText}>{selectedDate ? formatDateLabel(selectedDate) : 'All dates'}</Text>
            </Pressable>
            <Pressable hitSlop={8} style={s.dateArrowBtn} onPress={() => setSelectedDate((d) => shiftDateKey(d, 1))}>
              <AppIcon name="chevron-right" size={16} color="#475569" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={s.search}>
            <AppIcon name="search" size={15} color="#94A3B8" />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search patient name or token" placeholderTextColor="#94A3B8" style={s.searchInput} />
          </View>
        </View>

        {/* Status filter — labels only, no counts. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.segmentScroll} contentContainerStyle={s.segment}>
          {STATUS_FILTERS.map((label) => {
            const active = statusFilter === label;
            return (
              <Pressable key={label} style={[s.segmentItem, active && s.segmentItemActive]} onPress={() => setStatusFilter(label)}>
                <View style={s.segmentLabelRow}>
                  {label !== 'All' && <View style={[s.dot, { backgroundColor: STATUS_META[label].color }]} />}
                  <Text style={[s.segmentLabel, active && s.segmentLabelActive]}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.summary}>
          <Pressable style={s.hide} onPress={() => setHideVisited((v) => !v)} hitSlop={6}>
            <View style={[s.checkbox, hideVisited && s.checkboxOn]}>
              {hideVisited && <AppIcon name="check-mark" size={9} color="#FFF" strokeWidth={3.4} />}
            </View>
            <Text style={s.hideText}>Hide visited</Text>
          </Pressable>
        </View>

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
              {appointments.length === 0 ? 'No appointments yet.' : 'No appointments match your search.'}
            </Text>
          </View>
        ) : (
          visible.map((item) => (
            <AppointmentListCard key={item.id} item={item} onDelete={deleteAppointment} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const getInitials = (name) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function AppointmentListCard({ item, onDelete }) {
  const meta = STATUS_META[item.status] || STATUS_META.Pending;
  const muted = item.status === 'Visited' || item.status === 'Cancelled';
  const modeIcon = item.visitType.startsWith('Video') ? 'video' : item.visitType.startsWith('Voice') ? 'phone' : 'pin';

  return (
    <View style={[s.card, item.isEmergency && s.cardEmergency]}>
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text translate={false} style={s.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={s.grow}>
          <Text translate={false} style={[s.name, muted && s.nameMuted]} numberOfLines={1}>{item.name}</Text>
          <Text style={s.metaLine} numberOfLines={1}>
            {item.isEmergency ? 'Emergency' : item.token ? `Token #${item.token}` : 'No token'}
            {'  ·  '}
            {item.rawDate ? formatDateLabel(item.rawDate) : 'Date N/A'}
            {!item.isEmergency && item.time ? `  ·  ${item.time}` : ''}
          </Text>
        </View>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: meta.color }]} />
          <Text style={[s.statusText, { color: meta.color }]}>{item.status}</Text>
        </View>
      </View>

      <Text translate={false} style={s.reasonText} numberOfLines={2}>{item.reason}</Text>
      {!!item.cancelNote && <Text translate={false} style={s.cancelNote}>{item.cancelNote}</Text>}

      <View style={s.cardBottom}>
        <AppIcon name={modeIcon} size={13} color="#64748B" strokeWidth={2} />
        <Text translate={false} style={s.visitType} numberOfLines={1}>
          {item.visitType}{item.place ? `  ·  ${item.place}` : ''}
        </Text>
        {item.isEmergency && (
          <View style={s.emergencyTag}>
            <Text style={s.emergencyTagText}>Emergency</Text>
          </View>
        )}
        <Pressable style={s.iconButton} onPress={() => onDelete(item.id, item.name)} hitSlop={6}>
          <AppIcon name="trash" size={14} color="#94A3B8" strokeWidth={1.9} />
        </Pressable>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  content: { padding: 14, paddingBottom: 28 },

  toolbar: { gap: 10 },
  datePicker: { height: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  dateArrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  search: { height: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 0, marginLeft: 8 },

  segmentScroll: { marginTop: 12, marginHorizontal: -14, flexGrow: 0 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  segmentItem: { height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  segmentItemActive: { backgroundColor: '#F0FDFA', borderColor: '#5EEAD4' },
  segmentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  segmentLabelActive: { color: '#0F766E', fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3 },

  summary: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 10, paddingHorizontal: 2 },
  hide: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 16, height: 16, borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 4, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  hideText: { fontSize: 12.5, color: '#475569' },

  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardEmergency: { borderColor: '#FECACA' },
  grow: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  nameMuted: { color: '#475569' },
  metaLine: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 2 },
  statusText: { fontSize: 12, fontWeight: '700' },
  reasonText: { fontSize: 13.5, lineHeight: 19, color: '#334155', marginTop: 10 },
  cancelNote: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  visitType: { flex: 1, fontSize: 12, color: '#64748B' },
  emergencyTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FEF2F2' },
  emergencyTagText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  iconButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: '#94A3B8' },
});
