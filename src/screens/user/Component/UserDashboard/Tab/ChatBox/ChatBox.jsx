import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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
  Platform,
  StatusBar,
  Dimensions,
  StyleSheet,
  InteractionManager,
} from "react-native";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../../../../../../axiosConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { launchImageLibrary } from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";
import VideoCallModal from "../CallModal/VideoCallModal";
import VoiceCallModal from "../CallModal/VoiceCallModal";

const { width: screenWidth } = Dimensions.get("window");

// Professional Incoming Call Modal Component
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

  const displayName = callData?.from?.fullName || callData?.from?.displayName || callerName || "Counselor";
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
        <View style={[styles.incomingModal, callType === "video" ? styles.videoCallModal : styles.voiceCallModal]}>
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
              <Text style={styles.incomingCallType}>
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
                  <Text style={styles.incomingCallBtnText}>Decline</Text>
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
                  <Text style={styles.incomingCallBtnText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Performance Optimized Message Component
const MessageItem = memo(({ item, isUser }) => {
  return (
    <View style={[styles.messageBubble, isUser ? styles.messageRight : styles.messageLeft]}>
      <View style={[styles.messageContent, isUser ? styles.userMessageContent : styles.counselorMessageContent]}>
        {!!item.text && (
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.counselorMessageText]}>
            {item.text}
          </Text>
        )}
        {(item.attachmentName || item.attachmentUrl) && (
          <View style={[styles.attachmentBubble, isUser ? styles.userAttachmentBubble : styles.counselorAttachmentBubble]}>
            <Text
              style={[styles.attachmentBubbleText, isUser ? styles.userAttachmentBubbleText : styles.counselorAttachmentBubbleText]}
              numberOfLines={1}
            >
              📎 {item.attachmentName || "Attachment"}
            </Text>
          </View>
        )}
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>{item.time}</Text>
          {isUser && item.status === "sending" && <Text style={styles.messageStatusSending}>⌛ Sending...</Text>}
          {isUser && item.status === "sent" && <Text style={styles.messageStatusSent}>✓ Sent</Text>}
          {isUser && item.status === "error" && <Text style={styles.messageStatusError}>⚠️ Failed</Text>}
        </View>
      </View>
    </View>
  );
});

const ChatBox = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id: counselorId } = route.params || {};
  const { chatId, counselor: initialCounselor, user: initialUser } = route.params || {};

  // State for current chat
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);

  const [currentCounselor, setCurrentCounselor] = useState(() => {
    if (initialCounselor) {
      return initialCounselor;
    }
    return {
      id: counselorId || null,
      name: "Dr. Suresh Reddy",
      specialization: "Clinical Psychologist",
      online: true,
      avatar: null,
      avatarType: "text",
      profilePhoto: null,
      phoneNumber: "+91 98765 43215",
    };
  });

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

  const [newMessage, setNewMessage] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [counselorAvatarFailed, setCounselorAvatarFailed] = useState(false);
  const [chatStatus, setChatStatus] = useState(null);

  const flatListRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatSocketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fallbackChatIdRef = useRef(chatId || null);
  const hasInitialAutoScrollRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const initialScrollRetryTimeoutRef = useRef(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

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

  const resolveCurrentUserId = () => currentUser?.id || currentUser?._id || null;
  const resolveCounselorId = () => currentCounselor?.id?.toString() || currentCounselor?._id?.toString() || counselorId || currentChat?.counselorId?.toString() || null;

  const getProfilePhotoUrl = (counselor) => {
    if (!counselor) return null;
    if (counselor?.profilePhoto?.url) return counselor.profilePhoto.url;
    if (
      counselor?.profilePhoto &&
      typeof counselor.profilePhoto === "string" &&
      counselor.profilePhoto.startsWith("http")
    ) {
      return counselor.profilePhoto;
    }
    if (
      counselor?.avatar &&
      typeof counselor.avatar === "string" &&
      counselor.avatar.startsWith("http")
    ) {
      return counselor.avatar;
    }
    if (counselor?.avatar && counselor.avatarType === "image") return counselor.avatar;
    return null;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(word => word[0]).join("").toUpperCase().slice(0, 2);
  };

  const scrollToBottom = useCallback((animated = true) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!flatListRef.current) return;
        try {
          flatListRef.current.scrollToEnd({ animated });
        } catch (error) {
          // FlatList can throw if content is not laid out yet; ignore transient race.
        }
      });
    });
  }, []);

  const jumpToLatestMessage = useCallback(() => {
    if (initialScrollRetryTimeoutRef.current) {
      clearTimeout(initialScrollRetryTimeoutRef.current);
    }

    shouldAutoScrollRef.current = true;
    scrollToBottom(false);

    // Retry once after layout settles so the screen opens on the latest message.
    initialScrollRetryTimeoutRef.current = setTimeout(() => {
      scrollToBottom(false);
      initialScrollRetryTimeoutRef.current = null;
    }, 180);
  }, [scrollToBottom]);

  const handleMessagesScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldAutoScrollRef.current = distanceFromBottom <= 120;
  }, []);

  const handleMessagesContentSizeChange = useCallback(() => {
    if (!messages.length) return;

    if (!hasInitialAutoScrollRef.current) {
      hasInitialAutoScrollRef.current = true;
      jumpToLatestMessage();
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollToBottom(true);
    }
  }, [jumpToLatestMessage, messages.length, scrollToBottom]);

  const getChatIdForAPI = () => {
    if (chatId) return chatId;
    if (currentChat?.chatId) return currentChat.chatId;

    if (!fallbackChatIdRef.current) {
      const stableUserId = resolveCurrentUserId() || "user";
      const stableCounselorId = resolveCounselorId() || "counselor";
      fallbackChatIdRef.current = `chat_${stableUserId}_${stableCounselorId}`.replace(/\s+/g, "_");
    }

    return fallbackChatIdRef.current;
  };

  // Call API actions
  const handleAcceptCall = async (callId) => {
    try {
      const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
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
        name: detailedCall?.initiator?.displayName || incomingCallData.name || "Counselor",
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
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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

  // Poll for waiting calls
  useEffect(() => {
    const fetchIncomingCalls = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = resolveCurrentUserId();
        if (!userId || !token || showIncomingModal || isVideoModalOpen || isVoiceModalOpen) return;

        const response = await axios.get(`${API_BASE_URL}/api/video/calls/pending/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const callsList = response.data.pendingRequests || [];
        if (response.data.success && callsList.length > 0) {
          const waitingCall = callsList[0];
          const fromData = waitingCall.from || {};
          const callerFullName = fromData.fullName || fromData.displayName || "Counselor";

          setIncomingCallData({
            callId: waitingCall.callId,
            roomId: waitingCall.roomId,
            name: callerFullName,
            image: fromData.profilePhoto || null,
            callType: waitingCall.callType || "video",
            from: fromData,
            requestMessage: waitingCall.requestMessage,
            requestedAt: waitingCall.requestedAt,
            expiresAt: waitingCall.expiresAt,
            remainingSeconds: waitingCall.remainingSeconds,
          });
          setShowIncomingModal(true);
        }
      } catch (error) {
        console.error("Error polling for calls:", error);
      }
    };

    const interval = setInterval(fetchIncomingCalls, 5000);
    return () => clearInterval(interval);
  }, [showIncomingModal, currentUser, isVideoModalOpen, isVoiceModalOpen]);

  // Fetch messages from API
  const fetchMessagesFromAPI = async () => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await AsyncStorage.getItem("token");
      setIsLoadingMessages(true);

      const response = await axios.get(`${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.data && response.data.messages) {
        if (response.data.chatStatus) setChatStatus(response.data.chatStatus);

        const transformedMessages = response.data.messages.map((msg, index) => ({
          id: msg.id || index,
          messageId: msg.messageId,
          text: msg.content,
          sender: msg.senderRole === "user" ? "user" : "counselor",
          senderRole: msg.senderRole,
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          fullTime: msg.createdAt,
          contentType: msg.contentType,
          attachmentUrl: msg.attachmentUrl || null,
          attachmentName: msg.attachmentName || null,
          isRead: msg.isRead,
          status: "sent",
        }));

        hasInitialAutoScrollRef.current = false;
        shouldAutoScrollRef.current = true;
        setMessages(transformedMessages);
        setTimeout(jumpToLatestMessage, 100);
        return transformedMessages;
      }
    } catch (error) {
      console.error("Error fetching messages from API:", error);
      loadMessagesFromLocalStorage();
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadMessagesFromLocalStorage = useCallback(async () => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
      const chat = savedChats.find(c => c.id === currentChat?.id || c.chatId === getChatIdForAPI());
      if (chat && chat.messages) {
        hasInitialAutoScrollRef.current = false;
        shouldAutoScrollRef.current = true;
        setMessages(chat.messages);
        setTimeout(jumpToLatestMessage, 100);
      }
    } catch (error) {
      console.error("Error loading messages from localStorage:", error);
    }
  }, [currentChat?.id, jumpToLatestMessage]);

  const sendMessageToAPI = async ({ messageContent = "", file = null }) => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await AsyncStorage.getItem("token");
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
        const attachmentName =
          file.name || file.fileName || `attachment_${Date.now()}.jpg`;
        const attachmentType =
          file.type && file.type !== "application/octet-stream"
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
  };

  const handleSendMessage = async () => {
    if ((newMessage.trim() === "" && !pendingAttachment) || isSending) return;

    const messageText = newMessage.trim();
    const attachmentToSend = pendingAttachment;
    const tempUserMessage = {
      id: `temp_${Date.now()}`,
      text: messageText || `📎 ${attachmentToSend?.name || "Attachment"}`,
      sender: "user",
      senderRole: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      status: "sending",
      isTemporary: true,
      attachmentName: attachmentToSend?.name || null,
      attachmentUrl: attachmentToSend?.uri || null,
    };

    shouldAutoScrollRef.current = true;
    setMessages(prev => [...prev, tempUserMessage]);
    setNewMessage("");
    setPendingAttachment(null);
    setShowEmojiPicker(false);
    setIsSending(true);
    setTimeout(scrollToBottom, 50);

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
          attachmentUrl: sentMsg.attachmentUrl || null,
          attachmentName: sentMsg.attachmentName || null,
          isRead: sentMsg.isRead,
          status: "sent",
        }];
      });
      setTimeout(scrollToBottom, 100);
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
      setTimeout(scrollToBottom, 50);
    } finally {
      setIsSending(false);
      if (Platform.OS === "android") {
        setTimeout(() => messageInputRef.current?.focus(), 80);
      }
    }
  };

  const handlePickAttachment = useCallback(async () => {
    if (isSending) return;

    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: 1,
        quality: 0.9,
      });

      if (result.didCancel) return;

      const picked = result?.assets?.[0];
      if (!picked?.uri) {
        Alert.alert("Attachment", "Unable to read selected file.");
        return;
      }

      setPendingAttachment({
        uri: picked.uri,
        name: picked.fileName || `photo_${Date.now()}.jpg`,
        type: picked.type || "image/jpeg",
        size: picked.fileSize || 0,
      });
    } catch (error) {
      console.error("Attachment pick error:", error);
      Alert.alert("Attachment", "Failed to pick file. Please try again.");
    }
  }, [isSending]);

  const initiateVideoCall = async () => {
    if (!currentCounselor) {
      setCallError("Counselor information not available");
      return;
    }

    setIsInitiatingCall(true);
    setCallError(null);

    try {
      const token = await AsyncStorage.getItem("token");
      const initiatorId = resolveCurrentUserId();
      const initiatorName = currentUser?.name || currentUser?.fullName || "User";
      const initiatorType = "user";
      const receiverId = resolveCounselorId();
      const receiverName = currentCounselor.name || "Counselor";
      const receiverType = "counsellor";

      if (!initiatorId || !receiverId) throw new Error("Unable to start call. Missing user/counselor ID.");

      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, {
        initiatorId, initiatorType, receiverId, receiverType, callType: "video",
      }, { headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" } });

      if (response.data && response.data.success) {
        const receiverProfilePhoto = response.data.callData?.receiver?.profilePhoto || getProfilePhotoUrl(currentCounselor) || currentCounselor?.avatar || currentCounselor?.name?.charAt(0) || "👤";
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: response.data.callData?.receiver?.name || receiverName,
          type: "video",
          profilePic: receiverProfilePhoto,
          phoneNumber: currentCounselor?.phoneNumber,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: response.data.callData,
          initiator: response.data.callData?.initiator,
          receiver: response.data.callData?.receiver,
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
  };

  const initiateVoiceCall = async () => {
    if (!currentCounselor) {
      setCallError("Counselor information not available");
      return;
    }

    setIsInitiatingCall(true);
    setCallError(null);

    try {
      const token = await AsyncStorage.getItem("token");
      const initiatorId = resolveCurrentUserId();
      const initiatorName = currentUser?.name || currentUser?.fullName || "User";
      const initiatorType = "user";
      const receiverId = resolveCounselorId();
      const receiverName = currentCounselor.name || "Counselor";
      const receiverType = "counsellor";

      if (!initiatorId || !receiverId) throw new Error("Unable to start call. Missing user/counselor ID.");

      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, {
        initiatorId, initiatorType, receiverId, receiverType, callType: "audio",
      }, { headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" } });

      if (response.data && response.data.success) {
        const receiverProfilePhoto = response.data.callData?.receiver?.profilePhoto || getProfilePhotoUrl(currentCounselor) || currentCounselor?.avatar || currentCounselor?.name?.charAt(0) || "👤";
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: response.data.callData?.receiver?.name || receiverName,
          type: "voice",
          profilePic: receiverProfilePhoto,
          phoneNumber: currentCounselor?.phoneNumber,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: response.data.callData,
          initiator: response.data.callData?.initiator,
          receiver: response.data.callData?.receiver,
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
  };

  const handleVideoCall = () => initiateVideoCall();
  const handleVoiceCall = () => initiateVoiceCall();
  const handleCloseModal = () => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setCallError(null);
  };

  // Initialize chat and fetch messages
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
        let chat = savedChats.find(c => c.id === chatId) || savedChats.find(c => c.counselorId === counselorId);

        if (chat) {
          setCurrentChat(chat);
          if (chat.counselor) setCurrentCounselor(chat.counselor);
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

        await fetchMessagesFromAPI();
      } catch (error) {
        console.error("Error loading chat:", error);
      }
    };

    initializeChat();
  }, [counselorId, chatId]);

  useFocusEffect(
    useCallback(() => {
      hasInitialAutoScrollRef.current = false;
      shouldAutoScrollRef.current = true;

      if (messages.length > 0) {
        jumpToLatestMessage();
      }

      return () => {
        if (initialScrollRetryTimeoutRef.current) {
          clearTimeout(initialScrollRetryTimeoutRef.current);
          initialScrollRetryTimeoutRef.current = null;
        }
      };
    }, [jumpToLatestMessage, messages.length])
  );

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
      const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
      if (!token) return;

      const socket = io(API_BASE_URL, {
        auth: { token },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
      chatSocketRef.current = socket;

      socket.on("connect", () => {
        setIsSocketConnected(true);
        console.log("💬 Chat socket connected");
        socket.emit("join-chat", { chatId: apiChatId });
      });

      socket.on("reconnect", () => {
        setIsSocketConnected(true);
        console.log("💬 Chat socket reconnected - rejoining room");
        socket.emit("join-chat", { chatId: apiChatId });
      });

      socket.on("disconnect", () => {
        setIsSocketConnected(false);
      });

      socket.on("new-message", (messageData) => {
        console.log("📩 New message received via socket:", messageData);
        const userId = resolveCurrentUserId();
        if (messageData.senderRole === "user" && String(messageData.senderId) === String(userId)) {
          setMessages(prev => prev.filter(msg => !msg.isTemporary));
          return;
        }

        const transformedMessage = {
          id: messageData.id || messageData.messageId || `rt_${Date.now()}`,
          messageId: messageData.messageId,
          text: messageData.content,
          sender: messageData.senderRole === "user" ? "user" : "counselor",
          senderRole: messageData.senderRole,
          time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          fullTime: messageData.createdAt,
          contentType: messageData.contentType,
          attachmentUrl: messageData.attachmentUrl || null,
          attachmentName: messageData.attachmentName || null,
          isRead: messageData.isRead,
          status: "sent",
        };

        shouldAutoScrollRef.current = true;
        setMessages(prev => {
          const isDuplicate = prev.some(msg => msg.messageId && messageData.messageId && msg.messageId === messageData.messageId);
          if (isDuplicate) return prev;
          return [...prev, transformedMessage];
        });
        setTimeout(scrollToBottom, 100);
      });

      socket.on("user-typing", ({ userRole, isTyping: typing }) => {
        if (userRole !== "user") setRemoteIsTyping(typing);
      });

      socket.on("messages-read", () => {
        setMessages(prev => prev.map(msg => msg.sender === "user" ? { ...msg, isRead: true } : msg));
      });

      socket.on("chat-status-update", ({ status, chatId: updatedChatId }) => {
        console.log("✅ Chat status updated via socket:", status);
        setChatStatus(status);
        setCurrentChat(prev => prev ? { ...prev, status } : prev);
      });

      socket.on("connect_error", (err) => {
        setIsSocketConnected(false);
        console.error("Chat socket connection error:", err.message);
      });
    };

    setupSocket();

    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
        chatSocketRef.current = null;
      }
      setIsSocketConnected(false);
    };
  }, [chatId, currentChat?.chatId, scrollToBottom]);

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
      if (!isSocketConnected && currentChat) fetchMessagesFromAPI();
    }, 45000);
    return () => clearInterval(interval);
  }, [currentChat, isSocketConnected]);

  useEffect(() => {
    if (messages.length > 0) {
      if (!hasInitialAutoScrollRef.current) {
        hasInitialAutoScrollRef.current = true;
        jumpToLatestMessage();
      } else if (shouldAutoScrollRef.current) {
        scrollToBottom(true);
      }
    }
  }, [jumpToLatestMessage, messages.length, scrollToBottom]);

  useEffect(() => () => {
    if (initialScrollRetryTimeoutRef.current) {
      clearTimeout(initialScrollRetryTimeoutRef.current);
    }
  }, []);

  const handleInputChange = (text) => {
    setNewMessage(text);
    if (text.trim() !== "") handleTypingIndicator();
  };

  const renderMessage = useCallback(({ item }) => {
    const isUser = item.sender === "user";
    return <MessageItem item={item} isUser={isUser} />;
  }, []);

  const renderChatStatusBanner = () => {
    if (!chatStatus) return null;

    if (chatStatus === "accepted") return null;

    let statusText = "";
    let statusStyle = {};
    switch (chatStatus) {
      case "pending":
        statusText = "⏳ Waiting for counselor to accept...";
        statusStyle = styles.statusPending;
        break;
      case "ended":
        statusText = "🔒 vended";
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

  const counselorName = currentCounselor?.name || "Counselor";
  const counselorOnline = currentCounselor?.online || false;
  const counselorProfilePhoto = getProfilePhotoUrl(currentCounselor);

  useEffect(() => {
    setCounselorAvatarFailed(false);
  }, [counselorProfilePhoto]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoid}>
        <View style={styles.chatBoxMain}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={17} color="#0f172a" style={styles.backBtnIcon} />
              </TouchableOpacity>
              <View style={styles.userDetails}>
                <View style={styles.profilePic}>
                  <View style={styles.profileAvatar}>
                    {counselorProfilePhoto && !counselorAvatarFailed ? (
                      <Image
                        source={{ uri: counselorProfilePhoto }}
                        style={styles.profileAvatarImage}
                        onError={() => setCounselorAvatarFailed(true)}
                      />
                    ) : (
                      <Text style={styles.profileInitials}>{getInitials(counselorName)}</Text>
                    )}
                  </View>
                  <View style={[styles.activeDot, counselorOnline ? styles.onlineDot : styles.offlineDot]} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{counselorName}</Text>
                  <Text style={styles.profileStatus}>
                    {remoteIsTyping ? <Text style={styles.typingText}>Typing...</Text> : 
                    <Text style={styles.statusText}>{counselorOnline ? "Online" : "Offline"}</Text>}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.disabledBtn]} onPress={handleVideoCall} disabled={isInitiatingCall}>
                <Text style={styles.actionBtnIcon}>📹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.disabledBtn]} onPress={handleVoiceCall} disabled={isInitiatingCall}>
                <Text style={styles.actionBtnIcon}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowOptions(!showOptions)}>
                <Text style={styles.actionBtnIcon}>⋮</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Options Modal */}
          <Modal transparent visible={showOptions} animationType="fade" onRequestClose={() => setShowOptions(false)}>
            <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
              <View style={styles.optionsMenu}>
                <TouchableOpacity style={styles.optionItem} onPress={() => { fetchMessagesFromAPI(); setShowOptions(false); }}>
                  <Text style={styles.optionIcon}>🔄</Text>
                  <Text style={styles.optionText}>Refresh Messages</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionItem} onPress={() => { setMessages([]); setShowOptions(false); }}>
                  <Text style={styles.optionIcon}>🗑️</Text>
                  <Text style={styles.optionText}>Clear Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionItem} onPress={() => { Alert.alert("Report Issue", "Feature coming soon"); setShowOptions(false); }}>
                  <Text style={styles.optionIcon}>⚠️</Text>
                  <Text style={styles.optionText}>Report Issue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionItem} onPress={() => { Alert.alert("Chat Details", "Feature coming soon"); setShowOptions(false); }}>
                  <Text style={styles.optionIcon}>📋</Text>
                  <Text style={styles.optionText}>Chat Details</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Chat Status Banner */}
          {renderChatStatusBanner()}

          {/* Call Error Banner */}
          {callError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{callError}</Text>
              <TouchableOpacity onPress={() => setCallError(null)}>
                <Text style={styles.errorClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Messages Area */}
          {isLoadingMessages && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item.id?.toString() || item.messageId?.toString() || index.toString()}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={Platform.OS === 'android'}
              onLayout={() => {
                if (messages.length > 0 && !hasInitialAutoScrollRef.current) {
                  jumpToLatestMessage();
                }
              }}
              onContentSizeChange={handleMessagesContentSizeChange}
              onScroll={handleMessagesScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
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
                      {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              }
            />
          )}

          {/* Emoji Picker Modal */}
          <Modal transparent visible={showEmojiPicker} animationType="slide" onRequestClose={() => setShowEmojiPicker(false)}>
            <TouchableOpacity style={styles.emojiOverlay} activeOpacity={1} onPress={() => setShowEmojiPicker(false)}>
              <View style={styles.emojiPicker}>
                <View style={styles.emojiHeader}>
                  <Text style={styles.emojiTitle}>Emoji</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Text style={styles.emojiClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.emojiGrid}>
                  {["😊", "😂", "🥰", "😎", "😢", "😡", "👍", "👋", "❤️", "🎉", "🙏", "💪"].map((emoji, index) => (
                    <TouchableOpacity key={index} style={styles.emojiItem} onPress={() => {
                      setNewMessage(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}>
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Input Area */}
          <View style={styles.inputArea}>
            {pendingAttachment && (
              <View style={styles.attachmentPreview}>
                <Text style={styles.attachmentPreviewText} numberOfLines={1}>
                  📎 {pendingAttachment.name}
                </Text>
                <TouchableOpacity onPress={() => setPendingAttachment(null)}>
                  <Text style={styles.attachmentPreviewRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputGroup}>
              <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment} disabled={isSending}>
                <Text style={styles.attachIcon}>📎</Text>
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={messageInputRef}
                  style={styles.textInput}
                  value={newMessage}
                  onChangeText={handleInputChange}
                  placeholder={`Message ${counselorName}...`}
                  placeholderTextColor="#94a3b8"
                  multiline
                  blurOnSubmit={false}
                  editable={!isSending}
                />
                <TouchableOpacity style={styles.emojiBtn} onPress={() => setShowEmojiPicker(true)} disabled={isSending}>
                  <Text style={styles.emojiIcon}>😊</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  ((newMessage.trim() === "" && !pendingAttachment) || isSending) && styles.sendBtnDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={(newMessage.trim() === "" && !pendingAttachment) || isSending}
              >
                <Text style={styles.sendIcon}>{isSending ? "⏳" : "➤"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Call Modals */}
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

      <IncomingCallModal
        isOpen={showIncomingModal}
        onClose={() => setShowIncomingModal(false)}
        callType={incomingCallData.callType}
        callerName={incomingCallData.name}
        callerImage={incomingCallData.image}
        callData={incomingCallData}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
   
    backgroundColor: "#f8fafc",
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatBoxMain: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0,
  },
  // Header Styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f6",
    backgroundColor: "#ffffff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe4ef",
    backgroundColor: "#f8fbff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  backBtnIcon: {
    marginLeft: -2,
  },
  backBtnText: {
    fontSize: 20,
    color: "#1e293b",
  },
  userDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profilePic: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#6366f1",
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileInitials: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  activeDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  onlineDot: {
    backgroundColor: "#10b981",
  },
  offlineDot: {
    backgroundColor: "#94a3b8",
  },
  profileInfo: {
    flexDirection: "column",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  profileStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  statusText: {
    color: "#64748b",
    fontWeight: "500",
  },
  typingText: {
    color: "#10b981",
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef2f6",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  actionBtnIcon: {
    fontSize: 20,
    color: "#334155",
  },
  // Options Modal
  optionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  optionIcon: {
    fontSize: 16,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
  },
  // Chat Status Banner
  chatStatusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
  },
  statusAccepted: {
    backgroundColor: "#e8f5e9",
    borderBottomColor: "#81c784",
  },
  statusPending: {
    backgroundColor: "#fff3e0",
    borderBottomColor: "#ffb74d",
  },
  statusEnded: {
    backgroundColor: "#ffebee",
    borderBottomColor: "#ef9a9a",
  },
  chatStatusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  errorText: {
    flex: 1,
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "500",
  },
  errorClose: {
    fontSize: 18,
    color: "#991b1b",
    paddingHorizontal: 8,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
  },
  // Messages List
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  welcomeCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eef2f6",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  welcomeMsg: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
    lineHeight: 16,
  },
  welcomeTime: {
    fontSize: 10,
    color: "#94a3b8",
  },
  // Message Bubbles
  messageBubble: {
    maxWidth: "80%",
  },
  messageRight: {
    alignSelf: "flex-end",
  },
  messageLeft: {
    alignSelf: "flex-start",
  },
  messageContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  userMessageContent: {
    backgroundColor: "#6366f1",
    borderBottomRightRadius: 4,
  },
  counselorMessageContent: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eef2f6",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#ffffff",
  },
  counselorMessageText: {
    color: "#0f172a",
  },
  attachmentBubble: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  userAttachmentBubble: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  counselorAttachmentBubble: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  attachmentBubbleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  userAttachmentBubbleText: {
    color: "#ffffff",
  },
  counselorAttachmentBubbleText: {
    color: "#334155",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: "#94a3b8",
  },
  messageStatusSending: {
    fontSize: 10,
    color: "#ff9800",
  },
  messageStatusSent: {
    fontSize: 10,
    color: "#4caf50",
  },
  messageStatusError: {
    fontSize: 10,
    color: "#f44336",
  },
  // Input Area
  inputArea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef2f6",
    backgroundColor: "#ffffff",
  },
  attachmentPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  attachmentPreviewText: {
    flex: 1,
    color: "#3730a3",
    fontSize: 12,
    fontWeight: "600",
  },
  attachmentPreviewRemove: {
    color: "#3730a3",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#eef2f6",
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  attachIcon: {
    fontSize: 20,
    color: "#64748b",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 40,
    paddingLeft: 12,
    fontSize: 15,
    color: "#0f172a",
    maxHeight: 100,
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
  emojiIcon: {
    fontSize: 20,
    color: "#64748b",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#94a3b8",
  },
  sendIcon: {
    fontSize: 20,
    color: "#ffffff",
  },
  // Emoji Picker Modal
  emojiOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  emojiPicker: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  emojiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  emojiTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  emojiClose: {
    fontSize: 24,
    color: "#64748b",
    paddingHorizontal: 8,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  emojiItem: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 24,
  },
  // Incoming Call Modal Styles
  incomingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  incomingModal: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
  },
  videoCallModal: {
    borderTopWidth: 4,
    borderTopColor: "#4a90e2",
  },
  voiceCallModal: {
    borderTopWidth: 4,
    borderTopColor: "#34c759",
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
    backgroundColor: "#6366f1",
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
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  incomingCallType: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  incomingCallTime: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  incomingCallMessage: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
    marginTop: 8,
  },
  incomingCallControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  incomingCallBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 40,
    alignItems: "center",
  },
  acceptCallBtn: {
    backgroundColor: "#34c759",
  },
  rejectCallBtn: {
    backgroundColor: "#ff3b30",
  },
  incomingCallBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ChatBox;
