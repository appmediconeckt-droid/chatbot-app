// Patient side → an appointment's "View Vitals": the readings the doctor or
// clinic recorded at that one visit, read-only. Blood group sits on its own
// card; readings that were measured show as tiles, the rest are listed as
// not measured.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';
import { getAppointmentVitals, hasVitalValue } from '../utils/appointmentVitals';

const GREEN = '#00652C';
const INK = '#1D2939';
const MUTED = '#667085';

const READINGS = [
  { key: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', icon: 'heart-outline', fg: '#D92D20', bg: '#FEF0EF' },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', icon: 'pulse-outline', fg: '#C11574', bg: '#FDF0F7' },
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: 'thermometer-outline', fg: '#DC6803', bg: '#FFF4E8' },
  { key: 'spo2', label: 'SpO₂', unit: '%', icon: 'water-outline', fg: '#1570EF', bg: '#EDF4FF' },
  { key: 'respiratory_rate', label: 'Breathing rate', unit: '/min', icon: 'leaf-outline', fg: '#0E9384', bg: '#E9F8F6' },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'barbell-outline', fg: '#6941C6', bg: '#F3EFFD' },
  { key: 'height', label: 'Height', unit: 'cm', icon: 'resize-outline', fg: '#3E4784', bg: '#EEF0FA' },
  { key: 'pain_score', label: 'Pain score', unit: '/10', icon: 'bandage-outline', fg: '#B54708', bg: '#FEF6E7' },
];

const unitOf = (field, vitals) => (field.key === 'temperature' ? `°${vitals.temperature_unit || 'C'}` : field.unit);
const tightUnit = (unit) => /^[/°%]/.test(unit);

const recordedLabel = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${
    date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

const roleLabel = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'doctor') return 'Recorded by your doctor';
  if (value === 'receptionist') return 'Recorded at the clinic desk';
  return 'Recorded at the clinic';
};

function PainBar({ value }) {
  const score = Math.max(0, Math.min(10, Math.round(Number(value) || 0)));
  const tone = score >= 7 ? '#D92D20' : score >= 4 ? '#F79009' : '#12B76A';
  return (
    <View style={s.painBar}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[s.painStep, i < score && { backgroundColor: tone }]} />
      ))}
    </View>
  );
}

export default function AppointmentVitalsSheet({ appointment, doctorName, clinicName, onClose }) {
  const insets = useSafeAreaInsets();
  const vitals = appointment ? getAppointmentVitals(appointment) : {};
  const recorded = READINGS.filter((field) => hasVitalValue(vitals[field.key]));
  const missing = READINGS.filter((field) => !hasVitalValue(vitals[field.key]));
  const when = recordedLabel(vitals.recorded_at);
  const subtitle = [doctorName, clinicName].filter(Boolean).join(' · ');

  return (
    <Modal visible={Boolean(appointment)} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[s.overlay, { paddingTop: Math.max(insets.top, 24) }]}>
        <Pressable style={s.flex} onPress={onClose} accessibilityLabel="Close vitals" />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={s.handle} />
          <View style={s.head}>
            <LinearGradient colors={[GREEN, '#12B76A']} style={s.headIcon}>
              <Ionicons name="pulse" size={22} color="#FFFFFF" />
            </LinearGradient>
            <View style={s.flex}>
              <Text style={s.title}>Your vitals</Text>
              {!!subtitle && <Text translate={false} style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close vitals" hitSlop={10} style={s.close}>
              <Ionicons name="close" size={20} color="#475467" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <View style={s.metaRow}>
              {!!when && (
                <View style={s.metaChip}>
                  <Ionicons name="calendar-outline" size={13} color={GREEN} />
                  <Text translate={false} style={s.metaText}>{when}</Text>
                </View>
              )}
              <View style={s.metaChip}>
                <Ionicons name="shield-checkmark-outline" size={13} color={GREEN} />
                <Text style={s.metaText}>{roleLabel(vitals.recorded_role)}</Text>
              </View>
            </View>

            <View style={s.bloodCard}>
              <View style={s.bloodIcon}><Ionicons name="water" size={20} color="#D92D20" /></View>
              <View style={s.flex}>
                <Text style={s.bloodLabel}>Blood group</Text>
                {vitals.blood_group
                  ? <Text translate={false} style={s.bloodValue}>{vitals.blood_group}</Text>
                  : <Text style={s.bloodMissing}>Not recorded</Text>}
              </View>
            </View>

            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Readings</Text>
              <View style={s.countPill}>
                <Text translate={false} style={s.countText}>{recorded.length} of {READINGS.length} measured</Text>
              </View>
            </View>

            {recorded.length > 0 ? (
              <View style={s.grid}>
                {recorded.map((field) => {
                  const unit = unitOf(field, vitals);
                  return (
                    <View key={field.key} style={s.tile}>
                      <View style={s.tileTop}>
                        <View style={[s.tileIcon, { backgroundColor: field.bg }]}>
                          <Ionicons name={field.icon} size={16} color={field.fg} />
                        </View>
                        <Text style={s.tileLabel} numberOfLines={1}>{field.label}</Text>
                      </View>
                      <Text translate={false} style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit>
                        {String(vitals[field.key]).trim()}
                        <Text translate={false} style={s.tileUnit}>{tightUnit(unit) ? unit : ` ${unit}`}</Text>
                      </Text>
                      {field.key === 'pain_score' && <PainBar value={vitals.pain_score} />}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={s.empty}>No readings were measured at this visit.</Text>
            )}

            {missing.length > 0 && recorded.length > 0 && (
              <Text translate={false} style={s.missing}>Not measured: {missing.map((field) => field.label).join(', ')}</Text>
            )}

            {hasVitalValue(vitals.notes) && (
              <View style={s.notes}>
                <Ionicons name="document-text-outline" size={16} color="#475467" />
                <View style={s.flex}>
                  <Text style={s.notesTitle}>Notes</Text>
                  <Text translate={false} style={s.notesText}>{String(vitals.notes)}</Text>
                </View>
              </View>
            )}

            <View style={s.info}>
              <Ionicons name="information-circle-outline" size={16} color="#3D7A55" />
              <Text style={s.infoText}>Measured at the clinic for this visit. Ask your doctor if any reading worries you.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: {
    maxHeight: '88%', backgroundColor: '#F7F9F8', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, width: '100%', maxWidth: 720, alignSelf: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 12 },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAECF0',
  },
  headIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: INK },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2F1', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: '#E6F6EC', borderWidth: 1, borderColor: '#CDEBD8',
  },
  metaText: { fontSize: 12, fontWeight: '700', color: '#205A36' },

  bloodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FDD8D4',
  },
  bloodIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FEF0EF', alignItems: 'center', justifyContent: 'center' },
  bloodLabel: { fontSize: 12, fontWeight: '700', color: MUTED, letterSpacing: 0.3 },
  bloodValue: { fontSize: 24, fontWeight: '900', color: '#B42318', marginTop: 1 },
  bloodMissing: { fontSize: 15, fontWeight: '700', color: '#98A2B3', marginTop: 3 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: INK },
  countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4EDE9' },
  countText: { fontSize: 11.5, fontWeight: '700', color: GREEN },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: {
    width: '48.5%', padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAEFED',
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: MUTED },
  tileValue: { fontSize: 21, fontWeight: '800', color: INK, marginTop: 10 },
  tileUnit: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  painBar: { flexDirection: 'row', gap: 3, marginTop: 8 },
  painStep: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#EAECF0' },

  empty: { fontSize: 13, color: MUTED, paddingVertical: 8 },
  missing: { fontSize: 12, color: '#98A2B3', marginTop: 12, lineHeight: 17 },
  notes: {
    flexDirection: 'row', gap: 10, marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAECF0',
  },
  notesTitle: { fontSize: 12, fontWeight: '700', color: '#475467', marginBottom: 2 },
  notesText: { fontSize: 13.5, lineHeight: 19, color: INK },
  info: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: '#EEF8F1',
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#3D7A55' },
});
