// Full-screen prescription the patient opens from a doctor card on the
// Prescriptions tab. Laid out like a real Rx pad: doctor letterhead, patient
// details, diagnosis, the ℞ medicine list with timing chips, advice, tests,
// follow-up and a signature footer.
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Text from '../../../../../../components/TranslatedText';
import { PATIENT_GRADIENT } from '../../../../../../theme/palette';
import {
  downloadPrescriptionPdf,
  printPrescription,
} from '../../../../../../utils/printPrescription';
import { displayDownloadNotification } from '../../../../../../services/notificationService';
import { PrescriptionPaper } from '../../../counselor-dashboard/Tab/Prescriptions/PrescriptionReviews';
import { doctorRxToPaper } from '../../../../../../utils/prescriptionPaper';
import {
  DEFAULT_PRESCRIPTION_THEME_ID,
  getPrescriptionFestivalTheme,
} from '../../../../../../utils/prescriptionFestivalThemes';

// Doctor prescriptions have no theme picker — the default page background.
const DOCTOR_PAPER_THEME = getPrescriptionFestivalTheme(DEFAULT_PRESCRIPTION_THEME_ID);

// Patient-side screens use the green patient gradient; only the role badge
// says whether a doctor or a psychiatrist wrote the prescription.
const THEME = {
  gradient: PATIENT_GRADIENT,
  accent: '#006B2C',
  soft: '#F0FDF4',
  border: '#BBF7D0',
};

const formatLongDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// A Modal is its own native window, so it gets its own SafeAreaProvider: the
// insets are then measured for this window (status bar + navigation bar).
export default function DoctorPrescriptionView({ rx, onClose }) {
  if (!rx) return null;
  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <PrescriptionContent rx={rx} onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  );
}

// Plain-text copy of one visit's prescription for the share sheet
// (WhatsApp, email, Drive…).
const prescriptionText = rx => {
  const lines = [
    rx.clinic?.name || 'Humaeli',
    rx.clinic?.location,
    '',
    `${rx.doctorName} — ${rx.specialization}`,
    `Patient: ${rx.patientName || '—'}    Date: ${formatLongDate(rx.date)}`,
    rx.rxNumber ? `Rx No: ${rx.rxNumber}` : '',
    rx.diagnosis ? `\nDiagnosis: ${rx.diagnosis}` : '',
    '\nMedicines:',
    ...(rx.medicines.length
      ? rx.medicines.map(
          (m, i) =>
            `${i + 1}. ${m.name}${[m.dosage, m.timings.join(', '), m.duration]
              .filter(Boolean)
              .map(part => ` | ${part}`)
              .join('')}`,
        )
      : ['No medicines prescribed.']),
    rx.advice ? `\nAdvice: ${rx.advice}` : '',
    rx.tests.length ? `Recommended tests: ${rx.tests.join(', ')}` : '',
    rx.followUpDate ? `Follow-up: ${formatLongDate(rx.followUpDate)}` : '',
    '\nDigitally issued by Humaeli',
  ];
  return lines.filter(line => line !== undefined && line !== '').join('\n');
};

// `group` holds every visit with this doctor (newest first) in `visits`; the
// tabs switch which visit's prescription is shown.
function PrescriptionContent({ rx: group, onClose }) {
  const insets = useSafeAreaInsets();
  // The header sits under the status bar; never let it ride under the
  // battery/clock even if the inset reads 0 on some Android modal windows.
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );
  const scrollRef = useRef(null);
  const visits = group.visits?.length ? group.visits : [group];
  const [visitIndex, setVisitIndex] = useState(0);
  const rx = visits[visitIndex] || visits[0];
  const selectVisit = index => {
    setVisitIndex(index);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const shareAsText = () =>
    Share.share({
      title: `Prescription — ${rx.doctorName}`,
      message: prescriptionText(rx),
    }).catch(() => {});
  // Builds the prescription PDF (green letterhead, ℞ table, signature) and
  // saves it straight to the phone's Downloads folder — like a browser
  // download: no dialog, just a short confirmation.
  const [makingPdf, setMakingPdf] = useState(false);
  const handleDownloadPdf = async () => {
    if (makingPdf) return;
    setMakingPdf(true);
    try {
      const { path, cachePath } = await downloadPrescriptionPdf(rx);
      const fileName = path.split('/').pop();
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Downloaded: ${fileName}`, ToastAndroid.SHORT);
      } else {
        Alert.alert('PDF downloaded', fileName);
      }
      // Status-bar "Download complete" notification; tapping it opens the PDF.
      displayDownloadNotification({ fileName, openPath: cachePath }).catch(() => {});
    } catch (error) {
      Alert.alert(
        'Prescription PDF',
        error?.code === 'PRINT_UNAVAILABLE'
          ? 'The PDF will work after the app is updated. You can share it as text for now.'
          : error?.message || 'Could not create the PDF.',
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Share as text', onPress: shareAsText },
        ],
      );
    } finally {
      setMakingPdf(false);
    }
  };
  // Android print dialog — a printer, or "Save as PDF".
  const [printing, setPrinting] = useState(false);
  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printPrescription(rx);
    } catch (error) {
      Alert.alert(
        'Print',
        error?.code === 'PRINT_UNAVAILABLE'
          ? 'Printing will work after the app is updated.'
          : error?.message || 'Could not open the print screen.',
      );
    } finally {
      setPrinting(false);
    }
  };
  const theme = THEME;

  return (
    <View style={styles.root}>
      {/* Status-bar area stays white (dark icons); the green header starts
          below it so it never sits behind the clock / battery. */}
      <View style={{ height: topInset, backgroundColor: '#FFFFFF' }} />
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topBar, { paddingTop: 10 }]}
      >
        <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.topBarText}>
          <Text style={styles.topBarTitle}>Prescription</Text>
          {!!rx.rxNumber && (
            <Text translate={false} style={styles.topBarSub}>
              {rx.rxNumber}
            </Text>
          )}
        </View>
      </LinearGradient>

      {visits.length > 1 && (
        <View style={styles.visitBar}>
          <Text style={styles.visitBarTitle}>
            {visits.length} visits with {group.doctorName}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.visitTabs}
          >
            {visits.map((visit, index) => {
              const active = index === visitIndex;
              return (
                <Pressable
                  key={visit.id}
                  onPress={() => selectVisit(index)}
                  style={[styles.visitTab, active && styles.visitTabActive]}
                >
                  <Text
                    style={[
                      styles.visitTabTitle,
                      active && styles.visitTabTextActive,
                    ]}
                  >
                    {index === 0 ? 'Latest' : `Visit ${visits.length - index}`}
                  </Text>
                  <Text
                    translate={false}
                    style={[
                      styles.visitTabDate,
                      active && styles.visitTabTextActive,
                    ]}
                  >
                    {formatLongDate(visit.date)} • {visit.medicines.length} med
                    {visit.medicines.length === 1 ? '' : 's'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Same prescription page as the psychiatrist preview (PrescriptionPaper),
            filled with this visit; doctor-only parts (diagnosis, advice, tests,
            notes, follow-up) use the paper's complaint / instruction styles. */}
        <PrescriptionPaper
          {...doctorRxToPaper(rx)}
          themeImage={DOCTOR_PAPER_THEME.image}
          patientName={rx.patientName || 'You'}
        />
        <View style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#64748B"
          />
          <Text style={styles.disclaimerText}>
            Take medicines only as prescribed. Contact your doctor if symptoms
            get worse.
          </Text>
        </View>
      </ScrollView>

      {/* Actions — sticky, above the system navigation bar */}
      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 10) + 6 },
        ]}
      >
        <Pressable
          onPress={handlePrint}
          disabled={printing}
          style={[
            styles.actionBtn,
            styles.actionBtnOutline,
            printing && styles.actionBusy,
          ]}
          accessibilityLabel="Print prescription"
        >
          {printing ? (
            <ActivityIndicator size="small" color="#006B2C" />
          ) : (
            <Ionicons name="print-outline" size={19} color="#006B2C" />
          )}
          <Text style={styles.actionTextOutline}>Print</Text>
        </Pressable>
        <Pressable
          onPress={handleDownloadPdf}
          disabled={makingPdf}
          style={[styles.actionBtnWrap, makingPdf && styles.actionBusy]}
          accessibilityLabel="Download prescription as PDF"
        >
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.actionBtn}
          >
            {makingPdf ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.actionText}>
              {makingPdf ? 'Downloading…' : 'Download PDF'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF2F7' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarText: { flex: 1 },
  topBarTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  topBarSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  scroll: { padding: 16, paddingBottom: 24 },
  visitBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  visitBarTitle: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  visitTabs: { paddingHorizontal: 16, gap: 8 },
  visitTab: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  visitTabActive: { backgroundColor: '#006B2C', borderColor: '#006B2C' },
  visitTabTitle: { color: '#006B2C', fontSize: 13, fontWeight: '900' },
  visitTabDate: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  visitTabTextActive: { color: '#FFFFFF' },
  paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    paddingBottom: 18,
  },
  letterhead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 40, height: 40, resizeMode: 'contain' },
  clinicName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  clinicLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 3,
  },
  clinicLineText: {
    flexShrink: 1,
    color: '#E8FFF0',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  doubleRule: {
    marginHorizontal: 18,
    height: 4,
    borderTopWidth: 2,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '900' },
  letterheadText: { flex: 1 },
  doctorName: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  specialization: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  infoCell: { width: '50%', paddingBottom: 12, paddingRight: 8 },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  dashed: {
    marginHorizontal: 18,
    borderBottomWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 4,
  },
  section: { paddingHorizontal: 18, marginTop: 16 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: { flex: 1, color: '#334155', fontSize: 14, lineHeight: 21 },
  diagnosisBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  diagnosisText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  rxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 20,
    marginBottom: 6,
  },
  rxSymbol: {
    fontSize: 36,
    fontWeight: '900',
    fontStyle: 'italic',
    lineHeight: 40,
  },
  rxHeadText: { flex: 1 },
  rxTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  rxCount: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 18,
  },
  medicine: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  medIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  medIndexText: { fontSize: 13, fontWeight: '900' },
  medBody: { flex: 1 },
  medTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  medName: { flex: 1, color: '#0F172A', fontSize: 15.5, fontWeight: '900' },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationText: { color: '#475569', fontSize: 11.5, fontWeight: '800' },
  medDosage: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  timingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  timingText: { fontSize: 11.5, fontWeight: '800' },
  adviceBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 3,
  },
  testDot: { width: 6, height: 6, borderRadius: 3 },
  followUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 18,
    marginTop: 20,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  followUpIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpTextWrap: { flex: 1 },
  followUpLabel: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  followUpDate: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  followUpRelative: { fontSize: 12, fontWeight: '900' },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 18,
    marginTop: 26,
  },
  signature: { minWidth: 130, alignItems: 'center' },
  signatureName: { fontSize: 15, fontWeight: '700', fontStyle: 'italic' },
  signatureLine: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: '#CBD5E1',
    marginTop: 4,
  },
  signatureLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 3,
  },
  verified: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    flexShrink: 1,
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '800',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
    marginTop: 14,
  },
  disclaimerText: { flex: 1, color: '#64748B', fontSize: 12, lineHeight: 17 },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  actionBtnWrap: { flex: 1.4, borderRadius: 14, overflow: 'hidden' },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: '#006B2C',
    backgroundColor: '#F0FDF4',
  },
  actionBusy: { opacity: 0.7 },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  actionTextOutline: { color: '#006B2C', fontSize: 15, fontWeight: '900' },
});
