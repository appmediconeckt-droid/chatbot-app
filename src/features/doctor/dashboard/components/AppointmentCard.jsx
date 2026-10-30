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
  formatDelay,
  getElapsedAppointmentDelay,
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
  onNext,
  missedCallCount = 0,
  needsNext = false,
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
    : missedCallCount === 1 ? 'Call again (2 of 2)' : 'Video Call';

  let action = null;
  const isSkipped = item.status === 'skipped';
  const isCancelled = item.status === 'cancelled';
  if (isCompleted) {
    action = { label: 'View', ghost: true, onPress: () => onView?.(item) };
  } else if (isCancelled) {
    action = null; // session over / cancelled: nothing to start
  } else if (isSkipped) {
    // Moved to Next earlier: can be started whenever the doctor is free.
    action = { label: 'Start Consultation', ghost: false, onPress: () => onStartConsultation?.(item), disabled: sessionBusy || onBreak || !canStart };
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
  const availability = item.availability || {};
  const availabilityText = availability.status === 'unavailable'
    ? 'Unavailable'
    : availability.status === 'available' && !availability.returnedAt
      ? 'Available'
      : '';
  const isPendingQueueCard = ['pending', 'confirmed'].includes(item.status);
  const isUnavailablePending = availability.status === 'unavailable' && isPendingQueueCard;
  const meta = item.gender && item.gender !== 'Not specified' ? item.gender : '';

  const tokenNumber = String(getTokenLabel(item) || '').match(/\d+/)?.[0];
  const detailLine = [
    isSkipped ? 'Waiting · Next' : '',
    isCancelled ? (item.isNoShow ? 'Cancelled · No-show' : 'Cancelled') : '',
    meta,
    item.issue,
  ].filter(Boolean).join('  ·  ');
  const isLiveEmergency = item.isEmergency && !isCompleted && !isCancelled;
  const useCompactPendingStyle = isPendingQueueCard && !isLiveEmergency;
  const useUnavailableStyle = isUnavailablePending && !isLiveEmergency;
  const showInlineNext = useCompactPendingStyle && needsNext && !isCancelled && !isSkipped;
  const elapsedDelayMinutes = isPendingQueueCard ? getElapsedAppointmentDelay(item) : 0;
  const timeLabel = item.scheduledTime && item.scheduledTime !== 'Emergency'
    ? item.scheduledTime
    : item.isEmergency ? 'Priority' : 'Today';

  // Header: token tile | name + "gender · issue" | time pill.
  // Footer: how the patient is seen (mode) + any note on the left, actions on
  // the right — so neither side of the footer is empty.
  return (
    <View style={[
      styles.card,
      isPendingQueueCard && styles.cardPending,
      (highlight || isActive) && styles.cardHighlight,
      useUnavailableStyle && styles.cardUnavailable,
      item.isEmergency && !isCompleted && styles.cardEmergency,
    ]}>
      <View style={styles.header}>
        <LinearGradient
          colors={item.isEmergency && !isCompleted ? ['#F87171', '#DC2626'] : doctorGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tokenTile}
        >
          {tokenNumber ? (
            <Text translate={false} style={styles.tokenTileNumber} numberOfLines={1} adjustsFontSizeToFit>#{tokenNumber}</Text>
          ) : (
            item.isEmergency
              ? <AppIcon name="warning" size={18} strokeWidth={2.4} color="#FFFFFF" />
              : <Text translate={false} style={styles.tokenTileInitials}>{getInitials(item.name)}</Text>
          )}
          <Text style={styles.tokenTileLabel}>{item.isEmergency ? 'SOS' : 'TOKEN'}</Text>
        </LinearGradient>

        <View style={styles.patientInfo}>
          <Text translate={false} style={styles.name} numberOfLines={1}>{item.name}</Text>
          {!!detailLine && (
            <Text translate={false} style={styles.detail} numberOfLines={1}>{detailLine}</Text>
          )}
        </View>

        <View style={styles.timeColumn}>
          <View style={[
            styles.timePill,
            useUnavailableStyle && styles.timePillUnavailable,
            item.isEmergency && styles.timePillEmergency,
          ]}>
            <AppIcon
              name={item.isEmergency ? 'warning' : 'clock'}
              size={12}
              strokeWidth={2.2}
              color={item.isEmergency ? '#DC2626' : useUnavailableStyle ? '#A16207' : colors.blue}
            />
            <Text style={[
              styles.timeText,
              useUnavailableStyle && styles.unavailableTimeText,
              item.isEmergency && styles.emergencyTimeText,
            ]} numberOfLines={1}>{timeLabel}</Text>
          </View>
          {elapsedDelayMinutes > 0 && (
            <Text translate={false} style={styles.delayUnderTime} numberOfLines={1}>
              Delayed {formatDelay(elapsedDelayMinutes)}{item.delayReason ? ` · ${item.delayReason}` : ''}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.footerRow, useCompactPendingStyle && styles.footerRowCompact]}>
        <View style={[
          styles.footerInfo,
          useCompactPendingStyle && styles.footerInfoCompact,
        ]}>
          {!useCompactPendingStyle && <Text style={styles.detailsLabel}>VISIT DETAILS</Text>}
          <View style={[
            styles.badgeRow,
            useCompactPendingStyle && styles.compactBadgeRow,
            showInlineNext && styles.threeBadgeRow,
          ]}>
            {isLiveEmergency && (
              <View style={styles.emergencyBadge}>
                <AppIcon name="warning" size={11} strokeWidth={2.4} color="#FFFFFF" />
                <Text style={styles.emergencyBadgeText} numberOfLines={1}>Emergency</Text>
              </View>
            )}
            <View style={[styles.modeBadge, { backgroundColor: modeStyle.bg }]}>
              <AppIcon name={mode.icon} size={11} strokeWidth={2.2} color={modeStyle.text} />
              <Text style={[styles.modeText, { color: modeStyle.text }]} numberOfLines={1}>{mode.label}</Text>
            </View>
            {!!availabilityText && !isCompleted && !isCancelled && (
              <View
                accessible
                accessibilityLabel={`Reception: patient ${availability.status}`}
                style={[styles.availabilityBadge, availability.status === 'unavailable' ? styles.availabilityUnavailable : styles.availabilityAvailable]}
              >
                <AppIcon
                  name={availability.status === 'unavailable' ? 'warning' : 'check'}
                  size={10}
                  strokeWidth={2.4}
                  color={availability.status === 'unavailable' ? '#9A5B00' : '#16704E'}
                />
                <Text
                  style={[styles.availabilityText, availability.status === 'unavailable' ? styles.availabilityUnavailableText : styles.availabilityAvailableText]}
                  numberOfLines={1}
                >
                  {availabilityText}
                </Text>
              </View>
            )}
            {showInlineNext && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Move patient to Next"
                onPress={() => onNext?.(item)}
                disabled={sessionBusy || onBreak}
                style={({ pressed }) => [
                  styles.inlineNextButton,
                  pressed && styles.buttonPressed,
                  (sessionBusy || onBreak) && styles.disabled,
                ]}
              >
                <Text style={styles.inlineNextText}>Next</Text>
                <AppIcon name="chevron-right" size={11} strokeWidth={2.5} color="#92400E" />
              </Pressable>
            )}
          </View>
          {isCompleted && item.followUpRequired && (
            <Text style={styles.followUp} numberOfLines={1}>
              Follow-up: {item.followUpDate ? formatFollowUpDate(item.followUpDate) : 'Date not available'}
            </Text>
          )}
        </View>

        {!showInlineNext && <View style={styles.actions}>
          {needsNext && !isCompleted && !isCancelled && !isSkipped && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Move patient to Next"
              onPress={() => onNext?.(item)}
              disabled={sessionBusy || onBreak}
              style={({ pressed }) => [
                styles.button,
                styles.nextButton,
                pressed && styles.buttonPressed,
                (sessionBusy || onBreak) && styles.disabled,
              ]}
            >
              <Text style={[styles.buttonText, styles.nextButtonText]}>Next Patient</Text>
              <View style={styles.nextButtonIcon}>
                <AppIcon name="chevron-right" size={13} strokeWidth={2.5} color="#92400E" />
              </View>
            </Pressable>
          )}
          {!!remoteMode && !needsNext && !isCompleted && !isCancelled && (
            <Pressable
              onPress={() => onCall?.(item, remoteMode)}
              disabled={callDisabled}
              style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.buttonPressed, callDisabled && styles.disabled]}
            >
              <AppIcon name="video" size={13} strokeWidth={2} color={colors.navy} />
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
          {action && !needsNext && (
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
        </View>}
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  card: { ...shadow, backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardPending: { borderColor: '#DCE9E7', shadowOpacity: 0.07, elevation: 2 },
  cardHighlight: { borderColor: '#99DDD4', backgroundColor: '#FFFFFF', shadowOpacity: 0.11, elevation: 3 },
  cardUnavailable: { backgroundColor: '#FFFFFF', borderWidth: 0, paddingLeft: 14 },
  cardEmergency: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tokenTile: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tokenTileNumber: { fontSize: 18, lineHeight: 21, fontWeight: '900', color: '#FFFFFF' },
  tokenTileInitials: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  tokenTileLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  patientInfo: { flex: 1, minWidth: 0 },
  name: { ...typography.title, fontSize: 16, lineHeight: 21, color: colors.ink },
  detail: { ...typography.caption, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 3, textTransform: 'none' },
  timeColumn: { flexShrink: 0, maxWidth: 132, alignItems: 'flex-end', gap: 4 },
  timePill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#E6F7F5' },
  timePillUnavailable: { backgroundColor: '#FFF7E8' },
  timePillEmergency: { backgroundColor: '#FEF2F2' },
  timeText: { ...typography.label, fontSize: 12, lineHeight: 16, color: colors.navy },
  unavailableTimeText: { color: '#92400E' },
  emergencyTimeText: { color: '#DC2626' },
  delayUnderTime: { ...typography.caption, maxWidth: 132, fontSize: 10.5, lineHeight: 13, color: colors.red, textAlign: 'right' },

  footerRow: { gap: 10, marginTop: 13 },
  footerRowCompact: { marginTop: 10 },
  footerInfo: { minWidth: 0, gap: 7, alignItems: 'flex-start', padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#E8EEF2', backgroundColor: '#F8FAFC' },
  footerInfoCompact: { padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', gap: 5 },
  detailsLabel: { ...typography.label, fontSize: 9.5, lineHeight: 12, letterSpacing: 0.9, color: '#94A3B8' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, maxWidth: '100%' },
  compactBadgeRow: { alignSelf: 'stretch', flexWrap: 'nowrap', gap: 5 },
  threeBadgeRow: { justifyContent: 'space-between' },
  emergencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: '#DC2626' },
  emergencyBadgeText: { ...typography.label, fontSize: 11, lineHeight: 14, color: '#FFFFFF', fontWeight: '800' },
  modeBadge: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  modeText: { ...typography.label, flexShrink: 1, fontSize: 11.5, lineHeight: 15 },
  followUp: { ...typography.caption, fontSize: 11.5, color: '#15803D' },
  availabilityBadge: { maxWidth: '100%', minHeight: 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  availabilityAvailable: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  availabilityUnavailable: { backgroundColor: '#FFF7E8', borderColor: '#F5D08A' },
  availabilityText: { ...typography.caption, flexShrink: 1, fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  availabilityAvailableText: { color: '#16704E' },
  availabilityUnavailableText: { color: '#9A5B00' },
  inlineNextButton: { flexShrink: 0, minHeight: 28, paddingLeft: 10, paddingRight: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: '#F6D28B', backgroundColor: '#FFFBEB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  inlineNextText: { ...typography.label, fontSize: 11.5, lineHeight: 15, fontWeight: '800', color: '#92400E' },
  actions: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { flexGrow: 1, flexBasis: 120, minHeight: 44, borderRadius: 13, overflow: 'hidden' },
  primaryButtonFill: { flex: 1, minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  nextButton: { flexBasis: '100%', borderWidth: 1, borderColor: '#F6D28B', backgroundColor: '#FFFBEB', paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nextButtonIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7' },
  nextButtonText: { color: '#92400E', fontWeight: '800' },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  buttonText: { ...typography.button, fontSize: 13, lineHeight: 17 },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButtonText: { color: colors.navy },
});
