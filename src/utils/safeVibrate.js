// utils/safeVibrate.js - Fixed version
import { Vibration, Platform } from 'react-native';

let vibrationAvailable = true;

const normalizePattern = (pattern) => {
  if (Array.isArray(pattern)) {
    return pattern.map((duration, index) => {
      const numericDuration = Number(duration) || 0;

      // Make the pulse stronger while keeping brief gaps between bursts.
      if (index % 2 === 0) {
        return Math.max(120, Math.round(numericDuration * 2.2));
      }

      return Math.max(60, Math.round(numericDuration * 1.5));
    });
  }

  const numericPattern = Number(pattern) || 0;
  return Math.max(120, Math.round(numericPattern * 2.5));
};

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

    // Execute a stronger vibration pattern immediately (synchronous)
    const resolvedPattern = normalizePattern(pattern);
    Vibration.vibrate(resolvedPattern);
    return true;
  } catch (error) {
    // Handle specific error
    if (error.message?.includes('not current process')) {
      // Try again with a small delay
      setTimeout(() => {
        try {
          Vibration.vibrate(normalizePattern(pattern));
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
    Vibration.vibrate(120);
    setTimeout(() => cancelVibration(), 10);
    return true;
  } catch (error) {
    return false;
  }
};

export default safeVibrate;