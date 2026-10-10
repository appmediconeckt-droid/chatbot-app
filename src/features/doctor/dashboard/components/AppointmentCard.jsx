// Queue row for the doctor dashboard — mirrors the web queue row
// (Dashboard/DoctorDashboard.jsx `dd-queue-row`): initials avatar, token,
// consultation mode (top right), gender, issue, time, delay, follow-up, and
// the same action rules (call / View / Start / Continue). The queue tabs
// already say Pending / In Progress / Completed, so the card shows how the
// patient is being seen instead of repeating the status.
import React from 'react';
import { Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import { colors, shadow, typography, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';
import AppIcon from '../icons/AppIcon';
import {
  formatClockTime,
  getCallWindow,
  getConsultationModeInfo,
  getRemoteConsultationMode,
  getTokenLabel,
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
  showStart, // web shouldShowStartConsultation → "Start Consultation", else "View"
  canStart, // web canStartConsultation (slot time / queue turn / Next)
  sessionBusy, // another consultation running
  onBreak,
  onStartConsultation,
  onContinue,
  onView,
  onPrescription, // completed rows: open the consultation prescription
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
  const isSkipped = item.status === 'skipped';
  const isCancelled = item.status === 'cancelled';
  if (isCompleted) {
    action = { label: 'View', ghost: true, onPress: () => onView?.(item) };
  } else if (isCancelled) {
    action = null; // session over / cancelled: nothing to start
  } else if (isSkipped) {
    // Moved to Next earlier: can be started whenever the doctor is free.
    action = { label: 'Start Consultation', ghost: false, onPress: () => onStartConsultation?.(item), disabled: sessionBusy || onBreak };
  } else if (!remoteMode && isActive) {
    action = { label: 'Continue', ghost: false, onPress: () => onContinue?.(item), disabled: onBreak };
  } else if (!remoteMode) {
    // Web parity: "Start Consultation" for the first two in line or once the
    // slot time is reached; disabled until the queue turn / slot time.
    action = {
      label: showStart ? 'Start Consultation' : 'View',
      ghost: !showStart,
      onPress: () => onStartConsultation?.(item),
      disabled: sessionBusy || onBreak || (showStart && !canStart),
    };
  }

  const mode = getConsultationModeInfo(item);
  const modeStyle = MODE_STYLES[mode.key];
  const meta = item.gender && item.gender !== 'Not specified' ? item.gender : '';

  const tokenNumber = String(getTokenLabel(item) || '').match(/\d+/)?.[0];
  const detailLine = [
    isSkipped ? 'Waiting · Next' : '',
    isCancelled ? (item.isNoShow ? 'Cancelled · No-show' : 'Cancelled') : '',
    meta,
    item.issue,
  ].filter(Boolean).join('  ·  ');
  const timeLabel = item.isEmergency ? 'Priority' : item.scheduledTime || 'Today';

  // Header: token tile | name + "gender · issue" | time pill.
  // Footer: how the patient is seen (mode) + any note on the left, actions on
  // the right — so neither side of the footer is empty.
  return (
    <View style={[styles.card, (highlight || isActive) && styles.cardHighlight, item.isEmergency && !isCompleted && styles.cardEmergency]}>
      <View style={styles.header}>
        <LinearGradient
          colors={item.isEmergency && !isCompleted ? ['#F87171', '#DC2626'] : doctorGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tokenTile}
        >
          {item.isEmergency ? (
            <AppIcon name="warning" size={18} strokeWidth={2.4} color="#FFFFFF" />
          ) : tokenNumber ? (
            <Text translate={false} style={styles.tokenTileNumber} numberOfLines={1} adjustsFontSizeToFit>#{tokenNumber}</Text>
          ) : (
            <Text translate={false} style={styles.tokenTileInitials}>{getInitials(item.name)}</Text>
          )}
          <Text style={styles.tokenTileLabel}>{item.isEmergency ? 'SOS' : 'TOKEN'}</Text>
        </LinearGradient>

        <View style={styles.patientInfo}>
          <Text translate={false} style={styles.name} numberOfLines={1}>{item.name}</Text>
          {!!detailLine && (
            <Text translate={false} style={styles.detail} numberOfLines={1}>{detailLine}</Text>
          )}
        </View>

        <View style={[styles.timePill, item.isEmergency && styles.timePillEmergency]}>
          <AppIcon
            name={item.isEmergency ? 'warning' : 'clock'}
            size={12}
            strokeWidth={2.2}
            color={item.isEmergency ? '#DC2626' : colors.blue}
          />
          <Text style={[styles.timeText, item.isEmergency && styles.emergencyTimeText]} numberOfLines={1}>{timeLabel}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerInfo}>
          <View style={[styles.modeBadge, { backgroundColor: modeStyle.bg }]}>
            <AppIcon name={mode.icon} size={11} strokeWidth={2.2} color={modeStyle.text} />
            <Text style={[styles.modeText, { color: modeStyle.text }]} numberOfLines={1}>{mode.label}</Text>
          </View>
          {item.delayMinutes > 0 && (
            <Text translate={false} style={styles.delay} numberOfLines={1}>
              Delayed {item.delayMinutes} min{item.delayReason ? ` - ${item.delayReason}` : ''}
            </Text>
          )}
          {isCompleted && item.followUpRequired && (
            <Text style={styles.followUp} numberOfLines={1}>
              Follow-up: {item.followUpDate ? formatFollowUpDate(item.followUpDate) : 'Date not available'}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          {!!remoteMode && !isCompleted && !isCancelled && (
            <Pressable
              onPress={() => onCall?.(item, remoteMode)}
              disabled={callDisabled}
              style={[styles.button, styles.secondaryButton, callDisabled && styles.disabled]}
            >
              <AppIcon name={remoteMode === 'video' ? 'video' : 'phone'} size={13} strokeWidth={2} color={colors.navy} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>{callLabel}</Text>
            </Pressable>
          )}
          {/* Web parity: a completed row offers View and Prescription. */}
          {isCompleted && (
            <Pressable
              accessibilityRole="button"
              onPress={() => onPrescription?.(item)}
              style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.buttonPressed]}
            >
              <AppIcon name="file" size={13} strokeWidth={2.2} color={colors.navy} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Prescription</Text>
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
                <>
                  <AppIcon name="eye" size={13} strokeWidth={2.2} color={colors.navy} />
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>{action.label}</Text>
                </>
              ) : (
                <LinearGradient colors={doctorGradient} {...gradientDirection} style={styles.primaryButtonFill}>
                  <AppIcon name={isActive ? 'pulse' : 'check'} size={13} strokeWidth={2.4} color="#FFFFFF" />
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
  card: { ...shadow, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, borderWidth: 1, borderColor: '#E6F4F1' },
  cardHighlight: { borderColor: '#5EEAD4', backgroundColor: '#F4FFFC' },
  cardEmergency: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  tokenTile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tokenTileNumber: { fontSize: 18, lineHeight: 21, fontWeight: '900', color: '#FFFFFF' },
  tokenTileInitials: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  tokenTileLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  patientInfo: { flex: 1, minWidth: 0 },
  name: { ...typography.title, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  detail: { ...typography.caption, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 2, textTransform: 'none' },
  timePill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#E6F7F5' },
  timePillEmergency: { backgroundColor: '#FEF2F2' },
  timeText: { ...typography.label, fontSize: 12, lineHeight: 16, color: colors.navy },
  emergencyTimeText: { color: '#DC2626' },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F4F7' },
  footerInfo: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  modeBadge: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  modeText: { ...typography.label, flexShrink: 1, fontSize: 11, lineHeight: 14 },
  delay: { ...typography.caption, fontSize: 11.5, color: colors.red },
  followUp: { ...typography.caption, fontSize: 11.5, color: '#15803D' },
  actions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  button: { height: 36, borderRadius: 11, flexShrink: 0, overflow: 'hidden' },
  primaryButtonFill: { height: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  buttonText: { ...typography.button, fontSize: 13, lineHeight: 17 },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButtonText: { color: colors.navy },
});
