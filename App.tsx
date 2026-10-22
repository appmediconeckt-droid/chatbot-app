/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  StatusBar,
  Text as RNText,
  TextInput,
  useColorScheme,
} from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigationRef';
import { ResponsiveAppFrame } from './src/components/common/ResponsiveLayout';
import { isTokenExpired, startTokenExpiryWatcher } from './src/utils/tokenExpiry';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Landing from "./src/screens/auth/Landing";
import Login from "./src/screens/auth/Login"
import RoleSelector from "./src/screens/auth/RoleSelector";
import LocationGate from "./src/screens/auth/LocationGate";

import { ToastProvider } from './src/components/common/ToastProvider';

// Counselor Dashboard Screens

// Doctor screens (frontend-only — no Doctor backend yet)
import safeVibrate from './src/utils/safeVibrate';
import socketService from './src/services/socketService';
import { CallProvider } from './src/screens/user/VideoCall/CallProvider';
import GlobalIncomingCallController from './src/screens/user/VideoCall/GlobalIncomingCallController';
import HumaeliLogoSplash from './src/components/common/HumaeliLogoSplash';
import AppLockScreen, { PIN_STORAGE_KEY } from './src/screens/auth/AppLockScreen';
import PinSetupScreen from './src/screens/auth/PinSetupScreen';
import './src/i18n';
import { LanguageProvider } from './src/contexts/LanguageContext';
import {
  listenForTokenRefresh,
  listenForForegroundNotifications,
  listenForNotificationOpen,
  checkInitialNotification,
  PENDING_INCOMING_CALL_PUSH_KEY,
  requestNotificationPermission,
  syncPushNotificationToken,
} from './src/services/notificationService';
import {
  clearPendingIncomingCallStorage,
  isFreshIncomingCallPayload,
} from './src/services/callNotificationBridge';
import { normalizeRole, routeForRole } from './src/features/roles';
// Define your navigation param list
// import { LogBox } from 'react-native';
// LogBox.ignoreAllLogs(true);

export type RootStackParamList = {
  Landing: undefined;
  UserSignup: { role?: 'user' | 'counselor' } | undefined;
  RoleSelector: undefined;
  // Onboarding now runs AFTER signup for every role (see RoleSelector /
  // *Signup screens), so `destination` here points at what comes after the
  // tour — typically LocationGate or DoctorDashboard — not back
  // at the Signup screen itself.
  UserOnboarding: { destination?: keyof RootStackParamList; destinationParams?: object } | undefined;
  CounselorOnboarding: { destination?: keyof RootStackParamList; destinationParams?: object } | undefined;
  DoctorOnboarding: { destination?: keyof RootStackParamList; destinationParams?: object; doctorProfileBase?: object } | undefined;
  Login: { role?: 'user' | 'counselor' } | undefined;
  CounselorSignup: { role?: 'user' | 'counselor' } | undefined;
  DoctorSignup: { role?: 'doctor'; doctorProfileDraft?: object } | undefined;
  DoctorDashboard: undefined;
  StaffDashboard: undefined;
  OTPVerification: undefined;
  LocationGate: { destination: keyof RootStackParamList; destinationParams?: object };
  UserDashboard: undefined;
  ChatBox: { chatId?: string; chatMongoId?: string; counselor?: object; user?: object } | undefined;
  CounselorTable: undefined;
  CounselorDashboard: {
    initialTab?: 'profile';
    profileStartEditing?: boolean;
    profileIntentAt?: number;
  } | undefined;
  SMSInput: { chatId?: string; chatMongoId?: string; selectedUser?: object; chatData?: object } | undefined;
  ChangePassword: undefined;
  SetPassword: undefined;
  SetPasswordByOtp: undefined;
  PinSetup: { forced?: boolean; destination?: keyof RootStackParamList } | undefined;
  ForgotPassword: undefined;
  ForgotPasswordOTP: { email: string };
  ResetPassword: { email: string };
  CheckoutPage: { appointment?: object } | undefined;
  TransactionsHistory: undefined;
  AppLockSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Lock as soon as the user leaves the app and opens it again.
const LOCK_TIMEOUT_MS = 0;
// How long the logo splash stays up at least, so it never just flashes by.
const MIN_LOGO_SPLASH_MS = 1000;

// ─── Popups must reach the bottom of the screen ──────────────────────────────
// An Android Modal window stops above the navigation bar by default. This app
// draws its own bottom tab bar down there, so every popup left a visible strip
// of the dashboard below it. navigationBarTranslucent lets the modal window
// extend over that area; React Native requires statusBarTranslucent with it.
//
// Set as defaults so all ~59 modals get it. Modal is a class component, so
// defaultProps is still honoured in React 19 (only function components lost it).
// Merged, not replaced: Modal already ships `visible` and `hardwareAccelerated`.
const ModalWithDefaults = Modal as typeof Modal & { defaultProps?: Record<string, unknown> };
ModalWithDefaults.defaultProps = {
  ...(ModalWithDefaults.defaultProps || {}),
  statusBarTranslucent: true,
  navigationBarTranslucent: true,
};

// ─── Uniform text sizing across devices ──────────────────────────────────────
// Android's display "Font size" setting scales every Text/TextInput; at the
// largest setting labels grow ~1.3x and overflow this app's fixed-height rows.
// Capping keeps large-text devices readable without the layout changing shape.
const MAX_FONT_SCALE = 1.2;
const withFontCap = (Component: any) => {
  Component.defaultProps = Component.defaultProps || {};
  if (Component.defaultProps.maxFontSizeMultiplier === undefined) {
    Component.defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;
  }
};
withFontCap(RNText);
withFontCap(TextInput);

const normalizeStoredRole = (role: string | null | undefined) => {
  return normalizeRole(role);
};

const routeForStoredRole = (role: string | null | undefined): keyof RootStackParamList | null => {
  return routeForRole(role) as keyof RootStackParamList | null;
};

const hasFreshPendingIncomingCall = async () => {
  const pendingCallRaw = await AsyncStorage.getItem(PENDING_INCOMING_CALL_PUSH_KEY);
  if (!pendingCallRaw) return false;

  try {
    const pendingCall = JSON.parse(pendingCallRaw);
    const isFresh = isFreshIncomingCallPayload(pendingCall);
    if (!isFresh) {
      await clearPendingIncomingCallStorage();
    }
    return isFresh;
  } catch {
    await clearPendingIncomingCallStorage();
    return false;
  }
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [bootRoute, setBootRoute] = useState<keyof RootStackParamList>('Landing');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // The animated logo splash covers start-up and fades out once the route is
  // known; an incoming call skips its minimum time so the call shows at once.
  const [logoSplashVisible, setLogoSplashVisible] = useState(true);
  const [skipSplashDelay, setSkipSplashDelay] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  // Shared module-level ref (see src/navigationRef) so the axios interceptor can
  // reset to Login when the backend kills this device's session.
  const routeNameRef = useRef<string | undefined>(undefined);
  const backgroundedAt = useRef<number | null>(null);




  useEffect(() => {
    const bootstrapSessionRoute = async () => {
      let hasFreshIncomingCall = false;
      try {
        const [
          accessToken,
          token,
          storedUserRole,
          storedUserType,
          isAuthenticated,
          userDataRaw,
          counsellorId,
          counselorId,
          storedPin,
        ] = await Promise.all([
          AsyncStorage.getItem('accessToken'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('userType'),
          AsyncStorage.getItem('isAuthenticated'),
          AsyncStorage.getItem('userData'),
          AsyncStorage.getItem('counsellorId'),
          AsyncStorage.getItem('counselorId'),
          AsyncStorage.getItem(PIN_STORAGE_KEY),
        ]);

        hasFreshIncomingCall = await hasFreshPendingIncomingCall();

        const hasToken = Boolean(accessToken || token);
        if (!hasToken) {
          setBootRoute('Landing');
          return;
        }

        // Expired session: don't open the dashboard. The expiry watcher started
        // in NavigationContainer.onReady clears it and moves to the login screen.
        if (isTokenExpired(accessToken || token)) {
          setBootRoute('RoleSelector');
          return;
        }

        // Show lock screen if the user has set up a PIN
        if (storedPin && !hasFreshIncomingCall) {
          setIsLocked(true);
        }

        // Establish the singleton presence socket so the backend marks this
        // user online as soon as the app boots (mirrors web — connect with
        // the auth token, backend flips isOnline=true on `connection`).
        socketService.connect().catch((err) => {
          console.warn('[App] socket connect failed at bootstrap:', err?.message);
        });

        let role = normalizeStoredRole(storedUserRole) || normalizeStoredRole(storedUserType);

        if (!role && userDataRaw) {
          try {
            const userData = JSON.parse(userDataRaw);
            role =
              normalizeStoredRole(userData?.role) ||
              normalizeStoredRole(userData?.userRole) ||
              normalizeStoredRole(userData?.userType) ||
              normalizeStoredRole(userData?.accountType) ||
              normalizeStoredRole(userData?.user?.role) ||
              normalizeStoredRole(userData?.data?.role) ||
              normalizeStoredRole(userData?.data?.user?.role);
          } catch (error) {
            console.warn('Failed to parse userData for startup role restore', error);
          }
        }

        if (!role && (counsellorId || counselorId)) {
          role = 'counselor';
        }

        const destination = routeForStoredRole(role);
        if (destination) {

          // Location is requested ONLY during login/registration — never on a
          // plain app reload. A returning session goes straight to its
          // dashboard (App Lock, if a PIN exists, is handled above via
          // setIsLocked). This stops the location page re-appearing every boot.
          setBootRoute(destination);
        } else if (String(isAuthenticated).toLowerCase() === 'true' || userDataRaw) {
          // Older builds could persist a token without userRole/userType. Treat
          // that as a returning session so the public Get Started page never
          // flashes for an already logged-in user.
          setBootRoute('UserDashboard');
        } else {
          setBootRoute('Landing');
        }
      } catch (error) {
        console.warn('Session bootstrap failed, opening Landing', error);
        setBootRoute('Landing');
      } finally {
        // The logo splash keeps itself up for its minimum time, so the
        // dashboard can start loading underneath it straight away.
        if (hasFreshIncomingCall) setSkipSplashDelay(true);
        setIsBootstrapping(false);
      }
    };

    bootstrapSessionRoute();
  }, []);


  

  // Re-lock when app returns from background after LOCK_TIMEOUT_MS
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active' && backgroundedAt.current !== null) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed >= LOCK_TIMEOUT_MS) {
          const hasFreshIncomingCall = await hasFreshPendingIncomingCall();

          if (hasFreshIncomingCall) {
            setIsLocked(false);
            const storedRole = String(
              (await AsyncStorage.getItem('userRole')) || '',
            ).toLowerCase();
            const callDashboard = routeForStoredRole(storedRole) || 'UserDashboard';
            if (navigationRef.isReady()) {
              navigationRef.navigate(callDashboard as never);
            }
            return;
          }
          const storedPin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
          if (storedPin) {
            setIsLocked(true);
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

useEffect(() => {
  let mounted = true;
  const unsubscribeForeground = listenForForegroundNotifications();
  const unsubscribeTokenRefresh = listenForTokenRefresh(null, null);
  const unsubscribeNotificationOpen = listenForNotificationOpen(navigationRef);

  (async () => {
    await requestNotificationPermission();
    if (mounted) {
      await syncPushNotificationToken();
    }
  })().catch(error => {
    console.warn('[Push] initialization failed:', error?.message || error);
  });

  return () => {
    mounted = false;
    unsubscribeForeground();
    unsubscribeTokenRefresh();
    unsubscribeNotificationOpen();
  };
}, []);


  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <LanguageProvider>
        <CallProvider>
          {isBootstrapping ? null : (
          <ToastProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
            void checkInitialNotification(navigationRef);
            startTokenExpiryWatcher();
          }}
          onStateChange={() => {
            const previousRouteName = routeNameRef.current;
            const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

            if (previousRouteName && currentRouteName && previousRouteName !== currentRouteName) {
              safeVibrate(20);
            }

            routeNameRef.current = currentRouteName;

            if (
              currentRouteName === 'LocationGate' ||
              currentRouteName === 'UserDashboard' ||
              currentRouteName === 'CounselorDashboard'
            ) {
              void syncPushNotificationToken();
            }
          }}
        >
          <ResponsiveAppFrame>
          <Stack.Navigator
            initialRouteName={bootRoute}
            screenOptions={{
              headerShown: false,
              // Swipe back to the previous screen. Android has no interactive
              // swipe in native-stack, but its system back gesture still pops
              // the stack, so behaviour matches on both platforms.
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: '#f8fafc' },
            }}
          >
            {/* Role screens load their code when first opened (getComponent), so the
                app start doesn't run every role's dashboard. */}
            <Stack.Screen name="Landing" component={Landing} />
            <Stack.Screen name="RoleSelector" component={RoleSelector} />
            <Stack.Screen name="UserOnboarding" getComponent={() => require('./src/screens/auth/UserOnboarding').default} options={{ headerShown: false }} />
            <Stack.Screen name="CounselorOnboarding" getComponent={() => require('./src/screens/auth/CounselorOnboarding').default} options={{ headerShown: false }} />
            <Stack.Screen name="DoctorOnboarding" getComponent={() => require('./src/screens/auth/DoctorOnboarding').default} options={{ headerShown: false }} />
            <Stack.Screen name="UserSignup" getComponent={() => require('./src/screens/auth/UserSignup').default} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="ForgotPassword" getComponent={() => require('./src/screens/auth/ForgotPasswordScreen').default} />
            <Stack.Screen name="ForgotPasswordOTP" getComponent={() => require('./src/screens/auth/ForgotPasswordOTPScreen').default} />
            <Stack.Screen name="ResetPassword" getComponent={() => require('./src/screens/auth/ResetPasswordScreen').default} />
            <Stack.Screen name='CounselorSignup' getComponent={() => require('./src/screens/auth/CounselorSignup').default} />
            <Stack.Screen name='DoctorSignup' getComponent={() => require('./src/screens/auth/DoctorSignup').default} />
            <Stack.Screen name='DoctorDashboard' getComponent={() => require('./src/features/doctor/screens/DoctorDashboard').default} />
            <Stack.Screen name='StaffDashboard' getComponent={() => require('./src/features/staff/screens/StaffDashboard').default} />
              <Stack.Screen name='OTPVerification' getComponent={() => require('./src/screens/auth/OTPVerification').default} />
            <Stack.Screen
              name="LocationGate"
              component={LocationGate}
              initialParams={{ destination: 'UserDashboard' }}
            />
            <Stack.Screen name="UserDashboard" getComponent={() => require('./src/features/patient/screens/UserDashboard').default} />
             <Stack.Screen name='ChatBox' getComponent={() => require('./src/features/patient/screens/ChatBox').default} />
              <Stack.Screen name='CounselorTable' getComponent={() => require('./src/features/patient/screens/CounselorDirectory').default} />
              <Stack.Screen name='CheckoutPage' getComponent={() => require('./src/features/patient/screens/CheckoutPage').default} />
              <Stack.Screen name='TransactionsHistory' getComponent={() => require('./src/features/patient/screens/TransactionsHistory').default} />
              <Stack.Screen name='AppLockSettings' getComponent={() => require('./src/features/patient/screens/AppLockSettings').default} />
               <Stack.Screen name='CounselorDashboard' getComponent={() => require('./src/features/counselor/screens/CounselorDashboard').default} />
                <Stack.Screen name='SMSInput' getComponent={() => require('./src/features/counselor/screens/SMSInput').default} />
                <Stack.Screen name='ChangePassword' getComponent={() => require('./src/screens/account/ChangePassword').default} />
                <Stack.Screen name='SetPassword' getComponent={() => require('./src/screens/account/SetPassword').default} />
                <Stack.Screen name='SetPasswordByOtp' getComponent={() => require('./src/screens/account/SetPasswordByOtp').default} />
                <Stack.Screen
                  name='PinSetup'
                  component={PinSetupScreen}
                  initialParams={{ forced: false }}
                />
          </Stack.Navigator>
          </ResponsiveAppFrame>
        </NavigationContainer>

        {/* ── App Lock overlay — renders above everything ── */}
        {isLocked && !isBootstrapping && (
          <AppLockScreen onSuccess={() => setIsLocked(false)} />
        )}
        <GlobalIncomingCallController />
          </ToastProvider>
          )}
          {logoSplashVisible && (
            <HumaeliLogoSplash
              done={!isBootstrapping}
              minMs={skipSplashDelay ? 0 : MIN_LOGO_SPLASH_MS}
              onHidden={() => setLogoSplashVisible(false)}
            />
          )}
        </CallProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

export default App;
