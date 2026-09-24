// Ported from MediconecktApp's src/doctor/dashboard/components/PatientDetailScreen.tsx.
// Adaptation: ToastAndroid (Android-only) replaced with the app's cross-platform useToast.
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';

const TABS = ['Overview', 'Medical History', 'Visit Details'];

const ALLERGIES = [
  { name: 'Penicillin', severity: 'Severe', danger: true },
  { name: 'Peanuts', severity: 'Mild', danger: true },
  { name: 'Latex', severity: 'Suspected', danger: false },
];
const CONDITIONS = [
  { name: 'Hypertension', status: 'Managed', diagnosed: 'Oct 2019' },
  { name: 'Type 2 Diabetes', status: 'Monitoring', diagnosed: 'Mar 2021' },
];
const PROCEDURES = [
  { date: 'Nov 2021', title: 'Right Knee Arthroscopy', description: 'Meniscus repair. Dr. Sarah Jenkins at City General.' },
  { date: 'Aug 2015', title: 'Appendectomy', description: 'Uncomplicated laparoscopic removal. Dr. Robert Chen.' },
];
const VISITS = [
  { date: '2026-01-05', time: '10:30 AM', complaint: 'Fever & Cold', tone: 'amber', doctor: 'Dr. A. Sharma' },
  { date: '2026-01-08', time: '11:15 AM', complaint: 'Migraine Headache', tone: 'red', doctor: 'Dr. A. Sharma' },
];

export default function PatientDetailScreen({ patient, onBack, onVisitPress }) {
  const { showToast } = useToast();
  const notify = (text) => showToast(text);
  const [tab, setTab] = useState('Overview');

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Patient Details</Text>
        <Pressable onPress={() => notify('More options coming soon.')} style={s.moreButton} hitSlop={8}>
          <AppIcon name="more" size={19} color="#3C4759" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.profile}>
          <Image source={{ uri: patient.image }} style={s.avatar} />
          <Text style={s.name}>{patient.name}</Text>
          <Text style={s.meta}>{patient.age} • {patient.gender} • {patient.bloodGroup ?? 'O+'}</Text>
          <View style={s.quickActions}>
            <QuickAction icon="phone" label="Call" onPress={() => notify(`Calling ${patient.name}`)} />
            <QuickAction icon="message" label="Message" onPress={() => notify(`Opening chat with ${patient.name}`)} />
          </View>
        </View>

        <View style={s.tabs}>
          {TABS.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={s.tab}>
              <Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text>
              {tab === item && <View style={s.tabIndicator} />}
            </Pressable>
          ))}
        </View>

        {tab === 'Overview' && (
          <>
            <View style={s.vitalCard}>
              <View style={s.vitalIcon}><Text style={s.heart}>♥</Text></View>
              <View style={s.grow}>
                <Text style={s.vitalLabel}>Heart Rate</Text>
                <Text style={s.vitalValue}>72 <Text style={s.vitalUnit}>bpm</Text></Text>
              </View>
              <View style={s.checkedAt}>
                <Text style={s.checkedLabel}>Last checked</Text>
                <Text style={s.checkedValue}>Today, 09:30 AM</Text>
              </View>
            </View>

            <View style={s.two}>
              <View style={s.metricCard}>
                <AppIcon name="scale" size={18} color={colors.blue} strokeWidth={1.9} />
                <Text style={s.metricLabel}>Weight</Text>
                <Text style={s.metricValue}>75 kg</Text>
              </View>
              <View style={s.metricCard}>
                <AppIcon name="ruler" size={18} color={colors.blue} strokeWidth={1.9} />
                <Text style={s.metricLabel}>Height</Text>
                <Text style={s.metricValue}>178 cm</Text>
              </View>
            </View>

            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.eyebrow}>EMERGENCY CONTACT</Text>
                <Pressable onPress={() => notify('Edit emergency contact coming soon.')}><Text style={s.edit}>Edit</Text></Pressable>
              </View>
              <View style={s.contactRow}>
                <View style={s.contactIcon}><AppIcon name="user" size={18} color={colors.blue} /></View>
                <View style={s.grow}>
                  <Text style={s.contactName}>Priya Kumar</Text>
                  <Text style={s.contactSub}>Wife • +91 98765 43211</Text>
                </View>
                <Pressable onPress={() => notify('Calling Priya Kumar')} style={s.contactCall} hitSlop={8}>
                  <AppIcon name="phone" size={16} color={colors.blue} />
                </Pressable>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.eyebrow}>PRIMARY PHYSICIAN</Text>
              <View style={[s.contactRow, s.physicianRow]}>
                <View style={s.contactIcon}><AppIcon name="pulse" size={18} color={colors.blue} /></View>
                <View style={s.grow}>
                  <Text style={s.contactName}>Dr. Sarah Jenkins</Text>
                  <Text style={s.contactSub}>Cardiology</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {tab === 'Medical History' && (
          <>
            <View style={s.allergyCard}>
              <View style={s.sectionHeaderRow}>
                <AppIcon name="warning" size={19} color="#C0463F" strokeWidth={2} />
                <Text style={s.sectionTitle}>Allergies</Text>
              </View>
              <View style={s.allergyPills}>
                {ALLERGIES.map((allergy) => (
                  <View key={allergy.name} style={[s.allergyPill, !allergy.danger && s.allergyPillMuted]}>
                    <Text style={[s.allergyName, !allergy.danger && s.allergyNameMuted]}>{allergy.name}</Text>
                    <Text style={s.allergySeverity}> ({allergy.severity})</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <AppIcon name="pulse" size={18} color={colors.blue} strokeWidth={2} />
                <Text style={s.sectionTitle}>Active Conditions</Text>
              </View>
              {CONDITIONS.map((condition, index) => (
                <View key={condition.name} style={[s.conditionRow, index === CONDITIONS.length - 1 && s.conditionRowLast]}>
                  <View style={s.conditionTop}>
                    <Text style={s.conditionName}>{condition.name}</Text>
                    <View style={s.conditionBadge}><Text style={s.conditionBadgeText}>{condition.status}</Text></View>
                  </View>
                  <Text style={s.conditionDiagnosed}>Diagnosed: {condition.diagnosed}</Text>
                </View>
              ))}
            </View>

            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <AppIcon name="file" size={18} color={colors.blue} strokeWidth={2} />
                <Text style={s.sectionTitle}>Past Procedures</Text>
              </View>
              {PROCEDURES.map((procedure, index) => (
                <View key={procedure.title} style={s.timelineItem}>
                  <View style={s.timelineMarkerCol}>
                    <View style={[s.timelineDot, index === 0 && s.timelineDotActive]} />
                    {index < PROCEDURES.length - 1 && <View style={s.timelineLine} />}
                  </View>
                  <View style={s.timelineContent}>
                    <View style={s.datePill}><Text style={s.datePillText}>{procedure.date}</Text></View>
                    <Text style={s.procTitle}>{procedure.title}</Text>
                    <Text style={s.procDesc}>{procedure.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'Visit Details' && VISITS.map((visit) => (
          <View key={visit.date} style={s.visitCard}>
            <View style={s.visitTopRow}>
              <View style={s.visitMetaRow}>
                <AppIcon name="calendar" size={13} color="#667085" />
                <Text style={s.visitMetaText}>{visit.date}</Text>
              </View>
              <View style={[s.visitTag, visit.tone === 'red' && s.visitTagRed]}>
                <Text style={[s.visitTagText, visit.tone === 'red' && s.visitTagTextRed]}>{visit.complaint}</Text>
              </View>
            </View>
            <View style={s.visitMetaRow}>
              <AppIcon name="clock" size={13} color="#667085" />
              <Text style={s.visitMetaText}>{visit.time}</Text>
            </View>
            <View style={s.visitBottomRow}>
              <Text style={s.visitDoctor}>{visit.doctor}</Text>
              <Pressable onPress={onVisitPress} style={s.viewButtonWrap}>
                <View style={s.viewButton}>
                  <AppIcon name="eye" size={14} color="#FFFFFF" strokeWidth={2} />
                  <Text style={s.viewButtonText}>View Details</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={s.quickAction}>
      <View style={s.quickActionCircle}><AppIcon name={icon} size={19} color="#FFFFFF" /></View>
      <Text style={s.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#0D9488' },
  moreButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 13, paddingBottom: 30 },
  grow: { flex: 1 },
  profile: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 11, alignItems: 'center', paddingVertical: 21, paddingHorizontal: 16, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  avatar: { width: 78, height: 78, borderRadius: 39 },
  name: { fontSize: 21, fontWeight: '700', color: '#17243A', marginTop: 12 },
  meta: { fontSize: 14, color: '#667085', marginTop: 4 },
  quickActions: { flexDirection: 'row', gap: 28, marginTop: 16 },
  quickAction: { alignItems: 'center', gap: 5 },
  quickActionCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 12.5, fontWeight: '600', color: '#3C4759' },
  tabs: { flexDirection: 'row', marginTop: 16, borderBottomWidth: 1, borderBottomColor: '#DCE1E9' },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 10 },
  tabText: { fontSize: 13.5, fontWeight: '600', color: '#8A94A4' },
  tabTextActive: { color: colors.blue, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: -1, height: 2, width: '70%', backgroundColor: colors.blue, borderRadius: 1 },
  vitalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, padding: 13, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  vitalIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FDF1F1', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  heart: { fontSize: 18, color: '#C0463F' },
  vitalLabel: { fontSize: 13, color: '#667085' },
  vitalValue: { fontSize: 19, fontWeight: '700', color: '#17243A', marginTop: 2 },
  vitalUnit: { fontSize: 13, fontWeight: '500', color: '#667085' },
  checkedAt: { alignItems: 'flex-end' },
  checkedLabel: { fontSize: 11.5, color: '#8A94A4' },
  checkedValue: { fontSize: 13, fontWeight: '600', color: '#3C4759', marginTop: 2 },
  two: { flexDirection: 'row', gap: 12, marginTop: 12 },
  metricCard: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, padding: 13, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  metricLabel: { fontSize: 13, color: '#667085', marginTop: 8 },
  metricValue: { fontSize: 18, fontWeight: '700', color: '#17243A', marginTop: 2 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, padding: 13, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyebrow: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4, color: '#8A94A4', flex: 1 },
  edit: { fontSize: 13, fontWeight: '700', color: colors.blue },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  physicianRow: { marginTop: 9 },
  contactIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  contactSub: { fontSize: 13, color: '#667085', marginTop: 2 },
  contactCall: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#17243A' },
  allergyCard: { backgroundColor: '#FFFAFA', borderWidth: 1, borderColor: '#FBE4E4', borderRadius: 10, padding: 14, marginTop: 14 },
  allergyPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergyPill: { flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F8DADA' },
  allergyPillMuted: { backgroundColor: '#F1F2F5', borderColor: '#E2E4E9' },
  allergyName: { fontSize: 13, fontWeight: '700', color: '#C0463F' },
  allergyNameMuted: { color: '#4B5563' },
  allergySeverity: { fontSize: 13, color: '#8A94A4' },
  conditionRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  conditionRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  conditionTop: { flexDirection: 'row', alignItems: 'center' },
  conditionName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#17243A' },
  conditionBadge: { backgroundColor: colors.paleBlue, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 3 },
  conditionBadgeText: { fontSize: 11.5, fontWeight: '700', color: colors.blue },
  conditionDiagnosed: { fontSize: 13, color: '#667085', marginTop: 3 },
  timelineItem: { flexDirection: 'row' },
  timelineMarkerCol: { width: 20, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.blue, backgroundColor: '#FFF', marginTop: 4 },
  timelineDotActive: { backgroundColor: colors.blue },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#DCE1E9', marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: 16, paddingLeft: 10 },
  datePill: { alignSelf: 'flex-start', backgroundColor: colors.paleBlue, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2, marginBottom: 6 },
  datePillText: { fontSize: 11.5, fontWeight: '700', color: colors.blue },
  procTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  procDesc: { fontSize: 13, lineHeight: 18, color: '#667085', marginTop: 3 },
  visitCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, padding: 14, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  visitTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visitMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  visitMetaText: { fontSize: 13, color: '#526078' },
  visitTag: { backgroundColor: '#FFF5E5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  visitTagText: { fontSize: 12, fontWeight: '700', color: '#A65F00' },
  visitTagRed: { backgroundColor: '#FDF1F1' },
  visitTagTextRed: { color: '#C0463F' },
  visitBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  visitDoctor: { fontSize: 14, fontWeight: '700', color: colors.blue },
  viewButtonWrap: { borderRadius: 8, overflow: 'hidden' },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.navy, paddingHorizontal: 14, height: 36, borderRadius: 8 },
  viewButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
