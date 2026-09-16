// Ported from MediconecktApp's src/doctor/dashboard/components/AppointmentsListScreen.tsx.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';

const items = [
  { name: 'Marvin McKinney', time: '17:00 - 17:30', status: 'Scheduled', problem: 'Brain, Spinal Cord, and Nerve Disorders', clinician: 'Cristien (Technician)', address: '2972 Westheimer Rd. Santa Ana...', color: 'green' },
  { name: 'Dianne Russell', time: '18:15 - 19:00', status: 'Scheduled', problem: 'Upper Abdomen General - Test Code 2705', clinician: 'Kristin (Technician)', address: '4517 Washington Ave. Manchester...', color: 'green' },
  { name: 'Bessie Cooper', time: '17:45 - 18:00', status: 'Not confirmed', problem: 'Gynaecologic Disorders', clinician: 'Kristin (Technician)', address: '2715 Ash Dr. San Jose...', color: 'red' },
  { name: 'Annette Black', time: '12:00 - 12:30', status: 'Visited', problem: 'Digestive Disorders', clinician: 'Collen (Technician)', address: '2715 Ash Dr. San Jose...', color: 'gray' },
];

export default function AppointmentsListScreen({ onBack, onMenuPress }) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const visible = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.back}><Text style={s.backText}>‹</Text></Pressable>
        <Text style={s.title}>Appointments</Text>
        {onMenuPress && (
          <Pressable accessibilityLabel="Open navigation menu" onPress={onMenuPress} style={s.menuButton}>
            <AppIcon name="menu" size={21} color="#26364D" strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.datePicker}>
          <Text style={s.dateArrow}>‹</Text>
          <View style={s.dateCenter}>
            <AppIcon name="calendar" size={14} color="#07BFBD" />
            <Text style={s.dateText}>Jun 01, 2026</Text>
          </View>
          <Text style={s.dateArrow}>›</Text>
        </View>
        <View style={s.search}>
          <AppIcon name="search" size={15} color="#7C8798" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search Patient..." placeholderTextColor="#8A94A4" style={s.searchInput} />
        </View>
        <View style={s.filters}>
          {['✓ All', 'Life ×', 'Health ×', 'Helong-Te...'].map((label) => {
            const key = (label ?? '').replace('✓ ', '').replace(' ×', '');
            const active = filter === key;
            return (
              <Pressable key={label} onPress={() => setFilter(key)} style={[s.chip, active && s.chipActive]}>
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.summary}>
          <Text style={s.showing}>Showing: 10 Appointments</Text>
          <Pressable style={s.hide}>
            <View style={s.checkbox} />
            <Text style={s.hideText}>Hide visited</Text>
          </Pressable>
        </View>
        {visible.map((item, index) => (
          <AppointmentListCard key={item.name} item={item} last={index === visible.length - 1} />
        ))}
      </ScrollView>
    </View>
  );
}

function AppointmentListCard({ item, last }) {
  const statusStyle = item.color === 'green' ? s.green : item.color === 'red' ? s.red : s.gray;
  return (
    <View style={[s.card, item.color === 'red' && s.cardRed, last && s.cardBlue]}>
      <View style={s.cardTop}>
        <View>
          <Text style={[s.name, last && s.nameBlue]}>{item.name}</Text>
          <View style={s.timeRow}>
            <AppIcon name="clock" size={11} color="#526078" />
            <Text style={s.time}>{item.time}</Text>
          </View>
        </View>
        <View style={[s.status, statusStyle]}>
          <Text style={[s.statusText, statusStyle]}>
            {item.color === 'green' ? '▣ ' : item.color === 'red' ? '☒ ' : '✓ '}
            {item.status}
          </Text>
        </View>
      </View>
      <View style={s.problem}>
        <Text style={s.problemText}>{item.problem}</Text>
        <Text style={s.clinician}>♙ {item.clinician}</Text>
      </View>
      <View style={s.cardBottom}>
        <Text style={s.address}>{item.address}</Text>
        <Pressable style={s.iconButton}>
          <Text style={last ? s.editIcon : s.phoneIcon}>⌕</Text>
        </Pressable>
        <Pressable style={s.iconButton}>
          <Text style={last ? s.trash : s.more}>{last ? '♜' : '⋮'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { height: 54, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  menuButton: { marginLeft: 'auto' },
  back: { width: 30, height: 38, justifyContent: 'center' },
  backText: { fontSize: 28, lineHeight: 30, color: '#26364D' },
  title: { fontSize: 19, fontWeight: '700', color: '#07BFBD' },
  content: { padding: 8, paddingBottom: 24 },
  datePicker: { height: 43, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateText: { fontSize: 13, fontWeight: '700', color: '#25344A' },
  dateArrow: { fontSize: 18, color: '#526078' },
  search: { height: 40, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginTop: 10 },
  searchInput: { flex: 1, fontSize: 11, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  filters: { flexDirection: 'row', gap: 7, marginVertical: 10 },
  chip: { height: 34, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 17, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  chipActive: { backgroundColor: '#08F9ED', borderColor: '#08F9ED' },
  chipText: { fontSize: 10, color: '#526078' },
  chipTextActive: { color: '#FFF', fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  showing: { fontSize: 9, color: '#526078' },
  hide: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkbox: { width: 14, height: 14, borderWidth: 1, borderColor: '#AEB8C6', borderRadius: 3, backgroundColor: '#FFF' },
  hideText: { fontSize: 9, color: '#526078' },
  card: { minHeight: 160, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C7D0DF', borderRadius: 9, padding: 12, marginBottom: 8, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardRed: { borderLeftWidth: 3, borderLeftColor: '#F04438' },
  cardBlue: { borderColor: '#23ECFF', borderLeftWidth: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  nameBlue: { color: '#07BFBD' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  time: { fontSize: 9, color: '#526078' },
  status: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 4 },
  statusText: { fontSize: 8, fontWeight: '600' },
  green: { color: '#168A4A', borderColor: '#78D69D', backgroundColor: '#ECFAF1' },
  red: { color: '#D92D20', borderColor: '#FFB4AD', backgroundColor: '#FFF1F0' },
  gray: { color: '#667085', borderColor: '#C8D1DF', backgroundColor: '#F5F6F8' },
  problem: { backgroundColor: '#FAFAFD', borderWidth: 1, borderColor: '#D9DFE8', borderRadius: 6, padding: 9, marginTop: 10 },
  problemText: { fontSize: 10, color: '#26364D' },
  clinician: { fontSize: 9, color: '#526078', marginTop: 5 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  address: { flex: 1, fontSize: 8, color: '#667085' },
  iconButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#D9DFE8', alignItems: 'center', justifyContent: 'center', marginLeft: 7 },
  phoneIcon: { fontSize: 14, color: '#07BFBD' },
  more: { fontSize: 17, color: '#667085' },
  editIcon: { fontSize: 15, color: '#07BFBD' },
  trash: { fontSize: 13, color: '#D92D20' },
});
