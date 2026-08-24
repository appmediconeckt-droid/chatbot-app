import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  FlatList,
} from 'react-native';
import Text from '../../../../../../components/TranslatedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import PATIENT from '../../../../../../theme/palette';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

const Appointments = ({ navigation }) => {
  const { t } = useLanguageRender();
  const [activeTab, setActiveTab] = useState('upcoming');

  const upcomingAppointments = [
    {
      id: 1,
      counselor: 'Dr. Emily Chen',
      specialization: 'Mental Health Counselor',
      date: '2026-07-25',
      time: '2:30 PM',
      type: 'Video Call',
      status: 'confirmed',
      image: 'https://ui-avatars.com/api/?name=Emily+Chen',
    },
    {
      id: 2,
      counselor: 'Dr. James Wilson',
      specialization: 'Anxiety Specialist',
      date: '2026-08-01',
      time: '10:00 AM',
      type: 'Voice Call',
      status: 'confirmed',
      image: 'https://ui-avatars.com/api/?name=James+Wilson',
    },
  ];

  const pastAppointments = [
    {
      id: 3,
      counselor: 'Dr. Sarah Johnson',
      specialization: 'Depression Therapist',
      date: '2026-07-15',
      time: '3:00 PM',
      type: 'Video Call',
      status: 'completed',
      image: 'https://ui-avatars.com/api/?name=Sarah+Johnson',
    },
    {
      id: 4,
      counselor: 'Dr. Michael Lee',
      specialization: 'Stress Management',
      date: '2026-07-10',
      time: '11:00 AM',
      type: 'Voice Call',
      status: 'completed',
      image: 'https://ui-avatars.com/api/?name=Michael+Lee',
    },
  ];

  const appointments = activeTab === 'upcoming' ? upcomingAppointments : pastAppointments;

  const handleVideoCall = (appointment) => {
    Alert.alert(
      'Video Call',
      `Initiating video call with ${appointment.counselor}...`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleVoiceCall = (appointment) => {
    Alert.alert(
      'Voice Call',
      `Initiating voice call with ${appointment.counselor}...`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleReschedule = (appointment) => {
    Alert.alert('Reschedule', `Reschedule appointment with ${appointment.counselor}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reschedule', style: 'default' },
    ]);
  };

  const handleCancel = (appointment) => {
    Alert.alert('Cancel Appointment', `Cancel appointment with ${appointment.counselor}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive' },
    ]);
  };

  const renderAppointmentCard = ({ item }) => (
    <View style={s.appointmentCard}>
      <View style={s.cardHeader}>
        <View style={s.counselorInfo}>
          <View style={s.avatar}>
            {item.image ? (
              <Text style={s.avatarText}>{item.counselor.charAt(0)}</Text>
            ) : null}
          </View>
          <View style={s.counselorDetails}>
            <Text style={s.counselorName}>{item.counselor}</Text>
            <Text style={s.specialization}>{item.specialization}</Text>
          </View>
        </View>
        <View style={[s.statusBadge, { backgroundColor: activeTab === 'upcoming' ? '#E6F6EC' : '#f1f5f9' }]}>
          <Text style={[s.statusBadgeText, { color: activeTab === 'upcoming' ? PATIENT.primary : '#64748b' }]}>
            {item.status === 'confirmed' ? 'CONFIRMED' : 'COMPLETED'}
          </Text>
        </View>
      </View>

      <View style={s.appointmentDetails}>
        <View style={s.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
          <Text style={s.detailText}>{item.date}</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="time-outline" size={16} color="#94a3b8" />
          <Text style={s.detailText}>{item.time}</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="call-outline" size={16} color="#94a3b8" />
          <Text style={s.detailText}>{item.type}</Text>
        </View>
      </View>

      <View style={s.actionButtons}>
        {item.type === 'Video Call' ? (
          <TouchableOpacity
            style={[s.callButton, s.videoButton]}
            onPress={() => handleVideoCall(item)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="video-outline" size={18} color="#ffffff" />
            <Text style={s.callButtonText}>{t('Video')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.callButton, s.voiceButton]}
            onPress={() => handleVoiceCall(item)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="phone-outline" size={18} color="#ffffff" />
            <Text style={s.callButtonText}>{t('Voice')}</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'upcoming' ? (
          <>
            <TouchableOpacity
              style={[s.secondaryButton, s.rescheduleButton]}
              onPress={() => handleReschedule(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-edit-outline" size={16} color={PATIENT.primary} />
              <Text style={s.secondaryButtonText}>{t('Reschedule')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryButton, s.cancelButton]}
              onPress={() => handleCancel(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close-outline" size={16} color="#ef4444" />
              <Text style={[s.secondaryButtonText, { color: '#ef4444' }]}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[s.secondaryButton, s.rescheduleButton]}
            onPress={() => handleReschedule(item)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="calendar-plus-outline" size={16} color={PATIENT.primary} />
            <Text style={s.secondaryButtonText}>{t('Rebook')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('My Appointments')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabContainer}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'upcoming' && s.tabActive]}
          onPress={() => setActiveTab('upcoming')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'upcoming' && s.tabTextActive]}>{t('Upcoming')}</Text>
          {activeTab === 'upcoming' && <View style={s.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tab, activeTab === 'past' && s.tabActive]}
          onPress={() => setActiveTab('past')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'past' && s.tabTextActive]}>{t('Past')}</Text>
          {activeTab === 'past' && <View style={s.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Appointments List */}
      <FlatList
        data={appointments}
        renderItem={renderAppointmentCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
            <Text style={s.emptyText}>
              {activeTab === 'upcoming' ? t('No upcoming appointments') : t('No past appointments')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    paddingHorizontal: 16,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: PATIENT.primary, fontWeight: '800' },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: PATIENT.primary,
    borderRadius: 1.5,
  },

  listContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eef2f6',
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  counselorInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PATIENT.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  counselorDetails: { flex: 1 },
  counselorName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  specialization: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  appointmentDetails: { gap: 8, marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  actionButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 100,
    justifyContent: 'center',
  },
  videoButton: { backgroundColor: '#2563eb' },
  voiceButton: { backgroundColor: '#00652C' },
  callButtonText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },

  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  rescheduleButton: { borderColor: PATIENT.primary, backgroundColor: '#E6F6EC' },
  cancelButton: { borderColor: '#fecaca', backgroundColor: '#fff5f5' },
  secondaryButtonText: { fontSize: 12, fontWeight: '600', color: PATIENT.primary },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginTop: 12, fontWeight: '500' },
});

export default Appointments;
