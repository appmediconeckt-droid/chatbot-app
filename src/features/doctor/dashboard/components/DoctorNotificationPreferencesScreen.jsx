import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';

const ALERT_TYPES = [
  { key: 'appointments', icon: 'calendar', title: 'Appointment Reminders', subtitle: 'Notifications for upcoming visits.', default: true },
  { key: 'records', icon: 'file', title: 'Medical Record Updates', subtitle: 'Alerts when new lab results are available.', default: true },
  { key: 'prescriptions', icon: 'pill', title: 'Prescription Alerts', subtitle: 'Refill reminders and pharmacy updates.', default: true },
  { key: 'messages', icon: 'message', title: 'Messaging with Doctors', subtitle: 'New messages from your care team.', default: true },
  { key: 'tips', icon: 'note', title: 'New Health Tips', subtitle: 'General wellness advice and articles.', default: false },
];

const DELIVERY_METHODS = [
  { key: 'push', icon: 'bell', title: 'Push Notifications', default: true },
  { key: 'email', icon: 'mail', title: 'Email', default: true },
  { key: 'sms', icon: 'message', title: 'SMS Text Message', default: false },
];

export default function DoctorNotificationPreferencesScreen({ onBack }) {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState(() =>
    ALERT_TYPES.reduce((acc, item) => ({ ...acc, [item.key]: item.default }), {})
  );
  const [delivery, setDelivery] = useState(() =>
    DELIVERY_METHODS.reduce((acc, item) => ({ ...acc, [item.key]: item.default }), {})
  );
  const [quietHours, setQuietHours] = useState(false);
  const [quietFrom, setQuietFrom] = useState('10:00 PM');
  const [quietTo, setQuietTo] = useState('07:00 AM');

  const toggleAlert = (key, value) => setAlerts((prev) => ({ ...prev, [key]: value }));
  const toggleDelivery = (key, value) => setDelivery((prev) => ({ ...prev, [key]: value }));

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Notification Preference</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Manage how and when the app communicates with you. You can adjust these settings at any time to suit your preferences.
        </Text>

        <Section icon="bell" label="Alert Types">
          {ALERT_TYPES.map((item, index) => (
            <Row
              key={item.key}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              last={index === ALERT_TYPES.length - 1}
              value={alerts[item.key]}
              onValueChange={(v) => toggleAlert(item.key, v)}
            />
          ))}
        </Section>

        <Section icon="send" label="Delivery Methods">
          {DELIVERY_METHODS.map((item, index) => (
            <Row
              key={item.key}
              icon={item.icon}
              title={item.title}
              last={index === DELIVERY_METHODS.length - 1}
              value={delivery[item.key]}
              onValueChange={(v) => toggleDelivery(item.key, v)}
            />
          ))}
        </Section>

        <View style={s.section}>
          <View style={s.quietHeaderRow}>
            <AppIcon name="moon" size={15} color="#667085" strokeWidth={1.9} />
            <Text style={s.sectionLabel}>Quiet Hours</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={quietHours}
              onValueChange={(v) => { setQuietHours(v); showToast(v ? 'Quiet hours enabled' : 'Quiet hours disabled'); }}
              trackColor={{ false: '#D5DAE3', true: '#2DD4BF' }}
              thumbColor="#FFF"
            />
          </View>
          <View style={s.card}>
            <Text style={s.quietDesc}>Pause non-urgent notifications during specific times.</Text>
            <View style={s.quietRow}>
              <View style={s.timeField}>
                <Text style={s.timeLabel}>FROM</Text>
                <Pressable onPress={() => showToast('Time picker — coming soon')} style={s.timeBox}>
                  <Text style={s.timeText}>{quietFrom}</Text>
                </Pressable>
              </View>
              <View style={s.timeField}>
                <Text style={s.timeLabel}>TO</Text>
                <Pressable onPress={() => showToast('Time picker — coming soon')} style={s.timeBox}>
                  <Text style={s.timeText}>{quietTo}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ icon, label, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <AppIcon name={icon} size={15} color="#667085" strokeWidth={1.9} />
        <Text style={s.sectionLabel}>{label}</Text>
      </View>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle, last, value, onValueChange }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <View style={s.rowIcon}>
        <AppIcon name={icon} size={17} color="#0D9488" strokeWidth={1.9} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D5DAE3', true: '#2DD4BF' }}
        thumbColor="#FFF"
      />
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  intro: { fontSize: 13, lineHeight: 19, color: '#667085', marginBottom: 18 },
  section: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginLeft: 2 },
  quietHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginLeft: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C8D1DF',
    borderRadius: 14,
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF1F5', gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', color: '#17243A' },
  rowSubtitle: { fontSize: 12, color: '#667085', marginTop: 2 },
  quietDesc: { fontSize: 12.5, color: '#667085', padding: 14, paddingBottom: 4 },
  quietRow: { flexDirection: 'row', gap: 12, padding: 14, paddingTop: 10 },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: '#9AA6B8', marginBottom: 6 },
  timeBox: { height: 42, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  timeText: { fontSize: 14, fontWeight: '600', color: '#17243A' },
});
