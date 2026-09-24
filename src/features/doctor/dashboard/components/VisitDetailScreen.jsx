// Ported from MediconecktApp's src/doctor/dashboard/components/VisitDetailScreen.tsx.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';

export default function VisitDetailScreen({ patient, onBack, onDownload }) {
  return (
    <View style={s.screen}>
      <Pressable onPress={onBack} style={s.header} hitSlop={8}>
        <AppIcon name="chevron-left" size={16} color="#0D9488" strokeWidth={2.4} />
        <Text style={s.headerText}>Back to Visit History</Text>
      </Pressable>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.patient}>
          <View style={s.initial}><Text style={s.initialText}>{patient.name[0]}</Text></View>
          <View>
            <Text style={s.name}>{patient.name}</Text>
            <Text style={s.id}>Patient ID: #MK-2894</Text>
          </View>
        </View>
        <View style={s.card}>
          <View style={s.top}>
            <View>
              <Text style={s.label}>DATE & TIME</Text>
              <Meta icon="calendar" text="2026-01-08" />
              <Meta icon="clock" text="11:15 AM" />
            </View>
            <View style={s.doctor}>
              <Text style={s.label}>DOCTOR</Text>
              <Text style={s.doctorName}>Dr. A. Sharma</Text>
            </View>
          </View>
          <View style={s.rule} />
          <Row label="Primary Problem"><Chip text="Migraine Headache" red /></Row>
          <Row label="Follow-up"><Chip text="2026-01-12" /></Row>
        </View>
        <View style={s.card}>
          <Title icon="file" text="Clinical Notes" />
          <Text style={s.notes}>Patient reports severe throbbing pain on the right side of the head, accompanied by nausea and sensitivity to light. Symptoms started 48 hours ago. No visual aura reported. Previous episodes treated effectively with Sumatriptan.</Text>
        </View>
        <View style={s.card}>
          <Title icon="folder" text="Prescribed Actions" />
          <Action icon="pill" title="Sumatriptan 50mg" text="Take 1 tablet at onset of headache. Max 2 doses per 24 hours." />
          <Action icon="bed" title="Rest & Hydration" text="Rest in a dark, quiet room. Maintain fluid intake." />
        </View>
        <Pressable style={s.downloadWrap} onPress={onDownload}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
            <Text style={s.downloadText}>⇩  Download Prescription</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}
function Meta({ icon, text }) {
  return <View style={s.meta}><AppIcon name={icon} size={14} color="#385273" /><Text style={s.metaText}>{text}</Text></View>;
}
function Row({ label, children }) {
  return <View style={s.row}><Text style={s.rowLabel}>{label}</Text>{children}</View>;
}
function Chip({ text, red }) {
  return <View style={[s.chip, red && s.redChip]}><Text style={[s.chipText, red && s.redText]}>{text}</Text></View>;
}
function Title({ icon, text }) {
  return (
    <>
      <View style={s.titleRow}><AppIcon name={icon} size={18} color="#385273" strokeWidth={2} /><Text style={s.title}>{text}</Text></View>
      <View style={s.rule} />
    </>
  );
}
function Action({ icon, title, text }) {
  return (
    <View style={s.action}>
      <View style={s.actionIcon}><AppIcon name={icon} size={17} color="#0D9488" strokeWidth={2} /></View>
      <View style={s.grow}>
        <Text style={s.actionTitle}>{title}</Text>
        <Text style={s.actionText}>{text}</Text>
      </View>
    </View>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 15, paddingTop: 15, paddingBottom: 6 },
  headerText: { fontSize: 14, fontWeight: '600', color: '#0D9488' },
  content: { padding: 15, paddingTop: 6, paddingBottom: 28 },
  patient: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  initial: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', marginRight: 12, shadowColor: '#0D9488', shadowOpacity: 0.18, shadowRadius: 5, elevation: 2 },
  initialText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  name: { fontSize: 21, lineHeight: 27, fontWeight: '700', color: '#17243A' },
  id: { fontSize: 14, lineHeight: 19, color: '#667085', marginTop: 1 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCD5E2', borderRadius: 10, padding: 14, marginBottom: 16, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '700', letterSpacing: 0.3, color: '#526078' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  metaText: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: '#344054' },
  doctor: { alignItems: 'flex-end' },
  doctorName: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#0D9488', marginTop: 10 },
  rule: { height: 1, backgroundColor: '#E0E5EC', marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  rowLabel: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: '#667085' },
  chip: { backgroundColor: '#DFF5F3', borderWidth: 1, borderColor: '#B9E7E2', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#13756E' },
  redChip: { backgroundColor: '#FDF1F1', borderColor: '#F5DADA' },
  redText: { color: '#C0463F' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: '#25344A' },
  notes: { fontSize: 14, lineHeight: 21, color: '#536174' },
  action: { minHeight: 76, backgroundColor: '#F6F8FB', borderWidth: 1, borderColor: '#DCE2EA', borderRadius: 8, padding: 12, flexDirection: 'row', marginBottom: 11 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D8FEFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  grow: { flex: 1 },
  actionTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#273449' },
  actionText: { fontSize: 13, lineHeight: 18, color: '#667085', marginTop: 3 },
  downloadWrap: { marginHorizontal: 4, marginTop: 2, borderRadius: 8, shadowColor: '#0D9488', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  download: { height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  downloadText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
