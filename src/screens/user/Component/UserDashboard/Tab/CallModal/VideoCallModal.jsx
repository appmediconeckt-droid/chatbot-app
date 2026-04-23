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
  ScrollView,
  PermissionsAndroid,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { io } from 'socket.io-client';
import { RTCPeerConnection, RTCView, mediaDevices, RTCSessionDescription } from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import { RTC_CONFIGURATION } from '../../../../rtcConfig';

// Improved Emoji Picker Component
const EmojiPickerModal = ({ visible, onClose, onEmojiSelect }) => {
  const emojis = [
    '😊', '😂', '❤️', '👍', '🎉', '🔥', '✨', '🌟',
    '💯', '🤝', '💪', '🎯', '✅', '🙏', '👏', '😮',
    '😢', '😡', '🥳', '😎', '🤔', '😍', '🥰', '😘'
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.emojiOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.emojiPanel}>
              <View style={styles.emojiHandle}>
                <View style={styles.emojiHandleBar} />
              </View>
              <Text style={styles.emojiTitle}>Send Reaction</Text>
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.emojiGrid}
              >
                {emojis.map((emoji, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.emojiItem}
                    onPress={() => {
                      onEmojiSelect(emoji);
                      onClose();
                    }}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.emojiCloseBtn} onPress={onClose}>
                <Text style={styles.emojiCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const localPreviewWidth = isTablet ? 200 : Math.min(150, Math.max(100, Math.round(width * 0.3)));
const localPreviewHeight = Math.round(localPreviewWidth * 1.42);

const ACTIVE = new Set(['active', 'connected']);
const TERMINAL = new Set([
  'ended', 'completed', 'rejected', 'cancelled', 'missed', 'failed',
  'camera_error', 'no_camera',
]);

const normalizeStatus = (status) => {
  if (!status) return 'connecting';
  const normalized = String(status).toLowerCase();
  if (normalized === 'accepted') return 'active';
  if (normalized === 'completed') return 'ended';
  return normalized;
};

const isConnectedStatus = (status) => ACTIVE.has(normalizeStatus(status));
const isTerminalStatus = (status) => TERMINAL.has(normalizeStatus(status));

// Pulse Ring Component
const PulseRing = ({ size, delay, color = '#3b82f6' }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.12, 0.35] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
};

// Floating Emoji Animation
const FloatingEmoji = ({ emoji, onComplete }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 50;
    translateX.setValue(randomX);
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: randomX + (Math.random() - 0.5) * 30,
        duration: 2000,
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, []);

  return (
    <Animated.View
      style={[
        styles.floatingEmoji,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
    >
      <Text style={styles.floatingEmojiText}>{emoji}</Text>
    </Animated.View>
  );
};

// Animated Dots
const AnimatedDots = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return <Text style={styles.dotsText}>{dots}</Text>;
};

// Main Component
const VideoCallModal = ({
  isOpen,
  onClose,
  callData,
  currentUser,
  onEndCall,
}) => {
  const insets = useSafeAreaInsets();

  // UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCameraSwitched, setIsCameraSwitched] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(70);
  const [callDuration, setCallDuration] = useState(0);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCamera, setCurrentCamera] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  // Call state
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
  const [socketConnected, setSocketConnected] = useState(false);

  // Refs
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
  const screenStreamRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 3000);
  }, []);

  const addFloatingEmoji = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis(prev => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
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
    ({ emitLeave = true } = {}) => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;
        peerRef.current.onsignalingstatechange = null;
        try { peerRef.current.close(); } catch (_) {}
        peerRef.current = null;
      }
      if (socketRef.current) {
        try {
          if (emitLeave && callId && localUserIdRef.current && socketConnected) {
            socketRef.current.emit('leave-call', { callId, userId: localUserIdRef.current });
          }
        } catch (_) {}
        try { 
          if (socketRef.current) {
            socketRef.current.disconnect();
          }
        } catch (_) {}
        socketRef.current = null;
        setSocketConnected(false);
      }
      if (remoteStreamRef.current) {
        try { remoteStreamRef.current.release(); } catch (_) {}
        remoteStreamRef.current = null;
      }
      if (localStreamRef.current) {
        try { localStreamRef.current.release(); } catch (_) {}
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach(track => track.stop()); } catch (_) {}
        screenStreamRef.current = null;
      }
      setRemoteStreamURL(null);
      setLocalStreamURL(null);
      pendingIceRef.current = [];
      startedRef.current = false;
      setIsRemoteVideoReady(false);
      setIsSharingScreen(false);
    },
    [callId, socketConnected],
  );

  const replaceOutgoingTracks = useCallback((stream) => {
    if (!peerRef.current || !stream) return;
    const tracksByKind = stream.getTracks().reduce((acc, track) => {
      acc[track.kind] = track;
      return acc;
    }, {});
    peerRef.current.getSenders().forEach((sender) => {
      const kind = sender.track?.kind;
      if (!kind) return;
      sender.replaceTrack(tracksByKind[kind] || null).catch(() => {});
    });
  }, []);

  const requestMediaPermissions = useCallback(async () => {
    if (Platform.OS === 'ios') return true;
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      const hasCamera = result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      const hasMic = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      if (!hasCamera || !hasMic) {
        setCallStatus('camera_error');
        setIsConnecting(false);
        setWebrtcError('Permission denied. Please allow Camera and Microphone access.');
        return false;
      }
      return true;
    } catch (_) {
      setCallStatus('camera_error');
      setIsConnecting(false);
      setWebrtcError('Unable to request camera/microphone permissions.');
      return false;
    }
  }, []);

  const initializeCamera = useCallback(
    async (useBackCamera = false, selectedDeviceId = '') => {
      try {
        const hasPermission = await requestMediaPermissions();
        if (!hasPermission) return null;
        const constraints = {
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: useBackCamera ? 'environment' : 'user',
            ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
          },
        };
        const stream = await mediaDevices.getUserMedia(constraints);
        if (localStreamRef.current) localStreamRef.current.release();
        localStreamRef.current = stream;
        setLocalStreamURL(stream.toURL());
        stream.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
        stream.getVideoTracks().forEach((t) => { t.enabled = isVideoEnabled; });
        if (peerRef.current) replaceOutgoingTracks(stream);
        return stream;
      } catch (error) {
        console.error('Camera initialization error:', error);
        const msg = String(error?.message || '').toLowerCase();
        const isPerm = msg.includes('permission') || msg.includes('security') || msg.includes('denied');
        setCallStatus('camera_error');
        setIsConnecting(false);
        setWebrtcError(isPerm
          ? 'Permission denied. Please allow Camera and Microphone access.'
          : 'Unable to access camera. Please check your device camera.');
        return null;
      }
    },
    [isMuted, isVideoEnabled, replaceOutgoingTracks, requestMediaPermissions],
  );

  const toggleScreenShare = useCallback(async () => {
    if (!peerRef.current) {
      showNotification('Call not connected');
      return;
    }

    try {
      if (!isSharingScreen) {
        let screenStream;
        
        if (Platform.OS === 'android') {
          screenStream = await mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } else {
          showNotification('Screen sharing on iOS requires additional setup');
          return;
        }
        
        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerRef.current?.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          setIsSharingScreen(true);
          showNotification('Screen sharing started');
          
          if (socketRef.current && socketConnected) {
            socketRef.current.emit('screen-share-started', {
              callId,
              userId: localUserIdRef.current
            });
          }
        }
      } else {
        const cameraStream = await initializeCamera(isCameraSwitched);
        const videoTrack = cameraStream.getVideoTracks()[0];
        const sender = peerRef.current?.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          setIsSharingScreen(false);
          showNotification('Screen sharing stopped');
          
          if (socketRef.current && socketConnected) {
            socketRef.current.emit('screen-share-stopped', {
              callId,
              userId: localUserIdRef.current
            });
          }
        }
        
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
      }
    } catch (error) {
      console.error('Screen share error:', error);
      showNotification('Screen sharing not available on this device');
    }
  }, [isSharingScreen, initializeCamera, isCameraSwitched, callId, showNotification, socketConnected]);

  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(cameras);
      if (cameras[0]) setCurrentCamera(cameras[0].deviceId);
    } catch (_) {}
  }, []);

  const scheduleReconnect = useCallback(
    (reason = 'Network issue') => {
      if (isManualCloseRef.current || !isOpen) return;
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
    [cleanupRealtime, isOpen, callId, callStatus],
  );

  const establishConnection = useCallback(async () => {
    if (startedRef.current || !callId || isTerminalStatus(callStatus)) return;
    
    const localUserId =
      currentUser?.id || currentUser?._id || callData?.currentUserId ||
      (await AsyncStorage.getItem('userId')) ||
      (await AsyncStorage.getItem('counsellorId')) ||
      (await AsyncStorage.getItem('counselorId'));
    
    if (!localUserId) {
      console.error('No user ID found');
      return;
    }
    
    const serverCall = apiCallData || callData?.apiCallData || {};
    const initiatorId = serverCall?.initiator?.id || callData?.initiator?.id || callData?.initiatorId;
    const receiverId = serverCall?.receiver?.id || callData?.receiver?.id || callData?.receiverId;
    
    if (!initiatorId || !receiverId) {
      console.error('No initiator/receiver found');
      return;
    }
    
    localUserIdRef.current = String(localUserId);
    remoteUserIdRef.current =
      String(initiatorId) === String(localUserId) ? String(receiverId) : String(initiatorId);
    
    startedRef.current = true;
    
    let localStream = localStreamRef.current;
    if (!localStream) {
      localStream = await initializeCamera(isCameraSwitched);
      if (!localStream) {
        startedRef.current = false;
        return;
      }
    }
    
    const token =
      (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
    
    if (!token) {
      setWebrtcError('Authentication expired. Please login again.');
      setIsConnecting(false);
      startedRef.current = false;
      return;
    }
    
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (!hasEverConnectedRef.current && !isTerminalStatus(callStatus)) {
        setWebrtcError('Connection timeout. Please try again.');
        setIsConnecting(false);
      }
    }, 30000);
    
    // Create socket connection with better error handling
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'], // Allow polling as fallback for better connectivity
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // Increased timeout for slower mobile connections
      auth: { token },
      query: { token }, // Redundant but safer for some middleware
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
        } catch (err) {
          console.log('Error adding ICE candidate:', err);
        }
      }
    };
    
    const sendOffer = async () => {
      if (!peerRef.current || peerRef.current.signalingState !== 'stable') return;
      try {
        const offer = await peerRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerRef.current.setLocalDescription(offer);
        if (socketRef.current && socketConnected) {
          socketRef.current.emit('call-offer', { 
            callId, 
            offer, 
            to: remoteUserIdRef.current,
            from: localUserIdRef.current
          });
        }
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    };
    
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      if (socketRef.current && socketConnected) {
        socketRef.current.emit('ice-candidate', {
          callId,
          candidate: event.candidate,
          userId: localUserIdRef.current,
          to: remoteUserIdRef.current,
        });
      }
    };
    
    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log('ICE Connection State:', state);
      if (state === 'connected' || state === 'completed') {
        hasEverConnectedRef.current = true;
        setIsConnecting(false);
        setIsReconnecting(false);
        resetReconnectState();
        setWebrtcError('');
        updateRemoteState();
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      } else if (state === 'failed') {
        scheduleReconnect('ICE connection failed');
      }
    };
    
    peer.onsignalingstatechange = () => {
      console.log('Signaling State:', peer.signalingState);
    };
    
    peer.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        remoteStreamRef.current = incomingStream;
        setRemoteStreamURL(incomingStream.toURL());
        setIsRemoteVideoReady(true);
        setIsConnecting(false);
        hasEverConnectedRef.current = true;
      }
      updateRemoteState();
    };
    
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      console.log('Connection State:', state);
      if (state === 'connected') {
        hasEverConnectedRef.current = true;
        setIsConnecting(false);
        setIsReconnecting(false);
        resetReconnectState();
        setWebrtcError('');
        updateRemoteState();
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      }
      if (state === 'failed' || state === 'disconnected') {
        setWebrtcError('Video connection interrupted.');
        scheduleReconnect('Video connection interrupted');
      }
    };
    
    // Socket event handlers with better connection tracking
    socket.on('connect', () => {
      console.log('Socket connected');
      setSocketConnected(true);
      resetReconnectState();
      setWebrtcError('');
      setIsConnecting(true);
      socket.emit('join-call', { callId, userId: localUserIdRef.current });
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connect error:', error);
      setSocketConnected(false);
      setWebrtcError(error?.message || 'Socket connection error.');
      scheduleReconnect('Socket connection error');
    });
    
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
      setWebrtcError(`Reconnecting... (${attempt}/5)`);
    });
    
    socket.on('reconnect', () => {
      console.log('Socket reconnected');
      setSocketConnected(true);
      setWebrtcError('');
      socket.emit('join-call', { callId, userId: localUserIdRef.current });
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketConnected(false);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });
    
    socket.on('user-joined', async ({ userId }) => {
      if (String(userId) === localUserIdRef.current) return;
      if (peerRef.current?.connectionState === 'connected') return;
      if (String(initiatorId) === String(localUserIdRef.current)) {
        setTimeout(async () => {
          await sendOffer();
        }, 500);
      }
    });
    
    socket.on('call-offer', async ({ offer, userId, from }) => {
      const senderId = String(userId || from || '');
      if (!offer || senderId === localUserIdRef.current || !peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceQueue();
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        if (socketRef.current && socketConnected) {
          socketRef.current.emit('call-answer', { 
            callId, 
            answer, 
            to: remoteUserIdRef.current,
            from: localUserIdRef.current
          });
        }
      } catch (err) {
        console.error('Error handling call-offer:', err);
        setWebrtcError('Failed to process call offer.');
      }
    });
    
    socket.on('call-answer', async ({ answer, userId, from }) => {
      const senderId = String(userId || from || '');
      if (!answer || senderId === localUserIdRef.current || !peerRef.current) return;
      try {
        if (!peerRef.current.currentRemoteDescription) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          await flushIceQueue();
        }
      } catch (err) {
        console.error('Error handling call-answer:', err);
        setWebrtcError('Failed to process call answer.');
      }
    });
    
    socket.on('ice-candidate', async ({ candidate, userId, from }) => {
      const senderId = String(userId || from || '');
      if (!candidate || senderId === localUserIdRef.current || !peerRef.current) return;
      try {
        if (!peerRef.current.remoteDescription) { 
          pendingIceRef.current.push(candidate); 
          return; 
        }
        await peerRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.log('Error adding ICE candidate:', err);
        pendingIceRef.current.push(candidate);
      }
    });
    
    socket.on('emoji-received', ({ emoji, userId, from }) => {
      // Logic to check sender to avoid loops
      const senderId = from || userId;
      if (String(senderId) !== localUserIdRef.current) {
        addFloatingEmoji(emoji);
        showNotification(`Other user sent ${emoji}`);
      }
    });
    
    socket.on('screen-share-started', ({ userId }) => {
      if (String(userId) !== localUserIdRef.current) {
        showNotification('Screen sharing started by other participant');
      }
    });
    
    socket.on('screen-share-stopped', ({ userId }) => {
      if (String(userId) !== localUserIdRef.current) {
        showNotification('Screen sharing stopped by other participant');
      }
    });
    
    const handleRemoteCallEnded = ({ callId: endedCallId, endedBy } = {}) => {
      if (endedCallId && String(endedCallId) !== String(callId)) return;
      isManualCloseRef.current = true;
      resetReconnectState();
      hasEverConnectedRef.current = false;
      setCallStatus('ended');
      setIsConnecting(false);
      setIsRemoteVideoReady(false);
      setWebrtcError(endedBy ? `Call ended by ${endedBy}.` : 'Call ended by other participant.');
      cleanupRealtime();
      setTimeout(() => onClose(), 500);
    };
    
    socket.on('call_ended', handleRemoteCallEnded);
    socket.on('call-ended', handleRemoteCallEnded);
    
    // Send initial offer if initiator
    if (String(initiatorId) === String(localUserIdRef.current)) {
      setTimeout(async () => {
        if (peerRef.current && peerRef.current.signalingState === 'stable' && socketConnected) {
          await sendOffer();
        }
      }, 1000);
    }
  }, [apiCallData, callData, callId, callStatus, cleanupRealtime, currentUser,
    initializeCamera, isCameraSwitched, onClose, resetReconnectState, scheduleReconnect, 
    updateRemoteState, addFloatingEmoji, showNotification, socketConnected]);

  useEffect(() => { 
    establishConnectionRef.current = establishConnection; 
  }, [establishConnection]);

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

  useEffect(() => {
    if (!isOpen) return;
    const setup = async () => {
      const ok = await requestMediaPermissions();
      if (!ok) return;
      await initializeCamera(false);
      await getAvailableCameras();
    };
    setup();
    return () => {
      if (localStreamRef.current) { 
        localStreamRef.current.release(); 
        localStreamRef.current = null; 
      }
    };
  }, [isOpen, getAvailableCameras, initializeCamera, requestMediaPermissions]);

  useEffect(() => {
    if (isOpen && !isTerminalStatus(callStatus)) {
      establishConnection();
    }
  }, [isOpen, callStatus, establishConnection]);

  useEffect(() => {
    if (!isOpen || !callStartTime || !isConnectedStatus(callStatus)) return;
    const timer = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, callStartTime, callStatus]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = isVideoEnabled; });
    }
  }, [isVideoEnabled]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
    }
  }, [isMuted]);

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
    setShowSettings(false);
    setShowEmojiPicker(false);
    setCallStatus('ended');
    setCallId('');
    setRoomId('');
    setApiCallData(null);
    setIsReconnecting(false);
    setWebrtcError('');
    hasEverConnectedRef.current = false;
    setSocketConnected(false);
  }, [cleanupRealtime, isOpen, resetReconnectState]);

  const handleEndCall = async () => {
    isManualCloseRef.current = true;
    resetReconnectState();
    hasEverConnectedRef.current = false;
    setCallStatus('ended');
    setIsConnecting(false);
    setIsRemoteVideoReady(false);
    
    // Notify server about call end
    if (socketRef.current && socketConnected && callId) {
      try {
        socketRef.current.emit('end-call', { 
          callId, 
          userId: localUserIdRef.current 
        });
      } catch (err) {
        console.error('Error ending call:', err);
      }
    }
    
    cleanupRealtime();
    
    if (typeof onEndCall === 'function' && callId) {
      try { await onEndCall(callId); } catch (_) {}
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
    if (stream) setCurrentCamera(deviceId);
  };

  const sendEmoji = useCallback((emoji) => {
    if (socketRef.current && socketConnected && callId) {
      socketRef.current.emit('send-emoji', {
        callId,
        emoji,
        userId: localUserIdRef.current
      });
      addFloatingEmoji(emoji);
      showNotification(`Sent ${emoji}`);
    } else {
      // Still show emoji locally even if socket not connected
      addFloatingEmoji(emoji);
      showNotification(`Sent ${emoji} (local only)`);
    }
  }, [callId, addFloatingEmoji, showNotification, socketConnected]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (webrtcError) return webrtcError;
    if (isReconnecting) return 'Reconnecting video call...';
    if (isConnecting) return 'Connecting...';
    if (isConnectedStatus(callStatus) && !isRemoteVideoReady) return 'Waiting for video...';
    if (isConnectedStatus(callStatus)) return 'Connected';
    if (callStatus === 'ringing' || callStatus === 'pending') return 'Ringing';
    if (callStatus === 'ended') return 'Call Ended';
    return callStatus;
  };

  const isRinging = callStatus === 'ringing' || callStatus === 'pending' || callStatus === 'connecting';
  const displayInitial = (callerProfilePic?.charAt(0) || callerName?.charAt(0) || 'C').toUpperCase();

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={handleEndCall}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

        {/* Notification */}
        {notification.show && (
          <View style={[
            styles.notification, 
            notification.type === 'error' && styles.notificationError
          ]}>
            <Text style={styles.notificationText}>{notification.message}</Text>
          </View>
        )}

        {/* Floating Emojis */}
        {floatingEmojis.map(({ id, emoji }) => (
          <FloatingEmoji
            key={id}
            emoji={emoji}
            onComplete={() => setFloatingEmojis(prev => prev.filter(e => e.id !== id))}
          />
        ))}

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Video Call</Text>
          <TouchableOpacity onPress={handleEndCall} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Remote video */}
          {remoteStreamURL && isRemoteVideoReady ? (
            <RTCView
              streamURL={remoteStreamURL}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
            />
          ) : (
            <View style={styles.placeholderWrap}>
              <View style={styles.ringsContainer}>
                <PulseRing size={220} delay={0} />
                <PulseRing size={175} delay={200} />
                <PulseRing size={132} delay={400} />
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{displayInitial}</Text>
                </View>
              </View>
              <Text style={styles.callerName}>{callerName}</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusText}>{getStatusText()}</Text>
                {isRinging && <AnimatedDots />}
              </View>
              {isConnecting && !isRinging && (
                <ActivityIndicator size="small" color="#4a9eff" style={{ marginTop: 12 }} />
              )}
            </View>
          )}

          {/* Local PiP */}
          {localStreamURL && isVideoEnabled && isRemoteVideoReady && (
            <View style={[styles.localVideoContainer, { bottom: Math.max(108, insets.bottom + 96) }]}>
              <RTCView
                streamURL={localStreamURL}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                mirror={!isCameraSwitched}
              />
              <View style={styles.localVideoLabel}>
                <Text style={styles.localVideoLabelText}>
                  {isSharingScreen ? 'Screen' : (isCameraSwitched ? 'Back' : 'Front')}
                </Text>
              </View>
              {isMuted && (
                <View style={styles.mutedIndicator}>
                  <Ionicons name="mic-off" size={14} color="#fff" />
                </View>
              )}
            </View>
          )}

          {/* Duration badge */}
          {isRemoteVideoReady && (
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={13} color="#fff" />
              <Text style={styles.durationText}>{formatTime(callDuration)}</Text>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={[styles.controlsBar, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>

          {/* Mute */}
          <TouchableOpacity
            style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]}
            onPress={() => {
              const newValue = !isMuted;
              setIsMuted(newValue);
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => { 
                  t.enabled = !newValue; 
                });
              }
              showNotification(newValue ? 'Microphone Muted' : 'Microphone Unmuted');
            }}
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          </TouchableOpacity>

          {/* Video */}
          <TouchableOpacity
            style={[styles.ctrlBtn, !isVideoEnabled && styles.ctrlBtnActive]}
            onPress={() => {
              const newValue = !isVideoEnabled;
              setIsVideoEnabled(newValue);
              if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => { 
                  t.enabled = newValue; 
                });
              }
              showNotification(newValue ? 'Camera On' : 'Camera Off');
            }}
          >
            <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
          </TouchableOpacity>

          {/* Switch Camera */}
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={switchCamera}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Screen Share */}
          <TouchableOpacity
            style={[styles.ctrlBtn, isSharingScreen && styles.ctrlBtnActive]}
            onPress={toggleScreenShare}
          >
            <Ionicons name={isSharingScreen ? 'desktop' : 'desktop-outline'} size={24} color="#fff" />
          </TouchableOpacity>

          {/* Emoji */}
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => setShowEmojiPicker(true)}>
            <Ionicons name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>

          {/* End Call */}
          <TouchableOpacity style={[styles.ctrlBtn, styles.endBtn]} onPress={handleEndCall}>
            <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Settings Bottom Sheet */}
        <Modal
          visible={showSettings}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={styles.settingsOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowSettings(false)}
            />
            <View style={[styles.settingsPanel, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.settingsHandle}>
                <View style={styles.settingsHandleBar} />
              </View>
              <Text style={styles.settingsTitle}>Call Settings</Text>
              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Volume */}
                <View style={styles.settingItem}>
                  <View style={styles.settingRow}>
                    <Ionicons name="volume-high" size={22} color="#4ade80" />
                    <Text style={styles.settingLabel}>Volume</Text>
                    <Text style={styles.settingValue}>{Math.round(volumeLevel)}%</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={volumeLevel}
                    onValueChange={setVolumeLevel}
                    minimumTrackTintColor="#4ade80"
                    maximumTrackTintColor="#334155"
                    thumbTintColor="#4ade80"
                  />
                </View>

                {/* Camera selection */}
                {availableCameras.length > 1 && (
                  <View style={styles.settingItem}>
                    <View style={styles.settingRow}>
                      <Ionicons name="camera" size={22} color="#4ade80" />
                      <Text style={styles.settingLabel}>Camera</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {availableCameras.map((cam) => (
                        <TouchableOpacity
                          key={cam.deviceId}
                          style={[styles.camOption, currentCamera === cam.deviceId && styles.camOptionActive]}
                          onPress={() => selectCamera(cam.deviceId)}
                        >
                          <Ionicons
                            name={currentCamera === cam.deviceId ? 'radio-button-on' : 'radio-button-off'}
                            size={16}
                            color={currentCamera === cam.deviceId ? '#4ade80' : '#94a3b8'}
                          />
                          <Text style={[styles.camOptionText, currentCamera === cam.deviceId && styles.camOptionTextActive]}>
                            {cam.label?.replace(/[0-9]/g, '').trim() || `Camera ${cam.deviceId.slice(0, 6)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Microphone toggle */}
                <View style={styles.settingItem}>
                  <View style={styles.settingRow}>
                    <Ionicons name="mic" size={22} color="#4ade80" />
                    <Text style={styles.settingLabel}>Microphone</Text>
                  </View>
                  <TouchableOpacity style={styles.audioOption} onPress={() => setIsMuted((v) => !v)}>
                    <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? '#ef4444' : '#4ade80'} />
                    <Text style={[styles.audioOptionText, isMuted && { color: '#ef4444' }]}>
                      {isMuted ? 'Muted' : 'Active'}
                    </Text>
                    <Text style={styles.audioHint}>{isMuted ? 'Tap to unmute' : 'Tap to mute'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Camera toggle */}
                <View style={styles.settingItem}>
                  <View style={styles.settingRow}>
                    <Ionicons name="videocam" size={22} color="#4ade80" />
                    <Text style={styles.settingLabel}>Camera</Text>
                  </View>
                  <TouchableOpacity style={styles.audioOption} onPress={() => setIsVideoEnabled((v) => !v)}>
                    <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={20} color={isVideoEnabled ? '#4ade80' : '#ef4444'} />
                    <Text style={[styles.audioOptionText, !isVideoEnabled && { color: '#ef4444' }]}>
                      {isVideoEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Text style={styles.audioHint}>{isVideoEnabled ? 'Tap to disable' : 'Tap to enable'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Phone number */}
                {!!callerPhoneNumber && (
                  <View style={styles.settingItem}>
                    <View style={styles.settingRow}>
                      <Ionicons name="call-outline" size={22} color="#4ade80" />
                      <Text style={styles.settingLabel}>Phone Number</Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Ionicons name="call" size={15} color="#94a3b8" />
                      <Text style={styles.phoneText}>{callerPhoneNumber}</Text>
                    </View>
                  </View>
                )}

                {/* Call ID */}
                {!!callId && (
                  <View style={styles.settingItem}>
                    <View style={styles.settingRow}>
                      <Ionicons name="information-circle" size={22} color="#4ade80" />
                      <Text style={styles.settingLabel}>Call Info</Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Text style={styles.infoText}>Call ID: {callId}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity style={styles.doneBtn} onPress={() => setShowSettings(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Emoji Picker Modal - Fixed */}
        <EmojiPickerModal
          visible={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={sendEmoji}
        />
      </SafeAreaView>
    </Modal>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2535',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#0d1117',
    position: 'relative',
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  ringsContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '700',
  },
  callerName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '400',
  },
  dotsText: {
    color: '#4a9eff',
    fontSize: 15,
    width: 20,
  },
  localVideoContainer: {
    position: 'absolute',
    right: 16,
    width: localPreviewWidth,
    height: localPreviewHeight,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4ade80',
    backgroundColor: '#1e293b',
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  localVideoLabelText: {
    color: '#f8fafc',
    fontSize: 10,
  },
  mutedIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#ef4444',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  durationText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  controlsBar: {
    backgroundColor: '#111827',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e2535',
  },
  ctrlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1e2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnActive: {
    backgroundColor: '#2a4a7f',
  },
  endBtn: {
    backgroundColor: '#ef4444',
  },
  settingsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  settingsPanel: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: height * 0.85,
  },
  settingsHandle: {
    alignItems: 'center',
    marginBottom: 14,
  },
  settingsHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
  },
  settingsTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  settingItem: {
    marginBottom: 22,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  settingLabel: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  settingValue: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 38,
  },
  camOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#334155',
    borderRadius: 20,
    marginRight: 8,
  },
  camOptionActive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  camOptionText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  camOptionTextActive: {
    color: '#4ade80',
    fontWeight: '500',
  },
  audioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: '#334155',
    borderRadius: 14,
  },
  audioOptionText: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  audioHint: {
    color: '#94a3b8',
    fontSize: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: '#334155',
    borderRadius: 14,
  },
  phoneText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '500',
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  doneBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Emoji Picker Styles - Fixed
  emojiOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  emojiPanel: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 25,
    maxHeight: height * 0.7,
  },
  emojiHandle: {
    alignItems: 'center',
    marginBottom: 15,
  },
  emojiHandleBar: {
    width: 45,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
  },
  emojiTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 15,
  },
  emojiItem: {
    width: '20%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    margin: 5,
    borderRadius: 50,
  },
  emojiText: {
    fontSize: 32,
  },
  emojiCloseBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  emojiCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  notification: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 12,
    borderRadius: 10,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  notificationError: {
    borderColor: '#ef4444',
  },
  notificationText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  floatingEmoji: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 120,
    zIndex: 1000,
  },
  floatingEmojiText: {
    fontSize: 45,
  },
});

export default VideoCallModal;