import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  InteractionManager,
  Image,
} from 'react-native';
import { io } from 'socket.io-client';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import Ionicons from 'react-native-vector-icons/Ionicons';
import VideoCallModal from '../../../UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../UserDashboard/Tab/CallModal/VoiceCallModal';
import useRingtone from '../../../../../../hooks/useRingtone';
import { useIsFocused } from '@react-navigation/native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  const [isJoining, setIsJoining] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { stopRinging } = useRingtone();

  const handleJoin = async () => {
    if (isJoining) return;
    setIsJoining(true);
    stopRinging();
    // Close modal first so ringtone effect can't restart while accept API is in-flight.
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
    // Close modal first so ringtone effect can't restart while reject API is in-flight.
    onClose();
    if (onRejectCall && callData) {
      try {
        await onRejectCall(callData.callId);
        // already closed
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
          callType === "video" ? styles.videoCallModal : styles.voiceCallModal
        ]}>
          <View style={styles.incomingCallContent}>
            <View style={styles.incomingCallerInfo}>
              <View style={styles.incomingCallerAvatar}>
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
                  <Text style={styles.incomingCallBtnText}>Decline</Text>
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

const SMSInput = ({ navigation, route }) => {
  const isFocused = useIsFocused();
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
  
  // Counselor data states
  const [currentCounselor, setCurrentCounselor] = useState(null);
  const [counselorId, setCounselorId] = useState(null);

  // Get selected user from navigation state
  const selectedUser = location?.selectedUser;
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
    return {
      id,
      name: selectedUser?.name || selectedUser?.fullName || "User",
      gender: selectedUser?.gender,
      phone: selectedUser?.phone || selectedUser?.phoneNumber,
      email: selectedUser?.email,
    };
  };

  const userDetails = getUserDetails();
  const USER_ID = userDetails.id;
  const USER_NAME = userDetails.name;

  const getAvatarByGender = (gender) => {
    if (gender === "male") return "👨";
    if (gender === "female") return "👩";
    return "👤";
  };

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

  const handleMessagesScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromNewest = contentOffset.y;
    shouldAutoScrollRef.current = distanceFromNewest <= 120;
  }, []);

  const handleMessagesContentSizeChange = useCallback(() => {
    if (!messages.length) return;
    if (shouldAutoScrollRef.current) {
      // No animation on initial load — jumps straight to bottom without scrolling through history
      // Animated only for new messages after initial load is done
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
      if (file) {
        const formData = new FormData();
        if (messageContent.trim()) formData.append("content", messageContent.trim());
        formData.append("attachment", file);
        response = await axios.post(
          `${API_BASE_URL}/api/chat/chat/${apiChatId}/message`,
          formData,
          { headers: { Authorization: token ? `Bearer ${token}` : "" } }
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
    if (!message.trim() || !selectedUser || isSending) return;
    const messageText = message.trim();
    const tempMessage = {
      id: `temp_${Date.now()}`,
      text: messageText,
      sender: "me",
      senderRole: "counsellor",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      status: "sending",
      isTemporary: true,
    };
    shouldAutoScrollRef.current = true;
    setMessages(prev => [...prev, tempMessage]);
    setMessage("");
    setIsSending(true);
    setError(null);
    try {
      const sentMsg = await sendMessageToAPI({ messageContent: messageText });
      setMessages(prev => {
        // If socket already replaced the temp bubble, just remove any remaining temp
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
          profilePic: getAvatarByGender(selectedUser.gender),
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
          profilePic: getAvatarByGender(selectedUser.gender),
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
            // Counselor side: never show the caller's real photo here (privacy).
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
          // Token expired and refresh failed (or user logged out). Stop polling to avoid spam.
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
      
      const socket = io(API_BASE_URL, {
        auth: { token },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 800,
        timeout: 20000,
      });
      chatSocketRef.current = socket;
      
      socket.on("connect", () => {
        setIsSocketConnected(true);
        console.log("Chat socket connected");
        socket.emit("join-chat", { chatId: apiChatId });
      });

      socket.on("disconnect", () => {
        setIsSocketConnected(false);
      });
      
      socket.on("new-message", (messageData) => {
        shouldAutoScrollRef.current = true;
        const incomingId = messageData.id || messageData._id || messageData.messageId;
        const isOwnMessage = messageData.senderRole === "counsellor" && String(messageData.senderId) === String(counselorId);

        setMessages(prev => {
          // Dedup by messageId or id
          const alreadyExists = prev.some(msg =>
            (msg.messageId && messageData.messageId && msg.messageId === messageData.messageId) ||
            (msg.id && incomingId && !String(msg.id).startsWith('temp_') && msg.id === incomingId)
          );
          if (alreadyExists) return prev;

          // For own messages: replace temp bubble instead of adding a new one
          if (isOwnMessage) {
            const tempIndex = prev.findIndex(msg => msg.isTemporary);
            if (tempIndex !== -1) {
              const next = [...prev];
              next[tempIndex] = {
                id: incomingId,
                messageId: messageData.messageId,
                text: messageData.content,
                sender: "me",
                senderRole: "counsellor",
                time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                fullTime: messageData.createdAt,
                contentType: messageData.contentType,
                isRead: messageData.isRead,
                status: "sent",
              };
              return next;
            }
            // No temp bubble — add normally (e.g. sent from another device)
          }

          return [...prev, {
            id: incomingId,
            messageId: messageData.messageId,
            text: messageData.content,
            sender: isOwnMessage ? "me" : "user",
            senderRole: messageData.senderRole,
            time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            fullTime: messageData.createdAt,
            contentType: messageData.contentType,
            isRead: messageData.isRead,
            status: "sent",
          }];
        });
      });
      
      socket.on("user-typing", ({ userRole, isTyping: typing }) => {
        if (userRole === "user") setRemoteIsTyping(typing);
      });

      socket.on("connect_error", (error) => {
        setIsSocketConnected(false);
        console.error("Counselor chat socket connect error:", error?.message || error);
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
      case "sending": return <Text style={styles.messageStatusSending}>⌛ Sending...</Text>;
      case "sent": return <Text style={styles.messageStatusSent}>✓ Sent</Text>;
      case "error": return <Text style={styles.messageStatusError}>⚠️ Failed</Text>;
      default: return null;
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender === "me";

    return (
      <View style={[styles.messageBubble, isMe ? styles.messageRight : styles.messageLeft]}>
        <View style={[styles.messageContent, isMe ? styles.userMessageContent : styles.counselorMessageContent]}>
          <Text style={[styles.messageText, isMe ? styles.userMessageText : styles.counselorMessageText]}>
            {item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{item.time}</Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fb" translucent={false} />
      <View style={styles.chatBoxMain}>
        {/* Header - MediConeckt Design */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#081625" />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarIcon}>{getAvatarByGender(userDetails.gender)}</Text>
                <View style={[styles.activeDot, { backgroundColor: selectedUser?.status === "online" ? "#4caf50" : "#94a3b8" }]} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{USER_NAME}</Text>
                <Text style={styles.profileStatus}>
                  {remoteIsTyping ? (
                    <Text style={styles.typingText}>Typing...</Text>
                  ) : (
                    <Text style={styles.statusText}>
                      {selectedUser?.status === "online" ? "Online" : "Offline"}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.callButtons}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={initiateVoiceCall}
              disabled={isInitiatingCall}
            >
              <Ionicons name="call-outline" size={22} color="#2c50cd" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={initiateVideoCall}
              disabled={isInitiatingCall}
            >
              <Ionicons name="videocam-outline" size={22} color="#2c50cd" />
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
            <ActivityIndicator size="large" color="#2c50cd" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.errorMessage}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchMessagesFromAPI}>
              <Text style={styles.retryBtn}>Retry</Text>
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
                <Text style={styles.emptyMessagesText}>No messages yet</Text>
                <Text style={styles.emptyMessagesSubtext}>Start a conversation by sending a message</Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.welcomeCard}>
                <View style={styles.welcomeAvatar}>
                  <Text style={styles.welcomeInitials}>{getInitials(USER_NAME)}</Text>
                </View>
                <View style={styles.welcomeMsg}>
                  <Text style={styles.welcomeTitle}>Chat with {USER_NAME}</Text>
                  <Text style={styles.welcomeDesc}>
                    This is a secure counseling chat. Reply in real time and keep the conversation supportive.
                  </Text>
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
          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder={isSending ? "Sending..." : `Message ${USER_NAME}...`}
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
                message.trim() && !isSending ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!message.trim() || isSending}
            >
              <Ionicons name="send" size={20} color="#ffffff" />
            </TouchableOpacity>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    // marginTop:-30
  },
  chatBoxMain: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
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
    color: '#1e293b',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  backToListBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#2c50cd',
    borderRadius: 24,
    shadowColor: '#2c50cd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backToListBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarIcon: {
    fontSize: 24,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  profileStatus: {
    fontSize: 12,
  },
  statusText: {
    color: '#64748b',
    fontWeight: '500',
  },
  typingText: {
    color: '#2c50cd',
    fontWeight: '500',
  },
  callButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
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
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f7fb',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  messagesArea: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    flexGrow: 1,
  },
  welcomeCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  welcomeAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeInitials: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  welcomeMsg: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
    lineHeight: 16,
  },
  welcomeTime: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  errorMessage: {
    alignItems: 'center',
    paddingTop: 80,
    backgroundColor: '#f5f7fb',
  },
  retryBtn: {
    marginTop: 16,
    color: '#2c50cd',
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
    color: '#64748b',
    marginBottom: 6,
  },
  emptyMessagesSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    alignSelf: 'flex-start',
    borderRadius: 20,
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
    backgroundColor: '#94a3b8',
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
    color: '#64748b',
    fontStyle: 'italic',
  },
  messageBubble: {
    maxWidth: '100%',
    marginBottom: 2,
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '85%',
  },
  userMessageContent: {
    backgroundColor: '#2c50cd',
    borderBottomRightRadius: 4,
    shadowColor: '#2c50cd',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  counselorMessageContent: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  userMessageText: {
    color: '#ffffff',
  },
  counselorMessageText: {
    color: '#1e293b',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
  },
  messageStatusSending: {
    fontSize: 9,
    color: '#f59e0b',
    fontWeight: '500',
  },
  messageStatusSent: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: '500',
  },
  messageStatusError: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: '500',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#ffffff',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#2c50cd',
    shadowColor: '#2c50cd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
    opacity: 0.7,
  },
  // Incoming Call Modal Styles
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingCallModal: {
    width: screenWidth * 0.85,
    maxWidth: 360,
    backgroundColor: '#ffffff',
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
    borderTopColor: '#2c50cd',
  },
  voiceCallModal: {
    borderTopWidth: 3,
    borderTopColor: '#10b981',
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarEmojiLarge: {
    fontSize: 44,
  },
  avatarInitialLarge: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f172a",
  },
  incomingCallerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  incomingCallType: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '500',
  },
  incomingCallMessage: {
    fontSize: 12,
    color: '#2c50cd',
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
    backgroundColor: '#2c50cd',
  },
  rejectBtn: {
    backgroundColor: '#dc2626',
  },
  incomingCallBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default SMSInput;
