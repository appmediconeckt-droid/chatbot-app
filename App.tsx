/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
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

// Counselor Dashboard Screens
import CounselorDashboard from './src/screens/user/Component/counselor-dashboard/Dashboard/dashboard';
import SMSInput from './src/screens/user/Component/counselor-dashboard/Tab/SMSInput/SMSInput';
// Define your navigation param list
export type RootStackParamList = {
  Landing: undefined;
  UserSignup: undefined;
  UserDashboard: undefined;
  // Add other screens
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>  {/* ✅ Add NavigationContainer here */}
        <Stack.Navigator 
          initialRouteName="RoleSelector"
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
  container: {
    flex: 1,
  },
});

export default App;

