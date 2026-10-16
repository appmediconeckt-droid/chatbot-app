// Ported from MediconecktApp's CompleteAppointmentScreen; now submits the web
// dashboard's complete-appointment payload through onSave (parent PATCHes).
import React, { useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Text from '../../../../components/TranslatedText';
import VitalsSummary from '../../../../components/VitalsSummary';
import TextInput from '../../../../components/TranslatedTextInput';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { formatLocalDateKey, getConsultationModeInfo, getRemoteConsultationMode, getTokenLabel } from '../api/doctorAppointments';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import { getAppointmentVitals, hasVitalValue } from '../../../../utils/appointmentVitals';

const DURATION_TYPES = ['Days', 'Weeks', 'Months'];
const TIMINGS = ['Morning', 'Afternoon', 'Evening', 'Night'];
let medicineSeq = 0;
const nextMedicineId = () => `medicine-${++medicineSeq}`;
const emptyMedicine = () => ({ id: nextMedicineId(), name: '', dosage: '', timings: [], duration: '', type: 'Days' });

// Vitals are typed on the number keypad. Temperature keeps digits and one
// decimal point ("37.5"). The keypad has no "/", so blood pressure gets it
// automatically: 120 then 80 → "120/80" (2-digit systolic like 90/60 when the
// first digit isn't 1 or 2).
const formatTemperature = (text) => {
  const clean = String(text).replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = clean.split('.');
  return (rest.length ? `${whole}.${rest.join('').slice(0, 1)}` : whole).slice(0, 5);
};

const formatBloodPressure = (text) => {
  const digits = String(text).replace(/\D/g, '').slice(0, 6);
  const systolicLength = /^[12]/.test(digits) ? 3 : 2;
  return digits.length > systolicLength
    ? `${digits.slice(0, systolicLength)}/${digits.slice(systolicLength, systolicLength + 3)}`
    : digits;
};

function Field({ label, placeholder, keyboardType, value, onChangeText }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#8D96A6" keyboardType={keyboardType} value={value} onChangeText={onChangeText} />
    </View>
  );
}

function SectionTitle({ children }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

function MedicineEntry({ index, medicine, canRemove, typeOpen, onToggleTypeOpen, onChange, onRemove }) {
  const toggleTiming = (timing) =>
    onChange({ ...medicine, timings: medicine.timings.includes(timing) ? medicine.timings.filter((t) => t !== timing) : [...medicine.timings, timing] });

  return (
    <View style={styles.medicineCard}>
      <View style={styles.medicineCardHeader}>
        <Text style={styles.medicineCardTitle}>Medicine {index + 1}</Text>
        {canRemove && (
          <TouchableOpacity onPress={onRemove} hitSlop={8}>
            <AppIcon name="x" size={14} color="#8E9DB0" strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
      <Field label="Medicine Name" placeholder="e.g. Paracetamol 500mg" value={medicine.name} onChangeText={(text) => onChange({ ...medicine, name: text })} />
      <Field label="Dosage" placeholder="e.g. 1 Tablet" value={medicine.dosage} onChangeText={(text) => onChange({ ...medicine, dosage: text })} />
      <Text style={styles.fieldLabel}>Timing</Text>
      <View style={styles.timingRow}>
        {TIMINGS.map((timing) => {
          const selected = medicine.timings.includes(timing);
          return (
            <TouchableOpacity key={timing} onPress={() => toggleTiming(timing)} style={styles.timingOption}>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.timingText}>{timing}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.twoColumns}>
        <Field label="Duration" placeholder="5" keyboardType="number-pad" value={medicine.duration} onChangeText={(text) => onChange({ ...medicine, duration: text })} />
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Type</Text>
          <TouchableOpacity style={styles.selectField} onPress={onToggleTypeOpen}>
            <Text translate={false} style={styles.selectText}>{medicine.type}</Text>
            <View style={[styles.chevronWrap, typeOpen && styles.chevronOpen]}>
              <AppIcon name="chevron-down" size={13} color="#111827" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>
          {typeOpen && (
            <View style={styles.selectMenu}>
              {DURATION_TYPES.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.selectOption}
                  onPress={() => {
                    onChange({ ...medicine, type: option });
                    onToggleTypeOpen();
                  }}
                >
                  <Text style={[styles.selectOptionText, option === medicine.type && styles.selectOptionActive]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// Web parity (Dashboard/DoctorDashboard.jsx CompleteModal): same medicine
// line format, follow-up default = appointment date + longest medicine
// duration, and diagnosis + advice + fully-filled medicines required.
const formatMedicineLine = (m) => {
  const timing = m.timings?.length ? m.timings.join(', ') : 'Select timing';
  return `${m.name.trim() || 'Medicine'} - ${m.dosage.trim() || 'Dosage'} (${timing}) - ${m.duration.trim() || '?'} ${(m.type || 'Days').toLowerCase()}`;
};
const hasValidMedicine = (m) =>
  Boolean(m.name.trim() && m.dosage.trim() && m.timings.length && m.duration.trim() && m.type);
const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const durationDays = (m) => {
  const v = Number(m.duration || 0);
  const t = String(m.type || 'Days').toLowerCase();
  return t.startsWith('week') ? v * 7 : t.startsWith('month') ? v * 30 : v;
};
// After the longest medicine course, or a week out when there are none
// (in-clinic visits don't record medicines here).
const defaultFollowUpDate = (medicines, patient) => {
  const base = new Date(patient?.appointmentDate || Date.now());
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (Math.max(0, ...medicines.map(durationDays)) || 7));
  return toDateKey(d);
};

// Every consultation — in-clinic, walk-in, video or voice — completes through
// this full form: vitals, diagnosis, medicines, advice, notes and follow-up.
// Diagnosis, advice and every medicine are required, so the prescription is
// always recorded (and downloadable as PDF) before a visit is marked complete.
export default function CompleteAppointmentScreen({ patient, onCancel, onSave }) {
  // Signup-style keyboard handling: the form scrolls above the keyboard and the
  // focused field is scrolled into view (the window does not resize, edge-to-edge).
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  const isVisit = !getRemoteConsultationMode(patient);
  const modeInfo = getConsultationModeInfo(patient);
  const [temperature, setTemperature] = useState(() => {
    const vitals = getAppointmentVitals(patient);
    if (!hasVitalValue(vitals.temperature)) return '';
    // The editable field is Celsius; preserve the original unit in the summary.
    return String(vitals.temperature_unit === 'F'
      ? Math.round((Number(vitals.temperature) - 32) * 5 / 9 * 10) / 10
      : vitals.temperature);
  });
  const [bloodPressure, setBloodPressure] = useState(patient.bp && patient.bp !== 'Not recorded' ? patient.bp : '');
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState(() => [emptyMedicine()]);
  const [openTypeId, setOpenTypeId] = useState(null);
  const [advice, setAdvice] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [recommendedTests, setRecommendedTests] = useState([]);
  const [testDateId, setTestDateId] = useState(null);
  const testSeq = useRef(0);
  const updateTest = (id, field, value) => setRecommendedTests(current => current.map(test => test.id === id ? { ...test, [field]: value } : test));
  const openTestDate = test => {
    const value = test.completeBy ? new Date(`${test.completeBy}T00:00:00`) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: 'date', minimumDate: new Date(),
        onChange: (event, selected) => {
          if (event?.type === 'set' && selected) updateTest(test.id, 'completeBy', formatLocalDateKey(selected));
        },
      });
    } else {
      setTestDateId(test.id);
    }
  };
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  // Android: open the native dialog imperatively and only take the date on
  // OK ("set"). An inline picker also fires a "dismissed" event carrying the
  // old value, which put the previous date (e.g. the 10th) back after picking.
  const openFollowUpPicker = () => {
    const value = followUpDate ? new Date(`${followUpDate}T00:00:00`) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (event, selected) => {
          if (event?.type === 'set' && selected) setFollowUpDate(formatLocalDateKey(selected));
        },
      });
      return;
    }
    setShowFollowUpPicker(true);
  };
  const [saving, setSaving] = useState(false);
  // Ref lock: a double tap must not complete (and create the follow-up) twice.
  const saveLock = useRef(false);

  const updateMedicine = (id, next) => setMedicines((current) => current.map((item) => (item.id === id ? next : item)));
  const addMedicine = () => setMedicines((current) => [...current, emptyMedicine()]);
  const removeMedicine = (id) => setMedicines((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));

  const canSave = Boolean(diagnosis.trim() && advice.trim() && medicines.every(hasValidMedicine));
  const followUpMedicines = medicines;

  const saveConsultation = async () => {
    if (saveLock.current) return;
    if (!canSave) {
      Alert.alert('Incomplete', 'Diagnosis, advice and every medicine (name, dosage, timing, duration) are required.');
      return;
    }
    const finalFollowUpDate = followUpRequired ? (followUpDate.trim() || defaultFollowUpDate(followUpMedicines, patient)) : '';
    if (followUpRequired && !/^\d{4}-\d{2}-\d{2}$/.test(finalFollowUpDate)) {
      Alert.alert('Invalid date', 'Follow-up date must be YYYY-MM-DD.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      await onSave?.({
        temperature,
        bloodPressure,
        diagnosis,
        medicine: medicines.map(formatMedicineLine).join('\n'),
        medicines: medicines.map(({ name, dosage, timings, duration, type }) => ({
          name, dosage, timings, durationValue: duration, durationType: type,
        })),
        recommendedTests: recommendedTests.filter(test => test.testName.trim()).map(({ testName, completeBy, reason, instructions }) => ({
          testName: testName.trim(), completeBy: completeBy || null, reason, instructions,
        })),
        advice,
        additionalNotes,
        followUpRequired,
        followUpDate: finalFollowUpDate,
      });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleBar}>
        <Text style={styles.title}>Complete Appointment</Text>
        <TouchableOpacity onPress={onCancel} hitSlop={10} style={styles.closeBtn}>
          <AppIcon name="x" size={18} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>
      </LinearGradient>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} ref={kbScrollRef} contentContainerStyle={[styles.scrollContent, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        <View style={styles.patientCard}>
          <View><Text translate={false} style={styles.patientName}>{patient.name}</Text><Text style={styles.patientId}>{getTokenLabel(patient)}</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>{isVisit ? modeInfo.label.toUpperCase() : 'CONSULTATION'}</Text></View>
        </View>

        <VitalsSummary appointment={patient} title="Recorded patient vitals" />
        <SectionTitle>Patient Vitals</SectionTitle>
        <View style={styles.twoColumns}>
          <Field label="Temperature (°C)" placeholder="37.0" keyboardType="decimal-pad" value={temperature} onChangeText={(text) => setTemperature(formatTemperature(text))} />
          <Field label="Blood Pressure" placeholder="120/80" keyboardType="number-pad" value={bloodPressure} onChangeText={(text) => setBloodPressure(formatBloodPressure(text))} />
        </View>

        <SectionTitle>Diagnosis *</SectionTitle>
        <TextInput style={styles.textArea} placeholder="Enter detailed diagnosis..." placeholderTextColor="#8D96A6" multiline textAlignVertical="top" value={diagnosis} onChangeText={setDiagnosis} />

        <View style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>Recommended Tests / Investigations (Optional)</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.addMedicine} onPress={() => setRecommendedTests(current => [...current, {
            id: ++testSeq.current, testName: '', completeBy: '', reason: '', instructions: '',
          }])}>
            <Text style={styles.addMedicineText}>+ Add Test</Text>
          </TouchableOpacity>
        </View>
        {!recommendedTests.length && <Text style={styles.fieldLabel}>Add tests only when the patient needs an investigation or lab report.</Text>}
        {recommendedTests.map((test, index) => (
          <View key={test.id} style={styles.medicineCard}>
            <View style={styles.medicineCardHeader}>
              <Text style={styles.medicineCardTitle}>Test {index + 1}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove test ${index + 1}`} onPress={() => setRecommendedTests(current => current.filter(item => item.id !== test.id))} hitSlop={8}>
                <AppIcon name="x" size={14} color="#8E9DB0" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Field label="Test Name" placeholder="e.g., CBC, Blood Sugar, X-Ray" value={test.testName} onChangeText={value => updateTest(test.id, 'testName', value)} />
            <Text style={styles.fieldLabel}>Complete By</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Complete by date for test ${index + 1}`} style={styles.dateButton} onPress={() => openTestDate(test)}>
              <AppIcon name="calendar" size={16} color="#0D9488" strokeWidth={2.1} />
              <Text style={styles.dateButtonText}>{test.completeBy || 'Select date'}</Text>
            </TouchableOpacity>
            {!!test.completeBy && <TouchableOpacity accessibilityRole="button" onPress={() => updateTest(test.id, 'completeBy', '')}><Text style={styles.fieldLabel}>Clear date</Text></TouchableOpacity>}
            {Platform.OS === 'ios' && testDateId === test.id && (
              <View>
                <DateTimePicker value={test.completeBy ? new Date(`${test.completeBy}T00:00:00`) : new Date()} mode="date" display="inline" minimumDate={new Date()} onChange={(event, selected) => {
                  if (selected) updateTest(test.id, 'completeBy', formatLocalDateKey(selected));
                }} />
                <TouchableOpacity onPress={() => setTestDateId(null)}><Text style={styles.addMedicineText}>Done</Text></TouchableOpacity>
              </View>
            )}
            <Field label="Reason" placeholder="Why this test is required" value={test.reason} onChangeText={value => updateTest(test.id, 'reason', value)} />
            <Field label="Instructions" placeholder="e.g., 8 hours fasting" value={test.instructions} onChangeText={value => updateTest(test.id, 'instructions', value)} />
          </View>
        ))}

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Prescribed Medicines *</Text>
          <View style={styles.sectionRule} />
          <TouchableOpacity accessibilityRole="button" style={styles.addMedicine} onPress={addMedicine} hitSlop={6}>
            <Text style={styles.addMedicineText}>＋ Add Medicine</Text>
          </TouchableOpacity>
        </View>
        {medicines.map((medicine, index) => (
          <MedicineEntry
            key={medicine.id}
            index={index}
            medicine={medicine}
            canRemove={medicines.length > 1}
            typeOpen={openTypeId === medicine.id}
            onToggleTypeOpen={() => setOpenTypeId((current) => (current === medicine.id ? null : medicine.id))}
            onChange={(next) => updateMedicine(medicine.id, next)}
            onRemove={() => removeMedicine(medicine.id)}
          />
        ))}

        <SectionTitle>Advice *</SectionTitle>
        <TextInput style={[styles.textArea, styles.adviceArea]} placeholder="Enter any additional advice or instructions..." placeholderTextColor="#8D96A6" multiline textAlignVertical="top" value={advice} onChangeText={setAdvice} />

        <SectionTitle>Additional Notes</SectionTitle>
        <TextInput style={[styles.textArea, styles.adviceArea]} placeholder="Any additional notes..." placeholderTextColor="#8D96A6" multiline textAlignVertical="top" value={additionalNotes} onChangeText={setAdditionalNotes} />

        <SectionTitle>Follow-up</SectionTitle>
        <TouchableOpacity
          style={styles.timingOption}
          onPress={() => {
            const next = !followUpRequired;
            setFollowUpRequired(next);
            if (next && !followUpDate) setFollowUpDate(defaultFollowUpDate(followUpMedicines, patient));
          }}
        >
          <View style={[styles.checkbox, followUpRequired && styles.checkboxSelected]}>
            {followUpRequired && <AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} />}
          </View>
          <Text style={styles.timingText}>Follow-up required</Text>
        </TouchableOpacity>
        {followUpRequired && (
          // Tap to pick the date from a calendar (no typing YYYY-MM-DD).
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Follow-up Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={openFollowUpPicker} activeOpacity={0.8}>
              <AppIcon name="calendar" size={16} color="#0D9488" strokeWidth={2.1} />
              <Text style={[styles.dateButtonText, !followUpDate && styles.datePlaceholder]}>
                {followUpDate
                  ? new Date(`${followUpDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Select follow-up date'}
              </Text>
              <AppIcon name="chevron-down" size={15} color="#667085" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}
        {Platform.OS === 'ios' && followUpRequired && showFollowUpPicker && (
          <DateTimePicker
            value={followUpDate ? new Date(`${followUpDate}T00:00:00`) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(event, selected) => {
              if (event?.type === 'dismissed') { setShowFollowUpPicker(false); return; }
              if (selected) setFollowUpDate(formatLocalDateKey(selected));
            }}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.continueButtonWrap} onPress={saveConsultation} disabled={saving}>
          <LinearGradient
            colors={saving ? ['#8E9DB0', '#8E9DB0'] : CLINICIAN_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            <Text style={styles.continueText}>{saving ? 'Saving...' : isVisit ? 'Complete Consultation' : 'Complete Appointment'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  screen: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', backgroundColor: '#F0FDFA' },
  titleBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 19, lineHeight: 25, fontWeight: '700', letterSpacing: 0.1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 18 },
  patientCard: { minHeight: 73, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 7, paddingHorizontal: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  patientName: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#252B35', marginBottom: 3 },
  patientId: { fontSize: 13, lineHeight: 17, color: '#687181' },
  badge: { backgroundColor: '#EFF1F4', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, lineHeight: 15, color: '#5E6674', fontWeight: '600', letterSpacing: 0.2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2, marginBottom: 9 },
  sectionRule: { height: StyleSheet.hairlineWidth, backgroundColor: '#DCE1E9', flex: 1 },
  sectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#0D9488' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, marginBottom: 9 },
  addMedicine: { paddingVertical: 5 },
  addMedicineText: { color: '#0D9488', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  twoColumns: { flexDirection: 'row', gap: 9 },
  fieldWrap: { flex: 1, marginBottom: 12 },
  fieldLabel: { fontSize: 13, lineHeight: 17, fontWeight: '500', color: '#596170', marginBottom: 4 },
  dateButton: { height: 44, borderWidth: 1, borderColor: '#99E4D8', backgroundColor: '#F0FDFA', borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateButtonText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#252B35' },
  datePlaceholder: { color: '#8D96A6', fontWeight: '500' },
  input: { height: 40, borderWidth: 1, borderColor: '#CCD4E1', backgroundColor: '#FFF', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 0, fontSize: 14, fontWeight: '500', color: '#252B35' },
  textArea: { height: 88, borderWidth: 1, borderColor: '#CCD4E1', backgroundColor: '#FFF', borderRadius: 6, padding: 10, fontSize: 14, lineHeight: 19, color: '#252B35', marginBottom: 18 },
  medicineCard: { backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 7, padding: 10, marginBottom: 12 },
  medicineCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  medicineCardTitle: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: '#596170', letterSpacing: 0.3, textTransform: 'uppercase' },
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
  timingOption: { width: '48%', flexGrow: 1, height: 34, backgroundColor: '#EEF1F5', borderRadius: 5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  timingText: { color: '#3C4759', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  checkbox: { width: 17, height: 17, borderRadius: 4, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#AEB6C4', marginRight: 7, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  selectField: { height: 40, borderWidth: 1, borderColor: '#CCD4E1', backgroundColor: '#FFF', borderRadius: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 14, fontWeight: '500', color: '#252B35' },
  chevronWrap: { width: 13, height: 13, alignItems: 'center', justifyContent: 'center' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  selectMenu: { position: 'absolute', top: 66, left: 0, right: 0, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 8, paddingVertical: 4, zIndex: 20, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  selectOption: { paddingVertical: 9, paddingHorizontal: 12 },
  selectOptionText: { fontSize: 14, color: '#344054' },
  selectOptionActive: { color: '#0D9488', fontWeight: '700' },
  adviceArea: { height: 76, marginBottom: 0 },
  footer: { height: 64, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: { flex: 1, height: 43, borderWidth: 1, borderColor: '#C9D1DD', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#202630' },
  continueButtonWrap: { flex: 1.08 },
  continueButton: { height: 43, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
