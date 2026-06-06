import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Image,
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
import socketService from "../../../../../services/socketService";
import { launchImageLibrary } from 'react-native-image-picker';

// Icons
import Icon from "react-native-vector-icons/FontAwesome6";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { BlurView } from "@react-native-community/blur";

// Custom Hooks
import useVibration from "../../../../../hooks/useVibration";
import { forceStopRingtone, startIncomingRingtone } from "../../../../../hooks/useRingtone";
import Dashboard from "../Tab/CounselorDashboard/Dashboardcou";
import Messagesou from "../Tab/Messages/Messagesou";
import PatientRequests from "../Tab/PatientRequests/PatientRequests";
import CounselorProfile from "../Tab/Profile-Con/CounselorProfile";
import CounselorSettings from "../Tab/Settings/CounselorSettings";
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

  // Animations: spring scale-in for card, pulse on avatar, three expanding
  // wave rings around the avatar, and a subtle vertical float on the card.
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();

      // Avatar breathing pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      // Card float
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      // Three rings, staggered, looping forever
      const ringLoop = (val, delay) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
            Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      ringLoop(ring1, 0).start();
      ringLoop(ring2, 600).start();
      ringLoop(ring3, 1200).start();
    } else {
      scaleAnim.setValue(0);
      pulseAnim.setValue(1);
      floatAnim.setValue(0);
      ring1.setValue(0); ring2.setValue(0); ring3.setValue(0);
    }
  }, [isOpen]);

  const pressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.92, useNativeDriver: true, tension: 120, friction: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 6 }).start();
  };

  if (!isOpen) return null;

  // Match web behavior: prefer the anonymous handle, fall back to whatever
  // name the parent passed (already filtered by the API), and finally "User".
// Replace this function in IncomingCallModal:
const getDisplayName = () => {
  // ✅ IMPORTANT FIX: Match web logic - prioritize anonymous fields
  // Backend already filters real names for counselor view
  if (callData?.from?.anonymous) return callData.from.anonymous;
  if (callData?.from?.anonName) return callData.from.anonName;
  if (callData?.from?.anonymousName) return callData.from.anonymousName;
  if (callData?.anonymous) return callData.anonymous;
  if (callerName) return callerName;
  return "Anonymous";
};
  const displayInitial = (getDisplayName()?.charAt(0) || "U").toUpperCase();

  const handleAccept = async () => {
    setIsAccepting(true);
    forceStopRingtone();
    onClose();
    if (onAccept) await onAccept(callData);
    setIsAccepting(false);
  };

  const handleReject = async () => {
    setIsRejecting(true);
    forceStopRingtone();
    onClose();
    if (onReject) await onReject(callData?.callId);
    setIsRejecting(false);
  };

  const profilePhoto = callData?.from?.profilePhoto || callerImage;
  const isVideo = callType === "video";

  // Wave ring interpolations (expand out + fade)
  const ringStyle = (val) => ({
    transform: [{
      scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }),
    }],
    opacity: val.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
  });

  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  // Counselor gradient: blue theme
  const cardGradient = ["rgba(30, 64, 175, 0.94)", "rgba(37, 99, 235, 0.90)", "rgba(29, 78, 216, 0.94)"];
  const avatarGradient = ["#2563EB", "#1E40AF"];
  const acceptGradient = ["#3B82F6", "#1D4ED8"];

  return (
    <Modal transparent visible={isOpen} animationType="fade" onRequestClose={onClose}>
      {/* Dimmed blurred backdrop */}
      <View style={styles.callBackdrop}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={18}
          reducedTransparencyFallbackColor="#000"
        />
        <View style={styles.callBackdropTint} />

        <Animated.View
          style={[
            styles.glassCard,
            { transform: [{ scale: scaleAnim }, { translateY: floatY }] },
          ]}
        >
          {/* Gradient sheen layer */}
          <LinearGradient
            colors={cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassCardGradient}
          >
            {/* Top label */}
            <View style={styles.callTopRow}>
              <View style={styles.callTopPill}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={12} color="#ecfeff" />
                <Text style={styles.callTopPillText}>
                  {isVideo ? "Incoming video call" : "Incoming voice call"}
                </Text>
              </View>
            </View>

            {/* Avatar with three expanding wave rings */}
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.waveRing, ringStyle(ring1)]} />
              <Animated.View style={[styles.waveRing, ringStyle(ring2)]} />
              <Animated.View style={[styles.waveRing, ringStyle(ring3)]} />

              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient
                  colors={avatarGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}
                >
                  {profilePhoto ? (
                    <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{displayInitial}</Text>
                  )}
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Name + state */}
            <Text style={styles.callerName} numberOfLines={1}>{getDisplayName()}</Text>
            <View style={styles.ringingRow}>
              <View style={styles.ringingDot} />
              <Text style={styles.ringingText}>Ringing…</Text>
            </View>

            {/* Action row */}
            <View style={styles.actionsRow}>
              {/* Decline */}
              <View style={styles.actionCol}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    onPress={handleReject}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    activeOpacity={0.85}
                    disabled={isRejecting}
                    style={[styles.fab, styles.fabReject]}
                  >
                    {isRejecting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <MaterialIcons name="call-end" size={28} color="#fff" />
                    )}
                  </TouchableOpacity>
                </Animated.View>
                <Text style={styles.actionLabel}>
                  {isRejecting ? "Declining…" : "Decline"}
                </Text>
              </View>

              {/* Accept */}
              <View style={styles.actionCol}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    onPress={handleAccept}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    activeOpacity={0.9}
                    disabled={isAccepting}
                  >
                    <LinearGradient
                      colors={acceptGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.fab, styles.fabAccept]}
                    >
                      {isAccepting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <MaterialIcons name={isVideo ? "videocam" : "call"} size={28} color="#fff" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
                <Text style={styles.actionLabel}>
                  {isAccepting ? "Connecting…" : "Accept"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Friendly relative label for a date: "Today", "Tomorrow", or weekday/date.
const friendlyDateLabel = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(now)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

// ─── Appointment Card ────────────────────────────────────────────────────────
const AppointmentCard = ({ apt, onAccept, onReject, onVideoCall, updating, index = 0 }) => {
  const isUpdating = updating === apt._id;
  const isPending = apt.status === "pending";
  const isConfirmed = apt.status === "confirmed";
  const isCanceled = apt.status === "canceled";

  // Entrance animation — staggered fade-up so cards appear sequentially.
  const entry = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 6) * 55,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [entry, index]);
  const translateY = entry.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  const patientName =
    apt.patient?.anonymous ||
    apt.patient?.fullName ||
    "Anonymous User";
  const initials = patientName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const requestedDate = friendlyDateLabel(apt.date);
  const requestedTime = apt.date
    ? new Date(apt.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
  const isToday = apt.date ? isSameDay(apt.date, new Date()) : false;

  // Minimal status palette — muted, low-saturation tones for a calm aesthetic.
  const statusColor = isPending ? "#b45309" : isConfirmed ? "#047857" : "#b91c1c";
  const statusBg = isPending ? "#fef7e6" : isConfirmed ? "#ecfdf5" : "#fef2f2";
  const statusLabel = isPending ? "Pending" : isConfirmed ? "Confirmed" : "Canceled";
  const statusDot = isPending ? "#f59e0b" : isConfirmed ? "#2563EB" : "#ef4444";

  // Avatar gradient — soft pastel tones, status-aware but minimal.
  const avatarColors = isCanceled
    ? ["#fca5a5", "#f87171"]
    : isConfirmed
    ? ["#E0F2FE", "#BAE6FD"]
    : ["#E0F2FE", "#BAE6FD"];

  return (
    <Animated.View style={[aptStyles.card, { opacity: entry, transform: [{ translateY }] }]}>
      {/* Status side-accent (left vertical bar, subtle status tint) */}
      <View style={[aptStyles.cardSideAccent, { backgroundColor: statusDot + '55' }]} />

      <View style={aptStyles.cardBody}>
        {/* Header row: avatar ring + info + badge */}
        <View style={aptStyles.cardHeader}>
          {/* Gradient ring around avatar */}
          <View style={aptStyles.avatarRingOuter}>
            <LinearGradient colors={avatarColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={aptStyles.avatarRing}>
              <View style={aptStyles.avatarInner}>
                <Text style={aptStyles.avatarInitials}>{initials || "?"}</Text>
              </View>
            </LinearGradient>
            {isToday && <View style={aptStyles.todayDot} />}
          </View>

          <View style={aptStyles.patientInfo}>
            <Text style={aptStyles.patientName} numberOfLines={1}>{patientName}</Text>
            <View style={aptStyles.consultTag}>
              <Ionicons name="medkit-outline" size={11} color="#94a3b8" />
              <Text style={aptStyles.consultTagText}>Consultation</Text>
            </View>
          </View>

          <View style={[aptStyles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + "22" }]}>
            <View style={[aptStyles.statusBadgeDot, { backgroundColor: statusDot }]} />
            <Text style={[aptStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Date/time pill — bigger, hero block */}
        <View style={aptStyles.dateTimeBlock}>
          <View style={aptStyles.dateTimeIcon}>
            <Ionicons name="calendar" size={16} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={aptStyles.dateTimePrimary}>
              {requestedDate}
              {requestedTime !== "—" ? `  •  ${requestedTime}` : ""}
            </Text>
            {apt.date && (
              <Text style={aptStyles.dateTimeSecondary}>
                {new Date(apt.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </Text>
            )}
          </View>
        </View>

        {/* Notes */}
        {apt.notes && apt.notes.trim() !== "" && (
          <View style={aptStyles.notesBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color="#94a3b8" />
            <Text style={aptStyles.notesText} numberOfLines={3}>{apt.notes}</Text>
          </View>
        )}

        {/* Actions */}
        {isPending && (
          <View style={aptStyles.actions}>
            <TouchableOpacity
              style={aptStyles.rejectActionBtn}
              onPress={() => onReject(apt._id)}
              disabled={isUpdating}
              activeOpacity={0.85}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close" size={16} color="#ef4444" />
                  <Text style={aptStyles.rejectBtnText}>Decline</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={aptStyles.acceptActionBtn}
              onPress={() => onAccept(apt._id)}
              disabled={isUpdating}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={["#2563EB", "#0D9488"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={aptStyles.acceptBtnGradient}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={aptStyles.acceptBtnText}>Accept</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {isConfirmed && (
          <TouchableOpacity
            style={aptStyles.videoCallBtn}
            onPress={() => onVideoCall(apt)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#2563EB", "#1E3A8A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={aptStyles.videoCallBtnGradient}
            >
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={aptStyles.videoCallBtnText}>Start Video Call</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {isCanceled && (
          <View style={aptStyles.canceledNote}>
            <Ionicons name="information-circle-outline" size={13} color="#94a3b8" />
            <Text style={aptStyles.canceledNoteText}>This appointment was canceled.</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// â”€â”€ Appointments Shimmer UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AppointmentSkeletonCard = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 850, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 850, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <View style={aptStyles.card}>
      {/* Left vertical accent matching the new card layout */}
      <View style={[aptStyles.cardSideAccent, aptStyles.skelAccentColor]} />
      <View style={aptStyles.cardBody}>
        <View style={aptStyles.cardHeader}>
          <Animated.View style={[aptStyles.skelAvatar, { opacity: opacity }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={[aptStyles.skelLineLg, { opacity: opacity }]} />
            <Animated.View style={[aptStyles.skelLineSm, { opacity: opacity }]} />
          </View>
          <Animated.View style={[aptStyles.skelPill, { opacity: opacity }]} />
        </View>
        <View style={aptStyles.skelBody}>
          <Animated.View style={[aptStyles.skelLineFull, { opacity: opacity }]} />
          <Animated.View style={[aptStyles.skelLineMed, { opacity: opacity }]} />
        </View>
        <View style={aptStyles.skelActions}>
          <Animated.View style={[aptStyles.skelBtn, { opacity: opacity }]} />
          <Animated.View style={[aptStyles.skelBtn, { opacity: opacity }]} />
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
  const [earningsLoading, setEarningsLoading] = useState(true);
  const earningsShimmerAnim = useRef(new Animated.Value(0)).current;
  // Ref mirrors for modal states — lets polling interval use stable [] deps
  // without going stale on state changes.
  const showIncomingCallModalRef = useRef(false);
  const isVideoModalOpenRef = useRef(false);
  const isVoiceModalOpenRef = useRef(false);
  const isFocusedRef = useRef(false);
  const isPollingRef = useRef(true);

  // â”€â”€ Appointment state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState(null);
  const [aptFilter, setAptFilter] = useState("all"); // "all" | "pending" | "confirmed" | "canceled"

  const navigation = useNavigation();
  const { vibrate } = useVibration();
  const { showToast: showAppToast } = useToast();
  // Tracks whether ring has been started so we don't call startIncomingRingtone
  // multiple times for the same modal session (prevents double ring).
  const ringingStartedRef = useRef(false);

  useEffect(() => {
    if (!isFocused || !showIncomingCallModal) {
      if (ringingStartedRef.current) {
        ringingStartedRef.current = false;
        forceStopRingtone();
      }
      return;
    }
    if (!ringingStartedRef.current) {
      ringingStartedRef.current = true;
      startIncomingRingtone(true);
    }
  }, [isFocused, showIncomingCallModal]);

  // Earnings shimmer: pulse loop + reset on tab open
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(earningsShimmerAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(earningsShimmerAnim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [earningsShimmerAnim]);

  useEffect(() => {
    if (activeTab !== "earnings") return;
    setEarningsLoading(true);
    const t = setTimeout(() => setEarningsLoading(false), 750);
    return () => clearTimeout(t);
  }, [activeTab]);

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
          forceStopRingtone();
          ringingStartedRef.current = false;
          setShowIncomingCallModal(false);
          setIncomingCallData(null);
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
  }, [isFocused, showIncomingCallModal, incomingCallData?.callId]);

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
      const unsubscribers = [];
      try {
        const socket = await socketService.connect();
        aptSocketRef.current = socket;
        if (counsellorId) socket.emit('join-counsellor-room', { counsellorId });
        const refresh = () => fetchAppointments(true);
        unsubscribers.push(await socketService.on('appointment-booked', refresh));
        unsubscribers.push(await socketService.on('appointment-updated', refresh));
        unsubscribers.push(await socketService.on('appointment-new', refresh));
        unsubscribers.push(await socketService.on('appointment-status-changed', refresh));
        aptSocketRef.current._unsubscribers = unsubscribers;
      } catch (err) {
        console.error('Failed to connect appointment socket (shared):', err);
      }
    };
    connectAptSocket();
    return () => {
      try { const unsub = aptSocketRef.current?._unsubscribers || []; unsub.forEach(fn => { try { fn(); } catch {} }); } catch (e) {}
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
        // Match web: prefer anonymous handle, fall back to backend-provided
        // displayName/fullName, finally "User".
        const displayName =
          patientInfo.anonymous ||
          patientInfo.displayName ||
          patientInfo.fullName ||
          "User";

        const callData = {
          id: rawCall?.id || rawCall?._id || response.data.callId,
          callId: response.data.callId,
          roomId: response.data.roomId,
          name: displayName,
          profilePic: patientInfo.profilePhoto || patientInfo.image || null,
          isIncoming: false,
          callType: "video",
          type: "video",
          status: response.data.status || "ringing",
          currentUserId: storedCounsellorId,
          currentUserType: "counsellour",
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
  // Stop ringtone immediately
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

    // ✅ IMPORTANT FIX: Match web logic - prioritize anonymous fields
    let displayName = "User";
    if (remoteParticipant?.anonymous) {
      displayName = remoteParticipant.anonymous;
    } else if (remoteParticipant?.anonName) {
      displayName = remoteParticipant.anonName;
    } else if (remoteParticipant?.anonymousName) {
      displayName = remoteParticipant.anonymousName;
    } else if (remoteParticipant?.displayName) {
      displayName = remoteParticipant.displayName;
    } else if (remoteParticipant?.fullName) {
      displayName = remoteParticipant.fullName;
    } else if (callData.name) {
      displayName = callData.name;
    }

    const acceptedCallData = {
      id: detailedCall?.id || detailedCall?._id || callData.callId,
      callId: callData.callId,
      roomId: result.data?.roomId || detailedCall?.roomId || callData.roomId,
      name: displayName,  // Now uses anonymous name as priority
      isIncoming: true,
      status: result.data?.status || detailedCall?.status || "active",
      type: modalType,
      callType: modalType,
      profilePic: remoteParticipant?.profilePhoto || remoteParticipant?.image || callData.image || null,
      phoneNumber: remoteParticipant?.phoneNumber || remoteParticipant?.phone || "",
      apiCallData: detailedCall,
      initiator: detailedCall?.initiator || callData.initiator,
      receiver: detailedCall?.receiver,
      initiatorId: detailedCall?.initiator?.id || detailedCall?.initiator?._id,
      receiverId: detailedCall?.receiver?.id || detailedCall?.receiver?._id,
      currentUserId: counsellorId,
      currentUserType: "counsellour",
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
    forceStopRingtone();
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    await rejectCall(callId);
  };

  // â”€â”€ Fetch Waiting Calls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // const fetchWaitingCalls = async () => {
  //   try {
  //     const token = await getAuthToken();
  //     const counsellorId = await getCounsellorId();
  //     if (!counsellorId || !token) return;

  //     const response = await axios.get(
  //       `${API_BASE_URL}/api/video/calls/pending/${counsellorId}`,
  //       { headers: { Authorization: `Bearer ${token}` } }
  //     );

  //     const callsList =
  //       response.data.pendingRequests ||
  //       response.data.waitingCalls ||
  //       response.data.calls;

  //     if (response.data?.success && callsList?.length > 0) {
  //       setWaitingCalls(callsList);
  //       const waitingCall =
  //         callsList.find(
  //           (call) =>
  //             !call.status ||
  //             call.status === "waiting" ||
  //             call.status === "ringing"
  //         ) || callsList[0];

  //       if (
  //         waitingCall &&
  //         !showIncomingCallModalRef.current &&
  //         !isVideoModalOpenRef.current &&
  //         !isVoiceModalOpenRef.current
  //       ) {
  //         const fromData = waitingCall.from || waitingCall.initiator || {};
  //         // Match web: prefer anonymous handle from the API, then displayName,
  //         // and finally "Anonymous". Backend already filters real names for
  //         // the counselor view, so we trust the field it provides.
  //         const displayName =
  //           fromData.anonymous ||
  //           fromData.anonName ||
  //           fromData.anonymousName ||
  //           fromData.displayName ||
  //           "Anonymous";

  //         setIncomingCallData({
  //           callId: waitingCall.callId || waitingCall.id || waitingCall._id,
  //           roomId: waitingCall.roomId,
  //           name: displayName,
  //           image: fromData.profilePhoto || fromData.image || null,
  //           callType: waitingCall.callType || "video",
  //           from: fromData,
  //           initiator: waitingCall.initiator,
  //           requestedAt: waitingCall.requestedAt,
  //           expiresAt: waitingCall.expiresAt,
  //         });

  //         setShowIncomingCallModal(true);
  //         safeVibrate([320, 160, 320]);
  //       }
  //     } else {
  //       setWaitingCalls([]);
  //     }
  //   } catch (error) {
  //     const status = error?.response?.status;
  //     if (status === 401) {
  //       showToast("Session expired. Please login again.", "error");
  //       isPollingRef.current = false;
  //       setIsPolling(false);
  //       return;
  //     }
  //     console.error("Error fetching waiting calls:", error);
  //   }
  // };
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
        !showIncomingCallModalRef.current &&
        !isVideoModalOpenRef.current &&
        !isVoiceModalOpenRef.current
      ) {
        const fromData = waitingCall.from || waitingCall.initiator || {};
        
        // ✅ IMPORTANT FIX: Match web logic - prefer anonymous field
        // The backend already filters real names for counselor view
        let displayName = "Anonymous";
        
        // Check for anonymous fields first (these are what the backend provides)
        if (fromData.anonymous) {
          displayName = fromData.anonymous;
        } else if (fromData.anonName) {
          displayName = fromData.anonName;
        } else if (fromData.anonymousName) {
          displayName = fromData.anonymousName;
        } else if (fromData.isAnonymous && typeof fromData.isAnonymous === 'string') {
          displayName = fromData.isAnonymous;
        } 
        // ONLY fall back to displayName/fullName if anonymous fields don't exist
        // (but backend should always provide anonymous for counselor view)
        else if (fromData.displayName) {
          displayName = fromData.displayName;
        } else if (fromData.fullName) {
          displayName = fromData.fullName;
        }

        setIncomingCallData({
          callId: waitingCall.callId || waitingCall.id || waitingCall._id,
          roomId: waitingCall.roomId,
          name: displayName,  // Now uses anonymous name as priority
          image: fromData.profilePhoto || fromData.image || null,
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
      isPollingRef.current = false;
      setIsPolling(false);
      return;
    }
    console.error("Error fetching waiting calls:", error);
  }
};

  // Keep ref mirrors in sync so the stable polling interval reads current values.
  useEffect(() => { showIncomingCallModalRef.current = showIncomingCallModal; }, [showIncomingCallModal]);
  useEffect(() => { isVideoModalOpenRef.current = isVideoModalOpen; }, [isVideoModalOpen]);
  useEffect(() => { isVoiceModalOpenRef.current = isVoiceModalOpen; }, [isVoiceModalOpen]);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);
  useEffect(() => { isPollingRef.current = isPolling; }, [isPolling]);

  // Polling for waiting calls — stable [] deps prevent interval restart on modal state changes.
  useEffect(() => {
    const poll = () => {
      if (
        !isFocusedRef.current ||
        !isPollingRef.current ||
        showIncomingCallModalRef.current ||
        isVideoModalOpenRef.current ||
        isVoiceModalOpenRef.current
      ) return;
      fetchWaitingCalls();
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    forceStopRingtone();
    ringingStartedRef.current = false;
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    // Delay re-enabling polling so the just-ended call clears from the backend
    // before we poll again — prevents the ringtone restarting immediately after hangup.
    setTimeout(() => { isPollingRef.current = true; setIsPolling(true); }, 6000);
  };

  const handleCloseIncomingModal = () => {
    forceStopRingtone();
    ringingStartedRef.current = false;
    setShowIncomingCallModal(false);
    setIncomingCallData(null);
    isPollingRef.current = true;
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
        const missingFields = [];
        if (!data.specialization || (Array.isArray(data.specialization) && data.specialization.length === 0)) missingFields.push('Specialization');
        if (!data.experience) missingFields.push('Experience');
        if (!data.qualification && !data.education) missingFields.push('Qualification');
        if (!data.location) missingFields.push('Location');

        // Fetch accepted chats count for patient count
        let acceptedChatsCount = 0;
        try {
          const chatsRes = await axios.get(
            `${API_BASE_URL}/api/chat/chats`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          const chats = chatsRes.data?.chats || [];
          acceptedChatsCount = chats.filter(
            (c) => String(c.status || "").toLowerCase() === "accepted"
          ).length;
        } catch (e) {
          // non-critical — keep 0
        }

        setCounselorData({
          name: data.fullName || data.name,
          specialization: Array.isArray(data.specialization)
            ? data.specialization.join(", ")
            : data.specialization,
          experience: parseInt(data.experience) || null,
          patients: acceptedChatsCount,
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
          profileCompleted: data.profileCompleted === true,
          missingFields,
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

  const [photoUploading, setPhotoUploading] = useState(false);

  const handleSidebarPhotoEdit = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (res) => {
      if (res.didCancel || res.errorCode || !res.assets?.[0]) return;
      const asset = res.assets[0];
      try {
        setPhotoUploading(true);
        const token = await getAuthToken();
        const id = await getCounsellorId();
        const formData = new FormData();
        formData.append('profilePhoto', { uri: asset.uri, type: asset.type, name: asset.fileName || 'photo.jpg' });
        await axios.patch(`${API_BASE_URL}/api/auth/update/${id}`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        setCounselorData((prev) => ({ ...prev, profilePhoto: asset.uri }));
      } catch (e) {
        Alert.alert('Upload failed', 'Could not update profile photo. Please try again.');
      } finally {
        setPhotoUploading(false);
      }
    });
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
    // { id: "patients", icon: "users", label: "Patients", badge: 0 },
    { id: "earnings", icon: "money-bill-wave", label: "Earnings", badge: 0 },
    { id: "settings", icon: "sliders", label: "Settings", badge: 0 },
    { id: "profile", icon: "chart-pie", label: "Profile", badge: 0 },
  ];

  const handleTabChange = (tabId) => {
    vibrate(80);
    setActiveTab(tabId);
    setShowMobileMenu(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // â”€â”€ Appointments Tab Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAppointmentsTab = () => {
    const filterTabs = [
      { key: 'all', label: 'All', icon: 'apps-outline' },
      { key: 'pending', label: 'Pending', icon: 'time-outline' },
      { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
      { key: 'canceled', label: 'Canceled', icon: 'close-circle-outline' },
    ];

    const filteredApts =
      aptFilter === "all"
        ? appointments
        : appointments.filter((a) => a.status === aptFilter);

    const countFor = (key) =>
      key === "all" ? appointments.length : appointments.filter((a) => a.status === key).length;

    // Stats
    const pendingCount = appointments.filter((a) => a.status === "pending").length;
    const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
    const todayCount = appointments.filter((a) => isSameDay(a.date, new Date())).length;

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const firstName =
      (counselorData?.name || "").split(" ")[0] ||
      (counselorData?.name) ||
      "Counselor";

    return (
      <ScrollView
        style={aptStyles.scrollOuter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={aptStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingAppointments && appointments.length > 0}
            onRefresh={fetchAppointments}
            colors={["#1E3A8A", "#2563EB"]}
            tintColor="#2563EB"
          />
        }
      >
        {/* Inset section: hero, title, filters keep horizontal breathing room.
            The card list below this wrapper stays edge-to-edge. */}
        <View style={aptStyles.insetSection}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#1E3A8A", "#2563EB", "#0D9488"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={aptStyles.hero}
        >
          {/* Decorative blurred blobs */}
          <View style={aptStyles.heroBlob1} />
          <View style={aptStyles.heroBlob2} />

          <View style={aptStyles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={aptStyles.heroGreeting}>{greeting},</Text>
              <Text style={aptStyles.heroName} numberOfLines={1}>{firstName}</Text>
            </View>
            <TouchableOpacity
              style={aptStyles.heroRefreshBtn}
              onPress={() => fetchAppointments()}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <Text style={aptStyles.heroSubtitle}>
            {todayCount > 0
              ? `${todayCount} appointment${todayCount === 1 ? "" : "s"} scheduled for today`
              : `${appointments.length} total appointment${appointments.length === 1 ? "" : "s"}`}
          </Text>

          {/* Inline mini-summary bar */}
          <View style={aptStyles.heroSummaryBar}>
            <View style={aptStyles.heroSummaryItem}>
              <Text style={aptStyles.heroSummaryNum}>{pendingCount}</Text>
              <Text style={aptStyles.heroSummaryLabel}>Pending</Text>
            </View>
            <View style={aptStyles.heroSummaryDivider} />
            <View style={aptStyles.heroSummaryItem}>
              <Text style={aptStyles.heroSummaryNum}>{confirmedCount}</Text>
              <Text style={aptStyles.heroSummaryLabel}>Confirmed</Text>
            </View>
            <View style={aptStyles.heroSummaryDivider} />
            <View style={aptStyles.heroSummaryItem}>
              <Text style={aptStyles.heroSummaryNum}>{todayCount}</Text>
              <Text style={aptStyles.heroSummaryLabel}>Today</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Section title + filter chips ────────────────────────────────── */}
        <View style={aptStyles.sectionTitleRow}>
          <Text style={aptStyles.sectionTitle}>All Requests</Text>
          <Text style={aptStyles.sectionCount}>{filteredApts.length} shown</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={aptStyles.filterScroll}
          contentContainerStyle={aptStyles.filterRow}
        >
          {filterTabs.map((ft) => {
            const isActive = aptFilter === ft.key;
            const count = countFor(ft.key);

            if (isActive) {
              return (
                <TouchableOpacity
                  key={ft.key}
                  activeOpacity={0.9}
                  onPress={() => setAptFilter(ft.key)}
                >
                  <LinearGradient
                    colors={["#2563EB", "#0D9488"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[aptStyles.filterChip, aptStyles.filterChipActive]}
                  >
                    <Ionicons name={ft.icon} size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={[aptStyles.filterChipText, aptStyles.filterChipTextActive]}>
                      {ft.label}
                    </Text>
                    {count > 0 && (
                      <View style={[aptStyles.filterChipBadge, aptStyles.filterChipBadgeActive]}>
                        <Text style={[aptStyles.filterChipBadgeText, aptStyles.filterChipBadgeTextActive]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={ft.key}
                style={aptStyles.filterChip}
                onPress={() => setAptFilter(ft.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={ft.icon} size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={aptStyles.filterChipText}>{ft.label}</Text>
                {count > 0 && (
                  <View style={aptStyles.filterChipBadge}>
                    <Text style={aptStyles.filterChipBadgeText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </View>
        {/* end of inset section — list below is edge-to-edge */}

        {/* ── List / loading / empty ──────────────────────────────────────── */}
        {loadingAppointments && appointments.length === 0 ? (
          <View style={aptStyles.listContainer}>
            {[0, 1, 2, 3].map((i) => (
              <AppointmentSkeletonCard key={`apt_skel_${i}`} />
            ))}
          </View>
        ) : filteredApts.length === 0 ? (
          <View style={[aptStyles.emptyState, { paddingHorizontal: 14 }]}>
            <LinearGradient
              colors={["#F0F9FF", "#E0F2FE"]}
              style={aptStyles.emptyIconWrap}
            >
              <Ionicons name="calendar-outline" size={44} color="#2563EB" />
            </LinearGradient>
            <Text style={aptStyles.emptyTitle}>No appointments found</Text>
            <Text style={aptStyles.emptyText}>
              {aptFilter === "pending"
                ? "No pending appointment requests right now. New requests will appear here."
                : aptFilter === "confirmed"
                ? "No confirmed appointments yet. Accepted requests will show up here."
                : aptFilter === "canceled"
                ? "No canceled appointments."
                : "No appointments to show yet."}
            </Text>
            <TouchableOpacity
              style={aptStyles.emptyRefreshBtn}
              onPress={() => fetchAppointments()}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={14} color="#2563EB" />
              <Text style={aptStyles.emptyRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={aptStyles.listContainer}>
            {filteredApts.map((apt, idx) => (
              <AppointmentCard
                key={apt._id}
                apt={apt}
                index={idx}
                onAccept={(id) => handleUpdateAppointmentStatus(id, "confirmed")}
                onReject={(id) => handleUpdateAppointmentStatus(id, "canceled")}
                onVideoCall={handleInitiateVideoCallFromApt}
                updating={updatingAppointmentId}
              />
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
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
      case "earnings": {
        const shimmerOpacity = earningsShimmerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 0.75],
        });
        if (earningsLoading) {
          return (
            <ScrollView
              style={styles.earningsScroll}
              contentContainerStyle={styles.earningsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.earningsSection}>
                <View style={styles.earningsSectionHeader}>
                  <View style={styles.earningsSectionHeaderText}>
                    <Animated.View style={[styles.earnSkTitle, { opacity: shimmerOpacity }]} />
                    <Animated.View style={[styles.earnSkSubtitle, { opacity: shimmerOpacity }]} />
                  </View>
                  <Animated.View style={[styles.earnSkPill, { opacity: shimmerOpacity }]} />
                </View>
                <Animated.View style={[styles.earnSkHero, { opacity: shimmerOpacity }]} />
                <View style={styles.earningsMiniGrid}>
                  <Animated.View style={[styles.earnSkMini, { opacity: shimmerOpacity }]} />
                  <Animated.View style={[styles.earnSkMini, { opacity: shimmerOpacity }]} />
                </View>
                <View style={styles.earningsCardRow}>
                  <Animated.View style={[styles.earnSkCard, { opacity: shimmerOpacity }]} />
                  <Animated.View style={[styles.earnSkCard, { opacity: shimmerOpacity }]} />
                </View>
                <Animated.View style={[styles.earnSkList, { opacity: shimmerOpacity }]} />
              </View>
            </ScrollView>
          );
        }
        return (
          <ScrollView
            style={styles.earningsScroll}
            contentContainerStyle={styles.earningsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.earningsSection}>
              <View style={styles.earningsSectionHeader}>
                <View style={styles.earningsSectionHeaderText}>
                  <Text style={styles.earningsSectionTitle}>Earnings</Text>
                  <Text style={styles.earningsSectionSubtitle}>
                    Your payout overview at a glance
                  </Text>
                </View>
                <View style={styles.earningsPeriodPill}>
                  <Icon name="calendar" size={11} color="#2563EB" />
                  <Text style={styles.earningsPeriodPillText}>This month</Text>
                </View>
              </View>

              <LinearGradient
                colors={['#2563EB', '#0D9488', '#1E3A8A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.earningsHeroCard}
              >
                <View style={styles.earningsHeroTopRow}>
                  <View style={styles.earningsHeroIconWrap}>
                    <Icon name="wallet" size={20} color="#ffffff" />
                  </View>
                  <View style={styles.earningsHeroTrendPill}>
                    <Icon name="arrow-trend-up" size={11} color="#22c55e" />
                    <Text style={styles.earningsHeroTrendText}>+12.5%</Text>
                  </View>
                </View>

                <Text style={styles.earningsHeroLabel}>Total Earnings</Text>
                <Text style={styles.earningsHeroAmount}>₹24,500</Text>
                <Text style={styles.earningsHeroCaption}>
                  Across 45 completed sessions this month
                </Text>

                <View style={styles.earningsHeroDivider} />

                <View style={styles.earningsHeroBottomRow}>
                  <View style={styles.earningsHeroMetaItem}>
                    <Text style={styles.earningsHeroMetaLabel}>Pending</Text>
                    <Text style={styles.earningsHeroMetaValue}>₹8,750</Text>
                  </View>
                  <View style={styles.earningsHeroMetaItem}>
                    <Text style={styles.earningsHeroMetaLabel}>Withdrawable</Text>
                    <Text style={styles.earningsHeroMetaValue}>₹15,750</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.earningsWithdrawBtn}
                  activeOpacity={0.85}
                  onPress={() =>
                    Alert.alert(
                      "Withdraw",
                      "₹15,750 will be transferred to your linked bank account within 2-3 business days."
                    )
                  }
                >
                  <Icon name="arrow-up-right-from-square" size={13} color="#2563EB" />
                  <Text style={styles.earningsWithdrawBtnText}>Withdraw Funds</Text>
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.earningsMiniGrid}>
                <View style={styles.earningsMiniCard}>
                  <View style={[styles.earningsMiniIcon, { backgroundColor: '#dcfce7' }]}>
                    <Icon name="check" size={14} color="#16a34a" />
                  </View>
                  <Text style={styles.earningsMiniLabel}>Last 30 Days</Text>
                  <Text style={styles.earningsMiniValue}>₹24,500</Text>
                </View>
                <View style={styles.earningsMiniCard}>
                  <View style={[styles.earningsMiniIcon, { backgroundColor: '#dbeafe' }]}>
                    <Icon name="clock" size={14} color="#2563eb" />
                  </View>
                  <Text style={styles.earningsMiniLabel}>Processing</Text>
                  <Text style={styles.earningsMiniValue}>2-3 days</Text>
                </View>
              </View>

              <View style={styles.earningsCardRow}>
                <View style={[styles.earningsCard, styles.earningsCardPending]}>
                  <Text style={styles.earningsCardTitle}>Pending Payout</Text>
                  <Text style={styles.earningsAmount}>{'\u20B9'}8,750</Text>
                  <Text style={[styles.earningsBadge, styles.earningsBadgeWarning]}>
                    Awaiting processing
                  </Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsCardTitle}>This Month</Text>
                  <Text style={styles.earningsAmount}>{'\u20B9'}24,500</Text>
                  <Text style={styles.earningsBadge}>45 sessions completed</Text>
                </View>
              </View>

              <View style={styles.earningsBreakdownCard}>
                <View style={styles.earningsBreakdownHeader}>
                  <Text style={styles.earningsBreakdownTitle}>Recent Transactions</Text>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.earningsBreakdownLink}>View all</Text>
                  </TouchableOpacity>
                </View>

                {[
                  { name: "Riya Sharma", type: "Video session", amount: "+\u20B91,200", date: "Today, 10:24 AM", color: "#16a34a", icon: "video" },
                  { name: "Arjun Mehta", type: "Voice session", amount: "+\u20B9800", date: "Yesterday, 6:10 PM", color: "#2563eb", icon: "phone" },
                  { name: "Neha Verma", type: "Chat session", amount: "+\u20B9450", date: "12 May, 4:42 PM", color: "#9333ea", icon: "message" },
                  { name: "Withdrawal", type: "To HDFC \u2022\u2022\u2022\u2022 4421", amount: "-\u20B95,000", date: "10 May, 2:15 PM", color: "#ef4444", icon: "building-columns" },
                ].map((tx, i, arr) => (
                  <View
                    key={i}
                    style={[
                      styles.earningsTxnRow,
                      i < arr.length - 1 && styles.earningsTxnRowDivider,
                    ]}
                  >
                    <View
                      style={[
                        styles.earningsTxnIcon,
                        { backgroundColor: `${tx.color}1A` },
                      ]}
                    >
                      <Icon name={tx.icon} size={14} color={tx.color} />
                    </View>
                    <View style={styles.earningsTxnBody}>
                      <Text style={styles.earningsTxnName}>{tx.name}</Text>
                      <Text style={styles.earningsTxnMeta}>
                        {tx.type} {'\u2022'} {tx.date}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.earningsTxnAmount,
                        { color: tx.amount.startsWith("-") ? "#ef4444" : "#16a34a" },
                      ]}
                    >
                      {tx.amount}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        );
      }
      case "messages":
        return <Messagesou />;
      case "profile":
        return <CounselorProfile />;
      case "settings":
        return (
          <CounselorSettings
            onNavigate={(tab) => setActiveTab(tab)}
            onLogout={() => setShowLogoutConfirm(true)}
          />
        );
      default:
        return <Messagesou />;
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
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
            {/* Sidebar Brand Header */}
            <View style={styles.sidebarBrand}>
              <View style={styles.sidebarBrandIcon}>
                <Image
                  source={require('../../../../../image/Mediconect Logo-3.png')}
                  style={styles.sidebarBrandLogoImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.sidebarBrandText}>Mediconeckt</Text>
              <View style={styles.sidebarBrandPill}>
                <Text style={styles.sidebarBrandPillText}>PRO</Text>
              </View>
            </View>
            {/* Profile */}
            <View style={styles.sidebarHeader}>
              <View style={styles.profileContainer}>
                {/* Avatar with blue ring — tap to edit photo */}
                <TouchableOpacity
                  onPress={handleSidebarPhotoEdit}
                  activeOpacity={0.8}
                  style={{ alignItems: 'center' }}
                >
                  <View style={styles.avatarOuterRing}>
                    {counselorData?.profilePhoto ? (
                      <Image
                        source={{ uri: counselorData.profilePhoto }}
                        style={styles.profileAvatarImage}
                      />
                    ) : (
                      <LinearGradient
                        colors={["#2563EB", "#1D4ED8"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.profileAvatarGradient}
                      >
                        <Text style={styles.profileAvatarInitial}>
                          {(counselorData?.name || "C").charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                    {/* Camera edit badge */}
                    <View style={styles.avatarEditBadge}>
                      {photoUploading
                        ? <ActivityIndicator size={10} color="#fff" />
                        : <Feather name="camera" size={10} color="#ffffff" />}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Name */}
                <Text style={styles.profileName} numberOfLines={1}>
                  {counselorData?.name || "Counselor"}
                </Text>

                {/* Specialization */}
                <Text style={styles.profileSpecialization} numberOfLines={1}>
                  {counselorData?.specialization || "Mental Health"}
                </Text>

                {/* Rating + Experience row */}
                <View style={styles.profileMetaRow}>
                  <View style={styles.ratingBadge}>
                    <Icon name="star" size={11} color="#FBBF24" />
                    <Text style={styles.ratingText}>
                      {counselorData?.rating || "4.5"}
                    </Text>
                  </View>
                  {counselorData?.experience ? (
                    <View style={styles.expBadge}>
                      <Icon name="briefcase" size={10} color="#6366F1" />
                      <Text style={styles.expText}>
                        {counselorData.experience} yrs
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Online status pill */}
                <View style={styles.onlineStatusPill}>
                  <View style={styles.onlineStatusDot} />
                  <Text style={styles.onlineStatusText}>Available</Text>
                </View>

                {/* Quick stats strip */}
                <View style={styles.profileStatsStrip}>
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatNum}>
                      {counselorData?.patients || "0"}
                    </Text>
                    <Text style={styles.profileStatLabel}>Patients</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatNum}>
                      {counselorData?.languages?.length || "0"}
                    </Text>
                    <Text style={styles.profileStatLabel}>Languages</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatNum}>
                      {counselorData?.specializations?.length || "0"}
                    </Text>
                    <Text style={styles.profileStatLabel}>Specialties</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Nav */}
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
                    size={18}
                    color={activeTab === item.id ? "#FFFFFF" : "#6B7280"}
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
                      <Text style={styles.navBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Pushes logout to bottom */}
            <View style={{ flex: 1 }} />

            {/* Logout */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                style={[styles.navItem, styles.navItemLogout]}
                onPress={() => setShowLogoutConfirm(true)}
                activeOpacity={0.75}
              >
                <Feather name="log-out" size={18} color="#e53935" />
                <Text style={[styles.navLabel, styles.navLabelLogout]}>
                  Sign Out
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
                style={[styles.menuToggle, showMobileMenu && styles.menuToggleClose]}
                onPress={() => setShowMobileMenu(!showMobileMenu)}
                activeOpacity={0.7}
              >
                {showMobileMenu ? (
                  <Feather name="x" size={24} color="#2563EB" />
                ) : (
                  <Icon name="bars" size={20} color="#2563EB" />
                )}
              </TouchableOpacity>

              <View style={styles.mobileTitle}>
                <View style={styles.mobileTitleBadge}>
                  <Image
                    source={require('../../../../../image/Mediconect Logo-3.png')}
                    style={styles.mobileTitleLogoImg}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.mobileTitleText}>Mediconeckt</Text>
              </View>

              <TouchableOpacity
                style={styles.mobileLogoutBtn}
                onPress={() => setShowLogoutConfirm(true)}
                activeOpacity={0.5}
              >
                <Feather name="log-out" size={20} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mobile Menu Overlay */}
        {isMobile && showMobileMenu && (
          <View style={[styles.mobileMenuOverlay, { top: topInset + MOBILE_HEADER_BAR_HEIGHT }]}>
            <View style={styles.mobileMenu}>

              {/* Profile */}
              <View style={styles.sidebarHeader}>
                <View style={styles.profileContainer}>
                  <TouchableOpacity onPress={handleSidebarPhotoEdit} activeOpacity={0.8} style={{ alignItems: 'center' }}>
                    <View style={styles.avatarOuterRing}>
                      {counselorData?.profilePhoto ? (
                        <Image
                          source={{ uri: counselorData.profilePhoto }}
                          style={styles.profileAvatarImage}
                        />
                      ) : (
                        <LinearGradient
                          colors={["#2563EB", "#1D4ED8"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.profileAvatarGradient}
                        >
                          <Text style={styles.profileAvatarInitial}>
                            {(counselorData?.name || "C").charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}
                      <View style={styles.avatarEditBadge}>
                        {photoUploading
                          ? <ActivityIndicator size={10} color="#fff" />
                          : <Feather name="camera" size={10} color="#ffffff" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {counselorData?.name || "Counselor"}
                  </Text>
                  <Text style={styles.profileSpecialization} numberOfLines={1}>
                    {counselorData?.specialization || "Mental Health"}
                  </Text>
                  <View style={styles.profileMetaRow}>
                    <View style={styles.ratingBadge}>
                      <Icon name="star" size={11} color="#FBBF24" />
                      <Text style={styles.ratingText}>
                        {counselorData?.rating || "4.5"}
                      </Text>
                    </View>
                    {counselorData?.experience ? (
                      <View style={styles.expBadge}>
                        <Icon name="briefcase" size={10} color="#6366F1" />
                        <Text style={styles.expText}>
                          {counselorData.experience} yrs
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.onlineStatusPill}>
                    <View style={styles.onlineStatusDot} />
                    <Text style={styles.onlineStatusText}>Available</Text>
                  </View>
                  <View style={styles.profileStatsStrip}>
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNum}>
                        {counselorData?.patients || "0"}
                      </Text>
                      <Text style={styles.profileStatLabel}>Patients</Text>
                    </View>
                    <View style={styles.profileStatDivider} />
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNum}>
                        {counselorData?.languages?.length || "0"}
                      </Text>
                      <Text style={styles.profileStatLabel}>Languages</Text>
                    </View>
                    <View style={styles.profileStatDivider} />
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNum}>
                        {counselorData?.specializations?.length || "0"}
                      </Text>
                      <Text style={styles.profileStatLabel}>Specialties</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Nav items */}
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
                      size={24}
                      color={activeTab === item.id ? "#FFFFFF" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.mobileNavLabel,
                        activeTab === item.id && styles.mobileNavLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge > 0 && (
                      <View style={styles.mobileNavBadge}>
                        <Text style={styles.mobileNavBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={18} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Divider + Sign Out inline with nav */}
              <View style={styles.mobileNavDivider} />
              <View style={{ paddingHorizontal: 14, paddingBottom: 24 }}>
                <TouchableOpacity
                  style={[styles.mobileNavItem, styles.mobileNavItemLogout]}
                  onPress={() => {
                    setShowMobileMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Feather name="log-out" size={24} color="#e53935" />
                  <Text style={[styles.mobileNavLabel, styles.mobileNavLabelLogout]}>
                    Sign Out
                  </Text>
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
                  color={activeTab === item.id ? "#2563EB" : "#9CA3AF"}
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
            { flexDirection: 'column' },
          ]}
        >
          {/* Profile incomplete banner */}
          {counselorData && !counselorData.profileCompleted && (
            <TouchableOpacity
              style={profileBanner.wrap}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.85}
            >
              <View style={profileBanner.left}>
                <View style={profileBanner.iconWrap}>
                  <Icon name="exclamation-triangle" size={16} color="#92400e" />
                </View>
                <View style={profileBanner.textWrap}>
                  <Text style={profileBanner.title}>Complete your profile to appear in the directory</Text>
                  {counselorData.missingFields && counselorData.missingFields.length > 0 && (
                    <Text style={profileBanner.missing}>
                      Missing: {counselorData.missingFields.join(' · ')}
                    </Text>
                  )}
                </View>
              </View>
              <View style={profileBanner.btn}>
                <Text style={profileBanner.btnText}>Complete Now</Text>
              </View>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            {renderTabContent()}
          </View>
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
  // Cancel out the parent's horizontal padding so cards reach the screen edges.
  // The ScrollView uses this on `style` (not contentContainerStyle) so the
  // negative margin doesn't get pinched off by overflow:hidden on the content.
  scrollOuter: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 100,
  },
  // Wraps the hero, section title and filter chips so they keep their normal
  // horizontal breathing room. The card list below stays edge-to-edge.
  insetSection: {
    paddingHorizontal: 14,
  },

  // ─── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroBlob1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -60,
    right: -40,
  },
  heroBlob2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
    bottom: -30,
    left: -20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  heroRefreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 8,
  },
  heroSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSummaryNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSummaryLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // ─── Section title ────────────────────────────────────────────────────────
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  sectionCount: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // ─── Filter chips ─────────────────────────────────────────────────────────
  filterScroll: {
    marginBottom: 14,
  },
  filterRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipActive: {
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  filterChipBadge: {
    backgroundColor: '#F0F9FF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 6,
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  filterChipBadgeTextActive: {
    color: '#ffffff',
  },

  // ─── List ─────────────────────────────────────────────────────────────────
  listContainer: {
    gap: 12,
    marginTop: 2,
  },

  // ─── Card (minimal, flat, soft shadow) ────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
  },
  cardSideAccent: {
    width: 3,
    backgroundColor: '#e5e7eb',
  },
  // Kept for the skeleton card (uses cardAccent as a top bar)
  cardAccent: {
    height: 4,
    width: '100%',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // ─── Avatar with gradient ring ────────────────────────────────────────────
  avatarRingOuter: {
    width: 54,
    height: 54,
    position: 'relative',
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.2,
  },
  todayDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  // ─── Patient info ────────────────────────────────────────────────────────
  patientInfo: {
    flex: 1,
    gap: 4,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
  },
  consultTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  consultTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    letterSpacing: 0.2,
  },

  // ─── Status badge ────────────────────────────────────────────────────────
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // ─── Date/time block (minimal — no background, just a top divider) ───────
  dateTimeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dateTimeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTimePrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: 0.1,
  },
  dateTimeSecondary: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },

  // ─── Notes ───────────────────────────────────────────────────────────────
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#E0F2FE',
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#526071',
    lineHeight: 17,
  },

  // ─── Action buttons ──────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    paddingTop: 2,
  },
  rejectActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 0.3,
  },
  acceptActionBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  acceptBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // ─── Video call button ───────────────────────────────────────────────────
  videoCallBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  videoCallBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  videoCallBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // ─── Canceled note ───────────────────────────────────────────────────────
  canceledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingBottom: 12,
  },
  canceledNoteText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // ─── Empty state ─────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 12,
  },
  emptyIconWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 20,
  },
  emptyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#99f6e4',
    marginTop: 4,
  },
  emptyRefreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  // ─── Skeleton ────────────────────────────────────────────────────────────
  skelAccentColor: {
    backgroundColor: '#e0e7ff',
  },
  skelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
  },
  skelPill: {
    width: 72,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  skelBody: {
    gap: 10,
    marginBottom: 14,
  },
  skelLineLg: {
    width: '62%',
    height: 13,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  skelLineSm: {
    width: '44%',
    height: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  skelLineFull: {
    width: '100%',
    height: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  skelLineMed: {
    width: '70%',
    height: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  skelActions: {
    flexDirection: 'row',
    gap: 10,
  },
  skelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
});

// â”€â”€â”€ Main Styles (unchanged from original) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const profileBanner = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 12, fontWeight: '700', color: '#1E3A8A', lineHeight: 17 },
  missing: { fontSize: 11, color: '#2563EB', marginTop: 2 },
  btn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },

  // ─── Sidebar ─────────────────────────────────────────────────────────────
  sidebar: {
    width: 260,
    backgroundColor: "#FFFFFF",
    flexDirection: "column",
    position: "absolute",
    left: 0,
    top: 0,
    marginTop: 22,
    bottom: 0,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },

  // Brand strip
  sidebarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sidebarBrandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarBrandLogoImg: {
    width: 24,
    height: 24,
  },
  sidebarBrandText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    flex: 1,
    letterSpacing: 0.3,
  },
  sidebarBrandPill: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  sidebarBrandPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Profile section
  sidebarHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    alignItems: "center",
  },
  profileContainer: {
    alignItems: "center",
    position: "relative",
    width: "100%",
  },
  // Outer ring — bigger, blue glow
  avatarOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#2563EB",
    padding: 3,
    marginBottom: 12,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  // Real photo
  profileAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
  },
  // Gradient initials fallback
  profileAvatarGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarInitial: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  // Online dot — repositioned for bigger avatar
  onlineDot: {
    position: "absolute",
    top: 72,
    right: 76,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
  profileName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
    textAlign: "center",
    letterSpacing: 0.1,
    paddingHorizontal: 8,
  },
  profileSpecialization: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "500",
    paddingHorizontal: 8,
  },
  // Rating + experience row
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  expBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  expText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6366F1",
  },
  // Online status pill
  onlineStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 12,
  },
  onlineStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  onlineStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
  },
  // Quick stats strip
  profileStatsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileStatItem: {
    flex: 1,
    alignItems: "center",
  },
  profileStatNum: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  profileStatLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 1,
  },
  profileStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E7EB",
  },

  // ─── Sidebar Nav ─────────────────────────────────────────────────────────
  sidebarNav: {
    paddingHorizontal: 10,
    paddingTop: 12,
    gap: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 12,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    flex: 1,
  },
  navLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  navLabelLogout: {
    color: "#F87171",
    fontWeight: "600",
  },
  sidebarFooter: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  mobileNavDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  navItemLogout: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  navBadge: {
    position: "absolute",
    right: 10,
    backgroundColor: "#EF4444",
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // ─── Mobile Header ────────────────────────────────────────────────────────
  mobileHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 998,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  mobileHeaderBar: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuToggleClose: {
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
  },
  mobileTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  mobileTitleBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileTitleLogoImg: {
    width: 18,
    height: 18,
  },
  mobileTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.1,
  },
  mobileTitleRolePill: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  mobileTitleRoleText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  mobileLogoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  // ─── Mobile Menu Overlay ──────────────────────────────────────────────────
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
    width: 290,
    backgroundColor: "#FFFFFF",
    flexDirection: "column",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  mobileNav: {
    paddingHorizontal: 10,
    paddingTop: 12,
    gap: 2,
  },
  mobileNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 14,
  },
  mobileNavItemActive: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mobileNavLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    flex: 1,
  },
  mobileNavLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  mobileNavLabelLogout: {
    color: "#F87171",
    fontWeight: "600",
  },
  mobileNavItemLogout: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  mobileNavBadge: {
    backgroundColor: "#EF4444",
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginRight: 4,
  },
  mobileNavBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // ─── Mobile Bottom Nav ────────────────────────────────────────────────────
  // Pure white bottom nav — clean like most modern mobile apps
  mobileBottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    zIndex: 996,
    height: Platform.OS === "ios" ? 84 : 66,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 3,
    overflow: "hidden",
    borderRadius: 10,
    marginHorizontal: 2,
    paddingVertical: 4,
  },
  bottomNavItemActive: {
    backgroundColor: "#EFF6FF",
  },
  bottomNavLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9CA3AF",
    textAlign: "center",
  },
  bottomNavLabelActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  bottomNavBadge: {
    position: "absolute",
    top: 2,
    right: "18%",
    backgroundColor: "#EF4444",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bottomNavBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },

  // ─── Main Content ─────────────────────────────────────────────────────────
  mainContent: {
    flex: 1,
    marginLeft: 280,
    backgroundColor: "#F8FAFC",
  },
  mainContentMobile: {
    marginLeft: 0,
    marginTop: 0,
    marginBottom: Platform.OS === "ios" ? 84 : 68,
    paddingHorizontal: 0,
  },
  comingSoon: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 48,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F9FF",
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  earningsScroll: {
    flex: 1,
    width: "100%",
    backgroundColor: "#F8FAFC",
  },
  earningsScrollContent: {
    paddingBottom: 32,
  },
  earnSkTitle: {
    width: 140,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
  },
  earnSkSubtitle: {
    width: 200,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#edf1f5",
    marginTop: 8,
  },
  earnSkPill: {
    width: 90,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  earnSkHero: {
    width: "100%",
    height: 220,
    borderRadius: 24,
    backgroundColor: "#dbe1ea",
  },
  earnSkMini: {
    flex: 1,
    height: 86,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  earnSkCard: {
    flex: 1,
    height: 110,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  earnSkList: {
    width: "100%",
    height: 260,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  earningsSection: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  earningsSectionHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  earningsSectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  earningsSectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  earningsSectionSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  earningsPeriodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  earningsPeriodPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  earningsHeroCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  earningsWithdrawBtn: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  earningsWithdrawBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.2,
  },
  earningsHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  earningsHeroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  earningsHeroTrendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  earningsHeroTrendText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  earningsHeroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.82)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  earningsHeroAmount: {
    fontSize: 40,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 8,
    letterSpacing: -0.6,
  },
  earningsHeroCaption: {
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    marginTop: 8,
  },
  earningsHeroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginVertical: 18,
  },
  earningsHeroBottomRow: {
    flexDirection: "row",
    gap: 12,
  },
  earningsHeroMetaItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 14,
  },
  earningsHeroMetaLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.76)",
    marginBottom: 6,
  },
  earningsHeroMetaValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  earningsMiniGrid: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  earningsMiniCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  earningsMiniIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  earningsMiniLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  earningsMiniValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  earningsCardRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  earningsCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  earningsCardPending: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  earningsCardTitle: {
    fontSize: 13,
    fontFamily: "Manrope",
    color: "#475569",
    marginBottom: 8,
    fontWeight: "600",
  },
  earningsAmount: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Manrope",
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  earningsBadge: {
    fontSize: 12,
    fontFamily: "Manrope",
    color: "#16a34a",
    fontWeight: "600",
  },
  earningsBadgeWarning: {
    color: "#f97316",
  },
  earningsBreakdownCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  earningsBreakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 8,
  },
  earningsBreakdownTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  earningsBreakdownLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  earningsTxnRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  earningsTxnRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  earningsTxnIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  earningsTxnBody: {
    flex: 1,
    minWidth: 0,
  },
  earningsTxnName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  earningsTxnMeta: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  earningsTxnAmount: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  // ─── Chat Request Modal ──────────────────────────────────────────────────
  requestModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
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
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 14,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  requestModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#2563EB",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  requestModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.1,
  },
  requestTimer: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    fontWeight: "500",
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
    fontWeight: "700",
    color: "#0f172a",
  },
  requestTypeBadge: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  requestTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563EB",
  },
  requestMessage: {
    backgroundColor: "#f8fffe",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F9FF",
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
  },
  requestMessageText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
  requestTime: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "right",
    fontWeight: "500",
  },
  requestModalFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
    paddingTop: 16,
  },
  requestBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  requestReject: {
    backgroundColor: "#fff1f2",
    borderWidth: 1.5,
    borderColor: "#fecaca",
  },
  requestAccept: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  requestBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
  requestAcceptText: {
    color: "#ffffff",
  },
  requestProgress: {
    height: 4,
    backgroundColor: "#F0F9FF",
  },
  requestProgressBar: {
    height: "100%",
    backgroundColor: "#2563EB",
  },

  // ─── Logout Modal ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#1E40AF",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  mobileTitle: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  mobileHeaderLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  logoutModal: {
    padding: 28,
    alignItems: "center",
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  logoutText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  // ─── Glass incoming-call popup (rich animations) ──────────────────────────
  callBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  callBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 20, 32, 0.45)",
  },
  glassCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 20,
  },
  glassCardGradient: {
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 28,
    alignItems: "center",
  },
  callTopRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 18,
  },
  callTopPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  callTopPillText: {
    color: "#ecfeff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  avatarWrap: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  waveRing: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },
  avatarGradient: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 55,
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  callerName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  ringingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 26,
  },
  ringingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#86efac",
  },
  ringingText: {
    color: "rgba(236, 254, 255, 0.85)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  actionCol: {
    alignItems: "center",
    gap: 10,
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabReject: {
    backgroundColor: "#ef4444",
  },
  fabAccept: {
    // gradient applied inline
  },
  actionLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
