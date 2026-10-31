// The Add / Edit vitals form shared by the receptionist (before the checkup)
// and the doctor (optionally, during the consultation): the blood group, the
// same eight readings with units, optional notes, and one Save button. The
// caller saves.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';
import { BLOOD_GROUPS, normalizeBloodGroup } from '../utils/appointmentVitals';

export { BLOOD_GROUPS, normalizeBloodGroup };

// [key, label, placeholder, unit, accent]
export const VITAL_FIELDS = [
  ['blood_pressure', 'Blood pressure', '120/80', 'mmHg', '#F43F5E'],
  ['pulse', 'Pulse', '72', 'bpm', '#14B8A6'],
  ['temperature', 'Temperature', '37.0', '°C', '#F59E0B'],
  ['spo2', 'SpO₂', '98', '%', '#3B82F6'],
  ['respiratory_rate', 'Breathing rate', '16', '/min', '#6366F1'],
  ['weight', 'Weight', '65', 'kg', '#8B5CF6'],
  ['height', 'Height', '170', 'cm', '#64748B'],
  ['pain_score', 'Pain score', '0–10', '/10', '#E11D48'],
];

// Blood group is picked, not typed. Clinic staff record it here; the patient
// only sees it. [key, label, placeholder, unit, accent] like VITAL_FIELDS.
export const BLOOD_GROUP_FIELD = ['blood_group', 'Blood group', '', '', '#DC2626'];
// What read-only vitals views list: the blood group, then the readings.
export const VITAL_DISPLAY_FIELDS = [BLOOD_GROUP_FIELD, ...VITAL_FIELDS];

export const hasVital = (value) => value !== '' && value !== undefined && value !== null && String(value).trim() !== '';

const parseVitals = (value) => {
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return value && typeof value === 'object' ? value : {};
};

// Older records use bp / bloodPressure / heartRate for the same readings.
export const canonicalVitals = (value) => {
  const v = parseVitals(value);
  return {
    ...v,
    blood_pressure: v.blood_pressure ?? v.bp ?? v.bloodPressure ?? '',
    pulse: v.pulse ?? v.heartRate ?? v.heart_rate ?? '',
    blood_group: normalizeBloodGroup(v.blood_group ?? v.bloodGroup),
  };
};

export const vitalsDraft = (value) => {
  const v = canonicalVitals(value);
  return Object.fromEntries([...VITAL_DISPLAY_FIELDS.map(([key]) => [key, v[key] ?? '']), ['notes', v.notes || '']]);
};

export const hasAnyVitals = (value) => {
  const v = canonicalVitals(value);
  return VITAL_DISPLAY_FIELDS.some(([key]) => hasVital(v[key]));
};

// `onSubmit(draft)` saves and resolves; a rejection is shown under the form.
export default function VitalsForm({ initialVitals, onSubmit, onInputFocus, onBusyChange, color = '#12756D' }) {
  const [draft, setDraft] = useState(() => vitalsDraft(initialVitals));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bloodOpen, setBloodOpen] = useState(false);
  const saving = useRef(false);
  const inputRefs = useRef({});

  const save = async () => {
    if (saving.current) return;
    if (!VITAL_DISPLAY_FIELDS.some(([key]) => String(draft[key] ?? '').trim())) {
      setError('Enter at least one measured vital or the blood group.');
      return;
    }
    saving.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      await onSubmit(draft);
      Keyboard.dismiss();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Vitals could not be saved. Please try again.');
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <View>
      <Text style={s.hint}>Fill in the readings you measured — every field is optional, but enter at least one.</Text>
      <Text style={s.label}>Blood group</Text>
      {/* A dropdown: the field shows the choice, tapping it lists the groups. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Blood group"
        accessibilityState={{ expanded: bloodOpen, disabled: busy }}
        disabled={busy}
        onPress={() => { Keyboard.dismiss(); setBloodOpen((open) => !open); }}
        style={[s.inputBox, s.bloodField, bloodOpen && { borderColor: color }]}
      >
        <Text translate={false} style={[s.bloodValue, !draft.blood_group && s.bloodPlaceholder]}>
          {draft.blood_group || 'Select blood group'}
        </Text>
        <Ionicons name={bloodOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#728092" />
      </Pressable>
      {bloodOpen && (
        <View style={s.bloodList}>
          {['', ...BLOOD_GROUPS].map((group) => {
            const active = (draft.blood_group || '') === group;
            return (
              <Pressable
                key={group || 'none'}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={group ? `Blood group ${group}` : 'Blood group not recorded'}
                onPress={() => {
                  setDraft((current) => ({ ...current, blood_group: group }));
                  setBloodOpen(false);
                }}
                style={({ pressed }) => [s.bloodOption, active && s.bloodOptionActive, pressed && s.bloodOptionPressed]}
              >
                <Text translate={false} style={[s.bloodOptionText, !group && s.bloodPlaceholder, active && { color }]}>
                  {group || 'Not recorded'}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={color} />}
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={s.grid}>
        {VITAL_FIELDS.map(([key, label, placeholder, unit]) => (
          <View key={key} style={s.cell}>
            <Text style={s.label}>{label}</Text>
            <View style={s.inputBox}>
              <TextInput
                ref={node => { inputRefs.current[key] = node; }}
                value={String(draft[key] ?? '')}
                onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
                placeholder={placeholder}
                placeholderTextColor="#A6B1BE"
                keyboardType={key === 'blood_pressure' ? 'numbers-and-punctuation' : 'decimal-pad'}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => {
                  const nextKey = VITAL_FIELDS[VITAL_FIELDS.findIndex(([field]) => field === key) + 1]?.[0] || 'notes';
                  inputRefs.current[nextKey]?.focus();
                }}
                onFocus={onInputFocus}
                accessibilityLabel={`${label} (${unit})`}
                editable={!busy}
                style={s.input}
              />
              <Text translate={false} style={s.unit}>{unit}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[s.label, s.notesLabel]}>Measurement notes</Text>
      <TextInput
        ref={node => { inputRefs.current.notes = node; }}
        value={draft.notes}
        onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
        placeholder="Optional — e.g. measured after rest, left arm"
        placeholderTextColor="#A6B1BE"
        multiline
        onFocus={onInputFocus}
        accessibilityLabel="Measurement notes"
        editable={!busy}
        style={[s.inputBox, s.notes]}
      />
      {!!error && <Text translate={false} style={s.error}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        onPress={save}
        disabled={busy}
        style={({ pressed }) => [s.save, { backgroundColor: color }, pressed && s.savePressed, busy && s.saveBusy]}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
        <Text style={s.saveText}>{busy ? 'Saving...' : 'Save vitals'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: 12.5, lineHeight: 18, color: '#728092', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  cell: { width: '48.5%' },
  bloodField: { justifyContent: 'space-between', marginBottom: 14 },
  bloodValue: { fontSize: 15, fontWeight: '700', color: '#213547' },
  bloodPlaceholder: { color: '#A6B1BE', fontWeight: '600' },
  bloodList: { marginTop: -8, marginBottom: 14, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 11, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  bloodOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F4F7' },
  bloodOptionActive: { backgroundColor: '#F4FAF8' },
  bloodOptionPressed: { backgroundColor: '#EEF2F5' },
  bloodOptionText: { fontSize: 15, fontWeight: '700', color: '#344054' },
  label: { fontSize: 12, fontWeight: '700', color: '#475467', marginBottom: 6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 11, backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, color: '#213547', fontSize: 15, fontWeight: '600' },
  unit: { fontSize: 12, fontWeight: '700', color: '#728092', marginLeft: 6 },
  notesLabel: { marginTop: 14 },
  notes: { minHeight: 80, paddingVertical: 10, textAlignVertical: 'top', alignItems: 'flex-start', color: '#213547', fontSize: 14 },
  error: { fontSize: 12.5, color: '#B42318', marginTop: 10 },
  save: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  savePressed: { opacity: 0.88 },
  saveBusy: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
