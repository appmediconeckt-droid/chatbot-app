/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, StatusBar, StyleSheet, Text as RNText, TextInput, useColorScheme, View } from 'react-native';
import Text from './src/components/TranslatedText';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserSignup from './src/screens/auth/UserSignup';
import Landing from "./src/screens/auth/Landing";
import Login from "./src/screens/auth/Login"
import CounselorSignup from './src/screens/auth/CounselorSignup';
import RoleSelector from "./src/screens/auth/RoleSelector";
import UserOnboarding from './src/screens/auth/UserOnboarding';
import CounselorOnboarding from './src/screens/auth/CounselorOnboarding';
import OTPVerification from "./src/screens/auth/OTPVerification";
import LocationGate from "./src/screens/auth/LocationGate";
import ForgotPasswordScreen from "./src/screens/auth/ForgotPasswordScreen";
import ForgotPasswordOTPScreen from "./src/screens/auth/ForgotPasswordOTPScreen";
import ResetPasswordScreen from "./src/screens/auth/ResetPasswordScreen";

import UserDashboard from './src/screens/user/Component/UserDashboard/Dashboard/UserDashboard';
import ChatBox from './src/screens/user/Component/UserDashboard/Tab/ChatBox/ChatBox';
import CounselorTable from './src/screens/user/Component/UserDashboard/Tab/Counselor/CounselorDirectory';
import CheckoutPage from './src/screens/user/Component/UserDashboard/Tab/Wallet/CheckoutPage';
import TransactionsHistory from './src/screens/user/Component/UserDashboard/Tab/Wallet/TransactionsHistory';
import AppLockSettings from './src/screens/user/Component/UserDashboard/Tab/AppLockSettings';
import { ToastProvider } from './src/components/common/ToastProvider';

// Counselor Dashboard Screens
import CounselorDashboard from './src/screens/user/Component/counselor-dashboard/Dashboard/dashboard';
import SMSInput from './src/screens/user/Component/counselor-dashboard/Tab/SMSInput/SMSInput';
import ChangePassword from './src/screens/account/ChangePassword';
import SetPassword from './src/screens/account/SetPassword';
import SetPasswordByOtp from './src/screens/account/SetPasswordByOtp';
import safeVibrate from './src/utils/safeVibrate';
import socketService from './src/services/socketService';
import { CallProvider } from './src/screens/user/VideoCall/CallProvider';
import GlobalIncomingCallController from './src/screens/user/VideoCall/GlobalIncomingCallController';
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
// Define your navigation param list
// import { LogBox } from 'react-native';
// LogBox.ignoreAllLogs(true);

export type RootStackParamList = {
  Landing: undefined;
  UserSignup: { role?: 'user' | 'counselor' } | undefined;
  RoleSelector: undefined;
  UserOnboarding: { destination?: 'UserSignup'; destinationParams?: { role?: 'user' } } | undefined;
  CounselorOnboarding: { destination?: 'CounselorSignup'; destinationParams?: { role?: 'counselor' } } | undefined;
  Login: { role?: 'user' | 'counselor' } | undefined;
  CounselorSignup: { role?: 'user' | 'counselor' } | undefined;
  OTPVerification: undefined;
  LocationGate: { destination: keyof RootStackParamList; destinationParams?: object };
  UserDashboard: undefined;
  ChatBox: { chatId?: string } | undefined;
  CounselorTable: undefined;
  CounselorDashboard: {
    initialTab?: 'profile';
    profileStartEditing?: boolean;
    profileIntentAt?: number;
  } | undefined;
  SMSInput: undefined;
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



function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [bootRoute, setBootRoute] = useState<keyof RootStackParamList>('Landing');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  // Shared module-level ref (see src/navigationRef) so the axios interceptor can
  // reset to Login when the backend kills this device's session.
  const routeNameRef = useRef<string | undefined>(undefined);
  const backgroundedAt = useRef<number | null>(null);




  useEffect(() => {
    const normalizeRole = (role: string | null) => {
      const value = String(role || '').trim().toLowerCase();
      if (!value) return '';
      return value === 'counsellor' ? 'counselor' : value;
    };

    const bootstrapSessionRoute = async () => {
      try {
        const [accessToken, token, storedUserRole, userDataRaw, counsellorId, counselorId, storedPin, pendingCallRaw] = await Promise.all([
          AsyncStorage.getItem('accessToken'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('userData'),
          AsyncStorage.getItem('counsellorId'),
          AsyncStorage.getItem('counselorId'),
          AsyncStorage.getItem(PIN_STORAGE_KEY),
          AsyncStorage.getItem(PENDING_INCOMING_CALL_PUSH_KEY),
        ]);

        let hasFreshIncomingCall = false;
        if (pendingCallRaw) {
          try {
            const pendingCall = JSON.parse(pendingCallRaw);
            hasFreshIncomingCall = Boolean(
              pendingCall?.callId &&
              Date.now() - Number(pendingCall?.receivedAt || 0) < 90000,
            );
          } catch {}
        }

        const hasToken = Boolean(accessToken || token);
        if (!hasToken) {
          setBootRoute('Landing');
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

        let role = normalizeRole(storedUserRole);

        if (!role && userDataRaw) {
          try {
            const userData = JSON.parse(userDataRaw);
            role = normalizeRole(userData?.role || '');
          } catch (error) {
            console.warn('Failed to parse userData for startup role restore', error);
          }
        }

        if (!role && (counsellorId || counselorId)) {
          role = 'counselor';
        }

        if (role === 'counselor' || role === 'user') {
          const destination = role === 'counselor' ? 'CounselorDashboard' : 'UserDashboard';

          // Location is requested ONLY during login/registration — never on a
          // plain app reload. A returning session goes straight to its
          // dashboard (App Lock, if a PIN exists, is handled above via
          // setIsLocked). This stops the location page re-appearing every boot.
          setBootRoute(destination);
        } else {
          setBootRoute('Landing');
        }
      } catch (error) {
        console.warn('Session bootstrap failed, opening Landing', error);
        setBootRoute('Landing');
      } finally {
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
          const pendingCallRaw = await AsyncStorage.getItem(
            PENDING_INCOMING_CALL_PUSH_KEY,
          );
          let hasFreshIncomingCall = false;
          if (pendingCallRaw) {
            try {
              const pendingCall = JSON.parse(pendingCallRaw);
              hasFreshIncomingCall = Boolean(
                pendingCall?.callId &&
                Date.now() - Number(pendingCall?.receivedAt || 0) < 90000,
              );
            } catch {}
          }

          if (hasFreshIncomingCall) {
            setIsLocked(false);
            const storedRole = String(
              (await AsyncStorage.getItem('userRole')) || '',
            ).toLowerCase();
            const callDashboard = /counsell?or/.test(storedRole)
              ? 'CounselorDashboard'
              : 'UserDashboard';
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
          {isBootstrapping ? (
            <View style={styles.bootScreen}>
              <View style={styles.bootGlowTop} />
              <View style={styles.bootGlowBottom} />
              <View style={styles.bootCard}>
                <View style={styles.bootLogoWrap}>
                  <Image
                    source={require('./src/image/Humaeli-original-backup.png')}
                    style={styles.bootLogoImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.bootLoaderRow}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.bootLoaderText}>Preparing dashboard</Text>
                </View>
              </View>
            </View>
          ) : (
          <ToastProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
            void checkInitialNotification(navigationRef);
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
            <Stack.Screen name="Landing" component={Landing} />
            <Stack.Screen name="RoleSelector" component={RoleSelector} />
            <Stack.Screen name="UserOnboarding" component={UserOnboarding as React.ComponentType<any>} options={{ headerShown: false }} />
            <Stack.Screen name="CounselorOnboarding" component={CounselorOnboarding as React.ComponentType<any>} options={{ headerShown: false }} />
            <Stack.Screen name="UserSignup" component={UserSignup} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ForgotPasswordOTP" component={ForgotPasswordOTPScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name='CounselorSignup' component={CounselorSignup} />
              <Stack.Screen name='OTPVerification' component={OTPVerification} />
            <Stack.Screen
              name="LocationGate"
              component={LocationGate}
              initialParams={{ destination: 'UserDashboard' }}
            />
            <Stack.Screen name="UserDashboard" component={UserDashboard} />
             <Stack.Screen name='ChatBox' component={ChatBox} />
              <Stack.Screen name='CounselorTable' component={CounselorTable} />
              <Stack.Screen name='CheckoutPage' component={CheckoutPage} />
              <Stack.Screen name='TransactionsHistory' component={TransactionsHistory} />
              <Stack.Screen name='AppLockSettings' component={AppLockSettings} />
               <Stack.Screen name='CounselorDashboard' component={CounselorDashboard} />
                <Stack.Screen name='SMSInput' component={SMSInput} />
                <Stack.Screen name='ChangePassword' component={ChangePassword} />
                <Stack.Screen name='SetPassword' component={SetPassword} />
                <Stack.Screen name='SetPasswordByOtp' component={SetPasswordByOtp} />
                <Stack.Screen
                  name='PinSetup'
                  component={PinSetupScreen}
                  initialParams={{ forced: false }}
                />
          </Stack.Navigator>
        </NavigationContainer>

        {/* ── App Lock overlay — renders above everything ── */}
        {isLocked && !isBootstrapping && (
          <AppLockScreen onSuccess={() => setIsLocked(false)} />
        )}
        <GlobalIncomingCallController />
          </ToastProvider>
          )}
        </CallProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bootGlowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#dbeafe',
  },
  bootGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#e0e7ff',
  },
  bootCard: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
  bootLogoWrap: {
    width: '100%',
    maxWidth: 240,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  bootLogoImage: {
    width: '100%',
    height: '100%',
  },
  bootTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bootSubtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  bootLoaderRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bootLoaderText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default App;
