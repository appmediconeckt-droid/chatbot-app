// Ported from MediconecktApp's NewFollowUpScreen. Create + edit form with the
// web Follow-Up page's fields and payloads:
//   create -> POST /api/followups  (patient from the doctor's appointments)
//   edit   -> PUT  /api/followups/:id
// Dates are sent as YYYY-MM-DD and times as HH:mm, same as the web inputs.
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { formatLocalDateKey } from '../api/doctorAppointments';
import { apiErrorMessage, createFollowUp, normalizeDateInput, updateFollowUp } from '../api/doctorFollowUps';

const TYPES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'consultation', label: 'Consultation' },
];
const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
];

const toTimeValue = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const displayDate = (key) =>
  key ? new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';
const displayTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const pickerDate = (key, hhmm) => {
  const d = key ? new Date(`${key}T00:00:00`) : new Date();
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m || 0, 0, 0);
  }
  return d;
};

export default function NewFollowUpScreen({ doctor, patients = [], followUp, onBack, onSaved }) {
  const editing = Boolean(followUp);
  const [patientId, setPatientId] = useState(followUp?.patientId || '');
  const [followUpDate, setFollowUpDate] = useState(editing ? normalizeDateInput(followUp.followUpDate) : '');
  const [followUpTime, setFollowUpTime] = useState(followUp?.followUpTime ? String(followUp.followUpTime).slice(0, 5) : '');
  const [followUpType, setFollowUpType] = useState(followUp?.followUpType || 'routine');
  const [followUpStatus, setFollowUpStatus] = useState(followUp?.followUpStatus || 'pending');
  const [notes, setNotes] = useState(followUp?.notes && followUp.notes !== 'N/A' ? followUp.notes : '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [open, setOpen] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPatient = patients.find((p) => String(p.id) === String(patientId));
  const patientLabel = editing ? followUp.name : selectedPatient?.name || '';

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const save = async () => {
    if (!patientId || !followUpDate) {
      Alert.alert('Missing information', 'Please select patient and follow-up date');
      return;
    }
    if (submitting) return;
    try {
      setSubmitting(true);
      if (editing) {
        await updateFollowUp(doctor.id, followUp, {
          followUpDate,
          followUpTime,
          followUpType,
          followUpStatus,
          notes: notes || 'N/A',
        });
      } else {
        await createFollowUp(doctor.id, {
          patientId,
          appointmentId: selectedPatient?.appointmentId,
          followUpDate,
          followUpTime,
          followUpType,
          notes,
        }, selectedPatient);
      }
      onSaved?.();
      onBack();
    } catch (err) {
      Alert.alert('Error', apiErrorMessage(err, editing ? 'Failed to update follow-up' : 'Failed to add follow-up'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>{editing ? 'Edit Follow-up' : 'New Follow-up'}</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Label text="PATIENT" />
        <Select
          value={patientLabel}
          placeholder="Select patient"
          icon="search"
          onPress={editing ? undefined : () => setOpen(open === 'patient' ? null : 'patient')}
        />
        {!editing && open === 'patient' && (
          patients.length === 0 ? (
            <View style={s.options}><Text style={s.emptyOption}>No patients found in your appointments yet.</Text></View>
          ) : (
            <View style={s.options}>
              {patients.map((p) => (
                <Pressable key={String(p.id)} onPress={() => { setPatientId(p.id); setOpen(null); }} style={s.option}>
                  <Text style={s.optionText}>{p.name}</Text>
                  <Text style={s.optionSub}>{p.phone} • Last visit: {p.lastVisit ? displayDate(normalizeDateInput(p.lastVisit)) : 'N/A'}</Text>
                </Pressable>
              ))}
            </View>
          )
        )}
        {!!selectedPatient && !editing && (
          <Text style={s.hint}>Issue: {selectedPatient.issue}</Text>
        )}
        <View style={s.row}>
          <View style={s.half}>
            <Label text="DATE" />
            <Pressable onPress={() => setShowDatePicker(true)} style={s.inputBox}>
              <AppIcon name="calendar" size={17} color="#667085" />
              <Text style={[s.selectText, !followUpDate && s.placeholder]}>{followUpDate ? displayDate(followUpDate) : 'Select date'}</Text>
            </Pressable>
          </View>
          <View style={s.half}>
            <Label text="TIME" />
            <Pressable onPress={() => setShowTimePicker(true)} style={s.inputBox}>
              <AppIcon name="clock" size={17} color="#667085" />
              <Text style={[s.selectText, !followUpTime && s.placeholder]}>{followUpTime ? displayTime(followUpTime) : 'Select time'}</Text>
            </Pressable>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={pickerDate(followUpDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={editing ? undefined : new Date()}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowDatePicker(false);
              if (selected) setFollowUpDate(formatLocalDateKey(selected));
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={pickerDate(followUpDate, followUpTime)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowTimePicker(false);
              if (selected) setFollowUpTime(toTimeValue(selected));
            }}
          />
        )}
        <Label text="ASSIGN DOCTOR" />
        <View style={s.inputBox}>
          <AppIcon name="users" size={17} color="#667085" />
          <Text style={s.selectText}>{doctor?.name || 'Doctor'}</Text>
        </View>
        <Label text="FOLLOW-UP TYPE" />
        <View style={s.priority}>
          {TYPES.map((item) => (
            <Pressable key={item.value} onPress={() => setFollowUpType(item.value)} style={[s.priorityItem, followUpType === item.value && s.priorityActive]}>
              <Text style={[s.priorityText, followUpType === item.value && s.priorityTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {editing && (
          <>
            <Label text="STATUS" />
            <View style={s.priority}>
              {STATUSES.map((item) => (
                <Pressable key={item.value} onPress={() => setFollowUpStatus(item.value)} style={[s.priorityItem, followUpStatus === item.value && s.priorityActive]}>
                  <Text style={[s.priorityText, followUpStatus === item.value && s.priorityTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Label text="NOTES & INSTRUCTIONS" />
        <TextInput value={notes} onChangeText={setNotes} multiline textAlignVertical="top" placeholder="Add any specific preparation instructions or clinical notes here..." placeholderTextColor="#8A94A4" style={s.notes} />
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={save} style={s.createWrap} disabled={submitting}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.create}>
            <AppIcon name="calendar" size={16} color="#FFF" />
            <Text style={s.createText}>{submitting ? 'Saving...' : editing ? 'Update Follow-up' : 'Create Follow-up'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
function Label({ text }) {
  return <Text style={s.label}>{text}</Text>;
}
function Select({ value, placeholder, onPress, icon }) {
  return (
    <Pressable onPress={onPress} style={s.inputBox}>
      {icon && <AppIcon name={icon} size={17} color="#667085" />}
      <Text style={[s.selectText, !value && s.placeholder]}>{value || placeholder}</Text>
      <Text style={s.chevron}>⌄</Text>
    </Pressable>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 13, paddingBottom: 30 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: '#526078', marginTop: 14, marginBottom: 7 },
  inputBox: { height: 49, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#BFC9D8', borderRadius: 7, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  input: { flex: 1, fontSize: 15, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  selectText: { fontSize: 15, color: '#17243A', marginLeft: 4 },
  placeholder: { color: '#526078' },
  chevron: { marginLeft: 'auto', fontSize: 17, color: '#667085' },
  options: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, marginTop: 4, overflow: 'hidden', zIndex: 3 },
  option: { minHeight: 46, paddingVertical: 6, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  optionText: { fontSize: 14, color: '#344054' },
  optionSub: { fontSize: 12, color: '#8A94A4', marginTop: 2 },
  hint: { fontSize: 12.5, color: '#526078', marginTop: 6 },
  emptyOption: { fontSize: 13, color: '#8A94A4', padding: 13 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  priority: { height: 43, backgroundColor: '#E6E9EE', borderRadius: 7, flexDirection: 'row', padding: 3 },
  priorityItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 5 },
  priorityActive: { backgroundColor: '#FFF', shadowColor: '#17243A', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  priorityText: { fontSize: 14, color: '#667085' },
  priorityTextActive: { color: '#0D9488', fontWeight: '700' },
  notes: { height: 126, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#BFC9D8', borderRadius: 7, padding: 12, fontSize: 14, lineHeight: 20, color: '#17243A' },
  footer: { height: 72, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9', padding: 11 },
  createWrap: {},
  create: { height: 49, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
