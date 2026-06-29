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
import axiosInstance, { API_BASE_URL } from "../../../../../axiosConfig";
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
import AvatarBuilder from "../../PatientProfile/AvatarBuilder";
import LanguageSelector from '../../../../../components/common/LanguageSelector';
import RatingPrompt from '../../../../../components/RatingPrompt';
import { loadUserLanguage } from '../../../../../i18n';
import RealVideoCallModal from "../Tab/CallModal/VideoCallModal";
import RealVoiceCallModal from "../Tab/CallModal/VoiceCallModal";
import HelpSupport from "../Tab/HelpSupport/HelpSupport";
import PrivacyPolicy from "../Tab/PrivacyPolicy/PrivacyPolicy";
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const sendMessageRef = useRef(sendMessage);
  const setNewMessageRef = useRef(setNewMessage);
  const micPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  useEffect(() => { setNewMessageRef.current = setNewMessage; }, [setNewMessage]);

  // Track keyboard height so popup fills exactly the space above the keyboard
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Auto-scroll to bottom whenever a new message arrives or AI starts typing
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isLoading]);

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
      await Speech.startListening(selectedLang);
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

  return (
  <Modal animationType="slide" transparent={true} visible={true} statusBarTranslucent>
    <View style={styles.chatPopupOverlay}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.chatPopupBackdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.chatPopup, {
        height: keyboardHeight > 0 ? height - keyboardHeight - 40 : 630,
        marginBottom: keyboardHeight,
      }]}>
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
                    colors={['#667eea', '#764ba2']}
                    style={[styles.chatAvatar, styles.chatAvatarSmall]}
                  >
                    <MaterialIcons name="auto-awesome" size={14} color="white" />
                  </LinearGradient>
                )}
                <View style={{ flex: 1 }}>
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
                        color={isSpeaking ? "#ef4444" : "#667eea"}
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
                      <Ionicons name="person-circle" size={18} color="#667eea" />
                    )}
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
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => setShowLangPicker(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="language" size={16} color="#667eea" />
            <Text style={styles.langBtnText} numberOfLines={1}>
              {VOICE_LANGUAGES.find(l => l.code === selectedLang)?.label?.split(' ')[0] || 'EN'}
            </Text>
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.chatInput}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={() => sendMessage(newMessage)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={toggleRecording}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ scale: micPulse }] }}>
              <MaterialIcons
                name={isRecording ? "mic" : "mic-none"}
                size={20}
                color={isRecording ? "#fff" : "#667eea"}
              />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(newMessage)}
            disabled={!newMessage.trim() || isLoading}
          >
            <MaterialIcons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
        {/* Language picker modal */}
        <Modal
          transparent
          visible={showLangPicker}
          animationType="fade"
          onRequestClose={() => setShowLangPicker(false)}
        >
          <TouchableOpacity
            style={styles.langPickerOverlay}
            activeOpacity={1}
            onPress={() => setShowLangPicker(false)}
          >
            <View style={styles.langPickerCard}>
              <Text style={styles.langPickerTitle}>Select Voice Language</Text>
              {VOICE_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langPickerItem, selectedLang === lang.code && styles.langPickerItemActive]}
                  onPress={() => {
                    setShowLangPicker(false);
                    if (lang.code !== selectedLang) {
                      setSelectedLang(lang.code);
                      onLangChange?.(lang.code);
                    }
                  }}
                >
                  <Text style={[styles.langPickerItemText, selectedLang === lang.code && styles.langPickerItemTextActive]}>
                    {lang.label}
                  </Text>
                  {selectedLang === lang.code && (
                    <MaterialIcons name="check" size={18} color="#667eea" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        {showResetConfirm && (
          <View style={styles.resetConfirmOverlay}>
            <View style={styles.resetConfirmCard}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
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

  const ringStyle = (val) => ({
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
    opacity: val.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
  });
  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  // User gradient: purple / pink (counselor uses teal/blue — keeps each role distinct)
  const cardGradient = ["rgba(102, 126, 234, 0.92)", "rgba(118, 75, 162, 0.92)", "rgba(190, 75, 200, 0.85)"];
  const avatarGradient = ["#a78bfa", "#ec4899"];
  const acceptGradient = ["#10b981", "#059669"];

  return (
    <Modal transparent visible={isOpen} animationType="fade" onRequestClose={onClose}>
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
          <LinearGradient
            colors={cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassCardGradient}
          >
            <View style={styles.callTopRow}>
              <View style={styles.callTopPill}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={12} color="#fdf4ff" />
                <Text style={styles.callTopPillText}>
                  {isVideo ? t('call:incomingVideoCall') : t('call:incomingVoiceCall')}
                </Text>
              </View>
            </View>

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

            <Text style={styles.callerName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.ringingRow}>
              <View style={styles.ringingDot} />
              <Text style={styles.ringingText}>Ringing…</Text>
            </View>

            <View style={styles.actionsRow}>
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

const MyAppointmentsPanel = ({ onBookPress }) => {
  const { t } = useTranslation();
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
          <AppointmentsSkeleton />
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

                <TouchableOpacity style={styles.appointmentBookBtn} onPress={() => onBookPress(apt)}>
                  <MaterialIcons name="add-circle-outline" size={15} color="#ffffff" />
                  <Text style={styles.appointmentBookText}>Book Now</Text>
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

            <Text style={styles.appointmentDetailsTitle}>{t('appointment:appointmentDate')}</Text>
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
  const { t } = useTranslation();
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
  const [selectedLang, setSelectedLang] = useState('en-IN');
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

  const sendMessage = async (messageText = newMessage) => {
    const sourceText = typeof messageText === "string" ? messageText : newMessage;
    const trimmedMessage = sourceText.trim();
    if (!trimmedMessage) return;

    const userMessage = {
      id: Date.now(),
      text: trimmedMessage,
      sender: "user",
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
      const history = chatMessages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

      const response = await axiosInstance.post('/api/ai/message', {
        message: userMessage.text,
        history,
        sessionId: aiSessionId,
        language: selectedLang,
      });

      if (response.data?.success) {
        if (response.data.data?.sessionId) {
          setAiSessionId(response.data.data.sessionId);
        }
        const aiMessage = {
          id: Date.now() + 1,
          text: response.data.data?.aiResponse,
          sender: "ai",
          quickReplies: response.data.data?.quickReplies || null,
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
        backgroundColor="#ffffff"
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
          style={styles.headerLeft}
          onPress={() => setShowProfileMenu(!showProfileMenu)}
          activeOpacity={0.8}
        >
          <View style={styles.profileImageWrapper}>
            {userData.profilePhoto ? (
              <Image source={{ uri: userData.profilePhoto }} style={styles.profileImageHeader} />
            ) : (
              <View style={styles.profileImagePlaceholderHeader}>
                <Text style={styles.profileInitialsHeader}>
                  {userData.name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.headerNameWrap}>
            <Text style={styles.headerName} numberOfLines={1}>{userData.name || 'User'}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <LanguageSelector iconColor="#2563EB" iconSize={20} userId={userId} role="user" />
        </View>

        {/* Profile Dropdown Menu */}
        {showProfileMenu && (
          <Animated.View style={[styles.profileDropdown, { opacity: headerAnim }]}>
            <View style={styles.dropdownHeader}>
              <TouchableOpacity
                style={styles.dropdownAvatarWrap}
                onPress={() => setShowAvatarChooser(true)}
                activeOpacity={0.8}
                disabled={photoUploading}
              >
                {userData.profilePhoto ? (
                  <Image source={{ uri: userData.profilePhoto }} style={styles.dropdownAvatar} />
                ) : (
                  <View style={styles.dropdownAvatarPlaceholder}>
                    <Text style={styles.dropdownAvatarText}>
                      {userData.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.dropdownAvatarBadge}>
                  {photoUploading ? (
                    <ActivityIndicator size={11} color="#ffffff" />
                  ) : (
                    <MaterialIcons name="camera-alt" size={12} color="#ffffff" />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.dropdownUserInfo}>
                <Text style={styles.dropdownUserName}>{userData.name}</Text>
                <Text style={styles.dropdownUserEmail}>{userData.email}</Text>
              </View>
            </View>
            <View style={styles.dropdownItems}>
              <TouchableOpacity style={styles.dropdownItem} onPress={handleProfileClick}>
                <MaterialIcons name="person" size={18} color="#2563EB" />
                <Text style={styles.dropdownItemText}>{t('settings:myProfile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setShowProfileMenu(false); setActive("settings"); }}
              >
                <MaterialIcons name="settings" size={18} color="#64748b" />
                <Text style={styles.dropdownItemText}>{t('settings:settings')}</Text>
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity
                style={[styles.dropdownItem, styles.logoutDropdownItem]}
                onPress={() => setShowLogoutConfirm(true)}
              >
                <MaterialIcons name="logout" size={18} color="#ef4444" />
                <Text style={[styles.dropdownItemText, styles.logoutText]}>{t('auth:logout')}</Text>
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
          colors={['#4f46e5', '#7c3aed', '#9333ea']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiButtonGradient}
        >
          <MaterialIcons name="auto-awesome" size={30} color="white" />
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
          <Text style={[styles.navLabel, active === "Chat" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard:chat')}</Text>
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
          <Text style={[styles.navLabel, active === "Counselor" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard:counselor')}</Text>
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
          <Text style={[styles.navLabel, active === "Appointment" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard:myAppointment')}</Text>
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
          <Text style={[styles.navLabel, active === "Wallet" && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard:wallet')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setShowMoreModal(true)}
        >
          <View style={styles.navIconWrapper}>
            <MaterialIcons name="more-horiz" size={24} color="#94a3b8" />
          </View>
          <Text style={styles.navLabel} numberOfLines={1} adjustsFontSizeToFit>{t('settings:more')}</Text>
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
                    <Text style={styles.premiumMoreTitle}>{t('settings:settingsAndMore')}</Text>
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
                    <Text style={styles.premiumSectionTitle}>{t('settings:dashboardServices')}</Text>
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
                    <Text style={styles.premiumSectionTitle}>{t('settings:accountSettings')}</Text>
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
                      <Text style={styles.premiumListText}>{t('settings:myProfile')}</Text>
                      <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.premiumListItem}
                      onPress={() => { setShowMoreModal(false); setActive("settings"); }}
                    >
                      <View style={[styles.premiumListIcon, { backgroundColor: '#eef2ff' }]}>
                        <MaterialIcons name="settings" size={20} color="#4f46e5" />
                      </View>
                      <Text style={styles.premiumListText}>{t('settings:accountSettings')}</Text>
                      <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.premiumListItem}
                      onPress={() => { setShowMoreModal(false); setShowHelpSupport(true); }}
                    >
                      <View style={[styles.premiumListIcon, { backgroundColor: '#f0fdf4' }]}>
                        <MaterialIcons name="help-outline" size={20} color="#22c55e" />
                      </View>
                      <Text style={styles.premiumListText}>{t('settings:helpSupport')}</Text>
                      <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.premiumListItem}
                      onPress={() => { setShowMoreModal(false); setShowPrivacyPolicy(true); }}
                    >
                      <View style={[styles.premiumListIcon, { backgroundColor: '#faf5ff' }]}>
                        <MaterialIcons name="security" size={20} color="#a855f7" />
                      </View>
                      <Text style={styles.premiumListText}>{t('settings:privacyPolicy')}</Text>
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
                      <Text style={styles.premiumLogoutText}>{t('settings:logoutAccount')}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* LOGOUT CONFIRM MODAL */}
      {/* Help & Support full-screen modal */}
      <Modal visible={showHelpSupport} animationType="slide" transparent={false} onRequestClose={() => setShowHelpSupport(false)}>
        <HelpSupport onClose={() => setShowHelpSupport(false)} />
      </Modal>

      {/* Privacy Policy full-screen modal */}
      <Modal visible={showPrivacyPolicy} animationType="slide" transparent={false} onRequestClose={() => setShowPrivacyPolicy(false)}>
        <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} />
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
              <View style={[styles.avatarChooserIcon, { backgroundColor: '#eef2ff' }]}>
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
              <View style={[styles.avatarChooserIcon, { backgroundColor: '#eff6ff' }]}>
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

      <AvatarBuilder
        visible={showAvatarBuilder}
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
    backgroundColor: "#f7f9fb",
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 11,
  },
  headerNameWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.2,
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
    backgroundColor: '#eff6ff',
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

  // AI FLOATING BUTTON
  aiButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 999,
  },
  aiButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 31,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    gap: 2,
  },
  aiButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 1,
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
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
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
    backgroundColor: "#667eea",
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
    backgroundColor: "#f0f0ff",
    borderWidth: 1,
    borderColor: "#c7c7f5",
    minWidth: 52,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#667eea",
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
    backgroundColor: "#f0f0ff",
  },
  langPickerItemText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  langPickerItemTextActive: {
    color: "#667eea",
    fontWeight: "700",
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
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0ff",
  },
  micBtnActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
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
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#f0f0ff",
    alignSelf: "flex-start",
  },
  speakBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#667eea",
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
  // ─── Glass incoming-call popup (rich animations) ──────────────────────────
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
