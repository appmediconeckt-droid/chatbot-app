import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  const photo = call.profilePic || call.profilePhoto || call.avatar;
  if (!photo) return null;
  if (typeof photo === "string") {
    if (photo.startsWith("http")) return photo;
    if (photo.startsWith("/")) return `${API_BASE_URL}${photo}`;
    if (photo.length > 5) return `${API_BASE_URL}/${photo}`; // Likely a filename
  }
  return null;
};

const CallHistory = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeCallMode, setActiveCallMode] = useState('video');
  const [selectedCall, setSelectedCall] = useState(null);
  const [callsData, setCallsData] = useState([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [callError, setCallError] = useState('');
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
            missed,
            counterPartyId: call.withId,
            counterPartyType: normalizeRole(call.withType),
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
    } catch (error) {
      setCallError(
        error?.response?.data?.error ||
        'Failed to load call history. Please try again.',
      );
      setCallsData([]);
    } finally {
      setIsLoadingCalls(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchCallHistory().catch(() => { });
  }, [fetchCallHistory]);

  const startCallFromHistory = useCallback(
    async (callMode, callEntry = null) => {
      const resolvedCallMode = normalizeCallType(callMode);
      const receiverId = String(callEntry?.counterPartyId || '').trim();
      const receiverType = normalizeRole(callEntry?.counterPartyType || '');

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

        if (!response.data?.success) {
          throw new Error(response.data?.error || 'Failed to start call.');
        }

        const callData = response.data.callData || {};
        const receiverData = callData.receiver || {};

        setSelectedCall({
          id: callData.id || response.data.callId,
          callId: response.data.callId,
          roomId: response.data.roomId,
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
          if (activeFilter === 'video') return call.type === 'video';
          if (activeFilter === 'voice') return call.type === 'voice';
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

    return (
      <TouchableOpacity
        style={[styles.callItem, isMissed && styles.missedCallItem]}
        onPress={() => openCallModal(call)}
        activeOpacity={0.7}
      >
        <View style={styles.callAvatar}>
          {profileUrl ? (
            <Image source={{ uri: profileUrl }} style={styles.callAvatarImage} />
          ) : (
            <View style={[styles.callAvatarPlaceholder, { backgroundColor: isMissed ? "#fee2e2" : "#eef2ff" }]}>
              <Text style={[styles.callAvatarText, { color: isMissed ? "#ef4444" : "#2c50cd" }]}>{call.profilePic}</Text>
            </View>
          )}
          <View style={[styles.directionIndicator, { backgroundColor: isMissed ? "#ef4444" : call.status === "incoming" ? "#10b981" : "#3b82f6" }]}>
            <Ionicons
              name={isMissed ? "close" : call.status === "incoming" ? "arrow-down" : "arrow-up"}
              size={10}
              color="#ffffff"
            />
          </View>
        </View>

        <View style={styles.callInfo}>
          <View style={styles.callNameRow}>
            <Text style={[styles.callName, isMissed && styles.missedCallName]} numberOfLines={1}>
              {call.name}
            </Text>
            <Text style={styles.callTime}>{call.time}</Text>
          </View>

          <View style={styles.callDetails}>
            <Text style={styles.callType}>
              {call.type === "video" ? "Video Call" : "Voice Call"}
            </Text>
            {call.duration && (
              <>
                <View style={styles.dotSeparator} />
                <Text style={styles.callDuration}>{call.duration}</Text>
              </>
            )}
            {isMissed && (
              <View style={styles.callMissedTag}>
                <Text style={styles.callMissedTagText}>Missed</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.callActionBtn}
          onPress={(event) => {
            event?.stopPropagation?.();
            openCallModal(call);
          }}
        >
          <Ionicons
            name={call.type === "video" ? "videocam" : "call"}
            size={20}
            color="#2c50cd"
          />
        </TouchableOpacity>
      </TouchableOpacity>
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
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.callNoResultsTitle}>Loading call history...</Text>
        </View>
      );
    }

    return (
      <View style={styles.callNoResults}>
        <Ionicons name="call-outline" size={56} color="#94a3b8" />
        <Text style={styles.callNoResultsTitle}>No calls found</Text>
        <Text style={styles.callNoResultsSubtitle}>Try changing your search or filter</Text>
      </View>
    );
  };

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'missed', label: 'Missed' },
    { key: 'video', label: 'Video' },
    { key: 'voice', label: 'Voice' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      <View style={styles.headerContainer}>
        

        <View style={styles.searchSection}>
          <View style={styles.callSearch}>
            <Ionicons name="search" size={18} color="#74777c" />
            <TextInput
              style={styles.callSearchInput}
              placeholder="Search contacts..."
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
          {filterButtons.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.callFilterBtn,
                activeFilter === filter.key && styles.callFilterBtnActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.callFilterBtnText,
                  activeFilter === filter.key && styles.callFilterBtnTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
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
    backgroundColor: "#f8f9fb",
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
    marginTop:-35
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
  },
  callSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 46,
    gap: 10,
  },
  callSearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
  },
  callClearBtn: {
    padding: 4,
  },
  callFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  callFilterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  callFilterBtnActive: {
    backgroundColor: "#2c50cd",
    borderColor: "#2c50cd",
  },
  callFilterBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
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
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
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
  callAvatar: {
    position: "relative",
    marginRight: 14,
  },
  callAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  callAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  callAvatarText: {
    fontSize: 20,
    fontWeight: "700",
  },
  directionIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  callInfo: {
    flex: 1,
  },
  callNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  callName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  missedCallName: {
    color: "#ef4444",
  },
  callTime: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  callDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callType: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#cbd5e1",
  },
  callDuration: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  callMissedTag: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  callMissedTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ef4444",
    textTransform: "uppercase",
  },
  callActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
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
