// Doctor notification preferences. Saved on this device and applied by
// services/notificationService before it shows a notification (see
// services/notificationPreferences for exactly what can and can't be filtered).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../../../../services/notificationPreferences';

const CATEGORY_ROWS = [
  { key: 'appointments', icon: 'calendar', title: 'Appointments', subtitle: 'New bookings, cancellations, follow-ups and queue updates.' },
  { key: 'messages', icon: 'message', title: 'Patient Messages', subtitle: 'New chat messages from your patients.' },
  { key: 'payments', icon: 'smartphone', title: 'Payments', subtitle: 'Consultation payments and payout updates.' },
  { key: 'system', icon: 'info', title: 'Account & Updates', subtitle: 'Account, security and app announcements.' },
];

const SWITCH_COLORS = { trackColor: { false: '#D5DAE3', true: '#2DD4BF' }, thumbColor: '#FFF' };

const toDate = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const toHHMM = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatTime12h = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function DoctorNotificationPreferencesScreen({ onBack }) {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState(null); // 'from' | 'to' | null
  const loaded = useRef(false);

  useEffect(() => {
    loadNotificationPreferences().then((saved) => {
      setPrefs(saved);
      setLoading(false);
      loaded.current = true;
    });
  }, []);

  // Every change is saved immediately — there is no separate Save button.
  const update = (updater, message) => {
    setPrefs((prev) => {
      const next = updater(prev);
      if (loaded.current) {
        saveNotificationPreferences(next).catch(() => showToast('Could not save preference'));
      }
      return next;
    });
    if (message) showToast(message);
  };

  const setEnabled = (value) => update((p) => ({ ...p, enabled: value }), value ? 'Notifications turned on' : 'Notifications paused');
  const setCategory = (key, value) => update((p) => ({ ...p, categories: { ...p.categories, [key]: value } }));
  const setQuiet = (changes, message) => update((p) => ({ ...p, quietHours: { ...p.quietHours, ...changes } }), message);

  const onPickTime = (event, date) => {
    const field = pickerFor;
    if (Platform.OS === 'android') setPickerFor(null);
    if (event?.type === 'dismissed' || !date || !field) return;
    setQuiet({ [field]: toHHMM(date) });
  };

  if (loading) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color="#0D9488" />
      </View>
    );
  }

  const muted = !prefs.enabled;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Notification Preferences</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Choose which notifications this device shows. Changes are saved automatically. Incoming calls always ring.
        </Text>

        <View style={s.section}>
          <View style={s.card}>
            <View style={[s.row, s.rowLast]}>
              <View style={s.rowIcon}><AppIcon name="bell" size={17} color="#0D9488" strokeWidth={1.9} /></View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Push Notifications</Text>
                <Text style={s.rowSubtitle}>{muted ? 'Paused on this device' : 'On for this device'}</Text>
              </View>
              <Switch value={prefs.enabled} onValueChange={setEnabled} {...SWITCH_COLORS} />
            </View>
          </View>
        </View>

        <Section icon="bell" label="Notify Me About">
          {CATEGORY_ROWS.map((item, index) => (
            <Row
              key={item.key}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              last={index === CATEGORY_ROWS.length - 1}
              value={prefs.categories[item.key]}
              disabled={muted}
              onValueChange={(v) => setCategory(item.key, v)}
            />
          ))}
        </Section>

        <View style={[s.section, muted && s.dimmed]} pointerEvents={muted ? 'none' : 'auto'}>
          <View style={s.sectionHeaderRow}>
            <AppIcon name="moon" size={15} color="#667085" strokeWidth={1.9} />
            <Text style={s.sectionLabel}>Quiet Hours</Text>
            <View style={s.flex} />
            <Switch
              value={prefs.quietHours.enabled}
              onValueChange={(v) => setQuiet({ enabled: v }, v ? 'Quiet hours on' : 'Quiet hours off')}
              {...SWITCH_COLORS}
            />
          </View>
          <View style={s.card}>
            <Text style={s.quietDesc}>Silence all notifications except calls between these times, every day.</Text>
            <View style={[s.quietRow, !prefs.quietHours.enabled && s.dimmed]} pointerEvents={prefs.quietHours.enabled ? 'auto' : 'none'}>
              {['from', 'to'].map((field) => (
                <View key={field} style={s.timeField}>
                  <Text style={s.timeLabel}>{field === 'from' ? 'FROM' : 'TO'}</Text>
                  <Pressable onPress={() => setPickerFor(field)} style={[s.timeBox, pickerFor === field && s.timeBoxActive]}>
                    <AppIcon name="clock" size={14} color="#0D9488" strokeWidth={2} />
                    <Text style={s.timeText}>{formatTime12h(prefs.quietHours[field])}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {pickerFor && Platform.OS === 'ios' && (
              <View style={s.iosPicker}>
                <DateTimePicker value={toDate(prefs.quietHours[pickerFor])} mode="time" display="spinner" onChange={onPickTime} />
                <Pressable onPress={() => setPickerFor(null)} style={s.doneBtn}><Text style={s.doneText}>Done</Text></Pressable>
              </View>
            )}
          </View>
        </View>

        <Pressable onPress={() => Linking.openSettings().catch(() => showToast('Could not open system settings'))} style={s.systemLink}>
          <AppIcon name="smartphone" size={16} color="#0D9488" strokeWidth={1.9} />
          <View style={s.flex}>
            <Text style={s.systemTitle}>System notification settings</Text>
            <Text style={s.systemSub}>Sound, vibration and lock-screen display are controlled by your phone.</Text>
          </View>
          <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />
        </Pressable>
      </ScrollView>

      {pickerFor && Platform.OS === 'android' && (
        <DateTimePicker value={toDate(prefs.quietHours[pickerFor])} mode="time" display="default" onChange={onPickTime} />
      )}
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

function Row({ icon, title, subtitle, last, value, disabled, onValueChange }) {
  return (
    <View style={[s.row, last && s.rowLast, disabled && s.dimmed]}>
      <View style={s.rowIcon}>
        <AppIcon name={icon} size={17} color="#0D9488" strokeWidth={1.9} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} {...SWITCH_COLORS} />
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  dimmed: { opacity: 0.45 },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  intro: { fontSize: 13, lineHeight: 19, color: '#667085', marginBottom: 16 },
  section: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginLeft: 2 },
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
  timeBox: { height: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  timeBoxActive: { borderColor: '#0D9488', borderWidth: 1.5 },
  timeText: { fontSize: 14.5, fontWeight: '700', color: '#17243A' },
  iosPicker: { borderTopWidth: 1, borderTopColor: '#EEF1F5', paddingBottom: 10 },
  doneBtn: { alignSelf: 'flex-end', marginRight: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9, backgroundColor: '#0D9488' },
  doneText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  systemLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14 },
  systemTitle: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  systemSub: { fontSize: 12, color: '#667085', marginTop: 2 },
});
