// Ported from MediconecktApp's src/doctor/dashboard/components/WalkInAppointmentsScreen.tsx.
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';

const stats = [
  { icon: 'users', value: '124', label: 'Total Walk-ins', bg: '#E6F0FF', color: '#07BFBD' },
  { icon: 'clock', value: '12', label: 'Waiting', bg: '#FFF0E8', color: '#C85B20' },
  { icon: 'video', value: '8', label: 'In Consultation', bg: '#E8F7EF', color: '#16834A' },
  { icon: 'x', value: '8', label: 'Cancelled', bg: '#FFE9EA', color: '#D7353D' },
];
const patients = [
  { name: 'Michael Johnson', phone: '+1 (555) 123-4567', token: '#143', time: '10:15 AM', priority: 'High Priority', status: 'Waiting', color: '#FF9B00', image: '' },
  { name: 'Emma Lawson', phone: '+1 (555) 987-6543', token: '#142', time: '09:45 AM', priority: 'Low Priority', status: 'In Consultation', color: '#08F9ED', image: '' },
  { name: 'Robert Davis', phone: '+1 (555) 222-3333', token: '#141', time: '09:15 AM', priority: 'Med Priority', status: 'Completed', color: '#299D54', image: 'https://i.pravatar.cc/80?img=12' },
];

export default function WalkInAppointmentsScreen({ onBack, onMenuPress }) {
  const [filter, setFilter] = useState('All');
  const [registerVisible, setRegisterVisible] = useState(false);
  const [priority, setPriority] = useState('Low');
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>Walk-In-Appointments</Text>
        {onMenuPress && (
          <Pressable accessibilityLabel="Open navigation menu" onPress={onMenuPress} hitSlop={10} style={styles.menuButton}>
            <AppIcon name="menu" size={21} color="#26364D" strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Here's your walk-in queue for today.</Text>
        <View style={styles.stats}>
          {stats.map((item) => (
            <View style={styles.stat} key={item.label}>
              <View style={[styles.statIcon, { backgroundColor: item.bg }]}><AppIcon name={item.icon} size={17} color={item.color} strokeWidth={2} /></View>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.queue}>
          <View style={styles.queueHeader}>
            <View style={styles.queueHeaderIcon}><AppIcon name="timer" size={16} color="#07BFBD" /></View>
            <Text style={styles.queueTitle}>Live Queue Status</Text>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <View style={styles.queueMetrics}>
            <View style={styles.metric}><Text style={styles.tiny}>Current token</Text><Text style={styles.metricValue}>#144</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.tiny}>Average wait</Text><Text style={[styles.metricValue, styles.wait]}>18 min</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.tiny}>Maximum wait</Text><Text style={styles.metricValue}>22 min</Text></View>
          </View>
        </View>
        <View style={styles.search}>
          <AppIcon name="search" size={17} color="#69758A" />
          <TextInput style={styles.searchInput} placeholder="Search by patient name or phone" placeholderTextColor="#8B95A7" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {['All', 'Waiting', 'In Consultation', 'Completed'].map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
              <Text style={[styles.filterText, filter === item && styles.filterActiveText]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {patients.map((p, index) => (
          <View style={styles.patient} key={p.name}>
            <View style={styles.patientTop}>
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.initials]}><Text style={styles.initialText}>{p.name.split(' ').map((x) => x[0]).join('')}</Text></View>
              )}
              <View style={styles.patientInfo}><Text style={styles.patientName}>{p.name}</Text><Text style={styles.phone}>{p.phone}</Text></View>
              <Text style={styles.token}>{p.token}</Text>
            </View>
            <View style={styles.patientBottom}>
              <View style={styles.patientMeta}>
                <View style={styles.metaRow}><AppIcon name="clock" size={12} color="#596579" /><Text style={styles.time}>{p.time}</Text></View>
                <View style={[styles.priorityBadge, { backgroundColor: index === 0 ? '#FFF0F0' : index === 1 ? '#F2F4F7' : '#FFF3E9' }]}>
                  <Text style={[styles.priority, { color: index === 0 ? '#D92D36' : index === 1 ? '#667085' : '#C65F1A' }]}>{p.priority}</Text>
                </View>
              </View>
              <View style={[styles.status, { backgroundColor: `${p.color}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: p.color }]} />
                <Text style={[styles.statusText, { color: p.color }]}>{p.status}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => setRegisterVisible(true)}><Text style={styles.plus}>+</Text></Pressable>
      <Modal visible={registerVisible} transparent animationType="fade" onRequestClose={() => setRegisterVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRegisterVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}><AppIcon name="user" size={19} color="#07BFBD" strokeWidth={2} /></View>
              <View style={styles.modalHeading}><Text style={styles.modalTitle}>Patient Information</Text><Text style={styles.modalSubtitle}>Register a new walk-in patient</Text></View>
              <Pressable style={styles.modalClose} onPress={() => setRegisterVisible(false)}><AppIcon name="x" size={18} color="#667085" /></Pressable>
            </View>
            <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>PERSONAL DETAILS</Text><View style={styles.sectionLine} /></View>
            <Text style={styles.formLabel}>Patient Name <Text style={styles.required}>*</Text></Text>
            <View style={styles.formInputRow}><AppIcon name="user" size={14} color="#667085" /><TextInput style={styles.formInput} placeholder="Enter full name" placeholderTextColor="#8B95A7" /></View>
            <Text style={styles.formLabel}>Phone Number <Text style={styles.required}>*</Text></Text>
            <View style={styles.formInputRow}><Text style={styles.phoneIcon}>☎</Text><TextInput style={styles.formInput} placeholder="(555) 000-0000" placeholderTextColor="#8B95A7" keyboardType="phone-pad" /></View>
            <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>CONSULTATION DETAILS</Text><View style={styles.sectionLine} /></View>
            <Text style={styles.formLabel}>Department <Text style={styles.required}>*</Text></Text>
            <Pressable style={styles.select}><Text style={styles.selectText}>Select Department</Text><Text style={styles.selectArrow}>⌄</Text></Pressable>
            <Text style={styles.formLabel}>Priority Level <Text style={styles.required}>*</Text></Text>
            <View style={styles.priorityRow}>
              {['Low', 'Medium', 'High'].map((item) => (
                <Pressable key={item} onPress={() => setPriority(item)} style={[styles.priorityButton, priority === item && styles.prioritySelected]}>
                  <Text style={[styles.priorityButtonText, priority === item && styles.prioritySelectedText]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.formLabel}>Chief Complaint (Optional)</Text>
            <TextInput style={styles.complaint} placeholder="Briefly describe the symptoms..." placeholderTextColor="#8B95A7" multiline textAlignVertical="top" />
            <Pressable style={styles.registerButton} onPress={() => setRegisterVisible(false)}><Text style={styles.registerText}>＋ Register Patient</Text></Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setRegisterVisible(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { height: 56, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E3E7EE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 9 },
  menuButton: { marginLeft: 'auto' },
  back: { fontSize: 30, lineHeight: 32, color: '#10213F' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#07BFBD' },
  content: { padding: 12, paddingBottom: 90 },
  intro: { fontSize: 12, lineHeight: 17, color: '#687386', marginVertical: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  stat: { width: '48.5%', height: 112, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, padding: 12, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#12213A', marginTop: 7 },
  statLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: '#526078' },
  queue: { marginTop: 16, backgroundColor: '#EAF1FF', borderWidth: 1, borderColor: '#D4FBFF', borderRadius: 10, padding: 13, height: 128 },
  queueTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#25344E' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  queueHeaderIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#20A05A', marginLeft: 'auto', marginRight: 5 },
  liveText: { fontSize: 9, fontWeight: '700', color: '#16834A' },
  queueMetrics: { height: 57, backgroundColor: '#FFF', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  metric: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 30, backgroundColor: '#E3E8EF' },
  tiny: { fontSize: 9, lineHeight: 13, color: '#718096' },
  metricValue: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#23324A', marginTop: 2 },
  wait: { color: '#D04B35' },
  search: { height: 46, borderWidth: 1, borderColor: '#CDD6E3', backgroundColor: '#FFF', borderRadius: 9, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  searchInput: { flex: 1, fontSize: 12, paddingVertical: 0, color: '#16233A' },
  filters: { gap: 7, paddingVertical: 12 },
  filter: { height: 35, borderWidth: 1, borderColor: '#D4DBE5', borderRadius: 18, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  filterActive: { backgroundColor: '#07BFBD', borderColor: '#07BFBD' },
  filterText: { fontSize: 11, fontWeight: '500', color: '#26344C' },
  filterActiveText: { color: '#FFF', fontWeight: '600' },
  patient: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, padding: 12, marginBottom: 10, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  patientTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  initials: { backgroundColor: '#DCFFFF', alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 13, fontWeight: '600', color: '#24A8A2' },
  patientInfo: { flex: 1, marginLeft: 10 },
  patientName: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#17243A' },
  phone: { fontSize: 10, lineHeight: 14, color: '#788294', marginTop: 2 },
  token: { fontSize: 10, fontWeight: '600', color: '#526078', backgroundColor: '#EDF1F6', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5 },
  patientBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF1F5' },
  patientMeta: { gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time: { fontSize: 10, color: '#4B576A' },
  priorityBadge: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
  priority: { fontSize: 9, fontWeight: '600' },
  status: { borderRadius: 13, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  fab: { position: 'absolute', right: 14, bottom: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: '#08D9D0', alignItems: 'center', justifyContent: 'center', shadowColor: '#07BFBD', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 7 },
  plus: { fontSize: 31, lineHeight: 34, fontWeight: '300', color: '#FFF', textAlign: 'center', includeFontPadding: false },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18,28,45,0.38)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#FFF', borderRadius: 14, padding: 18, shadowColor: '#17243A', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalHeaderIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  modalHeading: { flex: 1 },
  modalTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#17243A' },
  modalSubtitle: { fontSize: 11, lineHeight: 15, color: '#758195', marginTop: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeadingText: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6, color: '#07BFBD' },
  sectionLine: { height: 1, backgroundColor: '#E3E8EF', flex: 1 },
  formLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: '#3D4A5C', marginBottom: 6 },
  required: { color: '#E02D36' },
  formInputRow: { height: 46, borderWidth: 1, borderColor: '#C8D2DF', backgroundColor: '#FBFCFE', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginBottom: 14 },
  formInput: { flex: 1, fontSize: 12, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  phoneIcon: { fontSize: 15, color: '#667085' },
  select: { height: 46, borderWidth: 1, borderColor: '#C8D2DF', backgroundColor: '#FBFCFE', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 14 },
  selectText: { fontSize: 12, color: '#344054' },
  selectArrow: { fontSize: 16, color: '#667085' },
  priorityRow: { flexDirection: 'row', gap: 9, marginBottom: 15 },
  priorityButton: { flex: 1, height: 43, borderWidth: 1, borderColor: '#CCD5E1', backgroundColor: '#FFF', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  prioritySelected: { backgroundColor: '#EAF2FF', borderColor: '#07BFBD' },
  priorityButtonText: { fontSize: 11, fontWeight: '500', color: '#344054' },
  prioritySelectedText: { color: '#07BFBD', fontWeight: '700' },
  complaint: { height: 88, borderWidth: 1, borderColor: '#C8D2DF', backgroundColor: '#FBFCFE', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 17, color: '#17243A', marginBottom: 22 },
  registerButton: { height: 46, borderRadius: 8, backgroundColor: '#07BFBD', alignItems: 'center', justifyContent: 'center', marginBottom: 11, shadowColor: '#07BFBD', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  registerText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  cancelButton: { height: 44, borderWidth: 1, borderColor: '#CBD4E2', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '600', color: '#344054' },
});
