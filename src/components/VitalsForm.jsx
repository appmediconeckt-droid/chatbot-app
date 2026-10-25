// The Add / Edit vitals form shared by the receptionist (before the checkup)
// and the doctor (optionally, during the consultation): the same eight
// readings with units, optional notes, and one Save button. The caller saves.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';

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
  };
};

export const vitalsDraft = (value) => {
  const v = canonicalVitals(value);
  return Object.fromEntries([...VITAL_FIELDS.map(([key]) => [key, v[key] ?? '']), ['notes', v.notes || '']]);
};

export const hasAnyVitals = (value) => {
  const v = canonicalVitals(value);
  return VITAL_FIELDS.some(([key]) => hasVital(v[key]));
};

// `onSubmit(draft)` saves and resolves; a rejection is shown under the form.
export default function VitalsForm({ initialVitals, onSubmit, onInputFocus, onBusyChange, color = '#12756D' }) {
  const [draft, setDraft] = useState(() => vitalsDraft(initialVitals));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const inputRefs = useRef({});

  const save = async () => {
    if (saving.current) return;
    if (!VITAL_FIELDS.some(([key]) => String(draft[key] ?? '').trim())) {
      setError('Enter at least one measured vital.');
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
