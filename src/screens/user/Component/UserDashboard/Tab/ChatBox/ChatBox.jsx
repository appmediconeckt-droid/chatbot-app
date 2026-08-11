import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  Dimensions,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from "react-native";
import socketService from '../../../../../../services/socketService';
import axios from "axios";
import { API_BASE_URL } from "../../../../../../axiosConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { pick } from "@react-native-documents/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import PATIENT from "../../../../../../theme/palette";
import ZoomableImageViewer from "../../../../../../components/common/ZoomableImageViewer";

// Patient green theme (from Figma).
const BRAND_GRADIENT = [PATIENT.gradientFrom, PATIENT.gradientTo];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
// Conditionally import RNFS only on native platforms
let RNFS;
if (Platform.OS !== 'web') {
  RNFS = require('react-native-fs');
}
import VideoCallModal from "../CallModal/VideoCallModal";
import VoiceCallModal from "../CallModal/VoiceCallModal";
import useRingtone from "../../../../../../hooks/useRingtone";
import useScreenshotPrevent from "../../../../../../utils/useScreenshotPrevent";
import TranslatedMessageBubble from "../../../../../../components/TranslatedMessageBubble";
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import ChatSkeleton from "../../../../../../components/common/ChatSkeleton";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchChatCallEntries,
  mergeTimelineForInverted,
  describeCall,
} from "../../../../../../utils/chatCallHistory";

const { width: screenWidth } = Dimensions.get("window");

// Professional Incoming Call Modal Component with Serenity design
const IncomingCallModal = ({
  isOpen,
  onClose,
  callType,
  callerName,
  callerImage,
  callData,
  onAcceptCall,
  onRejectCall,
}) => {
  const { t } = useLanguageRender();
  const { width: winWidth } = useWindowDimensions();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleAccept = async () => {
    if (isAccepting) return;
    setIsAccepting(true);
    if (onAcceptCall && callData) {
      try {
        await onAcceptCall(callData.callId);
        onClose();
      } catch (error) {
        console.error("Error accepting call:", error);
      } finally {
        setIsAccepting(false);
      }
    } else {
      onClose();
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (isRejecting) return;
    setIsRejecting(true);
    if (onRejectCall && callData) {
      try {
        await onRejectCall(callData.callId);
        onClose();
      } catch (error) {
        console.error("Error rejecting call:", error);
      } finally {
        setIsRejecting(false);
      }
    } else {
      onClose();
      setIsRejecting(false);
    }
  };

  if (!isOpen) return null;

  const displayName = callData?.from?.displayName || callData?.from?.fullName || callerName || "Counselor";
  const profilePhoto = callData?.from?.profilePhoto || callerImage;

  const formatRequestTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const requestedTime = callData?.requestedAt ? formatRequestTime(callData.requestedAt) : "";

  return (
    <Modal transparent visible={isOpen} animationType="fade">
      <View style={styles.incomingModalOverlay}>
        <View
          style={[
            styles.incomingModal,
            callType === "video" ? styles.videoCallModal : styles.voiceCallModal,
            { width: Math.min(winWidth * 0.88, 380) },
          ]}
        >
          <View style={styles.incomingModalContent}>
            <View style={styles.incomingCallerInfo}>
              <View style={styles.incomingCallerAvatar}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.incomingAvatarImage} />
                ) : (
                  <View style={styles.incomingAvatarPlaceholder}>
                    <Text style={styles.incomingAvatarText}>👤</Text>
                  </View>
                )}
              </View>
              <Text style={styles.incomingCallerName}>{displayName}</Text>
              <Text style={styles.launchCallType}>
                {callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
              </Text>
              {requestedTime ? (
                <Text style={styles.incomingCallTime}>Received at {requestedTime}</Text>
              ) : null}
              <Text style={styles.incomingCallMessage}>
                {callData?.requestMessage || `Incoming ${callType} call...`}
              </Text>
            </View>

            <View style={styles.incomingCallControls}>
              <TouchableOpacity
                style={[styles.incomingCallBtn, styles.rejectCallBtn]}
                onPress={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.incomingCallBtnText}>{t('Decline')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.incomingCallBtn, styles.acceptCallBtn]}
                onPress={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.incomingCallBtnText}>{t('Accept')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Reusable confirm modal to replace native Alert.confirm
const ConfirmModal = ({ visible, title, message, onConfirm, onCancel, confirmText = 'Delete', cancelText = 'Cancel', destructive = false }) => {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={onCancel}>
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View style={styles.confirmButtonsRow}>
            <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnCancel]} onPress={onCancel}>
              <Text style={styles.confirmBtnText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnConfirm, destructive && styles.confirmDestructive]} onPress={onConfirm}>
              <Text style={[styles.confirmBtnText, destructive && { color: '#fff' }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const ChatBox = () => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  useScreenshotPrevent();
  const navigation = useNavigation();
  const route = useRoute();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // Responsive bubble width, mirroring the web CSS breakpoints:
  // <375px → 85%, phones → 80%, tablets (≥768) → 70%.
  const bubbleMaxWidth = windowWidth >= 768 ? '70%' : windowWidth < 375 ? '85%' : '80%';
  const { id: counselorId } = route.params || {};
  const {
    chatId,
    chatMongoId,
    counselor: initialCounselor,
    user: initialUser,
    callType: launchCallType,
    callData: launchCallData,
  } = route.params || {};

  // State for current chat
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [callHistory, setCallHistory] = useState([]);

  const [currentCounselor, setCurrentCounselor] = useState(() => {
    if (initialCounselor) {
      return initialCounselor;
    }
    return {
      id: counselorId || null,
      name: "Dr. Sarah Mitchell",
      specialization: "Cognitive Behavioral Therapist",
      online: false,
      avatar: null,
      avatarType: "text",
      profilePhoto: null,
      phoneNumber: "+91 98765 43215",
    };
  });

  // Launched from the appointment tab: the call already exists server-side, so
  // just open the matching modal. Guarded by a ref so a re-render can't reopen a
  // call the user has already hung up.
  const launchedCallRef = useRef(false);
  useEffect(() => {
    if (launchedCallRef.current) return;
    if (!launchCallType || !launchCallData) return;
    launchedCallRef.current = true;

    const receiver = launchCallData?.receiver;
    const photo =
      getProfilePhotoUrl(receiver) ||
      getProfilePhotoUrl(currentCounselor) ||
      null;

    setSelectedCall({
      id: launchCallData?.id || launchCallData?._id,
      callId: launchCallData?.callId || launchCallData?.id || launchCallData?._id,
      roomId: launchCallData?.roomId,
      name: receiver?.name || currentCounselor?.name || "Counselor",
      type: launchCallType,
      callType: launchCallType,
      profilePic: photo,
      phoneNumber: currentCounselor?.phoneNumber,
      status: launchCallData?.status || "ringing",
      date: "Today",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      apiCallData: launchCallData,
      initiator: launchCallData?.initiator,
      receiver,
      currentUserType: "user",
    });

    if (launchCallType === "video") setIsVideoModalOpen(true);
    else setIsVoiceModalOpen(true);
  }, [launchCallType, launchCallData, currentCounselor]);

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
    image: null,
    callId: "",
    roomId: "",
    callType: "video",
  });

  const { startRinging: startIncomingRing, stopRinging: stopIncomingRing } = useRingtone();

  useEffect(() => {
    if (showIncomingModal) {
      startIncomingRing(true);
    } else {
      stopIncomingRing();
    }
  }, [showIncomingModal, startIncomingRing, stopIncomingRing]);

  const [newMessage, setNewMessage] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [confirmState, setConfirmState] = useState({ visible: false, title: '', message: '', onConfirm: null, onCancel: null, destructive: false });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  // Messages and call history are two separate requests. The spinner used to
  // clear the moment the MESSAGES landed, so the thread rendered and the call
  // bubbles dropped in seconds later and shoved everything around. Hold the
  // first render until both have settled.
  const [timelineReady, setTimelineReady] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [counselorAvatarFailed, setCounselorAvatarFailed] = useState(false);
  const [chatStatus, setChatStatus] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  // Track deleted message IDs persistently so they stay deleted across navigation/refresh
  const [deletedMessageIds, setDeletedMessageIds] = useState(new Set());
  // Track selected message for action menu
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [failedImageUrls, setFailedImageUrls] = useState(new Set());
  // Photo opened full-screen for pinch-zoom; null when the viewer is closed.
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  const flatListRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatSocketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fallbackChatIdRef = useRef(chatId || null);
  // Scroll model mirrors the counselor screen (SMSInput) exactly: a single
  // "should I stay pinned to newest" flag plus a "have I done the first scroll"
  // flag. No suppress-timers / drag-handlers — those caused the jitter.
  const initialLoadDoneRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  // Block the 45-second poll for 5 seconds after a delete, so the server has
  // time to confirm before a background refetch tries to re-add the deleted msg.
  const deletedRecentlyRef = useRef(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const isSendingRef = useRef(false);

  // Get current user from AsyncStorage
  const getCurrentUser = async () => {
    try {
      const storedUserData = await AsyncStorage.getItem("userData") || await AsyncStorage.getItem("user");
      if (!storedUserData) return null;
      return JSON.parse(storedUserData);
    } catch (e) {
      return null;
    }
  };

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser);
  }, []);

  const getAuthToken = useCallback(async () => (
    await AsyncStorage.getItem("token") ||
    await AsyncStorage.getItem("accessToken")
  ), []);

  const resolveCurrentUserId = useCallback(() => currentUser?.id || currentUser?._id || null, [currentUser]);
  
  const resolveCounselorId = useCallback(() => {
    const id =
      currentCounselor?.id?.toString() ||
      currentCounselor?._id?.toString() ||
      counselorId ||
      currentChat?.counselorId?.toString() ||
      null;

    if (!id) {
      console.warn("❌ resolveCounselorId: No counselor ID found!");
    }
    return id;
  }, [currentCounselor, counselorId, currentChat]);

  const isRealPhoto = (url) => {
    if (!url || typeof url !== 'string') return false;
    if (url.includes('ui-avatars.com')) return false;
    if (url.includes('dicebear')) return false;
    if (url.includes('gravatar.com')) return false;
    return true;
  };

  const getProfilePhotoUrl = (person) => {
    if (!person) return null;

    const photo = person.profilePhoto || person.avatar || person.profilePic || person.photo;

    if (!photo) return null;

    if (photo.url) return isRealPhoto(photo.url) ? photo.url : null;

    if (typeof photo === "string") {
      if (photo.startsWith("http")) return isRealPhoto(photo) ? photo : null;
      if (photo.startsWith("data:")) return photo;
      if (photo.length > 0) {
        if (photo.startsWith("/")) return `${API_BASE_URL}${photo}`;
        return `${API_BASE_URL}/${photo}`;
      }
    }
    
    return null;
  };

  const resolveOnlineStatus = (person) => {
    const explicitOnline = person?.isOnline ?? person?.online;
    if (typeof explicitOnline === 'boolean') return explicitOnline;
    if (typeof explicitOnline === 'string') return ['online', 'true', '1', 'yes'].includes(explicitOnline.toLowerCase());
    return false;
  };

  const getAttachmentUrl = (item) => {
    const rawUrl = item?.attachmentUrl || item?.attachment || "";
    if (!rawUrl || typeof rawUrl !== "string") return "";
    if (/^(https?:|file:|content:|data:)/i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith("/")) return `${API_BASE_URL}${rawUrl}`;
    return `${API_BASE_URL}/${rawUrl}`;
  };

  const isImageAttachment = (item) => {
    const url = getAttachmentUrl(item);
    const name = String(item?.attachmentName || "");
    const contentType = String(item?.attachmentType || item?.contentType || "").toLowerCase();
    return (
      contentType.startsWith("image/") ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)(\?|$)/i.test(url) ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(name) ||
      /screenshot|photo|image/i.test(name)
    );
  };

  const openAttachment = useCallback(async (uri) => {
    if (!uri || !RNFS) {
      // Fallback: try to open directly
      try {
        await Linking.openURL(uri);
      } catch (_) {
        Alert.alert('Cannot Open File', 'No app found to open this file.', [{ text: 'OK' }]);
      }
      return;
    }
    
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

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(word => word[0]).join("").toUpperCase().slice(0, 2);
  };

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  useEffect(() => {
    // iOS fires keyboardWillShow (pre-animation); Android ONLY fires
    // keyboardDidShow. Listening to willShow on Android meant the pad was never
    // applied and the keyboard covered the input — so pick the right event.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, () => {
      // Keep the newest message visible when the keyboard opens (WhatsApp-style).
      if (shouldAutoScrollRef.current) scrollToBottom(true);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      if (shouldAutoScrollRef.current) scrollToBottom(true);
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [scrollToBottom]);

  // Spacing above the keyboard is handled by KeyboardAvoidingView (it compares
  // this view's frame against the keyboard frame, so it works both when the OS
  // resizes the window and when the keyboard floats over it). The keyboard
  // listener above is kept only to auto-scroll to the newest message.

  // Call entries the user has deleted (hidden) from this thread. Persisted
  // locally because there is no server API to delete a call record.
  const [hiddenCallIds, setHiddenCallIds] = useState([]);
  const messagesCountRef = useRef(0);

  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages.length]);

  const messagesForList = useMemo(() => {
    if (!messages?.length && !callHistory?.length) return [];
    const merged = mergeTimelineForInverted(messages, callHistory);
    if (!hiddenCallIds.length) return merged;
    const hidden = new Set(hiddenCallIds.map(String));
    return merged.filter((item) => !(item.isCall && hidden.has(String(item.id))));
  }, [messages, callHistory, hiddenCallIds]);

  // Scroll handling — identical model to the counselor screen (SMSInput).
  // While the user scrolls, remember whether they are near the newest message
  // (inverted list: offset 0 = newest). Content-size changes only re-pin when
  // that flag is set, so scrolling up never yanks the view back down.
  const handleMessagesScroll = useCallback((event) => {
    const { contentOffset } = event.nativeEvent;
    shouldAutoScrollRef.current = contentOffset.y <= 48;
  }, []);

  const handleMessagesContentSizeChange = useCallback(() => {
    if (shouldAutoScrollRef.current) scrollToBottom(false);
    initialLoadDoneRef.current = true;
  }, [scrollToBottom]);

  const getChatIdForAPI = useCallback(() => {
    if (chatId) return chatId;
    if (currentChat?.chatId) return currentChat.chatId;

    if (!fallbackChatIdRef.current) {
      const stableUserId = resolveCurrentUserId() || "user";
      const stableCounselorId = resolveCounselorId() || "counselor";
      fallbackChatIdRef.current = `chat_${stableUserId}_${stableCounselorId}`.replace(/\s+/g, "_");
    }

    return fallbackChatIdRef.current;
  }, [chatId, currentChat, resolveCurrentUserId, resolveCounselorId]);

  const getChatIdForClearAPI = useCallback(() => (
    chatMongoId ||
    currentChat?._id ||
    currentChat?.id ||
    chatId ||
    currentChat?.chatId ||
    getChatIdForAPI()
  ), [chatMongoId, currentChat, chatId, getChatIdForAPI]);

  // Call API actions
  const handleAcceptCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const userId = resolveCurrentUserId();
      if (!userId) throw new Error("User ID missing");

      const response = await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/accept`, {
        acceptorId: userId,
        acceptorType: "user",
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (!response.data?.success) throw new Error(response.data?.error || "Failed to accept call");

      let detailedCall = null;
      try {
        const detailsResponse = await axios.get(`${API_BASE_URL}/api/video/calls/${callId}/details`, {
          params: { userId, userType: "user" },
          headers: { Authorization: `Bearer ${token}` },
        });
        detailedCall = detailsResponse.data?.call || null;
      } catch (detailsError) {
        console.warn("Could not fetch accepted call details:", detailsError);
      }

      const incomingType = String(incomingCallData.callType || "video").toLowerCase();
      const modalType = incomingType === "audio" ? "voice" : incomingType;

      const acceptedCallData = {
        id: detailedCall?.id || callId,
        callId,
        roomId: response.data.roomId || detailedCall?.roomId || incomingCallData.roomId,
        name: detailedCall?.initiator?.displayName || detailedCall?.initiator?.fullName || incomingCallData.name || "Counselor",
        displayName: detailedCall?.initiator?.displayName || detailedCall?.initiator?.fullName || incomingCallData.name || "Counselor",
        type: modalType,
        callType: modalType,
        profilePic: detailedCall?.initiator?.profilePhoto || incomingCallData.image || null,
        phoneNumber: detailedCall?.initiator?.phoneNumber || "",
        status: response.data.status || detailedCall?.status || "active",
        apiCallData: detailedCall,
        initiator: detailedCall?.initiator,
        receiver: detailedCall?.receiver,
        currentUserId: userId,
        currentUserType: "user",
        isIncoming: true,
      };

      setSelectedCall(acceptedCallData);
      if (modalType === "video") setIsVideoModalOpen(true);
      else setIsVoiceModalOpen(true);
      setShowIncomingModal(false);

      return response.data;
    } catch (error) {
      console.error("Error accepting call:", error);
      throw error;
    }
  };

  const handleRejectCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const userId = resolveCurrentUserId();
      if (!userId) throw new Error("User ID missing");
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/reject`, {
        userId,
        reason: "declined",
      }, { headers: { Authorization: `Bearer ${token}` } });
      return true;
    } catch (error) {
      console.error("Error rejecting call:", error);
      return false;
    }
  };

  const handleEndCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const userId = resolveCurrentUserId();
      if (!userId) throw new Error("User ID missing");
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/end`, {
        userId: userId,
        endedBy: "user",
      }, { headers: { Authorization: `Bearer ${token}` } });
      return true;
    } catch (error) {
      console.error("Error ending call:", error);
      return false;
    }
  };

  // Fetch messages from API
  const fetchMessagesFromAPI = useCallback(async (silent = false) => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      
      if (!silent && messagesCountRef.current === 0) setIsLoadingMessages(true);

      const response = await axios.get(`${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const messagesArray =
        response.data?.messages ||
        response.data?.data?.messages ||
        (Array.isArray(response.data) ? response.data : []);
      const responseChatStatus = response.data?.chatStatus || response.data?.data?.chatStatus;

      if (Array.isArray(messagesArray)) {
        if (responseChatStatus) setChatStatus(responseChatStatus);

        // Deduplicate system messages (e.g., "Sending a new request" that appears 6-7 times)
        // Keep only the FIRST occurrence of duplicate system messages
        const seenSystemTexts = new Set();
        const deduplicatedMessages = messagesArray.filter(msg => {
          const isSystemMessage = msg.content?.includes('Sending a new request') ||
                                  msg.content?.includes('expires in');
          if (isSystemMessage) {
            const key = msg.content;
            if (seenSystemTexts.has(key)) return false; // Skip duplicate
            seenSystemTexts.add(key);
          }
          return true;
        });

        const transformedMessages = deduplicatedMessages.map((msg, index) => ({
          id: msg.id || msg._id || index,
          messageId: msg.messageId,
          text: msg.content,
          sender: msg.senderRole === "user" ? "user" : "counselor",
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

        // Only re-pin to the newest message on the FIRST (non-silent) load.
        // A silent background refresh (30s poll / manual refresh) must NOT yank
        // the user's scroll position or force a re-scroll — that was the
        // "reloading" jump after deleting. The web keeps scroll on refresh
        // because the browser preserves it; we replicate that here.
        if (!silent) {
          initialLoadDoneRef.current = false;
          shouldAutoScrollRef.current = true;
        }

        setMessages(prev => {
          // Preserve any optimistic (still-sending) bubble so a poll that lands
          // mid-send doesn't make it disappear. Server messages win once they
          // carry the same id.
          const pending = prev.filter(m => m.isTemporary);
          // Filter out any message that the server returns if we already deleted it
          // (tracked in deletedMessageIds). This prevents the "flicker" where a
          // deleted message reappears if the server-side delete is still in progress.
          const filtered = transformedMessages.filter(
            m => !deletedMessageIds.has(String(m.messageId || m.id))
          );
          if (!pending.length) return filtered;
          const serverIds = new Set(
            filtered.map(m => String(m.messageId || m.id))
          );
          const keptPending = pending.filter(
            m => !serverIds.has(String(m.messageId || m.id))
          );
          return [...filtered, ...keptPending];
        });

        return transformedMessages;
      }
    } catch (error) {
      console.error("Error fetching messages from API:", error);
      if (messagesCountRef.current === 0) {
        await loadMessagesFromLocalStorage();
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [getAuthToken, getChatIdForAPI, loadMessagesFromLocalStorage, deletedMessageIds]);

  // Load the call history for THIS conversation
  // `overrides` exists because initializeChat calls setCurrentChat/
  // setCurrentCounselor and then needed the ids immediately — but those state
  // updates have not landed yet, so resolveCounselorId() still returned the old
  // (null) value and this bailed out at the guard below. Opened from My
  // Appointments, where no counselorId route param is passed, that meant the
  // call bubbles never loaded with the messages and only appeared once
  // something else refreshed them.
  const loadCallHistory = useCallback(async (overrides = {}) => {
    try {
      const token = await getAuthToken();
      const myId =
        overrides.myId || resolveCurrentUserId() || (await AsyncStorage.getItem("userId"));
      const peerId = overrides.peerId || resolveCounselorId();
      if (!myId || !peerId) return;
      const entries = await fetchChatCallEntries({ currentUserId: myId, peerId, token });
      setCallHistory(entries);
      // Cached alongside the messages so the next open can paint the whole
      // timeline at once instead of adding call bubbles a second later.
      AsyncStorage.setItem(
        `callHistory_${getChatIdForAPI()}`,
        JSON.stringify(entries),
      ).catch(() => {});
    } catch (_) {
      console.warn("Could not load call history:", _);
    }
  }, [getAuthToken, resolveCurrentUserId, resolveCounselorId]);

  const hiddenCallsStorageKey = useCallback(() => `hiddenCallEntries_${getChatIdForAPI()}`, [getChatIdForAPI]);

  // Load the locally-hidden call entries for this thread.
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

  // "Delete" a call bubble = hide it locally + remember the choice.
  const hideCallEntry = useCallback(async (callItemId) => {
    if (!callItemId) return;
    setHiddenCallIds((prev) => {
      const next = Array.from(new Set([...prev, String(callItemId)]));
      AsyncStorage.setItem(hiddenCallsStorageKey(), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [hiddenCallsStorageKey]);

  const loadMessagesFromLocalStorage = useCallback(async () => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
      const chat = savedChats.find(c => c.id === currentChat?.id || c.chatId === getChatIdForAPI());
      if (chat && chat.messages) {
        initialLoadDoneRef.current = false;
        shouldAutoScrollRef.current = true;
        setMessages(chat.messages);
      }
    } catch (error) {
      console.error("Error loading messages from localStorage:", error);
    }
  }, [currentChat, getChatIdForAPI]);

  const sendMessageToAPI = useCallback(async ({ messageContent = "", file = null }) => {
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
        response = await axios.post(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message`, {
          content: messageContent,
        }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      }

      if (response.data && response.data.success) return response.data.message;
      else throw new Error("Invalid API response");
    } catch (error) {
      console.error("Error sending message to API:", error);
      const backendError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send message";
      throw new Error(backendError);
    }
  }, [getAuthToken, getChatIdForAPI]);

  const handleSendMessage = useCallback(async () => {
    if ((newMessage.trim() === "" && !pendingAttachment) || isSending || isSendingRef.current) return;

    const messageText = newMessage.trim();
    const attachmentToSend = pendingAttachment;
    const tempUserMessage = {
      id: `temp_${Date.now()}`,
      text: messageText || "",
      sender: "user",
      senderRole: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      status: "sending",
      isTemporary: true,
      attachmentName: attachmentToSend?.name || null,
      attachmentUrl: attachmentToSend?.uri || null,
      attachmentType: attachmentToSend?.type || null,
    };

    isSendingRef.current = true;
    setIsSending(true);
    
    // Sending your own message always pins to newest; onContentSizeChange
    // performs the actual scroll (same as the counselor screen).
    shouldAutoScrollRef.current = true;
    setMessages(prev => [...prev, tempUserMessage]);
    setNewMessage("");
    setPendingAttachment(null);
    setShowEmojiPicker(false);

    try {
      const sentMsg = await sendMessageToAPI({ messageContent: messageText, file: attachmentToSend });
      setMessages(prev => {
        const withoutTemp = prev.filter(m => !m.isTemporary);
        if (!sentMsg) return withoutTemp;
        const alreadyHas = withoutTemp.some(m => m.messageId && sentMsg.messageId && m.messageId === sentMsg.messageId);
        if (alreadyHas) return withoutTemp;
        return [...withoutTemp, {
          id: sentMsg.id || sentMsg._id,
          messageId: sentMsg.messageId,
          text: sentMsg.content,
          sender: "user",
          senderRole: "user",
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
      console.error("Error in message sending flow:", err);
      setMessages(prev => prev.map(msg => msg.id === tempUserMessage.id ? { ...msg, status: "error", error: "Failed to send message" } : msg));
      const errorMessage = {
        id: `error_${Date.now()}`,
        text: `⚠️ ${err?.message || "Failed to send message. Please try again."}`,
        sender: "counselor",
        senderRole: "counsellor",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
        status: "error",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [newMessage, pendingAttachment, isSending, sendMessageToAPI]);

  // Delete any persisted message, matching the web chat behavior.
  const deleteMessage = useCallback(async (messageId) => {
    if (!messageId) {
      Alert.alert("Error", "Message ID not found");
      return false;
    }
    
    // Find the message to delete
    const messageToDelete = messages.find(m => 
      String(m.id) === String(messageId) || 
      String(m.messageId) === String(messageId)
    );
    
    if (!messageToDelete) {
      Alert.alert("Error", "Message not found");
      return false;
    }
    if (messageToDelete.isTemporary) {
      Alert.alert("Error", "Cannot delete message while sending");
      return false;
    }
    
    const apiChatId = getChatIdForAPI();
    const deleteId = messageToDelete.id || messageToDelete.messageId;

    // Optimistic delete: add to deletedMessageIds (persistent) and hide immediately.
    // When the server returns from a fetch, we filter out any message with an ID
    // in deletedMessageIds, preventing the "flicker" if the server delete is in progress.
    setDeletedMessageIds(prev => new Set([...prev, String(messageId), String(messageToDelete.messageId)]));
    setMessages(prev => prev.filter(m =>
      String(m.id) !== String(messageId) &&
      String(m.messageId) !== String(messageId)
    ));

    // Block all refetches for 10 seconds. The message is marked as deleted in state,
    // so if a fetch happens and the server hasn't confirmed yet, we filter it out.
    // But most importantly: without this grace period, multiple deletes or refetches
    // can race and cause the flicker. This gives the server safe time to confirm.
    deletedRecentlyRef.current = true;
    setTimeout(() => {
      deletedRecentlyRef.current = false;
    }, 10000);

    // Update local storage cache in the background (non-blocking).
    (async () => {
      try {
        const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
        const updatedChats = savedChats.map(c => {
          if (c.chatId === apiChatId || String(c.id) === String(currentChat?.id)) {
            return {
              ...c,
              messages: (c.messages || []).filter(m =>
                String(m.id) !== String(messageId) &&
                String(m.messageId) !== String(messageId)
              )
            };
          }
          return c;
        });
        await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
      } catch (e) {
        // ignore storage errors
      }
    })();

    try {
      const token = await getAuthToken();
      await axios.delete(
        `${API_BASE_URL}/api/chat/message/${encodeURIComponent(deleteId)}`,
        {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        }
      );
      return true;
    } catch (err) {
      console.error("Delete message failed:", err?.response?.data || err.message || err);
      // Roll back: put the message back where it was.
      setMessages(prev => {
        if (prev.some(m => String(m.id) === String(messageToDelete.id))) return prev;
        const restored = [...prev, messageToDelete];
        restored.sort((a, b) => {
          const ta = a.fullTime ? new Date(a.fullTime).getTime() : Date.now();
          const tb = b.fullTime ? new Date(b.fullTime).getTime() : Date.now();
          return ta - tb;
        });
        return restored;
      });
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || "Unknown server error";
      Alert.alert(
        "Delete Failed",
        `Could not delete message from server: ${serverMsg}. Please try again.`
      );
      return false;
    } finally {
      setDeletingMessageId(null);
    }
  }, [getAuthToken, getChatIdForAPI, currentChat, messages]);

  const deleteWholeChat = useCallback(async () => {
    const apiChatId = getChatIdForClearAPI();
    const localChatId = getChatIdForAPI();

    setConfirmState({
      visible: true,
      title: 'Delete Chat',
      message: 'Are you sure you want to delete all messages? You can start a new conversation after.',
      destructive: true,
      onCancel: () => setConfirmState(s => ({ ...s, visible: false })),
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, visible: false }));
        try {
          const token = await getAuthToken();

          if (!apiChatId) {
            Alert.alert("Error", "Chat ID not found");
            return false;
          }

          await axios.delete(
            `${API_BASE_URL}/api/chat/clear/${apiChatId}`,
            {
              headers: {
                Authorization: token ? `Bearer ${token}` : undefined,
                'Content-Type': 'application/json',
              },
            }
          );

          setMessages([]);
          setCallHistory([]);
          setNewMessage('');
          setChatStatus('active');

          try {
            const savedChats = JSON.parse(
              await AsyncStorage.getItem("activeChats") || "[]"
            );
            const updatedChats = savedChats.map(c =>
              (
                c.chatId === apiChatId ||
                c.chatId === localChatId ||
                String(c.id) === String(apiChatId) ||
                String(c.id) === String(localChatId) ||
                String(c._id) === String(apiChatId) ||
                String(c._id) === String(localChatId) ||
                String(c.id) === String(currentChat?.id)
              )
                ? {
                    ...c,
                    messages: [],
                    unread: 0,
                    status: 'active',
                    lastMessage: null,
                    lastMessageAt: null
                  }
                : c
            );
            await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
          } catch (storageErr) {
            console.error("Storage update error:", storageErr);
          }

          setCurrentChat(prev => prev ? {
            ...prev,
            messages: [],
            status: 'active',
            lastMessage: null,
            lastMessageAt: null
          } : null);

          setShowOptions(false);
          Alert.alert("Success", "Chat cleared! You can now start a new conversation.");
          return true;

        } catch (error) {
          console.error("❌ Delete chat failed:", error?.response?.data || error.message);
          Alert.alert(
            "Error",
            `Could not clear chat: ${error?.response?.data?.error || error.message || "Failed to clear chat on server"}`
          );
          return false;
        }
      }
    });
  }, [getAuthToken, getChatIdForAPI, getChatIdForClearAPI, currentChat]);

  const handlePickAttachment = useCallback(async () => {
    if (isSending) return;

    try {
      const [picked] = await pick();
      if (!picked?.uri) {
        Alert.alert("Attachment", "Unable to read selected file.");
        return;
      }

      setPendingAttachment({
        uri: picked.uri,
        name: picked.name || `file_${Date.now()}`,
        type: picked.type || picked.mimeType || "application/octet-stream",
        size: picked.size || picked.fileSize || 0,
      });
    } catch (error) {
      if (error?.code === "OPERATION_CANCELED") return;
      console.error("Attachment pick error:", error);
      Alert.alert("Attachment", "Failed to pick file. Please try again.");
    }
  }, [isSending]);

  const initiateVideoCall = useCallback(async () => {
    if (!currentCounselor) {
      setCallError("Counselor information not available");
      return;
    }

    setIsInitiatingCall(true);
    setCallError(null);

    try {
      const token = await getAuthToken();
      const initiatorId = resolveCurrentUserId();
      const receiverId = resolveCounselorId();

      if (!initiatorId || !receiverId) throw new Error("Unable to start call. Missing user/counselor ID.");

      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, {
        initiatorId, initiatorType: "user", receiverId, receiverType: "counsellor", callType: "video",
      }, { headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" } });

      if (response.data && response.data.success) {
        const receiverProfilePhoto = response.data.callData?.receiver?.profilePhoto || getProfilePhotoUrl(currentCounselor) || currentCounselor?.avatar || currentCounselor?.name?.charAt(0) || "👤";
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: response.data.callData?.receiver?.name || currentCounselor.name || "Counselor",
          type: "video",
          callType: "video",
          profilePic: receiverProfilePhoto,
          phoneNumber: currentCounselor?.phoneNumber,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: response.data.callData,
          initiator: response.data.callData?.initiator,
          receiver: response.data.callData?.receiver,
          currentUserId: initiatorId,
          currentUserType: "user",
        };
        setSelectedCall(callData);
        setIsVideoModalOpen(true);
      } else {
        throw new Error(response.data?.message || "Failed to initiate video call");
      }
    } catch (error) {
      console.error("Error initiating video call:", error);
      let errorMessage = "Failed to initiate video call. ";
      const backendMessage = error.response?.data?.message || error.response?.data?.error;
      errorMessage += backendMessage || error.message || "Please check your connection and try again.";
      setCallError(errorMessage);
    } finally {
      setIsInitiatingCall(false);
    }
  }, [currentCounselor, getAuthToken, resolveCurrentUserId, resolveCounselorId]);

  const initiateVoiceCall = useCallback(async () => {
    if (!currentCounselor) {
      setCallError("Counselor information not available");
      return;
    }

    setIsInitiatingCall(true);
    setCallError(null);

    try {
      const token = await getAuthToken();
      const initiatorId = resolveCurrentUserId();
      const receiverId = resolveCounselorId();

      if (!initiatorId || !receiverId) throw new Error("Unable to start call. Missing user/counselor ID.");

      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, {
        initiatorId, initiatorType: "user", receiverId, receiverType: "counsellor", callType: "audio",
      }, { headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" } });

      if (response.data && response.data.success) {
        const receiverProfilePhoto = response.data.callData?.receiver?.profilePhoto || getProfilePhotoUrl(currentCounselor) || currentCounselor?.avatar || currentCounselor?.name?.charAt(0) || "👤";
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: response.data.callData?.receiver?.name || currentCounselor.name || "Counselor",
          type: "voice",
          callType: "audio",
          profilePic: receiverProfilePhoto,
          phoneNumber: currentCounselor?.phoneNumber,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: response.data.callData,
          initiator: response.data.callData?.initiator,
          receiver: response.data.callData?.receiver,
          currentUserId: initiatorId,
          currentUserType: "user",
        };
        setSelectedCall(callData);
        setIsVoiceModalOpen(true);
      } else {
        throw new Error(response.data?.message || "Failed to initiate voice call");
      }
    } catch (error) {
      console.error("Error initiating voice call:", error);
      let errorMessage = "Failed to initiate voice call. ";
      const backendMessage = error.response?.data?.message || error.response?.data?.error;
      errorMessage += backendMessage || error.message || "Please check your connection and try again.";
      setCallError(errorMessage);
    } finally {
      setIsInitiatingCall(false);
    }
  }, [currentCounselor, getAuthToken, resolveCurrentUserId, resolveCounselorId]);

  const handleVideoCall = useCallback(() => initiateVideoCall(), [initiateVideoCall]);
  const handleVoiceCall = useCallback(() => initiateVoiceCall(), [initiateVoiceCall]);
  
  const handleCloseModal = useCallback(() => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setCallError(null);
    loadCallHistory();

    // Opened purely to host a call started elsewhere (My Appointments): go back
    // there instead of leaving the user sitting in a chat they didn't open.
    if (launchedCallRef.current) {
      launchedCallRef.current = false;
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [loadCallHistory, navigation]);

  // Initialize chat and fetch messages
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
        let chat = savedChats.find(c => c.chatId === chatId) || savedChats.find(c => c.counselorId === counselorId);

        if (chat) {
          setCurrentChat(chat);
          if (chat.counselor) setCurrentCounselor(chat.counselor);
          if (chat.messages && chat.messages.length > 0) {
            initialLoadDoneRef.current = false;
            shouldAutoScrollRef.current = true;
            // Restore BOTH halves of the timeline before painting. Restoring
            // only the messages is what made the thread appear first and the
            // call bubbles drop in afterwards.
            try {
              const cachedCalls = await AsyncStorage.getItem(
                // Same precedence as getChatIdForAPI(), which writes the key.
                `callHistory_${chatId || chat.chatId || ''}`,
              );
              if (cachedCalls) setCallHistory(JSON.parse(cachedCalls) || []);
            } catch (_) { /* cache is best-effort */ }
            setMessages(chat.messages);
            setTimelineReady(true);
          }
          
          if (chat.unread) {
            const updatedChats = savedChats.map(c => c.id === chat.id ? { ...c, unread: false } : c);
            await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
          }
        } else if (initialCounselor) {
          const newChat = {
            id: Date.now(),
            chatId: chatId || `chat_${Date.now()}`,
            counselorId: counselorId,
            counselor: initialCounselor,
            user: initialUser || { name: "User", email: "user@example.com" },
            messages: [],
            unread: false,
            startedAt: new Date().toISOString(),
          };
          setCurrentChat(newChat);
          const updatedChats = [...savedChats, newChat];
          await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
        }

        const silentFetch = messagesCountRef.current > 0 || (chat && chat.messages && chat.messages.length > 0);
        // Resolve the peer id from what we just read, NOT from state — the
        // setState calls above have not been applied yet at this point.
        const peerId =
          chat?.counselor?._id || chat?.counselor?.id || chat?.counselorId ||
          initialCounselor?._id || initialCounselor?.id || counselorId || null;
        // Load messages + call history in parallel so they appear together.
        await Promise.all([
          fetchMessagesFromAPI(silentFetch),
          loadCallHistory(peerId ? { peerId: String(peerId) } : {}),
        ]);
        setTimelineReady(true);
        
        setTimeout(() => {
          if (messageInputRef.current) messageInputRef.current.focus();
        }, 500);
      } catch (error) {
        console.error("Error loading chat:", error);
        // Never leave the thread stuck behind the spinner because one of the
        // two requests failed.
        setTimelineReady(true);
      }
    };

    initializeChat();
    // Safety net: if either request hangs, show whatever we have rather than
    // spinning forever.
    const readyGuard = setTimeout(() => setTimelineReady(true), 6000);
    // NOTE: deliberately NOT depending on fetchMessagesFromAPI / loadCallHistory.
    // Those callbacks change identity whenever currentChat changes, and this
    // effect calls setCurrentChat() — so including them created an infinite
    // init→setCurrentChat→callback-identity-change→re-init loop that refetched
    // the whole thread constantly (messages "reloaded" on every send, and a
    // just-deleted message kept reappearing/flickering until the server delete
    // finished). The web ChatBox depends only on these four values too.
    return () => clearTimeout(readyGuard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counselorId, chatId, initialCounselor, initialUser]);

  // Save messages to AsyncStorage
  useEffect(() => {
    const saveMessages = async () => {
      if (currentChat && messages.length > 0) {
        try {
          const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
          const updatedChats = savedChats.map(chat => {
            if (chat.id === currentChat.id) {
              return {
                ...chat,
                messages: messages,
                lastMessage: messages[messages.length - 1]?.text,
                lastMessageTime: messages[messages.length - 1]?.time,
                unread: false,
                chatStatus: chatStatus,
              };
            }
            return chat;
          });
          await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
        } catch (error) {
          console.error("Error saving messages:", error);
        }
      }
    };
    saveMessages();
  }, [messages, currentChat, chatStatus]);

  // Socket connection for real-time chat
  useEffect(() => {
    const apiChatId = chatId || currentChat?.chatId;
    if (!apiChatId) return;

    const setupSocket = async () => {
      const token = await getAuthToken();
      if (!token) return;

      const unsubscribers = [];
      try {
        const socket = await socketService.connect();
        chatSocketRef.current = socket;
        setIsSocketConnected(!!socket?.connected);

        const onConnect = () => {
          setIsSocketConnected(true);
          socket.emit("join-chat", { chatId: apiChatId });
        };

        unsubscribers.push(await socketService.on('connect', onConnect));
        unsubscribers.push(await socketService.on('disconnect', () => setIsSocketConnected(false)));

        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          const counselorKey = resolveCounselorId();
          if (!counselorKey || String(userId) !== String(counselorKey)) return;
          setCurrentCounselor((prev) => prev ? { ...prev, online: !!isOnline, status: isOnline ? 'online' : 'offline', lastSeen: lastSeen || prev.lastSeen || null } : prev);
        }));

        unsubscribers.push(await socketService.on('new-message', (messageData) => {
          const userId = resolveCurrentUserId();
          const isOwn = messageData.senderRole === 'user' && String(messageData.senderId) === String(userId);
          const transformedMessage = {
            id: messageData.id || messageData.messageId || `rt_${Date.now()}`,
            messageId: messageData.messageId,
            text: messageData.content,
            sender: isOwn ? 'user' : 'counselor',
            senderRole: messageData.senderRole,
            time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullTime: messageData.createdAt,
            contentType: messageData.contentType,
            attachmentType: messageData.attachmentType || messageData.contentType || null,
            attachmentUrl: messageData.attachmentUrl || null,
            attachmentName: messageData.attachmentName || null,
            isRead: messageData.isRead,
            status: 'sent',
          };
          // Match the counselor screen: a new message pins to newest and the
          // content-size change performs the scroll.
          shouldAutoScrollRef.current = true;
          setMessages(prev => {
            // We already have this exact message (e.g. our POST response landed
            // first) — nothing to do.
            if (prev.some(msg => msg.messageId && messageData.messageId && msg.messageId === messageData.messageId)) return prev;
            // Our own echo: swap the optimistic "sending" bubble in place so it
            // never flickers/disappears. (Previously it was removed and only
            // re-added by the HTTP response, so the bubble blinked out.)
            if (isOwn) {
              const tempIndex = prev.findIndex(m => m.isTemporary);
              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = transformedMessage;
                return next;
              }
            }
            return [...prev, transformedMessage];
          });
        }));

        unsubscribers.push(await socketService.on('user-typing', ({ userRole, isTyping: typing }) => {
          if (userRole !== 'user') setRemoteIsTyping(typing);
        }));

        unsubscribers.push(await socketService.on('messages-read', () => {
          setMessages(prev => prev.map(msg => msg.sender === 'user' ? { ...msg, isRead: true } : msg));
        }));

        unsubscribers.push(await socketService.on('chat-status-update', ({ status, chatId: updatedChatId }) => {
          if (updatedChatId === apiChatId) {
            setChatStatus(status);
            setCurrentChat(prev => prev ? { ...prev, status } : prev);
          }
        }));

        unsubscribers.push(await socketService.on('connect_error', (err) => {
          setIsSocketConnected(false);
          console.error('Chat shared socket connection error:', err?.message || err);
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
  }, [chatId, currentChat?.chatId, getAuthToken, scrollToBottom, resolveCurrentUserId, resolveCounselorId]);

  const handleTypingIndicator = useCallback(() => {
    const apiChatId = chatId || currentChat?.chatId;
    if (!chatSocketRef.current || !apiChatId) return;

    chatSocketRef.current.emit("typing", { chatId: apiChatId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (chatSocketRef.current) {
        chatSocketRef.current.emit("typing", { chatId: apiChatId, isTyping: false });
      }
    }, 2000);
  }, [chatId, currentChat?.chatId]);

  // Fallback polling
  useEffect(() => {
    const interval = setInterval(() => {
      // Silent = background refresh that must not disturb the user's scroll.
      // Skip if we just deleted a message — the server needs 5 seconds to confirm
      // before a refetch tries to re-add it (avoid the delete flicker).
      if (!isSocketConnected && currentChat && !deletedRecentlyRef.current) {
        fetchMessagesFromAPI(true);
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [currentChat, isSocketConnected, fetchMessagesFromAPI]);

  // Auto-refresh when screen comes into focus (user navigates back to ChatBox)
  useFocusEffect(
    useCallback(() => {
      // Silently refresh messages so they're up-to-date when user enters the screen
      if (currentChat && !deletedRecentlyRef.current) {
        fetchMessagesFromAPI(true);
      }
    }, [currentChat, fetchMessagesFromAPI])
  );

  const handleInputChange = (text) => {
    setNewMessage(text);
    if (text.trim() !== "") handleTypingIndicator();
  };

  const confirmDeleteCall = useCallback((item) => {
    setConfirmState({
      visible: true,
      title: 'Delete Call',
      message: `Remove this ${item.type === 'video' ? 'video' : 'voice'} call from the chat?\n\nThis action cannot be undone.`,
      destructive: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onCancel: () => setConfirmState(s => ({ ...s, visible: false })),
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, visible: false }));
        await hideCallEntry(item.id);
      },
    });
  }, [hideCallEntry]);

  // Counselor identity — declared before renderMessage so its deps are in scope.
  const counselorName = currentCounselor?.displayName || currentCounselor?.name || "Counselor";
  const counselorOnline = resolveOnlineStatus(currentCounselor);
  const counselorProfilePhoto = getProfilePhotoUrl(currentCounselor);
  // Header shows a short handle (max 8 chars) so long names don't crowd the bar.
  const counselorShortName =
    counselorName.length > 8 ? `${counselorName.slice(0, 8)}…` : counselorName;

  const renderCallItem = useCallback((item) => {
    const { isOutgoing, isAlert, statusLabel, durationText } = describeCall(item);
    const isSelected = selectedMessageId === item.id;

    return (
      <>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => setSelectedMessageId(item.id)}
          style={[styles.messageRow, isOutgoing ? styles.messageRowRight : styles.messageRowLeft]}
        >
          <View style={[styles.callBubble, isOutgoing ? styles.callBubbleOut : styles.callBubbleIn]}>
            <View style={styles.callIconCircle}>
              <Ionicons
                name={item.type === "video" ? "videocam" : "call"}
                size={18}
                color="#00652C"
              />
            </View>
            <View style={styles.callTextWrap}>
              <Text style={styles.callTitle}>
                {isOutgoing ? "Outgoing" : "Incoming"} {item.type === "video" ? "Video" : "Voice"} Call
              </Text>
              <View style={styles.callMetaRow}>
                <Ionicons
                  name={isAlert ? "arrow-down-outline" : isOutgoing ? "arrow-up-outline" : "arrow-down-outline"}
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
        {/* Call delete menu - Only Delete option */}
        <Modal transparent visible={isSelected} animationType="fade" onRequestClose={() => setSelectedMessageId(null)}>
          <TouchableOpacity style={styles.actionMenuOverlay} activeOpacity={1} onPress={() => setSelectedMessageId(null)}>
            <View style={styles.actionMenuBox}>
              <Text style={styles.actionMenuTitle}>{item.type === 'video' ? t('Video Call') : t('Voice Call')}</Text>
              <View style={styles.actionMenuDivider} />
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setSelectedMessageId(null);
                  confirmDeleteCall(item);
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                <Text style={[styles.actionMenuItemText, { color: '#dc2626', fontWeight: '600' }]}>{t('Delete Call')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }, [confirmDeleteCall, selectedMessageId]);

  const renderMessage = useCallback(({ item }) => {
    if (item.isCall) return renderCallItem(item);

    if (item.isDaySeparator) {
      return (
        <View style={styles.daySeparatorRow}>
          <View style={styles.daySeparatorLine} />
          <Text style={styles.daySeparatorLabel}>{t(item.label)}</Text>
          <View style={styles.daySeparatorLine} />
        </View>
      );
    }

    const isUser = item.sender === "user";
    const isDeleting = String(deletingMessageId) === String(item.id) ||
                       String(deletingMessageId) === String(item.messageId);
    const canDelete = !item.isTemporary && item.status !== "sending" && item.status !== "error";

    // Check if this is an image-only message (image with no text)
    const hasAttachment = item.attachmentName || item.attachmentUrl || item.attachment;
    const url = hasAttachment ? getAttachmentUrl(item) : '';
    const isImage = hasAttachment ? isImageAttachment(item) : false;

    // The API keeps an attachment's URL/filename in `content`, which the message
    // mapper assigns to `text` - so a picture arrived with its own URL (or
    // "screenshot.png") printed above it. Suppressed only when the text really
    // duplicates the attachment, so a genuine caption sent with an image stays.
    const rawText = String(item.text || '').trim();
    const textDuplicatesAttachment =
      !!hasAttachment &&
      !!rawText &&
      (rawText === url.trim() ||
        rawText === String(item.attachmentName || '').trim() ||
        rawText === url.split('/').pop());
    const hasText = !!rawText && !textDuplicatesAttachment;

    const isImageOnly = hasAttachment && !hasText && isImage && url && !failedImageUrls.has(url);

    const handleDeleteMessage = async () => {
      if (!canDelete) return;
      Alert.alert(
        "Delete Message",
        "Delete this message? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteMessage(item.id);
            },
          },
        ],
      );
    };

    // Bubble inner content — shared by the gradient (sent) and plain (received)
    // wrappers so both look identical apart from the background.
    const inner = (
      <>
        {hasText && (
          <TranslatedMessageBubble
            text={item.text}
            isUser={isUser}
            style={[styles.messageText, isUser ? styles.userMessageText : styles.counselorMessageText]}
          />
        )}
        {(item.attachmentName || item.attachmentUrl) && (() => {
          const url = getAttachmentUrl(item);
          const name = item.attachmentName || '';
          const isImage = isImageAttachment(item);
          const imageFailedToLoad = failedImageUrls.has(url);

          if (isImage && url && !imageFailedToLoad) {
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setZoomImageUrl(url)}
                style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#f0f0f0' }}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.attachmentImage}
                  resizeMode="cover"
                  onError={() => {
                    setFailedImageUrls(prev => new Set([...prev, url]));
                  }}
                />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openAttachment(url)}>
              <View style={[styles.attachmentBubble, isUser ? styles.userAttachmentBubble : styles.counselorAttachmentBubble]}>
                <Ionicons name="document-text-outline" size={16} color={isUser ? '#ffffff' : '#6366f1'} />
                <Text
                  style={[styles.attachmentBubbleText, isUser ? styles.userAttachmentBubbleText : styles.counselorAttachmentBubbleText]}
                  numberOfLines={1}
                >
                  📎 {name || 'Attachment'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })()}
      </>
    );

    // Time + read-receipt row — sits BELOW the bubble (per design).
    const metaRow = (
      <View style={[styles.metaRow, isUser && styles.metaRowRight]}>
        <Text style={styles.metaTime}>{item.time}</Text>
        {isUser && item.status === "sending" && <Text style={styles.metaStatus}>⌛</Text>}
        {isUser && item.status === "sent" && (
          <Ionicons
            name={item.isRead ? "checkmark-done" : "checkmark"}
            size={15}
            // #94a3b8 on the light chat background was 2.3:1 - below the 3:1
            // minimum for icons, hence "visible on my phone, not on others".
            color={item.isRead ? "#00652C" : "#64748B"}
          />
        )}
        {isUser && item.status === "error" && <Text style={styles.metaError}>⚠️ Failed</Text>}
      </View>
    );

    return (
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={() => canDelete && handleDeleteMessage()}
        style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}
      >
        <View style={[styles.messageBubble, { maxWidth: bubbleMaxWidth }, isUser ? styles.messageRight : styles.messageLeft]}>
          {isUser ? (
            <LinearGradient
              colors={BRAND_GRADIENT}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={[styles.messageContent, styles.userMessageContent, { alignSelf: "flex-end" }, isDeleting && styles.messageDeleting]}
            >
              {inner}
            </LinearGradient>
          ) : (
            <View style={[styles.messageContent, styles.counselorMessageContent, { alignSelf: "flex-start" }, isDeleting && styles.messageDeleting]}>
              {inner}
            </View>
          )}

          {/* Below-bubble row: counselor avatar (incoming) + time + ticks */}
          {isUser ? (
            metaRow
          ) : (
            <View style={styles.incomingMetaRow}>
              <View style={styles.msgAvatar}>
                {counselorProfilePhoto && !counselorAvatarFailed ? (
                  <Image source={{ uri: counselorProfilePhoto }} style={styles.msgAvatarImg} />
                ) : (
                  <View style={styles.msgAvatarFallback}>
                    <Text style={styles.msgAvatarText}>{getInitials(counselorName)}</Text>
                  </View>
                )}
              </View>
              {metaRow}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [renderCallItem, deleteMessage, openAttachment, deletingMessageId, bubbleMaxWidth, counselorProfilePhoto, counselorAvatarFailed, counselorName]);

  const renderChatStatusBanner = () => {
    if (!chatStatus || chatStatus === "accepted") return null;

    let statusText = "";
    let statusStyle = {};
    switch (chatStatus) {
      case "pending":
        statusText = "⏳ Waiting for counselor to accept...";
        statusStyle = styles.statusPending;
        break;
      case "ended":
        statusText = "🔒 Session ended";
        statusStyle = styles.statusEnded;
        break;
      default: return null;
    }
    return (
      <View style={[styles.chatStatusBanner, statusStyle]}>
        <Text style={styles.chatStatusText}>{statusText}</Text>
      </View>
    );
  };

  useEffect(() => {
    setCounselorAvatarFailed(false);
  }, [counselorProfilePhoto]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      {/* KeyboardAvoidingView measures this view's real frame vs the keyboard
          frame, so it self-corrects whether or not the OS resized the window
          (adjustResize is ignored under Android 15 edge-to-edge). Enabled on
          BOTH platforms — the old manual padding never worked there. */}
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoid}
      >
        <View style={styles.chatBoxMain}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#081625" />
              </TouchableOpacity>
              <View style={styles.userDetails}>
                <View style={styles.profilePic}>
                  {counselorProfilePhoto && !counselorAvatarFailed ? (
                    <Image
                      source={{ uri: counselorProfilePhoto }}
                      style={styles.profileAvatarImage}
                      onError={() => setCounselorAvatarFailed(true)}
                    />
                  ) : (
                    <LinearGradient
                      colors={BRAND_GRADIENT}
                      start={GRADIENT_START}
                      end={GRADIENT_END}
                      style={styles.profileAvatar}
                    >
                      <Text style={styles.profileInitials}>{getInitials(counselorName)}</Text>
                    </LinearGradient>
                  )}
                  <View style={[styles.activeDot, counselorOnline ? styles.onlineDot : styles.offlineDot]} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
                    {counselorShortName}
                  </Text>
                  <View style={styles.profileStatusRow}>
                    {remoteIsTyping ? (
                      <Text style={styles.typingText}>{t('Typing...')}</Text>
                    ) : (
                      <>
                        <View style={[styles.statusDot, counselorOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
                        <Text style={styles.statusText}>{counselorOnline ? "Online" : "Offline"}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.disabledBtn]} onPress={handleVideoCall} disabled={isInitiatingCall}>
                <Ionicons name="videocam" size={21} color={PATIENT.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.disabledBtn]} onPress={handleVoiceCall} disabled={isInitiatingCall}>
                <Ionicons name="call" size={19} color={PATIENT.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowOptions(!showOptions)}>
                <Ionicons name="ellipsis-vertical" size={18} color={PATIENT.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Options Modal */}
          <Modal transparent visible={showOptions} animationType="fade" onRequestClose={() => setShowOptions(false)}>
            <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
              <View style={styles.optionsMenu}>
                <TouchableOpacity style={styles.optionItem} onPress={() => { fetchMessagesFromAPI(); setShowOptions(false); }}>
                  <Ionicons name="refresh" size={18} color="#526071" />
                  <Text style={styles.optionText}>{t('Refresh Messages')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionItem, styles.optionItemLast]} onPress={() => { setShowOptions(false); deleteWholeChat(); }}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text style={[styles.optionText, styles.optionTextDanger]}>{t('Delete Chat')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {renderChatStatusBanner()}

          {callError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
              <Text style={styles.errorText}>{callError}</Text>
              <TouchableOpacity onPress={() => setCallError(null)}>
                <Ionicons name="close" size={20} color="#ba1a1a" />
              </TouchableOpacity>
            </View>
          )}

          {!timelineReady ? (
            <ChatSkeleton role="user" />
          ) : (
            <FlatList
              ref={flatListRef}
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
                    <Text style={styles.typingLabel}>{counselorName} is typing...</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                <View style={styles.welcomeCard}>
                  <View style={styles.welcomeAvatar}>
                    <Text style={styles.welcomeInitials}>{getInitials(counselorName)}</Text>
                  </View>
                  <View style={styles.welcomeMsg}>
                    <Text style={styles.welcomeTitle}>Welcome to your session with {counselorName}</Text>
                    <Text style={styles.welcomeDesc}>
                      This is a safe space to share your thoughts and feelings. Everything discussed here is confidential.
                    </Text>
                    <Text style={styles.welcomeTime}>
                      {new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              }
            />
          )}

          {/* Emoji Picker Modal */}
          <Modal transparent visible={showEmojiPicker} animationType="slide" onRequestClose={() => setShowEmojiPicker(false)}>
            <TouchableOpacity style={styles.emojiOverlay} activeOpacity={1} onPress={() => setShowEmojiPicker(false)}>
              <View style={[styles.emojiPicker, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.emojiHeader}>
                  <Text style={styles.emojiTitle}>{t('Emojis')}</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Ionicons name="close" size={24} color="#74777c" />
                  </TouchableOpacity>
                </View>
                <View style={styles.emojiGrid}>
                  {["😊", "😂", "❤️", "👍", "🔥", "🎉", "🙏", "💯"].map((emoji, index) => (
                    <TouchableOpacity key={index} style={styles.emojiItem} onPress={() => {
                      setNewMessage(prev => prev + emoji);
                      setShowEmojiPicker(false);
                      messageInputRef.current?.focus();
                    }}>
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          <ConfirmModal
            visible={confirmState.visible}
            title={confirmState.title}
            message={confirmState.message}
            destructive={confirmState.destructive}
            onCancel={confirmState.onCancel || (() => setConfirmState(s => ({ ...s, visible: false })))}
            onConfirm={confirmState.onConfirm || (() => setConfirmState(s => ({ ...s, visible: false })))}
            confirmText={confirmState.confirmText}
            cancelText={confirmState.cancelText}
          />

          {/* Input Area */}
          <View style={styles.inputArea}>
            <View style={styles.inputAreaInner}>
            {pendingAttachment && (
              <View style={styles.attachmentPreview}>
                <Ionicons name="attach" size={16} color={PATIENT.primary} />
                <Text style={styles.attachmentPreviewText} numberOfLines={1}>
                  {pendingAttachment.name}
                </Text>
                <TouchableOpacity onPress={() => setPendingAttachment(null)}>
                  <Ionicons name="close-circle" size={18} color="#74777c" />
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.inputGroup, isSending && styles.inputGroupDisabled]}>
              <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment} disabled={isSending}>
                <Ionicons name="attach" size={22} color={PATIENT.textSecondary} />
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={messageInputRef}
                  style={styles.textInput}
                  value={newMessage}
                  onChangeText={handleInputChange}
                  placeholder={t('Type a message...')}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  blurOnSubmit={false}
                  enablesReturnKeyAutomatically
                />
              </View>
              <TouchableOpacity
                onPress={handleSendMessage}
                activeOpacity={0.8}
                disabled={isSending}
                style={[
                  styles.sendBtn,
                  { backgroundColor: (newMessage.trim() === "" && !pendingAttachment) ? "#A7D3B7" : PATIENT.primary },
                ]}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send" size={19} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <VideoCallModal
        isOpen={isVideoModalOpen}
        onClose={handleCloseModal}
        callData={selectedCall}
        currentUser={currentUser}
        onEndCall={handleEndCall}
      />

      <VoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={handleCloseModal}
        callData={selectedCall}
        currentUser={currentUser}
        onEndCall={handleEndCall}
      />

      <ZoomableImageViewer
        visible={!!zoomImageUrl}
        uri={zoomImageUrl}
        onClose={() => setZoomImageUrl(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: PATIENT.backgroundTint,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatBoxMain: {
    flex: 1,
    width: '100%',
    backgroundColor: PATIENT.backgroundTint,
  },
  // Header Styles - Balanced
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  profilePic: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  activeDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  onlineDot: {
    backgroundColor: PATIENT.online,
  },
  offlineDot: {
    backgroundColor: "#94a3b8",
  },
  profileInfo: {
    flex: 1,
    flexDirection: "column",
    minWidth: 0,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Manrope" : "System",
  },
  profileStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOnline: {
    backgroundColor: PATIENT.online,
  },
  statusDotOffline: {
    backgroundColor: "#94a3b8",
  },
  statusText: {
    fontSize: 12,
    color: PATIENT.online,
    fontWeight: "500",
  },
  typingText: {
    fontSize: 12,
    color: PATIENT.primary,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 19,
    lineHeight: 19,
    includeFontPadding: false,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  // Options Modal
  optionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 16,
  },
  optionsMenu: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    minWidth: 200,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4f6",
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#191c1e",
  },
  optionTextDanger: {
    color: "#dc2626",
    fontWeight: "700",
  },
  // Chat Status Banner
  chatStatusBanner: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderBottomWidth: 1,
    borderBottomColor: "#c8e6c9",
  },
  statusPending: {
    backgroundColor: "#f1f8e9",
    borderBottomColor: "#dcedc8",
  },
  statusEnded: {
    backgroundColor: "#ffebee",
    borderBottomColor: "#ffcdd2",
  },
  chatStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2e7d32",
  },
  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffdad6",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: "#93000a",
    fontSize: 13,
    fontWeight: "500",
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#74777c",
  },
  // Messages List
  messagesList: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
    flexGrow: 1,
  },
  daySeparatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  daySeparatorLine: { width: 0, height: 0 },
  daySeparatorLabel: { fontSize: 11, fontWeight: '600', color: PATIENT.textSecondary, backgroundColor: '#EDEFF3', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  callBubbleRight: { alignSelf: 'flex-end', backgroundColor: '#e8eaff', borderColor: '#c7d2fe' },
  callBubbleLeft: { alignSelf: 'flex-start', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  callBubbleText: { flex: 1, fontSize: 13, color: '#334155' },
  callBubbleMeta: { fontSize: 11, color: '#64748b', marginLeft: 6 },
  welcomeCard: {
    flexDirection: "row",
    backgroundColor: "#eef2ff",
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  welcomeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeInitials: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  welcomeMsg: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#081625",
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: 12,
    color: "#44474c",
    marginBottom: 6,
    lineHeight: 16,
  },
  welcomeTime: {
    fontSize: 10,
    color: "#74777c",
  },
  // Message Bubbles - Serenity Design
  messageRow: {
    flexDirection: "row",
    marginBottom: 8,
    width: "100%",
    paddingHorizontal: 0,
  },
  messageRowLeft: {
    justifyContent: "flex-start",
    paddingRight: 0,
  },
  messageRowRight: {
    justifyContent: "flex-end",
    paddingLeft: 0,
  },
  messageAvatarContainer: {
    width: 36,
    height: 36,
    marginRight: 8,
    alignSelf: "flex-end",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#d5e4f8",
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#d5e4f8",
    justifyContent: "center",
    alignItems: "center",
  },
  messageAvatarInitials: {
    fontSize: 12,
    fontWeight: "700",
    color: "#081625",
  },
  messageAvatarSpacer: {
    width: 32,
    height: 32,
  },
  messageBubble: {
    maxWidth: "80%",
    flexShrink: 1,
  },
  messageRight: {
    alignSelf: "flex-end",
  },
  messageLeft: {
    alignSelf: "flex-start",
  },
  // Call entry bubble
  callBubble: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 215,
    maxWidth: "82%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6e8ea",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  callBubbleOut: {
    backgroundColor: "#ffffff",
    borderColor: "#e6e8ea",
    borderBottomRightRadius: 4,
  },
  callBubbleIn: {
    borderBottomLeftRadius: 4,
  },
  callIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E6F6EC",
    justifyContent: "center",
    alignItems: "center",
  },
  callIconCircleAlert: {
    backgroundColor: "#E6F6EC",
  },
  // NOTE: must be flexShrink (not flex:1) — callBubble sizes to its content,
  // so flex:1 here collapses the text to zero width.
  callTextWrap: {
    flexShrink: 1,
  },
  callTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  callMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  callMeta: {
    fontSize: 12,
    color: "#64748b",
  },
  callMetaAlert: {
    color: "#ef4444",
    fontWeight: "600",
  },
  callTime: {
    fontSize: 11,
    color: "#94a3b8",
    alignSelf: "flex-start",
    marginLeft: "auto",
    paddingLeft: 8,
  },
  callDeleteBtn: {
    alignSelf: "flex-start",
    padding: 2,
  },
  // Bubble now holds only text/image (time moved below), so it gets real padding.
  messageContent: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
  },
  userMessageContent: {
    shadowColor: PATIENT.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  counselorMessageContent: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#EDF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  messageDeleting: {
    opacity: 0.5,
  },
  // Time + ticks row BELOW the bubble
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  metaRowRight: {
    alignSelf: "flex-end",
  },
  metaTime: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  metaStatus: {
    fontSize: 11,
  },
  metaError: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "600",
  },
  incomingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  msgAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
  },
  msgAvatarImg: {
    width: "100%",
    height: "100%",
  },
  msgAvatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: PATIENT.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  msgAvatarText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: Platform.OS === "ios" ? "Manrope" : "System",
    flexShrink: 1,
  },
  userMessageText: {
    color: "#ffffff",
  },
  counselorMessageText: {
    color: "#1F2937",
  },
  attachmentImage: {
    width: 224,
    height: 168,
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  attachmentBubble: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userAttachmentBubble: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  counselorAttachmentBubble: {
    backgroundColor: "#f1f5f9",
  },
  attachmentBubbleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  userAttachmentBubbleText: {
    color: "#ffffff",
  },
  counselorAttachmentBubbleText: {
    color: "#526071",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: 8,
    paddingBottom: 1,
  },
  messageTime: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  messageTimeMine: {
    color: "#cbd5e1",
  },
  messageStatusSending: {
    fontSize: 10,
    color: "#f59e0b",
  },
  messageStatusIconWrap: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  messageStatusSent: {
    fontSize: 10,
    color: "#94a3b8",
  },
  messageStatusRead: {
    fontSize: 10,
    color: "#34B7F1",
  },
  messageStatusError: {
    fontSize: 10,
    color: "#f44336",
  },
  deleteIconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 4,
  },
  // Typing Indicator
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#eef2f6",
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366f1",
    opacity: 0.6,
  },
  typingDotDelay1: {
    opacity: 0.4,
  },
  typingDotDelay2: {
    opacity: 0.2,
  },
  typingLabel: {
    fontSize: 12,
    color: "#526071",
    fontStyle: "italic",
  },
  // Input Area
  inputArea: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  inputAreaInner: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  inputGroupDisabled: {
    opacity: 0.8,
    backgroundColor: "#f8f9fa",
  },
  attachmentPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  attachmentPreviewText: {
    flex: 1,
    color: "#081625",
    fontSize: 12,
    fontWeight: "500",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF1FA",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#E4E8F4",
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  textInput: {
    flex: 1,
    paddingVertical: 2,
    paddingRight: 8,
    paddingLeft: 6,
    fontSize: 15,
    color: "#081625",
    maxHeight: 100,
    minHeight: 32,
  },
  emojiBtn: {
    position: "absolute",
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PATIENT.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  // Emoji Picker Modal
  emojiOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  emojiPicker: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: 220, },
  emojiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4f6",
  },
  emojiTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#081625",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    justifyContent: "space-around",
  },
  emojiItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f2f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emojiText: {
    fontSize: 24,
  },
  // Confirm Modal Styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBox: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#081625',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#526071',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: '#f2f4f6',
  },
  confirmBtnConfirm: {
    backgroundColor: '#6366f1',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#081625',
  },
  confirmDestructive: {
    backgroundColor: '#ba1a1a',
  },
  // Incoming Call Modal Styles
  incomingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  incomingModal: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    overflow: "hidden",
  },
  videoCallModal: {
    borderTopWidth: 4,
    borderTopColor: "#6366f1",
  },
  voiceCallModal: {
    borderTopWidth: 4,
    borderTopColor: "#10b981",
  },
  incomingModalContent: {
    padding: 24,
  },
  incomingCallerInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  incomingCallerAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#d5e4f8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  incomingAvatarImage: {
    width: "100%",
    height: "100%",
  },
  incomingAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  incomingAvatarText: {
    fontSize: 48,
  },
  incomingCallerName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#081625",
    marginBottom: 4,
  },
  incomingCallType: {
    fontSize: 14,
    color: "#526071",
    marginBottom: 4,
  },
  incomingCallTime: {
    fontSize: 12,
    color: "#8492a5",
    marginBottom: 8,
  },
  incomingCallMessage: {
    fontSize: 13,
    color: "#74777c",
    fontStyle: "italic",
  },
  incomingCallControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  incomingCallBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: "center",
  },
  acceptCallBtn: {
    backgroundColor: "#10b981",
  },
  rejectCallBtn: {
    backgroundColor: "#ba1a1a",
  },
  incomingCallBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 240,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  actionMenuTitle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: '#8892a5',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: '#f0f3f8',
    marginVertical: 4,
  },
  actionMenuItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 12,
  },
  actionMenuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ChatBox;