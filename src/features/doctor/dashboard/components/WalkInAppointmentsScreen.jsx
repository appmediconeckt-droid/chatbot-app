// Ported from MediconecktApp's WalkInAppointmentsScreen. Same API contract as
// the web Walk-in/WalkInAppointment.jsx:
//   GET    /api/walkin-appointments?doctor_id=<id>
//   POST   /api/walkin-appointments   { patient_name, phone_number, symptoms, doctor_id, gender, doctor_name, department, priority, status: 'booked' }
//   PATCH  /api/walkin-appointments/:id { status: 'cancelled', doctor_id }
//   DELETE /api/walkin-appointments/:id { doctor_id }
// camelCase duplicates are sent too so older backends keep accepting it.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';

const STATUS_META = {
  waiting: { label: 'Waiting', color: '#C85B20', bg: '#FFF3E9' },
  in_consultation: { label: 'In Consultation', color: '#0D9488', bg: '#E6FBF8' },
  completed: { label: 'Completed', color: '#16834A', bg: '#E8F7EF' },
  cancelled: { label: 'Cancelled', color: '#D7353D', bg: '#FFE9EA' },
};

const DEPARTMENTS = ['General Medicine', 'Orthopedics', 'Cardiology', 'Pediatrics'];
const GENDERS = ['Male', 'Female', 'Other'];
const PRIORITIES = ['Low', 'Med', 'High'];

const FILTER_TO_STATUS = { All: null, Waiting: 'waiting', 'In Consultation': 'in_consultation', Completed: 'completed', Cancelled: 'cancelled' };

// Web: BOOKED / WAITING -> Waiting, IN_CONSULTATION, COMPLETED, CANCELLED.
const normalizeStatus = (raw) => {
  const v = String(raw || 'BOOKED').toUpperCase().replace(/[\s-]+/g, '_');
  if (['IN_CONSULTATION', 'IN_PROGRESS'].includes(v)) return 'in_consultation';
  if (['COMPLETED', 'COMPLETE'].includes(v)) return 'completed';
  if (['CANCELLED', 'CANCELED'].includes(v)) return 'cancelled';
  return 'waiting';
};

const unwrapApiArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  if (Array.isArray(payload?.walkins)) return payload.walkins;
  return [];
};

const normalizeWalkin = (item) => ({
  id: pickFirst(item.id, item._id),
  name: pickFirst(item.patient_name, item.patientName, item.walkin_patient_name, item.walkinPatientName,
    item.visitor_name, item.visitorName, item.name, item.full_name, ''),
  phone: pickFirst(item.phone_number, item.phone, item.contact_number, ''),
  gender: item.gender || 'Not specified',
  problem: pickFirst(item.problem, item.symptoms, item.reason, item.description, ''),
  status: normalizeStatus(pickFirst(item.appointment_status, item.appointmentStatus, item.walkin_status, item.queue_status, item.status)),
  createdAt: pickFirst(item.created_at, item.createdAt, item.date, item.appointment_date),
  time: pickFirst(item.time, item.appointment_time),
  doctor: pickFirst(item.doctor_name, item.doctor?.name, 'Not assigned'),
  department: pickFirst(item.department, item.dept, 'Not assigned'),
  priority: pickFirst(item.priority, 'Not specified'),
  token: pickFirst(item.token_number, item.tokenNumber, item.token_no, item.tokenNo, item.walkin_token,
    item.walkinToken, item.queue_token, item.queueToken, item.appointment_token, item.appointmentToken, item.token, ''),
});

const formatTime = (item) => {
  if (item.time) return item.time;
  const d = new Date(item.createdAt);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const minutesSince = (value) => {
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.max(0, Math.round((Date.now() - d) / 60000));
};

const initialForm = { name: '', phone: '', gender: '', problem: '', doctor: '', department: '', priority: 'Low' };

export default function WalkInAppointmentsScreen({ onBack }) {
  const { showToast } = useToast();
  const [walkins, setWalkins] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [registerVisible, setRegisterVisible] = useState(false);
  const [departmentPickerOpen, setDepartmentPickerOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, user?.user_id, user?.userId);
      if (id) setDoctorId(String(id));
      else {
        setApiError('Doctor ID not found. Please login again.');
        setLoading(false);
      }
    });
  }, []);

  const fetchWalkins = useCallback(async () => {
    if (!doctorId) return;
    try {
      setApiError('');
      const response = await axiosInstance.get('/api/walkin-appointments', { params: { doctor_id: doctorId } });
      setWalkins(unwrapApiArray(response.data).map(normalizeWalkin));
    } catch (err) {
      setApiError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load walk-in appointments');
      setWalkins([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [doctorId]);

  useEffect(() => { fetchWalkins(); }, [fetchWalkins]);

  const waitingList = walkins.filter((w) => w.status === 'waiting');
  const inConsultationList = walkins.filter((w) => w.status === 'in_consultation');
  const completedCount = walkins.filter((w) => w.status === 'completed').length;
  const cancelledCount = walkins.filter((w) => w.status === 'cancelled').length;

  const stats = [
    { icon: 'users', value: String(walkins.length), label: 'Total Walk-ins', bg: '#E6F0FF', color: '#0D9488' },
    { icon: 'clock', value: String(waitingList.length), label: 'Waiting', bg: '#FFF0E8', color: '#C85B20' },
    { icon: 'check', value: String(inConsultationList.length + completedCount), label: 'Consulted', bg: '#E8F7EF', color: '#16834A' },
    { icon: 'x', value: String(cancelledCount), label: 'Cancelled', bg: '#FFE9EA', color: '#D7353D' },
  ];

  const current = inConsultationList[0] || waitingList[0];
  const currentToken = current?.token ? `#${current.token}` : '—';
  const waitMinutes = waitingList.map((w) => minutesSince(w.createdAt));
  const avgWait = waitMinutes.length ? Math.round(waitMinutes.reduce((x, y) => x + y, 0) / waitMinutes.length) : 0;
  const maxWait = waitMinutes.length ? Math.max(...waitMinutes) : 0;

  const visible = walkins.filter((w) => {
    const statusFilter = FILTER_TO_STATUS[filter];
    if (statusFilter && w.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !w.name?.toLowerCase().includes(q) && !String(w.phone).includes(q)) return false;
    return true;
  });

  const cancelAppointment = async (id) => {
    try {
      setApiError('');
      const response = await axiosInstance.patch(`/api/walkin-appointments/${id}`, { status: 'cancelled', doctor_id: doctorId });
      const updated = response.data?.data || response.data?.appointment || response.data;
      setWalkins((prev) => prev.map((w) => (w.id === id ? { ...normalizeWalkin({ ...updated, id }), status: 'cancelled' } : w)));
      showToast('Appointment cancelled');
    } catch (err) {
      setApiError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to cancel appointment');
    }
  };

  const deleteAppointment = (id) => {
    Alert.alert('Delete Appointment', 'Are you sure you want to delete this appointment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setApiError('');
            await axiosInstance.delete(`/api/walkin-appointments/${id}`, { data: { doctor_id: doctorId } });
            setWalkins((prev) => prev.filter((w) => w.id !== id));
            showToast('Appointment deleted');
          } catch (err) {
            setApiError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to delete appointment');
          }
        },
      },
    ]);
  };

  const openActions = (w) => {
    const options = [];
    if (w.status !== 'cancelled' && w.status !== 'completed') {
      options.push({ text: 'Cancel', onPress: () => cancelAppointment(w.id) });
    }
    options.push({ text: 'Delete', style: 'destructive', onPress: () => deleteAppointment(w.id) });
    options.push({ text: 'Close', style: 'cancel' });
    Alert.alert(w.name, `${w.token ? `Token #${w.token} · ` : ''}${STATUS_META[w.status]?.label}\n${w.problem}`, options);
  };

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const closeModal = () => {
    setRegisterVisible(false);
    setForm(initialForm);
    setErrors({});
  };

  const validateForm = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.phone.trim()) next.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(form.phone.trim())) next.phone = 'Please enter a valid 10-digit phone number';
    if (!form.problem.trim()) next.problem = 'Problem description is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitRegistration = async () => {
    if (submitting || !validateForm()) return;
    if (!doctorId) {
      setApiError('Doctor ID not found. Please login again.');
      return;
    }
    const payload = {
      patient_name: form.name.trim(),
      phone_number: form.phone.trim(),
      symptoms: form.problem.trim(),
      doctor_id: doctorId,
      gender: form.gender || 'Not specified',
      doctor_name: form.doctor.trim(),
      department: form.department.trim(),
      priority: form.priority,
      status: 'booked',
      // camelCase aliases for the older chatbot-backend walk-in controller
      patientName: form.name.trim(),
      phone: form.phone.trim(),
      problem: form.problem.trim(),
    };
    try {
      setSubmitting(true);
      setApiError('');
      await axiosInstance.post('/api/walkin-appointments', payload);
      showToast('Walk-in appointment created');
      closeModal();
      fetchWalkins();
    } catch (err) {
      setApiError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create walk-in appointment');
      showToast('Could not create appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>Walk-In-Appointments</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWalkins(); }} colors={['#0D9488']} />}
      >
        <Text style={styles.intro}>Here's your walk-in queue for today.</Text>
        {!!apiError && <Text style={styles.errorText}>{apiError}</Text>}
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
            <View style={styles.queueHeaderIcon}><AppIcon name="timer" size={16} color="#0D9488" /></View>
            <Text style={styles.queueTitle}>Live Queue Status</Text>
          </View>
          <View style={styles.queueGrid}>
            <View style={styles.queueBox}>
              <Text style={styles.tiny}>Current Token</Text>
              <Text style={styles.metricValue}>{currentToken}</Text>
            </View>
            <View style={styles.queueBox}>
              <Text style={styles.tiny}>Avg Wait</Text>
              <Text style={[styles.metricValue, styles.wait]}>{avgWait}m</Text>
            </View>
            <View style={[styles.queueBox, styles.queueBoxWide]}>
              <Text style={styles.tiny}>Max Wait</Text>
              <Text style={styles.metricValue}>{maxWait}m</Text>
            </View>
          </View>
        </View>
        <View style={styles.search}>
          <AppIcon name="search" size={17} color="#69758A" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search patient name, phone..."
            placeholderTextColor="#8B95A7"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {Object.keys(FILTER_TO_STATUS).map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={styles.filter}>
              {filter === item && <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
              <Text style={[styles.filterText, filter === item && styles.filterActiveText]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <Text style={styles.emptyText}>Loading queue...</Text>
        ) : visible.length === 0 ? (
          <Text style={styles.emptyText}>{walkins.length === 0 ? 'No walk-ins registered today.' : 'No patients match.'}</Text>
        ) : (
          visible.map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.waiting;
            return (
              <Pressable style={styles.patient} key={String(p.id)} onPress={() => openActions(p)}>
                <View style={styles.patientTop}>
                  <View style={[styles.avatar, styles.initials]}>
                    <Text style={styles.initialText}>{p.name?.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{p.name}</Text>
                    <Text style={styles.phone}>{p.phone || 'No phone'} · {p.gender}</Text>
                    {!!p.problem && <Text style={styles.phone} numberOfLines={1}>{p.problem}</Text>}
                  </View>
                  <Text style={styles.token}>{p.token ? `#${p.token}` : '—'}</Text>
                </View>
                <View style={styles.patientBottom}>
                  <View style={styles.metaRow}><AppIcon name="clock" size={12} color="#596579" /><Text style={styles.time}>{formatTime(p)}</Text></View>
                  <Text style={styles.priorityTag}>{p.priority}</Text>
                  <View style={[styles.status, { backgroundColor: meta.bg }]}>
                    {p.status === 'completed' && <AppIcon name="check-mark" size={10} color={meta.color} strokeWidth={3} />}
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => setRegisterVisible(true)}>
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabFill}>
          <Text style={styles.plus}>+</Text>
        </LinearGradient>
      </Pressable>
      <Modal visible={registerVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalCardContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}><AppIcon name="user" size={19} color="#0D9488" strokeWidth={2} /></View>
              <View style={styles.modalHeading}><Text style={styles.modalTitle}>New Walk-in Appointment</Text><Text style={styles.modalSubtitle}>Register a new walk-in patient</Text></View>
              <Pressable style={styles.modalClose} onPress={closeModal}><AppIcon name="x" size={18} color="#667085" /></Pressable>
            </View>
            <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>PERSONAL DETAILS</Text><View style={styles.sectionLine} /></View>
            <Text style={styles.formLabel}>Patient Name <Text style={styles.required}>*</Text></Text>
            <View style={[styles.formInputRow, !!errors.name && styles.inputError]}>
              <AppIcon name="user" size={14} color="#667085" />
              <TextInput style={styles.formInput} value={form.name} onChangeText={(v) => setField('name', v)} placeholder="Michael Johnson" placeholderTextColor="#8B95A7" />
            </View>
            {!!errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
            <Text style={styles.formLabel}>Phone Number <Text style={styles.required}>*</Text></Text>
            <View style={[styles.formInputRow, !!errors.phone && styles.inputError]}>
              <AppIcon name="phone" size={14} color="#667085" />
              <TextInput style={styles.formInput} value={form.phone} onChangeText={(v) => setField('phone', v.replace(/\D/g, '').slice(0, 10))} placeholder="1234567890" placeholderTextColor="#8B95A7" keyboardType="phone-pad" />
            </View>
            {!!errors.phone && <Text style={styles.fieldError}>{errors.phone}</Text>}
            <Text style={styles.formLabel}>Gender</Text>
            <View style={styles.priorityRow}>
              {GENDERS.map((item) => (
                <Pressable key={item} onPress={() => setField('gender', form.gender === item ? '' : item)} style={[styles.priorityButton, form.gender === item && styles.prioritySelected]}>
                  <Text style={[styles.priorityButtonText, form.gender === item && styles.prioritySelectedText]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>CONSULTATION DETAILS</Text><View style={styles.sectionLine} /></View>
            <Text style={styles.formLabel}>Doctor</Text>
            <View style={styles.formInputRow}>
              <AppIcon name="user" size={14} color="#667085" />
              <TextInput style={styles.formInput} value={form.doctor} onChangeText={(v) => setField('doctor', v)} placeholder="Enter doctor name" placeholderTextColor="#8B95A7" />
            </View>
            <Text style={styles.formLabel}>Department</Text>
            <Pressable style={styles.select} onPress={() => setDepartmentPickerOpen((v) => !v)}>
              <Text style={[styles.selectText, !form.department && styles.placeholderText]}>{form.department || 'Select Department'}</Text>
              <AppIcon name="chevron-down" size={15} color="#667085" strokeWidth={2} />
            </Pressable>
            {departmentPickerOpen && (
              <View style={styles.departmentOptions}>
                {DEPARTMENTS.map((dept) => (
                  <Pressable key={dept} style={styles.departmentOption} onPress={() => { setField('department', dept); setDepartmentPickerOpen(false); }}>
                    <Text style={styles.departmentOptionText}>{dept}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((item) => (
                <Pressable key={item} onPress={() => setField('priority', item)} style={[styles.priorityButton, form.priority === item && styles.prioritySelected]}>
                  <Text style={[styles.priorityButtonText, form.priority === item && styles.prioritySelectedText]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.formLabel}>Problem/Symptoms <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.complaint, !!errors.problem && styles.inputError]}
              value={form.problem}
              onChangeText={(v) => setField('problem', v)}
              placeholder="Describe the problem or symptoms"
              placeholderTextColor="#8B95A7"
              multiline
              textAlignVertical="top"
            />
            {!!errors.problem && <Text style={[styles.fieldError, styles.fieldErrorSpaced]}>{errors.problem}</Text>}
            <Pressable style={styles.registerButtonWrap} onPress={submitRegistration} disabled={submitting}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.registerButton}>
                <AppIcon name="plus" size={15} color="#FFF" strokeWidth={2.4} />
                <Text style={styles.registerText}>{submitting ? 'Creating...' : 'Create Appointment'}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={closeModal}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 12, paddingBottom: 90 },
  intro: { fontSize: 14, lineHeight: 19, color: '#687386', marginVertical: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  stat: { width: '48.5%', height: 112, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, padding: 12, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#12213A', marginTop: 7 },
  statLabel: { fontSize: 11.5, lineHeight: 15, fontWeight: '700', color: '#526078', textTransform: 'uppercase', letterSpacing: 0.3 },
  queue: { marginTop: 16, backgroundColor: '#EAF1FF', borderWidth: 1, borderColor: '#D4FBFF', borderRadius: 10, padding: 13 },
  queueTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#25344E' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  queueHeaderIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  queueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  queueBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFF', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  queueBoxWide: { flexBasis: '100%' },
  tiny: { fontSize: 12, lineHeight: 16, color: '#718096' },
  metricValue: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#23324A', marginTop: 2 },
  wait: { color: '#D04B35' },
  search: { height: 46, borderWidth: 1, borderColor: '#CDD6E3', backgroundColor: '#FFF', borderRadius: 9, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0, color: '#16233A' },
  filters: { gap: 7, paddingVertical: 12 },
  filter: { height: 35, borderWidth: 1, borderColor: '#D4DBE5', borderRadius: 18, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', overflow: 'hidden' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#26344C' },
  filterActiveText: { color: '#FFF', fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#8A94A4', textAlign: 'center', marginTop: 20 },
  patient: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, padding: 12, marginBottom: 10, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  patientTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  initials: { backgroundColor: '#DCFFFF', alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 14, fontWeight: '600', color: '#24A8A2' },
  patientInfo: { flex: 1, marginLeft: 10 },
  patientName: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#17243A' },
  phone: { fontSize: 13, lineHeight: 17, color: '#788294', marginTop: 2 },
  token: { fontSize: 13, fontWeight: '600', color: '#526078', backgroundColor: '#EDF1F6', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5 },
  patientBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF1F5' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time: { fontSize: 13, color: '#4B576A' },
  status: { borderRadius: 13, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 13, fontWeight: '600' },
  fab: { position: 'absolute', right: 14, bottom: 16, width: 48, height: 48, borderRadius: 24, overflow: 'hidden', shadowColor: '#0D9488', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 7 },
  fabFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 31, lineHeight: 34, fontWeight: '300', color: '#FFF', textAlign: 'center', includeFontPadding: false },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18,28,45,0.38)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '90%', flexGrow: 0, backgroundColor: '#FFF', borderRadius: 14, shadowColor: '#17243A', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 10 },
  modalCardContent: { padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalHeaderIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  modalHeading: { flex: 1 },
  modalTitle: { fontSize: 18, lineHeight: 23, fontWeight: '700', color: '#17243A' },
  modalSubtitle: { fontSize: 13, lineHeight: 17, color: '#758195', marginTop: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeadingText: { fontSize: 13, lineHeight: 17, fontWeight: '700', letterSpacing: 0.6, color: '#0D9488' },
  sectionLine: { height: 1, backgroundColor: '#E3E8EF', flex: 1 },
  formLabel: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: '#3D4A5C', marginBottom: 6 },
  required: { color: '#E02D36' },
  formInputRow: { height: 46, borderWidth: 1, borderColor: '#C8D2DF', backgroundColor: '#FBFCFE', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginBottom: 14 },
  formInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0, marginLeft: 8 },
  select: { height: 46, borderWidth: 1, borderColor: '#C8D2DF', backgroundColor: '#FBFCFE', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 14 },
  selectText: { fontSize: 14, color: '#344054' },
  departmentOptions: { borderWidth: 1, borderColor: '#C8D2DF', borderRadius: 8, marginTop: -8, marginBottom: 14, overflow: 'hidden' },
  departmentOption: { height: 40, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  departmentOptionText: { fontSize: 13.5, color: '#344054' },
  priorityRow: { flexDirection: 'row', gap: 9, marginBottom: 15 },
  priorityButton: { flex: 1, height: 43, borderWidth: 1, borderColor: '#CCD5E1', backgroundColor: '#FFF', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  prioritySelected: { backgroundColor: '#EAF2FF', borderColor: '#0D9488' },
  priorityButtonText: { fontSize: 13, fontWeight: '500', color: '#344054' },
  prioritySelectedText: { color: '#0D9488', fontWeight: '700' },
  complaint: { height: 88, borderWidth: 1, borderColor: '#C8D2DF', backgroundColor: '#FBFCFE', borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 19, color: '#17243A', marginBottom: 22 },
  registerButtonWrap: { marginBottom: 11, borderRadius: 8, shadowColor: '#0D9488', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  registerButton: { height: 46, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  registerText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  cancelButton: { height: 44, borderWidth: 1, borderColor: '#CBD4E2', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, color: '#D7353D', marginBottom: 8 },
  inputError: { borderColor: '#E02D36' },
  fieldError: { fontSize: 12, color: '#E02D36', marginTop: -10, marginBottom: 10 },
  fieldErrorSpaced: { marginTop: -18, marginBottom: 16 },
  placeholderText: { color: '#8B95A7' },
  priorityTag: { fontSize: 12, fontWeight: '600', color: '#526078', backgroundColor: '#EDF1F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#344054' },
});
