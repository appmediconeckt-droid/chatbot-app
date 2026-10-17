// Timed API refreshes only as a backup to the socket. Screens keep their
// short interval, and the gate decides whether a tick actually calls the API:
//   - app in background            -> never
//   - socket disconnected          -> every tick (the short interval)
//   - socket connected             -> at most once per `connectedMs`
//                                     (Infinity: never — events cover it)
// The first tick always passes, so opening a screen still loads at once —
// unless `primed` (the screen has just loaded on its own).
import { AppState } from 'react-native';
import socketService from '../services/socketService';

export const createPollGate = (connectedMs, { primed = false } = {}) => {
  let lastRequest = primed ? Date.now() : 0;
  return () => {
    if (AppState.currentState !== 'active') return false;
    if (socketService.isConnected?.() && lastRequest && Date.now() - lastRequest < connectedMs) return false;
    lastRequest = Date.now();
    return true;
  };
};

// Incoming calls arrive instantly over the socket ('incoming_call_request',
// handled app-wide by GlobalIncomingCallController) and by push; the
// GET /api/video/calls/pending poll on the dashboards is only a backup.
export const createIncomingCallPollGate = () => createPollGate(30000);
