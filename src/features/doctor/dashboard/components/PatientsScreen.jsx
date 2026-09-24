// Patients — port of the web "Patients Medical Records" directory
// (PatientAppointmentDetails/PatientDetailsPage.jsx). Patients + visits come
// from GET /api/appointments?doctor_id (api/doctorPatients). Same stats,
// search, sort and 10-per-page pagination as the web. "Add Patient" is
// local-only there too (the web has no create-patient API).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { loadDoctorPatients } from '../api/doctorPatients';

const PAGE_SIZE = 10;
const GENDERS = ['All', 'Male', 'Female', 'Other'];
const SORTS = ['Newest First', 'Oldest First', 'Name A-Z'];
const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const todayLabel = () => new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
const emptyForm = () => ({ name: '', phone: '', age: '', gender: 'Male', bloodGroup: '', doctor: '' });

export default function PatientsScreen({ onPatientPress }) {
  const [patients, setPatients] = useState([]);
  const [localPatients, setLocalPatients] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('All');
  const [bloodGroup, setBloodGroup] = useState('All');
  const [sort, setSort] = useState('Newest First');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setError('');
      setPatients(await loadDoctorPatients());
      setStatus('succeeded');
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load patient details');
      setStatus('failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, gender, bloodGroup, sort]);

  const all = useMemo(() => [...localPatients, ...patients], [localPatients, patients]);
  const bloodOptions = useMemo(
    () => ['All', ...Array.from(new Set(all.map((p) => p.bloodGroup).filter((b) => b && b !== 'N/A')))],
    [all],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = all.filter((p) =>
      (!term || p.name.toLowerCase().includes(term) || String(p.phone).includes(term)) &&
      (gender === 'All' || String(p.gender).toLowerCase() === gender.toLowerCase()) &&
      (bloodGroup === 'All' || p.bloodGroup === bloodGroup));
    if (sort === 'Name A-Z') return [...rows].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'Oldest First') return [...rows].sort((a, b) => a.lastVisitKey - b.lastVisitKey);
    return [...rows].sort((a, b) => b.lastVisitKey - a.lastVisitKey);
  }, [all, search, gender, bloodGroup, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const first = filtered.length ? (safePage - 1) * PAGE_SIZE : 0;
  const pageRows = filtered.slice(first, first + PAGE_SIZE);

  const today = todayLabel();
  const stats = [
    { label: 'Total Patients', value: all.length, icon: 'users', tone: 'teal' },
    { label: 'New Admissions', value: all.filter((p) => p.records.length === 1).length, icon: 'user', tone: 'blue' },
    { label: 'Pending Reports', value: all.reduce((n, p) => n + p.records.filter((r) => r.diagnosis === 'N/A').length, 0), icon: 'file', tone: 'red' },
    { label: "Today's Appts", value: all.reduce((n, p) => n + p.records.filter((r) => r.date === today).length, 0), icon: 'calendar', tone: 'slate' },
  ];

  const cycle = (list, value, set) => set(list[(list.indexOf(value) + 1) % list.length]);

  const addPatient = () => {
    if (!form.name.trim()) return;
    const record = {
      id: `record-${Date.now()}`, sortKey: Date.now(), date: today, time: 'N/A', bp: 'N/A', pulse: 'N/A', temperature: 'N/A',
      problem: 'New patient registration', diagnosis: 'N/A', tablets: 'N/A', days: 'N/A',
      doctor: form.doctor.trim() || 'Doctor', prescription: 'N/A', followUp: 'N/A',
    };
    setLocalPatients((prev) => [{
      id: `local-${Date.now()}`,
      name: form.name.trim(),
      age: form.age || 'N/A',
      gender: form.gender || 'N/A',
      phone: form.phone.trim() || 'N/A',
      bloodGroup: form.bloodGroup || 'N/A',
      lastVisit: today,
      lastVisitKey: Date.now(),
      records: [record],
    }, ...prev]);
    setForm(emptyForm());
    setShowAdd(false);
  };

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#0D9488']} />}
      >
        <View style={s.headRow}>
          <View style={s.flex}>
            <Text style={s.title}>Patients Medical Records</Text>
            <Text style={s.subtitle}>Comprehensive patient history and visit details</Text>
          </View>
          <Pressable style={s.addBtnWrap} onPress={() => setShowAdd(true)}>
            <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addBtn}>
              <AppIcon name="plus" size={14} color="#FFF" strokeWidth={2.6} />
              <Text style={s.addBtnText}>Add</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={s.stats}>
          {stats.map((item) => (
            <View key={item.label} style={s.stat}>
              <View style={[s.statIcon, s[`tone_${item.tone}`]]}><AppIcon name={item.icon} size={15} color={TONE_FG[item.tone]} /></View>
              <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Patients Directory</Text>
        <View style={s.search}>
          <AppIcon name="search" size={16} color="#0D9488" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search patient by name or phone" placeholderTextColor="#94A3B8" style={s.searchInput} />
          {!!search && <Pressable onPress={() => setSearch('')} hitSlop={8}><AppIcon name="x" size={14} color="#98A2B3" /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          <FilterChip label="Gender" value={gender} active={gender !== 'All'} onPress={() => cycle(GENDERS, gender, setGender)} />
          <FilterChip label="Blood Group" value={bloodGroup} active={bloodGroup !== 'All'} onPress={() => cycle(bloodOptions, bloodGroup, setBloodGroup)} />
          <FilterChip label="Sort" value={sort} active={sort !== 'Newest First'} onPress={() => cycle(SORTS, sort, setSort)} />
        </ScrollView>

        {status === 'loading' ? (
          <View style={s.empty}><ActivityIndicator color="#0D9488" /><Text style={s.emptyText}>Loading patients...</Text></View>
        ) : status === 'failed' && !all.length ? (
          <View style={s.empty}><AppIcon name="file" size={30} color="#98A2B3" /><Text style={s.emptyText}>{error}</Text></View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}><AppIcon name="file" size={30} color="#98A2B3" /><Text style={s.emptyText}>No patients found for this doctor</Text></View>
        ) : (
          <>
            {pageRows.map((p) => (
              <Pressable key={p.id} onPress={() => onPatientPress?.(p)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
                <View style={s.cardTop}>
                  <View style={s.avatar}><Text style={s.avatarText}>{p.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={s.flex}>
                    <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.meta}>{p.age !== 'N/A' ? `${p.age} yrs` : 'Age N/A'} • {p.gender}</Text>
                  </View>
                  {p.bloodGroup !== 'N/A' && <Text style={s.blood}>{p.bloodGroup}</Text>}
                </View>
                <View style={s.contactRow}>
                  <AppIcon name="phone" size={13} color="#0D9488" />
                  <Text style={s.contactText}>{p.phone}</Text>
                </View>
                <View style={s.cardFooter}>
                  <Text style={s.lastVisit}>Last visit: {p.lastVisit}</Text>
                  <Text style={s.visits}>{p.records.length} {p.records.length === 1 ? 'Visit' : 'Visits'}</Text>
                </View>
              </Pressable>
            ))}
            <View style={s.pagination}>
              <Text style={s.pageInfo}>Showing {first + 1} to {Math.min(first + PAGE_SIZE, filtered.length)} of {filtered.length} patients</Text>
              <View style={s.pageBtns}>
                <Pressable disabled={safePage === 1} onPress={() => setPage(safePage - 1)} style={[s.pageBtn, safePage === 1 && s.disabled]}><Text style={s.pageBtnText}>‹</Text></Pressable>
                <Text style={s.pageNow}>{safePage} / {totalPages}</Text>
                <Pressable disabled={safePage === totalPages} onPress={() => setPage(safePage + 1)} style={[s.pageBtn, safePage === totalPages && s.disabled]}><Text style={s.pageBtnText}>›</Text></Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <View style={s.flex}>
                <Text style={s.modalTitle}>Add Patient</Text>
                <Text style={s.subtitle}>Create a patient profile for the doctor portal.</Text>
              </View>
              <Pressable onPress={() => setShowAdd(false)} hitSlop={8}><AppIcon name="x" size={18} color="#667085" /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={s.modalScroll}>
              <Field label="Patient Name *" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Robert Chen" />
              <Field label="Phone No" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+91 90000 00000" keyboardType="phone-pad" />
              <Field label="Age" value={form.age} onChangeText={(v) => setForm((f) => ({ ...f, age: v.replace(/\D/g, '') }))} placeholder="54" keyboardType="number-pad" />
              <Text style={s.fieldLabel}>Gender</Text>
              <View style={s.optionRow}>
                {['Male', 'Female', 'Other'].map((g) => (
                  <Pressable key={g} onPress={() => setForm((f) => ({ ...f, gender: g }))} style={[s.option, form.gender === g && s.optionActive]}>
                    <Text style={[s.optionText, form.gender === g && s.optionTextActive]}>{g}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.fieldLabel}>Blood Group</Text>
              <View style={s.optionRow}>
                {BLOOD_GROUPS.map((b) => (
                  <Pressable key={b} onPress={() => setForm((f) => ({ ...f, bloodGroup: f.bloodGroup === b ? '' : b }))} style={[s.option, form.bloodGroup === b && s.optionActive]}>
                    <Text style={[s.optionText, form.bloodGroup === b && s.optionTextActive]}>{b}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Doctor" value={form.doctor} onChangeText={(v) => setForm((f) => ({ ...f, doctor: v }))} placeholder="Dr. Sarah Jenkins" />
            </ScrollView>
            <View style={s.modalActions}>
              <Pressable style={s.cancelBtn} onPress={() => setShowAdd(false)}><Text style={s.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[s.saveWrap, !form.name.trim() && s.disabled]} onPress={addPatient} disabled={!form.name.trim()}>
                <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
                  <Text style={s.saveText}>Add Patient</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const TONE_FG = { teal: '#0D9488', blue: '#0369A1', red: '#DC2626', slate: '#475467' };

function FilterChip({ label, value, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}: {value}</Text>
      <AppIcon name="chevron-down" size={11} strokeWidth={2.4} color={active ? '#FFF' : '#243249'} />
    </Pressable>
  );
}

function Field({ label, ...inputProps }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor="#94A3B8" {...inputProps} />
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  content: { padding: 14, paddingBottom: 28 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#17243A' },
  subtitle: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  addBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 38, borderRadius: 12 },
  addBtnText: { fontSize: 13.5, fontWeight: '800', color: '#FFF' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stat: { width: '48.6%', backgroundColor: '#FFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E3EEEC' },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tone_teal: { backgroundColor: '#CCFBF1' },
  tone_blue: { backgroundColor: '#E0F2FE' },
  tone_red: { backgroundColor: '#FEE2E2' },
  tone_slate: { backgroundColor: '#EEF2F6' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#17243A', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#667085' },
  section: { fontSize: 16, fontWeight: '800', color: '#17243A', marginTop: 18, marginBottom: 10 },
  search: { height: 46, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CDE7E3', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  filters: { gap: 8, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#D5DAE3', backgroundColor: '#FFF', paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  chipText: { fontSize: 12.5, fontWeight: '700', color: '#243249' },
  chipTextActive: { color: '#FFF' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 13, color: '#667085', textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E3EEEC', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#0F766E' },
  name: { fontSize: 16, fontWeight: '800', color: '#17243A' },
  meta: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  blood: { fontSize: 12, fontWeight: '800', color: '#BE123C', backgroundColor: '#FFE4E6', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  contactText: { fontSize: 13, color: '#344054' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF3F2' },
  lastVisit: { fontSize: 12, color: '#667085' },
  visits: { fontSize: 12, fontWeight: '800', color: '#0F766E', backgroundColor: '#F0FDFA', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  pageInfo: { flex: 1, fontSize: 12, color: '#667085' },
  pageBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CDE7E3', alignItems: 'center', justifyContent: 'center' },
  pageBtnText: { fontSize: 18, fontWeight: '800', color: '#0D9488', marginTop: -2 },
  pageNow: { fontSize: 12.5, fontWeight: '700', color: '#344054' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: '90%' },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  modalScroll: { flexGrow: 0 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginTop: 10, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#17243A' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { paddingHorizontal: 13, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#D5DAE3', alignItems: 'center', justifyContent: 'center' },
  optionActive: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  optionText: { fontSize: 13, fontWeight: '700', color: '#475467' },
  optionTextActive: { color: '#FFF' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D5DAE3', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  saveWrap: { flex: 1.5 },
  saveBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
