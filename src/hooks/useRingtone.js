import { useCallback, useEffect, useState } from "react";
import { Vibration } from "react-native";
import InCallManager from "react-native-incall-manager";

const VIBRATION_PATTERN = [0, 400, 200, 400, 1000];
const RINGTONE_CYCLE_MS = 2500;
const MAX_RING_DURATION_MS = 60000;

// Singleton — one shared state across all hook instances so any component
// can stop the ringtone and it stops everywhere immediately.
let globalIsRinging = false;
let globalMode = null;
let globalSession = 0;
let ringLoopTimer = null;
let ringFailsafeTimer = null;
const listeners = new Set();

const notify = () => {
  const snapshot = { isRinging: globalIsRinging, mode: globalMode };
  listeners.forEach((fn) => { try { fn(snapshot); } catch (_) {} });
};

// Null-checked so a missing native module doesn't crash silently in a way
// that's hard to diagnose — the guard makes the skip explicit.
const forceStopAudio = () => {
  Vibration.cancel();
  if (InCallManager) {
    try { InCallManager.stopRingtone(); } catch (_) {}
    try { InCallManager.stopRingback(); } catch (_) {}
    try { InCallManager.setForceSpeakerphoneOn(false); } catch (_) {}
    try { InCallManager.setKeepScreenOn(false); } catch (_) {}
  }
};

const stopRingingGlobal = () => {
  globalSession += 1;
  globalIsRinging = false;
  globalMode = null;

  if (ringLoopTimer) { clearTimeout(ringLoopTimer); ringLoopTimer = null; }
  if (ringFailsafeTimer) { clearTimeout(ringFailsafeTimer); ringFailsafeTimer = null; }

  // Cut audio before notifying React — prevents a render where state says
  // "stopped" but audio is still playing.
  forceStopAudio();
  notify();
};

const ringTriggerGlobal = (mySession) => {
  if (!globalIsRinging || globalSession !== mySession) return;

  if (InCallManager) {
    try { InCallManager.stopRingtone(); } catch (_) {}
    try { InCallManager.startRingtone("_BUNDLE_"); } catch (_) {}
  }

  // Clear before reassigning — prevents a leaked timer if this function is
  // somehow re-entered before the previous setTimeout fires.
  if (ringLoopTimer) clearTimeout(ringLoopTimer);
  ringLoopTimer = setTimeout(() => ringTriggerGlobal(mySession), RINGTONE_CYCLE_MS);
};

const startRingingGlobal = (incoming = true) => {
  const requestedMode = incoming ? "incoming" : "outgoing";

  if (globalIsRinging) {
    if (globalMode !== requestedMode) {
      // stopRingingGlobal increments globalSession here (to old+1).
      stopRingingGlobal();
    } else {
      return;
    }
  }

  // Compute mySession AFTER the conditional stop so the new session ID is
  // always strictly greater than whatever stopRingingGlobal left behind.
  // Previously this was computed before the stop, meaning two sessions could
  // share the same ID when a mode-change stop occurred.
  const mySession = globalSession + 1;
  globalSession = mySession;
  globalIsRinging = true;
  globalMode = requestedMode;

  if (ringFailsafeTimer) clearTimeout(ringFailsafeTimer);
  ringFailsafeTimer = setTimeout(() => {
    if (globalIsRinging && globalSession === mySession) stopRingingGlobal();
  }, MAX_RING_DURATION_MS);

  if (incoming) {
    if (InCallManager) {
      try { InCallManager.setForceSpeakerphoneOn(true); } catch (_) {}
      try { InCallManager.setKeepScreenOn(true); } catch (_) {}
    }
    ringTriggerGlobal(mySession);
    Vibration.vibrate(VIBRATION_PATTERN, true);
  } else {
    if (InCallManager) {
      try { InCallManager.stopRingback(); } catch (_) {}
      try { InCallManager.setKeepScreenOn(true); } catch (_) {}
      try { InCallManager.startRingback("_BUNDLE_"); } catch (_) {}
    }
  }

  // Notify after all audio/state is set up so listeners see a consistent snapshot.
  notify();
};

// Resets all module-level state — call on logout to prevent stale globals
// from poisoning the next call session in the same app lifetime.
const resetRingtoneState = () => {
  globalSession += 1;
  globalIsRinging = false;
  globalMode = null;
  if (ringLoopTimer) { clearTimeout(ringLoopTimer); ringLoopTimer = null; }
  if (ringFailsafeTimer) { clearTimeout(ringFailsafeTimer); ringFailsafeTimer = null; }
  forceStopAudio();
  notify();
};

const useRingtone = () => {
  const [state, setState] = useState(() => ({ isRinging: globalIsRinging, mode: globalMode }));

  useEffect(() => {
    const listener = (snapshot) => setState(snapshot);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const startRinging = useCallback((incoming = true) => {
    startRingingGlobal(incoming);
  }, []);

  const stopRinging = useCallback(() => {
    stopRingingGlobal();
  }, []);

  return { startRinging, stopRinging, isRinging: state.isRinging, mode: state.mode };
};

// Exported so handlers can control audio synchronously without a hook instance.
export {
  stopRingingGlobal as forceStopRingtone,
  startRingingGlobal as startIncomingRingtone,
  resetRingtoneState,
};
export default useRingtone;
