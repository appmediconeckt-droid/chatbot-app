import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../../../../../axiosConfig';

const SMSList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Format time difference from createdAt
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return past.toLocaleDateString();
  };

  // Fetch chats from API
  const fetchChats = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setError('No access token found. Please log in.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chat/chats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform API data to match component structure
      const transformedUsers = data.chats.map(chat => {
        const otherParty = chat.otherParty || {};
        const displayName = otherParty.anonymous || otherParty.name || 'Anonymous User';
        const gender = otherParty.gender || 'neutral';
        const actualUserId = otherParty.id || otherParty._id || otherParty.userId || otherParty.user_id;

        return {
          id: chat.chatId,
          _id: actualUserId,
          receiverId: actualUserId,
          user: otherParty,
          chatId: chat.chatId,
          name: displayName,
          lastMessage: chat.lastMessage?.content || 'No messages yet',
          time: formatTimeAgo(chat.lastMessage?.createdAt || chat.updatedAt),
          unread: chat.unreadCount || 0,
          gender: gender,
          status: chat.status === 'pending' ? 'offline' : 'online',
          phone: otherParty.phone || 'Not available',
          email: otherParty.email || 'Not available',
          specialization: otherParty.specialization,
          rating: otherParty.rating,
          isExpired: chat.isExpired,
          expiresAt: chat.expiresAt,
          startedAt: chat.startedAt,
          acceptedAt: chat.acceptedAt,
          rejectedAt: chat.rejectedAt,
          cancelledAt: chat.cancelledAt,
        };
      });
      
      setUsers(transformedUsers);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  };

  // Filter users based on the displayed (anonymous) name
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = (user) => {
    navigation.navigate('SmsInput', { 
      selectedUser: user,
      chatId: user.chatId,
      chatData: user
    });
  };

  const totalUnread = users.reduce((acc, user) => acc + user.unread, 0);

  // Get gender-based avatar icon
  const getAvatarIcon = (gender) => {
    if (gender === 'male') return '👨';
    if (gender === 'female') return '👩';
    return '👤';
  };

  const renderUserItem = ({ item: user }) => (
    <TouchableOpacity
      style={[styles.userItem, user.isExpired && styles.expiredChat]}
      onPress={() => handleUserClick(user)}
      activeOpacity={0.7}
    >
      {/* Avatar with Status */}
      <View style={styles.userAvatar}>
        <View style={styles.avatarIconContainer}>
          <Text style={styles.avatarIcon}>{getAvatarIcon(user.gender)}</Text>
        </View>
        <View style={[styles.statusDot, styles[user.status]]} />
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <View style={styles.userRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.name}
          </Text>
          <Text style={styles.timeText}>{user.time}</Text>
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
          {user.specialization && user.specialization.length > 0 && (
            <View style={styles.specializationBadge}>
              <Text style={styles.specializationText}>
                {user.specialization[0]}
              </Text>
            </View>
          )}
          <Text style={[styles.statusText, styles[user.status]]}>
            {user.status === 'online' ? '🟢 Active' : '⚪ Inactive'}
          </Text>
        </View>

        {user.isExpired && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredText}>⚠️ Expired</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No conversations found</Text>
      <Text style={styles.emptyText}>
        Try searching with a different anonymous name
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error loading chats</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchChats}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>SMS List</Text>
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
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by anonymous name..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#6c757d"
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
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  // Header Styles
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
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
    fontWeight: '600',
    color: '#1a1a2e',
  },
  totalBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  totalText: {
    fontSize: 12,
    color: '#6c757d',
  },
  unreadBadgeHeader: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  unreadBadgeHeaderText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  // Search Bar Styles
  searchContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    top: 26,
    fontSize: 16,
    color: '#6c757d',
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 25,
    fontSize: 14,
    backgroundColor: 'white',
    width: '100%',
  },
  searchClear: {
    position: 'absolute',
    right: 28,
    top: 22,
    padding: 4,
  },
  searchClearText: {
    fontSize: 16,
    color: '#6c757d',
  },
  // User Item Styles
  listContent: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  },
  expiredChat: {
    opacity: 0.7,
    backgroundColor: '#fef5e7',
  },
  // Avatar Styles
  userAvatar: {
    position: 'relative',
    marginRight: 15,
  },
  avatarIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    fontSize: 24,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  online: {
    backgroundColor: '#4caf50',
  },
  offline: {
    backgroundColor: '#9e9e9e',
  },
  // User Info Styles
  userInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#6c757d',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 13,
    color: '#6c757d',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  userDetails: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  specializationBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specializationText: {
    fontSize: 10,
    color: '#6c757d',
  },
  statusText: {
    fontSize: 11,
  },
  statusTextOnline: {
    color: '#4caf50',
  },
  statusTextOffline: {
    color: '#9e9e9e',
  },
  expiredBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ff9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  // Empty State Styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  // Loading State Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6c757d',
  },
  // Error State Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc3545',
  },
  errorText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4a90e2',
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SMSList;