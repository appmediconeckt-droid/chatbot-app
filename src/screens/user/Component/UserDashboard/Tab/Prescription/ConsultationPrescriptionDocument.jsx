// Port of the web's common/PrescriptionDocument.jsx — the doctor prescription
// the web patient Prescriptions tab shows — with PrescriptionDocument.css:
// desktop layout from 600px wide, the web's phone layout below that.
import React from 'react';
import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Text from '../../../../../../components/TranslatedText';
import {
  followUpText,
  medicineDuration,
  medicineTiming,
  testLine,
} from '../../../../../../utils/consultationPrescriptionDocument';

const BRAND = require('../../../../../../image/prescriptionBrand.png');
const WATERMARK = require('../../../../../../image/prescriptionWatermark.png');

// `data` is doctorRxToDocument(rx).
export default function ConsultationPrescriptionDocument({ data }) {
  const wide = useWindowDimensions().width >= 600;
  return (
    <View style={[s.doc, wide && s.docWide]}>
      <Image source={WATERMARK} style={s.watermark} accessible={false} />
      <View style={[s.header, wide && s.headerWide]}>
        <View style={s.brand}>
          <Image source={BRAND} style={s.logo} accessibilityLabel="Humaeli" />
        </View>
        <View style={s.issuer}>
          <Text style={s.issuerLabel}>Prescribing doctor</Text>
          <Text translate={false} style={s.issuerName}>{data.doctor}</Text>
          {[data.qualification, data.specialization, data.registration && `Reg. No.: ${data.registration}`, data.clinic, data.address, data.doctorPhone, data.doctorEmail].filter(Boolean).map((value, index) => <Text key={index} translate={false} style={s.body}>{value}</Text>)}
        </View>
        <View style={s.reference}>
          <Field label="Date" value={data.date} />
          {!!data.opd && <Field label="OPD / Token No." value={data.opd} />}
          {!!data.prescriptionId && <Field label="Prescription No." value={data.prescriptionId} />}
        </View>
      </View>

      <View style={s.patient}>
        <Field label="Patient name" value={data.patient} style={s.half} />
        <Field label="Patient ID" value={data.patientId} style={s.halfEnd} />
        <Field label="Age / Gender" value={[data.age && `${data.age} years`, data.gender !== '—' && data.gender].filter(Boolean).join(' / ')} style={s.half} />
        <Field label="Weight" value={data.weight && `${data.weight}${/kg/i.test(data.weight) ? '' : ' kg'}`} style={s.halfEnd} />
        <Field label="Contact No." value={data.phone} style={s.half} />
        <Field label="Allergies" value={data.allergies || 'Not recorded'} style={s.halfEnd} />
      </View>
      <View style={s.titleRow}>
        <Text style={s.title}>℞ Prescription</Text>
        {wide && <Text style={s.kicker}>FOR A HEALTHIER YOU</Text>}
      </View>

      <Section
        title="Prescribed medicines"
      >
        {data.medicines.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.tableScroll}>
          <View style={s.table}>
            <View style={[s.row, s.headRow]}>
              <Text style={[s.th, s.colIndex]}>S. No.</Text>
              <Text style={[s.th, s.colName]}>Medicine name</Text>
              <Text style={[s.th, s.col]}>Strength</Text>
              <Text style={[s.th, s.col]}>Dosage</Text>
              <Text style={[s.th, s.col]}>Duration</Text>
              <Text style={[s.th, s.colInstructions]}>Instructions</Text>
            </View>
            {data.medicines.map((m, index) => (
              <View key={index} style={s.row}>
                <Text translate={false} style={[s.td, s.colIndex]}>{index + 1}</Text>
                <Text translate={false} style={[s.td, s.colName, s.bold]}>
                  {m.name || m.medicine || '—'}
                </Text>
                <Text translate={false} style={[s.td, s.col]}>{m.strength || '—'}</Text>
                <Text translate={false} style={[s.td, s.col]}>{m.dosage || '—'}</Text>
                <Text translate={false} style={[s.td, s.col]}>{medicineDuration(m) || '—'}</Text>
                <Text translate={false} style={[s.td, s.colInstructions]}>{[medicineTiming(m), m.instructions].filter(Boolean).join(' / ') || '—'}</Text>
              </View>
            ))}
          </View>
          </ScrollView>
        ) : (
          <Text translate={false} style={s.body}>{data.medicine || 'No medicines prescribed.'}</Text>
        )}
      </Section>

      <View style={[s.clinical, wide && s.footerWide]}>
        <View style={[wide && s.clinicalColumn]}><Section title="Consultation for"><Text translate={false} style={s.body}>{data.issue}</Text></Section></View>
        <View style={[wide && s.clinicalColumn]}><Section title="Diagnosis"><Text translate={false} style={s.body}>{data.diagnosis}</Text></Section></View>
      </View>
      {!!data.advice && (
        <Section title="Advice & instructions">
          <Text translate={false} style={s.body}>{data.advice}</Text>
        </Section>
      )}
      {!!data.notes && data.notes !== data.advice && (
        <Section title="Additional notes">
          <Text translate={false} style={s.body}>{data.notes}</Text>
        </Section>
      )}
      {data.tests.length > 0 && (
        <Section title="Recommended tests">
          {data.tests.map((test, index) => (
            <Text key={index} translate={false} style={s.body}>
              <Text translate={false} style={s.bold}>{test.testName || test.name}</Text>
              {testLine(test)}
            </Text>
          ))}
        </Section>
      )}

      <View style={[s.footer, wide && s.footerWide]}>
        <Field label="Next Follow-up:" value={followUpText(data)} />
        <View style={s.signoff}>
          <View style={s.signatureSpace}>{!!data.signature && <Image source={{ uri: data.signature }} style={s.signature} accessibilityLabel="Doctor signature" />}</View>
          <Field label="Issued by" value={data.doctor} />
          {!!data.qualification && <Text translate={false} style={s.body}>{data.qualification}</Text>}
          {!!data.registration && <Text translate={false} style={s.body}>Reg. No.: {data.registration}</Text>}
        </View>
      </View>
      <View style={s.brandFooter}>
        <Text style={s.footerCaption}>This prescription is provided by</Text>
        <Text translate={false} style={s.footerBrand}>♥ HUMAELI</Text>
        <Text translate={false} style={s.footerCaption}>Talk. Connect. Feel Supported.</Text>
      </View>
    </View>
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

function Field({ label, value, style }) {
  return (
    <View style={[s.field, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text translate={false} style={s.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  watermark: { position: 'absolute', right: 0, bottom: 100, width: 170, height: 170, opacity: 0.045, resizeMode: 'contain' },
  brandName: { fontSize: 22, color: '#269B9C', fontWeight: '700' },
  tagline: { fontSize: 8, color: '#193D42' },
  reference: { gap: 12, maxWidth: 180 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  clinical: { gap: 16 },
  clinicalColumn: { flex: 1 },
  signoff: { alignItems: 'flex-end', flexShrink: 1 },
  signatureSpace: { height: 64, width: 160 },
  signature: { width: '100%', height: '100%', resizeMode: 'contain' },
  brandFooter: { borderTopWidth: 1, borderTopColor: '#A7BDBC', marginTop: 60, paddingTop: 16, gap: 10, alignItems: 'center' },
  footerCaption: { fontSize: 9, color: '#64748B' },
  footerBrand: { fontSize: 16, fontWeight: '700', letterSpacing: 1, color: '#193D42' },
  doc: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
  },
  docWide: { padding: 32 },
  header: {
    gap: 14,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#A7BDBC',
  },
  headerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
  },
  brand: { alignItems: 'center', gap: 3 },
  logo: { width: 110, height: 110, resizeMode: 'contain' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#64748B' },
  title: { marginTop: 4, color: '#193D42', fontSize: 26, fontWeight: '700' },
  issuer: { gap: 3, flexShrink: 1 },
  issuerWide: { alignItems: 'flex-end', flexShrink: 1 },
  issuerLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  issuerName: { fontSize: 17, fontWeight: '700', color: '#193D42' },
  issuerDate: { fontSize: 14, color: '#64748B' },
  patient: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    padding: 16,
    marginVertical: 24,
    backgroundColor: '#F1F4F3',
    borderRadius: 10,
  },
  patientWide: { flexWrap: 'nowrap', gap: 20, padding: 20 },
  // Web phone grid: two columns with a 16px gap.
  half: { width: '50%', paddingRight: 8 },
  halfEnd: { width: '50%', paddingLeft: 8 },
  full: { width: '100%' },
  flex12: { flex: 1.2 },
  flex06: { flex: 0.6 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldValue: { fontSize: 14, fontWeight: '700', color: '#243247' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#193D42', marginBottom: 10 },
  rx: { fontSize: 23, color: '#193D42' },
  body: { fontSize: 14, lineHeight: 24, color: '#243247' },
  bold: { fontWeight: '700' },
  table: { minWidth: 760, flexGrow: 1 },
  tableScroll: { flexGrow: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headRow: { backgroundColor: '#DFE9E6' },
  th: { fontSize: 11, fontWeight: '700', color: '#475569', padding: 12 },
  td: { fontSize: 13, color: '#243247', padding: 12 },
  colIndex: { width: 52 },
  colInstructions: { flex: 1.7 },
  colName: { flex: 1.5 },
  col: { flex: 1 },
  footer: {
    gap: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerWide: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
});
