// "Next Patient" card — mirrors the web `dd-next-patient-card`: the active
// consultation, else the first pending appointment, else "Queue is clear".
// Remote (video / voice) appointments get a call button instead of Start.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, typography, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';
import AppIcon from '../icons/AppIcon';
import {
  formatClockTime,
  getCallWindow,
  getRemoteConsultationMode,
  getTokenLabel,
  isConsultationStartOpen,
} from '../api/doctorAppointments';

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'NA';

export default function NextPatientCard({ patient, isActive, onBreak, onStartConsultation, onContinue, onCall }) {
  const remoteMode = getRemoteConsultationMode(patient);
  // In-person Start unlocks at the slot time (an active one can always continue).
  const startLocked = Boolean(patient) && !remoteMode && !isActive && !isConsultationStartOpen(patient);
  // Remote: the call window opens 15 min before the slot (see getCallWindow).
  const callWindow = remoteMode ? getCallWindow(patient) : null;
  const callLocked = Boolean(callWindow) && !callWindow.open;
  const callNotYet = callLocked && callWindow.opensAt && Date.now() < callWindow.opensAt.getTime();
  const disabled = !patient || onBreak || startLocked || callLocked;
  const label = callNotYet ? `Call opens at ${formatClockTime(callWindow.opensAt)}`
    : remoteMode === 'video' ? 'Video Call'
      : remoteMode === 'voice' ? 'Voice Call'
        : startLocked ? `Starts at ${patient.scheduledTime}` : 'Start Consultation';
  const icon = remoteMode === 'video' ? 'video' : remoteMode === 'voice' ? 'phone' : startLocked ? 'clock' : 'pulse';

  const handlePress = () => {
    if (!patient) return;
    if (remoteMode) onCall?.(patient, remoteMode);
    else if (isActive) onContinue?.(patient);
    else onStartConsultation?.(patient);
  };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <Text style={styles.label}>NEXT PATIENT</Text>
        </View>
        <Text style={styles.time}>{patient?.scheduledTime || '--:--'}</Text>
      </View>
      <View style={styles.patient}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{patient ? getInitials(patient.name) : 'NA'}</Text></View>
        <View style={styles.info}>
          <Text style={styles.name}>{patient?.name || 'No Patient'}</Text>
          <Text style={styles.complaint} numberOfLines={1}>
            {patient ? `${getTokenLabel(patient)} - ${patient.issue}` : 'Queue is clear'}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        disabled={disabled}
        style={[styles.button, disabled && styles.disabled]}
      >
        <LinearGradient colors={doctorGradient} {...gradientDirection} style={styles.buttonFill}>
          <AppIcon name={icon} size={13} strokeWidth={2.3} color="#FFF" />
          <Text style={styles.buttonText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = createDoctorStyles({
  card: { borderRadius: 8, borderWidth: 1, borderColor: '#9AE8F8', backgroundColor: '#F0FDFA', padding: 12, marginTop: 16, marginBottom: 17 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue, marginRight: 7 },
  label: { ...typography.label, fontSize: 13, color: colors.navy },
  time: { ...typography.label, fontSize: 13, lineHeight: 23, color: colors.blue, backgroundColor: '#FFF', borderRadius: 11, paddingHorizontal: 10, overflow: 'hidden' },
  patient: { flexDirection: 'row', alignItems: 'center', marginVertical: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#FFF', marginRight: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.subtitle, fontSize: 14, color: '#FFF' },
  info: { flex: 1 },
  name: { ...typography.subtitle, fontSize: 15, lineHeight: 20, color: colors.navy },
  complaint: { ...typography.body, fontSize: 13, lineHeight: 17, color: colors.blue },
  button: { height: 37, borderRadius: 6, overflow: 'hidden' },
  disabled: { opacity: 0.5 },
  buttonFill: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...typography.button, fontSize: 14, color: '#FFF' },
});
