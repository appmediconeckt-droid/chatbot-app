import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'https://chatbot-backend-js25.onrender.com';

const SMSList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  const handleSessionExpired = useCallback(() => {
    AsyncStorage.multiRemove(['token', 'accessToken', 'userData']);
    navigation.replace('RoleSelector', {
      reason: 'session-expired',
      message: 'You were logged out because your account was used on another device.',
    });
  }, [navigation]);

  const getInitials = (name) => {
    if (!name) return 'US';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#4f46e5', '#0891b2', '#059669', '#b45309', '#c2410c',
      '#7e22ce', '#be123c', '#1e40af', '#0f766e', '#6b21a8',
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const messageTime = new Date(timeString);
    if (isNaN(messageTime.getTime())) return '';
    const now = new Date();
    const diffMs = now - messageTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffHours < 1) return `${diffMins}m ago`;
    if (diffDays === 0) {
      return messageTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)
      return messageTime.toLocaleDateString([], { weekday: 'short' });
    return messageTime.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFullDateTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch chats from API
  const fetchChats = useCallback(async () => {
    const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
    if (!token) {
      handleSessionExpired();
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chat/chats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const transformedUsers = (data.chats || []).map((chat) => {
        const otherParty = chat.otherParty || {};
        const displayName = otherParty.anonymous || otherParty.name || 'Anonymous User';
        const actualUserId = otherParty.id ||
          otherParty._id ||
          otherParty.userId ||
          otherParty.user_id ||
          chat.userId;

        const lastMessageTime = chat.lastMessage?.createdAt || chat.updatedAt || chat.startedAt;
        const chatStatus = String(chat.status || 'pending').toLowerCase();
        let specialization = 'Patient';
        if (Array.isArray(otherParty.specialization) && otherParty.specialization[0]) {
          specialization = otherParty.specialization[0];
        } else if (typeof otherParty.specialization === 'string') {
          specialization = otherParty.specialization;
        }

        return {
          id: chat.chatId,
          _id: actualUserId,
          receiverId: actualUserId,
          user: otherParty,
          chatId: chat.chatId,
          name: displayName,
          lastMessage: chat.lastMessage?.content || 'No messages yet',
          time: formatTime(lastMessageTime),
          fullDateTime: formatFullDateTime(lastMessageTime),
          lastActivityAt: lastMessageTime,
          unread: chat.unreadCount || 0,
          status: chatStatus,
          online: chatStatus === 'accepted' && !chat.isExpired,
          phone: otherParty.phone || 'Not available',
          email: otherParty.email || 'Not available',
          specialization,
          rating: otherParty.rating,
          isExpired: chat.isExpired,
          expiresAt: chat.expiresAt,
          startedAt: chat.startedAt,
          acceptedAt: chat.acceptedAt,
          rejectedAt: chat.rejectedAt,
          cancelledAt: chat.cancelledAt,
        };
      });

      transformedUsers.sort((a, b) => {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return bTime - aTime;
      });

      setUsers(transformedUsers);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  useEffect(() => {
    fetchChats();
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = (user) => {
    setSelectedChatId(user.chatId);
    navigation.navigate('SMSInput', {
      selectedUser: user,
      chatId: user.chatId,
      chatData: user,
    });
  };

  const totalUnread = users.reduce((acc, user) => acc + user.unread, 0);

  const getStatusBadgeText = (status) => {
    if (status === 'accepted') return 'Accepted';
    if (status === 'pending') return 'Pending';
    if (status === 'rejected') return 'Rejected';
    if (status === 'ended') return 'Ended';
    return 'Active';
  };

  const getStatusBadgeStyle = (status) => {
    if (status === 'accepted') return styles.statusAccepted;
    if (status === 'pending') return styles.statusPending;
    if (status === 'rejected') return styles.statusRejected;
    if (status === 'ended') return styles.statusRejected;
    return styles.statusAccepted;
  };

  const renderUserItem = ({ item: user }) => {
    const statusBadgeText = getStatusBadgeText(user.status);
    const statusBadgeStyle = getStatusBadgeStyle(user.status);
    
    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          selectedChatId === user.chatId && styles.userItemSelected,
          user.isExpired && styles.expiredChat,
        ]}
        onPress={() => handleUserClick(user)}
        activeOpacity={0.7}
      >
        {/* Avatar with status indicator */}
        <View style={styles.userAvatar}>
          <View
            style={[styles.avatarInitials, { backgroundColor: getAvatarColor(user.name) }]}
          >
            <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
          </View>
          <View style={[styles.statusDot, user.online ? styles.statusOnline : styles.statusOffline]} />
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.userRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.timeText}>
              {user.time}
            </Text>
          </View>

          <View style={styles.lastMessageContainer}>
            <Text style={styles.messagePreview} numberOfLines={1}>
              {user.lastMessage}
            </Text>
            {user.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{user.unread}</Text>
              </View>
            )}
          </View>

          <View style={styles.userDetails}>
            <View style={styles.specializationBadge}>
              <Text style={styles.specializationText} numberOfLines={1}>
                {user.specialization}
              </Text>
            </View>
            <View style={[styles.statusBadge, statusBadgeStyle]}>
              <Text style={styles.statusText}>{statusBadgeText}</Text>
            </View>
          </View>

          {user.isExpired && (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredText}>⚠️ Expired</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Error loading chats</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChats}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalText}>{users.length} conversations</Text>
          </View>
        </View>
        {totalUnread > 0 && (
          <View style={styles.unreadBadgeHeader}>
            <Text style={styles.unreadBadgeHeaderText}>{totalUnread} unread</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor="#94a3b8"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm !== '' && (
          <TouchableOpacity style={styles.searchClear} onPress={() => setSearchTerm('')}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No conversations found</Text>
            <Text style={styles.emptyText}>
              Try searching with a different name
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop:-40,
    marginLeft:-12,
    marginRight:-12
  },
  // Header Styles - Consistent padding
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  totalText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  unreadBadgeHeader: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unreadBadgeHeaderText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Search Bar Styles - Consistent padding
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    backgroundColor: '#ffffff',
  },
  searchInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
  },
  searchClear: {
    position: 'absolute',
    right: 24,
    top: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchClearText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  // List Content - No extra margins
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  // User Item Styles - Full width, consistent border
  userItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f6',
    marginBottom: 8,
    backgroundColor: '#ffffff',
    width: '100%',
  },
  userItemSelected: {
    borderColor: '#6366f1',
    borderWidth: 1,
    backgroundColor: '#f8faff',
  },
  expiredChat: {
    opacity: 0.7,
  },
  // Avatar Styles
  userAvatar: {
    position: 'relative',
    width: 52,
    height: 52,
    flexShrink: 0,
  },
  avatarInitials: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
  },
  statusDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: '#94a3b8',
  },
  // User Info Styles
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  messagePreview: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  userDetails: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  specializationBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  specializationText: {
    fontSize: 10,
    color: '#4f46e5',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusAccepted: {
    backgroundColor: '#dcfce7',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e293b',
  },
  expiredBadge: {
    marginTop: 6,
  },
  expiredText: {
    backgroundColor: '#fff7ed',
    color: '#c2410c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  // Empty State
  emptyContainer: {
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6366f1',
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SMSList;