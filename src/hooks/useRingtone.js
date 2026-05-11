import { useCallback, useEffect, useState } from "react";
import { Vibration } from "react-native";
import InCallManager from "react-native-incall-manager";

const VIBRATION_PATTERN = [0, 400, 200, 400, 1000];
const MAX_RING_DURATION_MS = 60000;

// Singleton — one shared state across all hook instances so any component
// can stop the ringtone and it stops everywhere immediately.
let globalIsRinging = false;
let globalMode = null;
let globalSession = 0;
let ringFailsafeTimer = null;
const listeners = new Set();

const notify = () => {
  const snapshot = { isRinging: globalIsRinging, mode: globalMode };
  listeners.forEach((fn) => { try { fn(snapshot); } catch (_) {} });
};

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

  if (ringFailsafeTimer) { clearTimeout(ringFailsafeTimer); ringFailsafeTimer = null; }

  // Cut audio before notifying React — prevents a render where state says
  // "stopped" but audio is still playing.
  forceStopAudio();
  notify();
};

const startRingingGlobal = (incoming = true) => {
  const requestedMode = incoming ? "incoming" : "outgoing";

  if (globalIsRinging) {
    if (globalMode !== requestedMode) {
      stopRingingGlobal();
    } else {
      return;
    }
  }

  // Compute mySession AFTER the conditional stop so the new session ID is
  // always strictly greater than whatever stopRingingGlobal left behind.
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
      // startRingtone loops natively — call once, no JS timer needed.
      try { InCallManager.startRingtone("_BUNDLE_"); } catch (_) {}
    }
    Vibration.vibrate(VIBRATION_PATTERN, true);
  } else {
    if (InCallManager) {
      try { InCallManager.stopRingback(); } catch (_) {}
      try { InCallManager.setKeepScreenOn(true); } catch (_) {}
      try { InCallManager.startRingback("_BUNDLE_"); } catch (_) {}
    }
  }

  notify();
};

// Resets all module-level state — call on logout to prevent stale globals
// from poisoning the next call session in the same app lifetime.
const resetRingtoneState = () => {
  globalSession += 1;
  globalIsRinging = false;
  globalMode = null;
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
