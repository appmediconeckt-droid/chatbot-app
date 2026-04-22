import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Slider,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { RTCPeerConnection, RTCView, mediaDevices } from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const ACTIVE = new Set(['active', 'connected']);
const TERMINAL = new Set([
  'ended', 'completed', 'rejected', 'cancelled', 'missed', 'failed',
  'camera_error', 'no_camera',
]);

const MAX_RECONNECT_ATTEMPTS = 4;
const RECONNECT_BASE_DELAY_MS = 1500;

const normalizeStatus = (status) => {
  if (!status) return 'connecting';
  const normalized = String(status).toLowerCase();
  if (normalized === 'accepted') return 'active';
  if (normalized === 'completed') return 'ended';
  return normalized;
};

const isConnectedStatus = (status) => ACTIVE.has(normalizeStatus(status));
const isTerminalStatus = (status) => TERMINAL.has(normalizeStatus(status));

const VideoCallModal = ({
  isOpen,
  onClose,
  callData,
  currentUser,
  onEndCall,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCameraSwitched, setIsCameraSwitched] = useState(false);
  const [isCallActive, setIsCallActive] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(70);
  const [callDuration, setCallDuration] = useState(0);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCamera, setCurrentCamera] = useState('');

  const [callerName, setCallerName] = useState('Counselor');
  const [callerProfilePic, setCallerProfilePic] = useState('C');
  const [callerPhoneNumber, setCallerPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState('connecting');
  const [callId, setCallId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [callStartTime, setCallStartTime] = useState(null);
  const [apiCallData, setApiCallData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRemoteVideoReady, setIsRemoteVideoReady] = useState(false);
  const [webrtcError, setWebrtcError] = useState('');
  const [localStreamURL, setLocalStreamURL] = useState(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState(null);

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const pendingIceRef = useRef([]);
  const startedRef = useRef(false);
  const localUserIdRef = useRef('');
  const remoteUserIdRef = useRef('');
  const hasEverConnectedRef = useRef(false);
  const isManualCloseRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const establishConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const API_BASE_URL = 'https://chatbot-backend-js25.onrender.com'; // Replace with your API URL
  const RTC_CONFIGURATION = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

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

  const updateRemoteState = useCallback(() => {
    const hasLiveVideo = remoteStreamRef.current !== null;
    const shouldMarkReady = hasLiveVideo || (peerRef.current?.connectionState === 'connected');

    setIsRemoteVideoReady(shouldMarkReady);

    if (shouldMarkReady) {
      hasEverConnectedRef.current = true;
      setIsConnecting(false);
      setIsReconnecting(false);
      resetReconnectState();
      setWebrtcError('');
    }
  }, [resetReconnectState]);

  const cleanupRealtime = useCallback(
    async ({ emitLeave = true } = {}) => {
      if (peerRef.current) {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
        peerRef.current = null;
      }

      if (socketRef.current) {
        try {
          if (emitLeave && callId && localUserIdRef.current) {
            socketRef.current.emit('leave-call', {
              callId,
              userId: localUserIdRef.current,
            });
          }
        } catch (error) {}

        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (remoteStreamRef.current) {
        remoteStreamRef.current.release();
        remoteStreamRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.release();
        localStreamRef.current = null;
      }

      setRemoteStreamURL(null);
      setLocalStreamURL(null);
      pendingIceRef.current = [];
      startedRef.current = false;
      setIsRemoteVideoReady(false);
    },
    [callId],
  );

  const replaceOutgoingTracks = useCallback((stream) => {
    if (!peerRef.current || !stream) return;

    const tracksByKind = stream.getTracks().reduce((acc, track) => {
      acc[track.kind] = track;
      return acc;
    }, {});

    const handledKinds = new Set();
    peerRef.current.getSenders().forEach((sender) => {
      const kind = sender.track?.kind;
      if (!kind) return;
      handledKinds.add(kind);
      sender.replaceTrack(tracksByKind[kind] || null).catch(() => {});
    });
  }, []);

  const initializeCamera = useCallback(async (useBackCamera = false, selectedDeviceId = '') => {
    try {
      let constraints = {
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: useBackCamera ? 'environment' : 'user',
        },
      };

      if (selectedDeviceId) {
        constraints.video.deviceId = { exact: selectedDeviceId };
      }

      const stream = await mediaDevices.getUserMedia(constraints);
      
      if (localStreamRef.current) {
        localStreamRef.current.release();
      }
      
      localStreamRef.current = stream;
      setLocalStreamURL(stream.toURL());
      
      // Apply mute and video settings
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = isVideoEnabled;
      });
      
      if (peerRef.current) {
        replaceOutgoingTracks(stream);
      }
      
      return stream;
    } catch (error) {
      console.error('Camera access error:', error);
      setWebrtcError('Unable to access camera.');
      return null;
    }
  }, [isMuted, isVideoEnabled, replaceOutgoingTracks]);

  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      if (cameras[0]) setCurrentCamera(cameras[0].deviceId);
    } catch (error) {
      console.error('Error listing cameras:', error);
    }
  }, []);

  const scheduleReconnect = useCallback(
    (reason = 'Network issue') => {
      if (isManualCloseRef.current || !isOpen || !isCallActive) return;
      if (!hasEverConnectedRef.current) return;
      if (!callId || !isConnectedStatus(callStatus) || isTerminalStatus(callStatus)) return;
      if (reconnectTimeoutRef.current) return;

      const nextAttempt = reconnectAttemptsRef.current + 1;
      if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
        setIsReconnecting(false);
        setWebrtcError('Video call connection lost. Please call again.');
        return;
      }

      reconnectAttemptsRef.current = nextAttempt;
      setIsReconnecting(true);
      setIsConnecting(true);
      setIsRemoteVideoReady(false);
      setWebrtcError(`${reason}. Reconnecting... (${nextAttempt}/${MAX_RECONNECT_ATTEMPTS})`);

      const delay = Math.min(RECONNECT_BASE_DELAY_MS * nextAttempt, 7000);

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        startedRef.current = false;
        cleanupRealtime({ emitLeave: false });
        if (typeof establishConnectionRef.current === 'function') {
          establishConnectionRef.current();
        }
      }, delay);
    },
    [cleanupRealtime, isCallActive, isOpen, callId, callStatus],
  );

  const establishConnection = useCallback(async () => {
    if (startedRef.current || !callId || !isConnectedStatus(callStatus)) return;

    const localUserId = currentUser?.id || currentUser?._id || 
      callData?.currentUserId || await AsyncStorage.getItem('userId') ||
      await AsyncStorage.getItem('counsellorId') || await AsyncStorage.getItem('counselorId');
    
    if (!localUserId) return;

    const serverCall = apiCallData || callData?.apiCallData || {};
    const initiatorId = serverCall?.initiator?.id || callData?.initiator?.id || callData?.initiatorId;
    const receiverId = serverCall?.receiver?.id || callData?.receiver?.id || callData?.receiverId;
    
    if (!initiatorId || !receiverId) return;

    localUserIdRef.current = String(localUserId);
    remoteUserIdRef.current = String(initiatorId) === String(localUserId)
      ? String(receiverId)
      : String(initiatorId);
    startedRef.current = true;

    const localStream = localStreamRef.current || await initializeCamera(isCameraSwitched);
    if (!localStream) {
      startedRef.current = false;
      return;
    }

    const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_BASE_DELAY_MS,
    });
    socketRef.current = socket;

    const peer = new RTCPeerConnection(RTC_CONFIGURATION);
    peerRef.current = peer;
    
    localStream.getTracks().forEach((track) => {
      peer.addTrack(track, localStream);
    });

    const flushIceQueue = async () => {
      if (!peerRef.current?.remoteDescription) return;
      const queue = [...pendingIceRef.current];
      pendingIceRef.current = [];
      for (const candidate of queue) {
        try {
          await peerRef.current.addIceCandidate(candidate);
        } catch (error) {}
      }
    };

    const sendOffer = async () => {
      if (!peerRef.current || peerRef.current.signalingState !== 'stable') return;
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit('call-offer', { callId, offer, to: remoteUserIdRef.current });
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('ice-candidate', {
        callId,
        candidate: event.candidate,
        userId: localUserIdRef.current,
        to: remoteUserIdRef.current,
      });
    };

    peer.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        remoteStreamRef.current = incomingStream;
        setRemoteStreamURL(incomingStream.toURL());
      }
      updateRemoteState();
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'connected') {
        hasEverConnectedRef.current = true;
        setIsConnecting(false);
        setIsReconnecting(false);
        resetReconnectState();
        setWebrtcError('');
        updateRemoteState();
      }
      if (state === 'failed' || state === 'disconnected') {
        setWebrtcError('Video connection interrupted.');
        scheduleReconnect('Video connection interrupted');
      }
    };

    socket.on('connect', () => {
      resetReconnectState();
      setWebrtcError('');
      setIsConnecting(true);
      socket.emit('join-call', { callId, userId: localUserIdRef.current });
    });

    socket.on('user-joined', async ({ userId }) => {
      if (String(userId) === localUserIdRef.current) return;
      if (peerRef.current?.connectionState === 'connected') return;

      const isLocalInitiator = String(initiatorId) === String(localUserIdRef.current);
      if (isLocalInitiator) {
        await sendOffer();
      }
    });

    const onOffer = async ({ offer, userId, from }) => {
      const senderId = String(userId || from || '');
      if (!offer || senderId === localUserIdRef.current || !peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(offer);
        await flushIceQueue();
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit('call-answer', {
          callId,
          answer,
          to: remoteUserIdRef.current,
        });
      } catch (error) {
        setWebrtcError('Failed to process call offer.');
      }
    };

    const onAnswer = async ({ answer, userId, from }) => {
      const senderId = String(userId || from || '');
      if (!answer || senderId === localUserIdRef.current || !peerRef.current) return;
      try {
        if (!peerRef.current.currentRemoteDescription) {
          await peerRef.current.setRemoteDescription(answer);
          await flushIceQueue();
        }
      } catch (error) {
        setWebrtcError('Failed to process call answer.');
      }
    };

    const handleRemoteCallEnded = ({ callId: endedCallId, endedBy } = {}) => {
      if (endedCallId && String(endedCallId) !== String(callId)) return;

      isManualCloseRef.current = true;
      resetReconnectState();
      hasEverConnectedRef.current = false;
      setIsCallActive(false);
      setCallStatus('ended');
      setIsConnecting(false);
      setIsRemoteVideoReady(false);
      setWebrtcError(endedBy ? `Call ended by ${endedBy}.` : 'Call ended by other participant.');
      cleanupRealtime();
      setTimeout(() => onClose(), 500);
    };

    socket.on('call-offer', onOffer);
    socket.on('offer', onOffer);
    socket.on('call-answer', onAnswer);
    socket.on('answer', onAnswer);
    socket.on('call_ended', handleRemoteCallEnded);
    socket.on('call-ended', handleRemoteCallEnded);
    socket.on('ice-candidate', async ({ candidate, userId, from }) => {
      const senderId = String(userId || from || '');
      if (!candidate || senderId === localUserIdRef.current || !peerRef.current) return;
      try {
        if (!peerRef.current.remoteDescription) {
          pendingIceRef.current.push(candidate);
          return;
        }
        await peerRef.current.addIceCandidate(candidate);
      } catch (error) {
        pendingIceRef.current.push(candidate);
      }
    });
  }, [apiCallData, callData, callId, callStatus, cleanupRealtime, currentUser, 
      initializeCamera, isCameraSwitched, onClose, resetReconnectState, scheduleReconnect, updateRemoteState]);

  useEffect(() => {
    establishConnectionRef.current = establishConnection;
  }, [establishConnection]);

  // Process callData when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const status = normalizeStatus(callData?.status || 'connecting');
    setCallerName(callData?.name || 'Counselor');
    setCallerProfilePic(callData?.profilePic || 'C');
    setCallerPhoneNumber(callData?.phoneNumber || '');
    setCallStatus(status);
    setCallId(callData?.callId || callData?.id || '');
    setRoomId(callData?.roomId || '');
    setApiCallData(callData?.apiCallData || null);
    setCallStartTime(callData?.startTime || new Date());
    setCallDuration(0);
    setIsConnecting(!isConnectedStatus(status) && !isTerminalStatus(status));
    setIsRemoteVideoReady(false);
    setIsReconnecting(false);
    setWebrtcError('');
    startedRef.current = false;
    isManualCloseRef.current = false;
    hasEverConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    clearReconnectTimer();
  }, [isOpen, callData, clearReconnectTimer]);

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeCamera(false);
      getAvailableCameras();
    }
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.release();
        localStreamRef.current = null;
      }
    };
  }, [isOpen, getAvailableCameras, initializeCamera]);

  // Establish WebRTC connection
  useEffect(() => {
    if (isOpen && isCallActive && isConnectedStatus(callStatus) && !isTerminalStatus(callStatus)) {
      establishConnection();
    }
  }, [isOpen, isCallActive, callStatus, establishConnection]);

  // Call duration timer
  useEffect(() => {
    if (!isOpen || !isCallActive || !callStartTime || !isConnectedStatus(callStatus)) return;
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, isCallActive, callStartTime, callStatus]);

  // Handle video enable/disable
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoEnabled;
      });
    }
  }, [isVideoEnabled]);

  // Handle audio mute/unmute
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Cleanup when modal closes
  useEffect(() => {
    if (isOpen) return;
    isManualCloseRef.current = true;
    resetReconnectState();
    cleanupRealtime();
    setLocalStreamURL(null);
    setRemoteStreamURL(null);
    setIsMuted(false);
    setIsSpeakerOn(true);
    setIsVideoEnabled(true);
    setIsCameraSwitched(false);
    setIsRecording(false);
    setIsCallActive(true);
    setShowSettings(false);
    setCallStatus('ended');
    setCallId('');
    setRoomId('');
    setApiCallData(null);
    setIsReconnecting(false);
    setWebrtcError('');
    hasEverConnectedRef.current = false;
  }, [cleanupRealtime, isOpen, resetReconnectState]);

  const handleEndCall = async () => {
    isManualCloseRef.current = true;
    resetReconnectState();
    hasEverConnectedRef.current = false;
    setIsCallActive(false);
    setCallStatus('ended');
    cleanupRealtime();

    if (typeof onEndCall === 'function' && callId) {
      try {
        await onEndCall(callId);
      } catch (error) {}
    }

    setTimeout(() => onClose(), 500);
  };

  const switchCamera = async () => {
    const next = !isCameraSwitched;
    setIsCameraSwitched(next);
    await initializeCamera(next);
  };

  const selectCamera = async (deviceId) => {
    const stream = await initializeCamera(isCameraSwitched, deviceId);
    if (stream) {
      setCurrentCamera(deviceId);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (webrtcError) return webrtcError;
    if (isReconnecting) return 'Reconnecting video call...';
    if (isConnecting) return 'Connecting...';
    if (isConnectedStatus(callStatus) && !isRemoteVideoReady) return 'Connected. Remote camera is not sending video.';
    if (isConnectedStatus(callStatus)) return 'Connected';
    if (callStatus === 'ringing' || callStatus === 'pending') return 'Waiting for participant...';
    if (callStatus === 'ended') return 'Call Ended';
    return callStatus;
  };

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1f2e" />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>📹</Text>
            <View style={styles.callInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Video Call with {callerName}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
              <Text style={styles.headerBtnText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, styles.closeBtn]} onPress={onClose}>
              <Text style={styles.headerBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Remote Video */}
          <View style={styles.remoteVideoContainer}>
            {remoteStreamURL && isRemoteVideoReady ? (
              <RTCView
                streamURL={remoteStreamURL}
                style={styles.remoteVideo}
                objectFit="cover"
              />
            ) : (
              <View style={styles.remoteVideoPlaceholder}>
                <Text style={styles.remoteAvatar}>
                  {callerProfilePic?.charAt(0) || callerName?.charAt(0) || 'C'}
                </Text>
                <Text style={styles.remoteName}>{callerName}</Text>
                {roomId && (
                  <Text style={styles.roomId}>
                    Room: {String(roomId).substring(0, 8)}...
                  </Text>
                )}
                <Text style={styles.callStatusText}>{getStatusText()}</Text>
                {isConnecting && <ActivityIndicator size="large" color="#4ade80" style={styles.loader} />}
              </View>
            )}
          </View>

          {/* Local Video (PiP) */}
          {localStreamURL && isVideoEnabled && (
            <View style={styles.localVideoContainer}>
              <RTCView
                streamURL={localStreamURL}
                style={styles.localVideo}
                objectFit="cover"
                mirror={!isCameraSwitched}
              />
              <View style={styles.localVideoLabel}>
                <Text style={styles.localVideoLabelText}>
                  You ({isCameraSwitched ? 'Back' : 'Front'})
                </Text>
              </View>
              {isMuted && (
                <View style={styles.mutedIndicator}>
                  <Text style={styles.mutedIndicatorText}>🔇</Text>
                </View>
              )}
            </View>
          )}

          {/* Call Duration */}
          <View style={styles.callDurationBadge}>
            <Text style={styles.callDurationText}>{formatTime(callDuration)}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.activeBtn]}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Text style={styles.btnIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              <Text style={styles.btnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, !isVideoEnabled && styles.activeBtn]}
              onPress={() => setIsVideoEnabled(!isVideoEnabled)}
            >
              <Text style={styles.btnIcon}>{isVideoEnabled ? '📹' : '🚫'}</Text>
              <Text style={styles.btnLabel}>{isVideoEnabled ? 'Camera Off' : 'Camera On'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, isSpeakerOn && styles.activeBtn]}
              onPress={() => setIsSpeakerOn(!isSpeakerOn)}
            >
              <Text style={styles.btnIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
              <Text style={styles.btnLabel}>{isSpeakerOn ? 'Speaker Off' : 'Speaker On'}</Text>
            </TouchableOpacity>

            {availableCameras.length >= 1 && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={switchCamera}
                disabled={availableCameras.length < 2}
              >
                <Text style={styles.btnIcon}>🔄</Text>
                <Text style={styles.btnLabel}>{isCameraSwitched ? 'Front' : 'Back'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.controlBtn, styles.endCallBtn]}
              onPress={handleEndCall}
            >
              <Text style={styles.btnIcon}>📞</Text>
              <Text style={styles.btnLabel}>End</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Modal */}
        <Modal
          visible={showSettings}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={styles.settingsOverlay}>
            <View style={styles.settingsPanel}>
              <Text style={styles.settingsTitle}>Call Settings</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Volume: {volumeLevel}%</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  value={volumeLevel}
                  onValueChange={setVolumeLevel}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor="#333"
                />
              </View>

              {availableCameras.length > 0 && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Select Camera</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {availableCameras.map((camera) => (
                      <TouchableOpacity
                        key={camera.deviceId}
                        style={[
                          styles.cameraOption,
                          currentCamera === camera.deviceId && styles.cameraOptionActive,
                        ]}
                        onPress={() => selectCamera(camera.deviceId)}
                      >
                        <Text style={styles.cameraOptionText}>
                          {camera.label || `Camera ${camera.deviceId.slice(0, 6)}...`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {callerPhoneNumber && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Phone</Text>
                  <Text style={styles.phoneNumber}>{callerPhoneNumber}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.closeSettingsBtn}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.closeSettingsBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1f2e',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e2b3a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 24,
    color: 'white',
  },
  callInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    maxWidth: width * 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    fontSize: 18,
    color: 'white',
  },
  closeBtn: {
    backgroundColor: '#ef4444',
  },
  // Content
  content: {
    flex: 1,
    position: 'relative',
  },
  // Remote Video
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: '#0f1a24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  remoteVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  remoteAvatar: {
    fontSize: 100,
    marginBottom: 20,
  },
  remoteName: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    marginBottom: 10,
  },
  roomId: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  callStatusText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  loader: {
    marginTop: 20,
  },
  // Local Video (PiP)
  localVideoContainer: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: width * 0.25,
    height: height * 0.2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: '#1a1f2e',
  },
  localVideo: {
    flex: 1,
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  localVideoLabelText: {
    fontSize: 10,
    color: 'white',
  },
  mutedIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(239,68,68,0.9)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedIndicatorText: {
    fontSize: 14,
  },
  // Call Duration
  callDurationBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  callDurationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Controls
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 40,
    marginHorizontal: 16,
  },
  controlBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    minWidth: 60,
  },
  activeBtn: {
    backgroundColor: '#3b82f6',
  },
  endCallBtn: {
    backgroundColor: '#ef4444',
  },
  btnIcon: {
    fontSize: 20,
    color: 'white',
    marginBottom: 2,
  },
  btnLabel: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  // Settings Modal
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsPanel: {
    backgroundColor: '#1e2b3a',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  cameraOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    marginRight: 8,
  },
  cameraOptionActive: {
    backgroundColor: '#3b82f6',
  },
  cameraOptionText: {
    color: 'white',
    fontSize: 12,
  },
  phoneNumber: {
    color: '#4ade80',
    fontSize: 14,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  closeSettingsBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeSettingsBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VideoCallModal;