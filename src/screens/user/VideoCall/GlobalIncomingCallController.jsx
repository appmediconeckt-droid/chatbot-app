import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import Text from '../../../components/TranslatedText';
import axiosInstance from '../../../axiosConfig';
import safeVibrate from '../../../utils/safeVibrate';
import socketService from '../../../services/socketService';
import { forceStopRingtone, startIncomingRingtone } from '../../../hooks/useRingtone';
import toImageUri from '../../../utils/imageUri';
import VideoCallModal from '../Component/UserDashboard/Tab/CallModal/VideoCallModal';
import VoiceCallModal from '../Component/UserDashboard/Tab/CallModal/VoiceCallModal';
import {
  consumePendingIncomingCallIntent,
  normalizeCallType,
  setGlobalCallUiActive,
  subscribeToIncomingCallIntents,
} from '../../../services/callNotificationBridge';

const emptyIncomingCall = {
  callId: '',
  roomId: '',
  name: '',
  image: null,
  callType: 'video',
};

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  return /counsell?or/.test(value) ? 'counsellor' : value;
};

const getStoredSession = async () => {
  const [
    storedUserId,
    storedRole,
    userDataRaw,
    counsellorId,
    counselorId,
  ] = await Promise.all([
    AsyncStorage.getItem('userId'),
    AsyncStorage.getItem('userRole'),
    AsyncStorage.getItem('userData'),
    AsyncStorage.getItem('counsellorId'),
    AsyncStorage.getItem('counselorId'),
  ]);

  let role = normalizeRole(storedRole);
  let userData = null;

  if (userDataRaw) {
    try {
      userData = JSON.parse(userDataRaw);
      if (!role) role = normalizeRole(userData?.role || userData?.type);
    } catch (_) {}
  }

  if (!role && (counsellorId || counselorId)) role = 'counsellor';
  if (!role && storedUserId) role = 'user';

  const currentUserId =
    role === 'counsellor'
      ? counsellorId || counselorId || storedUserId || userData?._id || userData?.id
      : storedUserId || userData?._id || userData?.id;

  return {
    role,
    currentUserId: currentUserId ? String(currentUserId) : '',
    streamRole: role === 'counsellor' ? 'counsellor' : 'user',
    apiRole: role === 'counsellor' ? 'counsellor' : 'user',
  };
};

const getPartyId = (party) => (
  party?._id ||
  party?.id ||
  party?.userId ||
  party?.counselorId ||
  party?.counsellorId ||
  null
);

const displayNameForParty = (party, fallback, currentRole) => {
  if (currentRole === 'counsellor') {
    return (
      party?.anonymous ||
      party?.anonName ||
      party?.anonymousName ||
      party?.displayName ||
      party?.fullName ||
      party?.name ||
      fallback ||
      'Anonymous User'
    );
  }

  return (
    party?.fullName ||
    party?.name ||
    party?.displayName ||
    fallback ||
    'Consultant'
  );
};

const resolveRemoteParty = (call, currentUserId) => {
  const initiator = call?.initiator || call?.from || null;
  const receiver = call?.receiver || null;
  const initiatorId = getPartyId(initiator);
  const receiverId = getPartyId(receiver);

  if (currentUserId && initiatorId && String(initiatorId) === String(currentUserId)) {
    return receiver || initiator || {};
  }

  if (currentUserId && receiverId && String(receiverId) === String(currentUserId)) {
    return initiator || receiver || {};
  }

  return initiator || call?.from || receiver || {};
};

const fetchCallDetails = async (callId, session) => {
  if (!callId || !session.currentUserId) return null;
  try {
    const response = await axiosInstance.get(
      `/api/video/calls/${callId}/details`,
      { params: { userId: session.currentUserId, userType: session.apiRole } },
    );
    return response.data?.call || null;
  } catch (_) {
    return null;
  }
};

const getErrorMessage = (error) => (
  error?.response?.data?.error || error?.message || 'Unable to connect this call'
);

const fetchPendingCall = async (intent, session) => {
  if (!session.currentUserId) return null;
  try {
    const response = await axiosInstance.get(`/api/video/calls/pending/${session.currentUserId}`);
    const calls = response.data?.pendingRequests || response.data?.waitingCalls || response.data?.calls || [];
    if (!Array.isArray(calls) || calls.length === 0) return null;
    if (!intent?.callId) return calls[0];
    return calls.find((call) => String(call?.callId || call?.id || call?._id) === String(intent.callId)) || null;
  } catch (_) {
    return null;
  }
};

const buildAcceptedCall = async (incomingCall, acceptData) => {
  const session = await getStoredSession();
  const detailedCall = await fetchCallDetails(incomingCall.callId, session);
  const sourceCall = detailedCall || incomingCall;
  const remoteParty = resolveRemoteParty(sourceCall, session.currentUserId);
  const modalType = normalizeCallType(sourceCall.callType || incomingCall.callType);
  const displayName = displayNameForParty(remoteParty, incomingCall.name, session.role);
  const image =
    toImageUri(remoteParty?.profilePhoto) ||
    toImageUri(remoteParty?.image) ||
    toImageUri(incomingCall.image);

  return {
    id: sourceCall.id || sourceCall._id || incomingCall.callId,
    callId: incomingCall.callId,
    roomId: acceptData?.roomId || sourceCall.roomId || incomingCall.roomId,
    name: displayName,
    userName: displayName,
    type: modalType,
    callType: modalType,
    status: acceptData?.status || sourceCall.status || 'active',
    profilePic: image,
    image,
    phoneNumber: remoteParty?.phoneNumber || remoteParty?.phone || '',
    apiCallData: detailedCall || incomingCall.apiCallData,
    initiator: sourceCall.initiator || incomingCall.initiator,
    receiver: sourceCall.receiver || incomingCall.receiver,
    initiatorId: getPartyId(sourceCall.initiator),
    receiverId: getPartyId(sourceCall.receiver),
    currentUserId: session.currentUserId,
    currentUserType: session.streamRole,
    isIncoming: true,
    from: incomingCall.from,
  };
};

const RootIncomingCallModal = ({
  visible,
  callData,
  onAccept,
  onReject,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const ringLoop = (value, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: 1900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const rings = [ringLoop(ring1, 0), ringLoop(ring2, 620), ringLoop(ring3, 1240)];
    pulseLoop.start();
    rings.forEach((loop) => loop.start());

    return () => {
      pulseLoop.stop();
      rings.forEach((loop) => loop.stop());
      pulse.setValue(1);
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
    };
  }, [visible, pulse, ring1, ring2, ring3]);

  if (!visible) return null;

  const isVideo = normalizeCallType(callData?.callType) === 'video';
  const displayName = callData?.name || (callData?.currentUserType === 'counsellor' ? 'Anonymous User' : 'Consultant');
  const initial = (displayName.charAt(0) || 'C').toUpperCase();
  const ringStyle = (value) => ({
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] }) }],
    opacity: value.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.42, 0] }),
  });

  const handleAccept = async () => {
    if (isAccepting || isRejecting) return;
    setIsAccepting(true);
    try {
      await onAccept();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (isRejecting || isAccepting) return;
    setIsRejecting(true);
    try {
      await onReject();
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.incomingScreen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        <View style={styles.header}>
          <Text style={styles.kicker}>
            {isVideo ? 'INCOMING VIDEO CALL' : 'INCOMING VOICE CALL'}
          </Text>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        </View>

        <View style={styles.avatarZone}>
          <Animated.View style={[styles.ring, ringStyle(ring1)]} />
          <Animated.View style={[styles.ring, ringStyle(ring2)]} />
          <Animated.View style={[styles.ring, ringStyle(ring3)]} />
          <Animated.View style={[styles.avatarOuter, { transform: [{ scale: pulse }] }]}>
            <View style={styles.avatar}>
              {callData?.image ? (
                <Image source={{ uri: callData.image }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
          </Animated.View>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={11} color="#0F8A3A" />
            <Text style={styles.secureText}>ENCRYPTED</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isRejecting || isAccepting}
              onPress={handleReject}
              style={[styles.fab, styles.declineFab]}
            >
              {isRejecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="call" size={27} color="#fff" style={styles.declineIcon} />
              )}
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{isRejecting ? 'Declining' : 'Decline'}</Text>
          </View>

          <View style={styles.actionCol}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isAccepting || isRejecting}
              onPress={handleAccept}
              style={[styles.fab, styles.acceptFab]}
            >
              {isAccepting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name={isVideo ? 'videocam' : 'call'} size={27} color="#fff" />
              )}
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{isAccepting ? 'Connecting' : 'Accept'}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const GlobalIncomingCallController = ({ exitOnDismiss = false }) => {
  const [incomingCall, setIncomingCall] = useState(emptyIncomingCall);
  const [showIncoming, setShowIncoming] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const handledCallIdsRef = useRef(new Set());
  const incomingCallRef = useRef(emptyIncomingCall);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const closeIncoming = useCallback(() => {
    forceStopRingtone();
    setShowIncoming(false);
    setIncomingCall(emptyIncomingCall);
    setGlobalCallUiActive(isVideoOpen || isVoiceOpen);
    if (exitOnDismiss && Platform.OS === 'android') {
      setTimeout(() => BackHandler.exitApp(), 100);
    }
  }, [exitOnDismiss, isVideoOpen, isVoiceOpen]);

  const handleIntent = useCallback((intent) => {
    if (!intent?.callId) return;
    if (handledCallIdsRef.current.has(String(intent.callId))) return;
    if (showIncoming || isVideoOpen || isVoiceOpen) return;

    // Present immediately from the push payload. Waiting for pending/details
    // APIs here used to consume most of the short ringing window on cold start.
    const immediateCall = {
      ...emptyIncomingCall,
      ...intent,
      callId: String(intent.callId),
      roomId: intent.roomId || '',
      name: intent.name || 'Incoming call',
      callType: normalizeCallType(intent.callType || intent?.data?.callType),
    };
    handledCallIdsRef.current.add(String(intent.callId));
    setIncomingCall(immediateCall);
    setShowIncoming(true);
    setGlobalCallUiActive(true);
    startIncomingRingtone(true);
    safeVibrate([320, 160, 320, 160, 320]);
  }, [showIncoming, isVideoOpen, isVoiceOpen]);

  useEffect(() => {
    const unsubscribe = subscribeToIncomingCallIntents(handleIntent);
    consumePendingIncomingCallIntent().then((intent) => {
      if (intent) handleIntent(intent);
    });
    return unsubscribe;
  }, [handleIntent]);

  useEffect(() => {
    let active = true;
    let unsubscribeSocket = null;

    const setupSocketIncomingCalls = async () => {
      try {
        unsubscribeSocket = await socketService.on('incoming_call_request', (payload = {}) => {
          if (!active) return;
          handleIntent({
            source: 'socket',
            receivedAt: Date.now(),
            data: payload,
            callId: payload.callId || payload.id || payload._id,
            roomId: payload.roomId || payload.room_id || '',
            callType: normalizeCallType(payload.callType || payload.type),
            name: typeof payload.from === 'string'
              ? payload.from
              : payload.from?.displayName || payload.from?.fullName || payload.callerName || payload.title || 'Incoming call',
            image: payload.fromProfilePhoto || payload.callerImage || payload.image || null,
            from: payload.from && typeof payload.from === 'object'
              ? payload.from
              : {
                  id: payload.fromId || null,
                  displayName: typeof payload.from === 'string' ? payload.from : payload.callerName,
                  fullName: typeof payload.from === 'string' ? payload.from : payload.callerName,
                  type: payload.fromType || null,
                  profilePhoto: payload.fromProfilePhoto || null,
                },
            initiator: payload.initiator && typeof payload.initiator === 'object'
              ? payload.initiator
              : {
                  id: payload.fromId || null,
                  displayName: typeof payload.from === 'string' ? payload.from : payload.callerName,
                  fullName: typeof payload.from === 'string' ? payload.from : payload.callerName,
                  type: payload.fromType || null,
                  profilePhoto: payload.fromProfilePhoto || null,
                },
            receiver: payload.receiver || null,
            requestedAt: payload.requestedAt || payload.timestamp || null,
            expiresAt: payload.expiresAt || null,
          });
        });
      } catch (error) {
        console.warn('[CallNotification] socket listener failed:', error?.message || error);
      }
    };

    setupSocketIncomingCalls();

    return () => {
      active = false;
      if (unsubscribeSocket) unsubscribeSocket();
    };
  }, [handleIntent]);

  useEffect(() => {
    setGlobalCallUiActive(showIncoming || isVideoOpen || isVoiceOpen);
    return () => setGlobalCallUiActive(false);
  }, [showIncoming, isVideoOpen, isVoiceOpen]);

  useEffect(() => {
    if (!showIncoming || !incomingCall.callId) return undefined;

    let cancelled = false;
    const checkStillPending = async () => {
      const session = await getStoredSession();
      if (cancelled || !session.currentUserId) return;
      const pending = await fetchPendingCall({ callId: incomingCall.callId }, session);
      if (!pending && !cancelled) {
        closeIncoming();
      }
    };

    const intervalId = setInterval(checkStillPending, 2000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [showIncoming, incomingCall.callId, closeIncoming]);

  const handleAccept = useCallback(async () => {
    const call = incomingCallRef.current;
    if (!call?.callId) return;

    forceStopRingtone();
    setShowIncoming(false);

    const session = await getStoredSession();
    if (!session.currentUserId) return;

    try {
      const response = await axiosInstance.put(
        `/api/video/calls/${call.callId}/accept`,
        { acceptorType: session.apiRole },
      );

      if (!response.data?.success) throw new Error(response.data?.error || 'Call was not accepted');

      const acceptedCall = await buildAcceptedCall(call, response.data);
      setSelectedCall(acceptedCall);
      setIncomingCall(emptyIncomingCall);
      if (acceptedCall.callType === 'video') setIsVideoOpen(true);
      else setIsVoiceOpen(true);
    } catch (error) {
      console.warn('[CallNotification] accept failed:', getErrorMessage(error));
      setShowIncoming(true);
      setGlobalCallUiActive(true);
      startIncomingRingtone(true);
    }
  }, []);

  const handleReject = useCallback(async () => {
    const call = incomingCallRef.current;
    forceStopRingtone();
    setShowIncoming(false);

    try {
      const session = await getStoredSession();
      if (session.currentUserId && call?.callId) {
        await axiosInstance.put(
          `/api/video/calls/${call.callId}/reject`,
          { userId: session.currentUserId, reason: 'declined' },
        );
      }
    } catch (_) {}
    setIncomingCall(emptyIncomingCall);
    setGlobalCallUiActive(false);
    if (exitOnDismiss && Platform.OS === 'android') {
      setTimeout(() => BackHandler.exitApp(), 100);
    }
  }, [exitOnDismiss]);

  const closeCallModal = useCallback(() => {
    forceStopRingtone();
    setIsVideoOpen(false);
    setIsVoiceOpen(false);
    setSelectedCall(null);
    setGlobalCallUiActive(false);
  }, []);

  const handleEndCall = useCallback(async (callId) => {
    try {
      const session = await getStoredSession();
      if (session.currentUserId && callId) {
        await axiosInstance.put(
          `/api/video/calls/${callId}/end`,
          { userId: session.currentUserId, endedBy: session.apiRole },
        );
      }
    } catch (_) {}
  }, []);

  return (
    <>
      <RootIncomingCallModal
        visible={showIncoming}
        callData={incomingCall}
        onAccept={handleAccept}
        onReject={handleReject}
        onClose={closeIncoming}
      />
      <VideoCallModal
        isOpen={isVideoOpen}
        onClose={closeCallModal}
        callData={selectedCall}
        currentUser={{ id: selectedCall?.currentUserId, role: selectedCall?.currentUserType }}
        onEndCall={handleEndCall}
      />
      <VoiceCallModal
        isOpen={isVoiceOpen}
        onClose={closeCallModal}
        callData={selectedCall}
        currentUser={{ id: selectedCall?.currentUserId, role: selectedCall?.currentUserType }}
        onEndCall={handleEndCall}
      />
    </>
  );
};

const styles = StyleSheet.create({
  incomingScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    width: '100%',
  },
  kicker: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  name: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 12,
    maxWidth: '92%',
    textAlign: 'center',
  },
  avatarZone: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    width: 250,
  },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: 'rgba(15,138,58,0.34)',
  },
  avatarOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    padding: 5,
    backgroundColor: '#DCFCE7',
  },
  avatar: {
    flex: 1,
    borderRadius: 61,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F8A3A',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '800',
  },
  secureBadge: {
    marginTop: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  secureText: {
    color: '#0F8A3A',
    fontSize: 10,
    fontWeight: '800',
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCol: {
    alignItems: 'center',
    minWidth: 96,
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  declineFab: {
    backgroundColor: '#EF4444',
  },
  acceptFab: {
    backgroundColor: '#16A34A',
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
});

export default GlobalIncomingCallController;
