// Ported from MediconecktApp's src/doctor/navigation/DoctorBottomNavigation.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { colors } from '../theme';

const routes = [
  ['home', 'Home'],
  ['calendar', 'Calendar'],
  ['user', 'Patients'],
  ['message', 'Messages'],
  ['users', 'Users'],
];

export default function DoctorBottomNavigation({ active = 'Home', onChange }) {
  return (
    <View style={styles.bar}>
      {routes.map(([icon, label]) => {
        const selected = active === label;
        return (
          <Pressable accessibilityLabel={label} onPress={() => onChange?.(label)} key={label} style={styles.item}>
            <AppIcon name={icon} size={18} strokeWidth={selected ? 2.4 : 1.7} color={selected ? colors.brightBlue : '#747B87'} />
            <Text style={[styles.label, selected && styles.active]}>{label}</Text>
            {selected && <View style={styles.indicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 65, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#DDE1E8', flexDirection: 'row', paddingTop: 7 },
  item: { flex: 1, alignItems: 'center', position: 'relative' },
  label: { fontSize: 8, lineHeight: 13, marginTop: 2, color: '#747B87' },
  active: { color: colors.brightBlue, fontWeight: '700' },
  indicator: { position: 'absolute', top: -8, width: 30, height: 2, backgroundColor: colors.brightBlue },
});
