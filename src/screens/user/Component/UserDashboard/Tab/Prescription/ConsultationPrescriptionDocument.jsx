// The in-app prescription page — the web's common/PrescriptionDocument.jsx as
// it shows on a phone (its ≤650px stylesheet), so the doctor, the reception
// desk and the patient see the same page they download as a PDF:
// letterhead (logo + clinic, consulting doctor, booking QR), patient table,
// "Consultation Prescription", consultation / diagnosis, medicines table,
// advice, notes, tests, follow-up and sign-off, contact and brand footers.
// A consultant / psychiatrist page (`data.variant === 'consultant'`) is the
// same page in the consultant blue, on its festival theme, with the patient's
// photo where a doctor's booking QR would be — and never a QR.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Text from '../../../../../../components/TranslatedText';
import {
  documentDate,
  isConsultantDocument,
  medicineDuration,
  medicineTiming,
  testLine,
} from '../../../../../../utils/consultationPrescriptionDocument';
import { withBookingQr } from '../../../../../../utils/prescriptionBookingQr';
import { getPrescriptionFestivalTheme } from '../../../../../../utils/prescriptionFestivalThemes';

const BRAND = require('../../../../../../image/prescriptionBrand.png');
// The web uses its round logo icon for both the watermark and the footer mark.
const LOGO_ICON = require('../../../../../../image/prescriptionWatermark.png');

const MUTED = '#64748B';
const RULE = '#CBD5E1';

// Doctor teal (the web page) and the consultant blue — the same page in two
// colours, matching the PDF's stylesheet swap.
const DOCTOR_PALETTE = {
  ink: '#183B3B', accent: '#0F766E', soft: '#F0FDFA', line: '#CCE7E2',
  chipBg: '#E7F4F1', chipInk: '#32645E', qualification: '#405F60', qrBorder: '#D9E9E5', contactRule: '#99DED5',
};
const CONSULTANT_PALETTE = {
  ink: '#0F2A5F', accent: '#1D4ED8', soft: '#EFF6FF', line: '#BFDBFE',
  chipBg: '#DBEAFE', chipInk: '#1E40AF', qualification: '#1E3A8A', qrBorder: '#BFDBFE', contactRule: '#93C5FD',
};

const has = (value) => Boolean(String(value ?? '').trim());
// A clinical text that was actually written ('—' is the "not recorded" mark).
const recorded = (value) => (has(value) && String(value).trim() !== '—' ? String(value) : '');
// [a, b, c] → [[a, b], [c]]: patient cells two to a row.
const pairs = (cells) => cells.reduce((rows, cell, index) => (index % 2 ? rows[rows.length - 1].push(cell) : rows.push([cell]), rows), []);

// The largest the doctor's signature is drawn, as on the PDF.
const SIGNATURE_BOX = { width: 145, height: 46 };

// The PDF's medicine table columns (S. No. / name / dosage / duration /
// instructions), so the page and the download match.
const COLUMNS = [['S. No.', 9], ['Medicine name', 33], ['Dosage', 18], ['Duration', 16], ['Instructions', 24]];

// `data` is doctorRxToDocument(rx) / appointmentToDocument(appointment), or a
// consultant prescription's document (variant 'consultant', themeId, photoUri,
// identityVerified).
// `bleed`: the horizontal padding of the screen it sits in — the page spreads
// over it to the screen edges (full width) instead of sitting inset.
export default function ConsultationPrescriptionDocument({ data, bleed = 0 }) {
  const consultant = isConsultantDocument(data);
  const s = consultant ? CONSULTANT_STYLES : DOCTOR_STYLES;
  const palette = consultant ? CONSULTANT_PALETTE : DOCTOR_PALETTE;
  const themeImage = consultant ? data.themeImage || getPrescriptionFestivalTheme(data.themeId).image : null;
  // Small phones: a smaller logo and QR so the letterhead fits without cutting
  // anything off.
  const compact = useWindowDimensions().width < 400;
  const [bookingQr, setBookingQr] = useState(consultant ? '' : data.bookingQr || '');
  // The signature drawn at its own shape (at most 145 × 46) so it sits right on
  // the doctor's name; a fixed box with "contain" left a gap under a wide one.
  const [signatureSize, setSignatureSize] = useState(SIGNATURE_BOX);
  // The page's measured size: the theme picture is drawn at exactly that, since
  // an Image without a size falls back to the picture's own small size.
  const [pageSize, setPageSize] = useState(null);
  useEffect(() => {
    let active = true;
    setSignatureSize(SIGNATURE_BOX);
    if (data.signature) {
      Image.getSize?.(data.signature, (width, height) => {
        if (!active || !(width > 0) || !(height > 0)) return;
        const scale = Math.min(SIGNATURE_BOX.width / width, SIGNATURE_BOX.height / height);
        setSignatureSize({ width: Math.round(width * scale), height: Math.round(height * scale) });
      }, () => {});
    }
    return () => { active = false; };
  }, [data.signature]);
  useEffect(() => {
    let active = true;
    // Consultant pages never show a booking QR.
    setBookingQr(consultant ? '' : data.bookingQr || '');
    if (!consultant && !data.bookingQr && data.doctorId) {
      withBookingQr(data).then((loaded) => { if (active) setBookingQr(loaded.bookingQr || ''); });
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultant, data.doctorId, data.bookingQr]);

  const gender = has(data.gender) && data.gender !== '—' ? data.gender : '';
  const ageGender = [has(data.age) && `${data.age} years`, gender].filter(Boolean).join(' / ');
  const weight = has(data.weight) ? `${data.weight}${/kg/i.test(String(data.weight)) ? '' : ' kg'}` : '';
  const medicines = Array.isArray(data.medicines) ? data.medicines : [];
  const tests = Array.isArray(data.tests) ? data.tests : [];
  const advice = String(data.advice || '');
  const adviceLines = advice.split(/\n+/).map((line) => line.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
  const contact = [data.doctorPhone, data.doctorEmail].filter(has).join(' | ');
  const followUp = data.followUp ? documentDate(data.followUp) : data.followUpRequired ? 'Required' : 'No follow-up scheduled';
  const showIdentity = consultant && typeof data.identityVerified === 'boolean';
  // A consultant page lists only what was recorded (two cells a row); the
  // doctor page keeps every row, with "-" for anything missing.
  const patientRows = consultant
    ? pairs([['Patient name', data.patient], ['Date', data.date], ['Age / Gender', ageGender],
      ['Contact No.', data.phone], ['Weight', weight], ['OPD / Token No.', data.opd],
      ['Prescription No.', data.prescriptionId]].filter(([, value]) => has(value) && value !== '—'))
    : [[['Patient name', data.patient], ['Date', data.date]], [['Age / Gender', ageGender], ['OPD / Token No.', data.opd]],
      [['Weight', weight], ['Prescription No.', data.prescriptionId]], [['Contact No.', data.phone]]];
  const issue = recorded(data.issue);
  const diagnosis = recorded(data.diagnosis);
  const clinicalCells = consultant
    ? [issue && ['Consultation for: ', issue], diagnosis && ['Diagnosis: ', diagnosis]].filter(Boolean)
    : [['Consultation for: ', data.issue || '—'], ['Diagnosis: ', data.diagnosis || '—']];

  return (
    <View
      style={[s.doc, bleed > 0 && s.docBleed, bleed > 0 && { marginHorizontal: -bleed }]}
      onLayout={themeImage ? ({ nativeEvent: { layout } }) => setPageSize((current) => (
        current && current.width === layout.width && current.height === layout.height ? current : { width: layout.width, height: layout.height }
      )) : undefined}
    >
      {themeImage ? (
        !!pageSize && (
        // The festival theme fills the page; its artwork replaces the watermark.
        <Image pointerEvents="none" source={themeImage} style={[s.themeBackground, pageSize]} resizeMode="stretch" accessible={false} />
        )
      ) : (
        <View pointerEvents="none" style={s.watermarkWrap}>
          <Image source={LOGO_ICON} style={s.watermark} accessible={false} />
        </View>
      )}

      {/* Letterhead */}
      <LinearGradient colors={[palette.soft, '#FFFFFF']} start={{ x: 0, y: 0.2 }} end={{ x: 0.75, y: 0.8 }} style={[s.header, compact && s.headerCompact]}>
        <View style={[s.brand, compact && s.brandCompact]}>
          <Image source={BRAND} style={[s.brandLogo, compact && s.brandLogoCompact]} accessibilityLabel="Humaeli - Talk. Connect. Feel Supported." />
          {has(data.clinic) && <Text translate={false} style={s.brandClinic}>{data.clinic}</Text>}
        </View>
        <View style={[s.issuer, compact && s.issuerCompact]}>
          <Text style={s.issuerLabel}>{consultant ? 'CONSULTANT' : 'CONSULTING DOCTOR'}</Text>
          <Text translate={false} style={[s.issuerName, compact && s.issuerNameCompact]}>{data.doctor}</Text>
          {has(data.qualification) && <Text translate={false} style={s.qualification}>{data.qualification}</Text>}
          {has(data.specialization) && <Text translate={false} style={s.specialization}>{data.specialization}</Text>}
          {has(data.registration) && (
            <View style={s.regChip}>
              <MaterialCommunityIcons name="stethoscope" size={11} color={palette.chipInk} />
              <Text translate={false} style={s.regText}>Reg. No.: {data.registration}</Text>
            </View>
          )}
        </View>
        {!!bookingQr && (
          <View style={[s.qr, compact && s.qrCompact]}>
            <Image source={{ uri: bookingQr }} style={[s.qrImage, compact && s.qrImageCompact]} accessibilityLabel="Doctor appointment booking QR" />
            <Text style={s.qrText}>Scan to book{'\n'}an appointment</Text>
          </View>
        )}
        {/* Consultant: the patient's photo (identity check) in the QR's place. */}
        {consultant && !!data.photoUri && (
          <View style={[s.qr, compact && s.qrCompact]}>
            <Image source={{ uri: data.photoUri }} style={[s.qrImage, s.photo, compact && s.qrImageCompact]} accessibilityLabel="Patient photo" />
            <Text style={s.qrText}>Patient photo</Text>
            {showIdentity && (
              <View style={s.identity}>
                <Ionicons name={data.identityVerified ? 'shield-checkmark' : 'time-outline'} size={9} color={data.identityVerified ? '#166534' : '#B45309'} />
                <Text style={[s.identityText, { color: data.identityVerified ? '#166534' : '#B45309' }]}>
                  {data.identityVerified ? 'Verified' : 'Pending'}
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Patient and visit details */}
      <View style={s.patient}>
        {patientRows.map((cells, index) => (
          <PatientRow key={cells[0][0]} s={s} first={index === 0} cells={cells} stacked={consultant} />
        ))}
      </View>

      <Text style={s.title}>CONSULTATION PRESCRIPTION</Text>

      {clinicalCells.length > 0 && (
        <View style={s.clinical}>
          {clinicalCells.map(([label, value], index) => (
            <Text
              key={label}
              translate={false}
              style={[s.clinicalText, label === 'Diagnosis: ' ? s.clinicalDiagnosis : s.clinicalIssue, index > 0 && s.clinicalSecond]}
            >
              <Text style={s.bold}>{label}</Text>{value}
            </Text>
          ))}
        </View>
      )}

      {/* Medicines */}
      <View style={s.section}>
        <Text style={s.sectionHead}>Prescribed Medicines</Text>
        {/* The PDF's table: S. No., name, dosage, duration, instructions. */}
        {medicines.length ? (
          <View style={s.table}>
            <View style={[s.tr, s.thRow]}>
              {COLUMNS.map(([label, width], index) => (
                <Text key={label} style={[s.cell, s.th, { width: `${width}%` }, index === COLUMNS.length - 1 && s.lastCell]}>{label}</Text>
              ))}
            </View>
            {medicines.map((m, row) => {
              const values = [
                String(row + 1),
                m.name || m.medicine || '-',
                m.dosage || '-',
                medicineDuration(m) || '-',
                [medicineTiming(m), m.instructions].filter(Boolean).join(' / ') || '-',
              ];
              return (
                <View key={row} style={[s.tr, s.tdRow, row < medicines.length - 1 && s.trDivider]}>
                  {values.map((value, index) => (
                    <Text
                      key={COLUMNS[index][0]}
                      translate={false}
                      style={[s.cell, s.td, { width: `${COLUMNS[index][1]}%` }, index === 1 && s.bold, index === values.length - 1 && s.lastCell]}
                    >
                      {value}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
          <Text translate={false} style={s.noMedicines}>{data.medicine || 'No medicines prescribed.'}</Text>
        )}
      </View>

      {!!advice && (
        <View style={[s.section, s.boxed]}>
          <Text style={[s.sectionHead, s.headInBox, s.adviceHead]}>Advice & Instructions</Text>
          {adviceLines.length > 1 ? (
            <View style={s.boxBody}>
              {adviceLines.map((line, index) => (
                <View key={index} style={s.bulletRow}>
                  <Text style={s.bullet}>{'•'}</Text>
                  <Text translate={false} style={s.bodyText}>{line}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text translate={false} style={[s.bodyText, s.boxBody]}>{advice}</Text>
          )}
        </View>
      )}

      {tests.length > 0 && (
        <View style={[s.section, s.boxed]}>
          <Text style={[s.sectionHead, s.headInBox, s.testsHead]}>Recommended tests</Text>
          {tests.map((test, index) => (
            <Text key={index} translate={false} style={[s.bodyText, s.boxBody, index > 0 && s.testDivider]}>
              <Text style={s.bold}>{test.testName || test.name}</Text>{testLine(test)}
            </Text>
          ))}
        </View>
      )}

      {/* Follow-up and sign-off (consultant prescriptions have no follow-up:
          the sign-off sits on the right alone). */}
      <View style={[s.footer, consultant && s.footerSignOnly]}>
        {!consultant && (
          <View style={s.followUp}>
            <MaterialCommunityIcons name="calendar-month-outline" size={20} color={palette.accent} />
            <View style={s.followUpText}>
              <Text style={s.followUpLabel}>Next Follow-up:</Text>
              <Text translate={false} style={s.followUpValue}>{followUp}</Text>
            </View>
          </View>
        )}
        {/* Signature sits right above the doctor's name, centred on it. */}
        <View style={s.signoff}>
          {!!data.signature && (
            <View style={s.signatureSpace}>
              <Image source={{ uri: data.signature }} style={[s.signature, signatureSize]} accessibilityLabel={consultant ? 'Consultant signature' : 'Doctor signature'} />
            </View>
          )}
          <Text translate={false} style={[s.signName, !!data.signature && s.signNameWithSignature]}>{data.doctor}</Text>
          {has(data.qualification) && <Text translate={false} style={s.signMeta}>{data.qualification}</Text>}
          {has(data.registration) && <Text translate={false} style={s.signMeta}>Reg. No.: {data.registration}</Text>}
        </View>
      </View>

      {(has(data.address) || !!contact) && (
        <View style={s.contactFooter}>
          {has(data.address) && <Text translate={false} style={s.contactText}>{data.address}</Text>}
          <Text translate={false} style={s.contactText}>{contact}</Text>
        </View>
      )}

      <View style={s.brandFooter}>
        <Text style={s.brandFooterText}>This prescription is provided by</Text>
        <View style={s.brandFooterMark}>
          <Image source={LOGO_ICON} style={s.brandFooterLogo} accessible={false} />
          <Text translate={false} style={s.brandFooterName}>HUMAELI</Text>
        </View>
        <Text style={s.brandFooterText}>Talk. Connect. Feel Supported.</Text>
      </View>
    </View>
  );
}

// One row of the patient table: two label / value cells, or one wide cell.
// `stacked` (consultant page): the label sits small above its value, so a
// name or date keeps the whole cell width and stays on one line.
function PatientRow({ s, cells, first, stacked }) {
  return (
    <View style={[s.patientRow, first && s.patientRowFirst, !first && s.patientRowRule]}>
      {cells.map(([label, value], index) => (
        <View key={label} style={[s.patientCell, stacked && s.patientCellStacked, index > 0 && s.patientCellRule]}>
          <Text style={[s.patientLabel, stacked && s.patientLabelStacked]} numberOfLines={1}>{label}</Text>
          <Text translate={false} style={[s.patientValue, first && index === 0 && s.patientValueStrong]}>{has(value) ? value : '-'}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (p) => StyleSheet.create({
  bold: { fontWeight: '700' },
  doc: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D4D7DB', paddingVertical: 18, paddingHorizontal: 10, overflow: 'hidden' },
  docBleed: { borderLeftWidth: 0, borderRightWidth: 0 },
  // Sized to the measured page (see pageSize): a 100% width is measured inside
  // the page's padding and left a bare strip down the right side.
  themeBackground: { position: 'absolute', top: 0, left: 0 },
  watermarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: '10%' },
  watermark: { width: '65%', maxWidth: 320, aspectRatio: 1, opacity: 0.055, resizeMode: 'contain' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10,
    borderWidth: 1, borderColor: p.line, borderTopWidth: 5, borderTopColor: p.accent, borderBottomWidth: 3, borderBottomColor: p.accent,
    borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
  },
  headerCompact: { gap: 6, padding: 8 },
  brand: { width: 76, alignItems: 'center' },
  brandCompact: { width: 58 },
  brandLogo: { width: 72, height: 60, resizeMode: 'contain' },
  brandLogoCompact: { width: 56, height: 46 },
  brandClinic: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: '700', color: p.accent, textAlign: 'center' },
  issuer: { flex: 1, minWidth: 0, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: p.line },
  issuerCompact: { paddingLeft: 7 },
  issuerLabel: { marginBottom: 4, fontSize: 8, fontWeight: '700', letterSpacing: 1, color: p.accent },
  issuerName: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: p.ink, letterSpacing: -0.3, marginBottom: 4 },
  issuerNameCompact: { fontSize: 14, lineHeight: 18 },
  qualification: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: p.qualification, marginVertical: 2 },
  specialization: { fontSize: 11, lineHeight: 15, color: p.accent, marginVertical: 2 },
  regChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 4, paddingVertical: 3, borderRadius: 5, backgroundColor: p.chipBg, borderWidth: 1, borderColor: p.line,
  },
  regText: { fontSize: 9, color: p.chipInk },
  qr: { width: 72, alignItems: 'center', gap: 3, padding: 4, borderRadius: 9, borderWidth: 1, borderColor: p.qrBorder, backgroundColor: '#FFFFFF' },
  qrCompact: { width: 60, padding: 3 },
  qrImage: { width: 60, height: 60, borderWidth: 1, borderColor: '#E2E8F0' },
  qrImageCompact: { width: 50, height: 50 },
  qrText: { fontSize: 8, lineHeight: 11, fontWeight: '600', color: p.chipInk, textAlign: 'center' },
  photo: { borderRadius: 6, resizeMode: 'cover' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  identityText: { fontSize: 7.5, fontWeight: '700' },

  patient: { marginVertical: 10, borderWidth: 1, borderColor: RULE, backgroundColor: '#FFFFFF' },
  patientRow: { flexDirection: 'row' },
  patientRowFirst: { backgroundColor: p.soft },
  patientRowRule: { borderTopWidth: 1, borderTopColor: RULE },
  patientCell: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
  patientCellRule: { borderLeftWidth: 1, borderLeftColor: RULE },
  patientLabel: { width: 64, fontSize: 11, lineHeight: 15, color: MUTED },
  patientCellStacked: { flexDirection: 'column', gap: 1 },
  patientLabelStacked: { width: 'auto', fontSize: 10, lineHeight: 13 },
  patientValue: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 15, fontWeight: '600', color: p.ink },
  patientValueStrong: { fontWeight: '700' },

  title: {
    textAlign: 'center', marginBottom: 9, fontSize: 16, lineHeight: 22, fontWeight: '700', color: p.ink,
    textDecorationLine: 'underline',
  },

  clinical: { flexDirection: 'row', marginBottom: 10, borderWidth: 1, borderColor: RULE },
  clinicalText: { flex: 1, minWidth: 0, paddingVertical: 5, paddingHorizontal: 8, fontSize: 12.5, lineHeight: 19, color: p.ink },
  clinicalSecond: { borderLeftWidth: 1, borderLeftColor: RULE },
  clinicalIssue: { backgroundColor: p.soft },
  clinicalDiagnosis: { backgroundColor: '#EEF2FF' },

  section: { marginBottom: 10 },
  sectionHead: {
    paddingVertical: 5, paddingHorizontal: 9, fontSize: 14, lineHeight: 20, fontWeight: '700', color: p.ink,
    backgroundColor: p.soft, borderWidth: 1, borderColor: '#E2E8F0',
  },
  boxed: { borderWidth: 1, borderColor: RULE, backgroundColor: '#FFFFFF' },
  headInBox: { borderWidth: 0, borderBottomWidth: 1, borderBottomColor: RULE },
  adviceHead: { backgroundColor: '#FFFBEB', color: '#B45309' },
  testsHead: { backgroundColor: '#EEF2FF', color: '#6366F1' },
  boxBody: { paddingVertical: 6, paddingHorizontal: 12 },
  bodyText: { flexShrink: 1, fontSize: 13, lineHeight: 19, color: p.ink },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 6 },
  bullet: { fontSize: 13, lineHeight: 19, color: p.ink },
  testDivider: { borderTopWidth: 1, borderTopColor: '#E1DCE6' },

  // The PDF's table: a dark header with white text, slate rules.
  table: { borderWidth: 1, borderTopWidth: 0, borderColor: RULE },
  tr: { flexDirection: 'row' },
  tdRow: { backgroundColor: '#FFFFFF' },
  trDivider: { borderBottomWidth: 1, borderBottomColor: RULE },
  thRow: { backgroundColor: p.accent, borderBottomWidth: 1, borderBottomColor: RULE },
  cell: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 11, lineHeight: 15, borderRightWidth: 1, borderRightColor: RULE },
  th: { color: '#FFFFFF', fontWeight: '700', fontSize: 10.5 },
  td: { color: p.ink },
  lastCell: { borderRightWidth: 0 },
  noMedicines: { padding: 9, borderWidth: 1, borderTopWidth: 0, borderColor: '#E2E8F0', fontSize: 13, lineHeight: 20, color: p.ink, backgroundColor: '#FFFFFF' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, minHeight: 84, paddingTop: 3, paddingBottom: 10 },
  footerSignOnly: { justifyContent: 'flex-end' },
  followUp: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 8, maxWidth: '50%' },
  followUpText: { flexShrink: 1, gap: 5 },
  followUpLabel: { fontSize: 13, fontWeight: '700', color: p.ink },
  followUpValue: { fontSize: 12, color: p.ink },
  signoff: { maxWidth: '50%', alignItems: 'center' },
  // Content-height only: a fixed 46px slot left a visible blank band above the
  // doctor's name whenever the saved signature was shorter (or absent).
  signatureSpace: { justifyContent: 'flex-end', alignItems: 'center', margin: 0, padding: 0 },
  signature: { resizeMode: 'contain' },
  signName: { fontSize: 14, fontWeight: '700', color: p.accent, textAlign: 'center', marginTop: 0 },
  // Uploaded signatures can contain a little transparent canvas below the
  // ink. Pull the name into that canvas so the two look visually attached.
  signNameWithSignature: { marginTop: -8 },
  signMeta: { fontSize: 11, lineHeight: 15, color: p.ink, textAlign: 'center' },

  contactFooter: { borderTopWidth: 1, borderTopColor: p.contactRule, paddingTop: 7, paddingBottom: 3, alignItems: 'center' },
  contactText: { fontSize: 11, lineHeight: 16, color: p.accent, textAlign: 'center' },
  brandFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 9, rowGap: 2, paddingTop: 7 },
  brandFooterText: { fontSize: 8, color: '#59616C' },
  brandFooterMark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandFooterLogo: { width: 16, height: 16, resizeMode: 'contain' },
  brandFooterName: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: p.accent },
});

const DOCTOR_STYLES = makeStyles(DOCTOR_PALETTE);
const CONSULTANT_STYLES = makeStyles(CONSULTANT_PALETTE);
