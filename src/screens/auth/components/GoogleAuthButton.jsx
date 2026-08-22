// src/screens/auth/components/GoogleAuthButton.jsx
// RN port of the web GoogleAuthButton. Hits POST /api/auth/google with the
// idToken Google returns (backend verifies it with the same web client ID).
//
// Requires:
//   npm install @react-native-google-signin/google-signin
// and a Google Cloud Console "Android" OAuth client whose package name +
// SHA-1 matches this app (without an Android client, sign-in fails with
// DEVELOPER_ERROR on Android). The `webClientId` below is used to request
// an ID token the backend can validate.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../axiosConfig';
import { GOOGLE_WEB_CLIENT_ID } from '../../../config';
import { sendLocationSilently } from '../../../utils/locationHelper';
import socketService from '../../../services/socketService';

let GoogleSigninModule = null;
let StatusCodesModule = null;
try {
  // Lazy-require so the screen doesn't crash if the native module isn't
  // linked yet (e.g. before `npm install` + rebuild).
  // eslint-disable-next-line global-require
  const lib = require('@react-native-google-signin/google-signin');
  GoogleSigninModule = lib.GoogleSignin;
  StatusCodesModule = lib.statusCodes;
} catch (err) {
  console.warn(
    '[GoogleAuthButton] @react-native-google-signin/google-signin not installed. ' +
      'Run `npm install @react-native-google-signin/google-signin` and rebuild the app.',
  );
}

// UI uses American spelling "counselor"; backend uses British "counsellor".
// Normalize for our own UI state, then map back when sending to the backend.
const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  return value === 'counsellor' ? 'counselor' : value;
};

const mapRoleForBackend = (role) =>
  role === 'counselor' ? 'counsellor' : role;

const isGeneratedUserAvatarUrl = (raw) => {
  const url =
    typeof raw === 'string'
      ? raw
      : raw?.url || raw?.secure_url || '';
  const value = String(url || '').trim();
  if (!value) return false;
  return (
    value.startsWith('data:image/') ||
    /^https:\/\/api\.dicebear\.com\//i.test(value)
  );
};

const sanitizeUserPhotoForRole = (user, roleName) => {
  if (!user || roleName !== 'user') return user;
  const profilePhoto = isGeneratedUserAvatarUrl(user.profilePhoto)
    ? user.profilePhoto
    : '';
  return {
    ...user,
    profilePhoto,
    profilePic: undefined,
    photo: undefined,
    picture: undefined,
    image: undefined,
  };
};

const GoogleAuthButton = ({
  role,
  mode = 'signin', // 'signin' | 'signup'
  onSuccess,
  onConflict,
  onError,
  disabled = false,
  locationEvent = 'login',
  gateDriven = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (!GoogleSigninModule) return;
    try {
      GoogleSigninModule.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
        forceCodeForRefreshToken: false,
      });
      setConfigured(true);
    } catch (err) {
      console.warn('[GoogleAuthButton] configure failed:', err?.message);
    }
  }, []);

  const exchangeWithBackend = async (idToken) => {
    const storedRole =
      normalizeRole(role) ||
      normalizeRole(await AsyncStorage.getItem('role')) ||
      'user';

    console.log(
      '[GoogleAuthButton] POST /api/auth/google role=',
      mapRoleForBackend(storedRole),
    );
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/google`,
      { idToken, role: mapRoleForBackend(storedRole) },
      { withCredentials: true, timeout: 20000 },
    );

    const data = response.data || {};
    console.log(
      '[GoogleAuthButton] backend response keys:',
      Object.keys(data),
      'success=',
      data.success,
      'hasToken=',
      Boolean(data.accessToken || data.token),
    );

    // Backend sometimes returns 200 { success:false, message:"..." } for
    // "user not registered" rather than a 4xx. Treat that as an error so the
    // UI shows the message instead of half-logging-in.
    if (data.success === false || !(data.accessToken || data.token)) {
      const msg =
        data.message ||
        'This Google account is not registered. Please sign up first.';
      const err = new Error(msg);
      err.response = { status: 400, data };
      throw err;
    }

    const userRole = normalizeRole(
      data.role || data.user?.role || storedRole,
    );
    const isCounselor = userRole === 'counselor';

    const token = data.accessToken || data.token;
    if (token) {
      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('token', token);
    }
    if (data.refreshToken) {
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
    }

    await AsyncStorage.setItem('userRole', userRole);
    await AsyncStorage.setItem('isAuthenticated', 'true');

    const user = sanitizeUserPhotoForRole(data.user || data, userRole);
    if (user) {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      if (user.email) await AsyncStorage.setItem('userEmail', user.email);
      const id = user._id || user.id;
      if (id) {
        await AsyncStorage.setItem('userId', id);
        if (isCounselor) {
          await AsyncStorage.setItem('counsellorId', id);
          await AsyncStorage.setItem('counselorId', id);
        }
      }
    }

    await AsyncStorage.removeItem('role');

    if (!gateDriven) {
      sendLocationSilently(locationEvent);
    }
    socketService.connect().catch(() => {});

    onSuccess?.({ isCounselor, user });
  };

  const handlePress = async () => {
    if (disabled || busy) return;
    if (!GoogleSigninModule) {
      onError?.(
        'Google Sign-In native module not installed. Run npm install and rebuild.',
      );
      return;
    }
    if (!configured) {
      onError?.('Google Sign-In not configured yet. Please try again.');
      return;
    }

    setBusy(true);
    try {
      await GoogleSigninModule.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      try {
        await GoogleSigninModule.signOut();
      } catch {
        /* ignore */
      }

      const signInResult = await GoogleSigninModule.signIn();
      console.log(
        '[GoogleAuthButton] signIn raw result:',
        JSON.stringify(signInResult),
      );

      // Lib v13+ returns { type: 'cancelled' } on cancel without throwing.
      if (signInResult?.type === 'cancelled') {
        return;
      }

      // Extract idToken across all known library shapes.
      let idToken =
        signInResult?.idToken ||
        signInResult?.data?.idToken ||
        signInResult?.user?.idToken ||
        signInResult?.data?.user?.idToken ||
        null;

      // Fallback: some lib versions only expose the idToken via getTokens().
      if (!idToken) {
        try {
          const tokens = await GoogleSigninModule.getTokens();
          idToken = tokens?.idToken || null;
        } catch (e) {
          console.warn('[GoogleAuthButton] getTokens fallback failed:', e?.message);
        }
      }

      if (!idToken) {
        throw new Error(
          'Google did not return an idToken. Check that the Android OAuth client (package + SHA-1) is registered in Google Cloud Console.',
        );
      }

      await exchangeWithBackend(idToken);
    } catch (err) {
      const code = err?.code;
      if (
        StatusCodesModule &&
        (code === StatusCodesModule.SIGN_IN_CANCELLED ||
          code === StatusCodesModule.IN_PROGRESS)
      ) {
        return;
      }
      if (code === 'DEVELOPER_ERROR') {
        onError?.(
          'DEVELOPER_ERROR: SHA-1 or package name does not match Google Cloud Console. Add the Android OAuth client with package com.chatbots and the debug SHA-1.',
        );
        return;
      }
      if (err?.response?.status === 409) {
        const conflictEmail = err.response?.data?.email || '';
        onConflict?.({ email: conflictEmail });
        return;
      }
      if (err?.response?.status === 404) {
        onError?.(
          'Backend route /api/auth/google not found on this server. Deploy the Google login route on the backend first.',
        );
        return;
      }
      if (
        err?.response?.status === 403 &&
        err?.response?.data?.code === 'ROLE_MISMATCH'
      ) {
        const actual = err.response.data.actualRole;
        const requested = err.response.data.requestedRole;
        onError?.(
          `This Google account is registered as ${actual}. You selected ${requested}. Please go back and pick the ${actual} role.`,
        );
        return;
      }
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Google sign-in failed. Please try again.';
      console.warn('[GoogleAuthButton] error:', msg, err?.response?.data);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  };

  const label = mode === 'signup' ? 'Sign up with Google' : 'Continue with Google';

  return (
    <TouchableOpacity
      style={[styles.button, (disabled || busy) && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={disabled || busy}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>
        <Image
          source={{
            uri: 'https://developers.google.com/identity/images/g-logo.png',
          }}
          style={styles.icon}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
      {busy ? (
        <ActivityIndicator size="small" color="#3c4043" style={styles.spinner} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  icon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3c4043',
    letterSpacing: 0.2,
  },
  spinner: {
    marginLeft: 10,
  },
});

export default GoogleAuthButton;
