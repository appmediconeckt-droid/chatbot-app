// Ported from MediconecktApp's FollowUpsScreen. Same data + actions as the web
// Follow-Up/FollowUp.jsx: patients from GET /api/appointments?doctor_id, rows
// from GET /api/followups?doctor_id, status changes / edits via PUT, delete
// via DELETE { doctor_id }, plus the web's status / type / search filters.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import NewFollowUpScreen from './NewFollowUpScreen';
import FollowUpDetailsScreen from './FollowUpDetailsScreen';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
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

// One palette for the whole screen: teal brand + semantic status colors.
const STATUS_META = {
  pending: { label: 'Pending', fg: '#B45309', bg: '#FEF3C7', strip: '#F59E0B', icon: 'clock' },
  scheduled: { label: 'Scheduled', fg: '#0F766E', bg: '#CCFBF1', strip: '#14B8A6', icon: 'calendar' },
  completed: { label: 'Completed', fg: '#15803D', bg: '#DCFCE7', strip: '#22C55E', icon: 'check-mark' },
  overdue: { label: 'Overdue', fg: '#B91C1C', bg: '#FEE2E2', strip: '#EF4444', icon: 'warning' },
};
const TYPE_META = {
  routine: { label: 'Routine', fg: '#0369A1', bg: '#E0F2FE' },
  urgent: { label: 'Urgent', fg: '#BE123C', bg: '#FFE4E6' },
  consultation: { label: 'Consultation', fg: '#6D28D9', bg: '#EDE9FE' },
};
const STATUS_LABEL = { scheduled: 'Scheduled', pending: 'Pending', completed: 'Completed' };
const TYPE_LABEL = { routine: 'Routine', urgent: 'Urgent', consultation: 'Consultation' };
const STATUS_FILTERS = [['all', 'All'], ['pending', 'Pending'], ['scheduled', 'Scheduled'], ['completed', 'Completed']];
const TYPE_FILTERS = [['all', 'All Types'], ['routine', 'Routine'], ['urgent', 'Urgent'], ['consultation', 'Consultation']];

const getInitials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '??';

const formatTime = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};

const toCard = (fu) => {
  const key = normalizeDateInput(fu.followUpDate);
  const d = key ? new Date(`${key}T00:00:00`) : null;
  const todayKey = formatLocalDateKey();
  const overdue = Boolean(key) && fu.followUpStatus !== 'completed' && key < todayKey;
  const overdueDays = overdue ? Math.max(1, Math.round((new Date(`${todayKey}T00:00:00`) - d) / 86400000)) : 0;
  return {
    key: String(fu.id),
    initial: getInitials(fu.name),
    name: fu.name,
    subline: [fu.age !== 'N/A' ? `${fu.age} yrs` : null, fu.gender, fu.phone !== 'N/A' ? fu.phone : null].filter(Boolean).join(' • ') || 'No contact details',
    date: d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date not set',
    isToday: key === todayKey && fu.followUpStatus !== 'completed',
    time: formatTime(fu.followUpTime),
    notes: fu.notes && fu.notes !== 'N/A' ? fu.notes : '',
    typeMeta: TYPE_META[fu.followUpType] || TYPE_META.routine,
    statusMeta: overdue ? STATUS_META.overdue : STATUS_META[fu.followUpStatus] || STATUS_META.pending,
    overdue,
    overdueDays,
    completed: fu.followUpStatus === 'completed',
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

  useDoctorBack(() => {
    if (editing) setEditing(null);
    else if (creating) setCreating(false);
    else if (viewing) setViewing(null);
    else return false;
    return true;
  });

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

  const statusCount = (value) => (value === 'all' ? followUps.length : followUps.filter((x) => x.followUpStatus === value).length);
  const overdueCount = followUps.filter((x) => toCard(x).overdue).length;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Follow-ups</Text>
          <Text style={s.headerSub}>Track and manage patient follow-up visits</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#0D9488']} />}
      >
        {!!apiError && (
          <View style={s.errorBox}>
            <AppIcon name="warning" size={14} color="#B91C1C" />
            <Text style={s.errorText}>{apiError}</Text>
          </View>
        )}

        {/* Summary */}
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>Total follow-ups</Text>
              <Text style={s.heroValue}>{followUps.length}</Text>
            </View>
            <View style={s.heroIcon}><AppIcon name="refresh" size={22} color="#FFF" strokeWidth={2} /></View>
          </View>
          <View style={s.heroStats}>
            <HeroStat label="Due today" value={dueToday} onPress={() => setFilterStatus('all')} />
            <HeroStat label="Pending" value={pendingCount} onPress={() => setFilterStatus('pending')} />
            <HeroStat label="Overdue" value={overdueCount} alert={overdueCount > 0} onPress={() => setFilterStatus('all')} />
            <HeroStat label="Completed" value={completedCount} onPress={() => setFilterStatus('completed')} />
          </View>
        </LinearGradient>

        {/* Search */}
        <View style={s.search}>
          <AppIcon name="search" size={16} color="#0D9488" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by patient, phone or doctor" placeholderTextColor="#94A3B8" style={s.input} />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}><AppIcon name="x" size={14} color="#98A2B3" /></Pressable>
          )}
        </View>

        {/* Status filter (segmented) */}
        <View style={s.segment}>
          {STATUS_FILTERS.map(([value, label]) => {
            const active = filterStatus === value;
            return (
              <Pressable key={value} onPress={() => setFilterStatus(value)} style={[s.segmentItem, active && s.segmentItemActive]}>
                <Text style={[s.segmentText, active && s.segmentTextActive]} numberOfLines={1}>{label}</Text>
                <Text style={[s.segmentCount, active && s.segmentCountActive]}>{statusCount(value)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeFilters}>
          {TYPE_FILTERS.map(([value, label]) => {
            const active = filterType === value;
            const meta = TYPE_META[value];
            return (
              <Pressable
                key={value}
                onPress={() => setFilterType(value)}
                style={[s.typeChip, active && (meta ? { backgroundColor: meta.bg, borderColor: meta.fg } : s.typeChipAllActive)]}
              >
                {meta && <View style={[s.typeDot, { backgroundColor: meta.fg }]} />}
                <Text style={[s.typeChipText, active && (meta ? { color: meta.fg } : s.typeChipTextAllActive)]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.listHeader}>
          <Text style={s.section}>{filterStatus === 'all' ? 'All follow-ups' : `${STATUS_LABEL[filterStatus]} follow-ups`}</Text>
          <Text style={s.listCount}>{visible.length} shown</Text>
        </View>

        {loading ? (
          <View style={s.empty}>
            <ActivityIndicator color="#0D9488" />
            <Text style={s.emptyText}>Loading follow-ups...</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><AppIcon name="calendar" size={26} color="#0D9488" /></View>
            <Text style={s.emptyTitle}>{followUps.length === 0 ? 'No follow-ups yet' : 'No follow-ups match'}</Text>
            <Text style={s.emptyText}>
              {followUps.length === 0 ? 'Create a follow-up to remind a patient to come back.' : 'Try another filter or search term.'}
            </Text>
            {followUps.length === 0 && !!doctor?.id && (
              <Pressable style={s.emptyBtn} onPress={() => setCreating(true)}><Text style={s.emptyBtnText}>＋ New Follow-up</Text></Pressable>
            )}
          </View>
        ) : (
          visible.map((fu) => {
            const card = toCard(fu);
            return (
              <PatientCard
                key={card.key}
                card={card}
                busy={busy}
                onPress={() => setViewing(fu)}
                onMore={() => openMore(fu)}
                onComplete={() => handleStatusChange(fu, 'completed')}
              />
            );
          })
        )}
      </ScrollView>
      <Pressable onPress={() => setCreating(true)} style={s.fabWrap} disabled={!doctor?.id}>
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
          <AppIcon name="plus" size={18} color="#FFF" strokeWidth={2.6} />
          <Text style={s.fabText}>New</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function HeroStat({ label, value, onPress, alert }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.heroStat, alert && s.heroStatAlert, pressed && s.pressed]}>
      <Text style={s.heroStatValue}>{value}</Text>
      <Text style={s.heroStatLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function PatientCard({ card, onPress, onMore, onComplete, busy }) {
  const { statusMeta, typeMeta } = card;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]}>
      <View style={[s.strip, { backgroundColor: statusMeta.strip }]} />
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={[s.avatar, { backgroundColor: statusMeta.bg }]}>
            <Text style={[s.avatarText, { color: statusMeta.fg }]}>{card.initial}</Text>
          </View>
          <View style={s.flex}>
            <Text style={s.name} numberOfLines={1}>{card.name}</Text>
            <Text style={s.subline} numberOfLines={1}>{card.subline}</Text>
          </View>
          <Pressable onPress={onMore} hitSlop={10} style={s.moreBtn}>
            <AppIcon name="more" size={18} color="#667085" />
          </Pressable>
        </View>

        <View style={s.chips}>
          <View style={[s.chip, card.isToday && s.chipToday]}>
            <AppIcon name="calendar" size={12} color={card.isToday ? '#FFF' : '#0F766E'} />
            <Text style={[s.chipText, card.isToday && s.chipTextToday]}>{card.isToday ? 'Today' : card.date}</Text>
          </View>
          {!!card.time && (
            <View style={s.chip}>
              <AppIcon name="clock" size={12} color="#0F766E" />
              <Text style={s.chipText}>{card.time}</Text>
            </View>
          )}
          <View style={[s.chip, { backgroundColor: typeMeta.bg }]}>
            <Text style={[s.chipText, { color: typeMeta.fg }]}>{typeMeta.label}</Text>
          </View>
        </View>

        {!!card.notes && <Text style={s.notes} numberOfLines={2}>{card.notes}</Text>}

        <View style={s.cardFooter}>
          <View style={[s.statusPill, { backgroundColor: statusMeta.bg }]}>
            <AppIcon name={statusMeta.icon} size={11} color={statusMeta.fg} strokeWidth={2.6} />
            <Text style={[s.statusText, { color: statusMeta.fg }]}>
              {card.overdue ? `Overdue · ${card.overdueDays}d` : statusMeta.label}
            </Text>
          </View>
          <View style={s.footerActions}>
            {!card.completed && (
              <Pressable onPress={onComplete} disabled={busy} style={s.doneBtn} hitSlop={4}>
                <AppIcon name="check-mark" size={12} color="#15803D" strokeWidth={3} />
                <Text style={s.doneText}>Mark done</Text>
              </Pressable>
            )}
            <Text style={s.details}>Details ›</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  header: { minHeight: 64, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7E7E4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 21, fontWeight: '800', color: '#0D9488' },
  headerSub: { fontSize: 12, color: '#667085', marginTop: 1 },
  content: { padding: 14, paddingBottom: 96 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 10, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 12.5, color: '#B91C1C' },

  hero: { borderRadius: 20, padding: 16, shadowColor: '#0F766E', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  heroValue: { fontSize: 34, fontWeight: '800', color: '#FFF', marginTop: 2 },
  heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  heroStatAlert: { backgroundColor: 'rgba(239,68,68,0.35)' },
  heroStatValue: { fontSize: 19, fontWeight: '800', color: '#FFF' },
  heroStatLabel: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  search: { height: 48, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CDE7E3', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginTop: 16 },
  input: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },

  segment: { flexDirection: 'row', backgroundColor: '#E1F3F0', borderRadius: 14, padding: 4, gap: 4, marginTop: 12 },
  segmentItem: { flex: 1, borderRadius: 11, paddingVertical: 7, alignItems: 'center' },
  segmentItemActive: { backgroundColor: '#0D9488', shadowColor: '#0F766E', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  segmentText: { fontSize: 12, fontWeight: '700', color: '#475467' },
  segmentTextActive: { color: '#FFF' },
  segmentCount: { fontSize: 11, fontWeight: '800', color: '#0F766E', marginTop: 1 },
  segmentCountActive: { color: '#CCFBF1' },

  typeFilters: { gap: 8, paddingVertical: 12 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#D5DAE3', backgroundColor: '#FFF', paddingHorizontal: 13 },
  typeChipAllActive: { backgroundColor: '#17243A', borderColor: '#17243A' },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  typeChipText: { fontSize: 12.5, fontWeight: '700', color: '#475467' },
  typeChipTextAllActive: { color: '#FFF' },

  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  section: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  listCount: { fontSize: 12, fontWeight: '600', color: '#667085' },

  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#17243A' },
  emptyText: { fontSize: 13, color: '#667085', textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: { marginTop: 6, backgroundColor: '#0D9488', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E3EEEC', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  strip: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 16.5, fontWeight: '800', color: '#17243A' },
  subline: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  moreBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F7F9', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDFA', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  chipToday: { backgroundColor: '#0D9488' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  chipTextToday: { color: '#FFF' },
  notes: { fontSize: 12.5, lineHeight: 18, color: '#475467', marginTop: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF3F2' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '800' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  doneText: { fontSize: 12, fontWeight: '800', color: '#15803D' },
  details: { fontSize: 13, fontWeight: '800', color: '#0D9488' },

  fabWrap: { position: 'absolute', right: 16, bottom: 20, borderRadius: 28, shadowColor: '#0F766E', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  fab: { height: 52, paddingHorizontal: 20, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  fabText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
