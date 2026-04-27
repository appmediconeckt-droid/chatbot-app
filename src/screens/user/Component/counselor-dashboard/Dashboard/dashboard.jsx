import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
  Animated,
  Easing,
  RefreshControl,
  KeyboardAvoidingView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../../../../axiosConfig";

// Icons (using only FontAwesome6 - no MaterialIcons)
import Icon from "react-native-vector-icons/FontAwesome6";
import Feather from "react-native-vector-icons/Feather";

// Custom Hooks
import useVibration from "../../../../../hooks/useVibration";
import Dashboard from "../Tab/CounselorDashboard/Dashboardcou";
import Messagesou from "../Tab/Messages/Messagesou";
import PatientRequests from "../Tab/PatientRequests/PatientRequests";
import CounselorProfile from "../Tab/Profile-Con/CounselorProfile";
import VideoCallModal from "../../UserDashboard/Tab/CallModal/VideoCallModal";
import VoiceCallModal from "../../UserDashboard/Tab/CallModal/VoiceCallModal";
import safeVibrate from "../../../../../utils/safeVibrate";
import { useToast } from "../../../../../components/common/ToastProvider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Incoming Call Modal Component
const IncomingCallModal = ({
  isOpen,
  onClose,
  callType,
  callerName,
  callerImage,
  callData,
  onAccept,
  onReject,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();
      startPulse();
    } else {
      scaleAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [isOpen]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  if (!isOpen) return null;

  const getDisplayName = () => {
    if (callData?.from?.isAnonymous) return callData.from.isAnonymous;
    if (callerName) return callerName;
    return "User";
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    if (onAccept) await onAccept(callData);
    setIsAccepting(false);
    onClose();
  };

  const handleReject = async () => {
    setIsRejecting(true);
    if (onReject) await onReject(callData?.callId);
    setIsRejecting(false);
    onClose();
  };

  return (
    <Modal transparent visible={isOpen} animationType="fade">
      <View style={styles.incomingCallOverlay}>
        <Animated.View
          style={[
            styles.incomingCallModal,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.incomingCallHeader}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.incomingCallAvatar}>
                {callerImage &&
                  (callerImage === "👨" ||
                    callerImage === "👩" ||
                    callerImage === "👤") ? (
                  <Text style={styles.avatarEmojiLarge}>{callerImage}</Text>
                ) : callerImage ? (
                  <Image source={{ uri: callerImage }} style={styles.avatarImage} />
                ) : (
                  <Icon name="user-circle" size={80} color="#fff" />
                )}
              </View>
            </Animated.View>
            <Text style={styles.incomingCallerName}>{getDisplayName()}</Text>
            <Text style={styles.incomingCallType}>
              {callType === "video" ? "📹 Video Call" : "📞 Voice Call"}
            </Text>
            <Text style={styles.incomingCallStatus}>Incoming call...</Text>
          </View>

          <View style={styles.incomingCallActions}>
            <TouchableOpacity
              style={[styles.incomingCallBtn, styles.rejectBtn]}
              onPress={handleReject}
              disabled={isRejecting}
            >
              {isRejecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="phone-slash" size={20} color="#fff" />
              )}
              <Text style={styles.incomingCallBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.incomingCallBtn, styles.acceptBtn]}
              onPress={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="phone" size={20} color="#fff" />
              )}
              <Text style={styles.incomingCallBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Main Component
export default function CounselorDashboard() {
  const [activeTab, setActiveTab] = useState("messages");
  const [isMobile, setIsMobile] = useState(SCREEN_WIDTH <= 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [modalCountdown, setModalCountdown] = useState(10);
  const [modalTimer, setModalTimer] = useState(null);
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [waitingCalls, setWaitingCalls] = useState([]);
  const [isPolling, setIsPolling] = useState(true);
  const [counselorData, setCounselorData] = useState(null);
  const [counsellorId, setCounsellorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  const navigation = useNavigation();
  const { vibrate } = useVibration();
  const { showToast: showAppToast } = useToast();

  // Check mobile screen
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setIsMobile(window.width <= 768);
    });
    return () => subscription?.remove();
  }, []);

  // Accept Call API
  const acceptCall = async (callId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("counsellorId");

      if (!userId) {
        console.error("No counsellorId found");
        return { success: false, error: "No counsellor ID found" };
      }

      const requestBody = {
        acceptorId: userId,
        acceptorType: "counsellor",
      };

      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/accept`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      }
      return { success: false, data: response.data };
    } catch (error) {
      console.error("Error accepting call:", error);
      return { success: false, error: error.message };
    }
  };

  // Join Call API
  const joinCall = async (callId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const counsellorId = await AsyncStorage.getItem("counsellorId");

      const requestBody = {
        userId: counsellorId,
        userType: "counsellor",
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/video/calls/${callId}/join`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.success) {
        return { success: true, data: response.data };
      }
      return { success: false, data: response.data };
    } catch (error) {
      console.error("Error joining call:", error);
      return { success: false, error: error.message };
    }
  };

  // End Call API
  const endCall = async (callId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const counsellorId = await AsyncStorage.getItem("counsellorId");

      const requestBody = {
        userId: counsellorId,
        endedBy: "counsellor",
      };

      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/end`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data?.success ? response.data : null;
    } catch (error) {
      console.error("Error ending call:", error);
      return null;
    }
  };

  // Reject Call API
  const rejectCall = async (callId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const counsellorId = await AsyncStorage.getItem("counsellorId");

      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/reject`,
        {
          userId: counsellorId,
          reason: "declined",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data?.success || false;
    } catch (error) {
      console.error("Error rejecting call:", error);
      return false;
    }
  };

  // Handle Accept Incoming Call
  const handleAcceptIncomingCall = async (callData) => {
    const result = await acceptCall(callData.callId);

    if (result && result.success) {
      const token = await AsyncStorage.getItem("token");
      const counsellorId = await AsyncStorage.getItem("counsellorId");

      let detailedCall = null;
      try {
        const detailsResponse = await axios.get(
          `${API_BASE_URL}/api/video/calls/${callData.callId}/details`,
          {
            params: {
              userId: counsellorId,
              userType: "counsellor",
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        detailedCall = detailsResponse.data?.call || null;
      } catch (detailsError) {
        console.warn("Could not fetch accepted call details:", detailsError);
      }

      const incomingType = String(callData.callType || detailedCall?.type || "video").toLowerCase();
      const modalType = incomingType === "audio" ? "voice" : incomingType;

      const remoteParticipant = detailedCall
        ? String(detailedCall.initiator?.id) === String(counsellorId)
          ? detailedCall.receiver
          : detailedCall.initiator
        : callData?.from || null;

      const acceptedCallData = {
        id: detailedCall?.id || callData.callId,
        callId: callData.callId,
        roomId: result.data?.roomId || detailedCall?.roomId || callData.roomId,
        name: remoteParticipant?.displayName || remoteParticipant?.fullName || callData.name,
        isIncoming: true,
        status: result.data?.status || detailedCall?.status || "active",
        type: modalType,
        callType: modalType,
        profilePic: remoteParticipant?.profilePhoto || callData.image || null,
        phoneNumber: remoteParticipant?.phoneNumber || remoteParticipant?.phone || "",
        apiCallData: detailedCall,
        receiver: detailedCall?.receiver,
        currentUserId: counsellorId,
        currentUserType: "counsellor",
        from: callData.from,
        initiator: detailedCall?.initiator || callData.initiator,
      };

      setSelectedCall(acceptedCallData);

      if (modalType === "video") {
        setIsVideoModalOpen(true);
      } else {
        setIsVoiceModalOpen(true);
      }
    } else {
      showToast("Failed to accept call. Please try again.", "error");
    }
  };

  // Handle Reject Incoming Call
  const handleRejectIncomingCall = async (callId) => {
    await rejectCall(callId);
  };

  // Fetch Waiting Calls
  const fetchWaitingCalls = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const counsellorId = await AsyncStorage.getItem("counsellorId");

      if (!counsellorId || !token) return;

      const response = await axios.get(
        `${API_BASE_URL}/api/video/calls/pending/${counsellorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const callsList = response.data.pendingRequests || response.data.waitingCalls || response.data.calls;

      if (response.data?.success && callsList?.length > 0) {
        setWaitingCalls(callsList);

        const waitingCall = callsList.find(
          (call) => !call.status || call.status === "waiting" || call.status === "ringing"
        ) || callsList[0];

        if (waitingCall && !showIncomingCallModal && !isVideoModalOpen && !isVoiceModalOpen) {
          const fromData = waitingCall.from || waitingCall.initiator || {};
          let displayName = "Anonymous";
          if (fromData.isAnonymous) displayName = fromData.isAnonymous;
          else if (fromData.displayName) displayName = fromData.displayName;
          else if (fromData.fullName) displayName = fromData.fullName;
          else if (fromData.name) displayName = fromData.name;

          let initiatorAvatar = "👤";
          if (fromData.gender === "female") initiatorAvatar = "👩";
          else if (fromData.gender === "male") initiatorAvatar = "👨";

          setIncomingCallData({
            callId: waitingCall.callId || waitingCall.id || waitingCall._id,
            roomId: waitingCall.roomId,
            name: displayName,
            image: initiatorAvatar,
            callType: waitingCall.callType || "video",
            from: fromData,
            initiator: waitingCall.initiator,
          });

          setShowIncomingCallModal(true);
          safeVibrate([320, 160, 320]);
        }
      } else {
        setWaitingCalls([]);
      }
    } catch (error) {
      console.error("Error fetching waiting calls:", error);
    }
  };

  // Polling for waiting calls
  useEffect(() => {
    if (isPolling && !showIncomingCallModal && !isVideoModalOpen && !isVoiceModalOpen) {
      fetchWaitingCalls();
      const interval = setInterval(fetchWaitingCalls, 5000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [isPolling, showIncomingCallModal, isVideoModalOpen, isVoiceModalOpen]);

  // Stop polling when modals are open
  useEffect(() => {
    setIsPolling(!(showIncomingCallModal || isVideoModalOpen || isVoiceModalOpen));
  }, [showIncomingCallModal, isVideoModalOpen, isVoiceModalOpen]);

  // Fetch Pending Requests
  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    try {
      const token = await AsyncStorage.getItem("token");

      const response = await axios.get(`${API_BASE_URL}/api/chat/pending-requests`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        timeout: 30000,
      });

      const requests = response.data.requests || [];

      if (requests.length > 0 && pendingRequests.length !== requests.length) {
        setCurrentRequest(requests[0]);
        setShowRequestModal(true);
        startModalTimer();
      }

      setPendingRequests(requests);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const startModalTimer = () => {
    setModalCountdown(10);
    const timer = setInterval(() => {
      setModalCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowRequestModal(false);
          setCurrentRequest(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setModalTimer(timer);
  };

  // Auto-hide modal after 10 seconds
  useEffect(() => {
    if (showRequestModal) {
      const timeout = setTimeout(() => {
        setShowRequestModal(false);
        setCurrentRequest(null);
        if (modalTimer) clearInterval(modalTimer);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [showRequestModal]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (modalTimer) clearInterval(modalTimer);
    };
  }, [modalTimer]);

  // Handle Accept Request
  const handleAcceptRequest = async () => {
    if (!currentRequest) return;

    vibrate([120, 60, 120]);

    try {
      const token = await AsyncStorage.getItem("token");
      const chatId = currentRequest.chatId;

      if (!chatId) {
        showToast("Unable to accept request: missing chat ID", "error");
        return;
      }

      await axios.patch(
        `${API_BASE_URL}/api/chat/accept/${chatId}`,
        {},
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      if (modalTimer) clearInterval(modalTimer);
      setShowRequestModal(false);
      setCurrentRequest(null);
      showToast("Request accepted successfully!", "success");
      fetchPendingRequests();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      showToast(`Failed to accept request: ${errorMessage}`, "error");
    }
  };

  // Handle Reject Request
  const handleRejectRequest = async () => {
    if (!currentRequest) return;

    vibrate([120]);

    try {
      const token = await AsyncStorage.getItem("token");
      const chatId = currentRequest.chatId;

      await axios.patch(
        `${API_BASE_URL}/api/chat/reject/${chatId}`,
        {},
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      if (modalTimer) clearInterval(modalTimer);
      setShowRequestModal(false);
      setCurrentRequest(null);
      fetchPendingRequests();
      showToast("Request rejected successfully", "info");
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      showToast(`Failed to reject request: ${errorMessage}`, "error");
    }
  };

  // Handle Join Call
  const handleJoinCall = async (callId) => {
    try {
      const result = await joinCall(callId);
      if (result?.success) return { success: true, data: result.data };
      return { success: false, error: "Join failed" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Handle End Call
  const handleEndCall = async (callId) => {
    try {
      await endCall(callId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleCloseVideoModal = () => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setIsPolling(true);
  };

  const handleCloseIncomingModal = () => {
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    setIsPolling(true);
  };

  const showToast = (message, type = "info") => {
    showAppToast({
      message,
      type,
      duration: 3200,
    });
  };

  // Poll for pending requests every 10 seconds
  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(fetchPendingRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      vibrate([120, 60, 120]);

      const accessToken = await AsyncStorage.getItem("accessToken");
      const refreshToken = await AsyncStorage.getItem("refreshToken");

      if (accessToken) {
        await axios.post(
          `${API_BASE_URL}/api/auth/logout`,
          { refreshToken },
          { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
        );
      }

      await AsyncStorage.clear();
      setShowLogoutConfirm(false);
      navigation.replace("RoleSelector");
    } catch (error) {
      console.error("Logout Error:", error);
      await AsyncStorage.clear();
      setShowLogoutConfirm(false);
      navigation.replace("RoleSelector");
    }
  };

  // Fetch Counselor Data
  useEffect(() => {
    const fetchCounsellor = async () => {
      try {
        const storedCounsellorId = (await AsyncStorage.getItem("counsellorId")) || (await AsyncStorage.getItem("counselorId"));

        if (!storedCounsellorId) {
          setLoading(false);
          return;
        }

        setCounsellorId(storedCounsellorId);

        const token = (await AsyncStorage.getItem("accessToken")) || (await AsyncStorage.getItem("token"));

        const res = await axios.get(`${API_BASE_URL}/api/auth/counsellors/${storedCounsellorId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = res.data?.counsellor;
        let profilePhotoUrl = null;
        if (data.profilePhoto) {
          if (typeof data.profilePhoto === "string") profilePhotoUrl = data.profilePhoto;
          else if (data.profilePhoto.url) profilePhotoUrl = data.profilePhoto.url;
          else if (data.profilePhoto.publicId) {
            profilePhotoUrl = `https://res.cloudinary.com/dfll8lwos/image/upload/${data.profilePhoto.publicId}`;
          }
        }

        setCounselorData({
          name: data.fullName || data.name,
          specialization: Array.isArray(data.specialization) ? data.specialization.join(", ") : data.specialization,
          experience: `${data.experience || 0} years`,
          patients: 0,
          rating: data.rating || 4.5,
          email: data.email,
          phoneNumber: data.phoneNumber,
          license: "N/A",
          education: data.qualification || data.education,
          university: "N/A",
          hourlyRate: 0,
          languages: data.languages || [],
          specializations: data.specialization || [],
          aboutMe: data.aboutMe,
          location: data.location,
          consultationMode: data.consultationMode,
          profilePhoto: profilePhotoUrl,
        });
      } catch (error) {
        console.error("Error fetching counsellor:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounsellor();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingRequests();
    await fetchWaitingCalls();
    setRefreshing(false);
  };

  const navItems = [
    { id: "messages", icon: "comments", label: "Messages", badge: pendingRequests.length },
    { id: "appointments", icon: "calendar-alt", label: "Appointments", badge: 0 },
    { id: "sessions", icon: "video", label: "Sessions", badge: 0 },
    { id: "patients", icon: "users", label: "Patients", badge: 0 },
    { id: "earnings", icon: "money-bill-wave", label: "Earnings", badge: 0 },
    { id: "profile", icon: "chart-pie", label: "Profile", badge: 0 },
    { id: "settings", icon: "cog", label: "Settings", badge: 0 },
  ];

  const handleTabChange = (tabId) => {
    vibrate(80);
    setActiveTab(tabId);
    setShowMobileMenu(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c50cd" />
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "appointments":
        return (
          <View style={styles.comingSoon}>
            <Icon name="calendar-alt" size={64} color="#526071" />
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonText}>Your appointments will appear here</Text>
          </View>
        );
      case "sessions":
        return (
          <View style={styles.comingSoon}>
            <Icon name="video" size={64} color="#526071" />
            <Text style={styles.comingSoonTitle}>No Sessions Today</Text>
            <Text style={styles.comingSoonText}>Your scheduled sessions will appear here</Text>
          </View>
        );
      case "patients":
        return <PatientRequests />;
      case "earnings":
        return (
          <ScrollView>
            <View style={styles.earningsSummary}>
              <View style={styles.earningsCard}>
                <Text style={styles.earningsCardTitle}>Total Earnings</Text>
                <Text style={styles.earningsAmount}>₹0</Text>
                <Text style={styles.earningsBadge}>+0% from last month</Text>
              </View>
              <View style={[styles.earningsCard, styles.earningsCardPending]}>
                <Text style={styles.earningsCardTitle}>Pending Payout</Text>
                <Text style={styles.earningsAmount}>₹0</Text>
                <Text style={[styles.earningsBadge, styles.earningsBadgeWarning]}>Awaiting processing</Text>
              </View>
              <View style={styles.earningsCard}>
                <Text style={styles.earningsCardTitle}>This Month</Text>
                <Text style={styles.earningsAmount}>₹0</Text>
                <Text style={styles.earningsBadge}>0 sessions completed</Text>
              </View>
            </View>
          </ScrollView>
        );
      case "messages":
        return <Messagesou />;
      case "profile":
        return <CounselorProfile />;
      case "settings":
        return (
          <View style={styles.comingSoon}>
            <Icon name="cog" size={64} color="#526071" />
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonText}>Profile settings will be available here</Text>
          </View>
        );
      default:
        return <Messagesou />;
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Incoming Call Modal */}
        <IncomingCallModal
          isOpen={showIncomingCallModal}
          onClose={handleCloseIncomingModal}
          callType={incomingCallData?.callType || "video"}
          callerName={incomingCallData?.name}
          callerImage={incomingCallData?.image}
          callData={incomingCallData}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />

        {/* Video Call Modal */}
        <VideoCallModal
          isOpen={isVideoModalOpen}
          onClose={handleCloseVideoModal}
          callData={selectedCall}
          currentUser={{ id: counsellorId, role: "counsellor" }}
          onEndCall={handleEndCall}
        />

        {/* Voice Call Modal */}
        <VoiceCallModal
          isOpen={isVoiceModalOpen}
          onClose={handleCloseVideoModal}
          callData={selectedCall}
          currentUser={{ id: counsellorId, role: "counsellor" }}
          onEndCall={handleEndCall}
        />

        {/* Desktop Sidebar */}
        {!isMobile && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <View style={styles.profileContainer}>
                {counselorData?.profilePhoto ? (
                  <Image source={{ uri: counselorData.profilePhoto }} style={styles.profileAvatar} />
                ) : (
                  <Icon name="user-circle" size={80} color="#8492a5" />
                )}
                <Text style={styles.profileName}>{counselorData?.name || "Counselor"}</Text>
                <Text style={styles.profileSpecialization}>
                  {counselorData?.specialization || "Not specified"}
                </Text>
                <View style={[styles.ratingBadge, { marginTop: 4 }]}>
                  <Icon name="star" size={14} color="#f5a623" />
                  <Text style={styles.ratingText}>{counselorData?.rating || 0}</Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.sidebarNavScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.sidebarNav}>
                {navItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.navItem, activeTab === item.id && styles.navItemActive]}
                    onPress={() => handleTabChange(item.id)}
                  >
                    <Icon name={item.icon} size={20} color={activeTab === item.id ? "#ffffff" : "#8492a5"} />
                    <Text style={[styles.navLabel, activeTab === item.id && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                    {item.badge > 0 && (
                      <View style={styles.navBadge}>
                        <Text style={styles.navBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={[styles.navItem, styles.navItemLogout]} onPress={() => setShowLogoutConfirm(true)}>
                <Icon name="sign-out-alt" size={20} color="#ba1a1a" />
                <Text style={[styles.navLabel, styles.navLabelLogout]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mobile Header - White background matching screenshot */}
        {isMobile && (
          <View style={styles.mobileHeader}>
            <TouchableOpacity style={styles.menuToggle} onPress={() => setShowMobileMenu(!showMobileMenu)}>
              <Icon name={showMobileMenu ? "times" : "bars"} size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <View style={styles.mobileTitle}>
              <Image 
                source={require("../../../../../image/Mediconect Logo-3.png")} 
                style={styles.mobileHeaderLogo} 
                resizeMode="contain" 
              />
              <Text style={styles.mobileTitleText}>Mediconeckt</Text>
            </View>
            <View style={styles.mobilePlaceholder} />
          </View>
        )}

        {/* Mobile Menu Overlay */}
        {isMobile && showMobileMenu && (
          <View style={styles.mobileMenuOverlay}>
            <View style={styles.mobileMenu}>
              <View style={styles.sidebarHeader}>
                <View style={styles.profileContainer}>
                  {counselorData?.profilePhoto ? (
                    <Image source={{ uri: counselorData.profilePhoto }} style={styles.profileAvatar} />
                  ) : (
                    <Icon name="user-circle" size={80} color="#8492a5" />
                  )}
                  <Text style={styles.profileName}>{counselorData?.name || "Counselor"}</Text>
                  <Text style={styles.profileSpecialization}>
                    {counselorData?.specialization || "Not specified"}
                  </Text>
                  <View style={[styles.ratingBadge, { marginTop: 4 }]}>
                    <Icon name="star" size={14} color="#f5a623" />
                    <Text style={styles.ratingText}>{counselorData?.rating || 0}</Text>
                  </View>
                </View>
              </View>

              <ScrollView style={styles.sidebarNavScrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.mobileNav}>
                  {navItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.mobileNavItem, activeTab === item.id && styles.mobileNavItemActive]}
                      onPress={() => handleTabChange(item.id)}
                    >
                      <Icon name={item.icon} size={20} color={activeTab === item.id ? "#ffffff" : "#8492a5"} />
                      <Text style={[styles.mobileNavLabel, activeTab === item.id && styles.mobileNavLabelActive]}>
                        {item.label}
                      </Text>
                      {item.badge > 0 && (
                        <View style={styles.mobileNavBadge}>
                          <Text style={styles.mobileNavBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                      <Icon name="arrow-right" size={16} color="#74777c" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.sidebarFooter}>
                <TouchableOpacity
                  style={[styles.mobileNavItem, styles.mobileNavItemLogout]}
                  onPress={() => {
                    setShowMobileMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  <Icon name="sign-out-alt" size={20} color="#ba1a1a" />
                  <Text style={[styles.mobileNavLabel, styles.mobileNavLabelLogout]}>Logout</Text>
                  <Icon name="arrow-right" size={16} color="#74777c" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Mobile Bottom Navigation - Dark navy footer (original design) */}
        {isMobile && !showMobileMenu && (
          <View style={styles.mobileBottomNav}>
            {navItems.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.bottomNavItem, activeTab === item.id && styles.bottomNavItemActive]}
                onPress={() => handleTabChange(item.id)}
              >
                <Icon name={item.icon} size={20} color={activeTab === item.id ? "#ffffff" : "#94A3B8"} />
                <Text style={[styles.bottomNavLabel, activeTab === item.id && styles.bottomNavLabelActive]}>
                  {item.label}
                </Text>
                {item.badge > 0 && (
                  <View style={styles.bottomNavBadge}>
                    <Text style={styles.bottomNavBadgeText}>{item.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Main Content */}
        <View style={[styles.mainContent, isMobile && styles.mainContentMobile]}>
          {renderTabContent()}
        </View>

        {/* Request Modal */}
        <Modal transparent visible={showRequestModal} animationType="slide">
          <View style={styles.requestModalOverlay}>
            <View style={styles.requestModal}>
              <View style={styles.requestModalHeader}>
                <View style={styles.requestHeaderLeft}>
                  <View style={styles.requestIcon}>
                    <Icon name="users" size={20} color="#ffffff" />
                  </View>
                  <View>
                    <Text style={styles.requestModalTitle}>New Chat Request</Text>
                    <Text style={styles.requestTimer}>Auto-closes in {modalCountdown}s</Text>
                  </View>
                </View>
              </View>

              <View style={styles.requestModalBody}>
                <View style={styles.requestPatientInfo}>
                  <Text style={styles.requestPatientName}>
                    {currentRequest?.user?.anonymous || currentRequest?.patientName || "Unknown User"}
                  </Text>
                  <View style={styles.requestTypeBadge}>
                    <Text style={styles.requestTypeText}>Chat Request</Text>
                  </View>
                </View>

                <View style={styles.requestMessage}>
                  <Text style={styles.requestMessageText}>
                    {currentRequest?.requestMessage || currentRequest?.message || "Would like to start a conversation with you."}
                  </Text>
                </View>

                <Text style={styles.requestTime}>
                  Requested: {new Date(currentRequest?.requestedAt).toLocaleTimeString()}
                </Text>
              </View>

              <View style={styles.requestModalFooter}>
                <TouchableOpacity
                  style={[styles.requestBtn, styles.requestReject]}
                  onPress={handleRejectRequest}
                  disabled={loadingRequests}
                >
                  <Icon name="times" size={16} color="#ba1a1a" />
                  <Text style={styles.requestBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.requestBtn, styles.requestAccept]}
                  onPress={handleAcceptRequest}
                  disabled={loadingRequests}
                >
                  <Icon name="check" size={16} color="#ffffff" />
                  <Text style={[styles.requestBtnText, styles.requestAcceptText]}>Accept</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.requestProgress}>
                <View style={[styles.requestProgressBar, { width: `${(modalCountdown / 10) * 100}%` }]} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Logout Confirmation Modal */}
        <Modal transparent visible={showLogoutConfirm} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.logoutModal}>
                <Icon name="triangle-exclamation" size={48} color="#f5a623" />
                <Text style={styles.logoutTitle}>Confirm Logout</Text>
                <Text style={styles.logoutText}>Are you sure you want to logout?</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogoutConfirm(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleLogout}>
                    <Text style={styles.confirmBtnText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9fb",
    flexDirection: "row",
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f9fb",
  },
  sidebar: {
    width: 280,
    backgroundColor: "#081625",
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
    shadowColor: "#0e1d2b",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sidebarHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1d2b3a",
  },
  profileContainer: {
    alignItems: "center",
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#ffffff",
    marginBottom: 4,
  },
  profileSpecialization: {
    fontSize: 14,
    fontFamily: "Manrope",
    color: "#8492a5",
    marginBottom: 8,
    textAlign: "center",
  },

  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#f5a623",
  },
  sidebarNavScrollView: {
    flex: 1,
  },
  sidebarNav: {
    padding: 16,
    gap: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 12,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "#2c50cd",
  },
  navLabel: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#8492a5",
    flex: 1,
  },
  navLabelActive: {
    color: "#ffffff",
  },
  navLabelLogout: {
    color: "#ba1a1a",
    fontWeight: "700",
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1d2b3a",
    backgroundColor: "#081625",
  },
  navItemLogout: {
    backgroundColor: "rgba(186, 26, 26, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(186, 26, 26, 0.2)",
  },
  navBadge: {
    position: "absolute",
    right: 12,
    backgroundColor: "#ba1a1a",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Manrope",
  },
  // Mobile Header - White background matching screenshot
  mobileHeader: {
    position: "absolute",
    top: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 998,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  menuToggle: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  mobileTitleText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Manrope",
    color: "#1A1A1A",
    letterSpacing: -0.3,
   
  },
  mobileSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Manrope",
    color: "#2c50cd",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  mobilePlaceholder: {
    width: 50,
  },
  // Mobile Menu
  mobileMenuOverlay: {
    position: "absolute",
    top:60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 997,
  },
  mobileMenu: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: "#081625",
    shadowColor: "#0e1d2b",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  mobileNav: {
    padding: 16,
    gap: 8,
  },
  mobileNavItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  mobileNavItemActive: {
    backgroundColor: "#2c50cd",
  },
  mobileNavLabel: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#8492a5",
    flex: 1,
  },
  mobileNavLabelActive: {
    color: "#ffffff",
  },
  mobileNavLabelLogout: {
    color: "#ba1a1a",
  },
  mobileNavItemLogout: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "rgba(186, 26, 26, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(186, 26, 26, 0.2)",
  },
  mobileNavBadge: {
    backgroundColor: "#ba1a1a",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginRight: 8,
  },
  mobileNavBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Manrope",
  },
  // Mobile Bottom Nav - Dark navy footer (original design)
  mobileBottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#081625",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    zIndex: 996,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  bottomNavLabel: {
    fontSize: 11,
    fontFamily: "Manrope",
    fontWeight: "500",
    color: "#94A3B8",
  },
  bottomNavLabelActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  bottomNavBadge: {
    position: "absolute",
    
    top: 4,
    right: "30%",
    backgroundColor: "#E53E3E",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bottomNavBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Manrope",
  },
  // Main Content
  mainContent: {
    flex: 1,
    marginLeft: 280,
    backgroundColor: "#f7f9fb",
  },
  mainContentMobile: {
    marginLeft: 0,
    marginTop: 100,
    marginBottom: 70,
    paddingHorizontal: 20,
  },
  mainContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  // Coming Soon
  comingSoon: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 48,
    alignItems: "center",
    shadowColor: "#0e1d2b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#191c1e",
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    fontFamily: "Manrope",
    color: "#44474c",
    textAlign: "center",
  },
  // Earnings
  earningsSummary: {
    gap: 16,
  },
  earningsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#0e1d2b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  earningsCardPending: {
    backgroundColor: "#fef3c7",
  },
  earningsCardTitle: {
    fontSize: 14,
    fontFamily: "Manrope",
    color: "#44474c",
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Manrope",
    color: "#191c1e",
    marginBottom: 8,
  },
  earningsBadge: {
    fontSize: 12,
    fontFamily: "Manrope",
    color: "#2e7d32",
  },
  earningsBadgeWarning: {
    color: "#ed6c02",
  },
  // Request Modal
  requestModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  requestModal: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 80,
    right: 16,
    width: SCREEN_WIDTH - 32,
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0e1d2b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  requestModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#2c50cd",
  },
  requestHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  requestIcon: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  requestModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#ffffff",
  },
  requestTimer: {
    fontSize: 12,
    fontFamily: "Manrope",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  requestModalBody: {
    padding: 20,
  },
  requestPatientInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestPatientName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#191c1e",
  },
  requestTypeBadge: {
    backgroundColor: "#e0e3e5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  requestTypeText: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Manrope",
    color: "#44474c",
  },
  requestMessage: {
    backgroundColor: "#f2f4f6",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  requestMessageText: {
    fontSize: 13,
    fontFamily: "Manrope",
    color: "#44474c",
    lineHeight: 18,
  },
  requestTime: {
    fontSize: 11,
    fontFamily: "Manrope",
    color: "#74777c",
    textAlign: "right",
  },
  requestModalFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e3e5",
    paddingTop: 16,
  },
  requestBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  requestReject: {
    backgroundColor: "#fee2e2",
  },
  requestAccept: {
    backgroundColor: "#2c50cd",
  },
  requestBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Manrope",
  },
  requestAcceptText: {
    color: "#ffffff",
  },
  requestProgress: {
    height: 4,
    backgroundColor: "#e0e3e5",
  },
  requestProgressBar: {
    height: "100%",
    backgroundColor: "#2c50cd",
  },
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
  },
  mobileTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginRight: 40,
  },
  mobileHeaderLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  logoutModal: {
    padding: 24,
    alignItems: "center",
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Manrope",
    color: "#191c1e",
    marginTop: 16,
    marginBottom: 8,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: "Manrope",
    color: "#44474c",
    marginBottom: 24,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#e0e3e5",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Manrope",
    color: "#191c1e",
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#ba1a1a",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Manrope",
    color: "#ffffff",
  },
  // Incoming Call Modal
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  incomingCallModal: {
    backgroundColor: "#2c50cd",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  incomingCallHeader: {
    alignItems: "center",
  },
  incomingCallAvatar: {
    marginBottom: 16,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  avatarEmojiLarge: {
    fontSize: 80,
  },
  incomingCallerName: {
    fontSize: 24,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#ffffff",
    marginBottom: 8,
  },
  incomingCallType: {
    fontSize: 16,
    fontFamily: "Manrope",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 4,
  },
  incomingCallStatus: {
    fontSize: 14,
    fontFamily: "Manrope",
    color: "rgba(255,255,255,0.8)",
  },
  incomingCallActions: {
    flexDirection: "row",
    gap: 20,
    marginTop: 32,
  },
  incomingCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 40,
  },
  rejectBtn: {
    backgroundColor: "#ba1a1a",
  },
  acceptBtn: {
    backgroundColor: "#2e7d32",
  },
  incomingCallBtnText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#ffffff",
  },
});

