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

const HUMAELI_LOGO = require('../../../../../../image/HumaeliIcon.png');

// `data` is doctorRxToDocument(rx).
export default function ConsultationPrescriptionDocument({ data }) {
  const wide = useWindowDimensions().width >= 600;
  return (
    <View style={[s.doc, wide && s.docWide]}>
      <View style={[s.header, wide && s.headerWide]}>
        <View style={s.brand}>
          <Image source={HUMAELI_LOGO} style={s.logo} />
          <View>
            <Text style={s.kicker}>CONSULTATION RECORD</Text>
            <Text style={s.title}>Prescription</Text>
          </View>
        </View>
        <View style={[s.issuer, wide && s.issuerWide]}>
          <Text style={s.issuerLabel}>Prescribing doctor</Text>
          <Text translate={false} style={s.issuerName}>{data.doctor}</Text>
          <Text translate={false} style={s.issuerDate}>{data.date}</Text>
        </View>
      </View>

      <View style={[s.patient, wide && s.patientWide]}>
        <Field label="Patient name" value={data.patient} style={wide ? s.flex12 : s.half} />
        <Field label="Gender" value={data.gender} style={wide ? s.flex06 : s.halfEnd} />
        <Field label="Consultation for" value={data.issue} style={wide ? s.flex12 : s.full} />
      </View>

      <Section title="Diagnosis">
        <Text translate={false} style={s.body}>{data.diagnosis}</Text>
      </Section>

      <Section
        title={[
          <Text key="rx" translate={false} style={s.rx}>℞</Text>,
          ' Prescribed medicines',
        ]}
      >
        {data.medicines.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.tableScroll}>
          <View style={s.table}>
            <View style={[s.row, s.headRow]}>
              <Text style={[s.th, s.colName]}>Medicine</Text>
              <Text style={[s.th, s.col]}>Dosage</Text>
              <Text style={[s.th, s.col]}>Timing</Text>
              <Text style={[s.th, s.col]}>Duration</Text>
            </View>
            {data.medicines.map((m, index) => (
              <View key={index} style={s.row}>
                <Text translate={false} style={[s.td, s.colName, s.bold]}>
                  {m.name || m.medicine || '—'}
                </Text>
                <Text translate={false} style={[s.td, s.col]}>{m.dosage || '—'}</Text>
                <Text translate={false} style={[s.td, s.col]}>{medicineTiming(m) || '—'}</Text>
                <Text translate={false} style={[s.td, s.col]}>{medicineDuration(m) || '—'}</Text>
              </View>
            ))}
          </View>
          </ScrollView>
        ) : (
          <Text translate={false} style={s.body}>{data.medicine || 'No medicines prescribed.'}</Text>
        )}
      </Section>

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
        <Field label="Follow-up" value={followUpText(data)} />
        <Field label="Issued by" value={data.doctor} />
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
    borderBottomColor: '#2563EB',
  },
  headerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 54, height: 54, resizeMode: 'contain' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#64748B' },
  title: { marginTop: 4, color: '#1E3A8A', fontSize: 26, fontWeight: '700' },
  issuer: { gap: 6 },
  issuerWide: { alignItems: 'flex-end', flexShrink: 1 },
  issuerLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  issuerName: { fontSize: 17, fontWeight: '700', color: '#1E3A8A' },
  issuerDate: { fontSize: 14, color: '#64748B' },
  patient: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    padding: 16,
    marginVertical: 24,
    backgroundColor: '#F3F6FB',
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
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 10 },
  rx: { fontSize: 23, color: '#1E3A8A' },
  body: { fontSize: 14, lineHeight: 24, color: '#243247' },
  bold: { fontWeight: '700' },
  table: { minWidth: 500, flexGrow: 1 },
  tableScroll: { flexGrow: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headRow: { backgroundColor: '#EFF4FC' },
  th: { fontSize: 11, fontWeight: '700', color: '#475569', padding: 12 },
  td: { fontSize: 13, color: '#243247', padding: 12 },
  colName: { flex: 1.3 },
  col: { flex: 1 },
  footer: {
    gap: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerWide: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
});
