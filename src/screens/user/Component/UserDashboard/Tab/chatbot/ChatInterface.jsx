import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import safeVibrate from '../../../../../../utils/safeVibrate';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ChatInterface = ({ setActiveTab }) => {
  const navigation = useNavigation();
  const route = useRoute();

  // State for counselors and chats
  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    counselor: null,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [counselorToDelete, setCounselorToDelete] = useState(null);
  const [error, setError] = useState(null);

  // Animation values
  const contextMenuAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;

  // Refs for long press
  const longPressTimer = useRef(null);
  const pressedItem = useRef(null);
  const touchMoved = useRef(false);

  // Function to get profile photo URL
  const getProfilePhotoUrl = (counselor) => {
    if (counselor?.profilePhoto?.url) {
      return counselor.profilePhoto.url;
    }
    if (counselor?.avatar && typeof counselor.avatar === 'string' && counselor.avatar.startsWith('http')) {
      return counselor.avatar;
    }
    return null;
  };

  // Get avatar initials
  const getInitials = (name) => {
    if (!name) return '👤';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Get random color for avatar based on name
  const getAvatarColor = (name) => {
    if (!name) return '#4f46e5';

    const colors = [
      '#4f46e5',
      '#0891b2',
      '#059669',
      '#b45309',
      '#c2410c',
      '#7e22ce',
      '#be123c',
      '#1e40af',
      '#0f766e',
      '#6b21a8',
      '#d97706',
      '#dc2626',
      '#16a34a',
      '#9333ea',
      '#db2777',
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Format time for display (relative time)
  const formatTime = (timeString) => {
    if (!timeString) return '';

    try {
      const messageTime = new Date(timeString);
      const now = new Date();
      const diffMs = now - messageTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffHours < 1) return `${diffMins}m ago`;
      if (diffDays === 0)
        return messageTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7)
        return messageTime.toLocaleDateString([], { weekday: 'short' });
      if (diffDays < 30) return `${diffDays}d ago`;
      return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (error) {
      return timeString;
    }
  };

  // Format full date and time for tooltip
  const formatFullDateTime = (timeString) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      return timeString;
    }
  };

  // Format last seen time
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Offline';

    try {
      const lastSeenTime = new Date(lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffHours < 1) return `${diffMins} minutes ago`;
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return lastSeenTime.toLocaleDateString();
    } catch (error) {
      return 'Recently';
    }
  };

  // Fetch chats from API
  const fetchChats = useCallback(async () => {
    const resolveLastPrompt = (chat) => {
      const latestFromArray = Array.isArray(chat?.messages) && chat.messages.length > 0
        ? chat.messages[chat.messages.length - 1]
        : null;

      return (
        chat?.lastMessage?.content ||
        chat?.lastMessage?.message ||
        chat?.lastMessage?.text ||
        chat?.lastMessage?.prompt ||
        latestFromArray?.content ||
        latestFromArray?.message ||
        latestFromArray?.text ||
        latestFromArray?.prompt ||
        'No messages yet'
      );
    };

    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('No token found');
        setCounselors([]);
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/chat/chats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        const data = response.data;

        if (data && data.chats && Array.isArray(data.chats)) {
          const counselorList = data.chats.map((chat) => {
            const otherParty = chat.otherParty || {};
            const lastMessage = resolveLastPrompt(chat);
            const lastMessageTime =
              chat.lastMessage?.createdAt || chat.updatedAt || chat.startedAt;

            let specialization = 'Counselor';
            if (otherParty.specialization) {
              if (
                Array.isArray(otherParty.specialization) &&
                otherParty.specialization.length > 0
              ) {
                specialization = otherParty.specialization[0];
              } else if (typeof otherParty.specialization === 'string') {
                specialization = otherParty.specialization;
              }
            }

            return {
              id: otherParty.id || chat.chatId,
              name: otherParty.name || 'Unknown Counselor',
              lastMessage: lastMessage,
              lastMessageTime: lastMessageTime,
              time: formatTime(lastMessageTime),
              fullDateTime: formatFullDateTime(lastMessageTime),
              unread: chat.unreadCount || 0,
              online: otherParty.isActive || false,
              lastSeen: otherParty.lastSeen || null,
              avatar: otherParty.avatar || null,
              avatarType: 'image',
              specialization: specialization,
              chatId: chat.chatId,
              user: {},
              startedAt: chat.startedAt,
              acceptedAt: chat.acceptedAt,
              status: chat.status,
              isExpired: chat.isExpired,
              messages: [],
              messageCount: 0,
            };
          });

          counselorList.sort((a, b) => {
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            return timeB - timeA;
          });

          setCounselors(counselorList);

          try {
            await AsyncStorage.setItem('activeChats', JSON.stringify(data.chats));
          } catch (storageError) {
            console.error('Error saving chats to AsyncStorage:', storageError);
          }
        } else {
          setCounselors([]);
        }
      } else if (response.status === 401) {
        await AsyncStorage.removeItem('token');
        setCounselors([]);
      } else {
        throw new Error(`Failed to fetch chats: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError(error.message);

      try {
        const savedChats = await AsyncStorage.getItem('activeChats');
        if (savedChats) {
          const chats = JSON.parse(savedChats);
          if (Array.isArray(chats) && chats.length > 0) {
            const counselorList = chats.map((chat) => {
              const otherParty = chat.otherParty || {};
              const lastMessage = resolveLastPrompt(chat);
              const lastMessageTime =
                chat.lastMessage?.createdAt || chat.updatedAt || chat.startedAt;

              let specialization = 'Counselor';
              if (otherParty.specialization) {
                if (
                  Array.isArray(otherParty.specialization) &&
                  otherParty.specialization.length > 0
                ) {
                  specialization = otherParty.specialization[0];
                } else if (typeof otherParty.specialization === 'string') {
                  specialization = otherParty.specialization;
                }
              }

              return {
                id: otherParty.id || chat.chatId,
                name: otherParty.name || 'Unknown Counselor',
                lastMessage: lastMessage,
                lastMessageTime: lastMessageTime,
                time: formatTime(lastMessageTime),
                fullDateTime: formatFullDateTime(lastMessageTime),
                unread: chat.unreadCount || 0,
                online: otherParty.isActive || false,
                lastSeen: otherParty.lastSeen || null,
                avatar: otherParty.avatar || null,
                avatarType: 'image',
                specialization: specialization,
                chatId: chat.chatId,
                user: {},
                startedAt: chat.startedAt,
                acceptedAt: chat.acceptedAt,
                status: chat.status,
                isExpired: chat.isExpired,
                messages: [],
                messageCount: 0,
              };
            });

            counselorList.sort((a, b) => {
              const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
              const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
              return timeB - timeA;
            });

            setCounselors(counselorList);
          }
        }
      } catch (localError) {
        console.error('Error loading chats from AsyncStorage:', localError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark chat as read
  const markChatAsRead = useCallback(async (chatId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await axios.post(
        `${API_BASE_URL}/api/chat/mark-all-read`,
        { chatId: chatId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200) {
        setCounselors((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c))
        );
      }
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }, []);

  // Delete chat
  const deleteChat = useCallback(async (chatId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return false;

      const response = await axios.delete(`${API_BASE_URL}/api/chat/chats/${chatId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200 || response.status === 204) {
        setCounselors((prev) => prev.filter((c) => c.id !== chatId));

        try {
          const savedChats = await AsyncStorage.getItem('activeChats');
          if (savedChats) {
            const chats = JSON.parse(savedChats);
            const updatedChats = chats.filter((chat) => chat.chatId !== chatId);
            await AsyncStorage.setItem('activeChats', JSON.stringify(updatedChats));
          }
        } catch (storageError) {
          console.error('Error updating AsyncStorage:', storageError);
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }, []);

  // Load active chats from API
  useEffect(() => {
    fetchChats();

    const intervalId = setInterval(() => {
      fetchChats();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [fetchChats]);

  // Handle counselor selection
  const handleCounselorSelect = useCallback(
    async (counselor) => {
      if (contextMenu.visible) return;

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
          profilePhoto: counselor.avatar,
          avatarType: counselor.avatarType,
        },
        user: counselor.user,
      });
    },
    [contextMenu.visible, markChatAsRead, navigation]
  );

  // Handle start new chat
  const handleStartNewChat = useCallback(() => {
    if (setActiveTab) {
      setActiveTab('Counselor');
    } else {
      navigation.navigate('CounselorTable');
    }
  }, [setActiveTab, navigation]);

  // Handle long press start (mobile)
  const handleLongPress = useCallback((counselor) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      safeVibrate(50);
    }

    setContextMenu({
      visible: true,
      x: screenWidth / 2 - 150,
      y: screenHeight / 2 - 150,
      counselor: counselor,
    });

    Animated.spring(contextMenuAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  // Handle item click
  const handleItemClick = useCallback(
    (counselor) => {
      if (contextMenu.visible) {
        closeContextMenu();
        return;
      }
      handleCounselorSelect(counselor);
    },
    [contextMenu.visible, handleCounselorSelect]
  );

  // Close context menu
  const closeContextMenu = useCallback(() => {
    Animated.timing(contextMenuAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setContextMenu({ visible: false, x: 0, y: 0, counselor: null });
    });
  }, [contextMenuAnim]);

  // Handle delete chat
  const handleDeleteChat = useCallback(
    (counselor) => {
      setCounselorToDelete(counselor);
      setShowDeleteConfirm(true);
      closeContextMenu();

      Animated.spring(modalAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    },
    [closeContextMenu, modalAnim]
  );

  // Confirm delete chat
  const confirmDeleteChat = useCallback(async () => {
    if (counselorToDelete) {
      const success = await deleteChat(counselorToDelete.id);

      if (success && (Platform.OS === 'ios' || Platform.OS === 'android')) {
        safeVibrate([50, 30, 50]);
      }

      setShowDeleteConfirm(false);
      setCounselorToDelete(null);
    }
  }, [counselorToDelete, deleteChat]);

  // Filter counselors based on search term
  const filteredCounselors = counselors.filter(
    (counselor) =>
      counselor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counselor.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render avatar component
  const renderAvatar = useCallback((counselor, size = 'md') => {
    const profilePhotoUrl = getProfilePhotoUrl(counselor);
    const avatarSize = size === 'sm' ? 40 : size === 'lg' ? 64 : 56;
    const fontSize = size === 'sm' ? 14 : size === 'lg' ? 24 : 20;

    if (profilePhotoUrl) {
      return (
        <Image
          source={{ uri: profilePhotoUrl }}
          style={[
            styles.avatarImage,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
          onError={() => {
            // Fallback handled by parent
          }}
        />
      );
    }

    return (
      <View
        style={[
          styles.avatarInitials,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: getAvatarColor(counselor.name),
          },
        ]}
      >
        <Text style={[styles.avatarInitialsText, { fontSize }]}>
          {getInitials(counselor.name)}
        </Text>
      </View>
    );
  }, []);

  // Render each counselor item
  const renderCounselorItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.counselorListItemWrapper}
        onPress={() => handleItemClick(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        <View style={styles.counselorListItem}>
          <View style={styles.counselorAvatarContainer}>
            <View style={styles.counselorAvatar}>
              {renderAvatar(item, 'md')}
            </View>
            <View
              style={[
                styles.counselorStatus,
                item.online ? styles.counselorStatusOnline : styles.counselorStatusOffline,
              ]}
            />
          </View>

          <View style={styles.counselorInfo}>
            <View style={styles.counselorNameRow}>
              <Text style={styles.counselorName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.counselorTime}>{item.time}</Text>
            </View>

            <View style={styles.counselorLastMessageRow}>
              <Text style={styles.counselorLastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
              {item.unread > 0 && (
                <View style={styles.counselorUnreadBadge}>
                  <Text style={styles.counselorUnreadText}>{item.unread}</Text>
                </View>
              )}
            </View>

            <View style={styles.counselorMetaInfo}>
              <Text style={styles.counselorSpecialization}>
                {item.specialization}
              </Text>
              {item.status === 'accepted' && (
                <View style={[styles.counselorStatusBadge, styles.statusAccepted]}>
                  <Text style={styles.statusAcceptedText}>✓ Accepted</Text>
                </View>
              )}
              {item.isExpired && (
                <View style={[styles.counselorStatusBadge, styles.statusExpired]}>
                  <Text style={styles.statusExpiredText}>⌛ Expired</Text>
                </View>
              )}
            </View>

            {!item.online && item.lastSeen && (
              <Text style={styles.counselorLastSeen}>
                Last seen: {formatLastSeen(item.lastSeen)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    ),
    [renderAvatar, handleItemClick, handleLongPress]
  );

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (searchTerm) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No counselors found matching "{searchTerm}"
          </Text>
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Text style={styles.emptyLink}>Clear search</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active chats yet.</Text>
        <TouchableOpacity onPress={handleStartNewChat}>
          <Text style={styles.emptyLink}>Start a new chat</Text>
        </TouchableOpacity>
      </View>
    );
  }, [searchTerm, handleStartNewChat]);

  // Render loading state
  const renderLoading = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#667eea" />
      <Text style={styles.loadingText}>Loading your chats...</Text>
    </View>
  ), []);

  // Render error state
  const renderError = useCallback(() => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>⚠️ {error}</Text>
      <TouchableOpacity onPress={fetchChats} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ), [error, fetchChats]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />

      <View style={styles.counselorSidebar}>
        <View style={styles.counselorSidebarHeader}>
          <Text style={styles.counselorListTitle}>My Counselors</Text>
          <View style={styles.counselorSearchBox}>
            <TextInput
              style={styles.counselorSearchInput}
              placeholder="Search counselors..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            <Text style={styles.counselorSearchIcon}>🔍</Text>
          </View>
        </View>

        <FlatList
          data={filteredCounselors}
          keyExtractor={(item) => item.id?.toString() || item.chatId}
          renderItem={renderCounselorItem}
          contentContainerStyle={styles.counselorListContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? renderLoading() : error ? renderError() : renderEmptyState()
          }
        />
      </View>

      {/* Context Menu Modal */}
      <Modal
        transparent
        visible={contextMenu.visible}
        animationType="none"
        onRequestClose={closeContextMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeContextMenu}
        >
          <Animated.View
            style={[
              styles.contextMenu,
              {
                left: contextMenu.x,
                top: contextMenu.y,
                opacity: contextMenuAnim,
                transform: [
                  {
                    scale: contextMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {contextMenu.counselor && (
              <>
                <View style={styles.contextMenuHeader}>
                  <View style={styles.contextMenuAvatar}>
                    {renderAvatar(contextMenu.counselor, 'sm')}
                  </View>
                  <View style={styles.contextMenuHeaderInfo}>
                    <Text style={styles.contextMenuCounselorName}>
                      {contextMenu.counselor.name}
                    </Text>
                    <Text style={styles.contextMenuStatus}>
                      {contextMenu.counselor.online ? '🟢 Online' : '⚫ Offline'}
                    </Text>
                    <Text style={styles.contextMenuTime} numberOfLines={1}>
                      Last message: {contextMenu.counselor.fullDateTime}
                    </Text>
                  </View>
                </View>
                <View style={styles.contextMenuItems}>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      markChatAsRead(contextMenu.counselor.id);
                      closeContextMenu();
                    }}
                  >
                    <Text style={styles.contextMenuIcon}>✓</Text>
                    <Text style={styles.contextMenuText}>Mark as Read</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.contextMenuItem, styles.contextMenuItemDelete]}
                    onPress={() => handleDeleteChat(contextMenu.counselor)}
                  >
                    <Text style={styles.contextMenuIcon}>🗑️</Text>
                    <Text style={styles.contextMenuText}>Delete Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={closeContextMenu}
                  >
                    <Text style={styles.contextMenuIcon}>✕</Text>
                    <Text style={styles.contextMenuText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        transparent
        visible={showDeleteConfirm}
        animationType="none"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {counselorToDelete && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Delete Chat</Text>
                </View>
                <View style={styles.modalBody}>
                  <View style={styles.deleteCounselorInfo}>
                    <View style={styles.deleteAvatar}>
                      {renderAvatar(counselorToDelete, 'lg')}
                    </View>
                    <View style={styles.deleteInfo}>
                      <Text style={styles.deleteName}>{counselorToDelete.name}</Text>
                      <Text style={styles.deleteSpecialization}>
                        {counselorToDelete.specialization}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.deleteConfirmText}>
                    Are you sure you want to delete this chat?
                  </Text>
                  <View style={styles.deleteWarning}>
                    <Text style={styles.deleteWarningText}>
                      ⚠️ This action cannot be undone. All messages will be permanently deleted.
                    </Text>
                  </View>
                  {counselorToDelete.fullDateTime && (
                    <Text style={styles.chatTimeInfo}>
                      Last message: {counselorToDelete.fullDateTime}
                    </Text>
                  )}
                </View>
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.btnSecondary}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnDanger}
                    onPress={confirmDeleteChat}
                  >
                    <Text style={styles.btnDangerText}>Delete Chat</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  counselorSidebar: {
    flex: 1,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  counselorSidebarHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    backgroundColor: '#ffffff',
  },
  counselorListTitle: {
    marginBottom: 20,
    color: '#1e293b',
    fontSize: 24,
    fontWeight: '700',
  },
  counselorSearchBox: {
    position: 'relative',
    width: '100%',
  },
  counselorSearchInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 40,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#1e293b',
  },
  counselorSearchIcon: {
    position: 'absolute',
    right: 14,
    top: 12,
    color: '#94a3b8',
    fontSize: 18,
  },
  counselorListContainer: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexGrow: 1,
  },
  counselorListItemWrapper: {
    marginBottom: 8,
    borderRadius: 16,
  },
  counselorListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f6',
    gap: 12,
  },
  counselorAvatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  counselorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  counselorStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  counselorStatusOnline: {
    backgroundColor: '#10b981',
  },
  counselorStatusOffline: {
    backgroundColor: '#94a3b8',
  },
  counselorInfo: {
    flex: 1,
  },
  counselorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  counselorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  counselorTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginLeft: 8,
  },
  counselorLastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  counselorLastMessage: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  counselorUnreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  counselorUnreadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  counselorMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  counselorSpecialization: {
    fontSize: 11,
    color: '#667eea',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontWeight: '500',
    overflow: 'hidden',
  },
  counselorStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusAccepted: {
    backgroundColor: '#d1fae5',
  },
  statusAcceptedText: {
    fontSize: 10,
    color: '#065f46',
    fontWeight: '500',
  },
  statusExpired: {
    backgroundColor: '#fee2e2',
  },
  statusExpiredText: {
    fontSize: 10,
    color: '#991b1b',
    fontWeight: '500',
  },
  counselorLastSeen: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyLink: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: 280,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  contextMenuHeader: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#667eea',
    gap: 12,
    alignItems: 'center',
  },
  contextMenuAvatar: {
    flexShrink: 0,
  },
  contextMenuHeaderInfo: {
    flex: 1,
  },
  contextMenuCounselorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  contextMenuStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  contextMenuTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  contextMenuItems: {
    padding: 8,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  contextMenuItemDelete: {
    // No specific styles needed
  },
  contextMenuIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  contextMenuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '90%',
    maxWidth: 420,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  deleteCounselorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginBottom: 20,
  },
  deleteAvatar: {
    flexShrink: 0,
  },
  deleteInfo: {
    flex: 1,
  },
  deleteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  deleteSpecialization: {
    fontSize: 12,
    color: '#667eea',
  },
  deleteConfirmText: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  deleteWarning: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
    marginBottom: 12,
  },
  deleteWarningText: {
    fontSize: 13,
    color: '#dc2626',
  },
  chatTimeInfo: {
    fontSize: 12,
    color: '#64748b',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eef2f6',
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    gap: 12,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eef2f6',
  },
  btnSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  btnDanger: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  btnDangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
};

export default ChatInterface;
