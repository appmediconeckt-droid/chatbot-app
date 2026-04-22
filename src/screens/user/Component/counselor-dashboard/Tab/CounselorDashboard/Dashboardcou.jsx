import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Dashboard Component – Sirf Dashboard ka data/content
 * Koi side menu nahi, sirf dashboard statistics aur cards
 */
const Dashboard = () => {
  const [loading, setLoading] = useState(true);

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Dashboard statistics data
  const dashboardStats = [
    { title: 'Total Patients', value: '156', icon: '👥', change: '+12%', color: '#4285F4' },
    { title: "Today's Sessions", value: '8', icon: '⏳', change: '+2 today', color: '#0F9D58' },
    { title: 'Appointments', value: '12', icon: '📅', change: '3 urgent', color: '#F4B400' },
    { title: 'Monthly Earnings', value: '₹84.5K', icon: '💰', change: '+18%', color: '#DB4437' },
  ];

  // Recent sessions data
  const recentSessions = [
    { id: 1, patient: 'Rahul Sharma', time: '10:30 AM', type: 'Video Call', status: 'Completed', statusColor: '#0F9D58' },
    { id: 2, patient: 'Priya Patel', time: '11:45 AM', type: 'In-Person', status: 'In Progress', statusColor: '#F4B400' },
    { id: 3, patient: 'Amit Kumar', time: '2:00 PM', type: 'Voice Call', status: 'Scheduled', statusColor: '#4285F4' },
    { id: 4, patient: 'Neha Singh', time: '3:30 PM', type: 'Video Call', status: 'Scheduled', statusColor: '#4285F4' },
    { id: 5, patient: 'Vikram Mehta', time: '5:00 PM', type: 'In-Person', status: 'Scheduled', statusColor: '#4285F4' },
  ];

  // Upcoming appointments
  const upcomingAppointments = [
    { id: 1, patient: 'Sunita Reddy', time: 'Tomorrow, 9:00 AM', type: 'Video Call' },
    { id: 2, patient: 'Arjun Nair', time: 'Tomorrow, 11:30 AM', type: 'In-Person' },
    { id: 3, patient: 'Kavita Joshi', time: 'Wed, 10:00 AM', type: 'Voice Call' },
  ];

  // Recent messages
  const recentMessages = [
    { id: 1, sender: 'Anjali Desai', preview: 'When can we schedule next session?', time: '5 min ago', unread: true },
    { id: 2, sender: 'Rohan Mehra', preview: "Thank you for yesterday's session", time: '2 hours ago', unread: false },
    { id: 3, sender: 'Dr. Gupta', preview: 'Case notes for patient referral', time: 'Yesterday', unread: false },
  ];

  // Weekly schedule
  const weeklySchedule = [
    { day: 'Mon', sessions: 6, patients: 8 },
    { day: 'Tue', sessions: 4, patients: 6 },
    { day: 'Wed', sessions: 8, patients: 10 },
    { day: 'Thu', sessions: 5, patients: 7 },
    { day: 'Fri', sessions: 7, patients: 9 },
    { day: 'Sat', sessions: 3, patients: 4 },
  ];

  // Get current date formatted
  const getFormattedDate = () => {
    const date = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-IN', options);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={Platform.OS === 'android'} />
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header Section - Transparent with proper padding for status bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeTitle}>Welcome back, Dr. Sharma 👋</Text>
            <Text style={styles.dateInfo}>{getFormattedDate()}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]}>
              <Text style={styles.primaryBtnText}>+ New Session</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          {dashboardStats.map((stat, index) => (
            <View 
              key={index} 
              style={[styles.statCard, { borderLeftColor: stat.color }]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
                <Text style={[styles.statIconText, { color: stat.color }]}>{stat.icon}</Text>
              </View>
              <View style={styles.statDetails}>
                <Text style={styles.statLabel}>{stat.title}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={[styles.statChange, { color: stat.color }]}>{stat.change}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Main Grid - 2 Columns Layout */}
        <View style={styles.dashboardGrid}>
          {/* Left Column */}
          <View style={styles.gridLeft}>
            {/* Recent Sessions Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Sessions</Text>
                <TouchableOpacity>
                  <Text style={styles.viewLink}>View All →</Text>
                </TouchableOpacity>
              </View>
              
              {recentSessions.map((session) => (
                <TouchableOpacity key={session.id} style={styles.sessionItem}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.patientName}>{session.patient}</Text>
                    <Text style={styles.sessionTime}>{session.time}</Text>
                    <Text style={styles.sessionType}>{session.type}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: session.statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: session.statusColor }]}>
                      {session.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weekly Overview Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Weekly Overview</Text>
                <TouchableOpacity>
                  <Text style={styles.viewLink}>Details →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.weeklyGrid}>
                {weeklySchedule.map((day) => (
                  <View key={day.day} style={styles.dayCard}>
                    <Text style={styles.dayName}>{day.day}</Text>
                    <Text style={styles.daySessions}>{day.sessions} sessions</Text>
                    <Text style={styles.dayPatients}>{day.patients} patients</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Right Column */}
          <View style={styles.gridRight}>
            {/* Upcoming Appointments Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Upcoming Appointments</Text>
                <TouchableOpacity>
                  <Text style={styles.viewLink}>Schedule →</Text>
                </TouchableOpacity>
              </View>
              {upcomingAppointments.map((apt) => (
                <TouchableOpacity key={apt.id} style={styles.appointmentItem}>
                  <View style={styles.appointmentIcon}>
                    <Text style={styles.appointmentIconText}>📅</Text>
                  </View>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.appointmentPatient}>{apt.patient}</Text>
                    <Text style={styles.appointmentTime}>{apt.time}</Text>
                    <View style={styles.appointmentTypeBadge}>
                      <Text style={styles.appointmentTypeText}>{apt.type}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Messages Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Messages</Text>
                <View style={styles.messageCountBadge}>
                  <Text style={styles.messageCountText}>1 new</Text>
                </View>
              </View>
              {recentMessages.map((msg) => (
                <TouchableOpacity key={msg.id} style={[styles.messageItem, msg.unread && styles.unreadMessage]}>
                  <View style={styles.messageAvatar}>
                    <Text style={styles.messageAvatarText}>{msg.sender.charAt(0)}</Text>
                  </View>
                  <View style={styles.messageContent}>
                    <Text style={styles.messageSender}>{msg.sender}</Text>
                    <Text style={styles.messagePreview}>{msg.preview}</Text>
                    <Text style={styles.messageTime}>{msg.time}</Text>
                  </View>
                  {msg.unread && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Actions Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Quick Actions</Text>
              </View>
              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickActionBtn}>
                  <Text style={styles.quickActionIcon}>📝</Text>
                  <Text style={styles.quickActionText}>Add Notes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn}>
                  <Text style={styles.quickActionIcon}>💰</Text>
                  <Text style={styles.quickActionText}>Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn}>
                  <Text style={styles.quickActionIcon}>📊</Text>
                  <Text style={styles.quickActionText}>Reports</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn}>
                  <Text style={styles.quickActionIcon}>👥</Text>
                  <Text style={styles.quickActionText}>New Patient</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 30,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  // Header Styles - Transparent, no background color
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
    flexWrap: 'wrap',
    backgroundColor: 'transparent', // Transparent background
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  dateInfo: {
    fontSize: 13,
    color: '#666',
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Statistics Cards
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    width: screenWidth > 768 ? '23%' : screenWidth > 480 ? '48%' : '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconText: {
    fontSize: 24,
  },
  statDetails: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statChange: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Dashboard Grid
  dashboardGrid: {
    flexDirection: screenWidth > 768 ? 'row' : 'column',
    gap: 20,
  },
  gridLeft: {
    flex: 1.5,
  },
  gridRight: {
    flex: 1,
  },
  // Card Styles
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  viewLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  // Session Item
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  sessionInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  sessionType: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Weekly Grid
  weeklyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayCard: {
    width: screenWidth > 480 ? '15%' : '30%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  daySessions: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 2,
  },
  dayPatients: {
    fontSize: 10,
    color: '#64748b',
  },
  // Appointment Item
  appointmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  appointmentIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appointmentIconText: {
    fontSize: 20,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentPatient: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  appointmentTime: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  appointmentTypeBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  appointmentTypeText: {
    fontSize: 10,
    color: '#2563eb',
    fontWeight: '600',
  },
  // Message Item
  messageItem: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
    position: 'relative',
  },
  unreadMessage: {
    backgroundColor: '#f0f9ff',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  messageAvatar: {
    width: 44,
    height: 44,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  messageContent: {
    flex: 1,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  messagePreview: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  messageCountBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
  },
  messageCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  unreadDot: {
    width: 8,
    height: 8,
    backgroundColor: '#2563eb',
    borderRadius: 4,
    position: 'absolute',
    right: 0,
    top: 18,
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionBtn: {
    width: screenWidth > 480 ? '48%' : '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
});

export default Dashboard;