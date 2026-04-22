import { useCallback, useEffect, useRef, useState } from "react";

const RING_REPEAT_MS = 3000;
const BEEP_FREQUENCY_HZ = 880;
const BEEP_DURATION_SEC = 0.18;
const BEEP_GAP_SEC = 0.12;
const BEEP_ATTACK_SEC = 0.01;
const BEEP_RELEASE_SEC = 0.08;
const BEEP_VOLUME = 0.08;
const RESUME_EVENTS = ["pointerdown", "touchstart", "keydown"];

const useRingtone = () => {
  const [isRinging, setIsRinging] = useState(false);

  const isRingingRef = useRef(false);
  const audioContextRef = useRef(null);
  const repeatTimerRef = useRef(null);
  const activeNodesRef = useRef([]);
  const startRingingRef = useRef(null);
  const resumeFromGestureRef = useRef(null);
  const listenersAttachedRef = useRef(false);

  const clearRepeatTimer = useCallback(() => {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  const disconnectNode = useCallback((node) => {
    if (!node) return;

    try {
      node.disconnect();
    } catch {
      // Node may already be disconnected; ignore.
    }
  }, []);

  const removeActiveEntry = useCallback(
    (entry) => {
      activeNodesRef.current = activeNodesRef.current.filter(
        (item) => item !== entry,
      );
      disconnectNode(entry.oscillator);
      disconnectNode(entry.gainNode);
    },
    [disconnectNode],
  );

  const stopActiveNodes = useCallback(() => {
    activeNodesRef.current.forEach((entry) => {
      entry.oscillator.onended = null;

      try {
        entry.oscillator.stop();
      } catch {
        // Oscillator may already be stopped.
      }

      disconnectNode(entry.oscillator);
      disconnectNode(entry.gainNode);
    });

    activeNodesRef.current = [];
  }, [disconnectNode]);

  const detachResumeListeners = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !listenersAttachedRef.current ||
      !resumeFromGestureRef.current
    ) {
      return;
    }

    RESUME_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, resumeFromGestureRef.current);
    });

    listenersAttachedRef.current = false;
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    const AudioContextCtor =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor) {
      console.warn("Web Audio API is not supported in this browser.");
      return null;
    }

    if (
      !audioContextRef.current ||
      audioContextRef.current.state === "closed"
    ) {
      audioContextRef.current = new AudioContextCtor();
    }

    return audioContextRef.current;
  }, []);

  const scheduleBeep = useCallback(
    (audioContext, startTime) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(BEEP_FREQUENCY_HZ, startTime);

      // Web Audio cannot ramp exponentially from absolute zero,
      // so use a tiny floor value instead.
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(
        BEEP_VOLUME,
        startTime + BEEP_ATTACK_SEC,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + BEEP_DURATION_SEC + BEEP_RELEASE_SEC,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const entry = { oscillator, gainNode };
      activeNodesRef.current.push(entry);

      oscillator.onended = () => {
        removeActiveEntry(entry);
      };

      oscillator.start(startTime);
      oscillator.stop(startTime + BEEP_DURATION_SEC + BEEP_RELEASE_SEC);
    },
    [removeActiveEntry],
  );

  const scheduleDoubleRing = useCallback(
    (audioContext) => {
      if (!isRingingRef.current) return;

      stopActiveNodes();
      clearRepeatTimer();

      const firstBeepStart = audioContext.currentTime + 0.02;
      const secondBeepStart =
        firstBeepStart + BEEP_DURATION_SEC + BEEP_GAP_SEC;

      scheduleBeep(audioContext, firstBeepStart);
      scheduleBeep(audioContext, secondBeepStart);

      repeatTimerRef.current = setTimeout(() => {
        if (typeof startRingingRef.current === "function") {
          void startRingingRef.current();
        }
      }, RING_REPEAT_MS);
    },
    [clearRepeatTimer, scheduleBeep, stopActiveNodes],
  );

  const resumeFromGesture = useCallback(async () => {
    if (!isRingingRef.current) {
      detachResumeListeners();
      return;
    }

    const audioContext = ensureAudioContext();
    if (!audioContext) {
      detachResumeListeners();
      setIsRinging(false);
      isRingingRef.current = false;
      return;
    }

    try {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    } catch (error) {
      console.warn("Ringtone resume still blocked by browser policy.", error);
    }

    if (audioContext.state === "running" && isRingingRef.current) {
      detachResumeListeners();
      scheduleDoubleRing(audioContext);
    }
  }, [detachResumeListeners, ensureAudioContext, scheduleDoubleRing]);

  const startRinging = useCallback(async () => {
    const audioContext = ensureAudioContext();
    if (!audioContext) {
      setIsRinging(false);
      isRingingRef.current = false;
      return;
    }

    setIsRinging(true);
    isRingingRef.current = true;

    try {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    } catch (error) {
      console.warn("Initial ringtone resume attempt was blocked.", error);
    }

    if (audioContext.state === "running") {
      detachResumeListeners();
      scheduleDoubleRing(audioContext);
      return;
    }

    // Browser autoplay gotcha:
    // incoming-call events are usually not user gestures, so Safari/iOS and
    // some desktop browsers may keep the AudioContext suspended until the user
    // taps or presses a key. We keep temporary listeners alive so the ringtone
    // starts on the first gesture while the overlay is still visible.
    if (typeof window !== "undefined" && !listenersAttachedRef.current) {
      RESUME_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, resumeFromGesture, {
          passive: true,
        });
      });
      listenersAttachedRef.current = true;
    }
  }, [detachResumeListeners, ensureAudioContext, resumeFromGesture, scheduleDoubleRing]);

  const stopRinging = useCallback(() => {
    setIsRinging(false);
    isRingingRef.current = false;

    clearRepeatTimer();
    detachResumeListeners();
    stopActiveNodes();

    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state === "running") {
      audioContext.suspend().catch(() => {
        // Context may already be closing; ignore.
      });
    }
  }, [clearRepeatTimer, detachResumeListeners, stopActiveNodes]);

  useEffect(() => {
    isRingingRef.current = isRinging;
  }, [isRinging]);

  useEffect(() => {
    startRingingRef.current = startRinging;
    resumeFromGestureRef.current = resumeFromGesture;
  }, [startRinging, resumeFromGesture]);

  useEffect(() => {
    return () => {
      clearRepeatTimer();
      detachResumeListeners();
      stopActiveNodes();

      const audioContext = audioContextRef.current;
      audioContextRef.current = null;

      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {
          // Ignore close races during unmount.
        });
      }
    };
  }, [clearRepeatTimer, detachResumeListeners, stopActiveNodes]);

  return {
    startRinging,
    stopRinging,
    isRinging,
  };
};

export default useRingtone;
