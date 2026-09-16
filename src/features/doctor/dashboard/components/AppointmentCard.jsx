// Ported from MediconecktApp's src/doctor/dashboard/components/AppointmentCard.tsx.
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';
import AppIcon from '../icons/AppIcon';

export default function AppointmentCard({ item, onStartConsultation }) {
  return (
    <View style={[styles.card, item.primary && styles.priorityCard]}>
      <View style={styles.header}>
        <Image source={{ uri: item.image }} style={styles.avatar} />
        <View style={styles.patientInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Pending</Text>
            </View>
          </View>
          <View style={styles.idRow}>
            <Text style={styles.patientId}>{item.id}</Text>
            <Text style={styles.gender}>{item.gender}</Text>
          </View>
        </View>
      </View>

      <View style={styles.complaintRow}>
        <View style={[styles.complaintIcon, item.primary && styles.priorityIcon]}>
          <AppIcon name="user" size={15} strokeWidth={1.9} color={item.primary ? colors.red : colors.blue} />
        </View>
        <Text style={[styles.complaint, item.primary && styles.priorityText]} numberOfLines={2}>{item.complaint}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.timeChip}>
          <AppIcon name="clock" size={14} strokeWidth={2} color={colors.blue} />
          <Text style={styles.timeText}>{item.time}</Text>
        </View>
        <Text style={styles.vital}>BP {item.bloodPressure}</Text>
        <Text style={styles.vital}>BG {item.bloodGroup}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.primary ? `Start consultation with ${item.name}` : `View ${item.name}`}
        onPress={item.primary ? () => onStartConsultation?.(item) : undefined}
        style={({ pressed }) => [
          styles.button,
          item.primary ? styles.primaryButton : styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        {item.primary && <AppIcon name="video" size={16} strokeWidth={2.2} color="#FFFFFF" />}
        <Text style={[styles.buttonText, item.primary ? styles.primaryButtonText : styles.secondaryButtonText]}>
          {item.primary ? 'Start Consultation' : 'View Details'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadow, backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#EEF1F6' },
  priorityCard: { borderColor: '#D7FBFF', shadowOpacity: 0.1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8ECF2', borderWidth: 2, borderColor: '#FFFFFF' },
  patientInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.ink },
  statusBadge: { height: 23, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FFF5E5', flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.amber, marginRight: 5 },
  statusText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#A65F00' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  patientId: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#536176', backgroundColor: '#F1F4F8', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  gender: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: colors.muted },
  complaintRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF1F6' },
  complaintIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F7FF', marginRight: 10 },
  priorityIcon: { backgroundColor: '#FFF1F2' },
  complaint: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#394457' },
  priorityText: { color: colors.red },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  timeChip: { height: 32, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF6FF' },
  timeText: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: colors.blue },
  vital: { height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFBFD', color: '#536176', fontSize: 12, lineHeight: 30, fontWeight: '700' },
  button: { height: 42, borderRadius: 9, marginTop: 14, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButton: { borderColor: colors.blue, backgroundColor: colors.blue },
  secondaryButton: { borderColor: '#BCC6D6', backgroundColor: '#FFFFFF' },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  buttonText: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButtonText: { color: colors.navy },
});
