// Ported from MediconecktApp's src/doctor/dashboard/components/PrescriptionScreen.tsx.
// Adaptation: brand renamed from "Mediconeckt" to "Humaeli".
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { downloadPrescriptionPdf } from '../utils/prescriptionPdf';
import { createDoctorStyles } from '../theme';

const meds = [
  ['1', 'Paracetamol 500mg', '1-0-1 Morning & Evening (After Meals)', '5 Days'],
  ['2', 'Cetirizine 10mg', '0-0-1 Night (Before Sleep)', '3 Days'],
  ['3', 'Amoxicillin 250mg', '1-1-1 Morning, Afternoon & Evening', '5 Days'],
  ['4', 'Pantoprazole 40mg', '1-0-0 Morning (Empty Stomach)', '7 Days'],
];

export default function PrescriptionScreen({ patient, onBack }) {
  return (
    <View style={s.screen}>
      <View style={s.nav}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.navTitle}>Prescription</Text>
        <Pressable onPress={() => void downloadPrescriptionPdf(patient.name)} style={s.downloadButton} hitSlop={8}>
          <AppIcon name="download" size={19} color="#0D9488" strokeWidth={2.2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.brandRow}>
          <View style={s.brandGroup}>
            <View style={s.logo}><Text style={s.logoText}>✚</Text></View>
            <View>
              <Text style={s.brand}>Humaeli</Text>
              <Text style={s.portal}>PROVIDER PORTAL</Text>
            </View>
          </View>
          <View style={s.official}>
            <Text style={s.officialTitle}>OFFICIAL MEDICAL PRESCRIPTION</Text>
            <Text style={s.meta}>ID: PRX-2025-0892</Text>
            <Text style={s.meta}>Date: Oct 24, 2023</Text>
          </View>
        </View>
        <View style={s.blueRule} />
        <View style={s.patientBox}>
          <Info label="PATIENT NAME" value={patient.name} />
          <Info label="AGE" value="45 Years" />
          <Info label="GENDER" value="Male" />
          <Info label="BLOOD GROUP" value="O+" blue />
        </View>
        <Text style={s.section}>▧  Rx Medications</Text>
        <View style={s.table}>
          <View style={[s.row, s.headRow]}>
            <Cell text="#" style={s.c0} />
            <Cell text="MEDICATION NAME" style={s.c1} />
            <Cell text="DOSAGE & FREQUENCY" style={s.c2} />
            <Cell text="DURATION" style={s.c3} />
          </View>
          {meds.map((r) => (
            <View style={s.row} key={r[0]}>
              <Cell text={r[0]} style={s.c0} />
              <Cell text={r[1]} style={[s.c1, s.bold]} />
              <Cell text={r[2]} style={s.c2} />
              <Cell text={r[3]} style={[s.c3, s.duration]} />
            </View>
          ))}
        </View>
        <View style={s.instructions}>
          <Text style={s.instructionTitle}>ⓘ  DOCTOR'S INSTRUCTIONS</Text>
          <Text style={s.instruction}>
            Take medicine strictly after meals unless specified otherwise.{`\n`}
            Rest well for the next 3 days and stay hydrated (minimum 3L water/day).{`\n`}
            Follow up after 5 days if symptoms persist.
          </Text>
        </View>
        <View style={s.footer}>
          <View>
            <View style={s.signature}><Text style={s.sign}>Sarah Jenkins</Text></View>
            <Text style={s.doctor}>Dr. Sarah Jenkins, MD</Text>
            <Text style={s.role}>GENERAL PHYSICIAN</Text>
            <Text style={s.role}>Reg No: MED-889021</Text>
          </View>
          <View style={s.verify}>
            <View style={s.qr}><AppIcon name="qr" size={30} color="#26364D" strokeWidth={1.6} /></View>
            <Text style={s.scan}>SCAN TO VERIFY</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
function Info({ label, value, blue }) {
  return <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={[s.infoValue, blue && s.blue]}>{value}</Text></View>;
}
function Cell({ text, style }) {
  return <Text style={[s.cell, style]}>{text}</Text>;
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#EEF2F7' },
  nav: { height: 62, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#D8DFE9' },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  navTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: '#0D9488' },
  downloadButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  page: { backgroundColor: '#FFF', margin: 8, padding: 18, minHeight: 700 },
  brandRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  brandGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  logo: { width: 38, height: 38, backgroundColor: '#F1FAFA', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  logoText: { fontSize: 20, color: '#20A69A' },
  brand: { fontSize: 17, fontWeight: '700', color: '#0D9488' },
  portal: { fontSize: 10, fontWeight: '600', color: '#526078' },
  official: { alignItems: 'flex-end', flexShrink: 1, marginLeft: 12 },
  officialTitle: { fontSize: 12, fontWeight: '700', color: '#26364D', textAlign: 'right' },
  meta: { fontSize: 11, color: '#526078', marginTop: 2, textAlign: 'right' },
  blueRule: { height: 2, backgroundColor: '#0D9488', marginVertical: 18 },
  patientBox: { height: 58, borderWidth: 1, borderColor: '#BFE9EA', borderRadius: 5, backgroundColor: '#E8F0FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  info: { flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#596579' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#243249', marginTop: 5 },
  blue: { color: '#0D9488' },
  section: { fontSize: 14, fontWeight: '700', color: '#26364D', marginTop: 20, marginBottom: 9 },
  table: { borderWidth: 1, borderColor: '#C7D2E3', borderRadius: 5, overflow: 'hidden' },
  row: { minHeight: 37, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#D7DEE9' },
  headRow: { minHeight: 31, backgroundColor: '#E8F0FF' },
  cell: { fontSize: 11, color: '#344054' },
  c0: { width: '7%' },
  c1: { width: '28%' },
  c2: { width: '48%' },
  c3: { width: '17%', textAlign: 'right' },
  bold: { fontWeight: '600' },
  duration: { fontWeight: '700', color: '#0D9488' },
  instructions: { marginTop: 64, borderLeftWidth: 3, borderLeftColor: '#0D9488', backgroundColor: '#F7F9FD', borderWidth: 1, borderColor: '#DCE3ED', padding: 14 },
  instructionTitle: { fontSize: 11, fontWeight: '700', color: '#526078' },
  instruction: { fontSize: 12, lineHeight: 18, color: '#344054', marginTop: 7 },
  footer: { borderTopWidth: 1, borderTopColor: '#D8DFE9', marginTop: 30, paddingTop: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  signature: { width: 130, height: 30, borderBottomWidth: 1, borderBottomColor: '#99A4B5' },
  sign: { fontSize: 14, fontStyle: 'italic', color: '#637083' },
  doctor: { fontSize: 13, fontWeight: '700', color: '#344054', marginTop: 6 },
  role: { fontSize: 10, color: '#667085', marginTop: 3 },
  verify: { alignItems: 'center' },
  qr: { width: 52, height: 52, borderWidth: 5, borderColor: '#E1E8F2', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  scan: { fontSize: 10, fontWeight: '600', color: '#667085', marginTop: 5 },
});
