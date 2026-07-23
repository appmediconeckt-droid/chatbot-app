import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import axiosInstance from '../../../../../../axiosConfig';
import socketService from '../../../../../../services/socketService';
import PATIENT from '../../../../../../theme/palette';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'message', label: 'Chats' },
];

// Per-type visual identity — icon + accent colour + soft tinted background.
const TYPE_CONFIG = {
  appointment: { icon: 'event',                  color: '#00652C', bg: '#E6F6EC' },
  message:     { icon: 'chat-bubble',            color: '#2563EB', bg: '#E7EEFE' },
  chat:        { icon: 'chat-bubble',            color: '#2563EB', bg: '#E7EEFE' },
  payment:     { icon: 'account-balance-wallet', color: '#7C3AED', bg: '#F3E8FF' },
  wallet:      { icon: 'account-balance-wallet', color: '#7C3AED', bg: '#F3E8FF' },
  call:        { icon: 'call',                   color: '#0D9488', bg: '#CCFBF1' },
  reminder:    { icon: 'notifications-active',   color: '#D97706', bg: '#FEF3C7' },
  system:      { icon: 'info',                   color: '#475569', bg: '#EEF1F5' },
  default:     { icon: 'notifications',          color: '#475569', bg: '#EEF1F5' },
};

const configFor = (type) => TYPE_CONFIG[String(type || '').toLowerCase()] || TYPE_CONFIG.default;

// Normalize whatever shape the backend returns into a stable card model.
const normalize = (n) => {
  const rawType = String(n.type || n.category || 'system').toLowerCase();
  // Fold chat → message so a single filter covers both.
  const type = rawType === 'chat' ? 'message' : rawType;
  return {
    id: String(n._id || n.id || n.notificationId || Math.random()),
    type,
    title: n.title || n.heading || 'Notification',
    body: n.message || n.body || n.content || n.text || '',
    createdAt: n.createdAt || n.time || n.timestamp || new Date().toISOString(),
    read: Boolean(n.isRead ?? n.read ?? false),
    link: n.link || n.data?.link || null,
    raw: n,
  };
};

// "2m", "3h", "5d" — compact relative time, falls back to a date.
const relativeTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const NotificationScreen = ({ onClose, onAction }) => {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/api/notifications');
      const payload = res.data;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notifications)
        ? payload.notifications
        : Array.isArray(payload?.data)
        ? payload.data
        : [];
      const normalized = list.map(normalize).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setItems(normalized);
    } catch (err) {
      console.error('Notifications: fetch failed', err?.response?.status, err?.message);
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Real-time: prepend on a live push, or refetch if the payload is opaque ──
  useEffect(() => {
    let unsubs = [];
    let mounted = true;

    const onPush = (payload) => {
      if (!mounted) return;
      const n = payload?.notification || payload;
      if (n && (n._id || n.id || n.title)) {
        const item = normalize(n);
        setItems((prev) => {
          if (prev.some((p) => p.id === item.id)) return prev;
          return [item, ...prev];
        });
      } else {
        fetchNotifications({ silent: true });
      }
    };

    (async () => {
      try {
        for (const evt of ['notification', 'new-notification', 'notification:new', 'notification-new']) {
          const off = await socketService.on(evt, onPush);
          unsubs.push(off);
        }
      } catch (e) {
        // socket optional — screen still works via pull-to-refresh
      }
    })();

    return () => {
      mounted = false;
      unsubs.forEach((off) => { try { off(); } catch {} });
    };
  }, [fetchNotifications]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => !n.read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  // ── Actions (optimistic, with server sync) ──
  const markRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await axiosInstance.patch(`/api/notifications/${id}/read`);
    } catch (e) {
      console.warn('markRead failed', e?.message);
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await axiosInstance.patch('/api/notifications/read-all');
    } catch (e) {
      console.warn('markAllRead failed', e?.message);
    }
  };

  const removeItem = async (id) => {
    const prev = items;
    setItems((cur) => cur.filter((n) => n.id !== id));
    try {
      await axiosInstance.delete(`/api/notifications/${id}`);
    } catch (e) {
      console.warn('delete failed', e?.message);
      setItems(prev); // rollback on failure
    }
  };

  const handlePress = (n) => {
    if (!n.read) markRead(n.id);
    onAction?.(n);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.surface} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={markAllRead}
          disabled={unreadCount === 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[s.markAll, unreadCount === 0 && s.markAllDisabled]}>Mark all</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={s.chipWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = f.id === 'unread' ? unreadCount : 0;
            return (
              <TouchableOpacity
                key={f.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.85}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[s.chipCount, active && s.chipCountActive]}>
                    <Text style={[s.chipCountText, active && s.chipCountTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PATIENT.primary} />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNotifications({ silent: true }); }}
              colors={[PATIENT.primary]}
              tintColor={PATIENT.primary}
            />
          }
        >
          {error ? (
            <View style={s.empty}>
              <Ionicons name="cloud-offline-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => fetchNotifications()} activeOpacity={0.85}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyText}>You're all caught up.</Text>
            </View>
          ) : (
            visible.map((n) => {
              const cfg = configFor(n.type);
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[s.card, !n.read && s.cardUnread]}
                  activeOpacity={0.85}
                  onPress={() => handlePress(n)}
                >
                  {!n.read && <View style={[s.unreadRail, { backgroundColor: cfg.color }]} />}

                  <View style={[s.cardIcon, { backgroundColor: cfg.bg }]}>
                    <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
                  </View>

                  <View style={s.cardBody}>
                    <View style={s.cardTopRow}>
                      <Text style={[s.cardTitle, !n.read && s.cardTitleUnread]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.read && <View style={[s.unreadDot, { backgroundColor: cfg.color }]} />}
                    </View>
                    {!!n.body && <Text style={s.cardText} numberOfLines={2}>{n.body}</Text>}
                    <View style={s.cardMetaRow}>
                      <Text style={s.cardTime}>{relativeTime(n.createdAt)}</Text>
                      <TouchableOpacity
                        onPress={() => removeItem(n.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
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
  backBtn: { width: 60, alignItems: 'flex-start' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: PATIENT.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  markAll: { fontSize: 13, fontWeight: '700', color: PATIENT.primary, width: 60, textAlign: 'right' },
  markAllDisabled: { color: '#cbd5e1' },

  chipWrap: { backgroundColor: PATIENT.surface, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PATIENT.chipBorder,
    backgroundColor: PATIENT.surface,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: PATIENT.primary, borderColor: PATIENT.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: PATIENT.textSecondary },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },
  chipCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  chipCountText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  chipCountTextActive: { color: '#ffffff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 12 },

  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: PATIENT.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: '#E2E8F0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  unreadRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#334155' },
  cardTitleUnread: { color: '#0f172a', fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardText: { fontSize: 13, color: '#64748b', lineHeight: 19, marginTop: 4 },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardTime: { fontSize: 11.5, color: '#94a3b8', fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  retryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PATIENT.primary,
  },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});

export default NotificationScreen;
