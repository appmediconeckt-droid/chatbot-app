// CounselorRequestChat.js - React Native Version
import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PATIENT from '../../../../../../theme/palette';
import PatientGradientButton from '../../../../../../components/common/PatientGradientButton';

const { width, height } = Dimensions.get('window');

const CounselorListSkeleton = () => {
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
    <View style={counselorSkel.wrap}>
      <View style={counselorSkel.searchBox}>
        <Animated.View style={[counselorSkel.searchInner, { opacity }]} />
      </View>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={counselorSkel.card}>
          <Animated.View style={[counselorSkel.avatar, { opacity }]} />
          <View style={counselorSkel.body}>
            <Animated.View style={[counselorSkel.lineLg, { opacity }]} />
            <Animated.View style={[counselorSkel.lineMd, { opacity }]} />
            <View style={counselorSkel.metaRow}>
              <Animated.View style={[counselorSkel.metaChip, { opacity }]} />
              <Animated.View style={[counselorSkel.metaChip, { opacity }]} />
            </View>
          </View>
          <Animated.View style={[counselorSkel.button, { opacity }]} />
        </View>
      ))}
    </View>
  );
};

const counselorSkel = {
  wrap: { flex: 1, width: '100%', paddingHorizontal: 16, paddingTop: 12 },
  searchBox: { width: '100%', marginBottom: 14 },
  searchInner: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    alignItems: 'center',
  },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#e2e8f0' },
  body: { flex: 1, minWidth: 0, gap: 7 },
  lineLg: { width: '70%', height: 13, borderRadius: 4, backgroundColor: '#e2e8f0' },
  lineMd: { width: '50%', height: 11, borderRadius: 4, backgroundColor: '#edf1f5' },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  metaChip: { width: 50, height: 16, borderRadius: 999, backgroundColor: '#edf1f5' },
  button: { width: 60, height: 30, borderRadius: 15, backgroundColor: '#e2e8f0' },
};
const resolveOnlineStatus = (person) => {
  const explicitOnline = person?.isOnline ?? person?.online;
  if (typeof explicitOnline === 'boolean') return explicitOnline;
  if (typeof explicitOnline === 'string') return ['online','true','1','yes'].includes(String(explicitOnline).toLowerCase());
  return false;
};

const CounselorRequestChat = ({ initialSearchQuery = '' }) => {
  const navigation = useNavigation();
  const { t } = useLanguageRender();
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
  const [activeFilter, setActiveFilter] = useState('all');
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
  const [paymentConfig, setPaymentConfig] = useState({
    enabled: false,
    fees: { chat: 100, voice: 200, video: 300 },
    durationMinutes: 30,
    requestExpiryHours: 24,
  });
  const [walletBalance, setWalletBalance] = useState(null);

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

  useEffect(() => {
    fetchPaymentConfig();
  }, [token]);

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

  const fetchPaymentConfig = async () => {
    try {
      const authToken = await getAuthToken();
      if (!authToken) return;

      const headers = { Authorization: `Bearer ${authToken}` };
      const [configRes, walletRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/chat/payment-config`, { headers }),
        axios.get(`${API_BASE_URL}/api/wallet/data`, { headers }),
      ]);

      setPaymentConfig((prev) => ({ ...prev, ...(configRes?.data || {}) }));
      setWalletBalance(Number(walletRes?.data?.balance || 0));
    } catch (error) {
      console.warn('Payment config unavailable:', error?.response?.data || error?.message);
    }
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

        // Track pending requests too. The status is what the card branches on:
        // pending keeps the request state, accepted/active unlocks scheduling.
        if ((status === 'pending' || status === 'accepted' || status === 'active') && counselorId && chatId) {
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
        online: counselor.online ?? counselor.available,
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
      const authToken = await getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/api/chat/counselors`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });

      const list = response.data?.counselors || response.data?.counsellors || [];
      const formattedCounselors = list.map((c) => ({
        id: c._id,
        name: c.fullName,
        specialization: Array.isArray(c.specialization) ? c.specialization.join(' , ') : (c.specialization || 'General'),
        experience: `${c.experience || 0} years`,
        rating: c.rating || 4.5,
        online: resolveOnlineStatus(c),
        available: resolveOnlineStatus(c),
        avatar: getProfilePhotoUrl(c) || getInitials(c.fullName),
        avatarType: getProfilePhotoUrl(c) ? 'image' : 'text',
        responseTime: '< 10 seconds',
        profilePhoto: c.profilePhoto,
        email: c.email,
        phone: c.phoneNumber,
        location: c.location,
      }));

      setCounselors(formattedCounselors);
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
    // If a chat/request already exists (pending or accepted), open the thread
    // directly — regardless of the counselor's online status.
    const existingChat = acceptedChatsByCounselorId[String(counselor.id)];
    if (existingChat?.chatId) {
      openChatBox(counselor, existingChat);
      return;
    }

    // No existing request yet — sending a NEW one needs the counselor available.
    if (!counselor.online && !counselor.available) {
      Alert.alert(
        t('appointment:counselorUnavailable'),
        `${counselor.name} ${t('appointment:notAvailableNow')}`
      );
      return;
    }

    setSelectedCounselorForRequest(counselor);
    setShowUserModal(true);
    fetchUserData();
  };

  const handleBookAppointment = (counselor) => {
    // Scheduling is only available once the counselor has accepted the request.
    // The card already hides the button, but guard here too so no other entry
    // point can open the booking modal for an unconnected counselor.
    const existingChat = acceptedChatsByCounselorId[String(counselor?.id)];
    const status = String(existingChat?.status || '').toLowerCase();
    if (status !== 'accepted' && status !== 'active') {
      Alert.alert(
        t('appointment:requestRequired', 'Request required'),
        status === 'pending'
          ? t(
              'appointment:requestPendingMessage',
              'Your request is waiting for the counselor to accept. You can schedule an appointment once it is accepted.'
            )
          : t(
              'appointment:requestFirstMessage',
              'Send a request to this counselor first. You can schedule an appointment once they accept.'
            )
      );
      return;
    }

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
    hour12: false,
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
    // Declared at function scope (not inside try) so the catch block below can
    // also read it — otherwise referencing it on error throws
    // "ReferenceError: Property 'counselorId' doesn't exist".
    const counselorId = selectedCounselorForRequest?.id;
    try {
      setIsLoading(true);

      const existingAcceptedChat = acceptedChatsByCounselorId[String(counselorId)];

      if (!counselorId) {
        Alert.alert(t('appointment:counselorNotSelected'), t('appointment:counselorNotSelectedMessage'));
        return;
      }

      if (existingAcceptedChat?.chatId) {
        setShowUserModal(false);
        openChatBox(selectedCounselorForRequest, existingAcceptedChat);
        return;
      }

      const authToken = await getAuthToken();

      if (paymentConfig.enabled) {
        const amount = Number(paymentConfig.fees?.chat || 100);
        const currentBalance = Number(walletBalance || 0);

        if (currentBalance < amount) {
          Alert.alert(
            'Insufficient wallet balance',
            `Please add ₹${amount - currentBalance} to continue.`
          );
          return;
        }
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/chat/start`,
        {
          counselorId: counselorId,
          sessionType: 'chat',
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
      if (typeof response?.data?.chat?.walletBalance === 'number') {
        setWalletBalance(response.data.chat.walletBalance);
      }

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
        // Reflect the new pending request right away so the card shows "Chat Now".
        const newChatId = response?.data?.chat?.chatId || response?.data?.chat?.id;
        if (newChatId) {
          setAcceptedChatsByCounselorId((prev) => ({
            ...prev,
            [String(counselorId)]: { chatId: String(newChatId), status: 'pending' },
          }));
        }
        Alert.alert(t('appointment:sessionRequestSent'), t('appointment:sessionRequestMessage'));
        setShowUserModal(false);
      }
    } catch (error) {
      console.error("Error:", error);

      const statusCode = error?.response?.status;
      const apiErrorMessage = error?.response?.data?.error || error?.response?.data?.message || 'Failed to send request';
      const existingChatId = error?.response?.data?.chatId || null;
      // The backend returns 400 with a `status` when a chat/request already
      // exists. Branch on that status instead of error-message text:
      //   accepted/active → open the existing chat
      //   pending         → request already sent, just wait (not an error)
      const apiStatus = String(error?.response?.data?.status || '').toLowerCase();

      if (statusCode === 400 && existingChatId && (apiStatus === 'accepted' || apiStatus === 'active')) {
        const acceptedChat = { chatId: String(existingChatId), status: apiStatus };
        setAcceptedChatsByCounselorId((prev) => ({
          ...prev,
          [String(counselorId)]: acceptedChat,
        }));
        setShowUserModal(false);
        if (selectedCounselorForRequest) {
          openChatBox(selectedCounselorForRequest, acceptedChat);
        }
        return;
      }

      if (statusCode === 400 && apiStatus === 'pending') {
        setShowUserModal(false);
        Alert.alert(
          t('appointment:sessionRequestSent'),
          'Your request was already sent. Please wait for the counselor to accept.'
        );
        return;
      }

      Alert.alert(t('common:error'), apiErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!bookingDateTime || Number.isNaN(bookingDateTime.getTime())) {
      Alert.alert(t('appointment:invalidDate'), t('appointment:pleaseChooseValidDateTime'));
      return;
    }

    if (bookingDateTime.getTime() <= Date.now()) {
      Alert.alert(t('appointment:invalidTime'), t('appointment:pleaseChooseFutureDateTime'));
      return;
    }

    if (!bookingNotes.trim()) {
      Alert.alert(t('appointment:clinicalNotesRequired'), t('appointment:pleaseAddReasonForBooking'));
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

      Alert.alert(t('appointment:bookedSuccessfully'), t('appointment:appointmentRequestSent'));
      setShowBookingModal(false);
      setBookingNotes('');
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert(t('appointment:bookingFailed'), error?.response?.data?.message || t('appointment:failedToBook'));
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

  const renderCounselorCard = (item) => {
    // A request must be ACCEPTED before scheduling opens up. A merely pending
    // request still counts as "no connection yet", so the card keeps showing
    // the request state instead of the booking/chat actions.
    const existingChat = acceptedChatsByCounselorId[String(item.id)];
    const chatStatus = String(existingChat?.status || '').toLowerCase();
    const isAccepted = !!existingChat?.chatId && (chatStatus === 'accepted' || chatStatus === 'active');
    const isPending = !!existingChat?.chatId && chatStatus === 'pending';
    const online = !!item.available;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardAvatarWrap}>
            {item.avatarType === 'image' ? (
              <Image source={{ uri: item.avatar }} style={styles.cardAvatar} />
            ) : (
              <LinearGradient
                colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                style={styles.cardAvatarPlaceholder}
              >
                <Text style={styles.cardAvatarText}>{item.avatar}</Text>
              </LinearGradient>
            )}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Ionicons name="checkmark-circle" size={15} color={PATIENT.primary} />
            </View>
            <Text style={styles.cardSpec} numberOfLines={1}>{item.specialization}</Text>
            <View style={styles.cardMetaRow}>
              <Ionicons name="briefcase-outline" size={12.5} color={PATIENT.textSecondary} />
              <Text style={styles.cardMetaText}>{item.experience}</Text>
              <Ionicons name="star" size={12.5} color="#F5A623" style={{ marginLeft: 12 }} />
              <Text style={styles.cardMetaText}>{(Number(item.rating) || 0).toFixed(1)}</Text>
            </View>
          </View>

          <View style={[styles.statusPill, online ? styles.statusPillOn : styles.statusPillOff]}>
            <View style={[styles.statusPillDot, { backgroundColor: online ? PATIENT.online : '#9CA3AF' }]} />
            <Text style={[styles.statusPillText, { color: online ? PATIENT.primary : '#6B7280' }]}>
              {online ? t('counselor:available', 'AVAILABLE') : t('common:offline', 'OFFLINE')}
            </Text>
          </View>
        </View>

        {isPending ? (
          // Request sent, counselor hasn't accepted yet — nothing to do but wait.
          <View style={styles.btnPendingRow}>
            <Ionicons name="time-outline" size={15} color="#B45309" />
            <Text style={styles.btnPendingText} numberOfLines={1}>
              {t('appointment:requestPending', 'Request pending — waiting for counselor to accept')}
            </Text>
          </View>
        ) : !online ? (
          // Offline is checked before `isAccepted` so "Chat Now" can never
          // render for a counselor who isn't there to answer. An accepted
          // counselor can still be booked for a later slot; an unconnected one
          // can't even be sent a request.
          <View style={styles.cardOfflineRow}>
            <Text style={styles.nextAvailText} numberOfLines={1}>
              {item.nextAvailable
                ? `${t('appointment:nextAvailable', 'Next Available')} ${item.nextAvailable}`
                : t('appointment:currentlyUnavailable', 'Currently unavailable')}
            </Text>
            {isAccepted ? (
              <TouchableOpacity
                style={styles.btnOutlineSm}
                onPress={() => handleBookAppointment(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnOutlineText}>{t('appointment:schedule')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.btnDisabledSm}>
                <Text style={styles.btnDisabledSmText}>
                  {t('appointment:sendRequest', 'Send Request')}
                </Text>
              </View>
            )}
          </View>
        ) : isAccepted ? (
          // Connected and online: scheduling and chat are both unlocked.
          <View style={styles.cardActions}>
            <PatientGradientButton
              style={styles.btnPrimary}
              onPress={() => handleBookAppointment(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {t('appointment:scheduleAppointment', 'Schedule Appointment')}
              </Text>
            </PatientGradientButton>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => handleChatNow(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnOutlineText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {t('appointment:chatNow')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // First time with this counselor: request only, no scheduling yet.
          <PatientGradientButton
            style={styles.btnPrimaryFull}
            onPress={() => handleChatNow(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {t('appointment:sendRequest', 'Send Request')}
            </Text>
          </PatientGradientButton>
        )}
      </View>
    );
  };

  const renderCounselorRow = ({ item }) => renderCounselorCard(item);

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

  // Chips: All / Online / Nearby / Top Rated + specializations from the data.
  // A counselor's `specialization` is a combined string ("Anxiety , Depression")
  // so we split on any separator ( , | / ) and add each specialty as its own
  // chip — otherwise the whole combined string shows up as a single chip.
  const filterChips = (() => {
    const specs = [];
    counselors.forEach((c) => {
      String(c.specialization || '')
        .split(/[,|/]/)
        .forEach((part) => {
          const s = part.trim();
          if (s && s.toLowerCase() !== 'general' && !specs.includes(s)) specs.push(s);
        });
    });
    return [
      { id: 'all', label: t('common:all', 'All') },
      { id: 'online', label: t('common:online', 'Online') },
      { id: 'nearby', label: t('appointment:nearby', 'Nearby') },
      { id: 'topRated', label: t('appointment:topRated', 'Top Rated') },
      ...specs.map((s) => ({ id: s, label: s })),
    ];
  })();

  const chipFiltered = filteredCounselors.filter((c) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'online') return !!c.available;
    if (activeFilter === 'nearby') return !!c.location;
    if (activeFilter === 'topRated') return (Number(c.rating) || 0) >= 4.5;
    return String(c.specialization || '').toLowerCase().includes(String(activeFilter).toLowerCase());
  });

  const sortedCounselors = [...chipFiltered].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return (Number(b.rating) || 0) - (Number(a.rating) || 0);
  });

  // Top pick shown in "Recommended for you"; the rest fill the list below.
  const recommended = sortedCounselors[0] || null;
  const restCounselors = recommended ? sortedCounselors.slice(1) : sortedCounselors;

  const renderListHeader = () => (
    <>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={PATIENT.textMuted} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('messages:searchCounselors', 'Search counselors...')}
          placeholderTextColor={PATIENT.textMuted}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
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
          const isActive = activeFilter === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setActiveFilter(chip.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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

      {recommended ? (
        <>
          <Text style={styles.sectionTitle}>
            {t('appointment:recommendedForYou', 'Recommended for you')}
          </Text>
          {renderCounselorCard(recommended)}
        </>
      ) : null}

      {restCounselors.length > 0 ? (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitleInline}>
            {t('appointment:availableCounselors', 'Available Counselors')}
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setActiveFilter('all')}>
            <Text style={styles.seeAll}>{t('appointment:seeAll', 'See All')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  const showInitialSkeleton = refreshing && counselors.length === 0;

  if (showInitialSkeleton) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />
        <CounselorListSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />

      {/* Counselors List */}
      <FlatList
        key="table-list"
        data={restCounselors}
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
            <ActivityIndicator size="large" color="#00652C" />
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
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowUserModal(false)}
          />
          <View style={[styles.reqSheet, { maxHeight: screenHeight * 0.88 }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.reqHeader}>
              <Text style={styles.reqTitle} numberOfLines={1}>
                {t('appointment:startChatWith', 'Start Chat with')} {selectedCounselorForRequest?.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowUserModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Anonymous card — green gradient */}
              <LinearGradient
                colors={['#006B2C', '#01CE54']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.anonCard}
              >
                <Ionicons
                  name="lock-closed"
                  size={92}
                  color="rgba(255,255,255,0.10)"
                  style={styles.anonWatermark}
                />
                <View style={styles.anonTopRow}>
                  <Ionicons name="lock-closed" size={17} color="#ffffff" />
                  <Text style={styles.anonTitle}>
                    {t('appointment:chatting', "You're chatting anonymously")}
                  </Text>
                </View>

                <View style={styles.anonPill}>
                  <Ionicons name="person" size={14} color={PATIENT.primary} />
                  <Text style={styles.anonPillText} numberOfLines={1}>
                    {isLoading ? t('common:loading') : userAnonymous || t('common:loading')}
                  </Text>
                </View>

                <Text style={styles.anonNote}>
                  {t('appointment:anonNote', 'Your real identity remains hidden. Only your anonymous name is visible to the counselor.')}
                </Text>
              </LinearGradient>

              {/* Counselor preview card */}
              {selectedCounselorForRequest && (
                <View style={styles.reqCounselorCard}>
                  <View style={styles.reqAvatarWrap}>
                    {selectedCounselorForRequest.avatarType === 'image' ? (
                      <Image
                        source={{ uri: selectedCounselorForRequest.avatar }}
                        style={styles.reqAvatarImg}
                      />
                    ) : (
                      <LinearGradient
                        colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                        style={styles.reqAvatarFallback}
                      >
                        <Text style={styles.reqAvatarText}>
                          {selectedCounselorForRequest.avatar}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>

                  <View style={styles.reqCounselorInfo}>
                    <View style={styles.reqNameRow}>
                      <Text style={styles.reqName} numberOfLines={1}>
                        {selectedCounselorForRequest.name}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color={PATIENT.primary} />
                    </View>
                    <Text style={styles.reqSpec} numberOfLines={1}>
                      {selectedCounselorForRequest.specialization}
                    </Text>
                    <View style={styles.reqMetaRow}>
                      <Ionicons name="briefcase-outline" size={12} color={PATIENT.textSecondary} />
                      <Text style={styles.reqMetaText}>{selectedCounselorForRequest.experience}</Text>
                      <Ionicons name="star" size={12} color="#F5A623" style={{ marginLeft: 10 }} />
                      <Text style={styles.reqMetaText}>
                        {(Number(selectedCounselorForRequest.rating) || 0).toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.reqStatusPill}>
                    <View
                      style={[
                        styles.reqStatusDot,
                        { backgroundColor: selectedCounselorForRequest.available ? PATIENT.online : '#9CA3AF' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.reqStatusText,
                        { color: selectedCounselorForRequest.available ? PATIENT.primary : '#6B7280' },
                      ]}
                    >
                      {selectedCounselorForRequest.available
                        ? t('counselor:available', 'AVAILABLE')
                        : t('common:offline', 'OFFLINE')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Info rows */}
              <View style={styles.reqInfoList}>
                <View style={styles.reqInfoRow}>
                  <Ionicons name="information-circle-outline" size={17} color="#94A3B8" />
                  <Text style={styles.reqInfoText}>
                    {selectedCounselorForRequest && acceptedChatsByCounselorId[String(selectedCounselorForRequest.id)]?.chatId
                      ? t('appointment:tapChatNowToContinue')
                      : t('appointment:youCanChatOnceAccepts')}
                  </Text>
                </View>
                <View style={styles.reqInfoRow}>
                  <Ionicons name="shield-checkmark-outline" size={17} color="#94A3B8" />
                  <Text style={styles.reqInfoText}>
                    {t('appointment:privacyNote', 'You are chatting anonymously. Your real identity is protected.')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.reqSubmitBtn, isLoading && { opacity: 0.7 }]}
                onPress={sendChatRequest}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.reqSubmitText}>
                    {selectedCounselorForRequest && acceptedChatsByCounselorId[String(selectedCounselorForRequest.id)]?.chatId
                      ? t('appointment:chatNow')
                      : t('appointment:sendRequest', 'Send Request')}
                  </Text>
                )}
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
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleSmall}>Book Appointment with</Text>
                <Text style={styles.modalTitleName} numberOfLines={1}>
                  {selectedCounselorForRequest?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowBookingModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalInfo}>
                <Text style={styles.modalSectionTitle}>{t('appointment:appointmentDate', 'Appointment Date & Time')}</Text>
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
                      <Ionicons name="calendar-outline" size={15} color={PATIENT.primary} />
                      <Text style={styles.dateTimeCardLabel}>{t('appointment:date', 'Date')}</Text>
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
                      <Ionicons name="time-outline" size={15} color={PATIENT.primary} />
                      <Text style={styles.dateTimeCardLabel}>{t('appointment:time', 'Time')}</Text>
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

                <Text style={[styles.modalSectionTitle, { marginTop: 14 }]}>{t('appointment:clinicalNotes')}</Text>
                <TextInput
                  style={styles.modalTextArea}
                  multiline
                  numberOfLines={4}
                  value={bookingNotes}
                  onChangeText={setBookingNotes}
                  placeholder={t('appointment:sessionReasonPlaceholder', 'Share what you want to discuss in this session...')}
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.privacyNote}>
                  Sent to the counselor for confirmation.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowBookingModal(false)}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelText}>{t('common:cancel', 'Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmBooking}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalConfirmText}>{t('common:confirm', 'Confirm')}</Text>
                  )}
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
    width: '100%',
    backgroundColor: PATIENT.backgroundTint,
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
    backgroundColor: '#E6F6EC',
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
    color: '#00652C',
    marginBottom: 2,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 0,
    backgroundColor: PATIENT.surface,
    borderWidth: 1,
    borderColor: PATIENT.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingVertical: 0,
    color: PATIENT.text,
    fontSize: 14.5,
  },
  searchActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Figma chips / sections / cards ───────────────────────────────────────
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
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitleInline: {
    fontSize: 13.5,
    fontWeight: '700',
    color: PATIENT.text,
  },
  seeAll: {
    fontSize: 12.5,
    fontWeight: '600',
    color: PATIENT.primary,
  },
  card: {
    backgroundColor: PATIENT.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
  },
  cardAvatar: {
    width: '100%',
    height: '100%',
  },
  cardAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
    paddingTop: 2,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: PATIENT.text,
    flexShrink: 1,
  },
  cardSpec: {
    fontSize: 12,
    color: PATIENT.textSecondary,
    marginTop: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  cardMetaText: {
    fontSize: 12,
    color: PATIENT.textSecondary,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 999,
  },
  statusPillOn: {
    backgroundColor: '#E6F6EC',
  },
  statusPillOff: {
    backgroundColor: '#F1F2F4',
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ─── Chat-request bottom sheet (Figma) ────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  reqSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  reqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  reqTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  anonCard: {
    borderRadius: 18,
    padding: 18,
    overflow: 'hidden',
  },
  anonWatermark: {
    position: 'absolute',
    right: -8,
    top: 6,
  },
  anonTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anonTitle: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  anonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
    maxWidth: '80%',
  },
  anonPillText: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '700',
  },
  anonNote: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 14,
  },
  reqCounselorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F7FCF9',
    borderWidth: 1,
    borderColor: '#E4EFE8',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
  },
  reqAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  reqAvatarImg: { width: '100%', height: '100%' },
  reqAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAvatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  reqCounselorInfo: { flex: 1, paddingTop: 1 },
  reqNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reqName: { fontSize: 14.5, fontWeight: '700', color: PATIENT.text, flexShrink: 1 },
  reqSpec: { fontSize: 11.5, color: PATIENT.textSecondary, marginTop: 2 },
  reqMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  reqMetaText: { fontSize: 11.5, color: PATIENT.textSecondary, fontWeight: '500' },
  reqStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reqStatusDot: { width: 6, height: 6, borderRadius: 3 },
  reqStatusText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
  reqInfoList: { marginTop: 18, gap: 14 },
  reqInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reqInfoText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#64748B' },
  reqSubmitBtn: {
    backgroundColor: PATIENT.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  reqSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  // flex 1.6 vs 1 — "Schedule Appointment" is a long label and was cramped
  // against a same-width "Request" button. Padding + shrink keep it on one line
  // on small screens instead of wrapping.
  btnPrimary: {
    flex: 1.6,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1.4,
    borderColor: PATIENT.primary,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PATIENT.surface,
  },
  btnOutlineSm: {
    borderWidth: 1.4,
    borderColor: PATIENT.primary,
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PATIENT.surface,
  },
  // Full-width variant used before a request exists — "Send Request" is the
  // only action available, so it takes the whole row.
  btnPrimaryFull: {
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  btnPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  btnPendingText: {
    flex: 1,
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  // Unavailable counselors can't receive new requests — shown inert rather than
  // hidden so the reason stays visible next to the availability text.
  btnDisabledSm: {
    borderWidth: 1.4,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  btnDisabledSmText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnOutlineText: {
    color: PATIENT.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  cardOfflineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  nextAvailText: {
    flex: 1,
    fontSize: 11.5,
    color: PATIENT.textSecondary,
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
    backgroundColor: '#E6F6EC',
    borderColor: '#00652C',
  },
  sortChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#00652C',
  },
  listContainer: {
    paddingHorizontal: 0,
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
  unavailableCard: {},
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
    backgroundColor: '#9ca3af',
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
    color: '#00652C',
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  modalTitleSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 3,
  },
  modalTitleName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
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
    color: '#00652C',
  },
  paidSessionPreview: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  paidSessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  paidSessionLabel: {
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: '600',
  },
  paidSessionValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  paidSessionNote: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
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
    marginBottom: 10,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e6ebf1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  dateTimeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dateTimeCardLabel: {
    fontSize: 12,
    color: '#64748b',
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
    borderColor: '#e6ebf1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 100,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e6ebf1',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PATIENT.primary,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  privacyNote: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 16,
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
