// Visit details — port of the web Patient Details "Visit Details" view
// (PatientAppointmentDetails/PatientDetailsPage.jsx): patient banner, Visit
// Information, Vital Signs, complaint + diagnosis, the full prescription
// (each medicine with dose, timing and duration), advice, recommended tests,
// doctor's notes, follow-up, and Download Prescription (the shared paper PDF).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { downloadVisitPrescriptionPdf } from '../utils/prescriptionPdf';

const isSet = (value) => {
  const v = value === undefined || value === null ? '' : String(value).trim();
  return Boolean(v) && v !== 'N/A';
};

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())
  .trim();

const MODE_LABELS = { 'in-clinic': 'In-Clinic', clinic: 'In-Clinic', video: 'Video Call', audio: 'Audio Call', chat: 'Chat' };
const SOURCE_LABELS = { qr: 'QR Walk-in', walkin: 'Walk-in', 'walk-in': 'Walk-in', online: 'Online Booking' };
const STATUS_TONES = {
  completed: { fg: '#047857', bg: '#D1FAE5' },
  cancelled: { fg: '#B42318', bg: '#FEE4E2' },
  booked: { fg: '#0369A1', bg: '#E0F2FE' },
  confirmed: { fg: '#0369A1', bg: '#E0F2FE' },
};

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

  const medicines = Array.isArray(record.medicines) ? record.medicines : [];
  const tests = Array.isArray(record.tests) ? record.tests : [];
  const hasDiagnosis = isSet(record.diagnosis);
  const hasFollowUp = isSet(record.followUp) && record.followUp !== 'Not required';
  const hasConsultation = hasDiagnosis || medicines.length > 0 || isSet(record.advice)
    || tests.length > 0 || isSet(record.additionalNotes) || hasFollowUp;
  const statusTone = STATUS_TONES[record.status] || { fg: '#475467', bg: '#F2F4F7' };

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

        <Card title="Vital Signs" icon="pulse">
          <View style={s.vitals}>
            <Vital label="Blood Pressure" value={isSet(record.bp) ? `${record.bp} mmHg` : '—'} icon="❤" tone="rose" />
            <Vital label="Pulse Rate" value={isSet(record.pulse) ? `${record.pulse} bpm` : '—'} icon="〰" tone="teal" />
            <Vital label="Temperature" value={isSet(record.temperature) ? `${record.temperature}°${record.temperatureUnit || 'C'}` : '—'} icon="🌡" tone="amber" />
            <Vital label="SpO₂" value={isSet(record.spo2) ? `${record.spo2}%` : '—'} icon="◉" tone="blue" />
            <Vital label="Breathing rate" value={isSet(record.respiratoryRate) ? `${record.respiratoryRate}/min` : '—'} icon="↕" tone="indigo" />
            <Vital label="Weight" value={isSet(record.weight) ? `${record.weight} kg` : '—'} icon="⚖" tone="violet" />
            <Vital label="Height" value={isSet(record.height) ? `${record.height} cm` : '—'} icon="↕" tone="slate" />
            <Vital label="Pain score" value={isSet(record.painScore) ? `${record.painScore}/10` : '—'} icon="●" tone="rose" />
          </View>
          {isSet(record.notes) && <Text translate={false} style={s.vitalsNotes}>Notes: {record.notes}</Text>}
          {isSet(record.recordedAt) && <Text translate={false} style={s.vitalsRecorded}>Recorded {new Date(record.recordedAt).toLocaleString('en-IN')}</Text>}
        </Card>

        <Card title="Complaint & Diagnosis" icon="note">
          <Text style={s.label}>Presenting Problem</Text>
          <Text translate={false} style={s.problem}>{record.problem}</Text>
          {isSet(record.patientNotes) && (
            <>
              <Text style={[s.label, s.labelSpaced]}>Patient's Notes</Text>
              <Text translate={false} style={s.body}>{record.patientNotes}</Text>
            </>
          )}
          <Text style={[s.label, s.labelSpaced]}>Diagnosis</Text>
          {hasDiagnosis
            ? <Text translate={false} style={s.diagnosis}>{record.diagnosis}</Text>
            : <Text style={s.muted}>Not recorded yet</Text>}
        </Card>

        {!hasConsultation && (
          <View style={s.pending}>
            <AppIcon name="info" size={16} color="#0369A1" />
            <Text style={s.pendingText}>
              The prescription, tests and follow-up appear here once the consultation for this visit is completed.
            </Text>
          </View>
        )}

        <Card title="Prescription" icon="pill" count={medicines.length}>
          {medicines.length ? medicines.map((m, index) => (
            <View key={`${m.name}-${index}`} style={[s.med, index > 0 && s.medSpaced]}>
              <View style={s.medIndex}><Text translate={false} style={s.medIndexText}>{index + 1}</Text></View>
              <View style={s.flex}>
                <Text translate={false} style={s.medName}>{m.name}</Text>
                <View style={s.chips}>
                  {isSet(m.dosage) && <Chip icon="pill" text={m.dosage} />}
                  {(m.timings || []).map((t) => <Chip key={t} icon="clock" text={t} />)}
                  {isSet(m.duration) && <Chip icon="timer" text={m.duration} tone="amber" />}
                </View>
              </View>
            </View>
          )) : <Text style={s.muted}>No medicines prescribed</Text>}
        </Card>

        {isSet(record.advice) && (
          <Card title="Advice & Instructions" icon="file">
            <Text translate={false} style={s.body}>{record.advice}</Text>
          </Card>
        )}

        {tests.length > 0 && (
          <Card title="Recommended Tests" icon="flask" count={tests.length}>
            <View style={s.chips}>
              {tests.map((t) => <Chip key={t} icon="flask" text={t} tone="indigo" />)}
            </View>
          </Card>
        )}

        {isSet(record.additionalNotes) && (
          <Card title="Doctor's Notes" icon="edit">
            <Text translate={false} style={s.body}>{record.additionalNotes}</Text>
          </Card>
        )}

        <Card title="Follow-up" icon="refresh">
          {hasFollowUp ? (
            <View style={s.followUp}>
              <AppIcon name="calendar" size={16} color="#B45309" />
              <View style={s.flex}>
                <Text style={s.followUpLabel}>Next visit on</Text>
                <Text translate={false} style={s.followUpDate}>{record.followUp}</Text>
              </View>
            </View>
          ) : <Text style={s.muted}>No follow-up required</Text>}
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

const CHIP_TONES = {
  teal: { fg: '#0F766E', bg: '#E6FBF8' },
  amber: { fg: '#B45309', bg: '#FEF3C7' },
  indigo: { fg: '#4338CA', bg: '#EEF2FF' },
};

function Chip({ icon, text, tone = 'teal' }) {
  const c = CHIP_TONES[tone];
  return (
    <View style={[s.chip, { backgroundColor: c.bg }]}>
      <AppIcon name={icon} size={11} color={c.fg} />
      <Text translate={false} style={[s.chipText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

function Vital({ label, value, icon, tone }) {
  return (
    <View style={[s.vital, s[`vital_${tone}`]]}>
      <Text style={s.vitalIcon}>{icon}</Text>
      <Text translate={false} style={s.vitalValue}>{value}</Text>
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
  vitals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vital: { width: '31%', minWidth: 92, borderRadius: 14, padding: 10, alignItems: 'center' },
  vital_rose: { backgroundColor: '#FFF1F2' },
  vital_teal: { backgroundColor: '#F0FDFA' },
  vital_amber: { backgroundColor: '#FFFBEB' },
  vital_blue: { backgroundColor: '#EFF6FF' },
  vital_indigo: { backgroundColor: '#EEF2FF' },
  vital_violet: { backgroundColor: '#F5F3FF' },
  vital_slate: { backgroundColor: '#F8FAFC' },
  vitalIcon: { fontSize: 18 },
  vitalValue: { fontSize: 14, fontWeight: '800', color: '#17243A', marginTop: 4, textAlign: 'center' },
  vitalLabel: { fontSize: 11, color: '#667085', marginTop: 2, textAlign: 'center' },
  vitalsNotes: { fontSize: 13, lineHeight: 19, color: '#344054', marginTop: 10 },
  vitalsRecorded: { fontSize: 11.5, color: '#98A2B3', marginTop: 6 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, color: '#667085', textTransform: 'uppercase' },
  labelSpaced: { marginTop: 12 },
  problem: { fontSize: 14, fontWeight: '700', color: '#0F766E', marginTop: 4 },
  diagnosis: { fontSize: 14, fontWeight: '700', color: '#17243A', marginTop: 4, lineHeight: 20 },
  body: { fontSize: 14, lineHeight: 20, color: '#344054', marginTop: 2 },
  muted: { fontSize: 13.5, color: '#98A2B3', fontStyle: 'italic', marginTop: 2 },
  pending: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 14, padding: 12, marginTop: 12 },
  pendingText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#075985' },
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
