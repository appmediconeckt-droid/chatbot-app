import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './TranslatedText';
import { getAppointmentVitals, hasAppointmentVitals, hasVitalValue, VITAL_FIELDS } from '../utils/appointmentVitals';

export default function VitalsSummary({ appointment, title = 'Patient vitals' }) {
  if (!hasAppointmentVitals(appointment)) return null;
  const vitals = getAppointmentVitals(appointment);
  const recordedDate = new Date(vitals.recorded_at);
  return <View style={s.card}>
    <Text style={s.title}>{title}</Text>
    <View style={s.grid}>{VITAL_FIELDS.map(([key, label, unit]) => <View key={key} style={s.reading}>
      <Text style={s.label}>{label}</Text>
      <Text translate={false} style={s.value}>{hasVitalValue(vitals[key])
        ? `${vitals[key]}${key === 'temperature' ? ` °${vitals.temperature_unit}` : unit ? `${unit.startsWith('/') ? '' : ' '}${unit}` : ''}`
        : 'Not recorded'}</Text>
    </View>)}</View>
    {hasVitalValue(vitals.notes) && <Text translate={false} style={s.note}>{vitals.notes}</Text>}
    {Number.isFinite(recordedDate.getTime()) && <Text translate={false} style={s.meta}>
      {recordedDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST{vitals.recorded_role ? ` · ${vitals.recorded_role}` : ''}
    </Text>}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCEAE5', borderRadius: 14, padding: 14, marginVertical: 10 },
  title: { fontSize: 16, fontWeight: '700', color: '#0F766E', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reading: { width: '47%', backgroundColor: '#F3F8F6', padding: 10, borderRadius: 8 },
  label: { fontSize: 12, color: '#667085', marginBottom: 4 },
  value: { fontSize: 14, fontWeight: '700', color: '#213547' },
  note: { marginTop: 10, fontSize: 13, color: '#475467' },
  meta: { marginTop: 8, fontSize: 11, color: '#667085' },
});
