// Ported from MediconecktApp's src/doctor/dashboard/components/PatientsScreen.tsx.
// Reworked: search and filter chips were purely decorative before (no
// onPress at all); they now actually filter/sort the list. Filters cycle on
// tap instead of opening a dropdown menu, so they stay compact in a single
// horizontally-scrolling row instead of wrapping onto a second line.
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';

const patients = [
  { name: 'Ramesh Kumar', age: '45 yrs', gender: 'Male', bloodGroup: 'B+', phone: '9876543210', visits: '2 Visit', lastVisit: '2023-10-12', doctor: 'Dr. Sarah Jenkins', image: 'https://i.pravatar.cc/120?img=12' },
  { name: 'Robert Chen', age: '54 yrs', gender: 'Male', bloodGroup: 'O+', phone: '+1 (555) 019-2834', visits: '3 Visit', lastVisit: '2023-11-02', doctor: 'Dr. Sarah Jenkins', image: 'https://i.pravatar.cc/120?img=11' },
  { name: 'Neha Iyer', age: '29 yrs', gender: 'Female', bloodGroup: 'A+', phone: '+91 90000 11223', visits: '1 Visit', lastVisit: '2023-09-18', doctor: 'Dr. Sarah Jenkins', image: 'https://i.pravatar.cc/120?img=45' },
];

const GENDERS = ['All', 'Male', 'Female'];
const BLOOD_GROUPS = ['All', ...Array.from(new Set(patients.map((p) => p.bloodGroup)))];

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const parseAge = (age) => parseInt(age, 10) || 0;

function CycleFilter({ label, value, isDefault, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, !isDefault && styles.filterActive]}>
      <Text style={[styles.filterText, !isDefault && styles.filterTextActive]}>{label}{value ? `: ${value}` : ''}</Text>
      <AppIcon name="chevron-down" size={11} strokeWidth={2.4} color={isDefault ? '#243249' : '#FFFFFF'} />
    </Pressable>
  );
}

function SortFilter({ label, direction, onPress }) {
  const active = direction !== null;
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
      <View style={direction === 'asc' && styles.flip}>
        <AppIcon name="chevron-down" size={11} strokeWidth={2.4} color={active ? '#FFFFFF' : '#243249'} />
      </View>
    </Pressable>
  );
}

export default function PatientsScreen({ onPatientPress }) {
  const [search, setSearch] = useState('');
  const [genderIndex, setGenderIndex] = useState(0);
  const [bloodIndex, setBloodIndex] = useState(0);
  const [ageSort, setAgeSort] = useState(null);
  const [visitSort, setVisitSort] = useState(null);

  const cycleAgeSort = () => setAgeSort((current) => (current === null ? 'asc' : current === 'asc' ? 'desc' : null));
  const cycleVisitSort = () => setVisitSort((current) => (current === null ? 'desc' : current === 'desc' ? 'asc' : null));

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = patients.filter((patient) => {
      const matchesGender = genderIndex === 0 || patient.gender === GENDERS[genderIndex];
      const matchesBlood = bloodIndex === 0 || patient.bloodGroup === BLOOD_GROUPS[bloodIndex];
      const matchesQuery = !query || patient.name.toLowerCase().includes(query) || patient.phone.toLowerCase().includes(query);
      return matchesGender && matchesBlood && matchesQuery;
    });
    if (ageSort) {
      list = [...list].sort((a, b) => (ageSort === 'asc' ? 1 : -1) * (parseAge(a.age) - parseAge(b.age)));
    }
    if (visitSort) {
      list = [...list].sort((a, b) => (visitSort === 'asc' ? 1 : -1) * (new Date(a.lastVisit) - new Date(b.lastVisit)));
    }
    return list;
  }, [search, genderIndex, bloodIndex, ageSort, visitSort]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Patients</Text>
        <View style={styles.count}><Text style={styles.countText}>{patients.length}</Text></View>
      </View>
      <View style={styles.search}>
        <AppIcon name="search" size={19} color="#778195" />
        <TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Search patient by name or phone number..." placeholderTextColor="#818A9C" />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}><AppIcon name="x" size={15} color="#8A94A4" /></Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <CycleFilter
          label="Gender"
          value={genderIndex === 0 ? '' : GENDERS[genderIndex]}
          isDefault={genderIndex === 0}
          onPress={() => setGenderIndex((current) => (current + 1) % GENDERS.length)}
        />
        <CycleFilter
          label="Blood"
          value={bloodIndex === 0 ? '' : BLOOD_GROUPS[bloodIndex]}
          isDefault={bloodIndex === 0}
          onPress={() => setBloodIndex((current) => (current + 1) % BLOOD_GROUPS.length)}
        />
        <SortFilter label="Age" direction={ageSort} onPress={cycleAgeSort} />
        <SortFilter label="Last Visit" direction={visitSort} onPress={cycleVisitSort} />
      </ScrollView>
      <View style={styles.cards}>
        {visible.map((patient, index) => (
          <Pressable onPress={() => onPatientPress?.(patient)} style={styles.card} key={`${patient.name}-${index}`}>
            <View style={styles.patientRow}>
              <Image source={{ uri: patient.image }} style={styles.avatar} />
              <View style={styles.patientInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{patient.name}</Text>
                  <View style={styles.bloodBadge}><Text style={styles.bloodText}>{patient.bloodGroup}</Text></View>
                </View>
                <Text style={styles.detail}>{patient.age}  •  {patient.gender}</Text>
                <View style={styles.phoneRow}>
                  <AppIcon name="phone" size={13} color="#293950" />
                  <Text style={styles.phone}>{patient.phone}</Text>
                </View>
              </View>
              <View style={styles.visitBadge}><Text style={styles.visitText}>{patient.visits}</Text></View>
            </View>
            <View style={styles.visitInfo}>
              <View style={styles.infoColumn}><Text style={styles.infoLabel}>Doctor</Text><Text style={styles.infoValue}>{patient.doctor}</Text></View>
              <View style={styles.infoColumn}><Text style={styles.infoLabel}>Last Visit</Text><Text style={styles.infoValue}>{formatDate(patient.lastVisit)}</Text></View>
            </View>
          </Pressable>
        ))}
        {visible.length === 0 && (
          <View style={styles.empty}><Text style={styles.emptyText}>No patients match your search.</Text></View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  content: { paddingHorizontal: 9, paddingTop: 17, paddingBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '700', color: '#0D9488' },
  count: { minWidth: 22, height: 20, borderRadius: 10, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  search: { height: 38, borderWidth: 1, borderColor: '#BFC8D8', backgroundColor: '#F9FAFE', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  filters: { gap: 8, marginTop: 10, marginBottom: 16, paddingRight: 4 },
  filter: { height: 30, borderWidth: 1, borderColor: '#C8D1E0', borderRadius: 16, backgroundColor: '#FAFBFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterActive: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#243249' },
  filterTextActive: { color: '#FFFFFF' },
  flip: { transform: [{ rotate: '180deg' }] },
  cards: { gap: 14 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 10, padding: 14, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  patientRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  patientInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontSize: 18, lineHeight: 23, fontWeight: '700', color: '#12213A' },
  bloodBadge: { height: 18, minWidth: 24, borderRadius: 5, backgroundColor: '#E5F0FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  bloodText: { fontSize: 12, fontWeight: '600', color: '#246E6B' },
  detail: { fontSize: 14, lineHeight: 19, color: '#526078', marginTop: 3 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  phone: { fontSize: 13, fontWeight: '600', color: '#26364D' },
  visitBadge: { backgroundColor: '#0D9488', borderRadius: 11, paddingHorizontal: 8, paddingVertical: 4 },
  visitText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  visitInfo: { height: 50, borderWidth: 1, borderColor: '#D4DDEB', borderRadius: 6, backgroundColor: '#EEF3FF', marginTop: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  infoColumn: { flex: 1 },
  infoLabel: { fontSize: 13, color: '#7A8496', marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#223149' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#8E9DB0' },
});
