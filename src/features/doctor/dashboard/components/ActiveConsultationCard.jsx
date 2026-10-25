// "Currently With" card — mirrors the web `dd-live-consult`: the server-side
// consultation timer (start time minus pauses), plus the actions:
//   Pause / Resume  → PATCH { consultation_action: 'pause' | 'resume' }
//   Checked         → open the Complete Appointment form, which records the
//                     diagnosis, medicines, advice and follow-up.
//   Complete        → finish straight away without a prescription (web
//                     handleCompleteNow).
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';
import { getConsultationModeInfo, getTokenLabel } from '../api/doctorAppointments';
import { MODE_STYLES } from './AppointmentCard';
import { VITAL_FIELDS, canonicalVitals, hasVital } from '../../../../components/VitalsForm';

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'NA';

const formatClock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const pad = (n) => String(n).padStart(2, '0');
export const formatDuration = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
};

// Same as web computeElapsedMs(): frozen while paused / on break.
export const computeElapsedMs = (session, now = Date.now()) => {
  if (!session?.startTime) return 0;
  let end = now;
  if (session.pauseStartMs) end = session.pauseStartMs;
  if (session.breakStartMs) end = session.breakStartMs;
  return Math.max(0, end - session.startTime - session.accumulatedPauseMs);
};

export default function ActiveConsultationCard({ session, onPause, onChecked, onComplete, onVitals, busy }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const patient = session.appt;
  const paused = session.status === 'paused';
  const onBreak = session.status === 'break';
  const disabled = onBreak || busy;
  const mode = getConsultationModeInfo(patient);
  const modeStyle = MODE_STYLES[mode.key];
  const vitals = canonicalVitals(patient.vitals);
  const recordedVitals = VITAL_FIELDS.filter(([key]) => hasVital(vitals[key]));

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.dot} />
          <Text style={s.label}>Currently With</Text>
        </View>
        <View style={s.activePill}>
          <View style={[s.activeDot, paused && s.pausedDot]} />
          <Text style={s.activeText}>{onBreak ? 'ON BREAK' : paused ? 'PAUSED' : 'ACTIVE CONSULTATION'}</Text>
        </View>
      </View>

      <View style={s.patientRow}>
        <View style={s.avatar}><Text translate={false} style={s.avatarText}>{getInitials(patient.name)}</Text></View>
        <View style={s.patientInfo}>
          <View style={s.nameRow}>
            <Text translate={false} style={s.name}>{patient.name}</Text>
            <Text style={s.gender}>({patient.gender})</Text>
          </View>
          <View style={s.complaintRow}>
            <AppIcon name="pin" size={12} strokeWidth={2} color={colors.muted} />
            <Text translate={false} style={s.complaint}>{patient.issue}</Text>
          </View>
        </View>
      </View>

      <View style={s.chips}>
        <View style={[s.modeChip, { backgroundColor: modeStyle.bg }]}>
          <AppIcon name={mode.icon} size={12} strokeWidth={2.2} color={modeStyle.text} />
          <Text style={[s.chipText, { color: modeStyle.text }]}>{mode.label}</Text>
        </View>
        <View style={s.chip}><Text style={s.chipText}>{getTokenLabel(patient)}</Text></View>
      </View>

      <View style={s.timeRow}>
        <View style={s.timeBox}>
          <Text style={s.timeLabel}>STARTED</Text>
          <Text style={s.timeValue}>{formatClock(session.startTime)}</Text>
        </View>
        <View style={s.timeBox}>
          <Text style={s.timeLabel}>ELAPSED</Text>
          <Text style={s.timeValue}>{formatDuration(computeElapsedMs(session, now))}</Text>
        </View>
      </View>

      {!!onVitals && (
        <View style={s.vitalsStrip}>
          <View style={s.vitalsIcon}><AppIcon name="pulse" size={14} strokeWidth={2.2} color="#0D9488" /></View>
          <View style={s.vitalsInfo}>
            <Text style={s.vitalsTitle}>Vitals</Text>
            <Text translate={false} style={s.vitalsSummary} numberOfLines={1}>
              {recordedVitals.length
                ? recordedVitals.map(([key, label, , unit]) => `${label} ${String(vitals[key]).trim()}${/^[/°%]/.test(unit) ? unit : ` ${unit}`}`).join('  ·  ')
                : 'Not recorded — optional'}
            </Text>
          </View>
          <Pressable style={[s.vitalsButton, busy && s.disabled]} onPress={onVitals} disabled={busy} hitSlop={4}>
            <AppIcon name={recordedVitals.length ? 'edit' : 'plus'} size={12} strokeWidth={2.4} color="#0D9488" />
            <Text style={s.vitalsButtonText}>{recordedVitals.length ? 'Edit' : 'Add'}</Text>
          </Pressable>
        </View>
      )}

      <View style={s.actions}>
        <Pressable style={[s.outlineButton, disabled && s.disabled]} onPress={onPause} disabled={disabled}>
          <Text style={s.outlineText}>{paused ? '▶ Resume' : '❚❚ Pause'}</Text>
        </Pressable>
        <Pressable style={[s.outlineButton, disabled && s.disabled]} onPress={onChecked} disabled={disabled}>
          <AppIcon name="file" size={13} strokeWidth={2.2} color={colors.navy} />
          <Text style={s.outlineText}>Checked</Text>
        </Pressable>
        <Pressable
          style={[s.completeButtonWrap, disabled && s.disabled]}
          onPress={onComplete}
          disabled={disabled}
        >
          <LinearGradient colors={doctorGradient} {...gradientDirection} style={s.completeButton}>
            <AppIcon name="check-mark" size={13} strokeWidth={2.5} color="#FFFFFF" />
            <Text style={s.completeText}>Complete</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  // marginTop keeps it off the overview cards above it — without it the card sat
  // flush against them and read as stuck to the section above.
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E3E8F0', padding: 12, marginTop: 22, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue },
  label: { ...typography.subtitle, fontSize: 13.5, color: colors.navy },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.paleBlue, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue },
  pausedDot: { backgroundColor: colors.amber },
  activeText: { ...typography.label, fontSize: 10, letterSpacing: 0.3, color: colors.blue },
  patientRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.subtitle, fontSize: 13, color: '#FFFFFF' },
  patientInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.title, fontSize: 15, color: colors.ink },
  gender: { ...typography.body, fontSize: 12.5, color: colors.muted },
  complaintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  complaint: { ...typography.body, fontSize: 12.5, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  chip: { height: 25, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFBFD', alignItems: 'center', justifyContent: 'center' },
  chipText: { ...typography.label, fontSize: 11, color: '#536176' },
  modeChip: { height: 25, paddingHorizontal: 9, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  timeBox: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFBFD', borderRadius: 7, paddingVertical: 6, paddingHorizontal: 10 },
  timeLabel: { ...typography.label, fontSize: 9.5, letterSpacing: 0.3, color: colors.muted },
  timeValue: { ...typography.title, fontSize: 13.5, color: colors.ink, marginTop: 1 },
  vitalsStrip: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 9, paddingVertical: 8, paddingLeft: 9, paddingRight: 8, borderRadius: 9, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' },
  vitalsIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  vitalsInfo: { flex: 1, minWidth: 0 },
  vitalsTitle: { ...typography.label, fontSize: 10, letterSpacing: 0.4, color: '#0F766E', textTransform: 'uppercase' },
  vitalsSummary: { ...typography.body, fontSize: 12.5, color: colors.ink, marginTop: 1 },
  vitalsButton: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 11, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#99F6E4' },
  vitalsButtonText: { ...typography.button, fontSize: 12, color: '#0D9488' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  outlineButton: { flex: 1, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#C9D1DD', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  outlineText: { ...typography.button, fontSize: 13, color: colors.navy },
  disabled: { opacity: 0.45 },
  completeButtonWrap: { flex: 1, height: 36, borderRadius: 8, overflow: 'hidden' },
  completeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  completeText: { ...typography.button, fontSize: 13, color: '#FFFFFF' },
});
