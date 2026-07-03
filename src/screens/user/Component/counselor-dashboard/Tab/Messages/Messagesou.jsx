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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {

  getAnonymousParticipantId,

  getAnonymousUserAvatar,

  getAnonymousUserDisplay,

} from '../../../../../../utils/anonymousUser'; 
import socketService from '../../../../../../services/socketService';
import { API_BASE_URL } from '../../../../../../axiosConfig';

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
const SMSList = () => {
  const { t } = useLanguageRender();
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

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = (user) => {
    setSelectedChatId(user.chatId);
    navigation.navigate('SMSInput', { selectedUser: user, chatId: user.chatId, chatData: user });
  };

  const renderUserItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={[styles.chatRow, selectedChatId === item.chatId && styles.chatRowSelected]}
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
          <View style={styles.rowHeader}>
            <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.timeText, item.unread > 0 && styles.timeActive]}>{item.time}</Text>
          </View>
          <View style={styles.rowFooter}>
            <TranslatedMessageBubble
              text={item.lastMessage || ''}
              style={[styles.messageText, item.unread > 0 && styles.messageUnread]}
              numberOfLines={1}
            />
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <TouchableOpacity onPress={fetchChats} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common:retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('messages:noChatsFound')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },

  // ─── Search ───────────────────────────────────────────────────────────────
  searchSection: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
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

  // ─── List ─────────────────────────────────────────────────────────────────
  list: { width: '100%', paddingBottom: 100 },
  chatRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  timeText: { fontSize: 11, color: '#94A3B8', minWidth: 56, textAlign: 'right' },
  timeActive: { color: '#1D4ED8', fontWeight: '700' },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageText: { fontSize: 13, color: '#64748B', flex: 1, marginRight: 8 },
  messageUnread: { color: '#1E293B', fontWeight: '600' },
  unreadBadge: {
    backgroundColor: '#1D4ED8',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

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
    backgroundColor: '#2563EB',
    borderRadius: 20,
  },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
});

export default SMSList;
