import React, { useState, useEffect, useRef } from "react";
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
  SafeAreaView,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { API_BASE_URL } from "../../../../../axiosConfig";
import Icon from "react-native-vector-icons/FontAwesome5";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import safeVibrate from "../../../../../utils/safeVibrate";
import ChatInterface from "../Tab/chatbot/ChatInterface";
import CounselorTable from "../Tab/Appointment/BookAppointment";
import WalletDashboard from "../Tab/Wallet/WalletDashboard";
import CallHistory from "../Tab/Callls/CallHistory";
import PatientProfile from "../../PatientProfile/PatientProfile";

const { width, height } = Dimensions.get("window");

// Improved ChatPopup Component
const ChatPopup = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  isLoading,
  onClose,
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
          {messages.map((message) => (
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
                  {message.text}
                </Text>
              </View>
              {message.sender === "user" && (
                <View style={[styles.chatAvatar, styles.chatAvatarSmall, styles.userAvatar]}>
                  <Ionicons name="person-circle" size={18} color="#667eea" />
                </View>
              )}
            </View>
          ))}
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

// Video Call Modal Component
const VideoCallModal = ({ isOpen, onClose, callData, onEndCall }) => (
  <Modal transparent={true} visible={isOpen} animationType="slide">
    <View style={styles.videoCallModalOverlay}>
      <View style={styles.videoCallModal}>
        <View style={styles.videoBackground}>
          <View style={styles.remoteVideoPlaceholder}>
            {callData?.from?.profilePhoto ? (
              <Image source={{ uri: callData.from.profilePhoto }} style={styles.remoteAvatar} />
            ) : (
              <MaterialIcons name="person" size={80} color="#667eea" />
            )}
            <Text style={styles.remoteName}>{callData?.from?.fullName || "Counselor"}</Text>
            <View style={styles.videoLoading}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.videoLoadingText}>Connecting...</Text>
            </View>
          </View>
          <View style={styles.localVideoPreview}>
            <View style={styles.localVideoPlaceholder}>
              <MaterialIcons name="videocam" size={24} color="#667eea" />
              <Text style={styles.localVideoText}>You</Text>
            </View>
          </View>
        </View>
        <View style={styles.videoCallControls}>
          <TouchableOpacity style={[styles.videoCallBtn, styles.endCallBtn]} onPress={onClose}>
            <MaterialIcons name="call-end" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Voice Call Modal Component
const VoiceCallModal = ({ isOpen, onClose, callData, onEndCall }) => (
  <Modal transparent={true} visible={isOpen} animationType="slide">
    <View style={styles.voiceCallModalOverlay}>
      <View style={styles.voiceCallModal}>
        <View style={styles.voiceCallContent}>
          <View style={styles.voiceCallerAvatar}>
            {callData?.from?.profilePhoto ? (
              <Image source={{ uri: callData.from.profilePhoto }} style={styles.voiceAvatar} />
            ) : (
              <MaterialIcons name="person" size={60} color="#667eea" />
            )}
          </View>
          <Text style={styles.voiceCallerName}>{callData?.from?.fullName || "Counselor"}</Text>
          <Text style={styles.voiceCallStatus}>Connecting...</Text>
          <TouchableOpacity style={[styles.voiceCallBtn, styles.endCallBtn]} onPress={onClose}>
            <MaterialIcons name="call-end" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const MyAppointmentsPanel = ({ onBookPress }) => {
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedApt, setSelectedApt] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
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
    };

    fetchAppointments();
  }, []);

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
      <LinearGradient colors={["#0f172a", "#1e293b"]} style={styles.appointmentsHero}>
        <Text style={styles.appointmentsHeroTitle}>My Appointments</Text>
        <Text style={styles.appointmentsHeroSubtitle}>
          Track upcoming sessions and review previous consultations.
        </Text>

        <View style={styles.appointmentsHeroTabs}>
          <TouchableOpacity
            onPress={() => setActiveTab("Upcoming")}
            style={[styles.heroTabBtn, activeTab === "Upcoming" && styles.heroTabBtnActive]}
          >
            <Text style={[styles.heroTabText, activeTab === "Upcoming" && styles.heroTabTextActive]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("Past")}
            style={[styles.heroTabBtn, activeTab === "Past" && styles.heroTabBtnActive]}
          >
            <Text style={[styles.heroTabText, activeTab === "Past" && styles.heroTabTextActive]}>Past</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

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

      <ScrollView contentContainerStyle={styles.appointmentsList} showsVerticalScrollIndicator={false}>
        {loadingAppointments ? (
          <View style={styles.appointmentLoaderWrap}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.appointmentLoaderText}>Loading appointments...</Text>
          </View>
        ) : displayApts.length === 0 ? (
          <View style={styles.appointmentEmptyCard}>
            <MaterialIcons name="event-busy" size={30} color="#94a3b8" />
            <Text style={styles.appointmentEmptyTitle}>No appointments found</Text>
            <Text style={styles.appointmentEmptySubtitle}>
              Try changing filters or book a new session with a counselor.
            </Text>
          </View>
        ) : (
          displayApts.map((apt) => (
            <View key={apt._id} style={styles.appointmentCard}>
              <View style={styles.appointmentCardHeader}>
                <Image source={{ uri: getAvatarSrc(apt) }} style={styles.appointmentAvatar} />
                <View style={styles.appointmentMetaColumn}>
                  <Text style={styles.appointmentDoctorName} numberOfLines={1}>
                    Dr. {apt?.counselor?.fullName || "Counselor"}
                  </Text>
                  <Text style={styles.appointmentSpecialization} numberOfLines={1}>
                    {apt?.counselor?.specialization || "Mental Wellness Specialist"}
                  </Text>
                </View>
                <View style={[styles.aptStatusPill, getStatusStyle(apt.status)]}>
                  <Text style={styles.aptStatusText}>{apt.status || "pending"}</Text>
                </View>
              </View>

              <View style={styles.appointmentDateRow}>
                <MaterialIcons name="event" size={16} color="#4f46e5" />
                <Text style={styles.appointmentDateText}>
                  {new Date(apt.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {"  •  "}
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
                  <MaterialIcons name="visibility" size={15} color="#334155" />
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
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");

      const response = await axios.post(
        `${API_BASE_URL}/api/chat/send`,
        {
          userId: userId,
          message: newMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }
      );

      if (response.data && response.data.reply) {
        const aiMessage = {
          id: Date.now() + 1,
          text: response.data.reply,
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
    setSelectedCall(callerInfo);
    if (callType !== "video") {
      setIsVoiceModalOpen(true);
    } else {
      setIsVideoModalOpen(true);
    }
    setShowCallModal(false);
  };

  const handleRejectCall = async (callId) => {
    setShowCallModal(false);
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
        return <CounselorTable />;
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
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />

      <CallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        callType={callType}
        callerName={callerInfo.userName || callerInfo.name}
        callerImage={callerInfo.image}
        callData={callerInfo}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
      />

      <VideoCallModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        callData={selectedCall}
        onEndCall={() => { }}
      />

      <VoiceCallModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        callData={selectedCall}
        onEndCall={() => { }}
      />

      {/* HEADER - Exactly matching screen.png */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../../../../image/Mediconect Logo-3.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Mediconecket</Text>
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
                <MaterialIcons name="person" size={18} color="#3B82F6" />
                <Text style={styles.dropdownItemText}>My Profile</Text>
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity
                style={[styles.dropdownItem, styles.logoutDropdownItem]}
                onPress={() => setShowLogoutConfirm(true)}
              >
                <MaterialIcons name="logout" size={18} color="#dc2626" />
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
          <Text style={[styles.navLabel, active === "Chat" && styles.navLabelActive]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, active === "Counselor" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Counselor")}
        >
          <View style={[styles.navIconWrapper, active === "Counselor" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="psychology"
              size={26}
              color={active === "Counselor" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Counselor" && styles.navLabelActive]}>Counselor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, active === "Appointment" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Appointment")}
        >
          <View style={[styles.navIconWrapper, active === "Appointment" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="event-available"
              size={26}
              color={active === "Appointment" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Appointment" && styles.navLabelActive]}>Appointment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, active === "Wallet" && styles.navItemActive]}
          onPress={() => handleMenuItemClick("Wallet")}
        >
          <View style={[styles.navIconWrapper, active === "Wallet" && styles.navIconWrapperActive]}>
            <MaterialIcons
              name="account-balance-wallet"
              size={26}
              color={active === "Wallet" ? "#ffffff" : "#94a3b8"}
            />
          </View>
          <Text style={[styles.navLabel, active === "Wallet" && styles.navLabelActive]}>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setShowMoreModal(true)}
        >
          <View style={styles.navIconWrapper}>
            <MaterialIcons name="more-horiz" size={26} color="#94a3b8" />
          </View>
          <Text style={styles.navLabel}>More</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },

  header: {
    backgroundColor: "#ffffff",
    paddingTop: Platform.OS === "ios" ? 40 : 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
    marginTop: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLogo: {
    width: 36,
    height: 36,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 4,
  },
  profileImageWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    // Premium Shadow
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImageHeader: {
    width: "100%",
    height: "100%",
  },
  profileImagePlaceholderHeader: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1d2b3a",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitialsHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1D2B3A",
    letterSpacing: -0.5,
  },

  // Profile Dropdown
  profileDropdown: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 70,
    right: 20,
    width: 280,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 101,
  },
  dropdownHeader: {
    padding: 20,
    backgroundColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dropdownAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  dropdownAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  dropdownAvatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  dropdownUserInfo: {
    flex: 1,
  },
  dropdownUserName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  dropdownUserEmail: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  dropdownItems: {
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingHorizontal: 20,
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 4,
  },
  logoutDropdownItem: {
    backgroundColor: "#fff5f5",
  },

  // Main Content
  contentContainer: {
    flex: 1,
  },

  appointmentsRoot: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  appointmentsHero: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  appointmentsHeroTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  appointmentsHeroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  appointmentsHeroTabs: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    gap: 6,
  },
  heroTabBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  heroTabBtnActive: {
    backgroundColor: "#ffffff",
  },
  heroTabText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTabTextActive: {
    color: "#0f172a",
  },
  appointmentFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#312e81",
  },
  filterChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  appointmentsList: {
    paddingHorizontal: 12,
    paddingBottom: 120,
    paddingTop: 6,
    gap: 10,
  },
  appointmentLoaderWrap: {
    alignItems: "center",
    paddingVertical: 40,
  },
  appointmentLoaderText: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 13,
  },
  appointmentEmptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  appointmentEmptyTitle: {
    marginTop: 10,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  appointmentEmptySubtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  appointmentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  appointmentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appointmentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  appointmentMetaColumn: {
    flex: 1,
  },
  appointmentDoctorName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  appointmentSpecialization: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  aptStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aptStatusText: {
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  aptStatusPending: {
    backgroundColor: "#fff7ed",
  },
  aptStatusConfirmed: {
    backgroundColor: "#eef2ff",
  },
  aptStatusCompleted: {
    backgroundColor: "#ecfdf5",
  },
  aptStatusCanceled: {
    backgroundColor: "#fef2f2",
  },
  appointmentDateRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  appointmentDateText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  appointmentActionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  appointmentDetailsBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 10,
    paddingVertical: 9,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  appointmentDetailsText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  appointmentBookBtn: {
    flex: 1,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 9,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  appointmentBookText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  appointmentDetailsModal: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    width: width * 0.88,
    maxWidth: 420,
  },
  detailsCloseBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
  },
  appointmentDetailsTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  appointmentDetailsLine: {
    color: "#334155",
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
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
    height: 80,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    zIndex: 998,
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  navItemActive: {
    backgroundColor: "#1e2b3c",
  },
  navIconWrapper: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  navIconWrapperActive: {
    borderTopWidth: 4,
    borderTopColor: "#ffffff",
    paddingTop: 8,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94a3b8",
    marginTop: 4,
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