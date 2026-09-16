// Ported from MediconecktApp's src/doctor/dashboard/components/DoctorSidebar.tsx.
// Adaptation: the profile card reads the real (mock) doctor name/specialization
// from AsyncStorage instead of the source's hardcoded "Vikas Sharma".
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from '../icons/AppIcon';

const items = [
  { id: 'appointments', label: 'Appointment Lists', icon: 'user', color: '#0EADA1', bg: '#EAF3FF', border: '#BFF8F6', iconBg: '#DCFFFF', pressedBg: '#DDFFFC' },
  { id: 'walkIn', label: 'Walk-In Appointment', icon: 'walk', color: '#B25E09', bg: '#FFF4E6', border: '#F6D1A6', iconBg: '#FFE8C7', pressedBg: '#FFECD5' },
  { id: 'followUps', label: 'Follow Ups', icon: 'users', color: '#6B3FB5', bg: '#F1EBFF', border: '#D6C6F7', iconBg: '#E7DDFF', pressedBg: '#EBE1FF' },
  { id: 'profileQr', label: 'QR Code', icon: 'qr', color: '#08F9ED', bg: '#EAF3FF', border: '#B9FFFD', iconBg: '#DCFFFF', pressedBg: '#DDFFFC' },
  { id: 'clinic', label: 'Clinic Management', icon: 'home', color: '#07883D', bg: '#EAF8EF', border: '#BFE7CE', iconBg: '#DDF4E7', pressedBg: '#E3F3E9' },
  { id: 'settings', label: 'Settings', icon: 'settings', color: '#41516A', bg: '#F2F5F8', border: '#D6DEE8', iconBg: '#E7ECF3', pressedBg: '#E9EEF5' },
];

export default function DoctorSidebar({ visible, activeItem, onClose, onNavigate, onLogout }) {
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
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: 'https://i.pravatar.cc/100?img=32' }} style={styles.avatar} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.specialty}>{specialization || 'General Physician'}</Text>
            </View>
            <Text style={styles.profileChevron}>›</Text>
          </View>

          <View style={styles.menu}>
            <Text style={styles.menuLabel}>NAVIGATION</Text>
            {items.map((item) => {
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
                  <Text style={[styles.itemText, selected && { color: item.color, fontWeight: '700' }]}>{item.label}</Text>
                </Pressable>
              );
            })}
            <View style={styles.menuDivider} />
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

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,33,63,0.28)' },
  panel: { width: '88%', maxWidth: 360, height: '100%', backgroundColor: '#FFFFFF', paddingTop: 34, paddingHorizontal: 16, borderTopRightRadius: 26, borderBottomRightRadius: 18, shadowColor: '#10213F', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 5, height: 0 }, elevation: 12 },
  profileCard: { height: 76, borderWidth: 1, borderColor: '#E0E5EC', backgroundColor: '#FBFCFE', borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#10213F', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 45, height: 45, borderRadius: 23 },
  onlineDot: { position: 'absolute', right: 0, bottom: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#20A05A', borderWidth: 2, borderColor: '#FFF' },
  profileInfo: { flex: 1 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#10213F' },
  specialty: { fontSize: 12, lineHeight: 17, color: '#7D879B', marginTop: 1 },
  profileChevron: { fontSize: 24, lineHeight: 26, color: '#98A2B3' },
  menu: { marginTop: 22 },
  menuLabel: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.9, color: '#98A2B3', marginLeft: 12, marginBottom: 9 },
  item: { height: 48, width: '100%', borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 11, position: 'relative', marginBottom: 3 },
  selectedItem: { borderWidth: 1, borderColor: '#D9E2EC' },
  pressedItem: { backgroundColor: '#E3F3E9', opacity: 1, transform: [{ scale: 0.99 }] },
  selectedBar: { position: 'absolute', left: 0, width: 3, height: 22, borderRadius: 2, backgroundColor: '#07883D' },
  iconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F3F6FA', alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: '#10213F', flex: 1 },
  menuDivider: { height: 1, backgroundColor: '#E8ECF1', marginVertical: 10, marginHorizontal: 8 },
  logoutItem: { marginTop: 0 },
  logoutIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFF0F1', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#D92D36', flex: 1 },
});
