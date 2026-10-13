// Ported from MediconecktApp's src/doctor/dashboard/components/OverviewCard.tsx.
// Compact stat tile for the doctor home: a tinted icon on the left, the value
// and its label on the right. `tone` gives each tile its own accent colour so
// the four tiles can be told apart at a glance.
import React from 'react';
import { Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import { colors, typography, createDoctorStyles } from '../theme';
import AppIcon from '../icons/AppIcon';

const TONES = {
  teal: { fg: colors.blue, bg: '#E6FFFB', border: '#B7EDE5' },
  amber: { fg: '#D97706', bg: '#FFF7E6', border: '#FBDDB1' },
  green: { fg: '#16A34A', bg: '#ECFDF3', border: '#BBEBC9' },
  indigo: { fg: '#4F46E5', bg: '#EEF2FF', border: '#CFD5FB' },
};

export default function OverviewCard({ title, value, suffix, icon, tone = 'teal', onPress }) {
  const palette = TONES[tone] || TONES.teal;
  return (
    // Press feedback is a background tint, not an opacity fade — fading an
    // elevated, rounded card makes Android draw its shadow as a rectangle.
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, { borderColor: palette.border }, pressed && { backgroundColor: palette.bg }]}
    >
      <View style={[styles.iconBox, { backgroundColor: palette.fg }]}>
        <AppIcon name={icon} size={18} strokeWidth={2.2} color="#FFFFFF" />
      </View>
      <View style={styles.body}>
        <View style={styles.valueRow}>
          <Text translate={false} style={styles.value} numberOfLines={1}>{value}</Text>
          {!!suffix && <Text style={styles.suffix}>{suffix}</Text>}
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = createDoctorStyles({
  card: {
    width: '48.5%',
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E3F1EF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { ...typography.title, fontSize: 20, lineHeight: 24, color: colors.ink },
  suffix: { ...typography.caption, fontSize: 12, color: colors.muted, marginLeft: 3 },
  title: { ...typography.caption, fontSize: 11.5, lineHeight: 15, color: '#64748B', marginTop: 2 },
});
