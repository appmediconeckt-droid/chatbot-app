// SMSInput.js - Fully Responsive Chat Interface with working avatar logic (mirrors SMSList)
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  Image,
  Linking,
  Pressable,
  BackHandler,
} from 'react-native';
import TextInput from '../../../../../../components/TranslatedTextInput';
import Text from '../../../../../../components/TranslatedText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ZoomableImageViewer from '../../../../../../components/common/ZoomableImageViewer';
import MicButton from '../../../../../../components/MicButton';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { pick } from '@react-native-documents/picker';
import { DOCTOR } from '../../../../../../theme/palette';

import socketService from '../../../../../../services/socketService';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import useRingtone, { INCOMING_RING_TIMEOUT_MS } from '../../../../../../hooks/useRingtone';
import { isGlobalCallUiActive } from '../../../../../../services/callNotificationBridge';
import { displayMissedCallNotification } from '../../../../../../services/notificationService';
import useScreenshotPrevent from '../../../../../../utils/useScreenshotPrevent';
import CounselorGradientButton from '../../../../../../components/common/CounselorGradientButton';
import VideoCallModal from '../../../UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../../../UserDashboard/Tab/CallModal/VoiceCallModal';
import {
  getAnonymousParticipantId,
  getAnonymousUserAvatar,
  getAnonymousUserDisplay,
} from '../../../../../../utils/anonymousUser';
import toImageUri from '../../../../../../utils/imageUri';
import GradientFill from '../../../../../../components/common/GradientFill';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import ChatSkeleton from "../../../../../../components/common/ChatSkeleton";
import PsychiatristDirectory from '../../../../../../components/common/PsychiatristDirectory';
import {
  describeCall,
} from '../../../../../../utils/chatCallHistory';
import {
  getNotificationOnlyCallMessage,
  isNotificationOnlyCallResponse,
} from '../../../../../../utils/callRequestStatus';
import { useSpeechToText } from '../../../../../../hooks/useSpeechToText';

const { width: screenWidth } = Dimensions.get('window');

// ─── Sent-bubble gradient ─────────────────────────────────────────────────
// EXACT same gradient as the counselor Earnings "Available Balance" box
// (DOCTOR.gradientFrom → gradientTo, horizontal). Pulled from the shared
// palette so it stays identical to earnings + login/signup.
const SENT_GRADIENT = [DOCTOR.gradientFrom, DOCTOR.gradientTo];
const SENT_GRADIENT_START = { x: 0, y: 0.5 };
const SENT_GRADIENT_END = { x: 1, y: 0.5 };

// ─── Avatar Colors (same as SMSList) ──────────────────────────────────────
const AVATAR_BG_COLORS = ['#4f46e5','#0891b2','#059669','#b45309','#c2410c','#7e22ce','#be123c','#1e40af'];
const getAvatarBg = (name) => {
  if (!name) return AVATAR_BG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
};

const normalizeIncomingCallType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'audio' || type === 'voice' || type.includes('audio') || type.includes('voice')) {
    return 'voice';
  }
  return 'video';
};

const getStreamRoomId = (...sources) => {
  for (const source of sources) {
    const roomId =
      source?.streamCallId ||
      source?.stream_call_id ||
      source?.streamId ||
      source?.roomId ||
      source?.room_id ||
      source?.channelId ||
      source?.call?.streamCallId ||
      source?.call?.roomId ||
      source?.data?.streamCallId ||
      source?.data?.roomId ||
      source?.callData?.streamCallId ||
      source?.callData?.roomId;
    if (roomId) return roomId;
  }
  return '';
};

const isPsychiatristSpecialization = (value) => {
  const text = Array.isArray(value) ? value.join(' ') : String(value || '');
  return /\bpsychiatrist\b|\bpsychiatry\b/i.test(text);
};

const createBlankMedicine = () => ({
  medicineName: '',
  dosage: '',
  timeOfDay: {
    Morning: false,
    Afternoon: false,
    Evening: false,
    Night: false,
  },
  whenToTake: '',
  duration: '',
});

// ─── Avatar Component (identical to ChatListAvatar) ───────────────────────
const escapePdfValue = (value) => String(value || '')
  // The lightweight PDF uses built-in Helvetica and byte offsets. Keep the
  // stream single-byte so names/instructions cannot corrupt the generated PDF.
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/\r?\n/g, ' ');

const buildSimplePrescriptionPdf = ({ patientName, psychiatristName, psychiatristId, problem, instructions, medicines }) => {
  const commands = [];
  const rect = (x, y, w, h, color) => commands.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
  const text = (value, x, y, size = 11, color = '0.10 0.14 0.22', font = 'F1') => {
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfValue(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, color = '0.82 0.88 0.95', width = 1) => {
    commands.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  rect(0, 0, 612, 792, '0.98 0.99 1');
  rect(36, 704, 540, 54, '0.10 0.32 0.74');
  text('HUMAELI', 56, 734, 20, '1 1 1', 'F2');
  text('DIGITAL PRESCRIPTION', 56, 716, 10, '0.86 0.93 1', 'F2');
  text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 430, 733, 10, '1 1 1');
  text(`Practitioner: ${psychiatristName || 'Psychiatrist'}`, 430, 716, 10, '1 1 1');
  if (psychiatristId) text(`ID: ${psychiatristId}`, 430, 702, 8, '0.86 0.93 1');

  rect(36, 628, 540, 54, '0.94 0.97 1');
  text('PATIENT', 56, 662, 9, '0.39 0.45 0.55', 'F2');
  text(patientName || 'Patient', 56, 643, 15, '0.08 0.13 0.22', 'F2');
  text(`Problem: ${problem}`, 255, 650, 11);

  text('Medicines', 36, 596, 15, '0.08 0.13 0.22', 'F2');
  rect(36, 566, 540, 24, '0.12 0.29 0.62');
  text('#', 48, 574, 9, '1 1 1', 'F2');
  text('Medicine', 78, 574, 9, '1 1 1', 'F2');
  text('Dosage', 222, 574, 9, '1 1 1', 'F2');
  text('Time', 316, 574, 9, '1 1 1', 'F2');
  text('How to take', 424, 574, 9, '1 1 1', 'F2');

  let y = 540;
  medicines.slice(0, 9).forEach((medicine, index) => {
    rect(36, y - 7, 540, 28, index % 2 === 0 ? '1 1 1' : '0.96 0.98 1');
    text(String(index + 1), 50, y + 3, 9);
    text(medicine.name || 'Medicine', 78, y + 3, 9, '0.08 0.13 0.22', 'F2');
    text(medicine.dosage || '', 222, y + 3, 9);
    text((medicine.timeOfDay || []).join(', '), 316, y + 3, 9);
    text(medicine.timing || '', 424, y + 3, 9);
    if (medicine.duration) text(`Duration: ${medicine.duration}`, 78, y - 10, 8, '0.39 0.45 0.55');
    line(36, y - 9, 576, y - 9);
    y -= 30;
  });

  if (instructions) {
    rect(36, Math.max(118, y - 52), 540, 46, '0.92 0.96 1');
    text('Additional instructions', 52, Math.max(145, y - 24), 10, '0.10 0.32 0.74', 'F2');
    text(instructions, 52, Math.max(128, y - 42), 10);
  }

  line(390, 92, 556, 92, '0.58 0.64 0.72');
  text('Digitally prescribed by', 410, 74, 9, '0.39 0.45 0.55');
  text(psychiatristName || 'Psychiatrist', 410, 58, 11, '0.08 0.13 0.22', 'F2');
  line(36, 40, 576, 40);
  text('This prescription was issued through Humaeli - www.humaeli.com - support@humaeli.com', 92, 24, 8, '0.39 0.45 0.55');

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 5 0 R >>',
    '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
};

const createPrescriptionAttachment = async ({ patientName, psychiatristName, psychiatristId, problem, instructions, medicines }) => {
  const safeName = String(patientName || 'Patient').replace(/[^\w.-]+/g, '-');
  const filename = `Prescription-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const filePath = `${RNFS.CachesDirectoryPath}/${filename}`;
  const pdf = buildSimplePrescriptionPdf({ patientName, psychiatristName, psychiatristId, problem, instructions, medicines });
  await RNFS.writeFile(filePath, pdf, 'utf8');
  return {
    uri: `file://${filePath}`,
    type: 'application/pdf',
    name: filename,
  };
};

const ChatAvatar = ({ avatarUrl, avatar, name, size = 40, style }) => {
  const [failed, setFailed] = useState(false);

  if (avatarUrl && !failed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, justifyContent: 'center', alignItems: 'center' },
        { backgroundColor: getAvatarBg(name) },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5, textAlign: 'center' }}>
        {avatar || getAnonymousUserAvatar({ name })}
      </Text>
    </View>
  );
};

// ─── Incoming Call Modal Component ─────────────────────────────────────────
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
  const { t } = useLanguageRender();
  const insets = useSafeAreaInsets();
  const [isJoining, setIsJoining] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { stopRinging } = useRingtone();

  const handleJoin = async () => {
    if (isJoining) return;
    setIsJoining(true);
    stopRinging();
    if (onJoinCall && callData) {
      try {
        await onJoinCall(callData.callId);
      } catch (error) {
        console.error("Error joining call:", error);
      } finally {
        setIsJoining(false);
      }
    } else {
      setIsJoining(false);
      onClose();
    }
  };

  const handleReject = async () => {
    if (isRejecting) return;
    setIsRejecting(true);
    stopRinging();
    if (onRejectCall && callData) {
      try {
        await onRejectCall(callData.callId);
      } catch (error) {
        console.error("Error rejecting call:", error);
      } finally {
        setIsRejecting(false);
        onClose();
      }
    } else {
      setIsRejecting(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const callerDisplay = getAnonymousUserDisplay(callData?.from || callData || {});
  const displayName =
    callData?.from?.anonymous ||
    callData?.from?.anonName ||
    callData?.from?.anonymousName ||
    callData?.name ||
    callerName ||
    callerDisplay.name ||
    "Anonymous User";
  const displayInitial = (displayName?.charAt(0) || "A").toUpperCase();
  const resolvedCallType = normalizeIncomingCallType(callType || callData?.callType);
  const isVideo = resolvedCallType === "video";
  const profilePhoto =
    toImageUri(callData?.from?.profilePhoto) ||
    toImageUri(callData?.from?.image) ||
    toImageUri(callData?.from?.avatarUrl) ||
    toImageUri(callData?.initiator?.profilePhoto) ||
    toImageUri(callData?.initiator?.image) ||
    toImageUri(callData?.image) ||
    toImageUri(callerDisplay.avatarUrl) ||
    toImageUri(callerAvatar);
  const callerLocation =
    callData?.from?.location ||
    callData?.from?.city ||
    callData?.location ||
    callData?.city ||
    null;

  return (
    <Modal
      visible={isOpen}
      transparent={false}
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.incomingCallScreen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.incomingCallHeader}>
          <Text style={styles.incomingCallKicker}>
            {isVideo ? t('call:incomingVideoCall', 'INCOMING VIDEO CALL') : t('call:incomingVoiceCall', 'INCOMING VOICE CALL')}
          </Text>
          <Text style={styles.incomingCallerName} numberOfLines={1}>{displayName}</Text>
          {!!callerLocation && (
            <View style={styles.incomingCallLocationRow}>
              <Ionicons name="location-outline" size={14} color="#94A3B8" />
              <Text style={styles.incomingCallLocation} numberOfLines={1}>{callerLocation}</Text>
            </View>
          )}
        </View>

        <View style={styles.incomingCallAvatarZone}>
          <View style={styles.incomingCallRingLarge} />
          <View style={styles.incomingCallRingSmall} />
          <View style={[styles.incomingCallerAvatar, { backgroundColor: getAvatarBg(displayName) }]}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.incomingAvatarImage} resizeMode="cover" />
            ) : (
              <LinearGradient colors={SENT_GRADIENT} start={SENT_GRADIENT_START} end={SENT_GRADIENT_END} style={styles.incomingAvatarGradient}>
                <Text style={styles.avatarInitialLarge}>{displayInitial}</Text>
              </LinearGradient>
            )}
          </View>
        </View>

        <View style={styles.incomingCallMeta}>
          <Ionicons name={isVideo ? "videocam" : "call"} size={18} color="#64748B" />
          <Text style={styles.incomingCallType}>{isVideo ? t('call:videoCall', 'Video Call') : t('call:voiceCall', 'Voice Call')}</Text>
        </View>

        <View style={styles.incomingCallControls}>
          <View style={styles.incomingCallActionCol}>
            <TouchableOpacity style={[styles.incomingCallBtn, styles.rejectBtn]} onPress={handleReject} disabled={isRejecting} activeOpacity={0.85}>
              {isRejecting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="call" size={28} color="#FFFFFF" style={styles.callEndIcon} />}
            </TouchableOpacity>
            <Text style={styles.incomingCallBtnLabel}>{isRejecting ? t('common:loading') : t('call:reject', 'Decline')}</Text>
          </View>
          <View style={styles.incomingCallActionCol}>
            <TouchableOpacity style={[styles.incomingCallBtn, styles.acceptBtn]} onPress={handleJoin} disabled={isJoining} activeOpacity={0.85}>
              <GradientFill />
              {isJoining ? <ActivityIndicator size="small" color="white" /> : <Ionicons name={isVideo ? "videocam" : "call"} size={28} color="#FFFFFF" />}
            </TouchableOpacity>
            <Text style={styles.incomingCallBtnLabel}>{isJoining ? t('call:connecting', 'Connecting...') : t('call:accept', 'Accept')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const SMSInput = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  useScreenshotPrevent();
  const location = route.params || {};
  const [message, setMessage] = useState("");
  const {
    isListening: isVoiceTyping,
    transcript: voiceTranscript,
    error: voiceTypingError,
    isAvailable: voiceTypingAvailable,
    startListening: startVoiceTyping,
    stopListening: stopVoiceTyping,
    clearTranscript: clearVoiceTranscript,
  } = useSpeechToText();
  const [keyboardInset, setKeyboardInset] = useState(0);
  const messageInputRef = useRef(null);
  const voiceTypingBaseRef = useRef("");
  const keyboardVisibleRef = useRef(false);
  const sendFocusGuardRef = useRef(false);
  const focusRestoreTimersRef = useRef([]);
  const messagesContainerRef = useRef(null);
  const chatSocketRef = useRef(null);
  const fallbackChatIdRef = useRef(null);

  const initialLoadDoneRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  // Block poll for 5 seconds after a delete so server can confirm.
  const deletedRecentlyRef = useRef(false);
  const deletedMessageIdsRef = useRef(new Set());
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);

  // Call modal states
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [callError, setCallError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showPsychiatristPicker, setShowPsychiatristPicker] = useState(false);
  const [recommendingPsychiatrist, setRecommendingPsychiatrist] = useState(false);
  const [issuingPrescription, setIssuingPrescription] = useState(false);
  const [prescriptionProblem, setPrescriptionProblem] = useState('');
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('');
  const [prescriptionMedicines, setPrescriptionMedicines] = useState([createBlankMedicine()]);

  // Receiving Call States
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const launchedFromCallPushRef = useRef(false);
  const [incomingCallData, setIncomingCallData] = useState({
    name: "",
    avatar: "👤",
    callId: "",
    roomId: "",
    callType: "video",
  });
  const { startRinging, stopRinging } = useRingtone();

  // Message states
  const [messages, setMessages] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  // Messages and call history are separate requests. The spinner cleared as soon
  // as the MESSAGES landed, so the thread rendered and the call bubbles dropped
  // in seconds later - the same jump the user side had. Hold the first paint
  // until both have settled.
  const [timelineReady, setTimelineReady] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [chatStatus, setChatStatus] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  // Call entries deleted (hidden) locally — there is no server API to delete a
  // call record, so we persist the hidden ids per chat.
  const [hiddenCallIds, setHiddenCallIds] = useState([]);
  // Track deleted message IDs persistently so they stay deleted across navigation/refresh
  const [deletedMessageIds, setDeletedMessageIds] = useState(new Set());
  const getDeletedMessagesStorageKey = useCallback(() => `deletedMessages_${getChatIdForAPI()}`, [chatId, USER_ID, counselorId, selectedUser]);
  // iOS uses padding; Android uses height to remain visible even where an OEM
  // ignores adjustResize, without retaining stale keyboard padding.

  // Counselor data
  const [currentCounselor, setCurrentCounselor] = useState(null);
  const [counselorId, setCounselorId] = useState(null);

  // Selected user from navigation (already contains avatarUrl + avatar from SMSList)
  const [selectedUser, setSelectedUser] = useState(location?.selectedUser || null);
  const chatId = location?.chatId;

  // ===================== Use same utilities as SMSList =====================
  const getUserDetailsFromSelected = () => {
    if (selectedUser && selectedUser.name) {
      // The selectedUser already comes fully hydrated from SMSList transformation
      return {
        id: selectedUser.userId || selectedUser.receiverId || selectedUser.id,
        name: selectedUser.name,
        gender: selectedUser.gender,
        avatar: selectedUser.avatar,
        avatarUrl: selectedUser.avatarUrl,
      };
    }
    // Fallback (should not happen because SMSList always passes processed user)
    const otherParty = selectedUser?.otherParty || selectedUser || {};
    const anonymous = getAnonymousUserDisplay(otherParty);
    return {
      id: getAnonymousParticipantId(otherParty) || selectedUser?.userId,
      name: anonymous.name,
      gender: anonymous.gender,
      avatar: anonymous.avatar,
      avatarUrl: anonymous.avatarUrl,
    };
  };

  const userDetails = getUserDetailsFromSelected();
  const USER_ID = userDetails.id;
  const USER_NAME = userDetails.name;
  const canIssuePrescription = isPsychiatristSpecialization(
    currentCounselor?.specialization || currentCounselor?.specializations,
  );

  const resolveOnlineStatus = (person) => {
    const v = person?.isOnline ?? person?.online;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return ['online','true','1','yes'].includes(v.toLowerCase());
    return false;
  };

  // ===================== Helper functions ===================================
  const getAuthToken = async () => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) return accessToken;
    return AsyncStorage.getItem("token");
  };

  const loadCounselorData = async () => {
    try {
      let counselorData = null;
      const storedCounselor = await AsyncStorage.getItem("counselor") ||
        await AsyncStorage.getItem("counsellor") ||
        await AsyncStorage.getItem("userData");
      if (storedCounselor) {
        try { counselorData = JSON.parse(storedCounselor); } catch(e) {}
      }
      let counselorIdValue = null;
      if (counselorData) {
        counselorIdValue = counselorData._id || counselorData.id;
        setCurrentCounselor(counselorData);
      }
      if (!counselorIdValue) {
        counselorIdValue = await AsyncStorage.getItem("counsellorId") ||
          await AsyncStorage.getItem("counselorId");
      }
      try {
        const token = await getAuthToken();
        if (token) {
          const me = await axios.get(`${API_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const freshCounselor = me.data?.counsellor || me.data?.counselor || me.data?.user;
          if (freshCounselor) {
            setCurrentCounselor(freshCounselor);
            counselorIdValue = counselorIdValue || freshCounselor._id || freshCounselor.id;
          }
        }
      } catch (_) {
        // Stored counselor data is enough for chat; fresh profile only improves role gating.
      }
      setCounselorId(counselorIdValue);
      return counselorIdValue;
    } catch (error) {
      return null;
    }
  };

  const normalizeObjectId = (value) => {
    if (!value) return null;
    if (typeof value === "object") {
      return normalizeObjectId(value._id) || normalizeObjectId(value.id) || normalizeObjectId(value.userId) || null;
    }
    const asString = String(value).trim();
    if (!asString) return null;
    if (/^[a-f\d]{24}$/i.test(asString)) return asString;
    const embeddedMatch = asString.match(/[a-f\d]{24}/i);
    return embeddedMatch ? embeddedMatch[0] : null;
  };

  const getChatIdForAPI = () => {
    if (chatId) return chatId;
    if (selectedUser && USER_ID && counselorId) {
      return `chat_${USER_ID}_${counselorId}`;
    }
    if (!fallbackChatIdRef.current) {
      const stableUserId = USER_ID || selectedUser?.userId || "user";
      const stableCounselorId = counselorId || "counsellor";
      fallbackChatIdRef.current = `chat_${stableUserId}_${stableCounselorId}`;
    }
    return fallbackChatIdRef.current;
  };

  // Prescriptions must always target an existing server-side consultation.
  // Unlike normal chat recovery, never invent a fallback ID for this endpoint.
  const getPrescriptionChatId = () => {
    const candidateChatId =
      chatId ||
      selectedUser?.chatId ||
      selectedUser?.chat_id ||
      selectedUser?.chat?.chatId ||
      selectedUser?.chat?._id ||
      selectedUser?.chat?.id;
    if (candidateChatId) return candidateChatId;

    const possibleId = selectedUser?.id || selectedUser?._id;
    if (typeof possibleId === 'string' && possibleId.startsWith('chat_')) {
      return possibleId;
    }
    return null;
  };

  const getAttachmentUrl = (item) => {
    const rawUrl = item?.attachmentUrl || item?.attachment || '';
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    if (/^(https?:|file:|content:|data:)/i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/')) return `${API_BASE_URL}${rawUrl}`;
    return `${API_BASE_URL}/${rawUrl}`;
  };

  const isImageAttachment = (item) => {
    const url = getAttachmentUrl(item);
    const name = String(item?.attachmentName || '');
    const contentType = String(item?.attachmentType || item?.contentType || '').toLowerCase();
    return contentType.startsWith('image/') ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)(\?|$)/i.test(url) ||
      /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(name);
  };

  const openAttachment = useCallback(async (uri) => {
    if (!uri) return;
    try {
      // Check if it's an image
      const isImage = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(uri);
      if (isImage) {
        // Show image preview modal
        setImagePreviewUrl(uri);
        setImagePreviewVisible(true);
        return;
      }

      // For non-image files, open with default app
      if (Platform.OS === 'android') {
        const fileName = uri.split('/').pop().split('?')[0] || `attachment_${Date.now()}.pdf`;
        const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        const fileExists = await RNFS.exists(destPath);
        if (!fileExists) {
          const result = await RNFS.downloadFile({ fromUrl: uri, toFile: destPath }).promise;
          if (result.statusCode !== 200) throw new Error('Download failed');
        }
        await Linking.openURL(`content://${destPath}`);
      } else {
        await Linking.openURL(uri);
      }
    } catch (error) {
      Alert.alert('Cannot Open File', 'No app found to open this file.');
    }
  }, []);

  const handlePickAttachment = useCallback(async () => {
    if (isSending) return;
    try {
      const [picked] = await pick();
      if (!picked?.uri) return;
      setPendingAttachment({
        uri: picked.uri,
        name: picked.name || `file_${Date.now()}`,
        type: picked.type || picked.mimeType || 'application/octet-stream',
        size: picked.size || picked.fileSize || 0,
      });
    } catch (error) {
      if (error?.code !== 'OPERATION_CANCELED') Alert.alert('Attachment', 'Failed to pick file.');
    }
  }, [isSending]);

  // ─── Message fetching & storage ─────────────────────────────────────────
  const saveMessagesToLocalStorage = async (messagesToSave) => {
    try {
      const savedChats = JSON.parse(await AsyncStorage.getItem("smsChats") || "[]");
      const chatIdToSave = getChatIdForAPI();
      const existingIndex = savedChats.findIndex(chat => chat.chatId === chatIdToSave);
      const chatData = {
        chatId: chatIdToSave,
        userId: USER_ID,
        userName: USER_NAME,
        messages: messagesToSave,
        chatStatus,
        lastUpdated: new Date().toISOString(),
      };
      if (existingIndex >= 0) savedChats[existingIndex] = chatData;
      else savedChats.push(chatData);
      await AsyncStorage.setItem("smsChats", JSON.stringify(savedChats));
    } catch (error) {}
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
    } catch (error) {}
  };

  const fetchMessagesFromAPI = async () => {
    if (!selectedUser || !counselorId) return;
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      setIsLoadingMessages(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/chat/chat/${apiChatId}/messages`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (response.data && response.data.messages) {
        if (response.data.chatStatus) setChatStatus(response.data.chatStatus);

        // Deduplicate system messages (e.g., "Sending a new request" that appears 6-7 times)
        // Keep only the FIRST occurrence of duplicate system messages
        const seenSystemTexts = new Set();
        const deduplicatedMessages = response.data.messages.filter(msg => {
          const isSystemMessage = msg.content?.includes('Sending a new request') ||
                                  msg.content?.includes('expires in');
          if (isSystemMessage) {
            const key = msg.content;
            if (seenSystemTexts.has(key)) return false; // Skip duplicate
            seenSystemTexts.add(key);
          }
          return true;
        });

        const transformed = deduplicatedMessages.map((msg, idx) => ({
          id: msg.id || msg._id || msg.messageId || `fetched_${idx}`,
          messageId: msg.messageId,
          text: msg.content,
          sender: msg.senderRole === "counsellor" ? "me" : "user",
          senderRole: msg.senderRole,
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          fullTime: msg.createdAt,
          contentType: msg.contentType,
          attachmentType: msg.attachmentType || msg.contentType || null,
          attachmentUrl: msg.attachmentUrl || null,
          attachmentName: msg.attachmentName || null,
          isRead: msg.isRead,
          status: "sent",
        }));
        initialLoadDoneRef.current = false;
        shouldAutoScrollRef.current = true;
        // Filter out any message that we've already deleted (tracked in deletedMessageIds)
        // so the server response doesn't re-add a message we optimistically deleted.
        setMessages(prev => {
          const filtered = transformed.filter(m => !deletedMessageIds.has(String(m.messageId || m.id)));
          saveMessagesToLocalStorage(filtered);
          return filtered;
        });
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        navigation.replace('RoleSelector', { reason: 'session-expired' });
        return;
      }
      loadMessagesFromLocalStorage();
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // ─── Call History ────────────────────────────────────────────────────────
  const fetchCallHistory = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const userId = USER_ID;
      const cId = counselorId;
      if (!userId || !cId) { setCallHistory([]); return; }
      const response = await axios.get(`${API_BASE_URL}/api/video/calls/history/${cId}`, {
        params: { peerId: userId, peerType: 'user', page: 1, limit: 100 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const callsData = response.data?.calls || response.data?.history || [];
      const formatted = callsData
        .filter((c) => String(c.withId || c.receiverId || c.peerId || c.receiver?.id || c.peer?.id) === String(userId))
        .map((c) => ({
          id: c.id || c._id || `call_${Date.now()}_${Math.random()}`,
          isCall: true,
          type: c.callType === 'audio' ? 'voice' : 'video',
          direction: (c.role === 'initiator' || c.initiator?.id === cId) ? 'outgoing' : 'incoming',
          status: c.status || 'completed',
          time: new Date(c.timestamp || c.createdAt || c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fullTime: c.timestamp || c.createdAt || c.startedAt,
          duration: c.duration || null,
        }));
      setCallHistory(formatted);
      AsyncStorage.setItem(
        `counselorCallHistory_${chatId || cId}`,
        JSON.stringify(formatted),
      ).catch(() => {});
    } catch { setCallHistory([]); }
  }, [USER_ID, counselorId]);

  const getMergedTimeline = useCallback(() => {
    return [...messages].filter((item) => !item?.isCall).sort((a, b) => {
      const tA = a.fullTime || a.createdAt || a.timestamp;
      const tB = b.fullTime || b.createdAt || b.timestamp;
      return new Date(tA) - new Date(tB);
    });
  }, [messages]);

  const hiddenCallsStorageKey = useCallback(() => `hiddenCallEntries_${getChatIdForAPI()}`, [chatId, USER_ID, counselorId, selectedUser]);

  // Load locally-hidden call entries for this thread.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(hiddenCallsStorageKey());
        if (active && stored) setHiddenCallIds(JSON.parse(stored) || []);
      } catch (_) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [hiddenCallsStorageKey]);

  // Load deleted message IDs for this thread so deletions survive app refresh
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(getDeletedMessagesStorageKey());
        if (active && stored) {
          const ids = JSON.parse(stored) || [];
          setDeletedMessageIds(new Set(ids));
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [getDeletedMessagesStorageKey]);

  // Keep ref in sync with deletedMessageIds state so socket listeners see current values
  useEffect(() => {
    deletedMessageIdsRef.current = deletedMessageIds;
  }, [deletedMessageIds]);

  const hideCallEntry = useCallback((callItemId) => {
    if (!callItemId) return;
    setHiddenCallIds((prev) => {
      const next = Array.from(new Set([...prev, String(callItemId)]));
      AsyncStorage.setItem(hiddenCallsStorageKey(), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [hiddenCallsStorageKey]);

  const confirmDeleteCall = useCallback((item) => {
    Alert.alert(
      'Delete Call',
      `Remove this ${item.type === 'video' ? 'video' : 'voice'} call from the chat?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          hideCallEntry(item.id);
        }},
      ],
    );
  }, [hideCallEntry]);

  const getItemDayKey = (item) => {
    const ts = item?.fullTime || item?.createdAt || item?.timestamp;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d.toDateString();
  };

  const formatItemDay = (item) => {
    const ts = item?.fullTime || item?.createdAt || item?.timestamp;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ─── Sending messages ───────────────────────────────────────────────────
  const sendMessageToAPI = async ({ messageContent = "", file = null }) => {
    try {
      const apiChatId = getChatIdForAPI();
      const token = await getAuthToken();
      let response;
      if (file) {
        const formData = new FormData();
        if (messageContent.trim()) formData.append("content", messageContent.trim());
        formData.append("attachment", {
          uri: file.uri,
          name: file.name || `attachment_${Date.now()}.jpg`,
          type: file.type || "image/jpeg",
        });
        response = await axios.post(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message`, formData, {
          headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "multipart/form-data" },
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/chat/chat/${apiChatId}/message`, { content: messageContent }, {
          headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        });
      }
      if (response.data && response.data.success) return response.data.message;
      throw new Error("Invalid API response");
    } catch (error) {
      throw error;
    }
  };

  const updatePrescriptionMedicine = (index, field, value) => {
    setPrescriptionMedicines(prev => prev.map((medicine, i) => (
      i === index ? { ...medicine, [field]: value } : medicine
    )));
  };

  const toggleMedicineTime = (index, slot) => {
    setPrescriptionMedicines(prev => prev.map((medicine, i) => (
      i === index
        ? { ...medicine, timeOfDay: { ...medicine.timeOfDay, [slot]: !medicine.timeOfDay?.[slot] } }
        : medicine
    )));
  };

  const resetPrescriptionForm = () => {
    setPrescriptionProblem('');
    setPrescriptionInstructions('');
    setPrescriptionMedicines([createBlankMedicine()]);
  };

  const handleOpenPrescription = () => {
    setShowOptions(false);
    if (!canIssuePrescription) {
      Alert.alert('Prescription not allowed', 'Only psychiatrists can create prescriptions.');
      return;
    }
    setShowPrescriptionModal(true);
  };

  const handleRecommendPsychiatrist = () => {
    setShowOptions(false);
    setShowPsychiatristPicker(true);
  };

  const handleSelectPsychiatrist = async (psychiatrist) => {
    if (recommendingPsychiatrist) return;
    const name = psychiatrist?.fullName || psychiatrist?.name || psychiatrist?.displayName || 'a psychiatrist';
    const specialization = Array.isArray(psychiatrist?.specializations)
      ? psychiatrist.specializations.filter(Boolean).join(', ')
      : psychiatrist?.specialization || psychiatrist?.category || 'Psychiatry';
    const note = `I recommend @${name} for ${specialization} support. Please open Consultants and search "${name}" to view their profile.`;
    try {
      setRecommendingPsychiatrist(true);
      await sendMessageToAPI({ messageContent: note });
      setShowPsychiatristPicker(false);
    } catch (error) {
      Alert.alert('Recommendation failed', error?.response?.data?.message || 'Unable to send psychiatrist recommendation right now.');
    } finally {
      setRecommendingPsychiatrist(false);
    }
  };

  const handleIssuePrescription = async () => {
    const validMedicines = prescriptionMedicines
      .map((medicine) => {
        const slots = Object.entries(medicine.timeOfDay || {})
          .filter(([, selected]) => selected)
          .map(([slot]) => slot);
        return {
          medicineName: medicine.medicineName.trim(),
          name: medicine.medicineName.trim(),
          dosage: medicine.dosage.trim(),
          timeOfDay: slots,
          timing: medicine.whenToTake.trim(),
          whenToTake: medicine.whenToTake.trim(),
          duration: medicine.duration.trim(),
        };
      })
      .filter((medicine) => medicine.medicineName || medicine.dosage || medicine.whenToTake);

    if (!prescriptionProblem.trim()) {
      Alert.alert('Patient problem required', 'Please describe the patient problem or diagnosis.');
      return;
    }
    if (validMedicines.length === 0 || validMedicines.some((m) => !m.medicineName || !m.dosage || !m.whenToTake || m.timeOfDay.length === 0)) {
      Alert.alert('Medicine details required', 'Please fill medicine name, dosage, time of day, and when to take.');
      return;
    }

    try {
      setIssuingPrescription(true);
      const apiChatId = getPrescriptionChatId();
      if (!apiChatId) {
        throw new Error('Chat ID not found. Please reopen this conversation and try again.');
      }
      const medicinesForApi = validMedicines.map((medicine) => ({
        name: medicine.name,
        dosage: medicine.dosage,
        timeOfDay: medicine.timeOfDay,
        timing: medicine.timing,
        duration: medicine.duration,
      }));
      const prescriptionPdf = await createPrescriptionAttachment({
        patientName: USER_NAME,
        psychiatristName: currentCounselor?.fullName || currentCounselor?.name || 'Psychiatrist',
        psychiatristId: counselorId,
        problem: prescriptionProblem.trim(),
        instructions: prescriptionInstructions.trim(),
        medicines: medicinesForApi,
      });
      const formData = new FormData();
      formData.append('problem', prescriptionProblem.trim());
      formData.append('instructions', prescriptionInstructions.trim());
      formData.append('medicines', JSON.stringify(medicinesForApi));
      formData.append('attachment', prescriptionPdf);

      const token = await getAuthToken();
      const response = await axios.post(`${API_BASE_URL}/api/prescriptions/chat/${encodeURIComponent(apiChatId)}`, formData, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'multipart/form-data',
        },
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || response.data?.message || 'Unable to send prescription.');
      }

      const note = `Prescription created for ${USER_NAME}. Please check the Prescription tab.`;
      await sendMessageToAPI({ messageContent: note }).catch(() => {});
      setMessages(prev => [...prev, {
        id: `temp_rx_${Date.now()}`,
        text: note,
        sender: 'me',
        senderRole: 'counsellor',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        status: 'sent',
      }]);
      resetPrescriptionForm();
      setShowPrescriptionModal(false);
      Alert.alert('Prescription sent', 'Prescription has been sent to the patient.');
    } catch (error) {
      Alert.alert(
        'Prescription failed',
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'Unable to send prescription.',
      );
    } finally {
      setIssuingPrescription(false);
    }
  };

  const getMessageIdentifier = (msg) => msg?._id || msg?.id || msg?.messageId;

  const removeMessageFromState = async (messageToDelete) => {
    const targetId = getMessageIdentifier(messageToDelete);
    if (!targetId) return;

    const isSameMessage = (msg) => {
      const currentId = getMessageIdentifier(msg);
      return currentId && String(currentId) === String(targetId);
    };

    // Add to deletedMessageIds (persistent) and hide immediately.
    setDeletedMessageIds(prev => {
      const updated = new Set([...prev, String(targetId), String(messageToDelete.messageId)]);
      AsyncStorage.setItem(getDeletedMessagesStorageKey(), JSON.stringify(Array.from(updated))).catch(() => {});
      return updated;
    });
    setMessages((prev) => {
      const updatedMessages = prev.filter((msg) => !isSameMessage(msg));
      saveMessagesToLocalStorage(updatedMessages);
      return updatedMessages;
    });
  };

  const handleDeleteMessage = async (messageToDelete) => {
    if (!selectedUser || isSending) return;

    const messageId = getMessageIdentifier(messageToDelete);
    if (!messageId || String(messageId).startsWith("temp_") || messageToDelete?.isTemporary) {
      Alert.alert("Delete Message", "This message cannot be deleted yet.");
      return;
    }

    Alert.alert(
      "Delete Message",
      "Delete this message? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setError(null);
            // Optimistic delete: remove instantly, then sync the server in the
            // background. Roll back if the server call fails.
            await removeMessageFromState(messageToDelete);
            // Set grace period (10 seconds) to prevent race conditions with multiple
            // deletes or concurrent fetches. Message is already marked as deleted above.
            deletedRecentlyRef.current = true;
            setTimeout(() => {
              deletedRecentlyRef.current = false;
            }, 10000);
            try {
              const token = await getAuthToken();
              await axios.delete(`${API_BASE_URL}/api/chat/message/${encodeURIComponent(messageId)}`, {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: token ? `Bearer ${token}` : "",
                },
              });
            } catch (deleteError) {
              if (deleteError?.response?.status === 401) {
                navigation.replace('RoleSelector', { reason: 'session-expired' });
                return;
              }
              // Restore the message since the server delete failed.
              setDeletedMessageIds(prev => {
                const updated = new Set(prev);
                updated.delete(String(messageId));
                updated.delete(String(messageToDelete.messageId));
                AsyncStorage.setItem(getDeletedMessagesStorageKey(), JSON.stringify(Array.from(updated))).catch(() => {});
                return updated;
              });
              setMessages((prev) => {
                if (prev.some((m) => String(getMessageIdentifier(m)) === String(messageId))) return prev;
                const restored = [...prev, messageToDelete];
                restored.sort((a, b) => {
                  const ta = new Date(a.fullTime || a.createdAt || a.timestamp || Date.now()).getTime();
                  const tb = new Date(b.fullTime || b.createdAt || b.timestamp || Date.now()).getTime();
                  return ta - tb;
                });
                return restored;
              });
              const errorMsg =
                deleteError?.response?.data?.error ||
                deleteError?.response?.data?.message ||
                deleteError?.message ||
                "Failed to delete message";
              Alert.alert("Delete Failed", errorMsg);
            }
          },
        },
      ],
    );
  };
  const handleSendMessage = async () => {
    if ((message.trim() === "" && !pendingAttachment) || !selectedUser || isSending) return;
    const keepComposerFocused = Boolean(
      keyboardVisibleRef.current || messageInputRef.current?.isFocused?.(),
    );
    const messageText = message.trim();
    const attachmentToSend = pendingAttachment;
    const tempMessage = {
      id: `temp_${Date.now()}`,
      text: messageText || `📎 ${attachmentToSend?.name || "Attachment"}`,
      sender: "me",
      senderRole: "counsellor",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      status: "sending",
      isTemporary: true,
      attachmentName: attachmentToSend?.name || null,
      attachmentUrl: attachmentToSend?.uri || null,
      attachmentType: attachmentToSend?.type || null,
    };
    shouldAutoScrollRef.current = true;
    setMessages(prev => [...prev, tempMessage]);
    setMessage("");
    setPendingAttachment(null);
    setIsSending(true);
    setError(null);
    // Sending must not blur or disable the composer. Keep the keyboard and
    // caret active while the network request completes.
    if (keepComposerFocused) preserveComposerFocusForSend();
    try {
      const sentMsg = await sendMessageToAPI({ messageContent: messageText, file: attachmentToSend });
      setMessages(prev => {
        const confirmedId = sentMsg?.id || sentMsg?._id || sentMsg?.messageId;
        const socketAlreadyAdded = confirmedId && prev.some(m => !m.isTemporary && (m.id === confirmedId || m.messageId === sentMsg?.messageId));
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
          attachmentType: sentMsg.attachmentType || sentMsg.contentType || attachmentToSend?.type || null,
          attachmentUrl: sentMsg.attachmentUrl || null,
          attachmentName: sentMsg.attachmentName || null,
          isRead: sentMsg.isRead,
          status: "sent",
        }];
      });
    } catch (err) {
      setMessages(prev => prev.map(msg => msg.id === tempMessage.id ? { ...msg, status: "error" } : msg));
      setError("Failed to send message");
      setTimeout(() => setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id)), 3000);
    } finally {
      setIsSending(false);
      finishComposerFocusForSend();
    }
  };

  useEffect(() => {
    const spokenText = String(voiceTranscript || "").trim();
    if (!spokenText) return;

    const baseText = voiceTypingBaseRef.current;
    const spacer = baseText && !/\s$/.test(baseText) ? " " : "";
    setMessage(`${baseText}${spacer}${spokenText}`);
  }, [voiceTranscript]);

  useEffect(() => {
    if (voiceTypingError) {
      console.warn("[Counselor Speech-to-Text] error:", voiceTypingError);
    }
  }, [voiceTypingError]);

  const handleVoiceTypingPress = useCallback(() => {
    if (isVoiceTyping) {
      stopVoiceTyping();
      return;
    }

    voiceTypingBaseRef.current = message || "";
    clearVoiceTranscript();
    messageInputRef.current?.focus();
    startVoiceTyping();
  }, [clearVoiceTranscript, isVoiceTyping, message, startVoiceTyping, stopVoiceTyping]);

  // ─── End session ─────────────────────────────────────────────────────────
  // Counselor ends the session. The backend should mark the chat "ended" and
  // emit the existing `chat-status-update` event so the user's app shows its
  // rating popup. We update our own status locally for immediate feedback.

  // Clear chat function
  const clearChat = async () => {
    try {
      const token = await getAuthToken();
      const apiChatId = getChatIdForAPI();

      await axios.post(
        `${API_BASE_URL}/api/chat/clear/${apiChatId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages([]);
      setCallHistory([]);
      setDeletedMessageIds(new Set());
      Alert.alert("Success", "Chat cleared! You can now start a new conversation.");
    } catch (error) {
      Alert.alert(
        "Error",
        `Could not clear chat: ${error?.response?.data?.error || error.message || "Failed to clear chat on server"}`
      );
    }
  };

  // ─── Call initiation and handling ────────────────────────────────────────
  const initiateVideoCall = async () => {
    if (!selectedUser || !counselorId) {
      setCallError("Unable to make call");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No token");
      const requestBody = {
        initiatorId: String(counselorId),
        receiverId: String(USER_ID),
        receiverType: "user",
        callType: "video",
        initiatorType: "counsellor",
      };
      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, requestBody, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.data && response.data.success) {
        if (isNotificationOnlyCallResponse(response.data)) {
          const notificationMessage = getNotificationOnlyCallMessage(response.data, USER_NAME || "User");
          setCallError(null);
          Alert.alert("Call request sent", notificationMessage);
          return;
        }

        const streamRoomId = getStreamRoomId(response.data, response.data.callData);
        const callData = {
          callId: response.data.callId || response.data.callData?._id,
          roomId: streamRoomId,
          streamCallId: streamRoomId,
          name: USER_NAME,
          type: "video",
          callType: "video",
          status: "ringing",
          currentUserId: counselorId,
          currentUserType: "counsellor",
          isIncoming: false,
        };
        setSelectedCall(callData);
        setIsVideoModalOpen(true);
      } else throw new Error(response.data?.message);
    } catch (error) {
      setCallError(error.message || "Failed to initiate video call");
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const initiateVoiceCall = async () => {
    if (!selectedUser || !counselorId) {
      setCallError("Unable to make call");
      return;
    }
    setIsInitiatingCall(true);
    setCallError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No token");
      const requestBody = {
        initiatorId: String(counselorId),
        receiverId: String(USER_ID),
        receiverType: "user",
        callType: "audio",
        initiatorType: "counsellor",
      };
      const response = await axios.post(`${API_BASE_URL}/api/video/calls/initiate`, requestBody, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.data && response.data.success) {
        if (isNotificationOnlyCallResponse(response.data)) {
          const notificationMessage = getNotificationOnlyCallMessage(response.data, USER_NAME || "User");
          setCallError(null);
          Alert.alert("Call request sent", notificationMessage);
          return;
        }

        const streamRoomId = getStreamRoomId(response.data, response.data.callData);
        const callData = {
          callId: response.data.callId || response.data.callData?._id,
          roomId: streamRoomId,
          streamCallId: streamRoomId,
          name: USER_NAME,
          type: "voice",
          callType: "audio",
          status: "ringing",
          currentUserId: counselorId,
          currentUserType: "counsellor",
          isIncoming: false,
        };
        setSelectedCall(callData);
        setIsVoiceModalOpen(true);
      } else throw new Error(response.data?.message);
    } catch (error) {
      setCallError(error.message || "Failed to initiate voice call");
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleJoinIncomingCall = async (callId) => {
    launchedFromCallPushRef.current = false;
    await AsyncStorage.removeItem('pendingIncomingCallPush');
    try {
      const token = await getAuthToken();
      const response = await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/accept`, {
        acceptorId: counselorId,
        acceptorType: "counsellor",
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data?.success) {
        const acceptedPayload =
          response.data?.call ||
          response.data?.callData ||
          response.data?.data?.call ||
          response.data?.data?.callData ||
          null;
        const modalType = normalizeIncomingCallType(
          incomingCallData.callType ||
          acceptedPayload?.callType ||
          acceptedPayload?.type ||
          response.data?.callType ||
          "video"
        );
        const initiatorId = acceptedPayload?.initiator?.id || acceptedPayload?.initiator?._id;
        const remoteParticipant =
          acceptedPayload && String(initiatorId) === String(counselorId)
            ? acceptedPayload.receiver
            : acceptedPayload?.initiator || incomingCallData?.from || {};
        const remoteName =
          remoteParticipant?.anonymous ||
          remoteParticipant?.anonName ||
          remoteParticipant?.anonymousName ||
          remoteParticipant?.displayName ||
          remoteParticipant?.fullName ||
          incomingCallData.name ||
          "Anonymous User";
        const streamRoomId = getStreamRoomId(response.data, acceptedPayload, incomingCallData);
        const callDataForModal = {
          id: acceptedPayload?.id || acceptedPayload?._id || callId,
          callId,
          roomId: streamRoomId,
          streamCallId: streamRoomId,
          name: remoteName,
          type: modalType,
          callType: modalType,
          status: response.data?.status || acceptedPayload?.status || "active",
          profilePic: remoteParticipant?.profilePhoto || remoteParticipant?.image || incomingCallData.image || null,
          apiCallData: acceptedPayload,
          initiator: acceptedPayload?.initiator || incomingCallData.initiator,
          receiver: acceptedPayload?.receiver || incomingCallData.receiver,
          initiatorId: acceptedPayload?.initiator?.id || acceptedPayload?.initiator?._id,
          receiverId: acceptedPayload?.receiver?.id || acceptedPayload?.receiver?._id,
          currentUserId: counselorId,
          currentUserType: "counsellor",
          from: incomingCallData.from,
          isIncoming: true,
        };
        if (modalType === "video") {
          setSelectedCall(callDataForModal);
          setIsVideoModalOpen(true);
        } else {
          setSelectedCall(callDataForModal);
          setIsVoiceModalOpen(true);
        }
        setShowIncomingModal(false);
        return { success: true };
      }
      throw new Error("Failed to accept call");
    } catch (error) {
      console.error("Join call error:", error);
      setShowIncomingModal(true);
      startRinging(true);
      throw error;
    }
  };

  const handleRejectIncomingCall = async (callId) => {
    const shouldExitAfterReject = launchedFromCallPushRef.current;
    launchedFromCallPushRef.current = false;
    try {
      const token = await getAuthToken();
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/reject`, { userId: counselorId, reason: "declined" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await AsyncStorage.removeItem('pendingIncomingCallPush');
      if (shouldExitAfterReject && Platform.OS === 'android') {
        setTimeout(() => BackHandler.exitApp(), 100);
      }
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleEndIncomingCall = async (callId) => {
    try {
      const token = await getAuthToken();
      await axios.put(`${API_BASE_URL}/api/video/calls/${callId}/end`, { userId: counselorId, endedBy: "counsellor" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => { loadCounselorData(); }, []);
  useEffect(() => {
    if (!selectedUser || !counselorId) return undefined;
    let alive = true;
    (async () => {
      // Paint from cache first when we have it, so the thread appears complete
      // straight away and the network refresh below is invisible.
      try {
        const cached = await AsyncStorage.getItem(
          `counselorCallHistory_${chatId || counselorId}`,
        );
        if (alive && cached) setCallHistory(JSON.parse(cached) || []);
      } catch (_) { /* cache is best-effort */ }

      // In parallel, not one-after-the-other, and the gate opens only when both
      // are done. try/finally so a rejected request opens the gate too - the
      // error branch below the skeleton is what should be shown then, not an
      // endless skeleton waiting on the 6s guard.
      try {
        await fetchMessagesFromAPI();
      } finally {
        if (alive) setTimelineReady(true);
      }
    })();
    // Never let a hung request leave the thread behind a skeleton forever.
    const guard = setTimeout(() => { if (alive) setTimelineReady(true); }, 6000);
    return () => { alive = false; clearTimeout(guard); };
  }, [selectedUser, chatId, counselorId]);

  const loadCallHistory = async () => {
    setCallHistory([]);
  };

  useEffect(() => {
    if (counselorId && USER_ID) loadCallHistory();
  }, [counselorId, USER_ID, chatId]);

  // Socket connection
  useEffect(() => {
    const setupSocket = async () => {
      const apiChatId = getChatIdForAPI();
      if (!apiChatId || !selectedUser || !counselorId) return;
      const token = await getAuthToken();
      if (!token) return;
      const unsubscribers = [];
      try {
        const socket = await socketService.connect();
        chatSocketRef.current = socket;
        setIsSocketConnected(true);
        const currentChatIds = [
          apiChatId,
          selectedUser?.chatId,
          selectedUser?.id,
          selectedUser?._id,
        ]
          .filter(Boolean)
          .map((id) => String(id));

        const isCurrentChatEvent = (payload = {}) => {
          const payloadChatIds = [
            payload.publicChatId,
            payload.chatId,
            payload._id,
            payload.id,
          ]
            .filter(Boolean)
            .map((id) => String(id));

          return payloadChatIds.some((id) => currentChatIds.includes(id));
        };

        const onConnect = () => {
          setIsSocketConnected(true);
          socket.emit('join-chat', { chatId: apiChatId });
        };
        unsubscribers.push(await socketService.on('connect', onConnect));
        if (socket.connected) onConnect();
        unsubscribers.push(await socketService.on('disconnect', () => setIsSocketConnected(false)));
        unsubscribers.push(await socketService.on('presence-update', ({ userId, isOnline, lastSeen }) => {
          if (String(userId) === String(USER_ID)) {
            setSelectedUser(prev => prev ? { ...prev, online: !!isOnline, lastSeen } : prev);
          }
        }));
        unsubscribers.push(await socketService.on('new-message', (messageData) => {
          if (!isCurrentChatEvent(messageData)) return;
          shouldAutoScrollRef.current = true;
          // Skip if this message was deleted locally
          if (deletedMessageIdsRef.current.has(String(messageData.messageId || messageData.id || messageData._id))) return;
          const isOwn = messageData.senderRole === 'counsellor' && String(messageData.senderId) === String(counselorId);
          setMessages(prev => {
            if (prev.some(m => m.messageId && m.messageId === messageData.messageId)) return prev;
            if (isOwn) {
              const tempIndex = prev.findIndex(m => m.isTemporary);
              if (tempIndex !== -1) {
                const next = [...prev];
                next[tempIndex] = {
                  id: messageData.id || messageData._id,
                  messageId: messageData.messageId,
                  text: messageData.content,
                  sender: 'me',
                  senderRole: 'counsellor',
                  time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  fullTime: messageData.createdAt,
                  attachmentType: messageData.attachmentType,
                  attachmentUrl: messageData.attachmentUrl,
                  attachmentName: messageData.attachmentName,
                  isRead: messageData.isRead,
                  status: 'sent',
                };
                return next;
              }
            }
            return [...prev, {
              id: messageData.id || messageData._id,
              messageId: messageData.messageId,
              text: messageData.content,
              sender: isOwn ? 'me' : 'user',
              senderRole: messageData.senderRole,
              time: new Date(messageData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              fullTime: messageData.createdAt,
              attachmentType: messageData.attachmentType,
              attachmentUrl: messageData.attachmentUrl,
              attachmentName: messageData.attachmentName,
              isRead: messageData.isRead,
              status: 'sent',
            }];
          });
        }));
        unsubscribers.push(await socketService.on('user-typing', ({ userRole, isTyping }) => {
          if (userRole === 'user') setRemoteIsTyping(isTyping);
        }));
        unsubscribers.push(await socketService.on('connect_error', (err) => console.error("Socket error", err)));
        chatSocketRef.current._unsubscribers = unsubscribers;
      } catch (err) {
        console.error("Socket setup error:", err);
      }
    };
    setupSocket();
    return () => {
      try { chatSocketRef.current?._unsubscribers?.forEach(fn => fn()); } catch(e) {}
      chatSocketRef.current = null;
    };
  }, [selectedUser, counselorId, USER_ID]);

  // Polling for calls
  useEffect(() => {
    let intervalId = null;
    const fetchIncoming = async () => {
      try {
        const token = await getAuthToken();
        if (!counselorId || !token || showIncomingModal || isVideoModalOpen || isVoiceModalOpen || isGlobalCallUiActive()) return;
        const res = await axios.get(`${API_BASE_URL}/api/video/calls/pending/${counselorId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const calls = res.data.pendingRequests || [];
        if (isGlobalCallUiActive()) return;
        if (calls.length > 0) {
          const call = calls[0];
          const from = call.from || call.initiator || {};
          const resolvedCallType = normalizeIncomingCallType(call.callType || call.type);
          const streamRoomId = getStreamRoomId(call);
          setIncomingCallData({
            callId: call.callId || call.id || call._id,
            roomId: streamRoomId,
            streamCallId: streamRoomId,
            name: from.anonymous || from.anonName || from.anonymousName || "Anonymous User",
            avatar: "👤",
            image:
              from.profilePhoto ||
              from.image ||
              from.avatarUrl ||
              from.avatar ||
              getAnonymousUserDisplay(from).avatarUrl ||
              null,
            callType: resolvedCallType,
            requestMessage: call.requestMessage || `Incoming ${resolvedCallType} call...`,
            from,
            initiator: call.initiator,
            receiver: call.receiver,
            requestedAt: call.requestedAt,
            expiresAt: call.expiresAt,
          });
          launchedFromCallPushRef.current = Boolean(
            await AsyncStorage.getItem('pendingIncomingCallPush'),
          );
          setShowIncomingModal(true);
        }
      } catch (err) {}
    };
    if (isFocused && counselorId) {
      fetchIncoming();
      intervalId = setInterval(fetchIncoming, 5000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isFocused, counselorId, showIncomingModal, isVideoModalOpen, isVoiceModalOpen]);

  useEffect(() => {
    if (showIncomingModal && !isVideoModalOpen && !isVoiceModalOpen && isFocused) {
      startRinging(true);
    } else {
      stopRinging();
    }
    return () => stopRinging();
  }, [showIncomingModal, isVideoModalOpen, isVoiceModalOpen, isFocused]);

  useEffect(() => {
    if (!showIncomingModal || !incomingCallData?.callId) return undefined;

    const timeoutId = setTimeout(async () => {
      const shouldExitAfterCall = launchedFromCallPushRef.current;
      launchedFromCallPushRef.current = false;
      stopRinging();
      setShowIncomingModal(false);
      await displayMissedCallNotification(incomingCallData, 'missed');
      await AsyncStorage.removeItem('pendingIncomingCallPush');
      if (shouldExitAfterCall && Platform.OS === 'android') {
        setTimeout(() => BackHandler.exitApp(), 100);
      }
    }, INCOMING_RING_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [showIncomingModal, incomingCallData?.callId, stopRinging]);

  useEffect(() => {
    if (!isSocketConnected && selectedUser && counselorId) {
      const interval = setInterval(() => {
        // Skip if we just deleted a message — let the server confirm first.
        if (!deletedRecentlyRef.current) fetchMessagesFromAPI();
      }, 45000);
      return () => clearInterval(interval);
    }
  }, [isSocketConnected, selectedUser, counselorId]);

  useEffect(() => {
    if (callError) setTimeout(() => setCallError(null), 5000);
  }, [callError]);

  // ─── Scroll handling ─────────────────────────────────────────────────────
  const messagesForList = useMemo(() => {
    const merged = getMergedTimeline();
    // inject day-separator sentinels
    const withDays = [];
    let lastDay = null;
    merged.forEach((item) => {
      const day = getItemDayKey(item);
      if (day && day !== lastDay) {
        withDays.push({ id: `day_${day}`, isDaySeparator: true, label: formatItemDay(item) });
        lastDay = day;
      }
      withDays.push(item);
    });
    return [...withDays].reverse();
  }, [getMergedTimeline]);
  const scrollToBottom = useCallback((animated = true) => {
    messagesContainerRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);
  const preserveComposerFocusForSend = useCallback(() => {
    sendFocusGuardRef.current = true;
    focusRestoreTimersRef.current.forEach(clearTimeout);
    focusRestoreTimersRef.current = [0, 60, 160, 320].map((delay) =>
      setTimeout(() => {
        if (sendFocusGuardRef.current) messageInputRef.current?.focus();
      }, delay),
    );
  }, []);
  const finishComposerFocusForSend = useCallback(() => {
    focusRestoreTimersRef.current.forEach(clearTimeout);
    focusRestoreTimersRef.current = [0, 80, 180].map((delay) =>
      setTimeout(() => {
        if (sendFocusGuardRef.current) messageInputRef.current?.focus();
      }, delay),
    );
    focusRestoreTimersRef.current.push(
      setTimeout(() => {
        sendFocusGuardRef.current = false;
      }, 260),
    );
  }, []);
  useEffect(() => () => {
    focusRestoreTimersRef.current.forEach(clearTimeout);
    focusRestoreTimersRef.current = [];
  }, []);
  const handleContentSizeChange = useCallback(() => {
    if (shouldAutoScrollRef.current) scrollToBottom(initialLoadDoneRef.current);
    initialLoadDoneRef.current = true;
  }, [scrollToBottom]);
  const handleScroll = useCallback((e) => {
    const { contentOffset } = e.nativeEvent;
    shouldAutoScrollRef.current = contentOffset.y <= 120;
  }, []);

  useEffect(() => {
    // Android uses adjustNothing for the activity, so lift the composer by the
    // measured keyboard height instead of relying on a full-window resize.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (event) => {
      keyboardVisibleRef.current = true;
      if (Platform.OS === 'android') {
        const keyboardHeight = event?.endCoordinates?.height || 0;
        setKeyboardInset(Math.max(0, keyboardHeight - insets.bottom));
      }
      if (shouldAutoScrollRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
        setTimeout(() => scrollToBottom(true), 120);
      }
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      keyboardVisibleRef.current = false;
      if (Platform.OS === 'android') setKeyboardInset(0);
      if (sendFocusGuardRef.current) {
        requestAnimationFrame(() => messageInputRef.current?.focus());
        return;
      }
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [insets.bottom, scrollToBottom]);

  // ─── Render functions ────────────────────────────────────────────────────
  const renderMessageStatus = (msg) => {
    if (msg.sender !== "me") return null;
    switch (msg.status) {
      case "sending": return <Text style={styles.messageStatusSending}>⌛</Text>;
      case "sent": return (
        <View style={styles.messageStatusIconWrap}>
          <Ionicons
            name={msg.isRead ? "checkmark-done" : "checkmark"}
            size={15}
            color={msg.isRead ? "#1687D9" : "#64748B"}
          />
        </View>
      );
      case "error": return <Text style={styles.messageStatusError}>⚠️ Failed</Text>;
      default: return null;
    }
  };

  // WhatsApp-style call entry shown inline in the chat thread.
  const renderCallItem = (item) => {
    const { isOutgoing, isAlert, statusLabel, durationText } = describeCall(item);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => confirmDeleteCall(item)}
        style={[styles.callRow, isOutgoing ? styles.msgRowRight : styles.msgRowLeft]}
      >
        <View style={[styles.callBubble, isOutgoing ? styles.callBubbleOut : styles.callBubbleIn]}>
          <View style={[styles.callIconCircle, isAlert && styles.callIconCircleAlert]}>
            <Ionicons
              name={item.type === "video" ? "videocam" : "call"}
              size={18}
              color={isAlert ? "#ef4444" : "#1D4ED8"}
            />
          </View>
          <View style={styles.callTextWrap}>
            <Text style={styles.callTitle}>
              {isOutgoing ? "Outgoing" : "Incoming"} {item.type === "video" ? "video" : "voice"} call
            </Text>
            <View style={styles.callMetaRow}>
              <Ionicons
                name={isAlert ? "close-circle" : isOutgoing ? "arrow-up-outline" : "arrow-down-outline"}
                size={12}
                color={isAlert ? "#ef4444" : "#64748b"}
              />
              <Text style={[styles.callMeta, isAlert && styles.callMetaAlert]}>
                {statusLabel}{durationText ? ` · ${durationText}` : ""}
              </Text>
            </View>
          </View>
          <Text style={styles.callTime}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }) => {
    if (item.isDaySeparator) {
      return (
        <View style={styles.daySeparatorRow}>
          <Text style={styles.daySeparatorLabel}>{t(item.label)}</Text>
        </View>
      );
    }

    if (item.isCall) {
      return renderCallItem(item);
    }

    const isMe = item.sender === "me";
    const messageId = getMessageIdentifier(item);
    const isDeleting = String(deletingMessageId) === String(messageId);
    const canDelete = !!messageId && !item.isTemporary && item.status !== "sending" && item.status !== "error";

    const url = getAttachmentUrl(item);
    const hasAttachment = !!(item.attachmentName || item.attachmentUrl);
    const isImage = hasAttachment && isImageAttachment(item) && url;

    // Human-readable file meta: "2.4 MB • PDF"
    const fileName = item.attachmentName || 'Attachment';
    const ext = (fileName.split('.').pop() || '').toUpperCase();
    const sizeBytes = Number(item.attachmentSize || item.fileSize || 0);
    const sizeLabel =
      sizeBytes > 0
        ? sizeBytes >= 1024 * 1024
          ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
        : '';
    const fileMeta = [sizeLabel, ext].filter(Boolean).join(' • ');

    // For image messages the server stores the file name as the text content.
    // Never show that as a caption — only show a real, user-typed caption.
    const looksLikeFilename = (txt) => {
      const s = String(txt || '').trim();
      if (!s) return false;
      return s === (item.attachmentName || '') ||
        /\.(jpe?g|png|gif|webp|heic|heif|pdf|docx?|xlsx?|pptx?|zip|mp4|mov|mp3)(\?|$)/i.test(s);
    };
    const showCaption = !!item.text && !looksLikeFilename(item.text);
    const isImageOnly = isImage && !showCaption;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {/* Plain text / image bubble — sent = earnings gradient, received = white */}
        {(showCaption || isImage) && (() => {
          // Image-only: NO bubble background — just the rounded photo itself
          // (professional, WhatsApp-style). Tap to open, long-press to delete.
          if (isImageOnly) {
            return (
              <Pressable
                onPress={() => openAttachment(url)}
                onLongPress={() => canDelete && handleDeleteMessage(item)}
                style={styles.imageOnlyWrap}
              >
                <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
              </Pressable>
            );
          }
          const inner = (
            <>
              {showCaption && (
                <TranslatedMessageBubble
                  text={item.text}
                  style={[styles.messageText, isMe ? styles.userMessageText : styles.counselorMessageText]}
                />
              )}
              {isImage && (
                <TouchableOpacity onPress={() => openAttachment(url)} activeOpacity={0.9}>
                  <Image
                    source={{ uri: url }}
                    style={[styles.attachmentImage, showCaption && styles.attachmentImageCaption]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            </>
          );
          return isMe ? (
            <Pressable onLongPress={() => canDelete && handleDeleteMessage(item)} style={styles.bubbleMeWrap}>
              <LinearGradient colors={SENT_GRADIENT} start={SENT_GRADIENT_START} end={SENT_GRADIENT_END} style={[styles.bubble, styles.bubbleMe]}>
                {inner}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable style={[styles.bubble, styles.bubbleThem]} onLongPress={() => canDelete && handleDeleteMessage(item)}>
              {inner}
            </Pressable>
          );
        })()}

        {/* File card (non-image attachment) — sent = earnings gradient, received = white */}
        {hasAttachment && !isImage && (() => {
          const inner = (
            <>
              <View style={[styles.fileIconBox, isMe && styles.fileIconBoxMe]}>
                <Ionicons name="document-text" size={20} color={isMe ? '#FFFFFF' : '#2563EB'} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={1}>
                  {fileName}
                </Text>
                {!!fileMeta && (
                  <Text style={[styles.fileMeta, isMe && styles.fileMetaMe]} numberOfLines={1}>
                    {fileMeta}
                  </Text>
                )}
              </View>
              <Ionicons name="download-outline" size={20} color={isMe ? '#FFFFFF' : '#2563EB'} />
            </>
          );
          return isMe ? (
            <Pressable style={styles.bubbleMeWrap} onPress={() => openAttachment(url)} onLongPress={() => canDelete && handleDeleteMessage(item)}>
              <LinearGradient colors={SENT_GRADIENT} start={SENT_GRADIENT_START} end={SENT_GRADIENT_END} style={[styles.fileCard, styles.fileCardMe]}>
                {inner}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable style={[styles.fileCard, styles.fileCardThem]} onPress={() => openAttachment(url)} onLongPress={() => canDelete && handleDeleteMessage(item)}>
              {inner}
            </Pressable>
          );
        })()}

        {/* Timestamp + read receipt OUTSIDE the bubble */}
        <View style={[styles.msgMeta, isMe ? styles.msgMetaRight : styles.msgMetaLeft]}>
          <Text style={styles.msgTime}>{item.time}</Text>
          {isMe && renderMessageStatus(item)}
        </View>
      </View>
    );
  };

  const handleBack = () => navigation.goBack();
  const handleCloseModal = () => {
    setIsVideoModalOpen(false);
    setIsVoiceModalOpen(false);
    setSelectedCall(null);
    setCallError(null);
    // A call just ended — refresh so the new call entry appears in the thread.
    loadCallHistory();
  };

  if (!selectedUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>{t('No user selected')}</Text>
            <Text style={styles.emptyText}>{t('Please select a user from the list to start messaging')}</Text>
            <CounselorGradientButton style={styles.backToListBtn} onPress={handleBack}>
              <Text style={styles.backToListBtnText}>← Back to SMS List</Text>
            </CounselorGradientButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        contentContainerStyle={styles.keyboardAvoidContent}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={0}
      >
          <View style={styles.chatBoxMain}>
          {/* Header — white bg, blue icons (matches Figma). Long-press the name for Refresh/Clear. */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-back" size={24} color="#2563EB" />
              </TouchableOpacity>
              <Pressable style={styles.userInfo} onLongPress={() => setShowOptions(true)}>
                <View style={styles.userAvatarWrapper}>
                  <ChatAvatar
                    avatarUrl={userDetails.avatarUrl}
                    avatar={userDetails.avatar}
                    name={USER_NAME}
                    size={40}
                    style={{ borderWidth: 2, borderColor: '#FFFFFF' }}
                  />
                  <View style={[styles.activeDot, { backgroundColor: resolveOnlineStatus(selectedUser) ? "#22C55E" : "#9CA3AF" }]} />
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName} numberOfLines={1}>{USER_NAME}</Text>
                  <Text style={styles.profileStatus}>
                    {remoteIsTyping ? (
                      <Text style={styles.typingText}>{t('Typing...')}</Text>
                    ) : (
                      <Text style={[
                        styles.statusText,
                        resolveOnlineStatus(selectedUser) && styles.statusTextOnline,
                      ]}>
                        {resolveOnlineStatus(selectedUser) ? "Online" : "Offline"}
                      </Text>
                    )}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View style={styles.callButtons}>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.actionBtnDisabled]} onPress={initiateVideoCall} disabled={isInitiatingCall}>
                <Ionicons name="videocam-outline" size={24} color="#004AC6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, isInitiatingCall && styles.actionBtnDisabled]} onPress={initiateVoiceCall} disabled={isInitiatingCall}>
                <Ionicons name="call-outline" size={22} color="#004AC6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowOptions(true)}>
                <Ionicons name="ellipsis-vertical" size={22} color="#004AC6" />
              </TouchableOpacity>
            </View>
          </View>

          {callError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
              <Text style={styles.errorText}>{callError}</Text>
              <TouchableOpacity onPress={() => setCallError(null)}><Ionicons name="close" size={20} color="#ba1a1a" /></TouchableOpacity>
            </View>
          )}

          {/* Options Modal */}
          <Modal transparent visible={showOptions} animationType="fade" onRequestClose={() => setShowOptions(false)}>
            <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
              <View style={styles.optionsMenu}>
                <TouchableOpacity style={styles.optionItem} onPress={() => { fetchMessagesFromAPI(); setShowOptions(false); }}>
                  <Ionicons name="refresh" size={18} color="#526071" />
                  <Text style={styles.optionText}>{t('Refresh Messages')}</Text>
                </TouchableOpacity>
                {canIssuePrescription ? (
                  <TouchableOpacity style={styles.optionItem} onPress={handleOpenPrescription}>
                    <Ionicons name="medical-outline" size={18} color="#004AC6" />
                    <Text style={styles.optionText}>Prescription</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.optionItem} onPress={handleRecommendPsychiatrist}>
                    <Ionicons name="person-add-outline" size={18} color="#004AC6" />
                    <Text style={styles.optionText}>Recommend Psychiatrist</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.optionItem, styles.optionItemLast]} onPress={() => { setShowOptions(false); clearChat(); }}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text style={[styles.optionText, styles.optionTextDanger]}>{t('Clear Chat')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          <Modal transparent={false} visible={showPsychiatristPicker} animationType="slide" onRequestClose={() => setShowPsychiatristPicker(false)}>
            <SafeAreaView style={styles.psychiatristModalSafe}>
              <PsychiatristDirectory
                title="Psychiatrists"
                subtitle={`Choose psychiatrist for ${USER_NAME || 'this patient'}`}
                selectLabel="Recommend"
                selectDisabled={recommendingPsychiatrist}
                onClose={() => setShowPsychiatristPicker(false)}
                onSelect={handleSelectPsychiatrist}
              />
            </SafeAreaView>
          </Modal>

          <Modal transparent visible={showPrescriptionModal} animationType="slide" onRequestClose={() => !issuingPrescription && setShowPrescriptionModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.prescriptionOverlay}>
              <View style={[styles.prescriptionSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                <View style={styles.prescriptionHeader}>
                  <View>
                    <Text style={styles.prescriptionKicker}>Patient prescription</Text>
                    <Text style={styles.prescriptionTitle}>Create Prescription</Text>
                    <Text style={styles.prescriptionPatient}>For {USER_NAME}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowPrescriptionModal(false)} disabled={issuingPrescription} style={styles.prescriptionClose}>
                    <Ionicons name="close" size={22} color="#475569" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.rxLabel}>Patient problem *</Text>
                  <TextInput
                    style={[styles.rxInput, styles.rxTextArea]}
                    value={prescriptionProblem}
                    onChangeText={setPrescriptionProblem}
                    placeholder="Describe the patient's problem or diagnosis"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />

                  {prescriptionMedicines.map((medicine, index) => (
                    <View key={`medicine-${index}`} style={styles.medicineForm}>
                      <View style={styles.medicineFormHeader}>
                        <Text style={styles.medicineFormTitle}>Medicine {index + 1}</Text>
                        {prescriptionMedicines.length > 1 && (
                          <TouchableOpacity
                            onPress={() => setPrescriptionMedicines(prev => prev.filter((_, i) => i !== index))}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.rxLabel}>Medicine name *</Text>
                      <TextInput
                        style={styles.rxInput}
                        value={medicine.medicineName}
                        onChangeText={(value) => updatePrescriptionMedicine(index, 'medicineName', value)}
                        placeholder="Medicine name"
                        placeholderTextColor="#94A3B8"
                      />

                      <Text style={styles.rxLabel}>Dosage *</Text>
                      <TextInput
                        style={styles.rxInput}
                        value={medicine.dosage}
                        onChangeText={(value) => updatePrescriptionMedicine(index, 'dosage', value)}
                        placeholder="e.g. 10 mg"
                        placeholderTextColor="#94A3B8"
                      />

                      <Text style={styles.rxLabel}>Time of day *</Text>
                      <View style={styles.timeChipRow}>
                        {['Morning', 'Afternoon', 'Evening', 'Night'].map((slot) => {
                          const active = Boolean(medicine.timeOfDay?.[slot]);
                          return (
                            <TouchableOpacity
                              key={slot}
                              style={[styles.timeChip, active && styles.timeChipActive]}
                              onPress={() => toggleMedicineTime(index, slot)}
                            >
                              <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{slot}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={styles.rxLabel}>When to take *</Text>
                      <TextInput
                        style={styles.rxInput}
                        value={medicine.whenToTake}
                        onChangeText={(value) => updatePrescriptionMedicine(index, 'whenToTake', value)}
                        placeholder="e.g. After breakfast and dinner"
                        placeholderTextColor="#94A3B8"
                      />

                      <Text style={styles.rxLabel}>Duration</Text>
                      <TextInput
                        style={styles.rxInput}
                        value={medicine.duration}
                        onChangeText={(value) => updatePrescriptionMedicine(index, 'duration', value)}
                        placeholder="e.g. 14 days"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  ))}

                  <TouchableOpacity style={styles.addMedicineBtn} onPress={() => setPrescriptionMedicines(prev => [...prev, createBlankMedicine()])}>
                    <Ionicons name="add-circle-outline" size={18} color="#004AC6" />
                    <Text style={styles.addMedicineText}>Add another medicine</Text>
                  </TouchableOpacity>

                  <Text style={styles.rxLabel}>Instructions</Text>
                  <TextInput
                    style={[styles.rxInput, styles.rxTextArea]}
                    value={prescriptionInstructions}
                    onChangeText={setPrescriptionInstructions}
                    placeholder="Additional instructions for the patient"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />

                  <View style={styles.prescriptionActions}>
                    <TouchableOpacity style={styles.rxCancelBtn} onPress={() => setShowPrescriptionModal(false)} disabled={issuingPrescription}>
                      <Text style={styles.rxCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.rxSendBtn, issuingPrescription && styles.rxSendBtnDisabled]} onPress={handleIssuePrescription} disabled={issuingPrescription}>
                      {issuingPrescription ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.rxSendText}>Send Prescription</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Messages */}
          {!timelineReady ? (
            <ChatSkeleton role="counselor" />
          ) : error && messages.length === 0 ? (
            <View style={styles.errorMessage}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchMessagesFromAPI}><Text style={styles.retryBtn}>{t('Retry')}</Text></TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={messagesContainerRef}
              style={styles.messagesArea}
              data={messagesForList}
              keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              inverted
              ListHeaderComponent={remoteIsTyping ? (
                <View style={styles.typingContainer}>
                  <View style={styles.typingDots}><View style={styles.typingDot} /><View style={[styles.typingDot, styles.typingDotDelay1]} /><View style={[styles.typingDot, styles.typingDotDelay2]} /></View>
                  <Text style={styles.typingLabel}>{USER_NAME} is typing...</Text>
                </View>
              ) : null}
              ListEmptyComponent={
                <View style={styles.emptyMessages}>
                  <Text style={styles.emptyMessagesIcon}>💬</Text>
                  <Text style={styles.emptyMessagesText}>{t('No messages yet')}</Text>
                  <Text style={styles.emptyMessagesSubtext}>{t('Start a conversation by sending a message')}</Text>
                </View>
              }
            />
          )}

          {/* Input */}
          <View style={[
            styles.inputArea,
            {
              // SafeAreaView owns the bottom system inset. Android gets a
              // measured keyboard margin so the composer stays above the IME.
              paddingBottom: 8,
              marginBottom: Platform.OS === 'android' ? keyboardInset : 0,
            },
          ]}>
            <View style={styles.inputAreaInner}>
              {pendingAttachment && (
                <View style={styles.attachmentPreview}>
                  <Ionicons name="attach" size={16} color="#2563EB" />
                  <Text style={styles.attachmentPreviewText} numberOfLines={1}>{t(pendingAttachment.name)}</Text>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity>
                </View>
              )}
              <View style={styles.inputGroup}>
                <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment} disabled={isSending}>
                  <Ionicons name="add" size={22} color="#2563EB" />
                </TouchableOpacity>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={messageInputRef}
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#8492a5"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    blurOnSubmit={false}
                    showSoftInputOnFocus
                    onBlur={() => {
                      if (sendFocusGuardRef.current) {
                        requestAnimationFrame(() => messageInputRef.current?.focus());
                      }
                    }}
                  />
                  <MicButton
                    isListening={isVoiceTyping}
                    onPress={handleVoiceTypingPress}
                    disabled={isSending || !voiceTypingAvailable}
                    color="#2563EB"
                    backgroundColor="#EFF6FF"
                    size={34}
                    iconSize={18}
                    style={styles.inputMicBtn}
                  />
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPressIn={() => {
                    if ((message.trim() || pendingAttachment) && !isSending) {
                      preserveComposerFocusForSend();
                    } else {
                      messageInputRef.current?.focus();
                    }
                  }}
                  onPress={handleSendMessage}
                >
                  <LinearGradient
                    colors={(message.trim() || pendingAttachment) && !isSending ? SENT_GRADIENT : ['#A8B9D6', '#A8B9D6']}
                    start={SENT_GRADIENT_START}
                    end={SENT_GRADIENT_END}
                    style={[styles.sendBtn, (message.trim() || pendingAttachment) && !isSending ? styles.sendBtnActive : styles.sendBtnDisabled]}
                  >
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <VideoCallModal isOpen={isVideoModalOpen} onClose={handleCloseModal} callData={selectedCall} currentUser={{ id: counselorId, role: "counsellor" }} onEndCall={handleEndIncomingCall} />
        <VoiceCallModal isOpen={isVoiceModalOpen} onClose={handleCloseModal} callData={selectedCall} currentUser={{ id: counselorId, role: "counsellor" }} onEndCall={handleEndIncomingCall} />
        <IncomingCallModal isOpen={isFocused && showIncomingModal} onClose={() => setShowIncomingModal(false)} callType={incomingCallData.callType} callerName={incomingCallData.name} callerAvatar={incomingCallData.image || incomingCallData.avatar} callData={incomingCallData} onJoinCall={handleJoinIncomingCall} onRejectCall={handleRejectIncomingCall} />
        <ZoomableImageViewer
          visible={imagePreviewVisible}
          uri={imagePreviewUrl}
          onClose={() => setImagePreviewVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
  keyboardAvoidContent: { flex: 1 },
  chatBoxMain: { flex: 1, backgroundColor: '#EFF6FF' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF', borderRadius: 20, margin: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  emptyIcon: { fontSize: 56, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  backToListBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, shadowColor: '#004AC6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  backToListBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, minWidth: 0 },
  userAvatarWrapper: { position: 'relative', width: 40, height: 40 },
  activeDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5, borderColor: '#FFFFFF' },
  userDetails: { flex: 1, minWidth: 0 },
  userName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 1 },
  profileStatus: { fontSize: 11 },
  statusText: { color: '#6B7280', fontWeight: '600' },
  statusTextOnline: { color: '#22C55E' },
  typingText: { color: '#BFDBFE', fontWeight: '600' },
  callButtons: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  actionBtnDisabled: { opacity: 0.4 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 12, gap: 8 },
  errorIcon: { fontSize: 16, marginRight: 6 },
  errorText: { flex: 1, color: '#DC2626', fontSize: 12, fontWeight: '500' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#F1F5F9' },
  loadingText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  messagesArea: { flex: 1, width: '100%', backgroundColor: '#F1F5F9' },
  messagesList: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 16, gap: 6, flexGrow: 1 },
  daySeparatorRow: { alignItems: 'center', marginVertical: 14 },
  daySeparatorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#E8EDF5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },

  /* ── Figma chat bubbles ── */
  msgRow: { width: '100%', marginBottom: 14 },
  msgRowLeft: { alignItems: 'flex-start' },
  msgRowRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: screenWidth >= 600 ? 500 : '82%',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleMeWrap: { maxWidth: screenWidth >= 600 ? 500 : '82%' },
  bubbleMe: {
    borderBottomRightRadius: 6,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  msgMetaLeft: { alignSelf: 'flex-start', marginLeft: 4 },
  msgMetaRight: { alignSelf: 'flex-end', marginRight: 4 },
  msgTime: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500' },

  /* ── File attachment card ── */
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: screenWidth >= 600 ? 500 : '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  fileCardThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fileCardMe: { borderBottomRightRadius: 6 },
  fileIconBox: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: '#E8EFFB', alignItems: 'center', justifyContent: 'center',
  },
  fileIconBoxMe: { backgroundColor: 'rgba(255,255,255,0.22)' },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  fileNameMe: { color: '#FFFFFF' },
  fileMeta: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
  fileMetaMe: { color: 'rgba(255,255,255,0.8)' },
  errorMessage: { alignItems: 'center', paddingTop: 80, backgroundColor: '#F8FAFC' },
  retryBtn: { marginTop: 16, color: '#2563EB', fontWeight: '600', fontSize: 14 },
  emptyMessages: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyMessagesIcon: { fontSize: 48, marginBottom: 16, opacity: 0.4 },
  emptyMessagesText: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  emptyMessagesSubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  typingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4, marginLeft: 38, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderRadius: 18, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB', opacity: 0.6 },
  typingDotDelay1: { opacity: 0.4 },
  typingDotDelay2: { opacity: 0.2 },
  typingLabel: { fontSize: 11, color: '#6B7280', fontStyle: 'italic' },
  messageBubble: { width: '100%', marginBottom: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRight: { justifyContent: 'flex-end' },
  messageLeft: { justifyContent: 'flex-start' },
  // ─── Call entry bubble (WhatsApp-style) ───────────────────────────────────
  callRow: { width: '100%', marginBottom: 6 },
  callBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: screenWidth >= 600 ? 500 : '80%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  callBubbleOut: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE', borderBottomRightRadius: 4 },
  callBubbleIn: { borderBottomLeftRadius: 4 },
  callIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E7EDFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIconCircleAlert: { backgroundColor: '#FEE2E2' },
  callTextWrap: { flexShrink: 1 },
  callTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  callMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  callMeta: { fontSize: 12, color: '#64748B' },
  callMetaAlert: { color: '#EF4444', fontWeight: '600' },
  callTime: { fontSize: 11, color: '#94A3B8', alignSelf: 'flex-end' },
  callDeleteBtn: { alignSelf: 'flex-start', padding: 2 },
  messageContent: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-end', justifyContent: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: screenWidth >= 600 ? 500 : '80%' },
  userMessageContent: { backgroundColor: '#1D4ED8', borderBottomRightRadius: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  counselorMessageContent: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  messageText: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  userMessageText: { color: '#FFFFFF' },
  counselorMessageText: { color: '#1E293B' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8, paddingBottom: 1 },
  messageTime: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  messageTimeMine: { color: 'rgba(255,255,255,0.55)' },
  messageStatusSending: { fontSize: 11, color: '#F59E0B', fontWeight: '500' },
  messageStatusIconWrap: { width: 16, alignItems: 'center', justifyContent: 'center' },
  messageStatusError: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
  deleteIconBtn: { paddingHorizontal: 4, paddingVertical: 2, marginLeft: 4 },
  attachmentImage: {
    width: screenWidth >= 600 ? 300 : 236,
    height: screenWidth >= 600 ? 224 : 176,
    borderRadius: 11,
    backgroundColor: '#EEF1F5',
  },
  // Extra gap only when a real caption sits above the image.
  attachmentImageCaption: { marginTop: 8 },
  // Image-only: white card FRAME around the photo (matches the user-side chat).
  imageOnlyWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  attachmentBubble: { marginTop: 8, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  userAttachmentBubble: { backgroundColor: 'rgba(255,255,255,0.15)' },
  counselorAttachmentBubble: { backgroundColor: '#F3F4F6' },
  attachmentBubbleText: { fontSize: 12, fontWeight: '600', flex: 1 },
  userAttachmentBubbleText: { color: '#FFFFFF' },
  counselorAttachmentBubbleText: { color: '#374151' },
  inputArea: { width: '100%', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 8 },
  inputAreaInner: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  attachmentPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 8 },
  attachmentPreviewText: { flex: 1, color: '#111827', fontSize: 12, fontWeight: '500' },
  inputGroupDisabled: { opacity: 0.7 },
  inputGroup: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  attachBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8EFFB' },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 44,
    position: 'relative',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 42,
    maxHeight: 120,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  inputMicBtn: {
    position: 'absolute',
    right: 5,
    bottom: 4,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  sendBtnActive: { shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 5, elevation: 5 },
  sendBtnDisabled: { backgroundColor: '#CBD5E1', opacity: 0.7 },
  incomingCallScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  incomingCallHeader: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
  },
  incomingCallKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: DOCTOR.primary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  incomingCallerName: {
    width: '100%',
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  incomingCallLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '90%',
  },
  incomingCallLocation: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  incomingCallAvatarZone: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingCallRingLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#DDEBFF',
  },
  incomingCallRingSmall: {
    position: 'absolute',
    width: 178,
    height: 178,
    borderRadius: 89,
    borderWidth: 2,
    borderColor: '#EAF2FF',
  },
  incomingCallerAvatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: DOCTOR.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  incomingAvatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitialLarge: { fontSize: 56, fontWeight: '800', color: '#FFFFFF' },
  incomingCallMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  incomingCallType: { fontSize: 14, color: '#64748B', fontWeight: '700' },
  incomingCallControls: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  incomingCallActionCol: {
    alignItems: 'center',
    gap: 11,
  },
  incomingCallBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 7,
  },
  acceptBtn: { backgroundColor: '#16A34A' },
  rejectBtn: { backgroundColor: '#DC2626' },
  callEndIcon: { transform: [{ rotate: '135deg' }] },
  incomingCallBtnLabel: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  // Options Menu Styles
  psychiatristModalSafe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 16,
  },
  optionsMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    minWidth: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f6',
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
  },
  optionTextDanger: {
    color: '#dc2626',
  },
  prescriptionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  prescriptionSheet: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  prescriptionKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: DOCTOR.primary,
    textTransform: 'uppercase',
  },
  prescriptionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  prescriptionPatient: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  prescriptionClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#334155',
    marginBottom: 7,
    marginTop: 10,
  },
  rxInput: {
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  rxTextArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  medicineForm: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medicineFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  medicineFormTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  timeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChipActive: {
    backgroundColor: '#EAF2FF',
    borderColor: DOCTOR.primary,
  },
  timeChipText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  timeChipTextActive: {
    color: DOCTOR.primary,
  },
  addMedicineBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addMedicineText: {
    color: DOCTOR.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  prescriptionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  rxCancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxCancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '900',
  },
  rxSendBtn: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: DOCTOR.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxSendBtnDisabled: {
    opacity: 0.65,
  },
  rxSendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  // Image Preview Modal Styles
});

export default SMSInput;
