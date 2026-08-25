// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import {
  //   View,
  //   Text,
  //   TextInput,
  //   TouchableOpacity,
  //   StyleSheet,
  //   ScrollView,
  //   KeyboardAvoidingView,
  //   Platform,
  //   Modal,
  //   ActivityIndicator,
  //   SafeAreaView,
  //   StatusBar,
  //   Image,
  //   useWindowDimensions,
  //   Animated,
//,
// } from 'react-native';
// import Text from '../../components/TranslatedText';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import axios from 'axios';
// import { API_BASE_URL } from '../../axiosConfig';
// import LinearGradient from 'react-native-linear-gradient';
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// // Import logo
// import logo from '../../image/HumaeliIcon.png';
// import GoogleAuthButton from './components/GoogleAuthButton';
// import { sendLocationSilently } from '../../utils/locationHelper';
// import socketService from '../../services/socketService';

// const UserSignup = ({ navigation, route }) => {
//   const { width, height } = useWindowDimensions();
//   const [isLogin, setIsLogin] = useState(true);
//   const [focusedField, setFocusedField] = useState(null);
//   const [formData, setFormData] = useState({
//     email: '',
//     password: '',
//     fullName: '',
//     anonymous: '',
//     phoneNumber: '',
//     age: '',
//     gender: '',
//     confirmPassword: '',
//   });

//   // Animation values
//   const fadeAnim = useRef(new Animated.Value(0)).current;
//   const slideAnim = useRef(new Animated.Value(30)).current;
//   const orb1Anim = useRef(new Animated.Value(0)).current;
//   const orb2Anim = useRef(new Animated.Value(0)).current;
//   const particle1 = useRef(new Animated.Value(0)).current;
//   const particle2 = useRef(new Animated.Value(0)).current;
  
//   // Staggered field animations
//   const fieldAnims = useRef([...Array(15)].map(() => new Animated.Value(0))).current;

//   // UI States
//   const [errors, setErrors] = useState({});
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [notification, setNotification] = useState({ show: false, message: '', type: '' });

//   // Verification states
//   const [emailVerified, setEmailVerified] = useState(false);
//   const [phoneVerified, setPhoneVerified] = useState(false);
//   const [showOtpModal, setShowOtpModal] = useState({ show: false, type: '', value: '' });
//   const [otpCode, setOtpCode] = useState('');
//   const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
//   const [otpError, setOtpError] = useState('');

//   // Device Conflict States
//   const [showDeviceConflict, setShowDeviceConflict] = useState(false);
//   const [deviceOtp, setDeviceOtp] = useState('');
//   const [deviceOtpSent, setDeviceOtpSent] = useState(false);
//   const [isSendingDeviceOtp, setIsSendingDeviceOtp] = useState(false);
//   const [isVerifyingDeviceOtp, setIsVerifyingDeviceOtp] = useState(false);

//   const genderOptions = ['Male', 'Female', 'Other'];

//   useEffect(() => {
//     fadeAnim.setValue(0);
//     slideAnim.setValue(30);
//     fieldAnims.forEach(anim => anim.setValue(0));

//     Animated.parallel([
//       Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
//       Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true }),
//       Animated.stagger(40, fieldAnims.map(anim => 
//         Animated.spring(anim, { toValue: 1, tension: 25, friction: 8, useNativeDriver: true })
//       ))
//     ]).start();
//   }, [isLogin]);

//   useEffect(() => {
//     const createOrbLoop = (anim, toVal) => {
//       return Animated.loop(
//         Animated.sequence([
//           Animated.timing(anim, { toValue: toVal, duration: 10000, useNativeDriver: true }),
//           Animated.timing(anim, { toValue: 0, duration: 10000, useNativeDriver: true }),
//         ])
//       );
//     };
//     createOrbLoop(orb1Anim, 120).start();
//     createOrbLoop(orb2Anim, -100).start();
//     createOrbLoop(particle1, 200).start();
//     createOrbLoop(particle2, -150).start();
//   }, []);

//   const persistUserSession = async (data) => {
//     const token = data?.token || data?.accessToken || data?.data?.token;
//     if (!token) return false;

//     await AsyncStorage.setItem('token', token);
//     await AsyncStorage.setItem('accessToken', token);
//     await AsyncStorage.setItem('isAuthenticated', 'true');
//     await AsyncStorage.setItem('userType', 'user');
//     await AsyncStorage.setItem('userEmail', formData.email);

//     const role = data?.role || data?.user?.role || 'user';
//     await AsyncStorage.setItem('userRole', role);

//     if (data.user) {
//       await AsyncStorage.setItem('userData', JSON.stringify(data.user));
//       if (data.user._id) await AsyncStorage.setItem('userId', data.user._id);
//     }
//     sendLocationSilently('login');
//     socketService.connect().catch(() => {});
//     return true;
//   };

//   const validateSignup = () => {
//     const newErrors = {};
//     if (!formData.fullName) newErrors.fullName = "Full name is required";
//     if (!formData.anonymous) newErrors.anonymous = "Anonymous name is required";
//     if (!formData.email) newErrors.email = "Email is required";
//     else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
//     else if (!emailVerified) newErrors.email = "Please verify your email first";

//     if (!formData.phoneNumber) newErrors.phoneNumber = "Phone number is required";
//     else if (!/^\d{10}$/.test(formData.phoneNumber)) newErrors.phoneNumber = "Phone number must be 10 digits";
//     else if (!phoneVerified) newErrors.phoneNumber = "Please verify your phone first";

//     if (!formData.age) newErrors.age = "Age is required";
//     else if (formData.age < 13 || formData.age > 120) newErrors.age = "Age must be between 13 and 120";

//     if (!formData.gender) newErrors.gender = "Gender is required";
//     if (!formData.password) newErrors.password = "Password is required";
//     else if (formData.password.length < 3) newErrors.password = "Password must be at least 3 chars";

//     if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    
//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleLogin = async () => {
//     try {
//       setIsLoading(true);
//       const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
//         email: formData.email,
//         password: formData.password,
//         role: 'user',
//       });
//       if (await persistUserSession(response.data)) {
//         showNotification('Login successful!');
//         setTimeout(() => navigation.replace('UserOnboarding'), 1000);
//       }
//     } catch (err) {
//       if (err?.response?.status === 409) {
//         setShowDeviceConflict(true);
//         showNotification('Session active on another device', 'info');
//       } else {
//         showNotification(err?.response?.data?.message || 'Login failed', 'error');
//       }
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSignup = async () => {
//     if (!validateSignup()) {
//       showNotification('Please correct the errors', 'error');
//       return;
//     }
//     try {
//       setIsLoading(true);
//       const signupData = {
//         fullName: formData.fullName,
//         email: formData.email,
//         anonymous: formData.anonymous,
//         phoneNum: formData.phoneNumber,
//         password: formData.password,
//         confirmPassword: formData.confirmPassword,
//         age: parseInt(formData.age),
//         gender: formData.gender,
//         role: "user",
//         isEmailVerified: true,
//         isPhoneVerified: true,
//       };
//       const response = await axios.post(`${API_BASE_URL}/api/auth/complete-registration`, signupData);
//       if (response.data.success && await persistUserSession(response.data)) {
//         showNotification('Account created successfully!');
//         setTimeout(() => navigation.replace('UserOnboarding'), 1500);
//       }
//     } catch (error) {
//       showNotification(error.response?.data?.message || 'Registration failed', 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSendVerifyOtp = async (type) => {
//     const value = type === 'email' ? formData.email : formData.phoneNumber;
//     if (!value) {
//       showNotification(`Please enter ${type} first`, 'error');
//       return;
//     }
//     try {
//       setIsLoading(true);
//       const endpoint = type === 'email' ? 'send-email-otp' : 'send-phone-otp';
//       const payload = type === 'email' ? { email: value } : { phoneNumber: `+${value}`, email: formData.email };
//       const response = await axios.post(`${API_BASE_URL}/api/auth/${endpoint}`, payload);
//       if (response.data.success) {
//         setShowOtpModal({ show: true, type, value });
//         showNotification(`OTP sent to ${type}`);
//       }
//     } catch (err) {
//       showNotification(err.response?.data?.message || 'Failed to send OTP', 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleVerifyOtp = async () => {
//     if (otpCode.length !== 6) {
//       setOtpError('Enter 6 digit code');
//       return;
//     }
//     try {
//       setIsVerifyingOtp(true);
//       const type = showOtpModal.type;
//       const endpoint = type === 'email' ? 'verify-email-otp' : 'verify-phone-otp';
//       const payload = type === 'email' 
//         ? { email: formData.email, otp: otpCode } 
//         : { phoneNumber: `+${formData.phoneNumber}`, otp: otpCode, email: formData.email };
      
//       const response = await axios.post(`${API_BASE_URL}/api/auth/${endpoint}`, payload);
//       if (response.data.success) {
//         if (type === 'email') setEmailVerified(true);
//         else setPhoneVerified(true);
//         setShowOtpModal({ show: false, type: '', value: '' });
//         setOtpCode('');
//         showNotification(`${type} verified successfully!`);
//       }
//     } catch (err) {
//       setOtpError(err.response?.data?.message || 'Verification failed');
//     } finally {
//       setIsVerifyingOtp(false);
//     }
//   };

//   const handleForgotPassword = async () => {
//     if (!formData.email) {
//       showNotification('Please enter email address', 'error');
//       return;
//     }
//     try {
//       setIsLoading(true);
//       await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: formData.email });
//       showNotification('Reset link sent to your email');
//     } catch (err) {
//       showNotification(err.response?.data?.message || 'Failed to send reset link', 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSendDeviceOtp = async () => {
//     try {
//       setIsSendingDeviceOtp(true);
//       await axios.post(`${API_BASE_URL}/api/auth/logout-other-devices`, { email: formData.email, role: 'user' });
//       setDeviceOtpSent(true);
//       showNotification('OTP sent to your email');
//     } catch (err) {
//       showNotification('Failed to send OTP', 'error');
//     } finally {
//       setIsSendingDeviceOtp(false);
//     }
//   };

//   const handleVerifyDeviceOtp = async () => {
//     try {
//       setIsVerifyingDeviceOtp(true);
//       const response = await axios.post(`${API_BASE_URL}/api/auth/verify-login-otp`, {
//         email: formData.email,
//         otp: deviceOtp,
//         logoutOthers: true,
//         role: 'user'
//       });
//       if (await persistUserSession(response.data)) {
//         setShowDeviceConflict(false);
//         navigation.replace('UserOnboarding');
//       }
//     } catch (err) {
//       showNotification('Invalid OTP', 'error');
//     } finally {
//       setIsVerifyingDeviceOtp(false);
//     }
//   };

//   const showNotification = (message, type = 'success') => {
//     setNotification({ show: true, message, type });
//     setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
//   };

//   const handleChange = useCallback((name, value) => {
//     setFormData(prev => ({ ...prev, [name]: value }));
//     if (name === 'email') setEmailVerified(false);
//     if (name === 'phoneNumber') setPhoneVerified(false);
//   }, []);

//   const renderInput = (index, name, icon, placeholder, options = {}, verifyType = null) => {
//     const isFocused = focusedField === name;
//     const isVerified = (verifyType === 'email' && emailVerified) || (verifyType === 'phone' && phoneVerified);
    
//     return (
//       <Animated.View key={`input-${name}`} style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
//         <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
//           <Icon name={icon} size={20} color={isFocused ? '#00652C' : '#64748b'} style={styles.inputIcon} />
//           <TextInput
//             style={styles.textInput}
//             value={formData[name]}
//             onChangeText={(text) => handleChange(name, text)}
//             onFocus={() => setFocusedField(name)}
//             onBlur={() => setFocusedField(null)}
//             placeholder={placeholder}
//             placeholderTextColor="#94a3b8"
//             {...options}
//           />
//           {verifyType && !isLogin && (
//             <TouchableOpacity 
//               onPress={() => handleSendVerifyOtp(verifyType)} 
//               disabled={isVerified}
//               style={[styles.verifyBtn, isVerified && styles.verifiedBtn]}
//             >
//               {isVerified ? (
//                 <Icon name="check-decagram" size={18} color="#10b981" />
//               ) : (
//                 <Text style={styles.verifyBtnText}>{t('Verify')}</Text>
//               )}
//             </TouchableOpacity>
//           )}
//         </View>
//         {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
//       </Animated.View>
//     );
//   };

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
//       <LinearGradient colors={['#0f172a', '#1e293b', '#000000']} style={styles.gradient}>
//         <Animated.View style={[styles.lavaOrb, styles.orb1, { transform: [{ translateY: orb1Anim }] }]} />
//         <Animated.View style={[styles.lavaOrb, styles.orb2, { transform: [{ translateY: orb2Anim }] }]} />

//         <SafeAreaView style={styles.safeArea}>
//           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={styles.flex}>
//             <TouchableOpacity style={styles.backBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('RoleSelector'))}>
//               <Icon name="chevron-left" size={28} color="#ffffff" />
//             </TouchableOpacity>

//             <ScrollView contentContainerStyle={[styles.scrollContent, isLogin && { paddingTop: height * 0.13 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
//               <Animated.View style={[styles.panel, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
//                 <View style={styles.header}>
//                   <View style={styles.logoBadge}><Image source={logo} style={styles.logo} resizeMode="contain" /></View>
//                   <View style={styles.brandContainer}><Text style={[styles.brandMain, { color: '#00652C' }]}>{t('Humaeli')}</Text></View>
//                   <Text style={styles.tagline}>{'Begin your journey'}</Text>
//                 </View>

//                 <View style={styles.formPanel}>
//                   {!isLogin && (
//                     <>{renderInput(0, 'fullName', 'account-outline', 'Full Name')}{renderInput(1, 'anonymous', 'incognito-circle', 'Anonymous Name')}</>
//                   )}
//                   {renderInput(2, 'email', 'email-outline', 'Email Address', { keyboardType: 'email-address', autoCapitalize: 'none' }, 'email')}
//                   {!isLogin && (
//                     <>{renderInput(3, 'phoneNumber', 'phone-outline', 'Phone Number', { keyboardType: 'phone-pad', maxLength: 10 }, 'phone')}{renderInput(4, 'age', 'calendar-account-outline', 'Age', { keyboardType: 'numeric' })}
//                       <Animated.View style={[styles.genderRow, { opacity: fieldAnims[5] }]}>
//                         {genderOptions.map(g => (
//                           <TouchableOpacity key={g} style={[styles.genderBtn, formData.gender === g && styles.genderBtnSelected]} onPress={() => handleChange('gender', g)}>
//                             <Text style={[styles.genderText, formData.gender === g && styles.genderTextSelected]}>{g}</Text>
//                           </TouchableOpacity>
//                         ))}
//                       </Animated.View>
//                     </>
//                   )}
//                   <Animated.View key="pwd-row" style={{ opacity: fieldAnims[6] }}>
//                     <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
//                       <Icon name="lock-outline" size={20} color={focusedField === 'password' ? '#00652C' : '#64748b'} style={styles.inputIcon} />
//                       <TextInput style={styles.textInput} value={formData.password} onChangeText={(text) => handleChange('password', text)} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} placeholder={t('Password')} placeholderTextColor="#94a3b8" secureTextEntry={!showPassword} />
//                       <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></TouchableOpacity>
//                     </View>
//                   </Animated.View>
//                   {isLogin && (
//                     <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}>
//                       <Text style={styles.forgotText}>{t('Forgot password?')}</Text>
//                     </TouchableOpacity>
//                   )}
//                   {!isLogin && (
//                     <Animated.View key="cpwd-row" style={{ opacity: fieldAnims[7] }}>
//                       <View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused]}>
//                         <Icon name="lock-check-outline" size={20} color={focusedField === 'confirmPassword' ? '#00652C' : '#64748b'} style={styles.inputIcon} />
//                         <TextInput style={styles.textInput} value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} onFocus={() => setFocusedField('confirmPassword')} onBlur={() => setFocusedField(null)} placeholder={t('Confirm Password')} placeholderTextColor="#94a3b8" secureTextEntry={!showConfirmPassword} />
//                         <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Icon name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></TouchableOpacity>
//                       </View>
//                     </Animated.View>
//                   )}
//                   <Animated.View key="submit-row" style={{ opacity: fieldAnims[8], marginTop: 10 }}>
//                     <TouchableOpacity style={styles.submitBtn} onPress={isLogin ? handleLogin : handleSignup} disabled={isLoading}>
//                       {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{isLogin ? 'Login' : 'Join Now'}</Text>}
//                     </TouchableOpacity>
//                   </Animated.View>
//                   <Animated.View key="google-row" style={{ opacity: fieldAnims[8], marginTop: 14 }}>
//                     <View style={styles.googleDividerRow}>
//                       <View style={styles.googleDividerLine} />
//                       <Text style={styles.googleDividerText}>or</Text>
//                       <View style={styles.googleDividerLine} />
//                     </View>
//                     <GoogleAuthButton
//                       role="user"
//                       mode={isLogin ? 'signin' : 'signup'}
//                       disabled={isLoading}
//                       locationEvent={isLogin ? 'login' : 'signup'}
//                       onSuccess={({ isCounselor }) => {
//                         sendLocationSilently(isLogin ? 'login' : 'signup');
//                         setTimeout(() => {
//                           navigation.replace(
//                             isCounselor ? 'CounselorDashboard' : 'UserDashboard',
//                           );
//                         }, 600);
//                       }}
//                       onError={(msg) => {
//                         setOtpError(msg);
//                         setTimeout(() => setOtpError(''), 4000);
//                       }}
//                     />
//                   </Animated.View>
//                   <Animated.View key="switch-row" style={[styles.switchRow, { opacity: fieldAnims[9] }]}>
//                     <Text style={styles.switchText}>{isLogin ? "New here?" : "Already joined?"}</Text>
//                     <TouchableOpacity onPress={() => setIsLogin(!isLogin)}><Text style={styles.switchLink}>{isLogin ? " Create Account" : " Login"}</Text></TouchableOpacity>
//                   </Animated.View>
//                 </View>
//               </Animated.View>
//             </ScrollView>
//           </KeyboardAvoidingView>
//         </SafeAreaView>

//         {/* Verification OTP Modal */}
//         <Modal visible={showOtpModal.show} transparent animationType="slide">
//           <View style={styles.modalOverlay}>
//             <View style={styles.modalContent}>
//               <View style={[styles.modalIcon, { backgroundColor: '#f5f7ff' }]}><Icon name={showOtpModal.type === 'email' ? 'email-fast-outline' : 'cellphone-text'} size={40} color="#00652C" /></View>
//               <Text style={styles.modalTitle}>Verify Your {showOtpModal.type === 'email' ? 'Email' : 'Phone'}</Text>
//               <Text style={styles.modalSub}>Enter the code sent to {showOtpModal.value}</Text>
//               <TextInput style={styles.otpInput} value={otpCode} onChangeText={setOtpCode} placeholder={t('000000')} placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={6} />
//               {otpError ? <Text style={styles.modalErrorText}>{otpError}</Text> : null}
//               <TouchableOpacity style={styles.modalActionBtn} onPress={handleVerifyOtp} disabled={isVerifyingOtp}>
//                 {isVerifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify Now')}</Text>}
//               </TouchableOpacity>
//               <TouchableOpacity onPress={() => setShowOtpModal({ show: false, type: '', value: '' })} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('Go Back')}</Text></TouchableOpacity>
//             </View>
//           </View>
//         </Modal>

//         {/* Device Conflict Modal */}
//         <Modal visible={showDeviceConflict} transparent animationType="fade">
//           <View style={styles.modalOverlay}>
//             <View style={styles.modalContent}>
//               <View style={styles.modalIcon}><Icon name="devices" size={40} color="#00652C" /></View>
//               <Text style={styles.modalTitle}>{t('Active Session Detected')}</Text>
//               <Text style={styles.modalSub}>You are logged in on another device. Would you like to log out from all other devices and log in here?</Text>
//               {!deviceOtpSent ? (
//                 <TouchableOpacity style={styles.modalActionBtn} onPress={handleSendDeviceOtp} disabled={isSendingDeviceOtp}>
//                   {isSendingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Log out other devices')}</Text>}
//                 </TouchableOpacity>
//               ) : (
//                 <View style={styles.otpWrapper}>
//                   <TextInput style={styles.otpInput} value={deviceOtp} onChangeText={setDeviceOtp} placeholder={t('Enter OTP')} placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={6} />
//                   <TouchableOpacity style={styles.modalActionBtn} onPress={handleVerifyDeviceOtp} disabled={isVerifyingDeviceOtp}>
//                     {isVerifyingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify & Login')}</Text>}
//                   </TouchableOpacity>
//                 </View>
//               )}
//               <TouchableOpacity onPress={() => setShowDeviceConflict(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('Cancel')}</Text></TouchableOpacity>
//             </View>
//           </View>
//         </Modal>

//         {notification.show && (
//           <Animated.View style={[styles.notification, { backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#00652C' : '#10b981' }]}>
//             <Icon name={notification.type === 'error' ? 'alert-circle' : 'check-circle'} size={20} color="#fff" />
//             <Text style={styles.notificationText}>{notification.message}</Text>
//           </Animated.View>
//         )}
//       </LinearGradient>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   googleDividerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 10,
//   },
//   googleDividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
//   googleDividerText: {
//     marginHorizontal: 12,
//     fontSize: 12,
//     color: '#9ca3af',
//     fontWeight: '600',
//   },
//   container: { flex: 1 },
//   flex: { flex: 1 },
//   gradient: { flex: 1, overflow: 'hidden' },
//   lavaOrb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.35 },
//   orb1: { top: -100, right: -50, backgroundColor: '#00652C' },
//   orb2: { bottom: -50, left: -100, backgroundColor: '#10b981' },
//   safeArea: { flex: 1 },
//   scrollContent: { paddingHorizontal: 20, paddingTop: 100, paddingBottom: 60, flexGrow: 1 },
//   backBtn: { position: 'absolute', top: 30, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
//   panel: { backgroundColor: 'rgba(255, 255, 255, 0.96)', borderRadius: 40, paddingHorizontal: 24, paddingVertical: 28, width: '100%', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
//   header: { alignItems: 'center', marginBottom: 24 },
//   logoBadge: { padding: 8, backgroundColor: '#fff', borderRadius: 20, shadowColor: '#00652C', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
//   logo: { width: 55, height: 55 },
//   brandContainer: { flexDirection: 'row', marginTop: 12 },
//   brandMain: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
//   brandAlt: { fontSize: 26, fontWeight: '400', color: '#00652C' },
//   tagline: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
//   formPanel: { gap: 14 },
//   inputField: { width: '100%' },
//   inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 16, height: 54, borderWidth: 1.5, borderColor: '#f1f5f9' },
//   inputWrapperFocused: { borderColor: '#00652C', backgroundColor: '#ffffff' },
//   inputIcon: { marginRight: 12 },
//   textInput: { flex: 1, color: '#1e293b', fontSize: 14, fontWeight: '600' },
//   verifyBtn: { backgroundColor: '#00652C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
//   verifiedBtn: { backgroundColor: 'transparent' },
//   verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
//   errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 16, fontWeight: '600' },
//   genderRow: { flexDirection: 'row', gap: 10 },
//   genderBtn: { flex: 1, height: 44, borderRadius: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
//   genderBtnSelected: { backgroundColor: '#f5f7ff', borderColor: '#00652C' },
//   genderText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
//   genderTextSelected: { color: '#00652C' },
//   forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },
//   forgotText: { color: '#00652C', fontSize: 12, fontWeight: '700' },
//   submitBtn: { height: 56, borderRadius: 20, backgroundColor: '#00652C', justifyContent: 'center', alignItems: 'center', shadowColor: '#00652C', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
//   submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
//   switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
//   switchText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
//   switchLink: { fontSize: 14, fontWeight: '800', color: '#00652C' },
//   notification: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 1000 },
//   notificationText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
//   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
//   modalContent: { backgroundColor: '#fff', borderRadius: 30, padding: 24, width: '100%', alignItems: 'center' },
//   modalIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
//   modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
//   modalSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
//   modalActionBtn: { width: '100%', height: 56, borderRadius: 18, backgroundColor: '#00652C', justifyContent: 'center', alignItems: 'center', shadowColor: '#00652C', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
//   modalActionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
//   modalErrorText: { color: '#ef4444', fontSize: 12, fontWeight: '700', marginBottom: 12 },
//   cancelBtn: { marginTop: 16 },
//   cancelText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
//   otpWrapper: { width: '100%', gap: 16 },
//   otpInput: { width: '100%', height: 54, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#f1f5f9', textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#1e293b' },
// });

// export default UserSignup;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  useWindowDimensions,
  Animated,
} from 'react-native';
import TextInput from '../../components/TranslatedTextInput';
import Text from '../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AuthBackground from '../../theme/AuthBackground';

// Import logo
import logo from '../../image/HumaeliIcon.png';
import GoogleAuthButton from './components/GoogleAuthButton';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import PasswordRequirementChecklist from '../../components/common/PasswordRequirementChecklist';
import { sendLocationSilently } from '../../utils/locationHelper';
import socketService from '../../services/socketService';
import useLanguageRender from '../../hooks/useLanguageRender';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';
import CountryPhoneInput from '../../components/common/CountryPhoneInput';
import {
  getPhoneLengthLabel,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
} from '../../utils/countryCodes';
import {
  calculateAgeFromDateOfBirth,
  formatDateOfBirthDisplay,
  getDatePickerValue,
  toDateOnlyString,
} from '../../utils/dateOfBirth';
import {
  getApiErrorMessage,
  isOtpRequestSuccessful,
  isOtpVerificationSuccessful,
  postPublicAuthEndpoint,
  postPublicAuthEndpointWithOtpRetry,
} from './authUtils';
import { STRONG_PASSWORD_HINT, validateStrongPassword } from '../../utils/passwordPolicy';

const OTP_RESEND_SECONDS = 60;

const UserSignup = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isCompact = width < 360 || height < 700;
  const [isLogin, setIsLogin] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const {
    scrollRef,
    keyboardInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    anonymous: '',
    phoneNumber: '',
    phoneCountryCode: '+91',
    age: '',
    dateOfBirth: '',
    gender: '',
    confirmPassword: '',
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  // Holds the running entrance animation so a mode switch can stop it cleanly.
  const entranceAnimRef = useRef(null);
  // Entrance plays on open only; later mode toggles skip it.
  const firstEntranceRef = useRef(true);
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  
  // Staggered field animations
  const fieldAnims = useRef([...Array(15)].map(() => new Animated.Value(0))).current;

  // UI States
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showDateOfBirthPicker, setShowDateOfBirthPicker] = useState(false);

  // Verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [showOtpModal, setShowOtpModal] = useState({ show: false, type: '', value: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const sendingVerificationRef = useRef(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const verifyingOtpRef = useRef(false);
  const [otpError, setOtpError] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const resendingOtpRef = useRef(false);

  // Device Conflict States
  const [showDeviceConflict, setShowDeviceConflict] = useState(false);
  const [deviceOtp, setDeviceOtp] = useState('');
  const [deviceOtpSent, setDeviceOtpSent] = useState(false);
  const [isSendingDeviceOtp, setIsSendingDeviceOtp] = useState(false);
  const [isVerifyingDeviceOtp, setIsVerifyingDeviceOtp] = useState(false);
  const [deviceOtpResendTimer, setDeviceOtpResendTimer] = useState(0);
  const [isResendingDeviceOtp, setIsResendingDeviceOtp] = useState(false);
  const resendingDeviceOtpRef = useRef(false);

  // Forgot Password popup
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const genderOptions = ['Male', 'Female', 'Other'];

  // Toggling Login <-> Create Account re-runs this entrance animation. It used to
  // reset every value to 0 and start a new animation WITHOUT stopping the
  // previous one - and calling setValue() on a native-driven value that still has
  // an animation attached can leave it stuck at 0. Every field is wrapped in an
  // Animated.View with `opacity: fieldAnims[i]`, so a stuck 0 renders the entire
  // form invisible - the blank page after switching back to Login.
  //
  // Stop the in-flight animation first, and if the new one gets interrupted, snap
  // the values to their end state so the form can never be left invisible.
  // The panel's opacity is bound to `fadeAnim` and every field's to
  // `fieldAnims[i]`, so if any of those is left at 0 the page renders completely
  // blank - no error, just nothing. That is what happened when switching from
  // Create Account back to Login: the effect reset all values to 0 and started a
  // new animation over the top of the previous one, and setValue() on a
  // native-driven value that still has an animation attached can leave it stuck.
  //
  // The entrance animation now runs once, when the screen opens. A mode toggle
  // just snaps everything to its visible end state, so the form cannot be left
  // invisible regardless of animation timing.
  useEffect(() => {
    entranceAnimRef.current?.stop();

    const showImmediately = () => {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      fieldAnims.forEach(anim => anim.setValue(1));
    };

    if (!firstEntranceRef.current) {
      showImmediately();
      return;
    }
    firstEntranceRef.current = false;

    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    fieldAnims.forEach(anim => anim.setValue(0));

    entranceAnimRef.current = Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true }),
      Animated.stagger(40, fieldAnims.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 25, friction: 8, useNativeDriver: true })
      ))
    ]);
    // If the entrance is interrupted, don't leave anything part-faded.
    entranceAnimRef.current.start(({ finished }) => {
      if (!finished) showImmediately();
    });
  }, [isLogin]);

  useEffect(() => {
    const createOrbLoop = (anim, toVal) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: toVal, duration: 10000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 10000, useNativeDriver: true }),
        ])
      );
    };
    createOrbLoop(orb1Anim, 120).start();
    createOrbLoop(orb2Anim, -100).start();
    createOrbLoop(particle1, 200).start();
    createOrbLoop(particle2, -150).start();
  }, []);

  useEffect(() => {
    if (!showOtpModal.show || otpResendTimer <= 0) return undefined;

    const interval = setInterval(() => {
      setOtpResendTimer(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [showOtpModal.show, otpResendTimer]);

  useEffect(() => {
    if (!showDeviceConflict || !deviceOtpSent || deviceOtpResendTimer <= 0) return undefined;

    const interval = setInterval(() => {
      setDeviceOtpResendTimer(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [showDeviceConflict, deviceOtpSent, deviceOtpResendTimer]);

  const formatOtpTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const persistUserSession = async (data) => {
    const token = data?.token || data?.accessToken || data?.data?.token;
    if (!token) return false;

    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('accessToken', token);
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userType', 'user');
    await AsyncStorage.setItem('userEmail', formData.email);

    const role = data?.role || data?.user?.role || 'user';
    await AsyncStorage.setItem('userRole', role);

    if (data.user) {
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      if (data.user._id) await AsyncStorage.setItem('userId', data.user._id);
    }
    sendLocationSilently('login');
    socketService.connect().catch(() => {});
    return true;
  };

  const validateSignup = () => {
    const newErrors = {};
    if (!formData.fullName) newErrors.fullName = "Full name is required";
    if (!formData.anonymous) newErrors.anonymous = "Anonymous name is required";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    else if (!emailVerified) newErrors.email = "Please verify your email first";

    if (!formData.phoneNumber) newErrors.phoneNumber = "Phone number is required";
    else if (!isValidLocalPhoneNumber(formData.phoneNumber, formData.phoneCountryCode)) {
      newErrors.phoneNumber = `Phone number must be ${getPhoneLengthLabel(formData.phoneCountryCode)} digits`;
    }

    const calculatedAge = calculateAgeFromDateOfBirth(formData.dateOfBirth);
    if (!formData.dateOfBirth || calculatedAge === null) newErrors.dateOfBirth = "Date of birth is required";
    else if (calculatedAge < 13 || calculatedAge > 120) newErrors.dateOfBirth = "Age must be between 13 and 120";

    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.password) newErrors.password = "Password is required";
    else {
      const passwordCheck = validateStrongPassword(formData.password);
      if (!passwordCheck.isValid) newErrors.password = passwordCheck.message;
    }

    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.post('/api/auth/login', {
        email: formData.email,
        password: formData.password,
        role: 'user',
      });
      if (await persistUserSession(response.data)) {
        showNotification('Login successful!');
        // Onboarding is for NEW accounts only - logging back in went through the
        // whole 4-page tour every time, which is what made it look like the tour
        // belonged to login. Signup below still routes to it.
        setTimeout(() => navigation.replace('LocationGate', { destination: 'UserDashboard' }), 1000);
      }
    } catch (err) {
      if (err?.response?.status === 409) {
        setDeviceOtp('');
        setDeviceOtpSent(false);
        setDeviceOtpResendTimer(0);
        setIsResendingDeviceOtp(false);
        resendingDeviceOtpRef.current = false;
        setShowDeviceConflict(true);
        showNotification('Session active on another device', 'info');
      } else {
        showNotification(err?.response?.data?.message || 'Login failed', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!validateSignup()) {
      showNotification('Please correct the errors', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const phoneNumber = normalizeLocalPhoneNumber(formData.phoneNumber, formData.phoneCountryCode);
      const signupData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        anonymous: formData.anonymous.trim(),
        phoneNumber,
        phoneNum: phoneNumber,
        phoneCountryCode: formData.phoneCountryCode,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        dateOfBirth: toDateOnlyString(formData.dateOfBirth),
        age: calculateAgeFromDateOfBirth(formData.dateOfBirth),
        gender: formData.gender.trim().toLowerCase(),
        role: "user",
        isEmailVerified: true,
        isPhoneVerified: true,
        emailVerificationToken,
      };
      const response = await postPublicAuthEndpoint('complete-registration', signupData);
      if (response.data?.success) {
        const hasSession = await persistUserSession(response.data);
        showNotification(response.data.message || 'Account created successfully!');

        if (hasSession) {
          setTimeout(() => navigation.replace('LocationGate', { destination: 'UserDashboard' }), 1500);
        } else if (response.data?.requiresLogin) {
          setFormData(prev => ({
            ...prev,
            password: '',
            confirmPassword: '',
          }));
          setEmailVerified(false);
          setEmailVerificationToken('');
          setTimeout(() => setIsLogin(true), 1200);
        }
      } else {
        showNotification(response.data?.message || 'Registration failed', 'error');
      }
    } catch (error) {
      showNotification(
        getApiErrorMessage(error, 'Registration failed'),
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerifyOtp = async () => {
    if (sendingVerificationRef.current) return;
    const email = formData.email.trim().toLowerCase();
    const type = 'email';
    const value = email;
    if (!value) {
      showNotification(`Please enter ${type} first`, 'error');
      return;
    }
    if (type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }
    sendingVerificationRef.current = true;
    setOtpCode('');
    setOtpError('');
    try {
      setIsSendingVerification(true);
      const endpoint = 'send-email-otp';
      const payload = { email: value };
      const response = await postPublicAuthEndpoint(endpoint, payload);
      if (isOtpRequestSuccessful(response)) {
        setFormData(prev => ({ ...prev, email: value }));
        setShowOtpModal({ show: true, type, value });
        setOtpResendTimer(OTP_RESEND_SECONDS);
        showNotification(response.data?.message || `OTP sent to ${type}`);
      } else {
        showNotification(response.data?.message || 'Failed to send OTP', 'error');
      }
    } catch (err) {
      showNotification(getApiErrorMessage(err, 'Failed to send OTP'), 'error');
    } finally {
      sendingVerificationRef.current = false;
      setIsSendingVerification(false);
    }
  };

  const handleResendVerifyOtp = async () => {
    if (resendingOtpRef.current || otpResendTimer > 0) return;

    const email = String(showOtpModal.value || formData.email).trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setOtpError('Enter valid email');
      return;
    }

    try {
      resendingOtpRef.current = true;
      setIsResendingOtp(true);
      setOtpError('');
      setOtpCode('');

      const response = await postPublicAuthEndpoint('send-email-otp', { email });
      if (isOtpRequestSuccessful(response)) {
        setFormData(prev => ({ ...prev, email }));
        setShowOtpModal({ show: true, type: 'email', value: email });
        setOtpResendTimer(OTP_RESEND_SECONDS);
        showNotification(response.data?.message || 'OTP resent successfully');
      } else {
        setOtpError(response.data?.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setOtpError(getApiErrorMessage(err, 'Failed to resend OTP'));
    } finally {
      resendingOtpRef.current = false;
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (verifyingOtpRef.current) return;
    const normalizedOtp = otpCode.trim();
    if (normalizedOtp.length !== 6) {
      setOtpError('Enter 6 digit code');
      return;
    }
    const otpEmail = String(showOtpModal.value || formData.email).trim().toLowerCase();
    try {
      verifyingOtpRef.current = true;
      setIsVerifyingOtp(true);
      setOtpError('');
      const type = 'email';
      const endpoint = 'verify-email-otp';
      const payload = { email: otpEmail, otp: normalizedOtp };
      
      const response = await postPublicAuthEndpointWithOtpRetry(endpoint, payload);
      if (isOtpVerificationSuccessful(response)) {
        setFormData(prev => ({ ...prev, email: otpEmail }));
        setEmailVerified(true);
        setEmailVerificationToken(
          response.data?.emailVerificationToken ||
          response.data?.data?.emailVerificationToken ||
          response.data?.result?.emailVerificationToken ||
          ''
        );
        setShowOtpModal({ show: false, type: '', value: '' });
        setOtpCode('');
        showNotification(`${type} verified successfully!`);
      } else {
        setOtpError(response.data?.message || 'Verification failed');
      }
    } catch (err) {
      setOtpError(getApiErrorMessage(err, 'Verification failed'));
    } finally {
      verifyingOtpRef.current = false;
      setIsVerifyingOtp(false);
    }
  };

  const closeOtpModal = () => {
    setShowOtpModal({ show: false, type: '', value: '' });
    setOtpCode('');
    setOtpError('');
    setOtpResendTimer(0);
    setIsResendingOtp(false);
    resendingOtpRef.current = false;
  };

  // Forgot password — open the in-screen popup (email → OTP → reset)
  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleSendDeviceOtp = async () => {
    try {
      setIsSendingDeviceOtp(true);
      setDeviceOtp('');
      await axiosInstance.post('/api/auth/logout-other-devices', { email: formData.email, role: 'user' });
      setDeviceOtpSent(true);
      setDeviceOtpResendTimer(OTP_RESEND_SECONDS);
      showNotification('OTP sent to your email');
    } catch (err) {
      showNotification('Failed to send OTP', 'error');
    } finally {
      setIsSendingDeviceOtp(false);
    }
  };

  const handleResendDeviceOtp = async () => {
    if (resendingDeviceOtpRef.current || deviceOtpResendTimer > 0) return;

    try {
      resendingDeviceOtpRef.current = true;
      setIsResendingDeviceOtp(true);
      setDeviceOtp('');
      await axiosInstance.post('/api/auth/logout-other-devices', { email: formData.email, role: 'user' });
      setDeviceOtpResendTimer(OTP_RESEND_SECONDS);
      showNotification('OTP resent to your email');
    } catch (err) {
      showNotification('Failed to resend OTP', 'error');
    } finally {
      resendingDeviceOtpRef.current = false;
      setIsResendingDeviceOtp(false);
    }
  };

  const handleVerifyDeviceOtp = async () => {
    if (deviceOtp.trim().length !== 6) {
      showNotification('Enter 6 digit OTP', 'error');
      return;
    }

    try {
      setIsVerifyingDeviceOtp(true);
      const response = await axiosInstance.post('/api/auth/verify-login-otp', {
        email: formData.email,
        otp: deviceOtp.trim(),
        logoutOthers: true,
        role: 'user'
      });
      if (await persistUserSession(response.data)) {
        closeDeviceConflictModal();
        // Still a login, just via the device-conflict OTP - not a new account.
        navigation.replace('LocationGate', { destination: 'UserDashboard' });
      }
    } catch (err) {
      showNotification('Invalid OTP', 'error');
    } finally {
      setIsVerifyingDeviceOtp(false);
    }
  };

  const closeDeviceConflictModal = () => {
    setShowDeviceConflict(false);
    setDeviceOtp('');
    setDeviceOtpSent(false);
    setDeviceOtpResendTimer(0);
    setIsResendingDeviceOtp(false);
    resendingDeviceOtpRef.current = false;
  };

  const showNotification = (message, type = 'success', duration) => {
    const displayDuration = duration ?? (type === 'error' ? 8000 : 3000);
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), displayDuration);
  };

  const handleChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      setEmailVerified(false);
      setEmailVerificationToken('');
    }
  }, []);

  const handleDateOfBirthChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') setShowDateOfBirthPicker(false);
    if (!selectedDate) return;

    const dateOfBirth = toDateOnlyString(selectedDate);
    const calculatedAge = calculateAgeFromDateOfBirth(dateOfBirth);
    setFormData(prev => ({
      ...prev,
      dateOfBirth,
      age: calculatedAge !== null ? String(calculatedAge) : '',
    }));
    setErrors(prev => {
      const next = { ...prev };
      delete next.dateOfBirth;
      delete next.age;
      return next;
    });
  };

  const renderInput = (index, name, icon, placeholder, options = {}, verifyType = null) => {
    const isFocused = focusedField === name;
    const isVerified = verifyType === 'email' && emailVerified;
    const isMetricField = name === 'age' || name === 'weight';

    return (
      <Animated.View key={`input-${name}`} style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        <View style={[styles.inputWrapper, isMetricField && styles.metricInputWrapper, isFocused && styles.inputWrapperFocused]}>
          <Icon name={icon} size={20} color={isFocused ? '#00652C' : '#64748b'} style={styles.inputIcon} />
          <TextInput
            style={[styles.textInput, isMetricField && styles.metricTextInput]}
            value={formData[name]}
            onChangeText={(text) => handleChange(name, text)}
            onFocus={(event) => {
              setFocusedField(name);
              scrollFocusedInputIntoView(event);
            }}
            onBlur={() => setFocusedField(null)}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            {...options}
          />
          {verifyType && !isLogin && (
            <TouchableOpacity 
              onPress={handleSendVerifyOtp}
              disabled={isVerified || isSendingVerification}
              style={[styles.verifyBtn, (isVerified || isSendingVerification) && styles.verifiedBtn]}
            >
              {isVerified ? (
                <Icon name="check-decagram" size={18} color="#10b981" />
              ) : isSendingVerification ? (
                <ActivityIndicator size="small" color="#00652C" />
              ) : (
                <Text style={styles.verifyBtnText}>{t('Verify')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </Animated.View>
    );
  };

  const renderPhoneInput = (index) => {
    const name = 'phoneNumber';
    const isFocused = focusedField === name;

    return (
      <Animated.View key="input-phoneNumber" style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        <CountryPhoneInput
          value={formData.phoneNumber}
          countryCode={formData.phoneCountryCode}
          onChangePhoneNumber={(text) => handleChange(name, text)}
          onChangeCountryCode={(code) => handleChange('phoneCountryCode', code)}
          focused={isFocused}
          accentColor="#00652C"
          containerStyle={styles.phoneInputWrapper}
          inputStyle={styles.phoneTextInput}
          onFocus={(event) => {
            setFocusedField(name);
            scrollFocusedInputIntoView(event);
          }}
          onBlur={() => setFocusedField(null)}
        />
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </Animated.View>
    );
  };

  const renderDateOfBirthInput = (index) => (
    <Animated.View key="input-dateOfBirth" style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
      <TouchableOpacity
        style={styles.inputWrapper}
        onPress={() => setShowDateOfBirthPicker(true)}
        activeOpacity={0.85}
      >
        <Icon name="calendar-month-outline" size={20} color="#64748b" style={styles.inputIcon} />
        <Text
          style={[
            styles.datePickerText,
            !formData.dateOfBirth && styles.datePickerPlaceholder,
          ]}
        >
          {formatDateOfBirthDisplay(formData.dateOfBirth, t('Date of Birth'))}
        </Text>
        <Icon name="chevron-down" size={20} color="#94a3b8" />
      </TouchableOpacity>
      {showDateOfBirthPicker && (
        <DateTimePicker
          value={getDatePickerValue(formData.dateOfBirth)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={handleDateOfBirthChange}
        />
      )}
      {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
    </Animated.View>
  );

  const isAnyModalVisible = showOtpModal.show || showDeviceConflict;
  const signupPanelHeight = Math.min(
    isTablet ? 760 : 720,
    Math.max(360, height - (isCompact ? 78 : 96))
  );
  const signupPanelPaddingY = isCompact ? 18 : 22;
  const signupLogoSize = isCompact ? 64 : 80;
  const signupHeaderHeight = signupLogoSize + (isCompact ? 70 : 76);
  const signupFormHeight = Math.max(
    260,
    signupPanelHeight - (signupPanelPaddingY * 2) - signupHeaderHeight
  );

  const scrollContainerStyle = {
    ...styles.scrollContent,
    justifyContent: isLogin ? 'center' : 'flex-start',
    paddingHorizontal: isCompact ? 12 : 16,
    paddingTop: isLogin ? (isCompact ? 72 : 88) : (isCompact ? 62 : 76),
    paddingBottom: (isLogin ? (isCompact ? 44 : 60) : (isCompact ? 14 : 20)) + keyboardInset,
  };
  const panelStyle = [
    styles.panel,
    {
      maxWidth: isTablet ? 480 : 440,
      height: isLogin ? undefined : signupPanelHeight,
      paddingHorizontal: isCompact ? 16 : 22,
      paddingVertical: signupPanelPaddingY,
      borderRadius: isCompact ? 28 : 40,
      opacity: isAnyModalVisible ? 0.2 : 1,
    },
  ];
  const logoStyle = [
    styles.logo,
    {
      width: isCompact ? 64 : 80,
      height: isCompact ? 64 : 80,
    },
  ];
  const formScrollStyle = [
    styles.formScroll,
    !isLogin && styles.signupFormScroll,
    !isLogin && { height: signupFormHeight },
  ];
  const formContentStyle = [
    styles.formPanel,
    !isLogin && styles.signupFormPanel,
    !isLogin && { paddingBottom: (isCompact ? 18 : 24) + keyboardInset },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {/* Green mesh backdrop (patient palette) — scales to phone/tablet */}
      <AuthBackground role="user" style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.flex}>
            <TouchableOpacity style={styles.backBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('RoleSelector'))}>
              <Icon name="chevron-left" size={28} color="#0F172A" />
            </TouchableOpacity>

            <ScrollView
              ref={isLogin ? scrollRef : null}
              contentContainerStyle={scrollContainerStyle}
              showsVerticalScrollIndicator={false}
              onLayout={isLogin ? handleKeyboardAwareScrollLayout : undefined}
              onScroll={isLogin ? handleKeyboardAwareScroll : undefined}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              scrollEnabled={isLogin}
              pointerEvents={isAnyModalVisible ? 'none' : 'auto'}
            >
              <Animated.View style={[panelStyle, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.header}>
                  <Image source={logo} style={logoStyle} resizeMode="contain" />
                  <View style={styles.brandContainer}><Text style={[styles.brandMain, { color: '#00652C' }]}>{t('Humaeli')}</Text></View>
                  <Text style={styles.tagline}>{'Begin your journey'}</Text>
                </View>

                <ScrollView
                  ref={!isLogin ? scrollRef : null}
                  style={formScrollStyle}
                  contentContainerStyle={formContentStyle}
                  showsVerticalScrollIndicator={!isLogin}
                  onLayout={!isLogin ? handleKeyboardAwareScrollLayout : undefined}
                  onScroll={!isLogin ? handleKeyboardAwareScroll : undefined}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  scrollEnabled={!isLogin}
                >
                  {!isLogin && (
                    <>{renderInput(0, 'fullName', 'account-outline', 'Full Name')}{renderInput(1, 'anonymous', 'incognito-circle', 'Anonymous Name')}</>
                  )}
                  {renderInput(2, 'email', 'email-outline', 'Email Address', { keyboardType: 'email-address', autoCapitalize: 'none' }, 'email')}
                  {!isLogin && (
                    <>{renderPhoneInput(3)}{renderDateOfBirthInput(4)}{renderInput(5, 'age', 'calendar-account-outline', 'Age', { editable: false })}
                      <Animated.View style={[styles.genderRow, { opacity: fieldAnims[6] }]}>
                        {genderOptions.map(g => (
                          <TouchableOpacity key={g} style={[styles.genderBtn, formData.gender === g && styles.genderBtnSelected]} onPress={() => handleChange('gender', g)}>
                            <Text style={[styles.genderText, formData.gender === g && styles.genderTextSelected]}>{g}</Text>
                          </TouchableOpacity>
                        ))}
                      </Animated.View>
                    </>
                  )}
	                  <Animated.View key="pwd-row" style={{ opacity: fieldAnims[7] }}>
	                    <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
	                      <Icon name="lock-outline" size={20} color={focusedField === 'password' ? '#00652C' : '#64748b'} style={styles.inputIcon} />
	                      <TextInput
	                        style={styles.textInput}
	                        value={formData.password}
	                        onChangeText={(text) => handleChange('password', text)}
	                        onFocus={(event) => { setFocusedField('password'); scrollFocusedInputIntoView(event); }}
	                        onBlur={() => setFocusedField(null)}
	                        placeholder={t('Password')}
	                        placeholderTextColor="#94a3b8"
	                        secureTextEntry={!showPassword}
	                      />
	                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
	                        <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" />
	                      </TouchableOpacity>
	                    </View>
	                    {!isLogin && <Text style={styles.passwordHint}>{t(STRONG_PASSWORD_HINT)}</Text>}
	                    {!isLogin && <PasswordRequirementChecklist password={formData.password} style={styles.passwordChecklist} />}
	                    {!isLogin && errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
	                  </Animated.View>
                  {isLogin && (
                    <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}>
                      <Text style={styles.forgotText}>{t('Forgot password?')}</Text>
                    </TouchableOpacity>
                  )}
                  {!isLogin && (
                    <Animated.View key="cpwd-row" style={{ opacity: fieldAnims[7] }}>
	                      <View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused]}>
	                        <Icon name="lock-check-outline" size={20} color={focusedField === 'confirmPassword' ? '#00652C' : '#64748b'} style={styles.inputIcon} />
	                        <TextInput
	                          style={styles.textInput}
	                          value={formData.confirmPassword}
	                          onChangeText={(text) => handleChange('confirmPassword', text)}
	                          onFocus={(event) => { setFocusedField('confirmPassword'); scrollFocusedInputIntoView(event); }}
	                          onBlur={() => setFocusedField(null)}
	                          placeholder={t('Confirm Password')}
	                          placeholderTextColor="#94a3b8"
	                          secureTextEntry={!showConfirmPassword}
	                        />
	                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
	                          <Icon name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" />
	                        </TouchableOpacity>
	                      </View>
	                      {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
	                    </Animated.View>
	                  )}
                  <Animated.View key="submit-row" style={{ opacity: fieldAnims[8], marginTop: 10 }}>
                    <TouchableOpacity activeOpacity={0.9} onPress={isLogin ? handleLogin : handleSignup} disabled={isLoading}>
                      <LinearGradient
                        colors={['#006B2C', '#01CE54']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.submitBtn}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.submitBtnText}>{isLogin ? 'Login' : 'Create Account'}</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View key="google-row" style={{ opacity: fieldAnims[8], marginTop: 14 }}>
                    <View style={styles.googleDividerRow}>
                      <View style={styles.googleDividerLine} />
                      <Text style={styles.googleDividerText}>or</Text>
                      <View style={styles.googleDividerLine} />
                    </View>
                    <GoogleAuthButton
                      role="user"
                      mode={isLogin ? 'signin' : 'signup'}
                      disabled={isLoading}
                      locationEvent={isLogin ? 'login' : 'signup'}
                      onSuccess={({ isCounselor }) => {
                        sendLocationSilently(isLogin ? 'login' : 'signup');
                        setTimeout(() => {
                          navigation.replace(
                            isCounselor ? 'CounselorDashboard' : 'UserDashboard',
                          );
                        }, 600);
                      }}
                      onError={(msg) => {
                        showNotification(msg || 'Google sign-in failed', 'error');
                        setOtpError(msg);
                        setTimeout(() => setOtpError(''), 8000);
                      }}
                    />
                  </Animated.View>
                  <Animated.View key="switch-row" style={[styles.switchRow, { opacity: fieldAnims[9] }]}>
                    <Text style={styles.switchText}>{isLogin ? "New here?" : "Already joined?"}</Text>
                    <TouchableOpacity onPress={() => setIsLogin(!isLogin)}><Text style={styles.switchLink}>{isLogin ? " Create Account" : " Login"}</Text></TouchableOpacity>
                  </Animated.View>
                </ScrollView>
              </Animated.View>
            </ScrollView>
          </View>
        </SafeAreaView>

        {/* Verification OTP Modal */}
        <Modal
          visible={showOtpModal.show}
          transparent
          animationType="slide"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={closeOtpModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalIcon, { backgroundColor: '#f5f7ff' }]}><Icon name="email-fast-outline" size={40} color="#00652C" /></View>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.modalSub}>Enter the code sent to {showOtpModal.value}</Text>
              <TextInput key={`${showOtpModal.type}:${showOtpModal.value}:${showOtpModal.show ? 'open' : 'closed'}`} style={styles.otpInput} value={otpCode} onChangeText={(value) => setOtpCode(value.replace(/\D/g, ''))} placeholder={t('000000')} placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={6} autoFocus />
              <View style={styles.otpResendRow}>
                {otpResendTimer > 0 ? (
                  <Text style={styles.otpTimerText}>
                    {t('Resend OTP in')} {formatOtpTimer(otpResendTimer)}
                  </Text>
                ) : (
                  <Text style={styles.otpTimerText}>{t("Didn't receive code?")}</Text>
                )}
                <TouchableOpacity
                  onPress={handleResendVerifyOtp}
                  disabled={otpResendTimer > 0 || isResendingOtp}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.otpResendText,
                      (otpResendTimer > 0 || isResendingOtp) && styles.otpResendTextDisabled,
                    ]}
                  >
                    {isResendingOtp ? t('Sending...') : t('Resend')}
                  </Text>
                </TouchableOpacity>
              </View>
              {otpError ? <Text style={styles.modalErrorText}>{otpError}</Text> : null}
              <TouchableOpacity
                style={[styles.modalActionBtn, (isVerifyingOtp || otpCode.length !== 6) && styles.modalActionBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={isVerifyingOtp || otpCode.length !== 6}
              >
                {isVerifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify Now')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={closeOtpModal} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('Go Back')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Device Conflict Modal */}
        <Modal
          visible={showDeviceConflict}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}><Icon name="devices" size={40} color="#00652C" /></View>
              <Text style={styles.modalTitle}>{t('Active Session Detected')}</Text>
              <Text style={styles.modalSub}>You are logged in on another device. Would you like to log out from all other devices and log in here?</Text>
              {!deviceOtpSent ? (
                <TouchableOpacity
                  style={[styles.modalActionBtn, isSendingDeviceOtp && styles.modalActionBtnDisabled]}
                  onPress={handleSendDeviceOtp}
                  disabled={isSendingDeviceOtp}
                >
                  {isSendingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Log out other devices')}</Text>}
                </TouchableOpacity>
              ) : (
                <View style={styles.otpWrapper}>
                  <TextInput
                    style={styles.otpInput}
                    value={deviceOtp}
                    onChangeText={(value) => setDeviceOtp(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('Enter OTP')}
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <View style={styles.otpResendRow}>
                    {deviceOtpResendTimer > 0 ? (
                      <Text style={styles.otpTimerText}>
                        {t('Resend OTP in')} {formatOtpTimer(deviceOtpResendTimer)}
                      </Text>
                    ) : (
                      <Text style={styles.otpTimerText}>{t("Didn't receive code?")}</Text>
                    )}
                    <TouchableOpacity
                      onPress={handleResendDeviceOtp}
                      disabled={deviceOtpResendTimer > 0 || isResendingDeviceOtp}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text
                        style={[
                          styles.otpResendText,
                          (deviceOtpResendTimer > 0 || isResendingDeviceOtp) && styles.otpResendTextDisabled,
                        ]}
                      >
                        {isResendingDeviceOtp ? t('Sending...') : t('Resend OTP')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, isVerifyingDeviceOtp && styles.modalActionBtnDisabled]}
                    onPress={handleVerifyDeviceOtp}
                    disabled={isVerifyingDeviceOtp}
                  >
                    {isVerifyingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify & Login')}</Text>}
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={closeDeviceConflictModal} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('Cancel')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {notification.show && (
          <Animated.View style={[styles.notification, { backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#00652C' : '#10b981' }]}>
            <Icon name={notification.type === 'error' ? 'alert-circle' : 'check-circle'} size={20} color="#fff" />
            <Text style={styles.notificationText}>{notification.message}</Text>
          </Animated.View>
        )}

        {/* Forgot Password popup (user side) */}
        <ForgotPasswordModal
          visible={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
          accentColor="#00652C"
          initialEmail={formData.email}
        />
      </AuthBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  googleDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  googleDividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  googleDividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  container: { flex: 1 },
  flex: { flex: 1 },
  gradient: { flex: 1, overflow: 'hidden' },
  lavaOrb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.35 },
  orb1: { top: -100, right: -50, backgroundColor: '#00652C' },
  orb2: { bottom: -50, left: -100, backgroundColor: '#10b981' },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 100, paddingBottom: 60, flexGrow: 1 },
  backBtn: { position: 'absolute', top: 30, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  panel: { backgroundColor: 'rgba(255, 255, 255, 0.96)', borderRadius: 40, paddingHorizontal: 24, paddingVertical: 28, width: '100%', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  header: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 80, height: 80 },
  brandContainer: { flexDirection: 'row', marginTop: 4 },
  brandMain: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  brandAlt: { fontSize: 26, fontWeight: '400', color: '#00652C' },
  tagline: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
  formScroll: { width: '100%' },
  signupFormScroll: { flexShrink: 0 },
  formPanel: { gap: 12 },
  signupFormPanel: { paddingBottom: 18 },
  inputField: { width: '100%' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 18, height: 58, borderWidth: 1.5, borderColor: '#f1f5f9' },
  metricInputWrapper: { height: 66, borderRadius: 20, paddingHorizontal: 20 },
  phoneInputWrapper: { height: 58, paddingHorizontal: 18 },
  inputWrapperFocused: { borderColor: '#00652C', backgroundColor: '#ffffff' },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  metricTextInput: { fontSize: 18, fontWeight: '800' },
  phoneTextInput: { fontSize: 15 },
  datePickerText: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  datePickerPlaceholder: { color: '#94a3b8' },
  verifyBtn: { minWidth: 68, minHeight: 34, backgroundColor: '#00652C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  verifiedBtn: { backgroundColor: 'transparent' },
  verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 16, fontWeight: '600' },
  passwordHint: { color: '#64748b', fontSize: 11, lineHeight: 15, marginTop: 4, marginLeft: 16, fontWeight: '600' },
  passwordChecklist: { marginLeft: 16, marginRight: 4 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, height: 44, borderRadius: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  genderBtnSelected: { backgroundColor: '#f5f7ff', borderColor: '#00652C' },
  genderText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  genderTextSelected: { color: '#00652C' },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },
  forgotText: { color: '#00652C', fontSize: 12, fontWeight: '700' },
  submitBtn: { height: 60, borderRadius: 20, backgroundColor: '#00652C', justifyContent: 'center', alignItems: 'center', shadowColor: '#00652C', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  switchText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  switchLink: { fontSize: 14, fontWeight: '800', color: '#00652C' },
  notification: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 1000 },
  notificationText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.64)', justifyContent: 'center', alignItems: 'center', padding: 22, zIndex: 30 },
  modalContent: { backgroundColor: '#fff', borderRadius: 26, padding: 28, width: '100%', maxWidth: 390, alignItems: 'center', borderWidth: 1, borderColor: '#DDF4E6', shadowColor: '#052E16', shadowOpacity: 0.18, shadowRadius: 24, elevation: 14 },
  modalIcon: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  modalActionBtn: { width: '100%', height: 54, borderRadius: 16, backgroundColor: '#00652C', justifyContent: 'center', alignItems: 'center', shadowColor: '#00652C', shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  modalActionBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  modalActionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalErrorText: { width: '100%', color: '#B91C1C', backgroundColor: '#FEF2F2', fontSize: 12, fontWeight: '700', textAlign: 'center', padding: 10, borderRadius: 10, marginTop: -6, marginBottom: 14 },
  cancelBtn: { width: '100%', height: 44, marginTop: 10, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  otpWrapper: { width: '100%', gap: 16 },
  otpInput: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#B7DFC7', textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  otpResendRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 16, flexWrap: 'wrap' },
  otpTimerText: { color: '#64748B', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  otpResendText: { color: '#00652C', fontSize: 13, fontWeight: '900' },
  otpResendTextDisabled: { color: '#94A3B8' },
});

export default UserSignup;
