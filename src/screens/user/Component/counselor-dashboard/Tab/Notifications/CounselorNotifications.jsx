import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Text from '../../../../../../components/TranslatedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import axiosInstance from '../../../../../../axiosConfig';
import socketService from '../../../../../../services/socketService';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

// Counselor-side palette (blue).
const C = {
  primary: '#2563EB',
  bg: '#F1F5F9',
  surface: '#FFFFFF',
  text: '#0F172A',
  textSub: '#64748B',
  muted: '#94A3B8',
  border: '#EEF2F6',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'requests', label: 'Requests' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'payment', label: 'Payments' },
];

// Per-type icon + accent + tint.
const TYPE_CONFIG = {
  appointment: { icon: 'event',                  color: '#2563EB', bg: '#EFF6FF' },
  booking:     { icon: 'event-available',        color: '#2563EB', bg: '#EFF6FF' },
  payment:     { icon: 'account-balance-wallet', color: '#16A34A', bg: '#DCFCE7' },
  payout:      { icon: 'payments',               color: '#16A34A', bg: '#DCFCE7' },
  message:     { icon: 'chat-bubble',            color: '#7C3AED', bg: '#F3E8FF' },
  chat:        { icon: 'chat-bubble',            color: '#7C3AED', bg: '#F3E8FF' },
  call:        { icon: 'call',                   color: '#004AC6', bg: '#E7EEFE' },
  reminder:    { icon: 'notifications-active',   color: '#D97706', bg: '#FEF3C7' },
  system:      { icon: 'info',                   color: '#475569', bg: '#EEF1F5' },
  default:     { icon: 'notifications',          color: '#475569', bg: '#EEF1F5' },
};
const configFor = (type) => TYPE_CONFIG[String(type || '').toLowerCase()] || TYPE_CONFIG.default;

const relativeTime = (iso, t = (s) => s) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t('Just now');
  if (mins < 60) return `${mins}${t('m ago')}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t('h ago')}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}${t('d ago')}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const resolvePhoto = (user) => {
  const raw = user?.Image || user?.image || user?.profilePhoto || user?.avatar;
  if (!raw) return null;
  const uri = typeof raw === 'string' ? raw : raw.secure_url || raw.url;
  return uri ? String(uri) : null;
};

const initialsOf = (name) =>
  String(name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

// ── Normalizers ──────────────────────────────────────────────────────────────
const normalizeNotification = (n) => {
  const rawType = String(n.type || n.category || 'system').toLowerCase();
  return {
    kind: 'notification',
    id: String(n._id || n.id || n.notificationId || Math.random()),
    type: rawType === 'chat' ? 'message' : rawType,
    title: n.title || n.heading || 'Notification', // fallback only; translated at render
    body: n.message || n.body || n.content || n.text || '',
    createdAt: n.createdAt || n.time || n.timestamp || new Date().toISOString(),
    read: Boolean(n.isRead ?? n.read ?? false),
  };
};

const normalizeRequest = (r) => ({
  kind: 'request',
  id: String(r.id || r.chatId),
  chatId: r.chatId,
  type: 'request',
  user: r.user,
  message: r.requestMessage || '',
  createdAt: r.requestedAt || new Date().toISOString(),
  paymentStatus: String(r.paymentStatus || 'free').toLowerCase(),
  amount: r.amount ?? 0,
  read: false,
});

const CounselorNotifications = ({ onClose, onChanged, onOpenChat, onAction }) => {
  const { t } = useLanguageRender();
  const [filter, setFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [reqRes, notifRes] = await Promise.allSettled([
        axiosInstance.get('/api/chat/pending-requests'),
        axiosInstance.get('/api/notifications', { params: { page: 1, limit: 100 } }),
      ]);

      if (reqRes.status === 'fulfilled') {
        const list = Array.isArray(reqRes.value.data?.requests) ? reqRes.value.data.requests : [];
        setRequests(list.map(normalizeRequest));
      }

      if (notifRes.status === 'fulfilled') {
        const p = notifRes.value.data;
        const list = Array.isArray(p)
          ? p
          : Array.isArray(p?.notifications)
          ? p.notifications
          : Array.isArray(p?.data)
          ? p.data
          : [];
        setNotifications(list.map(normalizeNotification));
      }

      if (reqRes.status === 'rejected' && notifRes.status === 'rejected') {
        setError('Could not load notifications.');
      }
    } catch (e) {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time: refetch on any incoming request/notification event.
  useEffect(() => {
    let unsubs = [];
    let mounted = true;
    const refresh = () => { if (mounted) fetchAll({ silent: true }); };
    (async () => {
      try {
        const events = [
          'notification', 'new-notification', 'notification:new', 'notification-new',
          'chat-request', 'new-chat-request', 'chatRequest', 'request-received',
          'appointment-booked', 'appointment-new',
        ];
        for (const evt of events) unsubs.push(await socketService.on(evt, refresh));
      } catch (e) { /* socket optional */ }
    })();
    return () => {
      mounted = false;
      unsubs.forEach((off) => { try { off(); } catch {} });
    };
  }, [fetchAll]);

  const unreadCount = useMemo(
    () => requests.length + notifications.filter((n) => !n.read).length,
    [requests, notifications]
  );

  // Merge + filter for the active tab.
  const visible = useMemo(() => {
    let list;
    if (filter === 'requests') list = [...requests];
    else if (filter === 'all') list = [...requests, ...notifications];
    else list = notifications.filter((n) => n.type === filter);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filter, requests, notifications]);

  const countFor = (id) => {
    if (id === 'requests') return requests.length;
    if (id === 'all') return unreadCount;
    return notifications.filter((n) => n.type === id && !n.read).length;
  };

  // ── Actions ──
  const respond = async (item, action) => {
    if (!item.chatId) return;
    setBusyId(item.id);
    const prev = requests;
    setRequests((cur) => cur.filter((r) => r.id !== item.id));
    try {
      await axiosInstance.patch(`/api/chat/${action}/${item.chatId}`);
      onChanged?.();
      if (action === 'accept') onOpenChat?.(item);
    } catch (e) {
      setRequests(prev);
    } finally {
      setBusyId(null);
    }
  };

  const markRead = async (item) => {
    if (item.read) return;
    setNotifications((cur) => cur.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    try {
      await axiosInstance.patch(`/api/notifications/${item.id}/read`);
    } catch (e) { /* non-critical */ }
  };

  const markAllRead = async () => {
    if (notifications.every((n) => n.read)) return;
    setNotifications((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await axiosInstance.patch('/api/notifications/read-all');
    } catch (e) { /* non-critical */ }
  };

  const removeNotification = async (item) => {
    const prev = notifications;
    setNotifications((cur) => cur.filter((n) => n.id !== item.id));
    try {
      await axiosInstance.delete(`/api/notifications/${item.id}`);
    } catch (e) {
      setNotifications(prev);
    }
  };

  // ── Renderers ──
  const renderRequest = (item) => {
    const photo = resolvePhoto(item.user);
    const name = item.user?.anonymous || item.user?.name || 'Anonymous User';
    const isPaid = item.paymentStatus === 'paid';
    const busy = busyId === item.id;
    return (
      <View key={`req-${item.id}`} style={s.card}>
        <View style={[s.rail, { backgroundColor: C.primary }]} />
        <View style={s.cardTop}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.avatar} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarText}>{initialsOf(name)}</Text>
            </View>
          )}
          <View style={s.cardHead}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>{name}</Text>
              <Text style={s.time}>{relativeTime(item.createdAt, t)}</Text>
            </View>
            <Text style={s.subline} numberOfLines={1}>{t('Wants to start a chat')}</Text>
          </View>
        </View>

        {!!item.message && (
          <View style={s.msgBox}>
            <Text style={s.msgText} numberOfLines={3}>{t(item.message)}</Text>
          </View>
        )}

        <View style={s.metaRow}>
          <View style={[s.tag, isPaid ? s.tagPaid : s.tagFree]}>
            <Ionicons name={isPaid ? 'card-outline' : 'gift-outline'} size={12} color={isPaid ? C.amber : C.green} />
            <Text style={[s.tagText, { color: isPaid ? C.amber : C.green }]}>
              {isPaid ? `Paid • ₹${item.amount}` : 'Free session'}
            </Text>
          </View>
        </View>

        <View style={s.actions}>
          <TouchableOpacity style={s.declineBtn} onPress={() => respond(item, 'reject')} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator size="small" color={C.danger} /> : (
              <><Ionicons name="close" size={16} color={C.danger} /><Text style={s.declineText}>{t('Decline')}</Text></>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={() => respond(item, 'accept')} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={s.acceptText}>{t('Accept')}</Text></>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNotification = (item) => {
    const cfg = configFor(item.type);
    return (
      <TouchableOpacity
        key={`n-${item.id}`}
        style={[s.notifCard, !item.read && s.notifUnread]}
        activeOpacity={0.85}
        onPress={() => {
          markRead(item);
          onAction?.(item);
        }}
      >
        {!item.read && <View style={[s.rail, { backgroundColor: cfg.color }]} />}
        <View style={[s.notifIcon, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={[s.notifTitle, !item.read && s.notifTitleUnread]} numberOfLines={1}>
              {t(item.title)}
            </Text>
            {!item.read && <View style={[s.dot, { backgroundColor: cfg.color }]} />}
          </View>
          {!!item.body && <Text style={s.notifBody} numberOfLines={2}>{t(item.body)}</Text>}
          <View style={s.notifMetaRow}>
            <Text style={s.time}>{relativeTime(item.createdAt, t)}</Text>
            <TouchableOpacity onPress={() => removeNotification(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{t('Notifications')}</Text>
          {unreadCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.markAll}>{t('Mark all')}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const n = countFor(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.85}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{t(f.label)}</Text>
                {n > 0 && (
                  <View style={[s.chipCount, active && s.chipCountActive]}>
                    <Text style={[s.chipCountText, active && s.chipCountTextActive]}>{n}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll({ silent: true }); }}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
        >
          {error ? (
            <View style={s.empty}>
              <Ionicons name="cloud-offline-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => fetchAll()} activeOpacity={0.85}>
                <Text style={s.retryText}>{t('Retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyText}>{t("You're all caught up.")}</Text>
            </View>
          ) : (
            visible.map((item) =>
              item.kind === 'request' ? renderRequest(item) : renderNotification(item)
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 10 : 6, paddingBottom: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 62, alignItems: 'flex-start' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  headerBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  markAll: { fontSize: 13, fontWeight: '700', color: C.primary, width: 62, textAlign: 'right' },

  chipWrap: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, height: 34, borderRadius: 999, borderWidth: 1,
    borderColor: '#E2E8F0', backgroundColor: C.surface, justifyContent: 'center',
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  chipCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  chipCountText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  chipCountTextActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 12 },

  rail: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },

  /* Request card */
  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  cardHead: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '800', color: C.text },
  time: { fontSize: 11.5, color: C.muted, fontWeight: '600' },
  subline: { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 3 },
  msgBox: { backgroundColor: '#F4F6FB', borderRadius: 10, padding: 11, marginTop: 12 },
  msgText: { fontSize: 13, color: '#526071', lineHeight: 19 },
  metaRow: { flexDirection: 'row', marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagFree: { backgroundColor: C.greenBg },
  tagPaid: { backgroundColor: C.amberBg },
  tagText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, backgroundColor: C.dangerBg,
    borderWidth: 1, borderColor: '#FECACA',
  },
  declineText: { fontSize: 13.5, fontWeight: '800', color: C.danger },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, backgroundColor: C.primary,
  },
  acceptText: { fontSize: 13.5, fontWeight: '800', color: '#fff' },

  /* Notification card */
  notifCard: {
    flexDirection: 'row', gap: 12, backgroundColor: C.surface, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden',
  },
  notifUnread: {
    borderColor: '#E2E8F0',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  notifIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#334155' },
  notifTitleUnread: { color: C.text, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: 13, color: C.textSub, lineHeight: 19, marginTop: 4 },
  notifMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 12 },
  emptyText: { fontSize: 14, color: C.muted, fontWeight: '500' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, backgroundColor: C.primary },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default CounselorNotifications;
