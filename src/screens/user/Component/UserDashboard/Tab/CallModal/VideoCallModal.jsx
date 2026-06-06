import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
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
import { useScreenshotPreventModal } from '../../../../../../utils/useScreenshotPrevent';

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  CallContent,
  useCallStateHooks,
  CallingState,
} from '@stream-io/video-react-native-sdk';

const resolveCallDisplayName = (callData, isCounselor) => {
  const apiCallData = callData?.apiCallData || {};
  const initiator = apiCallData?.initiator || {};
  const receiver = apiCallData?.receiver || {};

  const preferredAnonymous =
    initiator?.anonymous ||
    initiator?.anonName ||
    initiator?.anonymousName ||
    receiver?.anonymous ||
    receiver?.anonName ||
    receiver?.anonymousName;

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

// ─── Inner call UI ────────────────────────────────────────────────────────────
// onLocalHangup: user pressed end button (sends call.end() to kill for both sides)
// onRemoteEnded: remote side already ended, just cleanup locally
const CallUI = ({ onLocalHangup, onRemoteEnded, isCounselor, isOutgoing, participantName }) => {
  const { useCallCallingState, useRemoteParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const remoteParticipants = useRemoteParticipants();
  const { startRinging, stopRinging } = useRingtone();

  // Guard: fire remote-ended callback only once per session
  const endedRef = useRef(false);
  // Tracks whether the remote was ever in the room — used to detect "remote left"
  const everHadRemoteRef = useRef(false);

  const isJoined = callingState === CallingState.JOINED;
  const hasRemote = remoteParticipants.length > 0;

  const isEnded =
    callingState === CallingState.LEFT ||
    callingState === CallingState.IDLE;

  useEffect(() => {
    if (hasRemote) everHadRemoteRef.current = true;
  }, [hasRemote]);

  useEffect(() => {
    if (isEnded && !endedRef.current) {
      endedRef.current = true;
      onRemoteEnded();
    }
  }, [isEnded, onRemoteEnded]);

  // Detect remote-left: if the other side was present and then disappears
  // while we're still in the call, treat as remote hangup. Catches the case
  // where call.end() couldn't run (non-admin) so call.ended event never fires.
  useEffect(() => {
    if (everHadRemoteRef.current && !hasRemote && !endedRef.current && isJoined) {
      endedRef.current = true;
      onRemoteEnded();
    }
  }, [hasRemote, isJoined, onRemoteEnded]);

  // Guard: start/stop ringback only once per state transition for outgoing calls
  const ringingRef = useRef(false);

  // Ringback plays only on the outgoing side and only until the callee actually
  // appears in the room. JOINING/RINGING alone isn't enough — the initiator
  // hits JOINED almost immediately, but the callee may not be there yet.
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

  // Counselor side: strip the user's real photo from Stream's participant
  // object so the SDK's built-in UI renders initials instead of a real avatar.
  // Name is left alone — backend already gives us a safe label.
  useEffect(() => {
    if (!isCounselor) return;
    remoteParticipants.forEach((p) => {
      if (p?.publishedTracks && p.image) {
        try { p.image = ''; } catch (_) {}
      }
    });
  }, [isCounselor, remoteParticipants]);

  return (
    <View style={{ flex: 1 }}>
      {!!participantName && (
        <View style={styles.participantNameBadge}>
          <Text style={styles.participantNameText} numberOfLines={1}>{participantName}</Text>
        </View>
      )}
      <CallContent onHangupCallHandler={onLocalHangup} />
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VideoCallModal = ({ isOpen, onClose, callData, currentUser, onEndCall }) => {
  useScreenshotPreventModal(isOpen);
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const callRef = useRef(null);
  const clientRef = useRef(null);
  const initializingRef = useRef(false);
  const cleaningUpRef = useRef(false);
  const cancelledRef = useRef(false);
  const unsubscribersRef = useRef([]);
  const closingRef = useRef(false);
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

        // Guard: only join if not already connected to this call
        const currentState = streamCall.state?.callingState;
        const alreadyJoined =
          currentState === CallingState.JOINED ||
          currentState === CallingState.JOINING;

        if (!alreadyJoined) {
          // Initiator creates the room; callee joins an existing room.
          // Using create:true on the callee side would start a new room
          // instead of joining the initiator's room, causing a split session.
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

        // Store interval so cleanup can clear it
        cancelledRef._pollInterval = pollInterval;

      } catch (err) {
        if (!cancelledRef.current) {
          setError(err?.message || 'Failed to connect video call');
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
          <Text style={styles.headerTitle}>Video Call</Text>
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
                <CallUI
                  onLocalHangup={() => handleClose(true)}
                  onRemoteEnded={() => handleClose(false)}
                  participantName={displayName}
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
};

const counselorTheme = {
  bg: '#0d1117',
  header: '#1E40AF',
  headerBorder: '#1D4ED8',
  accent: '#93C5FD',
  retryBg: '#1D4ED8',
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
  participantNameBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 5,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '80%',
  },
  participantNameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VideoCallModal;
