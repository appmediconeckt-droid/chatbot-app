// RoleSelector.jsx - Masterpiece UI Version
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
  Image,
  Alert,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import logo
import logo from '../../image/Mediconect Logo-3.png';

const RoleSelector = () => {
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const userCardSlide = useRef(new Animated.Value(50)).current;
  const counselorCardSlide = useRef(new Animated.Value(50)).current;
  const scaleUser = useRef(new Animated.Value(1)).current;
  const scaleCounselor = useRef(new Animated.Value(1)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  
  // Background Animation Values
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  
  const logoHeartbeat = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Entrance Sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 15, friction: 6, useNativeDriver: true }),
      ]),
      Animated.stagger(200, [
        Animated.spring(userCardSlide, { toValue: 0, tension: 25, friction: 8, useNativeDriver: true }),
        Animated.spring(counselorCardSlide, { toValue: 0, tension: 25, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();

    // Heartbeat Logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoHeartbeat, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(logoHeartbeat, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Floating logo drift
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -15, duration: 3000, useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    // Lava Background Orbs
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
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => false);
    return () => backHandler.remove();
  }, []);
  
  const handlePressIn = (role) => {
    const scaleAnim = role === 'user' ? scaleUser : scaleCounselor;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = (role) => {
    const scaleAnim = role === 'user' ? scaleUser : scaleCounselor;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  const handleRoleSelect = async (role) => {
    const normalizedRole = role === 'counsellor' ? 'counselor' : role;
    setSelectedRole(normalizedRole);
    setIsLoading(true);
    
    try {
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userType');
      await AsyncStorage.setItem('role', normalizedRole);
      
      setTimeout(() => {
        setIsLoading(false);
        if (normalizedRole === 'user') {
          navigation.replace('UserSignup', { role: 'user' });
        } else if (normalizedRole === 'counselor') {
          navigation.replace('CounselorSignup', { role: 'counselor' });
        }
      }, 600);
    } catch (error) {
      console.error("Error saving role:", error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to save selection. Please try again.');
    }
  };
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#000000']}
        style={styles.gradient}
      >
        {/* Animated Lava Orbs */}
        <Animated.View 
          style={[
            styles.lavaOrb, 
            styles.orb1, 
            { transform: [{ translateY: orb1Anim }, { translateX: orb2Anim }] }
          ]} 
        />
        <Animated.View 
          style={[
            styles.lavaOrb, 
            styles.orb2, 
            { transform: [{ translateY: orb2Anim }, { translateX: orb1Anim }] }
          ]} 
        />

        {/* Floating Particles */}
        <Animated.View style={[styles.particle, { top: '20%', left: '10%', transform: [{ translateY: particle1 }] }]} />
        <Animated.View style={[styles.particle, { top: '60%', right: '15%', transform: [{ translateY: particle2 }] }]} />
        <Animated.View style={[styles.particle, { bottom: '10%', left: '30%', transform: [{ translateX: particle1 }] }]} />

        <SafeAreaView style={styles.safeArea}>
          <Animated.View 
            style={[
              styles.panel,
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: logoScale }]
              },
            ]}
          >
            {/* Header Section */}
            <View style={styles.header}>
              <Animated.View style={{ transform: [{ translateY: logoFloat }, { scale: logoHeartbeat }] }}>
                <View style={styles.logoOuter}>
                  <Image source={logo} style={styles.logo} resizeMode="contain" />
                </View>
              </Animated.View>
              <View style={styles.brandContainer}>
                <Text style={styles.brandMain}>Medicone</Text>
                <Text style={styles.brandAlt}>ckt</Text>
              </View>
              <Text style={styles.tagline}>Elevate Your Mind, Heal Your Soul</Text>
            </View>
            
            <View style={styles.roleHeader}>
              <View style={styles.dash} />
              <Text style={styles.roleTitle}>Select Portal</Text>
              <View style={styles.dash} />
            </View>

            {/* Cards Row */}
            <View style={styles.grid}>
              {/* User Card */}
              <Animated.View style={[styles.cardWrapper, { transform: [{ translateY: userCardSlide }, { scale: scaleUser }] }]}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={() => handlePressIn('user')}
                  onPressOut={() => handlePressOut('user')}
                  onPress={() => handleRoleSelect('user')}
                  disabled={isLoading}
                  style={styles.fullWidth}
                >
                  <View style={[styles.card, selectedRole === 'user' && styles.selectedUserCard]}>
                    {selectedRole === 'user' && (
                      <View style={styles.selectionCheck}>
                        <Icon name="check-circle" size={20} color="#6366f1" />
                      </View>
                    )}
                    <LinearGradient
                      colors={['#6366f1', '#818cf8']}
                      style={styles.iconContainer}
                    >
                      <Icon name="account-group" size={30} color="#ffffff" />
                    </LinearGradient>
                    <Text style={styles.roleLabel} numberOfLines={1} adjustsFontSizeToFit>User</Text>
                    <Text style={styles.roleHint}>I need support</Text>
                    
                    {selectedRole === 'user' && isLoading ? (
                      <ActivityIndicator size="small" color="#6366f1" style={{ marginTop: 10 }} />
                    ) : (
                      <View style={styles.goButton}>
                        <Icon name="chevron-right" size={20} color="#6366f1" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
              
              {/* Counselor Card */}
              <Animated.View style={[styles.cardWrapper, { transform: [{ translateY: counselorCardSlide }, { scale: scaleCounselor }] }]}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={() => handlePressIn('counselor')}
                  onPressOut={() => handlePressOut('counselor')}
                  onPress={() => handleRoleSelect('counselor')}
                  disabled={isLoading}
                  style={styles.fullWidth}
                >
                  <View style={[styles.card, selectedRole === 'counselor' && styles.selectedCounselorCard]}>
                    {selectedRole === 'counselor' && (
                      <View style={[styles.selectionCheck, { borderColor: '#10b981' }]}>
                        <Icon name="check-circle" size={20} color="#10b981" />
                      </View>
                    )}
                    <LinearGradient
                      colors={['#10b981', '#34d399']}
                      style={styles.iconContainer}
                    >
                      <Icon name="doctor" size={30} color="#ffffff" />
                    </LinearGradient>
                    <Text style={styles.roleLabel} numberOfLines={1} adjustsFontSizeToFit>Counselor</Text>
                    <Text style={styles.roleHint}>Expert help</Text>
                    
                    {selectedRole === 'counselor' && isLoading ? (
                      <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 10 }} />
                    ) : (
                      <View style={[styles.goButton, { backgroundColor: '#ecfdf5' }]}>
                        <Icon name="chevron-right" size={20} color="#10b981" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
            
            <View style={styles.footer}>
              <View style={styles.badgeContainer}>
                <Icon name="shield-lock" size={16} color="#6366f1" />
                <Text style={styles.badgeText}>End-to-End Encrypted</Text>
              </View>
              <Text style={styles.versionText}>v2.0.4 Premium Experience</Text>
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    overflow: 'hidden',
  },
  lavaOrb: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.4,
  },
  orb1: {
    top: -50,
    left: -50,
    backgroundColor: '#6366f1',
  },
  orb2: {
    bottom: -50,
    right: -50,
    backgroundColor: '#10b981',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 40,
    padding: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoOuter: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 6,
  },
  logo: {
    width: 65,
    height: 65,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  brandMain: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: -1,
  },
  brandAlt: {
    fontSize: 32,
    fontWeight: '400',
    color: '#6366f1',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 4,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dash: {
    width: 20,
    height: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
    width: '100%',
  },
  cardWrapper: {
    flex: 1,
    flexBasis: 0,
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    height: 210, // Absolute fixed height for symmetry
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  selectedUserCard: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f7ff',
    borderWidth: 2,
    // Premium Glow
    shadowColor: '#6366f1',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  selectedCounselorCard: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    // Premium Glow
    shadowColor: '#10b981',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    // Premium Squircle effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  selectionCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  roleLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
  },
  roleHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '700',
    textAlign: 'center',
  },
  goButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 24,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  versionText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default RoleSelector;