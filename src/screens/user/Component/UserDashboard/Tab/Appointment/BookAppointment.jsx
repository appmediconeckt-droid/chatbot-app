// CounselorRequestChat.js - React Native Version
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const CounselorRequestChat = ({ initialSearchQuery = '' }) => {
  const navigation = useNavigation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isSmallPhone = screenWidth < 420;
  const listBottomSpace = isSmallPhone ? 120 : 100;

  // State for counselors list
  const [counselors, setCounselors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [acceptedChatsByCounselorId, setAcceptedChatsByCounselorId] = useState({});
  const [userAnonymous, setUserAnonymous] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedCounselorForRequest, setSelectedCounselorForRequest] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDateTime, setBookingDateTime] = useState(() => {
    const nextSlot = new Date();
    const roundedMinutes = Math.ceil(nextSlot.getMinutes() / 15) * 15;
    nextSlot.setMinutes(roundedMinutes, 0, 0);
    nextSlot.setHours(nextSlot.getHours() + 1);
    return nextSlot;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');

  // Get user ID and token from AsyncStorage
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadUserData();
    fetchAcceptedChats();
  }, []);

  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery.trim()) {
      setSearchQuery(initialSearchQuery.trim());
    }
  }, [initialSearchQuery]);

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

  const getAuthToken = async () => {
    const storedToken = await AsyncStorage.getItem('token');
    const storedAccessToken = await AsyncStorage.getItem('accessToken');
    return storedToken || storedAccessToken || token;
  };

  const fetchAcceptedChats = async () => {
    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        setAcceptedChatsByCounselorId({});
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/chat/chats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const chats = Array.isArray(response?.data?.chats) ? response.data.chats : [];
      const acceptedMap = {};

      chats.forEach((chat) => {
        const status = String(chat?.status || '').toLowerCase();
        const counselorId = chat?.otherParty?.id;
        const chatId = chat?.chatId || chat?.id;

        if ((status === 'accepted' || status === 'active') && counselorId && chatId) {
          acceptedMap[String(counselorId)] = {
            chatId: String(chatId),
            status,
          };
        }
      });

      setAcceptedChatsByCounselorId(acceptedMap);
    } catch (error) {
      console.error('Error loading accepted chats:', error);
      setAcceptedChatsByCounselorId({});
    }
  };

  const openChatBox = (counselor, acceptedChat) => {
    navigation.navigate('ChatBox', {
      chatId: acceptedChat.chatId,
      counselor: {
        id: counselor.id,
        name: counselor.name,
        specialization: counselor.specialization,
        online: counselor.available,
      },
    });
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
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Fetch counselors from API
  const fetchCounselors = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${API_BASE_URL}/api/auth/counsellors`);

      if (response.data.success) {
        const formattedCounselors = response.data.counsellors.map((c) => ({
          id: c._id,
          name: c.fullName,
          specialization: c.specialization?.join(" , ") || "General",
          experience: `${c.experience || 0} years`,
          rating: c.rating || 4.5,
          online: c.isActive,
          available: c.isActive,
          avatar: getProfilePhotoUrl(c) || getInitials(c.fullName),
          avatarType: getProfilePhotoUrl(c) ? 'image' : 'text',
          responseTime: "< 10 seconds",
          profilePhoto: c.profilePhoto,
          email: c.email,
          phone: c.phoneNumber,
          location: c.location,
        }));

        setCounselors(formattedCounselors);
      }

      await fetchAcceptedChats();
    } catch (error) {
      console.error("Error fetching counselors:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCounselors();
  }, []);

  // Fetch user data when modal opens
  const fetchUserData = async () => {
    if (!userId) {
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
      Alert.alert(
        'Counselor Unavailable',
        `${counselor.name} is currently not available. Please try later.`
      );
      return;
    }

    const existingAcceptedChat = acceptedChatsByCounselorId[String(counselor.id)];
    if (existingAcceptedChat?.chatId) {
      openChatBox(counselor, existingAcceptedChat);
      return;
    }

    setSelectedCounselorForRequest(counselor);
    setShowUserModal(true);
    fetchUserData();
  };

  const handleBookAppointment = (counselor) => {
    setSelectedCounselorForRequest(counselor);
    const nextSlot = new Date();
    const roundedMinutes = Math.ceil(nextSlot.getMinutes() / 15) * 15;
    nextSlot.setMinutes(roundedMinutes, 0, 0);
    nextSlot.setHours(nextSlot.getHours() + 1);
    setBookingDateTime(nextSlot);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowBookingModal(true);
  };

  const bookingDateLabel = bookingDateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const bookingTimeLabel = bookingDateTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }

    setBookingDateTime((prev) => {
      const next = new Date(prev);
      next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      return next;
    });
  };

  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (event?.type === 'dismissed' || !selectedTime) {
      return;
    }

    setBookingDateTime((prev) => {
      const next = new Date(prev);
      next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      return next;
    });
  };

  // Send chat request
  const sendChatRequest = async () => {
    try {
      setIsLoading(true);

      const counselorId = selectedCounselorForRequest?.id;
      const existingAcceptedChat = acceptedChatsByCounselorId[String(counselorId)];

      if (!counselorId) {
        Alert.alert("Error", "Counselor not selected");
        return;
      }

      if (existingAcceptedChat?.chatId) {
        setShowUserModal(false);
        openChatBox(selectedCounselorForRequest, existingAcceptedChat);
        return;
      }

      const authToken = await getAuthToken();

      const response = await axios.post(
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

      const chatId = response?.data?.chat?.chatId || response?.data?.chatId || null;
      const chatStatus = String(response?.data?.chat?.status || '').toLowerCase();

      if ((chatStatus === 'accepted' || chatStatus === 'active') && chatId) {
        const acceptedChat = { chatId: String(chatId), status: chatStatus };
        setAcceptedChatsByCounselorId((prev) => ({
          ...prev,
          [String(counselorId)]: acceptedChat,
        }));
        setShowUserModal(false);
        openChatBox(selectedCounselorForRequest, acceptedChat);
        return;
      }

      if (response.data.success) {
        Alert.alert("Request Sent", "Session request sent. You can open chat once counselor accepts.");
        setShowUserModal(false);
      }
    } catch (error) {
      console.error("Error:", error);

      const statusCode = error?.response?.status;
      const apiErrorMessage = error?.response?.data?.error || error?.response?.data?.message || 'Failed to send request';
      const existingChatId = error?.response?.data?.chatId || null;
      const lowerMessage = String(apiErrorMessage).toLowerCase();

      if (
        statusCode === 400 &&
        existingChatId &&
        (lowerMessage.includes('already active') || lowerMessage.includes('continue your conversation'))
      ) {
        const acceptedChat = { chatId: String(existingChatId), status: 'accepted' };
        setAcceptedChatsByCounselorId((prev) => ({
          ...prev,
          [String(counselorId)]: acceptedChat,
        }));
        setShowUserModal(false);
        if (selectedCounselorForRequest) {
          openChatBox(selectedCounselorForRequest, acceptedChat);
          return;
        }
      }

      Alert.alert("Error", apiErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!bookingDateTime || Number.isNaN(bookingDateTime.getTime())) {
      Alert.alert('Invalid Date', 'Please choose a valid appointment date and time.');
      return;
    }

    if (bookingDateTime.getTime() <= Date.now()) {
      Alert.alert('Invalid Time', 'Please choose a future date and time for the appointment.');
      return;
    }

    if (!bookingNotes.trim()) {
      Alert.alert('Clinical Notes Required', 'Please add your reason for booking this appointment.');
      return;
    }

    try {
      setIsLoading(true);

      const authToken = await getAuthToken();

      await axios.post(
        `${API_BASE_URL}/api/appointments`,
        {
          counselorId: selectedCounselorForRequest?.id,
          date: bookingDateTime.toISOString(),
          notes: bookingNotes.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      addNotification(
        'success',
        'Appointment Booked',
        `Your appointment request was sent to ${selectedCounselorForRequest?.name || 'the counselor'}.`,
      );

      Alert.alert('Booked Successfully', 'Appointment request sent. The counselor has been notified.');
      setShowBookingModal(false);
      setBookingNotes('');
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('Booking Failed', error?.response?.data?.message || 'Failed to book appointment.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStarRating = (rating) => {
    const normalized = Math.max(0, Math.min(5, Number(rating) || 0));
    const fullStars = Math.floor(normalized);
    const hasHalfStar = normalized - fullStars >= 0.5;

    return (
      <View style={styles.starRow}>
        {[0, 1, 2, 3, 4].map((idx) => {
          if (idx < fullStars) {
            return <Ionicons key={`star-${idx}`} name="star" size={12} color="#f59e0b" />;
          }
          if (idx === fullStars && hasHalfStar) {
            return <Ionicons key={`star-${idx}`} name="star-half" size={12} color="#f59e0b" />;
          }
          return <Ionicons key={`star-${idx}`} name="star-outline" size={12} color="#cbd5e1" />;
        })}
      </View>
    );
  };

  const renderCounselorRow = ({ item }) => (
    <TouchableOpacity
      style={[styles.counselorRowTable, !item.available && styles.unavailableCard]}
      onPress={() => handleChatNow(item)}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeftWrap}>
        <View style={styles.rowAvatarWrap}>
          {item.avatarType === 'image' ? (
            <Image source={{ uri: item.avatar }} style={styles.rowAvatar} />
          ) : (
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.rowAvatarPlaceholder}>
              <Text style={styles.rowAvatarText}>{item.avatar}</Text>
            </LinearGradient>
          )}
          <View style={[styles.statusDot, item.available ? styles.online : styles.offline]} />
        </View>
        <View style={styles.rowInfoWrap}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            {acceptedChatsByCounselorId[String(item.id)]?.chatId ? (
              <View style={styles.acceptedBadgeInline}>
                <Text style={styles.acceptedBadgeText}>Accepted</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {item.specialization}{item.location ? ` • ${item.location}` : ''}
          </Text>
          <View style={styles.rowBottomLine}>
            <Text style={styles.rowExperience}>{item.experience}</Text>
            {renderStarRating(item.rating)}
          </View>
        </View>
      </View>

      <View style={styles.rowActionWrap}>
        <TouchableOpacity
          style={[styles.chatButton, !item.available && styles.chatButtonDisabled]}
          onPress={() => handleChatNow(item)}
          disabled={!item.available}
        >
          <LinearGradient
            colors={
              !item.available
                ? ['#ccc', '#ccc']
                : acceptedChatsByCounselorId[String(item.id)]?.chatId
                  ? ['#16a34a', '#15803d']
                  : ['#667eea', '#764ba2']
            }
            style={styles.chatButtonGradient}
          >
            <Text style={styles.chatButtonText}>
              {!item.available
                ? 'Unavailable'
                : acceptedChatsByCounselorId[String(item.id)]?.chatId
                  ? 'Chat Now'
                  : 'Send Request'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => handleBookAppointment(item)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#0f766e', '#0d9488']} style={styles.bookButtonGradient}>
            <Text style={styles.bookButtonText}>Schedule</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, styles[item.type]]}
      onPress={() => {
        if (item.chatId && selectedCounselorForRequest) {
          navigation.navigate('ChatBox', {
            chatId: item.chatId,
            counselor: {
              id: selectedCounselorForRequest.id,
              name: selectedCounselorForRequest.name,
              specialization: selectedCounselorForRequest.specialization,
              online: selectedCounselorForRequest.available,
            },
          });
        }
      }}
    >
      <Text style={styles.notificationIcon}>
        {item.type === 'success' && '✅'}
        {item.type === 'error' && '❌'}
        {item.type === 'message' && '💬'}
      </Text>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{item.timestamp}</Text>
      </View>
    </TouchableOpacity>
  );

  const filteredCounselors = counselors.filter((counselor) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      String(counselor.name || '').toLowerCase().includes(q) ||
      String(counselor.specialization || '').toLowerCase().includes(q) ||
      String(counselor.location || '').toLowerCase().includes(q)
    );
  });

  const sortedCounselors = [...filteredCounselors].sort((a, b) => {
    if (sortBy === 'rating') {
      return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    }

    if (sortBy === 'experience') {
      const expA = Number.parseInt(String(a.experience || '0'), 10) || 0;
      const expB = Number.parseInt(String(b.experience || '0'), 10) || 0;
      return expB - expA;
    }

    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const renderListHeader = () => (
    <>
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Counselor Directory</Text>
        <Text style={styles.headerSubtitle}>Trusted experts for confidential mental wellness support</Text>
      </View> */}

      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search counselor by name, specialization, or location"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
        <TouchableOpacity
          style={styles.searchActionButton}
          onPress={() => {
            if (searchQuery.length > 0) setSearchQuery('');
          }}
          activeOpacity={searchQuery.length > 0 ? 0.7 : 1}
        >
          <Ionicons
            name={searchQuery.length > 0 ? 'close' : 'search'}
            size={18}
            color={searchQuery.length > 0 ? '#4b5563' : '#6b7280'}
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'name' && styles.sortChipActive]}
          onPress={() => setSortBy('name')}
        >
          <View style={styles.sortChipContent}>
            <Ionicons name="text" size={12} color={sortBy === 'name' ? '#4338ca' : '#475569'} />
            <Text style={[styles.sortChipText, sortBy === 'name' && styles.sortChipTextActive]}>Name</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'rating' && styles.sortChipActive]}
          onPress={() => setSortBy('rating')}
        >
          <View style={styles.sortChipContent}>
            <Ionicons name="star" size={12} color={sortBy === 'rating' ? '#4338ca' : '#475569'} />
            <Text style={[styles.sortChipText, sortBy === 'rating' && styles.sortChipTextActive]}>Rating</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'experience' && styles.sortChipActive]}
          onPress={() => setSortBy('experience')}
        >
          <View style={styles.sortChipContent}>
            <Ionicons name="briefcase" size={12} color={sortBy === 'experience' ? '#4338ca' : '#475569'} />
            <Text style={[styles.sortChipText, sortBy === 'experience' && styles.sortChipTextActive]}>Experience</Text>
          </View>
        </TouchableOpacity>
      </View>

      {notifications.length > 0 ? (
        <View style={styles.notificationsPanel}>
          <FlatList
            data={notifications.slice(0, 3)}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Counselors List */}
      <FlatList
        key="table-list"
        data={sortedCounselors}
        renderItem={renderCounselorRow}
        keyExtractor={(item) => item.id}
        numColumns={1}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={[styles.listContainer, { paddingBottom: listBottomSpace }]}
        ListFooterComponent={<View style={{ height: listBottomSpace }} />}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={fetchCounselors}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.emptyText}>
              {searchQuery.trim() ? 'No counselors match your search.' : 'Loading counselors...'}
            </Text>
          </View>
        }
      />

      {/* User Info Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: Math.min(screenWidth * 0.92, 520), maxHeight: screenHeight * 0.82 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Start Chat with {selectedCounselorForRequest?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* User Info Card */}
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.userInfoCard}
              >
                <Text style={styles.userInfoIcon}>🔒</Text>
                <View style={styles.userInfoDetails}>
                  <Text style={styles.userInfoLabel}>You are chatting anonymously as:</Text>
                  <Text style={styles.userInfoName}>
                    {isLoading ? 'Loading...' : userAnonymous || 'Loading...'}
                  </Text>
                  <Text style={styles.userInfoNote}>
                    This anonymous name will be shown to the counselor
                  </Text>
                </View>
              </LinearGradient>

              {/* Counselor Preview */}
              {selectedCounselorForRequest && (
                <View style={styles.counselorPreview}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewAvatar}>
                      {selectedCounselorForRequest.avatarType === 'image' ? (
                        <Image
                          source={{ uri: selectedCounselorForRequest.avatar }}
                          style={styles.previewAvatarImage}
                        />
                      ) : (
                        <LinearGradient
                          colors={['#667eea', '#764ba2']}
                          style={styles.previewAvatarPlaceholder}
                        >
                          <Text style={styles.previewAvatarText}>
                            {selectedCounselorForRequest.avatar}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>{selectedCounselorForRequest.name}</Text>
                      <Text style={styles.previewSpecialization}>
                        {selectedCounselorForRequest.specialization}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.modalInfo}>
                {selectedCounselorForRequest && acceptedChatsByCounselorId[String(selectedCounselorForRequest.id)]?.chatId ? (
                  <>
                    <Text style={styles.modalInfoText}>You already have an accepted chat with this counselor.</Text>
                    <Text style={styles.modalInfoText}>Tap Chat Now to continue your conversation.</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalInfoText}>Your session request will be sent to the counselor.</Text>
                    <Text style={styles.modalInfoText}>You can chat once counselor accepts your request.</Text>
                  </>
                )}
                <Text style={styles.modalInfoText}>
                  Average response time: {selectedCounselorForRequest?.responseTime}
                </Text>
                <Text style={styles.privacyNote}>
                  You are chatting anonymously. Your real identity is protected.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={sendChatRequest}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={
                    selectedCounselorForRequest && acceptedChatsByCounselorId[String(selectedCounselorForRequest.id)]?.chatId
                      ? ['#16a34a', '#15803d']
                      : ['#667eea', '#764ba2']
                  }
                  style={styles.submitButtonGradient}
                >
                  <Text style={styles.submitButtonText}>
                    {isLoading
                      ? 'Loading...'
                      : selectedCounselorForRequest && acceptedChatsByCounselorId[String(selectedCounselorForRequest.id)]?.chatId
                        ? 'Chat Now'
                        : 'Send Request'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: Math.min(screenWidth * 0.92, 520), maxHeight: screenHeight * 0.82 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Book Appointment with {selectedCounselorForRequest?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalInfo}>
                <Text style={styles.modalSectionTitle}>Appointment Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={styles.dateTimeCard}
                    onPress={() => {
                      setShowDatePicker((prev) => !prev);
                      if (Platform.OS === 'ios') {
                        setShowTimePicker(false);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.dateTimeCardHeader}>
                      <Ionicons name="calendar-outline" size={16} color="#334155" />
                      <Text style={styles.dateTimeCardLabel}>Date</Text>
                    </View>
                    <Text style={styles.dateTimeCardValue}>{bookingDateLabel}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dateTimeCard}
                    onPress={() => {
                      setShowTimePicker((prev) => !prev);
                      if (Platform.OS === 'ios') {
                        setShowDatePicker(false);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.dateTimeCardHeader}>
                      <Ionicons name="time-outline" size={16} color="#334155" />
                      <Text style={styles.dateTimeCardLabel}>Time</Text>
                    </View>
                    <Text style={styles.dateTimeCardValue}>{bookingTimeLabel}</Text>
                  </TouchableOpacity>
                </View>

                {(showDatePicker || showTimePicker) && Platform.OS === 'ios' ? (
                  <View style={styles.pickerWrap}>
                    {showDatePicker ? (
                      <DateTimePicker
                        value={bookingDateTime}
                        mode="date"
                        display="inline"
                        minimumDate={new Date()}
                        onChange={handleDateChange}
                      />
                    ) : null}

                    {showTimePicker ? (
                      <DateTimePicker
                        value={bookingDateTime}
                        mode="time"
                        display="spinner"
                        onChange={handleTimeChange}
                      />
                    ) : null}
                  </View>
                ) : null}

                {showDatePicker && Platform.OS === 'android' ? (
                  <DateTimePicker
                    value={bookingDateTime}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                  />
                ) : null}

                {showTimePicker && Platform.OS === 'android' ? (
                  <DateTimePicker
                    value={bookingDateTime}
                    mode="time"
                    display="default"
                    onChange={handleTimeChange}
                  />
                ) : null}

                <Text style={[styles.modalSectionTitle, { marginTop: 14 }]}>Clinical Notes / Reason</Text>
                <TextInput
                  style={styles.modalTextArea}
                  multiline
                  numberOfLines={4}
                  value={bookingNotes}
                  onChangeText={setBookingNotes}
                  placeholder="Share what you want to discuss in this session..."
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.privacyNote}>
                  Appointment request will be sent instantly to the counselor for confirmation.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.chatButton, { flex: 1 }]}
                  onPress={() => setShowBookingModal(false)}
                  disabled={isLoading}
                >
                  <LinearGradient colors={['#64748b', '#475569']} style={styles.chatButtonGradient}>
                    <Text style={styles.chatButtonText}>Cancel</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bookButton, { flex: 1 }]}
                  onPress={handleConfirmBooking}
                  disabled={isLoading}
                >
                  <LinearGradient colors={['#0f766e', '#0d9488']} style={styles.bookButtonGradient}>
                    <Text style={styles.bookButtonText}>{isLoading ? 'Booking...' : 'Confirm'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f3',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e3a8a',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  statusInfoBox: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730a3',
    marginBottom: 4,
  },
  statusInfoText: {
    fontSize: 12,
    color: '#4338ca',
    marginBottom: 2,
  },
  searchContainer: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#d9e0ea',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: '#111827',
    fontSize: 14,
  },
  searchActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHelpText: {
    marginHorizontal: 14,
    marginTop: -4,
    marginBottom: 8,
    fontSize: 11,
    color: '#6b7280',
  },
  sortRow: {
    marginHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginRight: 2,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortChipActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  sortChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#4338ca',
  },
  listContainer: {
    paddingHorizontal: 10,
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
  },
  counselorRowTable: {
    width: '100%',
    minHeight: 96,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  rowAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  rowAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  rowAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  rowInfoWrap: {
    flex: 1,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginRight: 6,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#636b75',
  },
  rowBottomLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowExperience: {
    fontSize: 11,
    color: '#4b5563',
  },
  rowActionWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    minWidth: 124,
  },
  statusContainerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  acceptedBadgeInline: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  counselorCard: {
    width: (width - 48) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  counselorCardSingle: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  acceptedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 5,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  acceptedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  unavailableCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  online: {
    backgroundColor: '#10b981',
  },
  offline: {
    backgroundColor: '#ef4444',
  },
  statusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  onlineText: {
    color: '#10b981',
  },
  offlineText: {
    color: '#ef4444',
  },
  counselorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  specialization: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
    marginBottom: 4,
  },
  experience: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 12,
    color: '#ddd',
  },
  starFilled: {
    color: '#FFD700',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  responseTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  chatButton: {
    minWidth: 96,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chatButtonDisabled: {
    opacity: 0.7,
  },
  chatButtonGradient: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookButton: {
    minWidth: 96,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  notificationsPanel: {
    marginHorizontal: 4,
    marginBottom: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: 280,
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  notificationMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
  },
  userInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  userInfoIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  userInfoDetails: {
    flex: 1,
  },
  userInfoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  userInfoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  userInfoNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  counselorPreview: {
    margin: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewAvatar: {
    marginRight: 12,
  },
  previewAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  previewAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  previewSpecialization: {
    fontSize: 12,
    color: '#667eea',
  },
  modalInfo: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  dateTimeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dateTimeCardLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  dateTimeCardValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  pickerWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#dbe4ee',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#dbe4ee',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  privacyNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
    margin: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  submitButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
};

export default CounselorRequestChat;