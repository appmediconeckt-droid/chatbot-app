// Patients — port of the web "Patients Medical Records" directory
// (PatientAppointmentDetails/PatientDetailsPage.jsx). Patients + visits come
// from GET /api/appointments?doctor_id (api/doctorPatients). Same stats,
// search, sort and 10-per-page pagination as the web. Doctors don't add
// patients here — patients come from their appointments.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import { loadDoctorPatients } from '../api/doctorPatients';

const PAGE_SIZE = 10;
const GENDERS = ['All', 'Male', 'Female', 'Other'];
const SORTS = ['Newest First', 'Oldest First', 'Name A-Z'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Patient data comes from free-form appointment fields, so gender and blood
// group arrive as "M" / "male" / "Female", "O Positive" / "b+ve" / "AB -".
// Normalise both sides before comparing so the filters actually match.
const normalizeGender = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'n/a') return '';
  if (v === 'm' || v === 'male' || v === 'man') return 'Male';
  if (v === 'f' || v === 'female' || v === 'woman') return 'Female';
  return 'Other';
};

const normalizeBloodGroup = (value) => {
  const v = String(value || '').toUpperCase().replace(/[\s()]/g, '')
    .replace(/(POSITIVE|POS|\+VE)$/, '+')
    .replace(/(NEGATIVE|NEG|-VE)$/, '-');
  return BLOOD_GROUPS.includes(v) ? v : '';
};

// Floating filter menu geometry.
const MENU_ROW_HEIGHT = 42;
const MENU_MAX_HEIGHT = 5.5 * MENU_ROW_HEIGHT; // half a row peeks out, hinting that it scrolls
const CHIP_BORDER = 1.5;
const SCREEN_GUTTER = 12;

const todayLabel = () => new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PatientsScreen({ onPatientPress }) {
  const [patients, setPatients] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('All');
  const [bloodGroup, setBloodGroup] = useState('All');
  const [sort, setSort] = useState('Newest First');
  // The filter dropdown is drawn inside this screen's root view (not a Modal):
  // a Modal is a separate Android window, and with edge-to-edge on its
  // coordinates don't line up with the chip's, so the menu landed off-screen.
  // Measuring the chip relative to the root keeps everything in one space.
  // menuAnchor = { key, x, y, width, height } of the chip whose menu is open.
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [rootSize, setRootSize] = useState({ width: 0, height: 0 });
  const rootRef = useRef(null);
  const chipRefs = useRef({});
  const [page, setPage] = useState(1);

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

  const all = patients;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Phone numbers are stored with spaces / +91 / dashes, so compare digits only.
    const termDigits = term.replace(/\D/g, '');
    const rows = all.filter((p) => {
      if (term) {
        const nameHit = String(p.name || '').toLowerCase().includes(term);
        const phoneHit = termDigits.length >= 3 && String(p.phone || '').replace(/\D/g, '').includes(termDigits);
        if (!nameHit && !phoneHit) return false;
      }
      if (gender !== 'All' && normalizeGender(p.gender) !== gender) return false;
      if (bloodGroup !== 'All' && normalizeBloodGroup(p.bloodGroup) !== bloodGroup) return false;
      return true;
    });
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
    { label: "Today's Appointments", value: all.reduce((n, p) => n + p.records.filter((r) => r.date === today).length, 0), icon: 'calendar', tone: 'slate' },
  ];

  const filterConfig = {
    gender: { label: 'Gender', value: gender, options: GENDERS, onSelect: setGender },
    blood: { label: 'Blood Group', value: bloodGroup, options: ['All', ...BLOOD_GROUPS], onSelect: setBloodGroup },
    sort: { label: 'Sort By', value: sort, options: SORTS, onSelect: setSort },
  };
  const openConfig = menuAnchor ? filterConfig[menuAnchor.key] : null;

  const closeMenu = () => setMenuAnchor(null);

  // Measure the tapped chip relative to the screen root so the menu can
  // float directly under it.
  const toggleMenu = (key) => {
    if (menuAnchor?.key === key) {
      closeMenu();
      return;
    }
    const node = chipRefs.current[key];
    if (!node || !rootRef.current) return;
    node.measureLayout(
      rootRef.current,
      (x, y, width, height) => setMenuAnchor({ key, x, y, width, height }),
      () => closeMenu(),
    );
  };

  // Android back closes an open dropdown before leaving the screen.
  useDoctorBack(() => {
    if (!menuAnchor) return false;
    setMenuAnchor(null);
    return true;
  });

  // A select-style list attached to the chip: same width, same left edge,
  // joined border. Opens below; flips above when it would run off-screen.
  const menuLayout = (() => {
    if (!menuAnchor || !openConfig || !rootSize.width) return null;
    const height = Math.min(openConfig.options.length * MENU_ROW_HEIGHT + CHIP_BORDER, MENU_MAX_HEIGHT);
    const below = menuAnchor.y + menuAnchor.height - CHIP_BORDER;
    const direction = below + height <= rootSize.height - SCREEN_GUTTER ? 'down' : 'up';
    const top = direction === 'down' ? below : Math.max(menuAnchor.y - height + CHIP_BORDER, SCREEN_GUTTER);
    return { direction, style: { top, left: menuAnchor.x, width: menuAnchor.width, maxHeight: height } };
  })();
  const hasFilters = Boolean(search.trim()) || gender !== 'All' || bloodGroup !== 'All';

  const clearFilters = () => {
    setSearch('');
    setGender('All');
    setBloodGroup('All');
    closeMenu();
  };

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={s.screen}
      onLayout={(e) => setRootSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
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
        </View>

        <View style={s.stats}>
          {stats.map((item) => (
            <View key={item.label} style={s.stat}>
              <View style={[s.statIcon, s[`tone_${item.tone}`]]}><AppIcon name={item.icon} size={14} color={TONE_FG[item.tone]} /></View>
              <View style={s.statBody}>
                <Text translate={false} style={s.statValue}>{item.value}</Text>
                <Text style={s.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.section}>Patients Directory</Text>
        <View style={s.search}>
          <AppIcon name="search" size={16} color="#0D9488" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search patient by name or phone" placeholderTextColor="#94A3B8" style={s.searchInput} />
          {!!search && <Pressable onPress={() => setSearch('')} hitSlop={8}><AppIcon name="x" size={14} color="#98A2B3" /></Pressable>}
        </View>
        <View style={s.filters}>
          {Object.entries(filterConfig).map(([key, config]) => (
            <FilterChip
              key={key}
              chipRef={(node) => { chipRefs.current[key] = node; }}
              label={config.label}
              value={config.value}
              active={key === 'sort' ? config.value !== 'Newest First' : config.value !== 'All'}
              openDirection={menuAnchor?.key === key ? menuLayout?.direction || 'down' : null}
              onPress={() => toggleMenu(key)}
            />
          ))}
        </View>
        {hasFilters && (
          <View style={s.resultRow}>
            <Text style={s.resultText}>{filtered.length} {filtered.length === 1 ? 'patient' : 'patients'} found</Text>
            <Pressable onPress={clearFilters} hitSlop={8}><Text style={s.clearText}>Clear filters</Text></Pressable>
          </View>
        )}

        {status === 'loading' ? (
          <View style={s.empty}><ActivityIndicator color="#0D9488" /><Text style={s.emptyText}>Loading patients...</Text></View>
        ) : status === 'failed' && !all.length ? (
          <View style={s.empty}><AppIcon name="file" size={30} color="#98A2B3" /><Text style={s.emptyText}>{error}</Text></View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <AppIcon name="file" size={30} color="#98A2B3" />
            <Text translate={false} style={s.emptyText}>{hasFilters ? 'No patients match your search or filters' : 'No patients found for this doctor'}</Text>
            {hasFilters && <Pressable onPress={clearFilters} hitSlop={8}><Text style={s.clearText}>Clear filters</Text></Pressable>}
          </View>
        ) : (
          <>
            {pageRows.map((p) => (
              <Pressable key={p.id} onPress={() => onPatientPress?.(p)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
                <View style={s.cardTop}>
                  <View style={s.avatar}><Text translate={false} style={s.avatarText}>{p.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={s.flex}>
                    <Text translate={false} style={s.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.meta}>{p.age !== 'N/A' ? `${p.age} yrs` : 'Age N/A'} • {p.gender}</Text>
                  </View>
                  {p.bloodGroup !== 'N/A' && <Text translate={false} style={s.blood}>{p.bloodGroup}</Text>}
                </View>
                <View style={s.contactRow}>
                  <AppIcon name="phone" size={13} color="#0D9488" />
                  <Text translate={false} style={s.contactText}>{p.phone}</Text>
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

      {menuLayout && (
        <>
          <Pressable style={s.menuBackdrop} onPress={closeMenu} />
          <View style={[s.menu, menuLayout.direction === 'down' ? s.menuDown : s.menuUp, menuLayout.style]}>
            <ScrollView bounces={false} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {openConfig.options.map((option, index) => {
                const selected = openConfig.value === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => { openConfig.onSelect(option); closeMenu(); }}
                    style={({ pressed }) => [
                      s.menuRow,
                      index > 0 && s.menuRowDivider,
                      selected && s.menuRowSelected,
                      pressed && s.menuRowPressed,
                    ]}
                  >
                    <Text style={[s.menuRowText, selected && s.menuRowTextSelected]} numberOfLines={1}>{option}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

    </View>
  );
}

const TONE_FG = { teal: '#0D9488', blue: '#0369A1', red: '#DC2626', slate: '#475467' };

function FilterChip({ chipRef, label, value, active, openDirection, onPress }) {
  const open = Boolean(openDirection);
  return (
    <Pressable
      ref={chipRef}
      collapsable={false}
      onPress={onPress}
      style={[
        s.chip,
        active && s.chipActive,
        open && s.chipOpen,
        openDirection === 'down' && s.chipOpenDown,
        openDirection === 'up' && s.chipOpenUp,
      ]}
    >
      <View style={s.flex}>
        <Text style={[s.chipLabel, active && s.chipLabelActive]} numberOfLines={1}>{label}</Text>
        <Text translate={false} style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>{value}</Text>
      </View>
      <View style={open && s.chevronOpen}>
        <AppIcon name="chevron-down" size={12} strokeWidth={2.4} color={active ? '#FFF' : '#243249'} />
      </View>
    </Pressable>
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stat: { width: '48.6%', flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E3EEEC' },
  statIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1, minWidth: 0 },
  tone_teal: { backgroundColor: '#CCFBF1' },
  tone_blue: { backgroundColor: '#E0F2FE' },
  tone_red: { backgroundColor: '#FEE2E2' },
  tone_slate: { backgroundColor: '#EEF2F6' },
  statValue: { fontSize: 17, fontWeight: '800', color: '#17243A', lineHeight: 21 },
  statLabel: { fontSize: 11, color: '#667085' },
  section: { fontSize: 16, fontWeight: '800', color: '#17243A', marginTop: 18, marginBottom: 10 },
  search: { height: 46, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CDE7E3', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  filters: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingBottom: 4 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D5DAE3', backgroundColor: '#FFF', paddingHorizontal: 10 },
  chipActive: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  chipOpen: { borderColor: '#0D9488', borderWidth: CHIP_BORDER },
  // Square off the edge the list attaches to so chip + list read as one control.
  chipOpenDown: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  chipOpenUp: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  chipLabel: { fontSize: 10.5, fontWeight: '700', color: '#667085', textTransform: 'uppercase', letterSpacing: 0.3 },
  chipLabelActive: { color: 'rgba(255,255,255,0.8)' },
  chipText: { fontSize: 13, fontWeight: '800', color: '#243249', marginTop: 1 },
  chipTextActive: { color: '#FFF' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  menuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20 },
  menu: { position: 'absolute', zIndex: 21, backgroundColor: '#FFF', borderWidth: CHIP_BORDER, borderColor: '#0D9488', overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 21 },
  menuDown: { borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  menuUp: { borderBottomWidth: 0, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  menuRow: { height: MENU_ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 10 },
  menuRowDivider: { borderTopWidth: 1, borderTopColor: '#EEF1F5' },
  menuRowSelected: { backgroundColor: '#E6FAF6' },
  menuRowPressed: { backgroundColor: '#F2F4F7' },
  menuRowText: { fontSize: 13.5, fontWeight: '500', color: '#344054' },
  menuRowTextSelected: { fontWeight: '800', color: '#0F766E' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 2, paddingHorizontal: 2 },
  resultText: { fontSize: 12.5, fontWeight: '600', color: '#526078' },
  clearText: { fontSize: 13, fontWeight: '800', color: '#0D9488' },
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
});
