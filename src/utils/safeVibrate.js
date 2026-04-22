// utils/safeVibrate.js - Fixed version
import { Vibration, Platform } from 'react-native';

let vibrationAvailable = true;

// Main safe vibrate function - NOT async (synchronous for immediate execution)
const safeVibrate = (pattern = 50) => {
  // Don't try to vibrate if not available
  if (!vibrationAvailable) {
    return false;
  }

  try {
    // Check if Vibration API exists and we're on main thread
    if (!Vibration || typeof Vibration.vibrate !== 'function') {
      vibrationAvailable = false;
      return false;
    }

    // Execute vibration immediately (synchronous)
    Vibration.vibrate(pattern);
    return true;
  } catch (error) {
    // Handle specific error
    if (error.message?.includes('not current process')) {
      // Try again with a small delay
      setTimeout(() => {
        try {
          Vibration.vibrate(pattern);
        } catch (e) {
          vibrationAvailable = false;
        }
      }, 100);
    } else if (error.message?.includes('permission')) {
      vibrationAvailable = false;
    }
    return false;
  }
};

// Cancel current vibration
export const cancelVibration = () => {
  try {
    if (Vibration && typeof Vibration.cancel === 'function') {
      Vibration.cancel();
    }
  } catch (error) {
    // Silent fail
  }
};

// Initialize vibration (simple version)
export const initVibration = async () => {
  // Test if vibration works
  try {
    Vibration.vibrate(1);
    setTimeout(() => cancelVibration(), 10);
    return true;
  } catch (error) {
    return false;
  }
};

export default safeVibrate;