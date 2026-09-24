// Patient visit history — port of the web Patient Details "records" view
// (PatientAppointmentDetails/PatientDetailsPage.jsx): patient banner, Visit
// History (date, time, problem, doctor, follow-up) with 10-per-page
// pagination, and View Details per visit. Call dials the patient's phone;
// Message opens the patient's chat.
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { openChatForPatientId } from '../api/doctorChat';

const PAGE_SIZE = 10;

export default function PatientDetailScreen({ patient, navigation, onBack, onVisitPress }) {
  const [page, setPage] = useState(1);
  const records = patient?.records || [];
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const first = records.length ? (safePage - 1) * PAGE_SIZE : 0;
  const pageRows = records.slice(first, first + PAGE_SIZE);

  const call = () => {
    const phone = String(patient.phone || '').trim();
    if (!phone || phone === 'N/A') return Alert.alert('Call', `Phone number is not available for ${patient.name}.`);
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Call', 'Could not start the call.'));
  };

  const message = async () => {
    if (!navigation || String(patient.id).startsWith('local-')) return Alert.alert('Message', 'No chat available for this patient.');
    try {
      const opened = await openChatForPatientId(navigation, patient.id);
      if (!opened) Alert.alert('Message', `No active chat found for ${patient.name}.`);
    } catch {
      Alert.alert('Message', 'Could not open the chat.');
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Back to Patients</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
          <View style={s.bannerRow}>
            <View style={s.avatar}><Text style={s.avatarText}>{patient.name.charAt(0).toUpperCase()}</Text></View>
            <View style={s.flex}>
              <Text style={s.name}>{patient.name}</Text>
              <Text style={s.bannerMeta}>{patient.age !== 'N/A' ? `${patient.age} yrs` : 'Age N/A'} • {patient.gender}</Text>
            </View>
          </View>
          <View style={s.bannerInfo}>
            <View style={s.infoPill}><AppIcon name="phone" size={12} color="#FFF" /><Text style={s.infoText}>{patient.phone}</Text></View>
            <View style={s.infoPill}><Text style={s.infoText}>❤ Blood Group: {patient.bloodGroup}</Text></View>
          </View>
          <View style={s.actions}>
            <Pressable style={s.actionBtn} onPress={call}><AppIcon name="phone" size={14} color="#0D9488" /><Text style={s.actionText}>Call</Text></Pressable>
            <Pressable style={s.actionBtn} onPress={message}><AppIcon name="message" size={14} color="#0D9488" /><Text style={s.actionText}>Message</Text></Pressable>
          </View>
        </LinearGradient>

        <View style={s.sectionRow}>
          <AppIcon name="calendar" size={16} color="#0D9488" />
          <Text style={s.section}>Visit History ({records.length} appointments)</Text>
        </View>

        {records.length === 0 ? (
          <View style={s.empty}><AppIcon name="file" size={28} color="#98A2B3" /><Text style={s.emptyText}>No visit records found for this patient</Text></View>
        ) : (
          <>
            {pageRows.map((record) => (
              <Pressable key={String(record.id)} onPress={() => onVisitPress?.(record)} style={({ pressed }) => [s.visit, pressed && s.pressed]}>
                <View style={s.visitTop}>
                  <View style={s.dateBox}>
                    <AppIcon name="calendar" size={13} color="#0F766E" />
                    <Text style={s.dateText}>{record.date}</Text>
                  </View>
                  <View style={s.timeBox}>
                    <AppIcon name="clock" size={12} color="#667085" />
                    <Text style={s.timeText}>{record.time}</Text>
                  </View>
                </View>
                <Text style={s.problem} numberOfLines={2}>{record.problem}</Text>
                <View style={s.visitMeta}>
                  <Text style={s.doctor} numberOfLines={1}>👨‍⚕️ {record.doctor}</Text>
                  <Text style={[s.followUp, record.followUp === 'Not required' && s.followUpNone]}>Follow-up: {record.followUp}</Text>
                </View>
                <View style={s.viewRow}>
                  <AppIcon name="file" size={13} color="#0D9488" />
                  <Text style={s.viewText}>View Details</Text>
                  <AppIcon name="chevron-right" size={14} color="#0D9488" />
                </View>
              </Pressable>
            ))}
            {totalPages > 1 && (
              <View style={s.pagination}>
                <Text style={s.pageInfo}>Showing {first + 1} to {Math.min(first + PAGE_SIZE, records.length)} of {records.length} visits</Text>
                <View style={s.pageBtns}>
                  <Pressable disabled={safePage === 1} onPress={() => setPage(safePage - 1)} style={[s.pageBtn, safePage === 1 && s.disabled]}><Text style={s.pageBtnText}>‹</Text></Pressable>
                  <Text style={s.pageNow}>{safePage} / {totalPages}</Text>
                  <Pressable disabled={safePage === totalPages} onPress={() => setPage(safePage + 1)} style={[s.pageBtn, safePage === totalPages && s.disabled]}><Text style={s.pageBtnText}>›</Text></Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7E7E4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 17, fontWeight: '800', color: '#0D9488' },
  content: { padding: 14, paddingBottom: 28 },
  banner: { borderRadius: 20, padding: 16 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  name: { fontSize: 19, fontWeight: '800', color: '#FFF' },
  bannerMeta: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  bannerInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  infoText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 12, backgroundColor: '#FFF' },
  actionText: { fontSize: 13.5, fontWeight: '800', color: '#0D9488' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 10 },
  section: { fontSize: 16, fontWeight: '800', color: '#17243A' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 13, color: '#667085' },
  visit: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E3EEEC' },
  visitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDFA', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  dateText: { fontSize: 12.5, fontWeight: '800', color: '#0F766E' },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 12.5, color: '#667085' },
  problem: { fontSize: 14.5, fontWeight: '700', color: '#17243A', marginTop: 10 },
  visitMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  doctor: { flex: 1, fontSize: 12.5, color: '#475467' },
  followUp: { fontSize: 11.5, fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  followUpNone: { color: '#667085', backgroundColor: '#F1F5F9' },
  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF3F2' },
  viewText: { fontSize: 13, fontWeight: '800', color: '#0D9488' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  pageInfo: { flex: 1, fontSize: 12, color: '#667085' },
  pageBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CDE7E3', alignItems: 'center', justifyContent: 'center' },
  pageBtnText: { fontSize: 18, fontWeight: '800', color: '#0D9488', marginTop: -2 },
  pageNow: { fontSize: 12.5, fontWeight: '700', color: '#344054' },
});
