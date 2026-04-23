import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { io } from 'socket.io-client';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import VideoCallModal from '../../../UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../UserDashboard/Tab/CallModal/VoiceCallModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Incoming Call Modal Component
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

  const handleJoin = async () => {
    if (isJoining) return;
    setIsJoining(true);
    if (onJoinCall && callData) {
      try {
        const result = await onJoinCall(callData.callId);
        if (result && result.success) {
          onClose();
        }
      } catch (error) {
        console.error("Error joining call:", error);
      } finally {
        setIsJoining(false);
      }
    } else {
      onClose();
      setIsJoining(false);
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

  const displayName = callerName || "Anonymous User";

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
                <Text style={styles.avatarEmojiLarge}>
                  {callerAvatar === "👨" ? "👨" : callerAvatar === "👩" ? "👩" : "👤"}
                </Text>
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
                  <Text style={styles.incomingCallBtnText}>📞 Decline</Text>
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
                  <Text style={styles.incomingCallBtnText}>📞 Accept</Text>
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
  const location = route.params || {};
  const [message, setMessage] = useState("");
  const messagesContainerRef = useRef(null);
  const chatSocketRef = useRef(null);
  const fallbackChatIdRef = useRef(null);
  const hasInitialAutoScrollRef = useRef(false);
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

  // FIXED: Converted to async and moved to useEffect
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

  // FIXED: Get counselor name from state
  const getSelectedUserId = () => {
    if (!selectedUser) return null;
    return (
      selectedUser.receiverId ||
      selectedUser._id ||
      selectedUser.id ||
      selectedUser.userId ||
      location?.userId ||
      location?.chatData?.receiverId ||
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

  const scrollToBottom = useCallback((animated = true) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!messagesContainerRef.current) return;
        try {
          messagesContainerRef.current.scrollToEnd({ animated });
        } catch (scrollError) {
          // Ignore transient list layout race while list mounts.
        }
      });
    });
  }, []);

  const handleMessagesScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldAutoScrollRef.current = distanceFromBottom <= 120;
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
          id: msg.id || index,
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
        hasInitialAutoScrollRef.current = false;
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
        hasInitialAutoScrollRef.current = false;
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
        const withoutTemp = prev.filter(m => !m.isTemporary);
        if (!sentMsg) return withoutTemp;
        return [...withoutTemp, {
          id: sentMsg.id || sentMsg._id,
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
    const userId = getSelectedUserId();
    if (!userId) {
      setCallError("User information not found");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found");
      const requestBody = {
        initiatorId: counselorId,
        initiatorType: "counsellor",
        receiverId: userId,
        receiverType: "user",
        callType: "video",
      };
      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, requestBody, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.data && response.data.success) {
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: selectedUser.name || USER_NAME,
          type: "video",
          profilePic: getAvatarByGender(selectedUser.gender),
          phoneNumber: selectedUser.phone,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: response.data.callData,
        };
        setSelectedCall(callData);
        setIsVideoModalOpen(true);
      } else {
        throw new Error(response.data?.message || "Failed to initiate video call");
      }
    } catch (error) {
      console.error("Error initiating video call:", error);
      setCallError(error.response?.data?.message || error.message || "Failed to initiate video call");
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
    const userId = getSelectedUserId();
    if (!userId) {
      setCallError("User information not found");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found");
      const requestBody = {
        initiatorId: counselorId,
        initiatorType: "counsellor",
        receiverId: userId,
        receiverType: "user",
        callType: "audio",
      };
      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, requestBody, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.data && response.data.success) {
        const callData = {
          id: response.data.callData?.id,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: selectedUser.name || USER_NAME,
          type: "voice",
          profilePic: getAvatarByGender(selectedUser.gender),
          phoneNumber: selectedUser.phone,
          status: response.data.status || "ringing",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: response.data.callData,
        };
        setSelectedCall(callData);
        setIsVoiceModalOpen(true);
      } else {
        throw new Error(response.data?.message || "Failed to initiate voice call");
      }
    } catch (error) {
      console.error("Error initiating voice call:", error);
      setCallError(error.response?.data?.message || error.message || "Failed to initiate voice call");
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
        const callDataForModal = {
          id: detailedCall?.id || callId,
          callId: callId,
          roomId: response.data.roomId || detailedCall?.roomId || incomingCallData.roomId,
          name: remoteParticipant?.displayName || remoteParticipant?.fullName || incomingCallData.name,
          type: modalType,
          callType: modalType,
          profilePic: remoteParticipant?.profilePhoto || incomingCallData.avatar,
          phoneNumber: remoteParticipant?.phoneNumber || "",
          status: response.data.status || "active",
          date: "Today",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          apiCallData: detailedCall,
          isIncoming: true,
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
          let displayName = "Anonymous User";
          if (fromData.displayName) displayName = fromData.displayName;
          else if (fromData.fullName) displayName = fromData.fullName;
          else if (fromData.name) displayName = fromData.name;
          let avatar = "👤";
          if (fromData.gender === "female") avatar = "👩";
          else if (fromData.gender === "male") avatar = "👨";
          setIncomingCallData({
            callId: waitingCall.callId,
            roomId: waitingCall.roomId,
            name: displayName,
            avatar: avatar,
            callType: waitingCall.callType || "video",
            requestMessage: waitingCall.requestMessage || `Incoming ${waitingCall.callType || "video"} call...`,
          });
          setShowIncomingModal(true);
        }
      } catch (error) {
        console.error("Error polling for calls:", error);
      }
    };
    
    if (counselorId) {
      intervalId = setInterval(fetchIncomingCalls, 5000);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [showIncomingModal, counselorId, isVideoModalOpen, isVoiceModalOpen]);

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
        if (messageData.senderRole === "counsellor" && String(messageData.senderId) === String(counselorId)) {
          setMessages(prev => {
            const withoutTemp = prev.filter(msg => !msg.isTemporary);
            const alreadyHas = withoutTemp.some(msg => msg.messageId && messageData.messageId && msg.messageId === messageData.messageId);
            if (alreadyHas) return withoutTemp;
            return [...withoutTemp, {
              id: messageData.id || messageData.messageId,
              messageId: messageData.messageId,
              text: messageData.content,
              sender: "me",
              senderRole: "counsellor",
              time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              fullTime: messageData.createdAt,
              contentType: messageData.contentType,
              isRead: messageData.isRead,
              status: "sent",
            }];
          });
          return;
        }
        const transformedMessage = {
          id: messageData.id || messageData.messageId,
          messageId: messageData.messageId,
          text: messageData.content,
          sender: messageData.senderRole === "counsellor" ? "me" : "user",
          senderRole: messageData.senderRole,
          time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          fullTime: messageData.createdAt,
          contentType: messageData.contentType,
          isRead: messageData.isRead,
          status: "sent",
        };
        setMessages(prev => {
          const isDuplicate = prev.some(msg => msg.messageId && messageData.messageId && msg.messageId === messageData.messageId);
          if (isDuplicate) return prev;
          return [...prev, transformedMessage];
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
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.chatBoxMain}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="chevron-back" size={17} color="#0f172a" style={styles.backButtonIcon} />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarIcon}>{getAvatarByGender(userDetails.gender)}</Text>
                <View style={[styles.statusDot, { backgroundColor: selectedUser?.status === "online" ? "#22c55e" : "#94a3b8" }]} />
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
              style={[styles.callBtn, styles.voiceCallBtn]}
              onPress={initiateVoiceCall}
              disabled={isInitiatingCall}
            >
              <Text style={styles.callIcon}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callBtn, styles.videoCallBtn]}
              onPress={initiateVideoCall}
              disabled={isInitiatingCall}
            >
              <Text style={styles.callIcon}>📹</Text>
            </TouchableOpacity>
          </View>
        </View>

        {callError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{callError}</Text>
            <TouchableOpacity onPress={() => setCallError(null)}>
              <Text style={styles.errorClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoadingMessages && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
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
            data={messages}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={handleMessagesContentSizeChange}
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
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
                    {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyMessagesIcon}>💬</Text>
                <Text style={styles.emptyMessagesText}>No messages yet</Text>
                <Text style={styles.emptyMessagesSubtext}>Start a conversation by sending a message</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputForm}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={isSending ? "Sending..." : "Type your message..."}
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              editable={!isSending}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                message.trim() && !isSending ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!message.trim() || isSending}
            >
              <Text style={styles.sendBtnText}>{isSending ? "⏳" : "➤"}</Text>
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
        isOpen={showIncomingModal}
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
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 24,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  backToListBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 30,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  backToListBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2f6',
  },
  backButtonIcon: {
    marginLeft: -2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarIcon: {
    fontSize: 26,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2.5,
    borderColor: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
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
    color: '#10b981',
    fontWeight: '600',
  },
  callButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  voiceCallBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  videoCallBtn: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  callIcon: {
    fontSize: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '500',
  },
  errorClose: {
    fontSize: 18,
    color: '#991b1b',
    paddingHorizontal: 8,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
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
    paddingVertical: 20,
    gap: 12,
    flexGrow: 1,
  },
  welcomeCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f2f5',
  },
  welcomeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  welcomeInitials: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  welcomeMsg: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  welcomeDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
    lineHeight: 18,
  },
  welcomeTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  errorMessage: {
    alignItems: 'center',
    paddingTop: 100,
    backgroundColor: '#f5f7fb',
  },
  retryBtn: {
    marginTop: 16,
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyMessagesIcon: {
    fontSize: 56,
    marginBottom: 20,
    opacity: 0.4,
  },
  emptyMessagesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  emptyMessagesSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  // FIXED: Full width message bubbles with professional styling
  messageBubble: {
    maxWidth: '100%', // Changed from 80% to 100% for full width
    marginBottom: 4,
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '85%', // Keep content within reasonable width
  },
  userMessageContent: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  counselorMessageContent: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#eef2f6',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  userMessageText: {
    color: 'white',
  },
  counselorMessageText: {
    color: '#1e293b',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  messageStatusSending: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '500',
  },
  messageStatusSent: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '500',
  },
  messageStatusError: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '500',
  },
  inputForm: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eef2f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 30,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxHeight: 100,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  sendBtnActive: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
    opacity: 0.7,
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 20,
  },
  // Incoming Call Modal Styles - Professional
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(4px)',
  },
  incomingCallModal: {
    width: screenWidth * 0.85,
    maxWidth: 380,
    backgroundColor: 'white',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  videoCallModal: {
    borderTopWidth: 4,
    borderTopColor: '#6366f1',
  },
  voiceCallModal: {
    borderTopWidth: 4,
    borderTopColor: '#10b981',
  },
  incomingCallContent: {
    padding: 28,
    alignItems: 'center',
  },
  incomingCallerInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  incomingCallerAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarEmojiLarge: {
    fontSize: 52,
  },
  incomingCallerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  incomingCallType: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 10,
    fontWeight: '500',
  },
  incomingCallMessage: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },
  incomingCallControls: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  incomingCallBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptBtn: {
    backgroundColor: '#10b981',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  incomingCallBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default SMSInput;