import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import TextInput from '../../../../../../components/TranslatedTextInput';
import Text from '../../../../../../components/TranslatedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

import RealVideoCallModal from '../CallModal/VideoCallModal';
import RealVoiceCallModal from '../CallModal/VoiceCallModal';
import { API_BASE_URL } from '../../../../../../axiosConfig';

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'counselor') return 'counsellor';
  return normalized || 'user';
};

const normalizeCallType = (value) => {
  const normalized = String(value || 'video').trim().toLowerCase();
  if (normalized === 'audio' || normalized === 'voice') return 'voice';
  return 'video';
};

const formatDateLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday - startOfInput) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const formatCallDuration = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const getCallDirection = (call) => {
  const role = String(call?.role || '').trim().toLowerCase();
  return role === 'receiver' ? 'incoming' : 'outgoing';
};

const isMissedCall = (call) => {
  const status = String(call?.status || '').trim().toLowerCase();
  return status === 'missed' || status === 'rejected' || status === 'cancelled';
};

const callIconName = (type) => (type === "video" ? "videocam-outline" : "call-outline");

const getProfilePhotoUrl = (call) => {
  if (!call) return null;
  // Prefer profilePhoto (which contains the actual photo after enrichment)
  // Fall back to avatar or any other photo field
  const photo = call.profilePhoto || call.avatar || call.photo;
  if (!photo) return null;

  // Handle string URLs
  if (typeof photo === "string") {
    if (photo.startsWith("http")) return photo;
    if (photo.startsWith("/")) return `${API_BASE_URL}${photo}`;
    if (photo.length > 5) return `${API_BASE_URL}/${photo}`; // Likely a filename
  }

  // Handle object formats
  if (typeof photo === "object") {
    if (photo.url) return photo.url;
    if (photo.uri) return photo.uri;
    if (photo.publicId) return `https://res.cloudinary.com/dfll8lwos/image/upload/${photo.publicId}`;
  }

  return null;
};

const CallHistory = () => {
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactPhone = viewportWidth < 380;
  const { t } = useLanguageRender();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeCallMode, setActiveCallMode] = useState('video');
  const [selectedCall, setSelectedCall] = useState(null);
  const [callsData, setCallsData] = useState([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [callError, setCallError] = useState('');
  const [startingCallKey, setStartingCallKey] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserType, setCurrentUserType] = useState('user');

  useEffect(() => {
    const loadSession = async () => {
      const userId =
        (await AsyncStorage.getItem('userId')) ||
        (await AsyncStorage.getItem('counsellorId')) ||
        (await AsyncStorage.getItem('counselorId')) ||
        '';
      const userRole =
        (await AsyncStorage.getItem('userRole')) ||
        (await AsyncStorage.getItem('role')) ||
        'user';
      setCurrentUserId(String(userId).trim());
      setCurrentUserType(normalizeRole(userRole));
    };

    loadSession().catch(() => { });
  }, []);

  // Extract photo URL from various formats
  const extractPhotoUrl = (profilePhoto) => {
    if (!profilePhoto) return null;
    if (typeof profilePhoto === 'string') {
      if (profilePhoto.startsWith('http')) return profilePhoto;
      if (profilePhoto.startsWith('/')) return `${API_BASE_URL}${profilePhoto}`;
      return null;
    }
    if (typeof profilePhoto === 'object') {
      if (profilePhoto.url) return profilePhoto.url;
      if (profilePhoto.uri) return profilePhoto.uri;
      if (profilePhoto.publicId) {
        return `https://res.cloudinary.com/dfll8lwos/image/upload/${profilePhoto.publicId}`;
      }
    }
    return null;
  };

  // Call-history records have no photo or name; look up each unique counterparty's
  // profile data and merge it into the rows.
  const enrichWithProfileData = useCallback(async (calls, token) => {
    const unique = {};
    calls.forEach((c) => {
      if (c.counterPartyId) {
        unique[c.counterPartyId] = c.counterPartyType;
      }
    });
    const ids = Object.keys(unique);
    if (!ids.length) return;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const profileDataMap = {};
    await Promise.all(
      ids.map(async (id) => {
        const type = String(unique[id] || '').toLowerCase();
        const endpoint =
          type === 'counsellor' || type === 'counselor'
            ? `${API_BASE_URL}/api/auth/counsellors/${id}`
            : `${API_BASE_URL}/api/auth/getUser/${id}`;
        try {
          const res = await axios.get(endpoint, { headers });
          const data = res.data?.counsellor || res.data?.user || res.data || {};
          const photo = extractPhotoUrl(data?.profilePhoto);
          const fullName = data?.fullName || data?.displayName || data?.name;

          if (photo || fullName) {
            profileDataMap[id] = {
              ...(photo && { profilePhoto: photo }),
              ...(fullName && { name: fullName }),
            };
          }
        } catch {
          /* ignore individual lookup failures */
        }
      }),
    );

    if (Object.keys(profileDataMap).length) {
      setCallsData((prev) =>
        prev.map((c) =>
          profileDataMap[c.counterPartyId]
            ? { ...c, ...profileDataMap[c.counterPartyId] }
            : c,
        ),
      );
    }
  }, []);

  const fetchCallHistory = useCallback(async () => {
    if (!currentUserId) {
      setCallsData([]);
      setCallError('Unable to load call history. User not found.');
      return;
    }

    setIsLoadingCalls(true);
    setCallError('');

    try {
      const token =
        (await AsyncStorage.getItem('token')) ||
        (await AsyncStorage.getItem('accessToken'));

      const response = await axios.get(
        `${API_BASE_URL}/api/video/calls/history/${currentUserId}`,
        {
          params: { page: 1, limit: 100 },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );

      const historyItems = Array.isArray(response.data?.history)
        ? response.data.history
        : [];

      const normalizedCalls = historyItems
        .map((call, index) => {
          const timestamp = call.timestamp || call.createdAt;
          const dateValue = timestamp ? new Date(timestamp) : null;
          const normalizedType = normalizeCallType(call.type);
          const direction = getCallDirection(call);
          const missed = isMissedCall(call);
          const readableName =
            call.with || call.withName || call.withDisplayName || 'Participant';
          const avatarLabel = String(readableName || 'P').trim().charAt(0).toUpperCase() || 'P';

          return {
            id: call.id || `${timestamp || 'call'}_${index}`,
            callId: call.id,
            roomId: call.roomId,
            name: readableName,
            type: normalizedType,
            status: missed ? 'missed' : direction,
            rawStatus: String(call.status || '').toLowerCase(),
            date: formatDateLabel(timestamp),
            time:
              dateValue && !Number.isNaN(dateValue.getTime())
                ? dateValue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--',
            duration: Number(call.duration) > 0 ? formatCallDuration(call.duration) : null,
            profilePic: avatarLabel,
            profilePhoto:
              call.withPhoto ||
              call.withProfilePhoto ||
              call.withProfilePic ||
              call.withAvatar ||
              call.profilePhoto ||
              call.avatar ||
              call.photo ||
              call.withUser?.profilePhoto ||
              call.participant?.profilePhoto ||
              call.counsellor?.profilePhoto ||
              call.user?.profilePhoto ||
              null,
            missed,
            counterPartyId:
              call.withId ||
              call.receiverId ||
              call.counsellorId ||
              call.counselorId ||
              call.withUser?._id ||
              call.withUser?.id ||
              call.participant?._id ||
              call.participant?.id,
            counterPartyType: normalizeRole(
              call.withType || call.receiverType || call.participantType || 'counsellor',
            ),
            role: call.role,
            timestamp,
            apiCallData: call,
          };
        })
        .sort((a, b) => {
          const left = new Date(b.timestamp || 0).getTime();
          const right = new Date(a.timestamp || 0).getTime();
          return left - right;
        });

      setCallsData(normalizedCalls);

      // The history API doesn't return counterparty photos/names — fetch them and merge.
      enrichWithProfileData(normalizedCalls, token);
    } catch (error) {
      setCallError(
        error?.response?.data?.error ||
        'Failed to load call history. Please try again.',
      );
      setCallsData([]);
    } finally {
      setIsLoadingCalls(false);
    }
  }, [currentUserId, enrichWithProfileData]);

  useEffect(() => {
    fetchCallHistory().catch(() => { });
  }, [fetchCallHistory]);

  const startCallFromHistory = useCallback(
    async (callMode, callEntry = null) => {
      const resolvedCallMode = normalizeCallType(callMode);
      const receiverId = String(callEntry?.counterPartyId || '').trim();
      const receiverType = normalizeRole(callEntry?.counterPartyType || '');
      const callKey = `${callEntry?.id || receiverId}_${resolvedCallMode}`;

      if (!currentUserId) {
        setCallError('Unable to start call. User not found.');
        return;
      }

      if (!receiverId) {
        setCallError('Select a previous call entry to start a new call.');
        return;
      }

      try {
        setCallError('');
        setStartingCallKey(callKey);
        const token =
          (await AsyncStorage.getItem('token')) ||
          (await AsyncStorage.getItem('accessToken'));

        const response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          {
            initiatorId: currentUserId,
            initiatorType: currentUserType,
            receiverId,
            receiverType: receiverType || 'counsellor',
            callType: resolvedCallMode === 'voice' ? 'audio' : 'video',
          },
          {
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : { 'Content-Type': 'application/json' },
          },
        );

        if (response.data?.success === false) {
          throw new Error(
            response.data?.error || response.data?.message || 'Failed to start call.',
          );
        }

        const callData = response.data?.callData || response.data?.call || response.data || {};
        const receiverData = callData.receiver || {};

        setSelectedCall({
          id: callData.id || response.data.callId,
          callId: response.data?.callId || callData.callId || callData.id,
          roomId: response.data?.roomId || callData.roomId,
          name:
            receiverData.displayName ||
            receiverData.fullName ||
            callEntry?.name ||
            'Participant',
          type: resolvedCallMode,
          callType: resolvedCallMode,
          profilePic:
            receiverData.profilePhoto ||
            String(
              receiverData.displayName ||
              receiverData.fullName ||
              callEntry?.name ||
              'P',
            )
              .trim()
              .charAt(0)
              .toUpperCase(),
          status: response.data.status || 'ringing',
          apiCallData: callData,
          initiator: callData.initiator,
          receiver: callData.receiver,
          currentUserId,
        });

        setActiveCallMode(resolvedCallMode);
        if (resolvedCallMode === 'voice') setIsVoiceModalOpen(true);
        else setIsVideoModalOpen(true);
      } catch (error) {
        setCallError(
          error?.response?.data?.error ||
          error?.message ||
          'Unable to start call. Please try again.',
        );
      } finally {
        setStartingCallKey('');
      }
    },
    [currentUserId, currentUserType],
  );

  const filteredCalls = useMemo(
    () =>
      callsData
        .filter((call) => {
          if (activeFilter === 'all') return true;
          if (activeFilter === 'missed') return call.missed;
          if (activeFilter === 'incoming') return call.status === 'incoming';
          if (activeFilter === 'outgo') return call.status === 'outgoing';
          return true;
        })
        .filter((call) =>
          String(call.name || '').toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    [activeFilter, callsData, searchTerm],
  );

  const groupedCalls = useMemo(() => {
    const groups = filteredCalls.reduce((acc, call) => {
      const key = call.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(call);
      return acc;
    }, {});

    return Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date],
    }));
  }, [filteredCalls]);

  const openCallModal = useCallback(
    (call) => {
      startCallFromHistory(call.type, call).catch(() => { });
    },
    [startCallFromHistory],
  );

  const openNewVideoCall = useCallback(() => {
    if (!callsData.length) {
      setCallError('No recent contacts found. Start a chat first.');
      return;
    }
    startCallFromHistory('video', callsData[0]).catch(() => { });
  }, [callsData, startCallFromHistory]);

  const openNewVoiceCall = useCallback(() => {
    if (!callsData.length) {
      setCallError('No recent contacts found. Start a chat first.');
      return;
    }
    startCallFromHistory('voice', callsData[0]).catch(() => { });
  }, [callsData, startCallFromHistory]);

  const closeCallModals = useCallback(() => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    fetchCallHistory().catch(() => { });
  }, [fetchCallHistory]);

  const handleEndCall = useCallback(
    async (callId) => {
      try {
        if (!callId || !currentUserId) return false;
        const token =
          (await AsyncStorage.getItem('token')) ||
          (await AsyncStorage.getItem('accessToken'));

        await axios.put(
          `${API_BASE_URL}/api/video/calls/${callId}/end`,
          {
            userId: currentUserId,
            endedBy: currentUserType === 'counsellor' ? 'counsellor' : 'user',
          },
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        return true;
      } catch (_) {
        return false;
      }
    },
    [currentUserId, currentUserType],
  );

  const renderCallItem = ({ item: call }) => {
    const isMissed = call.status === "missed";
    const profileUrl = getProfilePhotoUrl(call);
    const spec = call.specialization || "Mental Wellness Specialist";

    return (
      <View
        style={styles.callItem}
      >
        {/* Avatar */}
        <View style={styles.callAvatarWrapper}>
          {profileUrl ? (
            <Image
              source={{ uri: profileUrl }}
              style={styles.callAvatarImage}
              onError={() => { }}
            />
          ) : (
            <View style={[styles.callAvatarPlaceholder, { backgroundColor: "#E6F6EC" }]}>
              <Text style={[styles.callAvatarText, { color: "#00652C" }]}>{call.profilePic}</Text>
            </View>
          )}
        </View>

        {/* Center: Info column + Time */}
        <View style={styles.callInfoSection}>
          <Text style={styles.callName} numberOfLines={1}>
            {call.name}
          </Text>
          <Text style={styles.callSpecialization} numberOfLines={1}>{spec}</Text>
          <Text style={styles.callTimeSmall}>{call.time}</Text>
        </View>

        {/* Duration in middle */}
        {call.duration && !isCompactPhone && (
          <View style={styles.callDurationBox}>
            <Text style={styles.callDurationText}>{call.duration}</Text>
          </View>
        )}

        {/* Both history actions are real buttons: redial by voice or video. */}
        <View style={styles.callRightIcon}>
          {isMissed && !isCompactPhone ? (
            <Text style={styles.missedCallText} numberOfLines={1}>{t('Missed')}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.historyCallAction}
            onPress={() => startCallFromHistory('voice', call)}
            disabled={Boolean(startingCallKey)}
            accessibilityRole="button"
            accessibilityLabel={`${t('Voice Call')} ${call.name}`}
          >
            {startingCallKey === `${call.id}_voice` ? (
              <ActivityIndicator size="small" color="#00652C" />
            ) : (
              <Ionicons name="call" size={20} color="#00652C" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.historyCallAction}
            onPress={() => startCallFromHistory('video', call)}
            disabled={Boolean(startingCallKey)}
            accessibilityRole="button"
            accessibilityLabel={`${t('Video Call')} ${call.name}`}
          >
            {startingCallKey === `${call.id}_video` ? (
              <ActivityIndicator size="small" color="#00652C" />
            ) : (
              <Ionicons name="videocam" size={21} color="#00652C" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.callDateHeader}>
      <Text style={styles.callDate}>{title}</Text>
    </View>
  );

  const renderEmptyState = () => {
    if (isLoadingCalls) {
      return (
        <View style={styles.callNoResults}>
          <ActivityIndicator size="large" color="#00652C" />
          <Text style={styles.callNoResultsTitle}>{t('Loading call history...')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.callNoResults}>
        <Ionicons name="call-outline" size={56} color="#94a3b8" />
        <Text style={styles.callNoResultsTitle}>{t('No calls found')}</Text>
        <Text style={styles.callNoResultsSubtitle}>{t('Try changing your search or filter')}</Text>
      </View>
    );
  };

  const filterButtons = [
    { key: 'all', label: t('All') },
    { key: 'missed', label: t('Missed') },
    { key: 'incoming', label: t('Incoming') },
    { key: 'outgo', label: t('Outgoing') },
  ];

  return (
    // UserDashboard already owns the top safe area and renders its header
    // immediately above this tab. Applying `top` here again created the large
    // blank strip between that header and the search box.
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9FF" />

      <View style={styles.headerContainer}>
        

        <View style={[styles.searchSection, isCompactPhone && styles.searchSectionCompact]}>
          <View style={[styles.callSearch, isCompactPhone && styles.callSearchCompact]}>
            <Ionicons name="search" size={isCompactPhone ? 17 : 18} color="#74777c" />
            <TextInput
              style={[styles.callSearchInput, isCompactPhone && styles.callSearchInputCompact]}
              placeholder={t('Search contacts...')}
              placeholderTextColor="#8696a0"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm ? (
              <TouchableOpacity style={styles.callClearBtn} onPress={() => setSearchTerm("")}>
                <Ionicons name="close-circle" size={18} color="#8696a0" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.callFilters}>
          {filterButtons.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={styles.callFilterBtnWrap}
                activeOpacity={0.85}
                onPress={() => setActiveFilter(filter.key)}
              >
                {isActive ? (
                  // Same gradient/direction as the wallet balance card.
                  <LinearGradient
                    colors={['#006B2C', '#01CE54']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.callFilterBtn, styles.callFilterBtnActive]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.callFilterBtnText, styles.callFilterBtnTextActive]}
                    >
                      {filter.label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.callFilterBtn}>
                    <Text numberOfLines={1} style={styles.callFilterBtnText}>
                      {filter.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {callError ? (
          <View style={styles.callErrorBanner}>
            <Ionicons name="alert-circle" size={16} color="#b91c1c" />
            <Text style={styles.callErrorText}>{callError}</Text>
          </View>
        ) : null}
      </View>

      <SectionList
        sections={groupedCalls}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCallItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.callsList}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />

      <RealVideoCallModal
        isOpen={isVideoModalOpen}
        onClose={closeCallModals}
        callData={selectedCall}
        currentUser={{ id: currentUserId, role: currentUserType }}
        onEndCall={handleEndCall}
        callMode={activeCallMode}
      />

      <RealVoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={closeCallModals}
        callData={selectedCall}
        currentUser={{ id: currentUserId, role: currentUserType }}
        onEndCall={handleEndCall}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9FF",
  },
  headerContainer: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    paddingBottom: 4,
  },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  callTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  callSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  callHeaderActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  searchSectionCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 46,
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  callSearchCompact: {
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  callSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
  },
  callSearchInputCompact: {
    fontSize: 14,
  },
  callClearBtn: {
    padding: 4,
  },
  callFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  // Chips share the row equally instead of sizing to their text - with the full
  // "Outgoing" label, auto-width chips overflow a 360dp screen.
  callFilterBtnWrap: {
    flex: 1,
    minWidth: 0,
  },
  callFilterBtn: {
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  callFilterBtnActive: {
    backgroundColor: "transparent",
    borderColor: "#006B2C",
  },
  callFilterBtnText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    includeFontPadding: false,
  },
  callFilterBtnTextActive: {
    color: "#ffffff",
  },
  callErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  callErrorText: {
    flex: 1,
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "500",
  },
  callsList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 10,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  callDateHeader: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  callDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  missedCallItem: {
    borderColor: "#fee2e2",
  },
  callAvatarWrapper: {
    flexShrink: 0,
  },
  callAvatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  callAvatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  callAvatarText: {
    fontSize: 20,
    fontWeight: "700",
  },
  callInfoSection: {
    flex: 1,
    minWidth: 0,
  },
  callName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  callSpecialization: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 4,
  },
  callTimeSmall: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  callDurationBox: {
    alignItems: "flex-end",
    minWidth: 50,
  },
  callDurationText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  callRightIcon: {
    marginLeft: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
  },
  historyCallAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8EF",
    borderWidth: 1,
    borderColor: "#CDEED9",
  },
  missedCallBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  missedCallText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  callNoResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 16,
  },
  callNoResultsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  callNoResultsSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

export default CallHistory;
