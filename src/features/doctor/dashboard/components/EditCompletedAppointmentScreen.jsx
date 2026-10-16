// Web parity: Dashboard/DoctorDashboard.jsx EditCompletedModal. "View" on a
// completed queue row opens this; Save PATCHes diagnosis / medicine / advice /
// additional_notes / follow_up_* (the parent does the request).
import React, { useRef, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import VitalsSummary from '../../../../components/VitalsSummary';
import TextInput from '../../../../components/TranslatedTextInput';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getTokenLabel } from '../api/doctorAppointments';
import { formatDuration } from './ActiveConsultationCard';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';

const formatDateTime = (value) => {
  const d = new Date(Number(value) || value);
  return Number.isNaN(d.getTime()) ? 'N/A' : `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

function Area({ label, icon, value, onChangeText, minHeight = 80, placeholder }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <View style={styles.labelIcon}>
          <AppIcon name={icon} size={14} color="#0F766E" strokeWidth={2.1} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <TextInput
        style={[styles.input, { minHeight }]}
        value={value}
        onChangeText={onChangeText}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor="#8D96A6"
      />
    </View>
  );
}

function SummaryItem({ icon, label, value }) {
  return (
    <View style={styles.summaryItem}>
      <View style={styles.summaryIcon}>
        <AppIcon name={icon} size={14} color="#0D9488" strokeWidth={2.1} />
      </View>
      <View style={styles.summaryText}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text translate={false} style={styles.summaryValue} numberOfLines={2}>{value || 'N/A'}</Text>
      </View>
    </View>
  );
}

export default function EditCompletedAppointmentScreen({ appointment, onCancel, onSave }) {
  // Signup-style keyboard handling: the form scrolls above the keyboard and the
  // focused field is scrolled into view (the window does not resize, edge-to-edge).
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  const [diagnosis, setDiagnosis] = useState(appointment.diagnosis || '');
  const [medicine, setMedicine] = useState(appointment.medicine || '');
  const [advice, setAdvice] = useState(appointment.advice || '');
  const [additionalNotes, setAdditionalNotes] = useState(appointment.additionalNotes || '');
  const [followUpRequired, setFollowUpRequired] = useState(Boolean(appointment.followUpRequired));
  const [followUpDate, setFollowUpDate] = useState(appointment.followUpDate || '');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  const save = async () => {
    if (saveLock.current) return;
    if (followUpRequired && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate.trim())) {
      Alert.alert('Invalid date', 'Follow-up date must be YYYY-MM-DD.');
      return;
    }
    saveLock.current = true;
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
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleBar}>
        <TouchableOpacity onPress={onCancel} hitSlop={10} style={styles.headerIconButton}>
          <AppIcon name="chevron-left" size={22} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>COMPLETED VISIT</Text>
          <Text style={styles.title}>Appointment Record</Text>
        </View>
        <View style={styles.headerBadge}>
          <AppIcon name="check" size={19} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </LinearGradient>
      <ScrollView ref={kbScrollRef} contentContainerStyle={[styles.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        <View style={styles.patientCard}>
          <Text translate={false} style={styles.patientName}>{appointment.name}</Text>
          <Text translate={false} style={styles.meta}>{getTokenLabel(appointment)} • {appointment.issue}</Text>
          <Text style={styles.meta}>Completed on: {appointment.endTime ? formatDateTime(appointment.endTime) : 'N/A'}</Text>
          {!!appointment.durationMs && <Text style={styles.meta}>Duration: {formatDuration(appointment.durationMs)}</Text>}
          <View style={styles.summaryGrid}>
            <SummaryItem icon="calendar" label="Completed" value={appointment.endTime ? formatDateTime(appointment.endTime) : 'N/A'} />
            <SummaryItem icon="timer" label="Duration" value={appointment.durationMs ? formatDuration(appointment.durationMs) : 'N/A'} />
          </View>
        </View>

        <VitalsSummary appointment={appointment} />
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Clinical Summary</Text>
            <Text style={styles.sectionHint}>Update the completed visit details</Text>
          </View>
          <Area label="Diagnosis" icon="note" value={diagnosis} onChangeText={setDiagnosis} placeholder="Enter final diagnosis" />
          <Area label="Medicine" icon="pill" value={medicine} onChangeText={setMedicine} minHeight={106} placeholder="Medicine, dosage, timing and duration" />
          <Area label="Advice" icon="message" value={advice} onChangeText={setAdvice} placeholder="Care instructions for patient" />
          <Area label="Additional Notes" icon="file" value={additionalNotes} onChangeText={setAdditionalNotes} placeholder="Private clinical notes or observations" />
        </View>

        <View style={styles.followCard}>
          <TouchableOpacity style={styles.checkRow} onPress={() => setFollowUpRequired((v) => !v)}>
            <View style={[styles.checkbox, followUpRequired && styles.checkboxOn]}>
              {followUpRequired && <AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <View style={styles.followTextBlock}>
              <Text style={styles.checkText}>Follow-up required</Text>
              <Text style={styles.followHint}>Schedule a return visit if the patient needs review.</Text>
            </View>
          </TouchableOpacity>
          {followUpRequired && (
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <View style={styles.labelIcon}>
                  <AppIcon name="calendar" size={14} color="#0F766E" strokeWidth={2.1} />
                </View>
                <Text style={styles.label}>Follow-up Date (YYYY-MM-DD)</Text>
              </View>
              <TextInput style={styles.input} value={followUpDate} onChangeText={setFollowUpDate} placeholder="2026-10-01" placeholderTextColor="#8D96A6" />
            </View>
          )}
        </View>
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
  screen: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', backgroundColor: colors.background },
  titleBar: { minHeight: 78, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  headerCopy: { flex: 1 },
  kicker: { ...typography.label, fontSize: 10.5, lineHeight: 14, color: 'rgba(255,255,255,0.78)' },
  title: { ...typography.title, fontSize: 20, lineHeight: 25, color: '#FFFFFF', marginTop: 3 },
  headerBadge: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  content: { padding: 14, paddingBottom: 28 },
  patientCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#D6F1ED', padding: 14, marginBottom: 14, gap: 5, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  patientName: { ...typography.title, fontSize: 18, lineHeight: 23, color: colors.ink },
  meta: { ...typography.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  summaryGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  summaryItem: { flex: 1, minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#DDF2EF', backgroundColor: '#F8FFFE', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6FFFB' },
  summaryText: { flex: 1, minWidth: 0 },
  summaryLabel: { ...typography.caption, fontSize: 10.5, lineHeight: 14, color: '#64748B' },
  summaryValue: { ...typography.caption, fontSize: 12.2, lineHeight: 16, color: colors.ink, marginTop: 2 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DDF2EF', padding: 14, marginBottom: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  sectionHead: { marginBottom: 12 },
  sectionTitle: { ...typography.subtitle, fontSize: 17, lineHeight: 22, color: '#0F172A' },
  sectionHint: { ...typography.body, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 3 },
  field: { marginBottom: 13 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  labelIcon: { width: 26, height: 26, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6FFFB' },
  label: { ...typography.caption, fontSize: 13.5, color: '#334155' },
  input: { borderWidth: 1, borderColor: '#CFE4E1', borderRadius: 14, backgroundColor: '#FBFEFE', paddingHorizontal: 12, paddingVertical: 10, ...typography.body, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  followCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DDF2EF', padding: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.6, borderColor: '#AEB6C4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  followTextBlock: { flex: 1 },
  checkText: { ...typography.caption, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  followHint: { ...typography.body, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 2 },
  footer: { minHeight: 72, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8 },
  cancel: { flex: 0.8, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#C9D1DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  cancelText: { ...typography.caption, fontSize: 14.5, color: '#252B35' },
  saveWrap: { flex: 1.3 },
  saveButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...typography.caption, fontSize: 14.5, color: '#FFFFFF' },
});
