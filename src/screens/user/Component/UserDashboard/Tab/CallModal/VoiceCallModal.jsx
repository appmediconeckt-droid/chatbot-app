import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  AppState,
  Platform,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../../../../../../axiosConfig";
import { RTC_CONFIGURATION } from "../../../../rtcConfig";
import safeVibrate from "../../../../../../utils/safeVibrate";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";

const { width, height } = Dimensions.get("window");

const ACTIVE_STATUSES = new Set(["active", "connected"]);
const TERMINAL_STATUSES = new Set([
  "ended",
  "completed",
  "rejected",
  "cancelled",
  "missed",
  "failed",
  "microphone_error",
]);

const MAX_RECONNECT_ATTEMPTS = 4;
const RECONNECT_BASE_DELAY_MS = 1500;

const normalizeUserType = (userType) => {
  if (!userType) return "user";
  const normalized = String(userType).toLowerCase();
  if (normalized === "counselor" || normalized === "counsellor") {
    return "counsellor";
  }
  return normalized;
};

const normalizeCallStatus = (status) => {
  if (!status) return "pending";
  const normalized = String(status).toLowerCase();
  if (normalized === "accepted") return "active";
  if (normalized === "completed") return "ended";
  return normalized;
};

const isConnectedStatus = (status) =>
  ACTIVE_STATUSES.has(normalizeCallStatus(status));
const isTerminalStatus = (status) =>
  TERMINAL_STATUSES.has(normalizeCallStatus(status));

const VoiceCallModal = ({
  isOpen,
  onClose,
  callData,
  currentUser,
  onEndCall,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("good");
  const [showSettings, setShowSettings] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(70);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRemoteAudioReady, setIsRemoteAudioReady] = useState(false);
  const [webrtcError, setWebrtcError] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  const [callerInfo, setCallerInfo] = useState({
    name: "",
    id: "",
    email: "",
    phone: "",
    specialization: "",
    profilePic: "",
  });

  const [userInfo, setUserInfo] = useState({
    name: "",
    id: "",
    email: "",
    phone: "",
    role: "",
  });

  const [callMetadata, setCallMetadata] = useState({
    callId: "",
    roomId: "",
    type: "voice",
    status: "connecting",
    startTime: null,
    chatId: "",
    apiCallData: null,
    isFallback: false,
  });

  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const animationFrameRef = useRef(null);

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localUserIdRef = useRef("");
  const remoteUserIdRef = useRef("");
  const hasStartedConnectionRef = useRef(false);
  const hasEverConnectedRef = useRef(false);
  const pendingIceCandidatesRef = useRef([]);
  const offerRetryTimerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualCloseRef = useRef(false);
  const establishVoiceConnectionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const animationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen && isCallActive && isConnectedStatus(callMetadata.status)) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animationValue, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animationValue, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      animationValue.setValue(0);
    }
  }, [isOpen, isCallActive, callMetadata.status]);

  const stopVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (error) {
        console.warn("Visualizer source disconnect failed:", error);
      }
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const clearOfferRetryTimer = useCallback(() => {
    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const resetReconnectState = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(false);
  }, [clearReconnectTimer]);

  const updateRemoteAudioState = useCallback(
    ({ forceReady = false } = {}) => {
      const remoteAudioTracks =
        remoteStreamRef.current?.getAudioTracks?.() || [];
      const hasRemoteAudioTrack = remoteAudioTracks.length > 0;
      const hasLiveAudio = remoteAudioTracks.some(
        (track) => track.readyState === "live"
      );
      const shouldMarkReady =
        forceReady || hasRemoteAudioTrack || hasLiveAudio;

      setIsRemoteAudioReady(shouldMarkReady);

      if (shouldMarkReady) {
        hasEverConnectedRef.current = true;
        setIsConnecting(false);
        setIsReconnecting(false);
        resetReconnectState();
        setWebrtcError("");
      }
    },
    [resetReconnectState]
  );

  const cleanupRealtimeConnection = useCallback(
    ({ emitLeave = true } = {}) => {
      clearOfferRetryTimer();

      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.onnegotiationneeded = null;
        try {
          peerConnectionRef.current.close();
        } catch (error) {
          console.warn("Peer connection close failed:", error);
        }
        peerConnectionRef.current = null;
      }

      if (socketRef.current) {
        try {
          if (emitLeave && callMetadata.callId && localUserIdRef.current) {
            socketRef.current.emit("leave-call", {
              callId: callMetadata.callId,
              userId: localUserIdRef.current,
            });
          }
        } catch (error) {
          console.warn("Socket leave-call failed:", error);
        }

        socketRef.current.off("connect");
        socketRef.current.off("offer");
        socketRef.current.off("answer");
        socketRef.current.off("call-offer");
        socketRef.current.off("call-answer");
        socketRef.current.off("ice-candidate");
        socketRef.current.off("user-joined");
        socketRef.current.off("user-left");
        socketRef.current.off("user-left-call");
        socketRef.current.off("call_ended");
        socketRef.current.off("call-ended");
        socketRef.current.off("call-status-update");
        socketRef.current.off("connect_error");
        socketRef.current.off("disconnect");
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
      }

      setIsRemoteAudioReady(false);
      pendingIceCandidatesRef.current = [];
      hasStartedConnectionRef.current = false;
    },
    [callMetadata.callId, clearOfferRetryTimer]
  );

  // Process callData when modal opens
  useEffect(() => {
    if (isOpen && callData) {
      setCallerInfo({
        name: callData.counselorName || callData.name || "Counselor",
        id: callData.counselorId || callData.id,
        email: callData.counselorEmail || callData.email,
        phone: callData.counselorPhone || callData.phoneNumber,
        specialization:
          callData.counselorSpecialization || "Mental Health Professional",
        profilePic: callData.profilePic || callData.avatar,
      });

      if (currentUser) {
        setUserInfo({
          name: currentUser.name || currentUser.fullName || "User",
          id: currentUser.id || currentUser._id,
          email: currentUser.email,
          phone: currentUser.phoneNumber || currentUser.phone,
          role: currentUser.role || "user",
        });
      } else if (callData.userName) {
        setUserInfo({
          name: callData.userName,
          id: callData.userId,
          email: callData.userEmail,
          phone: callData.userPhone,
          role: "user",
        });
      }

      const normalizedStatus = normalizeCallStatus(callData.status);

      setCallMetadata({
        callId: callData.callId || callData.id || "",
        roomId: callData.roomId || "",
        type: callData.type || "voice",
        status: normalizedStatus,
        startTime: callData.startTime || new Date().toISOString(),
        chatId: callData.chatId,
        apiCallData: callData.apiCallData || null,
        isFallback: callData.isFallback || false,
      });

      setCallDuration(0);
      setIsConnecting(
        !isConnectedStatus(normalizedStatus) &&
          !isTerminalStatus(normalizedStatus)
      );
      setIsReconnecting(false);
      setWebrtcError("");
      isManualCloseRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      hasStartedConnectionRef.current = false;
      hasEverConnectedRef.current = false;
    }
  }, [isOpen, callData, currentUser, clearReconnectTimer]);

  // Call duration timer
  useEffect(() => {
    let timer;
    if (
      isOpen &&
      isCallActive &&
      callMetadata.startTime &&
      isConnectedStatus(callMetadata.status)
    ) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, isCallActive, callMetadata.startTime, callMetadata.status]);

  // Simulate audio level for visualizer
  useEffect(() => {
    if (!isOpen || !isCallActive || !isConnectedStatus(callMetadata.status)) {
      setAudioLevel(0);
      return;
    }

    const interval = setInterval(() => {
      if (!isMuted) {
        const level = Math.random() * 100;
        setAudioLevel(level);
      } else {
        setAudioLevel(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isCallActive, callMetadata.status, isMuted]);

  // App state change handler
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isOpen &&
        isCallActive
      ) {
        safeVibrate(500);
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isOpen, isCallActive]);

  useEffect(() => {
    if (!isOpen) {
      isManualCloseRef.current = true;
      resetReconnectState();
      setIsMuted(false);
      setIsSpeakerOn(true);
      setCallDuration(0);
      setIsCallActive(true);
      setIsRecording(false);
      setShowSettings(false);
      setIsConnecting(true);
      setIsReconnecting(false);
      setCallMetadata((prev) => ({ ...prev, status: "ended" }));
      setWebrtcError("");
      hasEverConnectedRef.current = false;

      cleanupRealtimeConnection();

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      stopVisualizer();
      setAudioLevel(0);
    }
  }, [isOpen, cleanupRealtimeConnection, stopVisualizer, resetReconnectState]);

  const handleEndCall = async () => {
    isManualCloseRef.current = true;
    resetReconnectState();
    hasEverConnectedRef.current = false;
    setIsCallActive(false);
    setIsReconnecting(false);
    setCallMetadata((prev) => ({ ...prev, status: "ended" }));

    cleanupRealtimeConnection();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    stopVisualizer();

    if (onEndCall && callMetadata.callId) {
      try {
        await onEndCall(callMetadata.callId);
      } catch (error) {
        console.error("Error ending voice call:", error);
      }
    }

    setTimeout(() => {
      onClose();
    }, 500);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
      }, 30000);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getQualityIcon = () => {
    switch (connectionQuality) {
      case "good":
        return "signal";
      case "medium":
        return "signal-cellular-alt";
      case "poor":
        return "warning";
      default:
        return "signal";
    }
  };

  const getQualityColor = () => {
    switch (connectionQuality) {
      case "good":
        return "#4ade80";
      case "medium":
        return "#fbbf24";
      case "poor":
        return "#f87171";
      default:
        return "#4ade80";
    }
  };

  const getCallStatusDisplay = () => {
    if (webrtcError) {
      return webrtcError;
    }

    if (isReconnecting) {
      return "Reconnecting call...";
    }

    if (isConnectedStatus(callMetadata.status) && !isRemoteAudioReady) {
      return "Connected. Waiting for audio...";
    }

    if (isConnecting) {
      return callMetadata.status === "pending" || callMetadata.status === "ringing"
        ? "Waiting for counselor to accept..."
        : "Connecting...";
    }

    switch (callMetadata.status) {
      case "active":
      case "connected":
        return "Connected";
      case "pending":
      case "ringing":
        return "Waiting for counselor to accept...";
      case "rejected":
        return "Call Declined";
      case "cancelled":
        return "Call Cancelled";
      case "ended":
        return "Call Ended";
      case "microphone_error":
        return "Microphone Error";
      default:
        return callMetadata.status;
    }
  };

  const getStatusColor = () => {
    if (webrtcError) return "#f87171";
    if (isReconnecting) return "#fbbf24";
    if (isConnectedStatus(callMetadata.status)) return "#4ade80";
    if (isConnecting) return "#fbbf24";
    return "#f87171";
  };

  const scaleInterpolate = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const renderVisualizer = () => {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      const height = Math.max(5, Math.min(50, (audioLevel * (i + 1)) / 20));
      bars.push(
        <View
          key={i}
          style={[
            styles.visualizerBar,
            {
              height: height,
              opacity: isMuted ? 0.3 : 1,
            },
          ]}
        />
      );
    }
    return bars;
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="slide"
      onRequestClose={handleEndCall}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="call" size={24} color="white" />
              <View style={styles.callInfo}>
                <Text style={styles.headerTitle}>Voice Call with {callerInfo.name}</Text>
                {callerInfo.specialization && (
                  <Text style={styles.callerSpecialization}>
                    {callerInfo.specialization}
                  </Text>
                )}
                <View style={styles.qualityContainer}>
                  <Ionicons
                    name={getQualityIcon()}
                    size={12}
                    color={getQualityColor()}
                  />
                  <Text style={[styles.qualityText, { color: getQualityColor() }]}>
                    {connectionQuality}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Caller Profile */}
            <View style={styles.callerProfile}>
              <Animated.View
                style={[
                  styles.callerAvatar,
                  {
                    transform: [
                      {
                        scale:
                          isConnectedStatus(callMetadata.status) &&
                          !isConnecting
                            ? scaleInterpolate
                            : 1,
                      },
                    ],
                  },
                ]}
              >
                {callerInfo.profilePic ? (
                  <Text style={styles.avatarText}>
                    {callerInfo.name.charAt(0)}
                  </Text>
                ) : (
                  <Text style={styles.avatarText}>
                    {callerInfo.name.charAt(0)}
                  </Text>
                )}
              </Animated.View>
              <Text style={styles.callerName}>{callerInfo.name}</Text>
              {callerInfo.specialization && (
                <Text style={styles.callerSpecializationText}>
                  {callerInfo.specialization}
                </Text>
              )}
              <View style={styles.callStatus}>
                {isConnectedStatus(callMetadata.status) && (
                  <View style={styles.pulseDot} />
                )}
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {getCallStatusDisplay()}
                </Text>
              </View>

              {isCallActive && isConnectedStatus(callMetadata.status) && (
                <View style={styles.callDuration}>
                  <Text style={styles.durationIcon}>⏱️</Text>
                  <Text style={styles.durationText}>
                    {formatTime(callDuration)}
                  </Text>
                </View>
              )}

              {callMetadata.isFallback && (
                <Text style={styles.fallbackWarning}>
                  ⚠️ Using fallback connection
                </Text>
              )}
            </View>

            {/* Audio Visualizer */}
            {!isConnecting && isConnectedStatus(callMetadata.status) && (
              <View style={styles.audioVisualizer}>
                <View style={styles.visualizerBars}>{renderVisualizer()}</View>
                {isMuted && (
                  <View style={styles.mutedBadge}>
                    <Text style={styles.mutedBadgeText}>🔇 Microphone Muted</Text>
                  </View>
                )}
                {isRecording && (
                  <View style={styles.recordingBadge}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingBadgeText}>Recording</Text>
                  </View>
                )}
              </View>
            )}

            {/* Settings Panel */}
            {showSettings && (
              <View style={styles.settingsPanel}>
                <Text style={styles.settingsTitle}>Call Settings</Text>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Volume</Text>
                  <View style={styles.volumeContainer}>
                    <Text style={styles.volumeValue}>{volumeLevel}%</Text>
                  </View>
                </View>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Call Information</Text>
                  <View style={styles.callerInfoDisplay}>
                    <Text style={styles.infoText}>
                      <Text style={styles.infoLabel}>Counselor:</Text> {callerInfo.name}
                    </Text>
                    {callerInfo.specialization && (
                      <Text style={styles.infoText}>
                        <Text style={styles.infoLabel}>Specialization:</Text>{" "}
                        {callerInfo.specialization}
                      </Text>
                    )}
                    <Text style={styles.infoText}>
                      <Text style={styles.infoLabel}>User:</Text> {userInfo.name}
                    </Text>
                    <Text style={styles.infoText}>
                      <Text style={styles.infoLabel}>Call Type:</Text> 📞 Voice Call
                    </Text>
                    <Text style={styles.infoText}>
                      <Text style={styles.infoLabel}>Duration:</Text> {formatTime(callDuration)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.closeSettingsBtn}
                  onPress={() => setShowSettings(false)}
                >
                  <Text style={styles.closeSettingsText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Call Controls */}
            <View style={styles.callControls}>
              <TouchableOpacity
                style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                onPress={() => setIsMuted(!isMuted)}
              >
                <MaterialIcons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color="white"
                />
                <Text style={styles.controlBtnLabel}>
                  {isMuted ? "Unmute" : "Mute"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
                onPress={() => setIsSpeakerOn(!isSpeakerOn)}
              >
                <Ionicons
                  name={isSpeakerOn ? "volume-high" : "volume-off"}
                  size={24}
                  color="white"
                />
                <Text style={styles.controlBtnLabel}>
                  {isSpeakerOn ? "Speaker" : "Earpiece"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlBtn, isRecording && styles.controlBtnActive]}
                onPress={toggleRecording}
              >
                <MaterialIcons
                  name={isRecording ? "stop" : "fiber-manual-record"}
                  size={24}
                  color={isRecording ? "#ef4444" : "white"}
                />
                <Text style={styles.controlBtnLabel}>
                  {isRecording ? "Stop" : "Record"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setShowSettings(!showSettings)}
              >
                <Ionicons name="settings-outline" size={24} color="white" />
                <Text style={styles.controlBtnLabel}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlBtn, styles.endCallBtn]}
                onPress={handleEndCall}
              >
                <MaterialIcons name="call-end" size={24} color="white" />
                <Text style={styles.controlBtnLabel}>End</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width,
    height: height,
    backgroundColor: "#0f1f2f",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  callInfo: {
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  callerSpecialization: {
    fontSize: 12,
    color: "#a0aec0",
    marginTop: 2,
  },
  qualityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  qualityText: {
    fontSize: 11,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 22,
    color: "white",
  },
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  // Caller Profile
  callerProfile: {
    alignItems: "center",
    marginBottom: 20,
  },
  callerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontSize: 56,
    fontWeight: "bold",
    color: "white",
  },
  callerName: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  callerSpecializationText: {
    fontSize: 14,
    color: "#a0aec0",
    marginBottom: 8,
  },
  callStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  statusText: {
    fontSize: 14,
  },
  callDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 40,
    marginTop: 8,
  },
  durationIcon: {
    fontSize: 16,
  },
  durationText: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  fallbackWarning: {
    fontSize: 12,
    color: "#fbbf24",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  // Audio Visualizer
  audioVisualizer: {
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 60,
    marginBottom: 16,
    position: "relative",
  },
  visualizerBars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 4,
  },
  visualizerBar: {
    width: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  mutedBadge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: [{ translateX: -50 }],
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  mutedBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "white",
  },
  recordingBadge: {
    position: "absolute",
    bottom: -12,
    left: "50%",
    transform: [{ translateX: -50 }],
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  recordingBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "white",
  },
  // Settings Panel
  settingsPanel: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#a0aec0",
    marginBottom: 8,
  },
  volumeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  volumeValue: {
    fontSize: 14,
    color: "white",
  },
  callerInfoDisplay: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 12,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    color: "#e2e8f0",
    marginVertical: 2,
  },
  infoLabel: {
    fontWeight: "600",
    color: "white",
  },
  closeSettingsBtn: {
    width: "100%",
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeSettingsText: {
    fontSize: 14,
    fontWeight: "500",
    color: "white",
  },
  // Call Controls
  callControls: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  controlBtn: {
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 70,
  },
  controlBtnActive: {
    backgroundColor: "#2563eb",
  },
  controlBtnLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "white",
  },
  endCallBtn: {
    backgroundColor: "#ef4444",
  },
});

export default VoiceCallModal;
