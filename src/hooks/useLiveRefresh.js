import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import socketService from '../services/socketService';

// Refresh visible data after reconnect/resume, with a fallback for server edits
// that do not emit a socket event. Never poll while the app is in background.
export default function useLiveRefresh(refresh, events = [], intervalMs = 15000) {
  const focused = useIsFocused();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const eventKey = JSON.stringify(events);

  useEffect(() => {
    if (!focused) return;
    let disposed = false;
    let running = false;
    let queued = false;
    let state = AppState.currentState;
    let debounce;
    const unsubscribers = [];
    const run = async () => {
      if (disposed || (state && state !== 'active')) return;
      if (running) { queued = true; return; }
      running = true;
      try {
        await refreshRef.current();
      } catch (error) {
        console.warn('Live refresh failed:', error?.message);
      } finally {
        running = false;
        if (queued) { queued = false; void run(); }
      }
    };
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(run, 250);
    };
    const appStateSub = AppState.addEventListener('change', (next) => {
      state = next;
      if (next === 'active') void run();
    });
    const interval = setInterval(run, intervalMs);
    void run();
    (async () => {
      try {
        const socket = await socketService.connect();
        if (disposed) return;
        for (const event of new Set(['connect', ...JSON.parse(eventKey)])) {
          socket.on(event, schedule);
          unsubscribers.push(() => socket.off(event, schedule));
        }
        // Data may have changed during initial socket connection.
        schedule();
      } catch (error) {
        console.warn('Live refresh socket unavailable:', error?.message);
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(debounce);
      clearInterval(interval);
      appStateSub.remove();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [focused, eventKey, intervalMs]);
}
