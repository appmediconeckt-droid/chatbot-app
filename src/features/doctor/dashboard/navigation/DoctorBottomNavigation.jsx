// Ported from MediconecktApp's src/doctor/navigation/DoctorBottomNavigation.tsx.
// A raised round QR button sits in the middle (PhonePe-style scan button),
// between Calendar and Patients; it reports the label 'QR'.
import React from 'react';
import { Pressable, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';

const leftRoutes = [
  ['home', 'Home'],
  ['calendar', 'Calendar'],
];
const rightRoutes = [
  ['user', 'Patients'],
  ['users', 'Staff'],
];

// How far the QR button rises above the bar. The wrapper reserves this strip
// (transparent, touches pass through to the screen behind it) so the raised
// part of the button stays inside its parent and is tappable on Android.
const RAISE = 26;

export default function DoctorBottomNavigation({ active = 'Home', onChange }) {
  const renderItem = ([icon, label]) => {
    const selected = active === label;
    return (
      <Pressable accessibilityLabel={label} onPress={() => onChange?.(label)} key={label} style={styles.item}>
        <View style={[styles.iconWrap, selected && styles.activeIconWrap]}>
          <AppIcon name={icon} size={18} strokeWidth={selected ? 2.4 : 1.7} color={selected ? colors.blue : '#747B87'} />
        </View>
        <Text style={[styles.label, selected && styles.active]}>{label}</Text>
        {selected && <View style={styles.indicator} />}
      </Pressable>
    );
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        {leftRoutes.map(renderItem)}
        {/* Slot under the raised button, with its label. */}
        <Pressable accessibilityLabel="Book Appointment QR" onPress={() => onChange?.('QR')} style={[styles.item, styles.centerSlot]}>
          <Text style={[styles.label, styles.centerLabel]}>QR Code</Text>
        </Pressable>
        {rightRoutes.map(renderItem)}
      </View>

      <View style={styles.fabRow} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Book Appointment QR"
          onPress={() => onChange?.('QR')}
          style={({ pressed }) => [styles.fabRing, pressed && styles.fabPressed]}
        >
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <AppIcon name="qr" size={24} strokeWidth={2.1} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  wrapper: { marginTop: -RAISE, paddingTop: RAISE },
  bar: { height: 65, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#DDE1E8', flexDirection: 'row', paddingTop: 7 },
  item: { flex: 1, alignItems: 'center', position: 'relative' },
  iconWrap: { width: 30, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  activeIconWrap: { backgroundColor: colors.paleBlue },
  label: { ...typography.caption, fontSize: 12, lineHeight: 16, marginTop: 2, color: '#747B87', textAlign: 'center', width: '100%' },
  active: { color: colors.blue, fontWeight: '800' },
  indicator: { position: 'absolute', top: -8, width: 30, height: 2, backgroundColor: colors.blue },
  centerSlot: { justifyContent: 'flex-start' },
  // Same baseline as the other labels (icon 26 + 2 gap).
  centerLabel: { marginTop: 28, color: '#0D9488', fontWeight: '800' },
  fabRow: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  fabRing: {
    width: 60, height: 60, borderRadius: 30, padding: 4, backgroundColor: colors.surface,
    shadowColor: '#0D9488', shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
  fab: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
