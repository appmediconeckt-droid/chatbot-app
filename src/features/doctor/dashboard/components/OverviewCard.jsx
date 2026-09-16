// Ported from MediconecktApp's src/doctor/dashboard/components/OverviewCard.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';
import AppIcon from '../icons/AppIcon';

export default function OverviewCard({ title, value, suffix, icon, neutral, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.iconCircle, neutral && styles.neutral]}>
          <AppIcon name={icon} size={13} strokeWidth={2} color={neutral ? '#606775' : colors.blue} />
        </View>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...shadow, width: '48.5%', height: 100, borderRadius: 8, backgroundColor: colors.surface, padding: 13 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 10, lineHeight: 15, color: colors.muted },
  iconCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paleBlue },
  neutral: { backgroundColor: '#E4E6EA' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 11 },
  value: { fontSize: 19, lineHeight: 23, fontWeight: '700', color: colors.ink },
  suffix: { fontSize: 9, color: colors.muted, marginLeft: 3 },
});
