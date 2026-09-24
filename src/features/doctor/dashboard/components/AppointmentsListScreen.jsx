// Ported from MediconecktApp's AppointmentsListScreen. Same data + actions as
// the web AppointmentList: GET /api/appointments?doctor_id=<id> (rows filtered
// to this doctor), DELETE /api/appointments/:id, tap-to-call, and status /
// date / search / hide-visited filters.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
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

const STATUS_META = {
  Confirmed: { icon: 'check-mark', color: '#168A4A', border: '#78D69D', bg: '#ECFAF1' },
  Pending: { icon: 'clock', color: '#B7791F', border: '#FBD38D', bg: '#FFFBEB' },
  Cancelled: { icon: 'x', color: '#D92D20', border: '#FFB4AD', bg: '#FFF1F0' },
  Visited: { icon: 'check-mark', color: '#667085', border: '#C8D1DF', bg: '#F5F6F8' },
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
    time: appt.scheduledTime,
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
          .filter((apt) => !apt.doctorId || String(apt.doctorId) === String(doctorId)),
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

  const callPatient = useCallback((item) => {
    const phone = String(item.phone || '').trim();
    if (!phone || phone.toUpperCase() === 'N/A') {
      showToast(`Phone number is not available for ${item.name}.`);
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => showToast('Could not start the call'));
  }, [showToast]);

  const visible = appointments.filter((item) => {
    if (!item.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (hideVisited && item.status === 'Visited') return false;
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (selectedDate && item.rawDate && item.rawDate !== selectedDate) return false;
    return true;
  });

  const counts = appointments.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

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
        <View style={s.datePicker}>
          <Pressable hitSlop={8} style={s.dateArrowBtn} onPress={() => setSelectedDate((d) => shiftDateKey(d, -1))}>
            <AppIcon name="chevron-left" size={16} color="#526078" strokeWidth={2.2} />
          </Pressable>
          <Pressable style={s.dateCenter} onPress={() => setSelectedDate((d) => (d ? '' : formatLocalDateKey()))}>
            <View style={s.dateIconBadge}>
              <AppIcon name="calendar" size={13} color="#0D9488" strokeWidth={2.1} />
            </View>
            <Text style={s.dateText}>{selectedDate ? formatDateLabel(selectedDate) : 'All Dates'}</Text>
          </Pressable>
          <Pressable hitSlop={8} style={s.dateArrowBtn} onPress={() => setSelectedDate((d) => shiftDateKey(d, 1))}>
            <AppIcon name="chevron-right" size={16} color="#526078" strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={s.statsRow}>
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <View key={status} style={[s.statPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
              <Text style={[s.statPillValue, { color: meta.color }]}>{counts[status] || 0}</Text>
              <Text style={[s.statPillLabel, { color: meta.color }]}>{status}</Text>
            </View>
          ))}
        </View>

        <View style={s.search}>
          <AppIcon name="search" size={15} color="#7C8798" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search Patient..." placeholderTextColor="#8A94A4" style={s.searchInput} />
        </View>

        <View style={s.filters}>
          {STATUS_FILTERS.map((label) => (statusFilter === label ? (
            <View key={label} style={s.chipActive}>
              <AppIcon name="check-mark" size={11} color="#FFF" strokeWidth={3} />
              <Text style={s.chipActiveText}>{label}</Text>
            </View>
          ) : (
            <Pressable key={label} style={s.chip} onPress={() => setStatusFilter(label)}>
              <Text style={s.chipText}>{label}</Text>
            </Pressable>
          )))}
        </View>

        <View style={s.summary}>
          <Text style={s.showing}>Showing {visible.length} of {appointments.length} Appointments</Text>
          <Pressable style={s.hide} onPress={() => setHideVisited((v) => !v)}>
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
            <AppointmentListCard key={item.id} item={item} onCall={callPatient} onDelete={deleteAppointment} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const getInitials = (name) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function AppointmentListCard({ item, onCall, onDelete }) {
  const meta = STATUS_META[item.status];
  const isVisited = item.status === 'Visited';
  const isCancelled = item.status === 'Cancelled';

  return (
    <View style={[s.card, isVisited && s.cardHighlight, { borderLeftColor: meta.color }]}>
      <View style={s.cardTop}>
        <View style={[s.avatar, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={[s.avatarText, { color: meta.color }]}>{getInitials(item.name)}</Text>
        </View>
        <View style={s.grow}>
          <Text style={[s.name, isVisited && s.nameHighlight]}>{item.name}</Text>
          <View style={s.timeRow}>
            <AppIcon name="clock" size={11} color="#526078" />
            <Text style={s.time}>{item.time}</Text>
          </View>
        </View>
        <View style={[s.status, { borderColor: meta.border, backgroundColor: meta.bg }]}>
          <AppIcon name={meta.icon} size={10} color={meta.color} strokeWidth={3} />
          <Text style={[s.statusText, { color: meta.color }]}>{item.status}</Text>
        </View>
      </View>

      <View style={[s.reasonBox, { backgroundColor: meta.bg, borderColor: meta.border }]}>
        <View style={[s.reasonIcon, { backgroundColor: '#FFF' }]}>
          <AppIcon name={isCancelled ? 'warning' : 'pulse'} size={13} color={meta.color} strokeWidth={2} />
        </View>
        <View style={s.grow}>
          <Text style={s.reasonText}>{item.reason}</Text>
          {!!item.cancelNote && <Text style={s.cancelNote}>{item.cancelNote}</Text>}
        </View>
      </View>

      <View style={s.cardBottom}>
        <Text style={s.visitType}>
          {item.visitType}{item.place ? ` | ${item.place}` : ''}
        </Text>
        <Pressable style={s.iconButton} onPress={() => onCall(item)}>
          <AppIcon name="phone" size={14} color="#0D9488" strokeWidth={1.9} />
        </Pressable>
        <Pressable style={s.iconButton} onPress={() => onDelete(item.id, item.name)}>
          <AppIcon name="trash" size={14} color="#D92D20" strokeWidth={1.9} />
        </Pressable>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 10, paddingBottom: 28 },
  datePicker: { height: 46, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  dateArrowBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FA' },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateIconBadge: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 14.5, fontWeight: '700', color: '#17243A' },
  statsRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  statPill: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  statPillValue: { fontSize: 16, fontWeight: '800' },
  statPillLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  search: { height: 42, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 12, shadowColor: '#17243A', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  searchInput: { flex: 1, fontSize: 13.5, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 12 },
  chipActive: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, borderRadius: 16, paddingHorizontal: 13, backgroundColor: '#0D9488', shadowColor: '#0D9488', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  chipActiveText: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#FFF' },
  chipText: { fontSize: 13, color: '#526078' },
  summary: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  showing: { fontSize: 12, fontWeight: '600', color: '#526078' },
  hide: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 15, height: 15, borderWidth: 1, borderColor: '#AEB8C6', borderRadius: 4, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  hideText: { fontSize: 12, color: '#526078' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E6ED', borderLeftWidth: 4, borderRadius: 13, padding: 13, marginBottom: 11, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHighlight: { backgroundColor: '#F7FEFD' },
  grow: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  name: { fontSize: 15.5, fontWeight: '700', color: '#17243A' },
  nameHighlight: { color: '#0D9488' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  time: { fontSize: 12, color: '#526078' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '700' },
  reasonBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 9, padding: 9, marginTop: 11 },
  reasonIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reasonText: { fontSize: 13, color: '#26364D', fontWeight: '600' },
  cancelNote: { fontSize: 11.5, color: '#8A94A4', marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  visitType: { flex: 1, fontSize: 11.5, color: '#667085' },
  iconButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#D9DFE8', alignItems: 'center', justifyContent: 'center', marginLeft: 7 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: '#8A94A4' },
});
