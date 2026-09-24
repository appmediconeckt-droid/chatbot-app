// Ported from MediconecktApp's src/doctor/navigation/DoctorBottomNavigation.tsx.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';

const routes = [
  ['home', 'Home'],
  ['calendar', 'Calendar'],
  ['user', 'Patients'],
  ['users', 'Staff'],
];

export default function DoctorBottomNavigation({ active = 'Home', onChange }) {
  return (
    <View style={styles.bar}>
      {routes.map(([icon, label]) => {
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
      })}
    </View>
  );
}

const styles = createDoctorStyles({
  bar: { height: 65, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#DDE1E8', flexDirection: 'row', paddingTop: 7 },
  item: { flex: 1, alignItems: 'center', position: 'relative' },
  iconWrap: { width: 30, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  activeIconWrap: { backgroundColor: colors.paleBlue },
  label: { ...typography.caption, fontSize: 12, lineHeight: 16, marginTop: 2, color: '#747B87', textAlign: 'center', width: '100%' },
  active: { color: colors.blue, fontWeight: '800' },
  indicator: { position: 'absolute', top: -8, width: 30, height: 2, backgroundColor: colors.blue },
});
