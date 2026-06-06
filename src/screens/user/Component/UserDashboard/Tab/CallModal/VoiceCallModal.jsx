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
import InCallManager from 'react-native-incall-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import useRingtone from '../../../../../../hooks/useRingtone';
import { useScreenshotPreventModal } from '../../../../../../utils/useScreenshotPrevent';

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  CallingState,
} from '@stream-io/video-react-native-sdk';

const resolveCallDisplayName = (callData, isCounselor) => {
  const apiCallData = callData?.apiCallData || {};
  const initiator = apiCallData?.initiator || {};
  const receiver = apiCallData?.receiver || {};

  const preferredAnonymous =
    initiator?.anonymous || initiator?.anonName || initiator?.anonymousName ||
    receiver?.anonymous || receiver?.anonName || receiver?.anonymousName;

  const preferred =
    callData?.name ||
    callData?.displayName ||
    callData?.callerName ||
    receiver?.displayName ||
    receiver?.fullName ||
    initiator?.displayName ||
    initiator?.fullName;

  // Counselor view: anonymous handle wins; fall back to whatever name the
  // backend provided (already filtered server-side for counselor context).
  if (isCounselor) {
    return preferredAnonymous || preferred || 'User';
  }
  return preferred || preferredAnonymous || 'Participant';
};

// ─── Audio call UI (inside StreamCall context) ────────────────────────────────
// onLocalHangup: user pressed end button (sends call.end() to kill for both sides)
// onRemoteEnded: remote side already ended, just cleanup locally
const AudioCallUI = ({ onLocalHangup, onRemoteEnded, callerName, callerProfilePic, isCounselor, isOutgoing }) => {
  const {
    useCallCallingState,
    useMicrophoneState,
    useRemoteParticipants,
  } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, isMute } = useMicrophoneState();
  const remoteParticipants = useRemoteParticipants();
  const { startRinging, stopRinging } = useRingtone();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const toggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    InCallManager.setSpeakerphoneOn(next);
  };

  // Guard: fire onRemoteEnded exactly once per session
  const endedRef = useRef(false);
  // Guard: prevent duplicate ringback calls per outgoing connecting phase
  const ringingRef = useRef(false);
  // Locked-in start time — set once when the OTHER side joins, never overwritten.
  // Anchoring on the remote participant ensures both sides see the same elapsed time
  // (initiator joins seconds before callee, so using local join time would mismatch).
  const connectedAtRef = useRef(null);
  // Track whether we've ever seen a remote participant in this session
  const everHadRemoteRef = useRef(false);

  const isJoined = callingState === CallingState.JOINED;
  const hasRemote = remoteParticipants.length > 0;
  // Both sides are considered "in call" only when locally joined AND the remote
  // side is present in the room
  const isInCall = isJoined && hasRemote;

  useEffect(() => {
    if (hasRemote) everHadRemoteRef.current = true;
  }, [hasRemote]);

  useEffect(() => {
    if (!isInCall) {
      if (connectedAtRef.current === null) setElapsedSeconds(0);
      return;
    }

    // First moment both sides are present — anchor the timer here.
    if (!connectedAtRef.current) {
      connectedAtRef.current = Date.now();
    }

    const connected = connectedAtRef.current;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - connected) / 1000)));
    };

    tick();

    let intervalId = null;
    const msIntoSecond = (Date.now() - connected) % 1000;
    const alignTimeout = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 1000);
    }, 1000 - msIntoSecond);

    return () => {
      clearTimeout(alignTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isInCall]);

  const displayName = callerName || 'Participant';
  // Counselor sees anonymous user — never show real photo
  const showPhoto = !isCounselor && callerProfilePic;

  // Stop any residual ringtone the moment AudioCallUI mounts regardless of side
  useEffect(() => {
    stopRinging();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While waiting for the other side to join we still show "Connecting…"
  const isConnecting = isJoined && !hasRemote;
  const isConnected = isInCall;
  const isEnded =
    callingState === CallingState.LEFT ||
    callingState === CallingState.IDLE;

  // Stream "call.ended" events tear down the local state. If that doesn't fire
  // (admin-only end()), this catches it: once the remote was here and is now
  // gone, the other side hung up — leave too.
  useEffect(() => {
    if (everHadRemoteRef.current && !hasRemote && !endedRef.current && isJoined) {
      endedRef.current = true;
      onRemoteEnded();
    }
  }, [hasRemote, isJoined, onRemoteEnded]);

  useEffect(() => {
    if (isEnded && !endedRef.current) {
      endedRef.current = true;
      onRemoteEnded();
    }
  }, [isEnded, onRemoteEnded]);

  // Outgoing side only: ringback until the callee actually shows up (hasRemote).
  // Stops as soon as remote participant joins.
  useEffect(() => {
    if (!isOutgoing) return;

    const isWaiting = !hasRemote && !isEnded;

    if (isWaiting && !ringingRef.current) {
      ringingRef.current = true;
      startRinging(false);
    } else if (!isWaiting && ringingRef.current) {
      ringingRef.current = false;
      stopRinging();
    }
  }, [hasRemote, isEnded, isOutgoing, startRinging, stopRinging]);

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

  const t = isCounselor ? counselorTheme : userTheme;

  return (
    <View style={[styles.audioCallWrap, { backgroundColor: t.bg }]}>
      {/* Top — avatar, name, timer */}
      <View style={styles.audioCallTop}>
        <View style={[styles.avatarCircle, { backgroundColor: t.avatarBg }]}>
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{displayInitial}</Text>
          )}
        </View>

        <Text style={styles.callerName}>{displayName}</Text>

        <Text style={[styles.callStateText, { color: t.accent }]}>
          {isConnecting
            ? 'Connecting...'
            : isConnected
            ? formatTime(elapsedSeconds)
            : 'Call Ended'}
        </Text>

        {isConnecting && (
          <ActivityIndicator size="small" color={t.accent} style={{ marginTop: 8 }} />
        )}
      </View>

      {/* Bottom — controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.ctrlBtn, { backgroundColor: t.ctrlBg }, isMute && { backgroundColor: t.ctrlActive }]}
          onPress={toggleMute}
        >
          <Ionicons name={isMute ? 'mic-off' : 'mic'} size={26} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.ctrlBtn, styles.endBtn]} onPress={onLocalHangup}>
          <Ionicons
            name="call"
            size={26}
            color="#fff"
            style={{ transform: [{ rotate: '135deg' }] }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, { backgroundColor: t.ctrlBg }, isSpeaker && { backgroundColor: t.ctrlActive }]}
          onPress={toggleSpeaker}
        >
          <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VoiceCallModal = ({ isOpen, onClose, callData, currentUser, onEndCall }) => {
  useScreenshotPreventModal(isOpen);
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const callRef = useRef(null);
  const clientRef = useRef(null);
  const initializingRef = useRef(false);
  const cleaningUpRef = useRef(false);
  const closingRef = useRef(false);
  const cancelledRef = useRef(false);
  const unsubscribersRef = useRef([]);
  // Always holds the latest handleClose — Stream listeners use this ref so they
  // never capture a stale closure when call.ended fires on the remote side.
  const handleCloseRef = useRef(null);

  const { stopRinging } = useRingtone();
  const isCounselorView =
    callData?.currentUserType === 'counsellor' ||
    callData?.currentUserType === 'counselor';
  const displayName = resolveCallDisplayName(callData, isCounselorView);

  const cleanup = useCallback(async (endForAll = false) => {
    if (cleaningUpRef.current) return;
    cleaningUpRef.current = true;

    stopRinging();
    cancelledRef.current = true;
    if (cancelledRef._pollInterval) {
      clearInterval(cancelledRef._pollInterval);
      cancelledRef._pollInterval = null;
    }

    // Unsubscribe FIRST — stops call.ended re-firing during end()/leave()
    unsubscribersRef.current.forEach((fn) => { try { fn(); } catch (_) {} });
    unsubscribersRef.current = [];

    const currentCall = callRef.current;
    const currentClient = clientRef.current;
    callRef.current = null;
    clientRef.current = null;

    // On local hangup attempt BOTH: call.end() (kills room for everyone — admin
    // permission required) AND call.leave() (always succeeds). If end() fails
    // due to perms, leave() still removes us from the room, and the backend
    // /end PUT marks the call as ended so the remote side's poll closes it.
    if (endForAll) {
      try { await currentCall?.end(); } catch (_) {}
    }
    try { await currentCall?.leave(); } catch (_) {}
    try { await currentClient?.disconnectUser(); } catch (_) {}
    initializingRef.current = false;
    cleaningUpRef.current = false;

    setCall(null);
    setClient(null);
    setError('');
    setLoading(false);
  }, [stopRinging]);

  const handleClose = useCallback(async (localHangup = true) => {
    if (closingRef.current) return;
    closingRef.current = true;

    // Hit backend /end FIRST and wait for it. This marks the call ended on
    // the server before we tear down locally — so the remote side's 2s poll
    // immediately sees status:"ended" and closes too. Doing this after Stream
    // cleanup risks the remote modal hanging for up to ~5s.
    if (localHangup && onEndCall && callData?.callId) {
      try { await onEndCall(callData.callId); } catch (_) {}
    }
    await cleanup(localHangup);
    closingRef.current = false;
    onClose();
  }, [cleanup, callData?.callId, onEndCall, onClose]);

  // Keep the ref in sync with the latest handleClose on every render
  handleCloseRef.current = handleClose;

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
        // removed exactly once during cleanup — prevents duplicate firings.
        // Use handleCloseRef so the listener always calls the latest handleClose,
        // not the stale closure captured when setup() first ran.
        //
        // Listening to participant-left in addition to call.ended is critical:
        // call.end() requires admin perms on Stream — if the user isn't an
        // admin, call.ended never fires for the remote side. participant-left
        // fires reliably for any disconnect (leave, end, network drop).
        const closeFromRemote = () => { handleCloseRef.current?.(false); };
        const myStreamUserId = streamUserId;

        // For participant-left events, only close if the leaver is NOT us —
        // we fire our own participant_left when we call leave(), which would
        // create a self-triggered close loop without this filter.
        const onParticipantLeft = (event) => {
          const leaver =
            event?.participant?.user?.id ||
            event?.participant?.user_id ||
            event?.user?.id ||
            event?.user_id;
          if (leaver && String(leaver) === String(myStreamUserId)) return;
          closeFromRemote();
        };

        const unsubEnd = streamCall.on('call.ended', closeFromRemote);
        const unsubSession = streamCall.on('call.session_ended', closeFromRemote);
        const unsubRejected = streamCall.on('call.rejected', closeFromRemote);
        const unsubParticipantLeft = streamCall.on('call.session_participant_left', onParticipantLeft);
        // SDK also emits this synthetic event on the call object when a remote
        // peer's WebRTC connection drops — fires faster than the WS event.
        const unsubParticipantLeftRTC = streamCall.on('participantLeft', onParticipantLeft);
        unsubscribersRef.current = [
          unsubEnd,
          unsubSession,
          unsubRejected,
          unsubParticipantLeft,
          unsubParticipantLeftRTC,
        ];

        // Disable camera BEFORE joining — avoids unnecessary video track negotiation
        await streamCall.camera.disable().catch(() => {});

        // Guard: only join if not already connected to this call
        const currentState = streamCall.state?.callingState;
        const alreadyJoined =
          currentState === CallingState.JOINED ||
          currentState === CallingState.JOINING;

        if (!alreadyJoined) {
          // Initiator creates the room; callee joins an existing room.
          // Using create:true on the callee side would start a new room
          // instead of joining the counselor's room, causing a split session.
          const isIncoming = callData?.isIncoming === true;
          await streamCall.join({ create: !isIncoming });
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

        // Poll backend every 2s — if the other side ended the call, close this modal.
        // Faster polling keeps the gap between hangup and the other side closing short.
        const pollInterval = setInterval(async () => {
          if (cancelledRef.current) { clearInterval(pollInterval); return; }
          try {
            const tok = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
            const res = await axios.get(`${API_BASE_URL}/api/video/calls/${callData.callId}/details`, {
              headers: { Authorization: `Bearer ${tok}` },
            });
            const status = (
              res.data?.call?.status ||
              res.data?.status ||
              res.data?.data?.status ||
              ''
            ).toLowerCase();
            if (
              status === 'ended' ||
              status === 'rejected' ||
              status === 'missed' ||
              status === 'completed' ||
              status === 'cancelled' ||
              status === 'canceled'
            ) {
              clearInterval(pollInterval);
              if (!cancelledRef.current) handleCloseRef.current?.(false);
            }
          } catch (_) {}
        }, 2000);

        cancelledRef._pollInterval = pollInterval;

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
      cancelledRef.current = true;
      initializingRef.current = false;
      if (cancelledRef._pollInterval) {
        clearInterval(cancelledRef._pollInterval);
        cancelledRef._pollInterval = null;
      }
    };
  }, [isOpen, callData?.callId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run full teardown when the modal is closed from the outside
  useEffect(() => {
    if (!isOpen) {
      cleanup(false);
    }
  }, [isOpen, cleanup]);

  if (!isOpen) return null;

  const t = isCounselorView ? counselorTheme : userTheme;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <StatusBar barStyle="light-content" backgroundColor={t.header} />

        <View style={[styles.header, { backgroundColor: t.header, borderBottomColor: t.headerBorder }]}>
          <Text style={styles.headerTitle}>Voice Call</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.content, { backgroundColor: t.bg }]}>
          {loading && (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color={t.accent} />
              <Text style={[styles.statusText, { color: t.accent }]}>Connecting...</Text>
            </View>
          )}

          {!!error && !loading && (
            <View style={styles.centerWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: t.retryBg }]} onPress={handleClose}>
                <Text style={styles.retryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && client && call && (
            <StreamVideo client={client}>
              <StreamCall call={call}>
                <AudioCallUI
                  onLocalHangup={() => handleClose(true)}
                  onRemoteEnded={() => handleClose(false)}
                  callerName={displayName}
                  callerProfilePic={callData?.profilePic || null}
                  isOutgoing={callData?.isIncoming !== true}
                  isCounselor={isCounselorView}
                />
              </StreamCall>
            </StreamVideo>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const userTheme = {
  bg: '#0d1117',
  header: '#111827',
  headerBorder: '#1e2535',
  accent: '#4a9eff',
  retryBg: '#1e2535',
  avatarBg: '#3b82f6',
  ctrlBg: '#1e2535',
  ctrlActive: '#3b82f6',
};

const counselorTheme = {
  bg: '#0d1117',
  header: '#1E40AF',
  headerBorder: '#1D4ED8',
  accent: '#93C5FD',
  retryBg: '#1D4ED8',
  avatarBg: '#2563EB',
  ctrlBg: '#1D4ED8',
  ctrlActive: '#3B82F6',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  closeBtn: { padding: 4 },
  content: { flex: 1 },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  statusText: { fontSize: 16, fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Audio call UI — bg/avatar/ctrl colors applied inline via theme
  audioCallWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
  },
  audioCallTop: {
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
  callStateText: { fontSize: 16, fontWeight: '400' },
  controlsRow: { flexDirection: 'row', gap: 24 },
  ctrlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: { backgroundColor: '#ef4444' },
});

export default VoiceCallModal;
