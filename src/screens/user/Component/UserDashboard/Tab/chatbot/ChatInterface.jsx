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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import safeVibrate from '../../../../../../utils/safeVibrate';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ChatInterface = ({ setActiveTab }) => {
  const navigation = useNavigation();

  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, counselor: null });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [counselorToDelete, setCounselorToDelete] = useState(null);
  const [error, setError] = useState(null);

  const contextMenuAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getAvatarColor = (name) => {
    if (!name) return '#4f46e5';
    const colors = ['#4f46e5', '#0891b2', '#059669', '#b45309', '#c2410c', '#7e22ce', '#be123c', '#1e40af'];
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
      return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatFullDateTime = (timeString) => {
    if (!timeString) return '';
    try {
      return new Date(timeString).toLocaleString([], {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return timeString;
    }
  };

  const fetchChats = useCallback(async () => {
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
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setCounselors([]);
        setLoading(false);
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
    }
  }, []);

  const markChatAsRead = useCallback(async (chatId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      await axios.post(
        `${API_BASE_URL}/api/chat/mark-all-read`,
        { chatId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCounselors((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)));
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }, []);

  const deleteChat = useCallback(async (chatId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return false;
      const response = await axios.delete(`${API_BASE_URL}/api/chat/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 200 || response.status === 204) {
        setCounselors((prev) => prev.filter((c) => c.id !== chatId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  const handleCounselorSelect = useCallback(async (counselor) => {
    if (contextMenu.visible) return;
    safeVibrate(80);
    await markChatAsRead(counselor.id);
    navigation.navigate('ChatBox', {
      chatId: counselor.chatId,
      counselor: {
        id: counselor.id,
        name: counselor.name,
        specialization: counselor.specialization,
        online: counselor.online,
        lastSeen: counselor.lastSeen,
        avatar: counselor.avatar,
      },
    });
  }, [contextMenu.visible, markChatAsRead, navigation]);

  const handleStartNewChat = useCallback(() => {
    safeVibrate(100);
    if (setActiveTab) {
      setActiveTab('Counselor');
    } else {
      navigation.navigate('CounselorTable');
    }
  }, [setActiveTab, navigation]);

  const handleLongPress = useCallback((counselor) => {
    safeVibrate(150);
    setContextMenu({
      visible: true,
      x: screenWidth / 2 - 150,
      y: screenHeight / 2 - 150,
      counselor,
    });
    Animated.spring(contextMenuAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
  }, [contextMenuAnim]);

  const closeContextMenu = useCallback(() => {
    Animated.timing(contextMenuAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setContextMenu({ visible: false, x: 0, y: 0, counselor: null });
    });
  }, [contextMenuAnim]);

  const handleDeleteChat = useCallback((counselor) => {
    setCounselorToDelete(counselor);
    setShowDeleteConfirm(true);
    closeContextMenu();
    Animated.spring(modalAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
  }, [closeContextMenu, modalAnim]);

  const confirmDeleteChat = useCallback(async () => {
    if (counselorToDelete) {
      const success = await deleteChat(counselorToDelete.id);
      if (success) safeVibrate([120, 60, 120]);
      setShowDeleteConfirm(false);
      setCounselorToDelete(null);
      modalAnim.setValue(0);
    }
  }, [counselorToDelete, deleteChat, modalAnim]);

  const filteredCounselors = counselors.filter((counselor) =>
    counselor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    counselor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
    counselor.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderCounselorItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleCounselorSelect(item)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatarWrapper}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(item.name) }]}>
              <Text style={styles.avatarInitials}>{getInitials(item.name)}</Text>
            </View>
          )}
          <View style={[styles.onlineDot, item.online ? styles.online : styles.offline]} />
        </View>
      </View>

      <View style={styles.cardCenter}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.specializationBadge}>
          <Text style={styles.specializationText}>{item.specialization?.toUpperCase() || 'COUNSELOR'}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
      </View>

      <View style={styles.cardRight}>
        <Text style={styles.time}>{item.time}</Text>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.chatBtn, item.status === 'accepted' && styles.chatBtnActive]}
          onPress={() => handleCounselorSelect(item)}
        >
          <Text style={[styles.chatBtnText, item.status === 'accepted' && styles.chatBtnTextActive]}>
            {item.status === 'accepted' ? 'Chat' : 'Book'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#2c50cd" />
          <Text style={styles.emptyText}>Loading your chats...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchChats}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (searchTerm) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found for "{searchTerm}"</Text>
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Text style={styles.linkText}>Clear search</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active chats yet</Text>
        <TouchableOpacity onPress={handleStartNewChat}>
          <Text style={styles.linkText}>Find a Counselor</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* SEARCH BAR - Matching HTML design */}
      <View style={styles.searchSection}>
      
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#74777c" style={styles.searchLeadingIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, specialty, or message"
            placeholderTextColor="#74777c"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 ? (
            <TouchableOpacity style={styles.searchActionBtn} onPress={() => setSearchTerm('')}>
              <Ionicons name="close" size={16} color="#4b5563" />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchActionBtn}>
              <MaterialIcons name="tune" size={18} color="#74777c" />
            </View>
          )}
        </View>

      </View>

      {/* COUNSELOR LIST */}
      <FlatList
        data={filteredCounselors}
        keyExtractor={(item) => item.id?.toString() || item.chatId}
        renderItem={renderCounselorItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
      />

      {/* CONTEXT MENU MODAL */}
      <Modal transparent visible={contextMenu.visible} animationType="none" onRequestClose={closeContextMenu}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeContextMenu}>
          <Animated.View style={[styles.contextMenu, { opacity: contextMenuAnim, transform: [{ scale: contextMenuAnim }] }]}>
            {contextMenu.counselor && (
              <>
                <View style={styles.contextMenuHeader}>
                  <View style={styles.contextMenuAvatar}>
                    {contextMenu.counselor.avatar ? (
                      <Image source={{ uri: contextMenu.counselor.avatar }} style={styles.contextMenuAvatarImg} />
                    ) : (
                      <View style={[styles.contextMenuAvatarPlaceholder, { backgroundColor: getAvatarColor(contextMenu.counselor.name) }]}>
                        <Text style={styles.contextMenuAvatarInitials}>{getInitials(contextMenu.counselor.name)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.contextMenuInfo}>
                    <Text style={styles.contextMenuName}>{contextMenu.counselor.name}</Text>
                    <Text style={styles.contextMenuStatus}>{contextMenu.counselor.online ? '🟢 Online' : '⚫ Offline'}</Text>
                    <Text style={styles.contextMenuTime} numberOfLines={1}>Last: {contextMenu.counselor.fullDateTime}</Text>
                  </View>
                </View>
                <View style={styles.contextMenuItems}>
                  <TouchableOpacity style={styles.contextMenuItem} onPress={() => { markChatAsRead(contextMenu.counselor.id); closeContextMenu(); }}>
                    <Text style={styles.contextMenuIcon}>✓</Text>
                    <Text style={styles.contextMenuItemText}>Mark as Read</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contextMenuItem} onPress={() => handleDeleteChat(contextMenu.counselor)}>
                    <Text style={styles.contextMenuIcon}>🗑️</Text>
                    <Text style={[styles.contextMenuItemText, styles.dangerText]}>Delete Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contextMenuItem} onPress={closeContextMenu}>
                    <Text style={styles.contextMenuIcon}>✕</Text>
                    <Text style={styles.contextMenuItemText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal transparent visible={showDeleteConfirm} animationType="none" onRequestClose={() => setShowDeleteConfirm(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDeleteConfirm(false)}>
          <Animated.View style={[styles.deleteModal, { opacity: modalAnim, transform: [{ scale: modalAnim }] }]}>
            {counselorToDelete && (
              <>
                <View style={styles.deleteModalHeader}>
                  <Text style={styles.deleteModalTitle}>Delete Chat</Text>
                </View>
                <View style={styles.deleteModalBody}>
                  <View style={styles.deleteCounselorInfo}>
                    {counselorToDelete.avatar ? (
                      <Image source={{ uri: counselorToDelete.avatar }} style={styles.deleteAvatar} />
                    ) : (
                      <View style={[styles.deleteAvatarPlaceholder, { backgroundColor: getAvatarColor(counselorToDelete.name) }]}>
                        <Text style={styles.deleteAvatarInitials}>{getInitials(counselorToDelete.name)}</Text>
                      </View>
                    )}
                    <View style={styles.deleteInfo}>
                      <Text style={styles.deleteName}>{counselorToDelete.name}</Text>
                      <Text style={styles.deleteSpecialization}>{counselorToDelete.specialization}</Text>
                    </View>
                  </View>
                  <Text style={styles.deleteConfirmText}>Are you sure you want to delete this chat?</Text>
                  <View style={styles.deleteWarning}>
                    <Text style={styles.deleteWarningText}>⚠️ This action cannot be undone. All messages will be permanently deleted.</Text>
                  </View>
                  {counselorToDelete.fullDateTime && (
                    <Text style={styles.deleteMeta}>Last message: {counselorToDelete.fullDateTime}</Text>
                  )}
                </View>
                <View style={styles.deleteModalFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeleteChat}>
                    <Text style={styles.deleteBtnText}>Delete Chat</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb', // HTML background color
  },

  // Search Section - Matching HTML
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
    backgroundColor: '#f7f9fb',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  searchHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Manrope' : 'sans-serif',
  },
  searchCount: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#1e3a8a',
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d6dde5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchLeadingIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#191c1e',
    paddingVertical: 7,
    paddingHorizontal: 0,
    fontFamily: Platform.OS === 'ios' ? 'Manrope' : 'sans-serif',
  },
  searchActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  tableHeaderRow: {
    marginTop: 10,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tableHeaderCounselor: {
    flex: 1,
  },
  tableHeaderStatus: {
    minWidth: 72,
    textAlign: 'right',
  },

  // List
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },

  // Card - Matching HTML card design
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(196,198,204,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: {
    marginRight: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  online: {
    backgroundColor: '#10b981',
  },
  offline: {
    backgroundColor: '#cbd5e1',
  },
  cardCenter: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#081625',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Manrope' : 'sans-serif',
  },
  specializationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#d5e4f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specializationText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0e1d2b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastMessage: {
    fontSize: 12,
    color: '#44474c',
    lineHeight: 16,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginLeft: 12,
    minWidth: 80,
  },
  time: {
    fontSize: 12,
    color: '#74777c',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  chatBtn: {
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
  },
  chatBtnActive: {
    backgroundColor: '#2c50cd',
    shadowColor: '#2c50cd',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  chatBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#44474c',
  },
  chatBtnTextActive: {
    color: '#ffffff',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#2c50cd',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c50cd',
    textDecorationLine: 'underline',
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Context Menu
  contextMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: 280,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  contextMenuHeader: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#2c50cd',
    gap: 10,
    alignItems: 'center',
  },
  contextMenuAvatar: {
    flexShrink: 0,
  },
  contextMenuAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  contextMenuAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenuAvatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  contextMenuInfo: {
    flex: 1,
  },
  contextMenuName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  contextMenuStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  contextMenuTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  contextMenuItems: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 10,
  },
  contextMenuIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
    color: '#4b5563',
  },
  contextMenuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  dangerText: {
    color: '#dc2626',
  },

  // Delete Modal
  deleteModal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 380,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  deleteModalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  deleteModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  deleteCounselorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    marginBottom: 16,
  },
  deleteAvatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  deleteAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  deleteInfo: {
    flex: 1,
  },
  deleteName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  deleteSpecialization: {
    fontSize: 11,
    color: '#2c50cd',
    fontWeight: '500',
  },
  deleteConfirmText: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
    lineHeight: 20,
  },
  deleteWarning: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    marginBottom: 12,
  },
  deleteWarningText: {
    fontSize: 12,
    color: '#b91c1c',
    lineHeight: 18,
  },
  deleteMeta: {
    fontSize: 11,
    color: '#64748b',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    fontStyle: 'italic',
  },
  deleteModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 14,
    gap: 10,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  deleteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#dc2626',
    borderRadius: 10,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
};

export default ChatInterface;