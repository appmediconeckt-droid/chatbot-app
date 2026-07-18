import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from 'react-i18next';
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
  Keyboard,
  Platform,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  PermissionsAndroid,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import axiosInstance, { API_BASE_URL, AI_REALTIME_BASE_URL } from "../../../../../axiosConfig";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "@stream-io/react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary } from "react-native-image-picker";
import socketService from "../../../../../services/socketService";
import Icon from "react-native-vector-icons/FontAwesome5";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from "@react-native-community/blur";
import safeVibrate from "../../../../../utils/safeVibrate";
import { forceStopRingtone, startIncomingRingtone } from "../../../../../hooks/useRingtone";
import ChatInterface from "../Tab/chatbot/ChatInterface";
import CounselorTable from "../Tab/Appointment/BookAppointment";
import WalletDashboard from "../Tab/Wallet/WalletDashboard";
import CallHistory from "../Tab/Callls/CallHistory";
import PatientProfile from "../../PatientProfile/PatientProfile";
import AvatarPicker from "../../PatientProfile/AvatarPicker";
import LanguageSelector from '../../../../../components/common/LanguageSelector';
import RatingPrompt from '../../../../../components/RatingPrompt';
import { loadUserLanguage } from '../../../../../i18n';
import PATIENT from '../../../../../theme/palette';
import RealVideoCallModal from "../Tab/CallModal/VideoCallModal";
import RealVoiceCallModal from "../Tab/CallModal/VoiceCallModal";
import HelpSupport from "../Tab/HelpSupport/HelpSupport";
import PrivacyPolicy from "../Tab/PrivacyPolicy/PrivacyPolicy";
import NotificationScreen from "../Tab/Notifications/NotificationScreen";
import UserAccountSettings from "../Tab/UserAccountSettings";

const { width, height } = Dimensions.get("window");

const AI_WELCOME_MESSAGE = "Hi! Welcome back 💙 How are you feeling right now?";
const AI_WELCOME_QUICK_REPLIES = ["😢 Low", "😐 Okay", "🙂 Good", "✨ Great"];

// Improved ChatPopup Component
const VOICE_LANGUAGES = [
  { label: 'English (India)', code: 'en-IN' },
  { label: 'English (US)', code: 'en-US' },
  { label: 'Hindi', code: 'hi-IN' },
  { label: 'Tamil', code: 'ta-IN' },
  { label: 'Telugu', code: 'te-IN' },
  { label: 'Kannada', code: 'kn-IN' },
  { label: 'Malayalam', code: 'ml-IN' },
  { label: 'Bengali', code: 'bn-IN' },
  { label: 'Gujarati', code: 'gu-IN' },
  { label: 'Marathi', code: 'mr-IN' },
];

const ChatPopup = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  isLoading,
  onClose,
  onReset,
  showResetConfirm,
  onCancelReset,
  onConfirmReset,
  onCounselorPress,
  sendQuickReply,
  selectedLang,
  setSelectedLang,
  onLangChange,
  userPhoto,
}) => {
  const [speakingId, setSpeakingId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [aiAttachment, setAiAttachment] = useState(null);

  const pickAiAttachment = useCallback(() => {
    launchImageLibrary({ mediaType: "photo", quality: 0.8 }, (res) => {
      if (res.didCancel || res.errorCode || !res.assets?.[0]?.uri) return;
      setAiAttachment(res.assets[0].uri);
    });
  }, []);

  const handleAiSend = useCallback(() => {
    const text = (newMessage || "").trim();
    if (!text && !aiAttachment) return;
    sendMessage(text, aiAttachment || null);
    setAiAttachment(null);
  }, [newMessage, aiAttachment, sendMessage]);
  // Keyboard height reported by the event (0 when hidden).
  const [keyboardShownHeight, setKeyboardShownHeight] = useState(0);
  // Measured popup-overlay height (via onLayout) + the largest we've seen
  // (= the keyboard-hidden height). The difference tells us how much Android
  // already shrank the window for the keyboard, so we don't double-lift.
  const [overlayHeight, setOverlayHeight] = useState(height);
  const fullOverlayHeightRef = useRef(height);
  const handleOverlayLayout = useCallback((e) => {
    const h = e?.nativeEvent?.layout?.height || 0;
    if (!h) return;
    setOverlayHeight(h);
    if (h > fullOverlayHeightRef.current) fullOverlayHeightRef.current = h;
  }, []);
  const overlayShrink = Math.max(0, fullOverlayHeightRef.current - overlayHeight);
  // How much the keyboard still overlaps the popup after any OS resize: ~0 on
  // devices that resize (no gap), = keyboard height when it floats over the app.
  const keyboardHeight = keyboardShownHeight > 0
    ? Math.max(0, keyboardShownHeight - overlayShrink)
    : 0;
  const availHeight = overlayHeight;

  // Detect tablet: width >= 600 is typically tablet range
  const isTablet = width >= 600;
  const popupBaseHeight = isTablet ? 750 : 630;
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [aiVoiceOpen, setAiVoiceOpen] = useState(false);
  const [aiVoiceStatus, setAiVoiceStatus] = useState("idle");
  const [aiVoiceTime, setAiVoiceTime] = useState(0);
  const [aiVoiceMuted, setAiVoiceMuted] = useState(false);
  const [aiVoiceSpeakerOn, setAiVoiceSpeakerOn] = useState(true);
  const [aiVoiceError, setAiVoiceError] = useState(null);
  const [aiVoiceTranscript, setAiVoiceTranscript] = useState([]);
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const sendMessageRef = useRef(sendMessage);
  const setNewMessageRef = useRef(setNewMessage);
  const aiVoicePcRef = useRef(null);
  const aiVoiceMicStreamRef = useRef(null);
  const aiVoiceDataChannelRef = useRef(null);
  const aiVoiceTimerRef = useRef(null);
  const micPulse = useRef(new Animated.Value(1)).current;
  // AI voice orb + waveform animations
  const orbPulse = useRef(new Animated.Value(0)).current;
  const WAVE_COUNT = 13;
  const waveAnims = useRef(
    Array.from({ length: WAVE_COUNT }, () => new Animated.Value(0.25))
  ).current;

  // Drive the orb glow + waveform whenever the voice modal is live (not errored).
  useEffect(() => {
    const active = aiVoiceOpen && !aiVoiceError && aiVoiceStatus !== "error";
    if (!active) {
      orbPulse.stopAnimation();
      orbPulse.setValue(0);
      waveAnims.forEach((a) => { a.stopAnimation(); a.setValue(0.25); });
      return;
    }

    const orbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orbPulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    orbLoop.start();

    // Speaking = lively/tall bars, listening/other = calmer.
    const lively = aiVoiceStatus === "speaking" || aiVoiceStatus === "listening";
    const barLoops = waveAnims.map((a, i) => {
      const peak = lively ? (0.5 + Math.random() * 0.5) : (0.3 + Math.random() * 0.25);
      const dur = lively ? (300 + Math.random() * 260) : (600 + Math.random() * 300);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(i * 45),
          Animated.timing(a, { toValue: peak, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.22, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    });
    barLoops.forEach((l) => l.start());

    return () => {
      orbLoop.stop();
      barLoops.forEach((l) => l.stop());
    };
  }, [aiVoiceOpen, aiVoiceStatus, aiVoiceError, orbPulse, waveAnims]);

  const stopAiVoiceTimer = useCallback(() => {
    if (aiVoiceTimerRef.current) {
      clearInterval(aiVoiceTimerRef.current);
      aiVoiceTimerRef.current = null;
    }
  }, []);

  const startAiVoiceTimer = useCallback(() => {
    stopAiVoiceTimer();
    setAiVoiceTime(0);
    aiVoiceTimerRef.current = setInterval(() => {
      setAiVoiceTime((prev) => prev + 1);
    }, 1000);
  }, [stopAiVoiceTimer]);

  const cleanupAiVoiceCall = useCallback((options = {}) => {
    const { closeModal = false, nextStatus = "idle" } = options;

    stopAiVoiceTimer();

    try { aiVoiceDataChannelRef.current?.close?.(); } catch (_) {}
    aiVoiceDataChannelRef.current = null;

    try { aiVoicePcRef.current?.close?.(); } catch (_) {}
    aiVoicePcRef.current = null;

    try {
      aiVoiceMicStreamRef.current?.getTracks?.().forEach((track) => track.stop?.());
    } catch (_) {}
    aiVoiceMicStreamRef.current = null;

    try { InCallManager.setSpeakerphoneOn?.(false); } catch (_) {}
    try { InCallManager.setForceSpeakerphoneOn?.(false); } catch (_) {}
    try { InCallManager.stop(); } catch (_) {}

    setAiVoiceMuted(false);
    setAiVoiceSpeakerOn(true);
    setAiVoiceStatus(nextStatus);
    if (closeModal) {
      setAiVoiceOpen(false);
      setAiVoiceError(null);
      setAiVoiceTranscript([]);
      setAiVoiceTime(0);
    }
  }, [stopAiVoiceTimer]);

  useEffect(() => {
    return () => cleanupAiVoiceCall({ closeModal: true });
  }, [cleanupAiVoiceCall]);

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  useEffect(() => { setNewMessageRef.current = setNewMessage; }, [setNewMessage]);

  // Track how much the keyboard OVERLAPS the app window (not the full keyboard
  // height) so the popup sits right above the keyboard on every device. On
  // tablets where Android resizes the window for the keyboard, the overlap is
  // ~0 (the window already shrank) — using the full height there double-lifted
  // the popup and left a big empty gap. On devices where the keyboard floats
  // over the app, the overlap equals the keyboard height.
  useEffect(() => {
    // iOS fires keyboardWillShow; Android only reliably fires keyboardDidShow.
    // Listen to both so the popup resizes above the keyboard on every device.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      setKeyboardShownHeight(e?.endCoordinates?.height || 0);
    });
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardShownHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Auto-scroll to bottom whenever a new message arrives, AI starts typing,
  // or the keyboard opens (so the latest message stays above the input).
  useEffect(() => {
    const id = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages, isLoading, keyboardShownHeight]);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      micPulse.stopAnimation();
      micPulse.setValue(1);
    }
  }, [isRecording]);

  // Wire up STT listeners from native SpeechModule
  useEffect(() => {
    const Speech = require('../../../../../utils/SpeechBridge');

    const unsubResult = Speech.onSttResult((transcript) => {
      if (transcript) setNewMessageRef.current(transcript);
      setIsRecording(false);
    });
    const unsubStart = Speech.onSttStart(() => setIsRecording(true));
    const unsubEnd = Speech.onSttEnd(() => setIsRecording(false));
    const unsubError = Speech.onSttError((code) => {
      if (code !== 'no-match' && code !== 'timeout') {
        console.warn('[STT] error:', code);
      }
      setIsRecording(false);
    });
    const unsubTts = Speech.onTtsDone(() => setSpeakingId(null));

    Speech.initTts();

    return () => {
      unsubResult(); unsubStart(); unsubEnd(); unsubError(); unsubTts();
      Speech.destroyRecognizer();
      Speech.stopSpeaking();
    };
  }, []);

  // Normalize the app language to a speech-recognition locale. Most app codes are
  // already valid BCP-47 tags (en-US, hi-IN, fr-FR). Bare codes get a region and
  // anything empty falls back to English (India).
  const sttLocale = (code) => {
    const c = String(code || '').replace('_', '-').trim();
    if (!c) return 'en-IN';
    if (c.includes('-')) return c;
    const REGION = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', gu: 'gu-IN', mr: 'mr-IN', pa: 'pa-IN', ur: 'ur-IN' };
    return REGION[c] || c;
  };

  const toggleRecording = async () => {
    const Speech = require('../../../../../utils/SpeechBridge');

    if (isRecording) {
      try { await Speech.stopListening(); } catch (_) {}
      setIsRecording(false);
      return;
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs microphone access for voice input.',
            buttonPositive: 'Allow',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission needed', 'Allow microphone access for voice input.');
          return;
        }
      } catch (err) {
        console.warn('[STT] permission error:', err);
        return;
      }
    }

    try {
      await Speech.destroyRecognizer();
      // Show the recording state immediately (the native "stt-start" event only
      // fires once the user actually begins speaking, which feels unresponsive).
      setIsRecording(true);
      await Speech.startListening(sttLocale(selectedLang));
    } catch (e) {
      console.warn('[STT] start error:', e?.message ?? e);
      setIsRecording(false);
      Alert.alert('Voice Error', e?.message?.includes('available')
        ? 'Speech recognition is not available on this device.'
        : 'Could not start voice input. Please try again.');
    }
  };

  const stopSpeaking = () => {
    const Speech = require('../../../../../utils/SpeechBridge');
    Speech.stopSpeaking().catch(() => {});
    setSpeakingId(null);
  };

  const speakMessage = async (messageId, text) => {
    if (speakingId === messageId) { stopSpeaking(); return; }
    stopSpeaking();
    const Speech = require('../../../../../utils/SpeechBridge');
    setSpeakingId(messageId);
    try {
      await Speech.speakText(text, selectedLang);
    } catch (err) {
      console.warn('[TTS] error:', err?.message ?? err);
      setSpeakingId(null);
    }
  };

  const setAiVoiceSpeakerRoute = (enabled) => {
    try { InCallManager.setSpeakerphoneOn?.(enabled); } catch (_) {}
    try { InCallManager.setForceSpeakerphoneOn?.(enabled); } catch (_) {}
  };

  const formatAiVoiceTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const getAiVoiceStatusText = () => {
    if (aiVoiceError) return "Not connected";
    switch (aiVoiceStatus) {
      case "connecting": return "Connecting…";
      case "listening": return "Listening…";
      case "thinking": return "Thinking…";
      case "speaking": return "Speaking…";
      case "error": return "Not connected";
      default: return "Ready to talk";
    }
  };

  const appendAiVoiceTranscript = (speaker, text) => {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;
    setAiVoiceTranscript((prev) => [
      ...prev.slice(-5),
      { id: `${Date.now()}_${Math.random()}`, speaker, text: cleanText },
    ]);
  };

  const configureAiVoiceTurnDetection = (dataChannel) => {
    if (!dataChannel || dataChannel.readyState !== "open") return;
    dataChannel.send(JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
              create_response: true,
              interrupt_response: true,
            },
          },
        },
      },
    }));
  };

  const handleAiVoiceRealtimeEvent = (event) => {
    switch (event?.type) {
      case "input_audio_buffer.speech_started":
        setAiVoiceStatus("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        setAiVoiceStatus("thinking");
        break;
      case "response.audio.delta":
      case "response.audio_transcript.delta":
        setAiVoiceStatus("speaking");
        break;
      case "conversation.item.input_audio_transcription.completed":
        appendAiVoiceTranscript("You", event.transcript);
        break;
      case "response.audio_transcript.done":
        appendAiVoiceTranscript("AI", event.transcript);
        break;
      case "response.done":
        setAiVoiceStatus("listening");
        break;
      case "error":
        setAiVoiceError("I couldn't connect just now. Please try again.");
        setAiVoiceStatus("error");
        break;
      default:
        break;
    }
  };

  const waitForIceGathering = (pc) => new Promise((resolve) => {
    if (!pc || pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 1600);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeout);
        resolve();
      }
    };
  });

  const requestAiVoiceMicPermission = async () => {
    if (Platform.OS !== "android") return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone Permission",
        message: "This app needs microphone access for AI voice calls.",
        buttonPositive: "Allow",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const startAiVoiceCall = async () => {
    if (aiVoicePcRef.current || aiVoiceStatus === "connecting") return;

    const Speech = require('../../../../../utils/SpeechBridge');
    try { await Speech.stopListening(); } catch (_) {}
    try { await Speech.stopSpeaking(); } catch (_) {}
    setIsRecording(false);
    setSpeakingId(null);

    setAiVoiceOpen(true);
    setAiVoiceStatus("connecting");
    setAiVoiceError(null);
    setAiVoiceTranscript([]);
    setAiVoiceTime(0);

    try {
      const hasPermission = await requestAiVoiceMicPermission();
      if (!hasPermission) {
        throw new Error("Please allow microphone access to start the AI voice call.");
      }

      try { InCallManager.start({ media: "audio" }); } catch (_) {}
      setAiVoiceSpeakerRoute(true);

      const pc = new RTCPeerConnection();
      aiVoicePcRef.current = pc;

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setAiVoiceStatus("listening");
          startAiVoiceTimer();
        }
        if (state === "failed" || state === "disconnected" || state === "closed") {
          if (aiVoicePcRef.current) {
            setAiVoiceError("The voice connection dropped. Please try again.");
            cleanupAiVoiceCall({ nextStatus: "error" });
            setAiVoiceOpen(true);
          }
        }
      };

      pc.ontrack = () => {
        setAiVoiceStatus((prev) => (prev === "connecting" ? "listening" : prev));
      };

      const dataChannel = pc.createDataChannel("oai-events");
      aiVoiceDataChannelRef.current = dataChannel;
      dataChannel.onopen = () => {
        configureAiVoiceTurnDetection(dataChannel);
        setAiVoiceStatus("listening");
        startAiVoiceTimer();
      };
      dataChannel.onmessage = (messageEvent) => {
        try {
          handleAiVoiceRealtimeEvent(JSON.parse(messageEvent.data));
        } catch (parseError) {
          console.warn("[AI Voice] event parse error:", parseError);
        }
      };
      dataChannel.onerror = () => {
        setAiVoiceError("I couldn't connect just now. Please try again.");
        setAiVoiceStatus("error");
      };

      const micStream = await mediaDevices.getUserMedia({ audio: true, video: false });
      aiVoiceMicStreamRef.current = micStream;
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
      const sdp = pc.localDescription?.sdp || offer.sdp || "";
      const response = await fetch(`${AI_REALTIME_BASE_URL}/api/ai/realtime/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          "X-Tunnel-Skip-AntiPhishing-Page": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: sdp,
      });

      const answerSdp = await response.text();
      if (!response.ok) {
        const isHtmlError = /<!doctype html|<html|cannot post/i.test(answerSdp);
        throw new Error(
          isHtmlError
            ? `AI voice route is not available on ${AI_REALTIME_BASE_URL}. Please start/deploy the latest backend.`
            : answerSdp || "Could not start AI voice call."
        );
      }

      await pc.setRemoteDescription(new RTCSessionDescription({
        type: "answer",
        sdp: answerSdp,
      }));
    } catch (error) {
      console.error("[AI Voice] start error:", error);
      setAiVoiceError("I couldn't start voice chat. Please try again.");
      cleanupAiVoiceCall({ nextStatus: "error" });
      setAiVoiceOpen(true);
    }
  };

  const toggleAiVoiceMute = () => {
    const nextMuted = !aiVoiceMuted;
    aiVoiceMicStreamRef.current?.getAudioTracks?.().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setAiVoiceMuted(nextMuted);
  };

  const toggleAiVoiceSpeaker = () => {
    const nextSpeaker = !aiVoiceSpeakerOn;
    setAiVoiceSpeakerRoute(nextSpeaker);
    setAiVoiceSpeakerOn(nextSpeaker);
  };

  return (
  <Modal animationType="slide" transparent={true} visible={true} statusBarTranslucent>
    <View style={styles.chatPopupOverlay} onLayout={handleOverlayLayout}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.chatPopupBackdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.chatPopup, {
        height: keyboardShownHeight > 0
          ? Math.max(availHeight - keyboardHeight - 12, 320)
          : popupBaseHeight,
        marginBottom: keyboardHeight,
      }]}>
        <LinearGradient
          colors={['#2A8A51', '#0E7552']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chatPopupHeader}
        >
          <View style={styles.chatHeaderInfo}>
            <LinearGradient
              colors={['#ffffff', '#f0f0f0']}
              style={[styles.chatAvatar, styles.chatAvatarGradient]}
            >
              <MaterialIcons name="auto-awesome" size={22} color="#2A8A51" />
            </LinearGradient>
            <View>
              <Text style={styles.chatHeaderTitle}>AI Health Assistant</Text>
              <View style={styles.chatStatusRow}>
                <View style={styles.chatStatusDot} />
                <Text style={styles.chatStatus}>Online • Secure</Text>
              </View>
            </View>
          </View>
          <View style={styles.chatHeaderActions}>
            {onReset && (
              <TouchableOpacity
                onPress={onReset}
                style={[styles.chatIconBtn, isLoading && styles.chatIconBtnDisabled]}
                disabled={isLoading}
                accessibilityLabel="Reset chat"
              >
                <MaterialIcons name="refresh" size={20} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={startAiVoiceCall}
              style={[styles.chatIconBtn, aiVoiceStatus === "connecting" && styles.chatIconBtnDisabled]}
              disabled={aiVoiceStatus === "connecting"}
              accessibilityLabel="Start AI voice call"
            >
              {aiVoiceStatus === "connecting" ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialIcons name="call" size={20} color="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.chatIconBtn}
              accessibilityLabel="Close chat"
            >
              <MaterialIcons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatPopupBody}
          contentContainerStyle={styles.chatPopupBodyContent}
        >
          {messages.map((message) => {
            const textParts = String(message.text || "").split(/(\[.*?\])/g);
            const isAiMsg = message.sender === "ai";
            const isSpeaking = speakingId === message.id;

            return (
              <View
                key={message.id}
                style={[
                  styles.chatMessageWrapper,
                  message.sender === "user" && styles.chatMessageWrapperUser,
                ]}
              >
                {isAiMsg && (
                  <LinearGradient
                    colors={['#2A8A51', '#0E7552']}
                    style={[styles.chatAvatar, styles.chatAvatarSmall]}
                  >
                    <MaterialIcons name="auto-awesome" size={14} color="white" />
                  </LinearGradient>
                )}
                <View
                  style={[
                    styles.chatBubbleColumn,
                    message.sender === "user" && styles.chatBubbleColumnUser,
                  ]}
                >
                  <View
                    style={[
                      styles.chatBubble,
                      message.sender === "user" && styles.chatBubbleUser,
                    ]}
                  >
                    {!!message.image && (
                      <Image
                        source={{ uri: message.image }}
                        style={styles.chatBubbleImage}
                        resizeMode="cover"
                      />
                    )}
                    {!!message.text && (
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
                    )}
                    {isAiMsg && Array.isArray(message.quickReplies) && message.quickReplies.length > 0 && (
                      <View style={styles.quickRepliesWrap}>
                        {message.quickReplies.map((reply) => (
                          <TouchableOpacity
                            key={reply}
                            style={[
                              styles.quickReplyBtn,
                              isLoading && styles.quickReplyBtnDisabled,
                            ]}
                            activeOpacity={0.8}
                            disabled={isLoading}
                            onPress={() => sendQuickReply?.(reply)}
                          >
                            <Text style={styles.quickReplyText}>{reply}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  {isAiMsg && (
                    <TouchableOpacity
                      style={styles.speakBtn}
                      onPress={() => speakMessage(message.id, message.text)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={isSpeaking ? "stop-circle" : "volume-up"}
                        size={14}
                        color={isSpeaking ? "#ef4444" : "#2A8A51"}
                      />
                      <Text style={[styles.speakBtnText, isSpeaking && { color: '#ef4444' }]}>
                        {isSpeaking ? "Stop" : "Listen"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {message.sender === "user" && (
                  <View style={[styles.chatAvatar, styles.chatAvatarSmall, styles.userAvatar]}>
                    {userPhoto ? (
                      <Image source={{ uri: userPhoto }} style={{ width: '100%', height: '100%', borderRadius: 999 }} />
                    ) : (
                      <Ionicons name="person-circle" size={18} color="#2A8A51" />
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {isLoading && (
            <View style={[styles.chatMessageWrapper, styles.chatMessageWrapperAi]}>
              <LinearGradient
                colors={['#2A8A51', '#0E7552']}
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

        {aiAttachment && (
          <View style={styles.aiAttachPreview}>
            <Image source={{ uri: aiAttachment }} style={styles.aiAttachThumb} />
            <Text style={styles.aiAttachName} numberOfLines={1}>Photo attached</Text>
            <TouchableOpacity onPress={() => setAiAttachment(null)} hitSlop={8}>
              <MaterialIcons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.chatPopupFooter}>
          {/* + button → attach photo */}
          <TouchableOpacity style={styles.plusBtn} activeOpacity={0.75} onPress={pickAiAttachment}>
            <MaterialIcons name="add" size={22} color="#64748b" />
          </TouchableOpacity>

          {/* Input pill: leading icon + text + mic */}
          <View style={styles.chatInputPill}>
            <MaterialIcons name="auto-awesome" size={17} color="#2A8A51" style={styles.chatInputLead} />
            <TextInput
              ref={inputRef}
              style={styles.chatInput}
              placeholder="Type your question"
              placeholderTextColor="#94a3b8"
              value={newMessage}
              onChangeText={setNewMessage}
              onSubmitEditing={handleAiSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.inlineMicBtn}
              onPress={toggleRecording}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                <MaterialIcons
                  name={isRecording ? "mic" : "mic-none"}
                  size={20}
                  color={isRecording ? "#ef4444" : "#94a3b8"}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Green action button: send when typing/attached, else voice */}
          {(newMessage.trim() || aiAttachment) ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleAiSend}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <MaterialIcons name="send" size={19} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={startAiVoiceCall}
              activeOpacity={0.85}
            >
              <MaterialIcons name="graphic-eq" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
        {showResetConfirm && (
          <View style={styles.resetConfirmOverlay}>
            <View style={styles.resetConfirmCard}>
              <LinearGradient
                colors={['#2A8A51', '#0E7552']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.resetConfirmIcon}
              >
                <MaterialIcons name="refresh" size={26} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.resetConfirmTitle}>Start a fresh chat?</Text>
              <Text style={styles.resetConfirmText}>
                This clears the current AI chat and starts again with the welcome mood options.
              </Text>
              <View style={styles.resetConfirmActions}>
                <TouchableOpacity
                  style={[styles.resetConfirmBtn, styles.resetCancelBtn]}
                  onPress={onCancelReset}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.resetConfirmBtn, styles.resetStartBtn, isLoading && styles.resetBtnDisabled]}
                  onPress={onConfirmReset}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.resetStartText}>
                    {isLoading ? "Starting..." : "Start Fresh"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        <Modal
          animationType="fade"
          transparent={true}
          visible={aiVoiceOpen}
          statusBarTranslucent
          onRequestClose={() => cleanupAiVoiceCall({ closeModal: true })}
        >
          <View style={styles.aiVoiceOverlay}>
            <View style={styles.aiVoiceCard}>
              <View style={styles.aiVoiceOrbWrap}>
                <Animated.View
                  style={[
                    styles.aiVoiceOrbGlowOuter,
                    {
                      opacity: orbPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
                      transform: [{ scale: orbPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.aiVoiceOrbGlowInner,
                    {
                      opacity: orbPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                      transform: [{ scale: orbPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] }) }],
                    },
                  ]}
                />
                <LinearGradient
                  colors={['#2A8A51', '#0E7552', '#00652C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiVoiceAvatar}
                >
                  <MaterialIcons name="mic" size={40} color="#ffffff" />
                </LinearGradient>
              </View>

              <View style={styles.aiVoiceWave}>
                {waveAnims.map((a, i) => (
                  <Animated.View
                    key={i}
                    style={[styles.aiVoiceWaveBar, { transform: [{ scaleY: a }] }]}
                  />
                ))}
              </View>

              <Text style={styles.aiVoiceTitle}>AI Voice Assistant</Text>
              <Text style={styles.aiVoiceStatusText}>{getAiVoiceStatusText()}</Text>
              <Text style={styles.aiVoiceTimer}>{formatAiVoiceTime(aiVoiceTime)}</Text>
              {aiVoiceError ? (
                <View style={styles.aiVoiceErrorBox}>
                  <Text style={styles.aiVoiceErrorText}>{aiVoiceError}</Text>
                  <TouchableOpacity
                    style={styles.aiVoiceRetryBtn}
                    onPress={() => { setAiVoiceError(null); startAiVoiceCall(); }}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="refresh" size={16} color="#ffffff" />
                    <Text style={styles.aiVoiceRetryText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.aiVoiceHint}>
                  Speak when you're ready — I'll reply once you pause.
                </Text>
              )}

              {aiVoiceTranscript.length > 0 && (
                <View style={styles.aiVoiceTranscriptBox}>
                  {aiVoiceTranscript.map((item) => (
                    <Text key={item.id} style={styles.aiVoiceTranscriptText} numberOfLines={2}>
                      <Text style={styles.aiVoiceTranscriptSpeaker}>{item.speaker}: </Text>
                      {item.text}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.aiVoiceControls}>
                <TouchableOpacity
                  style={[styles.aiVoiceControlBtn, aiVoiceMuted && styles.aiVoiceControlBtnActive]}
                  onPress={toggleAiVoiceMute}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={aiVoiceMuted ? "mic-off" : "mic"} size={24} color={aiVoiceMuted ? "#ffffff" : "#334155"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiVoiceControlBtn, aiVoiceSpeakerOn && styles.aiVoiceControlBtnActiveBlue]}
                  onPress={toggleAiVoiceSpeaker}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={aiVoiceSpeakerOn ? "volume-up" : "hearing"} size={24} color={aiVoiceSpeakerOn ? "#ffffff" : "#334155"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiVoiceControlBtn, styles.aiVoiceEndBtn]}
                  onPress={() => cleanupAiVoiceCall({ closeModal: true })}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="call-end" size={26} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  </Modal>
  );
};

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
  const { t } = useTranslation();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Animations: spring scale-in for card, pulse on avatar, three expanding
  // wave rings around the avatar, gentle float on the card, button press scale.
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
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
  }, [isOpen, scaleAnim, pulseAnim, floatAnim, ring1, ring2, ring3]);

  const pressIn = () => Animated.spring(buttonScale, { toValue: 0.92, useNativeDriver: true, tension: 120, friction: 6 }).start();
  const pressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 6 }).start();

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
  const displayInitial = (displayName?.charAt(0) || "C").toUpperCase();
  const isVideo = callType === "video";

  // Expanding ripple rings around the avatar
  const ringStyle = (val) => ({
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] }) }],
    opacity: val.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
  });
  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const callerLocation = callData?.from?.location || callData?.from?.city || null;

  return (
    <Modal transparent={false} visible={isOpen} animationType="fade" onRequestClose={onClose}>
      <View style={styles.callScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* Top — INCOMING CALL / name / location */}
        <Animated.View
          style={[styles.callHeadWrap, { transform: [{ translateY: floatY }] }]}
        >
          <Text style={styles.callKicker}>
            {isVideo ? t('call:incomingVideoCall', 'INCOMING VIDEO CALL') : t('call:incomingCall', 'INCOMING CALL')}
          </Text>
          <Text style={styles.callName} numberOfLines={1}>{displayName}</Text>
          {!!callerLocation && (
            <View style={styles.callLocRow}>
              <Ionicons name="location-outline" size={13} color="#94A3B8" />
              <Text style={styles.callLocText} numberOfLines={1}>{callerLocation}</Text>
            </View>
          )}
        </Animated.View>

        {/* Middle — avatar with ripple rings + ENCRYPTED badge */}
        <View style={styles.callAvatarZone}>
          <Animated.View style={[styles.callRing, ringStyle(ring1)]} />
          <Animated.View style={[styles.callRing, ringStyle(ring2)]} />
          <Animated.View style={[styles.callRing, ringStyle(ring3)]} />

          <Animated.View style={[styles.callAvatarOuter, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.callAvatar}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.callAvatarImg} />
              ) : (
                <View style={styles.callAvatarFallback}>
                  <Text style={styles.callAvatarInitial}>{displayInitial}</Text>
                </View>
              )}
            </View>
          </Animated.View>

          <View style={styles.encryptedBadge}>
            <Ionicons name="lock-closed" size={11} color="#0E7552" />
            <Text style={styles.encryptedText}>ENCRYPTED</Text>
          </View>
        </View>

        {/* Bottom — Decline / Accept */}
        <View style={styles.callActionsRow}>
          <View style={styles.callActionCol}>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPress={handleReject}
                onPressIn={pressIn}
                onPressOut={pressOut}
                activeOpacity={0.85}
                disabled={isRejecting}
                style={[styles.callFab, styles.callFabDecline]}
              >
                {isRejecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                )}
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.callActionLabel}>
              {isRejecting ? t('common:loading') : t('call:reject', 'Decline')}
            </Text>
          </View>

          <View style={styles.callActionCol}>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPress={handleAccept}
                onPressIn={pressIn}
                onPressOut={pressOut}
                activeOpacity={0.9}
                disabled={isAccepting}
                style={[styles.callFab, styles.callFabAccept]}
              >
                {isAccepting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name={isVideo ? "videocam" : "call"} size={26} color="#fff" />
                )}
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.callActionLabel}>
              {isAccepting ? t('call:connecting') : t('call:accept', 'Accept')}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};



const AppointmentsSkeleton = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.78] });
  const S = aptSkelStyles;
  return (
    <View style={S.wrap}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={S.card}>
          {/* accent bar — matches aptCardAccent: height 4, width 100% */}
          <Animated.View style={[S.accentBar, { opacity }]} />

          {/* header row — matches appointmentCardHeader */}
          <View style={S.header}>
            {/* avatar — matches aptAvatarWrap 54×54, borderRadius 16 */}
            <Animated.View style={[S.avatar, { opacity }]} />
            {/* name + specialization — matches appointmentMetaColumn */}
            <View style={S.meta}>
              <Animated.View style={[S.lineLg, { opacity }]} />
              <Animated.View style={[S.lineMd, { opacity }]} />
            </View>
            {/* status pill — matches aptStatusPill */}
            <Animated.View style={[S.statusPill, { opacity }]} />
          </View>

          {/* divider — matches aptDivider */}
          <View style={S.divider} />

          {/* date row — matches appointmentDateRow */}
          <View style={S.dateRow}>
            <Animated.View style={[S.iconBox, { opacity }]} />
            <Animated.View style={[S.dateLine, { opacity }]} />
            <Animated.View style={[S.dot, { opacity }]} />
            <Animated.View style={[S.iconBox, { opacity }]} />
            <Animated.View style={[S.timeLine, { opacity }]} />
          </View>

          {/* action row — matches appointmentActionRow */}
          <View style={S.actionRow}>
            <Animated.View style={[S.btnLeft, { opacity }]} />
            <Animated.View style={[S.btnRight, { opacity }]} />
          </View>
        </View>
      ))}
    </View>
  );
};

const aptSkelStyles = StyleSheet.create({
  wrap: { width: '100%', gap: 12 },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4,
  },
  accentBar: { height: 4, width: '100%', backgroundColor: '#e2e8f0' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#e2e8f0' },
  meta: { flex: 1, gap: 8 },
  lineLg: { width: '65%', height: 14, borderRadius: 4, backgroundColor: '#e2e8f0' },
  lineMd: { width: '45%', height: 11, borderRadius: 4, backgroundColor: '#edf1f5' },
  statusPill: { width: 62, height: 24, borderRadius: 999, backgroundColor: '#edf1f5' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 16, marginTop: 14 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 12 },
  iconBox: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#edf1f5' },
  dateLine: { width: 80, height: 12, borderRadius: 4, backgroundColor: '#e2e8f0' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
  timeLine: { width: 44, height: 12, borderRadius: 4, backgroundColor: '#e2e8f0' },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  btnLeft: { flex: 1, height: 42, borderRadius: 13, backgroundColor: '#edf1f5' },
  btnRight: { flex: 1, height: 42, borderRadius: 13, backgroundColor: '#e2e8f0' },
});

const MyAppointmentsPanel = ({ onBookPress, onVideoCall, onVoiceCall, onChat }) => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedApt, setSelectedApt] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [countdown, setCountdown] = useState("");
  const socketRef = useRef(null);

  // Live countdown to the session start while the details sheet is open.
  useEffect(() => {
    if (!showDetailsModal || !selectedApt?.date) return;
    const target = new Date(selectedApt.date).getTime();
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showDetailsModal, selectedApt]);

  // Tablet detection for responsive modal
  const screenWidth = Dimensions.get('window').width;
  const isTablet = screenWidth >= 600;
  const modalWidth = isTablet ? screenWidth * 0.7 : width * 0.88;
  const modalMaxWidth = isTablet ? 700 : 420;

  const fetchAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true);
      const response = await axiosInstance.get('/api/appointments');
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
      const token = (await AsyncStorage.getItem("token")) || (await AsyncStorage.getItem("accessToken"));
      const userId = await AsyncStorage.getItem("userId");
      if (!token) return;

      const unsubscribers = [];
      try {
        const socket = await socketService.connect();
        socketRef.current = socket;

        if (userId) socket.emit('join-user-room', { userId });

        const refresh = () => fetchAppointments();
        unsubscribers.push(await socketService.on('appointment-booked', refresh));
        unsubscribers.push(await socketService.on('appointment-updated', refresh));
        unsubscribers.push(await socketService.on('appointment-confirmed', refresh));
        unsubscribers.push(await socketService.on('appointment-cancelled', refresh));
        unsubscribers.push(await socketService.on('appointment-status-changed', refresh));
        unsubscribers.push(await socketService.on('appointment-call-initiated', refresh));
        unsubscribers.push(await socketService.on('appointment-status-updated', refresh));

        socketRef.current._unsubscribers = unsubscribers;
      } catch (err) {
        console.error('Failed to connect shared socket for appointments:', err);
      }
    };

    connectSocket();

    return () => {
      try {
        const unsub = socketRef.current?._unsubscribers || [];
        unsub.forEach(fn => { try { fn(); } catch {} });
      } catch (e) {}
      socketRef.current = null;
    };
  }, [fetchAppointments]);

  const now = new Date();
  const upcomingApts = appointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate > now && apt.status !== "canceled";
  });
  const pastApts = appointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate <= now || apt.status === "canceled";
  });

  let displayApts = activeTab === "Upcoming" ? upcomingApts : pastApts;

  if (statusFilter === "Pending") {
    displayApts = displayApts.filter((apt) => apt.status === "pending");
  }
  if (statusFilter === "Confirmed") {
    displayApts = displayApts.filter((apt) => apt.status === "confirmed");
  }
  if (statusFilter === "Completed") {
    displayApts = displayApts.filter((apt) => apt.status === "completed");
  }

  const getStatusStyle = (status) => {
    if (status === "confirmed") return styles.aptStatusConfirmed;
    if (status === "completed") return styles.aptStatusCompleted;
    if (status === "canceled") return styles.aptStatusCanceled;
    return styles.aptStatusPending;
  };

  const getStatusTextColor = (status) => {
    if (status === "confirmed") return PATIENT.primary;
    if (status === "completed") return PATIENT.primary;
    if (status === "canceled") return "#B91C1C";
    return "#C2410C";
  };

  const getAccentColor = (status) => {
    if (status === "confirmed") return PATIENT.primary;
    if (status === "completed") return PATIENT.gradientFrom;
    if (status === "canceled") return "#EF4444";
    return "#F97316";
  };

  const getAvatarSrc = (apt) => {
    const photo = apt?.counselor?.profilePhoto;
    if (photo) {
      return typeof photo === "string" ? photo : photo.url;
    }

    const name = apt?.counselor?.fullName || "Counselor";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=ffffff&bold=true`;
  };

  // ---- Derived values for the details sheet ----
  const aptDate = selectedApt?.date ? new Date(selectedApt.date) : null;
  const isToday = aptDate ? aptDate.toDateString() === new Date().toDateString() : false;
  const dayLabel = aptDate ? (isToday ? "Today" : aptDate.toLocaleDateString("en-US", { weekday: "short" })) : "";
  const timeLabel = aptDate ? aptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
  const dateLabel = aptDate ? aptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "-";
  const statusRaw = selectedApt?.status || "pending";
  const statusCap = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
  const modeLabel = selectedApt?.mode || selectedApt?.sessionType || "Video Call";
  const durationLabel = selectedApt?.duration ? `${selectedApt.duration} Minutes` : "45 Minutes";
  const relDay = (d) => {
    if (!d) return "";
    const dd = new Date(d);
    const today = new Date();
    const yst = new Date();
    yst.setDate(today.getDate() - 1);
    const time = dd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (dd.toDateString() === today.toDateString()) return `Today, ${time}`;
    if (dd.toDateString() === yst.toDateString()) return "Yesterday";
    return dd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.appointmentFilterRow}
        >
          {[
            { key: "All", label: t('common:all', 'All') },
            { key: "Pending", label: t('common:pending', 'Pending') },
            { key: "Confirmed", label: t('common:confirmed', 'Confirmed') },
            { key: "Completed", label: t('appointment:completed', 'completed') },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.filterChip, statusFilter === chip.key && styles.filterChipActive]}
              onPress={() => setStatusFilter(chip.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, statusFilter === chip.key && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.appointmentsList} showsVerticalScrollIndicator={false}>
        {loadingAppointments ? (
          <AppointmentsSkeleton />
        ) : displayApts.length === 0 ? (
          <View style={styles.appointmentEmptyCard}>
            <MaterialIcons name="event-busy" size={40} color="#A7E3BE" />
            <Text style={styles.appointmentEmptyTitle}>No appointments found</Text>
            <Text style={styles.appointmentEmptySubtitle}>
              Try changing filters or book a new session with a counselor.
            </Text>
          </View>
        ) : (
          displayApts.map((apt) => (
            <View key={apt._id} style={styles.appointmentCard}>
              <View style={styles.appointmentCardHeader}>
                <View style={styles.aptAvatarWrap}>
                  <Image source={{ uri: getAvatarSrc(apt) }} style={styles.appointmentAvatar} />
                </View>
                <View style={styles.appointmentMetaColumn}>
                  <View style={styles.aptNameRow}>
                    <Text style={styles.appointmentDoctorName} numberOfLines={1}>
                      Dr. {apt?.counselor?.fullName || "Counselor"}
                    </Text>
                    <Ionicons name="checkmark-circle" size={14} color={PATIENT.primary} />
                  </View>
                  <Text style={styles.appointmentSpecialization} numberOfLines={1}>
                    {apt?.counselor?.specialization || "Mental Wellness Specialist"}
                  </Text>
                  <View style={styles.aptMetaRow}>
                    <Ionicons name="briefcase-outline" size={12} color={PATIENT.textSecondary} />
                    <Text style={styles.aptMetaText}>
                      {apt?.counselor?.experience || '4 years'}
                    </Text>
                    <Ionicons name="star" size={12} color="#F5A623" style={{ marginLeft: 10 }} />
                    <Text style={styles.aptMetaText}>
                      {(Number(apt?.counselor?.rating) || 4.9).toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.aptStatusPill, getStatusStyle(apt.status)]}>
                  <Ionicons
                    name={apt.status === 'canceled' ? 'close-circle' : 'checkmark-circle'}
                    size={11}
                    color={getStatusTextColor(apt.status)}
                  />
                  <Text style={[styles.aptStatusText, { color: getStatusTextColor(apt.status) }]}>
                    {apt.status || "pending"}
                  </Text>
                </View>
              </View>

              <View style={styles.aptDivider} />

              <View style={styles.appointmentDateRow}>
                <View style={styles.aptDateIconWrap}>
                  <MaterialIcons name="event" size={15} color={PATIENT.primary} />
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
                  <MaterialIcons name="access-time" size={15} color={PATIENT.primary} />
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
                  <Ionicons name="eye-outline" size={16} color={PATIENT.primary} />
                  <Text style={styles.appointmentDetailsText}>
                    {t('counselor:viewDetails', 'View Details')}
                  </Text>
                </TouchableOpacity>

                {/* Action Buttons: Video, Voice, Chat */}
                <TouchableOpacity
                  style={styles.aptActionIconBtn}
                  onPress={() => onVideoCall && onVideoCall(apt)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="videocam-outline" size={19} color={PATIENT.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.aptActionIconBtn}
                  onPress={() => onVoiceCall && onVoiceCall(apt)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={19} color={PATIENT.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.aptActionIconBtn}
                  onPress={() => onChat && onChat(apt)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-outline" size={19} color={PATIENT.primary} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        transparent={true}
        visible={showDetailsModal}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={sheetStyles.overlay}>
          <TouchableWithoutFeedback onPress={() => setShowDetailsModal(false)}>
            <View style={sheetStyles.backdrop} />
          </TouchableWithoutFeedback>

          <View style={sheetStyles.sheet}>
            <View style={sheetStyles.grabber} />

            {/* Header */}
            <View style={sheetStyles.header}>
              <View style={{ flex: 1 }}>
                <Text style={sheetStyles.title}>Appointment Details</Text>
                <Text style={sheetStyles.subtitle}>View your session information</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetailsModal(false)}
                style={sheetStyles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={sheetStyles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Counselor card */}
              <View style={sheetStyles.docCard}>
                <Image source={{ uri: getAvatarSrc(selectedApt) }} style={sheetStyles.docAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={sheetStyles.docNameRow}>
                    <Text style={sheetStyles.docName} numberOfLines={1}>
                      Dr. {selectedApt?.counselor?.fullName || "Counselor"}
                    </Text>
                    <Ionicons name="checkmark-circle" size={15} color={PATIENT.primary} />
                  </View>
                  <Text style={sheetStyles.docSpec} numberOfLines={1}>
                    {selectedApt?.counselor?.specialization || "Mental Wellness Specialist"}
                  </Text>
                  <View style={sheetStyles.docMetaRow}>
                    <Ionicons name="briefcase-outline" size={12} color={PATIENT.textSecondary} />
                    <Text style={sheetStyles.docMetaText}>
                      {selectedApt?.counselor?.experience || "4 years"}
                    </Text>
                    <Ionicons name="star" size={12} color="#F5A623" style={{ marginLeft: 10 }} />
                    <Text style={sheetStyles.docMetaText}>
                      {(Number(selectedApt?.counselor?.rating) || 4.9).toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={sheetStyles.confirmPill}>
                  <View style={sheetStyles.confirmDot} />
                  <Text style={sheetStyles.confirmText}>{statusCap}</Text>
                </View>
              </View>

              {/* Countdown banner */}
              <View style={sheetStyles.countBanner}>
                <LinearGradient
                  colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                  style={sheetStyles.countIcon}
                >
                  <Ionicons name="time-outline" size={22} color="#ffffff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={sheetStyles.countLabel}>Session starts in</Text>
                  <Text style={sheetStyles.countValue}>{countdown || "--:--:--"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={sheetStyles.countDay}>{dayLabel}</Text>
                  <Text style={sheetStyles.countTime}>{timeLabel}</Text>
                </View>
              </View>

              {/* Info grid */}
              <View style={sheetStyles.gridRow}>
                <View style={sheetStyles.gridCell}>
                  <View style={[sheetStyles.gridIcon, { backgroundColor: "#E7EEFE" }]}>
                    <MaterialIcons name="event" size={18} color="#2563EB" />
                  </View>
                  <Text style={sheetStyles.gridLabel}>DATE</Text>
                  <Text style={sheetStyles.gridValue}>{dateLabel}</Text>
                </View>
                <View style={sheetStyles.gridCell}>
                  <View style={[sheetStyles.gridIcon, { backgroundColor: "#E6F6EC" }]}>
                    <MaterialIcons name="schedule" size={18} color={PATIENT.primary} />
                  </View>
                  <Text style={sheetStyles.gridLabel}>TIME</Text>
                  <Text style={sheetStyles.gridValue}>{timeLabel}</Text>
                </View>
              </View>

              <View style={sheetStyles.gridRow}>
                <View style={sheetStyles.gridCell}>
                  <View style={[sheetStyles.gridIcon, { backgroundColor: "#F1EAFE" }]}>
                    <MaterialIcons name="laptop-mac" size={18} color="#7C3AED" />
                  </View>
                  <Text style={sheetStyles.gridLabel}>MODE</Text>
                  <Text style={sheetStyles.gridValue}>{modeLabel}</Text>
                </View>
                <View style={sheetStyles.gridCell}>
                  <View style={[sheetStyles.gridIcon, { backgroundColor: "#FEF3E2" }]}>
                    <MaterialIcons name="timer" size={18} color="#F59E0B" />
                  </View>
                  <Text style={sheetStyles.gridLabel}>DURATION</Text>
                  <Text style={sheetStyles.gridValue}>{durationLabel}</Text>
                </View>
              </View>

              {/* Activity timeline */}
              <View style={sheetStyles.timelineCard}>
                <View style={sheetStyles.tlItem}>
                  <View style={sheetStyles.tlDotCol}>
                    <View style={[sheetStyles.tlDot, { backgroundColor: "#CBD5E1" }]} />
                    <View style={sheetStyles.tlLine} />
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <Text style={sheetStyles.tlDate}>{relDay(selectedApt?.createdAt) || "Recently"}</Text>
                    <Text style={sheetStyles.tlStatus}>Booked</Text>
                  </View>
                </View>
                <View style={sheetStyles.tlItem}>
                  <View style={sheetStyles.tlDotCol}>
                    <View style={[sheetStyles.tlDot, { backgroundColor: PATIENT.primary }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sheetStyles.tlDate}>{relDay(selectedApt?.updatedAt) || relDay(selectedApt?.createdAt) || "Today"}</Text>
                    <Text style={sheetStyles.tlStatus}>{statusCap}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Fixed footer actions */}
            <View style={sheetStyles.footer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  setShowDetailsModal(false);
                  onVideoCall && onVideoCall(selectedApt);
                }}
              >
                <LinearGradient
                  colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={sheetStyles.joinBtn}
                >
                  <Ionicons name="videocam" size={20} color="#ffffff" />
                  <Text style={sheetStyles.joinText}>Join Video Session</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={sheetStyles.secRow}>
                <TouchableOpacity
                  style={sheetStyles.secBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    setShowDetailsModal(false);
                    onChat && onChat(selectedApt);
                  }}
                >
                  <Ionicons name="chatbubble-ellipses" size={17} color="#F59E0B" />
                  <Text style={sheetStyles.secText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={sheetStyles.secBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    setShowDetailsModal(false);
                    onVoiceCall && onVoiceCall(selectedApt);
                  }}
                >
                  <Ionicons name="call" size={17} color={PATIENT.primary} />
                  <Text style={sheetStyles.secText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function UserDashboard() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [active, setActive] = useState("Chat");
  const [chatOpen, setChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [targetCounselor, setTargetCounselor] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSessionId, setAiSessionId] = useState(null);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showResetChatConfirm, setShowResetChatConfirm] = useState(false);
  // Direct booking modal state (opened from appointment "Book Now" button)
  const [showDirectBookingModal, setShowDirectBookingModal] = useState(false);
  const [directBookCounselor, setDirectBookCounselor] = useState(null);
  const [directBookDateTime, setDirectBookDateTime] = useState(new Date());
  const [directBookNotes, setDirectBookNotes] = useState("");
  const [directBookLoading, setDirectBookLoading] = useState(false);
  const [showDirectDatePicker, setShowDirectDatePicker] = useState(false);
  const [showDirectTimePicker, setShowDirectTimePicker] = useState(false);

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

  const [chatMessages, setChatMessages] = useState([]);
  // AI/voice language — seeded from the app (dashboard) language so the AI speaks
  // the same language by default. The in-chat picker can still override it.
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en-IN');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showAvatarChooser, setShowAvatarChooser] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);

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

  // Reload user's language whenever this dashboard gains focus
  useEffect(() => {
    if (isFocused && userId) loadUserLanguage(userId, 'user');
  }, [isFocused, userId]);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
    }
  }, [chatOpen]);

  const startAiChat = useCallback(async (lang) => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.post(
        '/api/ai/message',
        { message: "hi", history: [], language: lang }
      );
 
      if (response.data?.success) {
        if (response.data.data?.sessionId) {
          setAiSessionId(response.data.data.sessionId);
        }

        setChatMessages([
          {
            id: Date.now(),
            text: response.data.data?.aiResponse || AI_WELCOME_MESSAGE,
            sender: "ai",
            quickReplies: response.data.data?.quickReplies || AI_WELCOME_QUICK_REPLIES,
          },
        ]);
      } else {
        throw new Error("Invalid AI kickoff response");
      }
    } catch (err) {
      console.warn("[AI-CHAT] kickoff failed:", err.message);
      setChatMessages([
        {
          id: Date.now(),
          text: AI_WELCOME_MESSAGE,
          sender: "ai",
          quickReplies: AI_WELCOME_QUICK_REPLIES,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    if (chatMessages.length > 0) return;
    if (isLoading) return;

    void startAiChat(selectedLang);
  }, [chatOpen, chatMessages.length, isLoading, startAiChat, selectedLang]);

  const handleResetChat = useCallback(() => {
    if (isLoading) return;
    setShowResetChatConfirm(true);
  }, [isLoading]);

  const cancelResetChat = useCallback(() => {
    if (isLoading) return;
    setShowResetChatConfirm(false);
  }, [isLoading]);

  const confirmResetChat = useCallback(async () => {
    if (isLoading) return;

    setShowResetChatConfirm(false);
    setIsLoading(true);
    try {
      await axiosInstance.delete('/api/ai-chat/my-history');
    } catch (err) {
      console.warn("[AI-CHAT] reset history failed:", err.message);
    }

    setAiSessionId(null);
    setNewMessage("");
    setChatMessages([]);
    await startAiChat(selectedLang);
  }, [isLoading, startAiChat]);

  const handleLangChange = useCallback(async (newLang) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await axiosInstance.delete('/api/ai-chat/my-history');
    } catch (_) {}
    setAiSessionId(null);
    setNewMessage("");
    setChatMessages([]);
    await startAiChat(newLang);
  }, [isLoading, startAiChat]);

  // ── Keep the AI language in sync with the app (dashboard) language ──────────
  // When the user switches the app language, the AI automatically follows: it
  // restarts and replies in that language. No need to use the in-chat picker.
  const syncedAppLangRef = useRef(i18n.language);
  useEffect(() => {
    const appLang = i18n.language;
    if (!appLang || appLang === syncedAppLangRef.current) return;
    syncedAppLangRef.current = appLang;
    setSelectedLang(appLang);
    // If an AI conversation is already open/active, restart it in the new
    // language; otherwise it will start in the new language when next opened.
    if (chatOpen || chatMessages.length > 0) {
      handleLangChange(appLang);
    }
  }, [i18n.language, chatOpen, chatMessages.length, handleLangChange]);

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

        const storedUserId = await AsyncStorage.getItem('userId');
        if (!storedUserId) return;

        const response = await axiosInstance.get(`/api/video/calls/pending/${storedUserId}`);
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
        const storedUserId = await AsyncStorage.getItem('userId');
        if (!storedUserId || cancelled) return;

        const response = await axiosInstance.get(`/api/video/calls/pending/${storedUserId}`);
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
      if (!storedUserId) return;

      setUserId(storedUserId);

      const response = await axiosInstance.get(`/api/auth/getUser/${storedUserId}`);

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

  // Handler for appointment video call
  const handleAptVideoCall = async (apt) => {
    try {
      const counselor = apt?.counselor || apt;
      const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
      const currentUserId = userId || await AsyncStorage.getItem("userId");
      const counselorId = counselor?.id || counselor?._id;

      if (!currentUserId || !counselorId) {
        Alert.alert("Error", "Missing user or counselor information");
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/video/calls/initiate`,
        {
          initiatorId: currentUserId,
          initiatorType: "user",
          receiverId: counselorId,
          receiverType: "counsellor",
          callType: "video",
        },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        navigation.navigate("ChatBox", {
          chatId: null,
          counselor: counselor,
          callType: "video",
          callData: response.data.callData,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to initiate video call");
      console.error("Video call error:", error);
    }
  };

  // Handler for appointment voice call
  const handleAptVoiceCall = async (apt) => {
    try {
      const counselor = apt?.counselor || apt;
      const token = await AsyncStorage.getItem("token") || await AsyncStorage.getItem("accessToken");
      const currentUserId = userId || await AsyncStorage.getItem("userId");
      const counselorId = counselor?.id || counselor?._id;

      if (!currentUserId || !counselorId) {
        Alert.alert("Error", "Missing user or counselor information");
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/video/calls/initiate`,
        {
          initiatorId: currentUserId,
          initiatorType: "user",
          receiverId: counselorId,
          receiverType: "counsellor",
          callType: "audio",
        },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        navigation.navigate("ChatBox", {
          chatId: null,
          counselor: counselor,
          callType: "voice",
          callData: response.data.callData,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to initiate voice call");
      console.error("Voice call error:", error);
    }
  };

  // Handler for appointment chat
  const handleAptChat = async (apt) => {
    try {
      const counselor = apt?.counselor || apt;
      navigation.navigate("ChatBox", {
        chatId: null,
        counselor: counselor,
        user: userData,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to open chat");
      console.error("Chat error:", error);
    }
  };

  // Upload a profile photo (file) or generated avatar (url) from the header.
  const uploadHeaderPhoto = async (formData, optimisticUri) => {
    try {
      setPhotoUploading(true);
      const token =
        (await AsyncStorage.getItem("accessToken")) ||
        (await AsyncStorage.getItem("token"));
      const storedUserId = await AsyncStorage.getItem("userId");
      const response = await axios.patch(
        `${API_BASE_URL}/api/auth/update/${storedUserId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (response.data?.success) {
        if (optimisticUri) setUserData((prev) => ({ ...prev, profilePhoto: optimisticUri }));
        fetchUserData();
      }
    } catch (e) {
      console.error("Header photo upload failed:", e);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Pick an image from the library and upload it.
  const handleHeaderUploadPhoto = () => {
    setShowAvatarChooser(false);
    launchImageLibrary({ mediaType: "photo", quality: 0.8 }, async (res) => {
      if (res.didCancel || res.errorCode || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const formData = new FormData();
      formData.append("profilePhoto", {
        uri: asset.uri,
        type: asset.type || "image/jpeg",
        name: asset.fileName || "photo.jpg",
      });
      await uploadHeaderPhoto(formData, asset.uri);
    });
  };

  // Generated avatar selected → save it.
  const handleHeaderAvatarSelect = async (avatarUrl) => {
    setShowAvatarBuilder(false);
    const formData = new FormData();
    formData.append("avatarUrl", avatarUrl);
    await uploadHeaderPhoto(formData, avatarUrl);
  };

  const sendMessage = async (messageText = newMessage, imageUri = null) => {
    const sourceText = typeof messageText === "string" ? messageText : newMessage;
    const trimmedMessage = sourceText.trim();
    if (!trimmedMessage && !imageUri) return;

    const userMessage = {
      id: Date.now(),
      text: trimmedMessage,
      sender: "user",
      image: imageUri || null,
    };
    setChatMessages((prev) => [
      ...prev.map((msg) =>
        msg.sender === "ai" && msg.quickReplies ? { ...msg, quickReplies: null } : msg
      ),
      userMessage,
    ]);
    setNewMessage("");
    setIsLoading(true);

    try {
      const outgoingText = trimmedMessage || "I've shared a photo — please take a look.";
      const history = chatMessages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

      const response = await axiosInstance.post('/api/ai-chat/send-message', {
        message: outgoingText,
        history,
        sessionId: aiSessionId,
        language: selectedLang,
      });

      if (response.data?.success !== false) {
        const responsePayload = response.data?.data || response.data || {};
        const aiResponse =
          responsePayload.aiResponse ||
          responsePayload.response ||
          responsePayload.reply ||
          responsePayload.message ||
          response.data?.aiResponse;

        if (!aiResponse) {
          throw new Error("Invalid AI response");
        }

        const nextSessionId = responsePayload.sessionId || response.data?.sessionId;
        if (nextSessionId) {
          setAiSessionId(nextSessionId);
        }

        const aiMessage = {
          id: Date.now() + 1,
          text: aiResponse,
          sender: "ai",
          quickReplies: responsePayload.quickReplies || response.data?.quickReplies || null,
        };
        setChatMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (error) {
      console.error("AI Chat error:", error);

      const aiMessage = {
        id: Date.now() + 1,
        text: "I'm sorry, I'm having trouble connecting to the medical server. Please try again later.",
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

  const sendQuickReply = async (replyText) => {
    await sendMessage(replyText);
  };

  const handleMenuItemClick = (id) => {
    setShowMoreModal(false);
    setShowProfileMenu(false);
    switchDashboardTab(id);
  };

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    switchDashboardTab("profile");
  };

  const switchDashboardTab = (tabId) => {
    if (active === tabId) return;
    safeVibrate(100);
    setActive(tabId);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      try {
        await axiosInstance.post('/api/auth/logout', { refreshToken });
      } catch (apiError) {
        console.error("Backend logout error:", apiError);
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
      const storedUserId = await AsyncStorage.getItem('userId');
      if (!storedUserId) return;

      const acceptRes = await axiosInstance.put(
        '/api/video/calls/' + callId + '/accept',
        { acceptorId: storedUserId, acceptorType: 'user' }
      );
      if (!acceptRes.data?.success) return;

      let detailedCall = null;
      try {
        const detailsRes = await axiosInstance.get(
          '/api/video/calls/' + callId + '/details',
          { params: { userId: storedUserId, userType: 'user' } }
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
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId && callId) {
        await axiosInstance.put(
          '/api/video/calls/' + callId + '/reject',
          { userId: storedUserId, reason: 'declined' }
        ).catch(() => {});
      }
    } catch (_) {}
  };

  const allMenuItems = [
    { id: "Chat", icon: "chat", label: t('dashboard:chat'), type: "material" },
    { id: "Counselor", icon: "psychology", label: t('dashboard:counselor'), type: "material" },
    { id: "Appointment", icon: "event-available", label: t('dashboard:myAppointment'), type: "material" },
    { id: "Wallet", icon: "account-balance-wallet", label: t('dashboard:wallet'), type: "material" },
    { id: "Video", icon: "history", label: t('dashboard:callHistory'), type: "material" },
  ];

  const handleDirectDateChange = (event, selectedDate) => {
    if (selectedDate) {
      const newDate = new Date(directBookDateTime);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setDirectBookDateTime(newDate);
    }
    if (Platform.OS === 'android') {
      setShowDirectDatePicker(false);
    }
  };

  const handleDirectTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      const newDate = new Date(directBookDateTime);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setDirectBookDateTime(newDate);
    }
    if (Platform.OS === 'android') {
      setShowDirectTimePicker(false);
    }
  };

  const handleDirectBooking = async () => {
    if (!directBookCounselor) return;

    try {
      setDirectBookLoading(true);
      const counselorId = directBookCounselor._id || directBookCounselor.id || directBookCounselor.counselorId;

      await axiosInstance.post('/api/appointments', {
        counselorId,
        date: directBookDateTime.toISOString(),
        notes: directBookNotes.trim(),
      });

      Alert.alert(
        t('appointment:bookedSuccessfully', 'Appointment Booked'),
        `Your appointment request was sent to ${directBookCounselor.fullName || directBookCounselor.name || 'the counselor'}.`
      );
      setShowDirectBookingModal(false);
      setDirectBookNotes('');
      setDirectBookDateTime(new Date());
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert(
        t('appointment:bookingFailed', 'Booking Failed'),
        error?.response?.data?.message || t('appointment:failedToBook', 'Failed to book appointment')
      );
    } finally {
      setDirectBookLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard:goodMorning', 'Good Morning');
    if (hour < 17) return t('dashboard:goodAfternoon', 'Good Afternoon');
    return t('dashboard:goodEvening', 'Good Evening');
  };

  const sidebarItems = [
    {
      id: 'profile',
      icon: 'person-outline',
      iconActive: 'person',
      label: t('settings:myProfile'),
      isActive: active === 'profile',
      onPress: () => { setShowMoreModal(false); switchDashboardTab('profile'); },
    },
    {
      id: 'Video',
      icon: 'call-outline',
      iconActive: 'call',
      label: t('dashboard:callHistory'),
      isActive: active === 'Video',
      onPress: () => { setShowMoreModal(false); handleMenuItemClick('Video'); },
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      iconActive: 'settings',
      label: t('settings:settings'),
      isActive: active === 'settings',
      onPress: () => { setShowMoreModal(false); setActive('settings'); },
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      iconActive: 'help-circle',
      label: t('settings:helpSupport'),
      isActive: false,
      onPress: () => { setShowMoreModal(false); setShowHelpSupport(true); },
    },
    {
      id: 'privacy',
      icon: 'shield-checkmark-outline',
      iconActive: 'shield-checkmark',
      label: t('settings:privacyPolicy'),
      isActive: false,
      onPress: () => { setShowMoreModal(false); setShowPrivacyPolicy(true); },
    },
  ];

  const renderContent = () => {
    switch (active) {
      case "Chat":
        return <ChatInterface setActiveTab={switchDashboardTab} />;
      case "Counselor":
        return <CounselorTable initialSearchQuery={targetCounselor} />;
      case "Appointment":
        return (
          <MyAppointmentsPanel
            onBookPress={(apt) => {
              const c = apt?.counselor || apt;
              setDirectBookCounselor(c);
              const nextSlot = new Date();
              nextSlot.setHours(nextSlot.getHours() + 1);
              setDirectBookDateTime(nextSlot);
              setDirectBookNotes("");
              setShowDirectBookingModal(true);
            }}
            onVideoCall={handleAptVideoCall}
            onVoiceCall={handleAptVoiceCall}
            onChat={handleAptChat}
          />
        );
      case "Wallet":
        return <WalletDashboard />;
      case "Video":
        return <CallHistory />;
      case "profile":
        return <PatientProfile />;
      case "settings":
        return <UserAccountSettings onNavigateBack={() => setActive("Chat")} />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={PATIENT.surface}
        translucent={false}
      />
      <RatingPrompt triggerKey={active} />

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
            const storedUserId = await AsyncStorage.getItem('userId');
            if (storedUserId && callId) {
              await axiosInstance.put(
                '/api/video/calls/' + callId + '/end',
                { userId: storedUserId, endedBy: 'user' }
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
            const storedUserId = await AsyncStorage.getItem('userId');
            if (storedUserId && callId) {
              await axiosInstance.put(
                '/api/video/calls/' + callId + '/end',
                { userId: storedUserId, endedBy: 'user' }
              ).catch(() => {});
            }
          } catch (_) {}
        }}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setShowMoreModal(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.menuLine, { width: 22 }]} />
          <View style={[styles.menuLine, { width: 22 }]} />
          <View style={[styles.menuLine, { width: 14 }]} />
        </TouchableOpacity>

        <View style={styles.headerLeft}>
          <Text style={styles.headerWelcome}>{t('dashboard:welcomeBack', 'Welcome back,')}</Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {getGreeting()}, {(userData.name || 'User').split(' ')[0]}
          </Text>
        </View>

        <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={() => setShowNotifications(true)}>
          <Ionicons name="notifications-outline" size={22} color={PATIENT.primary} />
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>

      {/* AI FLOATING BUTTON — centred in the bottom nav */}
      <TouchableOpacity
        style={styles.aiButton}
        onPress={() => setChatOpen(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiButtonGradient}
        >
          <Ionicons name="sparkles" size={26} color="#ffffff" />
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
          onClose={() => {
            setShowResetChatConfirm(false);
            setChatOpen(false);
          }}
          onReset={handleResetChat}
          showResetConfirm={showResetChatConfirm}
          onCancelReset={cancelResetChat}
          onConfirmReset={confirmResetChat}
          onCounselorPress={handleAIContactClick}
          sendQuickReply={sendQuickReply}
          selectedLang={selectedLang}
          setSelectedLang={setSelectedLang}
          onLangChange={handleLangChange}
          userPhoto={userData.profilePhoto}
        />
      )}

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        {[
          { id: 'Chat', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses', label: t('dashboard:chat') },
          { id: 'Counselor', icon: 'bulb-outline', iconActive: 'bulb', label: t('dashboard:counselor') },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.navItem}
            onPress={() => handleMenuItemClick(tab.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={active === tab.id ? tab.iconActive : tab.icon}
              size={22}
              color={active === tab.id ? PATIENT.primary : PATIENT.textMuted}
            />
            <Text
              style={[styles.navLabel, active === tab.id && styles.navLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Spacer for the centre AI button */}
        <View style={styles.navCenterSpacer} />

        {[
          { id: 'Appointment', icon: 'calendar-outline', iconActive: 'calendar', label: t('dashboard:myAppointment') },
          { id: 'Wallet', icon: 'wallet-outline', iconActive: 'wallet', label: t('dashboard:wallet') },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.navItem}
            onPress={() => handleMenuItemClick(tab.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={active === tab.id ? tab.iconActive : tab.icon}
              size={22}
              color={active === tab.id ? PATIENT.primary : PATIENT.textMuted}
            />
            <Text
              style={[styles.navLabel, active === tab.id && styles.navLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SIDEBAR DRAWER */}
      <Modal
        transparent
        visible={showMoreModal}
        animationType="fade"
        onRequestClose={() => setShowMoreModal(false)}
      >
        <View style={styles.sidebarRoot}>
          <View style={styles.sidebar}>
            {/* User card — green gradient */}
            <LinearGradient
              colors={[PATIENT.gradientFrom, PATIENT.gradientTo, PATIENT.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sbUserCard}
            >
              <TouchableOpacity
                style={styles.sbUserMain}
                activeOpacity={0.85}
                onPress={() => { setShowMoreModal(false); switchDashboardTab('profile'); }}
              >
                <View style={styles.sbAvatarWrap}>
                  {userData.profilePhoto ? (
                    <Image source={{ uri: userData.profilePhoto }} style={styles.sbAvatar} />
                  ) : (
                    <View style={styles.sbAvatarPlaceholder}>
                      <Text style={styles.sbAvatarText}>
                        {userData.name?.charAt(0)?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.sbUserInfo}>
                  <Text style={styles.sbUserName} numberOfLines={1}>{userData.name || 'User'}</Text>
                  <Text style={styles.sbUserRole} numberOfLines={1}>{t('auth:userRole', 'Patient')}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.sbGlobeWrap}>
                <LanguageSelector
                  iconName="globe-outline"
                  iconColor="#ffffff"
                  iconSize={20}
                  userId={userId}
                  role="user"
                  brand={PATIENT.primary}
                />
              </View>
            </LinearGradient>

            {/* Menu */}
            <View style={styles.sbMenu}>
              {sidebarItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.sbItem, item.isActive && styles.sbItemActive]}
                  onPress={item.onPress}
                  activeOpacity={0.75}
                >
                  <View style={[styles.sbIconChip, item.isActive && styles.sbIconChipActive]}>
                    <Ionicons
                      name={item.isActive ? item.iconActive : item.icon}
                      size={19}
                      color={item.isActive ? '#ffffff' : PATIENT.primary}
                    />
                  </View>
                  <Text style={[styles.sbItemText, item.isActive && styles.sbItemTextActive]}>
                    {item.label}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={item.isActive ? PATIENT.primary : '#CBD5E1'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Logout */}
            <TouchableOpacity
              style={styles.sbLogout}
              activeOpacity={0.85}
              onPress={() => { setShowMoreModal(false); setShowLogoutConfirm(true); }}
            >
              <Ionicons name="log-out-outline" size={20} color="#ffffff" />
              <Text style={styles.sbLogoutText}>{t('settings:logoutAccount')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setShowMoreModal(false)}
          />
        </View>
      </Modal>

      {/* Notifications full-screen modal */}
      <Modal visible={showNotifications} animationType="slide" transparent={false} onRequestClose={() => setShowNotifications(false)}>
        <NotificationScreen
          onClose={() => setShowNotifications(false)}
          onAction={(n) => {
            setShowNotifications(false);
            if (n.type === 'appointment') switchDashboardTab('Appointment');
            else if (n.type === 'chat') switchDashboardTab('Chat');
            else if (n.type === 'ai') setChatOpen(true);
          }}
        />
      </Modal>

      {/* LOGOUT CONFIRM MODAL */}
      {/* Help & Support full-screen modal */}
      <Modal visible={showHelpSupport} animationType="slide" transparent={false} onRequestClose={() => setShowHelpSupport(false)}>
        <HelpSupport
          onClose={() => setShowHelpSupport(false)}
          onOpenTab={switchDashboardTab}
        />
      </Modal>

      {/* Privacy Policy full-screen modal */}
      <Modal visible={showPrivacyPolicy} animationType="slide" transparent={false} onRequestClose={() => setShowPrivacyPolicy(false)}>
        <PrivacyPolicy
          onClose={() => setShowPrivacyPolicy(false)}
          onOpenTab={switchDashboardTab}
        />
      </Modal>

      <Modal transparent={true} visible={showLogoutConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>{t('settings:confirmLogout')}</Text>
            </View>
            <View style={styles.confirmModalBody}>
              <Text style={styles.confirmModalText}>{t('settings:logoutConfirm')}</Text>
            </View>
            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>{t('common:cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmLogoutBtn]}
                onPress={handleLogout}
              >
                <Text style={styles.confirmLogoutBtnText}>{t('auth:logout')}</Text>
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
              <Text style={styles.confirmModalTitle}>{t('settings:deleteAccount')}</Text>
            </View>
            <View style={styles.confirmModalBody}>
              <Text style={styles.confirmModalText}>{t('settings:deleteWarning')}</Text>
            </View>
            <View style={styles.confirmModalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>{t('common:cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={handleDeleteConfirm}
              >
                <Text style={styles.deleteBtnText}>{t('settings:deleteAccount')}</Text>
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

      {/* Avatar action chooser (from header popup) */}
      <Modal
        visible={showAvatarChooser}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarChooser(false)}
      >
        <TouchableOpacity
          style={styles.avatarChooserOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarChooser(false)}
        >
          <View style={styles.avatarChooserSheet}>
            <View style={styles.avatarChooserHandle} />
            <Text style={styles.avatarChooserTitle}>{t('profile:changePhoto', 'Change Profile Photo')}</Text>

            <TouchableOpacity
              style={styles.avatarChooserOption}
              onPress={() => { setShowAvatarChooser(false); setShowAvatarBuilder(true); }}
              activeOpacity={0.8}
            >
              <View style={[styles.avatarChooserIcon, { backgroundColor: '#E6F6EC' }]}>
                <MaterialIcons name="face" size={22} color="#6366f1" />
              </View>
              <View style={styles.avatarChooserTextWrap}>
                <Text style={styles.avatarChooserOptionTitle}>{t('profile:createAvatar', 'Create Avatar')}</Text>
                <Text style={styles.avatarChooserOptionSub}>{t('profile:createAvatarSub', 'Build a custom cartoon avatar')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarChooserOption}
              onPress={handleHeaderUploadPhoto}
              activeOpacity={0.8}
            >
              <View style={[styles.avatarChooserIcon, { backgroundColor: '#E6F6EC' }]}>
                <MaterialIcons name="image" size={22} color="#2563eb" />
              </View>
              <View style={styles.avatarChooserTextWrap}>
                <Text style={styles.avatarChooserOptionTitle}>{t('profile:uploadPhoto', 'Upload Photo')}</Text>
                <Text style={styles.avatarChooserOptionSub}>{t('profile:uploadPhotoSub', 'Choose from your gallery')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarChooserCancel}
              onPress={() => setShowAvatarChooser(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarChooserCancelText}>{t('common:cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <AvatarPicker
        visible={showAvatarBuilder}
        userGender={userData?.gender}
        currentAvatarUrl={userData?.profilePhoto}
        onSelect={handleHeaderAvatarSelect}
        onClose={() => setShowAvatarBuilder(false)}
      />

      {/* Direct Booking Modal - opened from appointment "Book Now" button */}
      <Modal
        visible={showDirectBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDirectBookingModal(false)}
      >
        <View style={styles.directBookingOverlay}>
          <View style={styles.directBookingContent}>
            <View style={styles.directBookingHeader}>
              <Text style={styles.directBookingTitle}>
                {directBookCounselor ? `Book with Dr. ${directBookCounselor.fullName || directBookCounselor.name}` : "Book Appointment"}
              </Text>
              <TouchableOpacity onPress={() => setShowDirectBookingModal(false)}>
                <Text style={styles.directBookingClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.directBookingScroll}>
              <Text style={styles.directBookingLabel}>Date</Text>
              <TouchableOpacity
                style={styles.directBookingInput}
                onPress={() => {
                  setShowDirectDatePicker(true);
                  if (Platform.OS === 'ios') {
                    setShowDirectTimePicker(false);
                  }
                }}
              >
                <Text>{directBookDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </TouchableOpacity>

              <Text style={styles.directBookingLabel}>Time</Text>
              <TouchableOpacity
                style={styles.directBookingInput}
                onPress={() => {
                  setShowDirectTimePicker(true);
                  if (Platform.OS === 'ios') {
                    setShowDirectDatePicker(false);
                  }
                }}
              >
                <Text>{directBookDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>

              {(showDirectDatePicker || showDirectTimePicker) && Platform.OS === 'ios' && (
                <View style={styles.directBookingPickerWrap}>
                  {showDirectDatePicker && (
                    <DateTimePicker
                      value={directBookDateTime}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={handleDirectDateChange}
                    />
                  )}
                  {showDirectTimePicker && (
                    <DateTimePicker
                      value={directBookDateTime}
                      mode="time"
                      display="spinner"
                      onChange={handleDirectTimeChange}
                    />
                  )}
                </View>
              )}

              {showDirectDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={directBookDateTime}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={handleDirectDateChange}
                />
              )}

              {showDirectTimePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={directBookDateTime}
                  mode="time"
                  display="default"
                  onChange={handleDirectTimeChange}
                />
              )}

              <Text style={styles.directBookingLabel}>Notes</Text>
              <TextInput
                style={styles.directBookingTextArea}
                multiline
                numberOfLines={4}
                value={directBookNotes}
                onChangeText={setDirectBookNotes}
                placeholder="Share what you want to discuss..."
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.directBookingHint}>Sent to the counselor for confirmation.</Text>
            </ScrollView>

            <View style={styles.directBookingActions}>
              <TouchableOpacity
                style={styles.directBookingCancelBtn}
                onPress={() => setShowDirectBookingModal(false)}
              >
                <Text style={styles.directBookingCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.directBookingSendBtn, directBookLoading && styles.directBookingSendBtnDisabled]}
                onPress={handleDirectBooking}
                disabled={directBookLoading}
              >
                <Text style={styles.directBookingSendText}>
                  {directBookLoading ? 'Sending...' : 'Send Request'}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: PATIENT.backgroundTint,
  },

  // ─── SIDEBAR DRAWER (Figma) ───────────────────────────────────────────────
  sidebarRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 276,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E7EC',
    paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: 24,
    paddingHorizontal: 14,
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sbUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    shadowColor: PATIENT.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  sbUserMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sbAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sbAvatar: {
    width: '100%',
    height: '100%',
  },
  sbAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sbAvatarText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  sbUserInfo: {
    flex: 1,
  },
  sbUserName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  sbUserRole: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  sbGlobeWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sbMenu: {
    marginTop: 22,
    gap: 4,
  },
  sbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  sbIconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E6F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sbIconChipActive: {
    backgroundColor: PATIENT.primary,
  },
  sbItemActive: {
    backgroundColor: '#F4FAF6',
  },
  sbItemText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1F2937',
  },
  sbItemTextActive: {
    color: PATIENT.primary,
    fontWeight: '700',
  },
  sbLogout: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F87171',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  sbLogoutText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 12,
    paddingBottom: 14,
    backgroundColor: PATIENT.surface,
    zIndex: 100,
  },
  menuBtn: {
    justifyContent: 'center',
    gap: 4,
    marginRight: 14,
    paddingVertical: 4,
  },
  menuLine: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  headerWelcome: {
    fontSize: 12,
    fontWeight: '400',
    color: PATIENT.textSecondary,
    marginBottom: 1,
  },
  headerName: {
    fontSize: 16.5,
    fontWeight: '700',
    color: PATIENT.text,
  },
  bellBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PATIENT.danger,
    borderWidth: 1.5,
    borderColor: PATIENT.surface,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Profile Image
  profileImageWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#E6F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageHeader: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  profileImagePlaceholderHeader: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#22c55e',
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },

  // Dim backdrop behind the full-width dropdown (tap to close)
  dropdownBackdrop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 66 : 70,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    zIndex: 200,
    elevation: 20,
  },
  // Profile Dropdown - full width, with a small gap below the navbar
  profileDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 72,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 21,
    zIndex: 201,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  dropdownHeader: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  avatarChooserOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  avatarChooserSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  avatarChooserHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  avatarChooserTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  avatarChooserOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  avatarChooserIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarChooserTextWrap: {
    flex: 1,
  },
  avatarChooserOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  avatarChooserOptionSub: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  avatarChooserCancel: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  avatarChooserCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  dropdownAvatarWrap: {
    position: 'relative',
  },
  dropdownAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dropdownAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  dropdownAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
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
    width: '100%',
    paddingVertical: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 15,
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
    backgroundColor: PATIENT.backgroundTint,
  },

  // Top bar: tabs + filters
  appointmentsTopBar: {
    backgroundColor: PATIENT.backgroundTint,
    paddingTop: 12,
    paddingBottom: 4,
  },
  appointmentsTabRow: {
    flexDirection: "row",
    backgroundColor: PATIENT.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: PATIENT.border,
  },
  aptTabBtn: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: "center",
  },
  aptTabBtnActive: {
    backgroundColor: PATIENT.primary,
  },
  aptTabText: {
    color: PATIENT.textSecondary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  aptTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  appointmentFilterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    height: 34,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: PATIENT.surface,
    borderWidth: 1,
    borderColor: PATIENT.chipBorder,
  },
  filterChipActive: {
    backgroundColor: PATIENT.primary,
    borderColor: PATIENT.primary,
  },
  filterChipText: {
    color: PATIENT.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },

  // List
  appointmentsList: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 14,
    gap: 12,
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
    backgroundColor: PATIENT.surface,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  appointmentCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  aptAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#E6F6EC",
  },
  appointmentAvatar: {
    width: 52,
    height: 52,
  },
  appointmentMetaColumn: {
    flex: 1,
    paddingTop: 2,
  },
  aptNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  appointmentDoctorName: {
    color: PATIENT.text,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  appointmentSpecialization: {
    color: PATIENT.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "400",
  },
  aptMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  aptMetaText: {
    fontSize: 12,
    color: PATIENT.textSecondary,
    fontWeight: "500",
  },
  aptStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 999,
  },
  aptStatusText: {
    fontSize: 10,
    textTransform: "capitalize",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  aptStatusPending: {
    backgroundColor: "#FFF4E5",
  },
  aptStatusConfirmed: {
    backgroundColor: "#E6F6EC",
  },
  aptStatusCompleted: {
    backgroundColor: "#E6F6EC",
  },
  aptStatusCanceled: {
    backgroundColor: "#FEE2E2",
  },

  aptDivider: {
    height: 1,
    backgroundColor: PATIENT.border,
    marginHorizontal: 14,
    marginTop: 14,
  },
  appointmentDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aptDateIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#E6F6EC",
    alignItems: "center",
    justifyContent: "center",
  },
  aptTimeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PATIENT.chipBorder,
    marginHorizontal: 6,
  },
  appointmentDateText: {
    color: PATIENT.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  appointmentActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  appointmentDetailsBtn: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1.4,
    borderColor: PATIENT.primary,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: PATIENT.surface,
  },
  appointmentDetailsText: {
    color: PATIENT.primary,
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
  aptActionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E6F6EC",
    justifyContent: "center",
    alignItems: "center",
  },
  appointmentDetailsModal: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    width: width * 0.88,
    maxWidth: 420,
    maxHeight: height * 0.8,
  },
  detailsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f4f8",
    backgroundColor: "#ffffff",
  },
  detailsModalTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  detailsCloseBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailsSectionCounselor: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f4f8",
  },
  detailsCounselorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    marginRight: 14,
    backgroundColor: "#f0f4f8",
  },
  detailsCounselorImage: {
    width: "100%",
    height: "100%",
  },
  detailsCounselorInfo: {
    flex: 1,
  },
  detailsCounselorName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailsCounselorSpec: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "500",
  },
  detailsStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 18,
    alignSelf: "flex-start",
  },
  detailsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  detailsStatusLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  detailsSection: {
    marginBottom: 18,
  },
  detailsItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 14,
  },
  detailsItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E6F6EC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailsItemContent: {
    flex: 1,
  },
  detailsItemLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailsItemValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  detailsActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f4f8",
  },
  detailsActionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: "#f9fafb",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailsActionBtnText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
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

  // AI FLOATING BUTTON
  aiButton: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 42 : 28,
    left: "50%",
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: PATIENT.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 999,
  },
  aiButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
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

  // BOTTOM NAVIGATION — Figma
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: PATIENT.surface,
    flexDirection: "row",
    alignItems: "center",
    height: Platform.OS === "ios" ? 84 : 68,
    borderTopWidth: 1,
    borderTopColor: PATIENT.border,
    paddingBottom: Platform.OS === "ios" ? 20 : 6,
    zIndex: 998,
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  navCenterSpacer: {
    width: 72,
  },
  navLabel: {
    fontSize: 10.5,
    fontWeight: "500",
    color: PATIENT.textMuted,
    textAlign: "center",
  },
  navLabelActive: {
    color: PATIENT.primary,
    fontWeight: "700",
  },

  // Chat Popup Styles
  chatPopupOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  chatPopupBackdrop: {
    flex: 1,
    minHeight: 0,
  },
  chatPopup: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
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
    shadowColor: "#2A8A51",
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
  chatStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  chatStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ADE80",
  },
  chatStatus: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  chatHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  chatIconBtnDisabled: {
    opacity: 0.45,
  },
  chatPopupBody: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  chatPopupBodyContent: {
    paddingBottom: 8,
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
  // Column holding the bubble (+ Listen button). flexShrink lets it size to the
  // bubble's content instead of stretching to fill the row. alignItems keeps the
  // Listen button aligned under the bubble on the correct side.
  chatBubbleColumn: {
    flexShrink: 1,
    alignItems: "flex-start",
  },
  chatBubbleColumnUser: {
    alignItems: "flex-end",
  },
  chatBubble: {
    padding: 10,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eaeaea",
    flexShrink: 1,
  },
  chatBubbleUser: {
    backgroundColor: "#2A8A51",
    borderColor: "#2A8A51",
  },
  chatBubbleText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  chatBubbleImage: {
    width: 180,
    height: 140,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#e2e8f0",
  },
  aiAttachPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: -2,
    marginTop: 6,
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  aiAttachThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  aiAttachName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  chatCounselorMention: {
    color: "#1d4ed8",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  chatBubbleTextUser: {
    color: "#ffffff",
  },
  quickRepliesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  quickReplyBtn: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#E6F6EC",
    borderWidth: 1,
    borderColor: "#A7E3BE",
    alignItems: "center",
  },
  quickReplyBtnDisabled: {
    opacity: 0.5,
  },
  quickReplyText: {
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: "700",
  },
  resetConfirmOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  resetConfirmCard: {
    width: "100%",
    maxWidth: 330,
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 18,
  },
  resetConfirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  resetConfirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  resetConfirmText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  resetConfirmActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  resetConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  resetCancelBtn: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  resetStartBtn: {
    backgroundColor: "#2A8A51",
  },
  resetBtnDisabled: {
    opacity: 0.6,
  },
  resetCancelText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
  resetStartText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  chatPopupFooter: {
    padding: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#eaeaea",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#E6F6EC",
    borderWidth: 1,
    borderColor: "#c7c7f5",
    minWidth: 52,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2A8A51",
  },
  langPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  langPickerCard: {
    width: "82%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  langPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  langPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  langPickerItemActive: {
    backgroundColor: "#E6F6EC",
  },
  langPickerItemText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  langPickerItemTextActive: {
    color: "#2A8A51",
    fontWeight: "700",
  },
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  chatInputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 44,
  },
  chatInputLead: {
    marginRight: 6,
  },
  chatInput: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 14,
    color: "#0f172a",
  },
  inlineMicBtn: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#00652C",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00652C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#E6F6EC",
    alignSelf: "flex-start",
  },
  speakBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2A8A51",
  },
  aiVoiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.66)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  aiVoiceCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.26,
    shadowRadius: 28,
    elevation: 18,
  },
  aiVoiceOrbWrap: {
    width: 168,
    height: 168,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  aiVoiceOrbGlowOuter: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: "rgba(42,138,81,0.14)",
  },
  aiVoiceOrbGlowInner: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(42,138,81,0.22)",
  },
  aiVoiceAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00652C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  aiVoiceWave: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 46,
    marginTop: 4,
    marginBottom: 8,
  },
  aiVoiceWaveBar: {
    width: 4,
    height: 46,
    borderRadius: 3,
    backgroundColor: "#2A8A51",
  },
  aiVoiceTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  aiVoiceStatusText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#2A8A51",
  },
  aiVoiceTimer: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  aiVoiceHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748b",
    textAlign: "center",
  },
  aiVoiceError: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#dc2626",
    textAlign: "center",
    fontWeight: "600",
  },
  aiVoiceErrorBox: {
    marginTop: 14,
    alignItems: "center",
    backgroundColor: "#F9F9FF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: "100%",
  },
  aiVoiceErrorText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#475569",
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 12,
  },
  aiVoiceRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#00652C",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  aiVoiceRetryText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
  },
  aiVoiceTranscriptBox: {
    width: "100%",
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  aiVoiceTranscriptText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#334155",
    marginBottom: 5,
  },
  aiVoiceTranscriptSpeaker: {
    fontWeight: "800",
    color: "#4f46e5",
  },
  aiVoiceControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 22,
  },
  aiVoiceControlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  aiVoiceControlBtnActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  aiVoiceControlBtnActiveBlue: {
    backgroundColor: "#2A8A51",
    borderColor: "#2A8A51",
  },
  aiVoiceEndBtn: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },

  loadingDots: {
    flexDirection: "row",
    gap: 6,
  },
  loadingDot: {
    width: 8,
    height: 8,
    backgroundColor: "#2A8A51",
    borderRadius: 4,
  },

  // Call Modal Styles
  // ─── Glass incoming-call popup (rich animations) ──────────────────────────
  // ─── Incoming call screen (Figma: clean white, ripple rings) ──────────────
  callScreen: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 70,
    paddingBottom: 56,
    paddingHorizontal: 24,
  },
  callHeadWrap: {
    alignItems: "center",
  },
  callKicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  callName: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 12,
    textAlign: "center",
  },
  callLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  callLocText: {
    fontSize: 13.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  callAvatarZone: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  callRing: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  callAvatarOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  callAvatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    overflow: "hidden",
  },
  callAvatarImg: {
    width: "100%",
    height: "100%",
  },
  callAvatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: PATIENT.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  callAvatarInitial: {
    color: "#ffffff",
    fontSize: 44,
    fontWeight: "700",
  },
  encryptedBadge: {
    position: "absolute",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EAF6FF",
    borderWidth: 1,
    borderColor: "#D3E9F7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  encryptedText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0E7552",
    letterSpacing: 0.6,
  },
  callActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 56,
  },
  callActionCol: {
    alignItems: "center",
    gap: 10,
  },
  callFab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  callFabDecline: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 7,
  },
  callFabAccept: {
    backgroundColor: "#00875A",
    shadowColor: "#00875A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 7,
  },
  callActionLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
  },

  callBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  callBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 12, 40, 0.45)",
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
    color: "#fdf4ff",
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
    backgroundColor: "#fda4af",
  },
  ringingText: {
    color: "rgba(253, 244, 255, 0.85)",
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
  fabAccept: {},
  actionLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
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
    borderColor: "#2A8A51",
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
    backgroundColor: "#2A8A51",
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
    color: "#2A8A51",
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
  directBookingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  directBookingContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  directBookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  directBookingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#081625",
    flex: 1,
  },
  directBookingClose: {
    fontSize: 28,
    color: "#64748b",
    paddingLeft: 10,
  },
  directBookingScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  directBookingPickerWrap: {
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  directBookingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
    marginTop: 12,
  },
  directBookingInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  directBookingTextArea: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: Platform.OS === "ios" ? "Manrope" : "System",
    fontSize: 14,
    color: "#081625",
    textAlignVertical: "top",
    minHeight: 100,
  },
  directBookingHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 16,
    fontStyle: "italic",
  },
  directBookingActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  directBookingCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  directBookingCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  directBookingSendBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2c50cd",
    alignItems: "center",
  },
  directBookingSendBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },
  directBookingSendText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
