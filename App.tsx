/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  StatusBar,
  StyleSheet,
  Text as RNText,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
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
import HumaeliHeroVideo from './src/components/common/HumaeliHeroVideo';
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
const MIN_BOOT_SPLASH_MS = 1400;
const VIDEO_BACKGROUND_COLOR = '#04181B';

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
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  return value === 'counsellor' ? 'counselor' : value;
};

const routeForStoredRole = (role: string | null | undefined): keyof RootStackParamList | null => {
  const normalizedRole = normalizeStoredRole(role);
  if (normalizedRole === 'counselor') return 'CounselorDashboard';
  if (normalizedRole === 'user') return 'UserDashboard';
  return null;
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
  } catch (_) {
    await clearPendingIncomingCallStorage();
    return false;
  }
};

const BootSplash = () => {
  const { width, height } = useWindowDimensions();
  const isTinyPhone = height < 650 || width < 360;
  const isCompactPhone = height < 760;
  const heroTextWidth = Math.min(width - 44, 360);

  return (
    <View style={styles.bootScreen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.bootHeroMedia}>
        <HumaeliHeroVideo
          style={StyleSheet.absoluteFill}
          sourceName="mobile_hero_section_video"
          muted
          resizeMode="cover"
          focusX={0.5}
          focusY={0}
          zoomScale={1}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0, 0, 0, 0.26)', 'rgba(4, 24, 27, 0.08)', VIDEO_BACKGROUND_COLOR]}
          locations={[0, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.bootHeroPanel}>
        <View style={[styles.bootHeroContent, { width: heroTextWidth }]}>
          <RNText
            maxFontSizeMultiplier={1}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.bootHeroKicker, isTinyPhone ? styles.bootHeroKickerTiny : styles.bootHeroKickerRegular]}
          >
            HUMAELI - YOUR MENTAL WELLNESS
          </RNText>
          <RNText
            maxFontSizeMultiplier={1}
            style={[
              styles.bootHeroTitle,
              isTinyPhone
                ? styles.bootHeroTitleTiny
                : isCompactPhone
                  ? styles.bootHeroTitleCompact
                  : styles.bootHeroTitleRegular,
            ]}
          >
            Human Empowered{'\n'}Mental Wellness{'\n'}Support
          </RNText>
          <View style={styles.bootHeroDivider} />
          <RNText
            maxFontSizeMultiplier={1}
            style={[
              styles.bootHeroDescription,
              isTinyPhone
                ? styles.bootHeroDescriptionTiny
                : isCompactPhone
                  ? styles.bootHeroDescriptionCompact
                  : styles.bootHeroDescriptionRegular,
            ]}
          >
            In your difficult time of mental health to connect with consultants, psychologists,
            psychological wellness practitioners & psychiatrists
          </RNText>
          <View style={styles.bootLoaderRow}>
            <ActivityIndicator color="#24C184" size="small" />
            <RNText maxFontSizeMultiplier={1} style={styles.bootLoaderText}>Loading your dashboard</RNText>
          </View>
        </View>
      </View>
    </View>
  );
};



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
    const bootstrapSessionRoute = async () => {
      const startedAt = Date.now();
      let hasFreshIncomingCall = false;
      try {
        const [accessToken, token, storedUserRole, storedUserType, userDataRaw, counsellorId, counselorId, storedPin] = await Promise.all([
          AsyncStorage.getItem('accessToken'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('userType'),
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
        } else {
          setBootRoute('Landing');
        }
      } catch (error) {
        console.warn('Session bootstrap failed, opening Landing', error);
        setBootRoute('Landing');
      } finally {
        const elapsed = Date.now() - startedAt;
        const minSplashMs = hasFreshIncomingCall ? 0 : MIN_BOOT_SPLASH_MS;
        if (elapsed < minSplashMs) {
          await new Promise<void>((resolve) => setTimeout(resolve, minSplashMs - elapsed));
        }
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
          {isBootstrapping ? (
            <BootSplash />
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
    backgroundColor: VIDEO_BACKGROUND_COLOR,
    overflow: 'hidden',
  },
  bootHeroMedia: {
    flex: 0.58,
    minHeight: 330,
    overflow: 'hidden',
    backgroundColor: VIDEO_BACKGROUND_COLOR,
  },
  bootHeroPanel: {
    flex: 0.42,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 28,
    backgroundColor: VIDEO_BACKGROUND_COLOR,
  },
  bootHeroContent: {
    alignItems: 'center',
    maxWidth: 360,
  },
  bootHeroKicker: {
    color: '#F4FFF9',
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.34)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bootHeroKickerTiny: {
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 8,
  },
  bootHeroKickerRegular: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10,
  },
  bootHeroTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bootHeroTitleTiny: {
    fontSize: 30,
    lineHeight: 34,
  },
  bootHeroTitleCompact: {
    fontSize: 34,
    lineHeight: 39,
  },
  bootHeroTitleRegular: {
    fontSize: 38,
    lineHeight: 43,
  },
  bootHeroDivider: {
    width: 54,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#24C184',
    marginBottom: 18,
    marginTop: 17,
  },
  bootHeroDescription: {
    color: '#E6F5F0',
    fontWeight: '500',
    textAlign: 'center',
  },
  bootHeroDescriptionTiny: {
    fontSize: 12,
    lineHeight: 18,
  },
  bootHeroDescriptionCompact: {
    fontSize: 13,
    lineHeight: 20,
  },
  bootHeroDescriptionRegular: {
    fontSize: 15,
    lineHeight: 23,
  },
  bootLoaderRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bootLoaderText: {
    color: '#DDF7EF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default App;
