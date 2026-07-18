import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import PATIENT from '../../../../../../theme/palette';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'chat', label: 'Chats' },
];

// Sample feed — replace `data` with a real notifications API when available.
const SEED = [
  {
    id: 'n1',
    type: 'appointment',
    icon: 'event',
    iconColor: '#00652C',
    iconBg: '#E6F6EC',
    title: 'Upcoming Session',
    time: 'Today • 10:30 AM',
    body: 'Your appointment with Dr. Emily Chen starts in 30 minutes.',
    unread: true,
    action: { label: 'Join Session', kind: 'primary' },
  },
  {
    id: 'n2',
    type: 'chat',
    icon: 'chat',
    iconColor: '#2563EB',
    iconBg: '#E7EEFE',
    title: 'New Message',
    time: '2 mins ago',
    body: 'Dr. Emily Chen sent you a message: "Your reports look normal."',
    unread: true,
  },
  {
    id: 'n3',
    type: 'ai',
    icon: 'auto-awesome',
    iconColor: '#64748B',
    iconBg: '#EEF1F5',
    title: 'AI Wellness Assistant',
    time: '1 hr ago',
    body: 'Your daily mindfulness exercise is ready.',
    action: { label: 'Open AI Chat', kind: 'outline' },
  },
];

const NotificationScreen = ({ onClose, onAction }) => {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(SEED);

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })));

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => n.unread);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.surface} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notification</Text>
        <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.markAll}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipScroll}
        contentContainerStyle={s.chipRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilter(f.id)}
              activeOpacity={0.85}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Feed */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={40} color="#cbd5e1" />
            <Text style={s.emptyText}>You're all caught up.</Text>
          </View>
        ) : (
          visible.map((n) => (
            <View key={n.id} style={s.card}>
              <View style={[s.cardIcon, { backgroundColor: n.iconBg }]}>
                <MaterialIcons name={n.icon} size={20} color={n.iconColor} />
              </View>

              <View style={s.cardBody}>
                <View style={s.cardTopRow}>
                  <Text style={s.cardTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={s.cardTime}>{n.time}</Text>
                  {n.unread && <View style={s.unreadDot} />}
                </View>
                <Text style={s.cardText}>{n.body}</Text>

                {n.action ? (
                  <TouchableOpacity
                    style={n.action.kind === 'primary' ? s.btnPrimary : s.btnOutline}
                    activeOpacity={0.88}
                    onPress={() => onAction?.(n)}
                  >
                    <Text style={n.action.kind === 'primary' ? s.btnPrimaryText : s.btnOutlineText}>
                      {n.action.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 6,
    paddingBottom: 12,
    backgroundColor: PATIENT.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  markAll: { fontSize: 13, fontWeight: '700', color: PATIENT.primary },

  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PATIENT.chipBorder,
    backgroundColor: PATIENT.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: PATIENT.primary, borderColor: PATIENT.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: PATIENT.textSecondary },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },

  scroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 12 },

  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: PATIENT.surface,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  cardTime: { fontSize: 11.5, color: '#94a3b8', fontWeight: '500' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PATIENT.primary,
  },
  cardText: { fontSize: 13, color: '#64748b', lineHeight: 19, marginTop: 5 },

  btnPrimary: {
    alignSelf: 'flex-start',
    backgroundColor: PATIENT.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 12,
  },
  btnPrimaryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  btnOutline: {
    alignSelf: 'flex-start',
    borderWidth: 1.4,
    borderColor: PATIENT.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 12,
    backgroundColor: PATIENT.surface,
  },
  btnOutlineText: { color: PATIENT.primary, fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
});

export default NotificationScreen;
