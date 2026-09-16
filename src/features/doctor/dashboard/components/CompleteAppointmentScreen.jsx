// Ported from MediconecktApp's src/doctor/dashboard/components/CompleteAppointmentScreen.tsx.
import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

export default function CompleteAppointmentScreen({ patient, onCancel, onContinue }) {
  const [timings, setTimings] = useState([]);
  const [temperature, setTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState(patient.bloodPressure);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');
  const [advice, setAdvice] = useState('');
  const [saving, setSaving] = useState(false);
  const toggleTiming = (timing) => setTimings((current) => (current.includes(timing) ? current.filter((item) => item !== timing) : [...current, timing]));

  const saveConsultation = () => {
    if (saving) return;
    setSaving(true);
    const consultation = {
      id: `${patient.id}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      completedAt: new Date().toISOString(),
      vitals: { temperature, bloodPressure },
      diagnosis,
      medicines: [{ name: medicineName, dosage, timings, duration, type: 'Days' }],
      advice,
    };

    // Return to the dashboard immediately; storage must never block navigation.
    onContinue();
    void AsyncStorage.getItem('doctor_consultations')
      .then((stored) => {
        const parsed = stored ? JSON.parse(stored) : [];
        const consultations = Array.isArray(parsed) ? parsed : [];
        return AsyncStorage.setItem('doctor_consultations', JSON.stringify([...consultations, consultation]));
      })
      .catch(() => Alert.alert('Unable to save', 'The consultation could not be saved. Please try again.'));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleBar}><Text style={styles.title}>Complete Appointment</Text></View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.patientCard}>
          <View><Text style={styles.patientName}>{patient.name}</Text><Text style={styles.patientId}>ID: {patient.id}</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>CONSULTATION</Text></View>
        </View>

        <SectionTitle>Patient Vitals</SectionTitle>
        <View style={styles.twoColumns}>
          <Field label="Temperature (°C)" placeholder="37.0" keyboardType="decimal-pad" value={temperature} onChangeText={setTemperature} />
          <Field label="Blood Pressure" placeholder={patient.bloodPressure} value={bloodPressure} onChangeText={setBloodPressure} />
        </View>

        <SectionTitle>Diagnosis</SectionTitle>
        <TextInput style={styles.textArea} placeholder="Enter detailed diagnosis..." placeholderTextColor="#8D96A6" multiline textAlignVertical="top" value={diagnosis} onChangeText={setDiagnosis} />

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Prescribed Medicines</Text>
          <View style={styles.sectionRule} />
          <TouchableOpacity accessibilityRole="button" style={styles.addMedicine}><Text style={styles.addMedicineText}>＋ Add Medicine</Text></TouchableOpacity>
        </View>
        <View style={styles.medicineCard}>
          <Field label="Medicine Name" placeholder="e.g. Paracetamol 500mg" value={medicineName} onChangeText={setMedicineName} />
          <Field label="Dosage" placeholder="e.g. 1 Tablet" value={dosage} onChangeText={setDosage} />
          <Text style={styles.fieldLabel}>Timing</Text>
          <View style={styles.timingRow}>
            {['Morning', 'Afternoon', 'Evening', 'Night'].map((timing) => {
              const selected = timings.includes(timing);
              return (
                <TouchableOpacity key={timing} onPress={() => toggleTiming(timing)} style={styles.timingOption}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View>
                  <Text style={styles.timingText}>{timing}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.twoColumns}>
            <Field label="Duration" placeholder="5" keyboardType="number-pad" value={duration} onChangeText={setDuration} />
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.selectField}><Text style={styles.selectText}>Days</Text><Text style={styles.chevron}>⌄</Text></View>
            </View>
          </View>
        </View>

        <SectionTitle>Advice</SectionTitle>
        <TextInput style={[styles.textArea, styles.adviceArea]} placeholder="Enter any additional advice or instructions..." placeholderTextColor="#8D96A6" multiline textAlignVertical="top" value={advice} onChangeText={setAdvice} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.continueButton, saving && styles.buttonDisabled]} onPress={saveConsultation} disabled={saving}>
          <Text style={styles.continueText}>{saving ? 'Saving...' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA', marginHorizontal: 4, borderRadius: 9, overflow: 'hidden' },
  titleBar: { height: 51, backgroundColor: '#07BFBD', justifyContent: 'center', paddingHorizontal: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  title: { color: '#FFF', fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: 0.1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 18 },
  patientCard: { minHeight: 73, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 7, paddingHorizontal: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  patientName: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: '#252B35', marginBottom: 3 },
  patientId: { fontSize: 11, lineHeight: 15, color: '#687181' },
  badge: { backgroundColor: '#EFF1F4', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 9, lineHeight: 12, color: '#5E6674', fontWeight: '600', letterSpacing: 0.2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2, marginBottom: 9 },
  sectionRule: { height: StyleSheet.hairlineWidth, backgroundColor: '#DCE1E9', flex: 1 },
  sectionTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#07BFBD' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, marginBottom: 9 },
  addMedicine: { paddingVertical: 5 },
  addMedicineText: { color: '#07BFBD', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  twoColumns: { flexDirection: 'row', gap: 9 },
  fieldWrap: { flex: 1, marginBottom: 12 },
  fieldLabel: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: '#596170', marginBottom: 4 },
  input: { height: 40, borderWidth: 1, borderColor: '#CCD4E1', backgroundColor: '#FFF', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 0, fontSize: 13, fontWeight: '500', color: '#252B35' },
  textArea: { height: 88, borderWidth: 1, borderColor: '#CCD4E1', backgroundColor: '#FFF', borderRadius: 6, padding: 10, fontSize: 13, lineHeight: 18, color: '#252B35', marginBottom: 18 },
  medicineCard: { backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 7, padding: 10, marginBottom: 18 },
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
  timingOption: { width: '48%', flexGrow: 1, height: 34, backgroundColor: '#EEF1F5', borderRadius: 5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  timingText: { color: '#3C4759', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  checkbox: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C9D1DD', marginRight: 7, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#07BFBD', borderColor: '#07BFBD' },
  check: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  selectField: { height: 40, borderWidth: 1, borderColor: '#CCD4E1', backgroundColor: '#FFF', borderRadius: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 13, fontWeight: '500', color: '#252B35' },
  chevron: { fontSize: 14, color: '#111827' },
  adviceArea: { height: 76, marginBottom: 0 },
  footer: { height: 64, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: { flex: 1, height: 43, borderWidth: 1, borderColor: '#C9D1DD', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '600', color: '#202630' },
  continueButton: { flex: 1.08, height: 43, borderRadius: 6, backgroundColor: '#07BFBD', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.65 },
  continueText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
});
