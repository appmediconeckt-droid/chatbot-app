// Ported from MediconecktApp's src/doctor/components/layout/DoctorHeader.tsx.
// Adaptation: the header reads the real (mock) doctor name from
// AsyncStorage instead of the source's hardcoded "Dr. Sharma".
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, createDoctorStyles } from '../../theme';
import AppIcon from '../../icons/AppIcon';

export default function DoctorHeader({ onMenuPress, onProfilePress, onNotificationsPress, onSettingsPress }) {
  const [doctorName, setDoctorName] = useState('Doctor');

  useEffect(() => {
    AsyncStorage.getItem('doctorMockProfile').then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.fullName) setDoctorName(parsed.fullName);
      } catch { /* ignore malformed mock data */ }
    });
  }, []);

  const displayName = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;

  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Open menu" style={styles.menu} onPress={onMenuPress}>
        <AppIcon name="menu" size={24} strokeWidth={2} color={colors.ink} />
      </Pressable>
      <View style={styles.titleArea}>
        <Text style={styles.doctor} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Settings" style={styles.actionButton} onPress={onSettingsPress}>
          <AppIcon name="settings" size={17} strokeWidth={1.9} color="#20242C" />
        </Pressable>
        <Pressable accessibilityLabel="Notifications" style={[styles.actionButton, styles.bell]} onPress={onNotificationsPress}>
          <AppIcon name="bell" size={17} strokeWidth={1.9} color="#20242C" />
          <View style={styles.dot} />
        </Pressable>
        <Pressable accessibilityLabel="Doctor profile" style={styles.avatarButton} onPress={onProfilePress}>
          <Image source={{ uri: 'https://i.pravatar.cc/100?img=32' }} style={styles.avatar} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  header: { height: 54, paddingHorizontal: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: '#E4E7EC', flexDirection: 'row', alignItems: 'center' },
  menu: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  titleArea: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 8 },
  doctor: { ...typography.subtitle, fontSize: 16, lineHeight: 20, color: colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bell: { position: 'relative' },
  dot: { position: 'absolute', right: 7, top: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: '#E53935' },
  avatarButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 30, height: 30, borderRadius: 15 },
});
