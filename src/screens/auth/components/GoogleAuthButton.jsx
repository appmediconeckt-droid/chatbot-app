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
  TouchableOpacity,
  View,
} from 'react-native';
import Text from '../../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../../axiosConfig';
import { GOOGLE_WEB_CLIENT_ID } from '../../../config';
import { sendLocationSilently } from '../../../utils/locationHelper';
import socketService from '../../../services/socketService';
import { syncPushNotificationToken } from '../../../services/notificationService';
import {
  isCounselorLikeRole,
  resolveAuthRole,
  routeForAuthRole,
} from '../resolveAuthRole';

let GoogleSigninModule = null;
let StatusCodesModule = null;
try {
  // Lazy-require so the screen doesn't crash if the native module isn't
  // linked yet (e.g. before `npm install` + rebuild).
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
  role === 'counselor' || role === 'doctor' ? 'counsellor' : role;

const getRoleLabel = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === 'doctor') return 'Doctor';
  return normalized === 'counselor' ? 'Consultant' : 'User';
};

const buildRoleMismatchMessage = ({ actualRole, requestedRole, fallbackMessage }) => {
  if (!actualRole && !requestedRole) {
    return fallbackMessage || 'Role mismatch. Please select the correct login role.';
  }

  const actualLabel = getRoleLabel(actualRole);
  const requestedLabel = requestedRole ? getRoleLabel(requestedRole) : 'another';
  return `Role mismatch: this Google account is registered as ${actualLabel}, but you selected ${requestedLabel} login. Please go back and select ${actualLabel} login.`;
};

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
  // 'auto' = common Login screen: backend resolves the account's real role
  // from the DB and refuses to create unregistered accounts.
  role,
  accountRole, // 'doctor' | 'counselor' | 'user' — stored on Google signup
  mode = 'signin', // 'signin' | 'signup'
  onSuccess,
  onConflict,
  onNotRegistered,
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

  // Backend sometimes returns 200 { success:false, message:"..." } for
  // "user not registered" rather than a 4xx. Treat that as an error so the
  // UI shows the message instead of half-logging-in.
  const postGoogleAuth = async (idToken, roleToTry) => {
    console.log(
      '[GoogleAuthButton] POST /api/auth/google role=',
      mapRoleForBackend(roleToTry),
    );
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/google`,
      {
        idToken,
        role: mapRoleForBackend(roleToTry),
        accountRole: accountRole || roleToTry,
        intent: mode === 'signup' ? 'signup' : 'login',
      },
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
    if (data.success === false || !(data.accessToken || data.token)) {
      const msg =
        data.message ||
        'This Google account is not registered. Please sign up first.';
      const err = new Error(msg);
      err.response = { status: 400, data };
      throw err;
    }
    return data;
  };

  const isRoleMismatchError = (error) => {
    const responseData = error?.response?.data || {};
    return responseData?.code === 'ROLE_MISMATCH' || responseData?.roleMismatch === true;
  };

  const exchangeWithBackend = async (idToken) => {
    const isAuto = normalizeRole(role) === 'auto';
    const storedRole = isAuto
      ? 'auto'
      : normalizeRole(role) ||
        normalizeRole(await AsyncStorage.getItem('role')) ||
        'user';

    let data;
    try {
      data = await postGoogleAuth(idToken, storedRole);
    } catch (error) {
      // 'auto' only: an older backend doesn't understand 'auto' and treats
      // it as 'user', answering ROLE_MISMATCH with the account's real role.
      // Retry once with that DB role (same idToken, no second Google prompt).
      // Explicit roles are never retried — the mismatch must be shown.
      const actualRole = normalizeRole(error?.response?.data?.actualRole);
      if (isAuto && isRoleMismatchError(error) && actualRole) {
        data = await postGoogleAuth(idToken, actualRole);
      } else {
        throw error;
      }
    }

    const requestedAppRole = normalizeRole(accountRole || storedRole);
    const userRole = resolveAuthRole(
      { ...data, accountRole: data.accountRole || accountRole },
      isAuto ? 'user' : requestedAppRole,
    );
    if (!isAuto && requestedAppRole && requestedAppRole !== userRole) {
      const err = new Error(
        buildRoleMismatchMessage({
          actualRole: userRole,
          requestedRole: requestedAppRole,
        }),
      );
      err.response = {
        status: 403,
        data: {
          code: 'ROLE_MISMATCH',
          roleMismatch: true,
          actualRole: userRole,
          requestedRole: requestedAppRole,
        },
      };
      throw err;
    }
    const isCounselor = isCounselorLikeRole(userRole);

    const token = data.accessToken || data.token;
    if (token) {
      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('token', token);
    }
    if (data.refreshToken) {
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
    }

    await AsyncStorage.setItem('userRole', userRole);
    await AsyncStorage.setItem('userType', userRole);
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
    if (!isCounselor) {
      await AsyncStorage.multiRemove(['counsellorId', 'counselorId']);
    }

    await AsyncStorage.removeItem('role');

    syncPushNotificationToken().catch(error => {
      console.warn('[Push] Token sync after Google login failed:', error?.message || error);
    });

    if (!gateDriven) {
      sendLocationSilently(locationEvent);
    }
    socketService.connect().catch(() => {});

    onSuccess?.({
      isCounselor,
      user,
      profileCompleted: data.profileCompleted,
      isNewUser: data.isNewUser,
      role: userRole,
      destination: routeForAuthRole(userRole),
    });
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
      const responseData = err?.response?.data || {};
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
      if (responseData?.code === 'ROLE_MISMATCH' || responseData?.roleMismatch === true) {
        onError?.(
          buildRoleMismatchMessage({
            actualRole: responseData.actualRole,
            requestedRole: responseData.requestedRole,
            fallbackMessage: responseData.message,
          }),
        );
        return;
      }
      if (responseData?.code === 'ACCOUNT_NOT_FOUND') {
        const msg =
          responseData.message ||
          'No account found for this Google account. Please sign up first.';
        if (onNotRegistered) onNotRegistered({ email: responseData.email, message: msg });
        else onError?.(msg);
        return;
      }
      if (err?.response?.status === 409) {
        const conflictEmail = responseData?.email || '';
        onConflict?.({ email: conflictEmail });
        return;
      }
      if (err?.response?.status === 404) {
        onError?.(
          'Backend route /api/auth/google not found on this server. Deploy the Google login route on the backend first.',
        );
        return;
      }
      const msg =
        responseData?.message ||
        err?.message ||
        'Google sign-in failed. Please try again.';
      console.warn('[GoogleAuthButton] error:', msg, responseData);
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
