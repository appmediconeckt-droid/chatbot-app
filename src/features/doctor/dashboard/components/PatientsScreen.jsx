// Ported from MediconecktApp's src/doctor/dashboard/components/PatientsScreen.tsx.
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';

const patients = [
  { name: 'Ramesh Kumar', age: '45 yrs', gender: 'Male', phone: '9876543210', visits: '2 Visit', image: 'https://i.pravatar.cc/120?img=12' },
  { name: 'Robert Chen', age: '54 yrs', gender: 'Male', phone: '+1 (555) 019-2834', visits: '2 Visit', image: 'https://i.pravatar.cc/120?img=11' },
  { name: 'Robert Chen', age: '54 yrs', gender: 'Male', phone: '+1 (555) 019-2834', visits: '2 Visit', image: 'https://i.pravatar.cc/120?img=13' },
];

export default function PatientsScreen({ onPatientPress }) {
  const [search, setSearch] = useState('');
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Patients</Text>
        <View style={styles.count}><Text style={styles.countText}>4</Text></View>
      </View>
      <View style={styles.search}>
        <AppIcon name="search" size={19} color="#778195" />
        <TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Search patient by name or phone number..." placeholderTextColor="#818A9C" />
      </View>
      <View style={styles.filters}>
        {['Gender', 'Blood Group', 'Age', 'Last Visit'].map((label) => (
          <Pressable style={styles.filter} key={label}>
            <Text style={styles.filterText}>{label}</Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.cards}>
        {patients.map((patient, index) => (
          <Pressable onPress={() => onPatientPress?.(patient)} style={styles.card} key={`${patient.name}-${index}`}>
            <View style={styles.patientRow}>
              <Image source={{ uri: patient.image }} style={styles.avatar} />
              <View style={styles.patientInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{patient.name}</Text>
                  <View style={styles.zeroBadge}><Text style={styles.zeroText}>0+</Text></View>
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
              <View style={styles.infoColumn}><Text style={styles.infoLabel}>Doctor</Text><Text style={styles.infoValue}>Dr. Sarah Jenkins</Text></View>
              <View style={styles.infoColumn}><Text style={styles.infoLabel}>Last Visit</Text><Text style={styles.infoValue}>Oct 12, 2023</Text></View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  content: { paddingHorizontal: 9, paddingTop: 17, paddingBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 27 },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '700', color: '#07BFBD' },
  count: { minWidth: 22, height: 20, borderRadius: 10, backgroundColor: '#07BFBD', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  search: { height: 38, borderWidth: 1, borderColor: '#BFC8D8', backgroundColor: '#F9FAFE', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 10 },
  searchInput: { flex: 1, fontSize: 13, color: '#17243A', paddingVertical: 0 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, marginBottom: 27 },
  filter: { height: 30, borderWidth: 1, borderColor: '#C8D1E0', borderRadius: 16, backgroundColor: '#FAFBFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { fontSize: 11, fontWeight: '600', color: '#243249' },
  chevron: { fontSize: 12, color: '#243249' },
  cards: { gap: 14 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 10, padding: 14, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  patientRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  patientInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#12213A' },
  zeroBadge: { height: 18, minWidth: 24, borderRadius: 5, backgroundColor: '#E5F0FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  zeroText: { fontSize: 9, fontWeight: '600', color: '#246E6B' },
  detail: { fontSize: 12, lineHeight: 17, color: '#526078', marginTop: 3 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  phone: { fontSize: 11, fontWeight: '600', color: '#26364D' },
  visitBadge: { backgroundColor: '#07BFBD', borderRadius: 11, paddingHorizontal: 8, paddingVertical: 4 },
  visitText: { fontSize: 9, fontWeight: '600', color: '#FFF' },
  visitInfo: { height: 50, borderWidth: 1, borderColor: '#D4DDEB', borderRadius: 6, backgroundColor: '#EEF3FF', marginTop: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  infoColumn: { flex: 1 },
  infoLabel: { fontSize: 10, color: '#7A8496', marginBottom: 2 },
  infoValue: { fontSize: 11, fontWeight: '700', color: '#223149' },
});
