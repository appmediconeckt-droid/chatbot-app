import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Text from '../../../../../../components/TranslatedText';
import {
  followUpText,
  medicineDuration,
  medicineTiming,
  testLine,
} from '../../../../../../utils/consultationPrescriptionDocument';

const BRAND = require('../../../../../../image/prescriptionBrand.png');
const WATERMARK = require('../../../../../../image/prescriptionWatermark.png');
const FOOTER_LOGO = require('../../../../../../image/HumaeliIconRound.png');

const INK = '#193D42';
const TEAL = '#0F766E';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

// The document builders fill missing fields with '—'.
const hasValue = (value) => !!String(value ?? '').trim() && String(value).trim() !== '—';

// `data` is doctorRxToDocument(rx) / appointmentToDocument(appointment).
export default function ConsultationPrescriptionDocument({ data }) {
  const wide = useWindowDimensions().width >= 600;
  const doctorLines = [data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`].filter(hasValue);
  const clinicLines = [data.clinic, data.address].filter(hasValue);
  const contactLine = [data.doctorPhone, data.doctorEmail].filter(hasValue).join('  ·  ');
  const ageGender = [hasValue(data.age) && `${data.age} yrs`, hasValue(data.gender) && data.gender].filter(Boolean).join(' / ');
  const weight = hasValue(data.weight) ? `${data.weight}${/kg/i.test(data.weight) ? '' : ' kg'}` : '';
  const followUp = followUpText(data);
  const hasFollowUp = followUp !== 'No follow-up scheduled';

  return (
    <View style={s.doc}>
      {/* Faint, centred behind the content — clear of the header and sign-off. */}
      <View pointerEvents="none" style={s.watermarkWrap}>
        <Image source={WATERMARK} style={s.watermark} accessible={false} />
      </View>

      {/* Letterhead */}
      <View style={s.letterhead}>
        <View style={[s.headTop, wide && s.headTopWide]}>
          <Image source={BRAND} style={s.logo} accessibilityLabel="Humaeli" />
          <View style={s.doctorBlock}>
            <Text style={s.eyebrow}>Prescribing doctor</Text>
            <Text translate={false} style={s.doctorName}>{data.doctor}</Text>
            {doctorLines.map((line, i) => <Text key={i} translate={false} style={s.doctorLine}>{line}</Text>)}
          </View>
        </View>
        {(clinicLines.length > 0 || !!contactLine) && (
          <View style={s.clinicStrip}>
            {clinicLines.map((line, i) => <Text key={i} translate={false} style={[s.clinicLine, i === 0 && s.clinicName]}>{line}</Text>)}
            {!!contactLine && <Text translate={false} style={s.clinicContact}>{contactLine}</Text>}
          </View>
        )}
      </View>

      {/* Reference row */}
      <View style={s.refRow}>
        <RefChip label="Date" value={data.date} />
        {hasValue(data.opd) && <RefChip label="Token" value={`#${data.opd}`} />}
      </View>
      {hasValue(data.prescriptionId) && (
        <Text translate={false} style={s.rxNumber} numberOfLines={1} ellipsizeMode="middle">
          Rx No. {String(data.prescriptionId).replace(/^appointment:/i, '')}
        </Text>
      )}

      {/* Patient */}
      <View style={s.patient}>
        <Text style={s.eyebrow}>Patient</Text>
        <Text translate={false} style={s.patientName}>{hasValue(data.patient) ? data.patient : '—'}</Text>
        {/* Only details that were recorded — never a "None recorded" filler. */}
        <View style={s.patientGrid}>
          {hasValue(ageGender) && <PatientField label="Age / Gender" value={ageGender} />}
          {hasValue(weight) && <PatientField label="Weight" value={weight} />}
          {hasValue(data.phone) && <PatientField label="Contact" value={data.phone} />}
          {hasValue(data.allergies) && !/^(none|not)\s*recorded$/i.test(String(data.allergies).trim()) && <PatientField label="Allergies" value={data.allergies} />}
          {hasValue(data.patientId) && <PatientField label="Patient ID" value={data.patientId} full />}
        </View>
      </View>

      {/* Rx */}
      <View style={s.rxHead}>
        <Text style={s.rxSymbol}>℞</Text>
        <Text style={s.rxTitle}>Prescription</Text>
        <View style={s.rxRule} />
      </View>

      {hasValue(data.issue) || hasValue(data.diagnosis) ? (
        <View style={[s.clinical, wide && s.clinicalWide]}>
          {hasValue(data.issue) && <ClinicalBox label="Consultation for" value={data.issue} />}
          {hasValue(data.diagnosis) && <ClinicalBox label="Diagnosis" value={data.diagnosis} tone="indigo" />}
        </View>
      ) : null}

      <SectionTitle title="Prescribed medicines" count={data.medicines.length} />
      {data.medicines.length ? (
        <View style={[s.medList, wide && s.medListWide]}>
          {data.medicines.map((m, index) => (
            <MedicineCard key={index} index={index} medicine={m} wide={wide} />
          ))}
        </View>
      ) : (
        <View style={s.emptyBox}>
          <Text translate={false} style={s.emptyText}>{hasValue(data.medicine) ? data.medicine : 'No medicines prescribed.'}</Text>
        </View>
      )}

      {data.tests.length > 0 && (
        <>
          <SectionTitle title="Recommended tests" count={data.tests.length} />
          {data.tests.map((test, index) => (
            <View key={index} style={s.testRow}>
              <View style={s.testDot} />
              <Text translate={false} style={s.testText}>
                <Text translate={false} style={s.testName}>{test.testName || test.name}</Text>
                {testLine(test)}
              </Text>
            </View>
          ))}
        </>
      )}

      {hasValue(data.advice) && (
        <>
          <SectionTitle title="Advice & instructions" />
          <Text translate={false} style={s.paragraph}>{data.advice}</Text>
        </>
      )}
      {hasValue(data.notes) && data.notes !== data.advice && (
        <>
          <SectionTitle title="Additional notes" />
          <Text translate={false} style={s.paragraph}>{data.notes}</Text>
        </>
      )}

      {/* Follow-up + sign-off */}
      <View style={[s.closing, wide && s.closingWide]}>
        <View style={[s.followUp, hasFollowUp ? s.followUpOn : s.followUpOff]}>
          <Text style={[s.eyebrow, hasFollowUp && s.followUpLabelOn]}>Next follow-up</Text>
          <Text translate={false} style={[s.followUpValue, hasFollowUp && s.followUpValueOn]}>{followUp}</Text>
        </View>
        <View style={s.signoff}>
          <View style={s.signatureSpace}>
            {!!data.signature && <Image source={{ uri: data.signature }} style={s.signature} accessibilityLabel="Doctor signature" />}
          </View>
          <View style={s.signatureLine} />
          <Text translate={false} style={s.signName}>{data.doctor}</Text>
          {hasValue(data.qualification) && <Text translate={false} style={s.signMeta}>{data.qualification}</Text>}
          {hasValue(data.registration) && <Text translate={false} style={s.signMeta}>Reg. No.: {data.registration}</Text>}
          <Text style={s.signCaption}>Issued by</Text>
        </View>
      </View>

      <View style={s.brandFooter}>
        <Text style={s.footerCaption}>This prescription is provided by</Text>
        <View style={s.footerBrandRow}>
          <Image source={FOOTER_LOGO} style={s.footerLogo} accessible={false} />
          <Text translate={false} style={s.footerBrand}>HUMAELI</Text>
        </View>
        <Text translate={false} style={s.footerCaption}>Talk. Connect. Feel Supported.</Text>
      </View>
    </View>
  );
}

function RefChip({ label, value }) {
  return (
    <View style={s.refChip}>
      <Text style={s.refLabel}>{label}</Text>
      <Text translate={false} style={s.refValue}>{hasValue(value) ? value : '—'}</Text>
    </View>
  );
}

function PatientField({ label, value, full }) {
  return (
    <View style={[s.patientField, full && s.patientFieldFull]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text translate={false} style={s.fieldValue}>{hasValue(value) ? value : '—'}</Text>
    </View>
  );
}

function ClinicalBox({ label, value, tone }) {
  return (
    <View style={[s.clinicalBox, tone === 'indigo' && s.clinicalBoxIndigo]}>
      <Text style={[s.fieldLabel, tone === 'indigo' && s.clinicalLabelIndigo]}>{label}</Text>
      <Text translate={false} style={s.clinicalValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title, count }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {count > 0 && <Text translate={false} style={s.sectionCount}>{count}</Text>}
    </View>
  );
}

function MedicineCard({ index, medicine: m, wide }) {
  const details = [
    ['Dosage', m.dosage],
    ['Duration', medicineDuration(m)],
    ['When', medicineTiming(m)],
  ].filter(([, value]) => hasValue(value));
  return (
    <View style={[s.med, wide && s.medWide]}>
      <View style={s.medTop}>
        <View style={s.medIndex}><Text translate={false} style={s.medIndexText}>{index + 1}</Text></View>
        <View style={s.flex}>
          <Text translate={false} style={s.medName}>{m.name || m.medicine || '—'}</Text>
          {hasValue(m.strength) && <Text translate={false} style={s.medStrength}>{m.strength}</Text>}
        </View>
      </View>
      {details.length > 0 && (
        <View style={s.medDetails}>
          {details.map(([label, value]) => (
            <View key={label} style={s.medDetail}>
              <Text style={s.medDetailLabel}>{label}</Text>
              <Text translate={false} style={s.medDetailValue}>{value}</Text>
            </View>
          ))}
        </View>
      )}
      {hasValue(m.instructions) && <Text translate={false} style={s.medNote}>{m.instructions}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  doc: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 14, overflow: 'hidden', padding: 18 },

  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  watermark: { width: 230, height: 230, opacity: 0.035, resizeMode: 'contain' },

  letterhead: { paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#A7D8D2' },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headTopWide: { gap: 24 },
  logo: { width: 84, height: 84, resizeMode: 'contain' },
  doctorBlock: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: MUTED },
  doctorName: { fontSize: 19, fontWeight: '800', color: INK, marginTop: 2 },
  doctorLine: { fontSize: 12.5, lineHeight: 18, color: '#334155', marginTop: 1 },
  clinicStrip: { marginTop: 12, backgroundColor: '#F0FDFA', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  clinicLine: { fontSize: 12.5, lineHeight: 18, color: '#334155' },
  clinicName: { fontSize: 13.5, fontWeight: '700', color: TEAL },
  clinicContact: { fontSize: 12, lineHeight: 18, color: MUTED, marginTop: 2 },

  refRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  refChip: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  refLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: MUTED },
  refValue: { fontSize: 14, fontWeight: '800', color: INK, marginTop: 2 },
  rxNumber: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

  patient: { marginTop: 14, backgroundColor: '#F6F8F8', borderRadius: 12, padding: 14 },
  patientName: { fontSize: 17, fontWeight: '800', color: INK, marginTop: 2 },
  patientGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 10 },
  patientField: { width: '50%', paddingRight: 8 },
  patientFieldFull: { width: '100%' },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: MUTED },
  fieldValue: { fontSize: 13.5, fontWeight: '700', color: '#243247', marginTop: 2 },

  rxHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12 },
  rxSymbol: { fontSize: 28, fontWeight: '700', color: TEAL, lineHeight: 32 },
  rxTitle: { fontSize: 20, fontWeight: '800', color: INK },
  rxRule: { flex: 1, height: 1, backgroundColor: LINE, marginLeft: 4 },

  clinical: { gap: 8, marginBottom: 6 },
  clinicalWide: { flexDirection: 'row' },
  clinicalBox: { flex: 1, borderRadius: 10, padding: 11, backgroundColor: '#F0FDFA', borderLeftWidth: 3, borderLeftColor: '#14B8A6' },
  clinicalBoxIndigo: { backgroundColor: '#EEF2FF', borderLeftColor: '#6366F1' },
  clinicalLabelIndigo: { color: '#4338CA' },
  clinicalValue: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: INK, marginTop: 3 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800', color: INK },
  sectionCount: { fontSize: 11, fontWeight: '800', color: '#FFF', backgroundColor: TEAL, minWidth: 20, textAlign: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },

  medList: { gap: 8 },
  medListWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  med: { borderWidth: 1, borderColor: '#CDEDE8', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12 },
  medWide: { width: '49%' },
  medTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  medIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  medIndexText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  medName: { fontSize: 15, fontWeight: '800', color: INK },
  medStrength: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  medDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginLeft: 34 },
  medDetail: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  medDetailLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: MUTED },
  medDetailValue: { fontSize: 12.5, fontWeight: '700', color: '#243247', marginTop: 1 },
  medNote: { fontSize: 12.5, lineHeight: 18, color: '#475569', marginTop: 8, marginLeft: 34, fontStyle: 'italic' },
  emptyBox: { borderWidth: 1, borderColor: LINE, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12 },
  emptyText: { fontSize: 13.5, color: MUTED, textAlign: 'center' },

  testRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 6 },
  testDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#14B8A6', marginTop: 7 },
  testText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: '#334155' },
  testName: { fontWeight: '800', color: INK },
  paragraph: { fontSize: 13.5, lineHeight: 21, color: '#334155' },

  closing: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: LINE, gap: 16 },
  closingWide: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  followUp: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignSelf: 'flex-start' },
  followUpOn: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  followUpOff: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: LINE },
  followUpLabelOn: { color: '#92400E' },
  followUpValue: { fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 2 },
  followUpValueOn: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  signoff: { alignSelf: 'flex-end', alignItems: 'flex-end', minWidth: 170 },
  signatureSpace: { height: 54, width: 170, alignItems: 'flex-end', justifyContent: 'flex-end' },
  signature: { width: '100%', height: '100%', resizeMode: 'contain' },
  signatureLine: { alignSelf: 'stretch', height: 1, backgroundColor: '#94A3B8', marginTop: 4, marginBottom: 6 },
  signName: { fontSize: 14.5, fontWeight: '800', color: INK },
  signMeta: { fontSize: 11.5, color: MUTED, marginTop: 1, textAlign: 'right' },
  signCaption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#94A3B8', marginTop: 4 },

  brandFooter: { marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#CFE3E0', alignItems: 'center', gap: 6 },
  footerCaption: { fontSize: 10, color: MUTED },
  footerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLogo: { width: 26, height: 26, resizeMode: 'contain' },
  footerBrand: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, color: INK },
});
