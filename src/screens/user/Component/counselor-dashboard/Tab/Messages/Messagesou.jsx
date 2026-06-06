import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import socketService from '../../../../../../services/socketService';
import useRingtone from '../../../../../../hooks/useRingtone';
import safeVibrate from '../../../../../../utils/safeVibrate';
import VideoCallModal from '../../../UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../UserDashboard/Tab/CallModal/VoiceCallModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_BASE_URL = 'https://chatbot-backend-js25.onrender.com';

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

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

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

const SMSList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const { startRinging: startIncomingRing, stopRinging: stopIncomingRing } = useRingtone();
  const pollingIntervalRef = useRef(null);
  const socketRef = useRef(null);

  const handleSessionExpired = useCallback(() => {
    AsyncStorage.multiRemove(['token', 'accessToken', 'userData']);
    navigation.replace('RoleSelector', {
      reason: 'session-expired',
      message: 'Your session has expired. Please log in again.',
    });
  }, [navigation]);

  const getIdentityAssets = (name) => {
    const assets = [
      { colors: ['#2563EB', '#0D9488'], icon: 'planet' },
      { colors: ['#0D9488', '#1E40AF'], icon: 'leaf' },
      { colors: ['#0D9488', '#2563EB'], icon: 'sunny' },
      { colors: ['#2563EB', '#1E3A8A'], icon: 'heart' },
      { colors: ['#0D9488', '#2563EB'], icon: 'water' },
      { colors: ['#0D9488', '#1E40AF'], icon: 'moon' },
    ];
    if (!name) return assets[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return assets[Math.abs(hash) % assets.length];
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const messageTime = new Date(timeString);
      const now = new Date();
      const diffMs = now - messageTime;
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays === 0) return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      if (diffDays === 1) return 'Yesterday';
      return messageTime.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
    } catch { return ''; }
  };

  const resolveOnlineStatus = (person) => {
    const explicitOnline = person?.isOnline ?? person?.online;
    if (typeof explicitOnline === 'boolean') return explicitOnline;
    if (typeof explicitOnline === 'string') return ['online','true','1','yes'].includes(String(explicitOnline).toLowerCase());
    return false;
  };

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

      const transformedUsers = (data.chats || []).map((chat) => {
        const otherParty = chat.otherParty || {};
        const displayName = otherParty.anonymous || otherParty.name || 'Anonymous User';
        const lastMessageTime = chat.lastMessage?.createdAt || chat.updatedAt || chat.startedAt;
        return {
          id: chat.chatId,
          chatId: chat.chatId,
          userId: otherParty._id || otherParty.id || otherParty.userId,
          receiverId: otherParty._id || otherParty.id || otherParty.userId,
          name: displayName,
          gender: otherParty.gender,
          profilePhoto: (() => {
            const p = otherParty.profilePhoto || otherParty.avatar || otherParty.profilePic || otherParty.photo;
            if (!p) return null;
            const url = p.url || (typeof p === 'string' ? p : null);
            if (!url) return null;
            // Only show real uploaded photos — skip generated avatars
            if (url.includes('ui-avatars.com') || url.includes('dicebear') || url.includes('gravatar')) return null;
            if (url.startsWith('http')) return url;
            return null;
          })(),
          lastMessage: chat.lastMessage?.content || 'No messages yet',
          time: formatTime(lastMessageTime),
          lastActivityAt: lastMessageTime,
          unread: chat.unreadCount || 0,
          status: String(chat.status || 'pending').toLowerCase(),
          online: resolveOnlineStatus(otherParty),
          lastSeen: otherParty.lastSeen || null,
        };
      });

      transformedUsers.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
      setUsers(transformedUsers);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useFocusEffect(useCallback(() => { fetchChats(); }, [fetchChats]));

  useEffect(() => {
    const setupSocket = async () => {
      const unsubscribers = [];
      try {
        const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
        if (!token) return;

        const socket = await socketService.connect();
        socketRef.current = socket;

        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          setUsers((prev) => prev.map((item) => (
            String(item.userId || item.receiverId || item.id) === String(userId)
              ? { ...item, online: !!isOnline, lastSeen: lastSeen || item.lastSeen || null }
              : item
          )));
        }));

        unsubscribers.push(await socketService.on('disconnect', () => { socketRef.current = null; }));
        socketRef.current._unsubscribers = unsubscribers;
      } catch (error) {
        console.error('Messages presence socket error:', error);
      }
    };

    setupSocket();

    return () => {
      try { const unsub = socketRef.current?._unsubscribers || []; unsub.forEach(fn => { try { fn(); } catch {} }); } catch (e) {}
      socketRef.current = null;
    };
  }, []);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = (user) => {
    setSelectedChatId(user.chatId);
    navigation.navigate('SMSInput', { selectedUser: user, chatId: user.chatId, chatData: user });
  };

  const renderUserItem = ({ item }) => {
    const { colors, icon } = getIdentityAssets(item.name);
    const hasRealPhoto = item.profilePhoto &&
      !item.profilePhoto.includes('ui-avatars.com') &&
      !item.profilePhoto.includes('dicebear') &&
      !item.profilePhoto.includes('gravatar.com');

    return (
      <TouchableOpacity
        style={[styles.chatRow, selectedChatId === item.chatId && styles.chatRowSelected]}
        onPress={() => handleUserClick(item)}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrapper}>
          {hasRealPhoto ? (
            <Image source={{ uri: item.profilePhoto }} style={styles.avatarImage} />
          ) : (
            <LinearGradient colors={colors} style={styles.avatarCircle}>
              <Ionicons name={icon} size={20} color="#FFFFFF" />
            </LinearGradient>
          )}
          {item.online && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.timeText, item.unread > 0 && styles.timeActive]}>{item.time}</Text>
          </View>

          <View style={styles.rowFooter}>
            <Text style={[styles.messageText, item.unread > 0 && styles.messageUnread]} numberOfLines={1}>{item.lastMessage}</Text>
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
     <View style={styles.searchSection}>
  <View style={styles.searchContainer}>
    
    <View style={styles.searchIconWrap}>
      <Ionicons
        name="search-outline"
        size={18}
        color="#2563EB"
      />
    </View>

    <TextInput
      style={styles.searchInput}
      placeholder="Search messages..."
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
        <Ionicons
          name="close"
          size={14}
          color="#9CA3AF"
        />
      </TouchableOpacity>
    )}

  </View>
</View>

      {loading && users.length === 0 ? (
        <View style={styles.shimmerContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonItem key={i} />)}
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
              <Text style={styles.emptyText}>No chats found</Text>
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

  // ─── Search Section ───────────────────────────────────────────────────────
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

  // ─── List ────────────────────────────────────────────────────────────────
  list: { width: '100%', paddingBottom: 100, paddingHorizontal: 0 },
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

  // ─── Avatar ──────────────────────────────────────────────────────────────
  avatarWrapper: { position: 'relative' },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52, borderRadius: 26, resizeMode: 'cover' },
  initialsText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
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

  // ─── Row content ─────────────────────────────────────────────────────────
  rowContent: { flex: 1, marginLeft: 13, justifyContent: 'center' },
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
    marginLeft: 6,
  },
  unreadCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  shimmerContainer: { flex: 1, width: '100%', paddingHorizontal: 0 },
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

  // ─── Empty ────────────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
});

export default SMSList;