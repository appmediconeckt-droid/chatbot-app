// Health Vitals tracker — shown only once the patient has a completed
// appointment with a Doctor (psychiatrist), not a plain Consultant. UI ONLY:
// values are local state, nothing is sent to the backend. Tap a tile to log
// a new reading for that metric.
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../../../../components/TranslatedText';
import { PATIENT } from '../../../../../../theme/palette';

const METRICS = [
  { key: 'bp', label: 'Blood Pressure', unit: 'mmHg', icon: 'heart', tint: '#FEE2E2', color: '#DC2626', placeholder: '120/80' },
  { key: 'sugar', label: 'Blood Sugar', unit: 'mg/dL', icon: 'water', tint: '#DBEAFE', color: '#2563EB', placeholder: '95' },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'barbell', tint: '#FEF3C7', color: '#B45309', placeholder: '70' },
  { key: 'spo2', label: 'SPO2', unit: '%', icon: 'pulse', tint: '#DCFCE7', color: PATIENT.primary, placeholder: '98' },
  { key: 'temp', label: 'Temperature', unit: '°F', icon: 'thermometer', tint: '#E0E7FF', color: '#4F46E5', placeholder: '98.6' },
];

export default function HealthVitalsCard() {
  const [values, setValues] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');

  const startEdit = (metric) => {
    setEditingKey(metric.key);
    setDraft(values[metric.key] || '');
  };

  const confirmEdit = () => {
    const value = draft.trim();
    if (value) setValues((prev) => ({ ...prev, [editingKey]: value }));
    setEditingKey(null);
    setDraft('');
  };

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Ionicons name="fitness-outline" size={17} color={PATIENT.primary} />
        <Text style={s.title}>Health Vitals</Text>
      </View>
      <Text style={s.subtitle}>Tracked since your last doctor visit</Text>

      <View style={s.grid}>
        {METRICS.map((metric) => {
          const hasReading = !!values[metric.key];
          const isEditing = editingKey === metric.key;
          return (
            <Pressable
              key={metric.key}
              onPress={() => (isEditing ? null : startEdit(metric))}
              style={s.tile}
            >
              <View style={[s.iconCircle, { backgroundColor: metric.tint }]}>
                <Ionicons name={metric.icon} size={16} color={metric.color} />
              </View>
              <Text style={s.metricLabel}>{metric.label}</Text>

              {isEditing ? (
                <View style={s.editRow}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={metric.placeholder}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                    style={s.editInput}
                    autoFocus
                    onSubmitEditing={confirmEdit}
                  />
                  <Pressable onPress={confirmEdit} style={s.editConfirm}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={s.metricValue}>
                    {values[metric.key] || metric.placeholder}
                    <Text style={s.metricUnit}> {metric.unit}</Text>
                  </Text>
                  <Text style={s.metricSub}>{hasReading ? 'Latest reading' : 'Tap to log a reading'}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 15.5, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 11 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  metricLabel: { fontSize: 11.5, color: '#64748B', fontWeight: '600' },
  metricValue: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 3 },
  metricUnit: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  metricSub: { fontSize: 10.5, color: '#94A3B8', marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  editInput: { flex: 1, height: 30, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 7, paddingHorizontal: 8, fontSize: 12.5, color: '#0F172A', backgroundColor: '#FFFFFF' },
  editConfirm: { width: 26, height: 26, borderRadius: 7, backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
});
