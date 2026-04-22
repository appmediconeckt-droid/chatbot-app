import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import { useToast } from '../../../../../../components/common/ToastProvider';

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 380;

const CounselorTable = () => {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [counselorsData, setCounselorsData] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [bookingCounselorId, setBookingCounselorId] = useState(null);
  const [imageLoadFailures, setImageLoadFailures] = useState({});
  const [acceptedChatsByCounselorId, setAcceptedChatsByCounselorId] = useState({});

  const getStoredToken = useCallback(async () => {
    const accessToken = await AsyncStorage.getItem('accessToken');
    const token = await AsyncStorage.getItem('token');
    return accessToken || token;
  }, []);

  const getStoredUserRole = useCallback(async () => {
    const explicitRole = await AsyncStorage.getItem('userRole');
    if (explicitRole) return String(explicitRole).toLowerCase();

    const userDataRaw = await AsyncStorage.getItem('userData');
    if (!userDataRaw) return '';

    try {
      const parsed = JSON.parse(userDataRaw);
      return String(parsed?.role || '').toLowerCase();
    } catch (parseError) {
      console.warn('Unable to parse stored userData role:', parseError);
      return '';
    }
  }, []);

  const getInitials = (name) => {
    if (!name) return 'CN';
    return name
      .split(' ')
      .map((word) => word?.[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const normalizeCounselor = useCallback((c, index) => {
    const specializationList = Array.isArray(c?.specialization)
      ? c.specialization
      : c?.specialization
        ? [c.specialization]
        : ['General'];

    const experienceYears = Number.isFinite(Number(c?.experience))
      ? Number(c.experience)
      : 0;

    const sessionFeeRaw = Number(c?.sessionFee || c?.fee || 0);
    const sessionFee = Number.isFinite(sessionFeeRaw) && sessionFeeRaw > 0 ? sessionFeeRaw : 0;

    return {
      id: c?._id || c?.id || `c-${index}`,
      name: c?.fullName || c?.name || 'Counselor',
      specialization: specializationList.join(', '),
      treatmentTypes: specializationList,
      experience: `${experienceYears} yrs`,
      languages: Array.isArray(c?.languages) && c.languages.length > 0 ? c.languages : ['English'],
      rating: Number(c?.rating) || 4.5,
      fee: sessionFee > 0 ? `₹${sessionFee}` : '₹0',
      availability: c?.isActive ? 'Now' : 'Today',
      patients: Number(c?.totalSessions) || 0,
      avatar: getInitials(c?.fullName || c?.name),
      profilePhoto: c?.profilePhoto?.url || c?.profilePhoto || c?.avatar || null,
      isActive: Boolean(c?.isActive),
    };
  }, []);

  const fetchCounselors = useCallback(async () => {
    try {
      setIsFetching(true);
      setFetchError('');

      const token = await getStoredToken();
      const response = await axios.get(`${API_BASE_URL}/api/auth/counsellors`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const list = response?.data?.counsellors;
      if (!Array.isArray(list)) {
        throw new Error('Invalid counselors response');
      }

      setCounselorsData(list.map(normalizeCounselor));
    } catch (error) {
      console.error('Error fetching counselors:', error);
      setCounselorsData([]);
      setFetchError(error?.response?.data?.message || error?.message || 'Failed to load counselors');
    } finally {
      setIsFetching(false);
    }
  }, [getStoredToken, normalizeCounselor]);

  const fetchAcceptedChats = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (!token) {
        setAcceptedChatsByCounselorId({});
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/chat/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const chats = Array.isArray(response?.data?.chats) ? response.data.chats : [];
      const nextMap = {};

      chats.forEach((chat) => {
        const status = String(chat?.status || '').toLowerCase();
        const counselorId = chat?.otherParty?.id;
        const chatId = chat?.chatId || chat?.id;

        if ((status === 'accepted' || status === 'active') && counselorId && chatId) {
          nextMap[String(counselorId)] = {
            chatId: String(chatId),
            status,
          };
        }
      });

      setAcceptedChatsByCounselorId(nextMap);
    } catch (error) {
      console.error('Error fetching active chats:', error);
      setAcceptedChatsByCounselorId({});
    }
  }, [getStoredToken]);

  useEffect(() => {
    fetchCounselors();
    fetchAcceptedChats();
  }, [fetchCounselors, fetchAcceptedChats]);

  // Build treatment chips from real API results
  const allTreatments = Array.from(
    new Set(counselorsData.flatMap((counselor) => counselor.treatmentTypes || []))
  );

  // Filter counselors based on search and category
  const filteredCounselors = counselorsData.filter(counselor => {
    const treatmentTypes = counselor.treatmentTypes || [];
    const languages = counselor.languages || [];
    const matchesSearch = 
      counselor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counselor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatmentTypes.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
      languages.some(l => l.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || 
      treatmentTypes.some(t => t.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Sort counselors
  const sortedCounselors = [...filteredCounselors].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'fee') {
      return parseInt(String(a.fee || '0').replace('₹', ''), 10) - parseInt(String(b.fee || '0').replace('₹', ''), 10);
    }
    if (sortBy === 'experience') return parseInt(String(b.experience || '0'), 10) - parseInt(String(a.experience || '0'), 10);
    return a.name.localeCompare(b.name);
  });

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<FontAwesome key={`star-${i}`} name="star" size={12} color="#fbbf24" />);
    }
    if (hasHalfStar) {
      stars.push(<FontAwesome key="half-star" name="star-half-full" size={12} color="#fbbf24" />);
    }
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<FontAwesome key={`empty-star-${i}`} name="star-o" size={12} color="#cbd5e1" />);
    }
    return stars;
  };

  const handleBookSession = useCallback(async (counselor) => {
    const counselorId = counselor?.id;
    if (!counselorId) {
      showToast({
        type: 'error',
        title: 'Invalid Counselor',
        message: 'Counselor ID is missing',
      });
      return;
    }

    try {
      setBookingCounselorId(String(counselorId));
      const token = await getStoredToken();
      const role = await getStoredUserRole();
      const existingAcceptedChat = acceptedChatsByCounselorId[String(counselorId)];

      if (!token) {
        showToast({
          type: 'warning',
          title: 'Login Required',
          message: 'Please login to book a session.',
        });
        return;
      }

      if (existingAcceptedChat?.chatId) {
        navigation.navigate('ChatBox', {
          chatId: existingAcceptedChat.chatId,
          counselor: {
            id: counselor.id,
            name: counselor.name,
            specialization: counselor.specialization,
            online: counselor.isActive,
          },
        });
        return;
      }

      if (role && role !== 'user') {
        showToast({
          type: 'error',
          title: 'Access Denied',
          message: 'Only user accounts can book counselor sessions.',
        });
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/chat/start`,
        { counselorId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const chatId = response?.data?.chat?.chatId || response?.data?.chatId || null;
      const chatStatus = String(response?.data?.chat?.status || '').toLowerCase();

      if (chatStatus === 'accepted' || chatStatus === 'active') {
        setAcceptedChatsByCounselorId((prev) => ({
          ...prev,
          [String(counselorId)]: {
            chatId: String(chatId),
            status: chatStatus,
          },
        }));

        navigation.navigate('ChatBox', {
          chatId,
          counselor: {
            id: counselor.id,
            name: counselor.name,
            specialization: counselor.specialization,
            online: counselor.isActive,
          },
        });
        return;
      }

      showToast({
        type: 'success',
        title: 'Request Sent',
        message:
          response?.data?.message ||
          `Session request sent to ${counselor.name}. Please wait for counselor acceptance.`,
      });
    } catch (error) {
      console.error('Error booking session:', error);

      const statusCode = error?.response?.status;
      const apiErrorMessage = error?.response?.data?.error || error?.response?.data?.message || 'Failed to book session';
      const existingChatId = error?.response?.data?.chatId || null;
      const lowerMessage = String(apiErrorMessage).toLowerCase();

      if (
        statusCode === 400 &&
        existingChatId &&
        (lowerMessage.includes('already active') || lowerMessage.includes('continue your conversation'))
      ) {
        setAcceptedChatsByCounselorId((prev) => ({
          ...prev,
          [String(counselorId)]: {
            chatId: String(existingChatId),
            status: 'accepted',
          },
        }));

        navigation.navigate('ChatBox', {
          chatId: existingChatId,
          counselor: {
            id: counselor.id,
            name: counselor.name,
            specialization: counselor.specialization,
            online: counselor.isActive,
          },
        });
        return;
      }

      if (statusCode === 403) {
        showToast({
          type: 'error',
          title: 'Access Denied',
          message: 'Only user accounts can request counselor chats. Please login with a user account.',
        });
        return;
      }

      showToast({
        type: 'error',
        title: 'Request Failed',
        message: apiErrorMessage,
      });
    } finally {
      setBookingCounselorId(null);
    }
  }, [acceptedChatsByCounselorId, getStoredToken, getStoredUserRole, navigation, showToast]);

  const renderCounselorCard = ({ item }) => {
    const acceptedChat = acceptedChatsByCounselorId[String(item.id)];
    const isAccepted = Boolean(acceptedChat?.chatId);

    return (
    <View style={styles.counselorCard}>
      {/* Card header with avatar and availability */}
      <View style={styles.cardHeader}>
        <View style={styles.counselorAvatar}>
          {item.profilePhoto && !imageLoadFailures[item.id] ? (
            <Image
              source={{ uri: item.profilePhoto }}
              style={styles.counselorAvatarImage}
              onError={() => {
                setImageLoadFailures((prev) => ({ ...prev, [item.id]: true }));
              }}
            />
          ) : (
            <Text style={styles.avatarText}>{item.avatar}</Text>
          )}
        </View>
        <View style={styles.counselorBasic}>
          <Text style={styles.counselorName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.specializationBadge}>
            <Text style={styles.counselorSpecialization} numberOfLines={1}>
              {item.specialization}
            </Text>
          </View>
        </View>
        <View style={[styles.availabilityBadge, item.availability === 'Now' && styles.availabilityNow]}>
          <Text style={[styles.availabilityText, item.availability === 'Now' && styles.availabilityNowText]}>
            {item.availability}
          </Text>
        </View>
      </View>

      {/* Tags (treatment types) */}
      <View style={styles.treatmentTags}>
        {item.treatmentTypes.slice(0, 3).map((t, i) => (
          <View key={i} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
          </View>
        ))}
        {item.treatmentTypes.length > 3 && (
          <View style={[styles.tag, styles.tagMore]}>
            <Text style={styles.tagText}>+{item.treatmentTypes.length - 3}</Text>
          </View>
        )}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Rating</Text>
          <View style={styles.statValueRow}>
            {renderStars(item.rating)}
            <Text style={styles.statValue}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Experience</Text>
          <Text style={styles.statValue}>{item.experience}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Patients</Text>
          <Text style={styles.statValue}>{item.patients.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Fee</Text>
          <Text style={[styles.statValue, styles.feeValue]}>{item.fee}</Text>
        </View>
      </View>

      {/* Languages and action */}
      <View style={styles.cardFooter}>
        <View style={styles.languages}>
          {item.languages.map((lang, i) => (
            <View key={i} style={styles.language}>
              <Text style={styles.languageText}>{lang}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.bookBtn,
            isSmallScreen && styles.bookBtnSmall,
            isAccepted && styles.bookBtnAccepted,
            bookingCounselorId === String(item.id) && styles.bookBtnDisabled,
          ]}
          onPress={() => handleBookSession(item)}
          disabled={bookingCounselorId === String(item.id)}
        >
          <Text style={styles.bookBtnText}>
            {bookingCounselorId === String(item.id)
              ? 'Booking...'
              : isAccepted
                ? 'Accepted'
                : 'Book session'}
          </Text>
        </TouchableOpacity>
        </View>
      </View>
    </View>
    );
  };

  const renderFilterChip = (treatment, index) => (
    <TouchableOpacity
      key={index}
      style={[styles.filterChip, selectedCategory === treatment && styles.filterChipActive]}
      onPress={() => setSelectedCategory(treatment)}
    >
      <Text style={[styles.filterChipText, selectedCategory === treatment && styles.filterChipTextActive]}>
        {treatment}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with decorative element */}
        <View style={styles.directoryHeader}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>🧠 Mental Health Experts</Text>
          </View>
          <Text style={styles.directoryTitle}>
            Find your <Text style={styles.titleHighlight}>counselor</Text>
          </Text>
          <Text style={styles.directorySubtitle}>
            Professional therapists specialized in various treatments
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={20} color="#8b9bb5" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, specialization, treatment or language..."
              placeholderTextColor="#9babc5"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm !== '' && (
              <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chips with horizontal scroll */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrapper}>
            <TouchableOpacity
              style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {allTreatments.slice(0, 12).map((treatment, idx) => renderFilterChip(treatment, idx))}
          </ScrollView>
        </View>

        {/* Sort bar and result count */}
        <View style={styles.sortBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortLeft}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
              onPress={() => setSortBy('name')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'name' && styles.sortBtnTextActive]}>Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'rating' && styles.sortBtnActive]}
              onPress={() => setSortBy('rating')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'rating' && styles.sortBtnTextActive]}>Rating</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'fee' && styles.sortBtnActive]}
              onPress={() => setSortBy('fee')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'fee' && styles.sortBtnTextActive]}>Fee (low)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'experience' && styles.sortBtnActive]}
              onPress={() => setSortBy('experience')}
            >
              <Text style={[styles.sortBtnText, sortBy === 'experience' && styles.sortBtnTextActive]}>Experience</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.resultCountRow}>
            <View style={styles.resultCount}>
              <Text style={styles.resultCountText}>
                {sortedCounselors.length} {sortedCounselors.length === 1 ? 'counselor' : 'counselors'} found
              </Text>
            </View>
          </View>
        </View>

        {/* Cards Grid */}
        <View style={styles.counselorGrid}>
          {isFetching ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.centerStateText}>Loading counselors...</Text>
            </View>
          ) : fetchError ? (
            <View style={styles.centerState}>
              <MaterialIcons name="error-outline" size={46} color="#dc2626" />
              <Text style={styles.errorTitle}>Unable to load counselors</Text>
              <Text style={styles.errorSubtitle}>{fetchError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchCounselors}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : sortedCounselors.length > 0 ? (
            <FlatList
              data={sortedCounselors}
              renderItem={renderCounselorCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.noResults}>
              <Ionicons name="search" size={80} color="#a0b3d9" />
              <Text style={styles.noResultsTitle}>No counselors found</Text>
              <Text style={styles.noResultsSubtitle}>Try adjusting your search or filter</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fcff',
  },
  // Header Styles
  directoryHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerBadge: {
    backgroundColor: '#e8edf9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 30,
    marginBottom: 12,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e6d',
    letterSpacing: 0.3,
  },
  directoryTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a2b4c',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleHighlight: {
    color: '#2563eb',
  },
  directorySubtitle: {
    fontSize: 14,
    color: '#5b6f8c',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 60,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    shadowColor: '#1c3454',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    padding: 0,
  },
  searchClear: {
    paddingHorizontal: 8,
  },
  searchClearText: {
    fontSize: 18,
    color: '#94a3b8',
  },
  // Filters Container
  filtersContainer: {
    marginBottom: 16,
  },
  chipsWrapper: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    backgroundColor: 'white',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1e3f76',
    borderColor: '#1e3f76',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3b4e6b',
  },
  filterChipTextActive: {
    color: 'white',
  },
  // Sort Bar
  sortBar: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#002040',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
    minHeight: 38,
  },
  sortLabel: {
    color: '#62748e',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    backgroundColor: 'white',
  },
  sortBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3f5680',
  },
  sortBtnTextActive: {
    color: 'white',
  },
  resultCount: {
    backgroundColor: '#eef4fb',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 30,
  },
  resultCountRow: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4d627a',
  },
  // Counselor Grid
  counselorGrid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // Counselor Card
  counselorCard: {
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  counselorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#233b6e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#233b6e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  counselorAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  counselorBasic: {
    flex: 1,
    marginRight: 8,
  },
  counselorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14253d',
    marginBottom: 4,
    lineHeight: 20,
  },
  specializationBadge: {
    backgroundColor: '#e9f0ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  counselorSpecialization: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
  availabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    backgroundColor: '#eef3fc',
    borderWidth: 1,
    borderColor: '#cfdff2',
  },
  availabilityNow: {
    backgroundColor: '#d2f0e0',
    borderColor: '#a0e0c0',
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34548c',
  },
  availabilityNowText: {
    color: '#0f6e4a',
  },
  // Treatment Tags
  treatmentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#f2f7ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#d5e6ff',
  },
  tagMore: {
    backgroundColor: '#e2eaf9',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#264d7c',
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8fcfd',
    paddingVertical: 12,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2ecfe',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6c85a8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d3b61',
  },
  feeValue: {
    color: '#0b6b50',
  },
  // Card Footer
  cardFooter: {
    marginTop: 2,
    gap: 10,
  },
  languages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 24,
  },
  language: {
    backgroundColor: '#ebf3ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#c8daff',
  },
  languageText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#3a5f8b',
  },
  actionRow: {
    width: '100%',
    alignItems: 'stretch',
  },
  bookBtn: {
    backgroundColor: '#1a3f6e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 40,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1e33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  bookBtnSmall: {
    paddingVertical: 9,
  },
  bookBtnAccepted: {
    backgroundColor: '#0f766e',
  },
  bookBtnDisabled: {
    opacity: 0.7,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  // No Results
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: 'white',
    borderRadius: 48,
    borderWidth: 1,
    borderColor: '#bdd3f0',
    borderStyle: 'dashed',
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f3b62',
    marginTop: 12,
    marginBottom: 4,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: '#6f8bb0',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d7e3f7',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  centerStateText: {
    marginTop: 12,
    color: '#3f5680',
    fontSize: 14,
    fontWeight: '500',
  },
  errorTitle: {
    marginTop: 10,
    color: '#8f1239',
    fontSize: 16,
    fontWeight: '700',
  },
  errorSubtitle: {
    marginTop: 6,
    color: '#7f1d1d',
    textAlign: 'center',
    fontSize: 13,
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default CounselorTable;