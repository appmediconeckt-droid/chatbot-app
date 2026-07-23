import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLanguageRender } from '../../../../../hooks/useLanguageRender';
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
import DateTimePicker from '@react-native-community/datetimepicker';

// Icons
import Icon from "react-native-vector-icons/FontAwesome6";
import Feather from "react-native-vector-icons/Feather";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { BlurView } from "@react-native-community/blur";

// Custom Hooks
import useVibration from "../../../../../hooks/useVibration";
import { forceStopRingtone, startIncomingRingtone } from "../../../../../hooks/useRingtone";
import Dashboard from "../Tab/CounselorDashboard/Dashboardcou";
import Messagesou from "../Tab/Messages/Messagesou";
import PatientRequests from "../Tab/PatientRequests/PatientRequests";
import CounselorProfile from "../Tab/Profile-Con/CounselorProfile";
import CounselorSettings from "../Tab/Settings/CounselorSettings";
import CounselorNotifications from "../Tab/Notifications/CounselorNotifications";
import CounselorWallet from "../Tab/Wallet/CounselorWallet";
import VideoCallModal from "../../UserDashboard/Tab/CallModal/VideoCallModal";
import VoiceCallModal from "../../UserDashboard/Tab/CallModal/VoiceCallModal";
import safeVibrate from "../../../../../utils/safeVibrate";
import { useToast } from "../../../../../components/common/ToastProvider";
import LanguageSelector from '../../../../../components/common/LanguageSelector';
import CounselorGradientButton from '../../../../../components/common/CounselorGradientButton';
import { loadUserLanguage } from '../../../../../i18n';

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
  const { t } = useLanguageRender();
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
                  {isVideo ? t('call:incomingVideoCall') : t('call:incomingVoiceCall')}
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
                  {isRejecting ? t('common:loading') : t('call:reject')}
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
                  {isAccepting ? t('call:connecting') : t('call:accept')}
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
const AppointmentCard = ({ apt, onAccept, onReject, onVideoCall, onVoiceCall, onChat, updating, index = 0 }) => {
  const { t } = useLanguageRender();
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

  // Meta line: age • gender • Consultation (only shows the parts we actually have)
  const patientAge = apt.patient?.age || apt.age;
  const patientGender = apt.patient?.gender || apt.gender;
  const metaParts = [
    patientAge ? String(patientAge) : null,
    patientGender || null,
    t('Consultation'),
  ].filter(Boolean);

  const requestedDate = apt.date
    ? new Date(apt.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "—";
  const requestedTime = apt.date
    ? new Date(apt.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
  const isToday = apt.date ? isSameDay(apt.date, new Date()) : false;

  // Status palette — Figma uses a blue CONFIRMED pill, amber PENDING, red CANCELED.
  const statusColor = isPending ? "#b45309" : isConfirmed ? "#2563EB" : "#b91c1c";
  const statusBg = isPending ? "#fef7e6" : isConfirmed ? "#EFF4FF" : "#fef2f2";
  const statusLabel = isPending ? t('common:pending') : isConfirmed ? t('common:confirmed') : t('common:canceled');
  const statusDot = isPending ? "#f59e0b" : isConfirmed ? "#2563EB" : "#ef4444";

  // Patient photo (string URL or Cloudinary-style object) → solid-letter avatar fallback.
  const rawPatientPhoto =
    apt.patient?.Image || apt.patient?.image || apt.patient?.profilePhoto || apt.patient?.avatar;
  const patientPhoto = rawPatientPhoto
    ? String(typeof rawPatientPhoto === 'string' ? rawPatientPhoto : rawPatientPhoto.secure_url || rawPatientPhoto.url || '')
    : '';
  const firstLetter = (patientName || '?').trim().charAt(0).toUpperCase();
  // Deterministic avatar colour per patient (matches the Figma's solid circles).
  const AVATAR_BGS = ['#B91C1C', '#2563EB', '#7C3AED', '#0D9488', '#D97706', '#DB2777', '#4F46E5'];
  const avatarBg = AVATAR_BGS[
    Math.abs(
      String(patientName).split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)
    ) % AVATAR_BGS.length
  ];

  return (
    <Animated.View style={[aptStyles.card, { opacity: entry, transform: [{ translateY }] }]}>
      <View style={aptStyles.cardBody}>
        {/* Header row: avatar + name/meta + status badge */}
        <View style={aptStyles.cardHeader}>
          <View style={aptStyles.avatarRingOuter}>
            {patientPhoto ? (
              <Image source={{ uri: patientPhoto }} style={aptStyles.avatarPhoto} />
            ) : (
              <View style={[aptStyles.avatarSolid, { backgroundColor: avatarBg }]}>
                <Text style={aptStyles.avatarLetter}>{firstLetter}</Text>
              </View>
            )}
            {isToday && <View style={aptStyles.todayDot} />}
          </View>

          <View style={aptStyles.patientInfo}>
            <Text style={aptStyles.patientName} numberOfLines={1}>{patientName}</Text>
            <Text style={aptStyles.patientMeta} numberOfLines={1}>{metaParts.join(' • ')}</Text>
          </View>

          <View style={[aptStyles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[aptStyles.statusBadgeDot, { backgroundColor: statusColor }]} />
            <Text style={[aptStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Details panel: date, duration, notes on a light rounded background */}
        <View style={aptStyles.detailsPanel}>
          <View style={aptStyles.infoRow}>
            <Ionicons name="calendar-outline" size={15} color="#64748b" />
            <Text style={aptStyles.infoRowText}>{t(requestedDate)}</Text>
            {requestedTime !== "—" && (
              <Text style={aptStyles.infoRowTime}>{requestedTime}</Text>
            )}
          </View>

          <View style={aptStyles.infoRow}>
            <Ionicons name="time-outline" size={15} color="#64748b" />
            <Text style={aptStyles.infoRowText}>45 {t('Mins Duration')}</Text>
          </View>

          {apt.notes && apt.notes.trim() !== "" && (
            <View style={aptStyles.notesBox}>
              <Ionicons name="document-text-outline" size={14} color="#64748b" />
              <Text style={aptStyles.notesText} numberOfLines={3}>{apt.notes}</Text>
            </View>
          )}
        </View>

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
                  <Text style={aptStyles.rejectBtnText}>{t('counselor:decline')}</Text>
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
                colors={["#003A9B", "#1490FF"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={aptStyles.acceptBtnGradient}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={aptStyles.acceptBtnText}>{t('counselor:acceptRequest')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {isConfirmed && (
          <View style={aptStyles.confirmedActions}>
            <TouchableOpacity
              style={[aptStyles.confirmedActionBtn, aptStyles.confirmedVideoBtn]}
              onPress={() => onVideoCall?.(apt)}
              activeOpacity={0.85}
            >
              <Ionicons name="videocam" size={15} color="#fff" />
              <Text style={aptStyles.confirmedActionText} numberOfLines={1}>
                {t('Video Session')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[aptStyles.confirmedActionBtn, aptStyles.confirmedVoiceBtn]}
              onPress={() => onVoiceCall?.(apt)}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={aptStyles.confirmedActionText} numberOfLines={1}>{t('Voice Call')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[aptStyles.confirmedActionBtn, aptStyles.confirmedChatBtn]}
              onPress={() => onChat?.(apt)}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-outline" size={14} color="#334155" />
              <Text style={[aptStyles.confirmedActionText, aptStyles.confirmedChatText]} numberOfLines={1}>{t('Chat')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCanceled && (
          <View style={aptStyles.canceledNote}>
            <Ionicons name="information-circle-outline" size={13} color="#94a3b8" />
            <Text style={aptStyles.canceledNoteText}>{t('counselor:appointmentCanceled')}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Session Card ────────────────────────────────────────────────────────────
// Mirrors the web SessionsTab card: confirmed appointment for the selected day
// with a Today/Upcoming/Past badge and video / voice / chat actions.
const SessionCard = ({ apt, onVideoCall, onVoiceCall, onChat, index = 0 }) => {
  const { t } = useLanguageRender();

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

  // Patient photo → solid initials circle fallback.
  const rawPhoto = apt.patient?.Image || apt.patient?.image || apt.patient?.profilePhoto || apt.patient?.avatar;
  const photoUri = rawPhoto
    ? String(typeof rawPhoto === 'string' ? rawPhoto : rawPhoto.secure_url || rawPhoto.url || '')
    : '';

  // 30-minute slot → "10:30 AM - 11:00 AM"
  const start = apt.date ? new Date(apt.date) : null;
  const end = start ? new Date(start.getTime() + 30 * 60000) : null;
  const fmt = (d) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
  const timeRange = start ? `${fmt(start)} - ${fmt(end)}` : '—';

  // Live now → show IN PROGRESS + the "conduct Session" action.
  const now = Date.now();
  const inProgress = !!(start && end && now >= start.getTime() && now <= end.getTime());

  const sessionType = apt.sessionType || apt.type || t('counselor:consultation', 'General Consultation');

  return (
    <Animated.View style={[sessStyles.card, { opacity: entry, transform: [{ translateY }] }]}>
      {/* Time row + live status */}
      <View style={sessStyles.timeRow}>
        <Ionicons name="time-outline" size={16} color="#64748b" />
        <Text style={sessStyles.timeText}>{timeRange}</Text>
        {inProgress && (
          <View style={sessStyles.liveBadge}>
            <Text style={sessStyles.liveBadgeText}>{t('counselor:inProgress', 'IN PROGRESS')}</Text>
          </View>
        )}
      </View>

      {/* Patient */}
      <View style={sessStyles.patientRow}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={sessStyles.avatarPhoto} />
        ) : (
          <View style={sessStyles.avatarSolid}>
            <Text style={sessStyles.avatarInitialsText}>{initials || '?'}</Text>
          </View>
        )}
        <View style={sessStyles.patientInfo}>
          <Text style={sessStyles.patientName} numberOfLines={1}>{patientName}</Text>
          <Text style={sessStyles.patientType} numberOfLines={1}>{sessionType}</Text>
        </View>
      </View>

      {/* Primary action */}
      {inProgress ? (
        <TouchableOpacity
          style={sessStyles.conductBtn}
          onPress={() => onVideoCall(apt)}
          activeOpacity={0.9}
        >
          <Ionicons name="videocam" size={17} color="#fff" />
          <Text style={sessStyles.conductBtnText}>{t('counselor:conductSession', 'conduct Sessions')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={sessStyles.viewBtn}
          onPress={() => onChat(apt)}
          activeOpacity={0.85}
        >
          <Text style={sessStyles.viewBtnText}>{t('counselor:viewDetails', 'View Details')}</Text>
        </TouchableOpacity>
      )}
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
  const { t } = useLanguageRender();
  const insets = useSafeAreaInsets();
  const MOBILE_HEADER_BAR_HEIGHT = 68;
  const topInset = Platform.OS === "ios" ? insets.top : 0;
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState("messages");
  const [isMobile, setIsMobile] = useState(SCREEN_WIDTH <= 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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
  const [aptFilter, setAptFilter] = useState("all"); // "all" | "today" | "upcoming"
  const [aptSearch, setAptSearch] = useState("");

  // â”€â”€ Sessions state (today's confirmed appointments — mirrors web SessionsTab) â”€
  const [sessionSelectedDate, setSessionSelectedDate] = useState(new Date());
  const [showSessionDatePicker, setShowSessionDatePicker] = useState(false);

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

  // Fetch when tab becomes active (sessions reuses the same appointments data)
  useEffect(() => {
    if (activeTab === "appointments" || activeTab === "sessions") fetchAppointments();
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
  const handleInitiateVideoCallFromApt = async (apt, callType = "video") => {
    const isVoice = callType === "audio";
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
        callType: isVoice ? "audio" : "video",
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
          callType: isVoice ? "voice" : "video",
          type: isVoice ? "voice" : "video",
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
            callType: isVoice ? 'audio' : 'video',
            counsellorId: storedCounsellorId,
            userId: userId,
            counsellorName: counselorData?.fullName || "Counselor"
          });
        }
        
        setSelectedCall(callData);
        if (isVoice) setIsVoiceModalOpen(true);
        else setIsVideoModalOpen(true);
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

  // ── Open Chat from a Session (mirrors web handleOpenAppointmentChat) ───────
  const getAppointmentPatientId = (apt) => {
    const p = apt.patient || apt.user || {};
    return normalizeObjectId(
      p._id || p.id || p.userId || apt.userId || apt.user?._id || apt.user?.id || apt.patientId
    );
  };

  // Find the chat between this counsellor and the appointment's patient.
  // Checks (in order): a chat ref on the appointment → accepted/active chats →
  // pending chat requests (patient asked but counsellor hasn't accepted yet).
  // IDs are normalized to the bare ObjectId so anonymized/object forms still match.
  const findAppointmentChat = async (apt, patientId) => {
    const directChatId =
      apt.chatId || apt.conversationId || apt.chat?.chatId || apt.chat?._id || apt.chat?.id;
    if (directChatId) return { chatId: directChatId, chat: apt.chat || null };

    const target = normalizeObjectId(patientId);
    const idMatches = (...vals) =>
      vals.some((v) => v && normalizeObjectId(v) === target);

    // 1. Accepted / active chats (these appear in the Messages list).
    try {
      const res = await axios.get(`${API_BASE_URL}/api/chat/chats`);
      const chats = Array.isArray(res.data?.chats) ? res.data.chats : [];
      const matched = chats.find((chat) => {
        const other = chat.otherParty || chat.user || chat.patient || {};
        return idMatches(chat.userId, chat.receiverId, other._id, other.id, other.userId);
      });
      if (matched) {
        return { chatId: matched.chatId || matched.id || matched._id, chat: matched };
      }
    } catch (err) {
      console.warn("Appointment chat lookup (chats) failed:", err?.message);
    }

    // 2. Pending chat requests — the patient started a chat that isn't accepted
    //    yet, so it isn't in /chats. Opening it lets the counsellor respond.
    try {
      const res = await axios.get(`${API_BASE_URL}/api/chat/pending-requests`);
      const requests = Array.isArray(res.data?.requests) ? res.data.requests : [];
      const matched = requests.find((r) => {
        const u = r.user || {};
        return idMatches(u.id, u._id, u.userId, r.userId);
      });
      if (matched) {
        return { chatId: matched.chatId || matched.id || matched._id, chat: matched };
      }
    } catch (err) {
      console.warn("Appointment chat lookup (pending) failed:", err?.message);
    }

    return { chatId: null, chat: null };
  };

  const handleOpenAppointmentChat = async (apt) => {
    const patientId = getAppointmentPatientId(apt);
    if (!patientId) {
      showToast("Missing patient information.", "error");
      return;
    }

    const { chatId, chat } = await findAppointmentChat(apt, patientId);
    if (!chatId) {
      showToast("Chat is not available for this appointment yet.", "info");
      return;
    }

    const other = chat?.otherParty || {};
    const patientInfo = apt.patient || apt.user || {};
    const name =
      other.anonymous || patientInfo.anonymous || patientInfo.fullName || other.name || "Anonymous User";

    // Shape matches what SMSList passes so SMSInput hydrates the same way.
    const selectedUser = {
      id: chatId,
      _id: patientId,
      userId: patientId,
      receiverId: patientId,
      chatId,
      name,
      anonymous: name,
      gender: other.gender || patientInfo.gender,
      avatar: other.avatar,
      avatarUrl: other.avatarUrl || other.profilePhoto?.url || null,
      status: chat?.status || "accepted",
      online: other.isOnline || other.online || false,
      isOnline: other.isOnline || other.online || false,
      lastSeen: other.lastSeen || null,
      appointmentId: apt._id,
    };

    navigation.navigate("SMSInput", { selectedUser, chatId, chatData: selectedUser });
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
      // Surface the backend's actual error so we can see WHY it 500s.
      console.error("Error fetching pending requests:", {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
        url: `${API_BASE_URL}/api/chat/pending-requests`,
      });
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

  // Reload counselor's language whenever this dashboard gains focus
  useEffect(() => {
    if (isFocused && counsellorId) loadUserLanguage(counsellorId, 'counsellor');
  }, [isFocused, counsellorId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingRequests();
    await fetchWaitingCalls();
    if (activeTab === "appointments" || activeTab === "sessions") await fetchAppointments();
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
      label: t('counselor:messages'),
      badge: pendingRequests.length,
    },
    {
      id: "appointments",
      icon: "calendar-alt",
      label: t('counselor:appointment'),
      badge: appointments.filter((a) => a.status === "pending").length,
    },
    { id: "sessions", icon: "video", label: t('counselor:sessions'), badge: 0 },
    // { id: "patients", icon: "users", label: "Patients", badge: 0 },
    { id: "earnings", icon: "money-bill-wave", label: t('counselor:earnings'), badge: 0 },
    { id: "settings", icon: "sliders", label: t('settings:settings'), badge: 0 },
    { id: "profile", icon: "chart-pie", label: t('counselor:profile'), badge: 0 },
  ];

  const handleTabChange = (tabId) => {
    vibrate(80);
    setActiveTab(tabId);
    setShowMobileMenu(false);
  };

  // ── Global greeting header data (used by the single mobile header) ──
  // profilePhoto may be a string URL or a Cloudinary-style object.
  const counselorPhotoUri = (() => {
    const raw = counselorData?.profilePhoto;
    if (!raw) return null;
    const uri = typeof raw === 'string' ? raw : raw.secure_url || raw.url;
    return uri ? String(uri) : null;
  })();

  const greetingTitle = (() => {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    // First name only — surname is dropped (e.g. "Vivek Singh" → "Dr. Vivek").
    const firstNameOnly =
      (counselorData?.name || 'Counselor')
        .replace(/^Dr\.?\s*/i, '')
        .trim()
        .split(/\s+/)[0] || 'Counselor';
    return `${g}, Dr. ${firstNameOnly}`;
  })();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // â”€â”€ Appointments Tab Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAppointmentsTab = () => {
    const now = new Date();
    const isUpcoming = (a) => new Date(a.date) > now;
    const isPast = (a) => {
      const appointmentDate = new Date(a.date);
      return !Number.isNaN(appointmentDate.getTime()) && appointmentDate < now;
    };

    // Filter by tab: All Request / Today / Upcoming, then by search text.
    const byTab =
      aptFilter === "today"
        ? appointments.filter((a) => isSameDay(a.date, now))
        : aptFilter === "upcoming"
        ? appointments.filter((a) => isUpcoming(a))
        : aptFilter === "past"
        ? appointments.filter((a) => isPast(a))
        : appointments;

    const q = aptSearch.trim().toLowerCase();
    const filteredApts = q
      ? byTab.filter((a) =>
          String(a.patient?.anonymous || a.patient?.fullName || "").toLowerCase().includes(q)
        )
      : byTab;

    const countFor = (key) =>
      key === "today"
        ? appointments.filter((a) => isSameDay(a.date, now)).length
        : key === "upcoming"
        ? appointments.filter((a) => isUpcoming(a)).length
        : key === "past"
        ? appointments.filter((a) => isPast(a)).length
        : appointments.length;

    const filterTabs = [
      { key: 'all', label: t('counselor:allRequest', 'All Request'), icon: 'apps-outline' },
      { key: 'today', label: t('counselor:today', 'Today'), icon: 'today-outline' },
      { key: 'upcoming', label: t('counselor:upcoming', 'Upcoming'), icon: 'calendar-outline' },
      { key: 'past', label: t('counselor:past', 'Past'), icon: 'time-outline' },
    ];

    // Stats
    const pendingCount = appointments.filter((a) => a.status === "pending").length;
    const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
    const todayCount = appointments.filter((a) => isSameDay(a.date, now)).length;

    // Greeting
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    const firstName = (
      (counselorData?.name || "").replace(/^Dr\.?\s*/i, "").split(" ")[0] ||
      counselorData?.name ||
      "Counselor"
    ).toUpperCase();
    const counselorPhoto = counselorData?.profilePhoto || null;
    const counselorInitial = (counselorData?.name || "C").charAt(0).toUpperCase();
    const shortHeaderName = (counselorData?.name || "Counselor").replace(/^Dr\.?\s*/i, "").slice(0, 8);

    return (
      <ScrollView
        style={aptStyles.scrollOuter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={aptStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingAppointments && appointments.length > 0}
            onRefresh={fetchAppointments}
            colors={["#003A9B", "#1490FF"]}
            tintColor="#2563EB"
          />
        }
      >
        {/* Inset section: hero, search, filters keep horizontal breathing room. */}
        <View style={aptStyles.insetSection}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#003A9B", "#1490FF"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={aptStyles.hero}
        >
          {/* Decorative blurred blobs */}
          <View style={aptStyles.heroBlob1} />
          <View style={aptStyles.heroBlob2} />

          <View style={aptStyles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={aptStyles.heroGreeting}>{greeting},</Text>
              <Text style={aptStyles.heroName} numberOfLines={1}>{firstName}</Text>
              <Text style={aptStyles.heroSubtitle}>
                {appointments.length} {t('counselor:totalAppointments', 'total appointment(s)')}
              </Text>
            </View>
            <TouchableOpacity
              style={aptStyles.heroRefreshBtn}
              onPress={() => fetchAppointments()}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Stats inner card */}
          <View style={aptStyles.heroSummaryBar}>
            <View style={aptStyles.heroSummaryItem}>
              <Text style={aptStyles.heroSummaryNum}>{pendingCount}</Text>
              <Text style={aptStyles.heroSummaryLabel}>{t('common:pending', 'PENDING')}</Text>
            </View>
            <View style={aptStyles.heroSummaryDivider} />
            <View style={aptStyles.heroSummaryItem}>
              <Text style={aptStyles.heroSummaryNum}>{confirmedCount}</Text>
              <Text style={aptStyles.heroSummaryLabel}>{t('common:confirmed', 'CONFIRMED')}</Text>
            </View>
            <View style={aptStyles.heroSummaryDivider} />
            <View style={aptStyles.heroSummaryItem}>
              <Text style={aptStyles.heroSummaryNum}>{todayCount}</Text>
              <Text style={aptStyles.heroSummaryLabel}>{t('counselor:today', 'TODAY')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <View style={aptStyles.searchBox}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={aptStyles.searchInput}
            placeholder={t('counselor:searchPatients', 'Search patients...')}
            placeholderTextColor="#94a3b8"
            value={aptSearch}
            onChangeText={setAptSearch}
          />
          {aptSearch.length > 0 && (
            <TouchableOpacity onPress={() => setAptSearch("")} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter chips ────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          contentContainerStyle={aptStyles.filterRow}
          style={aptStyles.filterScroller}
        >
          {filterTabs.map((ft) => {
            const isActive = aptFilter === ft.key;
            const count = countFor(ft.key);
            return (
              <TouchableOpacity
                key={ft.key}
                style={[aptStyles.filterChip, isActive && aptStyles.filterChipActive]}
                onPress={() => setAptFilter(ft.key)}
                activeOpacity={0.85}
              >
                {isActive && (
                  <Ionicons name={ft.icon} size={14} color="#ffffff" style={{ marginRight: 6 }} />
                )}
                <Text style={[aptStyles.filterChipText, isActive && aptStyles.filterChipTextActive]}>
                  {ft.label}
                </Text>
                {isActive && count > 0 && (
                  <View style={aptStyles.filterChipBadge}>
                    <Text style={aptStyles.filterChipBadgeText}>{String(count).padStart(2, '0')}</Text>
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
            <Text style={aptStyles.emptyTitle}>{t('No appointments found')}</Text>
            <Text style={aptStyles.emptyText}>
              {aptFilter === "pending"
                ? t("No pending appointment requests right now. New requests will appear here.")
                : aptFilter === "confirmed"
                ? t("No confirmed appointments yet. Accepted requests will show up here.")
                : aptFilter === "past"
                ? t("No past appointments found.")
                : aptFilter === "canceled"
                ? t("No canceled appointments.")
                : t("No appointments to show yet.")}
            </Text>
            <TouchableOpacity
              style={aptStyles.emptyRefreshBtn}
              onPress={() => fetchAppointments()}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={14} color="#2563EB" />
              <Text style={aptStyles.emptyRefreshText}>{t('Refresh')}</Text>
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
                onVideoCall={(a) => handleInitiateVideoCallFromApt(a, "video")}
                onVoiceCall={(a) => handleInitiateVideoCallFromApt(a, "audio")}
                onChat={handleOpenAppointmentChat}
                updating={updatingAppointmentId}
              />
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // â”€â”€ Sessions Tab Content (today's confirmed appointments) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderSessionsTab = () => {
    // Confirmed appointments that fall on the selected day (default: today).
    const sessions = appointments
      .filter((a) => a.status === "confirmed" && isSameDay(a.date, sessionSelectedDate))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const selectedDateLabel = sessionSelectedDate.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
    const isTodaySelected = isSameDay(sessionSelectedDate, new Date());

    return (
      <ScrollView
        style={aptStyles.scrollOuter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={aptStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingAppointments && appointments.length > 0}
            onRefresh={fetchAppointments}
            colors={["#003A9B", "#1490FF"]}
            tintColor="#2563EB"
          />
        }
      >
        <View style={sessStyles.headerWrap}>
          <View style={sessStyles.headerTopRow}>
            <Text style={sessStyles.headerTitle}>{t('counselor:sessions', 'Sessions')}</Text>
            <View style={sessStyles.headerCountPill}>
              <Text style={sessStyles.headerCountText}>
                {sessions.length} {t('counselor:confirmedSessions', 'Confirmed')}
              </Text>
            </View>
          </View>

          <Text style={sessStyles.headerShowing}>
            {t('counselor:showingFor', 'Showing for')}:{' '}
            <Text style={sessStyles.headerShowingDate}>{selectedDateLabel}</Text>
          </Text>

          <View style={sessStyles.filterRow}>
            <TouchableOpacity
              style={sessStyles.dateBtn}
              onPress={() => setShowSessionDatePicker(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={16} color="#2563EB" />
              <Text style={sessStyles.dateBtnText}>{selectedDateLabel}</Text>
            </TouchableOpacity>
            {!isTodaySelected && (
              <TouchableOpacity
                style={sessStyles.clearBtn}
                onPress={() => setSessionSelectedDate(new Date())}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={13} color="#64748b" />
                <Text style={sessStyles.clearBtnText}>{t('counselor:today', 'Today')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showSessionDatePicker && (
          <DateTimePicker
            value={sessionSelectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selected) => {
              setShowSessionDatePicker(Platform.OS === "ios");
              if (event.type !== "dismissed" && selected) setSessionSelectedDate(selected);
            }}
          />
        )}

        {loadingAppointments && appointments.length === 0 ? (
          <View style={aptStyles.listContainer}>
            {[0, 1, 2].map((i) => (
              <AppointmentSkeletonCard key={`sess_skel_${i}`} />
            ))}
          </View>
        ) : sessions.length === 0 ? (
          <View style={sessStyles.emptyWrap}>
            <View style={sessStyles.emptyIconCircle}>
              <Ionicons name="videocam-off-outline" size={46} color="#2563EB" />
            </View>

            <Text style={sessStyles.emptyTitle}>
              {isTodaySelected
                ? t('counselor:noSessionsToday', 'No sessions today')
                : t('counselor:noSessionsForDate', 'No sessions for this date')}
            </Text>
            <Text style={sessStyles.emptyText}>
              {t(
                'counselor:sessionsHint',
                'Your confirmed sessions for the selected day will appear here. Enjoy the downtime or check upcoming dates.'
              )}
            </Text>

            <CounselorGradientButton
              style={sessStyles.refreshBtn}
              onPress={() => fetchAppointments()}
              activeOpacity={0.9}
            >
              <Ionicons name="refresh" size={17} color="#ffffff" />
              <Text style={sessStyles.refreshBtnText}>
                {t('counselor:refreshSchedule', 'Refresh Schedule')}
              </Text>
            </CounselorGradientButton>

            <TouchableOpacity
              style={sessStyles.tomorrowBtn}
              onPress={() => {
                const tomorrow = new Date(sessionSelectedDate);
                tomorrow.setDate(tomorrow.getDate() + 1);
                setSessionSelectedDate(tomorrow);
              }}
              activeOpacity={0.85}
            >
              <Text style={sessStyles.tomorrowBtnText}>
                {t('counselor:viewTomorrow', 'View Tomorrow')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={aptStyles.listContainer}>
            {sessions.map((apt, idx) => (
              <SessionCard
                key={apt._id}
                apt={apt}
                index={idx}
                onVideoCall={(a) => handleInitiateVideoCallFromApt(a, "video")}
                onVoiceCall={(a) => handleInitiateVideoCallFromApt(a, "audio")}
                onChat={handleOpenAppointmentChat}
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
        return renderSessionsTab();
      case "patients":
        return <PatientRequests />;
      case "earnings": {
        return <CounselorWallet onClose={() => setActiveTab("dashboard")} />;
        /*
         * Legacy hard-coded earnings preview retained temporarily below for
         * merge compatibility. The live CounselorWallet screen above now owns
         * earnings, payout history and withdrawal requests.
         */
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
              <LinearGradient
                colors={['#003A9B', '#1490FF']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.earningsHeroCard}
              >
                <View style={styles.earningsHeroTopRow}>
                  <View style={styles.earningsHeroTitleRow}>
                    <View style={styles.earningsHeroIconWrap}>
                      <Icon name="wallet" size={16} color="#ffffff" />
                    </View>
                    <Text style={styles.earningsHeroLabel}>Total Earning</Text>
                  </View>
                  <View style={styles.earningsHeroTrendPill}>
                    <Icon name="arrow-trend-up" size={11} color="#22c55e" />
                    <Text style={styles.earningsHeroTrendText}>+12.5%</Text>
                  </View>
                </View>

                <Text style={styles.earningsHeroAmount}>₹24,500</Text>
                <Text style={styles.earningsHeroCaption}>
                  Across 45 completed sessions this month
                </Text>

                {/* Inner pending / withdrawable card */}
                <View style={styles.earningsHeroInner}>
                  <View style={styles.earningsHeroMetaItem}>
                    <Text style={styles.earningsHeroMetaLabel}>Pending</Text>
                    <Text style={styles.earningsHeroMetaValue}>₹8,750</Text>
                  </View>
                  <View style={styles.earningsHeroInnerDivider} />
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
                  <View style={[styles.earningsMiniIcon, { backgroundColor: '#dbeafe' }]}>
                    <Icon name="circle-check" size={14} color="#2563eb" />
                  </View>
                  <Text style={styles.earningsMiniLabel}>Last 30 Days</Text>
                  <Text style={styles.earningsMiniValue}>₹24,500</Text>
                </View>
                <View style={styles.earningsMiniCard}>
                  <View style={[styles.earningsMiniIcon, { backgroundColor: '#dbeafe' }]}>
                    <Icon name="circle-check" size={14} color="#2563eb" />
                  </View>
                  <Text style={styles.earningsMiniLabel}>Last 30 Days</Text>
                  <Text style={styles.earningsMiniValue}>₹24,500</Text>
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
        return (
          <Messagesou
            counselorData={counselorData}
            notifCount={pendingRequests.length}
            onBellPress={() => setShowNotifications(true)}
          />
        );
      case "profile":
        return <CounselorProfile />;
      case "settings":
        return (
          <CounselorSettings
            onNavigate={(tab) => setActiveTab(tab)}
            onLogout={() => setShowLogoutConfirm(true)}
            notifCount={pendingRequests.length}
            onBellPress={() => setShowNotifications(true)}
          />
        );
      default:
        return (
          <Messagesou
            counselorData={counselorData}
            notifCount={pendingRequests.length}
            onBellPress={() => setShowNotifications(true)}
          />
        );
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
                        colors={["#003A9B", "#1490FF"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
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
                        {counselorData.experience} {t('counselor:yrs')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Quick stats strip */}
                <View style={styles.profileStatsStrip}>
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatNum}>
                      {counselorData?.patients || "0"}
                    </Text>
                    <Text style={styles.profileStatLabel}>{t('counselor:patientsLabel')}</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatNum}>
                      {counselorData?.languages?.length || "0"}
                    </Text>
                    <Text style={styles.profileStatLabel}>{t('counselor:languagesLabel')}</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatNum}>
                      {counselorData?.specializations?.length || "0"}
                    </Text>
                    <Text style={styles.profileStatLabel}>{t('counselor:specialtiesLabel')}</Text>
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
                  {t('counselor:signOut')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mobile Header — ONE global greeting header shown on every tab */}
        {isMobile && (
          <View style={styles.mobileHeader}>
            <View style={[styles.greetingHeaderBar, { paddingTop: topInset + 10 }]}>
              {/* Avatar → opens the profile tab */}
              <TouchableOpacity
                style={styles.greetingLeft}
                activeOpacity={0.8}
                onPress={() => setActiveTab('profile')}
              >
                {counselorPhotoUri ? (
                  <Image source={{ uri: counselorPhotoUri }} style={styles.greetingAvatar} />
                ) : (
                  <View style={styles.greetingAvatarFallback}>
                    <Text style={styles.greetingAvatarText}>
                      {(counselorData?.name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.greetingWelcome}>
                    {t('counselor:welcomeBack', 'Welcome back,')}
                  </Text>
                  <Text style={styles.greetingName} numberOfLines={1}>
                    {greetingTitle}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Bell only — matches the Figma header exactly */}
              <TouchableOpacity
                style={styles.greetingBell}
                activeOpacity={0.7}
                onPress={() => setShowNotifications(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="notifications-outline" size={22} color="#1D4ED8" />
                {pendingRequests.length > 0 && (
                  <View style={styles.greetingBellBadge}>
                    <Text style={styles.greetingBellBadgeText}>
                      {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
                    </Text>
                  </View>
                )}
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
                          colors={["#003A9B", "#1490FF"]}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
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
                          {counselorData.experience} {t('counselor:yrs')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.profileStatsStrip}>
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNum}>
                        {counselorData?.patients || "0"}
                      </Text>
                      <Text style={styles.profileStatLabel}>{t('counselor:patientsLabel')}</Text>
                    </View>
                    <View style={styles.profileStatDivider} />
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNum}>
                        {counselorData?.languages?.length || "0"}
                      </Text>
                      <Text style={styles.profileStatLabel}>{t('counselor:languagesLabel')}</Text>
                    </View>
                    <View style={styles.profileStatDivider} />
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNum}>
                        {counselorData?.specializations?.length || "0"}
                      </Text>
                      <Text style={styles.profileStatLabel}>{t('counselor:specialtiesLabel')}</Text>
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
                    {activeTab === item.id && (
                      <LinearGradient
                        colors={["#003A9B", "#1490FF"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
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
                    {t('counselor:signOut')}
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
              // Figma-matched icons per tab (MaterialCommunityIcons):
              //   Chats → chat bubble, Appointments → calendar,
              //   Sessions → bubble with video camera, Earnings → banknote,
              //   Settings → gear. Filled variant when active.
              const active = activeTab === item.id;
              const bottomIconMap = {
                messages: active ? "message-text" : "message-text-outline",
                appointments: active ? "calendar" : "calendar-blank-outline",
                sessions: active ? "message-video" : "message-video",
                earnings: active ? "cash" : "cash-multiple",
                settings: active ? "cog" : "cog-outline",
              };
              return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.bottomNavItem,
                  activeTab === item.id && styles.bottomNavItemActive,
                ]}
                onPress={() => handleTabChange(item.id)}
              >
                <MaterialCommunityIcons
                  name={bottomIconMap[item.id] || "circle-outline"}
                  size={24}
                  color={active ? "#2563EB" : "#9CA3AF"}
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

        {/* Pending-request notifications (opened from the bell) */}
        <Modal
          visible={showNotifications}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowNotifications(false)}
        >
          <CounselorNotifications
            onClose={() => setShowNotifications(false)}
            onChanged={() => fetchPendingRequests()}
            onOpenChat={(req) => {
              setShowNotifications(false);
              setActiveTab('messages');
            }}
          />
        </Modal>

        {/* Main Content */}
        <View
          style={[
            styles.mainContent,
            isMobile && styles.mainContentMobile,
            // Clear the fixed greeting header on every tab.
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
                  <LinearGradient
                    colors={["#003A9B", "#1490FF"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                  />
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
              <View style={styles.logoutModalAccent} />
              <View style={styles.logoutModal}>
                <View style={styles.logoutIconWrap}>
                  <Feather name="log-out" size={26} color="#DC2626" />
                </View>
                <Text style={styles.logoutTitle}>{t('counselor:signOutQuestion')}</Text>
                <Text style={styles.logoutText}>
                  {t('counselor:signOutMessage')}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowLogoutConfirm(false)}
                  >
                    <Text style={styles.cancelBtnText}>{t('common:cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleLogout}
                  >
                    <Feather name="log-out" size={15} color="#ffffff" />
                    <Text style={styles.confirmBtnText}>{t('counselor:signOut')}</Text>
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
// ─── Sessions tab styles ─────────────────────────────────────────────────────
const sessStyles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerCountPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  headerCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  headerShowing: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 4,
  },
  headerShowingDate: {
    color: "#334155",
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dateBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#334155",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eef2f7",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  /* ── Empty state (Figma) ── */
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#F1F5FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13.5,
    color: "#94a3b8",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 26,
    paddingHorizontal: 8,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    borderRadius: 999,
    paddingVertical: 15,
  },
  refreshBtnText: { color: "#ffffff", fontSize: 14.5, fontWeight: "700" },
  tomorrowBtn: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderRadius: 999,
    paddingVertical: 15,
    marginTop: 12,
  },
  tomorrowBtnText: { color: "#2563EB", fontSize: 14.5, fontWeight: "700" },

  /* ── Figma session card ── */
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: "#334155" },
  liveBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.4,
  },
  patientRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  avatarPhoto: { width: 46, height: 46, borderRadius: 23 },
  avatarSolid: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsText: { fontSize: 15, fontWeight: "800", color: "#2563EB" },
  patientType: { fontSize: 12.5, color: "#94a3b8", fontWeight: "500", marginTop: 2 },

  conductBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  conductBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  viewBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  viewBtnText: { color: "#2563EB", fontSize: 14, fontWeight: "700" },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarRingOuter: {
    marginRight: 12,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  consultTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  consultTagText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  detailsBlock: {
    marginTop: 14,
    gap: 9,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  detailText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  notesBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
  },
  notesText: {
    flex: 1,
    fontSize: 12.5,
    color: "#64748b",
    fontStyle: "italic",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBtn: {
    backgroundColor: "#2563EB",
  },
  voiceBtn: {
    backgroundColor: "#0D9488",
  },
  chatBtn: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
});

const aptStyles = StyleSheet.create({
  // Cancel out the parent's horizontal padding so cards reach the screen edges.
  // The ScrollView uses this on `style` (not contentContainerStyle) so the
  // negative margin doesn't get pinched off by overflow:hidden on the content.
  scrollOuter: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 100,
  },
  // Wraps the hero, search and filter chips so they keep their normal
  // horizontal breathing room. The card list below stays edge-to-edge.
  insetSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },

  // ─── Greeting header ────────────────────────────────────────────────────────
  greetingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  greetingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  greetingAvatar: { width: 42, height: 42, borderRadius: 21 },
  greetingAvatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center',
  },
  greetingAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  greetingWelcome: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  greetingName: { fontSize: 16, color: '#0F172A', fontWeight: '800', marginTop: 1 },
  bellButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800' },

  // ─── Search ─────────────────────────────────────────────────────────────────
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 46,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e6ebf1',
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500', padding: 0 },

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
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
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
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  heroSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSummaryNum: {
    fontSize: 22,
    fontWeight: '900',
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
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    marginBottom: 14,
  },
  filterScroller: {
    flexGrow: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 112,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
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
    backgroundColor: 'rgba(255,255,255,0.28)',
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 6,
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '800',
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
    paddingBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // ─── Avatar: photo or solid letter circle (matches Figma) ─────────────────
  avatarRingOuter: {
    width: 48,
    height: 48,
    position: 'relative',
  },
  avatarPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarSolid: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 19,
    fontWeight: '700',
    color: '#ffffff',
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
    gap: 3,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
  },
  patientMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },

  // ─── Status badge (pill with dot) ────────────────────────────────────────
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
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

  // ─── Details panel (date / duration / notes) ─────────────────────────────
  detailsPanel: {
    backgroundColor: '#F4F6FB',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  infoRowTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 2,
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
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 2,
  },
  notesText: {
    flex: 1,
    fontSize: 12.5,
    color: '#526071',
    lineHeight: 18,
  },

  // ─── Action buttons ──────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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

  // ─── Confirmed appointment actions (video / voice / chat) ─────────────────
  confirmedActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  confirmedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
  },
  confirmedVideoBtn: {
    flex: 1.35,
    backgroundColor: '#2563EB',
  },
  confirmedVoiceBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
  },
  confirmedChatBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  confirmedActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  confirmedChatText: {
    color: '#334155',
  },

  // ─── Canceled note ───────────────────────────────────────────────────────
  canceledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
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

  /* ── Global greeting header ── */
  greetingHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  greetingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  greetingAvatar: { width: 40, height: 40, borderRadius: 20 },
  greetingAvatarFallback: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D4ED8',
    alignItems: 'center', justifyContent: 'center',
  },
  greetingAvatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  greetingWelcome: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500' },
  greetingName: { fontSize: 15.5, color: '#0F172A', fontWeight: '800', marginTop: 1 },
  greetingActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  greetingBell: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  greetingBellBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  greetingBellBadgeText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800' },
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
  mobileHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: "transparent",
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

  // ─── Earnings greeting header ───────────────────────────────────────────────
  earnGreetingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  earnGreetingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  earnGreetingAvatar: { width: 42, height: 42, borderRadius: 21 },
  earnGreetingAvatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center',
  },
  earnGreetingAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  earnGreetingWelcome: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  earnGreetingName: { fontSize: 16, color: '#0F172A', fontWeight: '800', marginTop: 1 },
  earnBellButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  earnBellBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  earnBellBadgeText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800' },

  earningsHeroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earningsHeroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.14)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  earningsHeroInnerDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
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
    width: 30,
    height: 30,
    borderRadius: 9,
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
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  earningsHeroAmount: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 14,
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
    alignItems: "center",
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
    backgroundColor: "transparent",
    overflow: "hidden",
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
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    overflow: "hidden",
  },
  logoutModalAccent: {
    height: 4,
    backgroundColor: "#2563EB",
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  logoutIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  logoutText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
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
    color: "#2563EB",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    borderRadius: 14,
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
