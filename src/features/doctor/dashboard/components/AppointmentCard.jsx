// Queue row for the doctor dashboard — mirrors the web queue row
// (Dashboard/DoctorDashboard.jsx `dd-queue-row`): initials avatar, token,
// status label, type / mode / gender / issue / time meta, delay, follow-up,
// BP / BG chips, and the same action rules (call / View / Start / Continue).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, shadow, typography, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';
import AppIcon from '../icons/AppIcon';
import { getRemoteConsultationMode, getTokenLabel, isAppointmentCallWindowOpen } from '../api/doctorAppointments';

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'NA';

const STATUS_STYLES = {
  Pending: { bg: '#FFF5E5', dot: colors.amber, text: '#A65F00' },
  Confirmed: { bg: '#E8F1FF', dot: '#2563EB', text: '#1D4ED8' },
  'In Progress': { bg: '#E6FAF6', dot: colors.blue, text: colors.blue },
  Completed: { bg: '#E7F8EE', dot: '#16A34A', text: '#15803D' },
  Cancelled: { bg: '#F1F4F8', dot: colors.muted, text: colors.muted },
};

export const getQueueStatusLabel = (appt, isActive) => {
  if (appt.status === 'completed') return 'Completed';
  if (appt.status === 'in-progress' || isActive) return 'In Progress';
  if (appt.status === 'confirmed') return 'Confirmed';
  if (appt.status === 'cancelled') return 'Cancelled';
  return 'Pending';
};

const formatFollowUpDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Date not available'
    : d.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function AppointmentCard({
  item,
  isActive,
  highlight,
  primary, // first pending row → "Start Consultation"
  sessionBusy, // another consultation running
  onBreak,
  onStartConsultation,
  onContinue,
  onView,
  onCall,
}) {
  const statusLabel = getQueueStatusLabel(item, isActive);
  const statusStyle = STATUS_STYLES[statusLabel] || STATUS_STYLES.Pending;
  const remoteMode = getRemoteConsultationMode(item);
  const isCompleted = item.status === 'completed';
  const callDisabled = !isAppointmentCallWindowOpen(item) || !item.patientId;

  let action = null;
  if (isCompleted) {
    action = { label: 'View', ghost: true, onPress: () => onView?.(item) };
  } else if (!remoteMode && isActive) {
    action = { label: 'Continue', ghost: false, onPress: () => onContinue?.(item), disabled: onBreak };
  } else if (!remoteMode) {
    action = {
      label: primary ? 'Start Consultation' : 'View',
      ghost: !primary,
      onPress: () => onStartConsultation?.(item),
      disabled: sessionBusy || onBreak,
    };
  }

  return (
    <View style={[styles.card, (highlight || isActive) && styles.cardHighlight]}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(item.name)}</Text></View>
        <View style={styles.patientInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.idPill}><Text style={styles.idText}>{getTokenLabel(item)}</Text></View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{item.appointmentType}</Text>
            {!!remoteMode && (
              <>
                <Text style={styles.dot}>•</Text>
                <AppIcon name={remoteMode === 'video' ? 'video' : 'phone'} size={12} strokeWidth={2} color={colors.muted} />
                <Text style={styles.meta}>{remoteMode === 'video' ? 'Video' : 'Voice'}</Text>
              </>
            )}
            <Text style={styles.dot}>•</Text>
            <Text style={styles.meta}>{item.gender}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.complaint} numberOfLines={1}>{item.issue}</Text>
            <View style={styles.timeChip}>
              <AppIcon name="clock" size={13} strokeWidth={2} color={colors.muted} />
              <Text style={styles.timeText}>{item.scheduledTime || 'Today'}</Text>
            </View>
          </View>
          {item.delayMinutes > 0 && (
            <Text style={styles.delay}>
              Delayed {item.delayMinutes} min{item.delayReason ? ` - ${item.delayReason}` : ''}
            </Text>
          )}
          {isCompleted && item.followUpRequired && (
            <Text style={styles.followUp}>
              Follow-up: {item.followUpDate ? formatFollowUpDate(item.followUpDate) : 'Date not available'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.vitals}>
          <View style={styles.vitalChip}><Text style={styles.vital}>BP: {item.bp || 'N/A'}</Text></View>
          <View style={styles.vitalChip}><Text style={styles.vital}>BG: {item.bloodGroup || 'N/A'}</Text></View>
        </View>

        <View style={styles.actions}>
          {!!remoteMode && !isCompleted && (
            <Pressable
              onPress={() => onCall?.(item, remoteMode)}
              disabled={callDisabled}
              style={[styles.button, styles.secondaryButton, callDisabled && styles.disabled]}
            >
              <AppIcon name={remoteMode === 'video' ? 'video' : 'phone'} size={13} strokeWidth={2} color={colors.navy} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>{remoteMode === 'video' ? ' Video Call' : ' Voice Call'}</Text>
            </Pressable>
          )}
          {action && (
            <Pressable
              accessibilityRole="button"
              onPress={action.onPress}
              disabled={action.disabled}
              style={({ pressed }) => [
                styles.button,
                action.ghost && styles.secondaryButton,
                pressed && styles.buttonPressed,
                action.disabled && styles.disabled,
              ]}
            >
              {action.ghost ? (
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>{action.label}</Text>
              ) : (
                <LinearGradient colors={doctorGradient} {...gradientDirection} style={styles.primaryButtonFill}>
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>{action.label}</Text>
                </LinearGradient>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  card: { ...shadow, backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#EEF1F6' },
  cardHighlight: { borderColor: '#9AE8F8', backgroundColor: '#F7FEFD' },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.subtitle, fontSize: 15, color: colors.blue },
  patientInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...typography.title, flexShrink: 1, fontSize: 17, lineHeight: 22, color: colors.ink },
  idPill: { height: 21, paddingHorizontal: 7, borderRadius: 5, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  idText: { ...typography.label, fontSize: 12, lineHeight: 16, color: '#536176' },
  statusBadge: { alignSelf: 'flex-start', height: 21, marginTop: 5, paddingHorizontal: 8, borderRadius: 11, flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { ...typography.label, fontSize: 12, lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  meta: { ...typography.caption, fontSize: 13, lineHeight: 18, color: colors.muted },
  dot: { fontSize: 13, color: colors.muted },
  complaint: { ...typography.caption, flexShrink: 1, fontSize: 13.5, lineHeight: 18, color: '#394457' },
  timeChip: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { ...typography.body, fontSize: 12.5, lineHeight: 16, color: colors.muted },
  delay: { ...typography.caption, fontSize: 12.5, color: colors.red, marginTop: 4 },
  followUp: { ...typography.caption, fontSize: 12.5, color: '#15803D', marginTop: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF1F6' },
  vitals: { flexDirection: 'row', gap: 8 },
  vitalChip: { height: 30, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFBFD', alignItems: 'center', justifyContent: 'center' },
  vital: { ...typography.label, color: '#536176', fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  button: { height: 38, borderRadius: 8, flexShrink: 0, overflow: 'hidden' },
  primaryButtonFill: { height: 38, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { borderWidth: 1, borderColor: '#BCC6D6', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  buttonText: { ...typography.button, fontSize: 14, lineHeight: 18 },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButtonText: { color: colors.navy },
});
