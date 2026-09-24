// Web parity: Dashboard/DoctorDashboard.jsx EditCompletedModal. "View" on a
// completed queue row opens this; Save PATCHes diagnosis / medicine / advice /
// additional_notes / follow_up_* (the parent does the request).
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getTokenLabel } from '../api/doctorAppointments';
import { formatDuration } from './ActiveConsultationCard';

const formatDateTime = (value) => {
  const d = new Date(Number(value) || value);
  return Number.isNaN(d.getTime()) ? 'N/A' : `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

function Area({ label, value, onChangeText, minHeight = 80 }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, { minHeight }]}
        value={value}
        onChangeText={onChangeText}
        multiline
        textAlignVertical="top"
        placeholderTextColor="#8D96A6"
      />
    </View>
  );
}

export default function EditCompletedAppointmentScreen({ appointment, onCancel, onSave }) {
  const [diagnosis, setDiagnosis] = useState(appointment.diagnosis || '');
  const [medicine, setMedicine] = useState(appointment.medicine || '');
  const [advice, setAdvice] = useState(appointment.advice || '');
  const [additionalNotes, setAdditionalNotes] = useState(appointment.additionalNotes || '');
  const [followUpRequired, setFollowUpRequired] = useState(Boolean(appointment.followUpRequired));
  const [followUpDate, setFollowUpDate] = useState(appointment.followUpDate || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (followUpRequired && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate.trim())) {
      Alert.alert('Invalid date', 'Follow-up date must be YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    try {
      await onSave?.({
        diagnosis,
        medicine,
        advice,
        additionalNotes,
        followUpRequired,
        followUpDate: followUpRequired ? followUpDate.trim() : '',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleBar}><Text style={styles.title}>Completed Appointment</Text></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.patientCard}>
          <Text style={styles.patientName}>{appointment.name}</Text>
          <Text style={styles.meta}>{getTokenLabel(appointment)} • {appointment.issue}</Text>
          <Text style={styles.meta}>Completed on: {appointment.endTime ? formatDateTime(appointment.endTime) : 'N/A'}</Text>
          {!!appointment.durationMs && <Text style={styles.meta}>Duration: {formatDuration(appointment.durationMs)}</Text>}
        </View>

        <Area label="Diagnosis" value={diagnosis} onChangeText={setDiagnosis} />
        <Area label="Medicine" value={medicine} onChangeText={setMedicine} minHeight={100} />
        <Area label="Advice" value={advice} onChangeText={setAdvice} />
        <Area label="Additional Notes" value={additionalNotes} onChangeText={setAdditionalNotes} />

        <TouchableOpacity style={styles.checkRow} onPress={() => setFollowUpRequired((v) => !v)}>
          <View style={[styles.checkbox, followUpRequired && styles.checkboxOn]}>
            {followUpRequired && <AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} />}
          </View>
          <Text style={styles.checkText}>Follow-up required</Text>
        </TouchableOpacity>
        {followUpRequired && (
          <View style={styles.field}>
            <Text style={styles.label}>Follow-up Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={followUpDate} onChangeText={setFollowUpDate} placeholder="2026-10-01" placeholderTextColor="#8D96A6" />
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveWrap} onPress={save} disabled={saving}>
          <LinearGradient colors={saving ? ['#8E9DB0', '#8E9DB0'] : CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveButton}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  screen: { flex: 1, backgroundColor: colors.background },
  titleBar: { height: 51, paddingHorizontal: 14, backgroundColor: '#0D9488', justifyContent: 'center' },
  title: { ...typography.subtitle, fontSize: 18, color: '#FFFFFF' },
  content: { padding: 14, paddingBottom: 24 },
  patientCard: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 14, gap: 3 },
  patientName: { ...typography.title, fontSize: 16, color: colors.ink },
  meta: { ...typography.body, fontSize: 13, color: colors.muted },
  field: { marginBottom: 12 },
  label: { ...typography.caption, fontSize: 13, color: '#3C4759', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 8, ...typography.body, fontSize: 14, color: colors.ink },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#AEB6C4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  checkText: { ...typography.caption, fontSize: 14, color: colors.ink },
  footer: { height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  cancel: { flex: 0.8, height: 43, borderRadius: 6, borderWidth: 1, borderColor: '#C9D1DD', alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.caption, fontSize: 14, color: '#252B35' },
  saveWrap: { flex: 1.3 },
  saveButton: { height: 43, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...typography.caption, fontSize: 14, color: '#FFFFFF' },
});
