// Ported from MediconecktApp's src/doctor/dashboard/components/FollowUpsScreen.tsx.
import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import NewFollowUpScreen from './NewFollowUpScreen';

const patients = [
  { initial: 'EK', name: 'Eleanor Vance', id: '64-F • ID: 88455', date: 'Oct 24, 09:00 AM', type: 'Hypertension Chk.', status: 'Scheduled', tone: 'blue' },
  { initial: 'MR', name: 'Marcus Reed', id: '42-M • ID: 92118', date: 'Overdue (2d)', type: 'Post-op Review', status: 'Pending', tone: 'amber' },
  { initial: 'CW', name: 'Chen Wei', id: '71-M • ID: 49328', date: 'TBD', type: 'Annual Physical', status: 'Completed', tone: 'green' },
  { initial: 'SJ', name: 'Sarah Jenkins', id: '38-F • ID: 77104', date: 'Oct 26, 11:30 AM', type: 'Lab Results', status: 'Scheduled', tone: 'blue' },
];

export default function FollowUpsScreen({ onBack, onMenuPress }) {
  const [filter, setFilter] = useState('All Patients');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (creating) setCreating(false);
      else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [creating, onBack]);
  if (creating) return <NewFollowUpScreen onBack={() => setCreating(false)} />;
  const visible = patients.filter((x) => x.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.title}>Follow Ups Management</Text>
        {onMenuPress && (
          <Pressable accessibilityLabel="Open navigation menu" onPress={onMenuPress} style={s.menuButton}>
            <AppIcon name="menu" size={21} color="#26364D" strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Overview</Text>
        <Text style={s.subheading}>Today's clinic activity summary.</Text>
        <View style={s.metrics}>
          <Metric icon="users" label="Total Patients" value="2,840" trend="↗ 12%" />
          <Metric icon="calendar" label="Due Today" value="18" />
          <Metric icon="calendar" label="Pending" value="142" red />
        </View>
        <View style={s.completed}>
          <View style={s.completeIcon}><Text style={s.completeCheck}>✓</Text></View>
          <View><Text style={s.completeLabel}>Completed</Text><Text style={s.completeValue}>1,205</Text></View>
          <Pressable style={s.report}><Text style={s.reportText}>View{`\n`}Report</Text></Pressable>
        </View>
        <Text style={s.section}>Upcoming Follow Ups</Text>
        <View style={s.search}>
          <AppIcon name="search" size={15} color="#7C8798" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search patients by name, ID" placeholderTextColor="#8A94A4" style={s.input} />
        </View>
        <View style={s.filters}>
          {['All Patients', 'Scheduled', 'Pending Review'].map((x) => (
            <Pressable key={x} onPress={() => setFilter(x)} style={[s.filter, filter === x && s.filterActive]}>
              <Text style={[s.filterText, filter === x && s.filterTextActive]}>{filter === x ? '✓ ' : ''}{x}</Text>
            </Pressable>
          ))}
        </View>
        {visible.map((patient) => <PatientCard key={patient.name} {...patient} />)}
      </ScrollView>
      <Pressable onPress={() => setCreating(true)} style={s.fab}><Text style={s.plus}>+</Text></Pressable>
    </View>
  );
}

function Metric({ icon, label, value, trend, red }) {
  return (
    <View style={s.metric}>
      <View style={[s.metricIcon, red && s.metricIconRed]}><AppIcon name={icon} size={15} color={red ? '#D92D20' : '#07BFBD'} /></View>
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
        <View style={s.patientInfo}><Text style={s.name}>{p.name}</Text><Text style={s.id}>{p.id}</Text></View>
        <Text style={s.more}>⋮</Text>
      </View>
      <View style={s.divider} />
      <View style={s.followRow}>
        <View style={s.followLeft}><Text style={s.meta}>▣ Next Follow-up</Text><Text style={s.meta}>▧ Reason</Text></View>
        <View style={s.followRight}><Text style={[s.date, amber && s.overdue]}>{p.date}</Text><Text style={s.type}>{p.type}</Text></View>
      </View>
      <View style={s.patientBottom}>
        <View style={[s.badge, amber && s.badgeAmber, green && s.badgeGreen]}>
          <Text style={[s.badgeText, amber && s.badgeTextAmber, green && s.badgeTextGreen]}>{green ? '✓ ' : amber ? '⚠ ' : ''}{p.status}</Text>
        </View>
        <Pressable><Text style={s.details}>View Details +</Text></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  back: { fontSize: 33, color: '#26364D', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#07BFBD' },
  menuButton: { marginLeft: 'auto' },
  content: { padding: 14, paddingBottom: 38 },
  heading: { fontSize: 20, fontWeight: '700', color: '#17243A' },
  subheading: { fontSize: 13, color: '#667085', marginTop: 3, marginBottom: 16 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, height: 128, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD4E1', borderRadius: 11, padding: 11 },
  metricIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#E9F1FF', alignItems: 'center', justifyContent: 'center' },
  metricIconRed: { backgroundColor: '#FFF0F0' },
  trend: { position: 'absolute', right: 7, top: 9, fontSize: 9, color: '#159A59', backgroundColor: '#DDF8E8', padding: 3, borderRadius: 7 },
  metricLabel: { fontSize: 11, color: '#667085', marginTop: 14 },
  metricValue: { fontSize: 25, fontWeight: '700', color: '#17243A', marginTop: 3 },
  completed: { height: 98, backgroundColor: '#08F9ED', borderRadius: 11, marginTop: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  completeIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  completeCheck: { fontSize: 23, fontWeight: '700', color: '#08F9ED' },
  completeLabel: { fontSize: 13, color: '#DDFFFF' },
  completeValue: { fontSize: 24, fontWeight: '700', color: '#FFF', marginTop: 2 },
  report: { marginLeft: 'auto', width: 78, height: 52, borderRadius: 7, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  reportText: { fontSize: 11, fontWeight: '700', textAlign: 'center', color: '#07BFBD' },
  section: { fontSize: 19, fontWeight: '700', color: '#17243A', marginTop: 24, marginBottom: 12 },
  search: { height: 49, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 9, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 13, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  filters: { flexDirection: 'row', gap: 8, marginVertical: 13 },
  filter: { height: 38, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 19, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  filterActive: { backgroundColor: '#07BFBD', borderColor: '#07BFBD' },
  filterText: { fontSize: 11, color: '#526078' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },
  patient: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD4E1', borderRadius: 11, padding: 14, marginBottom: 12 },
  patientTop: { flexDirection: 'row', alignItems: 'center' },
  initial: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#DFFCFF', alignItems: 'center', justifyContent: 'center' },
  initialAmber: { backgroundColor: '#FFF0C9' },
  initialGreen: { backgroundColor: '#E3E8EF' },
  initialText: { fontSize: 14, fontWeight: '700', color: '#526078' },
  patientInfo: { marginLeft: 12 },
  name: { fontSize: 17, fontWeight: '700', color: '#17243A' },
  id: { fontSize: 11, color: '#667085', marginTop: 4 },
  more: { marginLeft: 'auto', fontSize: 21, color: '#667085' },
  divider: { height: 1, backgroundColor: '#E2E7EE', marginVertical: 13 },
  followRow: { flexDirection: 'row' },
  followLeft: { gap: 8 },
  followRight: { marginLeft: 'auto', alignItems: 'flex-end', gap: 8 },
  meta: { fontSize: 11, color: '#667085' },
  date: { fontSize: 11, fontWeight: '600', color: '#344054' },
  overdue: { color: '#D92D20' },
  type: { fontSize: 11, color: '#344054' },
  patientBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  badge: { backgroundColor: '#EAF2FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  badgeAmber: { backgroundColor: '#FFF0F0' },
  badgeGreen: { backgroundColor: '#E8F8EF' },
  badgeText: { fontSize: 10, color: '#07BFBD' },
  badgeTextAmber: { color: '#D92D20' },
  badgeTextGreen: { color: '#168A4A' },
  details: { fontSize: 11, fontWeight: '700', color: '#07BFBD' },
  fab: { position: 'absolute', right: 14, bottom: 18, width: 48, height: 48, borderRadius: 24, backgroundColor: '#07BFBD', alignItems: 'center', justifyContent: 'center', elevation: 6 },
  plus: { fontSize: 28, color: '#FFF', lineHeight: 30 },
});
