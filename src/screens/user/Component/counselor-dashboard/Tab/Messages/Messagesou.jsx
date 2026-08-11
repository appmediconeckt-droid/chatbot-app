import React, { useState, useEffect, useCallback, useRef } from 'react';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {

  getAnonymousParticipantId,

  getAnonymousUserAvatar,

  getAnonymousUserDisplay,

} from '../../../../../../utils/anonymousUser'; 
import GradientFill from '../../../../../../components/common/GradientFill';
import socketService from '../../../../../../services/socketService';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import CounselorGradientButton from '../../../../../../components/common/CounselorGradientButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Skeleton ────────────────────────────────────────────────────────────────
const SkeletonItem = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.skeletonRow}>
      <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
      <View style={styles.skeletonContent}>
        <Animated.View style={[styles.skeletonTitle, { opacity }]} />
        <Animated.View style={[styles.skeletonText, { opacity }]} />
      </View>
      <Animated.View style={[styles.skeletonTime, { opacity }]} />
    </View>
  );
};

// ─── Avatar with photo + onError fallback ─────────────────────────────────────
const AVATAR_BG_COLORS = ['#4f46e5','#0891b2','#059669','#b45309','#c2410c','#7e22ce','#be123c','#1e40af'];
const getAvatarBg = (name) => {
  if (!name) return AVATAR_BG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
};

const ChatListAvatar = ({ avatarUrl, avatar, name }) => {
  const [failed, setFailed] = useState(false);

  if (avatarUrl && !failed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={avatarStyles.img}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        avatarStyles.fallback,
        { backgroundColor: getAvatarBg(name) },
      ]}
    >
      <Text style={avatarStyles.fallbackText}>
        {avatar || getAnonymousUserAvatar({ name })}
      </Text>
    </View>
  );
};

const avatarStyles = StyleSheet.create({
  img: { width: 52, height: 52, borderRadius: 26, resizeMode: 'cover' },
  fallback: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { fontSize: 26 },
});

// ─── Main Component ──────────────────────────────────────────────────────────
const SMSList = ({ counselorData, notifCount = 0, onBellPress }) => {
  const { t } = useLanguageRender();

  // Time-aware greeting for the header.
  const greetingLabel = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('counselor:goodMorning', 'Good Morning');
    if (h < 17) return t('counselor:goodAfternoon', 'Good Afternoon');
    return t('counselor:goodEvening', 'Good Evening');
  })();
  const counselorName = counselorData?.name || counselorData?.fullName || 'Counselor';
  const counselorPhoto = counselorData?.profilePhoto || null;
  const counselorInitial = counselorName.charAt(0).toUpperCase();
  // Header shows at most 8 characters of the name (no ellipsis dots).
  const shortName = counselorName.slice(0, 8);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const socketRef = useRef(null);

  const handleSessionExpired = useCallback(() => {
    AsyncStorage.multiRemove(['token', 'accessToken', 'userData']);
    navigation.replace('RoleSelector', {
      reason: 'session-expired',
      message: 'Your session has expired. Please log in again.',
    });
  }, [navigation]);

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const messageTime = new Date(timeString);
      const now = new Date();
      const diffDays = Math.floor((now - messageTime) / 86400000);
      if (diffDays === 0) return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      if (diffDays === 1) return 'Yesterday';
      return messageTime.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
    } catch { return ''; }
  };

  const resolveOnlineStatus = (person) => {
    const v = person?.isOnline ?? person?.online;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return ['online', 'true', '1', 'yes'].includes(v.toLowerCase());
    return false;
  };

  // const resolveProfilePhoto = (otherParty) => {
  //   // Try every field name the backend might use for a user's photo
  //   const p =
  //     otherParty.profilePhoto ||
  //     otherParty.avatarUrl ||
  //     otherParty.avatar ||
  //     otherParty.profilePic ||
  //     otherParty.photo ||
  //     otherParty.image ||
  //     otherParty.picture ||
  //     null;
  //   if (!p) return null;
  //   // p can be a Cloudinary object { secure_url, url } or a plain string
  //   const raw = (typeof p === 'object')
  //     ? (p.secure_url || p.url || null)
  //     : p;
  //   if (!raw || typeof raw !== 'string') return null;
  //   if (raw.includes('ui-avatars.com') || raw.includes('dicebear') || raw.includes('gravatar')) return null;
  //   if (raw.startsWith('http')) return raw;
  //   if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  //   return null;
  // };

  const fetchChats = useCallback(async () => {
    const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
    if (!token) return handleSessionExpired();
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chat/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) return handleSessionExpired();
      const data = await response.json();

      // DEBUG: log first chat's otherParty so you can see exact field names in Metro logs
      if (data.chats?.length > 0) {
        console.log('[ChatList] otherParty sample:', JSON.stringify(data.chats[0].otherParty, null, 2));
      }

   const transformed = (data.chats || []).map((chat) => {
  const otherParty = chat.otherParty || {};

  const anonymousUser =
    getAnonymousUserDisplay(otherParty);

  const actualUserId =
    getAnonymousParticipantId({
      ...otherParty,
      userId: chat.userId,
    }) || chat.userId;

  const lastMessageTime =
    chat.lastMessage?.createdAt ||
    chat.updatedAt ||
    chat.startedAt;

  return {
    id: chat.chatId,
    chatId: chat.chatId,

    userId: actualUserId,
    receiverId: actualUserId,

    name: anonymousUser.name,
    gender: anonymousUser.gender,

    age: otherParty.age || otherParty.ageYears || null,
    // Session topic, if the API attaches one to the chat.
    topic:
      chat.topic ||
      chat.reason ||
      chat.lastAppointment?.reason ||
      otherParty.condition ||
      otherParty.concern ||
      null,

    avatar: anonymousUser.avatar,
    avatarUrl: anonymousUser.avatarUrl,

    lastMessage:
      chat.lastMessage?.content || t('messages:noMessages'),

    time: formatTime(lastMessageTime),

    lastActivityAt: lastMessageTime,

    unread: chat.unreadCount || 0,

    status: String(
      chat.status || 'pending'
    ).toLowerCase(),

    online: resolveOnlineStatus(otherParty),

    lastSeen: otherParty.lastSeen || null,
  };
});

      transformed.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
      setUsers(transformed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useFocusEffect(useCallback(() => { fetchChats(); }, [fetchChats]));

  // Presence socket — update online status in real-time
  useEffect(() => {
    const setupSocket = async () => {
      const unsubscribers = [];
      try {
        const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
        if (!token) return;

        const socket = await socketService.connect();
        socketRef.current = socket;

        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          setUsers((prev) => prev.map((item) =>
            String(item.userId || item.receiverId || item.id) === String(userId)
              ? { ...item, online: !!isOnline, lastSeen: lastSeen || item.lastSeen || null }
              : item
          ));
        }));

        unsubscribers.push(await socketService.on('disconnect', () => { socketRef.current = null; }));
        socketRef.current._unsubscribers = unsubscribers;
      } catch (err) {
        console.error('Messages presence socket error:', err);
      }
    };

    setupSocket();

    return () => {
      try {
        const unsub = socketRef.current?._unsubscribers || [];
        unsub.forEach(fn => { try { fn(); } catch {} });
      } catch (_) {}
      socketRef.current = null;
    };
  }, []);

  // ─── Filter chips ───────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState('all');
  const filterChips = [
    { id: 'all', label: t('common:all', 'All') },
    { id: 'online', label: t('common:online', 'Online') },
    { id: 'unread', label: t('messages:unread', 'Unread') },
    { id: 'recent', label: t('messages:recent', 'Recent') },
  ];

  /**
   * Badge derived from the chat's real state.
   *
   * The previous version labelled any chat with an unread message "URGENT" and
   * everything else "NORMAL". Neither was true: an unread message is not a
   * clinical urgency, and in a mental-health app that mislabel invites a
   * counselor to deprioritise a genuinely serious case just because it has been
   * read. "NORMAL" also tagged every ordinary row with a badge carrying no
   * information. `pending` was shown as "FOLLOW UP" when it actually means the
   * request has not been accepted yet.
   *
   * Returns null when there is nothing meaningful to say, so the badge only
   * appears when it tells the counselor something actionable.
   */
  const getCategory = (item) => {
    if (item.status === 'pending') {
      return { label: t('messages:newRequest', 'NEW REQUEST'), color: '#1D4ED8', bg: '#EFF6FF' };
    }
    if (item.status === 'rejected' || item.status === 'cancelled' || item.status === 'canceled') {
      return { label: t('messages:closed', 'CLOSED'), color: '#64748B', bg: '#F1F5F9' };
    }
    return null;
  };

  // "28, F • Anxiety Follow-up" - each part appears only if the API sent it, so
  // no age or clinical label is ever invented. Falls back to presence.
  const metaLine = (item) => {
    const who = [item.age, item.gender].filter(Boolean).join(', ');
    const tail = item.topic || (item.online ? t('common:online', 'Online') : '');
    return [who, tail].filter(Boolean).join('  •  ');
  };

  const searchMatched = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = searchMatched.filter((u) => {
    if (activeFilter === 'online') return u.online;
    if (activeFilter === 'unread') return u.unread > 0;
    return true; // 'all' and 'recent' (already sorted by recency)
  });

  const handleUserClick = (user) => {
    setSelectedChatId(user.chatId);
    navigation.navigate('SMSInput', { selectedUser: user, chatId: user.chatId, chatData: user });
  };

  const renderUserItem = ({ item }) => {
    const category = getCategory(item);
    return (
      <TouchableOpacity
        style={[styles.chatCard, selectedChatId === item.chatId && styles.chatRowSelected]}
        onPress={() => handleUserClick(item)}
        activeOpacity={0.75}
      >
        {/* avatarOuter has no overflow:hidden so the online badge is not clipped */}
        <View style={styles.avatarOuter}>
          <View style={styles.avatarWrapper}>
            <ChatListAvatar
              avatarUrl={item.avatarUrl}
              avatar={item.avatar}
              name={item.name}
            />
          </View>
          <View style={[styles.onlineBadge, { backgroundColor: item.online ? '#22c55e' : '#9CA3AF' }]} />
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.nameText} numberOfLines={1}>{t(item.name)}</Text>

          {/* Category badge + meta line */}
          <View style={styles.metaRow}>
            {category ? (
              <View style={[styles.categoryBadge, { backgroundColor: category.bg }]}>
                <Text style={[styles.categoryText, { color: category.color }]}>{t(category.label)}</Text>
              </View>
            ) : null}
            <Text style={styles.metaText} numberOfLines={1}>
              {metaLine(item)}
            </Text>
          </View>

          <View style={styles.rowFooter}>
            <TranslatedMessageBubble
              text={item.lastMessage || ''}
              style={[styles.messageText, item.unread > 0 && styles.messageUnread]}
              numberOfLines={1}
            />
          </View>
        </View>

        {/* Right column: timestamp above the unread count, as in the design. */}
        <View style={styles.rowAside}>
          <Text style={[styles.timeText, item.unread > 0 && styles.timeActive]}>{item.time}</Text>
          {item.unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unread > 99 ? '99+' : item.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // Render via `ListHeaderComponent={renderListHeader()}` - passing the function
  // makes VirtualizedList treat it as a component *type*, and this arrow is new
  // every render, so the header (search TextInput included) remounted on each
  // keystroke and lost focus after one character.
  const renderListHeader = () => (
    <>
      {/* Filter chips */}
      <View style={styles.chipSection}>
        <FlatList
          data={filterChips}
          keyExtractor={(c) => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item: chip }) => {
            const isActive = activeFilter === chip.id;
            return (
              // GradientFill is an absolute layer, so both states keep the same
              // tree and metrics - selecting a chip can't resize it or shift the row.
              <TouchableOpacity
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveFilter(chip.id)}
                activeOpacity={0.8}
              >
                {isActive ? <GradientFill /> : null}
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{t(chip.label)}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrap}>
            <Ionicons name="search-outline" size={18} color="#2563EB" />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder={t('messages:searchMessages')}
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity
              style={styles.searchClearButton}
              onPress={() => setSearchTerm('')}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={14} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.shimmerContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonItem key={i} />)}
        </View>
      ) : error && users.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={40} color="#94A3B8" />
          <Text style={styles.emptyText}>{t('messages:failedToLoad')}</Text>
          <CounselorGradientButton onPress={fetchChats} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common:retry')}</Text>
          </CounselorGradientButton>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          ListHeaderComponent={renderListHeader()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('messages:noChatsFound')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },

  // ─── Greeting header ────────────────────────────────────────────────────────
  greetingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  greetingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  greetingAvatar: { width: 42, height: 42, borderRadius: 21 },
  greetingAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  greetingTextWrap: { flex: 1 },
  greetingWelcome: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  greetingName: { fontSize: 16, color: '#0F172A', fontWeight: '800', marginTop: 1 },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800' },

  // ─── Search ───────────────────────────────────────────────────────────────
  searchSection: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  searchClearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },

  // ─── Filter chips ─────────────────────────────────────────────────────────
  chipSection: { backgroundColor: '#F1F5F9', paddingTop: 12, paddingBottom: 4 },
  chipRow: { paddingHorizontal: 14, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { borderColor: '#003A9B' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },

  // ─── List ─────────────────────────────────────────────────────────────────
  list: { width: '100%', paddingBottom: 100, backgroundColor: '#F1F5F9' },
  chatCard: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  chatRowSelected: { backgroundColor: '#EFF6FF' },

  // ─── Avatar ───────────────────────────────────────────────────────────────
  // avatarOuter: no overflow:hidden so the online badge corner dot is NOT clipped
  avatarOuter: {
    position: 'relative',
    width: 52,
    height: 52,
    marginRight: 13,
  },
  // avatarWrapper: clips the photo/gradient to a circle
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // ─── Row content ──────────────────────────────────────────────────────────
  rowContent: { flex: 1, justifyContent: 'center' },
  rowAside: { alignItems: 'flex-end', gap: 7, marginLeft: 8 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  nameText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  timeText: { fontSize: 11, color: '#94A3B8', textAlign: 'right' },
  timeActive: { color: '#1D4ED8', fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  categoryText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
  metaText: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500', flex: 1 },

  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageText: { fontSize: 13, color: '#64748B', flex: 1, marginRight: 8 },
  messageUnread: { color: '#1E293B', fontWeight: '600' },

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  shimmerContainer: { flex: 1, width: '100%' },
  skeletonRow: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  skeletonAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E2E8F0' },
  skeletonContent: { flex: 1, marginLeft: 13, gap: 8 },
  skeletonTitle: { width: '40%', height: 13, borderRadius: 6, backgroundColor: '#DBEAFE' },
  skeletonText: { width: '70%', height: 10, borderRadius: 6, backgroundColor: '#E2E8F0' },
  skeletonTime: { width: 38, height: 10, borderRadius: 6, backgroundColor: '#E2E8F0' },

  // ─── Empty / Error ────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', marginTop: 100, gap: 12 },
  emptyText: { fontSize: 15, color: '#94A3B8', fontWeight: '500' },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
});

export default SMSList;
