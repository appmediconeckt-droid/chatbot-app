// Patient profile → "My vitals": the readings clinic staff recorded at the
// patient's visits. Only the latest reading is shown — a newer recording
// replaces it, earlier visits are not listed again.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { fetchPatientVitals } from '../services/patientVitals';
import { hasVitalValue } from '../utils/appointmentVitals';

const GREEN = '#00652C';
const INK = '#1D2939';
const MUTED = '#667085';

const FIELDS = [
  { key: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', icon: 'heart-outline', fg: '#D92D20', bg: '#FEF0EF' },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', icon: 'pulse-outline', fg: '#C11574', bg: '#FDF0F7' },
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: 'thermometer-outline', fg: '#DC6803', bg: '#FFF4E8' },
  { key: 'spo2', label: 'SpO₂', unit: '%', icon: 'water-outline', fg: '#1570EF', bg: '#EDF4FF' },
  { key: 'respiratory_rate', label: 'Breathing rate', unit: '/min', icon: 'leaf-outline', fg: '#0E9384', bg: '#E9F8F6' },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'barbell-outline', fg: '#6941C6', bg: '#F3EFFD' },
  { key: 'height', label: 'Height', unit: 'cm', icon: 'resize-outline', fg: '#3E4784', bg: '#EEF0FA' },
  { key: 'pain_score', label: 'Pain score', unit: '/10', icon: 'bandage-outline', fg: '#B54708', bg: '#FEF6E7' },
];
const unitFor = (field, vitals) => (field.key === 'temperature' ? `°${vitals.temperature_unit || 'C'}` : field.unit);

const visitInfo = (appointment) => {
  const doctor = appointment.counselor || appointment.doctor;
  const vitals = appointment.vitals || {};
  return {
    doctor: doctor?.fullName || doctor?.name || appointment.doctor_name || '',
    recorded: FIELDS.filter((field) => hasVitalValue(vitals[field.key])),
    missing: FIELDS.filter((field) => !hasVitalValue(vitals[field.key])),
    notes: hasVitalValue(vitals.notes) ? String(vitals.notes) : '',
  };
};

export default function PatientVitalsButton() {
  const [records, setRecords] = useState([]);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const insets = useSafeAreaInsets();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await fetchPatientVitals();
      if (mounted.current) { setRecords(result); setError(''); }
    } catch (err) {
      if (mounted.current) setError(err.response?.data?.message || err.message || 'Vitals could not be loaded.');
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); setLoaded(true); }
    }
  }, []);
  useLiveRefresh(refresh, ['appointment-updated', 'appointment-status-changed']);
  if (!records.length && !visible) return null;

  const close = () => setVisible(false);
  const latest = records[0];
  const latestInfo = latest ? visitInfo(latest) : null;

  return <>
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [s.entry, pressed && s.pressed]}
      onPress={() => { setVisible(true); refresh(); }}
    >
      <View style={s.entryIcon}><Ionicons name="pulse" size={20} color="#FFFFFF" /></View>
      <View style={s.flex}>
        <Text style={s.entryTitle}>My vitals</Text>
        <Text style={s.entrySub} numberOfLines={1}>
          Your latest readings from the clinic
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={GREEN} />
    </Pressable>

    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close vitals" onPress={close} hitSlop={10} style={s.back}>
            <Ionicons name="arrow-back" size={22} color={INK} />
          </Pressable>
          <View style={s.flex}>
            <Text style={s.title}>My vitals</Text>
            <Text style={s.subtitle}>Measured by clinic staff at your visits</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={busy && loaded} onRefresh={refresh} colors={[GREEN]} tintColor={GREEN} />}
        >
          {busy && !loaded && !records.length && (
            <View style={s.state}><ActivityIndicator color={GREEN} /><Text style={s.stateText}>Loading your vitals...</Text></View>
          )}

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#B42318" />
              <Text translate={false} accessibilityRole="alert" style={s.errorText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={refresh} style={s.retry}><Text style={s.retryText}>Retry</Text></Pressable>
            </View>
          )}

          {!!latest && (
            <View style={s.latestCard}>
              <View style={s.latestHead}>
                <View style={s.flex}>
                  <Text style={s.eyebrow}>LATEST READING</Text>
                  <Text style={s.latestDate}>Your vitals</Text>
                  {!!latestInfo.doctor && (
                    <View style={s.doctorRow}>
                      <Ionicons name="medkit-outline" size={13} color={MUTED} />
                      <Text translate={false} style={s.doctorText} numberOfLines={1}>{latestInfo.doctor}</Text>
                    </View>
                  )}
                </View>
                <View style={s.countPill}>
                  <Text translate={false} style={s.countValue}>{latestInfo.recorded.length}</Text>
                  <Text style={s.countLabel}>readings</Text>
                </View>
              </View>
              <VitalTiles vitals={latest.vitals} fields={latestInfo.recorded} />
              {!!latestInfo.notes && <NotesBox text={latestInfo.notes} />}
              {latestInfo.missing.length > 0 && (
                <Text translate={false} style={s.missing}>Not measured: {latestInfo.missing.map((field) => field.label).join(', ')}</Text>
              )}
            </View>
          )}

          {loaded && !busy && !error && !records.length && (
            <View style={s.state}>
              <View style={s.emptyIcon}><Ionicons name="pulse-outline" size={28} color={GREEN} /></View>
              <Text style={s.emptyTitle}>No vitals recorded yet</Text>
              <Text style={s.stateText}>Readings taken at the clinic before your consultation will appear here.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  </>;
}

function VitalTiles({ vitals = {}, fields }) {
  return (
    <View style={s.grid}>
      {fields.map((field) => {
        const unit = unitFor(field, vitals);
        return (
          <View key={field.key} style={s.tile}>
            <View style={[s.tileIcon, { backgroundColor: field.bg }]}>
              <Ionicons name={field.icon} size={16} color={field.fg} />
            </View>
            <Text style={s.tileLabel} numberOfLines={1}>{field.label}</Text>
            <Text translate={false} style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit>
              {String(vitals[field.key])}
              <Text translate={false} style={s.tileUnit}>{unit.startsWith('/') || unit.startsWith('°') || unit === '%' ? unit : ` ${unit}`}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function NotesBox({ text }) {
  return (
    <View style={s.notes}>
      <Ionicons name="document-text-outline" size={15} color="#475467" />
      <View style={s.flex}>
        <Text style={s.notesTitle}>Notes from staff</Text>
        <Text translate={false} style={s.notesText}>{text}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },

  entry: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12, padding: 12,
    backgroundColor: '#E6F6EC', borderWidth: 1, borderColor: '#CDEBD8', borderRadius: 14,
  },
  entryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 15, fontWeight: '700', color: GREEN },
  entrySub: { fontSize: 12, color: '#3D7A55', marginTop: 2 },

  screen: { flex: 1, backgroundColor: '#F4F7F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#EAECF0',
  },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: INK },
  subtitle: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  content: { padding: 16 },

  state: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  stateText: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 14,
    backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA',
  },
  errorText: { flex: 1, fontSize: 13, color: '#B42318' },
  retry: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FECDCA' },
  retryText: { fontSize: 12.5, fontWeight: '700', color: '#B42318' },

  latestCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E4EDE9',
    shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  latestHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  eyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: GREEN },
  latestDate: { fontSize: 16, fontWeight: '700', color: INK, marginTop: 4 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  doctorText: { flexShrink: 1, fontSize: 12.5, color: MUTED },
  countPill: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#E6F6EC' },
  countValue: { fontSize: 17, fontWeight: '800', color: GREEN, lineHeight: 20 },
  countLabel: { fontSize: 10.5, fontWeight: '600', color: '#3D7A55' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.5%', padding: 12, borderRadius: 12, backgroundColor: '#F8FAFA', borderWidth: 1, borderColor: '#EEF2F1' },
  tileIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileLabel: { fontSize: 12, fontWeight: '600', color: MUTED },
  tileValue: { fontSize: 20, fontWeight: '800', color: INK, marginTop: 2 },
  tileUnit: { fontSize: 12, fontWeight: '600', color: MUTED },

  notes: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EAECF0' },
  notesTitle: { fontSize: 11.5, fontWeight: '700', color: '#475467', marginBottom: 2 },
  notesText: { fontSize: 13, lineHeight: 19, color: INK },
  missing: { fontSize: 11.5, color: '#98A2B3', marginTop: 12, lineHeight: 17 },

});
