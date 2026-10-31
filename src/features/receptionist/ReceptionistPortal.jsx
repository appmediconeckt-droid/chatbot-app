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
import { assignedClinicId, indiaToday, patientKey, profilePhotoOf } from './receptionistUtils';
import { DoctorSection, LiveQueueSection, OverviewSection, ProfileSection } from './sections/DashboardSections';
import AppointmentsSection from './sections/AppointmentsSection';
import PatientsSection from './sections/PatientsSection';
import LedDisplaySection from './sections/LedDisplaySection';
import SettingsSection from './sections/SettingsSection';
import { ReceptionistVitalsProvider } from './ReceptionistVitalsContext';
import useBookingAlerts from './hooks/useBookingAlerts';
import { readScreenCache, writeScreenCache } from '../../utils/screenCache';
import humaeliIcon from '../../image/HumaeliIcon.png';
import LanguageSelector from '../../components/common/LanguageSelector';
import { LANGUAGES, loadUserLanguage } from '../../i18n';
import { useLanguageContext } from '../../contexts/LanguageContext';

// `tab`: shown in the bottom bar (the everyday sections); the rest stay
// in the side menu.
const MENU = [
  { key: 'dashboard', title: 'Dashboard', tab: 'Home', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'appointments', title: 'Appointments', tab: 'Appointments', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'live-queue', title: 'Live Queue', icon: 'list-outline', activeIcon: 'list' },
  { key: 'led-display', title: 'LED Display', icon: 'tv-outline', activeIcon: 'tv' },
  { key: 'patients', title: 'Patients & Prescriptions', tab: 'Patients', icon: 'people-outline', activeIcon: 'people' },
  { key: 'doctor', title: 'Doctor & Clinics', tab: 'Doctor', icon: 'medkit-outline', activeIcon: 'medkit' },
  { key: 'profile', title: 'My Profile', icon: 'person-outline' },
  { key: 'settings', title: 'Settings', icon: 'settings-outline' },
];
const POLL_MS = 10000;

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
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const [editingVitals, setEditingVitals] = useState(false);

  // The account (fresh from the server; the stored copy shows meanwhile).
  // Read again on pull-to-refresh and whenever Profile / Settings opens, so a
  // clinic, shift or timing the doctor changed shows without signing in again.
  const accountScreenOpen = section === 'profile' || section === 'settings';
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (cancelled || !user) return;
        setProfile((current) => ({ ...(current || {}), ...user }));
        setClinic(assignedClinicId(user));
      })
      .catch((err) => { if (!cancelled && !initialProfile) setAccountError(apiError(err, 'Your account could not be loaded.')); });
    return () => { cancelled = true; };
  }, [initialProfile, refresh, accountScreenOpen]);

  // Today's saved copy of the feed shows at once (WhatsApp-style); the first
  // live read below replaces it. Marked so booking alerts ignore it.
  useEffect(() => {
    readScreenCache('receptionist-dashboard', { sameDay: true }).then((cached) => {
      if (!cached || typeof cached !== 'object') return;
      setData((current) => current || { ...cached, __fromCache: true });
      if (Array.isArray(cached.clinics)) setClinics((current) => (current.length ? current : cached.clinics));
    });
  }, []);

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
      try {
        const result = await fetchReceptionistDashboard({ date: indiaToday(), clinicId: clinic });
        if (cancelled) return;
        setData(result);
        writeScreenCache('receptionist-dashboard', result);
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
          timer = setTimeout(load, POLL_MS);
        }
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [profile, clinic, refresh]);

  // Phone notification for every new booking / walk-in that reaches the feed.
  useBookingAlerts(data, clinic);

  // Language: chosen from the side menu and kept per receptionist account
  // (same storage as the doctor / patient dashboards), re-applied on open.
  const receptionistId = String(profile?._id || profile?.id || '');
  const { language: appLanguage } = useLanguageContext();
  const currentLanguageName = LANGUAGES.find((lang) => lang.code === appLanguage)?.name || 'English';
  useEffect(() => {
    if (receptionistId) loadUserLanguage(receptionistId, 'receptionist').catch(() => {});
  }, [receptionistId]);

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
  // The clinic / doctor names saved on the account can be out of date after
  // the doctor moves the receptionist; the live feed's clinic list is current.
  const accountProfile = useMemo(() => {
    if (!profile) return profile;
    const ownClinicId = assignedClinicId(profile);
    const liveClinic = clinics.find((row) => String(row._id || row.id) === String(clinic))
      || clinics.find((row) => String(row._id || row.id) === ownClinicId);
    return {
      ...profile,
      clinic_name: liveClinic?.clinic_name || profile.clinic_name,
      assignedDoctorName: doctorName || profile.assignedDoctorName,
    };
  }, [profile, clinics, clinic, doctorName]);

  const renderSection = () => {
    if (!profile) return null;
    const common = { profile, data, clinics, clinic, error, onView: viewPatient, onNavigate: navigateTo };
    switch (section) {
      case 'appointments': return <AppointmentsSection clinicId={clinic} canCancel refreshKey={refresh} />;
      case 'live-queue': return <LiveQueueSection {...common} />;
      case 'led-display': return <LedDisplaySection profile={profile} clinic={clinic} onNavigate={navigateTo} />;
      case 'patients': return <PatientsSection refreshKey={refresh} />;
      case 'doctor': return <DoctorSection {...common} />;
      case 'profile': return <ProfileSection profile={accountProfile} onProfileUpdated={applyProfileUpdate} />;
      case 'settings':
        return (
          <SettingsSection
            profile={accountProfile}
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
        {/* No clinic / refresh bar: the receptionist has one assigned clinic,
            and the data refreshes by itself (every 10–15s) and on pull-down. */}
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
            <View style={s.drawerHeader}>
              <View style={s.brandMark}>
                <Image source={humaeliIcon} style={s.brandLogo} resizeMode="contain" />
              </View>
              <View style={s.flex}>
                <View style={s.brandNameRow}>
                  <Text translate={false} style={s.drawerTitle}>Humaeli</Text>
                  <View style={s.portalBadge}><Text style={s.portalBadgeText}>PORTAL</Text></View>
                </View>
                <Text style={s.drawerSubtitle}>Receptionist workspace</Text>
              </View>
              <Pressable onPress={() => setMenuOpen(false)} style={s.iconButton} hitSlop={8} accessibilityLabel="Close navigation">
                <Ionicons name="close" size={20} color={REC.ink} />
              </Pressable>
            </View>
            <ScrollView style={s.flex} contentContainerStyle={s.navContent} showsVerticalScrollIndicator={false}>
              {[
                { label: 'OPERATIONS', items: MENU.filter((item) => !item.tab && !['profile', 'settings'].includes(item.key)) },
                { label: 'ACCOUNT', items: MENU.slice(6) },
              ].map((group) => (
                <View key={group.label} style={s.navGroup}>
                  <Text style={s.navLabel}>{group.label}</Text>
                  {group.items.map((item) => {
                    const active = item.key === section;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => navigateTo(item.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => [s.navItem, active && s.navItemActive, pressed && s.navItemPressed]}
                      >
                        {active && <View style={s.activeRail} />}
                        <View style={[s.navIcon, active && s.navIconActive]}>
                          <Ionicons name={active ? (item.activeIcon || item.icon) : item.icon} size={18} color={active ? REC.primary : '#667786'} />
                        </View>
                        <Text style={[s.navText, active && s.navTextActive]} numberOfLines={1}>{item.title}</Text>
                        {active && <Ionicons name="chevron-forward" size={15} color={REC.primary} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={s.drawerFooter}>
              <LanguageSelector
                userId={receptionistId || null}
                role="receptionist"
                brand={REC.primary}
                triggerStyle={s.languageItem}
              >
                <View style={s.languageIcon}>
                  <Ionicons name="globe-outline" size={17} color={REC.primary} />
                </View>
                <Text style={s.navText}>Language</Text>
                <Text translate={false} style={s.languageValue} numberOfLines={1}>{currentLanguageName}</Text>
                <Ionicons name="chevron-forward" size={15} color="#98A2B3" />
              </LanguageSelector>
              <View style={s.accessNote}>
                <View style={s.accessIcon}><Ionicons name="shield-checkmark" size={14} color={REC.primary} /></View>
                <Text style={s.accessText}>Securely connected to your assigned doctor</Text>
              </View>
              <Pressable onPress={() => { setMenuOpen(false); onLogout(); }} disabled={loggingOut} style={({ pressed }) => [s.logout, pressed && s.logoutPressed]}>
                <View style={s.logoutIcon}><Ionicons name="log-out-outline" size={17} color="#B42318" /></View>
                <Text style={s.logoutText}>{loggingOut ? 'Logging out...' : 'Logout'}</Text>
              </Pressable>
            </View>
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
  content: { paddingTop: 12, paddingBottom: 24 },
  contextHint: { fontSize: 11.5, color: REC.muted, textAlign: 'center' },
  loadingAccount: { paddingVertical: 30 },
  bottomBar: { flexDirection: 'row', justifyContent: 'center', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDE1E8', paddingTop: 7 },
  bottomItem: { flex: 1, maxWidth: 200, alignItems: 'center', minHeight: 52 },
  bottomIconWrap: { width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bottomLabel: { fontSize: 11.5, lineHeight: 15, marginTop: 2, color: '#747B87', textAlign: 'center', width: '100%' },
  bottomLabelActive: { color: REC.primary, fontWeight: '700' },
  drawerRoot: { flex: 1, flexDirection: 'row' },
  drawer: { width: '84%', maxWidth: 336, backgroundColor: '#FFFFFF', paddingHorizontal: 18, borderTopRightRadius: 22, borderBottomRightRadius: 22, overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: 'rgba(18,35,52,0.58)' },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#EEF2F4' },
  brandMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F5F0', borderWidth: 1, borderColor: '#D4EAE3', alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 35, height: 35 },
  brandNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  drawerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.35, color: REC.primary },
  drawerSubtitle: { fontSize: 10.5, fontWeight: '600', color: REC.muted, marginTop: 2 },
  portalBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: '#EAF5F1' },
  portalBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, color: REC.primary },
  navContent: { paddingVertical: 14 },
  navGroup: { marginBottom: 8 },
  navLabel: { fontSize: 9.5, letterSpacing: 1.5, fontWeight: '800', color: '#98A2B3', marginTop: 5, marginBottom: 7, marginLeft: 10 },
  navItem: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 9, height: 48, borderRadius: 12, marginBottom: 3, overflow: 'hidden' },
  navItemActive: { backgroundColor: '#EAF5F1', borderWidth: 1, borderColor: '#D5EAE3' },
  navItemPressed: { opacity: 0.72 },
  activeRail: { position: 'absolute', left: 0, width: 3, height: 24, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: REC.primary },
  navIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F2F5F6', alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: '#D7ECE5' },
  navText: { flex: 1, fontSize: 13.5, fontWeight: '500', color: '#465668' },
  navTextActive: { color: REC.primaryDark, fontWeight: '800' },
  drawerFooter: { paddingTop: 11, borderTopWidth: 1, borderTopColor: '#EEF2F4' },
  languageItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, height: 44, borderRadius: 11, borderWidth: 1, borderColor: REC.line, backgroundColor: '#FFFFFF' },
  languageIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  languageValue: { maxWidth: 76, textAlign: 'right', fontSize: 12, fontWeight: '700', color: REC.primary },
  accessNote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 9 },
  accessIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  accessText: { flex: 1, fontSize: 10.5, lineHeight: 14, color: REC.muted },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: '#F1D5D2', backgroundColor: '#FFF8F7' },
  logoutPressed: { opacity: 0.7 },
  logoutIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#FCE9E7', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 13.5, fontWeight: '700', color: '#B42318' },
});
