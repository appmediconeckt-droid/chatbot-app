// Receptionist portal — the web portal (chatbot/src/Component/Receptionist/
// ReceptionistLayout.jsx + pages) for a receptionist signed in on the app.
// The layout keeps the receptionist's account and the shared dashboard feed
// (GET /api/staff/receptionist/dashboard, every 10s for the assigned clinic);
// each menu entry is one section of the same screen.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, BackHandler, Image, Modal, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../components/TranslatedText';
import { AlertBox, Avatar, PatientDetailsSheet, REC } from './receptionistUi';
import { apiError, fetchMe, fetchReceptionistDashboard } from './receptionistApi';
import { assignedClinicId, clinicName, displayTime, indiaToday, patientKey, profilePhotoOf } from './receptionistUtils';
import { DoctorSection, LiveQueueSection, OverviewSection, ProfileSection } from './sections/DashboardSections';
import AppointmentsSection from './sections/AppointmentsSection';
import PatientsSection from './sections/PatientsSection';
import LedDisplaySection from './sections/LedDisplaySection';
import SettingsSection from './sections/SettingsSection';
import { ReceptionistVitalsProvider } from './ReceptionistVitalsContext';
import useBookingAlerts from './hooks/useBookingAlerts';
import humaeliIcon from '../../image/HumaeliIcon.png';

// `tab`: shown in the bottom bar (the everyday sections); the rest stay
// in the side menu.
const MENU = [
  { key: 'dashboard', title: 'Dashboard', tab: 'Home', icon: 'grid-outline', activeIcon: 'grid', description: 'Your front desk at a glance' },
  { key: 'appointments', title: 'Appointments', tab: 'Appointments', icon: 'calendar-outline', activeIcon: 'calendar', description: 'Manage your view of online and walk-in bookings' },
  { key: 'live-queue', title: 'Live Queue', icon: 'list-outline', activeIcon: 'list', description: "Follow the doctor's current checkups and waiting patients" },
  { key: 'led-display', title: 'LED Display', icon: 'tv-outline', activeIcon: 'tv', description: "Launch your doctor's live token screen on an LED or TV" },
  { key: 'patients', title: 'Patients & Prescriptions', tab: 'Patients', icon: 'document-text-outline', activeIcon: 'document-text', description: 'Doctor-wise completed checkups and prescribed treatment' },
  { key: 'doctor', title: 'Doctor & Clinics', tab: 'Doctor', icon: 'medkit-outline', activeIcon: 'medkit', description: 'Assigned doctor and clinic contact information' },
  { key: 'profile', title: 'My Profile', icon: 'person-outline', description: 'Your account and staff assignment' },
  { key: 'settings', title: 'Settings', icon: 'settings-outline', description: 'Keep your account secure' },
];
const POLL_MS = 10000;
const preferenceKey = (profile) => `receptionist-preferences:${profile?._id || profile?.id || profile?.email || ''}`;

export default function ReceptionistPortal({ initialProfile, onLogout, loggingOut, onPasswordChanged }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(initialProfile || null);
  const [accountError, setAccountError] = useState('');
  const [section, setSection] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [clinic, setClinic] = useState(() => assignedClinicId(initialProfile));
  const [clinics, setClinics] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const [editingVitals, setEditingVitals] = useState(false);
  const [preferences, setPreferences] = useState({ compactTables: false });

  // The account (fresh from the server; the stored copy shows meanwhile).
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (cancelled || !user) return;
        setProfile((current) => ({ ...(current || {}), ...user }));
        setClinic(assignedClinicId(user));
        AsyncStorage.getItem(preferenceKey(user))
          .then((raw) => {
            const stored = JSON.parse(raw || '{}') || {};
            if (!cancelled) setPreferences({ compactTables: stored.compactTables === true });
          })
          .catch(() => {});
      })
      .catch((err) => { if (!cancelled && !initialProfile) setAccountError(apiError(err, 'Your account could not be loaded.')); });
    return () => { cancelled = true; };
  }, [initialProfile]);

  // The shared dashboard feed, re-read every 10s while the app is open.
  useEffect(() => {
    if (!profile) return undefined;
    let cancelled = false;
    let timer;
    const load = async () => {
      if (AppState.currentState !== 'active') {
        timer = setTimeout(load, POLL_MS);
        return;
      }
      setRefreshing(true);
      try {
        const result = await fetchReceptionistDashboard({ date: indiaToday(), clinicId: clinic });
        if (cancelled) return;
        setData(result);
        const rows = result?.clinics || [];
        setClinics(rows);
        setError('');
        const assigned = String(rows[0]?._id || rows[0]?.id || '');
        if (assigned && clinic !== assigned) setClinic(assigned);
      } catch (err) {
        if (cancelled) return;
        setError(apiError(err, 'Unable to refresh data. Showing the last successful update, if available.'));
        if ([401, 403, 404].includes(err?.response?.status)) setData(null);
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          timer = setTimeout(load, POLL_MS);
        }
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [profile, clinic, refresh]);

  // Phone notification for every new booking / walk-in that reaches the feed.
  useBookingAlerts(data, clinic);

  // Hardware back: close the menu, then return to the dashboard.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuOpen) { setMenuOpen(false); return true; }
      if (section !== 'dashboard') { setSection('dashboard'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [menuOpen, section]);

  const navigateTo = useCallback((key) => {
    setSection(key);
    setMenuOpen(false);
  }, []);

  // After Edit profile: show the new name / phone / photo everywhere (header,
  // sidebar, profile) and keep the stored account in step for the next launch.
  const applyProfileUpdate = useCallback((changes) => {
    setProfile((current) => ({ ...(current || {}), ...changes }));
    AsyncStorage.getItem('userData')
      .then((raw) => {
        const stored = JSON.parse(raw || '{}') || {};
        return AsyncStorage.setItem('userData', JSON.stringify({ ...stored, ...changes }));
      })
      .catch(() => {});
  }, []);

  const savePreferences = (next) => {
    setPreferences(next);
    AsyncStorage.setItem(preferenceKey(profile), JSON.stringify(next)).catch(() => {});
  };

  const page = MENU.find((item) => item.key === section) || MENU[0];
  const selectedPatient = useMemo(
    () => (selected ? data?.appointments?.find((row) => patientKey(row) === patientKey(selected)) || selected : null),
    [data, selected],
  );
  // Retain the opened appointment if a live refresh no longer includes it.
  const viewPatient = (row, options = {}) => {
    setEditingVitals(options.editVitals === true);
    setSelected(row);
  };
  const doctorName = data?.doctor?.fullName || data?.doctor?.name;

  const renderSection = () => {
    if (!profile) return null;
    const common = { profile, data, clinics, clinic, error, onView: viewPatient, onNavigate: navigateTo, compact: preferences.compactTables };
    switch (section) {
      case 'appointments': return <AppointmentsSection clinicId={clinic} canCancel compact={preferences.compactTables} />;
      case 'live-queue': return <LiveQueueSection {...common} />;
      case 'led-display': return <LedDisplaySection profile={profile} clinic={clinic} onNavigate={navigateTo} />;
      case 'patients': return <PatientsSection />;
      case 'doctor': return <DoctorSection {...common} />;
      case 'profile': return <ProfileSection profile={profile} onProfileUpdated={applyProfileUpdate} />;
      case 'settings':
        return (
          <SettingsSection
            profile={profile}
            preferences={preferences}
            onSavePreferences={savePreferences}
            onNavigate={navigateTo}
            onLogout={onLogout}
            loggingOut={loggingOut}
            onPasswordChanged={onPasswordChanged}
          />
        );
      default: return <OverviewSection {...common} />;
    }
  };

  return (
    <ReceptionistVitalsProvider><SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.topbar}>
        <Pressable onPress={() => setMenuOpen(true)} style={s.iconButton} hitSlop={8} accessibilityLabel="Open navigation">
          <Ionicons name="menu" size={22} color={REC.ink} />
        </Pressable>
        <View style={s.breadcrumb}>
          <Text style={s.breadcrumbStrong} numberOfLines={1}>Receptionist</Text>
        </View>
        <Pressable onPress={() => navigateTo('profile')} hitSlop={6}>
          <Avatar photo={profilePhotoOf(profile || {})} name={profile?.fullName} size={36} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefresh((value) => value + 1)} colors={[REC.primary]} />}
      >
        {!!profile && (
          <View style={s.statusBar}>
            <View style={s.clinicChip}>
              <Ionicons name="business" size={15} color={REC.primary} />
              <Text translate={false} style={s.clinicChipText} numberOfLines={1}>
                {clinic && clinics.length ? clinicName(clinics, clinic) : profile.clinic_name || 'Your clinic'}
              </Text>
            </View>
            <View style={s.sync}>
              <View style={[s.dot, error && s.dotWarning]} />
              <Text translate={false} style={s.syncText}>
                {refreshing ? 'Updating' : data ? displayTime(data.updatedAt) : 'Connecting'}
              </Text>
            </View>
            <Pressable
              onPress={() => setRefresh((value) => value + 1)}
              disabled={refreshing}
              style={({ pressed }) => [s.refreshButton, pressed && s.refreshButtonPressed]}
              hitSlop={6}
              accessibilityLabel="Refresh"
            >
              <Ionicons name="refresh" size={18} color={REC.primary} />
            </Pressable>
          </View>
        )}

        <AlertBox text={accountError} />
        {!!error && <AlertBox text={`${error}${data ? ' The displayed data may be out of date.' : ''}`} />}

        {profile ? renderSection() : !accountError && (
          <View style={s.loadingAccount}><Text style={s.contextHint}>Loading your receptionist account...</Text></View>
        )}
      </ScrollView>

      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        {MENU.filter((item) => item.tab).map((item) => {
          const active = item.key === section;
          return (
            <Pressable key={item.key} onPress={() => navigateTo(item.key)} style={s.bottomItem} accessibilityLabel={item.title}>
              <View style={s.bottomIconWrap}>
                <Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? REC.primary : '#747B87'} />
              </View>
              <Text style={[s.bottomLabel, active && s.bottomLabelActive]} numberOfLines={1}>{item.tab}</Text>
            </Pressable>
          );
        })}
      </View>

      <PatientDetailsSheet patient={selectedPatient} editVitals={editingVitals} clinics={clinics} doctorName={doctorName} onClose={() => setSelected(null)} />

      <Modal visible={menuOpen} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setMenuOpen(false)}>
        <View style={s.drawerRoot}>
          <View style={[s.drawer, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 16 }]}>
            <View style={s.brandRow}>
              <View style={s.brandMark}><Image source={humaeliIcon} style={s.brandLogo} resizeMode="contain" /></View>
              <View style={s.flex}>
                <Text style={s.brand}>Humaeli</Text>
                <Text style={s.brandSub}>RECEPTIONIST PORTAL</Text>
              </View>
              <Pressable onPress={() => setMenuOpen(false)} style={s.iconButton} hitSlop={8} accessibilityLabel="Close navigation">
                <Ionicons name="close" size={20} color={REC.ink} />
              </Pressable>
            </View>
            <View style={s.account}>
              <Avatar photo={profilePhotoOf(profile || {})} name={profile?.fullName} size={42} />
              <View style={s.flex}>
                <Text translate={false} style={s.accountName} numberOfLines={1}>{profile?.fullName || 'Receptionist'}</Text>
                <Text style={s.accountSub}>Front desk team</Text>
              </View>
            </View>
            <Text style={s.navLabel}>WORKSPACE</Text>
            <ScrollView style={s.flex} showsVerticalScrollIndicator={false}>
              {MENU.filter((item) => !item.tab).map((item) => {
                const active = item.key === section;
                return (
                  <Pressable key={item.key} onPress={() => navigateTo(item.key)} style={[s.navItem, active && s.navItemActive]}>
                    <Ionicons name={item.icon} size={19} color={active ? REC.softText : '#5B6B7B'} />
                    <Text style={[s.navText, active && s.navTextActive]}>{item.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={s.accessNote}>
              <Ionicons name="shield-checkmark-outline" size={18} color={REC.primary} />
              <Text style={s.accessText}>Connected to your <Text style={s.accessStrong}>assigned doctor</Text></Text>
            </View>
            <Pressable onPress={() => { setMenuOpen(false); onLogout(); }} disabled={loggingOut} style={s.logout}>
              <Ionicons name="log-out-outline" size={19} color="#B42318" />
              <Text style={s.logoutText}>{loggingOut ? 'Logging out...' : 'Logout'}</Text>
            </Pressable>
          </View>
          <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close navigation" />
        </View>
      </Modal>
    </SafeAreaView></ReceptionistVitalsProvider>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: REC.bg },
  topbar: { height: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: REC.line },
  iconButton: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5F7' },
  breadcrumb: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  breadcrumbStrong: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: REC.ink },
  content: { paddingBottom: 24 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginVertical: 12 },
  clinicChip: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line },
  clinicChipText: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: REC.ink },
  refreshButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line },
  refreshButtonPressed: { backgroundColor: REC.soft },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: REC.green },
  dotWarning: { backgroundColor: REC.amber },
  syncText: { fontSize: 12, color: '#4A8875' },
  contextHint: { fontSize: 11.5, color: REC.muted, textAlign: 'center' },
  loadingAccount: { paddingVertical: 30 },
  bottomBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDE1E8', paddingTop: 7 },
  bottomItem: { flex: 1, alignItems: 'center', minHeight: 52 },
  bottomIconWrap: { width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 11.5, lineHeight: 15, marginTop: 2, color: '#747B87', textAlign: 'center', width: '100%' },
  bottomLabelActive: { color: REC.primary, fontWeight: '700' },
  drawerRoot: { flex: 1, flexDirection: 'row' },
  drawer: { width: '80%', maxWidth: 320, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(32,50,72,0.5)' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E8F5F0', alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 34, height: 34 },
  brand: { fontSize: 22, fontWeight: '800', color: REC.primary },
  brandSub: { fontSize: 9, letterSpacing: 1.6, fontWeight: '700', color: REC.muted, marginTop: 2 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 22, padding: 12, borderRadius: 12, backgroundColor: '#F7FAF9', borderWidth: 1, borderColor: REC.line },
  accountName: { fontSize: 14.5, fontWeight: '700', color: REC.ink },
  accountSub: { fontSize: 11.5, color: REC.muted, marginTop: 2 },
  navLabel: { fontSize: 10, letterSpacing: 1.6, fontWeight: '700', color: '#98A2B3', marginTop: 22, marginBottom: 8, marginLeft: 6 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 46, borderRadius: 10, marginBottom: 2 },
  navItemActive: { backgroundColor: '#FFFFFF' },
  navText: { fontSize: 14, color: '#465668' },
  navTextActive: { color: REC.softText, fontWeight: '700' },
  accessNote: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: '#F4F8F7', marginTop: 10 },
  accessText: { flex: 1, fontSize: 12, color: '#718A82' },
  accessStrong: { fontWeight: '700', color: REC.ink },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 50, borderRadius: 12, marginTop: 10, backgroundColor: '#FFF8F7', borderWidth: 1, borderColor: '#F3D5D1' },
  logoutText: { fontSize: 14, fontWeight: '700', color: '#B42318' },
});
