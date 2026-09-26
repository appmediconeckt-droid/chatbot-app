// Doctor dashboard (Home) — same data + actions as the web
// chatbot/src/Component/DoctorDashboard/Dashboard/DoctorDashboard.jsx:
//   feed      GET /api/appointments, /api/walkin-appointments,
//             /api/appointments?appointment_status=completed, /api/followups
//   consult   PATCH /api/(walkin-)appointments/:id  in-progress / pause / resume / completed
//   breaks    GET /api/doctor-breaks/active, POST /start, PATCH /:id/end
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Dimensions, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { CLINICIAN_GRADIENT } from '../../../theme/palette';

import DoctorHeader from '../dashboard/components/layout/DoctorHeader';
import DoctorBottomNavigation from '../dashboard/navigation/DoctorBottomNavigation';
import { colors, typography, createDoctorStyles } from '../dashboard/theme';
import AppIcon from '../dashboard/icons/AppIcon';
import AppointmentCard from '../dashboard/components/AppointmentCard';
import NextPatientCard from '../dashboard/components/NextPatientCard';
import ActiveConsultationCard from '../dashboard/components/ActiveConsultationCard';
import EditCompletedAppointmentScreen from '../dashboard/components/EditCompletedAppointmentScreen';
import CompleteAppointmentScreen from '../dashboard/components/CompleteAppointmentScreen';
import DoctorSidebar from '../dashboard/components/DoctorSidebar';
import { DoctorBackContext, useDoctorBackRegistry } from '../dashboard/useDoctorBack';
import WalkInAppointmentsScreen from '../dashboard/components/WalkInAppointmentsScreen';
import PatientsScreen from '../dashboard/components/PatientsScreen';
import PatientDetailScreen from '../dashboard/components/PatientDetailScreen';
import VisitDetailScreen from '../dashboard/components/VisitDetailScreen';
import CalendarAvailabilityScreen from '../dashboard/components/CalendarAvailabilityScreen';
import AppointmentsListScreen from '../dashboard/components/AppointmentsListScreen';
import DoctorProfileQrScreen from '../dashboard/components/DoctorProfileQrScreen';
import DoctorProfileScreen from '../dashboard/components/DoctorProfileScreen';
import FollowUpsScreen from '../dashboard/components/FollowUpsScreen';
import ClinicPageScreen from '../dashboard/components/ClinicPageScreen';
import StaffManagementScreen from '../dashboard/components/StaffManagementScreen';
import NotificationsScreen from '../dashboard/components/NotificationsScreen';
import DoctorSettingsScreen from '../dashboard/components/DoctorSettingsScreen';
import OverviewCard from '../dashboard/components/OverviewCard';
import QueueTabs from '../dashboard/components/QueueTabs';
import {
  endBreak,
  fetchActiveBreak,
  formatAppointment,
  formatLocalDateKey,
  getDoctorIdFromUser,
  getStatusUpdatePayload,
  getStoredDoctorUser,
  getTokenLabel,
  isConsultationStartOpen,
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
import { clearAccountLocalData } from '../../../utils/authSession';

const { width } = Dimensions.get('window');

const sidebarRoutes = {
  appointments: 'appointments',
  walkIn: 'walkIn',
  followUps: 'followUps',
  clinic: 'clinic',
  settings: 'settings',
  qrCode: 'profileQr',
};

const screenSidebarItems = {
  clinic: 'clinic',
  appointments: 'appointments',
  walkIn: 'walkIn',
  followUps: 'followUps',
  settings: 'settings',
  profileQr: 'qrCode',
};

const removeMinutesSuffix = (value) => (value ?? '').replace(' min', '');

// ------------------------------------------------------------------
// Patient Consent Form Modal
// ------------------------------------------------------------------
function PatientConsentModal({ visible, onClose, onStartConsultation, patient, starting }) {
  const [agreements, setAgreements] = useState({ reviewed: true, tracking: true, responsibility: true, confidentiality: true });
  const toggleAgreement = (key) => setAgreements((prev) => ({ ...prev, [key]: !prev[key] }));
  const allChecked = agreements.reviewed && agreements.tracking && agreements.responsibility && agreements.confidentiality;
  if (!visible) return null;
  return (
    <View style={consentStyles.overlay}>
      <View style={consentStyles.content}>
        <View style={consentStyles.header}>
          <View style={consentStyles.headerIconBadge}>
            <AppIcon name="user" size={15} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={consentStyles.headerTitle}>Patient Consent Form</Text>
        </View>
        <ScrollView style={consentStyles.scroll} contentContainerStyle={consentStyles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={consentStyles.sectionTitle}>Patient Information</Text>
          <View style={[consentStyles.infoRow, consentStyles.fullWidth]}>
            <Text style={consentStyles.infoLabel}>Name:</Text>
            <Text style={consentStyles.infoValue}>{patient?.name ?? ''}</Text>
          </View>
          <View style={consentStyles.gridRow}>
            <View style={consentStyles.infoRow}>
              <Text style={consentStyles.infoLabel}>Gender:</Text>
              <Text style={consentStyles.infoValue}>{patient?.gender ?? ''}</Text>
            </View>
            <View style={consentStyles.infoRow}>
              <Text style={consentStyles.infoLabel}>Scheduled:</Text>
              <Text style={consentStyles.infoValue}>{patient?.scheduledTime ?? ''}</Text>
            </View>
          </View>
          <View style={[consentStyles.infoRow, consentStyles.fullWidth]}>
            <Text style={consentStyles.infoLabel}>Issue:</Text>
            <Text style={consentStyles.infoValue}>{patient?.issue ?? ''}</Text>
          </View>
          <View style={[consentStyles.infoRow, consentStyles.fullWidth]}>
            <Text style={consentStyles.infoLabel}>Token:</Text>
            <Text style={consentStyles.infoValue}>{patient ? getTokenLabel(patient) : 'N/A'}</Text>
          </View>
          <View style={[consentStyles.infoRow, consentStyles.fullWidth]}>
            <Text style={consentStyles.infoLabel}>Phone:</Text>
            <Text style={consentStyles.infoValue}>{patient?.phone || 'N/A'}</Text>
          </View>

          <Text style={[consentStyles.sectionTitle, { marginTop: 16 }]}>Agreement</Text>
          <View style={consentStyles.agreementBox}>
            {[
              ['reviewed', "I confirm that I have reviewed the patient's information."],
              ['tracking', 'I understand that starting will begin tracking consultation time.'],
              ['responsibility', 'I acknowledge my responsibility for providing appropriate medical care.'],
              ['confidentiality', 'I confirm I will maintain patient confidentiality.'],
            ].map(([key, text]) => (
              <TouchableOpacity key={key} style={consentStyles.agreementItem} onPress={() => toggleAgreement(key)} hitSlop={4}>
                <View style={[consentStyles.checkbox, agreements[key] && consentStyles.checkboxChecked]}>
                  {agreements[key] && <AppIcon name="check-mark" size={13} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={consentStyles.agreementText}>{text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={consentStyles.buttonContainer}>
          <TouchableOpacity style={consentStyles.cancelButton} onPress={onClose}>
            <Text style={consentStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={consentStyles.startButtonWrap} onPress={onStartConsultation} disabled={!allChecked || starting}>
            <LinearGradient
              colors={allChecked && !starting ? CLINICIAN_GRADIENT : ['#8E9DB0', '#8E9DB0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={consentStyles.startButton}
            >
              <Text style={consentStyles.play}>▶</Text>
              <Text style={consentStyles.startButtonText}>{starting ? 'Starting...' : 'Start Consultation'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const consentStyles = createDoctorStyles({
  overlay: { position: 'absolute', top: 58, right: 0, bottom: 65, left: 0, zIndex: 30 },
  content: { flex: 1, marginHorizontal: 4, backgroundColor: colors.background, borderRadius: 9, overflow: 'hidden' },
  header: { height: 51, paddingHorizontal: 12, backgroundColor: '#0D9488', flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.subtitle, fontSize: 19, lineHeight: 25, color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 16 },
  sectionTitle: { ...typography.caption, fontSize: 15, lineHeight: 20, color: '#0D9488', marginBottom: 12 },
  infoRow: { flex: 1, minHeight: 61, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 6, marginBottom: 9 },
  fullWidth: { width: '100%' },
  gridRow: { flexDirection: 'row', gap: 9 },
  infoLabel: { ...typography.body, fontSize: 13, lineHeight: 17, color: '#596170', marginBottom: 3 },
  infoValue: { ...typography.caption, fontSize: 14, lineHeight: 19, color: '#252B35' },
  agreementBox: { backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 6, padding: 10, paddingBottom: 2 },
  agreementItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 9 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#AEB6C4', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  agreementText: { ...typography.body, fontSize: 13, color: '#3C4759', flex: 1, lineHeight: 18 },
  buttonContainer: { height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  cancelButton: { flex: 0.8, height: 43, borderRadius: 6, borderWidth: 1, borderColor: '#C9D1DD', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { ...typography.caption, fontSize: 14, color: '#252B35' },
  // Wrapper carries the flex sizing (matching cancelButton's flex sibling);
  // the LinearGradient inside carries the actual pill shape/fill so the
  // gradient corners round correctly.
  startButtonWrap: { flex: 1.3 },
  startButton: { height: 43, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startButtonText: { ...typography.caption, fontSize: 14, lineHeight: 16, color: '#FFFFFF', textAlign: 'center' },
  play: { ...typography.text, fontSize: 12, color: '#FFFFFF' },
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
            <View style={[breakInProgressStyles.avatar, breakInProgressStyles.avatarInitials]}><Text style={breakInProgressStyles.avatarText}>{nextPatient.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
            <View style={breakInProgressStyles.patientInfo}>
              <Text style={breakInProgressStyles.patientName}>{nextPatient.name}</Text>
              <Text style={breakInProgressStyles.patientDetails}>{getTokenLabel(nextPatient)} - {nextPatient.issue}</Text>
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
      <View style={modalStyles.overlay}>
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
      </View>
    </Modal>
  );
}

const modalStyles = createDoctorStyles({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#FFFFFF', borderRadius: 24, width: width - 48, paddingHorizontal: 24, paddingBottom: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
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
  // Same flow as the web DoctorLayout logout: tell the server to invalidate the
  // session (POST /api/auth/logout, refresh token in body), then ALWAYS clear the
  // local session and go back to the role selector, even if the request fails.
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
      navigation.replace('RoleSelector');
    }
  }, [navigation]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Logout Account', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: performLogout },
    ]);
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
  const [patientDetailOrigin, setPatientDetailOrigin] = useState('patients');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [notificationsOrigin, setNotificationsOrigin] = useState('dashboard');
  const [isStaffProfileOpen, setIsStaffProfileOpen] = useState(false);
  const [qrOrigin, setQrOrigin] = useState('dashboard');

  // ---- web-parity dashboard state -------------------------------------
  const [doctorId, setDoctorId] = useState(null);
  const [appointments, setAppointments] = useState([]); // today's pending/confirmed/in-progress
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  // { appt, startTime, accumulatedPauseMs, pauseStartMs, breakId, breakStartMs,
  //   breakEndMs, breakDurationMs, status: 'started' | 'paused' | 'break' }
  const [activeSession, setActiveSession] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
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

  const fetchAppointments = useCallback(async ({ silent } = {}) => {
    if (!doctorId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await loadDoctorAppointmentFeed(doctorId);
      setAppointments(
        list
          .filter((apt) =>
            isTodayAppointment(apt) &&
            ['pending', 'confirmed', 'in-progress'].includes(normalizeAppointmentStatus(apt)))
          .map((apt) => formatAppointment(apt)),
      );

      let followUpList = [];
      try {
        followUpList = await loadDoctorFollowUps(doctorId);
      } catch (followUpError) {
        console.warn('Follow-up history could not be loaded separately:', followUpError?.message);
      }

      setCompleted(
        list
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
          }),
      );
    } catch (err) {
      console.error('Error fetching appointments:', err?.message);
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Error loading appointments. Please check if the server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [doctorId]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

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
    // Every Start path funnels through here, so the time gate holds even for
    // the queue's "View" rows, which also open the start-consultation modal.
    if (!isConsultationStartOpen(appt)) {
      Alert.alert('Not yet time', `${appt.name}'s consultation can be started at ${appt.scheduledTime}.`);
      return;
    }
    setSelectedPatient(appt);
    setConsentModalVisible(true);
  };

  // Marks one appointment in-progress and opens it as the "Currently With"
  // session. Shared by Start Consultation (consent form) and direct calls.
  const beginConsultation = async (appt) => {
    let saved;
    try {
      const response = await patchAppointment(appt, getStatusUpdatePayload(appt, 'in-progress'));
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
    setActiveTab('In Progress');
    return true;
  };

  const handleStartConsultation = async () => {
    if (!selectedPatient || actionBusy) return;
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

  // "Complete" — mark completed without the form (web handleCompleteNow).
  const handleCompleteNow = () => {
    if (!activeSession?.appt) return;
    const appt = activeSession.appt;
    Alert.alert('Complete Appointment', `Mark ${appt.name}'s consultation as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          setActionBusy(true);
          try {
            await patchAppointment(appt, getStatusUpdatePayload(appt, 'completed'));
            setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
            setActiveSession(null);
            setActiveTab('Completed');
            await fetchAppointments({ silent: true });
          } catch (err) {
            showError(err, 'Appointment could not be completed.');
          } finally {
            setActionBusy(false);
          }
        },
      },
    ]);
  };

  // "Checked" / "Continue" — open the form (web handleChecked → CompleteModal).
  const handleChecked = () => {
    if (!activeSession?.appt) return;
    setCompleteAppointmentVisible(true);
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
    // In-clinic / walk-in visits send only timing + follow-up: no clinical
    // fields, so nothing empty overwrites what was recorded elsewhere.
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
      Alert.alert('Appointment completed', `${appt.name}'s consultation has been saved.`);
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
      setCompleted((prev) => prev.map((a) => (a.id === editingAppointment.id ? { ...a, ...formData } : a)));
      setEditingAppointment(null);
    } catch (err) {
      showError(err, 'Appointment could not be updated.');
    }
  };

  // Web: navigate('/patient-sms', { callTargetId, autoStartCallType }).
  // Video / Voice Call: rings the patient straight from the dashboard — no chat
  // screen. Once the call is placed the consultation starts too, so it shows
  // under "Currently With" (Checked / Complete) when the call ends. If the
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
  // Today's pending appointments stay queued even after their slot time has
  // passed, until the doctor acts on them.
  // Every queue tab is in token order (lowest token first), so the first
  // Pending card — and the Next Patient card — is the next token to call.
  const pendingAppointments = useMemo(
    () => sortByToken(appointments.filter((appt) => appt.status === 'pending')),
    [appointments],
  );
  const inProgressAppointments = useMemo(() => [
    // The patient currently being seen stays on top.
    ...(activeAppt ? [activeAppt] : []),
    ...sortByToken(appointments.filter((appt) => ['confirmed', 'in-progress'].includes(appt.status) && appt.id !== activeAppt?.id)),
  ], [appointments, activeAppt]);
  const completedQueue = useMemo(() => sortByToken(completed), [completed]);
  const visibleQueue = activeTab === 'Completed'
    ? completedQueue
    : activeTab === 'In Progress' ? inProgressAppointments : pendingAppointments;
  const nextPatient = activeAppt || pendingAppointments[0] || appointments[0] || null;
  const totalToday = appointments.length + completed.length;
  const averageConsultMin = completed.length
    ? Math.max(1, Math.round(completed.reduce((sum, appt) => sum + (appt.durationMs || 0), 0) / completed.length / 60000))
    : 15;
  const overview = [
    { title: "Today's\nAppointments", value: String(totalToday || appointments.length), icon: 'calendar' },
    { title: 'Pending\nConsultations', value: String(pendingAppointments.length), icon: 'hourglass' },
    { title: 'Completed\nToday', value: String(completed.length), icon: 'check', neutral: true },
    { title: 'Avg. Consult\nTime', value: String(averageConsultMin), suffix: 'min', icon: 'timer' },
  ];
  const tabCounts = {
    Pending: pendingAppointments.length,
    'In Progress': inProgressAppointments.length,
    Completed: completed.length,
  };

  // Android back, one step at a time: overlays first, then the open screen's
  // own inner pages (via useDoctorBack), then back to wherever this screen was
  // opened from, and only from Home does it leave the app.
  const backRegistry = useDoctorBackRegistry();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingAppointment) { setEditingAppointment(null); return true; }
      if (completeAppointmentVisible) { setCompleteAppointmentVisible(false); return true; }
      if (consentModalVisible) { setConsentModalVisible(false); return true; }
      if (breakModalVisible) { setBreakModalVisible(false); return true; }
      if (sidebarVisible) { setSidebarVisible(false); return true; }
      if (backRegistry.handle()) return true;
      if (activeScreen === 'dashboard') return false;
      if (activeScreen === 'patientDetail') setActiveScreen(patientDetailOrigin);
      else if (activeScreen === 'visitDetail') setActiveScreen('patientDetail');
      else if (activeScreen === 'notifications') setActiveScreen(notificationsOrigin || 'dashboard');
      else if (activeScreen === 'profileQr') setActiveScreen(qrOrigin || 'dashboard');
      else setActiveScreen('dashboard');
      return true;
    });
    return () => subscription.remove();
  }, [activeScreen, backRegistry, breakModalVisible, completeAppointmentVisible, consentModalVisible, editingAppointment, notificationsOrigin, patientDetailOrigin, qrOrigin, sidebarVisible]);

  const sidebarActiveItem = screenSidebarItems[activeScreen] ?? null;
  const openNotifications = () => {
    setNotificationsOrigin(activeScreen);
    setActiveScreen('notifications');
  };

  const handleSidebarNavigate = (item) => {
    const nextScreen = sidebarRoutes[item];
    if (nextScreen) {
      if (nextScreen === 'profileQr') setQrOrigin('dashboard');
      setActiveScreen(nextScreen);
      setTimeout(() => setSidebarVisible(false), 120);
      return;
    }
    Alert.alert('Settings', 'Doctor settings are coming soon.');
  };

  // Header/sidebar's profile avatar opens the doctor profile; the QR card is
  // reached from the sidebar "QR Code" item or the profile's "Open Card" pill.
  const onProfilePress = () => setActiveScreen('profile');

  const openQrCard = (origin = 'dashboard') => {
    setQrOrigin(origin);
    setActiveScreen('profileQr');
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
      todayTotal={totalToday}
      todayCompleted={completed.length}
      onViewSchedule={() => {
        setActiveScreen('appointments');
        setTimeout(() => setSidebarVisible(false), 120);
      }}
      onLogout={confirmLogout}
    />
  );

  const renderScreen = () => {
    if (activeScreen === 'walkIn') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <WalkInAppointmentsScreen onBack={() => setActiveScreen('dashboard')} />
        </SafeAreaView>
      );
    }
    if (activeScreen === 'settings') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorSettingsScreen
            onBack={() => setActiveScreen('dashboard')}
            onOpenCard={() => openQrCard('settings')}
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
            onBack={() => setActiveScreen(patientDetailOrigin)}
            onVisitPress={(record) => { setSelectedRecord(record); setActiveScreen('visitDetail'); }}
          />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'visitDetail' && selectedListPatient && selectedRecord) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <VisitDetailScreen patient={selectedListPatient} record={selectedRecord} onBack={() => setActiveScreen('patientDetail')} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'patients') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => setActiveScreen('settings')} />
          <PatientsScreen onPatientPress={(patient) => { setSelectedListPatient(patient); setPatientDetailOrigin('patients'); setActiveScreen('patientDetail'); }} />
          <DoctorBottomNavigation
            active="Patients"
            onChange={(label) => {
              if (label === 'Home') setActiveScreen('dashboard');
              if (label === 'Calendar') setActiveScreen('calendar');
              if (label === 'Staff') setActiveScreen('staffManagement');
            }}
          />
          {renderSidebar()}
        </SafeAreaView>
      );
    }

    if (activeScreen === 'calendar') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => setActiveScreen('settings')} />
          <CalendarAvailabilityScreen />
          <DoctorBottomNavigation
            active="Calendar"
            onChange={(label) => {
              if (label === 'Home') setActiveScreen('dashboard');
              if (label === 'Patients') setActiveScreen('patients');
              if (label === 'Staff') setActiveScreen('staffManagement');
            }}
          />
          {renderSidebar()}
        </SafeAreaView>
      );
    }

    if (activeScreen === 'appointments') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <AppointmentsListScreen onBack={() => setActiveScreen('dashboard')} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'profile') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorProfileScreen onBack={() => setActiveScreen('dashboard')} onOpenCard={() => openQrCard('profile')} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'profileQr') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <DoctorProfileQrScreen onBack={() => setActiveScreen(qrOrigin)} />
          {renderSidebar()}
        </SafeAreaView>
      );
    }

    if (activeScreen === 'clinic') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ClinicPageScreen onBack={() => setActiveScreen('dashboard')} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'followUps') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <FollowUpsScreen onBack={() => setActiveScreen('dashboard')} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'notifications') {
      return (
        <SafeAreaView style={styles.safeArea}>
          <NotificationsScreen onBack={() => setActiveScreen(notificationsOrigin)} />
        </SafeAreaView>
      );
    }

    if (activeScreen === 'staffManagement') {
      const staffSubscreenOpen = isCreateStaffOpen || isStaffProfileOpen;
      return (
        <SafeAreaView style={styles.safeArea}>
          {!staffSubscreenOpen && <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => setActiveScreen('settings')} />}
          <StaffManagementScreen onCreateStaffOpenChange={setIsCreateStaffOpen} onStaffProfileOpenChange={setIsStaffProfileOpen} />
          {!staffSubscreenOpen && (
            <DoctorBottomNavigation
              active="Staff"
              onChange={(label) => {
                if (label === 'Home') setActiveScreen('dashboard');
                if (label === 'Calendar') setActiveScreen('calendar');
                if (label === 'Patients') setActiveScreen('patients');
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
          <View style={styles.sectionHeader}>
            <Text style={styles.eyebrow}>OVERVIEW</Text>
            <Pressable onPress={() => setBreakModalVisible(true)} style={styles.breakButton}>
              <AppIcon name="coffee" size={15} strokeWidth={1.8} color="#52617A" />
              <Text style={styles.breakText}>Take Break</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {overview.map((item) => (
              <OverviewCard
                key={item.title}
                {...item}
                onPress={item.title.startsWith("Today's") ? () => setActiveScreen('appointments') : undefined}
              />
            ))}
          </View>

          <NextPatientCard
            patient={nextPatient}
            isActive={Boolean(activeAppt) && nextPatient?.id === activeAppt?.id}
            onBreak={onBreak}
            onStartConsultation={handleConsentClick}
            onContinue={handleChecked}
            onCall={handleCall}
          />

          {activeSession?.appt && (
            <ActiveConsultationCard
              session={activeSession}
              busy={actionBusy}
              onPause={handlePause}
              onChecked={handleChecked}
              onComplete={handleCompleteNow}
            />
          )}

          <Text style={styles.heading}>Today's Appointment Queue</Text>
          <QueueTabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />

          {visibleQueue.length === 0 ? (
            <View style={styles.empty}>
              <AppIcon name="calendar" size={26} strokeWidth={1.6} color={colors.muted} />
              <Text style={styles.emptyText}>No appointments in this queue</Text>
            </View>
          ) : (
            visibleQueue.map((item, index) => (
              <AppointmentCard
                key={`${activeTab}-${item.id}`}
                item={item}
                isActive={activeAppt?.id === item.id}
                highlight={index === 0}
                primary={index === 0 && activeTab === 'Pending'}
                sessionBusy={Boolean(activeSession?.appt)}
                onBreak={onBreak}
                onStartConsultation={handleConsentClick}
                onContinue={handleChecked}
                onView={(appt) => setEditingAppointment(appt)}
                onCall={handleCall}
              />
            ))
          )}
        </ScrollView>
      );
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} onNotificationsPress={openNotifications} onSettingsPress={() => setActiveScreen('settings')} />
        {renderHomeBody()}

        <BreakModal visible={breakModalVisible} onClose={() => setBreakModalVisible(false)} onStartBreak={handleStartBreak} />
        <PatientConsentModal
          visible={consentModalVisible}
          onClose={() => setConsentModalVisible(false)}
          onStartConsultation={handleStartConsultation}
          patient={selectedPatient}
          starting={actionBusy}
        />

        {completeAppointmentVisible && activeSession?.appt && (
          <View style={styles.completeAppointmentOverlay}>
            <CompleteAppointmentScreen
              patient={activeSession.appt}
              onCancel={() => setCompleteAppointmentVisible(false)}
              onSave={saveCompleteForm}
            />
          </View>
        )}
        {editingAppointment && (
          <View style={styles.completeAppointmentOverlay}>
            <EditCompletedAppointmentScreen
              appointment={editingAppointment}
              onCancel={() => setEditingAppointment(null)}
              onSave={saveEditedAppointment}
            />
          </View>
        )}
        <DoctorBottomNavigation
          active="Home"
          onChange={(label) => {
            if (label === 'Patients') setActiveScreen('patients');
            if (label === 'Calendar') setActiveScreen('calendar');
            if (label === 'Staff') setActiveScreen('staffManagement');
          }}
        />
        {renderSidebar()}
      </SafeAreaView>
    );
  };

  return (
    <DoctorBackContext.Provider value={backRegistry}>
      {renderScreen()}
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
  content: { paddingHorizontal: 12, paddingTop: 13, paddingBottom: 18 },
  sectionHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  breakButton: { height: 28, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface },
  breakText: { ...typography.caption, fontSize: 15, color: colors.ink },
  eyebrow: { ...typography.title, fontSize: 17, color: '#3C4759', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  heading: { ...typography.subtitle, fontSize: 18, color: colors.ink, marginBottom: 10 },
  empty: { height: 140, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { ...typography.body, fontSize: 15, color: colors.muted, textAlign: 'center' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorTitle: { ...typography.subtitle, fontSize: 17, color: colors.red },
  retryButton: { marginTop: 6, paddingHorizontal: 22, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...typography.button, fontSize: 14, color: colors.red },
});
