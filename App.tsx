/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UserSignup from './src/screens/auth/UserSignup';
// import Landing from "./src/screens/auth/Landing";
import Login from "./src/screens/auth/Login"
import CounselorSignup from './src/screens/auth/CounselorSignup';
import RoleSelector from "./src/screens/auth/RoleSelector";
import OTPVerification from "./src/screens/auth/OTPVerification";

import UserDashboard from './src/screens/user/Component/UserDashboard/Dashboard/UserDashboard';
import ChatBox from './src/screens/user/Component/UserDashboard/Tab/ChatBox/ChatBox';
import CounselorTable from './src/screens/user/Component/UserDashboard/Tab/Counselor/CounselorDirectory';
import { ToastProvider } from './src/components/common/ToastProvider';

// Counselor Dashboard Screens
import CounselorDashboard from './src/screens/user/Component/counselor-dashboard/Dashboard/dashboard';
import SMSInput from './src/screens/user/Component/counselor-dashboard/Tab/SMSInput/SMSInput';
import safeVibrate from './src/utils/safeVibrate';
// Define your navigation param list
// import { LogBox } from 'react-native';
// LogBox.ignoreAllLogs(true);

export type RootStackParamList = {
  Landing: undefined;
  UserSignup: { role?: 'user' | 'counselor' } | undefined;
  RoleSelector: undefined;
  Login: { role?: 'user' | 'counselor' } | undefined;
  CounselorSignup: { role?: 'user' | 'counselor' } | undefined;
  OTPVerification: undefined;
  UserDashboard: undefined;
  ChatBox: undefined;
  CounselorTable: undefined;
  CounselorDashboard: undefined;
  SMSInput: undefined;
  // Add other screens
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [bootRoute, setBootRoute] = useState<keyof RootStackParamList>('RoleSelector');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const normalizeRole = (role: string | null) => {
      const value = String(role || '').trim().toLowerCase();
      if (!value) return '';
      return value === 'counsellor' ? 'counselor' : value;
    };

    const bootstrapSessionRoute = async () => {
      try {
        const [accessToken, token, storedUserRole, userDataRaw, counsellorId, counselorId] = await Promise.all([
          AsyncStorage.getItem('accessToken'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('userData'),
          AsyncStorage.getItem('counsellorId'),
          AsyncStorage.getItem('counselorId'),
        ]);

        const hasToken = Boolean(accessToken || token);
        if (!hasToken) {
          setBootRoute('RoleSelector');
          return;
        }

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

        if (role === 'counselor') {
          setBootRoute('CounselorDashboard');
        } else if (role === 'user') {
          setBootRoute('UserDashboard');
        } else {
          setBootRoute('RoleSelector');
        }
      } catch (error) {
        console.warn('Session bootstrap failed, opening RoleSelector', error);
        setBootRoute('RoleSelector');
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrapSessionRoute();
  }, []);

  if (isBootstrapping) {
    return (
      <SafeAreaProvider>
        <View style={styles.bootScreen}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={styles.bootGlowTop} />
          <View style={styles.bootGlowBottom} />
          <View style={styles.bootCard}>
            <View style={styles.bootLogoWrap}>
              <Image
                source={require('./src/image/Mediconect Logo-3.png')}
                style={styles.bootLogoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.bootTitle}>Mediconect Chatbot</Text>
            <Text style={styles.bootSubtitle}>Inspire, Engage, Connect Online.</Text>
            <View style={styles.bootLoaderRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.bootLoaderText}>Preparing dashboard</Text>
            </View>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ToastProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
          }}
          onStateChange={() => {
            const previousRouteName = routeNameRef.current;
            const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

            if (previousRouteName && currentRouteName && previousRouteName !== currentRouteName) {
              safeVibrate(20);
            }

            routeNameRef.current = currentRouteName;
          }}
        >
          <Stack.Navigator
            initialRouteName={bootRoute}
            screenOptions={{
              headerShown: false,
            }}
          >
            {/* <Stack.Screen name="Landing" component={Landing} /> */}
            <Stack.Screen name="UserSignup" component={UserSignup} />
            <Stack.Screen name="RoleSelector" component={RoleSelector} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name='CounselorSignup' component={CounselorSignup} />
              <Stack.Screen name='OTPVerification' component={OTPVerification} />
            <Stack.Screen name="UserDashboard" component={UserDashboard} />
             <Stack.Screen name='ChatBox' component={ChatBox} />
              <Stack.Screen name='CounselorTable' component={CounselorTable} />
               <Stack.Screen name='CounselorDashboard' component={CounselorDashboard} />
                <Stack.Screen name='SMSInput' component={SMSInput} />
          </Stack.Navigator>
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
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
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bootLogoImage: {
    width: 62,
    height: 62,
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
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bootLoaderText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
});

export default App;

