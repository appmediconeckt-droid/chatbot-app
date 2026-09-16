// Ported from MediconecktApp's src/doctor/dashboard/components/PatientDetailScreen.tsx.
// Adaptation: ToastAndroid (Android-only) replaced with the app's cross-platform useToast.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';

export default function PatientDetailScreen({ patient, onBack, onVisitPress }) {
  const { showToast } = useToast();
  const notify = (text) => showToast(text);
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.title}>Patient Profile</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.profile}>
          <View style={s.avatarWrap}>
            <Image source={{ uri: patient.image }} style={s.avatar} />
            <View style={s.camera}><Text style={s.cameraText}>◉</Text></View>
          </View>
          <Text style={s.name}>{patient.name}</Text>
          <View style={s.metaRow}>
            <Text style={s.meta}>{patient.age} · {patient.gender} ·</Text>
            <View style={s.blood}><Text style={s.bloodText}>O+</Text></View>
          </View>
          <View style={s.actions}>
            <Action icon="video" label="Call" onPress={() => notify('Calling patient')} />
            <Action icon="message" label="Rx" onPress={() => notify('Prescription opened')} />
            <Action icon="calendar" label="Appt" onPress={() => notify('Appointment opened')} />
            <Action icon="user" label="Note" onPress={() => notify('Clinical note opened')} />
          </View>
        </View>
        <View style={s.diagnosis}>
          <View style={s.diagnosisIcon}><Text style={s.heart}>♥</Text></View>
          <View style={s.grow}>
            <Text style={s.diagnosisLabel}>CURRENT PRIMARY DIAGNOSIS</Text>
            <Text style={s.diagnosisTitle}>Hypertension (Stage 2)</Text>
            <Text style={s.diagnosisText}>Diagnosed Oct 2022. Monitored bi-weekly.</Text>
          </View>
        </View>
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>▣ Medications</Text>
            <Pressable><Text style={s.edit}>Edit</Text></Pressable>
          </View>
          <Medication name="Lisinopril" dose="20 mg  ·  1x Daily (Morning)" />
          <Medication name="Amlodipine" dose="5mg  ·  1x Daily (Evening)" />
        </View>
        <View style={s.two}>
          <Summary icon="♧" title="Labs" line1="Lipid Panel · Nov" line2="12" badge="2 New" />
          <Summary icon="▣" title="Visits" line1="Follow-up · Oct 28" line2="" footer="View All" onPress={onVisitPress} />
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>◷ Appt History</Text>
          <View style={s.history}>
            <DateBox month="OCT" day="28" />
            <View><Text style={s.historyTitle}>Routine Checkup</Text><Text style={s.historySub}>In-Person · Dr. Morrow</Text></View>
          </View>
          <View style={s.history}>
            <DateBox month="SEP" day="15" />
            <View><Text style={s.historyTitle}>BP Monitoring</Text><Text style={s.historySub}>Telehealth · NP. Davis</Text></View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
function Action({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={s.action}>
      <View style={s.actionIcon}><AppIcon name={icon} size={19} color="#07BFBD" /></View>
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}
function Medication({ name, dose }) {
  return (
    <View style={s.medication}>
      <View><Text style={s.medName}>{name}</Text><Text style={s.medDose}>{dose}</Text></View>
      <Text style={s.link}>⌕</Text>
    </View>
  );
}
function Summary({ icon, title, line1, line2, badge, footer = 'View All', onPress }) {
  return (
    <Pressable onPress={onPress} style={s.summary}>
      <View style={s.summaryIcon}><Text style={s.summaryIconText}>{icon}</Text></View>
      <Text style={s.summaryTitle}>{title}</Text>
      <Text style={s.summaryLine}>{line1}</Text>
      <Text style={s.summaryLine}>{line2}</Text>
      <View style={s.summaryBottom}>
        {badge && <View style={s.newBadge}><Text style={s.newText}>{badge}</Text></View>}
        <Text style={s.view}>{footer} ›</Text>
      </View>
    </Pressable>
  );
}
function DateBox({ month, day }) {
  return <View style={s.dateBox}><Text style={s.month}>{month}</Text><Text style={s.day}>{day}</Text></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FC' },
  header: { height: 61, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  back: { fontSize: 33, lineHeight: 35, color: '#26364D', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#07BFBD' },
  content: { padding: 13, paddingBottom: 30 },
  profile: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 11, alignItems: 'center', paddingTop: 21, overflow: 'hidden', shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 78, height: 78, borderRadius: 39 },
  camera: { position: 'absolute', right: 0, bottom: 1, width: 21, height: 21, borderRadius: 11, backgroundColor: '#07BFBD', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  cameraText: { fontSize: 9, color: '#FFF' },
  name: { fontSize: 21, fontWeight: '700', color: '#17243A', marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  meta: { fontSize: 12, color: '#667085' },
  blood: { backgroundColor: '#FFE5E5', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginLeft: 5 },
  bloodText: { fontSize: 9, fontWeight: '700', color: '#D92D20' },
  actions: { height: 64, backgroundColor: '#F0F4FF', flexDirection: 'row', width: '100%', marginTop: 18 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { height: 27, justifyContent: 'center' },
  actionText: { fontSize: 10, fontWeight: '600', color: '#07BFBD', marginTop: 2 },
  diagnosis: { backgroundColor: '#FFD8D5', borderRadius: 10, padding: 14, marginTop: 14, flexDirection: 'row' },
  diagnosisIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  heart: { fontSize: 20, color: '#E93636' },
  grow: { flex: 1 },
  diagnosisLabel: { fontSize: 9, fontWeight: '700', color: '#C92E2E' },
  diagnosisTitle: { fontSize: 16, fontWeight: '700', color: '#D92D20', marginTop: 3 },
  diagnosisText: { fontSize: 10, lineHeight: 15, color: '#B93838', marginTop: 3 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, padding: 13, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#26364D' },
  edit: { fontSize: 10, fontWeight: '700', color: '#07BFBD', marginLeft: 'auto' },
  medication: { height: 57, backgroundColor: '#EEF2FF', borderRadius: 7, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  medName: { fontSize: 12, fontWeight: '600', color: '#26364D' },
  medDose: { fontSize: 9, color: '#526078', marginTop: 4 },
  link: { fontSize: 19, color: '#526078', marginLeft: 'auto' },
  two: { flexDirection: 'row', gap: 12, marginTop: 14 },
  summary: { flex: 1, minHeight: 162, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, padding: 13 },
  summaryIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFBFF', alignItems: 'center', justifyContent: 'center' },
  summaryIconText: { fontSize: 18, color: '#07BFBD' },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#26364D', marginTop: 12 },
  summaryLine: { fontSize: 10, color: '#526078', marginTop: 5 },
  summaryBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto' },
  newBadge: { backgroundColor: '#E9F1FF', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  newText: { fontSize: 8, color: '#07BFBD' },
  view: { fontSize: 9, color: '#526078', marginLeft: 'auto' },
  history: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E5EAF0' },
  dateBox: { width: 42, height: 44, borderRadius: 6, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  month: { fontSize: 8, color: '#667085' },
  day: { fontSize: 16, fontWeight: '700', color: '#526078' },
  historyTitle: { fontSize: 12, fontWeight: '600', color: '#26364D' },
  historySub: { fontSize: 9, color: '#667085', marginTop: 4 },
});
