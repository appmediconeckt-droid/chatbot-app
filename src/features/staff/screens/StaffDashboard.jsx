// Staff dashboard — where a clinic staff member (nurse, receptionist, lab
// technician, …) lands after signing in on the main Login page with the
// email + generated password the doctor shared when creating them
// (CreateStaffScreen). One screen for every staff role: the role, clinic and
// shift come from the logged-in user record (`userData`).
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../components/TranslatedText';
import AppIcon from '../../doctor/dashboard/icons/AppIcon';
import { colors, createDoctorStyles } from '../../doctor/dashboard/theme';
import { CLINICIAN_GRADIENT } from '../../../theme/palette';
import { isOnShiftNow, normalizeStaff, shiftInfo } from '../../doctor/dashboard/components/staffApi';
import axiosInstance from '../../../axiosConfig';
import socketService from '../../../services/socketService';
import { clearAccountLocalData } from '../../../utils/authSession';

// What each role looks after (same wording as the Create Staff role cards).
const ROLE_DUTIES = {
  nurse: ['Direct patient care & monitoring', 'Record vitals before consultation', 'Assist the doctor during procedures'],
  assistant: ['Clinical operations & support', 'Prepare patients for consultation', 'Keep patient records up to date'],
  technician: ['Collect lab samples', 'Run lab tests', 'Share reports with the doctor'],
  billing: ['Invoicing & payments', 'Insurance claims', 'Daily billing summary'],
  housekeeping: ['Facility cleanliness & hygiene', 'Room preparation between patients', 'Supplies & waste handling'],
  supervisor: ['Oversee departmental operations', 'Manage staff shifts', 'Escalate issues to the doctor'],
  receptionist: ['Greet and check in patients', 'Manage the walk-in queue', 'Book and reschedule appointments'],
  manager: ['Run the department', 'Staff planning', 'Reports for the doctor'],
};
const DEFAULT_DUTIES = ['Support the clinic team', 'Follow the doctor’s instructions', 'Keep your profile up to date'];

const readStoredUser = async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('userData')) || 'null') || {};
  } catch {
    return {};
  }
};

export default function StaffDashboard({ navigation }) {
  const [staff, setStaff] = useState(() => normalizeStaff({}));
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadStaff = useCallback(async () => {
    setStaff(normalizeStaff(await readStoredUser()));
    setNow(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadStaff();
    // Keep "On shift now" correct while the screen stays open.
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [loadStaff]);

  // Same flow as the doctor logout: tell the server, then always clear the
  // local session and go back to the role selector.
  const performLogout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      await axiosInstance.post('/api/auth/logout', { refreshToken }, { timeout: 10000 });
    } catch (logoutError) {
      console.warn('Staff logout request failed:', logoutError?.message);
    } finally {
      try { socketService.disconnect(); } catch (e) { /* ignore */ }
      try { await clearAccountLocalData(); } catch (e) { /* ignore */ }
      navigation.replace('RoleSelector');
    }
  }, [navigation]);

  const confirmLogout = () => {
    Alert.alert('Logout Account', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: performLogout },
    ]);
  };

  const shift = shiftInfo(staff.shift);
  const onShift = isOnShiftNow(staff.shift, now);
  const duties = ROLE_DUTIES[staff.roleKey] || DEFAULT_DUTIES;
  const firstName = staff.firstName || staff.name.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStaff(); }} colors={[colors.blue]} />}
      >
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroTop}>
            <Image source={{ uri: staff.image }} style={s.avatar} />
            <View style={s.heroText}>
              <Text translate={false} style={s.greeting} numberOfLines={1}>Hi, {firstName}</Text>
              <Text translate={false} style={s.roleLine} numberOfLines={1}>
                {staff.role}{staff.clinicName ? ` · ${staff.clinicName}` : ''}
              </Text>
            </View>
            <Pressable onPress={confirmLogout} style={s.heroButton} hitSlop={8} accessibilityLabel="Logout">
              <AppIcon name="logout" size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>
          <View style={s.rolePill}>
            <AppIcon name="shield" size={13} color="#FFFFFF" strokeWidth={2} />
            <Text style={s.rolePillText}>Logged in as {staff.role}</Text>
          </View>
        </LinearGradient>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <AppIcon name="clock" size={16} color={colors.blue} strokeWidth={2} />
            <Text style={s.cardTitle}>My Shift</Text>
            <View style={[s.statusPill, onShift ? s.statusOn : s.statusOff]}>
              <View style={[s.statusDot, onShift ? s.dotOn : s.dotOff]} />
              <Text style={[s.statusText, onShift ? s.statusTextOn : s.statusTextOff]}>{onShift ? 'On shift now' : 'Off shift'}</Text>
            </View>
          </View>
          <Text style={s.shiftName}>{shift.key} Shift</Text>
          <Text style={s.shiftTime}>{shift.label}</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <AppIcon name="briefcase" size={16} color={colors.blue} strokeWidth={2} />
            <Text style={s.cardTitle}>My Responsibilities</Text>
          </View>
          {duties.map((duty) => (
            <View key={duty} style={s.dutyRow}>
              <View style={s.dutyCheck}><AppIcon name="check-mark" size={11} color={colors.blue} strokeWidth={3} /></View>
              <Text style={s.dutyText}>{duty}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <AppIcon name="user" size={16} color={colors.blue} strokeWidth={2} />
            <Text style={s.cardTitle}>My Details</Text>
          </View>
          <Detail label="Employee ID" value={staff.id} />
          <Detail label="Email" value={staff.email} />
          <Detail label="Phone" value={staff.phone} />
          <Detail label="Department" value={staff.department} />
          <Detail label="Clinic" value={staff.clinicName} />
          <Detail label="Joined" value={staff.joinDate} last />
        </View>

        <Pressable onPress={() => navigation.navigate('ChangePassword')} style={s.actionRow}>
          <View style={s.actionIcon}><AppIcon name="lock" size={16} color={colors.blue} strokeWidth={2} /></View>
          <View style={s.grow}>
            <Text style={s.actionTitle}>Change Password</Text>
            <Text style={s.actionSub}>Replace the password your doctor shared with you.</Text>
          </View>
          <AppIcon name="chevron-right" size={16} color={colors.muted} />
        </Pressable>

        <Pressable onPress={confirmLogout} style={s.logoutButton}>
          <AppIcon name="logout" size={16} color={colors.red} strokeWidth={2} />
          <Text style={s.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value, last }) {
  return (
    <View style={[s.detail, last && s.detailLast]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text translate={false} style={s.detailValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 14, paddingBottom: 32 },
  grow: { flex: 1 },

  hero: { borderRadius: 18, padding: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,.7)', backgroundColor: '#FFFFFF' },
  heroText: { flex: 1, marginLeft: 12, minWidth: 0 },
  greeting: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  roleLine: { fontSize: 13.5, color: 'rgba(255,255,255,.9)', marginTop: 2 },
  heroButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginTop: 14 },
  rolePillText: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },

  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusOn: { backgroundColor: colors.paleBlue, borderWidth: 1, borderColor: '#99F6E4' },
  statusOff: { backgroundColor: colors.line },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: colors.blue },
  dotOff: { backgroundColor: colors.muted },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  statusTextOn: { color: colors.blue },
  statusTextOff: { color: colors.muted },
  shiftName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  shiftTime: { fontSize: 13.5, color: colors.muted, marginTop: 2 },

  dutyRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  dutyCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  dutyText: { flex: 1, fontSize: 13.5, color: colors.ink },

  detail: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 13, color: colors.muted, width: 100 },
  detailValue: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.ink, textAlign: 'right' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 14 },
  actionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  actionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },

  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#F4C7C3', backgroundColor: '#FFF5F4', marginTop: 16 },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.red },
});
