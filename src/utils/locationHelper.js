// src/utils/locationHelper.js
// Uses react-native-geolocation-service (Play Services FusedLocationProvider).
// The community geolocation library was unreliable on modern Android — silent
// timeouts on every method. This lib is the production-grade choice and just
// works once installed + the native build is regenerated.
//
// Requires:
//   npm install react-native-geolocation-service
//   (then rebuild: cd android && gradlew clean && cd .. && npx react-native run-android)
// AndroidManifest.xml must declare ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION
// (already added).

import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../axiosConfig';

let GeolocationLib = null;
try {
  // eslint-disable-next-line global-require
  GeolocationLib = require('react-native-geolocation-service').default;
  console.log('[location] Geolocation module loaded:', !!GeolocationLib);
} catch (err) {
  console.warn(
    '[location] react-native-geolocation-service not installed yet. ' +
      'Run `npm install react-native-geolocation-service` then rebuild the app.',
  );
}

const LOCATION_SUMMARY_KEY = 'locationSummary';
const STICKY_BANNER_KEY = 'locationStickyBanner';
const PENDING_NOTICE_KEY = 'pendingLocationNotice';

// Ask Android for runtime location permission. iOS uses Info.plist + the
// native picker triggered by Geolocation.requestAuthorization, which the
// library handles internally on first getCurrentPosition.
export const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    // Ask for both fine + coarse together. On Android 12+ the user can pick
    // "Approximate" — that only grants COARSE, not FINE. Either is fine for
    // our use case (city-level), so we accept whichever the user granted.
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const fine =
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const coarse =
      result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
    return (
      fine === PermissionsAndroid.RESULTS.GRANTED ||
      coarse === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.warn('[location] permission request failed:', err?.message);
    return false;
  }
};

export const getCurrentPosition = (options = {}) =>
  new Promise(async (resolve, reject) => {
    console.log('[location] getCurrentPosition called');
    if (!GeolocationLib) {
      console.warn('[location] native module missing');
      reject(new Error('Geolocation native module not installed. Run npm install + rebuild.'));
      return;
    }

    const granted = await requestLocationPermission();
    console.log('[location] permission granted:', granted);
    if (!granted) {
      reject(new Error('Location permission denied — open Android Settings → Apps → Chatbots → Permissions → Location → Allow.'));
      return;
    }

    // iOS needs explicit authorization request before getCurrentPosition.
    if (Platform.OS === 'ios') {
      try {
        await GeolocationLib.requestAuthorization('whenInUse');
      } catch (e) {
        console.warn('[location] iOS auth threw:', e?.message);
      }
    }

    // Strategy: race two parallel attempts (low-accuracy + high-accuracy)
    // plus a watchPosition that resolves on ANY fix. First fix wins.
    // This is the only pattern I've found that works reliably across the
    // many ways Android can silently fail to deliver a position.

    let settled = false;
    let watchId = null;

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        try {
          GeolocationLib.clearWatch(watchId);
        } catch {
          /* ignore */
        }
      }
      fn();
    };

    const onPos = (label) => (pos) => {
      console.log(
        `[location] fix from ${label}: lat=${pos.coords.latitude} lng=${pos.coords.longitude} acc=${pos.coords.accuracy}`,
      );
      settle(() =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      );
    };

    const onErr = (label) => (err) => {
      console.warn(`[location] ${label} error:`, err?.code, err?.message);
    };

    // react-native-geolocation-service Android options:
    //   forceRequestLocation: true       — actively activate a provider
    //   showLocationDialog: true         — prompt user to enable Location if off
    //   forceLocationManager: false      — use Play Services Fused (recommended)

    // Attempt 1: cached / low-accuracy, accepts very stale fix.
    try {
      GeolocationLib.getCurrentPosition(
        onPos('cached-low'),
        onErr('cached-low'),
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 3600000,
          forceRequestLocation: true,
          showLocationDialog: true,
          forceLocationManager: false,
        },
      );
    } catch (e) {
      console.warn('[location] cached-low threw:', e?.message);
    }

    // Attempt 2: fresh high-accuracy GPS fix (the one Fused does best).
    try {
      GeolocationLib.getCurrentPosition(
        onPos('high'),
        onErr('high'),
        {
          enableHighAccuracy: true,
          timeout: 18000,
          maximumAge: 60000,
          forceRequestLocation: true,
          showLocationDialog: true,
          forceLocationManager: false,
        },
      );
    } catch (e) {
      console.warn('[location] high threw:', e?.message);
    }

    // Attempt 3: watchPosition — wakes the OS into actively delivering fixes.
    try {
      watchId = GeolocationLib.watchPosition(
        onPos('watch'),
        onErr('watch'),
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          interval: 1000,
          fastestInterval: 500,
          forceRequestLocation: true,
          showLocationDialog: true,
          forceLocationManager: false,
        },
      );
      console.log('[location] watch started, id=', watchId);
    } catch (e) {
      console.warn('[location] watch threw:', e?.message);
    }

    // Final timeout — if no attempt resolved, reject with actionable error.
    setTimeout(() => {
      settle(() =>
        reject(
          new Error(
            'Could not get a location fix in 20s. Check: (1) Location is ON in Android Settings, (2) the app has "Precise location" enabled in Settings → Apps → Chatbots → Permissions, (3) try going outdoors or near a window.',
          ),
        ),
      );
    }, options.timeout || 20000);
  });

export const captureAndSendLocation = async (event = 'manual') => {
  const coords = await getCurrentPosition();
  let response;
  try {
    response = await axiosInstance.post(
      '/api/location/update',
      { latitude: coords.latitude, longitude: coords.longitude, event },
      { timeout: 15000 },
    );
  } catch (err) {
    if (err?.response?.status === 404) {
      throw new Error(
        'Backend route /api/location/update not found. Deploy the location route on the backend first.',
      );
    }
    if (err?.code === 'ECONNABORTED') {
      throw new Error('Backend timed out while saving location. Try again.');
    }
    throw err;
  }

  const current = response?.data?.data?.current;
  if (current) {
    await cacheLocationSummary({
      city: current.city || '',
      state: current.state || '',
      country: current.country || '',
      address: current.address || '',
      coordinates: current.coordinates || null,
      capturedAt: current.capturedAt || new Date().toISOString(),
    });
  }

  return response.data;
};

export const cacheLocationSummary = async (summary) => {
  try {
    await AsyncStorage.setItem(LOCATION_SUMMARY_KEY, JSON.stringify(summary));
  } catch {
    /* ignore */
  }
};

export const getCachedLocationSummary = async () => {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_SUMMARY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCachedLocationSummary = async () => {
  try {
    await AsyncStorage.removeItem(LOCATION_SUMMARY_KEY);
  } catch {
    /* ignore */
  }
};

export const formatLocationLabel = (summary) => {
  if (!summary) return '';
  const parts = [summary.city, summary.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (summary.address) return summary.address;
  if (summary.country) return summary.country;
  return 'Location set';
};

export const setStickyLocationBanner = async (on) => {
  try {
    if (on) await AsyncStorage.setItem(STICKY_BANNER_KEY, '1');
    else await AsyncStorage.removeItem(STICKY_BANNER_KEY);
  } catch {
    /* ignore */
  }
};

export const hasStickyLocationBanner = async () => {
  try {
    return (await AsyncStorage.getItem(STICKY_BANNER_KEY)) === '1';
  } catch {
    return false;
  }
};

export const setPendingLocationNotice = async (notice) => {
  try {
    await AsyncStorage.setItem(PENDING_NOTICE_KEY, JSON.stringify(notice));
  } catch {
    /* ignore */
  }
};

export const consumePendingLocationNotice = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_NOTICE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_NOTICE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Best-effort wrapper used during auth flows. Never throws — GPS is optional.
export const sendLocationSilently = async (event) => {
  try {
    await captureAndSendLocation(event);
    return true;
  } catch (err) {
    console.warn(`[location] ${event} location capture skipped:`, err.message);
    await setPendingLocationNotice({
      message: err.message || "Couldn't capture your location",
      event,
      timestamp: Date.now(),
    });
    return false;
  }
};

// Soft-block helper for the LocationGate-style flow.
export const tryCaptureLocation = async (event) => {
  try {
    await captureAndSendLocation(event);
    await setStickyLocationBanner(false);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err.message || "Couldn't capture your location",
    };
  }
};
