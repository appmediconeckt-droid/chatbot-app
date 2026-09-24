// Ported from MediconecktApp's FollowUpsScreen. Same data + actions as the web
// Follow-Up/FollowUp.jsx: patients from GET /api/appointments?doctor_id, rows
// from GET /api/followups?doctor_id, status changes / edits via PUT, delete
// via DELETE { doctor_id }, plus the web's status / type / search filters.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import NewFollowUpScreen from './NewFollowUpScreen';
import FollowUpDetailsScreen from './FollowUpDetailsScreen';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { formatLocalDateKey } from '../api/doctorAppointments';
import {
  apiErrorMessage,
  deleteFollowUp,
  getCurrentDoctor,
  loadAppointmentPatients,
  loadFollowUpsForDoctor,
  normalizeDateInput,
  updateFollowUp,
} from '../api/doctorFollowUps';

const STATUS_TONE = { scheduled: 'blue', pending: 'amber', completed: 'green' };
const STATUS_LABEL = { scheduled: 'Scheduled', pending: 'Pending', completed: 'Completed' };
const TYPE_LABEL = { routine: 'Routine', urgent: 'Urgent', consultation: 'Consultation' };
const STATUS_FILTERS = [['all', 'All'], ['pending', 'Pending'], ['scheduled', 'Scheduled'], ['completed', 'Completed']];
const TYPE_FILTERS = [['all', 'All Types'], ['routine', 'Routine'], ['urgent', 'Urgent'], ['consultation', 'Consultation']];

const getInitials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '??';

const toCard = (fu) => {
  const key = normalizeDateInput(fu.followUpDate);
  const d = key ? new Date(`${key}T00:00:00`) : null;
  const todayKey = formatLocalDateKey();
  let dateLabel = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + (fu.followUpTime ? `, ${String(fu.followUpTime).slice(0, 5)}` : '')
    : 'Date not set';
  const overdue = Boolean(key) && fu.followUpStatus !== 'completed' && key < todayKey;
  if (overdue) {
    const days = Math.max(1, Math.round((new Date(`${todayKey}T00:00:00`) - d) / 86400000));
    dateLabel = `Overdue (${days}d)`;
  }
  return {
    key: String(fu.id),
    initial: getInitials(fu.name),
    name: fu.name,
    id_display: `${fu.age !== 'N/A' ? `Age ${fu.age} • ` : ''}${fu.phone}`,
    date: dateLabel,
    type: TYPE_LABEL[fu.followUpType] || 'Routine',
    status: STATUS_LABEL[fu.followUpStatus] || 'Pending',
    tone: STATUS_TONE[fu.followUpStatus] || 'amber',
    overdue,
  };
};

export default function FollowUpsScreen({ onBack }) {
  const { showToast } = useToast();
  const [doctor, setDoctor] = useState(null);
  const [patients, setPatients] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCurrentDoctor().then(setDoctor); }, []);

  const loadData = useCallback(async () => {
    if (!doctor) return;
    if (!doctor.id) {
      setApiError('Doctor id not found. Please login again.');
      setLoading(false);
      return;
    }
    try {
      setApiError('');
      const appointmentPatients = await loadAppointmentPatients(doctor.id);
      setPatients(appointmentPatients);
      setFollowUps(await loadFollowUpsForDoctor(doctor.id, appointmentPatients, doctor.name));
    } catch (err) {
      setApiError(apiErrorMessage(err, 'Failed to load follow-ups'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [doctor]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing) setEditing(null);
      else if (creating) setCreating(false);
      else if (viewing) setViewing(null);
      else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [creating, editing, viewing, onBack]);

  const handleStatusChange = async (followUp, newStatus) => {
    const previous = followUps;
    setBusy(true);
    setFollowUps((prev) => prev.map((x) => (x.id === followUp.id ? { ...x, followUpStatus: newStatus } : x)));
    try {
      await updateFollowUp(doctor.id, followUp, { followUpStatus: newStatus });
      showToast(`Marked as ${STATUS_LABEL[newStatus]}`);
      setViewing((v) => (v && v.id === followUp.id ? { ...v, followUpStatus: newStatus } : v));
    } catch (err) {
      setFollowUps(previous);
      Alert.alert('Error', apiErrorMessage(err, 'Failed to update follow-up status'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (followUp) => {
    Alert.alert('Delete Follow-up', 'Are you sure you want to delete this follow-up?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFollowUp(doctor.id, followUp.id);
            setFollowUps((prev) => prev.filter((x) => x.id !== followUp.id));
            setViewing(null);
            showToast('Follow-up deleted');
          } catch (err) {
            Alert.alert('Error', apiErrorMessage(err, 'Failed to delete follow-up'));
          }
        },
      },
    ]);
  };

  const openMore = (followUp) => {
    const options = STATUS_FILTERS
      .filter(([value]) => value !== 'all' && value !== followUp.followUpStatus)
      .map(([value, label]) => ({ text: `Mark ${label}`, onPress: () => handleStatusChange(followUp, value) }));
    options.push({ text: 'Edit', onPress: () => setEditing(followUp) });
    options.push({ text: 'Delete', style: 'destructive', onPress: () => handleDelete(followUp) });
    options.push({ text: 'Close', style: 'cancel' });
    Alert.alert(followUp.name, `${STATUS_LABEL[followUp.followUpStatus]} • ${TYPE_LABEL[followUp.followUpType]}`, options);
  };

  if (creating || editing) {
    return (
      <NewFollowUpScreen
        doctor={doctor}
        patients={patients}
        followUp={editing}
        onBack={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setViewing(null); loadData(); }}
      />
    );
  }

  if (viewing) {
    return (
      <FollowUpDetailsScreen
        followUp={viewing}
        busy={busy}
        onBack={() => setViewing(null)}
        onEdit={() => setEditing(viewing)}
        onCheckIn={() => handleStatusChange(viewing, 'completed')}
        onDelete={() => handleDelete(viewing)}
      />
    );
  }

  const term = query.trim().toLowerCase();
  const visible = followUps.filter((x) => {
    if (filterStatus !== 'all' && x.followUpStatus !== filterStatus) return false;
    if (filterType !== 'all' && x.followUpType !== filterType) return false;
    if (term && !(x.name.toLowerCase().includes(term) || String(x.phone).includes(term) || String(x.doctor).toLowerCase().includes(term))) return false;
    return true;
  });

  const todayKey = formatLocalDateKey();
  const dueToday = followUps.filter((x) => x.followUpStatus !== 'completed' && normalizeDateInput(x.followUpDate) === todayKey).length;
  const pendingCount = followUps.filter((x) => x.followUpStatus === 'pending').length;
  const completedCount = followUps.filter((x) => x.followUpStatus === 'completed').length;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Follow Ups Management</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#0D9488']} />}
      >
        <Text style={s.heading}>Overview</Text>
        <Text style={s.subheading}>Follow-up activity summary.</Text>
        {!!apiError && <Text style={s.errorText}>{apiError}</Text>}
        <View style={s.metrics}>
          <Metric icon="users" label="Total Follow-ups" value={String(followUps.length)} />
          <Metric icon="calendar" label="Due Today" value={String(dueToday)} />
          <Metric icon="calendar" label="Pending" value={String(pendingCount)} red />
        </View>
        <View style={s.completed}>
          <View style={s.completeIcon}><Text style={s.completeCheck}>✓</Text></View>
          <View><Text style={s.completeLabel}>Completed</Text><Text style={s.completeValue}>{completedCount}</Text></View>
          <Pressable style={s.report} onPress={() => setFilterStatus('completed')}><Text style={s.reportText}>View{`\n`}All</Text></Pressable>
        </View>
        <Text style={s.section}>Follow Ups</Text>
        <View style={s.search}>
          <AppIcon name="search" size={15} color="#7C8798" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by patient, phone or doctor" placeholderTextColor="#8A94A4" style={s.input} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {STATUS_FILTERS.map(([value, label]) => (
            <Pressable key={value} onPress={() => setFilterStatus(value)} style={s.filter}>
              {filterStatus === value && <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
              <Text style={[s.filterText, filterStatus === value && s.filterTextActive]}>{filterStatus === value ? '✓ ' : ''}{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filters, s.filtersTight]}>
          {TYPE_FILTERS.map(([value, label]) => (
            <Pressable key={value} onPress={() => setFilterType(value)} style={s.filter}>
              {filterType === value && <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
              <Text style={[s.filterText, filterType === value && s.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {loading ? (
          <Text style={s.emptyText}>Loading follow-ups...</Text>
        ) : visible.length === 0 ? (
          <Text style={s.emptyText}>{followUps.length === 0 ? 'No follow-ups yet.' : 'No follow-ups match.'}</Text>
        ) : (
          visible.map((fu) => {
            const card = toCard(fu);
            return (
              <PatientCard
                key={card.key}
                {...card}
                onPress={() => setViewing(fu)}
                onMore={() => openMore(fu)}
              />
            );
          })
        )}
      </ScrollView>
      <Pressable onPress={() => setCreating(true)} style={s.fabWrap} disabled={!doctor?.id}>
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
          <Text style={s.plus}>+</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function Metric({ icon, label, value, trend, red }) {
  return (
    <View style={s.metric}>
      <View style={[s.metricIcon, red && s.metricIconRed]}><AppIcon name={icon} size={15} color={red ? '#D92D20' : '#0D9488'} /></View>
      {trend && <Text style={s.trend}>{trend}</Text>}
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}
function PatientCard(p) {
  const amber = p.tone === 'amber';
  const green = p.tone === 'green';
  return (
    <View style={s.patient}>
      <View style={s.patientTop}>
        <View style={[s.initial, amber && s.initialAmber, green && s.initialGreen]}><Text style={s.initialText}>{p.initial}</Text></View>
        <View style={s.patientInfo}><Text style={s.name}>{p.name}</Text><Text style={s.id}>{p.id_display}</Text></View>
        <Pressable onPress={p.onMore} hitSlop={8}><Text style={s.more}>⋮</Text></Pressable>
      </View>
      <View style={s.divider} />
      <View style={s.followRow}>
        <View style={s.followLeft}><Text style={s.meta}>▣ Follow-up Date</Text><Text style={s.meta}>▧ Type</Text></View>
        <View style={s.followRight}><Text style={[s.date, p.overdue && s.overdue]}>{p.date}</Text><Text style={s.type}>{p.type}</Text></View>
      </View>
      <View style={s.patientBottom}>
        <View style={[s.badge, amber && s.badgeAmber, green && s.badgeGreen]}>
          <Text style={[s.badgeText, amber && s.badgeTextAmber, green && s.badgeTextGreen]}>{green ? '✓ ' : amber ? '⚠ ' : ''}{p.status}</Text>
        </View>
        <Pressable onPress={p.onPress}><Text style={s.details}>View Details +</Text></Pressable>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 14, paddingBottom: 38 },
  heading: { fontSize: 21, fontWeight: '700', color: '#17243A' },
  subheading: { fontSize: 14, color: '#667085', marginTop: 3, marginBottom: 16 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, height: 128, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD4E1', borderRadius: 11, padding: 11 },
  metricIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#E9F1FF', alignItems: 'center', justifyContent: 'center' },
  metricIconRed: { backgroundColor: '#FFF0F0' },
  trend: { position: 'absolute', right: 7, top: 9, fontSize: 12, color: '#159A59', backgroundColor: '#DDF8E8', padding: 3, borderRadius: 7 },
  metricLabel: { fontSize: 13, color: '#667085', marginTop: 14 },
  metricValue: { fontSize: 25, fontWeight: '700', color: '#17243A', marginTop: 3 },
  completed: { height: 98, backgroundColor: '#2DD4BF', borderRadius: 11, marginTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  completeIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  completeCheck: { fontSize: 23, fontWeight: '700', color: '#2DD4BF' },
  completeLabel: { fontSize: 14, color: '#DDFFFF' },
  completeValue: { fontSize: 24, fontWeight: '700', color: '#FFF', marginTop: 2 },
  report: { marginLeft: 'auto', width: 78, height: 52, borderRadius: 7, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  reportText: { fontSize: 13, fontWeight: '700', textAlign: 'center', color: '#0D9488' },
  section: { fontSize: 20, fontWeight: '700', color: '#17243A', marginTop: 24, marginBottom: 12 },
  search: { height: 49, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 9, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  filter: { height: 38, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 19, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', overflow: 'hidden' },
  filterText: { fontSize: 13, color: '#526078' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },
  errorText: { fontSize: 13, color: '#D92D20', marginBottom: 10 },
  filtersTight: { paddingTop: 0 },
  emptyText: { fontSize: 13, color: '#8A94A4', textAlign: 'center', marginTop: 20 },
  patient: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD4E1', borderRadius: 11, padding: 14, marginBottom: 12 },
  patientTop: { flexDirection: 'row', alignItems: 'center' },
  initial: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#DFFCFF', alignItems: 'center', justifyContent: 'center' },
  initialAmber: { backgroundColor: '#FFF0C9' },
  initialGreen: { backgroundColor: '#E3E8EF' },
  initialText: { fontSize: 15, fontWeight: '700', color: '#526078' },
  patientInfo: { marginLeft: 12 },
  name: { fontSize: 18, fontWeight: '700', color: '#17243A' },
  id: { fontSize: 13, color: '#667085', marginTop: 4 },
  more: { marginLeft: 'auto', fontSize: 21, color: '#667085' },
  divider: { height: 1, backgroundColor: '#E2E7EE', marginVertical: 13 },
  followRow: { flexDirection: 'row' },
  followLeft: { gap: 8 },
  followRight: { marginLeft: 'auto', alignItems: 'flex-end', gap: 8 },
  meta: { fontSize: 13, color: '#667085' },
  date: { fontSize: 13, fontWeight: '600', color: '#344054' },
  overdue: { color: '#D92D20' },
  type: { fontSize: 13, color: '#344054' },
  patientBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  badge: { backgroundColor: '#EAF2FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  badgeAmber: { backgroundColor: '#FFF0F0' },
  badgeGreen: { backgroundColor: '#E8F8EF' },
  badgeText: { fontSize: 13, color: '#0D9488' },
  badgeTextAmber: { color: '#D92D20' },
  badgeTextGreen: { color: '#168A4A' },
  details: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  fabWrap: { position: 'absolute', right: 14, bottom: 18, width: 48, height: 48, borderRadius: 24, elevation: 6 },
  fab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 28, color: '#FFF', lineHeight: 30 },
});
