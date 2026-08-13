// SMSInput.js - Fully Responsive Chat Interface with working avatar logic (mirrors SMSList)
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  Image,
  Linking,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ZoomableImageViewer from '../../../../../../components/common/ZoomableImageViewer';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { pick } from '@react-native-documents/picker';
import { DOCTOR } from '../../../../../../theme/palette';

import socketService from '../../../../../../services/socketService';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import useRingtone from '../../../../../../hooks/useRingtone';
import useScreenshotPrevent from '../../../../../../utils/useScreenshotPrevent';
import CounselorGradientButton from '../../../../../../components/common/CounselorGradientButton';
import VideoCallModal from '../../../UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../UserDashboard/Tab/CallModal/VoiceCallModal';
import {
  getAnonymousParticipantId,
  getAnonymousUserAvatar,
  getAnonymousUserDisplay,
} from '../../../../../../utils/anonymousUser';
import GradientFill from '../../../../../../components/common/GradientFill';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import ChatSkeleton from "../../../../../../components/common/ChatSkeleton";
import {
  fetchChatCallEntries,
  mergeTimelineForInverted,
  describeCall,
} from '../../../../../../utils/chatCallHistory';

const { width: screenWidth } = Dimensions.get('window');

// ─── Sent-bubble gradient ─────────────────────────────────────────────────
// EXACT same gradient as the counselor Earnings "Available Balance" box
// (DOCTOR.gradientFrom → gradientTo, horizontal). Pulled from the shared
// palette so it stays identical to earnings + login/signup.
const SENT_GRADIENT = [DOCTOR.gradientFrom, DOCTOR.gradientTo];
const SENT_GRADIENT_START = { x: 0, y: 0.5 };
const SENT_GRADIENT_END = { x: 1, y: 0.5 };

// ─── Avatar Colors (same as SMSList) ──────────────────────────────────────
const AVATAR_BG_COLORS = ['#4f46e5','#0891b2','#059669','#b45309','#c2410c','#7e22ce','#be123c','#1e40af'];
const getAvatarBg = (name) => {
  if (!name) return AVATAR_BG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
};

// ─── Avatar Component (identical to ChatListAvatar) ───────────────────────
const ChatAvatar = ({ avatarUrl, avatar, name, size = 40, style }) => {
  const [failed, setFailed] = useState(false);

  if (avatarUrl && !failed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, justifyContent: 'center', alignItems: 'center' },
        { backgroundColor: getAvatarBg(name) },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5, textAlign: 'center' }}>
        {avatar || getAnonymousUserAvatar({ name })}
      </Text>
    </View>
  );
};

// ─── Incoming Call Modal Component ─────────────────────────────────────────
const IncomingCallModal = ({
  isOpen,
  onClose,
  callType,
  callerName,
  callerAvatar,
  callData,
  onJoinCall,
  onRejectCall,
}) => {
  const { t } = useLanguageRender();
  const { width: winWidth } = useWindowDimensions();
  const [isJoining, setIsJoining] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { stopRinging } = useRingtone();

  const handleJoin = async () => {
    if (isJoining) return;
    setIsJoining(true);
    stopRinging();
    onClose();
    if (onJoinCall && callData) {
      try {
        await onJoinCall(callData.callId);
      } catch (error) {
        console.error("Error joining call:", error);
      } finally {
        setIsJoining(false);
      }
    } else {
      setIsJoining(false);
    }
  };

  const handleReject = async () => {
    if (isRejecting) return;
    setIsRejecting(true);
    stopRinging();
    onClose();
    if (onRejectCall && callData) {
      try {
        await onRejectCall(callData.callId);
      } catch (error) {
        console.error("Error rejecting call:", error);
      } finally {
        setIsRejecting(false);
      }
    } else {
      setIsRejecting(false);
    }
  };

  if (!isOpen) return null;

  const displayName = callerName || "Anonymous User";
  const displayInitial = (displayName?.charAt(0) || "A").toUpperCase();

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.incomingCallOverlay}>
        <View style={[
          styles.incomingCallModal,
          callType === "video" ? styles.videoCallModal : styles.voiceCallModal,
          { width: Math.min(winWidth * 0.88, 380) },
        ]}>
          <View style={styles.incomingCallContent}>
            <View style={styles.incomingCallerInfo}>
              <View style={[styles.incomingCallerAvatar, { backgroundColor: getAvatarBg(displayName) }]}>
                <Text style={styles.avatarInitialLarge}>{displayInitial}</Text>
              </View>
              <Text style={styles.incomingCallerName}>{displayName}</Text>
              <Text style={styles.incomingCallType}>
                {callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
              </Text>
              <Text style={styles.incomingCallMessage}>
                {callData?.requestMessage || `Incoming ${callType} call...`}
              </Text>
            </View>
            <View style={styles.incomingCallControls}>
              <TouchableOpacity style={[styles.incomingCallBtn, styles.rejectBtn]} onPress={handleReject} disabled={isRejecting}>
                {isRejecting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.incomingCallBtnText}>{t('call:reject')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.incomingCallBtn, styles.acceptBtn]} onPress={handleJoin} disabled={isJoining}>
                <GradientFill />
                {isJoining ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.incomingCallBtnText}>{t('call:accept')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const SMSInput = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const isFocused = useIsFocused();
  useScreenshotPrevent();
  const location = route.params || {};
  const [message, setMessage] = useState("");
  const messageInputRef = useRef(null);
  const keyboardVisibleRef = useRef(false);
  const sendFocusGuardRef = useRef(false);
  const focusRestoreTimersRef = useRef([]);
  const messagesContainerRef = useRef(null);
  const chatSocketRef = useRef(null);
  const fallbackChatIdRef = useRef(null);

  const initialLoadDoneRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  // Block poll for 5 seconds after a delete so server can confirm.
  const deletedRecentlyRef = useRef(false);
  const deletedMessageIdsRef = useRef(new Set());
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);

  // Call modal states
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [callError, setCallError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  // Receiving Call States
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState({
    name: "",
    avatar: "👤",
    callId: "",
    roomId: "",
    callType: "video",
  });
  const { startRinging, stopRinging } = useRingtone();

  // Message states
  const [messages, setMessages] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  // Messages and call history are separate requests. The spinner cleared as soon
  // as the MESSAGES landed, so the thread rendered and the call bubbles dropped
  // in seconds later - the same jump the user side had. Hold the first paint
  // until both have settled.
  const [timelineReady, setTimelineReady] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [chatStatus, setChatStatus] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  // Call entries deleted (hidden) locally — there is no server API to delete a
  // call record, so we persist the hidden ids per chat.
  const [hiddenCallIds, setHiddenCallIds] = useState([]);
  // Track deleted message IDs persistently so they stay deleted across navigation/refresh
  const [deletedMessageIds, setDeletedMessageIds] = useState(new Set());
  const getDeletedMessagesStorageKey = useCallback(() => `deletedMessages_${getChatIdForAPI()}`, [chatId, USER_ID, counselorId, selectedUser]);
  // iOS uses padding; Android uses height to remain visible even where an OEM
  // ignores adjustResize, without retaining stale keyboard padding.

  // Counselor data
  const [currentCounselor, setCurrentCounselor] = useState(null);
  const [counselorId, setCounselorId] = useState(null);

  // Selected user from navigation (already contains avatarUrl + avatar from SMSList)
  const [selectedUser, setSelectedUser] = useState(location?.selectedUser || null);
  const chatId = location?.chatId;

  // ===================== Use same utilities as SMSList =====================
  const getUserDetailsFromSelected = () => {
    if (selectedUser && selectedUser.name) {
      // The selectedUser already comes fully hydrated from SMSList transformation
      return {
        id: selectedUser.userId || selectedUser.receiverId || selectedUser.id,
        name: selectedUser.name,
        gender: selectedUser.gender,
        avatar: selectedUser.avatar,
        avatarUrl: selectedUser.avatarUrl,
      };
    }
    // Fallback (should not happen because SMSList always passes processed user)
    const otherParty = selectedUser?.otherParty || selectedUser || {};
    const anonymous = getAnonymousUserDisplay(otherParty);
    return {
      id: getAnonymousParticipantId(otherParty) || selectedUser?.userId,
      name: anonymous.name,
      gender: anonymous.gender,
      avatar: anonymous.avatar,
      avatarUrl: anonymous.avatarUrl,
    };
  };

  const userDetails = getUserDetailsFromSelected();
  const USER_ID = userDetails.id;
  const USER_NAME = userDetails.name;

  const resolveOnlineStatus = (person) => {
    const v = person?.isOnline ?? person?.online;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return ['online','true','1','yes'].includes(v.toLowerCase());
    return false;
  };

  // ===================== Helper functions ===================================
  const getAuthToken = async () => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) return accessToken;
    return AsyncStorage.getItem("token");
  };

  const loadCounselorData = async () => {
    try {
      let counselorData = null;
      const storedCounselor = await AsyncStorage.getItem("counselor") ||
        await AsyncStorage.getItem("counsellor") ||
        await AsyncStorage.getItem("userData");
      if (storedCounselor) {
        try { counselorData = JSON.parse(storedCounselor); } catch(e) {}
      }
      let counselorIdValue = null;
      if (counselorData) {
        counselorIdValue = counselorData._id || counselorData.id;
      }
      if (!counselorIdValue) {
        counselorIdValue = await AsyncStorage.getItem("counsellorId") ||
          await AsyncStorage.getItem("counselorId");
      }
      setCounselorId(counselorIdValue);
      return counselorIdValue;
    } catch (error) {
      return null;
    }
  };

  const normalizeObjectId = (value) => {
    if (!value) return null;
    if (typeof value === "object") {
      return normalizeObjectId(value._id) || normalizeObjectId(value.id) || normalizeObjectId(value.userId) || null;
    }
    const asString = String(value).trim();
    if (!asString) return null;
    if (/^[a-f\d]{24}$/i.test(asString)) return asString;
    const embeddedMatch = asString.match(/[a-f\d]{24}/i);
    return embeddedMatch ? embeddedMatch[0] : null;
  };

  const getChatIdForAPI = () => {
    if (chatId) return chatId;
    if (selectedUser && USER_ID && counselorId) {
      return `chat_${USER_ID}_${counselorId}`;
    }
    if (!fallbackChatIdRef.current) {
      const stableUserId = USER_ID || selectedUser?.userId || "user";
      const stableCounselorId = counselorId || "counsellor";
      fallbackChatIdRef.current = `chat_${stableUserId}_${stableCounselorId}`;
    }
    return fallbackChatIdRef.current;
  };

  const getAttachmentUrl = (item) => {
    const rawUrl = item?.attachmentUrl || item?.attachment || '';
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    if (/^(https?:|file:|content:|data:)/i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/')) return `${API_BASE_URL}${rawUrl}`;
    return `${API_BASE_URL}/${rawUrl}`;
  };

  const isImageAttachment = (item) => {
    const url = getAttachmentUrl(item);
    const name = String(item?.attachmentName || '');
    const contentType = String(item?.attachmentType || item?.contentType || '').toLowerCase();
    return contentType.startsWith('image/') ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)(\?|$)/i.test(url) ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(name);
  };

  const openAttachment = useCallback(async (uri) => {
    if (!uri) return;
    try {
      // Check if it's an image
      const isImage = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(uri);
      if (isImage) {
        // Show image preview modal
        setImagePreviewUrl(uri);
        setImagePreviewVisible(true);
        return;
      }

      // For non-image files, open with default app
      if (Platform.OS === 'android') {
        const fileName = uri.split('/').pop().split('?')[0] || `attachment_${Date.now()}.pdf`;
        const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        const fileExists = await RNFS.exists(destPath);
        if (!fileExists) {
          const result = await RNFS.downloadFile({ fromUrl: uri, toFile: destPath }).promise;
          if (result.statusCode !== 200) throw new Error('Download failed');
        }
        await Linking.openURL(`content://${destPath}`);
      } else {
        await Linking.openURL(uri);
      }
    } catch (error) {
      Alert.alert('Cannot Open File', 'No app found to open this file.');
    }
  }, []);

  const handlePickAttachment = useCallback(async () => {
    if (isSending) return;
    try {
      const [picked] = await pick();
      if (!picked?.uri) return;
      setPendingAttachment({
        uri: picked.uri,
        name: picked.name || `file_${Date.now()}`,
        type: picked.type || picked.mimeType || 'application/octet-stream',
        size: picked.size || picked.fileSize || 0,
      });
    } catch (error) {
      if (error?.code !== 'OPERATION_CANCELED') Alert.alert('Attachment', 'Failed to pick file.');
    }
  }, [isSending]);

  // ─── Message fetching & storage ─────────────────────────────────────────
  const saveMessagesToLocalStorage = async (messagesToSave) => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("smsChats") || "[]");
      const chatIdToSave = getChatIdForAPI();
      const existingIndex = savedChats.findIndex(chat => chat.chatId === chatIdToSave);
      const chatData = {
        chatId: chatIdToSave,
        userId: USER_ID,
        userName: USER_NAME,
        messages: messagesToSave,
        chatStatus,
        lastUpdated: new Date().toISOString(),
      };
      if (existingIndex >= 0) savedChats[existingIndex] = chatData;
      else savedChats.push(chatData);
      await AsyncStorage.setItem("smsChats", JSON.stringify(savedChats));
    } catch (error) {}
  };

  const loadMessagesFromLocalStorage = async () => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("smsChats") || "[]");
      const chatIdToLoad = getChatIdForAPI();
      const savedChat = savedChats.find(chat => chat.chatId === chatIdToLoad);
      if (savedChat && savedChat.messages) {
        setMessages(savedChat.messages);
        if (savedChat.chatStatus) setChatStatus(savedChat.chatStatus);
      }
    } catch (error) {}
  };

  const fetchMessagesFromAPI = async () => {
    if (!selectedUser || !counselorId) return;
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      setIsLoadingMessages(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (response.data && response.data.messages) {
        if (response.data.chatStatus) setChatStatus(response.data.chatStatus);

        // Deduplicate system messages (e.g., "Sending a new request" that appears 6-7 times)
        // Keep only the FIRST occurrence of duplicate system messages
        const seenSystemTexts = new Set();
        const deduplicatedMessages = response.data.messages.filter(msg => {
          const isSystemMessage = msg.content?.includes('Sending a new request') ||
                                  msg.content?.includes('expires in');
          if (isSystemMessage) {
            const key = msg.content;
            if (seenSystemTexts.has(key)) return false; // Skip duplicate
            seenSystemTexts.add(key);
          }
          return true;
        });

        const transformed = deduplicatedMessages.map((msg, idx) => ({
          id: msg.id || msg._id || msg.messageId || `fetched_${idx}`,
          messageId: msg.messageId,
          text: msg.content,
          sender: msg.senderRole === "counsellor" ? "me" : "user",
          senderRole: msg.senderRole,
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          fullTime: msg.createdAt,
          contentType: msg.contentType,
          attachmentType: msg.attachmentType || msg.contentType || null,
          attachmentUrl: msg.attachmentUrl || null,
          attachmentName: msg.attachmentName || null,
          isRead: msg.isRead,
          status: "sent",
        }));
        initialLoadDoneRef.current = false;
        shouldAutoScrollRef.current = true;
        // Filter out any message that we've already deleted (tracked in deletedMessageIds)
        // so the server response doesn't re-add a message we optimistically deleted.
        setMessages(prev => {
          const filtered = transformed.filter(m => !deletedMessageIds.has(String(m.messageId || m.id)));
          saveMessagesToLocalStorage(filtered);
          return filtered;
        });
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        navigation.replace('RoleSelector', { reason: 'session-expired' });
        return;
      }
      loadMessagesFromLocalStorage();
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // ─── Call History ────────────────────────────────────────────────────────
  const fetchCallHistory = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const userId = USER_ID;
      const cId = counselorId;
      if (!userId || !cId) { setCallHistory([]); return; }
      const response = await axios.get(`${API_BASE_URL}/api/video/calls/history/${cId}`, {
        params: { peerId: userId, peerType: 'user', page: 1, limit: 100 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const callsData = response.data?.calls || response.data?.history || [];
      const formatted = callsData
        .filter((c) => String(c.withId || c.receiverId || c.peerId || c.receiver?.id || c.peer?.id) === String(userId))
        .map((c) => ({
          id: c.id || c._id || `call_${Date.now()}_${Math.random()}`,
          isCall: true,
          type: c.callType === 'audio' ? 'voice' : 'video',
          direction: (c.role === 'initiator' || c.initiator?.id === cId) ? 'outgoing' : 'incoming',
          status: c.status || 'completed',
          time: new Date(c.timestamp || c.createdAt || c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fullTime: c.timestamp || c.createdAt || c.startedAt,
          duration: c.duration || null,
        }));
      setCallHistory(formatted);
      AsyncStorage.setItem(
        `counselorCallHistory_${chatId || cId}`,
        JSON.stringify(formatted),
      ).catch(() => {});
    } catch { setCallHistory([]); }
  }, [USER_ID, counselorId]);

  // ─── Merged timeline (messages + calls sorted oldest→newest) ────────────
  const getMergedTimeline = useCallback(() => {
    const hidden = new Set(hiddenCallIds.map(String));
    const visibleCalls = callHistory.filter((c) => !hidden.has(String(c.id)));
    return [...messages, ...visibleCalls].sort((a, b) => {
      const tA = a.fullTime || a.createdAt || a.timestamp;
      const tB = b.fullTime || b.createdAt || b.timestamp;
      return new Date(tA) - new Date(tB);
    });
  }, [messages, callHistory, hiddenCallIds]);

  const hiddenCallsStorageKey = useCallback(() => `hiddenCallEntries_${getChatIdForAPI()}`, [chatId, USER_ID, counselorId, selectedUser]);

  // Load locally-hidden call entries for this thread.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(hiddenCallsStorageKey());
        if (active && stored) setHiddenCallIds(JSON.parse(stored) || []);
      } catch (_) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [hiddenCallsStorageKey]);

  // Load deleted message IDs for this thread so deletions survive app refresh
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(getDeletedMessagesStorageKey());
        if (active && stored) {
          const ids = JSON.parse(stored) || [];
          setDeletedMessageIds(new Set(ids));
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [getDeletedMessagesStorageKey]);

  // Keep ref in sync with deletedMessageIds state so socket listeners see current values
  useEffect(() => {
    deletedMessageIdsRef.current = deletedMessageIds;
  }, [deletedMessageIds]);

  const hideCallEntry = useCallback((callItemId) => {
    if (!callItemId) return;
    setHiddenCallIds((prev) => {
      const next = Array.from(new Set([...prev, String(callItemId)]));
      AsyncStorage.setItem(hiddenCallsStorageKey(), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [hiddenCallsStorageKey]);

  const confirmDeleteCall = useCallback((item) => {
    Alert.alert(
      'Delete Call',
      `Remove this ${item.type === 'video' ? 'video' : 'voice'} call from the chat?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          hideCallEntry(item.id);
        }},
      ],
    );
  }, [hideCallEntry]);

  const getItemDayKey = (item) => {
    const ts = item?.fullTime || item?.createdAt || item?.timestamp;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d.toDateString();
  };

  const formatItemDay = (item) => {
    const ts = item?.fullTime || item?.createdAt || item?.timestamp;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ─── Sending messages ───────────────────────────────────────────────────
  const sendMessageToAPI = async ({ messageContent = "", file = null }) => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      let response;
      if (file) {
        const formData = new FormData();
        if (messageContent.trim()) formData.append("content", messageContent.trim());
        formData.append("attachment", {
          uri: file.uri,
          name: file.name || `attachment_${Date.now()}.jpg`,
          type: file.type || "image/jpeg",
        });
        response = await axios.post(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message`, formData, {
          headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "multipart/form-data" },
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message`, { content: messageContent }, {
          headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        });
      }
      if (response.data && response.data.success) return response.data.message;
      throw new Error("Invalid API response");
    } catch (error) {
      throw error;
    }
  };

  const getMessageIdentifier = (msg) => msg?._id || msg?.id || msg?.messageId;

  const removeMessageFromState = async (messageToDelete) => {
    const targetId = getMessageIdentifier(messageToDelete);
    if (!targetId) return;

    const isSameMessage = (msg) => {
      const currentId = getMessageIdentifier(msg);
      return currentId && String(currentId) === String(targetId);
    };

    // Add to deletedMessageIds (persistent) and hide immediately.
    setDeletedMessageIds(prev => {
      const updated = new Set([...prev, String(targetId), String(messageToDelete.messageId)]);
      AsyncStorage.setItem(getDeletedMessagesStorageKey(), JSON.stringify(Array.from(updated))).catch(() => {});
      return updated;
    });
    setMessages((prev) => {
      const updatedMessages = prev.filter((msg) => !isSameMessage(msg));
      saveMessagesToLocalStorage(updatedMessages);
      return updatedMessages;
    });
  };

  const handleDeleteMessage = async (messageToDelete) => {
    if (!selectedUser || isSending) return;

    const messageId = getMessageIdentifier(messageToDelete);
    if (!messageId || String(messageId).startsWith("temp_") || messageToDelete?.isTemporary) {
      Alert.alert("Delete Message", "This message cannot be deleted yet.");
      return;
    }

    Alert.alert(
      "Delete Message",
      "Delete this message? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setError(null);
            // Optimistic delete: remove instantly, then sync the server in the
            // background. Roll back if the server call fails.
            await removeMessageFromState(messageToDelete);
            // Set grace period (10 seconds) to prevent race conditions with multiple
            // deletes or concurrent fetches. Message is already marked as deleted above.
            deletedRecentlyRef.current = true;
            setTimeout(() => {
              deletedRecentlyRef.current = false;
            }, 10000);
            try {
              const token = await getAuthToken();
              await axios.delete(`${API_BASE_URL}/api/chat/message/${encodeURIComponent(messageId)}`, {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: token ? `Bearer ${token}` : "",
                },
              });
            } catch (deleteError) {
              if (deleteError?.response?.status === 401) {
                navigation.replace('RoleSelector', { reason: 'session-expired' });
                return;
              }
              // Restore the message since the server delete failed.
              setDeletedMessageIds(prev => {
                const updated = new Set(prev);
                updated.delete(String(messageId));
                updated.delete(String(messageToDelete.messageId));
                AsyncStorage.setItem(getDeletedMessagesStorageKey(), JSON.stringify(Array.from(updated))).catch(() => {});
                return updated;
              });
              setMessages((prev) => {
                if (prev.some((m) => String(getMessageIdentifier(m)) === String(messageId))) return prev;
                const restored = [...prev, messageToDelete];
                restored.sort((a, b) => {
                  const ta = new Date(a.fullTime || a.createdAt || a.timestamp || Date.now()).getTime();
                  const tb = new Date(b.fullTime || b.createdAt || b.timestamp || Date.now()).getTime();
                  return ta - tb;
                });
                return restored;
              });
              const errorMsg =
                deleteError?.response?.data?.error ||
                deleteError?.response?.data?.message ||
                deleteError?.message ||
                "Failed to delete message";
              Alert.alert("Delete Failed", errorMsg);
            }
          },
        },
      ],
    );
  };
  const handleSendMessage = async () => {
    if ((message.trim() === "" && !pendingAttachment) || !selectedUser || isSending) return;
    const keepComposerFocused = Boolean(
      keyboardVisibleRef.current || messageInputRef.current?.isFocused?.(),
    );
    const messageText = message.trim();
    const attachmentToSend = pendingAttachment;
    const tempMessage = {
      id: `temp_${Date.now()}`,
      text: messageText || `📎 ${attachmentToSend?.name || "Attachment"}`,
      sender: "me",
      senderRole: "counsellor",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      status: "sending",
      isTemporary: true,
      attachmentName: attachmentToSend?.name || null,
      attachmentUrl: attachmentToSend?.uri || null,
      attachmentType: attachmentToSend?.type || null,
    };
    shouldAutoScrollRef.current = true;
    setMessages(prev => [...prev, tempMessage]);
    setMessage("");
    setPendingAttachment(null);
    setIsSending(true);
    setError(null);
    // Sending must not blur or disable the composer. Keep the keyboard and
    // caret active while the network request completes.
    if (keepComposerFocused) preserveComposerFocusForSend();
    try {
      const sentMsg = await sendMessageToAPI({ messageContent: messageText, file: attachmentToSend });
      setMessages(prev => {
        const confirmedId = sentMsg?.id || sentMsg?._id || sentMsg?.messageId;
        const socketAlreadyAdded = confirmedId && prev.some(m => !m.isTemporary && (m.id === confirmedId || m.messageId === sentMsg?.messageId));
        if (socketAlreadyAdded) return prev.filter(m => !m.isTemporary);
        const withoutTemp = prev.filter(m => !m.isTemporary);
        if (!sentMsg) return withoutTemp;
        return [...withoutTemp, {
          id: confirmedId,
          messageId: sentMsg.messageId,
          text: sentMsg.content,
          sender: "me",
          senderRole: "counsellor",
          time: new Date(sentMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          fullTime: sentMsg.createdAt,
          contentType: sentMsg.contentType,
          attachmentType: sentMsg.attachmentType || sentMsg.contentType || attachmentToSend?.type || null,
          attachmentUrl: sentMsg.attachmentUrl || null,
          attachmentName: sentMsg.attachmentName || null,
          isRead: sentMsg.isRead,
          status: "sent",
        }];
      });
    } catch (err) {
      setMessages(prev => prev.map(msg => msg.id === tempMessage.id ? { ...msg, status: "error" } : msg));
      setError("Failed to send message");
      setTimeout(() => setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id)), 3000);
    } finally {
      setIsSending(false);
      finishComposerFocusForSend();
    }
  };

  // ─── End session ─────────────────────────────────────────────────────────
  // Counselor ends the session. The backend should mark the chat "ended" and
  // emit the existing `chat-status-update` event so the user's app shows its
  // rating popup. We update our own status locally for immediate feedback.

  // Clear chat function
  const clearChat = async () => {
    try {
      const token = await getAuthToken();
      const apiChatId = getChatIdForAPI();

      await axios.post(
        `${API_BASE_URL}/api/chat/clear/${apiChatId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages([]);
      setCallHistory([]);
      setDeletedMessageIds(new Set());
      Alert.alert("Success", "Chat cleared! You can now start a new conversation.");
    } catch (error) {
      Alert.alert(
        "Error",
        `Could not clear chat: ${error?.response?.data?.error || error.message || "Failed to clear chat on server"}`
      );
    }
  };

  // ─── Call initiation and handling ────────────────────────────────────────
  const initiateVideoCall = async () => {
    if (!selectedUser || !counselorId) {
      setCallError("Unable to make call");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No token");
      const requestBody = {
        initiatorId: String(counselorId),
        receiverId: String(USER_ID),
        receiverType: "user",
        callType: "video",
        initiatorType: "counsellor",
      };
      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, requestBody, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.data && response.data.success) {
        const callData = {
          callId: response.data.callId || response.data.callData?._id,
          roomId: response.data.roomId,
          name: USER_NAME,
          type: "video",
          callType: "video",
          status: "ringing",
          currentUserId: counselorId,
          currentUserType: "counsellor",
          isIncoming: false,
        };
        setSelectedCall(callData);
        setIsVideoModalOpen(true);
      } else throw new Error(response.data?.message);
    } catch (error) {
      setCallError(error.message || "Failed to initiate video call");
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const initiateVoiceCall = async () => {
    if (!selectedUser || !counselorId) {
      setCallError("Unable to make call");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No token");
      const requestBody = {
        initiatorId: String(counselorId),
        receiverId: String(USER_ID),
        receiverType: "user",
        callType: "audio",
        initiatorType: "counsellor",
      };
      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, requestBody, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.data && response.data.success) {
        const callData = {
          callId: response.data.callId || response.data.callData?._id,
          roomId: response.data.roomId,
          name: USER_NAME,
          type: "voice",
          callType: "audio",
          status: "ringing",
          currentUserId: counselorId,
          currentUserType: "counsellor",
          isIncoming: false,
        };
        setSelectedCall(callData);
        setIsVoiceModalOpen(true);
      } else throw new Error(response.data?.message);
    } catch (error) {
      setCallError(error.message || "Failed to initiate voice call");
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleJoinIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const response = await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/accept`, {
        acceptorId: counselorId,
        acceptorType: "counsellor",
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data?.success) {
        let detailedCall = null;
        try {
          const details = await axios.get(`${API_BASE_URL}/api/video/calls/${callId}/details`, {
            params: { userId: counselorId, userType: "counsellor" },
            headers: { Authorization: `Bearer ${token}` },
          });
          detailedCall = details.data?.call;
        } catch(e) {}
        const callType = incomingCallData.callType || detailedCall?.type || "video";
        const modalType = callType === "audio" ? "voice" : callType;
        const callDataForModal = {
          callId,
          roomId: response.data.roomId || detailedCall?.roomId,
          name: incomingCallData.name,
          type: modalType,
          callType: modalType,
          status: "active",
          currentUserType: "counsellor",
          isIncoming: true,
        };
        if (modalType === "video") {
          setSelectedCall(callDataForModal);
          setIsVideoModalOpen(true);
        } else {
          setSelectedCall(callDataForModal);
          setIsVoiceModalOpen(true);
        }
        return { success: true };
      }
      throw new Error("Failed to accept call");
    } catch (error) {
      console.error("Join call error:", error);
      throw error;
    }
  };

  const handleRejectIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/reject`, { userId: counselorId, reason: "declined" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleEndIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/end`, { userId: counselorId, endedBy: "counsellor" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => { loadCounselorData(); }, []);
  useEffect(() => {
    if (!selectedUser || !counselorId) return undefined;
    let alive = true;
    (async () => {
      // Paint from cache first when we have it, so the thread appears complete
      // straight away and the network refresh below is invisible.
      try {
        const cached = await AsyncStorage.getItem(
          `counselorCallHistory_${chatId || counselorId}`,
        );
        if (alive && cached) setCallHistory(JSON.parse(cached) || []);
      } catch (_) { /* cache is best-effort */ }

      // In parallel, not one-after-the-other, and the gate opens only when both
      // are done. try/finally so a rejected request opens the gate too - the
      // error branch below the skeleton is what should be shown then, not an
      // endless skeleton waiting on the 6s guard.
      try {
        await Promise.all([fetchMessagesFromAPI(), fetchCallHistory()]);
      } finally {
        if (alive) setTimelineReady(true);
      }
    })();
    // Never let a hung request leave the thread behind a skeleton forever.
    const guard = setTimeout(() => { if (alive) setTimelineReady(true); }, 6000);
    return () => { alive = false; clearTimeout(guard); };
  }, [selectedUser, chatId, counselorId]);

  // Load call history for this conversation and merge it into the thread.
  const loadCallHistory = async () => {
    try {
      if (!counselorId || !USER_ID) return;
      const token = await getAuthToken();
      const entries = await fetchChatCallEntries({
        currentUserId: counselorId,
        peerId: USER_ID,
        token,
      });
      setCallHistory(entries);
    } catch (_) {
      // Non-fatal — chat still renders without call entries.
    }
  };

  // Secondary refresh once both ids are known. It used to be the ONLY thing that
  // loaded call history on this screen when the ids resolved late, which is why
  // the bubbles appeared well after the messages.
  useEffect(() => {
    if (counselorId && USER_ID) loadCallHistory();
  }, [counselorId, USER_ID, chatId]);

  // Socket connection
  useEffect(() => {
    const setupSocket = async () => {
      const apiChatId = getChatIdForAPI();
      if (!apiChatId || !selectedUser || !counselorId) return;
      const token = await getAuthToken();
      if (!token) return;
      const unsubscribers = [];
      try {
        const socket = await socketService.connect();
        chatSocketRef.current = socket;
        setIsSocketConnected(true);
        const onConnect = () => {
          socket.emit('join-chat', { chatId: apiChatId });
        };
        unsubscribers.push(await socketService.on('connect', onConnect));
        unsubscribers.push(await socketService.on('disconnect', () => setIsSocketConnected(false)));
        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          if (String(userId) === String(USER_ID)) {
            setSelectedUser(prev => prev ? { ...prev, online: !!isOnline, lastSeen } : prev);
          }
        }));
        unsubscribers.push(await socketService.on('new-message', (messageData) => {
          shouldAutoScrollRef.current = true;
          // Skip if this message was deleted locally
          if (deletedMessageIdsRef.current.has(String(messageData.messageId || messageData.id || messageData._id))) return;
          const isOwn = messageData.senderRole === 'counsellor' && String(messageData.senderId) === String(counselorId);
          setMessages(prev => {
            if (prev.some(m => m.messageId && m.messageId === messageData.messageId)) return prev;
            if (isOwn) {
              const tempIndex = prev.findIndex(m => m.isTemporary);
              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = {
                  id: messageData.id || messageData._id,
                  messageId: messageData.messageId,
                  text: messageData.content,
                  sender: 'me',
                  senderRole: 'counsellor',
                  time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  fullTime: messageData.createdAt,
                  attachmentType: messageData.attachmentType,
                  attachmentUrl: messageData.attachmentUrl,
                  attachmentName: messageData.attachmentName,
                  isRead: messageData.isRead,
                  status: 'sent',
                };
                return next;
              }
            }
            return [...prev, {
              id: messageData.id || messageData._id,
              messageId: messageData.messageId,
              text: messageData.content,
              sender: isOwn ? 'me' : 'user',
              senderRole: messageData.senderRole,
              time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              fullTime: messageData.createdAt,
              attachmentType: messageData.attachmentType,
              attachmentUrl: messageData.attachmentUrl,
              attachmentName: messageData.attachmentName,
              isRead: messageData.isRead,
              status: 'sent',
            }];
          });
        }));
        unsubscribers.push(await socketService.on('user-typing', ({ userRole, isTyping }) => {
          if (userRole === 'user') setRemoteIsTyping(isTyping);
        }));
        unsubscribers.push(await socketService.on('connect_error', (err) => console.error("Socket error", err)));
        chatSocketRef.current._unsubscribers = unsubscribers;
      } catch (err) {
        console.error("Socket setup error:", err);
      }
    };
    setupSocket();
    return () => {
      try { chatSocketRef.current?._unsubscribers?.forEach(fn => fn()); } catch(e) {}
      chatSocketRef.current = null;
    };
  }, [selectedUser, counselorId, USER_ID]);

  // Polling for calls
  useEffect(() => {
    let intervalId = null;
    const fetchIncoming = async () => {
      try {
        const token = await getAuthToken();
        if (!counselorId || !token || showIncomingModal || isVideoModalOpen || isVoiceModalOpen) return;
        const res = await axios.get(`${API_BASE_URL}/api/video/calls/pending/${counselorId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const calls = res.data.pendingRequests || [];
        if (calls.length > 0) {
          const call = calls[0];
          const from = call.from || {};
          setIncomingCallData({
            callId: call.callId,
            roomId: call.roomId,
            name: from.anonymous || from.anonName || from.anonymousName || "Anonymous User",
            avatar: "👤",
            callType: call.callType || "video",
            requestMessage: call.requestMessage || `Incoming ${call.callType || "video"} call...`,
          });
          setShowIncomingModal(true);
        }
      } catch (err) {}
    };
    if (isFocused && counselorId) {
      intervalId = setInterval(fetchIncoming, 5000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isFocused, counselorId, showIncomingModal, isVideoModalOpen, isVoiceModalOpen]);

  useEffect(() => {
    if (showIncomingModal && !isVideoModalOpen && !isVoiceModalOpen && isFocused) {
      startRinging(true);
    } else {
      stopRinging();
    }
    return () => stopRinging();
  }, [showIncomingModal, isVideoModalOpen, isVoiceModalOpen, isFocused]);

  useEffect(() => {
    if (!isSocketConnected && selectedUser && counselorId) {
      const interval = setInterval(() => {
        // Skip if we just deleted a message — let the server confirm first.
        if (!deletedRecentlyRef.current) fetchMessagesFromAPI();
      }, 45000);
      return () => clearInterval(interval);
    }
  }, [isSocketConnected, selectedUser, counselorId]);

  useEffect(() => {
    if (callError) setTimeout(() => setCallError(null), 5000);
  }, [callError]);

  // ─── Scroll handling ─────────────────────────────────────────────────────
  const messagesForList = useMemo(() => {
    const merged = getMergedTimeline();
    // inject day-separator sentinels
    const withDays = [];
    let lastDay = null;
    merged.forEach((item) => {
      const day = getItemDayKey(item);
      if (day && day !== lastDay) {
        withDays.push({ id: `day_${day}`, isDaySeparator: true, label: formatItemDay(item) });
        lastDay = day;
      }
      withDays.push(item);
    });
    return [...withDays].reverse();
  }, [getMergedTimeline]);
  const scrollToBottom = useCallback((animated = true) => {
    messagesContainerRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);
  const preserveComposerFocusForSend = useCallback(() => {
    sendFocusGuardRef.current = true;
    focusRestoreTimersRef.current.forEach(clearTimeout);
    focusRestoreTimersRef.current = [0, 60, 160, 320].map((delay) =>
      setTimeout(() => {
        if (sendFocusGuardRef.current) messageInputRef.current?.focus();
      }, delay),
    );
  }, []);
  const finishComposerFocusForSend = useCallback(() => {
    focusRestoreTimersRef.current.forEach(clearTimeout);
    focusRestoreTimersRef.current = [0, 80, 180].map((delay) =>
      setTimeout(() => {
        if (sendFocusGuardRef.current) messageInputRef.current?.focus();
      }, delay),
    );
    focusRestoreTimersRef.current.push(
      setTimeout(() => {
        sendFocusGuardRef.current = false;
      }, 260),
    );
  }, []);
  useEffect(() => () => {
    focusRestoreTimersRef.current.forEach(clearTimeout);
    focusRestoreTimersRef.current = [];
  }, []);
  const handleContentSizeChange = useCallback(() => {
    if (shouldAutoScrollRef.current) scrollToBottom(initialLoadDoneRef.current);
    initialLoadDoneRef.current = true;
  }, [scrollToBottom]);
  const handleScroll = useCallback((e) => {
    const { contentOffset } = e.nativeEvent;
    shouldAutoScrollRef.current = contentOffset.y <= 120;
  }, []);

  useEffect(() => {
    // iOS fires keyboardWillShow (pre-animation); Android ONLY fires
    // keyboardDidShow. KeyboardAvoidingView does the lifting — these listeners
    // just keep the newest message visible (WhatsApp-style). Same as user side.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      keyboardVisibleRef.current = true;
      if (shouldAutoScrollRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
        setTimeout(() => scrollToBottom(true), 120);
      }
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      keyboardVisibleRef.current = false;
      if (sendFocusGuardRef.current) {
        requestAnimationFrame(() => messageInputRef.current?.focus());
        return;
      }
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [scrollToBottom]);

  // ─── Render functions ────────────────────────────────────────────────────
  const renderMessageStatus = (msg) => {
    if (msg.sender !== "me") return null;
    switch (msg.status) {
      case "sending": return <Text style={styles.messageStatusSending}>⌛</Text>;
      case "sent": return (
        <View style={styles.messageStatusIconWrap}>
          <Ionicons
            name={msg.isRead ? "checkmark-done" : "checkmark"}
            size={15}
            color={msg.isRead ? "#1687D9" : "#64748B"}
          />
        </View>
      );
      case "error": return <Text style={styles.messageStatusError}>⚠️ Failed</Text>;
      default: return null;
    }
  };

  // WhatsApp-style call entry shown inline in the chat thread.
  const renderCallItem = (item) => {
    const { isOutgoing, isAlert, statusLabel, durationText } = describeCall(item);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => confirmDeleteCall(item)}
        style={[styles.callRow, isOutgoing ? styles.msgRowRight : styles.msgRowLeft]}
      >
        <View style={[styles.callBubble, isOutgoing ? styles.callBubbleOut : styles.callBubbleIn]}>
          <View style={[styles.callIconCircle, isAlert && styles.callIconCircleAlert]}>
            <Ionicons
              name={item.type === "video" ? "videocam" : "call"}
              size={18}
              color={isAlert ? "#ef4444" : "#1D4ED8"}
            />
          </View>
          <View style={styles.callTextWrap}>
            <Text style={styles.callTitle}>
              {isOutgoing ? "Outgoing" : "Incoming"} {item.type === "video" ? "video" : "voice"} call
            </Text>
            <View style={styles.callMetaRow}>
              <Ionicons
                name={isAlert ? "close-circle" : isOutgoing ? "arrow-up-outline" : "arrow-down-outline"}
                size={12}
                color={isAlert ? "#ef4444" : "#64748b"}
              />
              <Text style={[styles.callMeta, isAlert && styles.callMetaAlert]}>
                {statusLabel}{durationText ? ` · ${durationText}` : ""}
              </Text>
            </View>
          </View>
          <Text style={styles.callTime}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }) => {
    if (item.isDaySeparator) {
      return (
        <View style={styles.daySeparatorRow}>
          <Text style={styles.daySeparatorLabel}>{t(item.label)}</Text>
        </View>
      );
    }

    if (item.isCall) {
      return renderCallItem(item);
    }

    const isMe = item.sender === "me";
    const messageId = getMessageIdentifier(item);
    const isDeleting = String(deletingMessageId) === String(messageId);
    const canDelete = !!messageId && !item.isTemporary && item.status !== "sending" && item.status !== "error";

    const url = getAttachmentUrl(item);
    const hasAttachment = !!(item.attachmentName || item.attachmentUrl);
    const isImage = hasAttachment && isImageAttachment(item) && url;

    // Human-readable file meta: "2.4 MB • PDF"
    const fileName = item.attachmentName || 'Attachment';
    const ext = (fileName.split('.').pop() || '').toUpperCase();
    const sizeBytes = Number(item.attachmentSize || item.fileSize || 0);
    const sizeLabel =
      sizeBytes > 0
        ? sizeBytes >= 1024 * 1024
          ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
        : '';
    const fileMeta = [sizeLabel, ext].filter(Boolean).join(' • ');

    // For image messages the server stores the file name as the text content.
    // Never show that as a caption — only show a real, user-typed caption.
    const looksLikeFilename = (txt) => {
      const s = String(txt || '').trim();
      if (!s) return false;
      return s === (item.attachmentName || '') ||
        /\.(jpe?g|png|gif|webp|heic|heif|pdf|docx?|xlsx?|pptx?|zip|mp4|mov|mp3)(\?|$)/i.test(s);
    };
    const showCaption = !!item.text && !looksLikeFilename(item.text);
    const isImageOnly = isImage && !showCaption;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {/* Plain text / image bubble — sent = earnings gradient, received = white */}
        {(showCaption || isImage) && (() => {
          // Image-only: NO bubble background — just the rounded photo itself
          // (professional, WhatsApp-style). Tap to open, long-press to delete.
          if (isImageOnly) {
            return (
              <Pressable
                onPress={() => openAttachment(url)}
                onLongPress={() => canDelete && handleDeleteMessage(item)}
                style={styles.imageOnlyWrap}
              >
                <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
              </Pressable>
            );
          }
          const inner = (
            <>
              {showCaption && (
                <TranslatedMessageBubble
                  text={item.text}
                  style={[styles.messageText, isMe ? styles.userMessageText : styles.counselorMessageText]}
                />
              )}
              {isImage && (
                <TouchableOpacity onPress={() => openAttachment(url)} activeOpacity={0.9}>
                  <Image
                    source={{ uri: url }}
                    style={[styles.attachmentImage, showCaption && styles.attachmentImageCaption]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            </>
          );
          return isMe ? (
            <Pressable onLongPress={() => canDelete && handleDeleteMessage(item)} style={styles.bubbleMeWrap}>
              <LinearGradient colors={SENT_GRADIENT} start={SENT_GRADIENT_START} end={SENT_GRADIENT_END} style={[styles.bubble, styles.bubbleMe]}>
                {inner}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable style={[styles.bubble, styles.bubbleThem]} onLongPress={() => canDelete && handleDeleteMessage(item)}>
              {inner}
            </Pressable>
          );
        })()}

        {/* File card (non-image attachment) — sent = earnings gradient, received = white */}
        {hasAttachment && !isImage && (() => {
          const inner = (
            <>
              <View style={[styles.fileIconBox, isMe && styles.fileIconBoxMe]}>
                <Ionicons name="document-text" size={20} color={isMe ? '#FFFFFF' : '#2563EB'} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={1}>
                  {fileName}
                </Text>
                {!!fileMeta && (
                  <Text style={[styles.fileMeta, isMe && styles.fileMetaMe]} numberOfLines={1}>
                    {fileMeta}
                  </Text>
                )}
              </View>
              <Ionicons name="download-outline" size={20} color={isMe ? '#FFFFFF' : '#2563EB'} />
            </>
          );
          return isMe ? (
            <Pressable style={styles.bubbleMeWrap} onPress={() => openAttachment(url)} onLongPress={() => canDelete && handleDeleteMessage(item)}>
              <LinearGradient colors={SENT_GRADIENT} start={SENT_GRADIENT_START} end={SENT_GRADIENT_END} style={[styles.fileCard, styles.fileCardMe]}>
                {inner}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable style={[styles.fileCard, styles.fileCardThem]} onPress={() => openAttachment(url)} onLongPress={() => canDelete && handleDeleteMessage(item)}>
              {inner}
            </Pressable>
          );
        })()}

        {/* Timestamp + read receipt OUTSIDE the bubble */}
        <View style={[styles.msgMeta, isMe ? styles.msgMetaRight : styles.msgMetaLeft]}>
          <Text style={styles.msgTime}>{item.time}</Text>
          {isMe && renderMessageStatus(item)}
        </View>
      </View>
    );
  };

  const handleBack = () => navigation.goBack();
  const handleCloseModal = () => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setCallError(null);
    // A call just ended — refresh so the new call entry appears in the thread.
    loadCallHistory();
  };

  if (!selectedUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>{t('No user selected')}</Text>
            <Text style={styles.emptyText}>{t('Please select a user from the list to start messaging')}</Text>
            <CounselorGradientButton style={styles.backToListBtn} onPress={handleBack}>
              <Text style={styles.backToListBtnText}>← Back to SMS List</Text>
            </CounselorGradientButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        contentContainerStyle={styles.keyboardAvoidContent}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={0}
      >
          <View style={styles.chatBoxMain}>
          {/* Header — white bg, blue icons (matches Figma). Long-press the name for Refresh/Clear. */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-back" size={24} color="#2563EB" />
              </TouchableOpacity>
              <Pressable style={styles.userInfo} onLongPress={() => setShowOptions(true)}>
                <View style={styles.userAvatarWrapper}>
                  <ChatAvatar
                    avatarUrl={userDetails.avatarUrl}
                    avatar={userDetails.avatar}
                    name={USER_NAME}
                    size={40}
                    style={{ borderWidth: 2, borderColor: '#FFFFFF' }}
                  />
                  <View style={[styles.activeDot, { backgroundColor: resolveOnlineStatus(selectedUser) ? "#22C55E" : "#9CA3AF" }]} />
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName} numberOfLines={1}>{USER_NAME}</Text>
                  <Text style={styles.profileStatus}>
                    {remoteIsTyping ? (
                      <Text style={styles.typingText}>{t('Typing...')}</Text>
                    ) : (
                      <Text style={[
                        styles.statusText,
                        resolveOnlineStatus(selectedUser) && styles.statusTextOnline,
                      ]}>
                        {resolveOnlineStatus(selectedUser) ? "Online" : "Offline"}
                      </Text>
                    )}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View style={styles.callButtons}>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.actionBtnDisabled]} onPress={initiateVideoCall} disabled={isInitiatingCall}>
                <Ionicons name="videocam-outline" size={24} color="#004AC6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.actionBtnDisabled]} onPress={initiateVoiceCall} disabled={isInitiatingCall}>
                <Ionicons name="call-outline" size={22} color="#004AC6" />
              </TouchableOpacity>
            </View>
          </View>

          {callError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
              <Text style={styles.errorText}>{callError}</Text>
              <TouchableOpacity onPress={() => setCallError(null)}><Ionicons name="close" size={20} color="#ba1a1a" /></TouchableOpacity>
            </View>
          )}

          {/* Options Modal */}
          <Modal transparent visible={showOptions} animationType="fade" onRequestClose={() => setShowOptions(false)}>
            <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
              <View style={styles.optionsMenu}>
                <TouchableOpacity style={styles.optionItem} onPress={() => { fetchMessagesFromAPI(); setShowOptions(false); }}>
                  <Ionicons name="refresh" size={18} color="#526071" />
                  <Text style={styles.optionText}>{t('Refresh Messages')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionItem, styles.optionItemLast]} onPress={() => { setShowOptions(false); clearChat(); }}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text style={[styles.optionText, styles.optionTextDanger]}>{t('Clear Chat')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Messages */}
          {!timelineReady ? (
            <ChatSkeleton role="counselor" />
          ) : error && messages.length === 0 ? (
            <View style={styles.errorMessage}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchMessagesFromAPI}><Text style={styles.retryBtn}>{t('Retry')}</Text></TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={messagesContainerRef}
              style={styles.messagesArea}
              data={messagesForList}
              keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              inverted
              ListHeaderComponent={remoteIsTyping ? (
                <View style={styles.typingContainer}>
                  <View style={styles.typingDots}><View style={styles.typingDot} /><View style={[styles.typingDot, styles.typingDotDelay1]} /><View style={[styles.typingDot, styles.typingDotDelay2]} /></View>
                  <Text style={styles.typingLabel}>{USER_NAME} is typing...</Text>
                </View>
              ) : null}
              ListEmptyComponent={
                <View style={styles.emptyMessages}>
                  <Text style={styles.emptyMessagesIcon}>💬</Text>
                  <Text style={styles.emptyMessagesText}>{t('No messages yet')}</Text>
                  <Text style={styles.emptyMessagesSubtext}>{t('Start a conversation by sending a message')}</Text>
                </View>
              }
            />
          )}

          {/* Input */}
          <View style={[
            styles.inputArea,
            {
              // Permanently paint and pad through the bottom system inset so
              // closing the keyboard cannot reveal an empty strip below the
              // composer. Constant geometry also prevents a delayed jump.
              // The enclosing SafeAreaView supplies the navigation-bar inset.
              // A fixed inner padding avoids the late keyboard-event jump.
              paddingBottom: 8,
            },
          ]}>
            <View style={styles.inputAreaInner}>
              {pendingAttachment && (
                <View style={styles.attachmentPreview}>
                  <Ionicons name="attach" size={16} color="#2563EB" />
                  <Text style={styles.attachmentPreviewText} numberOfLines={1}>{t(pendingAttachment.name)}</Text>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity>
                </View>
              )}
              <View style={styles.inputGroup}>
                <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment} disabled={isSending}>
                  <Ionicons name="add" size={22} color="#2563EB" />
                </TouchableOpacity>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={messageInputRef}
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#8492a5"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    blurOnSubmit={false}
                    showSoftInputOnFocus
                    onBlur={() => {
                      if (sendFocusGuardRef.current) {
                        requestAnimationFrame(() => messageInputRef.current?.focus());
                      }
                    }}
                  />
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPressIn={() => {
                    if ((message.trim() || pendingAttachment) && !isSending) {
                      preserveComposerFocusForSend();
                    } else {
                      messageInputRef.current?.focus();
                    }
                  }}
                  onPress={handleSendMessage}
                >
                  <LinearGradient
                    colors={(message.trim() || pendingAttachment) && !isSending ? SENT_GRADIENT : ['#A8B9D6', '#A8B9D6']}
                    start={SENT_GRADIENT_START}
                    end={SENT_GRADIENT_END}
                    style={[styles.sendBtn, (message.trim() || pendingAttachment) && !isSending ? styles.sendBtnActive : styles.sendBtnDisabled]}
                  >
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <VideoCallModal isOpen={isVideoModalOpen} onClose={handleCloseModal} callData={selectedCall} currentUser={{ id: counselorId, role: "counsellor" }} onEndCall={handleEndIncomingCall} />
        <VoiceCallModal isOpen={isVoiceModalOpen} onClose={handleCloseModal} callData={selectedCall} currentUser={{ id: counselorId, role: "counsellor" }} onEndCall={handleEndIncomingCall} />
        <IncomingCallModal isOpen={isFocused && showIncomingModal} onClose={() => setShowIncomingModal(false)} callType={incomingCallData.callType} callerName={incomingCallData.name} callerAvatar={incomingCallData.avatar} callData={incomingCallData} onJoinCall={handleJoinIncomingCall} onRejectCall={handleRejectIncomingCall} />
        <ZoomableImageViewer
          visible={imagePreviewVisible}
          uri={imagePreviewUrl}
          onClose={() => setImagePreviewVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
  keyboardAvoidContent: { flex: 1 },
  chatBoxMain: { flex: 1, backgroundColor: '#EFF6FF' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF', borderRadius: 20, margin: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  emptyIcon: { fontSize: 56, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  backToListBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, shadowColor: '#004AC6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  backToListBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, minWidth: 0 },
  userAvatarWrapper: { position: 'relative', width: 40, height: 40 },
  activeDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5, borderColor: '#FFFFFF' },
  userDetails: { flex: 1, minWidth: 0 },
  userName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 1 },
  profileStatus: { fontSize: 11 },
  statusText: { color: '#6B7280', fontWeight: '600' },
  statusTextOnline: { color: '#22C55E' },
  typingText: { color: '#BFDBFE', fontWeight: '600' },
  callButtons: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  actionBtnDisabled: { opacity: 0.4 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 12, gap: 8 },
  errorIcon: { fontSize: 16, marginRight: 6 },
  errorText: { flex: 1, color: '#DC2626', fontSize: 12, fontWeight: '500' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#F1F5F9' },
  loadingText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  messagesArea: { flex: 1, width: '100%', backgroundColor: '#F1F5F9' },
  messagesList: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 16, gap: 6, flexGrow: 1 },
  daySeparatorRow: { alignItems: 'center', marginVertical: 14 },
  daySeparatorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#E8EDF5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },

  /* ── Figma chat bubbles ── */
  msgRow: { width: '100%', marginBottom: 14 },
  msgRowLeft: { alignItems: 'flex-start' },
  msgRowRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: screenWidth >= 600 ? 500 : '82%',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleMeWrap: { maxWidth: screenWidth >= 600 ? 500 : '82%' },
  bubbleMe: {
    borderBottomRightRadius: 6,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  msgMetaLeft: { alignSelf: 'flex-start', marginLeft: 4 },
  msgMetaRight: { alignSelf: 'flex-end', marginRight: 4 },
  msgTime: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500' },

  /* ── File attachment card ── */
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: screenWidth >= 600 ? 500 : '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  fileCardThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fileCardMe: { borderBottomRightRadius: 6 },
  fileIconBox: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: '#E8EFFB', alignItems: 'center', justifyContent: 'center',
  },
  fileIconBoxMe: { backgroundColor: 'rgba(255,255,255,0.22)' },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  fileNameMe: { color: '#FFFFFF' },
  fileMeta: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
  fileMetaMe: { color: 'rgba(255,255,255,0.8)' },
  callBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginVertical: 3, maxWidth: '85%', borderWidth: 1 },
  callBubbleRight: { alignSelf: 'flex-end', backgroundColor: '#e8eaff', borderColor: '#c7d2fe' },
  callBubbleLeft: { alignSelf: 'flex-start', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  callBubbleText: { flex: 1, fontSize: 13, color: '#334155' },
  callBubbleMeta: { fontSize: 11, color: '#64748b', marginLeft: 6 },
  errorMessage: { alignItems: 'center', paddingTop: 80, backgroundColor: '#F8FAFC' },
  retryBtn: { marginTop: 16, color: '#2563EB', fontWeight: '600', fontSize: 14 },
  emptyMessages: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyMessagesIcon: { fontSize: 48, marginBottom: 16, opacity: 0.4 },
  emptyMessagesText: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  emptyMessagesSubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  typingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4, marginLeft: 38, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderRadius: 18, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB', opacity: 0.6 },
  typingDotDelay1: { opacity: 0.4 },
  typingDotDelay2: { opacity: 0.2 },
  typingLabel: { fontSize: 11, color: '#6B7280', fontStyle: 'italic' },
  messageBubble: { width: '100%', marginBottom: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRight: { justifyContent: 'flex-end' },
  messageLeft: { justifyContent: 'flex-start' },
  // ─── Call entry bubble (WhatsApp-style) ───────────────────────────────────
  callRow: { width: '100%', marginBottom: 6 },
  callBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: screenWidth >= 600 ? 500 : '80%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  callBubbleOut: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE', borderBottomRightRadius: 4 },
  callBubbleIn: { borderBottomLeftRadius: 4 },
  callIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E7EDFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIconCircleAlert: { backgroundColor: '#FEE2E2' },
  callTextWrap: { flexShrink: 1 },
  callTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  callMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  callMeta: { fontSize: 12, color: '#64748B' },
  callMetaAlert: { color: '#EF4444', fontWeight: '600' },
  callTime: { fontSize: 11, color: '#94A3B8', alignSelf: 'flex-end' },
  callDeleteBtn: { alignSelf: 'flex-start', padding: 2 },
  messageContent: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-end', justifyContent: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: screenWidth >= 600 ? 500 : '80%' },
  userMessageContent: { backgroundColor: '#1D4ED8', borderBottomRightRadius: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  counselorMessageContent: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  messageText: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  userMessageText: { color: '#FFFFFF' },
  counselorMessageText: { color: '#1E293B' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8, paddingBottom: 1 },
  messageTime: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  messageTimeMine: { color: 'rgba(255,255,255,0.55)' },
  messageStatusSending: { fontSize: 11, color: '#F59E0B', fontWeight: '500' },
  messageStatusIconWrap: { width: 16, alignItems: 'center', justifyContent: 'center' },
  messageStatusError: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
  deleteIconBtn: { paddingHorizontal: 4, paddingVertical: 2, marginLeft: 4 },
  attachmentImage: {
    width: screenWidth >= 600 ? 300 : 236,
    height: screenWidth >= 600 ? 224 : 176,
    borderRadius: 11,
    backgroundColor: '#EEF1F5',
  },
  // Extra gap only when a real caption sits above the image.
  attachmentImageCaption: { marginTop: 8 },
  // Image-only: white card FRAME around the photo (matches the user-side chat).
  imageOnlyWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  attachmentBubble: { marginTop: 8, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  userAttachmentBubble: { backgroundColor: 'rgba(255,255,255,0.15)' },
  counselorAttachmentBubble: { backgroundColor: '#F3F4F6' },
  attachmentBubbleText: { fontSize: 12, fontWeight: '600', flex: 1 },
  userAttachmentBubbleText: { color: '#FFFFFF' },
  counselorAttachmentBubbleText: { color: '#374151' },
  inputArea: { width: '100%', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 8 },
  inputAreaInner: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  attachmentPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 8 },
  attachmentPreviewText: { flex: 1, color: '#111827', fontSize: 12, fontWeight: '500' },
  inputGroupDisabled: { opacity: 0.7 },
  inputGroup: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8EFFB' },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  textInput: { flex: 1, fontSize: 14, lineHeight: 20, color: '#111827', paddingVertical: Platform.OS === 'ios' ? 6 : 4, paddingHorizontal: 8, maxHeight: 120, minHeight: 36, textAlignVertical: 'center' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnActive: { shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 5, elevation: 5 },
  sendBtnDisabled: { backgroundColor: '#CBD5E1', opacity: 0.7 },
  incomingCallOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center' },
  incomingCallModal: { maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  videoCallModal: { borderTopWidth: 3, borderTopColor: '#003A9B' },
  voiceCallModal: { borderTopWidth: 3, borderTopColor: '#003A9B' },
  incomingCallContent: { padding: 24, alignItems: 'center' },
  incomingCallerInfo: { alignItems: 'center', marginBottom: 24 },
  incomingCallerAvatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  avatarInitialLarge: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  incomingCallerName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  incomingCallType: { fontSize: 13, color: '#6B7280', marginBottom: 8, fontWeight: '500' },
  incomingCallMessage: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  incomingCallControls: { flexDirection: 'row', gap: 12, width: '100%' },
  incomingCallBtn: { flex: 1, paddingVertical: 12, borderRadius: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  acceptBtn: { overflow: 'hidden' },
  rejectBtn: { backgroundColor: '#DC2626' },
  incomingCallBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  // Options Menu Styles
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 16,
  },
  optionsMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    minWidth: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f6',
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
  },
  optionTextDanger: {
    color: '#dc2626',
  },
  // Image Preview Modal Styles
});

export default SMSInput;
