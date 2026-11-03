// Ported from MediconecktApp's NewFollowUpScreen. Create + edit form with the
// web Follow-Up page's fields and payloads:
//   create -> POST /api/followups  (patient from the doctor's appointments)
//   edit   -> PUT  /api/followups/:id
// Dates are sent as YYYY-MM-DD, same as the web input. There is no time
// field: a follow-up is for a day (an existing time is left as saved).
import React, { useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { formatLocalDateKey } from '../api/doctorAppointments';
import { apiErrorMessage, createFollowUp, normalizeDateInput, updateFollowUp } from '../api/doctorFollowUps';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import displayLocale from '../../../../utils/displayLocale';

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

const displayDate = (key) =>
  key ? new Date(`${key}T00:00:00`).toLocaleDateString(displayLocale('en-US'), { month: 'short', day: '2-digit', year: 'numeric' }) : '';
const pickerDate = (key) => (key ? new Date(`${key}T00:00:00`) : new Date());

export default function NewFollowUpScreen({ doctor, patients = [], followUp, onBack, onSaved }) {
  // Signup-style keyboard handling: the form scrolls above the keyboard and the
  // focused field is scrolled into view (the window does not resize, edge-to-edge).
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  const editing = Boolean(followUp);
  const [patientId, setPatientId] = useState(followUp?.patientId || '');
  const [followUpDate, setFollowUpDate] = useState(editing ? normalizeDateInput(followUp.followUpDate) : '');
  const [followUpType, setFollowUpType] = useState(followUp?.followUpType || 'routine');
  const [followUpStatus, setFollowUpStatus] = useState(followUp?.followUpStatus || 'pending');
  const [notes, setNotes] = useState(followUp?.notes && followUp.notes !== 'N/A' ? followUp.notes : '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [open, setOpen] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // State alone can't stop a fast double tap (both taps run before the
  // re-render), which created the same follow-up more than once.
  const submitLock = useRef(false);

  const selectedPatient = patients.find((p) => String(p.id) === String(patientId));
  const patientLabel = editing ? followUp.name : selectedPatient?.name || '';

  useDoctorBack(() => {
    onBack();
    return true;
  });

  const save = async () => {
    if (!patientId || !followUpDate) {
      Alert.alert('Missing information', 'Please select patient and follow-up date');
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      setSubmitting(true);
      if (editing) {
        await updateFollowUp(doctor.id, followUp, {
          followUpDate,
          followUpType,
          followUpStatus,
          notes: notes || 'N/A',
        });
      } else {
        await createFollowUp(doctor.id, {
          patientId,
          appointmentId: selectedPatient?.appointmentId,
          followUpDate,
          followUpType,
          notes,
        }, selectedPatient);
      }
      onSaved?.();
      onBack();
    } catch (err) {
      Alert.alert('Error', apiErrorMessage(err, editing ? 'Failed to update follow-up' : 'Failed to add follow-up'));
    } finally {
      submitLock.current = false;
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
      <ScrollView ref={kbScrollRef} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
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
                  <Text translate={false} style={s.optionText}>{p.name}</Text>
                  <Text translate={false} style={s.optionSub}>{p.phone} • Last visit: {p.lastVisit ? displayDate(normalizeDateInput(p.lastVisit)) : 'N/A'}</Text>
                </Pressable>
              ))}
            </View>
          )
        )}
        {!!selectedPatient && !editing && (
          <Text translate={false} style={s.hint}>Issue: {selectedPatient.issue}</Text>
        )}
        <Label text="DATE" />
        <Pressable onPress={() => setShowDatePicker(true)} style={s.inputBox}>
          <AppIcon name="calendar" size={17} color="#667085" />
          <Text style={[s.selectText, !followUpDate && s.placeholder]}>{followUpDate ? displayDate(followUpDate) : 'Select date'}</Text>
        </Pressable>
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
        <Label text="ASSIGN DOCTOR" />
        <View style={s.inputBox}>
          <AppIcon name="users" size={17} color="#667085" />
          <Text translate={false} style={s.selectText}>{doctor?.name || 'Doctor'}</Text>
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
      <Text translate={false} style={[s.selectText, !value && s.placeholder]}>{value || placeholder}</Text>
      <Text style={s.chevron}>⌄</Text>
    </Pressable>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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
