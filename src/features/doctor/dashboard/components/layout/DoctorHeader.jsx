// Ported from MediconecktApp's src/doctor/components/layout/DoctorHeader.tsx.
// Adaptation: the greeting reads the real (mock) doctor name from
// AsyncStorage instead of the source's hardcoded "Dr. Sharma".
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme';
import AppIcon from '../../icons/AppIcon';

export default function DoctorHeader({ onMenuPress, onProfilePress }) {
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
      <View style={styles.greeting}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text style={styles.doctor}>Good evening, {displayName}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Settings">
          <AppIcon name="settings" size={17} strokeWidth={1.9} color="#20242C" />
        </Pressable>
        <Pressable accessibilityLabel="Notifications" style={styles.bell}>
          <AppIcon name="bell" size={17} strokeWidth={1.9} color="#20242C" />
          <View style={styles.dot} />
        </Pressable>
        <Pressable accessibilityLabel="Doctor profile QR" onPress={onProfilePress}>
          <Image source={{ uri: 'https://i.pravatar.cc/100?img=32' }} style={styles.avatar} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 58, paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: '#E4E7EC', flexDirection: 'row', alignItems: 'center' },
  menu: { width: 31, height: 31, justifyContent: 'center', marginRight: 5 },
  greeting: { flex: 1 },
  welcome: { fontSize: 9, lineHeight: 13, color: colors.muted },
  doctor: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bell: { position: 'relative' },
  dot: { position: 'absolute', right: -1, top: 0, width: 5, height: 5, borderRadius: 3, backgroundColor: '#E53935' },
  avatar: { width: 28, height: 28, borderRadius: 14 },
});
