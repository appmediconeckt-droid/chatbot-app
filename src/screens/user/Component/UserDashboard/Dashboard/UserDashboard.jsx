import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { API_BASE_URL } from "../../../../../axiosConfig";
import { io } from "socket.io-client";
import Icon from "react-native-vector-icons/FontAwesome5";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import safeVibrate from "../../../../../utils/safeVibrate";
import { forceStopRingtone, startIncomingRingtone } from "../../../../../hooks/useRingtone";
import ChatInterface from "../Tab/chatbot/ChatInterface";
import CounselorTable from "../Tab/Appointment/BookAppointment";
import WalletDashboard from "../Tab/Wallet/WalletDashboard";
import CallHistory from "../Tab/Callls/CallHistory";
import PatientProfile from "../../PatientProfile/PatientProfile";
import RealVideoCallModal from "../Tab/CallModal/VideoCallModal";
import RealVoiceCallModal from "../Tab/CallModal/VoiceCallModal";

const { width, height } = Dimensions.get("window");

// Improved ChatPopup Component
const ChatPopup = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  isLoading,
  onClose,
  onCounselorPress,
}) => (
  <Modal animationType="slide" transparent={true} visible={true}>
    <View style={styles.chatPopupOverlay}>
      <View style={styles.chatPopup}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chatPopupHeader}
        >
          <View style={styles.chatHeaderInfo}>
            <LinearGradient
              colors={['#ffffff', '#f0f0f0']}
              style={[styles.chatAvatar, styles.chatAvatarGradient]}
            >
              <MaterialIcons name="auto-awesome" size={22} color="#667eea" />
            </LinearGradient>
            <View>
              <Text style={styles.chatHeaderTitle}>AI Health Assistant</Text>
              <Text style={styles.chatStatus}>Online • Always Here for You</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.chatCloseBtn}>
            <MaterialIcons name="close" size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView style={styles.chatPopupBody}>
          {messages.map((message) => {
            const textParts = String(message.text || "").split(/(\[.*?\])/g);

            return (
              <View
                key={message.id}
                style={[
                  styles.chatMessageWrapper,
                  message.sender === "user" && styles.chatMessageWrapperUser,
                ]}
              >
                {message.sender === "ai" && (
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={[styles.chatAvatar, styles.chatAvatarSmall]}
                  >
                    <MaterialIcons name="auto-awesome" size={14} color="white" />
                  </LinearGradient>
                )}
                <View
                  style={[
                    styles.chatBubble,
                    message.sender === "user" && styles.chatBubbleUser,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatBubbleText,
                      message.sender === "user" && styles.chatBubbleTextUser,
                    ]}
                  >
                    {textParts.map((part, index) => {
                      if (part.startsWith("[") && part.endsWith("]")) {
                        const counselorName = part.slice(1, -1).trim();
                        return (
                          <Text
                            key={`${message.id}_${index}`}
                            style={styles.chatCounselorMention}
                            onPress={() => onCounselorPress?.(counselorName)}
                          >
                            {counselorName}
                          </Text>
                        );
                      }

                      return <Text key={`${message.id}_${index}`}>{part}</Text>;
                    })}
                  </Text>
                </View>
                {message.sender === "user" && (
                  <View style={[styles.chatAvatar, styles.chatAvatarSmall, styles.userAvatar]}>
                    <Ionicons name="person-circle" size={18} color="#667eea" />
                  </View>
                )}
              </View>
            );
          })}
          {isLoading && (
            <View style={[styles.chatMessageWrapper, styles.chatMessageWrapperAi]}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={[styles.chatAvatar, styles.chatAvatarSmall]}
              >
                <MaterialIcons name="auto-awesome" size={14} color="white" />
              </LinearGradient>
              <View style={styles.chatBubble}>
                <View style={styles.loadingDots}>
                  <View style={styles.loadingDot} />
                  <View style={styles.loadingDot} />
                  <View style={styles.loadingDot} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.chatPopupFooter}>
          <TextInput
            style={styles.chatInput}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || isLoading}
          >
            <MaterialIcons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Call Modal Component
const CallModal = ({
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isOpen, pulseAnim]);

  const handleAccept = async () => {
    if (isAccepting) return;
    setIsAccepting(true);
    if (onAcceptCall && callData) {
      await onAcceptCall(callData.callId);
      onClose();
    }
    setIsAccepting(false);
  };

  const handleReject = async () => {
    if (isRejecting) return;
    setIsRejecting(true);
    if (onRejectCall && callData) {
      await onRejectCall(callData.callId);
      onClose();
    }
    setIsRejecting(false);
  };

  if (!isOpen) return null;

  const displayName = callData?.from?.fullName || callerName || "Counselor";
  const profilePhoto = callData?.from?.profilePhoto || callerImage;

  return (
    <Modal transparent={true} visible={isOpen} animationType="fade">
      <View style={styles.callModalOverlay}>
        <View style={styles.callModal}>
          <View style={styles.callModalContent}>
            <View style={styles.callerInfo}>
              <Animated.View style={[styles.callerAvatar, { transform: [{ scale: pulseAnim }] }]}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.callerAvatarImage} />
                ) : (
                  <MaterialIcons name="person" size={44} color="white" />
                )}
              </Animated.View>
              <Text style={styles.callerName}>{displayName}</Text>
              <Text style={styles.callType}>
                {callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
              </Text>
            </View>

            <View style={styles.callControls}>
              <TouchableOpacity
                style={[styles.callBtn, styles.rejectBtn]}
                onPress={handleReject}
                disabled={isRejecting}
              >
                <MaterialIcons name="call-end" size={22} color="white" />
                <Text style={styles.callBtnText}>
                  {isRejecting ? "Rejecting..." : "Decline"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callBtn, styles.acceptBtn]}
                onPress={handleAccept}
                disabled={isAccepting}
              >
                <MaterialIcons name="call" size={22} color="white" />
                <Text style={styles.callBtnText}>
                  {isAccepting ? "Accepting..." : "Accept"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};


const MyAppointmentsPanel = ({ onBookPress }) => {
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedApt, setSelectedApt] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const socketRef = useRef(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true);
      const token =
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("accessToken"));
      const response = await axios.get(`${API_BASE_URL}/api/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();

    const connectSocket = async () => {
      const token =
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("accessToken"));
      const userId = await AsyncStorage.getItem("userId");
      if (!token) return;

      const socket = io(API_BASE_URL, {
        transports: ["polling", "websocket"],
        auth: { token },
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (userId) socket.emit("join-user-room", { userId });
      });

      // Re-fetch on any appointment change event
      const refresh = () => fetchAppointments();
      socket.on("appointment-booked", refresh);
      socket.on("appointment-updated", refresh);
      socket.on("appointment-confirmed", refresh);
      socket.on("appointment-cancelled", refresh);
      socket.on("appointment-status-changed", refresh);
      
      // 🔄 Listen for appointment call initiation and status updates
      socket.on("appointment-call-initiated", refresh);
      socket.on("appointment-status-updated", refresh);
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchAppointments]);

  const upcomingApts = appointments.filter(
    (apt) => apt.status !== "completed" && apt.status !== "canceled"
  );
  const pastApts = appointments.filter(
    (apt) => apt.status === "completed" || apt.status === "canceled"
  );

  let displayApts = activeTab === "Upcoming" ? upcomingApts : pastApts;

  if (statusFilter === "Pending") {
    displayApts = displayApts.filter((apt) => apt.status === "pending");
  }
  if (statusFilter === "Confirmed") {
    displayApts = displayApts.filter((apt) => apt.status === "confirmed");
  }

  const getStatusStyle = (status) => {
    if (status === "confirmed") return styles.aptStatusConfirmed;
    if (status === "completed") return styles.aptStatusCompleted;
    if (status === "canceled") return styles.aptStatusCanceled;
    return styles.aptStatusPending;
  };

  const getStatusTextColor = (status) => {
    if (status === "confirmed") return "#5b21b6";
    if (status === "completed") return "#166534";
    if (status === "canceled") return "#b91c1c";
    return "#c2410c";
  };

  const getAccentColor = (status) => {
    if (status === "confirmed") return "#7c3aed";
    if (status === "completed") return "#16a34a";
    if (status === "canceled") return "#ef4444";
    return "#f97316";
  };

  const getAvatarSrc = (apt) => {
    const photo = apt?.counselor?.profilePhoto;
    if (photo) {
      return typeof photo === "string" ? photo : photo.url;
    }

    const name = apt?.counselor?.fullName || "Counselor";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=ffffff&bold=true`;
  };

  return (
    <View style={styles.appointmentsRoot}>
      {/* Tabs + Filter bar */}
      <View style={styles.appointmentsTopBar}>
        <View style={styles.appointmentsTabRow}>
          <TouchableOpacity
            onPress={() => setActiveTab("Upcoming")}
            style={[styles.aptTabBtn, activeTab === "Upcoming" && styles.aptTabBtnActive]}
          >
            <Text style={[styles.aptTabText, activeTab === "Upcoming" && styles.aptTabTextActive]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("Past")}
            style={[styles.aptTabBtn, activeTab === "Past" && styles.aptTabBtnActive]}
          >
            <Text style={[styles.aptTabText, activeTab === "Past" && styles.aptTabTextActive]}>Past</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.appointmentFilterRow}>
          {[
            { key: "All", label: "All" },
            { key: "Pending", label: "Pending" },
            { key: "Confirmed", label: "Confirmed" },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.filterChip, statusFilter === chip.key && styles.filterChipActive]}
              onPress={() => setStatusFilter(chip.key)}
            >
              <Text style={[styles.filterChipText, statusFilter === chip.key && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.appointmentsList} showsVerticalScrollIndicator={false}>
        {loadingAppointments ? (
          <View style={styles.appointmentLoaderWrap}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.appointmentLoaderText}>Loading appointments...</Text>
          </View>
        ) : displayApts.length === 0 ? (
          <View style={styles.appointmentEmptyCard}>
            <MaterialIcons name="event-busy" size={40} color="#c7d2fe" />
            <Text style={styles.appointmentEmptyTitle}>No appointments found</Text>
            <Text style={styles.appointmentEmptySubtitle}>
              Try changing filters or book a new session with a counselor.
            </Text>
          </View>
        ) : (
          displayApts.map((apt) => (
            <View key={apt._id} style={styles.appointmentCard}>
              {/* Accent bar */}
              <View style={[styles.aptCardAccent, { backgroundColor: getAccentColor(apt.status) }]} />

              <View style={styles.appointmentCardHeader}>
                <View style={styles.aptAvatarWrap}>
                  <Image source={{ uri: getAvatarSrc(apt) }} style={styles.appointmentAvatar} />
                </View>
                <View style={styles.appointmentMetaColumn}>
                  <Text style={styles.appointmentDoctorName} numberOfLines={1}>
                    Dr. {apt?.counselor?.fullName || "Counselor"}
                  </Text>
                  <Text style={styles.appointmentSpecialization} numberOfLines={1}>
                    {apt?.counselor?.specialization || "Mental Wellness Specialist"}
                  </Text>
                </View>
                <View style={[styles.aptStatusPill, getStatusStyle(apt.status)]}>
                  <Text style={[styles.aptStatusText, { color: getStatusTextColor(apt.status) }]}>{apt.status || "pending"}</Text>
                </View>
              </View>

              <View style={styles.aptDivider} />

              <View style={styles.appointmentDateRow}>
                <View style={styles.aptDateIconWrap}>
                  <MaterialIcons name="event" size={15} color="#4f46e5" />
                </View>
                <Text style={styles.appointmentDateText}>
                  {new Date(apt.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                <View style={styles.aptTimeDot} />
                <View style={styles.aptDateIconWrap}>
                  <MaterialIcons name="access-time" size={15} color="#4f46e5" />
                </View>
                <Text style={styles.appointmentDateText}>
                  {new Date(apt.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>

              <View style={styles.appointmentActionRow}>
                <TouchableOpacity
                  style={styles.appointmentDetailsBtn}
                  onPress={() => {
                    setSelectedApt(apt);
                    setShowDetailsModal(true);
                  }}
                >
                  <MaterialIcons name="visibility" size={15} color="#4f46e5" />
                  <Text style={styles.appointmentDetailsText}>View Details</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.appointmentBookBtn} onPress={onBookPress}>
                  <MaterialIcons name="add-circle-outline" size={15} color="#ffffff" />
                  <Text style={styles.appointmentBookText}>Book New</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        transparent={true}
        visible={showDetailsModal}
        animationType="fade"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.appointmentDetailsModal}>
            <TouchableOpacity
              onPress={() => setShowDetailsModal(false)}
              style={styles.detailsCloseBtn}
            >
              <MaterialIcons name="close" size={20} color="#64748b" />
            </TouchableOpacity>

            <Text style={styles.appointmentDetailsTitle}>Appointment Details</Text>
            <Text style={styles.appointmentDetailsLine}>
              Date: {selectedApt ? new Date(selectedApt.date).toLocaleDateString("en-US") : "-"}
            </Text>
            <Text style={styles.appointmentDetailsLine}>
              Time: {selectedApt ? new Date(selectedApt.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
            </Text>
            <Text style={styles.appointmentDetailsLine}>Status: {selectedApt?.status || "pending"}</Text>
            <Text style={styles.appointmentDetailsLine}>Notes: {selectedApt?.notes || "N/A"}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function UserDashboard() {
  const navigation = useNavigation();
  const [active, setActive] = useState("Chat");
  const [chatOpen, setChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [targetCounselor, setTargetCounselor] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Call Modal States
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState("video");
  const [callerInfo, setCallerInfo] = useState({
    name: "",
    image: null,
    userId: "",
    userName: "",
    callId: "",
    roomId: "",
    waitingDuration: 0,
  });
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  const [userId, setUserId] = useState(null);
  const chatBodyRef = useRef(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phone: "",
    profilePhoto: "",
  });

  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI health assistant. How can I help you today?",
      sender: "ai",
    },
  ]);

  const handleAIContactClick = (name) => {
    setTargetCounselor(name);
    setActive("Counselor");
    setChatOpen(false);
  };

  useEffect(() => {
    checkMobile();
    fetchUserData();
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
    }
  }, [chatOpen]);

  // Track call IDs already handled so the same call never rings twice
  const handledCallIdsRef = useRef(new Set());
  // After a call ends, block polling for 6s so the backend clears the call first
  const pollBlockedUntilRef = useRef(0);
  // Refs so the polling interval never needs to restart when modal state changes
  const showCallModalRef = useRef(false);
  const isVideoModalOpenRef = useRef(false);
  const isVoiceModalOpenRef = useRef(false);
  // Ref mirror for callerInfo so "still pending" check has stable access
  const callerInfoRef = useRef({ callId: '' });

  // Keep refs in sync with state
  useEffect(() => { showCallModalRef.current = showCallModal; }, [showCallModal]);
  useEffect(() => { isVideoModalOpenRef.current = isVideoModalOpen; }, [isVideoModalOpen]);
  useEffect(() => { isVoiceModalOpenRef.current = isVoiceModalOpen; }, [isVoiceModalOpen]);
  useEffect(() => { callerInfoRef.current = callerInfo; }, [callerInfo]);

  // Poll for incoming calls from counselor — single stable interval, never restarts
  useEffect(() => {
    let isMounted = true;

    const fetchIncomingCalls = async () => {
      try {
        if (Date.now() < pollBlockedUntilRef.current) return;
        if (showCallModalRef.current || isVideoModalOpenRef.current || isVoiceModalOpenRef.current) return;

        const token =
          (await AsyncStorage.getItem('accessToken')) ||
          (await AsyncStorage.getItem('token'));
        const storedUserId = await AsyncStorage.getItem('userId');
        if (!token || !storedUserId) return;

        const response = await axios.get(
          `${API_BASE_URL}/api/video/calls/pending/${storedUserId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!isMounted) return;

        const callsList = response.data.pendingRequests || [];
        if (response.data.success && callsList.length > 0) {
          const waitingCall = callsList[0];
          const callId = waitingCall.callId || waitingCall._id || waitingCall.id;

          // Skip calls we already handled or dismissed
          if (handledCallIdsRef.current.has(callId)) return;

          const fromData = waitingCall.from || {};
          const counselorName =
            fromData.fullName ||
            fromData.name ||
            fromData.displayName ||
            waitingCall.counselorName ||
            waitingCall.counsellorName ||
            'Counselor';

          handledCallIdsRef.current.add(callId);

          const resolvedCallType =
            String(waitingCall.callType || 'video').toLowerCase() === 'audio'
              ? 'voice'
              : 'video';

          setCallerInfo({
            callId,
            roomId: waitingCall.roomId,
            name: counselorName,
            userName: counselorName,
            image: fromData.profilePhoto || fromData.image || null,
            userId: fromData._id || fromData.id || '',
            callType: resolvedCallType,
            from: fromData,
          });
          setCallType(resolvedCallType);
          startIncomingRingtone(true);
          setShowCallModal(true);
        }
      } catch (_) {}
    };

    const intervalId = setInterval(fetchIncomingCalls, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // If the counselor cancels/ends the outgoing call while the user's incoming
  // call modal is open, detect that the call is gone and close the modal + stop ring.
  useEffect(() => {
    if (!showCallModal || !callerInfo.callId) return;

    let cancelled = false;

    const checkStillPending = async () => {
      try {
        const token =
          (await AsyncStorage.getItem('accessToken')) ||
          (await AsyncStorage.getItem('token'));
        const storedUserId = await AsyncStorage.getItem('userId');
        if (!token || !storedUserId || cancelled) return;

        const response = await axios.get(
          `${API_BASE_URL}/api/video/calls/pending/${storedUserId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (cancelled) return;

        const callsList = response.data.pendingRequests || [];
        const currentCallId = callerInfoRef.current.callId;
        const stillThere = callsList.some(
          (c) => (c?.callId || c?.id || c?._id) === currentCallId
        );

        if (!stillThere) {
          forceStopRingtone();
          pollBlockedUntilRef.current = Date.now() + 6000;
          setShowCallModal(false);
          setCallerInfo({ name: '', image: null, userId: '', userName: '', callId: '', roomId: '', waitingDuration: 0 });
        }
      } catch (_) {}
    };

    checkStillPending();
    const intervalId = setInterval(checkStillPending, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [showCallModal, callerInfo.callId]);

  const checkMobile = () => {
    setIsMobile(width <= 768);
  };

  const fetchUserData = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem("userId");
      const token = await AsyncStorage.getItem("token");

      if (!storedUserId) return;

      const response = await axios.get(`${API_BASE_URL}/api/auth/getUser/${storedUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const user = response.data.user;
        setUserData({
          name: user.fullName || "",
          email: user.email || "",
          phone: user.phoneNumber || "",
          profilePhoto: user.profilePhoto?.url || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: newMessage,
      sender: "user",
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setIsLoading(true);

    try {
      const token = (await AsyncStorage.getItem("token")) || (await AsyncStorage.getItem("accessToken"));

      const history = chatMessages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

      const response = await axios.post(
        `${API_BASE_URL}/api/ai-chat`,
        {
          message: userMessage.text,
          history,
        },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      const aiResponseText =
        response.data?.data?.aiResponse ||
        response.data?.reply ||
        response.data?.response ||
        response.data?.message ||
        response.data?.text ||
        "I'm here to help. Could you please rephrase that?";

      if (response.data?.success || aiResponseText) {
        const aiMessage = {
          id: Date.now() + 1,
          text: aiResponseText,
          sender: "ai",
        };
        setChatMessages((prev) => [...prev, aiMessage]);
      } else {
        const fallbackMessage = {
          id: Date.now() + 1,
          text: "I'm here to help. Could you please rephrase that?",
          sender: "ai",
        };
        setChatMessages((prev) => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error("Chat API error:", error);

      if (error.response && error.response.status === 401) {
        console.log("Authentication failed - token may be expired");
      }

      const aiResponses = [
        "I understand. Would you like to try some breathing exercises?",
        "Thank you for sharing. How long have you been feeling this way?",
        "I'm here to listen. Would you like me to suggest some coping strategies?",
        "Would you like me to connect you with a mental health professional?",
      ];
      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponses[Math.floor(Math.random() * aiResponses.length)],
        sender: "ai",
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
      if (!chatOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    }
  };

  const handleMenuItemClick = (id) => {
    switchDashboardTab(id);
    if (isMobile) {
      setShowMoreModal(false);
      setShowProfileMenu(false);
    }
  };

  const handleProfileClick = () => {
    switchDashboardTab("profile");
    if (isMobile) {
      setShowProfileMenu(false);
    }
  };

  const switchDashboardTab = (tabId) => {
    if (active === tabId) return;
    safeVibrate(100);
    setActive(tabId);
  };

  const handleLogout = async () => {
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      const token = await AsyncStorage.getItem("token");

      if (accessToken || token) {
        try {
          await axios.post(
            `${API_BASE_URL}/api/auth/logout`,
            { refreshToken },
            {
              headers: {
                Authorization: `Bearer ${accessToken || token}`,
                "Content-Type": "application/json"
              }
            }
          );
        } catch (apiError) {
          console.error("Backend logout error:", apiError);
        }
      }

      await AsyncStorage.clear();
      navigation.replace("RoleSelector");
    } catch (error) {
      console.error("Logout error:", error);
      await AsyncStorage.clear();
      navigation.replace("RoleSelector");
    }
  };

  const handleDeleteConfirm = () => {
    safeVibrate([220, 100, 220]);
    setShowDeleteConfirm(false);
    setDeleteSuccess(true);
    setTimeout(() => {
      navigation.navigate("RoleSelector");
    }, 2500);
  };

  const handleAcceptCall = async (callId) => {
    forceStopRingtone();
    setShowCallModal(false);
    setCallerInfo({ name: '', image: null, userId: '', userName: '', callId: '', roomId: '', waitingDuration: 0 });
    pollBlockedUntilRef.current = Date.now() + 6000;
    try {
      const token = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
      const storedUserId = await AsyncStorage.getItem('userId');
      if (!token || !storedUserId) return;

      const acceptRes = await axios.put(
        API_BASE_URL + '/api/video/calls/' + callId + '/accept',
        { acceptorId: storedUserId, acceptorType: 'user' },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (!acceptRes.data?.success) return;

      let detailedCall = null;
      try {
        const detailsRes = await axios.get(
          API_BASE_URL + '/api/video/calls/' + callId + '/details',
          { params: { userId: storedUserId, userType: 'user' }, headers: { Authorization: 'Bearer ' + token } }
        );
        detailedCall = detailsRes.data?.call || null;
      } catch (_) {}

      const incomingType = String(callerInfo.callType || callType || 'video').toLowerCase();
      const modalType = incomingType === 'audio' ? 'voice' : incomingType;
      const remoteParticipant = detailedCall?.initiator || callerInfo?.from || {};

      const acceptedCallData = {
        id: detailedCall?.id || detailedCall?._id || callId,
        callId,
        roomId: acceptRes.data?.roomId || detailedCall?.roomId || callerInfo.roomId,
        name: remoteParticipant?.fullName || remoteParticipant?.displayName || callerInfo.name || 'Counselor',
        type: modalType,
        callType: modalType,
        status: acceptRes.data?.status || detailedCall?.status || 'active',
        profilePic: remoteParticipant?.profilePhoto || callerInfo.image || null,
        phoneNumber: remoteParticipant?.phoneNumber || '',
        apiCallData: detailedCall,
        initiator: detailedCall?.initiator,
        receiver: detailedCall?.receiver,
        initiatorId: detailedCall?.initiator?.id || detailedCall?.initiator?._id,
        receiverId: detailedCall?.receiver?.id || detailedCall?.receiver?._id,
        currentUserId: storedUserId,
        currentUserType: 'user',
        isIncoming: true,
      };

      setSelectedCall(acceptedCallData);
      if (modalType === 'video') setIsVideoModalOpen(true);
      else setIsVoiceModalOpen(true);
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const handleRejectCall = async (callId) => {
    forceStopRingtone();
    setShowCallModal(false);
    setCallerInfo({ name: '', image: null, userId: '', userName: '', callId: '', roomId: '', waitingDuration: 0 });
    // Block polling so the backend has time to process the reject before we poll again
    pollBlockedUntilRef.current = Date.now() + 6000;
    try {
      const token = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
      const storedUserId = await AsyncStorage.getItem('userId');
      if (token && storedUserId && callId) {
        await axios.put(
          API_BASE_URL + '/api/video/calls/' + callId + '/reject',
          { userId: storedUserId, reason: 'declined' },
          { headers: { Authorization: 'Bearer ' + token } }
        ).catch(() => {});
      }
    } catch (_) {}
  };

  const allMenuItems = [
    { id: "Chat", icon: "chat", label: "Chat", type: "material" },
    { id: "Counselor", icon: "psychology", label: "Counselor", type: "material" },
    { id: "Appointment", icon: "event-available", label: "My Appointment", type: "material" },
    { id: "Wallet", icon: "account-balance-wallet", label: "Wallet", type: "material" },
    { id: "Video", icon: "history", label: "Call History", type: "material" },
  ];

  const renderContent = () => {
    switch (active) {
      case "Chat":
        return <ChatInterface setActiveTab={switchDashboardTab} />;
      case "Counselor":
        return <CounselorTable initialSearchQuery={targetCounselor} />;
      case "Appointment":
        return <MyAppointmentsPanel onBookPress={() => setActive("Counselor")} />;
      case "Wallet":
        return <WalletDashboard />;
      case "Video":
        return <CallHistory />;
      case "profile":
        return <PatientProfile />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />

      <CallModal
        isOpen={showCallModal}
        onClose={() => {
          forceStopRingtone();
          setShowCallModal(false);
          setCallerInfo({ name: '', image: null, userId: '', userName: '', callId: '', roomId: '', waitingDuration: 0 });
          pollBlockedUntilRef.current = Date.now() + 6000;
        }}
        callType={callType}
        callerName={callerInfo.userName || callerInfo.name}
        callerImage={callerInfo.image}
        callData={callerInfo}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
      />

      <RealVideoCallModal
        isOpen={isVideoModalOpen}
        onClose={() => {
          pollBlockedUntilRef.current = Date.now() + 6000;
          setIsVideoModalOpen(false);
          setSelectedCall(null);
          setShowCallModal(false);
          setCallerInfo({ name: '', image: null, userId: '', userName: '', callId: '', roomId: '', waitingDuration: 0 });
        }}
        callData={selectedCall}
        onEndCall={async (callId) => {
          try {
            const token = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
            const storedUserId = await AsyncStorage.getItem('userId');
            if (token && storedUserId && callId) {
              await axios.put(
                API_BASE_URL + '/api/video/calls/' + callId + '/end',
                { userId: storedUserId, endedBy: 'user' },
                { headers: { Authorization: 'Bearer ' + token } }
              ).catch(() => {});
            }
          } catch (_) {}
        }}
      />

      <RealVoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={() => {
          pollBlockedUntilRef.current = Date.now() + 6000;
          setIsVoiceModalOpen(false);
          setSelectedCall(null);
          setShowCallModal(false);
          setCallerInfo({ name: '', image: null, userId: '', userName: '', callId: '', roomId: '', waitingDuration: 0 });
        }}
        callData={selectedCall}
        onEndCall={async (callId) => {
          try {
            const token = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
            const storedUserId = await AsyncStorage.getItem('userId');
            if (token && storedUserId && callId) {
              await axios.put(
                API_BASE_URL + '/api/video/calls/' + callId + '/end',
                { userId: storedUserId, endedBy: 'user' },
                { headers: { Authorization: 'Bearer ' + token } }
              ).catch(() => {});
            }
          } catch (_) {}
        }}
      />

      {/* HEADER - Exactly matching screen.png */}
      <View style={styles.header}>
  <View style={styles.headerLeft}>
    <Text style={styles.userName}>{userData.name || 'User'}</Text>
  </View>
  <TouchableOpacity 
    style={styles.profileImageWrapper}
    onPress={() => setShowProfileMenu(!showProfileMenu)}
    activeOpacity={0.7}
  >
    {userData.profilePhoto ? (
      <Image source={{ uri: userData.profilePhoto }} style={styles.profileImageHeader} />
    ) : (
      <View style={styles.profileImagePlaceholderHeader}>
        <Text style={styles.profileInitialsHeader}>
          {userData.name?.charAt(0) || 'U'}
        </Text>
      </View>
    )}
  </TouchableOpacity>

  {/* Profile Dropdown Menu */}
  {showProfileMenu && (
    <Animated.View style={[styles.profileDropdown, { opacity: headerAnim }]}>
      <View style={styles.dropdownHeader}>
        {userData.profilePhoto ? (
          <Image source={{ uri: userData.profilePhoto }} style={styles.dropdownAvatar} />
        ) : (
          <View style={styles.dropdownAvatarPlaceholder}>
            <Text style={styles.dropdownAvatarText}>
              {userData.name?.charAt(0) || 'U'}
            </Text>
          </View>
        )}
        <View style={styles.dropdownUserInfo}>
          <Text style={styles.dropdownUserName}>{userData.name}</Text>
          <Text style={styles.dropdownUserEmail}>{userData.email}</Text>
        </View>
      </View>
      <View style={styles.dropdownItems}>
        <TouchableOpacity style={styles.dropdownItem} onPress={handleProfileClick}>
          <MaterialIcons name="person" size={18} color="#4A90E2" />
          <Text style={styles.dropdownItemText}>My Profile</Text>
        </TouchableOpacity>
        <View style={styles.dropdownDivider} />
        <TouchableOpacity
          style={[styles.dropdownItem, styles.logoutDropdownItem]}
          onPress={() => setShowLogoutConfirm(true)}
        >
          <MaterialIcons name="logout" size={18} color="#ef4444" />
          <Text style={[styles.dropdownItemText, styles.logoutText]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )}
</View>

      {/* MAIN CONTENT */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>

      {/* AI FLOATING BUTTON - Exactly matching screen.png */}
      <TouchableOpacity
        style={styles.aiButton}
        onPress={() => setChatOpen(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#7c83fd', '#4e56cc']}
          style={styles.aiButtonGradient}
        >
          <MaterialIcons name="auto-awesome" size={24} color="white" />
          <Text style={styles.aiButtonText}>AI</Text>
        </LinearGradient>
        {unreadCount > 0 && !chatOpen && (
          <View style={styles.aiUnreadBadge}>
            <Text style={styles.aiUnreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* CHAT POPUP */}
      {chatOpen && (
        <ChatPopup
          messages={chatMessages}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          sendMessage={sendMessage}
          isLoading={isLoading}
          onClose={() => setChatOpen(false)}
          onCounselorPress={handleAIContactClick}
        />
      )}

      {/* BOTTOM NAVIGATION - Exactly matching screen.png */}
      {/* BOTTOM NAVIGATION - Exactly matching screen.png */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, active === "Chat" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Chat")}
        >
          <View style={[styles.navIconWrapper, active === "Chat" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="chat"
              size={26}
              color={active === "Chat" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Chat" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, active === "Counselor" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Counselor")}
        >
          <View style={[styles.navIconWrapper, active === "Counselor" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="psychology"
              size={24}
              color={active === "Counselor" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Counselor" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>Counselor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, active === "Appointment" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Appointment")}
        >
          <View style={[styles.navIconWrapper, active === "Appointment" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="event-available"
              size={24}
              color={active === "Appointment" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Appointment" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>Appointment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, active === "Wallet" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Wallet")}
        >
          <View style={[styles.navIconWrapper, active === "Wallet" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="account-balance-wallet"
              size={24}
              color={active === "Wallet" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Wallet" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setShowMoreModal(true)}
        >
          <View style={styles.navIconWrapper}>
            <MaterialIcons name="more-horiz" size={24} color="#94a3b8" />
          </View>
          <Text style={styles.navLabel} numberOfLines={1} adjustsFontSizeToFit>More</Text>
        </TouchableOpacity>
      </View>

      {/* MORE MODAL - Premium Redesign */}
      <Modal transparent={true} visible={showMoreModal} animationType="slide">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMoreModal(false)}
        >
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.premiumMoreModal, { transform: [{ translateY: 0 }] }]}>
                <LinearGradient
                  colors={['#1e293b', '#0f172a']}
                  style={styles.premiumMoreHeader}
                >
                  <View style={styles.premiumHeaderLine} />
                  <View style={styles.premiumHeaderTitleRow}>
                    <Text style={styles.premiumMoreTitle}>Settings & More</Text>
                    <TouchableOpacity 
                      onPress={() => setShowMoreModal(false)}
                      style={styles.premiumCloseBtn}
                    >
                      <MaterialIcons name="close" size={24} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>

                <ScrollView 
                  style={styles.premiumMoreBody}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.premiumMoreSection}>
                    <Text style={styles.premiumSectionTitle}>Dashboard Services</Text>
                    {allMenuItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.premiumListItem}
                        onPress={() => handleMenuItemClick(item.id)}
                      >
                        <View style={[
                          styles.premiumListIcon, 
                          { backgroundColor: active === item.id ? '#eff6ff' : '#f8fafc' }
                        ]}>
                          <MaterialIcons 
                            name={item.icon} 
                            size={20} 
                            color={active === item.id ? "#3b82f6" : "#64748b"} 
                          />
                        </View>
                        <Text style={[
                          styles.premiumListText,
                          active === item.id && { color: '#3b82f6' }
                        ]}>
                          {item.label}
                        </Text>
                        <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.premiumMoreSection}>
                    <Text style={styles.premiumSectionTitle}>Account Settings</Text>
                    <TouchableOpacity 
                      style={styles.premiumListItem}
                      onPress={() => {
                        setShowMoreModal(false);
                        switchDashboardTab("profile");
                      }}
                    >
                      <View style={[styles.premiumListIcon, { backgroundColor: '#eff6ff' }]}>
                        <MaterialIcons name="person" size={20} color="#3b82f6" />
                      </View>
                      <Text style={styles.premiumListText}>My Profile</Text>
                      <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.premiumListItem}
                      onPress={() => Alert.alert("Support", "Support feature coming soon!")}
                    >
                      <View style={[styles.premiumListIcon, { backgroundColor: '#f0fdf4' }]}>
                        <MaterialIcons name="help-outline" size={20} color="#22c55e" />
                      </View>
                      <Text style={styles.premiumListText}>Help & Support</Text>
                      <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.premiumListItem}
                      onPress={() => Alert.alert("Privacy", "Privacy Policy coming soon!")}
                    >
                      <View style={[styles.premiumListIcon, { backgroundColor: '#faf5ff' }]}>
                        <MaterialIcons name="security" size={20} color="#a855f7" />
                      </View>
                      <Text style={styles.premiumListText}>Privacy Policy</Text>
                      <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.premiumMoreSection, { marginBottom: 10 }]}>
                    <TouchableOpacity
                      style={styles.premiumLogoutBtn}
                      onPress={() => {
                        setShowMoreModal(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      <MaterialIcons name="logout" size={20} color="#ffffff" />
                      <Text style={styles.premiumLogoutText}>Logout Account</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* LOGOUT CONFIRM MODAL */}
      <Modal transparent={true} visible={showLogoutConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>Confirm Logout</Text>
            </View>
            <View style={styles.confirmModalBody}>
              <Text style={styles.confirmModalText}>Are you sure you want to logout?</Text>
            </View>
            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmLogoutBtn]}
                onPress={handleLogout}
              >
                <Text style={styles.confirmLogoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal transparent={true} visible={showDeleteConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>Delete Account</Text>
            </View>
            <View style={styles.confirmModalBody}>
              <Text style={styles.confirmModalText}>
                This action cannot be undone. All your data will be permanently deleted.
              </Text>
            </View>
            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={handleDeleteConfirm}
              >
                <Text style={styles.deleteBtnText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE SUCCESS MODAL */}
      <Modal transparent={true} visible={deleteSuccess} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, styles.successModal]}>
            <View style={styles.confirmModalHeader}>
              <Text style={[styles.confirmModalTitle, styles.successTitle]}>
                <MaterialIcons name="check-circle" size={20} color="#10b981" /> Account Deleted!
              </Text>
            </View>
            <View style={styles.confirmModalBody}>
              <Text style={styles.confirmModalText}>Your account has been successfully deleted.</Text>
              <Text style={styles.confirmModalText}>Redirecting...</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },

 header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  headerLeft: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  
  // Profile Image - Matching iOS style
  profileImageWrapper: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImageHeader: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholderHeader: {
    width: '100%',
    height: '100%',
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Profile Dropdown - Matching iOS style
  profileDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 65,
    right: 15,
    width: 280,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 101,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  dropdownHeader: {
    padding: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  dropdownAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  dropdownAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  dropdownUserInfo: {
    flex: 1,
  },
  dropdownUserName: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  dropdownUserEmail: {
    color: '#64748b',
    fontSize: 12,
  },
  dropdownItems: {
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  logoutDropdownItem: {
    backgroundColor: '#fff5f5',
  },
  logoutText: {
    color: '#ef4444',
  },
  
  // Main Content
  contentContainer: {
    flex: 1,
  },

  appointmentsRoot: {
    flex: 1,
    backgroundColor: "#f0f4ff",
  },

  // Top bar: tabs + filters
  appointmentsTopBar: {
    backgroundColor: "#ffffff",
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e8ecf5",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  appointmentsTabRow: {
    flexDirection: "row",
    backgroundColor: "#f0f4ff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  aptTabBtn: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 9,
    alignItems: "center",
  },
  aptTabBtnActive: {
    backgroundColor: "#4f46e5",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  aptTabText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  aptTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  appointmentFilterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#f0f4ff",
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  filterChipActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  filterChipText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },

  // List
  appointmentsList: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 14,
    gap: 14,
  },
  appointmentLoaderWrap: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  appointmentLoaderText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
  },
  appointmentEmptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  appointmentEmptyTitle: {
    marginTop: 14,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "700",
  },
  appointmentEmptySubtitle: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // Card
  appointmentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4,
  },
  aptCardAccent: {
    height: 4,
    width: "100%",
  },
  appointmentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  aptAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e0e7ff",
  },
  appointmentAvatar: {
    width: 54,
    height: 54,
  },
  appointmentMetaColumn: {
    flex: 1,
  },
  appointmentDoctorName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  appointmentSpecialization: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  aptStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  aptStatusText: {
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  aptStatusPending: {
    backgroundColor: "#fff4e5",
  },
  aptStatusConfirmed: {
    backgroundColor: "#ede9fe",
  },
  aptStatusCompleted: {
    backgroundColor: "#dcfce7",
  },
  aptStatusCanceled: {
    backgroundColor: "#fee2e2",
  },

  aptDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginHorizontal: 16,
    marginTop: 14,
  },
  appointmentDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  aptDateIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  aptTimeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c7d2fe",
    marginHorizontal: 4,
  },
  appointmentDateText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  appointmentActionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  appointmentDetailsBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e0e7ff",
    borderRadius: 13,
    paddingVertical: 11,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#f5f3ff",
  },
  appointmentDetailsText: {
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: "700",
  },
  appointmentBookBtn: {
    flex: 1,
    backgroundColor: "#4f46e5",
    borderRadius: 13,
    paddingVertical: 11,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  appointmentBookText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  appointmentDetailsModal: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    width: width * 0.88,
    maxWidth: 420,
  },
  detailsCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentDetailsTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
  },
  appointmentDetailsLine: {
    color: "#475569",
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 22,
  },

  // AI FLOATING BUTTON - Matching screen.png
  aiButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: "#7c83fd",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  aiButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
  },
  aiButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  aiUnreadBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ef4444",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  aiUnreadBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },

  // BOTTOM NAVIGATION - Matching screen.png
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#081625",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "stretch",
    height: Platform.OS === "ios" ? 82 : 68,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingBottom: Platform.OS === "ios" ? 20 : 4,
    zIndex: 998,
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  navItemActive: {
    backgroundColor: "#1e2b3c",
  },
  navIconWrapper: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
  },
  navIconWrapperActive: {
    borderTopWidth: 3,
    borderTopColor: "#ffffff",
    paddingTop: 6,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94a3b8",
    marginTop: 2,
    textAlign: "center",
  },
  navLabelActive: {
    color: "#ffffff",
  },

  // Chat Popup Styles
  chatPopupOverlay: {
    position: "absolute",
    bottom: 90,
    right: 20,
    left: 20,
    zIndex: 1000,
  },
  chatPopup: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    height: 480,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  chatPopupHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  chatAvatarGradient: {
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  chatAvatarSmall: {
    width: 32,
    height: 32,
  },
  userAvatar: {
    backgroundColor: "transparent",
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  chatStatus: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  chatCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  chatPopupBody: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  chatMessageWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    maxWidth: "85%",
  },
  chatMessageWrapperUser: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  chatMessageWrapperAi: {
    alignSelf: "flex-start",
  },
  chatBubble: {
    padding: 10,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eaeaea",
    maxWidth: "100%",
  },
  chatBubbleUser: {
    backgroundColor: "#667eea",
    borderColor: "#667eea",
  },
  chatBubbleText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  chatCounselorMention: {
    color: "#1d4ed8",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  chatBubbleTextUser: {
    color: "#ffffff",
  },
  chatPopupFooter: {
    padding: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#eaeaea",
    flexDirection: "row",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 24,
    fontSize: 14,
    backgroundColor: "#f8f9fa",
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#667eea",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 6,
  },
  loadingDot: {
    width: 8,
    height: 8,
    backgroundColor: "#667eea",
    borderRadius: 4,
  },

  // Call Modal Styles
  callModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  callModal: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    width: width * 0.9,
    maxWidth: 360,
    overflow: "hidden",
  },
  callModalContent: {
    padding: 24,
    alignItems: "center",
  },
  callerInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  callerAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  callerAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 45,
  },
  callerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e1b3a",
    marginBottom: 4,
  },
  callType: {
    fontSize: 14,
    color: "#667eea",
  },
  callControls: {
    flexDirection: "row",
    gap: 16,
  },
  callBtn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 40,
    minWidth: 100,
  },
  acceptBtn: {
    backgroundColor: "#22c55e",
  },
  rejectBtn: {
    backgroundColor: "#ef4444",
  },
  callBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Video Call Modal Styles
  videoCallModalOverlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoCallModal: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  remoteVideoPlaceholder: {
    alignItems: "center",
  },
  remoteAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  remoteName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 10,
  },
  videoLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  videoLoadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  localVideoPreview: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 100,
    height: 140,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#667eea",
  },
  localVideoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  localVideoText: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 4,
  },
  videoCallControls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  videoCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  endCallBtn: {
    backgroundColor: "#ef4444",
  },

  // Voice Call Modal Styles
  voiceCallModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceCallModal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 32,
    padding: 40,
    width: width * 0.85,
    maxWidth: 400,
  },
  voiceCallContent: {
    alignItems: "center",
  },
  voiceCallerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  voiceAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  voiceCallerName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  voiceCallStatus: {
    fontSize: 14,
    color: "#667eea",
    marginBottom: 32,
  },
  voiceCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Premium More Modal Styles
  premiumMoreModal: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    width: width,
    height: height * 0.75,
    position: 'absolute',
    bottom: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 25,
  },
  premiumMoreHeader: {
    padding: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  premiumHeaderLine: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    marginBottom: 20,
  },
  premiumHeaderTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  premiumMoreTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  premiumCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  premiumMoreBody: {
    flex: 1,
    padding: 24,
    backgroundColor: "#ffffff",
  },
  premiumMoreSection: {
    marginBottom: 28,
  },
  premiumSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  premiumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  premiumListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  premiumListIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  premiumListText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  premiumLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  premiumLogoutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  premiumDeleteBtn: {
    alignItems: "center",
    padding: 16,
    marginTop: 8,
  },
  premiumDeleteText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  confirmModal: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    width: width * 0.85,
    maxWidth: 400,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  confirmModalBody: {
    padding: 24,
    alignItems: "center",
  },
  confirmModalText: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  confirmModalFooter: {
    padding: 16,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cancelBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  confirmLogoutBtn: {
    backgroundColor: "#ef4444",
  },
  confirmLogoutBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  deleteBtn: {
    backgroundColor: "#ef4444",
  },
  deleteBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  successModal: {
    borderTopWidth: 4,
    borderTopColor: "#10b981",
  },
  successTitle: {
    color: "#10b981",
  },
});