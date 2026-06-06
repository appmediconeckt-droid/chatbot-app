import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

const { ScreenshotPrevent } = NativeModules;

const secure = () => {
  if (Platform.OS === 'android' && ScreenshotPrevent) ScreenshotPrevent.enable();
};
const unsecure = () => {
  if (Platform.OS === 'android' && ScreenshotPrevent) ScreenshotPrevent.disable();
};

// For full screens: enables on mount, disables on unmount only.
// FLAG_SECURE is owned by the screen — modals must NOT disable it.
const useScreenshotPrevent = () => {
  useEffect(() => {
    secure();
    return () => unsecure();
  }, []);
};

// For modals: enables when open=true, but NEVER disables —
// the parent screen owns FLAG_SECURE and keeps it active after the modal closes.
export const useScreenshotPreventModal = (open) => {
  useEffect(() => {
    if (open) secure();
  }, [open]);
};

export default useScreenshotPrevent;
