import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, { API_BASE_URL } from '../../../../../../axiosConfig';
import { io } from 'socket.io-client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [counselorName, setCounselorName] = useState('');
  const socketRef = useRef(null);

  const getToken = async () =>
    (await AsyncStorage.getItem('accessToken')) ||
    (await AsyncStorage.getItem('token'));

  const getCounsellorId = async () =>
    (await AsyncStorage.getItem('counsellorId')) ||
    (await AsyncStorage.getItem('counselorId'));

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const counsellorId = await getCounsellorId();

      if (counsellorId) {
        try {
          const profileRes = await axiosInstance.get(`${API_BASE_URL}/api/auth/getCounsellor/${counsellorId}`);
          const name = profileRes.data?.counsellor?.fullName || profileRes.data?.fullName || '';
          setCounselorName(name);
        } catch (_) {}
      }

      const aptRes = await axiosInstance.get(`${API_BASE_URL}/api/appointments`);
      const data = Array.isArray(aptRes.data)
        ? aptRes.data
        : Array.isArray(aptRes.data?.appointments)
        ? aptRes.data.appointments
        : Array.isArray(aptRes.data?.data)
        ? aptRes.data.data
        : [];
      setAppointments(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const connectSocket = async () => {
      const token = await getToken();
      const counsellorId = await getCounsellorId();
      if (!token) return;

      const socket = io(API_BASE_URL, {
        transports: ['polling', 'websocket'],
        auth: { token },
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (counsellorId) socket.emit('join-counsellor-room', { counsellorId });
      });

      const refresh = () => fetchData(true);
      // Cover all possible event names the backend may emit
      socket.on('appointment-booked', refresh);
      socket.on('appointment-new', refresh);
      socket.on('appointment-updated', refresh);
      socket.on('appointment-confirmed', refresh);
      socket.on('appointment-cancelled', refresh);
      socket.on('appointment-status-changed', refresh);
      socket.on('new-appointment', refresh);
    };

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [fetchData]);

  // Use start-of-today so appointments earlier today are included
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingApts = appointments
    .filter((a) => {
      const s = (a.status || '').toLowerCase();
      return s !== 'canceled' && s !== 'cancelled' && s !== 'completed';
    })
    .filter((a) => new Date(a.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const pendingCount = appointments.filter((a) => (a.status || '').toLowerCase() === 'pending').length;
  const confirmedCount = appointments.filter((a) => (a.status || '').toLowerCase() === 'confirmed').length;
  const totalCount = appointments.length;

  const getFormattedDate = () =>
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatAptTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const todayDate = new Date();
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(todayDate.getDate() + 1);
    const isToday = d.toDateString() === todayDate.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    if (isTomorrow) return `Tomorrow, ${time}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${time}`;
  };

  const getUserName = (apt) =>
    apt?.user?.fullName || apt?.user?.name || apt?.user?.anonymous ||
    apt?.patient?.fullName || apt?.patient?.name || 'Patient';

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return { bg: '#dcfce7', text: '#16a34a' };
    if (s === 'canceled' || s === 'cancelled') return { bg: '#fee2e2', text: '#b91c1c' };
    return { bg: '#fff4e5', text: '#c2410c' };
  };

  const stats = [
    { label: 'Total', value: String(totalCount), icon: 'event-note', color: '#4f46e5', bg: '#ede9fe' },
    { label: 'Pending', value: String(pendingCount), icon: 'hourglass-empty', color: '#c2410c', bg: '#fff4e5' },
    { label: 'Confirmed', value: String(confirmedCount), icon: 'check-circle', color: '#16a34a', bg: '#dcfce7' },
  ];

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4ff" translucent={false} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            colors={['#4f46e5']}
            tintColor="#4f46e5"
          />
        }
      >
        {/* Welcome */}
        <View style={styles.welcomeBlock}>
          <View style={styles.welcomeTextWrap}>
            <Text style={styles.welcomeTitle}>
              Welcome back{counselorName ? `,` : ''}{'\n'}
              {counselorName ? <Text style={styles.welcomeName}>{counselorName} 👋</Text> : '👋'}
            </Text>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
          </View>
        </View>

        {/* Stats row — full width, equal flex columns */}
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <View style={[styles.statIconBox, { backgroundColor: s.color + '22' }]}>
                <MaterialIcons name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleIcon}>
                <MaterialIcons name="event" size={16} color="#4f46e5" />
              </View>
              <Text style={styles.cardTitle}>Upcoming Sessions</Text>
            </View>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </View>

          {upcomingApts.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="event-available" size={36} color="#c7d2fe" />
              <Text style={styles.emptyText}>No upcoming sessions</Text>
            </View>
          ) : (
            upcomingApts.map((apt, idx) => {
              const aptId = apt._id || apt.id || idx;
              const sc = getStatusStyle(apt.status);
              return (
                <View key={aptId} style={[styles.aptRow, idx === 0 && styles.aptRowFirst]}>
                  <View style={styles.aptAvatar}>
                    <Text style={styles.aptAvatarText}>
                      {(getUserName(apt).charAt(0) || 'P').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.aptInfo}>
                    <Text style={styles.aptPatient} numberOfLines={1}>{getUserName(apt)}</Text>
                    <View style={styles.aptTimeLine}>
                      <MaterialIcons name="access-time" size={11} color="#94a3b8" />
                      <Text style={styles.aptTime}>{formatAptTime(apt.date)}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusPillText, { color: sc.text }]}>
                      {(apt.status || 'pending').charAt(0).toUpperCase() + (apt.status || 'pending').slice(1)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleIcon}>
                <MaterialIcons name="flash-on" size={16} color="#4f46e5" />
              </View>
              <Text style={styles.cardTitle}>Quick Actions</Text>
            </View>
          </View>
          <View style={styles.quickGrid}>
            {[
              { icon: 'note-add', label: 'Add Notes', color: '#4f46e5', bg: '#ede9fe' },
              { icon: 'receipt', label: 'Invoice', color: '#16a34a', bg: '#dcfce7' },
              { icon: 'bar-chart', label: 'Reports', color: '#c2410c', bg: '#fff4e5' },
              { icon: 'person-add', label: 'New Patient', color: '#0369a1', bg: '#e0f2fe' },
            ].map((q) => (
              <TouchableOpacity key={q.label} style={[styles.quickBtn, { backgroundColor: q.bg }]}>
                <View style={[styles.quickIconBox, { backgroundColor: q.color + '22' }]}>
                  <MaterialIcons name={q.icon} size={22} color={q.color} />
                </View>
                <Text style={[styles.quickLabel, { color: q.color }]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
};

const CARD_PADDING = 16;
const CONTENT_H_PAD = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  content: {
    paddingHorizontal: CONTENT_H_PAD,
    paddingBottom: 48,
    paddingTop: 16,
    gap: 14,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
  },

  // Welcome
  welcomeBlock: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  welcomeTextWrap: {
    gap: 6,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c7d2fe',
    lineHeight: 22,
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  dateText: {
    fontSize: 12,
    color: '#a5b4fc',
    fontWeight: '500',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    opacity: 0.75,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: CARD_PADDING,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  pendingBadge: {
    backgroundColor: '#fff4e5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pendingBadgeText: {
    fontSize: 11,
    color: '#c2410c',
    fontWeight: '700',
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },

  // Appointment row
  aptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  aptRowFirst: {
    borderTopWidth: 0,
  },
  aptAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aptAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4f46e5',
  },
  aptInfo: {
    flex: 1,
    gap: 4,
  },
  aptPatient: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  aptTimeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aptTime: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Quick actions — flex so they fill full width
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickBtn: {
    // Each button takes exactly half the available card width minus half the gap
    width: (screenWidth - CONTENT_H_PAD * 2 - CARD_PADDING * 2 - 10) / 2,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  quickIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Dashboard;
