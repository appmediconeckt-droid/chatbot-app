import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { API_BASE_URL } from "../../../../../axiosConfig";
import { getAuthToken, getCounsellorId } from "../../../../auth/authUtils";
import { io } from "socket.io-client";

// Icons (using only FontAwesome6 - no MaterialIcons)
import Icon from "react-native-vector-icons/FontAwesome6";
import Feather from "react-native-vector-icons/Feather";

// Custom Hooks
import useVibration from "../../../../../hooks/useVibration";
import useRingtone, { forceStopRingtone } from "../../../../../hooks/useRingtone";
import Dashboard from "../Tab/CounselorDashboard/Dashboardcou";
import Messagesou from "../Tab/Messages/Messagesou";
import PatientRequests from "../Tab/PatientRequests/PatientRequests";
import CounselorProfile from "../Tab/Profile-Con/CounselorProfile";
import VideoCallModal from "../../UserDashboard/Tab/CallModal/VideoCallModal";
import VoiceCallModal from "../../UserDashboard/Tab/CallModal/VoiceCallModal";
import safeVibrate from "../../../../../utils/safeVibrate";
import { useToast } from "../../../../../components/common/ToastProvider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// â”€â”€â”€ Incoming Call Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const { stopRinging } = useRingtone();

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
    if (callData?.from?.anonymous) return callData.from.anonymous;
    if (callerName) return callerName;
    return "User";
  };
  const displayInitial = (getDisplayName()?.charAt(0) || "A").toUpperCase();

  const handleAccept = async () => {
    setIsAccepting(true);
    // Close modal first so ringtone effect can't restart while accept API is in-flight.
    onClose();
    stopRinging();
    if (onAccept) await onAccept(callData);
    setIsAccepting(false);
  };

  const handleReject = async () => {
    setIsRejecting(true);
    // Close modal first so ringtone effect can't restart while reject API is in-flight.
    onClose();
    stopRinging();
    if (onReject) await onReject(callData?.callId);
    setIsRejecting(false);
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
                <Text style={styles.avatarInitialLarge}>{displayInitial}</Text>
              </View>
            </Animated.View>
            <Text style={styles.incomingCallerName}>{getDisplayName()}</Text>
            <Text style={styles.incomingCallType}>
              {callType === "video" ? "ðŸ“¹ Video Call" : "ðŸ“ž Voice Call"}
            </Text>
            <Text style={styles.incomingCallStatus}>Incoming call...</Text>
            {!!callData?.requestedAt && (
              <Text style={styles.incomingCallTime}>
                {new Date(callData.requestedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
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

// â”€â”€â”€ Appointment Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AppointmentCard = ({ apt, onAccept, onReject, onVideoCall, updating }) => {
  const isUpdating = updating === apt._id;
  const isPending = apt.status === "pending";
  const isConfirmed = apt.status === "confirmed";
  const isCanceled = apt.status === "canceled";

  const avatarConfig = isPending
    ? { icon: "user-clock", bg: "#fff7e6", color: "#f59e0b" }
    : isConfirmed
    ? { icon: "user-check", bg: "#eafaf2", color: "#10b981" }
    : { icon: "user-xmark", bg: "#feeff1", color: "#ef4444" };

  const patientName =
    apt.patient?.anonymous || apt.patient?.fullName || "Anonymous User";

  const requestedDate = apt.date
    ? new Date(apt.date).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "—";

  const requestedTime = apt.date
    ? new Date(apt.date).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const statusColor =
    isPending ? "#f59e0b" : isConfirmed ? "#10b981" : "#ef4444";
  const statusBg =
    isPending ? "#fef3c7" : isConfirmed ? "#d1fae5" : "#fee2e2";

  return (
    <View style={aptStyles.card}>
      <View style={[aptStyles.cardAccent, { backgroundColor: statusColor }]} />
      {/* Header row */}
     <View style={aptStyles.cardHeader}>
  <View style={aptStyles.avatarWrap}>
    <View style={[aptStyles.avatarFallback, { backgroundColor: avatarConfig.bg }]}>
      <Icon name={avatarConfig.icon} size={20} color={avatarConfig.color} />
    </View>
  </View>

  <View style={aptStyles.patientInfo}>
    <Text style={aptStyles.patientName} numberOfLines={1}>
      {patientName}
    </Text>
    <View style={aptStyles.consultTag}>
      <Icon name="brain" size={10} color="#2c50cd" />
      <Text style={aptStyles.consultTagText}>INITIAL CONSULTATION</Text>
    </View>
  </View>

  <View style={[aptStyles.statusBadge, { backgroundColor: statusBg }]}>
    <Text style={[aptStyles.statusText, { color: statusColor }]}>
      {apt.status?.toUpperCase()}
    </Text>
  </View>
</View>

      {/* Notes */}
      {apt.notes && apt.notes.trim() !== "" && (
        <View style={aptStyles.notesBox}>
          <Icon name="quote-left" size={10} color="#94a3b8" />
          <Text style={aptStyles.notesText}>{apt.notes}</Text>
        </View>
      )}

      {/* Time row */}
      <View style={aptStyles.timeRow}>
        <Icon name="clock" size={12} color="#8492a5" />
        <Text style={aptStyles.timeLabel}>Requested: </Text>
        <Text style={aptStyles.timeValue}>
          {requestedDate} · {requestedTime}
        </Text>
      </View>

      {/* Actions */}
      {isPending && (
        <View style={aptStyles.actions}>
          <TouchableOpacity
            style={[aptStyles.actionBtn, aptStyles.rejectActionBtn]}
            onPress={() => onReject(apt._id)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#ba1a1a" />
            ) : (
              <>
                <Icon name="xmark" size={14} color="#ba1a1a" />
                <Text style={[aptStyles.actionBtnText, { color: "#ba1a1a" }]}>
                  Reject
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[aptStyles.actionBtn, aptStyles.acceptActionBtn]}
            onPress={() => onAccept(apt._id)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={14} color="#fff" />
                <Text style={[aptStyles.actionBtnText, { color: "#fff" }]}>
                  Accept
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Video call button for confirmed appointments */}
      {isConfirmed && (
        <TouchableOpacity
          style={aptStyles.videoCallBtn}
          onPress={() => onVideoCall(apt)}
        >
          <Icon name="video" size={14} color="#fff" />
          <Text style={aptStyles.videoCallBtnText}>Start Video Call</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// â”€â”€ Appointments Shimmer UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AppointmentSkeletonCard = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <View style={aptStyles.card}>
      <Animated.View style={[aptStyles.cardAccent, { backgroundColor: "#eef2f7", opacity }]} />
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 14 }}>
        <View style={aptStyles.skelHeader}>
          <Animated.View style={[aptStyles.skelAvatar, { opacity }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={[aptStyles.skelLineLg, { opacity }]} />
            <Animated.View style={[aptStyles.skelLineSm, { opacity }]} />
          </View>
          <Animated.View style={[aptStyles.skelPill, { opacity }]} />
        </View>
        <View style={aptStyles.skelBody}>
          <Animated.View style={[aptStyles.skelLineFull, { opacity }]} />
          <Animated.View style={[aptStyles.skelLineMed, { opacity }]} />
        </View>
        <View style={aptStyles.skelActions}>
          <Animated.View style={[aptStyles.skelBtn, { opacity }]} />
          <Animated.View style={[aptStyles.skelBtn, { opacity }]} />
        </View>
      </View>
    </View>
  );
};

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function CounselorDashboard() {
  const insets = useSafeAreaInsets();
  const MOBILE_HEADER_BAR_HEIGHT = 56;
  const topInset = Platform.OS === "ios" ? insets.top : 0;
  const isFocused = useIsFocused();
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

  // â”€â”€ Appointment state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState(null);
  const [aptFilter, setAptFilter] = useState("all"); // "all" | "pending" | "confirmed" | "canceled"

  const navigation = useNavigation();
  const { vibrate } = useVibration();
  const { showToast: showAppToast } = useToast();
  const { startRinging: startIncomingRing, stopRinging: stopIncomingRing } = useRingtone();

  useEffect(() => {
    if (!isFocused) {
      stopIncomingRing();
      return;
    }
    if (showIncomingCallModal) startIncomingRing(true);
    else stopIncomingRing();
  }, [isFocused, showIncomingCallModal, startIncomingRing, stopIncomingRing]);

  // If caller ends/cancels while incoming modal is open, stop ringtone and close modal.
  useEffect(() => {
    if (!isFocused || !showIncomingCallModal || !incomingCallData?.callId) return;

    let cancelled = false;

    const checkStillPending = async () => {
      try {
        const token = await getAuthToken();
        const counsellorId = await getCounsellorId();
        if (cancelled || !token || !counsellorId) return;

        const response = await axios.get(
          `${API_BASE_URL}/api/video/calls/pending/${counsellorId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const pending = response.data?.pendingRequests || [];
        const stillThere = pending.some((c) => (c?.callId || c?.id || c?._id) === incomingCallData.callId);

        if (!stillThere && !cancelled) {
          setShowIncomingCallModal(false);
          setIncomingCallData(null);
          stopIncomingRing();
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
  }, [isFocused, showIncomingCallModal, incomingCallData?.callId, stopIncomingRing]);

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

  // Check mobile screen
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setIsMobile(window.width <= 768);
    });
    return () => subscription?.remove();
  }, []);

  // â”€â”€ Fetch Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const aptSocketRef = useRef(null);

  const fetchAppointments = useCallback(async (silent = false) => {
    if (!silent) setLoadingAppointments(true);
    try {
      // axios here is the axiosInstance from axiosConfig — token injected automatically
      const res = await axios.get(`${API_BASE_URL}/api/appointments`);
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.appointments)
        ? res.data.appointments
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setAppointments(data);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  // Fetch when tab becomes active
  useEffect(() => {
    if (activeTab === "appointments") fetchAppointments();
  }, [activeTab, fetchAppointments]);

  // Real-time socket for appointment updates
  useEffect(() => {
    const connectAptSocket = async () => {
      const token = (await AsyncStorage.getItem("accessToken")) || (await AsyncStorage.getItem("token"));
      const counsellorId = await getCounsellorId();
      if (!token) return;
      const socket = io(API_BASE_URL, {
        transports: ["polling", "websocket"],
        auth: { token },
        reconnection: true,
      });
      aptSocketRef.current = socket;
      socket.on("connect", () => {
        if (counsellorId) socket.emit("join-counsellor-room", { counsellorId });
      });
      const refresh = () => fetchAppointments(true);
      socket.on("appointment-booked", refresh);
      socket.on("appointment-updated", refresh);
      socket.on("appointment-new", refresh);
      socket.on("appointment-status-changed", refresh);
    };
    connectAptSocket();
    return () => {
      aptSocketRef.current?.disconnect();
      aptSocketRef.current = null;
    };
  }, [fetchAppointments]);

  // â”€â”€ Update Appointment Status (Accept / Reject) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleUpdateAppointmentStatus = async (id, status) => {
    setUpdatingAppointmentId(id);
    vibrate([80, 40, 80]);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.patch(
        `${API_BASE_URL}/api/appointments/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Find the appointment to get patient ID for socket notification
      const appointment = appointments.find(a => a._id === id);
      const patientId = appointment?.patient?._id || appointment?.patient?.id || appointment?.userId;
      
      // 🔄 Emit socket event to notify user of appointment status change
      if (aptSocketRef.current && patientId) {
        aptSocketRef.current.emit('appointment-status-updated', {
          appointmentId: id,
          status: status,
          patientId: patientId,
          counsellorId: counsellorId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Optimistic local update
      setAppointments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status } : a))
      );
      showToast(
        status === "confirmed"
          ? "Appointment accepted!"
          : "Appointment rejected.",
        status === "confirmed" ? "success" : "info"
      );
    } catch (err) {
      console.error("Error updating appointment status:", err);
      showToast("Failed to update appointment status.", "error");
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  // â”€â”€ Initiate Video Call from Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleInitiateVideoCallFromApt = async (apt) => {
    const patientInfo = apt.patient || {};
    const storedCounsellorId = await getCounsellorId();
    const token = await getAuthToken();
    const rawUserId =
      patientInfo._id ||
      patientInfo.id ||
      patientInfo.userId ||
      apt.userId ||
      apt.user?._id ||
      apt.user?.id ||
      apt.patientId;
    const userId = normalizeObjectId(rawUserId);

    if (!userId) {
      showToast("Invalid receiver ID format for this appointment.", "error");
      return;
    }
    if (!storedCounsellorId) {
      showToast("Missing counsellor ID. Please login again.", "error");
      return;
    }
    if (!token) {
      showToast("Session expired. Please login again.", "error");
      return;
    }

    try {
      const authHeader = String(token).startsWith("Bearer ")
        ? String(token)
        : `Bearer ${token}`;

      const basePayload = {
        initiatorId: String(storedCounsellorId),
        receiverId: String(userId),
        receiverType: "user",
        callType: "video",
      };

      const headers = {
        "Content-Type": "application/json",
        Authorization: authHeader,
      };

      let response;
      try {
        response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          { ...basePayload, initiatorType: "counsellor" },
          { headers }
        );
      } catch (firstError) {
        const statusCode = firstError?.response?.status;
        if (statusCode !== 400) {
          throw firstError;
        }

        // Some API versions use "counselor" spelling; retry once for compatibility.
        response = await axios.post(
          `${API_BASE_URL}/api/video/calls/initiate`,
          { ...basePayload, initiatorType: "counselor" },
          { headers }
        );
      }

      if (response.data?.success) {
        const rawCall = response.data.callData || {};
        const callData = {
          id: rawCall?.id || rawCall?._id || response.data.callId,
          callId: response.data.callId,
          roomId: response.data.roomId,
          // Counselor side: never show real user name/photo.
          name: patientInfo.anonymous || patientInfo.displayName || "Anonymous User",
          profilePic: null,
          isIncoming: false,
          callType: "video",
          type: "video",
          status: response.data.status || "ringing",
          currentUserId: storedCounsellorId,
          currentUserType: "counsellor",
          apiCallData: rawCall,
          initiator: rawCall?.initiator,
          receiver: rawCall?.receiver,
          initiatorId: rawCall?.initiator?.id || rawCall?.initiator?._id,
          receiverId: rawCall?.receiver?.id || rawCall?.receiver?._id,
        };
        
        // 🔄 Emit socket event to notify user of incoming call from appointment
        if (aptSocketRef.current) {
          aptSocketRef.current.emit('appointment-call-initiated', {
            appointmentId: apt._id,
            callId: response.data.callId,
            callType: 'video',
            counsellorId: storedCounsellorId,
            userId: userId,
            counsellorName: counselorData?.fullName || "Counselor"
          });
        }
        
        setSelectedCall(callData);
        setIsVideoModalOpen(true);
      } else {
        showToast(response.data?.message || "Failed to initiate call", "error");
      }
    } catch (error) {
      console.error("Call initiation error:", error?.response?.data || error);
      showToast(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error.message ||
          "Failed to initiate call",
        "error"
      );
    }
  };

  // â”€â”€ Accept Call API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const acceptCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const userId = await getCounsellorId();
      if (!userId) return { success: false, error: "No counsellor ID found" };
      if (!token) return { success: false, error: "Session expired. Please login again." };

      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/accept`,
        { acceptorId: userId, acceptorType: "counsellor" },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data?.success
        ? { success: true, data: response.data }
        : { success: false, data: response.data };
    } catch (error) {
      console.error("Error accepting call:", error);
      const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
      return { success: false, error: backendMessage || error.message };
    }
  };

  const joinCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const counsellorId = await getCounsellorId();
      if (!counsellorId) return { success: false, error: "No counsellor ID found" };
      if (!token) return { success: false, error: "Session expired. Please login again." };
      const response = await axios.post(
        `${API_BASE_URL}/api/video/calls/${callId}/join`,
        { userId: counsellorId, userType: "counsellor" },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data?.success
        ? { success: true, data: response.data }
        : { success: false, data: response.data };
    } catch (error) {
      console.error("Error joining call:", error);
      const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
      return { success: false, error: backendMessage || error.message };
    }
  };

  const endCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const counsellorId = await getCounsellorId();
      if (!counsellorId || !token) return null;
      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/end`,
        { userId: counsellorId, endedBy: "counsellor" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data?.success ? response.data : null;
    } catch (error) {
      console.error("Error ending call:", error);
      return null;
    }
  };

  const rejectCall = async (callId) => {
    try {
      const token = await getAuthToken();
      const counsellorId = await getCounsellorId();
      if (!counsellorId || !token) return false;
      const response = await axios.put(
        `${API_BASE_URL}/api/video/calls/${callId}/reject`,
        { userId: counsellorId, reason: "declined" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data?.success || false;
    } catch (error) {
      console.error("Error rejecting call:", error);
      return false;
    }
  };

  // â”€â”€ Handle Accept Incoming Call â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleAcceptIncomingCall = async (callData) => {
    // Stop ringtone immediately — synchronous, fires before any await
    forceStopRingtone();
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    const result = await acceptCall(callData.callId);
    if (result?.success) {
      const token = await getAuthToken();
      const counsellorId = await getCounsellorId();
      if (!token || !counsellorId) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      let detailedCall = null;
      try {
        const detailsResponse = await axios.get(
          `${API_BASE_URL}/api/video/calls/${callData.callId}/details`,
          {
            params: { userId: counsellorId, userType: "counsellor" },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        detailedCall = detailsResponse.data?.call || null;
      } catch (detailsError) {
        console.warn("Could not fetch accepted call details:", detailsError);
      }

      const incomingType = String(
        callData.callType || detailedCall?.type || "video"
      ).toLowerCase();
      const modalType = incomingType === "audio" ? "voice" : incomingType;
      const initiatorIdStr = String(detailedCall?.initiator?.id || detailedCall?.initiator?._id || '');
      const remoteParticipant = detailedCall
        ? initiatorIdStr === String(counsellorId)
          ? detailedCall.receiver
          : detailedCall.initiator
        : callData?.from || null;

      const acceptedCallData = {
        id: detailedCall?.id || detailedCall?._id || callData.callId,
        callId: callData.callId,
        roomId: result.data?.roomId || detailedCall?.roomId || callData.roomId,
        name:
          remoteParticipant?.anonymous ||
          remoteParticipant?.anonName ||
          remoteParticipant?.anonymousName ||
          callData.name,
        isIncoming: true,
        status: result.data?.status || detailedCall?.status || "active",
        type: modalType,
        callType: modalType,
        // Counselor side: never show real user photo.
        profilePic: null,
        phoneNumber:
          remoteParticipant?.phoneNumber || remoteParticipant?.phone || "",
        apiCallData: detailedCall,
        initiator: detailedCall?.initiator || callData.initiator,
        receiver: detailedCall?.receiver,
        initiatorId: detailedCall?.initiator?.id || detailedCall?.initiator?._id,
        receiverId: detailedCall?.receiver?.id || detailedCall?.receiver?._id,
        currentUserId: counsellorId,
        currentUserType: "counsellor",
        from: callData.from,
      };

      setSelectedCall(acceptedCallData);
      if (modalType === "video") setIsVideoModalOpen(true);
      else setIsVoiceModalOpen(true);
    } else {
      showToast("Failed to accept call. Please try again.", "error");
    }
  };

  const handleRejectIncomingCall = async (callId) => {
    await rejectCall(callId);
  };

  // â”€â”€ Fetch Waiting Calls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchWaitingCalls = async () => {
    try {
      const token = await getAuthToken();
      const counsellorId = await getCounsellorId();
      if (!counsellorId || !token) return;

      const response = await axios.get(
        `${API_BASE_URL}/api/video/calls/pending/${counsellorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const callsList =
        response.data.pendingRequests ||
        response.data.waitingCalls ||
        response.data.calls;

      if (response.data?.success && callsList?.length > 0) {
        setWaitingCalls(callsList);
        const waitingCall =
          callsList.find(
            (call) =>
              !call.status ||
              call.status === "waiting" ||
              call.status === "ringing"
          ) || callsList[0];

        if (
          waitingCall &&
          !showIncomingCallModal &&
          !isVideoModalOpen &&
          !isVoiceModalOpen
        ) {
          const fromData = waitingCall.from || waitingCall.initiator || {};
          const displayName =
            fromData.anonymous ||
            fromData.anonName ||
            fromData.anonymousName ||
            fromData.displayName ||
            "Anonymous";

          let initiatorAvatar = "ðŸ‘¤";
          if (fromData.gender === "female") initiatorAvatar = "ðŸ‘©";
          else if (fromData.gender === "male") initiatorAvatar = "ðŸ‘¨";

          setIncomingCallData({
            callId: waitingCall.callId || waitingCall.id || waitingCall._id,
            roomId: waitingCall.roomId,
            name: displayName,
            // Counselor side: never show the caller's real photo here (privacy).
            image: null,
            callType: waitingCall.callType || "video",
            from: fromData,
            initiator: waitingCall.initiator,
            requestedAt: waitingCall.requestedAt,
            expiresAt: waitingCall.expiresAt,
          });

          setShowIncomingCallModal(true);
          safeVibrate([320, 160, 320]);
        }
      } else {
        setWaitingCalls([]);
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        showToast("Session expired. Please login again.", "error");
        setIsPolling(false);
        return;
      }
      console.error("Error fetching waiting calls:", error);
    }
  };

  // Polling for waiting calls
  useEffect(() => {
    if (isFocused && isPolling && !showIncomingCallModal && !isVideoModalOpen && !isVoiceModalOpen) {
      fetchWaitingCalls();
      const interval = setInterval(fetchWaitingCalls, 5000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [isFocused, isPolling, showIncomingCallModal, isVideoModalOpen, isVoiceModalOpen]);

  useEffect(() => {
    setIsPolling(!(showIncomingCallModal || isVideoModalOpen || isVoiceModalOpen));
  }, [showIncomingCallModal, isVideoModalOpen, isVoiceModalOpen]);

  // â”€â”€ Fetch Pending Chat Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE_URL}/api/chat/pending-requests`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          timeout: 30000,
        }
      );

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

  useEffect(() => {
    return () => {
      if (modalTimer) clearInterval(modalTimer);
    };
  }, [modalTimer]);

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
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
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

  const handleRejectRequest = async () => {
    if (!currentRequest) return;
    vibrate([120]);
    try {
      const token = await AsyncStorage.getItem("token");
      const chatId = currentRequest.chatId;
      await axios.patch(
        `${API_BASE_URL}/api/chat/reject/${chatId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
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

  const handleJoinCall = async (callId) => {
    try {
      const result = await joinCall(callId);
      if (result?.success) return { success: true, data: result.data };
      return { success: false, error: "Join failed" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleEndCall = async (callId) => {
    try {
      await endCall(callId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleCloseVideoModal = () => {
    stopIncomingRing();
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    // Delay re-enabling polling so the just-ended call clears from the backend
    // before we poll again — prevents the ringtone restarting immediately after hangup
    setTimeout(() => setIsPolling(true), 6000);
  };

  const handleCloseIncomingModal = () => {
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    stopIncomingRing();
    setIsPolling(true);
  };

  const showToast = (message, type = "info") => {
    showAppToast({ message, type, duration: 3200 });
  };

  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(fetchPendingRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      vibrate([120, 60, 120]);
      const accessToken = await AsyncStorage.getItem("accessToken");
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (accessToken) {
        await axios.post(
          `${API_BASE_URL}/api/auth/logout`,
          { refreshToken },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
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
        const storedCounsellorId =
          (await AsyncStorage.getItem("counsellorId")) ||
          (await AsyncStorage.getItem("counselorId"));
        if (!storedCounsellorId) {
          setLoading(false);
          return;
        }
        setCounsellorId(storedCounsellorId);
        const token =
          (await AsyncStorage.getItem("accessToken")) ||
          (await AsyncStorage.getItem("token"));
        const res = await axios.get(
          `${API_BASE_URL}/api/auth/counsellors/${storedCounsellorId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const data = res.data?.counsellor;
        let profilePhotoUrl = null;
        if (data.profilePhoto) {
          if (typeof data.profilePhoto === "string")
            profilePhotoUrl = data.profilePhoto;
          else if (data.profilePhoto.url)
            profilePhotoUrl = data.profilePhoto.url;
          else if (data.profilePhoto.publicId)
            profilePhotoUrl = `https://res.cloudinary.com/dfll8lwos/image/upload/${data.profilePhoto.publicId}`;
        }
        setCounselorData({
          name: data.fullName || data.name,
          specialization: Array.isArray(data.specialization)
            ? data.specialization.join(", ")
            : data.specialization,
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
    if (activeTab === "appointments") await fetchAppointments();
    setRefreshing(false);
  };

  const navItems = [
    {
      id: "messages",
      icon: "comments",
      label: "Messages",
      badge: pendingRequests.length,
    },
    {
      id: "appointments",
      icon: "calendar-alt",
      label: "Appointment",
      badge: appointments.filter((a) => a.status === "pending").length,
    },
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

  // â”€â”€ Appointments Tab Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAppointmentsTab = () => {
    const filterTabs = [
      { key: "all", label: "All" },
      { key: "pending", label: "Pending" },
      { key: "confirmed", label: "Confirmed" },
      { key: "canceled", label: "Canceled" },
    ];

    const filteredApts =
      aptFilter === "all"
        ? appointments
        : appointments.filter((a) => a.status === aptFilter);

    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={aptStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingAppointments && appointments.length > 0}
            onRefresh={fetchAppointments}
            colors={["#2c50cd"]}
          />
        }
      >
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={aptStyles.filterScroll}
          contentContainerStyle={aptStyles.filterRow}
        >
          {filterTabs.map((ft) => {
            const isActive = aptFilter === ft.key;
            return (
              <TouchableOpacity
                key={ft.key}
                style={[
                  aptStyles.filterChip,
                  isActive && aptStyles.filterChipActive,
                ]}
                onPress={() => setAptFilter(ft.key)}
              >
                <Text
                  style={[
                    aptStyles.filterChipText,
                    isActive && aptStyles.filterChipTextActive,
                  ]}
                >
                  {ft.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Loading state */}
        {loadingAppointments && appointments.length === 0 ? (
          <View style={aptStyles.listContainer}>
            {[0, 1, 2, 3, 4].map((i) => (
              <AppointmentSkeletonCard key={`apt_skel_${i}`} />
            ))}
          </View>
        ) : filteredApts.length === 0 ? (
          <View style={aptStyles.emptyState}>
            <Icon name="calendar-xmark" size={52} color="#cbd5e1" />
            <Text style={aptStyles.emptyTitle}>No appointments found</Text>
            <Text style={aptStyles.emptyText}>
              {aptFilter === "pending"
                ? "You have no pending appointment requests."
                : aptFilter === "confirmed"
                ? "No confirmed appointments yet."
                : "No appointments to show."}
            </Text>
            <Text style={aptStyles.refreshBtnText}>Pull down to refresh</Text>
          </View>
        ) : (
          <View style={aptStyles.listContainer}>
            {filteredApts.map((apt) => (
              <AppointmentCard
                key={apt._id}
                apt={apt}
                onAccept={(id) =>
                  handleUpdateAppointmentStatus(id, "confirmed")
                }
                onReject={(id) =>
                  handleUpdateAppointmentStatus(id, "canceled")
                }
                onVideoCall={handleInitiateVideoCallFromApt}
                updating={updatingAppointmentId}
              />
            ))}
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // â”€â”€ Tab Content Renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "appointments":
        return renderAppointmentsTab();
      case "sessions":
        return (
          <View style={styles.comingSoon}>
            <Icon name="video" size={64} color="#526071" />
            <Text style={styles.comingSoonTitle}>No Sessions Today</Text>
            <Text style={styles.comingSoonText}>
              Your scheduled sessions will appear here
            </Text>
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
                <Text style={styles.earningsAmount}>â‚¹0</Text>
                <Text style={styles.earningsBadge}>+0% from last month</Text>
              </View>
              <View
                style={[styles.earningsCard, styles.earningsCardPending]}
              >
                <Text style={styles.earningsCardTitle}>Pending Payout</Text>
                <Text style={styles.earningsAmount}>â‚¹0</Text>
                <Text
                  style={[
                    styles.earningsBadge,
                    styles.earningsBadgeWarning,
                  ]}
                >
                  Awaiting processing
                </Text>
              </View>
              <View style={styles.earningsCard}>
                <Text style={styles.earningsCardTitle}>This Month</Text>
                <Text style={styles.earningsAmount}>â‚¹0</Text>
                <Text style={styles.earningsBadge}>
                  0 sessions completed
                </Text>
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
            <Text style={styles.comingSoonText}>
              Profile settings will be available here
            </Text>
          </View>
        );
      default:
        return <Messagesou />;
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Incoming Call Modal */}
        <IncomingCallModal
          isOpen={isFocused && showIncomingCallModal}
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
                  <Image
                    source={{ uri: counselorData.profilePhoto }}
                    style={styles.profileAvatar}
                  />
                ) : (
                  <Icon name="user-circle" size={80} color="#8492a5" />
                )}
                <Text style={styles.profileName}>
                  {counselorData?.name || "Counselor"}
                </Text>
                <Text style={styles.profileSpecialization}>
                  {counselorData?.specialization || "Not specified"}
                </Text>
                <View style={[styles.ratingBadge, { marginTop: 4 }]}>
                  <Icon name="star" size={14} color="#f5a623" />
                  <Text style={styles.ratingText}>
                    {counselorData?.rating || 0}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.sidebarNavScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sidebarNav}>
                {navItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.navItem,
                      activeTab === item.id && styles.navItemActive,
                    ]}
                    onPress={() => handleTabChange(item.id)}
                  >
                    <Icon
                      name={item.icon}
                      size={20}
                      color={
                        activeTab === item.id ? "#ffffff" : "#8492a5"
                      }
                    />
                    <Text
                      style={[
                        styles.navLabel,
                        activeTab === item.id && styles.navLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge > 0 && (
                      <View style={styles.navBadge}>
                        <Text style={styles.navBadgeText}>
                          {item.badge}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                style={[styles.navItem, styles.navItemLogout]}
                onPress={() => setShowLogoutConfirm(true)}
              >
                <Icon name="sign-out-alt" size={20} color="#ba1a1a" />
                <Text style={[styles.navLabel, styles.navLabelLogout]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mobile Header */}
        {isMobile && (
          <View style={styles.mobileHeader}>
            <View style={[styles.mobileHeaderBar, { height: MOBILE_HEADER_BAR_HEIGHT, paddingTop: topInset }]}>
              <TouchableOpacity
                style={styles.menuToggle}
                onPress={() => setShowMobileMenu(!showMobileMenu)}
              >
                <Icon
                  name={showMobileMenu ? "times" : "bars"}
                  size={22}
                  color="#1A1A1A"
                />
              </TouchableOpacity>

              <View style={styles.mobileTitle}>
                <Image
                  source={require("../../../../../image/Mediconect Logo-3.png")}
                  style={styles.mobileHeaderLogo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.mobilePlaceholder} />
            </View>
          </View>
        )}

        {/* Mobile Menu Overlay */}
        {isMobile && showMobileMenu && (
          <View style={[styles.mobileMenuOverlay, { top: topInset + MOBILE_HEADER_BAR_HEIGHT }]}>
            <View style={styles.mobileMenu}>
              <View style={styles.sidebarHeader}>
                <View style={styles.profileContainer}>
                  {counselorData?.profilePhoto ? (
                    <Image
                      source={{ uri: counselorData.profilePhoto }}
                      style={styles.profileAvatar}
                    />
                  ) : (
                    <Icon name="user-circle" size={80} color="#8492a5" />
                  )}
                  <Text style={styles.profileName}>
                    {counselorData?.name || "Counselor"}
                  </Text>
                  <Text style={styles.profileSpecialization}>
                    {counselorData?.specialization || "Not specified"}
                  </Text>
                  <View style={[styles.ratingBadge, { marginTop: 4 }]}>
                    <Icon name="star" size={14} color="#f5a623" />
                    <Text style={styles.ratingText}>
                      {counselorData?.rating || 0}
                    </Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={styles.sidebarNavScrollView}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.mobileNav}>
                  {navItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.mobileNavItem,
                        activeTab === item.id && styles.mobileNavItemActive,
                      ]}
                      onPress={() => handleTabChange(item.id)}
                    >
                      <Icon
                        name={item.icon}
                        size={20}
                        color={
                          activeTab === item.id ? "#ffffff" : "#8492a5"
                        }
                      />
                      <Text
                        style={[
                          styles.mobileNavLabel,
                          activeTab === item.id &&
                            styles.mobileNavLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.badge > 0 && (
                        <View style={styles.mobileNavBadge}>
                          <Text style={styles.mobileNavBadgeText}>
                            {item.badge}
                          </Text>
                        </View>
                      )}
                      <Icon name="arrow-right" size={16} color="#74777c" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.sidebarFooter}>
                <TouchableOpacity
                  style={[
                    styles.mobileNavItem,
                    styles.mobileNavItemLogout,
                  ]}
                  onPress={() => {
                    setShowMobileMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  <Icon name="sign-out-alt" size={20} color="#ba1a1a" />
                  <Text
                    style={[
                      styles.mobileNavLabel,
                      styles.mobileNavLabelLogout,
                    ]}
                  >
                    Logout
                  </Text>
                  <Icon name="arrow-right" size={16} color="#74777c" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Mobile Bottom Navigation */}
        {isMobile && !showMobileMenu && (
          <View style={styles.mobileBottomNav}>
            {navItems.slice(0, 5).map((item) => {
              const shortLabel = item.label;
              return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.bottomNavItem,
                  activeTab === item.id && styles.bottomNavItemActive,
                ]}
                onPress={() => handleTabChange(item.id)}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  color={activeTab === item.id ? "#ffffff" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.bottomNavLabel,
                    activeTab === item.id && styles.bottomNavLabelActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {shortLabel}
                </Text>
                {item.badge > 0 && (
                  <View style={styles.bottomNavBadge}>
                    <Text style={styles.bottomNavBadgeText}>
                      {item.badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Main Content */}
        <View
          style={[
            styles.mainContent,
            isMobile && styles.mainContentMobile,
            isMobile && { marginTop: topInset + MOBILE_HEADER_BAR_HEIGHT },
          ]}
        >
          {renderTabContent()}
        </View>

        {/* Chat Request Modal */}
        <Modal transparent visible={showRequestModal} animationType="slide">
          <View style={styles.requestModalOverlay}>
            <View style={styles.requestModal}>
              <View style={styles.requestModalHeader}>
                <View style={styles.requestHeaderLeft}>
                  <View style={styles.requestIcon}>
                    <Icon name="users" size={20} color="#ffffff" />
                  </View>
                  <View>
                    <Text style={styles.requestModalTitle}>
                      New Chat Request
                    </Text>
                    <Text style={styles.requestTimer}>
                      Auto-closes in {modalCountdown}s
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.requestModalBody}>
                <View style={styles.requestPatientInfo}>
                  <Text style={styles.requestPatientName}>
                    {currentRequest?.user?.anonymous ||
                      currentRequest?.patientName ||
                      "Unknown User"}
                  </Text>
                  <View style={styles.requestTypeBadge}>
                    <Text style={styles.requestTypeText}>Chat Request</Text>
                  </View>
                </View>

                <View style={styles.requestMessage}>
                  <Text style={styles.requestMessageText}>
                    {currentRequest?.requestMessage ||
                      currentRequest?.message ||
                      "Would like to start a conversation with you."}
                  </Text>
                </View>

                <Text style={styles.requestTime}>
                  Requested:{" "}
                  {new Date(currentRequest?.requestedAt).toLocaleTimeString()}
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
                  <Text
                    style={[
                      styles.requestBtnText,
                      styles.requestAcceptText,
                    ]}
                  >
                    Accept
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.requestProgress}>
                <View
                  style={[
                    styles.requestProgressBar,
                    { width: `${(modalCountdown / 10) * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Logout Confirmation Modal */}
        <Modal
          transparent
          visible={showLogoutConfirm}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.logoutModal}>
                <Icon
                  name="triangle-exclamation"
                  size={48}
                  color="#f5a623"
                />
                <Text style={styles.logoutTitle}>Confirm Logout</Text>
                <Text style={styles.logoutText}>
                  Are you sure you want to logout?
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowLogoutConfirm(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleLogout}
                  >
                    <Text style={styles.confirmBtnText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Appointment-specific Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const aptStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 100,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Manrope",
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope",
    color: "#6b7280",
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 2,
  },
  headerRefresh: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterScroll: {
    marginTop: 0,
    marginBottom: 16,
    paddingTop: 4,
    zIndex: 1,
    position: "relative",
  },
  filterRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e0e3e5",
  },
  filterChipActive: {
    backgroundColor: "#2c50cd",
    borderColor: "#2c50cd",
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Manrope",
    fontWeight: "600",
    color: "#526071",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  filterChipBadge: {
    backgroundColor: "#e0e3e5",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  filterChipBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontFamily: "Manrope",
    fontWeight: "700",
    color: "#526071",
  },
  filterChipBadgeTextActive: {
    color: "#ffffff",
  },
  listContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    marginHorizontal: 4,
    marginVertical: 1,
  },
  cardAccent: {
    height: 4,
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 2,
  },

  // Shimmer / Skeleton
  skelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  skelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#eef2f7",
  },
  skelPill: {
    width: 78,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#eef2f7",
  },
  skelBody: {
    gap: 10,
    marginBottom: 14,
  },
  skelLineLg: {
    width: "62%",
    height: 14,
    borderRadius: 8,
    backgroundColor: "#eef2f7",
  },
  skelLineSm: {
    width: "46%",
    height: 10,
    borderRadius: 8,
    backgroundColor: "#eef2f7",
  },
  skelLineFull: {
    width: "100%",
    height: 10,
    borderRadius: 8,
    backgroundColor: "#eef2f7",
  },
  skelLineMed: {
    width: "72%",
    height: 10,
    borderRadius: 8,
    backgroundColor: "#eef2f7",
  },
  skelActions: {
    flexDirection: "row",
    gap: 10,
  },
  skelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eef2f7",
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: "hidden",
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  patientInfo: {
    flex: 1,
    gap: 4,
  },
  patientName: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Manrope",
    color: "#191c1e",
  },
  consultTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  consultTagText: {
    fontSize: 10,
    fontFamily: "Manrope",
    fontWeight: "700",
    color: "#2c50cd",
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Manrope",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#cbd5e1",
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Manrope",
    color: "#526071",
    fontStyle: "italic",
    lineHeight: 17,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: "Manrope",
    color: "#74777c",
  },
  timeValue: {
    fontSize: 12,
    fontFamily: "Manrope",
    fontWeight: "600",
    color: "#44474c",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 13,
  },
  rejectActionBtn: {
    backgroundColor: "#fff5f5",
    borderWidth: 1.5,
    borderColor: "#fecaca",
  },
  acceptActionBtn: {
    backgroundColor: "#4f46e5",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Manrope",
    fontWeight: "700",
  },
  videoCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#0f766e",
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 13,
  },
  videoCallBtnText: {
    fontSize: 13,
    fontFamily: "Manrope",
    fontWeight: "700",
    color: "#ffffff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Manrope",
    fontWeight: "700",
    color: "#44474c",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Manrope",
    color: "#74777c",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2c50cd",
  },
  refreshBtnText: {
    fontSize: 12,
    fontFamily: "Manrope",
    fontWeight: "500",
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 6,
  },
});

// â”€â”€â”€ Main Styles (unchanged from original) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f9fb",
  },
  container: {
    flex: 1,
    backgroundColor: "#f7f9fb",
    flexDirection: "row",
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
    marginTop:22,
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
    marginBottom: 5,
 marginTop:20
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Manrope",
    color: "#ffffff",
    marginBottom: 4,
    marginTop:4
  },
  profileSpecialization: {
    fontSize: 14,
    fontFamily: "Manrope",
    color: "#8492a5",
    marginTop:4,
    marginBottom: 10,
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
    marginTop:8
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
  mobileHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 998,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  mobileHeaderBar: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuToggle: {
    width: 50,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  mobileTitleText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Manrope",
    color: "#1A1A1A",
    letterSpacing: -0.3,
  },
  mobilePlaceholder: {
    width: 50,
  },
  mobileMenuOverlay: {
    position: "absolute",
    top: 60,
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
  mobileBottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#081625",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 20 : 6,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    zIndex: 996,
    height: Platform.OS === "ios" ? 82 : 68,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 2,
    overflow: "hidden",
  },
  bottomNavLabel: {
    fontSize: 10,
    fontFamily: "Manrope",
    fontWeight: "500",
    color: "#94A3B8",
    textAlign: "center",
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
  mainContent: {
    flex: 1,
    marginLeft: 280,
    backgroundColor: "#f7f9fb",
  },
  mainContentMobile: {
    marginLeft: 0,
    marginTop: 0,
    marginBottom: Platform.OS === "ios" ? 82 : 68,
    paddingHorizontal: 20,
  },
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
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
  avatarInitialLarge: {
    fontSize: 36,
    fontWeight: "800",
    fontFamily: "Manrope",
    color: "#ffffff",
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
  incomingCallTime: {
    fontSize: 12,
    fontFamily: "Manrope",
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
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
