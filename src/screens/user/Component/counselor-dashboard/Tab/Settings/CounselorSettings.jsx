import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

const SECTIONS = [
  {
    title: 'Account',
    items: [
      {
        id: 'profile',
        icon: 'user',
        iconBg: '#eef1ff',
        iconColor: '#2c50cd',
        label: 'Edit Profile',
        subtitle: 'Personal & professional details',
      },
      {
        id: 'change_password',
        icon: 'lock',
        iconBg: '#fff7ed',
        iconColor: '#f97316',
        label: 'Change Password',
        subtitle: 'Update your login password',
      },
      {
        id: 'availability',
        icon: 'calendar',
        iconBg: '#f0fdf4',
        iconColor: '#16a34a',
        label: 'Availability Schedule',
        subtitle: 'Set your working hours & days',
      },
      {
        id: 'consultation_mode',
        icon: 'video',
        iconBg: '#fdf4ff',
        iconColor: '#9333ea',
        label: 'Consultation Mode',
        subtitle: 'Online, in-person or both',
      },
    ],
  },
  {
    title: 'Privacy & Security',
    items: [
      {
        id: 'two_factor',
        icon: 'shield',
        iconBg: '#f0fdf4',
        iconColor: '#16a34a',
        label: 'Two-Factor Authentication',
        subtitle: 'Add an extra layer of security',
      },
      {
        id: 'active_sessions',
        icon: 'monitor',
        iconBg: '#eef1ff',
        iconColor: '#2c50cd',
        label: 'Active Sessions',
        subtitle: 'Manage your logged-in devices',
      },
      {
        id: 'anonymous_mode',
        icon: 'eye-off',
        iconBg: '#fff7ed',
        iconColor: '#f97316',
        label: 'Anonymous Patient Names',
        subtitle: 'Always show anonymous names',
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        id: 'help',
        icon: 'help-circle',
        iconBg: '#eef1ff',
        iconColor: '#2c50cd',
        label: 'Help & FAQ',
        subtitle: 'Common questions & guides',
      },
      {
        id: 'contact',
        icon: 'mail',
        iconBg: '#f0fdf4',
        iconColor: '#16a34a',
        label: 'Contact Support',
        subtitle: 'Reach our support team',
      },
      {
        id: 'feedback',
        icon: 'edit-2',
        iconBg: '#fdf4ff',
        iconColor: '#9333ea',
        label: 'Send Feedback',
        subtitle: 'Help us improve the app',
      },
    ],
  },
  {
    title: 'Legal',
    items: [
      {
        id: 'terms',
        icon: 'file-text',
        iconBg: '#f8fafc',
        iconColor: '#64748b',
        label: 'Terms & Conditions',
        subtitle: 'Read our terms of service',
      },
      {
        id: 'privacy',
        icon: 'lock',
        iconBg: '#f8fafc',
        iconColor: '#64748b',
        label: 'Privacy Policy',
        subtitle: 'How we handle your data',
      },
    ],
  },
];

const CounselorSettings = ({ onNavigate, onLogout }) => {

  const handlePress = (id) => {
    if (id === 'profile') { onNavigate?.('profile'); return; }
    if (id === 'contact') { Linking.openURL('mailto:support@mediconnect.com'); return; }
    Alert.alert('Coming Soon', 'This feature will be available in the next update.');
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>Manage your account & preferences</Text>
      </View>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.row,
                  idx < section.items.length - 1 && styles.rowDivider,
                ]}
                onPress={() => handlePress(item.id)}
                activeOpacity={0.65}
              >
                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                  <Feather name={item.icon} size={18} color={item.iconColor} />
                </View>

                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowSub}>{item.subtitle}</Text>
                </View>

                <Feather name="chevron-right" size={16} color="#d1d5db" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* App version card */}
      <View style={styles.versionCard}>
        <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
          <Feather name="info" size={18} color="#94a3b8" />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>App Version</Text>
          <Text style={styles.rowSub}>Mediconnect Counselor v1.0.0</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={onLogout}
        activeOpacity={0.8}
      >
        <View style={styles.signOutInner}>
          <Feather name="log-out" size={18} color="#e53935" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2025 Mediconnect. All rights reserved.</Text>
    </ScrollView>
  );
};

export default CounselorSettings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    paddingBottom: 48,
  },

  /* ── Header ── */
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'Manrope',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'Manrope',
    color: '#94a3b8',
    marginTop: 3,
  },

  /* ── Section ── */
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Manrope',
    color: '#94a3b8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 6,
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8ecf0',
  },

  /* ── Row ── */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope',
    color: '#0f172a',
  },
  rowSub: {
    fontSize: 12,
    fontFamily: 'Manrope',
    color: '#94a3b8',
    marginTop: 2,
  },

  /* ── Version Card ── */
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8ecf0',
    marginTop: 8,
    marginBottom: 24,
  },

  /* ── Sign Out ── */
  signOutBtn: {
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 20,
    overflow: 'hidden',
  },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Manrope',
    color: '#e53935',
  },

  /* ── Footer ── */
  footer: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Manrope',
    color: '#cbd5e1',
    marginBottom: 8,
  },
});
