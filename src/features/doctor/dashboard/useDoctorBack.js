// Android back for the doctor dashboard.
//
// The dashboard swaps whole screens in and out with state (not a navigator),
// and several of those screens have their own inner pages (Settings →
// Privacy & Security → Change Password, Follow-ups → New Follow-up, Staff →
// Create Staff, ...). With one BackHandler per screen, the dashboard's
// listener — re-added on every state change, so always the newest and first
// to run — jumped straight to Home and inner pages never got a say.
//
// Instead the dashboard owns one registry. A screen with inner pages calls
// useDoctorBack(handler); on back press the dashboard asks the most recently
// mounted (innermost) handler first. A handler returns true when it closed one
// of its own pages, or false to let the screen above it handle back.
import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export const DoctorBackContext = createContext(null);

export function useDoctorBackRegistry() {
  const handlers = useRef([]);
  const registry = useRef(null);
  if (!registry.current) {
    registry.current = {
      register(entry) {
        handlers.current = [...handlers.current, entry];
        return () => {
          handlers.current = handlers.current.filter((item) => item !== entry);
        };
      },
      // Innermost (last mounted) first.
      handle() {
        for (let i = handlers.current.length - 1; i >= 0; i -= 1) {
          if (handlers.current[i].current?.() === true) return true;
        }
        return false;
      },
    };
  }
  return registry.current;
}

export function useDoctorBack(handler) {
  const registry = useContext(DoctorBackContext);
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  // Registered once per mount (the ref always calls the latest handler), so
  // stack order is mount order: inner pages sit above the screen that opened them.
  useEffect(() => {
    if (registry) return registry.register(handlerRef);
    // Rendered outside the dashboard: fall back to a plain listener.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handlerRef.current?.() === true);
    return () => subscription.remove();
  }, [registry]);
}
