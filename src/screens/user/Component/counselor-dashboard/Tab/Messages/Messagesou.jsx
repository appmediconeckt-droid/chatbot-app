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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
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

  const handleSessionExpired = useCallback(() => {
    AsyncStorage.multiRemove(['token', 'accessToken', 'userData']);
    navigation.replace('RoleSelector', {
      reason: 'session-expired',
      message: 'Your session has expired. Please log in again.',
    });
  }, [navigation]);

  const getIdentityAssets = (name) => {
    const assets = [
      { colors: ['#6366f1', '#4f46e5'], icon: 'planet' },
      { colors: ['#10b981', '#059669'], icon: 'leaf' },
      { colors: ['#f59e0b', '#d97706'], icon: 'sunny' },
      { colors: ['#ef4444', '#dc2626'], icon: 'heart' },
      { colors: ['#8b5cf6', '#7c3aed'], icon: 'water' },
      { colors: ['#06b6d4', '#0891b2'], icon: 'moon' },
    ];
    if (!name) return assets[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return assets[Math.abs(hash) % assets.length];
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
          lastMessage: chat.lastMessage?.content || 'No messages yet',
          time: formatTime(lastMessageTime),
          lastActivityAt: lastMessageTime,
          unread: chat.unreadCount || 0,
          status: String(chat.status || 'pending').toLowerCase(),
          online: String(chat.status).toLowerCase() === 'accepted' && !chat.isExpired,
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

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = (user) => {
    setSelectedChatId(user.chatId);
    navigation.navigate('SMSInput', { selectedUser: user, chatId: user.chatId, chatData: user });
  };

  const renderUserItem = ({ item }) => {
    const { colors, icon } = getIdentityAssets(item.name);

    return (
      <TouchableOpacity
        style={[styles.chatRow, selectedChatId === item.chatId && styles.chatRowSelected]}
        onPress={() => handleUserClick(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          <LinearGradient colors={colors} style={styles.avatarCircle}>
            <Ionicons name={icon} size={26} color="#FFFFFF" />
          </LinearGradient>
          {item.online && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.timeText, item.unread > 0 && styles.timeActive]}>{item.time}</Text>
          </View>
          
          <View style={styles.rowFooter}>
            <Text style={styles.messageText} numberOfLines={1}>{item.lastMessage}</Text>
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
        color="#4f46e5"
      />
    </View>

    <TextInput
      style={styles.searchInput}
      placeholder="Search messages..."
      placeholderTextColor="#94a3b8"
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
          color="#64748b"
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
    backgroundColor: '#FFFFFF', 
    marginTop: -60,
    marginLeft: -15,
    marginRight: -15,
  },
  searchSection: {
  paddingHorizontal: 14,
  paddingTop: Platform.OS === 'ios' ? 65 : 65,
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
  shadowOffset: {
    width: 0,
    height: 6,
  },
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
  list: { width: '100%', paddingBottom: 100, paddingHorizontal: 15 }, 
  chatRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  chatRowSelected: { backgroundColor: '#F8FAFB' },
  avatarWrapper: { position: 'relative' },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  onlineBadge: { position: 'absolute', bottom: 1, right: 1, width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#21c063', borderWidth: 2.5, borderColor: '#FFFFFF' },
  rowContent: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  nameText: { fontSize: 17, fontWeight: '700', color: '#1A1C1E' },
  timeText: { fontSize: 12, color: '#667781', minWidth: 65, textAlign: 'right' }, 
  timeActive: { color: '#008069', fontWeight: '700' },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageText: { fontSize: 14, color: '#64748b', flex: 1, marginRight: 10 },
  unreadBadge: { backgroundColor: '#21c063', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  unreadCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  
  // Shimmer UI Styles
  shimmerContainer: { flex: 1, width: '100%', paddingHorizontal: 25 },
  skeletonRow: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  skeletonAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0F2F5' },
  skeletonContent: { flex: 1, marginLeft: 16, gap: 8 },
  skeletonTitle: { width: '40%', height: 14, borderRadius: 4, backgroundColor: '#F0F2F5' },
  skeletonText: { width: '70%', height: 10, borderRadius: 4, backgroundColor: '#F0F2F5' },
  skeletonTime: { width: 40, height: 10, borderRadius: 4, backgroundColor: '#F0F2F5' },

  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 15, color: '#8696A0' },
});

export default SMSList;