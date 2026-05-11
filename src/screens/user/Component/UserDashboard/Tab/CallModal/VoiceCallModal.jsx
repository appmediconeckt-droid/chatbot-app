import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import useRingtone from '../../../../../../hooks/useRingtone';

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  CallingState,
} from '@stream-io/video-react-native-sdk';

// ─── Audio call UI (inside StreamCall context) ────────────────────────────────
const AudioCallUI = ({ onEndCall, callerName, callerProfilePic, isCounselor, isOutgoing }) => {
  const {
    useCallCallingState,
    useMicrophoneState,
    useCallStartedAt,
    useCallEndedAt,
  } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, isMute } = useMicrophoneState();
  const { startRinging, stopRinging } = useRingtone();
  const startedAt = useCallStartedAt?.();
  const endedAt = useCallEndedAt?.();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Guard: fire onEndCall exactly once per session
  const endedRef = useRef(false);
  // Guard: prevent duplicate startRinging calls per connecting phase
  const ringingRef = useRef(false);

  useEffect(() => {
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsedSeconds = () => {
      const endTime = endedAt || new Date();
      const seconds = Math.max(
        0,
        Math.floor((endTime.getTime() - startedAt.getTime()) / 1000),
      );
      setElapsedSeconds(seconds);
    };

    updateElapsedSeconds();

    if (endedAt) return;

    const timerId = setInterval(updateElapsedSeconds, 1000);
    return () => clearInterval(timerId);
  }, [endedAt, startedAt]);

  // callerName prop already has anonymous name from callData.name (set by backend)
  // For counselor: always show anonymous name, never real name
  const displayName = callerName || (isCounselor ? 'Anonymous User' : 'User');
  // Counselor sees anonymous user — never show real photo
  const showPhoto = !isCounselor && callerProfilePic;

  // Counselor side: stop any residual incoming ring once AudioCallUI mounts
  useEffect(() => {
    if (isCounselor) {
      stopRinging();
    }
  }, [isCounselor, stopRinging]);

  const isConnecting =
    callingState === CallingState.JOINING ||
    callingState === CallingState.RINGING;
  const isConnected = callingState === CallingState.JOINED && !endedAt;
  const isEnded =
    !!endedAt ||
    callingState === CallingState.LEFT ||
    callingState === CallingState.IDLE;

  useEffect(() => {
    if (isEnded && !endedRef.current) {
      endedRef.current = true;
      onEndCall();
    }
  }, [isEnded, onEndCall]);

  // Outgoing side only: play ringback during connecting, stop once joined/ended.
  // ringingRef prevents calling startRinging multiple times if callingState
  // re-renders while still in JOINING/RINGING phase.
  useEffect(() => {
    if (!isOutgoing) return;

    if (isConnecting && !ringingRef.current) {
      ringingRef.current = true;
      startRinging(false);
    } else if (!isConnecting && ringingRef.current) {
      ringingRef.current = false;
      stopRinging();
    }
  }, [callingState, isOutgoing, isConnecting, startRinging, stopRinging]);

  const toggleMute = async () => {
    try {
      if (isMute) await microphone.enable();
      else await microphone.disable();
    } catch (_) {}
  };

  const formatTime = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const isValidUrl = (str) =>
    typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
  const profilePhotoUrl = showPhoto && isValidUrl(callerProfilePic) ? callerProfilePic : null;
  const displayInitial = (displayName?.charAt(0) || 'U').toUpperCase();

  return (
    <View style={styles.audioCallWrap}>
      {/* Avatar */}
      <View style={styles.avatarCircle}>
        {profilePhotoUrl ? (
          <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{displayInitial}</Text>
        )}
      </View>

      {/* Counselor: show anonymous name only. User: show counselor name. */}
      <Text style={styles.callerName}>{displayName}</Text>

      <Text style={styles.callStateText}>
        {isConnecting
          ? 'Connecting...'
          : isConnected
          ? formatTime(elapsedSeconds)
          : 'Call Ended'}
      </Text>

      {isConnecting && (
        <ActivityIndicator size="small" color="#4a9eff" style={{ marginTop: 8 }} />
      )}

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.ctrlBtn, isMute && styles.ctrlBtnActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMute ? 'mic-off' : 'mic'} size={26} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.ctrlBtn, styles.endBtn]} onPress={onEndCall}>
          <Ionicons
            name="call"
            size={26}
            color="#fff"
            style={{ transform: [{ rotate: '135deg' }] }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VoiceCallModal = ({ isOpen, onClose, callData, currentUser, onEndCall }) => {
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const callRef = useRef(null);
  const clientRef = useRef(null);
  // Prevents setup() from running twice (Strict Mode double-invoke or re-render)
  const initializingRef = useRef(false);
  // Prevents cleanup() from running multiple times concurrently
  const cleaningUpRef = useRef(false);
  // Prevents handleClose from triggering multiple simultaneous close flows
  const closingRef = useRef(false);
  // Signals the in-flight async setup to abort
  const cancelledRef = useRef(false);
  // Stores unsub functions so listeners are removed exactly once
  const unsubscribersRef = useRef([]);

  const { stopRinging } = useRingtone();

  // Idempotent cleanup — safe to call multiple times
  const cleanup = useCallback(async () => {
    if (cleaningUpRef.current) return;
    cleaningUpRef.current = true;

    stopRinging();
    cancelledRef.current = true;

    // Remove Stream event listeners before leaving
    unsubscribersRef.current.forEach((fn) => { try { fn(); } catch (_) {} });
    unsubscribersRef.current = [];

    try { await callRef.current?.leave(); } catch (_) {}
    try { await clientRef.current?.disconnectUser(); } catch (_) {}

    callRef.current = null;
    clientRef.current = null;
    initializingRef.current = false;
    cleaningUpRef.current = false;

    setCall(null);
    setClient(null);
    setError('');
    setLoading(false);
  }, [stopRinging]);

  // handleClose is idempotent via closingRef
  const handleClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (onEndCall && callData?.callId) {
      try { await onEndCall(callData.callId); } catch (_) {}
    }
    await cleanup();
    onClose();
    closingRef.current = false;
  }, [cleanup, callData?.callId, onEndCall, onClose]);

  useEffect(() => {
    if (!isOpen || !callData?.callId) return;

    // Guard: prevent duplicate setup calls (Strict Mode, rapid re-renders)
    if (initializingRef.current) return;
    initializingRef.current = true;

    cancelledRef.current = false;
    cleaningUpRef.current = false;
    closingRef.current = false;

    const setup = async () => {
      try {
        setLoading(true);
        setError('');

        const authToken =
          (await AsyncStorage.getItem('accessToken')) ||
          (await AsyncStorage.getItem('token'));
        if (!authToken) throw new Error('Not authenticated');

        const tokenRes = await axios.get(`${API_BASE_URL}/api/video/stream/token`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!tokenRes.data?.success) throw new Error('Failed to get Stream token');

        const { token: streamToken, userId: streamUserId, apiKey } = tokenRes.data;
        if (!apiKey || !streamToken || !streamUserId) throw new Error('Invalid Stream credentials');

        if (cancelledRef.current) return;

        const userName =
          currentUser?.fullName || currentUser?.name ||
          (await AsyncStorage.getItem('fullName')) ||
          (await AsyncStorage.getItem('userName')) || 'User';

        // getOrCreateInstance reuses an existing WS connection when the same
        // apiKey+userId combo is already connected — avoids duplicate connections
        const streamClient = StreamVideoClient.getOrCreateInstance({
          apiKey,
          user: { id: streamUserId, name: userName },
          token: streamToken,
        });
        clientRef.current = streamClient;

        if (cancelledRef.current) {
          await streamClient.disconnectUser().catch(() => {});
          return;
        }

        // 'default' call type works for audio — camera is disabled before join
        const streamCall = streamClient.call('default', callData.callId);
        callRef.current = streamCall;

        // Register listeners before join and store unsub refs so they are
        // removed exactly once during cleanup — prevents duplicate firings
        const unsubEnd = streamCall.on('call.ended', () => { handleClose(); });
        const unsubSession = streamCall.on('call.session_ended', () => { handleClose(); });
        unsubscribersRef.current = [unsubEnd, unsubSession];

        // Disable camera BEFORE joining — avoids unnecessary video track negotiation
        await streamCall.camera.disable().catch(() => {});

        // Guard: only join if not already connected to this call
        const currentState = streamCall.state?.callingState;
        const alreadyJoined =
          currentState === CallingState.JOINED ||
          currentState === CallingState.JOINING;

        if (!alreadyJoined) {
          await streamCall.join({ create: true });
        }

        if (cancelledRef.current) {
          unsubscribersRef.current.forEach((fn) => { try { fn(); } catch (_) {} });
          unsubscribersRef.current = [];
          await streamCall.leave().catch(() => {});
          return;
        }

        setClient(streamClient);
        setCall(streamCall);
        setLoading(false);
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err?.message || 'Failed to connect voice call');
          setLoading(false);
        }
        initializingRef.current = false;
      }
    };

    setup();

    return () => {
      // Effect cleanup: mark cancelled so in-flight async work aborts.
      // Do NOT call full cleanup() here — that runs when isOpen becomes false.
      cancelledRef.current = true;
      initializingRef.current = false;
    };
  }, [isOpen, callData?.callId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run full teardown when the modal is closed from the outside
  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen, cleanup]);

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Call</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {loading && (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#4a9eff" />
              <Text style={styles.statusText}>Connecting...</Text>
            </View>
          )}

          {!!error && !loading && (
            <View style={styles.centerWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleClose}>
                <Text style={styles.retryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && client && call && (
            <StreamVideo client={client}>
              <StreamCall call={call}>
                <AudioCallUI
                  onEndCall={handleClose}
                  callerName={callData?.name || 'Counselor'}
                  callerProfilePic={callData?.profilePic || null}
                  isOutgoing={callData?.isIncoming !== true}
                  isCounselor={
                    callData?.currentUserType === 'counsellor' ||
                    callData?.currentUserType === 'counselor'
                  }
                />
              </StreamCall>
            </StreamVideo>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2535',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  closeBtn: { padding: 4 },
  content: { flex: 1, backgroundColor: '#0d1117' },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  statusText: { color: '#4a9eff', fontSize: 16, fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    backgroundColor: '#1e2535',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Audio call UI
  audioCallWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 60,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { color: '#fff', fontSize: 44, fontWeight: '700' },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  callerName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  callStateText: { color: '#4a9eff', fontSize: 16, fontWeight: '400' },
  controlsRow: { flexDirection: 'row', gap: 24, marginTop: 32 },
  ctrlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnActive: { backgroundColor: '#3b82f6' },
  endBtn: { backgroundColor: '#ef4444' },
});

export default VoiceCallModal;
