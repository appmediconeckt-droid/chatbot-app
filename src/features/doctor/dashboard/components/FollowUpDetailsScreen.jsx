// Ported from MediconecktApp's src/doctor/dashboard/components/FollowUpDetailsScreen.tsx.
// Adaptation: ToastAndroid (Android-only) replaced with the app's cross-platform useToast.
import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';

export default function FollowUpDetailsScreen({ details, onBack, onReschedule }) {
  const { showToast } = useToast();
  const displayDate = details.date || '10/24/2026';
  const patient = details.patient || 'Eleanor Vance';
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.title}>Follow-Up Details</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.patientCard}>
          <Image source={{ uri: 'https://i.pravatar.cc/100?img=47' }} style={s.avatar} />
          <View><Text style={s.patient}>{patient}</Text><Text style={s.patientMeta}>64 F   ·   ID: #8493</Text></View>
        </View>
        <View style={s.badges}>
          <View style={s.scheduled}><Text style={s.scheduledText}>▣ Scheduled</Text></View>
          <View style={s.priority}><Text style={s.priorityText}>⚑ {details.priority === 'Routine' ? 'High' : details.priority} Priority</Text></View>
        </View>
        <View style={s.card}>
          <Text style={s.label}>APPOINTMENT TIME</Text>
          <View style={s.appointment}>
            <View style={s.dateBlock}><Text style={s.bigDate}>{formatDate(displayDate)}</Text><Text style={s.year}>2023</Text></View>
            <View style={s.vertical} />
            <View><Text style={s.bigTime}>{details.time || '09:00'}</Text><Text style={s.year}>AM</Text></View>
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.label}>CLINICAL CONTEXT</Text>
          <Context icon="phone" label="Reason" value={details.type || 'Hypertension Check'} />
          <Context icon="user" label="Assigned Doctor" value={details.provider || 'Dr. Smith'} />
          <Context icon="home" label="Location" value="Cardiology Dept, Room 302" />
        </View>
        <View style={s.card}>
          <Text style={s.label}>⚑  NOTES &amp; INSTRUCTIONS</Text>
          <Text style={s.notes}>{details.notes || 'Patient reported occasional dizziness. Monitor BP closely during visit. Standard stress test.'}</Text>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={() => showToast('Patient checked in')} style={s.checkin}><Text style={s.checkinText}>✓  Check-in Patient</Text></Pressable>
        <View style={s.bottomRow}>
          <Pressable onPress={onReschedule} style={s.secondary}><Text style={s.secondaryText}>Reschedule</Text></Pressable>
          <Pressable onPress={() => Alert.alert('Cancel follow-up', 'Are you sure you want to cancel this follow-up?')} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </View>
  );
}
function formatDate(value) {
  const parts = value.split('/');
  return parts.length > 1 ? `${monthName(parts[0])} ${Number(parts[1])}` : 'Oct 24';
}
function monthName(month) {
  return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month)] || 'Oct';
}
function Context({ icon, label, value }) {
  return (
    <View style={s.context}>
      <AppIcon name={icon} size={17} color="#667085" />
      <View><Text style={s.contextLabel}>{label}</Text><Text style={s.contextValue}>{value}</Text></View>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { height: 61, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  back: { fontSize: 33, lineHeight: 35, color: '#26364D', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#07BFBD' },
  content: { padding: 10, paddingBottom: 12 },
  patientCard: { height: 92, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C5CFDD', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  patient: { fontSize: 18, fontWeight: '700', color: '#17243A' },
  patientMeta: { fontSize: 11, color: '#667085', marginTop: 5 },
  badges: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  scheduled: { backgroundColor: '#EAF2FF', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  scheduledText: { fontSize: 10, color: '#344054' },
  priority: { backgroundColor: '#FFF0F0', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  priorityText: { fontSize: 10, color: '#D92D20' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C5CFDD', borderRadius: 8, padding: 16, marginBottom: 11 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: '#526078', marginBottom: 15 },
  appointment: { flexDirection: 'row', alignItems: 'center' },
  dateBlock: { width: '45%' },
  bigDate: { fontSize: 29, fontWeight: '700', color: '#07BFBD' },
  bigTime: { fontSize: 29, fontWeight: '700', color: '#17243A' },
  year: { fontSize: 12, color: '#667085', marginTop: 3 },
  vertical: { height: 55, width: 1, backgroundColor: '#D8DFE9', marginRight: 20 },
  context: { flexDirection: 'row', gap: 11, marginBottom: 16 },
  contextLabel: { fontSize: 11, color: '#667085' },
  contextValue: { fontSize: 12, fontWeight: '500', color: '#26364D', marginTop: 3 },
  notes: { fontSize: 12, lineHeight: 19, color: '#344054' },
  footer: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9', padding: 10 },
  checkin: { height: 48, backgroundColor: '#08F9ED', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checkinText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  secondary: { flex: 1, height: 43, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 13, color: '#344054' },
  cancel: { flex: 1, height: 43, borderWidth: 1, borderColor: '#F04438', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, color: '#D92D20' },
});
