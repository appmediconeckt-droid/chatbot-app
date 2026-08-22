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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InCallManager from 'react-native-incall-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import useRingtone from '../../../../../../hooks/useRingtone';
import { useScreenshotPreventModal } from '../../../../../../utils/useScreenshotPrevent';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  CallingState,
} from '@stream-io/video-react-native-sdk';

// Blends two hex colours; used to spread a gradient across the waveform bars,
// which are separate Views and so can't share one LinearGradient.
const mixHex = (from, to, ratio) => {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const ch = (a, b) => Math.round(a + (b - a) * ratio).toString(16).padStart(2, '0');
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
};

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
  // `t` is the call theme in this file, so the translator is bound as `tr`.
  const { t: tr } = useLanguageRender();
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
  // Animated voice waveform
  const waveAnims = useRef(
    Array.from({ length: 9 }, () => new Animated.Value(0.3))
  ).current;
  // Avatar breathing pulse + expanding ripple rings
  const avatarPulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  // Entrance fade/slide
  const enterAnim = useRef(new Animated.Value(0)).current;

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

  // Entrance: fade + rise once on mount.
  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  // Avatar breathing pulse + expanding ripple rings while connecting/connected.
  useEffect(() => {
    const active = isConnecting || isConnected;
    if (!active) {
      avatarPulse.stopAnimation();
      avatarPulse.setValue(1);
      [ring1, ring2, ring3].forEach((r) => { r.stopAnimation(); r.setValue(0); });
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarPulse, { toValue: 1.05, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(avatarPulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();

    const ringLoop = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const loops = [ringLoop(ring1, 0), ringLoop(ring2, 730), ringLoop(ring3, 1460)];
    loops.forEach((l) => l.start());

    return () => {
      pulse.stop();
      loops.forEach((l) => l.stop());
    };
  }, [isConnecting, isConnected, avatarPulse, ring1, ring2, ring3]);

  // Ripple the waveform while the call is live (and not muted).
  useEffect(() => {
    const active = isConnected && !isMute;
    if (!active) {
      waveAnims.forEach((a) => { a.stopAnimation(); a.setValue(0.3); });
      return;
    }
    const loops = waveAnims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 70),
          Animated.timing(a, {
            toValue: 0.55 + Math.random() * 0.45,
            duration: 320 + Math.random() * 240,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0.28,
            duration: 320 + Math.random() * 240,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [isConnected, isMute, waveAnims]);

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
    <View style={styles.audioCallWrap}>
      {/* Top — avatar, name, badges, timer, waveform */}
      <Animated.View
        style={[
          styles.audioCallTop,
          {
            opacity: enterAnim,
            transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          },
        ]}
      >
        <View style={styles.avatarZone}>
          {[ring1, ring2, ring3].map((r, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.ripple,
                {
                  borderColor: t.brand,
                  opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                  transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                },
              ]}
            />
          ))}
          <Animated.View style={[styles.avatarRing, { transform: [{ scale: avatarPulse }] }]}>
            <View style={[styles.avatarCircle, { backgroundColor: t.tint }]}>
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: t.brand }]}>{displayInitial}</Text>
              )}
            </View>
          </Animated.View>
        </View>

        <Text style={[styles.callerName, { color: t.brand }]} numberOfLines={1}>{displayName}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badgeAudio}>
            <Text style={styles.badgeAudioText}>{tr('HD AUDIO')}</Text>
          </View>
          <View style={[styles.badgeSecure, { backgroundColor: t.tint }]}>
            <Text style={[styles.badgeSecureText, { color: t.brand }]}>{tr('ENCRYPTED')}</Text>
          </View>
        </View>

        <View style={styles.timerRow}>
          {isConnecting ? (
            <ActivityIndicator size="small" color={t.brand} />
          ) : (
            <Ionicons name="timer-outline" size={15} color={t.brand} />
          )}
          <Text style={[styles.timerText, { color: t.brand }]}>
            {isConnecting
              ? tr('Connecting…')
              : isConnected
              ? formatTime(elapsedSeconds)
              : tr('Call Ended')}
          </Text>
        </View>

        <View style={styles.waveRow}>
          {waveAnims.map((a, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  backgroundColor: mixHex(
                    t.waveFrom,
                    t.waveTo,
                    waveAnims.length > 1 ? i / (waveAnims.length - 1) : 0,
                  ),
                  transform: [{ scaleY: a }],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Bottom — control panel + end button */}
      <Animated.View
        style={[
          styles.bottomArea,
          {
            opacity: enterAnim,
            transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
          },
        ]}
      >
        <View style={styles.controlPanel}>
          <TouchableOpacity
            style={[styles.ctrlBtn, { backgroundColor: t.tint }, isMute && { backgroundColor: t.brand }]}
            onPress={toggleMute}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isMute ? 'mic-off' : 'mic'}
              size={24}
              color={isMute ? '#ffffff' : '#0f172a'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctrlBtn, { backgroundColor: t.tint }, isSpeaker && { backgroundColor: t.brand }]}
            onPress={toggleSpeaker}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isSpeaker ? 'volume-high' : 'volume-medium'}
              size={24}
              color={isSpeaker ? '#ffffff' : '#0f172a'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endBtn} onPress={onLocalHangup} activeOpacity={0.85}>
            <Ionicons
              name="call"
              size={26}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const VoiceConnectingPreview = ({ onHangup, callerName, callerProfilePic, isCounselor }) => {
  const { t: tr } = useLanguageRender();
  const theme = isCounselor ? counselorTheme : userTheme;
  const displayName = callerName || 'Participant';
  const canShowPhoto =
    !isCounselor &&
    typeof callerProfilePic === 'string' &&
    (callerProfilePic.startsWith('http://') || callerProfilePic.startsWith('https://'));
  const displayInitial = (displayName?.charAt(0) || 'U').toUpperCase();

  return (
    <View style={styles.audioCallWrap}>
      <View style={styles.audioCallTop}>
        <View style={styles.avatarZone}>
          <View style={[styles.ripple, { borderColor: theme.brand, opacity: 0.1, transform: [{ scale: 1.45 }] }]} />
          <View style={[styles.ripple, { borderColor: theme.brand, opacity: 0.18, transform: [{ scale: 1.22 }] }]} />
          <View style={styles.avatarRing}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.tint }]}>
              {canShowPhoto ? (
                <Image source={{ uri: callerProfilePic }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: theme.brand }]}>{displayInitial}</Text>
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.callerName, { color: theme.brand }]} numberOfLines={1}>{displayName}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badgeAudio}>
            <Text style={styles.badgeAudioText}>{tr('HD AUDIO')}</Text>
          </View>
          <View style={[styles.badgeSecure, { backgroundColor: theme.tint }]}>
            <Text style={[styles.badgeSecureText, { color: theme.brand }]}>{tr('ENCRYPTED')}</Text>
          </View>
        </View>

        <View style={styles.timerRow}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={[styles.timerText, { color: theme.brand }]}>{tr('Connecting…')}</Text>
        </View>

        <View style={styles.waveRow}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: 22,
                  backgroundColor: mixHex(theme.waveFrom, theme.waveTo, i / 8),
                  opacity: 0.9,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottomArea}>
        <View style={styles.controlPanel}>
          <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: theme.tint, opacity: 0.65 }]} disabled>
            <Ionicons name="mic" size={24} color="#0f172a" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: theme.tint, opacity: 0.65 }]} disabled>
            <Ionicons name="volume-high" size={24} color="#0f172a" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.endBtn} onPress={onHangup} activeOpacity={0.85}>
            <Ionicons
              name="call"
              size={26}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VoiceCallModal = ({ isOpen, onClose, callData, currentUser, onEndCall }) => {
  const { t: tr } = useLanguageRender();
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
  // Matched loosely on purpose. The counselor dashboard was sending
  // "counsellour" (a typo), which equalled neither spelling - so this was always
  // false and the counselor got the USER call screen: green theme, the caller's
  // photo shown, and the close cross that should not be there.
  const isCounselorView = /counsell?o?u?r/i.test(String(callData?.currentUserType || ''));
  const displayName = resolveCallDisplayName(callData, isCounselorView);

  const cleanup = useCallback(async (endForAll = false) => {
    if (cleaningUpRef.current) return;
    cleaningUpRef.current = true;

    stopRinging();
    // Release the audio session opened for ringback (outgoing calls start it).
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
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      // Explicit, not relying on the app-wide default: without these the modal
      // window stops above the navigation bar and the dashboard's tab bar stayed
      // visible in a strip under the call screen.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {!!error && !loading && (
          <View style={styles.lightHeader}>
            <Text style={styles.lightHeaderTitle}>{tr('Voice Call')}</Text>
            {/* Counselor side: no cross. Android back still cancels a connecting
                call (onRequestClose), and the error state below has its own
                Close button, so nothing becomes unreachable. */}
            {!isCounselorView && (
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={[styles.content, { backgroundColor: '#ffffff' }]}>
          {loading && (
            <VoiceConnectingPreview
              onHangup={() => handleClose(true)}
              callerName={displayName}
              callerProfilePic={callData?.profilePic || null}
              isCounselor={isCounselorView}
            />
          )}

          {!!error && !loading && (
            <View style={styles.centerWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: t.brand }]} onPress={handleClose}>
                <Text style={styles.retryBtnText}>{tr('Close')}</Text>
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
  brand: '#006B2C',
  // Wallet-card gradient stops - the waveform is drawn across them.
  waveFrom: '#006B2C',
  waveTo: '#01CE54',
  tint: '#E6F6EC',
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
  brand: '#004AC6',
  // Earnings-card gradient stops.
  waveFrom: '#003A9B',
  waveTo: '#1490FF',
  tint: '#E7EEFE',
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
  lightHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  lightHeaderTitle: { color: '#0f172a', fontSize: 17, fontWeight: '700' },
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

  // ─── Audio call UI (Figma: white sheet, green accents) ────────────────────
  audioCallWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioCallTop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  avatarZone: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  ripple: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
    borderColor: '#2A8A51',
  },
  avatarRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.5,
    borderColor: '#E6E7EC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  avatarCircle: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: '#E6F6EC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: '#00652C', fontSize: 46, fontWeight: '700' },
  avatarImage: { width: '100%', height: '100%' },
  callerName: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    maxWidth: '82%',
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  badgeAudio: {
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAudioText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  badgeSecure: {
    backgroundColor: '#E6F6EC',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSecureText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00652C',
    letterSpacing: 0.5,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 18,
  },
  timerText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#00652C',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    marginTop: 22,
  },
  waveBar: {
    width: 4,
    height: 30,
    borderRadius: 3,
    // Colour is per-bar and comes from the active theme - see mixHex below.
  },

  bottomArea: {
    width: '100%',
    alignItems: 'center',
  },
  controlPanel: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    width: '100%',
    backgroundColor: '#F7F8FA',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 30,
    paddingBottom: 38,
    paddingHorizontal: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
  },
  ctrlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E6F6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 7,
  },
});

export default VoiceCallModal;
