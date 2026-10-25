// Doctor dashboard (Home) — same data + actions as the web
// chatbot/src/Component/DoctorDashboard/Dashboard/DoctorDashboard.jsx:
//   feed      GET /api/appointments, /api/walkin-appointments,
//             /api/appointments?appointment_status=completed, /api/followups
//   consult   PATCH /api/(walkin-)appointments/:id  in-progress / pause / resume / completed
//   breaks    GET /api/doctor-breaks/active, POST /start, PATCH /:id/end
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resetToLoginScreen } from '../../../navigationRef';
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, RefreshControl, ScrollView, ToastAndroid, TouchableOpacity, View } from 'react-native';
import Text from '../../../components/TranslatedText';
import { ResponsiveGrid } from '../../../components/common/ResponsiveLayout';
import VitalsSummary from '../../../components/VitalsSummary';
import TextInput from '../../../components/TranslatedTextInput';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { CLINICIAN_GRADIENT } from '../../../theme/palette';

import DoctorHeader from '../dashboard/components/layout/DoctorHeader';
import DoctorBottomNavigation from '../dashboard/navigation/DoctorBottomNavigation';
import { colors, typography, createDoctorStyles } from '../dashboard/theme';
import AppIcon from '../dashboard/icons/AppIcon';
import AppointmentCard from '../dashboard/components/AppointmentCard';
import ActiveConsultationCard from '../dashboard/components/ActiveConsultationCard';
import EditCompletedAppointmentScreen from '../dashboard/components/EditCompletedAppointmentScreen';
import CompleteAppointmentScreen from '../dashboard/components/CompleteAppointmentScreen';
import DoctorVitalsSheet from '../dashboard/components/DoctorVitalsSheet';
import DoctorSidebar from '../dashboard/components/DoctorSidebar';
import { DoctorBackContext, useDoctorBackRegistry } from '../dashboard/useDoctorBack';
import { loadUserLanguage } from '../../../i18n';
import { readScreenCache, writeScreenCache } from '../../../utils/screenCache';
import WalkInAppointmentsScreen from '../dashboard/components/WalkInAppointmentsScreen';
import PatientsScreen from '../dashboard/components/PatientsScreen';
import PatientDetailScreen from '../dashboard/components/PatientDetailScreen';
import VisitDetailScreen from '../dashboard/components/VisitDetailScreen';
import CalendarAvailabilityScreen from '../dashboard/components/CalendarAvailabilityScreen';
import AppointmentsListScreen from '../dashboard/components/AppointmentsListScreen';
import DoctorProfileQrScreen from '../dashboard/components/DoctorProfileQrScreen';
import DoctorProfileCardQrScreen from '../dashboard/components/DoctorProfileCardQrScreen';
import DoctorProfileScreen from '../dashboard/components/DoctorProfileScreen';
import FollowUpsScreen from '../dashboard/components/FollowUpsScreen';
import ClinicPageScreen from '../dashboard/components/ClinicPageScreen';
import DoctorReviewsScreen from '../dashboard/components/DoctorReviewsScreen';
import StaffManagementScreen from '../dashboard/components/StaffManagementScreen';
import NotificationsScreen from '../dashboard/components/NotificationsScreen';
import DoctorSettingsScreen from '../dashboard/components/DoctorSettingsScreen';
import OverviewCard from '../dashboard/components/OverviewCard';
import QueueTabs from '../dashboard/components/QueueTabs';
import LogoutConfirmModal from '../dashboard/components/LogoutConfirmModal';
import ConsultationPrescriptionModal from '../dashboard/components/ConsultationPrescriptionModal';
import {
  endBreak,
  fetchActiveBreak,
  formatAppointment,
  formatLocalDateKey,
  getAppointmentSource,
  getDoctorIdFromUser,
  getSkipPayload,
  getStatusUpdatePayload,
  getStoredDoctorUser,
  getTokenLabel,
  getAppointmentCancellationState,
  isAppointmentStartTimeReached,
  isCompletedToday,
  isScheduledToday,
  isTodayAppointment,
  loadDoctorAppointmentFeed,
  loadDoctorFollowUps,
  normalizeAppointmentStatus,
  patchAppointment,
  pickFirst,
  sortByToken,
  startBreak,
} from '../dashboard/api/doctorAppointments';
import { endDirectCall, startDirectCall } from '../dashboard/api/doctorCalls';
import VideoCallModal from '../../../screens/user/Component/UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../screens/user/Component/UserDashboard/Tab/CallModal/VoiceCallModal';
import axiosInstance from '../../../axiosConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../../../services/socketService';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import { clearAccountLocalData } from '../../../utils/authSession';
import UpdateReminderModal from '../../../components/UpdateReminderModal';
import { KeyboardSheetOverlay } from '../../../components/common/KeyboardSheet';
import { useToast } from '../../../components/common/ToastProvider';


// Same events the counsellor dashboard refreshes on, so a booking shows up on
// the doctor's queue as soon as the server announces it.
const APPOINTMENT_REFRESH_EVENTS = [
  'appointment-booked',
  'appointment-new',
  'appointment-updated',
  'appointment-status-changed',
  'appointment-confirmed',
  'appointment-cancelled',
  // Emitted on every queue change (the web doctor dashboard refreshes on it).
  'queueUpdated',
];

const sidebarRoutes = {
  appointments: 'appointments',
  walkIn: 'walkIn',
  followUps: 'followUps',
  reviews: 'reviews',
  clinic: 'clinic',
  settings: 'settings',
  qrCode: 'profileQr',
};

const screenSidebarItems = {
  clinic: 'clinic',
  appointments: 'appointments',
  walkIn: 'walkIn',
  followUps: 'followUps',
  reviews: 'reviews',
  settings: 'settings',
  profileQr: 'qrCode',
};

const removeMinutesSuffix = (value) => (value ?? '').replace(' min', '');

// ------------------------------------------------------------------
// Patient Consent Form Modal
// ------------------------------------------------------------------
// A real Modal (bottom sheet) so it sits above the header and the bottom bar —
// the centre QR button used to cover its Start / Cancel buttons.
function PatientConsentModal({ visible, onClose, onStartConsultation, onNext, nextDisabled = true, startBlockedText = '', patient, starting }) {
  const insets = useSafeAreaInsets();
  const [agreements, setAgreements] = useState({ reviewed: true, tracking: true, responsibility: true, confidentiality: true });
  const toggleAgreement = (key) => setAgreements((prev) => ({ ...prev, [key]: !prev[key] }));
  const allChecked = agreements.reviewed && agreements.tracking && agreements.responsibility && agreements.confidentiality;
  const name = patient?.name ?? '';
  const initials = String(name).split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'P';
  const gender = patient?.gender && !/not specified/i.test(patient.gender) ? patient.gender : '';
  const canStart = allChecked && !starting && !startBlockedText;
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={consentStyles.backdrop}>
        <Pressable style={consentStyles.backdropTap} onPress={starting ? undefined : onClose} />
        <View style={[consentStyles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={consentStyles.header}>
            <View style={consentStyles.handle} />
            <View style={consentStyles.headerRow}>
              <View style={consentStyles.headerIconBadge}>
                <AppIcon name="shield" size={18} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <View style={consentStyles.headerText}>
                <Text style={consentStyles.headerTitle}>Patient Consent Form</Text>
                <Text style={consentStyles.headerSub}>Review before starting the consultation</Text>
              </View>
              <Pressable onPress={onClose} disabled={starting} hitSlop={10} style={consentStyles.closeBtn}>
                <AppIcon name="x" size={18} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
            </View>
          </LinearGradient>

          <ScrollView style={consentStyles.scroll} contentContainerStyle={consentStyles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Patient card */}
            <View style={consentStyles.patientCard}>
              <View style={consentStyles.avatar}>
                <Text translate={false} style={consentStyles.avatarText}>{initials}</Text>
              </View>
              <View style={consentStyles.patientText}>
                <Text translate={false} style={consentStyles.patientName} numberOfLines={1}>{name}</Text>
                {!!gender && <Text style={consentStyles.patientMeta}>{gender}</Text>}
              </View>
              <View style={consentStyles.tokenChip}>
                <Text style={consentStyles.tokenChipText}>{patient ? getTokenLabel(patient) : 'N/A'}</Text>
              </View>
            </View>

            <View style={consentStyles.infoGrid}>
              <InfoTile icon="clock" label="Scheduled" value={patient?.scheduledTime || '—'} />
              <InfoTile icon="phone" label="Phone" value={patient?.phone || 'N/A'} />
              <InfoTile icon="pulse" label="Issue" value={patient?.issue || '—'} wide />
            </View>

            <VitalsSummary appointment={patient} />
            <Text style={consentStyles.sectionTitle}>Agreement</Text>
            <View style={consentStyles.agreementBox}>
              {[
                ['reviewed', "I confirm that I have reviewed the patient's information."],
                ['tracking', 'I understand that starting will begin tracking consultation time.'],
                ['responsibility', 'I acknowledge my responsibility for providing appropriate medical care.'],
                ['confidentiality', 'I confirm I will maintain patient confidentiality.'],
              ].map(([key, text], index) => (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.7}
                  style={[consentStyles.agreementItem, index > 0 && consentStyles.agreementDivider]}
                  onPress={() => toggleAgreement(key)}
                >
                  <View style={[consentStyles.checkbox, agreements[key] && consentStyles.checkboxChecked]}>
                    {agreements[key] && <AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3.2} />}
                  </View>
                  <Text style={consentStyles.agreementText}>{text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {!!startBlockedText && (
            <View style={consentStyles.blockedHint}>
              <AppIcon name="clock" size={14} color="#B45309" strokeWidth={2.2} />
              <Text style={consentStyles.blockedHintText}>{startBlockedText}</Text>
            </View>
          )}
          <View style={consentStyles.footer}>
            <TouchableOpacity style={consentStyles.cancelButton} onPress={onClose} disabled={starting}>
              <Text style={consentStyles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            {/* Web "Next": the patient hasn't come — move them aside and show the next one. */}
            <TouchableOpacity
              style={[consentStyles.nextButton, (nextDisabled || starting) && consentStyles.nextButtonDisabled]}
              onPress={onNext}
              disabled={nextDisabled || starting}
            >
              <Text style={consentStyles.nextButtonText}>Next</Text>
              <AppIcon name="chevron-right" size={14} color={colors.navy} strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity style={consentStyles.startButtonWrap} onPress={onStartConsultation} disabled={!canStart} activeOpacity={0.85}>
              <LinearGradient
                colors={canStart ? CLINICIAN_GRADIENT : ['#9CA3AF', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={consentStyles.startButton}
              >
                {starting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <AppIcon name="pulse" size={16} color="#FFFFFF" strokeWidth={2.4} />}
                <Text style={consentStyles.startButtonText} numberOfLines={1}>{starting ? 'Starting...' : 'Start'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoTile({ icon, label, value, wide }) {
  return (
    <View style={[consentStyles.infoTile, wide && consentStyles.infoTileWide]}>
      <View style={consentStyles.infoIcon}>
        <AppIcon name={icon} size={14} color={colors.blue} strokeWidth={2.2} />
      </View>
      <View style={consentStyles.infoText}>
        <Text style={consentStyles.infoLabel}>{label}</Text>
        <Text translate={false} style={consentStyles.infoValue} numberOfLines={wide ? 3 : 1}>{value}</Text>
      </View>
    </View>
  );
}

const consentStyles = createDoctorStyles({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: { width: '100%', maxWidth: 720, alignSelf: 'center', maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.55)', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { ...typography.subtitle, fontSize: 18, lineHeight: 23, color: '#FFFFFF' },
  headerSub: { ...typography.body, fontSize: 12.5, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 14, paddingBottom: 8 },

  patientCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#CCFBF1', padding: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.subtitle, fontSize: 16, color: '#FFFFFF' },
  patientText: { flex: 1 },
  patientName: { ...typography.subtitle, fontSize: 17, lineHeight: 22, color: colors.ink },
  patientMeta: { ...typography.body, fontSize: 13, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  tokenChip: { backgroundColor: '#CCFBF1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  tokenChipText: { ...typography.caption, fontSize: 13, color: colors.navy },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  infoTile: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 10, marginBottom: 10 },
  infoTileWide: { width: '100%', alignItems: 'flex-start' },
  infoIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1 },
  infoLabel: { ...typography.body, fontSize: 11.5, color: colors.muted },
  infoValue: { ...typography.caption, fontSize: 14, lineHeight: 19, color: colors.ink, marginTop: 1 },

  sectionTitle: { ...typography.caption, fontSize: 14, color: colors.navy, marginTop: 6, marginBottom: 8, marginLeft: 2 },
  agreementBox: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 },
  agreementItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11 },
  agreementDivider: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#AEB6C4', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.blue, borderColor: colors.blue },
  agreementText: { ...typography.body, fontSize: 13.5, color: '#334155', flex: 1, lineHeight: 19 },

  blockedHint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 14, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFBEB' },
  blockedHintText: { flex: 1, fontSize: 12.5, color: '#92400E', fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.line },
  cancelButton: { flex: 0.9, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#C9D1DD', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  nextButton: { flex: 0.9, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.blue, backgroundColor: '#F0FDFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  nextButtonDisabled: { opacity: 0.45 },
  nextButtonText: { ...typography.caption, fontSize: 15, color: colors.navy },
  cancelButtonText: { ...typography.caption, fontSize: 15, color: '#252B35' },
  // Wrapper carries the flex sizing; the LinearGradient carries the pill
  // shape/fill so the gradient corners round correctly.
  startButtonWrap: { flex: 1.2 },
  startButton: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startButtonText: { ...typography.caption, fontSize: 15, lineHeight: 18, color: '#FFFFFF', textAlign: 'center' },
});

// ------------------------------------------------------------------
// Break In Progress Modal
// ------------------------------------------------------------------
function BreakInProgressModal({ onEndBreak, endMs, nextPatient }) {
  const computeRemaining = () => {
    if (!endMs) return '00:00';
    const diffSec = Math.max(0, Math.round((endMs - Date.now()) / 1000));
    const minutes = Math.floor(diffSec / 60);
    const seconds = diffSec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  const [timer, setTimer] = useState(computeRemaining);
  useEffect(() => {
    setTimer(computeRemaining());
    const interval = setInterval(() => {
      setTimer(computeRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [endMs]);
  return (
    <View style={breakInProgressStyles.overlay}>
      <View style={breakInProgressStyles.statusPill}>
        <View style={breakInProgressStyles.statusDot} />
        <Text style={breakInProgressStyles.statusText}>On Break</Text>
      </View>

      <View style={breakInProgressStyles.card}>
        <AppIcon name="coffee" size={30} color="#26364D" strokeWidth={1.8} />
        <Text style={breakInProgressStyles.title}>Break in Progress</Text>
        <Text style={breakInProgressStyles.subtitle}>Taking a moment to Relax.</Text>
        <View style={breakInProgressStyles.timerBox}><Text style={breakInProgressStyles.timer}>{timer}</Text></View>
        <TouchableOpacity style={breakInProgressStyles.endButtonWrap} onPress={onEndBreak}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={breakInProgressStyles.endButton}>
            <Text style={breakInProgressStyles.endButtonText}>End Break</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={breakInProgressStyles.upNextCard}>
        <View style={breakInProgressStyles.upNextHeader}>
          <Text style={breakInProgressStyles.upNextLabel}>Up Next</Text>
          {!!nextPatient && (
            <View style={breakInProgressStyles.upNextTimePill}>
              <Text style={breakInProgressStyles.upNextTime}>{nextPatient.scheduledTime}</Text>
            </View>
          )}
        </View>
        {nextPatient ? (
          <View style={breakInProgressStyles.patientRow}>
            <View style={[breakInProgressStyles.avatar, breakInProgressStyles.avatarInitials]}><Text translate={false} style={breakInProgressStyles.avatarText}>{String(nextPatient.name || '').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
            <View style={breakInProgressStyles.patientInfo}>
              <Text translate={false} style={breakInProgressStyles.patientName}>{nextPatient.name}</Text>
              <Text translate={false} style={breakInProgressStyles.patientDetails}>{getTokenLabel(nextPatient)} - {nextPatient.issue}</Text>
            </View>
            <View style={breakInProgressStyles.patientArrow}>
              <AppIcon name="chevron-right" size={16} color="#3C4759" strokeWidth={2} />
            </View>
          </View>
        ) : (
          <Text style={breakInProgressStyles.patientDetails}>No upcoming appointments today.</Text>
        )}
      </View>
    </View>
  );
}

const breakInProgressStyles = createDoctorStyles({
  overlay: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 20 },
  statusPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E7E9EE', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#6B7280' },
  statusText: { ...typography.caption, fontSize: 13, color: '#4B5563' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 26, alignItems: 'center', borderWidth: 1, borderColor: '#E7EAF0', marginBottom: 16 },
  title: { ...typography.subtitle, fontSize: 20, color: '#1A2B3C', marginTop: 12, textAlign: 'center' },
  subtitle: { ...typography.body, fontSize: 14, color: '#8E9DB0', marginTop: 4, marginBottom: 20, textAlign: 'center' },
  timerBox: { width: '100%', borderWidth: 1, borderColor: '#E2E5EA', backgroundColor: '#F8F9FB', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  timer: { ...typography.title, fontSize: 34, color: colors.blue, textAlign: 'center', letterSpacing: 1.5 },
  endButtonWrap: { width: '100%' },
  endButton: { paddingVertical: 15, borderRadius: 12, width: '100%', alignItems: 'center' },
  endButtonText: { ...typography.caption, fontSize: 16, color: '#FFFFFF' },
  upNextCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 18, borderWidth: 1, borderColor: '#E7EAF0' },
  upNextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  upNextLabel: { ...typography.subtitle, fontSize: 17, color: '#1A2B3C' },
  upNextTimePill: { backgroundColor: colors.paleBlue, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  upNextTime: { ...typography.caption, fontSize: 13, color: colors.blue },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarInitials: { backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.subtitle, fontSize: 15, color: '#FFFFFF' },
  patientInfo: { flex: 1 },
  patientName: { ...typography.subtitle, fontSize: 16, color: '#1A2B3C', marginBottom: 2 },
  patientDetails: { ...typography.body, fontSize: 13, color: '#8E9DB0' },
  patientArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
});

// ------------------------------------------------------------------
// Break Control Modal
// ------------------------------------------------------------------
function BreakModal({ visible, onClose, onStartBreak }) {
  const [selectedDuration, setSelectedDuration] = useState('15');
  const [customMinutes, setCustomMinutes] = useState('');
  const durations = ['10 min', '15 min', '30 min', 'Custom'];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Lifts the dialog above the keyboard while typing custom minutes. */}
      <KeyboardSheetOverlay style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <View style={modalStyles.headerBlock}>
            <View style={modalStyles.headerRow}>
              <Text style={modalStyles.title}>Break Control</Text>
              <View style={modalStyles.statusPill}>
                <View style={modalStyles.statusDot} />
                <Text style={modalStyles.statusText}>On Duty</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={modalStyles.closeButton}>
                <AppIcon name="x" size={18} color="#8E9DB0" strokeWidth={2} />
              </Pressable>
            </View>
            <View style={modalStyles.divider} />
          </View>

          <Text style={modalStyles.durationLabel}>SELECT DURATION</Text>
          <View style={modalStyles.durationGrid}>
            {durations.map((duration) => {
              const normalizedDuration = removeMinutesSuffix(duration);
              const isActive = selectedDuration === normalizedDuration;
              return (
                <TouchableOpacity
                  key={duration}
                  style={[modalStyles.durationOption, isActive && modalStyles.durationOptionActive]}
                  onPress={() => setSelectedDuration(normalizedDuration)}
                >
                  <Text style={[modalStyles.durationText, isActive && modalStyles.durationTextActive]}>{duration}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedDuration === 'Custom' && (
            <TextInput
              style={modalStyles.customInput}
              placeholder="Minutes"
              placeholderTextColor="#8E9DB0"
              keyboardType="number-pad"
              value={customMinutes}
              onChangeText={(text) => setCustomMinutes(text.replace(/\D/g, ''))}
            />
          )}
          <TouchableOpacity
            style={modalStyles.startButtonWrap}
            onPress={() => {
              const minutes = selectedDuration === 'Custom' ? Number(customMinutes) : Number(selectedDuration);
              if (!minutes || minutes <= 0) {
                Alert.alert('Break duration', 'Enter the break length in minutes.');
                return;
              }
              onStartBreak(minutes);
            }}
          >
            <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modalStyles.startButton}>
              <AppIcon name="coffee" size={18} color="#FFFFFF" strokeWidth={2} />
              <Text style={modalStyles.startButtonText}>Start Break</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
            <Text style={modalStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSheetOverlay>
    </Modal>
  );
}

const modalStyles = createDoctorStyles({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#FFFFFF', borderRadius: 24, width: '88%', maxWidth: 520, maxHeight: '90%', paddingHorizontal: 24, paddingBottom: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
  headerBlock: { width: '100%', marginHorizontal: -24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 22, paddingBottom: 16, paddingHorizontal: 24, gap: 10 },
  title: { ...typography.subtitle, fontSize: 20, color: '#1A2B3C' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.paleBlue, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34C759' },
  statusText: { ...typography.caption, fontSize: 13, color: colors.blue },
  closeButton: { marginLeft: 'auto', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.line, width: '100%' },
  durationLabel: { ...typography.label, fontSize: 13, color: '#8E9DB0', letterSpacing: 0.8, marginTop: 20, marginBottom: 12, textAlign: 'left', alignSelf: 'flex-start', width: '100%' },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24, width: '100%' },
  durationOption: { flexBasis: '48%', flexGrow: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2E5EA' },
  durationOptionActive: { backgroundColor: colors.paleBlue, borderColor: colors.blue },
  durationText: { ...typography.caption, fontSize: 15, color: '#3C4759' },
  durationTextActive: { color: colors.blue, fontWeight: '800' },
  customInput: { width: '100%', height: 46, borderWidth: 1.5, borderColor: '#E2E5EA', borderRadius: 12, paddingHorizontal: 14, marginTop: -12, marginBottom: 20, ...typography.body, fontSize: 15, color: '#1A2B3C' },
  startButtonWrap: { width: '100%', marginBottom: 8 },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 14, borderRadius: 12, width: '100%' },
  startButtonText: { ...typography.caption, fontSize: 17, color: '#FFFFFF' },
  cancelButton: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  cancelButtonText: { ...typography.body, fontSize: 17, color: '#3C4759' },
});

// ------------------------------------------------------------------
// MAIN SCREEN
// ------------------------------------------------------------------
export default function DoctorDashboard({ navigation }) {
  // Full-screen form Modals pad by these directly: SafeAreaView inside a
  // Modal (its own Android window) can report 0 insets.
  const modalInsets = useSafeAreaInsets();
  const { setToastRole } = useToast();

  useEffect(() => {
    setToastRole('doctor');
  }, [setToastRole]);

  // Same flow as the web DoctorLayout logout: tell the server to invalidate the
  // session (POST /api/auth/logout, refresh token in body), then ALWAYS clear the
  // local session and go to the common Login screen (never the Sign Up flow),
  // even if the request fails.
  const performLogout = useCallback(async ({ skipServerLogout } = {}) => {
    try {
      if (!skipServerLogout) {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        await axiosInstance.post('/api/auth/logout', { refreshToken }, { timeout: 10000 });
      }
    } catch (logoutError) {
      console.warn('Doctor logout request failed:', logoutError?.message);
    } finally {
      try { socketService.disconnect(); } catch (e) { /* ignore */ }
      try { await clearAccountLocalData(); } catch (e) { /* ignore */ }
      setSidebarVisible(false);
      resetToLoginScreen(navigation);
    }
  }, [navigation]);

  // Custom logout popup (LogoutConfirmModal) instead of a plain Alert.
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [doctorDisplayName, setDoctorDisplayName] = useState('');
  // Completed queue row whose prescription is open (web SummaryModal).
  const [prescriptionAppointment, setPrescriptionAppointment] = useState(null);
  const confirmLogout = useCallback(() => {
    setSidebarVisible(false);
    setLogoutOpen(true);
  }, []);
  const handleConfirmLogout = useCallback(async () => {
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    setLogoutOpen(false);
  }, [performLogout]);

  const [activeTab, setActiveTab] = useState('Pending');
  const [breakModalVisible, setBreakModalVisible] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [completeAppointmentVisible, setCompleteAppointmentVisible] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [selectedListPatient, setSelectedListPatient] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [isStaffProfileOpen, setIsStaffProfileOpen] = useState(false);

  // ---- web-parity dashboard state -------------------------------------
  const [doctorId, setDoctorId] = useState(null);
  const [appointments, setAppointments] = useState([]); // today's pending/confirmed/in-progress
  const [completed, setCompleted] = useState([]);
  // Today's completed only drives the counters; the Completed tab lists them all.
  const [completedAll, setCompletedAll] = useState([]);
  const fetchInFlightRef = useRef(false);
  const skippedAppointmentIdsRef = useRef(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  // { appt, startTime, accumulatedPauseMs, pauseStartMs, breakId, breakStartMs,
  //   breakEndMs, breakDurationMs, status: 'started' | 'paused' | 'break' }
  const [activeSession, setActiveSession] = useState(null);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Today's cancelled / no-show appointments. The server decides these now
  // (web: "queue membership is determined by server status, never session
  // time") — the app no longer cancels anyone on its own.
  const [cancelledToday, setCancelledToday] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Apply this doctor's saved app language (Settings → Language), the same
  // way the patient and counselor dashboards do — on open and on refocus.
  useEffect(() => {
    if (!doctorId) return undefined;
    loadUserLanguage(doctorId, 'doctor');
    const unsubscribe = navigation?.addListener?.('focus', () => loadUserLanguage(doctorId, 'doctor'));
    return () => unsubscribe?.();
  }, [doctorId, navigation]);

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      setDoctorDisplayName(String(user?.fullName || user?.name || user?.user?.fullName || '').trim());
      const id = getDoctorIdFromUser(user);
      if (id) {
        setDoctorId(String(id));
      } else {
        setError('Doctor ID not found. Please login again.');
        setLoading(false);
      }
    });
  }, []);

  const showError = useCallback((err, fallback) => {
    const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
    Alert.alert('Error', message);
  }, []);

  // activeSession is local state, so reopening the dashboard mid-consultation
  // used to lose it: the live consultation card vanished and the patient's queue
  // row offered "Start Consultation" again instead of Continue / Complete.
  // Rebuild it from the server's consultation_* fields, mirroring the shape
  // beginConsultation writes. Never clobbers a session already in hand.
  const restoreRunningConsultation = useCallback((liveList) => {
    setActiveSession((current) => {
      if (current?.appt) {
        const latest = liveList.find(appt => appt.id === current.appt.id);
        return latest ? { ...current, appt: latest } : current;
      }
      if (current?.status === 'break') return current;
      const running = liveList.find((appt) => appt.status === 'in-progress');
      if (!running) return current;
      const raw = running.__raw || {};
      const timing = raw.consultation_timing || raw.consultationTiming || {};
      const pauses = Array.isArray(timing.pauses) ? timing.pauses : [];
      const openPause = pauses.find((pause) => !pause.endedAt);
      const startedAt = Date.parse(timing.startedAt || raw.consultation_started_at || raw.actual_start_at);
      return {
        appt: running,
        startTime: Number.isFinite(startedAt) ? startedAt : Date.now(),
        accumulatedPauseMs: pauses.reduce(
          (total, pause) => total + (pause.endedAt ? Math.max(0, Date.parse(pause.endedAt) - Date.parse(pause.startedAt)) : 0),
          0,
        ),
        pauseStartMs: openPause ? Date.parse(openPause.startedAt) : null,
        breakStartMs: null,
        breakEndMs: null,
        breakDurationMs: null,
        status: openPause ? 'paused' : 'started',
      };
    });
  }, []);

  const fetchAppointments = useCallback(async ({ silent } = {}) => {
    // Both early returns must release the pull-to-refresh spinner, since
    // onRefresh turns it on before calling this.
    if (!doctorId) { setRefreshing(false); return; }
    // Polls, socket bursts and pull-to-refresh can all land together — don't
    // stack duplicate feed requests on top of each other.
    if (fetchInFlightRef.current) { setRefreshing(false); return; }
    fetchInFlightRef.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await loadDoctorAppointmentFeed(doctorId);
      const liveAppointmentList = list
        // Today's pending appointments stay in the queue even after their
        // slot time has passed — the doctor can still see a late patient.
        .filter((apt) =>
          isTodayAppointment(apt) &&
          ['pending', 'confirmed', 'in-progress', 'skipped'].includes(normalizeAppointmentStatus(apt)))
        .map((apt) => formatAppointment(apt))
        .map((appt) => {
          if (!skippedAppointmentIdsRef.current.has(appt.id)) return appt;
          if (['completed', 'cancelled', 'in-progress'].includes(appt.status)) {
            skippedAppointmentIdsRef.current.delete(appt.id);
            return appt;
          }
          return { ...appt, status: 'skipped', queueStatus: 'skipped' };
        });
      setAppointments(liveAppointmentList);
      setSelectedPatient(current => current ? liveAppointmentList.find(appt => appt.id === current.id) || current : current);
      restoreRunningConsultation(liveAppointmentList);
      setCancelledToday(
        list
          .filter((apt) => isScheduledToday(apt) && normalizeAppointmentStatus(apt) === 'cancelled')
          .map((apt) => ({
            ...formatAppointment(apt),
            status: 'cancelled',
            isNoShow: getAppointmentCancellationState(apt).noShow,
          })),
      );

      let followUpList = [];
      try {
        followUpList = await loadDoctorFollowUps(doctorId);
      } catch (followUpError) {
        console.warn('Follow-up history could not be loaded separately:', followUpError?.message);
      }

      // The feed returns every day's completed history. Keep the whole list for
      // the Completed tab, and derive today's for the counters and averages.
      const allCompleted = list
        .filter((apt) => normalizeAppointmentStatus(apt) === 'completed')
        .map((apt) => {
          const formatted = formatAppointment(apt);
          if (formatted.followUpDate) return formatted;
          const match = followUpList.find((item) => {
            const fuApptId = pickFirst(item?.appointment_id, item?.appointmentId);
            const fuPatient = item?.patient || item?.patient_details || {};
            const fuPatientId = pickFirst(item?.patient_id, item?.patientId, fuPatient?.id, fuPatient?._id);
            return (
              (fuApptId && String(fuApptId) === String(formatted.apiId)) ||
              (fuPatientId && formatted.patientId && String(fuPatientId) === String(formatted.patientId))
            );
          });
          const matchedDate = pickFirst(match?.follow_up_date, match?.followUpDate, match?.followup_date, match?.date);
          return matchedDate
            ? { ...formatted, followUpRequired: true, followUpDate: formatLocalDateKey(matchedDate) }
            : formatted;
        });

      const completedToday = allCompleted.filter((item) => isCompletedToday(item.__raw));
      setCompletedAll(allCompleted);
      setCompleted(completedToday);
      writeScreenCache('doctor-queue', {
        appointments: liveAppointmentList,
        cancelledToday: list
          .filter((apt) => isScheduledToday(apt) && normalizeAppointmentStatus(apt) === 'cancelled')
          .map((apt) => ({ ...formatAppointment(apt), status: 'cancelled', isNoShow: getAppointmentCancellationState(apt).noShow })),
        completedAll: allCompleted,
        completed: completedToday,
      });
    } catch (err) {
      console.error('Error fetching appointments:', err?.message);
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Error loading appointments. Please check if the server is running.');
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [doctorId, restoreRunningConsultation]);

  // Today's saved queue shows at once (WhatsApp-style) and the feed request
  // refreshes it quietly; a copy from another day is never shown. The copy
  // never restores a running consultation — only the live feed does.
  const queueCopyShownRef = useRef(false);
  useEffect(() => {
    if (!doctorId || queueCopyShownRef.current) { fetchAppointments(); return undefined; }
    queueCopyShownRef.current = true;
    let cancelled = false;
    readScreenCache('doctor-queue', { sameDay: true }).then((cached) => {
      if (cancelled) return; // the effect's next run fetches
      const hasCopy = Array.isArray(cached?.appointments);
      if (hasCopy) {
        setAppointments(cached.appointments);
        setCancelledToday(Array.isArray(cached.cancelledToday) ? cached.cancelledToday : []);
        setCompletedAll(Array.isArray(cached.completedAll) ? cached.completedAll : []);
        setCompleted(Array.isArray(cached.completed) ? cached.completed : []);
        setLoading(false);
      }
      fetchAppointments(hasCopy ? { silent: true } : undefined);
    });
    return () => { cancelled = true; };
  }, [fetchAppointments, doctorId]);

  // New bookings used to appear only after a remount (switching tabs), because
  // nothing refreshed the doctor's feed while the dashboard sat open. This keeps
  // it live: the socket events update it instantly, and the hook's own interval
  // (plus a refresh when the app returns to the foreground) is the fallback for
  // when an event is missed or the doctor isn't in the emitting room. It only
  // runs while this screen is focused and the app is active.
  useLiveRefresh(
    () => fetchAppointments({ silent: true }),
    APPOINTMENT_REFRESH_EVENTS,
  );

  // Restore an active server break after reload / login.
  useEffect(() => {
    if (!doctorId) return;
    fetchActiveBreak()
      .then((serverBreak) => {
        if (!serverBreak || !serverBreak.endMs || serverBreak.endMs <= Date.now()) return;
        setActiveSession((current) => ({
          appt: current?.appt || null,
          startTime: current?.startTime || serverBreak.startMs,
          accumulatedPauseMs: current?.accumulatedPauseMs || 0,
          pauseStartMs: null,
          breakId: serverBreak.id,
          breakStartMs: serverBreak.startMs,
          breakEndMs: serverBreak.endMs,
          breakDurationMs: serverBreak.durationMs,
          status: 'break',
        }));
      })
      .catch((err) => console.error('Failed to restore active break:', err?.message));
  }, [doctorId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments({ silent: true });
  };

  // ---- consultation ---------------------------------------------------
  const handleConsentClick = (appt) => {
    setSelectedPatient(appt);
    setConsentModalVisible(true);
  };

  // Web handleNextPatient: the patient hasn't come — move them to the "Next"
  // queue and show the following pending patient in the consent form.
  const handleNextPatient = async () => {
    if (!selectedPatient || actionBusy || activeSession?.appt || activeSession?.status === 'break') return;
    setActionBusy(true);
    let saved;
    try {
      const response = await patchAppointment(selectedPatient, getSkipPayload(selectedPatient));
      saved = response.data?.appointment || response.data?.data;
    } catch (err) {
      showError(err, 'Unable to move patient to Next.');
      setActionBusy(false);
      return;
    }
    const skippedId = selectedPatient.id;
    skippedAppointmentIdsRef.current.add(skippedId);
    const next = pendingAppointments.find((appt) => appt.id !== skippedId) || null;
    const skippedPatient = saved
      ? { ...formatAppointment({ ...saved, __appointmentSource: selectedPatient.appointmentSource }), status: 'skipped' }
      : { ...selectedPatient, status: 'skipped' };
    setAppointments((prev) => prev.map((a) => (a.id === skippedId ? skippedPatient : a)));
    setSelectedPatient(next);
    if (!next) {
      setConsentModalVisible(false);
      setActiveTab('Next');
    }
    setActionBusy(false);
  };

  // Marks one appointment in-progress and opens it as the "Currently With"
  // session. Shared by Start Consultation (consent form) and direct calls.
  const beginConsultation = async (appt) => {
    let saved;
    try {
      // Same request as the web (getAppointmentStatusUrl): online appointments
      // start through PATCH /api/appointments/:id/status. The plain /:id route
      // can't store "in-progress" (not in the status enum) and fails with 500
      // "Failed to update appointment"; /status sets queue_status in_progress,
      // the start time and the timer. Walk-ins keep their own route.
      const response = getAppointmentSource(appt) === 'walkin'
        ? await patchAppointment(appt, getStatusUpdatePayload(appt, 'in-progress'))
        : await axiosInstance.patch(
          `/api/appointments/${encodeURIComponent(String(appt.apiId || appt.id))}/status`,
          { status: 'in-progress' },
        );
      saved = response.data?.appointment || response.data?.data;
    } catch (err) {
      showError(err, 'Checkup could not be started.');
      return false;
    }
    const timing = saved?.consultation_timing || {};
    const pauses = timing.pauses || [];
    const openPause = pauses.find((pause) => !pause.endedAt);
    setActiveSession({
      appt: { ...appt, status: 'in-progress' },
      startTime: new Date(timing.startedAt || saved?.consultation_started_at || Date.now()).getTime(),
      accumulatedPauseMs: pauses.reduce(
        (total, pause) => total + (pause.endedAt ? Math.max(0, Date.parse(pause.endedAt) - Date.parse(pause.startedAt)) : 0),
        0,
      ),
      pauseStartMs: openPause ? Date.parse(openPause.startedAt) : null,
      breakStartMs: null,
      breakEndMs: null,
      breakDurationMs: null,
      status: openPause ? 'paused' : 'started',
    });
    setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, status: 'in-progress' } : a)));
    skippedAppointmentIdsRef.current.delete(appt.id);
    setActiveTab('In Progress');
    return true;
  };

  const handleStartConsultation = async () => {
    if (!selectedPatient || actionBusy) return;
    // Web handleStartFromConsent: start in queue order / from the slot time.
    if (!canStartAppointment(selectedPatient)) {
      Alert.alert('Not yet', startBlockedReason(selectedPatient));
      return;
    }
    setActionBusy(true);
    const started = await beginConsultation(selectedPatient);
    if (started) {
      setConsentModalVisible(false);
      setSelectedPatient(null);
    }
    setActionBusy(false);
  };

  const handlePause = async () => {
    if (!activeSession?.appt || activeSession.status === 'break' || actionBusy) return;
    const resuming = activeSession.status === 'paused';
    setActionBusy(true);
    try {
      await patchAppointment(activeSession.appt, { consultation_action: resuming ? 'resume' : 'pause' });
    } catch (err) {
      showError(err, 'Could not update consultation timer.');
      setActionBusy(false);
      return;
    }
    setActiveSession((s) => (resuming
      ? { ...s, accumulatedPauseMs: s.accumulatedPauseMs + (Date.now() - s.pauseStartMs), pauseStartMs: null, status: 'started' }
      : { ...s, pauseStartMs: Date.now(), status: 'paused' }));
    setActionBusy(false);
  };

  const getTreatmentTiming = () => {
    const endTime = Date.now();
    let paused = activeSession.accumulatedPauseMs;
    if (activeSession.pauseStartMs) paused += endTime - activeSession.pauseStartMs;
    if (activeSession.breakStartMs) paused += endTime - activeSession.breakStartMs;
    return { endTime, durationMs: Math.max(0, endTime - activeSession.startTime - paused) };
  };

  // "Checked" / "Continue" — open the Complete Appointment form to record the
  // diagnosis, medicines, advice and follow-up.
  const handleChecked = () => {
    if (!activeSession?.appt) return;
    setCompleteAppointmentVisible(true);
  };

  // "Complete" — web handleCompleteNow: finish the consultation straight away
  // without a prescription, for when the doctor has nothing to prescribe.
  const handleCompleteNow = async () => {
    if (!activeSession?.appt || activeSession.status === 'break' || actionBusy) return;
    const appt = activeSession.appt;
    const { endTime, durationMs } = getTreatmentTiming();
    setActionBusy(true);
    try {
      await patchAppointment(appt, getStatusUpdatePayload(appt, 'completed', {
        end_time: endTime,
        duration_ms: durationMs,
      }));
      setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
      setActiveSession(null);
      setActiveTab('Completed');
      Alert.alert('Appointment completed', `${appt.name}'s consultation has been completed.`);
      await fetchAppointments({ silent: true });
    } catch (err) {
      showError(err, 'Appointment could not be completed.');
    } finally {
      setActionBusy(false);
    }
  };

  const saveCompleteForm = async (formData) => {
    if (!activeSession?.appt) return;
    const appt = activeSession.appt;
    const { endTime, durationMs } = getTreatmentTiming();
    const tests = (formData.recommendedTests || [])
      .filter((test) => test.testName?.trim())
      .map((test) => ({
        testName: test.testName.trim(),
        completeBy: test.completeBy || null,
        reason: test.reason || '',
        instructions: test.instructions || '',
      }));
    const primaryTest = tests[0] || {};
    const clinicalFields = formData.visitOnly ? {} : {
      diagnosis: formData.diagnosis,
      medicine: formData.medicine,
      medicines: formData.medicines || [],
      testName: primaryTest.testName || null,
      completeBy: primaryTest.completeBy || null,
      reason: primaryTest.reason || '',
      instructions: primaryTest.instructions || '',
      recommended_tests: tests,
      recommendedTests: tests,
      advice: formData.advice,
      additional_notes: formData.additionalNotes || '',
    };
    try {
      await patchAppointment(appt, getStatusUpdatePayload(appt, 'completed', {
        end_time: endTime,
        duration_ms: durationMs,
        ...clinicalFields,
        follow_up_required: formData.followUpRequired || false,
        follow_up_date: formData.followUpDate || '',
      }));
      setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
      setActiveSession(null);
      setCompleteAppointmentVisible(false);
      setActiveTab('Completed');
      setPrescriptionAppointment(appt);
      await fetchAppointments({ silent: true });
    } catch (err) {
      showError(err, 'Appointment could not be completed.');
    }
  };

  const saveEditedAppointment = async (formData) => {
    if (!editingAppointment) return;
    try {
      await patchAppointment(editingAppointment, {
        ...(formData.visitOnly ? {} : {
          diagnosis: formData.diagnosis,
          medicine: formData.medicine,
          advice: formData.advice,
          additional_notes: formData.additionalNotes,
        }),
        follow_up_required: formData.followUpRequired,
        follow_up_date: formData.followUpDate,
        doctor_id: doctorId,
      });
      const applyEdit = (prev) =>
        prev.map((a) => (a.id === editingAppointment.id ? { ...a, ...formData } : a));
      setCompleted(applyEdit);
      // The Completed tab reads the full history, so it needs the edit too.
      setCompletedAll(applyEdit);
      setEditingAppointment(null);
    } catch (err) {
      showError(err, 'Appointment could not be updated.');
    }
  };

  // Web: navigate('/patient-sms', { callTargetId, autoStartCallType }).
  // Video / Voice Call: rings the patient straight from the dashboard — no chat
  // screen. Once the call is placed the consultation starts too, so it shows
  // under "Currently With" (Complete) when the call ends. If the
  // patient is offline the server only notifies them; nothing else changes.
  const [activeCall, setActiveCall] = useState(null); // { mode, callData, callerId }
  const [callStarting, setCallStarting] = useState(false);

  const handleCall = async (appt, mode) => {
    if (!appt?.patientId) return Alert.alert('Call', 'Patient account not found for this appointment.');
    if (callStarting || activeCall) return undefined;
    const otherSession = activeSession?.appt && activeSession.appt.id !== appt.id;
    if (otherSession) {
      return Alert.alert('Consultation in progress', `Finish ${activeSession.appt.name}'s consultation before calling another patient.`);
    }
    setCallStarting(true);
    try {
      const result = await startDirectCall({ patientId: appt.patientId, patientName: appt.name, mode });
      if (result.notificationOnly) {
        Alert.alert('Call request sent', result.message);
        return undefined;
      }
      setActiveCall({ mode, callData: result.callData, callerId: result.callerId });
      if (!activeSession?.appt) await beginConsultation(appt);
    } catch (err) {
      showError(err, 'Could not start the call.');
    } finally {
      setCallStarting(false);
    }
    return undefined;
  };

  // ---- breaks ---------------------------------------------------------
  const handleStartBreak = async (minutes) => {
    if (!canTakeBreak) {
      setBreakModalVisible(false);
      return;
    }
    try {
      const serverBreak = await startBreak(minutes);
      // The persisted break now owns the pause interval; close a manual pause.
      if (activeSession?.appt && activeSession.status === 'paused') {
        await patchAppointment(activeSession.appt, { consultation_action: 'resume' });
      }
      const breakFields = {
        pauseStartMs: null,
        breakId: serverBreak.id,
        breakStartMs: serverBreak.startMs,
        breakEndMs: serverBreak.endMs,
        breakDurationMs: serverBreak.durationMs,
        status: 'break',
      };
      setActiveSession((s) => (s
        ? {
          ...s,
          ...breakFields,
          accumulatedPauseMs: s.pauseStartMs ? s.accumulatedPauseMs + (Date.now() - s.pauseStartMs) : s.accumulatedPauseMs,
        }
        : { appt: null, startTime: Date.now(), accumulatedPauseMs: 0, ...breakFields }));
      setBreakModalVisible(false);
      fetchAppointments({ silent: true });
    } catch (err) {
      showError(err, 'Failed to start break');
    }
  };

  const finishBreak = useCallback((usedMs) => {
    setActiveSession((s) => {
      if (!s) return s;
      if (!s.appt) return null;
      return {
        ...s,
        accumulatedPauseMs: s.accumulatedPauseMs + Math.max(0, usedMs ?? s.breakDurationMs ?? 0),
        breakId: null,
        breakStartMs: null,
        breakEndMs: null,
        breakDurationMs: null,
        status: 'started',
      };
    });
  }, []);

  const handleEndBreak = async () => {
    if (activeSession?.status !== 'break') return;
    const used = Date.now() - activeSession.breakStartMs;
    try {
      if (activeSession.breakId) await endBreak(activeSession.breakId);
    } catch (err) {
      showError(err, 'Failed to end break');
      return;
    }
    finishBreak(used);
    fetchAppointments({ silent: true });
  };

  // Auto-end the break when its time runs out (web parity).
  useEffect(() => {
    if (activeSession?.status !== 'break' || !activeSession.breakEndMs) return;
    if (activeSession.breakEndMs - now > 0) return;
    if (activeSession.breakId) {
      endBreak(activeSession.breakId)
        .then(() => fetchAppointments({ silent: true }))
        .catch((err) => console.error('Failed to auto-end break:', err?.message));
    }
    finishBreak();
  }, [now, activeSession, fetchAppointments, finishBreak]);

  // ---- derived queue / stats (same formulas as web) ------------------
  const activeAppt = activeSession?.appt || null;
  const onBreak = activeSession?.status === 'break';
  // Every queue tab uses the web order (emergency → slot time → token), so the
  // first Pending card — and the Next Patient card — is the next one to call.
  // Queue membership comes from the server status only (web parity).
  const liveAppointments = appointments;
  const cancelledQueue = sortByToken(cancelledToday.filter((appt) => appt.id !== activeAppt?.id));
  const pendingAppointments = sortByToken(liveAppointments.filter((appt) => appt.status === 'pending'));
  const inProgressAppointments = [
    // The patient currently being seen stays on top.
    ...(activeAppt ? [activeAppt] : []),
    ...sortByToken(liveAppointments.filter((appt) => ['confirmed', 'in-progress'].includes(appt.status) && appt.id !== activeAppt?.id)),
  ];
  // Full completed history: newest day first, normal queue order within a day.
  const completedQueue = useMemo(() => {
    const byDay = new Map();
    completedAll.forEach((appt) => {
      const key = formatLocalDateKey(appt.appointmentDate) || '';
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(appt);
    });
    return [...byDay.keys()]
      .sort((a, b) => String(b).localeCompare(String(a)))
      .flatMap((key) => sortByToken(byDay.get(key)));
  }, [completedAll]);
  // Patients moved aside with "Next" in the consent form.
  const skippedAppointments = sortByToken(liveAppointments.filter((appt) => appt.status === 'skipped'));
  // Strict queue order: only the patient at the top of Pending (emergencies
  // sort first) can be started. Once that token is started, completed or
  // moved to Next, the following one moves up and becomes startable. "Next"
  // patients can be started whenever the doctor is free — never during
  // another consultation or a break.
  const pendingIndexOf = (appt) => pendingAppointments.findIndex((item) => item.id === appt?.id);
  const isQueueTurnAvailable = (appt) => (completed.length > 0 || skippedAppointments.length > 0) && pendingIndexOf(appt) === 0;
  const canStartAppointment = (appt) =>
    Boolean(appt) &&
    ['pending', 'confirmed', 'skipped'].includes(appt.status) &&
    !activeAppt &&
    !onBreak &&
    (appt.status === 'skipped'
      || (appt.status === 'pending' && pendingIndexOf(appt) === 0)
      || (appt.status === 'confirmed' && (isAppointmentStartTimeReached(appt, now) || isQueueTurnAvailable(appt))));
  // Every waiting card shows Start Consultation; only the top one is enabled.
  const shouldShowStart = (appt) => {
    if (activeTab === 'Next') return appt?.status === 'skipped';
    return activeTab === 'Pending' && ['pending', 'confirmed'].includes(appt?.status);
  };
  // Why a patient can't be started yet (alert + consent form hint).
  const startBlockedReason = (appt) => {
    if (activeSession?.appt || activeSession?.status === 'break') {
      return 'Finish the current consultation or break before starting another appointment.';
    }
    const top = pendingAppointments[0];
    if (appt?.status === 'pending' && top && top.id !== appt.id) {
      return `${getTokenLabel(top)} (${top.name}) is first in the queue. Start it or move it to Next first.`;
    }
    return `Consultation can start at ${appt?.scheduledTime || 'the appointment time'}.`;
  };
  const visibleQueue = activeTab === 'Completed'
    ? completedQueue
    : activeTab === 'In Progress' ? inProgressAppointments
      : activeTab === 'Next' ? skippedAppointments
        : activeTab === 'Cancelled' ? cancelledQueue : pendingAppointments;
  // "Up Next" on the break screen is the next patient to call: the top of
  // Pending. The patient already being seen and patients moved to Next
  // (they haven't come) are not "up next".
  const nextPatient = pendingAppointments.find((appt) => appt.id !== activeAppt?.id) || null;
  // A break pauses the queue, so there must be a queue to pause.
  const canTakeBreak = Boolean(activeAppt) || liveAppointments.length > 0;
  const totalToday = liveAppointments.length + completed.length;
  const averageConsultMin = completed.length
    ? Math.max(1, Math.round(completed.reduce((sum, appt) => sum + (appt.durationMs || 0), 0) / completed.length / 60000))
    : 15;
  const overview = [
    { title: "Today's Appointments", value: String(totalToday), icon: 'calendar', tone: 'teal' },
    { title: 'Pending Consultations', value: String(pendingAppointments.length), icon: 'hourglass', tone: 'amber' },
    { title: 'Completed Today', value: String(completed.length), icon: 'check', tone: 'green' },
    { title: 'Avg. Consult Time', value: String(averageConsultMin), suffix: 'min', icon: 'timer', tone: 'indigo' },
  ];

  // Overview heading at the top of Home: today's date, no greeting.
  const today = new Date();
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const todayLabel = `${WEEKDAYS[today.getDay()]}, ${today.getDate()} ${MONTHS[today.getMonth()]}`;
  const tabCounts = {
    Pending: pendingAppointments.length,
    'In Progress': inProgressAppointments.length,
    Next: skippedAppointments.length,
    // Matches the tab's list, which is the full history (not just today).
    Completed: completedQueue.length,
    Cancelled: cancelledQueue.length,
  };

  // Screen history, like a stack navigator (WhatsApp-style back): opening a
  // screen remembers the one it was opened from, and back returns there
  // instead of always jumping to Home. The bottom tabs are roots: from any tab
  // back goes to Home, and Home asks for a second press before leaving.
  const historyRef = useRef([]);
  const activeScreenRef = useRef(activeScreen);
  activeScreenRef.current = activeScreen;
  const exitPressedAtRef = useRef(0);

  const openScreen = useCallback((next) => {
    const current = activeScreenRef.current;
    if (current === next) return;
    historyRef.current = [...historyRef.current, current].slice(-30);
    activeScreenRef.current = next;
    setActiveScreen(next);
  }, []);

  const switchTab = useCallback((tab) => {
    historyRef.current = tab === 'dashboard' ? [] : ['dashboard'];
    activeScreenRef.current = tab;
    setActiveScreen(tab);
  }, []);

  const goBack = useCallback(() => {
    const previous = historyRef.current[historyRef.current.length - 1] || 'dashboard';
    historyRef.current = historyRef.current.slice(0, -1);
    activeScreenRef.current = previous;
    setActiveScreen(previous);
  }, []);

  // Android back, one step at a time: overlays first, then the open screen's
  // own inner pages (via useDoctorBack), then the screen history, and only a
  // second press on Home leaves the app.
  const backRegistry = useDoctorBackRegistry();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingAppointment) { setEditingAppointment(null); return true; }
      if (completeAppointmentVisible) { setCompleteAppointmentVisible(false); return true; }
      if (consentModalVisible) { setConsentModalVisible(false); return true; }
      if (breakModalVisible) { setBreakModalVisible(false); return true; }
      if (sidebarVisible) { setSidebarVisible(false); return true; }
      if (backRegistry.handle()) return true;
      if (activeScreen !== 'dashboard') { goBack(); return true; }
      historyRef.current = [];
      const now = Date.now();
      if (now - exitPressedAtRef.current < 2000) return false;
      exitPressedAtRef.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });
    return () => subscription.remove();
  }, [activeScreen, backRegistry, breakModalVisible, completeAppointmentVisible, consentModalVisible, editingAppointment, goBack, sidebarVisible]);

  const sidebarActiveItem = screenSidebarItems[activeScreen] ?? null;
  const openNotifications = () => {
    openScreen('notifications');
  };

  const handleSidebarNavigate = (item) => {
    const nextScreen = sidebarRoutes[item];
    if (nextScreen) {
      openScreen(nextScreen);
      setTimeout(() => setSidebarVisible(false), 120);
      return;
    }
    Alert.alert('Settings', 'Doctor settings are coming soon.');
  };

  // Header/sidebar's profile avatar opens the doctor profile. As on the web:
  // the sidebar "QR Code" item / bottom QR button open the clinic walk-in QR
  // (profileQr); Settings → Profile QR and the profile's "Open Card" pill open
  // the doctor's own profile QR (profileCardQr).
  const onProfilePress = () => openScreen('profile');

  const openQrCard = () => {
    openScreen('profileCardQr');
  };

  const handleSidebarProfilePress = () => {
    onProfilePress();
    setTimeout(() => setSidebarVisible(false), 120);
  };

  const renderSidebar = () => (
    <DoctorSidebar
      visible={sidebarVisible}
      activeItem={sidebarActiveItem}
      onClose={() => setSidebarVisible(false)}
      onNavigate={handleSidebarNavigate}
      onProfilePress={handleSidebarProfilePress}
      onLogout={confirmLogout}
    />
  );

  const renderScreen = () => {
    if (activeScreen === 'walkIn') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <WalkInAppointmentsScreen onBack={goBack} />
        </SafeAreaView>
      );
    }
    if (activeScreen === 'settings') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorSettingsScreen
            onBack={goBack}
            onOpenCard={openQrCard}
            onLogout={confirmLogout}
            onForceLogout={performLogout}
            navigation={navigation}
          />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'patientDetail' && selectedListPatient) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <PatientDetailScreen
            patient={selectedListPatient}
            onBack={goBack}
            onVisitPress={(record) => { setSelectedRecord(record); openScreen('visitDetail'); }}
          />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'visitDetail' && selectedListPatient && selectedRecord) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <VisitDetailScreen patient={selectedListPatient} record={selectedRecord} onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'patients') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => openScreen('settings')} />
          <PatientsScreen onPatientPress={(patient) => { setSelectedListPatient(patient); openScreen('patientDetail'); }} />
          <DoctorBottomNavigation
            active="Patients"
            onChange={(label) => {
              if (label === 'QR') openScreen('profileQr');
              if (label === 'Home') switchTab('dashboard');
              if (label === 'Calendar') switchTab('calendar');
              if (label === 'Staff') switchTab('staffManagement');
            }}
          />
          {renderSidebar()}
        </SafeAreaView>
      );
    }

    if (activeScreen === 'calendar') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => openScreen('settings')} />
          <CalendarAvailabilityScreen />
          <DoctorBottomNavigation
            active="Calendar"
            onChange={(label) => {
              if (label === 'QR') openScreen('profileQr');
              if (label === 'Home') switchTab('dashboard');
              if (label === 'Patients') switchTab('patients');
              if (label === 'Staff') switchTab('staffManagement');
            }}
          />
          {renderSidebar()}
        </SafeAreaView>
      );
    }

    if (activeScreen === 'appointments') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <AppointmentsListScreen onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'profile') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorProfileScreen onBack={goBack} onOpenCard={openQrCard} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'profileCardQr') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorProfileCardQrScreen onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'profileQr') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorProfileQrScreen onBack={goBack} />
          {/* QR Code is the middle bottom tab, so the tab bar stays visible
              here like on Home / Patients / Calendar / Staff. */}
          <DoctorBottomNavigation
            active="QR"
            onChange={(label) => {
              if (label === 'Home') switchTab('dashboard');
              if (label === 'Patients') switchTab('patients');
              if (label === 'Calendar') switchTab('calendar');
              if (label === 'Staff') switchTab('staffManagement');
            }}
          />
          {renderSidebar()}
        </SafeAreaView>
      );
    }

    if (activeScreen === 'clinic') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ClinicPageScreen onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'reviews') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorReviewsScreen onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'followUps') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <FollowUpsScreen onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'notifications') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <NotificationsScreen onBack={goBack} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'staffManagement') {
      const staffSubscreenOpen = isCreateStaffOpen || isStaffProfileOpen;
      return (
        <SafeAreaView style={styles.safeArea}>
          {!staffSubscreenOpen && <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => openScreen('settings')} />}
          <StaffManagementScreen onCreateStaffOpenChange={setIsCreateStaffOpen} onStaffProfileOpenChange={setIsStaffProfileOpen} />
          {!staffSubscreenOpen && (
            <DoctorBottomNavigation
              active="Staff"
              onChange={(label) => {
                if (label === 'QR') openScreen('profileQr');
                if (label === 'Home') switchTab('dashboard');
                if (label === 'Calendar') switchTab('calendar');
                if (label === 'Patients') switchTab('patients');
              }}
            />
          )}
          {!staffSubscreenOpen && renderSidebar()}
        </SafeAreaView>
      );
    }


    const renderHomeBody = () => {
      if (loading) {
        return (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.emptyText}>Loading appointments...</Text>
          </View>
        );
      }
      if (error) {
        return (
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchAppointments()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        );
      }
      if (onBreak) {
        return (
          <BreakInProgressModal
            onEndBreak={handleEndBreak}
            endMs={activeSession.breakEndMs}
            nextPatient={nextPatient}
          />
        );
      }
      return (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue]} />}
        >
          <View style={styles.overviewHeader}>
            <View style={styles.overviewCopy}>
              <Text style={styles.overviewTitle}>Today's Overview</Text>
              <View style={styles.overviewDateRow}>
                <AppIcon name="calendar" size={13} strokeWidth={2} color={colors.muted} />
                <Text style={styles.overviewDate}>{todayLabel}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => (canTakeBreak
                ? setBreakModalVisible(true)
                : Alert.alert('No appointments', 'There are no appointments in your queue today, so there is nothing to pause.'))}
              style={[styles.breakButton, !canTakeBreak && styles.breakButtonDisabled]}
            >
              <AppIcon name="coffee" size={15} strokeWidth={2} color="#B45309" />
              <Text style={styles.breakText}>Take Break</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {overview.map((item) => (
              <OverviewCard
                key={item.title}
                {...item}
                onPress={item.title.startsWith("Today's") ? () => openScreen('appointments') : undefined}
              />
            ))}
          </View>

          {activeSession?.appt && (
            <ActiveConsultationCard
              session={activeSession}
              busy={actionBusy}
              onPause={handlePause}
              onChecked={handleChecked}
              onComplete={handleCompleteNow}
              onVitals={() => setVitalsOpen(true)}
            />
          )}
          <DoctorVitalsSheet
            appointment={activeSession?.appt}
            visible={vitalsOpen}
            onClose={() => setVitalsOpen(false)}
            onSaved={(saved) => {
              setVitalsOpen(false);
              // Show the new readings straight away (card, Complete form); the
              // silent refetch then brings the server's copy.
              setActiveSession((current) => (current?.appt ? {
                ...current,
                appt: {
                  ...current.appt,
                  vitals: { ...(current.appt.vitals || {}), ...saved },
                  bp: saved.blood_pressure || current.appt.bp,
                  temperature: saved.temperature ?? current.appt.temperature,
                },
              } : current));
              fetchAppointments({ silent: true });
            }}
          />

          <View style={styles.queueHeader}>
            <View style={styles.overviewCopy}>
              <Text style={styles.heading}>Appointment Queue</Text>
              <Text style={styles.sectionHint}>Sorted by current workflow</Text>
            </View>
            <View style={styles.queueIcon}>
              <AppIcon name="users" size={18} strokeWidth={2} color="#FFFFFF" />
            </View>
          </View>
          <QueueTabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />

          {visibleQueue.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <AppIcon name="calendar" size={22} strokeWidth={1.8} color={colors.blue} />
              </View>
              <Text style={styles.emptyTitle}>No appointments here</Text>
              <Text style={styles.emptyHint}>Appointments in this queue will show up here.</Text>
            </View>
          ) : (
            <ResponsiveGrid minItemWidth={350} maxColumns={2}>{visibleQueue.map((item, index) => (
              <AppointmentCard
                key={`${activeTab}-${item.id}`}
                item={item}
                isActive={activeAppt?.id === item.id}
                highlight={index === 0}
                showStart={shouldShowStart(item)}
                canStart={canStartAppointment(item)}
                sessionBusy={Boolean(activeSession?.appt)}
                onBreak={onBreak}
                onStartConsultation={handleConsentClick}
                onContinue={handleChecked}
                onView={(appt) => setEditingAppointment(appt)}
                onPrescription={(appt) => setPrescriptionAppointment(appt)}
                onCall={handleCall}
              />
            ))}</ResponsiveGrid>
          )}
        </ScrollView>
      );
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => openScreen('settings')} />
        {renderHomeBody()}

        <BreakModal visible={breakModalVisible} onClose={() => setBreakModalVisible(false)} onStartBreak={handleStartBreak} />
        <PatientConsentModal
          visible={consentModalVisible}
          onClose={() => setConsentModalVisible(false)}
          onStartConsultation={handleStartConsultation}
          onNext={handleNextPatient}
          nextDisabled={!selectedPatient || Boolean(activeSession?.appt) || activeSession?.status === 'break' || selectedPatient?.status === 'skipped'}
          startBlockedText={
            selectedPatient && !canStartAppointment(selectedPatient)
              ? startBlockedReason(selectedPatient)
              : ''
          }
          patient={selectedPatient}
          starting={actionBusy}
        />

        {/* Full-screen modals so the header, bottom bar and the centre QR
            button never cover the form or its Save / Cancel buttons. */}
        <Modal
          visible={Boolean(completeAppointmentVisible && activeSession?.appt)}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setCompleteAppointmentVisible(false)}
        >
          <View style={[styles.formModal, { paddingTop: modalInsets.top, paddingBottom: modalInsets.bottom }]}>
            {completeAppointmentVisible && activeSession?.appt && (
              <CompleteAppointmentScreen
                patient={activeSession.appt}
                onCancel={() => setCompleteAppointmentVisible(false)}
                onSave={saveCompleteForm}
              />
            )}
          </View>
        </Modal>
        <Modal
          visible={Boolean(editingAppointment)}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setEditingAppointment(null)}
        >
          <View style={[styles.formModal, { paddingTop: modalInsets.top, paddingBottom: modalInsets.bottom }]}>
            {editingAppointment && (
              <EditCompletedAppointmentScreen
                appointment={editingAppointment}
                onCancel={() => setEditingAppointment(null)}
                onSave={saveEditedAppointment}
              />
            )}
          </View>
        </Modal>
        <DoctorBottomNavigation
          active="Home"
          onChange={(label) => {
            if (label === 'QR') openScreen('profileQr');
            if (label === 'Patients') switchTab('patients');
            if (label === 'Calendar') switchTab('calendar');
            if (label === 'Staff') switchTab('staffManagement');
          }}
        />
        {renderSidebar()}
      </SafeAreaView>
    );
  };

  return (
    <DoctorBackContext.Provider value={backRegistry}>
      {renderScreen()}
      <ConsultationPrescriptionModal
        visible={Boolean(prescriptionAppointment)}
        appointment={prescriptionAppointment}
        doctorName={doctorDisplayName}
        onClose={() => setPrescriptionAppointment(null)}
      />
      <LogoutConfirmModal
        visible={logoutOpen}
        doctorName={doctorDisplayName}
        loggingOut={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
      {/* Play Store "update available" reminder, same as the patient and
          consultant dashboards (popup + notification, twice per version). */}
      <UpdateReminderModal variant="doctor" />
      {activeCall?.mode === 'video' && (
        <VideoCallModal
          isOpen
          callData={activeCall.callData}
          currentUser={{ id: activeCall.callerId, role: 'counsellor' }}
          onClose={() => setActiveCall(null)}
          onEndCall={(callId) => endDirectCall(callId, activeCall.callerId)}
        />
      )}
      {activeCall?.mode === 'voice' && (
        <VoiceCallModal
          isOpen
          callData={activeCall.callData}
          currentUser={{ id: activeCall.callerId, role: 'counsellor' }}
          onClose={() => setActiveCall(null)}
          onEndCall={(callId) => endDirectCall(callId, activeCall.callerId)}
        />
      )}
    </DoctorBackContext.Provider>
  );
}

const styles = createDoctorStyles({
  safeArea: { flex: 1, backgroundColor: colors.background },
  completeAppointmentOverlay: { position: 'absolute', top: 58, right: 0, bottom: 65, left: 0, zIndex: 20 },
  formModal: { flex: 1, backgroundColor: '#FFFFFF' },
  // Extra bottom room: the raised QR button overlaps the last ~26px.
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 54 },
  breakButton: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: '#FCD9A6', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF7E6' },
  breakButtonDisabled: { opacity: 0.5 },
  breakText: { ...typography.caption, fontSize: 14, color: '#92400E' },
  sectionHint: { ...typography.body, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  overviewCopy: { flex: 1 },
  overviewTitle: { ...typography.title, fontSize: 20, lineHeight: 25, color: colors.ink },
  overviewDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  overviewDate: { ...typography.body, fontSize: 13, lineHeight: 17, color: colors.muted },
  // marginTop separates the queue from the overview grid above it — without it
  // the heading sat flush against the cards.
  queueHeader: { marginTop: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queueIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue },
  heading: { ...typography.subtitle, fontSize: 18, lineHeight: 23, color: colors.ink },
  empty: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DDF2EF', marginTop: 12 },
  emptyText: { ...typography.body, fontSize: 15, color: colors.muted, textAlign: 'center' },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E6FFFB', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...typography.subtitle, fontSize: 15, lineHeight: 20, color: colors.ink },
  emptyHint: { ...typography.body, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorTitle: { ...typography.subtitle, fontSize: 17, color: colors.red },
  retryButton: { marginTop: 6, paddingHorizontal: 22, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...typography.button, fontSize: 14, color: colors.red },
});
