// Ported from MediconecktApp's src/doctor/navigation/DoctorBottomNavigation.tsx.
// Five plain tabs, all rendered identically. QR used to be a raised round
// PhonePe-style scan button in the middle; it is now an ordinary tab like the
// rest, so the bar reads as one consistent row.
import React from 'react';
import { Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';

// [icon, value, label?] — `value` is what onChange reports (the dashboard
// switches on 'QR'), `label` is what the tab shows when it differs.
const routes = [
  ['home', 'Home'],
  ['calendar', 'Calendar'],
  ['qr', 'QR', 'QR Code'],
  ['patients', 'Patients'],
  ['users', 'Staff'],
];

export default function DoctorBottomNavigation({ active = 'Home', onChange }) {
  const renderItem = ([icon, value, label = value]) => {
    const selected = active === value;
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        onPress={() => onChange?.(value)}
        key={value}
        style={({ pressed }) => [styles.item, pressed && !selected && styles.itemPressed]}
      >
        <View style={styles.iconWrap}>
          <AppIcon name={icon} size={21} strokeWidth={selected ? 2.3 : 1.8} color={selected ? colors.blue : INACTIVE} />
        </View>
        <Text style={[styles.label, selected && styles.active]} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  };

  return <View style={styles.bar}>{routes.map(renderItem)}</View>;
}

const INACTIVE = '#6B7280';

const styles = createDoctorStyles({
  bar: {
    height: 70,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF0F3',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  item: { flex: 1, maxWidth: 180, height: '100%', alignItems: 'center', justifyContent: 'center' },
  itemPressed: { opacity: 0.6 },
  iconWrap: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, fontSize: 11.5, lineHeight: 15, marginTop: 4, color: INACTIVE, fontWeight: '500', textAlign: 'center', width: '100%' },
  active: { color: colors.blue, fontWeight: '800' },
});
