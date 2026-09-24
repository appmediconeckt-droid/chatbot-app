// Patient Requests — real backend: GET /api/chat/pending-requests lists chats
// a patient started that this counsellor hasn't accepted/rejected yet; Accept
// and Reject call the same respondToChatRequest() helper already proven in
// CounselorNotifications.jsx and dashboard.jsx (PATCH /api/chat/accept|reject/:chatId).
// There is no backend concept of patient age/gender/priority/contact/"cancelled"
// history here — those were fabricated in the old mock and have been dropped.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import axiosInstance from '../../../../../../axiosConfig';
import { respondToChatRequest } from '../../../../../../utils/chatRequestActions';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Text from '../../../../../../components/TranslatedText';

const timeAgo = (value) => {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const normalizeRequest = (r) => ({
  id: String(r.id || r.chatId),
  chatId: r.chatId || r.id,
  userId: r.user?.id || null,
  name: r.user?.anonymous || r.user?.name || 'Anonymous User',
  avatar: r.user?.Image || null,
  message: r.requestMessage || '',
  requestedAt: r.requestedAt,
  paymentStatus: String(r.paymentStatus || 'free').toLowerCase(),
  amount: r.amount || 0,
});

const PatientRequests = () => {
  const { t } = useLanguageRender();
  const navigation = useNavigation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.get('/api/chat/pending-requests');
      const list = Array.isArray(data?.requests) ? data.requests : [];
      setRequests(list.map(normalizeRequest));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load patient requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  const respond = async (request, action) => {
    setBusyId(request.id);
    try {
      await respondToChatRequest(request, action);
      setRequests((current) => current.filter((r) => r.id !== request.id));
      if (action === 'accept') {
        navigation.navigate('SMSInput', {
          selectedUser: {
            id: request.chatId,
            _id: request.userId,
            userId: request.userId,
            receiverId: request.userId,
            chatId: request.chatId,
            name: request.name,
            anonymous: request.name,
            avatarUrl: request.avatar,
            status: 'accepted',
          },
          chatId: request.chatId,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || `Failed to ${action} request`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('Patient Requests')}</Text>
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, styles.statPending]}>
            <Text style={styles.statLabel}>{t('Pending')}</Text>
            <Text style={styles.statValue}>{requests.length}</Text>
          </View>
        </View>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.noPatients}>
          <ActivityIndicator color="#667eea" />
        </View>
      ) : (
        <View style={styles.patientsGrid}>
          {requests.length > 0 ? (
            requests.map((request) => {
              const busy = busyId === request.id;
              return (
                <View key={request.id} style={styles.patientCard}>
                  <View style={styles.patientHeader}>
                    <Text style={styles.patientName}>{request.name}</Text>
                    <View
                      style={[
                        styles.paymentBadge,
                        request.paymentStatus === 'paid' ? styles.paymentBadgePaid : styles.paymentBadgeFree,
                      ]}
                    >
                      <Text style={styles.paymentBadgeText}>
                        {request.paymentStatus === 'paid' ? `₹${request.amount}` : t('Free')}
                      </Text>
                    </View>
                  </View>

                  {!!request.message && (
                    <Text style={styles.messagePreview} numberOfLines={2}>{request.message}</Text>
                  )}
                  <Text style={styles.timeText}>{timeAgo(request.requestedAt)}</Text>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.btnAccept, busy && styles.btnDisabled]}
                      onPress={() => respond(request, 'accept')}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                        <Text style={styles.btnAcceptText}>✓ {t('Accept')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnCancel, busy && styles.btnDisabled]}
                      onPress={() => respond(request, 'reject')}
                      disabled={busy}
                    >
                      <Text style={styles.btnCancelText}>✕ {t('Reject')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.noPatients}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color="#c3c9d1" />
              <Text style={styles.noPatientsText}>{t('No pending requests right now.')}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  contentContainer: { padding: 16, paddingBottom: 30 },
  header: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: { fontSize: 22, fontWeight: '600', color: '#333', marginBottom: 20, textAlign: 'center' },
  statsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  statBox: { minWidth: 120, alignItems: 'center', padding: 12, borderRadius: 10 },
  statPending: { backgroundColor: '#f39c12' },
  statLabel: { fontSize: 12, color: 'white', opacity: 0.9, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '700', color: 'white' },

  errorBox: { backgroundColor: '#ffebee', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#c62828', fontSize: 13 },

  patientsGrid: { gap: 16 },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 5,
    borderLeftColor: '#667eea',
  },
  patientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  patientName: { fontSize: 17, fontWeight: '700', color: '#333', flex: 1 },
  paymentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  paymentBadgeFree: { backgroundColor: '#e8f5e8' },
  paymentBadgePaid: { backgroundColor: '#fff3e0' },
  paymentBadgeText: { fontSize: 12, fontWeight: '700', color: '#333' },
  messagePreview: { fontSize: 13.5, color: '#555', lineHeight: 19, marginBottom: 8 },
  timeText: { fontSize: 11.5, color: '#8a94a4', marginBottom: 14 },

  actionButtons: { flexDirection: 'row', gap: 12 },
  btnAccept: { flex: 1, backgroundColor: '#27ae60', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnAcceptText: { color: 'white', fontWeight: '600', fontSize: 14 },
  btnCancel: { flex: 1, backgroundColor: '#e74c3c', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnCancelText: { color: 'white', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },

  noPatients: { alignItems: 'center', padding: 40, backgroundColor: 'white', borderRadius: 15, gap: 10 },
  noPatientsText: { fontSize: 14, color: '#777' },
});

export default PatientRequests;
