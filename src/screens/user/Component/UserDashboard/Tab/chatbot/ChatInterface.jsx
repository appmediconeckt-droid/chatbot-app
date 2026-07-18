// ChatInterface.tsx - Android version with iOS design
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  RefreshControl,
  Vibration,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import socketService from '../../../../../../services/socketService';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import safeVibrate from '../../../../../../utils/safeVibrate';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PATIENT from '../../../../../../theme/palette';

const { width: screenWidth } = Dimensions.get('window');

const ChatListSkeleton = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return (
    <View style={chatSkel.wrap}>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View key={i} style={chatSkel.row}>
          <Animated.View style={[chatSkel.avatar, { opacity }]} />
          <View style={chatSkel.body}>
            <Animated.View style={[chatSkel.nameLine, { opacity }]} />
            <Animated.View style={[chatSkel.msgLine, { opacity }]} />
          </View>
          <Animated.View style={[chatSkel.time, { opacity }]} />
        </View>
      ))}
    </View>
  );
};

const chatSkel = {
  wrap: { flex: 1, width: '100%', paddingHorizontal: 14, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e2e8f0' },
  body: { flex: 1, marginLeft: 14, gap: 8 },
  nameLine: { width: '45%', height: 15, borderRadius: 5, backgroundColor: '#e2e8f0' },
  msgLine: { width: '75%', height: 12, borderRadius: 4, backgroundColor: '#edf1f5' },
  time: { width: 40, height: 10, borderRadius: 4, backgroundColor: '#edf1f5' },
};

const resolveOnlineStatus = (person) => {
  const explicitOnline = person?.isOnline ?? person?.online;
  if (typeof explicitOnline === 'boolean') return explicitOnline;
  if (typeof explicitOnline === 'string') return ['online', 'true', '1', 'yes'].includes(explicitOnline.toLowerCase());
  return false;
};

const ChatInterface = ({ setActiveTab }) => {
  const navigation = useNavigation();
  const { t } = useTranslation(['messages', 'common', 'dashboard']);

  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const socketRef = useRef(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const longPressTimer = useRef(null);
  const pressedItemId = useRef(null);

  const getInitials = (name) => {
    if (!name) return '👤';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getAvatarColor = (name) => {
    if (!name) return '#4f46e5';
    const colors = [
      '#4f46e5', '#0891b2', '#059669', '#b45309', '#c2410c',
      '#7e22ce', '#be123c', '#1e40af', '#0f766e', '#6b21a8',
      '#d97706', '#dc2626', '#16a34a', '#9333ea', '#db2777'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const messageTime = new Date(timeString);
      const now = new Date();
      const diffMs = now - messageTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t('messages:justNow', 'Just now');
      if (diffHours < 1) return `${diffMins}m ago`;
      if (diffDays === 0) return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return t('messages:yesterday', 'Yesterday');
      if (diffDays < 7) return messageTime.toLocaleDateString([], { weekday: 'short' });
      if (diffDays < 30) return `${diffDays}d ago`;
      return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatFullDateTime = (timeString) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleString([], {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return timeString;
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return t('common:offline', 'Offline');
    try {
      const lastSeenTime = new Date(lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t('messages:justNow', 'Just now');
      if (diffHours < 1) return `${diffMins} minutes ago`;
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return t('messages:yesterday', 'Yesterday');
      if (diffDays < 7) return `${diffDays} days ago`;
      return lastSeenTime.toLocaleDateString();
    } catch {
      return t('messages:recently', 'Recently');
    }
  };

  const fetchChats = useCallback(async (isInitial = false) => {
    const resolveLastMessage = (chat) => {
      const latestFromArray = Array.isArray(chat?.messages) && chat.messages.length > 0
        ? chat.messages[chat.messages.length - 1]
        : null;
      return (
        chat?.lastMessage?.content ||
        chat?.lastMessage?.message ||
        chat?.lastMessage?.text ||
        latestFromArray?.content ||
        latestFromArray?.message ||
        latestFromArray?.text ||
        t('messages:noMessages', 'No messages yet')
      );
    };

    try {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
      if (!token) {
        setCounselors([]);
        setLoading(false);
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/chat/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const chatsArray =
        response.data?.chats ||
        response.data?.data?.chats ||
        (Array.isArray(response.data) ? response.data : []);

      if (response.status === 200 && Array.isArray(chatsArray)) {
        const counselorList = chatsArray.map((chat) => {
          const otherParty = chat.otherParty || {};
          const lastMessage = resolveLastMessage(chat);
          const lastMessageTime = chat.lastMessage?.createdAt || chat.updatedAt || chat.startedAt;

          let specialization = 'Counselor';
          if (otherParty.specialization) {
            if (Array.isArray(otherParty.specialization) && otherParty.specialization.length > 0) {
              specialization = otherParty.specialization[0];
            } else if (typeof otherParty.specialization === 'string') {
              specialization = otherParty.specialization;
            }
          }

          return {
            id: otherParty.id || chat.chatId,
            chatMongoId: chat.id || chat._id || null,
            name: otherParty.name || 'Unknown Counselor',
            fullName: otherParty.name || 'Unknown Counselor',
            lastMessage,
            lastMessageTime,
            time: formatTime(lastMessageTime),
            fullDateTime: formatFullDateTime(lastMessageTime),
            unread: chat.unreadCount || 0,
            online: resolveOnlineStatus(otherParty),
            lastSeen: otherParty.lastSeen || null,
            avatar: otherParty.profilePhoto?.url || otherParty.avatar,
            specialization,
            chatId: chat.chatId,
            status: chat.status,
            isExpired: chat.isExpired,
            profilePhoto: otherParty.profilePhoto,
            phoneNumber: otherParty.phoneNumber,
          };
        });

        counselorList.sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        });

        setCounselors(counselorList);

        try {
          await AsyncStorage.setItem('activeChats', JSON.stringify(chatsArray));
        } catch (storageError) {
          console.warn('Could not cache active chats:', storageError);
        }
      } else {
        setCounselors([]);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError(error.message);

      try {
        const savedChats = JSON.parse(await AsyncStorage.getItem('activeChats') || '[]');
        if (Array.isArray(savedChats) && savedChats.length > 0) {
          const counselorList = savedChats.map((chat) => {
            const otherParty = chat.otherParty || {};
            const lastMessage = resolveLastMessage(chat);
            const lastMessageTime = chat.lastMessage?.createdAt || chat.updatedAt || chat.startedAt;
            const specialization = Array.isArray(otherParty.specialization)
              ? otherParty.specialization[0] || 'Counselor'
              : otherParty.specialization || 'Counselor';

            return {
              id: otherParty.id || otherParty._id || chat.chatId,
              chatMongoId: chat.id || chat._id || null,
              name: otherParty.name || otherParty.fullName || 'Unknown Counselor',
              fullName: otherParty.name || otherParty.fullName || 'Unknown Counselor',
              lastMessage,
              lastMessageTime,
              time: formatTime(lastMessageTime),
              fullDateTime: formatFullDateTime(lastMessageTime),
              unread: chat.unreadCount || 0,
              online: resolveOnlineStatus(otherParty),
              lastSeen: otherParty.lastSeen || null,
              avatar: otherParty.profilePhoto?.url || otherParty.avatar,
              specialization,
              chatId: chat.chatId,
              status: chat.status,
              isExpired: chat.isExpired,
              profilePhoto: otherParty.profilePhoto,
              phoneNumber: otherParty.phoneNumber,
            };
          });
          setCounselors(counselorList);
        }
      } catch (storageError) {
        console.warn('Could not load cached chats:', storageError);
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  const markChatAsRead = useCallback(async (chatIdentifier) => {
    try {
      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
      if (!token) return;
      await axios.post(
        `${API_BASE_URL}/api/chat/mark-all-read`,
        { chatId: chatIdentifier },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCounselors((prev) => prev.map((c) => ((c.chatId === chatIdentifier || String(c.id) === String(chatIdentifier)) ? { ...c, unread: 0 } : c)));
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }, []);

  const deleteChat = useCallback(async (chatId) => {
    try {
      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
      if (!token) return false;
      const response = await axios.delete(`${API_BASE_URL}/api/chat/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 200 || response.status === 204) {
        setCounselors((prev) => prev.filter((c) => c.id !== chatId && c.chatId !== chatId));
        if (Platform.OS === 'android') {
          Vibration.vibrate(50);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchChats(true);
    const interval = setInterval(() => fetchChats(false), 30000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  useEffect(() => {
    const setupSocket = async () => {
      const unsubscribers = [];
      try {
        const token = await AsyncStorage.getItem('accessToken') || await AsyncStorage.getItem('token');
        if (!token) return;

        const socket = await socketService.connect();
        socketRef.current = socket;

        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          setCounselors((prev) => prev.map((counselor) => (
            String(counselor.id) === String(userId)
              ? { ...counselor, online: !!isOnline, lastSeen: lastSeen || counselor.lastSeen || null }
              : counselor
          )));
        }));

        unsubscribers.push(await socketService.on('disconnect', () => { socketRef.current = null; }));
        socketRef.current._unsubscribers = unsubscribers;
      } catch (error) {
        console.error('Chat interface presence socket error:', error);
      }
    };

    setupSocket();

    return () => {
      try {
        const unsub = socketRef.current?._unsubscribers || [];
        unsub.forEach(fn => { try { fn(); } catch {} });
      } catch (e) {}
      socketRef.current = null;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchChats(false);
    }, [fetchChats])
  );

  const handleCounselorSelect = useCallback(async (counselor) => {
    await markChatAsRead(counselor.chatId || counselor.id);
    safeVibrate(80);
    navigation.navigate('ChatBox', {
      id: counselor.id,
      chatId: counselor.chatId,
      chatMongoId: counselor.chatMongoId,
      counselor: {
        id: counselor.id,
        name: counselor.name,
        fullName: counselor.name,
        specialization: counselor.specialization,
        online: counselor.online,
        lastSeen: counselor.lastSeen,
        avatar: counselor.avatar,
        profilePhoto: counselor.profilePhoto,
        phoneNumber: counselor.phoneNumber,
      },
    });
  }, [markChatAsRead, navigation]);

  const handleStartNewChat = useCallback(() => {
    safeVibrate(100);
    if (setActiveTab) {
      setActiveTab('Live Chat');
    } else {
      navigation.navigate('CounselorDirectory');
    }
  }, [setActiveTab, navigation]);

  const handleLongPressStart = useCallback((counselor) => {
    pressedItemId.current = counselor.id;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
    }).start();
    longPressTimer.current = setTimeout(() => {
      if (pressedItemId.current === counselor.id) {
        if (Platform.OS === 'android') {
          Vibration.vibrate(50);
        }
        setSelectedCounselor(counselor);
        setShowDeleteConfirm(true);
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 50,
        }).start();
      }
    }, 500);
  }, [scaleAnim]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressedItemId.current = null;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  }, [scaleAnim]);

  const handleItemPress = useCallback((counselor) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    handleCounselorSelect(counselor);
  }, [handleCounselorSelect]);

  const confirmDeleteChat = useCallback(async () => {
    if (selectedCounselor) {
      const success = await deleteChat(selectedCounselor.id);
      if (success && Platform.OS === 'android') {
        Vibration.vibrate([50, 30, 50]);
      }
      setShowDeleteConfirm(false);
      setSelectedCounselor(null);
    }
  }, [selectedCounselor, deleteChat]);

  // Chips: All / Online / Recent, then the specializations present in the list.
  const filterChips = useMemo(() => {
    const specs = [];
    counselors.forEach((c) => {
      const s = (c.specialization || '').trim();
      if (s && s !== 'Counselor' && !specs.includes(s)) specs.push(s);
    });
    return [
      { id: 'all', label: t('common:all', 'All') },
      { id: 'online', label: t('common:online', 'Online') },
      { id: 'recent', label: t('messages:recent', 'Recent') },
      ...specs.slice(0, 6).map((s) => ({ id: s, label: s })),
    ];
  }, [counselors, t]);

  const filteredCounselors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return counselors.filter((counselor) => {
      const matchesSearch =
        !term ||
        counselor.name.toLowerCase().includes(term) ||
        counselor.specialization.toLowerCase().includes(term) ||
        counselor.lastMessage.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (activeFilter === 'all' || activeFilter === 'recent') return true;
      if (activeFilter === 'online') return !!counselor.online;
      return counselor.specialization === activeFilter;
    });
  }, [counselors, searchTerm, activeFilter]);

  const renderAvatar = (counselor) => {
    const avatarUrl = counselor.avatar || counselor.profilePhoto?.url;
    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatarImage}
        />
      );
    }
    return (
      <View style={[styles.avatarInitials, { backgroundColor: getAvatarColor(counselor.name) }]}>
        <Text style={styles.avatarInitialsText}>{getInitials(counselor.name)}</Text>
      </View>
    );
  };

  const renderChatItem = ({ item }) => {
    const animatedStyle = {
      transform: [{ scale: pressedItemId.current === item.id ? scaleAnim : 1 }],
    };
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleLongPressStart(item)}
        onPressOut={handleLongPressEnd}
        delayLongPress={500}
      >
        <Animated.View style={[styles.chatItem, animatedStyle]}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              {renderAvatar(item)}
            </View>
            {item.online && <View style={styles.statusDot} />}
          </View>
          <View style={styles.chatInfo}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.specialization} numberOfLines={1}>
              {item.specialization}
            </Text>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.isExpired && (
              <View style={styles.metaContainer}>
                <View style={styles.expiredBadge}>
                  <Ionicons name="time-outline" size={14} color="#f59e0b" />
                  <Text style={styles.expiredText}>{t('messages:expired', 'Expired')}</Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.chatRight}>
            <Text style={[styles.chatTime, item.unread > 0 && styles.chatTimeUnread]}>
              {item.time}
            </Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread > 99 ? '99+' : item.unread}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (initialLoading || loading) return null;
    return (
      <View style={styles.emptyContainer}>
        {searchTerm ? (
          <>
            <Ionicons name="search-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>{t('messages:noCounselorsFound', 'No counselors found')}</Text>
            <Text style={styles.emptyText}>
              {t('messages:noCounselorsMatching', 'No counselors matching "{{term}}"', { term: searchTerm })}
            </Text>
            <TouchableOpacity style={styles.clearButton} onPress={() => setSearchTerm('')}>
              <Text style={styles.clearButtonText}>{t('messages:clearSearch', 'Clear search')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>{t('messages:noActiveChats', 'No active chats yet')}</Text>
            <Text style={styles.emptyText}>
              {t('messages:startConversationCounselor', 'Start a conversation with a counselor')}
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={handleStartNewChat}>
              <Text style={styles.startButtonText}>{t('messages:startNewChat', 'Start a new chat')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderErrorState = () => {
    if (!error || loading || initialLoading) return null;
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchChats(false)}>
          <Text style={styles.retryButtonText}>{t('common:retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={PATIENT.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('messages:searchCounselors', 'Search counselors...')}
            placeholderTextColor={PATIENT.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity style={styles.searchClearButton} onPress={() => setSearchTerm('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={PATIENT.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {filterChips.map((chip) => {
            const active = activeFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(chip.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {initialLoading ? (
        <ChatListSkeleton />
      ) : error && !loading ? (
        renderErrorState()
      ) : (
        <FlatList
          data={filteredCounselors}
          keyExtractor={(item) => (item.chatId ? String(item.chatId) : item.id?.toString())}
          renderItem={renderChatItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={filteredCounselors.length === 0 ? styles.listEmpty : styles.list}
          ListHeaderComponent={
            filteredCounselors.length > 0 ? (
              <Text style={styles.sectionTitle}>
                {t('messages:recentConversations', 'Recent Conversations')}
              </Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchChats(false)}
              tintColor={PATIENT.primary}
              colors={[PATIENT.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDeleteConfirm(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('messages:deleteChat', 'Delete Chat')}</Text>
            </View>
            {selectedCounselor && (
              <View style={styles.modalBody}>
                <View style={styles.deleteCounselorInfo}>
                  <View style={styles.deleteAvatar}>
                    {renderAvatar(selectedCounselor)}
                  </View>
                  <View style={styles.deleteInfo}>
                    <Text style={styles.deleteName}>{selectedCounselor.name}</Text>
                    <Text style={styles.deleteSpecialization}>
                      {selectedCounselor.specialization}
                    </Text>
                  </View>
                </View>
                <Text style={styles.deleteMessage}>
                  {t('messages:deleteChatConfirm', 'Are you sure you want to delete this chat?')}
                </Text>
                <Text style={styles.deleteWarning}>
                  {t('messages:deleteChatWarning', '⚠️ This action cannot be undone. All messages will be permanently deleted.')}
                </Text>
                {selectedCounselor.fullDateTime && (
                  <Text style={styles.chatTimeInfo}>
                    {t('messages:lastMessageLabel', 'Last message')}: {selectedCounselor.fullDateTime}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common:cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDeleteChat}
              >
                <Text style={styles.deleteButtonText}>{t('messages:deleteChat', 'Delete Chat')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: PATIENT.backgroundTint,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: PATIENT.backgroundTint,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PATIENT.surface,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: PATIENT.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '400',
    color: PATIENT.text,
    paddingVertical: 0,
  },
  searchClearButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  chipRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
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
  chipActive: {
    backgroundColor: PATIENT.primary,
    borderColor: PATIENT.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: PATIENT.textSecondary,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: PATIENT.text,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  list: {
    paddingBottom: 24,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: PATIENT.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarInitials: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2.5,
    borderColor: PATIENT.surface,
    backgroundColor: PATIENT.online,
    zIndex: 1,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: PATIENT.text,
  },
  specialization: {
    fontSize: 11.5,
    color: PATIENT.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  lastMessage: {
    fontSize: 13,
    color: PATIENT.textSecondary,
    marginTop: 5,
  },
  chatRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    marginLeft: 10,
    gap: 8,
  },
  chatTime: {
    fontSize: 11,
    color: PATIENT.textMuted,
    fontWeight: '500',
  },
  chatTimeUnread: {
    color: PATIENT.primary,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: PATIENT.primary,
    borderRadius: 11,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  acceptedBadge: {
    marginRight: 4,
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredText: {
    fontSize: 10,
    color: '#f59e0b',
    marginLeft: 2,
  },
  lastSeen: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 2,
    fontWeight: '400',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '500',
  },
  startButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth - 48,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalBody: {
    padding: 20,
  },
  deleteCounselorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  deleteAvatar: {
    marginRight: 12,
  },
  deleteInfo: {
    flex: 1,
  },
  deleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  deleteSpecialization: {
    fontSize: 13,
    color: '#64748b',
  },
  deleteMessage: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  deleteWarning: {
    fontSize: 13,
    color: '#f59e0b',
    marginBottom: 12,
  },
  chatTimeInfo: {
    fontSize: 12,
    color: '#94a3b8',
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
};

export default ChatInterface;