// Notifications — opened from the bell icon in DoctorHeader.
// Data source: real backend — GET/PATCH/DELETE /api/notifications, the exact
// same endpoints already used by the patient-side NotificationScreen.jsx.
// The old mock had rich, hand-written per-item content (custom "lines",
// quotes, and action buttons like "Call Patient"/"Reschedule" per category) —
// none of that exists in the real notification payload (just
// title/message/type/read/createdAt), so cards are now one consistent shape
// driven by real fields. Category counts/filters are computed from the real
// `type` field instead of being hardcoded.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import axiosInstance from '../../../../axiosConfig';

const FILTERS = ['All', 'Urgent', 'Appointments', 'Messages'];
const TONE_COLORS = { red: '#D2564B', blue: colors.blue, amber: '#B7791F' };

const toneForType = (type) => {
  const t = String(type || '').toLowerCase();
  if (['urgent', 'emergency', 'critical', 'alert'].includes(t)) return 'red';
  if (['appointment', 'appointments', 'booking'].includes(t)) return 'blue';
  if (['message', 'chat', 'reply'].includes(t)) return 'amber';
  return 'blue';
};
const categoryForType = (type) => {
  const tone = toneForType(type);
  if (tone === 'red') return 'Urgent';
  if (tone === 'amber') return 'Messages';
  return 'Appointments';
};
const iconForTone = { red: 'warning', blue: 'calendar', amber: 'message' };

const relativeTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const normalize = (n) => {
  const type = n.type || n.category || 'appointment';
  return {
    id: String(n._id || n.id),
    tone: toneForType(type),
    category: categoryForType(type),
    icon: iconForTone[toneForType(type)],
    title: n.title || n.heading || 'Notification',
    body: n.message || n.body || n.content || '',
    time: relativeTime(n.createdAt || n.time),
    read: Boolean(n.isRead ?? n.read ?? false),
  };
};

export default function NotificationsScreen({ onBack }) {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/api/notifications');
      const payload = res.data;
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.notifications) ? payload.notifications : Array.isArray(payload?.data) ? payload.data : [];
      setNotifications(list.map(normalize));
    } catch (err) {
      console.error('Error fetching doctor notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const visible = filter === 'All' ? notifications : notifications.filter((item) => item.category === filter);
  const counts = {
    Urgent: notifications.filter((n) => n.category === 'Urgent').length,
    Appointments: notifications.filter((n) => n.category === 'Appointments').length,
    Messages: notifications.filter((n) => n.category === 'Messages').length,
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await axiosInstance.patch('/api/notifications/read-all');
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const markRead = async (id) => {
    setNotifications((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await axiosInstance.patch(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const removeNotification = async (id) => {
    const prev = notifications;
    setNotifications((cur) => cur.filter((n) => n.id !== id));
    try {
      await axiosInstance.delete(`/api/notifications/${id}`);
    } catch (err) {
      console.error('Error deleting notification:', err);
      setNotifications(prev);
      showToast('Could not delete notification');
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.grow}>
          <Text style={s.title}>Notifications</Text>
          <Text style={s.subtitle}>You have {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.statsRow}>
          <StatCard icon="warning" tone="red" value={String(counts.Urgent)} label="Urgent" />
          <StatCard icon="calendar" tone="blue" value={String(counts.Appointments)} label="Appointments" />
          <StatCard icon="message" tone="amber" value={String(counts.Messages)} label="Messages" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {FILTERS.map((item) => {
            const active = filter === item;
            return (
              <Pressable key={item} onPress={() => setFilter(item)} style={[s.filterChip, active && s.filterChipActive]}>
                <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Recent</Text>
          <Pressable onPress={markAllRead} hitSlop={6} style={s.markAllRow}>
            <AppIcon name="check-mark" size={13} color={colors.blue} strokeWidth={2.6} />
            <Text style={s.markAllText}>Mark all read</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={s.empty}><Text style={s.emptyText}>Loading notifications...</Text></View>
        ) : visible.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyText}>No notifications in this filter.</Text></View>
        ) : (
          visible.map((item) => (
            <NotificationCard key={item.id} item={item} onOpen={() => markRead(item.id)} onDelete={() => removeNotification(item.id)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, tone, value, label }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, s[`statIcon_${tone}`]]}>
        <AppIcon name={icon} size={16} color={TONE_COLORS[tone]} strokeWidth={2} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function NotificationCard({ item, onOpen, onDelete }) {
  return (
    <Pressable onPress={onOpen} style={s.card}>
      <View style={[s.accentBar, s[`accent_${item.tone}`]]} />
      <View style={s.cardTopRow}>
        <View style={[s.cardIcon, s[`statIcon_${item.tone}`]]}>
          <AppIcon name={item.icon} size={17} color={TONE_COLORS[item.tone]} strokeWidth={2} />
        </View>
        <View style={s.grow}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle}>{item.title}</Text>
          </View>
          <Text style={s.cardTime}>{item.time}</Text>
        </View>
        {!item.read && <View style={s.unreadDot} />}
        <Pressable onPress={onDelete} hitSlop={8} style={s.deleteBtn}>
          <AppIcon name="trash" size={14} color="#8A94A4" strokeWidth={1.9} />
        </Pressable>
      </View>

      {!!item.body && <Text style={s.cardBody}>{item.body}</Text>}
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { minHeight: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 },
  backButton: { width: 30, height: 38, alignItems: 'flex-start', justifyContent: 'center', marginRight: 6 },
  grow: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: colors.blue },
  subtitle: { fontSize: 12.5, color: '#667085', marginTop: 2 },

  scrollArea: { flex: 1 },
  content: { padding: 14, paddingBottom: 30 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 12, padding: 12, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statIcon_red: { backgroundColor: '#FDF1F1' },
  statIcon_blue: { backgroundColor: colors.paleBlue },
  statIcon_amber: { backgroundColor: '#FFF6E5' },
  statValue: { fontSize: 19, fontWeight: '800', color: '#17243A' },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: '#667085', marginTop: 1 },

  filters: { gap: 8, paddingBottom: 16 },
  filterChip: { height: 34, borderRadius: 17, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE3EC' },
  filterChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#526078' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: '#17243A' },
  markAllRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  markAllText: { fontSize: 13, fontWeight: '700', color: colors.blue },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E6EE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  accent_red: { backgroundColor: '#D2564B' },
  accent_blue: { backgroundColor: colors.blue },
  accent_amber: { backgroundColor: colors.amber },

  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  cardTime: { fontSize: 12, color: '#8A94A4', marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue, marginTop: 4 },
  deleteBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

  cardBody: { fontSize: 13.5, lineHeight: 19, color: '#526078', marginTop: 6, marginLeft: 46 },

  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#8E9DB0' },
});
