// Web parity: Dashboard/DoctorDashboard.jsx EditCompletedModal. "View" on a
// completed queue row opens this as a read-only record (diagnosis, medicines,
// tests, advice, notes, follow-up). "Edit" switches to the form; Save PATCHes
// diagnosis / medicine / advice / additional_notes / follow_up_* (the parent
// does the request).
import React, { useRef, useState } from 'react';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { formatLocalDateKey, getTokenLabel } from '../api/doctorAppointments';
import { formatDuration } from './ActiveConsultationCard';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import useKeyboardLift from '../../../../hooks/useKeyboardLift';
import { getDoctorMedicines, getDoctorTests } from '../../../../utils/consultationDetails';

const has = (value) => value != null && String(value).trim() !== '' && !/^(n\/?a|not recorded|none|—)$/i.test(String(value).trim());

const formatDateTime = (value) => {
  const d = new Date(Number(value) || value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

const formatDay = (key) => {
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const TIMINGS = ['Morning', 'Afternoon', 'Evening', 'Night'];
let medicineSeq = 0;
const medicineRow = (m = {}) => ({ id: ++medicineSeq, name: m.name || '', dosage: m.dosage || '', timings: m.timings || [], duration: m.duration || '' });

// Back to the text the server keeps: "Name - 1 Tablet (Morning, Night) - 5 days".
const medicineText = (rows) => rows
  .filter((m) => m.name.trim())
  .map((m) => (m.dosage.trim() || m.timings.length || m.duration.trim()
    ? `${m.name.trim()} - ${m.dosage.trim() || 'Dosage'} (${m.timings.join(', ')}) - ${m.duration.trim() || '—'}`
    : m.name.trim()))
  .join('\n');

const TONE_FG = { teal: '#0F766E', indigo: '#4338CA', amber: '#B45309', blue: '#2563EB', slate: '#475569' };

function Section({ icon, title, tone = 'teal', children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, styles[`icon_${tone}`]]}>
          <AppIcon name={icon} size={14} color={TONE_FG[tone]} strokeWidth={2.2} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// Compact text box that grows with its text.
function Field({ label, icon, value, onChangeText, placeholder }) {
  return (
    <View>
      <View style={styles.fieldHead}>
        <AppIcon name={icon} size={13} color="#0F766E" strokeWidth={2.2} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
      />
    </View>
  );
}

export default function EditCompletedAppointmentScreen({ appointment, onCancel, onSave }) {
  const {
    scrollRef: kbScrollRef,
    keyboardOpen,
    keyboardTop,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ layoutAvoidsKeyboard: true });
  const [screenRef, keyboardLift] = useKeyboardLift(keyboardOpen, keyboardTop);

  const raw = appointment.__raw || appointment;
  // The medicine text is what Save updates, so prefer it; the structured list
  // from the original completion is only used when there is no text.
  const medicines = getDoctorMedicines(has(appointment.medicine) ? { medicine: appointment.medicine } : raw);
  const tests = getDoctorTests(raw);
  const completedAt = appointment.endTime ? formatDateTime(appointment.endTime) : '';
  const hasClinical = [appointment.diagnosis, appointment.advice, appointment.additionalNotes].some(has) || medicines.length > 0 || tests.length > 0;

  const [editing, setEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(appointment.diagnosis || '');
  const [medicineRows, setMedicineRows] = useState(() => medicines.map(medicineRow));
  const [advice, setAdvice] = useState(appointment.advice || '');
  const [additionalNotes, setAdditionalNotes] = useState(appointment.additionalNotes || '');
  const [followUpRequired, setFollowUpRequired] = useState(Boolean(appointment.followUpRequired));
  const [followUpDate, setFollowUpDate] = useState(appointment.followUpDate || '');
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  const updateRow = (id, patch) => setMedicineRows((rows) => rows.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const toggleTiming = (m, time) => updateRow(m.id, {
    timings: m.timings.includes(time) ? m.timings.filter((x) => x !== time) : TIMINGS.filter((x) => x === time || m.timings.includes(x)),
  });

  const openDatePicker = () => {
    const value = followUpDate ? new Date(`${followUpDate}T00:00:00`) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (event, selected) => { if (event?.type === 'set' && selected) setFollowUpDate(formatLocalDateKey(selected)); },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  };

  const save = async () => {
    if (saveLock.current) return;
    if (followUpRequired && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate.trim())) {
      setFormError('Pick a follow-up date, or untick Follow-up required.');
      return;
    }
    setFormError('');
    saveLock.current = true;
    setSaving(true);
    try {
      await onSave?.({
        diagnosis,
        medicine: medicineText(medicineRows),
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
    <View ref={screenRef} collapsable={false} style={[styles.screen, keyboardLift > 0 && { paddingBottom: keyboardLift }]}>
      <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleBar}>
        <TouchableOpacity onPress={editing ? () => setEditing(false) : onCancel} hitSlop={10} style={styles.headerIconButton}>
          <AppIcon name="chevron-left" size={22} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>COMPLETED VISIT</Text>
          <Text style={styles.title}>{editing ? 'Edit Record' : 'Appointment Record'}</Text>
        </View>
        <View style={styles.headerBadge}>
          <AppIcon name={editing ? 'edit' : 'check'} size={18} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </LinearGradient>

      <ScrollView
        ref={kbScrollRef}
        contentContainerStyle={styles.content}
        onScroll={kbOnScroll}
        onLayout={kbOnLayout}
        onFocusCapture={kbFocus}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Patient */}
        <View style={styles.patientCard}>
          <View style={styles.avatar}>
            <Text translate={false} style={styles.avatarText}>{String(appointment.name || 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text translate={false} style={styles.patientName} numberOfLines={1}>{appointment.name}</Text>
            <Text translate={false} style={styles.meta} numberOfLines={1}>
              {[getTokenLabel(appointment), has(appointment.issue) && appointment.issue].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <View style={styles.donePill}>
            <AppIcon name="check-mark" size={11} color="#047857" strokeWidth={3} />
            <Text style={styles.donePillText}>Completed</Text>
          </View>
        </View>

        {!editing && (!!completedAt || !!appointment.durationMs) && (
          <View style={styles.statRow}>
            {!!completedAt && (
              <View style={styles.stat}>
                <AppIcon name="calendar" size={14} color="#0D9488" strokeWidth={2.1} />
                <View style={styles.flex}>
                  <Text style={styles.statLabel}>Completed</Text>
                  <Text translate={false} style={styles.statValue}>{completedAt}</Text>
                </View>
              </View>
            )}
            {!!appointment.durationMs && (
              <View style={styles.stat}>
                <AppIcon name="timer" size={14} color="#0D9488" strokeWidth={2.1} />
                <View style={styles.flex}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text translate={false} style={styles.statValue}>{formatDuration(appointment.durationMs)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {editing ? (
          <>
            <View style={styles.formCard}>
              <Field label="Diagnosis" icon="note" value={diagnosis} onChangeText={setDiagnosis} placeholder="Final diagnosis" />
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHead}>
                <AppIcon name="pill" size={13} color="#0F766E" strokeWidth={2.2} />
                <Text style={[styles.fieldLabel, styles.flex]}>Medicines</Text>
                <TouchableOpacity onPress={() => setMedicineRows((rows) => [...rows, medicineRow()])} hitSlop={8} style={styles.addButton}>
                  <AppIcon name="plus" size={12} color="#0D9488" strokeWidth={2.6} />
                  <Text style={styles.addText}>Add medicine</Text>
                </TouchableOpacity>
              </View>
              {!medicineRows.length && <Text style={styles.formHint}>No medicines on this visit.</Text>}
              {medicineRows.map((m, index) => (
                <View key={m.id} style={styles.medEdit}>
                  <View style={styles.medEditTop}>
                    <View style={styles.medIndex}><Text translate={false} style={styles.medIndexText}>{index + 1}</Text></View>
                    <TextInput style={[styles.inputLine, styles.flex]} value={m.name} onChangeText={(v) => updateRow(m.id, { name: v })} placeholder="Medicine name" placeholderTextColor="#98A2B3" />
                    <TouchableOpacity onPress={() => setMedicineRows((rows) => rows.filter((row) => row.id !== m.id))} hitSlop={8} style={styles.removeButton} accessibilityLabel={`Remove medicine ${index + 1}`}>
                      <AppIcon name="x" size={13} color="#98A2B3" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.medEditRow}>
                    <TextInput style={[styles.inputLine, styles.flex]} value={m.dosage} onChangeText={(v) => updateRow(m.id, { dosage: v })} placeholder="Dosage, e.g. 1 tablet" placeholderTextColor="#98A2B3" />
                    <TextInput style={[styles.inputLine, styles.flex]} value={m.duration} onChangeText={(v) => updateRow(m.id, { duration: v })} placeholder="Duration, e.g. 5 days" placeholderTextColor="#98A2B3" />
                  </View>
                  <View style={styles.timingRow}>
                    {TIMINGS.map((time) => {
                      const on = m.timings.includes(time);
                      return (
                        <TouchableOpacity key={time} onPress={() => toggleTiming(m, time)} style={[styles.timing, on && styles.timingOn]} activeOpacity={0.8}>
                          <Text style={[styles.timingText, on && styles.timingTextOn]}>{time}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.formCard}>
              <Field label="Advice" icon="message" value={advice} onChangeText={setAdvice} placeholder="Care instructions for the patient" />
              <View style={styles.fieldGap} />
              <Field label="Additional notes" icon="file" value={additionalNotes} onChangeText={setAdditionalNotes} placeholder="Clinical notes or observations" />
            </View>

            <View style={styles.formCard}>
              <TouchableOpacity style={styles.checkRow} onPress={() => setFollowUpRequired((v) => !v)} activeOpacity={0.8}>
                <View style={[styles.checkbox, followUpRequired && styles.checkboxOn]}>
                  {followUpRequired && <AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.checkText}>Follow-up required</Text>
                  <Text style={styles.formHint}>Schedule a return visit if the patient needs review.</Text>
                </View>
              </TouchableOpacity>
              {followUpRequired && (
                <TouchableOpacity style={styles.dateButton} onPress={openDatePicker} activeOpacity={0.8}>
                  <AppIcon name="calendar" size={15} color="#0D9488" strokeWidth={2.1} />
                  <Text translate={false} style={[styles.dateText, !followUpDate && styles.datePlaceholder]}>
                    {followUpDate ? formatDay(followUpDate) : 'Select follow-up date'}
                  </Text>
                  <AppIcon name="chevron-down" size={14} color="#667085" strokeWidth={2.2} />
                </TouchableOpacity>
              )}
              {Platform.OS === 'ios' && followUpRequired && showIosPicker && (
                <DateTimePicker
                  value={followUpDate ? new Date(`${followUpDate}T00:00:00`) : new Date()}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(event, selected) => { if (selected) setFollowUpDate(formatLocalDateKey(selected)); }}
                />
              )}
            </View>
            {!!formError && <Text style={styles.formError}>{formError}</Text>}
          </>
        ) : (
          <>
            {hasClinical ? (
              <>
                {has(appointment.diagnosis) && (
                  <Section icon="note" title="Diagnosis" tone="indigo">
                    <Text translate={false} style={styles.bodyStrong}>{appointment.diagnosis}</Text>
                  </Section>
                )}
                {medicines.length > 0 && (
                  <Section icon="pill" title={`Medicines (${medicines.length})`}>
                    {medicines.map((m, index) => {
                      // Each value under its own label, like the prescription.
                      const details = [
                        ['Dosage', m.dosage],
                        ['When', (m.timings || []).join(', ')],
                        ['Duration', m.duration],
                      ].filter(([, value]) => has(value));
                      return (
                        <View key={`${m.name}-${index}`} style={[styles.med, index > 0 && styles.medSpaced]}>
                          <View style={styles.medTop}>
                            <View style={styles.medIndex}><Text translate={false} style={styles.medIndexText}>{index + 1}</Text></View>
                            <Text translate={false} style={[styles.medName, styles.flex]}>{m.name}</Text>
                          </View>
                          {details.length > 0 && (
                            <View style={styles.medDetails}>
                              {details.map(([label, value]) => (
                                <View key={label} style={styles.medDetail}>
                                  <Text style={styles.medDetailLabel}>{label}</Text>
                                  <Text translate={false} style={styles.medDetailValue}>{value}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </Section>
                )}
                {tests.length > 0 && (
                  <Section icon="flask" title="Recommended tests" tone="blue">
                    <View style={styles.chips}>
                      {tests.map((t, index) => <Text key={`${t}-${index}`} translate={false} style={[styles.chip, styles.testChip]}>{t}</Text>)}
                    </View>
                  </Section>
                )}
                {has(appointment.advice) && (
                  <Section icon="message" title="Advice" tone="amber">
                    <Text translate={false} style={styles.body}>{appointment.advice}</Text>
                  </Section>
                )}
                {has(appointment.additionalNotes) && (
                  <Section icon="file" title="Additional notes" tone="slate">
                    <Text translate={false} style={styles.body}>{appointment.additionalNotes}</Text>
                  </Section>
                )}
              </>
            ) : (
              <View style={styles.empty}>
                <AppIcon name="note" size={22} color="#98A2B3" />
                <Text style={styles.emptyText}>No clinical details were recorded for this visit.</Text>
              </View>
            )}
            <View style={[styles.follow, appointment.followUpRequired ? styles.followOn : styles.followOff]}>
              <AppIcon name="calendar" size={15} color={appointment.followUpRequired ? '#B45309' : '#667085'} strokeWidth={2.1} />
              <Text style={[styles.followLabel, appointment.followUpRequired && styles.followLabelOn]}>Follow-up</Text>
              <Text translate={false} style={[styles.followValue, appointment.followUpRequired && styles.followValueOn]}>
                {appointment.followUpRequired ? (appointment.followUpDate ? formatDay(appointment.followUpDate) : 'Required') : 'Not required'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {editing ? (
          <>
            <TouchableOpacity style={styles.cancel} onPress={() => setEditing(false)} disabled={saving}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveWrap} onPress={save} disabled={saving}>
              <LinearGradient colors={saving ? ['#8E9DB0', '#8E9DB0'] : CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveButton}>
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveWrap} onPress={() => setEditing(true)}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveButton}>
                <AppIcon name="edit" size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.saveText}>Edit Record</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', backgroundColor: colors.background },
  titleBar: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  headerCopy: { flex: 1 },
  kicker: { ...typography.label, fontSize: 10.5, lineHeight: 14, color: 'rgba(255,255,255,0.78)' },
  title: { ...typography.title, fontSize: 19, lineHeight: 24, color: '#FFFFFF', marginTop: 2 },
  headerBadge: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  content: { padding: 14, paddingBottom: 24 },

  patientCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#D6F1ED', padding: 13 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.title, fontSize: 18, color: '#0F766E' },
  patientName: { ...typography.title, fontSize: 16.5, lineHeight: 21, color: colors.ink },
  meta: { ...typography.body, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
  donePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#D1FAE5' },
  donePillText: { ...typography.label, fontSize: 11, color: '#047857' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 2 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E3EEEC', paddingVertical: 9, paddingHorizontal: 10 },
  statLabel: { ...typography.caption, fontSize: 10.5, color: '#64748B' },
  statValue: { ...typography.caption, fontSize: 12.5, color: colors.ink, marginTop: 1 },

  section: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E3EEEC', padding: 13, marginTop: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  icon_teal: { backgroundColor: '#E6FBF8' },
  icon_indigo: { backgroundColor: '#EEF2FF' },
  icon_amber: { backgroundColor: '#FEF3C7' },
  icon_blue: { backgroundColor: '#DBEAFE' },
  icon_slate: { backgroundColor: '#F1F5F9' },
  sectionTitle: { ...typography.subtitle, fontSize: 14.5, color: '#0F172A' },
  body: { ...typography.body, fontSize: 13.5, lineHeight: 20, color: '#344054' },
  bodyStrong: { ...typography.caption, fontSize: 14, lineHeight: 20, color: colors.ink },
  med: { padding: 11, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDEDE8' },
  medSpaced: { marginTop: 8 },
  medTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  medDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9, marginLeft: 32 },
  medDetail: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  medDetailLabel: { ...typography.label, fontSize: 9.5, letterSpacing: 0.4, textTransform: 'uppercase', color: '#64748B' },
  medDetailValue: { ...typography.caption, fontSize: 12.5, color: colors.ink, marginTop: 1 },
  medIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  medIndexText: { ...typography.label, fontSize: 11, color: '#FFFFFF' },
  medName: { ...typography.caption, fontSize: 14, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { ...typography.label, fontSize: 11.5, color: '#0F766E', backgroundColor: '#E6FBF8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  testChip: { color: '#1D4ED8', backgroundColor: '#DBEAFE' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 22, marginTop: 10, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  emptyText: { ...typography.body, fontSize: 13, color: colors.muted, textAlign: 'center' },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1 },
  followOn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  followOff: { backgroundColor: '#FFFFFF', borderColor: '#E3EEEC' },
  followLabel: { flex: 1, ...typography.caption, fontSize: 13, color: '#667085' },
  followLabelOn: { color: '#92400E' },
  followValue: { ...typography.caption, fontSize: 13, color: '#667085' },
  followValueOn: { fontSize: 14, color: '#B45309' },

  // Edit form
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E3EEEC', padding: 12, marginTop: 10 },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  formHint: { ...typography.body, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 2 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldLabel: { ...typography.caption, fontSize: 12.5, color: '#344054' },
  fieldGap: { height: 12 },
  input: { minHeight: 44, maxHeight: 140, borderWidth: 1, borderColor: '#D0DCDA', borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingTop: 10, paddingBottom: 10, ...typography.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  inputLine: { height: 40, borderWidth: 1, borderColor: '#D0DCDA', borderRadius: 9, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 0, ...typography.body, fontSize: 13.5, color: colors.ink },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E6FBF8' },
  addText: { ...typography.label, fontSize: 12, color: '#0D9488' },
  medEdit: { padding: 10, borderRadius: 11, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E3EEEC', marginTop: 8, gap: 8 },
  medEditTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medEditRow: { flexDirection: 'row', gap: 8 },
  removeButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EF' },
  timingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timing: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D0DCDA', backgroundColor: '#FFFFFF' },
  timingOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  timingText: { ...typography.label, fontSize: 11.5, color: '#475467' },
  timingTextOn: { color: '#FFFFFF' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.6, borderColor: '#AEB6C4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  checkText: { ...typography.caption, fontSize: 14, color: colors.ink },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 44, marginTop: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#99E4D8', backgroundColor: '#F0FDFA' },
  dateText: { flex: 1, ...typography.caption, fontSize: 13.5, color: colors.ink },
  datePlaceholder: { color: '#98A2B3' },
  formError: { ...typography.body, fontSize: 12.5, color: '#B42318', marginTop: 10 },

  footer: { minHeight: 68, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: { flex: 0.8, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#C9D1DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  cancelText: { ...typography.caption, fontSize: 14.5, color: '#252B35' },
  saveWrap: { flex: 1.3 },
  saveButton: { height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveText: { ...typography.caption, fontSize: 14.5, color: '#FFFFFF' },
});
