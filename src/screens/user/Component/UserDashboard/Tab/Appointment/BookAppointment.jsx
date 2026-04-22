import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'https://chatbot-backend-js25.onrender.com'; // Replace with your actual API URL

const CounselorRequestChat = () => {
  // State for counselors list
  const [counselors, setCounselors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [userAnonymous, setUserAnonymous] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedCounselorForRequest, setSelectedCounselorForRequest] = useState(null);

  // Get user ID and token from AsyncStorage
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);

  // Load user data from AsyncStorage on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedToken = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
      setUserId(storedUserId);
      setToken(storedToken);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleCounselorClick = (counselor) => {
    setSelectedCounselorForRequest(counselor);
    setShowUserModal(true);
  };

  // Function to fetch user data from API
  const fetchUserData = async () => {
    if (!userId) {
      // If no user ID, generate anonymous name
      const anonymousName = `Anonymous_${Math.floor(Math.random() * 10000)}`;
      setUserAnonymous(anonymousName);
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/api/auth/getUser/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        const user = response.data.user;
        const anonymousName = user.anonymous || user.fullName || user.name || "";
        setUserAnonymous(anonymousName);
        if (anonymousName) {
          await AsyncStorage.setItem('userAnonymousName', anonymousName);
        }
      } else {
        const anonymousName = `Anonymous_${Math.floor(Math.random() * 10000)}`;
        setUserAnonymous(anonymousName);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      const anonymousName = `Anonymous_${Math.floor(Math.random() * 10000)}`;
      setUserAnonymous(anonymousName);
    } finally {
      setIsLoading(false);
    }
  };

  // Load active chats from AsyncStorage on mount
  useEffect(() => {
    loadActiveChats();
  }, []);

  const loadActiveChats = async () => {
    try {
      const savedChats = await AsyncStorage.getItem('activeChats');
      if (savedChats) {
        setActiveChats(JSON.parse(savedChats));
      }
    } catch (error) {
      console.error('Error loading active chats:', error);
    }
  };

  // Save active chats to AsyncStorage whenever they change
  useEffect(() => {
    saveActiveChats();
  }, [activeChats]);

  const saveActiveChats = async () => {
    try {
      await AsyncStorage.setItem('activeChats', JSON.stringify(activeChats));
    } catch (error) {
      console.error('Error saving active chats:', error);
    }
  };

  // Function to get counselor profile photo URL
  const getProfilePhotoUrl = (counselor) => {
    if (counselor.profilePhoto && counselor.profilePhoto.url) {
      return counselor.profilePhoto.url;
    }
    return null;
  };

  // Function to get initials for avatar fallback
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Fetch counselors from API
  useEffect(() => {
    fetchCounselors();
  }, []);

  const fetchCounselors = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/counsellors`);
      const data = await response.json();

      if (data.success) {
        const formattedCounselors = data.counsellors.map((c, index) => ({
          id: c._id,
          name: c.fullName,
          specialization: c.specialization?.join(" , ") || "General",
          experience: `${c.experience || 0} years`,
          rating: c.rating || 4.5,
          online: c.isActive,
          available: c.isActive,
          avatar: getProfilePhotoUrl(c) || getInitials(c.fullName),
          avatarType: getProfilePhotoUrl(c) ? 'image' : 'text',
          expertise: c.specialization || [],
          responseTime: "< 10 seconds",
          profilePhoto: c.profilePhoto,
          email: c.email,
          phone: c.phoneNumber,
          location: c.location,
          languages: c.languages || [],
          aboutMe: c.aboutMe,
          qualification: c.qualification,
          education: c.education,
          certifications: c.certifications || [],
          consultationMode: c.consultationMode || [],
          totalSessions: c.totalSessions || 0,
          activeClients: c.activeClients || 0
        }));

        setCounselors(formattedCounselors);
      }
    } catch (error) {
      console.error("Error fetching counselors:", error);
    }
  };

  // Fetch user data when modal opens
  useEffect(() => {
    if (showUserModal) {
      fetchUserData();
    }
  }, [showUserModal]);

  // Show notification
  const addNotification = (type, title, message, counselorId = null, chatId = null) => {
    const newNotification = {
      id: Date.now(),
      type,
      title,
      message,
      counselorId,
      chatId,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 5000);
  };

  // Handle Chat Now click
  const handleChatNow = (counselor) => {
    if (!counselor.available) {
      addNotification(
        'error',
        'Counselor Unavailable',
        `${counselor.name} is currently not available. Please try later.`,
        counselor.id
      );
      return;
    }

    setSelectedCounselorForRequest(counselor);
    setShowUserModal(true);
  };

  // Send chat request
  const sendChatRequest = async () => {
    try {
      setIsLoading(true);

      const authToken = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
      const counselorId = selectedCounselorForRequest?.id;

      if (!counselorId) {
        Alert.alert('Error', 'Counselor not selected');
        return;
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/chat/start`,
        {
          counselorId: counselorId,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Chat Started:", res.data);
      Alert.alert('Success', 'Chat request sent successfully!');
      setShowUserModal(false);

    } catch (error) {
      console.error("❌ Error:", error);
      Alert.alert('Error', error?.response?.data?.message || "Failed to send request");
    } finally {
      setIsLoading(false);
    }
  };

  // Accept chat request
  const acceptChatRequest = (counselor) => {
    const newChat = {
      id: Date.now(),
      counselorId: counselor.id,
      counselor: counselor,
      user: {
        name: userAnonymous,
        anonymousName: userAnonymous,
        userId: userId || null,
        isAnonymous: !userId || true
      },
      messages: [
        {
          id: Date.now(),
          text: `Hello ${userAnonymous}! I'm ${counselor.name}. How can I help you today?`,
          sender: 'counselor',
          time: new Date().toLocaleTimeString()
        }
      ],
      unread: true,
      startedAt: new Date().toISOString(),
      lastMessage: `Hello ${userAnonymous}! I'm ${counselor.name}. How can I help you today?`,
      lastMessageTime: new Date().toLocaleTimeString()
    };

    setActiveChats(prev => [newChat, ...prev]);

    addNotification(
      'success',
      'Chat Request Accepted',
      `${counselor.name} has accepted your chat request. Click to start chatting.`,
      counselor.id,
      newChat.id
    );
  };

  // Remove notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCounselors();
    setRefreshing(false);
  };

  const renderNotification = ({ item: notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, styles[notification.type]]}
      onPress={() => {
        if (notification.type === 'success' && notification.chatId) {
          const chat = activeChats.find(c => c.id === notification.chatId);
          if (chat) {
            // Navigate to chat - implement navigation
          }
        }
        removeNotification(notification.id);
      }}
    >
      <View style={styles.notificationIcon}>
        <Text style={styles.notificationIconText}>
          {notification.type === 'request' && '⏳'}
          {notification.type === 'success' && '✅'}
          {notification.type === 'error' && '❌'}
          {notification.type === 'message' && '💬'}
        </Text>
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{notification.title}</Text>
        <Text style={styles.notificationMessage}>{notification.message}</Text>
        <Text style={styles.notificationTime}>{notification.timestamp}</Text>
      </View>
      <TouchableOpacity onPress={() => removeNotification(notification.id)}>
        <Text style={styles.notificationClose}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderCounselorCard = ({ item: counselor }) => (
    <View style={[styles.counselorCard, !counselor.available && styles.unavailableCard]}>
      <View style={styles.counselorCardHeader}>
        <View style={styles.counselorAvatar}>
          {counselor.avatarType === 'image' ? (
            <Image 
              source={{ uri: counselor.avatar }} 
              style={styles.counselorAvatarImage}
              onError={() => {
                // Handle image error - fallback to text
              }}
            />
          ) : (
            <Text style={styles.counselorAvatarText}>{counselor.avatar}</Text>
          )}
        </View>
        <View style={styles.counselorStatus}>
          <View style={[styles.statusDot, counselor.available ? styles.online : styles.offline]} />
          <Text style={styles.statusText}>{counselor.available ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      <Text style={styles.counselorName}>{counselor.name}</Text>
      {counselor.location && (
        <Text style={styles.counselorLocation}>📍 {counselor.location}</Text>
      )}
      <Text style={styles.counselorSpecialization}>{counselor.specialization}</Text>
      
      <Text style={styles.counselorExperience}>💼 {counselor.experience} experience</Text>
      
      <View style={styles.counselorRating}>
        <Text style={styles.stars}>
          {'★'.repeat(Math.floor(counselor.rating))}{'☆'.repeat(5 - Math.floor(counselor.rating))}
        </Text>
        <Text style={styles.ratingNumber}>{counselor.rating}</Text>
      </View>
      
      <Text style={styles.counselorResponse}>⚡ Avg response: {counselor.responseTime}</Text>
      
      <TouchableOpacity
        onPress={() => handleChatNow(counselor)}
        disabled={!counselor.available}
        style={[styles.chatNowBtn, !counselor.available && styles.disabledBtn]}
      >
        <Text style={styles.chatNowBtnText}>
          {counselor.available ? '💬 Chat Now' : '🔴 Unavailable'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderMobileCounselorRow = ({ item: counselor }) => (
    <TouchableOpacity
      style={styles.counselorRow}
      onPress={() => handleChatNow(counselor)}
    >
      <View style={styles.rowAvatar}>
        {counselor.avatarType === 'image' ? (
          <Image source={{ uri: counselor.avatar }} style={styles.rowAvatarImage} />
        ) : (
          <Text style={styles.rowAvatarText}>{counselor.avatar}</Text>
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{counselor.name}</Text>
        <Text style={styles.rowSpecialization}>{counselor.specialization}</Text>
        {counselor.experience && (
          <Text style={styles.rowExperience}>💼 {counselor.experience}</Text>
        )}
      </View>
      <View style={styles.rowAction}>
        <View style={[styles.dot, counselor.available ? styles.online : styles.offline]} />
        <TouchableOpacity
          disabled={!counselor.available}
          style={[styles.rowBtn, !counselor.available && styles.disabledRowBtn]}
          onPress={() => handleChatNow(counselor)}
        >
          <Text style={styles.rowBtnText}>Chat</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderActiveChat = ({ item: chat }) => (
    <TouchableOpacity
      style={[styles.chatTab, chat.unread && styles.unreadChatTab]}
      onPress={() => {
        // Navigate to chat - implement navigation
      }}
    >
      <View style={styles.chatTabAvatarContainer}>
        {chat.counselor.avatarType === 'image' ? (
          <Image source={{ uri: chat.counselor.avatar }} style={styles.chatTabAvatarImage} />
        ) : (
          <View style={styles.chatTabAvatarTextContainer}>
            <Text style={styles.chatTabAvatarText}>{chat.counselor.avatar}</Text>
          </View>
        )}
      </View>
      <View style={styles.chatTabInfo}>
        <Text style={styles.chatTabName}>{chat.counselor.name}</Text>
        <Text style={styles.chatTabPreview} numberOfLines={1}>
          {chat.lastMessage || chat.messages[chat.messages.length - 1].text.substring(0, 30)}...
        </Text>
      </View>
      {chat.unread && <Text style={styles.unreadBadge}>●</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Notification Panel */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id.toString()}
        style={styles.notificationPanel}
        contentContainerStyle={styles.notificationList}
      />

      <ScrollView
        style={styles.mainContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Counselors Section */}
        <View style={styles.counselorsSection}>
          <Text style={styles.pageTitle}>Online Counselors</Text>
          <Text style={styles.pageSubtitle}>Click 'Chat Now' to send a request</Text>

          {/* Desktop View - Cards Grid */}
          <FlatList
            data={counselors}
            renderItem={renderCounselorCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            style={styles.desktopView}
            scrollEnabled={false}
          />

          {/* Mobile View - Table/List Style */}
          <FlatList
            data={counselors}
            renderItem={renderMobileCounselorRow}
            keyExtractor={(item) => item.id}
            style={styles.mobileView}
            scrollEnabled={false}
          />
        </View>

        {/* Active Chats Sidebar */}
        {activeChats.length > 0 && (
          <View style={styles.activeChatsSidebar}>
            <Text style={styles.sidebarTitle}>Active Chats</Text>
            <FlatList
              data={activeChats}
              renderItem={renderActiveChat}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* User Info Modal */}
      <Modal
        visible={showUserModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Start Chat with {selectedCounselorForRequest?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalUserInfo}>
              <View style={styles.userInfoCard}>
                <View style={styles.userInfoIcon}>
                  <Text style={styles.userInfoIconText}>🔒</Text>
                </View>
                <View style={styles.userInfoDetails}>
                  <Text style={styles.userInfoLabel}>
                    You are chatting anonymously as:
                  </Text>
                  <View style={styles.userInfoName}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.anonymousName}>
                        {userAnonymous || 'Loading...'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.userInfoNote}>
                    This anonymous name will be shown to the counselor
                  </Text>
                </View>
              </View>
            </View>

            {selectedCounselorForRequest && (
              <View style={styles.counselorPreview}>
                <View style={styles.counselorPreviewHeader}>
                  <View style={styles.counselorPreviewAvatar}>
                    {selectedCounselorForRequest.avatarType === 'image' ? (
                      <Image
                        source={{ uri: selectedCounselorForRequest.avatar }}
                        style={styles.counselorPreviewImage}
                      />
                    ) : (
                      <View style={styles.counselorPreviewTextContainer}>
                        <Text style={styles.counselorPreviewText}>
                          {selectedCounselorForRequest.avatar}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.counselorPreviewInfo}>
                    <Text style={styles.counselorPreviewName}>
                      {selectedCounselorForRequest.name}
                    </Text>
                    <Text style={styles.counselorPreviewSpecialization}>
                      {selectedCounselorForRequest.specialization}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoText}>⏳ Your request will be sent to the counselor</Text>
              <Text style={styles.modalInfoText}>✅ You'll be notified when they accept</Text>
              <Text style={styles.modalInfoText}>💬 Average response time: {selectedCounselorForRequest?.responseTime}</Text>
              <Text style={styles.privacyNote}>
                🔒 You are chatting anonymously. Your real identity is protected.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={sendChatRequest}
              disabled={isLoading || !userAnonymous}
            >
              <Text style={styles.modalSubmitBtnText}>
                {isLoading ? 'Loading...' : 'Send Chat Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  // Notification Panel
  notificationPanel: {
    position: 'absolute',
    top: 10,
    right: 10,
    left: 10,
    zIndex: 1000,
    maxHeight: '50%',
  },
  notificationList: {
    gap: 10,
  },
  notificationItem: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10,
  },
  request: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 5,
    borderLeftColor: '#fbbf24',
  },
  success: {
    backgroundColor: '#f0fff4',
    borderLeftWidth: 5,
    borderLeftColor: '#48bb78',
  },
  error: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 5,
    borderLeftColor: '#f56565',
  },
  message: {
    backgroundColor: '#ebf4ff',
    borderLeftWidth: 5,
    borderLeftColor: '#667eea',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationIconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 5,
    fontSize: 14,
  },
  notificationMessage: {
    color: '#4a5568',
    fontSize: 12,
    marginBottom: 5,
  },
  notificationTime: {
    color: '#a0aec0',
    fontSize: 10,
  },
  notificationClose: {
    fontSize: 20,
    color: '#a0aec0',
    paddingHorizontal: 5,
  },
  // Main Content
  mainContent: {
    flex: 1,
    padding: 20,
  },
  counselorsSection: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 10,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 40,
  },
  // Desktop View
  desktopView: {
    display: 'flex',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  counselorCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 20,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  unavailableCard: {
    opacity: 0.8,
    backgroundColor: '#f7fafc',
  },
  counselorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  counselorAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  counselorAvatarImage: {
    width: '100%',
    height: '100%',
  },
  counselorAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#667eea',
  },
  counselorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f4f8',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  online: {
    backgroundColor: '#48bb78',
  },
  offline: {
    backgroundColor: '#a0aec0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a5568',
  },
  counselorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 5,
  },
  counselorLocation: {
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 15,
    fontSize: 14,
  },
  counselorSpecialization: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    fontWeight: '600',
    marginBottom: 15,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  counselorExperience: {
    color: '#4a5568',
    fontSize: 14,
    marginBottom: 15,
  },
  counselorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stars: {
    color: '#fbbf24',
    fontSize: 14,
  },
  ratingNumber: {
    fontWeight: '700',
    color: '#2d3748',
  },
  counselorResponse: {
    backgroundColor: '#f0f4f8',
    padding: 10,
    borderRadius: 12,
    fontSize: 12,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 20,
  },
  chatNowBtn: {
    backgroundColor: '#667eea',
    padding: 14,
    borderRadius: 15,
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: '#cbd5e0',
    opacity: 0.7,
  },
  chatNowBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  // Mobile View
  mobileView: {
    display: 'flex',
  },
  counselorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rowAvatarImage: {
    width: '100%',
    height: '100%',
  },
  rowAvatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 18,
  },
  rowInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rowName: {
    fontWeight: '600',
    fontSize: 15,
    color: '#2d3748',
    marginBottom: 4,
  },
  rowSpecialization: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  rowExperience: {
    fontSize: 11,
    color: '#48bb78',
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#667eea',
  },
  disabledRowBtn: {
    backgroundColor: '#cbd5e0',
  },
  rowBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Active Chats Sidebar
  activeChatsSidebar: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#667eea',
    alignSelf: 'flex-start',
  },
  chatTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  unreadChatTab: {
    backgroundColor: '#fef3c7',
  },
  chatTabAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  chatTabAvatarImage: {
    width: '100%',
    height: '100%',
  },
  chatTabAvatarTextContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTabAvatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 18,
  },
  chatTabInfo: {
    flex: 1,
  },
  chatTabName: {
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 5,
  },
  chatTabPreview: {
    fontSize: 12,
    color: '#718096',
  },
  unreadBadge: {
    color: '#f56565',
    fontSize: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 30,
    width: '90%',
    maxWidth: 450,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
  },
  modalClose: {
    fontSize: 28,
    color: '#a0aec0',
  },
  modalUserInfo: {
    marginBottom: 20,
  },
  userInfoCard: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfoIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfoIconText: {
    fontSize: 24,
  },
  userInfoDetails: {
    flex: 1,
  },
  userInfoLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userInfoName: {
    marginBottom: 6,
  },
  anonymousName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  userInfoNote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  counselorPreview: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  counselorPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counselorPreviewAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  counselorPreviewImage: {
    width: '100%',
    height: '100%',
  },
  counselorPreviewTextContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counselorPreviewText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
  counselorPreviewInfo: {
    flex: 1,
  },
  counselorPreviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  counselorPreviewSpecialization: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalInfo: {
    backgroundColor: '#f0f4f8',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  modalInfoText: {
    color: '#4a5568',
    fontSize: 12,
    marginBottom: 8,
  },
  privacyNote: {
    fontSize: 11,
    color: '#666',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalSubmitBtn: {
    backgroundColor: '#48bb78',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default CounselorRequestChat;