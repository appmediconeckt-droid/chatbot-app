// RoleSelector.jsx - Masterpiece UI Version
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  StatusBar,
  SafeAreaView,
  Alert,
  BackHandler,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PATIENT, DOCTOR } from '../../theme/palette';
import AuthBackground from '../../theme/AuthBackground';
import logo from '../../image/HumaeliIcon.png';
import useLanguageRender from '../../hooks/useLanguageRender';

const RoleSelector = () => {
  const { t } = useLanguageRender();
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Responsive: live window size (reacts to rotation / split-screen, unlike a
  // module-level Dimensions.get). The panel is capped so it stays a centred
  // card on tablets instead of stretching edge-to-edge.
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = winW >= 600;
  const isShort = winH < 700;
  const R = {
    panelMaxW: isTablet ? 460 : 420,
    panelPadH: isTablet ? 30 : 22,
    panelPadTop: isShort ? 16 : isTablet ? 26 : 22,
    shield: isTablet ? 54 : 44,
    spark: isTablet ? 21 : 17,
    portal: isTablet ? 13.5 : 12,
    roleIcon: isTablet ? 50 : 42,
    roleIconGlyph: isTablet ? 26 : 22,
    roleName: isTablet ? 18 : 16,
    roleSub: isTablet ? 13 : 11.5,
    cardPadV: isTablet ? 17 : 14,
  };

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  // Starts near 1 so the panel barely grows — a big 0.8→1 scale pushed the
  // bottom badge around on tablets while it settled.
  const logoScale = useRef(new Animated.Value(0.97)).current;
  const userCardSlide = useRef(new Animated.Value(24)).current;
  const counselorCardSlide = useRef(new Animated.Value(24)).current;
  const scaleUser = useRef(new Animated.Value(1)).current;
  const scaleCounselor = useRef(new Animated.Value(1)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  
  // Background Animation Values
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  
  
  useEffect(() => {
    // Entrance: quick and settled in ~450ms. Everything (incl. the bottom
    // badge) runs in PARALLEL — the old version faded for 1s and only THEN
    // staggered the cards on slow springs, leaving the badge hidden ~2s.
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 70, friction: 11, useNativeDriver: true }),
      Animated.stagger(70, [
        Animated.spring(userCardSlide, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
        Animated.spring(counselorCardSlide, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
      ]),
    ]).start();

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
      
      {/* Soft mesh: green (top-left) → blue (bottom-right) — both portals */}
      <AuthBackground role="both" style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Scrolls only when the panel can't fit (tablet / short screens);
              otherwise flexGrow+center keeps it vertically centred. Without
              this the bottom badge was clipped by gradient's overflow:hidden. */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          <Animated.View
            style={[
              styles.panel,
              {
                maxWidth: R.panelMaxW,
                paddingHorizontal: R.panelPadH,
                paddingTop: R.panelPadTop,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: logoScale }],
              },
            ]}
          >
            {/* Header mirrors the Login card: mark, bold title, light subtitle.
                Uses the tree-only icon so the "Humaeli" wordmark inside the full
                logo doesn't repeat the title text below it. */}
            <View style={{ marginBottom: 12, alignItems: 'center' }}>
              <Image
                source={logo}
                style={{ width: 80, height: 80, resizeMode: 'contain' }}
              />
            </View>

            <Text style={styles.brandTitle}>{t('Humaeli')}</Text>
            <Text style={styles.tagline}>{t('Empowering People, Inspiring Mental Wellness')}</Text>

            <View style={styles.portalRow}>
              <View style={styles.portalRule} />
              <Text style={[styles.portalLabel, { fontSize: R.portal }]}>{t('Select Portal')}</Text>
              <View style={styles.portalRule} />
            </View>

            {/* Stacked role cards */}
            <View style={styles.stack}>
              {/* User → green */}
              <Animated.View style={{ transform: [{ translateY: userCardSlide }, { scale: scaleUser }] }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPressIn={() => handlePressIn('user')}
                  onPressOut={() => handlePressOut('user')}
                  onPress={() => handleRoleSelect('user')}
                  disabled={isLoading}
                  style={[
                    styles.roleCard,
                    { paddingVertical: R.cardPadV },
                    selectedRole === 'user' && {
                      borderColor: PATIENT.primary,
                      backgroundColor: '#F6FCF9',
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.roleIcon,
                      { width: R.roleIcon, height: R.roleIcon, borderRadius: R.roleIcon / 2, shadowColor: PATIENT.primary },
                    ]}
                  >
                    <Icon name="account-group" size={R.roleIconGlyph} color="#ffffff" />
                  </LinearGradient>
                  <View style={styles.roleTextWrap}>
                    <Text style={[styles.roleName, { fontSize: R.roleName }]}>{t('User')}</Text>
                    <Text style={[styles.roleSub, { fontSize: R.roleSub }]}>{t('Find trusted counselors')}</Text>
                  </View>
                  {selectedRole === 'user' && isLoading ? (
                    <ActivityIndicator size="small" color={PATIENT.primary} />
                  ) : (
                    <View style={[styles.chevWrap, { backgroundColor: '#E6F6EC' }]}>
                      <Icon name="chevron-right" size={18} color={PATIENT.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Counselor → blue */}
              <Animated.View style={{ transform: [{ translateY: counselorCardSlide }, { scale: scaleCounselor }] }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPressIn={() => handlePressIn('counselor')}
                  onPressOut={() => handlePressOut('counselor')}
                  onPress={() => handleRoleSelect('counselor')}
                  disabled={isLoading}
                  style={[
                    styles.roleCard,
                    { paddingVertical: R.cardPadV },
                    selectedRole === 'counselor' && {
                      borderColor: DOCTOR.primary,
                      backgroundColor: '#F5F9FF',
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[DOCTOR.gradientFrom, DOCTOR.gradientTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.roleIcon,
                      { width: R.roleIcon, height: R.roleIcon, borderRadius: R.roleIcon / 2, shadowColor: DOCTOR.primary },
                    ]}
                  >
                    <Icon name="briefcase-variant" size={R.roleIconGlyph} color="#ffffff" />
                  </LinearGradient>
                  <View style={styles.roleTextWrap}>
                    <Text style={[styles.roleName, { fontSize: R.roleName }]}>{t('Counselor')}</Text>
                    <Text style={[styles.roleSub, { fontSize: R.roleSub }]}>{t('Manage your practice')}</Text>
                  </View>
                  {selectedRole === 'counselor' && isLoading ? (
                    <ActivityIndicator size="small" color={DOCTOR.primary} />
                  ) : (
                    <View style={[styles.chevWrap, { backgroundColor: '#E8F0FE' }]}>
                      <Icon name="chevron-right" size={18} color={DOCTOR.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Encrypted badge */}
            <View style={styles.badgeContainer}>
              <Icon name="shield-lock" size={12} color={DOCTOR.primary} />
              <Text style={styles.badgeText}>{t('END-TO-END ENCRYPTED')}</Text>
            </View>
          </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </AuthBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  panel: {
    width: '100%',
    alignSelf: 'center',
    // Solid white — a translucent panel let the mesh tint it, so the pure-white
    // inner cards read as a second colour inside the card.
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  },
  logoOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(74, 108, 247, 0.09)',
  },
  logoShield: {
    shadowColor: '#4A6CF7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  logoSpark: {
    position: 'absolute',
  },
  // Both copied from Login's title/subtitle so the two headers read as one
  // design. Fixed sizes on purpose - the responsive R.brand/R.tagline values
  // are what made this header look different from Login's.
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 2,
  },
  portalRule: {
    width: 26,
    height: 1,
    backgroundColor: '#DDE3EC',
  },
  portalLabel: {
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chevWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    width: '100%',
    gap: 12,
    marginTop: 14,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#ECEFF5',
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  roleIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    // coloured glow — shadowColor is set per-role inline
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 9,
    elevation: 6,
  },
  roleTextWrap: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
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
    gap: 5,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4EAF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 22,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#004AC6',
    letterSpacing: 0.6,
  },
  versionText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default RoleSelector;