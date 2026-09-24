// Doctor Messages — port of the web "Patient Communications" page
// (DoctorDashboardChat/DoctorSmsPatient.jsx): live conversations from
// GET /api/chat/chats (auto-refresh every 10 s like the web), the web's stats,
// status filters and search. Tapping a patient opens the app chat screen
// (messages, attachments, voice / video calls). Patients with an open video /
// voice appointment get the web's "Check & Complete Appointment" form
// (PATCH /api/appointments/:id).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getDoctorIdFromUser, getStoredDoctorUser } from '../api/doctorAppointments';
import {
  completeRemoteConsultation,
  findOpenRemoteAppointment,
  loadChatPatients,
  loadDoctorAppointments,
  openPatientChat,
} from '../api/doctorChat';

const FILTERS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['critical', 'Critical'],
  ['needs attention', 'Needs Attention'],
  ['stable', 'Stable'],
  ['improving', 'Improving'],
  ['archived', 'Archived'],
];

const toneOf = (status) => {
  const v = String(status || '').toLowerCase();
  if (v === 'critical') return 'red';
  if (v.includes('attention') || v.includes('waiting') || v === 'pending') return 'orange';
  return 'blue';
};

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';

const emptyConsultForm = () => ({ diagnosis: '', medicine: '', advice: '', recommendedTests: [] });

export default function PatientCommunicationsScreen({ navigation, onChatOpenChange }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [consult, setConsult] = useState(null); // { patient, appointment }
  const [consultForm, setConsultForm] = useState(emptyConsultForm);
  const [savingConsult, setSavingConsult] = useState(false);

  useEffect(() => { onChatOpenChange?.(false); }, [onChatOpenChange]);

  const loadPatients = useCallback(async () => {
    try {
      setError('');
      const doctorId = getDoctorIdFromUser(await getStoredDoctorUser());
      const [rows, appts] = await Promise.all([
        loadChatPatients(),
        doctorId ? loadDoctorAppointments(doctorId).catch(() => []) : Promise.resolve([]),
      ]);
      setPatients(rows);
      setAppointments(appts);
      setStatus('succeeded');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load chat list');
      setStatus((current) => (current === 'succeeded' ? current : 'failed'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Same as the web: load now, then refresh every 10 seconds.
  useEffect(() => {
    loadPatients();
    const timer = setInterval(loadPatients, 10000);
    return () => clearInterval(timer);
  }, [loadPatients]);

  const openChat = (patient, callType) => {
    if (!navigation) return Alert.alert('Messages', 'Chat is not available right now.');
    if (!patient.chatId) return Alert.alert('Messages', 'No active chat found for this patient.');
    openPatientChat(navigation, patient, callType);
  };

  const openConsult = (patient) => {
    const appointment = findOpenRemoteAppointment(appointments, patient.receiverId);
    if (!appointment) return Alert.alert('Remote consultation', 'This patient has no open video / voice appointment to complete.');
    setConsultForm(emptyConsultForm());
    setConsult({ patient, appointment });
  };

  const saveConsult = async () => {
    if (!consult) return;
    if (!consultForm.diagnosis.trim() || !consultForm.medicine.trim() || !consultForm.advice.trim()) {
      return Alert.alert('Remote consultation', 'Diagnosis, medicine and advice are required.');
    }
    setSavingConsult(true);
    try {
      await completeRemoteConsultation(consult.appointment, consultForm);
      setConsult(null);
      Alert.alert('Consultation completed', `${consult.patient.name}'s appointment has been completed.`);
      loadPatients();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to complete consultation');
    } finally {
      setSavingConsult(false);
    }
  };

  const updateTest = (index, field, value) =>
    setConsultForm((f) => ({ ...f, recommendedTests: f.recommendedTests.map((t, i) => (i === index ? { ...t, [field]: value } : t)) }));

  const query = search.trim().toLowerCase();
  const visible = patients.filter((p) => {
    const statusValue = p.status.toLowerCase();
    const matchesSearch = !query ||
      p.name.toLowerCase().includes(query) ||
      String(p.condition).toLowerCase().includes(query) ||
      String(p.lastMessage).toLowerCase().includes(query);
    const matchesStatus =
      filter === 'all' || filter === 'archived' ||
      (filter === 'unread' ? p.unread > 0 : statusValue === filter);
    return matchesSearch && matchesStatus;
  });

  const unreadCount = patients.reduce((sum, p) => sum + Number(p.unread || 0), 0);
  const criticalCount = patients.filter((p) => p.status.toLowerCase() === 'critical').length;
  const waitingCount = patients.filter((p) => p.status.toLowerCase().includes('waiting') || p.status.toLowerCase() === 'pending').length;
  const resolvedCount = patients.filter((p) => p.status.toLowerCase().includes('resolved')).length;

  return (
    <View style={s.screen}>
      <ScrollView
        style={s.listScroll}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPatients(); }} colors={['#0D9488']} />}
      >
        <Text style={s.pageTitle}>Patient Communications</Text>

        <View style={s.stats}>
          <Stat icon="warning" label="Critical Patients" value={criticalCount} tone="red" />
          <Stat icon="message" label="Unread Messages" value={unreadCount} tone="teal" />
          <Stat icon="clock" label="Waiting for Reply" value={waitingCount} tone="orange" />
          <Stat icon="check-mark" label="Resolved Today" value={resolvedCount} tone="green" />
        </View>

        <View style={s.search}>
          <View style={s.searchIconWrap}>
            <AppIcon name="search" size={16} color="#0D9488" strokeWidth={2.2} />
          </View>
          <TextInput value={search} onChangeText={setSearch} style={s.searchInput} placeholder="Search conversations..." placeholderTextColor="#9AA4B5" />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8} style={s.searchClear}><AppIcon name="x" size={13} color="#8A94A4" /></Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filters}>
          {FILTERS.map(([value, label]) => (
            <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}>
              {filter === value && <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
              <Text style={[s.filterText, filter === value && s.filterTextActive]}>{label}</Text>
              {value === 'unread' && unreadCount > 0 && (
                <View style={[s.filterBadge, filter === value && s.filterBadgeOnActive]}>
                  <Text style={[s.filterBadgeText, filter === value && s.filterBadgeTextOnActive]}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <Text style={s.sectionTitle}>Conversations</Text>
        {!!error && <Text style={s.errorText}>{error}</Text>}

        {status === 'loading' ? (
          <View style={s.empty}><ActivityIndicator color="#0D9488" /><Text style={s.emptyText}>Loading conversations...</Text></View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><AppIcon name="message" size={22} color="#B0B8C4" strokeWidth={1.8} /></View>
            <Text style={s.emptyText}>{patients.length === 0 ? 'No conversations yet.' : 'No conversations match this filter.'}</Text>
          </View>
        ) : (
          visible.map((item) => {
            const unread = item.unread > 0;
            const tone = toneOf(item.status);
            const remoteAppointment = findOpenRemoteAppointment(appointments, item.receiverId);
            return (
              <Pressable
                onPress={() => openChat(item)}
                key={item.id}
                style={({ pressed }) => [s.conversation, unread && s.conversationUnread, pressed && s.conversationPressed]}
              >
                <View style={[s.accentBar, tone === 'orange' && s.accentOrange, tone === 'red' && s.accentRed]} />
                <View style={s.avatarWrap}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarInitials]}><Text style={s.avatarText}>{getInitials(item.name)}</Text></View>
                  )}
                  {item.online && <View style={s.onlineDot} />}
                </View>
                <View style={s.conversationBody}>
                  <View style={s.conversationTop}>
                    <Text style={[s.name, unread && s.nameUnread]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[s.time, unread && s.timeUnread]}>{item.messageTime}</Text>
                  </View>
                  <View style={s.metaRow}>
                    <Text style={s.condition} numberOfLines={1}>
                      {[item.age !== 'NA' ? `${item.age} yrs` : null, item.gender, item.condition].filter(Boolean).join(' • ')}
                    </Text>
                    <View style={[s.status, tone === 'orange' && s.orange, tone === 'red' && s.red]}>
                      <Text style={[s.statusText, tone === 'orange' && s.orangeText, tone === 'red' && s.redText]}>{item.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={s.previewRow}>
                    <Text numberOfLines={1} style={[s.preview, unread && s.previewUnread]}>{item.lastMessage}</Text>
                    {unread && <View style={s.unread}><Text style={s.unreadText}>{item.unread}</Text></View>}
                  </View>
                  <View style={s.actionsRow}>
                    <Pressable style={s.actionBtn} onPress={() => openChat(item, 'voice')} hitSlop={4}>
                      <AppIcon name="phone" size={13} color="#0D9488" />
                      <Text style={s.actionText}>Voice</Text>
                    </Pressable>
                    <Pressable style={s.actionBtn} onPress={() => openChat(item, 'video')} hitSlop={4}>
                      <AppIcon name="video" size={13} color="#0D9488" />
                      <Text style={s.actionText}>Video</Text>
                    </Pressable>
                    {remoteAppointment && (
                      <Pressable style={[s.actionBtn, s.actionBtnComplete]} onPress={() => openConsult(item)} hitSlop={4}>
                        <AppIcon name="check-mark" size={13} color="#FFF" strokeWidth={2.6} />
                        <Text style={[s.actionText, s.actionTextComplete]}>Complete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Remote Consultation — Check & Complete Appointment */}
      <Modal visible={Boolean(consult)} transparent animationType="slide" onRequestClose={() => setConsult(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <View style={s.flex}>
                <Text style={s.modalEyebrow}>REMOTE CONSULTATION</Text>
                <Text style={s.modalTitle}>Check & Complete Appointment</Text>
                <Text style={s.modalSub}>Add the prescription and recommended tests for {consult?.patient?.name || 'this patient'}.</Text>
              </View>
              <Pressable onPress={() => setConsult(null)} hitSlop={8}><AppIcon name="x" size={18} color="#667085" /></Pressable>
            </View>
            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Diagnosis <Text style={s.required}>*</Text></Text>
              <TextInput style={s.textArea} multiline textAlignVertical="top" value={consultForm.diagnosis} onChangeText={(v) => setConsultForm((f) => ({ ...f, diagnosis: v }))} placeholder="Clinical diagnosis and findings" placeholderTextColor="#9AA4B5" />
              <Text style={s.fieldLabel}>Medicine / Prescription <Text style={s.required}>*</Text></Text>
              <TextInput style={[s.textArea, s.textAreaTall]} multiline textAlignVertical="top" value={consultForm.medicine} onChangeText={(v) => setConsultForm((f) => ({ ...f, medicine: v }))} placeholder="Medicine name, dosage, timing and duration" placeholderTextColor="#9AA4B5" />
              <Text style={s.fieldLabel}>Doctor's Advice <Text style={s.required}>*</Text></Text>
              <TextInput style={s.textArea} multiline textAlignVertical="top" value={consultForm.advice} onChangeText={(v) => setConsultForm((f) => ({ ...f, advice: v }))} placeholder="Diet, care and follow-up advice" placeholderTextColor="#9AA4B5" />

              <View style={s.testsHead}>
                <Text style={s.fieldLabel}>Recommended Tests</Text>
                <Pressable onPress={() => setConsultForm((f) => ({ ...f, recommendedTests: [...f.recommendedTests, { testName: '', completeBy: '', reason: '', instructions: '' }] }))}>
                  <Text style={s.addLink}>＋ Add test</Text>
                </Pressable>
              </View>
              {consultForm.recommendedTests.map((test, index) => (
                <View key={index} style={s.testCard}>
                  <View style={s.testCardHead}>
                    <Text style={s.testTitle}>Test {index + 1}</Text>
                    <Pressable onPress={() => setConsultForm((f) => ({ ...f, recommendedTests: f.recommendedTests.filter((_, i) => i !== index) }))} hitSlop={8}>
                      <AppIcon name="trash" size={14} color="#DC2626" />
                    </Pressable>
                  </View>
                  <TextInput style={s.input} value={test.testName} onChangeText={(v) => updateTest(index, 'testName', v)} placeholder="Test name (e.g. CBC)" placeholderTextColor="#9AA4B5" />
                  <TextInput style={s.input} value={test.completeBy} onChangeText={(v) => updateTest(index, 'completeBy', v)} placeholder="Complete by (YYYY-MM-DD)" placeholderTextColor="#9AA4B5" />
                  <TextInput style={s.input} value={test.reason} onChangeText={(v) => updateTest(index, 'reason', v)} placeholder="Reason" placeholderTextColor="#9AA4B5" />
                  <TextInput style={s.input} value={test.instructions} onChangeText={(v) => updateTest(index, 'instructions', v)} placeholder="Instructions (e.g. fasting)" placeholderTextColor="#9AA4B5" />
                </View>
              ))}
            </ScrollView>
            <View style={s.modalActions}>
              <Pressable style={s.cancelBtn} onPress={() => setConsult(null)}><Text style={s.cancelText}>Cancel</Text></Pressable>
              <Pressable style={s.saveWrap} onPress={saveConsult} disabled={savingConsult}>
                <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
                  <Text style={s.saveText}>{savingConsult ? 'Saving...' : 'Complete Appointment'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ icon, label, value, tone }) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, s[`statIcon_${tone}`]]}><AppIcon name={icon} size={14} color={STAT_COLORS[tone]} /></View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
      <Text style={[s.statLive, { color: STAT_COLORS[tone] }]}>● Live</Text>
    </View>
  );
}

const STAT_COLORS = { red: '#DC2626', teal: '#0D9488', orange: '#C44A21', green: '#16A34A' };

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F3F6FA' },
  search: {
    height: 46,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 9,
    shadowColor: '#17243A',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E4FBF9', alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  searchClear: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  filtersScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  filter: {
    height: 34,
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 17,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  filterActive: {
    borderColor: 'transparent',
    shadowColor: '#0D9488',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: '#526078' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },
  filterBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', marginLeft: 7, paddingHorizontal: 4 },
  filterBadgeOnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  filterBadgeTextOnActive: { color: '#FFF' },
  listScroll: { flex: 1 },
  list: { paddingTop: 12, paddingBottom: 24 },
  flex: { flex: 1 },
  pageTitle: { fontSize: 19, fontWeight: '800', color: '#17243A', marginHorizontal: 16, marginBottom: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  stat: { width: '48.5%', backgroundColor: '#FFF', borderRadius: 14, padding: 11, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statIcon_red: { backgroundColor: '#FEE2E2' },
  statIcon_teal: { backgroundColor: '#E4FBF9' },
  statIcon_orange: { backgroundColor: '#FBEADD' },
  statIcon_green: { backgroundColor: '#DCFCE7' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#17243A', marginTop: 6 },
  statLabel: { fontSize: 12, color: '#667085', marginTop: 1 },
  statLive: { position: 'absolute', right: 10, top: 12, fontSize: 10.5, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#17243A', marginHorizontal: 16, marginTop: 6, marginBottom: 10 },
  errorText: { fontSize: 12.5, color: '#C0463F', marginHorizontal: 16, marginBottom: 8 },
  avatarInitials: { backgroundColor: '#E4FBF9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#0D9488' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#B6ECE6', backgroundColor: '#F2FDFC', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  actionBtnComplete: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  actionText: { fontSize: 12, fontWeight: '700', color: '#0D9488' },
  actionTextComplete: { color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: '90%' },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  modalEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: '#0D9488' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#17243A', marginTop: 2 },
  modalSub: { fontSize: 12.5, color: '#667085', marginTop: 3 },
  modalScroll: { flexGrow: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#344054', marginTop: 10, marginBottom: 6 },
  required: { color: '#DC2626' },
  textArea: { minHeight: 64, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 12, padding: 10, fontSize: 13.5, color: '#17243A' },
  textAreaTall: { minHeight: 96 },
  testsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addLink: { fontSize: 13, fontWeight: '800', color: '#0D9488', marginTop: 10 },
  testCard: { borderWidth: 1, borderColor: '#E3EEEC', borderRadius: 12, padding: 10, marginBottom: 8, gap: 6, backgroundColor: '#FCFEFE' },
  testCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testTitle: { fontSize: 12.5, fontWeight: '800', color: '#0D9488' },
  input: { height: 42, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 10, fontSize: 13.5, color: '#17243A' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D5DAE3', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  saveWrap: { flex: 1.6 },
  saveBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  conversation: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    minHeight: 84,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 11,
    overflow: 'hidden',
    shadowColor: '#17243A',
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  conversationUnread: { backgroundColor: '#F2FDFC' },
  conversationPressed: { opacity: 0.85 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#0D9488' },
  accentOrange: { backgroundColor: '#E08A3E' },
  accentRed: { backgroundColor: '#D2564B' },
  avatarWrap: { position: 'relative', marginLeft: 4 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#F0F3F8' },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF' },
  conversationBody: { flex: 1 },
  conversationTop: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 15.5, fontWeight: '700', color: '#374357' },
  nameUnread: { fontWeight: '800', color: '#17243A' },
  time: { marginLeft: 8, fontSize: 12, color: '#8A94A4' },
  timeUnread: { color: '#0D9488', fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  condition: { flex: 1, fontSize: 12.5, color: '#7B8493' },
  status: { backgroundColor: '#D9FEFF', borderRadius: 11, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10.5, fontWeight: '700', color: '#0D9488' },
  orange: { backgroundColor: '#FBEADD' },
  orangeText: { color: '#C44A21' },
  red: { backgroundColor: '#FDF1F1' },
  redText: { color: '#C0463F' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  preview: { flex: 1, fontSize: 13.5, color: '#7B8493' },
  previewUnread: { color: '#3C4759', fontWeight: '600' },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#8E9DB0' },
});
