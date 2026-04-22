import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { io } from 'socket.io-client';
import axios from 'axios';
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
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatSocketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
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

  // FIXED: Converted to async and moved to useEffect
  const loadCounselorData = async () => {
    try {
      let counselorData = null;
      const storedCounselor = await AsyncStorage.getItem("counselor");
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
        const storedId = await AsyncStorage.getItem("counselorId");
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
  const COUNSELOR_NAME = currentCounselor?.name || "Counselor";

  const getSelectedUserId = () => {
    if (!selectedUser) return null;
    return selectedUser.receiverId || selectedUser._id || selectedUser.id || selectedUser.userId || null;
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

  const getChatIdForAPI = () => {
    if (chatId) return chatId;
    if (selectedUser && USER_ID && counselorId) {
      return `chat_${USER_ID}_${counselorId}`;
    }
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchMessagesFromAPI = async () => {
    if (!selectedUser || !counselorId) return;
    try {
      const apiChatId = getChatIdForAPI();
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
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
        const token = await AsyncStorage.getItem("token");
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
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      
      const socket = io(API_BASE_URL, {
        auth: { token },
        transports: ["websocket"],
      });
      chatSocketRef.current = socket;
      
      socket.on("connect", () => {
        console.log("Chat socket connected");
        socket.emit("join-chat", { chatId: apiChatId });
      });
      
      socket.on("new-message", (messageData) => {
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
    };
    
    setupSocket();
    
    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
        chatSocketRef.current = null;
      }
    };
  }, [getChatIdForAPI(), selectedUser, counselorId]);

  useEffect(() => {
    if (callError) {
      const timer = setTimeout(() => setCallError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [callError]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderMessageStatus = (message) => {
    if (message.sender !== "me") return null;
    switch (message.status) {
      case "sending": return <Text style={styles.messageStatusSending}>⌛</Text>;
      case "sent": return <Text style={styles.messageStatusSent}>✓</Text>;
      case "error": return <Text style={styles.messageStatusError}>⚠️</Text>;
      default: return null;
    }
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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarIcon}>{getAvatarByGender(userDetails.gender)}</Text>
              <View style={[styles.statusDot, { backgroundColor: selectedUser?.status === "online" ? "#22c55e" : "#94a3b8" }]} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{USER_NAME}</Text>
              <Text style={styles.userPhone}>{userDetails.phone}</Text>
              <Text style={styles.userEmail}>{userDetails.email}</Text>
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

      <ScrollView
        style={styles.messagesArea}
        ref={messagesContainerRef}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingMessages && messages.length === 0 ? (
          <View style={styles.loadingMessages}>
            <ActivityIndicator size="large" color="#2563eb" />
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
        ) : messages.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyMessagesIcon}>💬</Text>
            <Text style={styles.emptyMessagesText}>No messages yet</Text>
            <Text style={styles.emptyMessagesSubtext}>Start a conversation by sending a message</Text>
          </View>
        ) : (
          messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.sender === "me" ? styles.sentRow : styles.receivedRow,
              ]}
            >
              <View style={[
                styles.messageBubble,
                msg.sender === "me" ? styles.sentBubble : styles.receivedBubble,
              ]}>
                <Text style={[
                  styles.messageText,
                  msg.sender === "me" ? styles.sentMessageText : styles.receivedMessageText,
                ]}>{msg.text}</Text>
                <View style={styles.messageFooter}>
                  <Text style={styles.messageTime}>{msg.time}</Text>
                  {renderMessageStatus(msg)}
                </View>
              </View>
            </View>
          ))
        )}
        <View ref={messagesEndRef} />
      </ScrollView>

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
            style={[styles.sendBtn, message.trim() && !isSending && styles.sendBtnActive]}
            onPress={handleSendMessage}
            disabled={!message.trim() || isSending}
          >
            <Text style={styles.sendBtnText}>{isSending ? "..." : "Send"}</Text>
          </TouchableOpacity>
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
    backgroundColor: 'white',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  backToListBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563eb',
    borderRadius: 30,
  },
  backToListBtnText: {
    color: 'white',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#64748b',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarIcon: {
    fontSize: 24,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  userPhone: {
    fontSize: 12,
    color: '#64748b',
  },
  userEmail: {
    fontSize: 10,
    color: '#94a3b8',
  },
  callButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCallBtn: {
    backgroundColor: '#eef2ff',
  },
  videoCallBtn: {
    backgroundColor: '#2563eb',
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
    marginTop: 8,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 13,
  },
  errorClose: {
    fontSize: 16,
    color: '#991b1b',
    paddingHorizontal: 8,
  },
  messagesArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#f8fafc',
  },
  loadingMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  errorMessage: {
    alignItems: 'center',
    paddingTop: 100,
  },
  retryBtn: {
    marginTop: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  emptyMessages: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyMessagesIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyMessagesText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyMessagesSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  messageRow: {
    marginBottom: 12,
  },
  sentRow: {
    alignItems: 'flex-end',
  },
  receivedRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sentBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sentMessageText: {
    color: 'white',
  },
  receivedMessageText: {
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
    fontSize: 10,
    color: '#94a3b8',
  },
  messageStatusSending: {
    fontSize: 10,
    color: '#94a3b8',
  },
  messageStatusSent: {
    fontSize: 10,
    color: '#22c55e',
  },
  messageStatusError: {
    fontSize: 10,
    color: '#ef4444',
  },
  inputForm: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
  },
  sendBtnActive: {
    backgroundColor: '#2563eb',
  },
  sendBtnText: {
    color: '#94a3b8',
    fontWeight: '500',
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
    backgroundColor: 'white',
    borderRadius: 26,
    overflow: 'hidden',
  },
  videoCallModal: {
    borderTopWidth: 4,
    borderTopColor: '#2563eb',
  },
  voiceCallModal: {
    borderTopWidth: 4,
    borderTopColor: '#4facfe',
  },
  incomingCallContent: {
    padding: 24,
    alignItems: 'center',
  },
  incomingCallerInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  incomingCallerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarEmojiLarge: {
    fontSize: 48,
  },
  incomingCallerName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  incomingCallType: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  incomingCallMessage: {
    fontSize: 12,
    color: '#2563eb',
  },
  incomingCallControls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  incomingCallBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#22c55e',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  incomingCallBtnText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default SMSInput;