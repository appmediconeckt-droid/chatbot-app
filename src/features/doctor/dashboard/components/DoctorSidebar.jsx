// Ported from MediconecktApp's src/doctor/dashboard/components/DoctorSidebar.tsx.
// Adaptation: the profile card reads the real (mock) doctor name/specialization
// from AsyncStorage instead of the source's hardcoded "Vikas Sharma".
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';

const activeNav = {
  color: colors.blue,
  bg: colors.paleBlue,
  border: '#99F6E4',
  iconBg: '#CCFBF1',
  pressedBg: '#E6FFFB',
};

const GROUPS = [
  {
    label: 'MAIN',
    items: [
      { id: 'appointments', label: 'Appointments', icon: 'calendar', ...activeNav },
      { id: 'walkIn', label: 'Walk-In Appointment', icon: 'walk', ...activeNav },
      { id: 'followUps', label: 'Follow Ups', icon: 'refresh', ...activeNav },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { id: 'qrCode', label: 'QR Code', icon: 'qr', ...activeNav },
      { id: 'clinic', label: 'Clinic Profile', icon: 'plus', ...activeNav },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings', ...activeNav },
    ],
  },
];

export default function DoctorSidebar({
  visible,
  activeItem,
  onClose,
  onNavigate,
  onProfilePress,
  onLogout,
  todayTotal = 0,
  todayCompleted = 0,
  onViewSchedule,
}) {
  const todayPending = Math.max(0, todayTotal - todayCompleted);
  const [selectedItem, setSelectedItem] = useState(activeItem ?? null);
  const [doctorName, setDoctorName] = useState('Doctor');
  const [specialization, setSpecialization] = useState('');

  useEffect(() => {
    setSelectedItem(activeItem ?? null);
  }, [activeItem, visible]);

  useEffect(() => {
    AsyncStorage.getItem('doctorMockProfile').then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.fullName) setDoctorName(parsed.fullName);
        if (parsed?.specialization) setSpecialization(parsed.specialization);
      } catch { /* ignore malformed mock data */ }
    });
  }, []);

  const displayName = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open doctor profile"
            onPress={onProfilePress}
            style={({ pressed }) => [styles.profileCard, pressed && styles.profileCardPressed]}
          >
            <View style={styles.avatarWrap}>
              <Image source={{ uri: 'https://i.pravatar.cc/100?img=32' }} style={styles.avatar} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.specialty}>{specialization || 'General Physician'}</Text>
            </View>
            <Text style={styles.profileChevron}>›</Text>
          </Pressable>

          <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menu} showsVerticalScrollIndicator={false}>
            {GROUPS.map((group) => (
              <View key={group.label} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.items.map((item) => {
                  const selected = selectedItem === item.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={item.id}
                      onPress={() => {
                        setSelectedItem(item.id);
                        onNavigate(item.id);
                      }}
                      style={({ pressed }) => [
                        styles.item,
                        selected && styles.selectedItem,
                        selected && { backgroundColor: item.bg, borderColor: item.border },
                        pressed && [styles.pressedItem, { backgroundColor: selected ? item.pressedBg : '#EEF4FA' }],
                      ]}
                    >
                      {selected && <View style={[styles.selectedBar, { backgroundColor: item.color }]} />}
                      <View style={[styles.iconBox, selected && { backgroundColor: item.iconBg }]}>
                        <AppIcon name={item.icon} size={19} strokeWidth={2} color={selected ? item.color : '#28405F'} />
                      </View>
                      <Text style={[styles.itemText, selected && styles.selectedItemText, selected && { color: item.color }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              onPress={() => (onViewSchedule ? onViewSchedule() : onNavigate('appointments'))}
              style={styles.scheduleCard}
            >
              <View style={styles.scheduleHeaderRow}>
                <AppIcon name="clock" size={14} color={colors.blue} strokeWidth={2} />
                <Text style={styles.scheduleTitle}>Today's Schedule</Text>
              </View>
              <Text style={styles.scheduleCount}>{todayTotal} Appointments</Text>
              <Text style={styles.scheduleBreakdown}>{todayPending} pending · {todayCompleted} completed</Text>
              <Text style={styles.scheduleLink}>View schedule →</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [styles.item, styles.logoutItem, pressed && styles.pressedItem]}
            >
              <View style={styles.logoutIconBox}>
                <AppIcon name="logout" size={19} strokeWidth={1.8} color="#D92D36" />
              </View>
              <Text style={styles.logoutText}>Logout Account</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createDoctorStyles({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,33,63,0.28)' },
  panel: { width: '88%', maxWidth: 360, height: '100%', backgroundColor: '#FFFFFF', paddingTop: 34, borderTopRightRadius: 26, borderBottomRightRadius: 18, shadowColor: '#10213F', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 5, height: 0 }, elevation: 12 },
  profileCard: { height: 76, marginHorizontal: 16, borderWidth: 1, borderColor: '#BFF8F6', backgroundColor: colors.paleBlue, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#10213F', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  profileCardPressed: { backgroundColor: '#E6FFFB' },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 45, height: 45, borderRadius: 23 },
  onlineDot: { position: 'absolute', right: 0, bottom: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#20A05A', borderWidth: 2, borderColor: '#FFF' },
  profileInfo: { flex: 1 },
  name: { ...typography.subtitle, fontSize: 16.5, lineHeight: 21, color: '#10213F' },
  specialty: { ...typography.body, fontSize: 14.5, lineHeight: 19, color: '#7D879B', marginTop: 1 },
  profileChevron: { ...typography.text, fontSize: 24, lineHeight: 26, color: '#98A2B3' },
  menuScroll: { flex: 1, marginTop: 6 },
  menu: { paddingHorizontal: 16, paddingBottom: 12 },
  group: { marginTop: 16 },
  groupLabel: { ...typography.label, fontSize: 11, lineHeight: 16, color: '#98A2B3', marginBottom: 8, marginLeft: 4 },
  item: { height: 50, width: '100%', borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 11, position: 'relative', marginBottom: 5 },
  selectedItem: { borderWidth: 1, borderColor: '#D9E2EC' },
  pressedItem: { backgroundColor: '#E6FFFB', opacity: 1, transform: [{ scale: 0.99 }] },
  selectedBar: { position: 'absolute', left: 0, width: 3, height: 22, borderRadius: 2, backgroundColor: colors.blue },
  iconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F3F6FA', alignItems: 'center', justifyContent: 'center' },
  itemText: { ...typography.body, fontSize: 15, lineHeight: 20, color: '#10213F', flex: 1 },
  selectedItemText: { ...typography.caption, fontSize: 15, lineHeight: 20, flex: 1 },
  scheduleCard: { marginTop: 20, backgroundColor: colors.paleBlue, borderWidth: 1, borderColor: '#BFF8F6', borderRadius: 14, padding: 14 },
  scheduleHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  scheduleTitle: { ...typography.caption, fontSize: 12.5, color: colors.blue },
  scheduleCount: { ...typography.title, fontSize: 19, color: '#10213F' },
  scheduleBreakdown: { ...typography.body, fontSize: 12.5, color: '#7D879B', marginTop: 2 },
  scheduleLink: { ...typography.caption, fontSize: 12.5, color: colors.blue, marginTop: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#E8ECF1' },
  logoutItem: { marginTop: 0, marginBottom: 0 },
  logoutIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFF0F1', alignItems: 'center', justifyContent: 'center' },
  logoutText: { ...typography.caption, fontSize: 15, lineHeight: 20, color: '#D92D36', flex: 1 },
});
