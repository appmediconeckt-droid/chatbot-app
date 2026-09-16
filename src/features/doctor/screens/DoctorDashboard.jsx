// Ported from MediconecktApp's src/doctor/dashboard/screens/DoctorDashboardScreen.tsx
// — full port at the user's request, matching the reference app screen-for-screen.
// This REPLACES the earlier lightweight mock placeholder.
//
// Still frontend-only: there is no Doctor backend, so this reads/writes only
// the local mock session (AsyncStorage `doctorMockProfile`) and local mock
// data (features/doctor/dashboard/data/appointments.js). The one exception is
// CompleteAppointmentScreen, which persists a completed consultation to
// AsyncStorage under `doctor_consultations` — that's local device storage,
// not a backend call.
//
// Not ported: the source's VideoConsultationModal — it was dead code in the
// original file (defined but never rendered anywhere in the actual screen).
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DoctorHeader from '../dashboard/components/layout/DoctorHeader';
import DoctorBottomNavigation from '../dashboard/navigation/DoctorBottomNavigation';
import { colors } from '../dashboard/theme';
import AppIcon from '../dashboard/icons/AppIcon';
import AppointmentCard from '../dashboard/components/AppointmentCard';
import NextPatientCard from '../dashboard/components/NextPatientCard';
import CompleteAppointmentScreen from '../dashboard/components/CompleteAppointmentScreen';
import DoctorSidebar from '../dashboard/components/DoctorSidebar';
import WalkInAppointmentsScreen from '../dashboard/components/WalkInAppointmentsScreen';
import PatientsScreen from '../dashboard/components/PatientsScreen';
import PatientDetailScreen from '../dashboard/components/PatientDetailScreen';
import VisitDetailScreen from '../dashboard/components/VisitDetailScreen';
import PrescriptionScreen from '../dashboard/components/PrescriptionScreen';
import CalendarAvailabilityScreen from '../dashboard/components/CalendarAvailabilityScreen';
import AppointmentsListScreen from '../dashboard/components/AppointmentsListScreen';
import DoctorProfileQrScreen from '../dashboard/components/DoctorProfileQrScreen';
import FollowUpsScreen from '../dashboard/components/FollowUpsScreen';
import PatientCommunicationsScreen from '../dashboard/components/PatientCommunicationsScreen';
import { downloadPrescriptionPdf } from '../dashboard/utils/prescriptionPdf';
import OverviewCard from '../dashboard/components/OverviewCard';
import QueueTabs from '../dashboard/components/QueueTabs';
import { appointments } from '../dashboard/data/appointments';

const { width } = Dimensions.get('window');

const sidebarRoutes = {
  appointments: 'appointments',
  walkIn: 'walkIn',
  followUps: 'followUps',
  profileQr: 'profileQr',
  clinic: 'dashboard',
};

const screenSidebarItems = {
  dashboard: 'clinic',
  appointments: 'appointments',
  walkIn: 'walkIn',
  followUps: 'followUps',
  profileQr: 'profileQr',
};

const overview = [
  { title: "Today's\nAppointments", value: '3', icon: 'calendar' },
  { title: 'Pending\nConsultations', value: '3', icon: 'hourglass' },
  { title: 'Completed\nToday', value: '0', icon: 'check', neutral: true },
  { title: 'Avg. Consult\nTime', value: '15', suffix: 'min', icon: 'timer' },
];

const removeMinutesSuffix = (value) => (value ?? '').replace(' min', '');

// ------------------------------------------------------------------
// Patient Consent Form Modal
// ------------------------------------------------------------------
function PatientConsentModal({ visible, onClose, onStartConsultation, patient }) {
  const [agreements, setAgreements] = useState({ reviewed: true, tracking: true, responsibility: true });
  const toggleAgreement = (key) => setAgreements((prev) => ({ ...prev, [key]: !prev[key] }));
  const allChecked = agreements.reviewed && agreements.tracking && agreements.responsibility;
  if (!visible) return null;
  return (
    <View style={consentStyles.overlay}>
      <View style={consentStyles.content}>
        <View style={consentStyles.header}>
          <AppIcon name="calendar" size={17} color="#FFFFFF" strokeWidth={2} />
          <Text style={consentStyles.headerTitle}>Patient Consultation Form</Text>
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
              <Text style={consentStyles.infoValue}>{patient?.time ?? ''}</Text>
            </View>
          </View>
          <View style={[consentStyles.infoRow, consentStyles.fullWidth]}>
            <Text style={consentStyles.infoLabel}>Issue:</Text>
            <Text style={consentStyles.infoValue}>{patient?.complaint ?? ''}</Text>
          </View>
          <View style={[consentStyles.infoRow, consentStyles.fullWidth]}>
            <Text style={consentStyles.infoLabel}>Patient ID:</Text>
            <Text style={consentStyles.infoValue}>{patient?.id ?? ''}</Text>
          </View>

          <Text style={[consentStyles.sectionTitle, { marginTop: 16 }]}>Patient Vitals</Text>
          <View style={consentStyles.vitalsContainer}>
            <View style={consentStyles.vitalItem}>
              <Text style={consentStyles.vitalLabel}>Blood Pressure</Text>
              <Text style={consentStyles.vitalValue}>{patient?.bloodPressure ?? ''} mmHg</Text>
            </View>
            <View style={consentStyles.vitalItem}>
              <Text style={consentStyles.vitalLabel}>Blood Group</Text>
              <Text style={consentStyles.vitalValue}>{patient?.bloodGroup ?? ''}</Text>
            </View>
          </View>

          <Text style={[consentStyles.sectionTitle, { marginTop: 16 }]}>Agreement</Text>
          <View style={consentStyles.agreementBox}>
            {[
              ['reviewed', "I confirm that I have reviewed the patient's information and vitals."],
              ['tracking', 'I understand that starting will begin tracking consultation time.'],
              ['responsibility', 'I acknowledge my responsibility for providing appropriate medical care.'],
            ].map(([key, text]) => (
              <TouchableOpacity key={key} style={consentStyles.agreementItem} onPress={() => toggleAgreement(key)}>
                <View style={[consentStyles.checkbox, agreements[key] && consentStyles.checkboxChecked]}>
                  {agreements[key] && <Text style={consentStyles.checkmark}>✓</Text>}
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
          <TouchableOpacity
            style={[consentStyles.startButton, !allChecked && consentStyles.startButtonDisabled]}
            onPress={onStartConsultation}
            disabled={!allChecked}
          >
            <Text style={consentStyles.play}>▶</Text>
            <Text style={consentStyles.startButtonText}>Start{`\n`}Consultation</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const consentStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 58, right: 0, bottom: 65, left: 0, zIndex: 30 },
  content: { flex: 1, marginHorizontal: 4, backgroundColor: '#F7F8FA', borderRadius: 9, overflow: 'hidden' },
  header: { height: 51, paddingHorizontal: 12, backgroundColor: '#07BFBD', flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 16 },
  sectionTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#07BFBD', marginBottom: 12 },
  infoRow: { flex: 1, minHeight: 61, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 6, marginBottom: 9 },
  fullWidth: { width: '100%' },
  gridRow: { flexDirection: 'row', gap: 9 },
  infoLabel: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: '#596170', marginBottom: 3 },
  infoValue: { fontSize: 13, lineHeight: 18, color: '#252B35', fontWeight: '600' },
  vitalsContainer: { flexDirection: 'row', gap: 9 },
  vitalItem: { flex: 1, height: 75, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  vitalLabel: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: '#596170', marginBottom: 5 },
  vitalValue: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#252B35' },
  agreementBox: { backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#CCD4E1', borderRadius: 6, padding: 10, paddingBottom: 2 },
  agreementItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 9 },
  checkbox: { width: 17, height: 17, borderRadius: 3, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: '#00BEC6', borderColor: '#00BEC6' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  agreementText: { fontSize: 11, color: '#3C4759', flex: 1, lineHeight: 16 },
  buttonContainer: { height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D9DEE7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  cancelButton: { flex: 1, height: 43, borderRadius: 6, borderWidth: 1, borderColor: '#C9D1DD', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontSize: 13, fontWeight: '600', color: '#252B35' },
  startButton: { flex: 1, height: 43, borderRadius: 6, backgroundColor: '#07BFBD', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startButtonDisabled: { backgroundColor: '#8E9DB0' },
  startButtonText: { fontSize: 12, lineHeight: 14, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  play: { fontSize: 9, color: '#FFFFFF' },
});

// ------------------------------------------------------------------
// Break In Progress Modal
// ------------------------------------------------------------------
function BreakInProgressModal({ visible, onClose, onEndBreak }) {
  const [timer, setTimer] = useState('14:57');
  useEffect(() => {
    if (visible) {
      let minutes = 14;
      let seconds = 57;
      const interval = setInterval(() => {
        seconds--;
        if (seconds < 0) {
          minutes--;
          seconds = 59;
        }
        if (minutes < 0) {
          clearInterval(interval);
          return;
        }
        setTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={breakInProgressStyles.overlay}>
        <View style={breakInProgressStyles.content}>
          <TouchableOpacity style={breakInProgressStyles.closeButton} onPress={onClose}>
            <AppIcon name="x" size={24} color="#8E9DB0" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={breakInProgressStyles.title}>Break in Progress</Text>
          <Text style={breakInProgressStyles.subtitle}>Taking a moment to recharge.</Text>
          <View style={breakInProgressStyles.timerContainer}><Text style={breakInProgressStyles.timer}>{timer}</Text></View>
          <TouchableOpacity style={breakInProgressStyles.endButton} onPress={onEndBreak}>
            <Text style={breakInProgressStyles.endButtonText}>End Break</Text>
          </TouchableOpacity>
          <View style={breakInProgressStyles.upNextContainer}>
            <Text style={breakInProgressStyles.upNextLabel}>Up Next</Text>
            <Text style={breakInProgressStyles.upNextTime}>10:30 AM</Text>
          </View>
          <View style={breakInProgressStyles.patientContainer}>
            <Text style={breakInProgressStyles.patientName}>Priya Verma</Text>
            <Text style={breakInProgressStyles.patientDetails}>Routine Checkup • ID: 884-291</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const breakInProgressStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#FFFFFF', borderRadius: 24, width: width - 48, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  closeButton: { position: 'absolute', top: 16, right: 16, padding: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#00BEC6', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#8E9DB0', marginBottom: 24, textAlign: 'center' },
  timerContainer: { marginBottom: 24 },
  timer: { fontSize: 52, fontWeight: '700', color: '#3C4759', textAlign: 'center', letterSpacing: 2 },
  endButton: { backgroundColor: '#00BEC6', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 24 },
  endButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.3 },
  upNextContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginBottom: 10 },
  upNextLabel: { fontSize: 14, fontWeight: '600', color: '#3C4759' },
  upNextTime: { fontSize: 14, fontWeight: '600', color: '#00BEC6' },
  patientContainer: { width: '100%', alignItems: 'center' },
  patientName: { fontSize: 18, fontWeight: '700', color: '#3C4759', marginBottom: 2 },
  patientDetails: { fontSize: 14, color: '#8E9DB0' },
});

// ------------------------------------------------------------------
// Break Control Modal
// ------------------------------------------------------------------
function BreakModal({ visible, onClose, onStartBreak }) {
  const [selectedDuration, setSelectedDuration] = useState('15');
  const durations = ['10 min', '15 min', '30 min', 'Custom'];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <Text style={modalStyles.title}>Break Control</Text>
          <View style={modalStyles.statusContainer}>
            <View style={modalStyles.statusDot} />
            <Text style={modalStyles.statusText}>On Duty</Text>
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
          <TouchableOpacity style={modalStyles.startButton} onPress={() => onStartBreak(selectedDuration)}>
            <Text style={modalStyles.startButtonText}>Start Break</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
            <Text style={modalStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#FFFFFF', borderRadius: 24, width: width - 48, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A2B3C', marginBottom: 16, textAlign: 'center', letterSpacing: 0.5 },
  statusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  statusText: { fontSize: 14, color: '#3C4759', fontWeight: '500' },
  durationLabel: { fontSize: 12, fontWeight: '700', color: '#8E9DB0', letterSpacing: 0.8, marginBottom: 12, textAlign: 'center', alignSelf: 'flex-start', width: '100%' },
  durationGrid: { flexDirection: 'row', gap: 10, marginBottom: 24, width: '100%' },
  durationOption: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F5F7FA', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  durationOptionActive: { backgroundColor: '#00BEC6', borderColor: '#00BEC6' },
  durationText: { fontSize: 13, fontWeight: '600', color: '#3C4759' },
  durationTextActive: { color: '#FFFFFF' },
  startButton: { backgroundColor: '#00BEC6', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 8 },
  startButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.3 },
  cancelButton: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '500', color: '#3C4759' },
});

// ------------------------------------------------------------------
// MAIN SCREEN
// ------------------------------------------------------------------
export default function DoctorDashboard({ navigation }) {
  const [activeTab, setActiveTab] = useState('Pending');
  const [breakModalVisible, setBreakModalVisible] = useState(false);
  const [breakInProgressVisible, setBreakInProgressVisible] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [completeAppointmentVisible, setCompleteAppointmentVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [selectedListPatient, setSelectedListPatient] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (completeAppointmentVisible) { setCompleteAppointmentVisible(false); return true; }
      if (consentModalVisible) { setConsentModalVisible(false); return true; }
      if (breakInProgressVisible) { setBreakInProgressVisible(false); return true; }
      if (breakModalVisible) { setBreakModalVisible(false); return true; }
      if (sidebarVisible) { setSidebarVisible(false); return true; }
      if (activeScreen === 'dashboard') return false;
      if (activeScreen === 'patientDetail') setActiveScreen('patients');
      else if (activeScreen === 'visitDetail') setActiveScreen('patientDetail');
      else if (activeScreen === 'prescription') setActiveScreen('visitDetail');
      else setActiveScreen('dashboard');
      return true;
    });
    return () => subscription.remove();
  }, [activeScreen, breakInProgressVisible, breakModalVisible, completeAppointmentVisible, consentModalVisible, sidebarVisible]);

  const handleStartBreak = (duration) => {
    console.log(`Break started for ${duration} minutes`);
    setBreakModalVisible(false);
    setBreakInProgressVisible(true);
  };
  const handleEndBreak = () => {
    setBreakInProgressVisible(false);
  };
  const handleStartConsultation = () => {
    setConsentModalVisible(false);
    setCompleteAppointmentVisible(true);
  };
  const handleStartConsultationFromNextPatient = () => {
    const nextPatient = appointments[0];
    setSelectedPatient(nextPatient);
    setConsentModalVisible(true);
  };
  const handleStartConsultationFromCard = (patient) => {
    setSelectedPatient(patient);
    setConsentModalVisible(true);
  };

  const sidebarActiveItem = screenSidebarItems[activeScreen] ?? null;

  const handleSidebarNavigate = (item) => {
    const nextScreen = sidebarRoutes[item];
    if (nextScreen) {
      setActiveScreen(nextScreen);
      setTimeout(() => setSidebarVisible(false), 120);
      return;
    }
    Alert.alert('Settings', 'Doctor settings are coming soon.');
  };

  const renderSidebar = () => (
    <DoctorSidebar
      visible={sidebarVisible}
      activeItem={sidebarActiveItem}
      onClose={() => setSidebarVisible(false)}
      onNavigate={handleSidebarNavigate}
      onLogout={() =>
        Alert.alert('Logout Account', 'Are you sure you want to log out?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive' },
        ])
      }
    />
  );

  // Header/sidebar's "profile" avatar opens the ported QR screen (faithful to
  // the source); the fuller onboarding-collected profile stays reachable at
  // navigation.navigate('DoctorProfile').
  const onProfilePress = () => setActiveScreen('profileQr');

  if (activeScreen === 'walkIn') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <WalkInAppointmentsScreen onBack={() => setActiveScreen('dashboard')} onMenuPress={() => setSidebarVisible(true)} />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  if (activeScreen === 'patientDetail' && selectedListPatient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <PatientDetailScreen patient={selectedListPatient} onBack={() => setActiveScreen('patients')} onVisitPress={() => setActiveScreen('visitDetail')} />
      </SafeAreaView>
    );
  }

  if (activeScreen === 'visitDetail' && selectedListPatient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <VisitDetailScreen patient={selectedListPatient} onBack={() => setActiveScreen('patientDetail')} onDownload={() => void downloadPrescriptionPdf(selectedListPatient.name)} />
      </SafeAreaView>
    );
  }

  if (activeScreen === 'prescription' && selectedListPatient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <PrescriptionScreen patient={selectedListPatient} onBack={() => setActiveScreen('visitDetail')} />
      </SafeAreaView>
    );
  }

  if (activeScreen === 'patients') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} />
        <PatientsScreen onPatientPress={(patient) => { setSelectedListPatient(patient); setActiveScreen('patientDetail'); }} />
        <DoctorBottomNavigation
          active="Patients"
          onChange={(label) => {
            if (label === 'Home') setActiveScreen('dashboard');
            if (label === 'Calendar') setActiveScreen('calendar');
            if (label === 'Messages') setActiveScreen('messages');
          }}
        />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  if (activeScreen === 'calendar') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} />
        <CalendarAvailabilityScreen />
        <DoctorBottomNavigation
          active="Calendar"
          onChange={(label) => {
            if (label === 'Home') setActiveScreen('dashboard');
            if (label === 'Patients') setActiveScreen('patients');
            if (label === 'Messages') setActiveScreen('messages');
          }}
        />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  if (activeScreen === 'appointments') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppointmentsListScreen onBack={() => setActiveScreen('dashboard')} onMenuPress={() => setSidebarVisible(true)} />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  if (activeScreen === 'profileQr') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorProfileQrScreen onBack={() => setActiveScreen('dashboard')} onMenuPress={() => setSidebarVisible(true)} />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  if (activeScreen === 'followUps') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <FollowUpsScreen onBack={() => setActiveScreen('dashboard')} onMenuPress={() => setSidebarVisible(true)} />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  if (activeScreen === 'messages') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} />
        <PatientCommunicationsScreen />
        <DoctorBottomNavigation
          active="Messages"
          onChange={(label) => {
            if (label === 'Home') setActiveScreen('dashboard');
            if (label === 'Calendar') setActiveScreen('calendar');
            if (label === 'Patients') setActiveScreen('patients');
          }}
        />
        {renderSidebar()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <DoctorHeader onMenuPress={() => setSidebarVisible(true)} onProfilePress={onProfilePress} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>You have 3 appointments today. Next appointment at{`\n`}10:00 AM.</Text>
          <Pressable onPress={() => setBreakModalVisible(true)} style={styles.breakButton}>
            <AppIcon name="coffee" size={15} strokeWidth={1.8} color="#52617A" />
            <Text style={styles.breakText}>Take Break</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>OVERVIEW</Text>
        <View style={styles.grid}>
          {overview.map((item) => (
            <OverviewCard key={item.title} {...item} onPress={item.title.startsWith("Today's") ? () => setActiveScreen('appointments') : undefined} />
          ))}
        </View>

        <NextPatientCard patient={appointments[0]} onStartConsultation={handleStartConsultationFromNextPatient} />

        <Text style={styles.heading}>Today's Appointment Queue</Text>
        <QueueTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'Pending' ? (
          appointments.map((item) => <AppointmentCard item={item} key={item.id} onStartConsultation={handleStartConsultationFromCard} />)
        ) : (
          <View style={styles.empty}><Text style={styles.emptyText}>No {activeTab.toLowerCase()} appointments</Text></View>
        )}
      </ScrollView>

      <BreakModal visible={breakModalVisible} onClose={() => setBreakModalVisible(false)} onStartBreak={handleStartBreak} />
      <BreakInProgressModal visible={breakInProgressVisible} onClose={() => setBreakInProgressVisible(false)} onEndBreak={handleEndBreak} />
      <PatientConsentModal visible={consentModalVisible} onClose={() => setConsentModalVisible(false)} onStartConsultation={handleStartConsultation} patient={selectedPatient} />

      {completeAppointmentVisible && selectedPatient && (
        <View style={styles.completeAppointmentOverlay}>
          <CompleteAppointmentScreen
            patient={selectedPatient}
            onCancel={() => setCompleteAppointmentVisible(false)}
            onContinue={() => {
              setCompleteAppointmentVisible(false);
              setSelectedPatient(null);
              setActiveTab('Pending');
            }}
          />
        </View>
      )}
      <DoctorBottomNavigation
        active="Home"
        onChange={(label) => {
          if (label === 'Patients') setActiveScreen('patients');
          if (label === 'Calendar') setActiveScreen('calendar');
          if (label === 'Messages') setActiveScreen('messages');
        }}
      />
      {renderSidebar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  completeAppointmentOverlay: { position: 'absolute', top: 58, right: 0, bottom: 65, left: 0, zIndex: 20 },
  content: { paddingHorizontal: 12, paddingTop: 13, paddingBottom: 18 },
  summary: { height: 64, justifyContent: 'flex-start' },
  summaryText: { fontSize: 14, lineHeight: 16, color: colors.muted },
  breakButton: { position: 'absolute', right: 0, bottom: 0, height: 28, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface },
  breakText: { fontSize: 14, color: colors.ink },
  eyebrow: { fontSize: 16, fontWeight: '800', color: '#3C4759', letterSpacing: 0.4, marginTop: 7, marginBottom: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  empty: { height: 140, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.muted },
});
