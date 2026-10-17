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
  ['user', 'Patients'],
  ['users', 'Staff'],
];

export default function DoctorBottomNavigation({ active = 'Home', onChange }) {
  const renderItem = ([icon, value, label = value]) => {
    const selected = active === value;
    return (
      <Pressable accessibilityLabel={label} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange?.(value)} key={value} style={styles.item}>
        <View style={styles.iconWrap}>
          <AppIcon name={icon} size={18} strokeWidth={selected ? 2.4 : 1.7} color={selected ? colors.blue : '#747B87'} />
        </View>
        <Text style={[styles.label, selected && styles.active]} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  };

  return <View style={styles.bar}>{routes.map(renderItem)}</View>;
}

const styles = createDoctorStyles({
  bar: { height: 65, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#DDE1E8', flexDirection: 'row', justifyContent: 'center', paddingTop: 7 },
  item: { flex: 1, maxWidth: 180, alignItems: 'center', position: 'relative' },
  iconWrap: { width: 30, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, fontSize: 12, lineHeight: 16, marginTop: 2, color: '#747B87', textAlign: 'center', width: '100%' },
  active: { color: colors.blue, fontWeight: '800' },
});
