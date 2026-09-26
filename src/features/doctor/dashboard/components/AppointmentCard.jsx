// Queue row for the doctor dashboard — mirrors the web queue row
// (Dashboard/DoctorDashboard.jsx `dd-queue-row`): initials avatar, token,
// consultation mode (top right), gender, issue, time, delay, follow-up, and
// the same action rules (call / View / Start / Continue). The queue tabs
// already say Pending / In Progress / Completed, so the card shows how the
// patient is being seen instead of repeating the status.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, shadow, typography, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';
import AppIcon from '../icons/AppIcon';
import {
  formatClockTime,
  getCallWindow,
  getConsultationModeInfo,
  getRemoteConsultationMode,
  getTokenLabel,
  isConsultationStartOpen,
} from '../api/doctorAppointments';

// Mode badge colours — one per way of consulting, so the queue reads at a glance.
export const MODE_STYLES = {
  visit: { bg: '#E6FAF6', text: '#0F766E' },
  walkin: { bg: '#FEF3C7', text: '#A65F00' },
  video: { bg: '#E8F1FF', text: '#1D4ED8' },
  voice: { bg: '#F3E8FF', text: '#7E22CE' },
};

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'NA';

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
  const remoteMode = getRemoteConsultationMode(item);
  const isCompleted = item.status === 'completed';
  // A missing patient id is not a reason to grey the button out: the press
  // handler explains it, which beats a button that silently does nothing.
  const callWindow = getCallWindow(item);
  const callDisabled = !callWindow.open;
  const callNotYet = callDisabled && callWindow.opensAt && Date.now() < callWindow.opensAt.getTime();
  const callLabel = callNotYet
    ? `Opens ${formatClockTime(callWindow.opensAt)}`
    : remoteMode === 'video' ? 'Video Call' : 'Voice Call';

  let action = null;
  if (isCompleted) {
    action = { label: 'View', ghost: true, onPress: () => onView?.(item) };
  } else if (!remoteMode && isActive) {
    action = { label: 'Continue', ghost: false, onPress: () => onContinue?.(item), disabled: onBreak };
  } else if (!remoteMode) {
    // Start unlocks at the slot time; until then the button says when.
    const startLocked = primary && !isConsultationStartOpen(item);
    action = {
      label: primary ? (startLocked ? `Starts ${item.scheduledTime}` : 'Start Consultation') : 'View',
      ghost: !primary,
      onPress: () => onStartConsultation?.(item),
      disabled: sessionBusy || onBreak || startLocked,
    };
  }

  const mode = getConsultationModeInfo(item);
  const modeStyle = MODE_STYLES[mode.key];
  const meta = item.gender && item.gender !== 'Not specified' ? item.gender : '';

  return (
    <View style={[styles.card, (highlight || isActive) && styles.cardHighlight]}>
      {/* Header: avatar | name + token/gender | consultation mode (top right) */}
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(item.name)}</Text></View>
        <View style={styles.patientInfo}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <View style={styles.subRow}>
            <View style={styles.tokenPill}><Text style={styles.tokenText}>{getTokenLabel(item)}</Text></View>
            {!!meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
          </View>
        </View>
        <View style={[styles.modeBadge, { backgroundColor: modeStyle.bg }]}>
          <AppIcon name={mode.icon} size={12} strokeWidth={2.2} color={modeStyle.text} />
          <Text style={[styles.modeText, { color: modeStyle.text }]} numberOfLines={1}>{mode.label}</Text>
        </View>
      </View>

      {/* Body: complaint, delay / follow-up notes */}
      <View style={styles.body}>
        <View style={styles.issueRow}>
          <View style={styles.issueIcon}>
            <AppIcon name="pulse" size={13} strokeWidth={2} color={colors.blue} />
          </View>
          <Text style={styles.issue} numberOfLines={2}>{item.issue}</Text>
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

      {/* Footer: time on the left, action on the right */}
      <View style={styles.footerRow}>
        <View style={styles.timeChip}>
          <AppIcon name="clock" size={13} strokeWidth={2} color={colors.muted} />
          <Text style={styles.timeText} numberOfLines={1}>{item.scheduledTime || 'Today'}</Text>
        </View>

        <View style={styles.actions}>
          {!!remoteMode && !isCompleted && (
            <Pressable
              onPress={() => onCall?.(item, remoteMode)}
              disabled={callDisabled}
              style={[styles.button, styles.secondaryButton, callDisabled && styles.disabled]}
            >
              <AppIcon name={remoteMode === 'video' ? 'video' : 'phone'} size={13} strokeWidth={2} color={colors.navy} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>{callLabel}</Text>
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
  card: { ...shadow, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF1F6' },
  cardHighlight: { borderColor: '#9AE8F8', backgroundColor: '#F7FEFD' },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.subtitle, fontSize: 15, color: colors.blue },
  patientInfo: { flex: 1, minWidth: 0, paddingTop: 1 },
  name: { ...typography.title, fontSize: 16.5, lineHeight: 21, color: colors.ink },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  tokenPill: { height: 20, paddingHorizontal: 7, borderRadius: 6, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  tokenText: { ...typography.label, fontSize: 11.5, lineHeight: 15, color: '#536176' },
  meta: { ...typography.caption, flexShrink: 1, fontSize: 12.5, lineHeight: 16, color: colors.muted },

  body: { marginTop: 12, gap: 6 },
  modeBadge: { flexShrink: 0, maxWidth: '46%', flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 9, borderRadius: 13 },
  modeText: { ...typography.label, flexShrink: 1, fontSize: 11.5, lineHeight: 15 },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F7F9FC', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  issueIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  issue: { ...typography.caption, flex: 1, fontSize: 13.5, lineHeight: 18, color: '#394457' },
  delay: { ...typography.caption, fontSize: 12.5, color: colors.red, marginLeft: 2 },
  followUp: { ...typography.caption, fontSize: 12.5, color: '#15803D', marginLeft: 2 },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF1F6' },
  timeChip: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { ...typography.label, fontSize: 13, lineHeight: 17, color: '#394457' },
  actions: { flexDirection: 'row', gap: 8 },
  button: { height: 38, borderRadius: 9, flexShrink: 0, overflow: 'hidden' },
  primaryButtonFill: { height: 38, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { borderWidth: 1, borderColor: '#BCC6D6', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  buttonText: { ...typography.button, fontSize: 14, lineHeight: 18 },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButtonText: { color: colors.navy },
});
