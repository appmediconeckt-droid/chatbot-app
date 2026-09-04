import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import Text from '../../../../../../components/TranslatedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InCallManager from 'react-native-incall-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import useRingtone from '../../../../../../hooks/useRingtone';
import { useScreenshotPreventModal } from '../../../../../../utils/useScreenshotPrevent';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import toImageUri from '../../../../../../utils/imageUri';
import { joinStreamCall } from './streamCallUtils';

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantView,
  FloatingParticipantView,
  useCallStateHooks,
  CallingState,
} from '@stream-io/video-react-native-sdk';

const IMAGE_KEYS = [
  'profilePhoto',
  'profilePic',
  'avatar',
  'photo',
  'userProfilePhoto',
  'counselorProfilePhoto',
  'counsellorProfilePhoto',
];

const normalizeImageUri = (raw) => {
  const uri = toImageUri(raw);
  if (!uri || typeof uri !== 'string') return null;

  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (/^(https?:|file:|content:|data:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${API_BASE_URL}${trimmed}`;
  if (trimmed.length < 5 || !/[/.]/.test(trimmed)) return null;
  return `${API_BASE_URL}/${trimmed}`;
};

const firstImageUri = (...values) => {
  for (const value of values) {
    const uri = normalizeImageUri(value);
    if (uri) return uri;
  }
  return null;
};

const parseStoredValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
  try { return JSON.parse(trimmed); } catch (_) { return trimmed; }
};

const getCallParty = (callData, key) => (
  callData?.apiCallData?.[key] ||
  callData?.[key] ||
  null
);

const getPartyId = (party) => (
  party?._id ||
  party?.id ||
  party?.userId ||
  party?.counselorId ||
  party?.counsellorId ||
  null
);

const partyMatchesRole = (party, currentUserType) => {
  const role = String(currentUserType || '').toLowerCase();
  if (!role) return false;
  const partyType = String(party?.type || party?.role || party?.userType || '').toLowerCase();
  if (!partyType) return false;
  if (/^(user|patient)/.test(role)) return /^(user|patient)/.test(partyType);
  if (/counsell?o?u?r/.test(role)) return /counsell?o?u?r/.test(partyType);
  return partyType === role;
};

const resolveCallParties = (callData, currentUser) => {
  const initiator = getCallParty(callData, 'initiator');
  const receiver = getCallParty(callData, 'receiver');
  const currentUserId = callData?.currentUserId || currentUser?.id || currentUser?._id || null;
  const currentUserType = callData?.currentUserType || currentUser?.role || currentUser?.type || null;
  const initiatorId = getPartyId(initiator);
  const receiverId = getPartyId(receiver);

  if (currentUserId && initiatorId && String(currentUserId) === String(initiatorId)) {
    return { localParty: initiator, remoteParty: receiver };
  }
  if (currentUserId && receiverId && String(currentUserId) === String(receiverId)) {
    return { localParty: receiver, remoteParty: initiator };
  }
  if (partyMatchesRole(initiator, currentUserType)) {
    return { localParty: initiator, remoteParty: receiver };
  }
  if (partyMatchesRole(receiver, currentUserType)) {
    return { localParty: receiver, remoteParty: initiator };
  }
  return { localParty: null, remoteParty: null };
};

const getPersonPhoto = (person) => firstImageUri(
  person?.profilePhoto,
  person?.profilePic,
  person?.image,
  person?.avatarUrl,
  person?.avatar,
  person?.photo,
);

const getStoredProfilePhoto = async () => {
  const entries = await AsyncStorage.multiGet(IMAGE_KEYS);
  return firstImageUri(...entries.map(([, value]) => parseStoredValue(value)));
};

const hasVideoTrack = (participant) => {
  if (!participant) return false;
  if (participant.videoStream) return true;
  const tracks = Array.isArray(participant.publishedTracks) ? participant.publishedTracks : [];
  return tracks.some((track) => (
    track === 2 ||
    String(track).toLowerCase() === 'video' ||
    String(track).toLowerCase() === 'track_type_video'
  ));
};

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

const ProfileVideoFallback = ({ participant, profilePhoto, compact = false }) => {
  const photoUri = firstImageUri(profilePhoto, participant?.image);

  return (
    <View style={[styles.videoOffFallback, compact && styles.videoOffFallbackCompact]}>
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={compact ? styles.videoOffAvatarCompact : styles.videoOffAvatar}
          resizeMode="cover"
        />
      ) : (
        <View style={compact ? styles.videoOffIconWrapCompact : styles.videoOffIconWrap}>
          <Ionicons
            name="videocam-off"
            size={compact ? 24 : 42}
            color="rgba(255,255,255,0.82)"
          />
        </View>
      )}
    </View>
  );
};

const SelfParticipantView = ({ style, ...props }) => (
  <View style={[style, styles.pipCard]}>
    <ParticipantView {...props} style={StyleSheet.absoluteFillObject} />
  </View>
);

// ─── Custom bottom control bar (Figma: dark translucent rounded sheet) ────────
const VideoControls = ({ onHangupCallHandler }) => {
  const { useMicrophoneState, useCameraState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const { camera, isMute: isCamOff } = useCameraState();
  const [isSpeaker, setIsSpeaker] = useState(true);

  const toggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    try { InCallManager.setForceSpeakerphoneOn(next); } catch (_) {}
  };

  return (
    <View style={styles.controlsWrap}>
      <View style={styles.controlsBar}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.vcBtn, isMute && styles.vcBtnActive]}
            onPress={() => microphone.toggle()}
            activeOpacity={0.8}
          >
            <Ionicons name={isMute ? 'mic-off' : 'mic'} size={21} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.vcBtn, isCamOff && styles.vcBtnActive]}
            onPress={() => camera.toggle()}
            activeOpacity={0.8}
          >
            <Ionicons name={isCamOff ? 'videocam-off' : 'videocam'} size={21} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vcBtn}
            onPress={() => camera.flip()}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-reverse" size={21} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.vcBtn, !isSpeaker && styles.vcBtnActive]}
            onPress={toggleSpeaker}
            activeOpacity={0.8}
          >
            <Ionicons name={isSpeaker ? 'volume-high' : 'volume-mute'} size={21} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vcEndBtn}
            onPress={onHangupCallHandler}
            activeOpacity={0.85}
          >
            <Ionicons
              name="call"
              size={23}
              color="#ffffff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const VideoConnectingPreview = ({ onHangup, participantName, participantPhoto, isCounselor, isOutgoing }) => {
  const initial = String(participantName || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <View style={styles.callRoot}>
      <View style={styles.waitingWrap}>
        <View style={styles.waitingAvatar}>
          {!isCounselor && participantPhoto ? (
            <Image source={{ uri: participantPhoto }} style={styles.waitingAvatarImg} />
          ) : (
            <Text style={styles.waitingInitial}>{initial}</Text>
          )}
        </View>
        <Text style={styles.waitingName} numberOfLines={1}>{participantName}</Text>
        <View style={styles.videoConnectingRow}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.waitingStatus}>{isOutgoing ? 'Calling...' : 'Connecting...'}</Text>
        </View>
      </View>

      <View style={styles.controlsWrap}>
        <View style={styles.controlsBar}>
          <View style={styles.controlsRow}>
            <TouchableOpacity style={[styles.vcBtn, styles.vcBtnDisabled]} disabled>
              <Ionicons name="mic" size={21} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vcBtn, styles.vcBtnDisabled]} disabled>
              <Ionicons name="videocam" size={21} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vcBtn, styles.vcBtnDisabled]} disabled>
              <Ionicons name="camera-reverse" size={21} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vcBtn, styles.vcBtnDisabled]} disabled>
              <Ionicons name="volume-high" size={21} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.vcEndBtn} onPress={onHangup} activeOpacity={0.85}>
              <Ionicons
                name="call"
                size={23}
                color="#ffffff"
                style={{ transform: [{ rotate: '135deg' }] }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Inner call UI ────────────────────────────────────────────────────────────
// onLocalHangup: user pressed end button (sends call.end() to kill for both sides)
// onRemoteEnded: remote side already ended, just cleanup locally
const CallUI = ({ onLocalHangup, onRemoteEnded, isOutgoing, participantName, participantPhoto, localParticipantPhoto }) => {
  const insets = useSafeAreaInsets();
  const { useCallCallingState, useRemoteParticipants, useLocalParticipant } = useCallStateHooks();
  const callingState = useCallCallingState();
  const remoteParticipants = useRemoteParticipants();
  const localParticipant = useLocalParticipant();
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

  // Call duration — starts once the other side actually joins.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!hasRemote) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [hasRemote]);
  const timerText = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // Give InCallManager an active audio session for the duration of the call so
  // the Speaker button can actually switch the route (setForceSpeakerphoneOn is
  // a no-op without a session). Without this the speaker toggle did nothing on
  // the counselor side. Stops on unmount.
  useEffect(() => {
    try { InCallManager.start({ media: 'video' }); } catch (_) {}
    return () => { try { InCallManager.stop(); } catch (_) {} };
  }, []);

  // Once connected (ringing has stopped, which resets the route), force the
  // loudspeaker on — video calls should default to speaker. Defined AFTER the
  // ringback effect so it runs last and wins the route.
  useEffect(() => {
    if (hasRemote) {
      try { InCallManager.setForceSpeakerphoneOn(true); } catch (_) {}
    }
  }, [hasRemote]);

  const remote = remoteParticipants[0];
  const isRemoteVideoOn = Boolean(remote?.videoStream) && hasVideoTrack(remote);
  const initial = String(participantName || 'U').trim().charAt(0).toUpperCase() || 'U';
  const RemoteVideoFallback = useCallback(
    ({ participant }) => (
      <ProfileVideoFallback participant={participant} profilePhoto={participantPhoto} />
    ),
    [participantPhoto],
  );
  const LocalVideoFallback = useCallback(
    ({ participant }) => (
      <ProfileVideoFallback participant={participant} profilePhoto={localParticipantPhoto} compact />
    ),
    [localParticipantPhoto],
  );

  return (
    <View style={styles.callRoot}>
      {/* Full-screen remote video (no border, cover) */}
      {remote ? (
        <ParticipantView
          participant={remote}
          style={styles.fullVideo}
          objectFit="cover"
          ParticipantLabel={null}
          ParticipantNetworkQualityIndicator={null}
          ParticipantReaction={null}
          ParticipantVideoFallback={RemoteVideoFallback}
        />
      ) : (
        <View style={styles.waitingWrap}>
          <View style={styles.waitingAvatar}>
            {participantPhoto ? (
              <Image source={{ uri: participantPhoto }} style={styles.waitingAvatarImg} />
            ) : (
              <Text style={styles.waitingInitial}>{initial}</Text>
            )}
          </View>
          <Text style={styles.waitingName} numberOfLines={1}>{participantName}</Text>
          <Text style={styles.waitingStatus}>{isOutgoing ? 'Calling…' : 'Connecting…'}</Text>
        </View>
      )}

      {/* Local self-view — Stream's FloatingParticipantView renders the local
          camera reliably (a raw ParticipantView left the PiP blank). Top-right,
          rounded, no signal/label chrome. */}
      {localParticipant && (
        <FloatingParticipantView
          participant={localParticipant}
          alignment="top-right"
          objectFit="cover"
          ParticipantView={SelfParticipantView}
          ParticipantVideoFallback={LocalVideoFallback}
          draggableContainerStyle={[
            styles.pipStage,
            { top: insets.top + 12, bottom: insets.bottom + 104 },
          ]}
          participantViewStyle={styles.pipFloat}
          ParticipantNetworkQualityIndicator={null}
          ParticipantReaction={null}
        />
      )}

      {/* Name + timer overlay (top-left) — only once connected */}
      {!!participantName && remote && isRemoteVideoOn && (
        <View
          style={[styles.participantNameBadge, { top: insets.top + 12 }]}
          pointerEvents="none"
        >
          <Text style={styles.participantNameText} numberOfLines={1}>{participantName}</Text>
          <Text style={styles.participantTimerText}>{timerText}</Text>
        </View>
      )}

      {/* Bottom controls */}
      <VideoControls onHangupCallHandler={onLocalHangup} />
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VideoCallModal = ({ isOpen, onClose, callData, currentUser, onEndCall }) => {
  const { t } = useLanguageRender();
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
  // Loose match: the counselor dashboard sent "counsellour" (typo), which matched
  // neither exact spelling, so counselors were shown the user variant of the call.
  const currentUserType = callData?.currentUserType || currentUser?.role || currentUser?.type || '';
  const isCounselorView = /counsell?o?u?r/i.test(String(currentUserType));
  const displayName = resolveCallDisplayName(callData, isCounselorView);
  const { localParty, remoteParty } = resolveCallParties(callData, currentUser);
  const participantPhoto = firstImageUri(
    getPersonPhoto(remoteParty),
    callData?.profilePic,
    callData?.profilePhoto,
    callData?.image,
    callData?.receiver?.profilePhoto,
    callData?.initiator?.profilePhoto,
  );
  const [localParticipantPhoto, setLocalParticipantPhoto] = useState(() => firstImageUri(
    currentUser?.profilePhoto,
    currentUser?.profilePic,
    currentUser?.image,
    currentUser?.avatarUrl,
    currentUser?.avatar,
    getPersonPhoto(localParty),
  ));

  const cleanup = useCallback(async (endForAll = false) => {
    if (cleaningUpRef.current) return;
    cleaningUpRef.current = true;

    stopRinging();
    // Release the audio session opened for ringback so it doesn't leak after
    // the call ends (outgoing calls open it via InCallManager.start).
    try { InCallManager.stop(); } catch (_) {}
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
        const streamUserPhoto =
          firstImageUri(
            currentUser?.profilePhoto,
            currentUser?.profilePic,
            currentUser?.image,
            currentUser?.avatarUrl,
            currentUser?.avatar,
            getPersonPhoto(localParty),
          ) ||
          (await getStoredProfilePhoto());

        setLocalParticipantPhoto(streamUserPhoto);

        // getOrCreateInstance reuses an existing WS connection when the same
        // apiKey+userId combo is already connected — avoids duplicate connections
        const streamClient = StreamVideoClient.getOrCreateInstance({
          apiKey,
          user: {
            id: streamUserId,
            name: userName,
            ...(streamUserPhoto ? { image: streamUserPhoto } : {}),
          },
          token: streamToken,
        });
        clientRef.current = streamClient;

        if (cancelledRef.current) {
          await streamClient.disconnectUser().catch(() => {});
          return;
        }

        const streamCall = await joinStreamCall({
          streamClient,
          callData,
          CallingState,
        });
        callRef.current = streamCall;

        // Register listeners after a successful join and store unsub refs so they are
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

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Full-bleed video: no SafeAreaView insets, no "Video Call" header bar
          and no dark container — those produced the black band over the video.
          The name/timer and controls float on top of the stream instead. */}
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <View style={styles.content}>
          {loading && (
            <VideoConnectingPreview
              onHangup={() => handleClose(true)}
              participantName={displayName}
              participantPhoto={participantPhoto}
              isOutgoing={callData?.isIncoming !== true}
              isCounselor={isCounselorView}
            />
          )}

          {!!error && !loading && (
            <View style={styles.centerWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={[styles.retryBtn, styles.closeErrorBtn]} onPress={handleClose}>
                <Text style={styles.retryBtnText}>{t('Close')}</Text>
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
                  participantPhoto={participantPhoto}
                  localParticipantPhoto={localParticipantPhoto}
                  isOutgoing={callData?.isIncoming !== true}
                />
              </StreamCall>
            </StreamVideo>
          )}
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
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
  closeErrorBtn: { backgroundColor: '#EF4444' },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Full-screen remote video + waiting state
  callRoot: { flex: 1, backgroundColor: '#0B0B0F' },
  fullVideo: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B0B0F' },
  videoOffFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B0B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOffFallbackCompact: {
    backgroundColor: '#15151A',
  },
  videoOffAvatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#1E293B',
  },
  videoOffAvatarCompact: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#1E293B',
  },
  videoOffIconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOffIconWrapCompact: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  waitingAvatar: {
    width: 112, height: 112, borderRadius: 56, overflow: 'hidden',
    backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  waitingAvatarImg: { width: '100%', height: '100%', borderRadius: 56 },
  waitingInitial: { color: '#fff', fontSize: 44, fontWeight: '800' },
  waitingName: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  waitingStatus: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '500' },
  videoConnectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Local self-view PiP. Width/height override the SDK's default (23% of screen).
  // The SDK starts its draggable view at top: 0. This inset keeps the mini
  // video clear of the top edge/notch on both user and counselor call screens.
  pipStage: {
    ...StyleSheet.absoluteFillObject,
  },
  pipFloat: {
    width: 118,
    height: 162,
    borderRadius: 18,
    marginHorizontal: 14,
  },
  pipCard: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#15151A',
    elevation: 0,
    shadowOpacity: 0,
  },
  // Name + timer overlay — top-left, plain white text over the video (Figma)
  participantNameBadge: {
    position: 'absolute',
    left: 18,
    zIndex: 5,
    maxWidth: '55%',
  },
  participantNameText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  participantTimerText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ─── Bottom control bar (Figma) ───────────────────────────────────────────
  controlsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 22,
  },
  // Dark translucent sheet with dark-grey circular buttons (per Figma)
  controlsBar: {
    backgroundColor: 'rgba(28, 30, 34, 0.38)',
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  vcBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(75, 85, 99, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vcBtnActive: {
    backgroundColor: 'rgba(31, 41, 55, 0.96)',
  },
  vcBtnDisabled: {
    opacity: 0.55,
  },
  vcEndBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VideoCallModal;
