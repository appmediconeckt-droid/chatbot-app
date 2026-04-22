// hooks/useVibration.js - Fixed version
import { useCallback, useEffect, useState } from "react";
import { Vibration } from "react-native";
import safeVibrate, { cancelVibration, initVibration } from "../utils/safeVibrate";

const useVibration = (autoRequestPermission = true) => {
  const [isReady, setIsReady] = useState(false);

  // Initialize on mount
  useEffect(() => {
    if (autoRequestPermission) {
      initVibration().then(() => {
        setIsReady(true);
      });
    } else {
      setIsReady(true);
    }
  }, [autoRequestPermission]);

  // Simple vibrate function - synchronous
  const vibrate = useCallback((pattern = 50) => {
    if (!isReady) {
      // Try anyway after small delay
      setTimeout(() => {
        safeVibrate(pattern);
      }, 50);
      return;
    }
    safeVibrate(pattern);
  }, [isReady]);

  // Stop vibration
  const stopVibration = useCallback(() => {
    cancelVibration();
  }, []);

  return {
    vibrate,
    stopVibration,
    isReady,
  };
};

export default useVibration;