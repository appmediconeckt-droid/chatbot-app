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
  InteractionManager,
  Image,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../../../../../../services/socketService';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
import { pick } from '@react-native-documents/picker';
import VideoCallModal from '../../../UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../UserDashboard/Tab/CallModal/VoiceCallModal';
import useRingtone from '../../../../../../hooks/useRingtone';
import { useIsFocused } from '@react-navigation/native';
import useScreenshotPrevent from '../../../../../../utils/useScreenshotPrevent';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#DC2626', '#F59E0B',
  '#10B981', '#0369A1', '#06B6D4', '#1E40AF',
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getAvatarEmoji = (gender) => {
  if (gender === 'male') return '👨';
  if (gender === 'female') return '👩';
  return '👤';
};

// Resolves a profilePhoto value (string, Cloudinary object, or user object) to an absolute URL or null
const resolvePhotoUrl = (photo) => {
  if (!photo) return null;
  // If it's a user/otherParty object, try all possible photo field names
  if (typeof photo === 'object' && !photo.secure_url && !photo.url && !photo.public_id) {
    const candidate =
      photo.profilePhoto ||
      photo.avatarUrl ||
      photo.avatar ||
      photo.profilePic ||
      photo.image ||
      photo.picture ||
      null;
    if (!candidate) return null;
    return resolvePhotoUrl(candidate);
  }
  const raw = (typeof photo === 'object')
    ? (photo.secure_url || photo.url || null)
    : photo;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.includes('ui-avatars.com') || raw.includes('dicebear') || raw.includes('gravatar.com')) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return null;
};

// Returns true only for real user-uploaded photos — filters out generated avatars
const isRealPhoto = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('ui-avatars.com')) return false;
  if (url.includes('dicebear')) return false;
  if (url.includes('gravatar.com')) return false;
  return true;
};

// Incoming Call Modal Component - Serenity Design
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
  const { t } = useTranslation();
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
        const result = await onJoinCall(callData.callId);
        if (result && result.success) {
          // already closed
        }
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
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.incomingCallOverlay}>
        <View style={[
          styles.incomingCallModal,
          callType === "video" ? styles.videoCallModal : styles.voiceCallModal,
          { width: Math.min(winWidth * 0.88, 380) },
        ]}>
          <View style={styles.incomingCallContent}>
            <View style={styles.incomingCallerInfo}>
              <View style={[styles.incomingCallerAvatar, { backgroundColor: getAvatarColor(displayName) }]}>
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
              <TouchableOpacity
                style={[styles.incomingCallBtn, styles.rejectBtn]}
                onPress={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.incomingCallBtnText}>{t('call:reject')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.incomingCallBtn, styles.acceptBtn]}
                onPress={handleJoin}
                disabled={isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.incomingCallBtnText}>{t('call:accept')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SMSInput = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  useScreenshotPrevent();
  const location = route.params || {};
  const [message, setMessage] = useState("");
  const messagesContainerRef = useRef(null);
  const chatSocketRef = useRef(null);
  const fallbackChatIdRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);

  // Call modal states
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [callError, setCallError] = useState(null);

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

  useEffect(() => {
    if (!isFocused) {
      stopRinging();
      return;
    }
    if (showIncomingModal) startRinging(true);
    else stopRinging();
  }, [isFocused, showIncomingModal, startRinging, stopRinging]);

  // If caller ends/cancels while modal is open, stop ringtone and close modal.
  useEffect(() => {
    if (!isFocused || !showIncomingModal || !incomingCallData?.callId || !counselorId) return;

    let cancelled = false;

    const checkStillPending = async () => {
      try {
        const token = await getAuthToken();
        if (cancelled || !token) return;

        const response = await axios.get(`${API_BASE_URL}/api/video/calls/pending/${counselorId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const pending = response.data?.pendingRequests || [];
        const stillThere = pending.some((c) => c?.callId === incomingCallData.callId);

        if (!stillThere && !cancelled) {
          setShowIncomingModal(false);
          setIncomingCallData({
            name: "",
            avatar: "👤",
            callId: "",
            roomId: "",
            callType: "video",
          });
          stopRinging();
        }
      } catch (_) {
        // ignore transient polling errors
      }
    };

    checkStillPending();
    const intervalId = setInterval(checkStillPending, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isFocused, showIncomingModal, incomingCallData?.callId, counselorId, stopRinging]);

  // Message states
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [chatStatus, setChatStatus] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  
  // Counselor data states
  const [currentCounselor, setCurrentCounselor] = useState(null);
  const [counselorId, setCounselorId] = useState(null);

  // Get selected user from navigation state
  const [selectedUser, setSelectedUser] = useState(location?.selectedUser || null);
  const chatId = location?.chatId;

  const getAuthToken = async () => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) return accessToken;
    return AsyncStorage.getItem("token");
  };

  const loadCounselorData = async () => {
    try {
      let counselorData = null;
      const storedCounselor =
        (await AsyncStorage.getItem("counselor")) ||
        (await AsyncStorage.getItem("counsellor")) ||
        (await AsyncStorage.getItem("userData"));

      if (storedCounselor) {
        try {
          counselorData = JSON.parse(storedCounselor);
          setCurrentCounselor(counselorData);
        } catch (e) {
          console.error("Error parsing counselor:", e);
        }
      }
      
      let counselorIdValue = null;
      if (counselorData) {
        if (counselorData._id) counselorIdValue = counselorData._id;
        if (counselorData.id) counselorIdValue = counselorData.id;
      }
      if (!counselorIdValue) {
        const storedId =
          (await AsyncStorage.getItem("counsellorId")) ||
          (await AsyncStorage.getItem("counselorId"));
        if (storedId) counselorIdValue = storedId;
      }
      setCounselorId(counselorIdValue);
      return counselorIdValue;
    } catch (error) {
      console.error("Error loading counselor data:", error);
      return null;
    }
  };

  const normalizeObjectId = (value) => {
    if (!value) return null;

    if (typeof value === "object") {
      return (
        normalizeObjectId(value._id) ||
        normalizeObjectId(value.id) ||
        normalizeObjectId(value.userId) ||
        normalizeObjectId(value.$oid) ||
        null
      );
    }

    const asString = String(value).trim();
    if (!asString) return null;

    if (/^[a-f\d]{24}$/i.test(asString)) return asString;

    const embeddedMatch = asString.match(/[a-f\d]{24}/i);
    return embeddedMatch ? embeddedMatch[0] : null;
  };

  const getParticipantIdFromChatId = () => {
    const sourceChatId =
      chatId ||
      location?.chatData?.chatId ||
      location?.chatData?.id ||
      selectedUser?.chatId ||
      "";

    const chatIdText = String(sourceChatId || "");
    if (!chatIdText) return null;

    const matchedIds = chatIdText.match(/[a-f\d]{24}/gi) || [];
    if (!matchedIds.length) return null;

    const normalizedCounselorId = normalizeObjectId(counselorId);
    const receiverId = matchedIds.find(
      (id) => !normalizedCounselorId || String(id).toLowerCase() !== String(normalizedCounselorId).toLowerCase()
    );

    return receiverId || null;
  };

  const getSelectedUserId = () => {
    return (
      selectedUser?.receiverId ||
      selectedUser?._id ||
      selectedUser?.id ||
      selectedUser?.userId ||
      selectedUser?.user?._id ||
      selectedUser?.user?.id ||
      selectedUser?.patient?._id ||
      selectedUser?.patient?.id ||
      location?.userId ||
      location?.chatData?.receiverId ||
      location?.chatData?.otherParty?._id ||
      location?.chatData?.otherParty?.id ||
      location?.chatData?.otherParty?.userId ||
      getParticipantIdFromChatId() ||
      null
    );
  };

  const getUserDetails = () => {
    const id = getSelectedUserId();
    // Get photo from selectedUser with proper resolution
    const profilePhotoUrl = resolvePhotoUrl(selectedUser);
    
    return {
      id,
      name: selectedUser?.anonymous || selectedUser?.anonName || selectedUser?.name || selectedUser?.fullName || "User",
      gender: selectedUser?.gender,
      phone: selectedUser?.phone || selectedUser?.phoneNumber,
      email: selectedUser?.email,
      profilePhoto: profilePhotoUrl,
    };
  };

  const userDetails = getUserDetails();

  const resolveOnlineStatus = (person) => {
    const explicitOnline = person?.isOnline ?? person?.online;
    if (typeof explicitOnline === 'boolean') return explicitOnline;
    if (typeof explicitOnline === 'string') return ['online','true','1','yes'].includes(String(explicitOnline).toLowerCase());
    return false;
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
    return (
      contentType.startsWith('image/') ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)(\?|$)/i.test(url) ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(name) ||
      /screenshot|photo|image/i.test(name)
    );
  };

  const openAttachment = useCallback(async (uri) => {
    if (!uri) return;
    try {
      if (Platform.OS === 'android') {
        const fileName = uri.split('/').pop().split('?')[0] || `attachment_${Date.now()}.pdf`;
        const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        const fileExists = await RNFS.exists(destPath);
        if (!fileExists) {
          const result = await RNFS.downloadFile({ fromUrl: uri, toFile: destPath }).promise;
          if (result.statusCode !== 200) throw new Error('Download failed');
        }
        const intentUrl = `intent://${destPath.replace('file://', '')}#Intent;action=android.intent.action.VIEW;type=application/pdf;scheme=file;end`;
        const canOpen = await Linking.canOpenURL(intentUrl);
        if (canOpen) {
          await Linking.openURL(intentUrl);
        } else {
          await Linking.openURL(uri);
        }
      } else {
        await Linking.openURL(uri);
      }
    } catch (error) {
      console.error('Error opening attachment:', error);
      try { await Linking.openURL(uri); } catch (_) {
        Alert.alert('Cannot Open File', 'No app found to open this file. Please install a PDF viewer app.', [{ text: 'OK' }]);
      }
    }
  }, []);

  const handlePickAttachment = useCallback(async () => {
    if (isSending) return;

    try {
      const [picked] = await pick();
      if (!picked?.uri) {
        Alert.alert('Attachment', 'Unable to read selected file.');
        return;
      }

      setPendingAttachment({
        uri: picked.uri,
        name: picked.name || `file_${Date.now()}`,
        type: picked.type || picked.mimeType || 'application/octet-stream',
        size: picked.size || picked.fileSize || 0,
      });
    } catch (error) {
      if (error?.code === 'OPERATION_CANCELED') return;
      console.error('Attachment pick error:', error);
      Alert.alert('Attachment', 'Failed to pick file. Please try again.');
    }
  }, [isSending]);
  
  const USER_ID = userDetails.id;
  const USER_NAME = userDetails.name;

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Chat UX: use an inverted list so latest messages are visible immediately.
  const messagesForList = useMemo(() => {
    if (!messages?.length) return [];
    return [...messages].reverse();
  }, [messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (!messagesContainerRef.current) return;
    try {
      messagesContainerRef.current.scrollToOffset({ offset: 0, animated });
    } catch (_) {}
  }, []);

  // Keep newest message visible whenever the keyboard appears (WhatsApp-style).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvt, () => {
      scrollToBottom(true);
    });
    return () => sub.remove();
  }, [scrollToBottom]);

  const handleMessagesScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromNewest = contentOffset.y;
    shouldAutoScrollRef.current = distanceFromNewest <= 120;
  }, []);

  const handleMessagesContentSizeChange = useCallback(() => {
    if (!messages.length) return;
    if (shouldAutoScrollRef.current) {
      scrollToBottom(initialLoadDoneRef.current);
      initialLoadDoneRef.current = true;
    }
  }, [messages.length, scrollToBottom]);

  const getChatIdForAPI = () => {
    if (chatId) return chatId;
    if (selectedUser && USER_ID && counselorId) {
      return `chat_${USER_ID}_${counselorId}`;
    }

    if (!fallbackChatIdRef.current) {
      const stableUserId = USER_ID || selectedUser?.receiverId || selectedUser?.id || "user";
      const stableCounselorId = counselorId || "counsellor";
      fallbackChatIdRef.current = `chat_${stableUserId}_${stableCounselorId}`;
    }

    return fallbackChatIdRef.current;
  };

  const fetchMessagesFromAPI = async () => {
    if (!selectedUser || !counselorId) return;
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      setIsLoadingMessages(true);
      setError(null);

      const response = await axios.get(
        `${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );

      if (response.data && response.data.messages) {
        if (response.data.chatStatus) {
          setChatStatus(response.data.chatStatus);
        }
        const transformedMessages = response.data.messages.map((msg, index) => ({
          id: msg.id || msg._id || msg.messageId || `fetched_${index}`,
          messageId: msg.messageId,
          text: msg.content,
          sender: msg.senderRole === "counsellor" ? "me" : "user",
          senderRole: msg.senderRole,
          time: new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
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
        setMessages(transformedMessages);
        saveMessagesToLocalStorage(transformedMessages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      loadMessagesFromLocalStorage();
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const saveMessagesToLocalStorage = async (messagesToSave) => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("smsChats") || "[]");
      const chatIdToSave = getChatIdForAPI();
      const existingChatIndex = savedChats.findIndex(chat => chat.chatId === chatIdToSave);
      const chatData = {
        chatId: chatIdToSave,
        userId: USER_ID,
        userName: USER_NAME,
        messages: messagesToSave,
        chatStatus: chatStatus,
        lastUpdated: new Date().toISOString(),
      };
      if (existingChatIndex >= 0) {
        savedChats[existingChatIndex] = chatData;
      } else {
        savedChats.push(chatData);
      }
      await AsyncStorage.setItem("smsChats", JSON.stringify(savedChats));
    } catch (error) {
      console.error("Error saving messages:", error);
    }
  };

  const loadMessagesFromLocalStorage = async () => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("smsChats") || "[]");
      const chatIdToLoad = getChatIdForAPI();
      const savedChat = savedChats.find(chat => chat.chatId === chatIdToLoad);
      if (savedChat && savedChat.messages) {
        shouldAutoScrollRef.current = true;
        setMessages(savedChat.messages);
        if (savedChat.chatStatus) setChatStatus(savedChat.chatStatus);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessageToAPI = async ({ messageContent = "", file = null }) => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      let response;
      const inferMimeType = (name = "") => {
        const lowerName = String(name).toLowerCase();
        if (lowerName.endsWith(".png")) return "image/png";
        if (lowerName.endsWith(".webp")) return "image/webp";
        if (lowerName.endsWith(".gif")) return "image/gif";
        if (lowerName.endsWith(".heic")) return "image/heic";
        if (lowerName.endsWith(".heif")) return "image/heif";
        return "image/jpeg";
      };

      if (file) {
        const formData = new FormData();
        const attachmentName = file.name || file.fileName || `attachment_${Date.now()}.jpg`;
        const attachmentType = file.type && file.type !== "application/octet-stream"
          ? file.type
          : inferMimeType(attachmentName);

        if (messageContent.trim()) formData.append("content", messageContent.trim());
        formData.append("attachment", {
          uri: file.uri,
          name: attachmentName,
          type: attachmentType,
        });
        response = await axios.post(
          `${API_BASE_URL}/api/chat/chat/${apiChatId}/message`,
          formData,
          { headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "multipart/form-data" } }
        );
      } else {
        response = await axios.post(
          `${API_BASE_URL}/api/chat/chat/${apiChatId}/message`,
          { content: messageContent },
          { headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" } }
        );
      }
      if (response.data && response.data.success) {
        return response.data.message;
      } else {
        throw new Error("Invalid API response");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if ((message.trim() === "" && !pendingAttachment) || !selectedUser || isSending) return;
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
    try {
      const sentMsg = await sendMessageToAPI({ messageContent: messageText, file: attachmentToSend });
      setMessages(prev => {
        const confirmedId = sentMsg?.id || sentMsg?._id || sentMsg?.messageId;
        const socketAlreadyAdded = confirmedId && prev.some(m =>
          !m.isTemporary && (m.id === confirmedId || (m.messageId && m.messageId === sentMsg?.messageId))
        );
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
      console.error("Error sending message:", err);
      setMessages(prev => prev.map(msg => msg.id === tempMessage.id ? { ...msg, status: "error" } : msg));
      setError("Failed to send message. Please try again.");
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      }, 3000);
    } finally {
      setIsSending(false);
    }
  };

  const initiateVideoCall = async () => {
    if (!selectedUser) {
      setCallError("No user selected for call");
      return;
    }
    if (!counselorId) {
      setCallError("Please login again to make calls");
      return;
    }
    const userId = normalizeObjectId(getSelectedUserId());
    if (!userId) {
      setCallError("Invalid receiver ID format for this user");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found");
      const authHeader = String(token).startsWith("Bearer ")
        ? String(token)
        : `Bearer ${token}`;
      const requestBody = {
        initiatorId: String(counselorId),
        receiverId: String(userId),
        receiverType: "user",
        callType: "video",
      };

      let response;
      try {
        response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          { ...requestBody, initiatorType: "counsellor" },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
          }
        );
      } catch (firstError) {
        if (firstError?.response?.status !== 400) {
          throw firstError;
        }

        response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          { ...requestBody, initiatorType: "counselor" },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
          }
        );
      }
      if (response.data && response.data.success) {
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId || response.data.callData?._id || response.data.callData?.id,
          roomId: response.data.roomId || response.data.callData?.roomId,
          name: selectedUser.name || USER_NAME,
          type: "video",
          callType: "video",
          profilePic: getAvatarEmoji(userDetails.gender),
          phoneNumber: selectedUser.phone,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          currentUserId: String(counselorId),
          currentUserType: "counsellor",
          initiator: response.data.callData?.initiator,
          receiver: response.data.callData?.receiver,
          apiCallData: response.data.callData,
          isIncoming: false,
        };
        setSelectedCall(callData);
        setIsVideoModalOpen(true);
      } else {
        throw new Error(response.data?.message || "Failed to initiate video call");
      }
    } catch (error) {
      console.error("Error initiating video call:", error?.response?.data || error);
      setCallError(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        "Failed to initiate video call"
      );
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const initiateVoiceCall = async () => {
    if (!selectedUser) {
      setCallError("No user selected for call");
      return;
    }
    if (!counselorId) {
      setCallError("Please login again to make calls");
      return;
    }
    const userId = normalizeObjectId(getSelectedUserId());
    if (!userId) {
      setCallError("Invalid receiver ID format for this user");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found");
      const authHeader = String(token).startsWith("Bearer ")
        ? String(token)
        : `Bearer ${token}`;
      const requestBody = {
        initiatorId: String(counselorId),
        receiverId: String(userId),
        receiverType: "user",
        callType: "audio",
      };

      let response;
      try {
        response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          { ...requestBody, initiatorType: "counsellor" },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
          }
        );
      } catch (firstError) {
        if (firstError?.response?.status !== 400) {
          throw firstError;
        }

        response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          { ...requestBody, initiatorType: "counselor" },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
          }
        );
      }
      if (response.data && response.data.success) {
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId || response.data.callData?._id || response.data.callData?.id,
          roomId: response.data.roomId || response.data.callData?.roomId,
          name: selectedUser.name || USER_NAME,
          type: "voice",
          callType: "audio",
          profilePic: getAvatarEmoji(userDetails.gender),
          phoneNumber: selectedUser.phone,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          currentUserId: String(counselorId),
          currentUserType: "counsellor",
          initiator: response.data.callData?.initiator,
          receiver: response.data.callData?.receiver,
          apiCallData: response.data.callData,
          isIncoming: false,
        };
        setSelectedCall(callData);
        setIsVoiceModalOpen(true);
      } else {
        throw new Error(response.data?.message || "Failed to initiate voice call");
      }
    } catch (error) {
      console.error("Error initiating voice call:", error?.response?.data || error);
      setCallError(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        "Failed to initiate voice call"
      );
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleJoinIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      if (!counselorId) throw new Error("Counselor ID not found");
      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/accept`,
        { acceptorId: counselorId, acceptorType: "counsellor" },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      if (response.data && response.data.success) {
        let detailedCall = null;
        try {
          const detailsResponse = await axios.get(`${API_BASE_URL}/api/video/calls/${callId}/details`, {
            params: { userId: counselorId, userType: "counsellor" },
            headers: { Authorization: `Bearer ${token}` },
          });
          detailedCall = detailsResponse.data?.call || null;
        } catch (detailsError) {
          console.warn("Could not fetch call details:", detailsError);
        }
        const incomingType = String(incomingCallData.callType || detailedCall?.type || "video").toLowerCase();
        const modalType = incomingType === "audio" ? "voice" : incomingType;
        const remoteParticipant = detailedCall
          ? String(detailedCall.initiator?.id) === String(counselorId) ? detailedCall.receiver : detailedCall.initiator
          : null;
        const anonymousName =
          remoteParticipant?.anonymous ||
          remoteParticipant?.anonName ||
          remoteParticipant?.anonymousName ||
          incomingCallData.name ||
          "Anonymous User";
        const callDataForModal = {
          id: detailedCall?.id || callId,
          callId: callId,
          roomId: response.data.roomId || detailedCall?.roomId || incomingCallData.roomId,
          name: anonymousName,
          type: modalType,
          callType: modalType,
          profilePic: null,
          phoneNumber: remoteParticipant?.phoneNumber || "",
          status: response.data.status || "active",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: detailedCall,
          isIncoming: true,
          currentUserType: "counsellor",
        };
        if (modalType === "video") {
          setSelectedCall(callDataForModal);
          setIsVideoModalOpen(true);
        } else {
          setSelectedCall(callDataForModal);
          setIsVoiceModalOpen(true);
        }
        return { success: true, data: response.data };
      }
      throw new Error(response.data?.message || "Failed to join call");
    } catch (error) {
      console.error("Error joining call:", error);
      throw error;
    }
  };

  const handleRejectIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/reject`, {
        userId: counselorId,
        reason: "declined",
      }, { headers: { Authorization: `Bearer ${token}` } });
      return true;
    } catch (error) {
      console.error("Error rejecting call:", error);
      return false;
    }
  };

  const handleEndIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/end`, {
        userId: counselorId,
        endedBy: "counsellor",
      }, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return true;
    } catch (error) {
      if (error?.response?.status === 404) return true;
      console.error("Error ending call:", error);
      return false;
    }
  };

  // Load counselor data on mount
  useEffect(() => {
    loadCounselorData();
  }, []);

  // Poll for incoming calls
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    
    const fetchIncomingCalls = async () => {
      try {
        const token = await getAuthToken();
        if (!counselorId || !token || showIncomingModal || isVideoModalOpen || isVoiceModalOpen) return;
        const response = await axios.get(`${API_BASE_URL}/api/video/calls/pending/${counselorId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!isMounted) return;
        const callsList = response.data.pendingRequests || [];
        if (response.data.success && callsList.length > 0) {
          const waitingCall = callsList[0];
          const fromData = waitingCall.from || {};
          const displayName =
            fromData.anonymous ||
            fromData.anonName ||
            fromData.anonymousName ||
            "Anonymous User";
          setIncomingCallData({
            callId: waitingCall.callId,
            roomId: waitingCall.roomId,
            name: displayName,
            avatar: "👤",
            callType: waitingCall.callType || "video",
            requestMessage: waitingCall.requestMessage || `Incoming ${waitingCall.callType || "video"} call...`,
            requestedAt: waitingCall.requestedAt,
          });
          setShowIncomingModal(true);
        }
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401) {
          if (intervalId) clearInterval(intervalId);
          intervalId = null;
          return;
        }
        console.error("Error polling for calls:", error);
      }
    };
    
    if (isFocused && counselorId) {
      intervalId = setInterval(fetchIncomingCalls, 5000);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isFocused, showIncomingModal, counselorId, isVideoModalOpen, isVoiceModalOpen]);

  const handleCloseModal = () => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setCallError(null);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Fetch messages when counselor data is loaded
  useEffect(() => {
    if (selectedUser && counselorId) {
      fetchMessagesFromAPI();
    }
  }, [selectedUser, chatId, counselorId]);

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
        setIsSocketConnected(!!socket?.connected);

        const onConnect = () => {
          setIsSocketConnected(true);
          console.log('Chat socket connected (shared)');
          socket.emit('join-chat', { chatId: apiChatId });
        };

        unsubscribers.push(await socketService.on('connect', onConnect));
        unsubscribers.push(await socketService.on('disconnect', () => setIsSocketConnected(false)));

        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          const selectedUserId = normalizeObjectId(getSelectedUserId());
          if (!selectedUserId || String(userId) !== String(selectedUserId)) return;
          setSelectedUser((prev) => prev ? { ...prev, online: !!isOnline, status: isOnline ? 'online' : 'offline', lastSeen: lastSeen || prev.lastSeen || null } : prev);
        }));

        unsubscribers.push(await socketService.on('new-message', (messageData) => {
          shouldAutoScrollRef.current = true;
          const incomingId = messageData.id || messageData._id || messageData.messageId;
          const isOwnMessage = messageData.senderRole === 'counsellor' && String(messageData.senderId) === String(counselorId);

          setMessages(prev => {
            const alreadyExists = prev.some(msg => (msg.messageId && messageData.messageId && msg.messageId === messageData.messageId) || (msg.id && incomingId && !String(msg.id).startsWith('temp_') && msg.id === incomingId));
            if (alreadyExists) return prev;
            if (isOwnMessage) {
              const tempIndex = prev.findIndex(msg => msg.isTemporary);
              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = {
                  id: incomingId,
                  messageId: messageData.messageId,
                  text: messageData.content,
                  sender: 'me',
                  senderRole: 'counsellor',
                  time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  fullTime: messageData.createdAt,
                  contentType: messageData.contentType,
                  attachmentType: messageData.attachmentType || messageData.contentType || null,
                  attachmentUrl: messageData.attachmentUrl || null,
                  attachmentName: messageData.attachmentName || null,
                  isRead: messageData.isRead,
                  status: 'sent',
                };
                return next;
              }
            }
            return [...prev, {
              id: incomingId,
              messageId: messageData.messageId,
              text: messageData.content,
              sender: isOwnMessage ? 'me' : 'user',
              senderRole: messageData.senderRole,
              time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              fullTime: messageData.createdAt,
              contentType: messageData.contentType,
              attachmentType: messageData.attachmentType || messageData.contentType || null,
              attachmentUrl: messageData.attachmentUrl || null,
              attachmentName: messageData.attachmentName || null,
              isRead: messageData.isRead,
              status: 'sent',
            }];
          });
        }));

        unsubscribers.push(await socketService.on('user-typing', ({ userRole, isTyping: typing }) => {
          if (userRole === 'user') setRemoteIsTyping(typing);
        }));

        unsubscribers.push(await socketService.on('messages-read', () => {
          setMessages((prev) => prev.map((msg) => (msg.sender === 'me' ? { ...msg, isRead: true } : msg)));
        }));

        unsubscribers.push(await socketService.on('connect_error', (error) => {
          setIsSocketConnected(false);
          console.error('Counselor chat shared socket connect error:', error?.message || error);
        }));

        chatSocketRef.current._unsubscribers = unsubscribers;
      } catch (err) {
        console.error('Failed to setup shared chat socket:', err);
      }
    };

    setupSocket();

    return () => {
      try {
        const unsub = chatSocketRef.current?._unsubscribers || [];
        unsub.forEach(fn => { try { fn(); } catch {} });
      } catch (e) {}
      chatSocketRef.current = null;
      setIsSocketConnected(false);
    };
  }, [chatId, selectedUser, counselorId, USER_ID]);

  // Poll as fallback only when socket is not connected.
  useEffect(() => {
    if (!selectedUser || !counselorId || isSocketConnected) return;

    const intervalId = setInterval(() => {
      fetchMessagesFromAPI();
    }, 45000);

    return () => clearInterval(intervalId);
  }, [selectedUser, counselorId, isSocketConnected]);

  useEffect(() => {
    if (callError) {
      const timer = setTimeout(() => setCallError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [callError]);

  const renderMessageStatus = (message) => {
    if (message.sender !== "me") return null;
    switch (message.status) {
      case "sending":
        return <Text style={styles.messageStatusSending}>⌛</Text>;
      case "sent":
        return (
          <View style={styles.messageStatusIconWrap}>
            <Ionicons
              name={message.isRead ? "checkmark-done" : "checkmark"}
              size={message.isRead ? 14 : 13}
              color={message.isRead ? "#BFDBFE" : "rgba(255,255,255,0.55)"}
            />
          </View>
        );
      case "error":
        return <Text style={styles.messageStatusError}>⚠️ Failed</Text>;
      default:
        return null;
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender === "me";
    const userInitial = (USER_NAME?.charAt(0) || 'U').toUpperCase();

    return (
      <View style={[styles.messageBubble, isMe ? styles.messageRight : styles.messageLeft]}>
        {/* Avatar — left side for user messages */}
        {!isMe && (
          <View style={[styles.msgAvatar, { backgroundColor: getAvatarColor(USER_NAME) }]}>
            {userDetails.profilePhoto && isRealPhoto(userDetails.profilePhoto) ? (
              <Image source={{ uri: userDetails.profilePhoto }} style={styles.msgAvatarPhoto} />
            ) : (
              <Text style={styles.msgAvatarText}>
                {getAvatarEmoji(userDetails.gender) || userInitial}
              </Text>
            )}
          </View>
        )}

        <View style={[styles.messageContent, isMe ? styles.userMessageContent : styles.counselorMessageContent]}>
          {!!item.text && (
            <Text style={[styles.messageText, isMe ? styles.userMessageText : styles.counselorMessageText]}>
              {item.text}
            </Text>
          )}
          {(item.attachmentName || item.attachmentUrl) && (() => {
            const url = getAttachmentUrl(item);
            const name = item.attachmentName || '';
            const imageAttachment = isImageAttachment(item);
            if (imageAttachment && url) {
              return (
                <TouchableOpacity activeOpacity={0.9} onPress={() => openAttachment(url)}>
                  <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => openAttachment(url)}>
                <View style={[styles.attachmentBubble, isMe ? styles.userAttachmentBubble : styles.counselorAttachmentBubble]}>
                  <Ionicons name="document-text-outline" size={16} color={isMe ? '#FFFFFF' : '#2563EB'} />
                  <Text style={[styles.attachmentBubbleText, isMe ? styles.userAttachmentBubbleText : styles.counselorAttachmentBubbleText]} numberOfLines={1}>
                    📎 {name || 'Attachment'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })()}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMine]}>{item.time}</Text>
            {renderMessageStatus(item)}
          </View>
        </View>
      </View>
    );
  };

  if (!selectedUser) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No user selected</Text>
          <Text style={styles.emptyText}>Please select a user from the list to start messaging</Text>
          <TouchableOpacity style={styles.backToListBtn} onPress={handleBack}>
            <Text style={styles.backToListBtnText}>← Back to SMS List</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" translucent={false} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        enabled
      >
      <View style={styles.chatBoxMain}>
        {/* Header - MediConeckt Design */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <View style={styles.userAvatarWrapper}>
                <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(USER_NAME) }]}>
                  {userDetails.profilePhoto && isRealPhoto(userDetails.profilePhoto) ? (
                    <Image
                      source={{ uri: userDetails.profilePhoto }}
                      style={styles.userAvatarPhoto}
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {getAvatarEmoji(userDetails.gender) || (USER_NAME?.charAt(0) || 'U').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={[styles.activeDot, { backgroundColor: resolveOnlineStatus(selectedUser) ? "#4caf50" : "#9CA3AF" }]} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{USER_NAME}</Text>
                <Text style={styles.profileStatus}>
                  {remoteIsTyping ? (
                    <Text style={styles.typingText}>{t('messages:typing')}</Text>
                  ) : (
                    <Text style={styles.statusText}>
                      {resolveOnlineStatus(selectedUser) ? t('common:online') : t('common:offline')}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.callButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, isInitiatingCall && styles.actionBtnDisabled]}
              onPress={initiateVoiceCall}
              disabled={isInitiatingCall}
            >
              <Ionicons name="call" size={19} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, isInitiatingCall && styles.actionBtnDisabled]}
              onPress={initiateVideoCall}
              disabled={isInitiatingCall}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {callError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
            <Text style={styles.errorText}>{callError}</Text>
            <TouchableOpacity onPress={() => setCallError(null)}>
              <Ionicons name="close" size={20} color="#ba1a1a" />
            </TouchableOpacity>
          </View>
        )}

        {isLoadingMessages && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>{t('common:loadingMessages')}</Text>
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.errorMessage}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchMessagesFromAPI}>
              <Text style={styles.retryBtn}>{t('common:retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={messagesContainerRef}
            style={styles.messagesArea}
            data={messagesForList}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={handleMessagesContentSizeChange}
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            inverted
            ListHeaderComponent={
              remoteIsTyping ? (
                <View style={styles.typingContainer}>
                  <View style={styles.typingDots}>
                    <View style={styles.typingDot} />
                    <View style={[styles.typingDot, styles.typingDotDelay1]} />
                    <View style={[styles.typingDot, styles.typingDotDelay2]} />
                  </View>
                  <Text style={styles.typingLabel}>{USER_NAME} is typing...</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyMessagesIcon}>💬</Text>
                <Text style={styles.emptyMessagesText}>{t('messages:noMessages')}</Text>
                <Text style={styles.emptyMessagesSubtext}>{t('messages:startConversation')}</Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.welcomeCard}>
                <View style={[styles.welcomeAvatar, { backgroundColor: getAvatarColor(USER_NAME) }]}>
                  {userDetails.profilePhoto && isRealPhoto(userDetails.profilePhoto) ? (
                    <Image source={{ uri: userDetails.profilePhoto }} style={styles.welcomeAvatarImage} />
                  ) : (
                    <Text style={styles.welcomeInitials}>
                      {getAvatarEmoji(userDetails.gender) || getInitials(USER_NAME)}
                    </Text>
                  )}
                </View>
                <View style={styles.welcomeMsg}>
                  <Text style={styles.welcomeTitle}>{t('messages:chatWith', { name: USER_NAME })}</Text>
                  <Text style={styles.welcomeDesc}>{t('messages:secureChat')}</Text>
                  <Text style={styles.welcomeTime}>
                    {new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            }
          />
        )}

        {/* Input Area - MediConeckt Design */}
        <View style={styles.inputArea}>
          <View style={styles.inputAreaInner}>
          {pendingAttachment && (
            <View style={styles.attachmentPreview}>
              <Ionicons name="attach" size={16} color="#2563EB" />
              <Text style={styles.attachmentPreviewText} numberOfLines={1}>
                {pendingAttachment.name}
              </Text>
              <TouchableOpacity onPress={() => setPendingAttachment(null)}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.inputGroup, isSending && styles.inputGroupDisabled]}>
            <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment} disabled={isSending}>
              <Ionicons name="add" size={22} color="#2563EB" />
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder={isSending ? t('common:sending') : t('messages:typeMessage')}
                placeholderTextColor="#8492a5"
                value={message}
                onChangeText={setMessage}
                editable={!isSending}
                multiline
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                ((message.trim() !== "" || pendingAttachment) && !isSending) ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={((message.trim() === "" && !pendingAttachment) || isSending)}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </View>

      <VideoCallModal
        isOpen={isVideoModalOpen}
        onClose={handleCloseModal}
        callData={selectedCall}
        currentUser={{ id: counselorId, role: "counsellor" }}
        onEndCall={handleEndIncomingCall}
      />

      <VoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={handleCloseModal}
        callData={selectedCall}
        currentUser={{ id: counselorId, role: "counsellor" }}
        onEndCall={handleEndIncomingCall}
      />

      <IncomingCallModal
        isOpen={isFocused && showIncomingModal}
        onClose={() => setShowIncomingModal(false)}
        callType={incomingCallData.callType}
        callerName={incomingCallData.name}
        callerAvatar={incomingCallData.avatar}
        callData={incomingCallData}
        onJoinCall={handleJoinIncomingCall}
        onRejectCall={handleRejectIncomingCall}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatBoxMain: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  backToListBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backToListBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  userAvatarWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userAvatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  profileStatus: {
    fontSize: 11,
  },
  statusText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  typingText: {
    color: '#BFDBFE',
    fontWeight: '600',
  },
  callButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  messagesArea: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },
  messagesList: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
    flexGrow: 1,
  },
  welcomeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  welcomeAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  welcomeAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    resizeMode: 'cover',
  },
  welcomeInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  welcomeMsg: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 3,
  },
  welcomeDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    lineHeight: 17,
  },
  welcomeTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  errorMessage: {
    alignItems: 'center',
    paddingTop: 80,
    backgroundColor: '#F8FAFC',
  },
  retryBtn: {
    marginTop: 16,
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyMessagesIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.4,
  },
  emptyMessagesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  emptyMessagesSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 38,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    opacity: 0.6,
  },
  typingDotDelay1: {
    opacity: 0.4,
  },
  typingDotDelay2: {
    opacity: 0.2,
  },
  typingLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  messageBubble: {
    width: '100%',
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    flexShrink: 0,
  },
  msgAvatarPhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    resizeMode: 'cover',
  },
  msgAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messageContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: screenWidth >= 600 ? 500 : '80%',
  },
  userMessageContent: {
    backgroundColor: '#1D4ED8',
    borderBottomRightRadius: 4,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  counselorMessageContent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  counselorMessageText: {
    color: '#1E293B',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 3,
  },
  messageTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.55)',
  },
  messageStatusSending: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
  messageStatusIconWrap: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageStatusError: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '500',
  },
  attachmentImage: {
    width: 220,
    height: 180,
    borderRadius: 12,
    marginTop: 6,
  },
  attachmentBubble: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userAttachmentBubble: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  counselorAttachmentBubble: {
    backgroundColor: '#F3F4F6',
  },
  attachmentBubbleText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  userAttachmentBubbleText: {
    color: '#FFFFFF',
  },
  counselorAttachmentBubbleText: {
    color: '#374151',
  },
  inputArea: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  inputAreaInner: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  attachmentPreviewText: {
    flex: 1,
    color: '#111827',
    fontSize: 12,
    fontWeight: '500',
  },
  inputGroupDisabled: {
    opacity: 0.7,
    backgroundColor: '#FFFFFF',
  },
  inputGroup: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    paddingHorizontal: 8,
    maxHeight: 120,
    minHeight: 36,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#1D4ED8',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
    opacity: 0.7,
  },
  // Incoming Call Modal Styles
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingCallModal: {
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  videoCallModal: {
    borderTopWidth: 3,
    borderTopColor: '#2563EB',
  },
  voiceCallModal: {
    borderTopWidth: 3,
    borderTopColor: '#0D9488',
  },
  incomingCallContent: {
    padding: 24,
    alignItems: 'center',
  },
  incomingCallerInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  incomingCallerAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarInitialLarge: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  incomingCallerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  incomingCallType: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  incomingCallMessage: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
  },
  incomingCallControls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  incomingCallBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  acceptBtn: {
    backgroundColor: '#2563EB',
  },
  rejectBtn: {
    backgroundColor: '#DC2626',
  },
  incomingCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default SMSInput;