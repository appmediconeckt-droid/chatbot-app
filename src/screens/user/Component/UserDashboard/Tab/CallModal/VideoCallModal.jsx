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

  if (isCounselor) {
    return preferredAnonymous || preferred || 'Participant';
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

  const isEnded =
    callingState === CallingState.LEFT ||
    callingState === CallingState.IDLE;

  useEffect(() => {
    if (isEnded && !endedRef.current) {
      endedRef.current = true;
      // State went to LEFT/IDLE without local hangup — remote ended the call
      onRemoteEnded();
    }
  }, [isEnded, onRemoteEnded]);

  // Guard: start/stop ringback only once per state transition for outgoing calls
  const ringingRef = useRef(false);

  useEffect(() => {
    if (!isOutgoing) return;

    const isConnecting =
      callingState === CallingState.JOINING ||
      callingState === CallingState.RINGING;

    if (isConnecting && !ringingRef.current) {
      ringingRef.current = true;
      startRinging(false);
    } else if (!isConnecting && ringingRef.current) {
      ringingRef.current = false;
      stopRinging();
    }
  }, [callingState, isOutgoing, startRinging, stopRinging]);

  // Strip real photo from remote participants so Stream renders initials for counselor
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

    if (endForAll) {
      try { await currentCall?.end(); } catch (_) {}
    } else {
      try { await currentCall?.leave(); } catch (_) {}
    }
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

    if (localHangup && onEndCall && callData?.callId) {
      try { await onEndCall(callData.callId); } catch (_) {}
    }
    await cleanup(localHangup);
    onClose();
    closingRef.current = false;
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
        // removed exactly once during cleanup — prevents duplicate firings
        // Use handleCloseRef so the listener always calls the latest handleClose,
        // not the stale closure captured when setup() first ran.
        const unsubEnd = streamCall.on('call.ended', () => { handleCloseRef.current?.(false); });
        const unsubSession = streamCall.on('call.session_ended', () => { handleCloseRef.current?.(false); });
        unsubscribersRef.current = [unsubEnd, unsubSession];

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

        // Poll backend every 3s — if the other side ended the call, close this modal
        const pollInterval = setInterval(async () => {
          if (cancelledRef.current) { clearInterval(pollInterval); return; }
          try {
            const tok = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
            const res = await axios.get(`${API_BASE_URL}/api/video/calls/${callData.callId}`, {
              headers: { Authorization: `Bearer ${tok}` },
            });
            const status = res.data?.call?.status || res.data?.status;
            if (status === 'ended' || status === 'rejected' || status === 'missed') {
              clearInterval(pollInterval);
              if (!cancelledRef.current) handleCloseRef.current?.(false);
            }
          } catch (_) {}
        }, 3000);

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

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Video Call</Text>
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
