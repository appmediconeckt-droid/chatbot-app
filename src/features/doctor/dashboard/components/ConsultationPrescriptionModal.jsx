// "Prescription" on a completed queue card — port of the web dashboard's
// SummaryModal + common/PrescriptionDocument.jsx: the consultation record
// (patient, diagnosis, prescribed medicines, advice, notes, tests, follow-up)
// with Close and Download PDF.
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { downloadVisitPrescriptionPdf } from '../utils/prescriptionPdf';

const HUMAELI_LOGO = require('../../../../image/HumaeliIcon.png');

const prescriptionDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const listText = (value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : value || '');
const medicineTiming = (m) => [listText(m.timeOfDay || m.timings), m.timing || m.when].filter(Boolean).join(' · ');
const medicineDuration = (m) => m.duration || [m.durationValue, m.durationType].filter(Boolean).join(' ');

// Same fields as the web's prescriptionDetails(record, doctorName); the queue
// item is the formatted appointment, the raw API record carries the lists.
const prescriptionDetails = (appt = {}, doctorName) => {
  const raw = appt.__raw || {};
  const record = { ...raw, ...appt };
  const patient = raw.patient || {};
  return {
    patient: appt.name || patient.name || patient.fullName || 'Patient',
    doctor: doctorName || raw.psychiatrist?.name || raw.doctor?.name || 'Doctor',
    date: prescriptionDate(record.issuedAt || record.endTime || record.appointmentDate || record.date),
    gender: appt.gender && appt.gender !== 'Not specified' ? appt.gender : patient.gender || '—',
    issue: record.issue || record.problem || '—',
    diagnosis: record.diagnosis || record.problem || '—',
    medicines: Array.isArray(raw.medicines) ? raw.medicines : [],
    medicine: record.medicine || '',
    advice: record.advice || record.instructions || '',
    notes: record.additionalNotes || record.additional_notes || '',
    tests: raw.recommendedTests || raw.recommended_tests || [],
    followUp: record.followUpDate || record.follow_up_date,
    followUpRequired: record.followUpRequired || record.follow_up_required,
  };
};

export default function ConsultationPrescriptionModal({ visible, appointment, doctorName, onClose }) {
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);
  if (!appointment) return null;
  const data = prescriptionDetails(appointment, doctorName);

  const download = async () => {
    setDownloading(true);
    try {
      const medicinesText = data.medicines.length
        ? data.medicines.map((m) => [m.name || m.medicine, m.dosage, medicineTiming(m)].filter(Boolean).join(' - ')).join('; ')
        : data.medicine || 'N/A';
      await downloadVisitPrescriptionPdf(
        {
          name: data.patient,
          age: appointment.__raw?.age || appointment.__raw?.patient?.age || 'N/A',
          gender: data.gender,
          phone: appointment.phone || 'N/A',
          bloodGroup: appointment.bloodGroup || 'N/A',
        },
        {
          id: appointment.apiId,
          date: data.date,
          time: appointment.scheduledTime || '',
          doctor: data.doctor,
          followUp: data.followUp ? prescriptionDate(data.followUp) : data.followUpRequired ? 'Required' : 'Not required',
          problem: data.issue,
          diagnosis: data.diagnosis,
          bp: appointment.bp || 'N/A',
          pulse: appointment.__raw?.pulse || appointment.__raw?.pulse_rate || 'N/A',
          temperature: appointment.temperature || 'N/A',
          medicines: data.medicines,
          tests: data.tests,
          advice: data.advice,
          notes: data.notes,
          tablets: medicinesText,
          days: data.medicines.map(medicineDuration).filter(Boolean).join(', ') || 'N/A',
          prescription: [data.advice, data.notes].filter(Boolean).join('\n') || 'N/A',
        },
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={s.backdropTap} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Consultation Prescription</Text>
            <Pressable onPress={onClose} hitSlop={8} style={s.closeIcon}>
              <AppIcon name="x" size={18} color="#475467" strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={s.doc}>
              <View style={s.docHeader}>
                <Image source={HUMAELI_LOGO} style={s.logo} />
                <View style={s.flex}>
                  <Text style={s.kicker}>CONSULTATION RECORD</Text>
                  <Text style={s.docTitle}>Prescription</Text>
                </View>
                <View style={s.issuer}>
                  <Text translate={false} style={s.issuerName} numberOfLines={1}>{data.doctor}</Text>
                  <Text style={s.issuerDate}>{data.date}</Text>
                </View>
              </View>

              <View style={s.patientBox}>
                <Field label="Patient name" value={data.patient} />
                <Field label="Gender" value={data.gender} />
                <Field label="Consultation for" value={data.issue} wide />
              </View>

              <Section title="Diagnosis"><Text style={s.body}>{data.diagnosis}</Text></Section>

              <Section title="℞  Prescribed medicines">
                {data.medicines.length ? (
                  data.medicines.map((m, index) => (
                    <View key={index} style={[s.medRow, index > 0 && s.medRowDivider]}>
                      <Text translate={false} style={s.medName}>{m.name || m.medicine || '—'}</Text>
                      <View style={s.medMeta}>
                        <MedPill label="Dosage" value={m.dosage} />
                        <MedPill label="Timing" value={medicineTiming(m)} />
                        <MedPill label="Duration" value={medicineDuration(m)} />
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={s.body}>{data.medicine || 'No medicines prescribed.'}</Text>
                )}
              </Section>

              {!!data.advice && <Section title="Advice & instructions"><Text style={s.body}>{data.advice}</Text></Section>}
              {!!data.notes && data.notes !== data.advice && (
                <Section title="Additional notes"><Text style={s.body}>{data.notes}</Text></Section>
              )}
              {Array.isArray(data.tests) && data.tests.length > 0 && (
                <Section title="Recommended tests">
                  {data.tests.map((test, index) => (
                    <Text key={index} style={s.body}>
                      <Text style={s.bold}>{test.testName || test.name}</Text>
                      {test.completeBy ? ` · By ${prescriptionDate(test.completeBy)}` : ''}
                      {test.reason ? `\n${test.reason}` : ''}
                      {test.instructions ? `\n${test.instructions}` : ''}
                    </Text>
                  ))}
                </Section>
              )}

              <View style={s.docFooter}>
                <Field
                  label="Follow-up"
                  value={data.followUp ? prescriptionDate(data.followUp) : data.followUpRequired ? 'Required' : 'No follow-up scheduled'}
                />
                <Field label="Issued by" value={data.doctor} />
              </View>
            </View>
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={s.closeBtn}><Text style={s.closeText}>Close</Text></Pressable>
            <Pressable onPress={download} disabled={downloading} style={s.downloadWrap}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
                {downloading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <AppIcon name="download" size={16} color="#FFF" strokeWidth={2.2} />}
                <Text style={s.downloadText}>{downloading ? 'Downloading...' : 'Download PDF'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, wide }) {
  return (
    <View style={[s.field, wide && s.fieldWide]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text translate={false} style={s.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

function MedPill({ label, value }) {
  return (
    <View style={s.medPill}>
      <Text style={s.medPillLabel}>{label}</Text>
      <Text translate={false} style={s.medPillValue}>{value || '—'}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  backdropTap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { width: '100%', maxWidth: 800, alignSelf: 'center', maxHeight: '92%', backgroundColor: '#F0FDFA', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0F172A' },
  closeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 8 },
  flex: { flex: 1, minWidth: 0 },
  doc: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#CCEDE8', padding: 14 },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#0F766E' },
  logo: { width: 40, height: 40, borderRadius: 10 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#0F766E' },
  docTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  issuer: { alignItems: 'flex-end', maxWidth: '42%' },
  issuerName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  issuerDate: { fontSize: 11.5, color: '#667085', marginTop: 2 },
  patientBox: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, rowGap: 8 },
  field: { width: '50%', paddingRight: 8 },
  fieldWide: { width: '100%' },
  fieldLabel: { fontSize: 11, color: '#667085' },
  fieldValue: { fontSize: 13.5, fontWeight: '700', color: '#1F2937', marginTop: 1 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F766E', marginBottom: 6 },
  body: { fontSize: 13.5, lineHeight: 19, color: '#344054' },
  bold: { fontWeight: '800', color: '#1F2937' },
  medRow: { paddingVertical: 8 },
  medRowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  medName: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  medMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  medPill: { backgroundColor: '#F0FDFA', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  medPillLabel: { fontSize: 10, color: '#667085' },
  medPillValue: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  docFooter: { flexDirection: 'row', marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  closeBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 15, fontWeight: '700', color: '#334155' },
  downloadWrap: { flex: 1.4, borderRadius: 12 },
  download: { height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  downloadText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
