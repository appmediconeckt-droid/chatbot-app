// ChatInterface.tsx - Android version with iOS design
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import safeVibrate from '../../../../../../utils/safeVibrate';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');

const ChatInterface = ({ setActiveTab }) => {
  const navigation = useNavigation();

  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState(null);

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

      if (diffMins < 1) return 'Just now';
      if (diffHours < 1) return `${diffMins}m ago`;
      if (diffDays === 0) return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return 'Yesterday';
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
    if (!lastSeen) return 'Offline';
    try {
      const lastSeenTime = new Date(lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffHours < 1) return `${diffMins} minutes ago`;
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return lastSeenTime.toLocaleDateString();
    } catch {
      return 'Recently';
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
        'No messages yet'
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

      if (response.status === 200 && response.data?.chats) {
        const counselorList = response.data.chats.map((chat) => {
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
            name: otherParty.name || 'Unknown Counselor',
            fullName: otherParty.name || 'Unknown Counselor',
            lastMessage,
            lastMessageTime,
            time: formatTime(lastMessageTime),
            fullDateTime: formatFullDateTime(lastMessageTime),
            unread: chat.unreadCount || 0,
            online: otherParty.isActive || false,
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
      } else {
        setCounselors([]);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError(error.message);
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
      // Normalize update: match either chatId or id fields to be robust
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
        setCounselors((prev) => prev.filter((c) => c.id !== chatId));
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

  useFocusEffect(
    useCallback(() => {
      fetchChats(false);
    }, [fetchChats])
  );

  const handleCounselorSelect = useCallback(async (counselor) => {
    // Ensure we mark the correct chat as read using the chatId when available
    await markChatAsRead(counselor.chatId || counselor.id);
    safeVibrate(80);
    // Pass both `chatId` and `id` explicitly so the ChatBox can unambiguously resolve
    navigation.navigate('ChatBox', {
      id: counselor.id,
      chatId: counselor.chatId,
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


  const filteredCounselors = counselors.filter((counselor) =>
    counselor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    counselor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
    counselor.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            {renderAvatar(item)}
            <View style={[styles.statusDot, item.online ? styles.statusOnline : styles.statusOffline]} />
          </View>
          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.chatTime}>{item.time}</Text>
            </View>
            <View style={styles.chatFooter}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
              {item.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unread > 99 ? '99+' : item.unread}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.metaContainer}>
              <Text style={styles.specialization} numberOfLines={1}>
                {item.specialization}
              </Text>
              {item.status === 'accepted' && (
                <View style={styles.acceptedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                </View>
              )}
              {item.isExpired && (
                <View style={styles.expiredBadge}>
                  <Ionicons name="time-outline" size={14} color="#f59e0b" />
                  <Text style={styles.expiredText}>Expired</Text>
                </View>
              )}
            </View>
            {!item.online && item.lastSeen && (
              <Text style={styles.lastSeen} numberOfLines={1}>
                Last seen: {formatLastSeen(item.lastSeen)}
              </Text>
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
            <Text style={styles.emptyTitle}>No counselors found</Text>
            <Text style={styles.emptyText}>
              No counselors matching "{searchTerm}"
            </Text>
            <TouchableOpacity style={styles.clearButton} onPress={() => setSearchTerm('')}>
              <Text style={styles.clearButtonText}>Clear search</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No active chats yet</Text>
            <Text style={styles.emptyText}>
              Start a conversation with a counselor
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={handleStartNewChat}>
              <Text style={styles.startButtonText}>Start a new chat</Text>
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
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrap}>
            <Ionicons name="search-outline" size={18} color="#4f46e5" />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search counselors..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity style={styles.searchClearButton} onPress={() => setSearchTerm('')} activeOpacity={0.7}>
              <Ionicons name="close" size={14} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {initialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : error && !loading ? (
        renderErrorState()
      ) : (
        <FlatList
          data={filteredCounselors}
          keyExtractor={(item) => (item.chatId ? String(item.chatId) : item.id?.toString())}
          renderItem={renderChatItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={filteredCounselors.length === 0 ? styles.listEmpty : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchChats(false)}
              tintColor="#4f46e5"
              colors={['#4f46e5']}
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
              <Text style={styles.modalTitle}>Delete Chat</Text>
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
                  Are you sure you want to delete this chat?
                </Text>
                <Text style={styles.deleteWarning}>
                  ⚠️ This action cannot be undone. All messages will be permanently deleted.
                </Text>
                {selectedCounselor.fullDateTime && (
                  <Text style={styles.chatTimeInfo}>
                    Last message: {selectedCounselor.fullDateTime}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDeleteChat}
              >
                <Text style={styles.deleteButtonText}>Delete Chat</Text>
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
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    paddingHorizontal: 10,
    height: 46,
    borderWidth: 1,
    borderColor: '#dbe4f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  searchIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    paddingVertical: 0,
  },
  searchClearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },

  list: {
    paddingVertical: 0,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginHorizontal: 12,
    marginVertical: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: '#94a3b8',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#4f46e5',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  specialization: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 8,
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
    fontSize: 11,
    color: '#94a3b8',
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
