// Ported from MediconecktApp's src/doctor/dashboard/components/NextPatientCard.tsx.
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import AppIcon from '../icons/AppIcon';

export default function NextPatientCard({ patient, onStartConsultation }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <Text style={styles.label}>NEXT PATIENT</Text>
        </View>
        <Text style={styles.time}>{patient.time}</Text>
      </View>
      <View style={styles.patient}>
        <Image source={{ uri: patient.image }} style={styles.avatar} />
        <View>
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.complaint}>{patient.complaint}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start consultation with ${patient.name}`}
        onPress={onStartConsultation}
        style={styles.button}
      >
        <AppIcon name="video" size={13} strokeWidth={2.3} color="#FFF" />
        <Text style={styles.buttonText}>Start Consultation</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, borderColor: '#9AE8F8', backgroundColor: '#DCF9FF', padding: 12, marginTop: 16, marginBottom: 17 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue, marginRight: 7 },
  label: { fontSize: 9, fontWeight: '700', color: colors.navy },
  time: { fontSize: 9, lineHeight: 20, fontWeight: '700', color: colors.blue, backgroundColor: '#FFF', borderRadius: 11, paddingHorizontal: 10 },
  patient: { flexDirection: 'row', alignItems: 'center', marginVertical: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#FFF', marginRight: 12 },
  name: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.navy },
  complaint: { fontSize: 10, color: colors.blue },
  button: { height: 37, borderRadius: 6, backgroundColor: colors.brightBlue, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
});
