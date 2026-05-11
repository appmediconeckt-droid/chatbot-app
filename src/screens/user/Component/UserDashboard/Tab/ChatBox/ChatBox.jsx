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
import { useNavigation, useRoute } from "@react-navigation/native";
import { launchImageLibrary } from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";
import VideoCallModal from "../CallModal/VideoCallModal";
import VoiceCallModal from "../CallModal/VoiceCallModal";
import useRingtone from "../../../../../../hooks/useRingtone";

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
      name: "Dr. Sarah Mitchell",
      specialization: "Cognitive Behavioral Therapist",
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

  const getProfilePhotoUrl = (person) => {
    if (!person) return null;
    
    // Check all possible fields the backend might use
    const photo = person.profilePhoto || person.avatar || person.profilePic || person.photo;
    
    if (!photo) return null;
    
    if (photo.url) return photo.url;
    
    if (typeof photo === "string") {
      if (photo.startsWith("http")) return photo;
      if (photo.startsWith("data:")) return photo;
      
      // If it's a filename or relative path, try to construct URL
      if (photo.length > 0) {
        if (photo.startsWith("/")) return `${API_BASE_URL}${photo}`;
        return `${API_BASE_URL}/${photo}`;
      }
    }
    
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
          // With `inverted`, offset 0 corresponds to the visual bottom (newest messages).
          flatListRef.current.scrollToOffset({ offset: 0, animated });
        } catch (error) {
          // FlatList can throw if content is not laid out yet; ignore transient race.
        }
      });
    });
  }, []);

  // Chat UX: use an inverted list so the newest message appears at the bottom
  // without needing an initial scroll-to-end (more reliable on Android).
  const messagesForList = useMemo(() => {
    if (!messages?.length) return [];
    // Data oldest -> newest; for inverted lists we pass newest -> oldest.
    return [...messages].reverse();
  }, [messages]);

  const handleMessagesScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // With `inverted`, being "at bottom" means being near offset 0.
    // Keep auto-scroll enabled only if the user is near the newest messages.
    const distanceFromNewest = contentOffset.y;
    shouldAutoScrollRef.current = distanceFromNewest <= 120;
  }, []);

  const handleMessagesContentSizeChange = useCallback(() => {
    if (!messages.length) return;

    if (!hasInitialAutoScrollRef.current) {
      hasInitialAutoScrollRef.current = true;
      shouldAutoScrollRef.current = true;
      scrollToBottom(false);
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

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
  const fetchMessagesFromAPI = async (silent = false) => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await AsyncStorage.getItem("token");
      
      // Only show loader if we have absolutely no messages to show
      if (!silent && messages.length === 0) setIsLoadingMessages(true);

      const response = await axios.get(`${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.data && response.data.messages) {
        if (response.data.chatStatus) setChatStatus(response.data.chatStatus);

        const transformedMessages = response.data.messages.map((msg, index) => ({
          id: msg.id || msg._id || index,
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

        // Use a functional update to ensure we don't overwrite real-time messages that might have arrived
        setMessages(transformedMessages);
        
        if (!hasInitialAutoScrollRef.current) {
          hasInitialAutoScrollRef.current = true;
          setTimeout(() => scrollToBottom(false), 50);
        }
        
        return transformedMessages;
      }
    } catch (error) {
      console.error("Error fetching messages from API:", error);
      if (messages.length === 0) loadMessagesFromLocalStorage();
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadMessagesFromLocalStorage = async () => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
      const chat = savedChats.find(c => c.id === currentChat?.id || c.chatId === getChatIdForAPI());
      if (chat && chat.messages) {
        hasInitialAutoScrollRef.current = false;
        shouldAutoScrollRef.current = true;
        setMessages(chat.messages);
      }
    } catch (error) {
      console.error("Error loading messages from localStorage:", error);
    }
  };

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
      // Ensure the keyboard stays open and focus is returned immediately
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }
  };

  // Delete a single message (tries standard backend route and falls back gracefully)
  const deleteMessage = async (messageId) => {
    if (!messageId) return false;
    const apiChatId = getChatIdForAPI();
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message/${messageId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      // remove from UI
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId) && String(m.messageId) !== String(messageId)));
      // persist change to local storage
      try {
        const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
        const updatedChats = savedChats.map(c => {
          if (c.chatId === apiChatId || String(c.id) === String(currentChat?.id)) {
            return { ...c, messages: (c.messages || []).filter(m => String(m.id) !== String(messageId) && String(m.messageId) !== String(messageId)) };
          }
          return c;
        });
        await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
      } catch (e) {
        // ignore storage errors
      }
      return true;
    } catch (err) {
      console.error("Delete message failed:", err?.response || err.message || err);
      Alert.alert("Delete message", "Could not delete message from server.");
      return false;
    }
  };

  // Delete whole chat (clear all messages permanently)
  const deleteWholeChat = async () => {
    const apiChatId = getChatIdForAPI();
    try {
      const token = await AsyncStorage.getItem("token");
      // Try endpoint that clears messages for a chat
      await axios.delete(`${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
    } catch (err) {
      // Fallback: try deleting the chat resource itself
      try {
        const token = await AsyncStorage.getItem("token");
        await axios.delete(`${API_BASE_URL}/api/chat/chats/${apiChatId}`, {
          headers: { Authorization: token ? `Bearer ${token}` : undefined },
        });
      } catch (err2) {
        console.error("Delete chat failed:", err2?.response || err2.message || err2);
        Alert.alert("Delete chat", "Could not delete chat on server. Clearing locally.");
      }
    }

    // Clear locally regardless of server result
    setMessages([]);
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("activeChats") || "[]");
      const updatedChats = savedChats.map(c => (c.chatId === apiChatId || String(c.id) === String(currentChat?.id)) ? { ...c, messages: [] } : c);
      await AsyncStorage.setItem("activeChats", JSON.stringify(updatedChats));
    } catch (e) {
      // ignore storage errors
    }
    // close options if open
    setShowOptions(false);
    return true;
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
        let chat = savedChats.find(c => c.chatId === chatId) || savedChats.find(c => c.counselorId === counselorId);

        if (chat) {
          setCurrentChat(chat);
          if (chat.counselor) setCurrentCounselor(chat.counselor);
          if (chat.messages && chat.messages.length > 0) {
            setMessages(chat.messages);
            // Scroll to bottom immediately since we have local messages
            setTimeout(() => scrollToBottom(false), 50);
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

        // Fetch from API silently if we already have messages, otherwise show loader
        const silentFetch = messages.length > 0 || (chat && chat.messages && chat.messages.length > 0);
        await fetchMessagesFromAPI(silentFetch);
        
        // Auto focus keyboard after loading
        setTimeout(() => {
          if (messageInputRef.current) messageInputRef.current.focus();
        }, 500);
      } catch (error) {
        console.error("Error loading chat:", error);
      }
    };

    initializeChat();
  }, [counselorId, chatId]);

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
        shouldAutoScrollRef.current = true;
        scrollToBottom(false);
      } else if (shouldAutoScrollRef.current) {
        scrollToBottom(true);
      }
    }
  }, [messages.length, scrollToBottom]);

  const handleInputChange = (text) => {
    setNewMessage(text);
    if (text.trim() !== "") handleTypingIndicator();
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === "user";
    const showAvatar = !isUser && (index === 0 || messages[index - 1]?.sender === "user");
    
    return (
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={() => {
          if (item.sender === "user") {
            setConfirmState({
              visible: true,
              title: 'Delete message',
              message: 'Delete this message?',
              destructive: true,
              onCancel: () => setConfirmState(s => ({ ...s, visible: false })),
              onConfirm: async () => {
                setConfirmState(s => ({ ...s, visible: false }));
                await deleteMessage(item.messageId || item.id);
              },
            });
          }
        }}
        style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}
      >
        {!isUser && (
          <View style={styles.messageAvatarContainer}>
            {showAvatar ? (
              counselorProfilePhoto && !counselorAvatarFailed ? (
                <Image
                  source={{ uri: counselorProfilePhoto }}
                  style={styles.messageAvatar}
                  onError={() => setCounselorAvatarFailed(true)}
                />
              ) : (
                <View style={styles.messageAvatarPlaceholder}>
                  <Text style={styles.messageAvatarInitials}>{getInitials(counselorName)}</Text>
                </View>
              )
            ) : (
              <View style={styles.messageAvatarSpacer} />
            )}
          </View>
        )}
        
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
      </TouchableOpacity>
    );
  };

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

  const counselorName = currentCounselor?.displayName || currentCounselor?.name || "Counselor";
  const counselorSpecialization = currentCounselor?.specialization || "Cognitive Behavioral Therapist";
  const counselorOnline = currentCounselor?.online || false;
  const counselorProfilePhoto = getProfilePhotoUrl(currentCounselor);

  useEffect(() => {
    setCounselorAvatarFailed(false);
  }, [counselorProfilePhoto]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fb" translucent={false} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={styles.keyboardAvoid}
      >
        <View style={styles.chatBoxMain}>
          {/* Header - Serenity & Trust Design */}
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
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileInitials}>{getInitials(counselorName)}</Text>
                    </View>
                  )}
                  <View style={[styles.activeDot, counselorOnline ? styles.onlineDot : styles.offlineDot]} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
                    {counselorName}
                  </Text>
                  {/* <Text style={styles.profileSpecialization}>{counselorSpecialization}</Text> */}
                  <View style={styles.profileStatusRow}>
                    {remoteIsTyping ? (
                      <Text style={styles.typingText}>Typing...</Text>
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
                <Ionicons name="videocam" size={20} color="#2c50cd" style={styles.actionIcon} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.disabledBtn]} onPress={handleVoiceCall} disabled={isInitiatingCall}>
                <Ionicons name="call" size={20} color="#2c50cd" style={styles.actionIcon} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowOptions(!showOptions)}>
                <Ionicons name="ellipsis-vertical" size={18} color="#526071" style={styles.actionIcon} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Options Modal */}
          <Modal transparent visible={showOptions} animationType="fade" onRequestClose={() => setShowOptions(false)}>
            <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
              <View style={styles.optionsMenu}>
                <TouchableOpacity style={styles.optionItem} onPress={() => { fetchMessagesFromAPI(); setShowOptions(false); }}>
                  <Ionicons name="refresh" size={18} color="#526071" />
                  <Text style={styles.optionText}>Refresh Messages</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionItem} onPress={() => {
                    setShowOptions(false);
                    setConfirmState({
                      visible: true,
                      title: 'Delete Chat',
                      message: 'Delete all messages for this conversation? This cannot be undone.',
                      destructive: true,
                      onCancel: () => setConfirmState(s => ({ ...s, visible: false })),
                      onConfirm: async () => {
                        setConfirmState(s => ({ ...s, visible: false }));
                        await deleteWholeChat();
                      }
                    });
                  }}>
                  <Ionicons name="trash-outline" size={18} color="#526071" />
                  <Text style={styles.optionText}>Delete Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionItem} onPress={() => { Alert.alert("Report Issue", "Feature coming soon"); setShowOptions(false); }}>
                  <Ionicons name="warning-outline" size={18} color="#526071" />
                  <Text style={styles.optionText}>Report Issue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionItem} onPress={() => { Alert.alert("Chat Details", "Feature coming soon"); setShowOptions(false); }}>
                  <Ionicons name="information-circle-outline" size={18} color="#526071" />
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
              <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
              <Text style={styles.errorText}>{callError}</Text>
              <TouchableOpacity onPress={() => setCallError(null)}>
                <Ionicons name="close" size={20} color="#ba1a1a" />
              </TouchableOpacity>
            </View>
          )}

          {/* Messages Area */}
          {isLoadingMessages && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2c50cd" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
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
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              inverted
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={Platform.OS === "android"}
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
              <View style={styles.emojiPicker}>
                <View style={styles.emojiHeader}>
                  <Text style={styles.emojiTitle}>Emojis</Text>
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

          {/* Confirm Modal (replaces native Alert confirmations) */}
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

          {/* Input Area - Serenity Design */}
          <View style={styles.inputArea}>
            {pendingAttachment && (
              <View style={styles.attachmentPreview}>
                <Ionicons name="attach" size={16} color="#2c50cd" />
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
                <Ionicons name="add" size={24} color="#526071" />
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={messageInputRef}
                  style={styles.textInput}
                  value={newMessage}
                  onChangeText={handleInputChange}
                  placeholder={`Message ${counselorName}...`}
                  placeholderTextColor="#8492a5"
                  multiline
                  blurOnSubmit={false}
                  editable={!isSending}
                  enablesReturnKeyAutomatically
                />
                <TouchableOpacity style={styles.emojiBtn} onPress={() => setShowEmojiPicker(true)} disabled={isSending}>
                  <Ionicons name="happy-outline" size={22} color="#8492a5" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  ((newMessage.trim() === "" && !pendingAttachment) || isSending) && styles.sendBtnDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={(newMessage.trim() === "" && !pendingAttachment) || isSending}
                activeOpacity={0.8}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send" size={20} color="#ffffff" />
                )}
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
    backgroundColor: "#f7f9fb",
   
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatBoxMain: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },
  // Header Styles - Serenity Trust Design
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e6e8ea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f2f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
// Updated styles for header - replace the existing style definitions:

profilePic: {
  position: "relative",
  width: 44,  // Changed from 52 to 44 (smaller)
  height: 44, // Changed from 52 to 44 (smaller)
  borderRadius: 22, // Changed from 26 to 22
  backgroundColor: "#d5e4f8",
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
},
profileAvatar: {
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#d5e4f8",
},
profileAvatarImage: {
  width: "100%",
  height: "100%",
},
profileInitials: {
  fontSize: 16, // Changed from 20 to 16 (smaller text for smaller avatar)
  fontWeight: "600",
  color: "#081625",
  textTransform: "uppercase",
},
activeDot: {
  position: "absolute",
  bottom: 1,  // Adjusted for smaller avatar
  right: 1,   // Adjusted for smaller avatar
  width: 10,  // Changed from 12 to 10
  height: 10, // Changed from 12 to 10
  borderRadius: 5, // Changed from 6 to 5
  borderWidth: 2,
  borderColor: "#ffffff",
},
profileInfo: {
  flexDirection: "column",
  flexShrink: 1,
  minWidth: 0,
},
profileName: {
  fontSize: 16,
  fontWeight: "700",
  color: "#081625",
  fontFamily: Platform.OS === "ios" ? "Manrope" : "System",
  flexShrink: 1,
  maxWidth: screenWidth * 0.42,
},
// REMOVED profileSpecialization style entirely
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
    backgroundColor: "#4caf50",
  },
  statusDotOffline: {
    backgroundColor: "#94a3b8",
  },
  statusText: {
    fontSize: 11,
    color: "#74777c",
    fontWeight: "500",
  },
  typingText: {
    fontSize: 11,
    color: "#2c50cd",
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
    borderRadius: 22,
    backgroundColor: "#f2f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    // force consistent visual size and vertical alignment
    fontSize: 20,
    lineHeight: 20,
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
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#191c1e",
  },
  // Chat Status Banner
  chatStatusBanner: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#fff3e0",
    borderBottomWidth: 1,
    borderBottomColor: "#ffe0b2",
  },
  statusPending: {
    backgroundColor: "#fff8e1",
    borderBottomColor: "#ffecb3",
  },
  statusEnded: {
    backgroundColor: "#ffebee",
    borderBottomColor: "#ffcdd2",
  },
  chatStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e65100",
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
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  welcomeCard: {
    flexDirection: "row",
    backgroundColor: "#eceef0",
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  welcomeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#b9c8db",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeInitials: {
    fontSize: 24,
    fontWeight: "700",
    color: "#081625",
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
    marginBottom: 4,
    width: "100%",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
    paddingRight: 40,
  },
  messageRowRight: {
    justifyContent: "flex-end",
    paddingLeft: 40,
  },
  messageAvatarContainer: {
    width: 36,
    height: 36,
    marginRight: 8,
    alignSelf: "flex-end", // Align avatar to bottom of the message group
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
    maxWidth: "85%",
  },
  messageRight: {
    alignSelf: "flex-end",
  },
  messageLeft: {
    alignSelf: "flex-start",
  },
  messageContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  userMessageContent: {
    backgroundColor: "#2c50cd",
    borderBottomRightRadius: 4,
  },
  counselorMessageContent: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6e8ea",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "Manrope" : "System",
  },
  userMessageText: {
    color: "#ffffff",
  },
  counselorMessageText: {
    color: "#081625",
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
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  counselorAttachmentBubble: {
    backgroundColor: "#f2f4f6",
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
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 6,
  },
  messageTime: {
    fontSize: 10,
    color: "#8492a5",
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
  // Typing Indicator
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#eceef0",
    alignSelf: "flex-start",
    borderRadius: 20,
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
    backgroundColor: "#8492a5",
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
  // Input Area - Serenity Design
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
    borderTopWidth: 1,
    borderTopColor: "#e6e8ea",
    backgroundColor: "#ffffff",
    
  },
  inputGroupDisabled: {
    opacity: 0.8,
    backgroundColor: "#f8f9fa",
  },
  attachmentPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f4f6",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
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
    gap: 10,
    backgroundColor: "#f2f4f6",
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingVertical: 10,
    paddingRight: 40,
    paddingLeft: 8,
    fontSize: 15,
    color: "#081625",
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
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2c50cd",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2c50cd",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#b9c8db",
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
    maxHeight: 220,
  },
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
    backgroundColor: '#2c50cd',
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
    width: screenWidth * 0.88,
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    overflow: "hidden",
  },
  videoCallModal: {
    borderTopWidth: 4,
    borderTopColor: "#2c50cd",
  },
  voiceCallModal: {
    borderTopWidth: 4,
    borderTopColor: "#4caf50",
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
    backgroundColor: "#2c50cd",
  },
  rejectCallBtn: {
    backgroundColor: "#ba1a1a",
  },
  incomingCallBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ChatBox;
