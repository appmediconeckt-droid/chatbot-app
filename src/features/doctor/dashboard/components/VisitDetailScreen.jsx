// Visit details — port of the web Patient Details "Visit Details" view
// (PatientAppointmentDetails/PatientDetailsPage.jsx): patient banner, Visit
// Information, Vital Signs, Medical Information, Prescription + Doctor's
// Instructions, and Download Prescription (PDF with the web's sections).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { downloadVisitPrescriptionPdf } from '../utils/prescriptionPdf';

export default function VisitDetailScreen({ patient, record, onBack }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadVisitPrescriptionPdf(patient, record);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Visit Details</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.banner}>
          <View style={s.avatar}><Text style={s.avatarText}>{patient.name.charAt(0).toUpperCase()}</Text></View>
          <View style={s.flex}>
            <Text style={s.name}>{patient.name}</Text>
            <Text style={s.meta}>
              {[patient.age !== 'N/A' ? `${patient.age} yrs` : null, patient.gender, patient.bloodGroup, patient.phone].filter(Boolean).join(' • ')}
            </Text>
          </View>
        </View>

        <Card title="Visit Information" icon="calendar">
          <Row label="Date" value={record.date} />
          <Row label="Time" value={record.time} />
          <Row label="Consulting Doctor" value={record.doctor} highlight />
          <Row label="Follow-up Date" value={record.followUp} warn={record.followUp !== 'Not required'} last />
        </Card>

        <Card title="Vital Signs" icon="pulse">
          <View style={s.vitals}>
            <Vital label="Blood Pressure" value={`${record.bp}${record.bp !== 'N/A' ? ' mmHg' : ''}`} icon="❤" tone="rose" />
            <Vital label="Pulse Rate" value={`${record.pulse}${record.pulse !== 'N/A' ? ' bpm' : ''}`} icon="〰" tone="teal" />
            <Vital label="Temperature" value={String(record.temperature)} icon="🌡" tone="amber" />
          </View>
        </Card>

        <Card title="Medical Information" icon="note">
          <Text style={s.label}>Presenting Problem</Text>
          <Text style={s.problem}>{record.problem}</Text>
          <Text style={[s.label, s.labelSpaced]}>Diagnosis</Text>
          <Text style={s.body}>{record.diagnosis}</Text>
        </Card>

        <Card title="Prescription" icon="pill">
          <View style={s.rxBox}>
            <Text style={s.label}>Medication</Text>
            <Text style={s.body}>{record.tablets}</Text>
            <Text style={[s.label, s.labelSpaced]}>Duration</Text>
            <Text style={s.body}>{record.days}</Text>
          </View>
          <Text style={[s.label, s.labelSpaced]}>Doctor's Instructions</Text>
          <Text style={s.body}>{record.prescription}</Text>
        </Card>
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={download} disabled={downloading} style={s.downloadWrap}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
            {downloading ? <ActivityIndicator color="#FFF" /> : <AppIcon name="download" size={16} color="#FFF" />}
            <Text style={s.downloadText}>{downloading ? 'Downloading...' : 'Download Prescription'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Card({ title, icon, children }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardIcon}><AppIcon name={icon} size={14} color="#0D9488" /></View>
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, highlight, warn, last }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, highlight && s.rowHighlight, warn && s.rowWarn]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Vital({ label, value, icon, tone }) {
  return (
    <View style={[s.vital, s[`vital_${tone}`]]}>
      <Text style={s.vitalIcon}>{icon}</Text>
      <Text style={s.vitalValue}>{value}</Text>
      <Text style={s.vitalLabel}>{label}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  flex: { flex: 1 },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7E7E4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  content: { padding: 14, paddingBottom: 20 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E3EEEC' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0F766E' },
  name: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  meta: { fontSize: 12.5, color: '#667085', marginTop: 3 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#E3EEEC' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#17243A' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF3F2' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: '#667085' },
  rowValue: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: '#17243A', textAlign: 'right' },
  rowHighlight: { color: '#0F766E' },
  rowWarn: { color: '#B45309' },
  vitals: { flexDirection: 'row', gap: 8 },
  vital: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center' },
  vital_rose: { backgroundColor: '#FFF1F2' },
  vital_teal: { backgroundColor: '#F0FDFA' },
  vital_amber: { backgroundColor: '#FFFBEB' },
  vitalIcon: { fontSize: 18 },
  vitalValue: { fontSize: 14, fontWeight: '800', color: '#17243A', marginTop: 4, textAlign: 'center' },
  vitalLabel: { fontSize: 11, color: '#667085', marginTop: 2, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, color: '#667085', textTransform: 'uppercase' },
  labelSpaced: { marginTop: 12 },
  problem: { fontSize: 14, fontWeight: '700', color: '#0F766E', marginTop: 4 },
  body: { fontSize: 14, lineHeight: 20, color: '#344054', marginTop: 4 },
  rxBox: { backgroundColor: '#F8FFFE', borderWidth: 1, borderColor: '#CCFBF1', borderRadius: 12, padding: 12 },
  footer: { padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D7E7E4' },
  downloadWrap: {},
  download: { height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
