// Visit details — port of the web Patient Details "Visit Details" view
// (PatientAppointmentDetails/PatientDetailsPage.jsx): patient banner, Visit
// Information, Vital Signs, complaint + diagnosis, the full prescription
// (each medicine with dose, timing and duration), advice, recommended tests,
// doctor's notes, follow-up, and Download Prescription (the shared paper PDF).
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { downloadConsultationPrescriptionPdf } from '../utils/consultationPrescriptionPdf';
import { formatAppointment } from '../api/doctorAppointments';
import useDoctorPrescriptionDocument from '../useDoctorPrescriptionDocument';
import ConsultationPrescriptionDocument from '../../../../screens/user/Component/UserDashboard/Tab/Prescription/ConsultationPrescriptionDocument';

const isSet = (value) => {
  const v = value === undefined || value === null ? '' : String(value).trim();
  return Boolean(v) && v !== 'N/A';
};

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())
  .trim();

const MODE_LABELS = { 'in-clinic': 'In-Clinic', clinic: 'In-Clinic', video: 'Video Call', audio: 'Video Call', voice: 'Video Call', phone: 'Video Call', chat: 'Chat' };
const SOURCE_LABELS = { qr: 'QR Walk-in', walkin: 'Walk-in', 'walk-in': 'Walk-in', online: 'Online Booking' };
const STATUS_TONES = {
  completed: { fg: '#047857', bg: '#D1FAE5' },
  cancelled: { fg: '#B42318', bg: '#FEE4E2' },
  booked: { fg: '#0369A1', bg: '#E0F2FE' },
  confirmed: { fg: '#0369A1', bg: '#E0F2FE' },
};

export default function VisitDetailScreen({ patient, record, onBack }) {
  const [downloading, setDownloading] = useState(false);
  const appointment = useMemo(() => formatAppointment(record.__raw || { ...record, patient }), [record, patient]);
  const { data: prescription, error, retry } = useDoctorPrescriptionDocument(appointment);

  // Until the consultation is completed there are no medicines and no signature
  // yet, so a download would only produce an empty prescription.
  const status = String(record.status || '').toLowerCase();
  const canDownload = !status || status === 'completed' || status === 'complete';

  const download = async () => {
    if (!prescription || downloading || !canDownload) return;
    setDownloading(true);
    try {
      await downloadConsultationPrescriptionPdf(prescription);
    } finally {
      setDownloading(false);
    }
  };

  const hasDiagnosis = isSet(record.diagnosis);
  const statusTone = STATUS_TONES[record.status] || { fg: '#475467', bg: '#F2F4F7' };
  // Only the readings staff actually recorded; the card is hidden when none were.
  const vitals = [
    { label: 'Blood Pressure', value: record.bp, unit: 'mmHg', tone: 'rose' },
    { label: 'Pulse Rate', value: record.pulse, unit: 'bpm', tone: 'teal' },
    { label: 'Temperature', value: record.temperature, unit: `°${record.temperatureUnit || 'C'}`, tone: 'amber' },
    { label: 'SpO₂', value: record.spo2, unit: '%', tone: 'blue' },
    { label: 'Breathing Rate', value: record.respiratoryRate, unit: '/min', tone: 'indigo' },
    { label: 'Weight', value: record.weight, unit: 'kg', tone: 'violet' },
    { label: 'Height', value: record.height, unit: 'cm', tone: 'slate' },
    { label: 'Pain Score', value: record.painScore, unit: '/10', tone: 'rose' },
  ].filter((v) => isSet(v.value));
  const hasVitals = vitals.length > 0 || isSet(record.notes);

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
          <View style={s.avatar}><Text translate={false} style={s.avatarText}>{patient.name.charAt(0).toUpperCase()}</Text></View>
          <View style={s.flex}>
            <Text translate={false} style={s.name}>{patient.name}</Text>
            <Text translate={false} style={s.meta}>
              {[patient.age !== 'N/A' ? `${patient.age} yrs` : null, patient.gender, patient.bloodGroup, patient.phone].filter(isSet).join(' • ')}
            </Text>
          </View>
          {isSet(record.tokenNumber) && (
            <View style={[s.token, record.isEmergency && s.tokenDanger]}>
              <Text style={[s.tokenLabel, record.isEmergency && s.tokenTextDanger]}>Token</Text>
              <Text translate={false} style={[s.tokenValue, record.isEmergency && s.tokenTextDanger]}>#{record.tokenNumber}</Text>
            </View>
          )}
        </View>

        {record.isEmergency && (
          <View style={s.emergency}>
            <AppIcon name="warning" size={18} color="#DC2626" />
            <View style={s.flex}>
              <Text style={s.emergencyTitle}>Emergency Visit</Text>
              {isSet(record.emergencyReason) && <Text translate={false} style={s.emergencyText}>{record.emergencyReason}</Text>}
            </View>
          </View>
        )}

        <Card title="Visit Information" icon="calendar">
          <Row label="Date" value={record.date} />
          <Row label="Time" value={record.time} />
          {isSet(record.consultationMode) && (
            <Row label="Consultation Mode" value={MODE_LABELS[record.consultationMode.toLowerCase()] || titleCase(record.consultationMode)} />
          )}
          {isSet(record.bookingSource) && (
            <Row label="Booked Via" value={SOURCE_LABELS[record.bookingSource] || titleCase(record.bookingSource)} />
          )}
          <Row label="Consulting Doctor" value={record.doctor} highlight last={!isSet(record.status)} />
          {isSet(record.status) && (
            <View style={[s.row, s.rowLast]}>
              <Text style={s.rowLabel}>Status</Text>
              <Text style={[s.statusPill, { color: statusTone.fg, backgroundColor: statusTone.bg }]}>{titleCase(record.status)}</Text>
            </View>
          )}
        </Card>

        {hasVitals && (
          <Card title="Vital Signs" icon="pulse" count={vitals.length}>
            {vitals.length > 0 && (
              <View style={s.vitals}>
                {vitals.map((v) => <Vital key={v.label} {...v} />)}
              </View>
            )}
            {isSet(record.notes) && (
              <View style={s.vitalsNotesBox}>
                <Text style={s.vitalsNotesLabel}>Notes</Text>
                <Text translate={false} style={s.vitalsNotes}>{record.notes}</Text>
              </View>
            )}
            {isSet(record.recordedAt) && (
              <View style={s.vitalsRecordedRow}>
                <AppIcon name="clock" size={12} color="#98A2B3" />
                <Text translate={false} style={s.vitalsRecorded}>Recorded {new Date(record.recordedAt).toLocaleString('en-IN')}</Text>
              </View>
            )}
          </Card>
        )}

        {(isSet(record.problem) || isSet(record.patientNotes) || hasDiagnosis) && (
          <Card title={hasDiagnosis ? 'Complaint & Diagnosis' : 'Complaint'} icon="note">
            {isSet(record.problem) && (
              <View style={[s.infoBlock, s.problemBlock]}>
                <Text style={[s.label, s.problemLabel]}>Presenting Problem</Text>
                <Text translate={false} style={s.problem}>{record.problem}</Text>
              </View>
            )}
            {isSet(record.patientNotes) && (
              <View style={[s.infoBlock, s.notesBlock]}>
                <Text style={s.label}>Patient's Notes</Text>
                <Text translate={false} style={s.body}>{record.patientNotes}</Text>
              </View>
            )}
            {hasDiagnosis && (
              <View style={[s.infoBlock, s.diagnosisBlock]}>
                <Text style={[s.label, s.diagnosisLabel]}>Diagnosis</Text>
                <Text translate={false} style={s.diagnosis}>{record.diagnosis}</Text>
              </View>
            )}
          </Card>
        )}

        <View style={s.rxHead}>
          <View style={s.cardIcon}><AppIcon name="file" size={14} color="#0D9488" /></View>
          <View style={s.flex}>
            <Text style={s.cardTitle}>Prescription</Text>
            <Text style={s.rxSub}>Medicines, tests and follow-up for this visit</Text>
          </View>
        </View>
        {error ? (
          <View style={s.rxState}>
            <AppIcon name="warning" size={20} color="#B42318" />
            <Text accessibilityRole="alert" style={s.rxStateText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={s.retryBtn} hitSlop={6}>
              <AppIcon name="refresh" size={14} color="#0D9488" />
              <Text style={s.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : prescription ? (
          <ConsultationPrescriptionDocument data={prescription} />
        ) : (
          <View style={s.rxState}>
            <ActivityIndicator color="#0D9488" />
            <Text style={s.rxStateText}>Loading prescription...</Text>
          </View>
        )}
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={download} disabled={downloading || !prescription || !canDownload} style={[s.downloadWrap, (!prescription || !canDownload) && s.disabled]}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
            {downloading ? <ActivityIndicator color="#FFF" /> : <AppIcon name={canDownload ? 'download' : 'clock'} size={16} color="#FFF" />}
            <Text style={s.downloadText}>
              {downloading ? 'Downloading...' : canDownload ? 'Download Prescription' : 'Available after consultation'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Card({ title, icon, count, children }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardIcon}><AppIcon name={icon} size={14} color="#0D9488" /></View>
        <Text style={s.cardTitle}>{title}</Text>
        {count > 0 && <Text translate={false} style={s.cardCount}>{count}</Text>}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, highlight, last }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text translate={false} style={[s.rowValue, highlight && s.rowHighlight]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Vital({ label, value, unit, tone }) {
  return (
    <View style={[s.vital, s[`vital_${tone}`]]}>
      <View style={[s.vitalAccent, s[`accent_${tone}`]]} />
      <Text style={s.vitalLabel}>{label}</Text>
      <Text translate={false} style={s.vitalValue}>
        {String(value).trim()}
        <Text translate={false} style={s.vitalUnit}>{unit.startsWith('/') || unit.startsWith('°') || unit === '%' ? unit : ` ${unit}`}</Text>
      </Text>
    </View>
  );
}

const s = createDoctorStyles({
  retry: { color: '#0D9488', fontWeight: '800', fontSize: 13.5 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E6FBF8', marginTop: 4 },
  rxHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10, paddingHorizontal: 2 },
  rxSub: { fontSize: 12, color: '#667085', marginTop: 1 },
  rxState: { alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E3EEEC', borderRadius: 16, paddingVertical: 28, paddingHorizontal: 16 },
  rxStateText: { fontSize: 13.5, lineHeight: 19, color: '#475467', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7E7E4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  content: { padding: 14, paddingBottom: 20 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDFA', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#CCFBF1' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#99F6E4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0F766E' },
  name: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  meta: { fontSize: 12.5, color: '#667085', marginTop: 3 },
  token: { alignItems: 'center', backgroundColor: '#E6FBF8', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  tokenDanger: { backgroundColor: '#FEE2E2' },
  tokenLabel: { fontSize: 10, fontWeight: '800', color: '#0F766E', textTransform: 'uppercase', letterSpacing: 0.4 },
  tokenValue: { fontSize: 17, fontWeight: '900', color: '#0F766E' },
  tokenTextDanger: { color: '#DC2626' },
  emergency: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 12, marginTop: 12 },
  emergencyTitle: { fontSize: 14, fontWeight: '800', color: '#B42318' },
  emergencyText: { fontSize: 13, lineHeight: 18, color: '#7A271A', marginTop: 2 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#E3EEEC' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#17243A' },
  cardCount: { fontSize: 12, fontWeight: '800', color: '#FFF', backgroundColor: '#0D9488', minWidth: 22, textAlign: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF3F2' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: '#667085' },
  rowValue: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: '#17243A', textAlign: 'right' },
  rowHighlight: { color: '#0F766E' },
  statusPill: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  vitals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  vital: { width: '48.5%', borderRadius: 14, paddingVertical: 11, paddingLeft: 14, paddingRight: 10, overflow: 'hidden' },
  vitalAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  accent_rose: { backgroundColor: '#F43F5E' },
  accent_teal: { backgroundColor: '#14B8A6' },
  accent_amber: { backgroundColor: '#F59E0B' },
  accent_blue: { backgroundColor: '#3B82F6' },
  accent_indigo: { backgroundColor: '#6366F1' },
  accent_violet: { backgroundColor: '#8B5CF6' },
  accent_slate: { backgroundColor: '#64748B' },
  vital_rose: { backgroundColor: '#FFF1F2' },
  vital_teal: { backgroundColor: '#F0FDFA' },
  vital_amber: { backgroundColor: '#FFFBEB' },
  vital_blue: { backgroundColor: '#EFF6FF' },
  vital_indigo: { backgroundColor: '#EEF2FF' },
  vital_violet: { backgroundColor: '#F5F3FF' },
  vital_slate: { backgroundColor: '#F8FAFC' },
  vitalLabel: { fontSize: 11.5, fontWeight: '600', color: '#667085' },
  vitalValue: { fontSize: 18, fontWeight: '800', color: '#17243A', marginTop: 3 },
  vitalUnit: { fontSize: 12, fontWeight: '600', color: '#667085' },
  vitalsNotesBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 11, marginTop: 10 },
  vitalsNotesLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: '#667085', textTransform: 'uppercase' },
  vitalsNotes: { fontSize: 13, lineHeight: 19, color: '#344054', marginTop: 3 },
  vitalsRecordedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  vitalsRecorded: { fontSize: 11.5, color: '#98A2B3' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: '#667085', textTransform: 'uppercase' },
  infoBlock: { borderRadius: 12, padding: 12, marginTop: 8, borderLeftWidth: 3 },
  problemBlock: { marginTop: 0, backgroundColor: '#F0FDFA', borderLeftColor: '#14B8A6' },
  problemLabel: { color: '#0F766E' },
  problem: { fontSize: 15, fontWeight: '800', color: '#0F766E', marginTop: 4 },
  notesBlock: { backgroundColor: '#F8FAFC', borderLeftColor: '#CBD5E1' },
  diagnosisBlock: { backgroundColor: '#EEF2FF', borderLeftColor: '#6366F1' },
  diagnosisLabel: { color: '#4338CA' },
  diagnosis: { fontSize: 14.5, fontWeight: '700', color: '#1E1B4B', marginTop: 4, lineHeight: 21 },
  body: { fontSize: 13.5, lineHeight: 20, color: '#344054', marginTop: 4 },
  med: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F8FFFE', borderWidth: 1, borderColor: '#CCFBF1', borderRadius: 12, padding: 11 },
  medSpaced: { marginTop: 8 },
  medIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  medIndexText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  medName: { fontSize: 14.5, fontWeight: '800', color: '#17243A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  followUp: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12 },
  followUpLabel: { fontSize: 12, color: '#92400E' },
  followUpDate: { fontSize: 15, fontWeight: '800', color: '#B45309', marginTop: 1 },
  footer: { padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D7E7E4' },
  downloadWrap: {},
  download: { height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
