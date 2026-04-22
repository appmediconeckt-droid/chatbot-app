// RoleSelector.jsx - Fixed Native Driver Issues
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Import logo - adjust path as needed
import logo from '../../image/Mediconect Logo-3.png';

const RoleSelector = () => {
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleUser = useRef(new Animated.Value(1)).current;
  const scaleCounselor = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
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
      
      console.log(normalizedRole + " selected");
      
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
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View 
            style={[
              styles.panel,
              { opacity: fadeAnim },
            ]}
          >
            {/* Header Section - Exactly matching web version */}
            <View style={styles.header}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.welcomeBadge}>✦ welcome back ✦</Text>
              <Text style={styles.subtitle}>choose your path —</Text>
            </View>
            
            {/* Cards Row - Side by Side with equal width */}
            <View style={styles.grid}>
              {/* User Card */}
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={() => handlePressIn('user')}
                onPressOut={() => handlePressOut('user')}
                onPress={() => handleRoleSelect('user')}
                disabled={isLoading}
                style={styles.cardContainer}
              >
                <Animated.View
                  style={[
                    styles.card,
                    styles.userCard,
                    { transform: [{ scale: scaleUser }] },
                    selectedRole === 'user' && styles.selectedCard,
                  ]}
                >
                  <View style={[styles.iconCircle, selectedRole === 'user' && styles.selectedIconCircle]}>
                    <Text style={styles.iconText}>🧑‍💼</Text>
                  </View>
                  <Text style={[styles.roleLabel, selectedRole === 'user' && styles.selectedRoleLabel]}>user</Text>
                  <Text style={styles.roleHint}>personal dashboard</Text>
                  <View style={styles.microDivider} />
                  <Text style={styles.footerNote}>explore</Text>
                  {selectedRole === 'user' && isLoading ? (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#667eea" />
                    </View>
                  ) : null}
                </Animated.View>
              </TouchableOpacity>
              
              {/* Counselor Card */}
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={() => handlePressIn('counselor')}
                onPressOut={() => handlePressOut('counselor')}
                onPress={() => handleRoleSelect('counselor')}
                disabled={isLoading}
                style={styles.cardContainer}
              >
                <Animated.View
                  style={[
                    styles.card,
                    styles.counselorCard,
                    { transform: [{ scale: scaleCounselor }] },
                    selectedRole === 'counselor' && styles.selectedCard,
                  ]}
                >
                  <View style={[styles.iconCircle, selectedRole === 'counselor' && styles.selectedIconCircle]}>
                    <Text style={styles.iconText}>👩‍⚕️</Text>
                  </View>
                  <Text style={[styles.roleLabel, selectedRole === 'counselor' && styles.selectedRoleLabel]}>counsellor</Text>
                  <Text style={styles.roleHint}>professional toolkit</Text>
                  <View style={styles.microDivider} />
                  <Text style={styles.footerNote}>guide</Text>
                  {selectedRole === 'counselor' && isLoading ? (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#f5576c" />
                    </View>
                  ) : null}
                </Animated.View>
              </TouchableOpacity>
            </View>
            
            {/* Bottom Actions - Exactly matching web version */}
            <View style={styles.bottomActions}>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>⚡ both paths</Text>
              </View>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>🕊️ unique</Text>
              </View>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>❔ help</Text>
              </View>
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
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 40,
    padding: SCREEN_WIDTH < 400 ? 20 : SCREEN_WIDTH < 500 ? 25 : 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT < 700 ? 30 : 40,
  },
  logo: {
    width: SCREEN_WIDTH < 400 ? 55 : 65,
    height: SCREEN_WIDTH < 400 ? 55 : 65,
    marginBottom: 15,
  },
  welcomeBadge: {
    fontSize: SCREEN_WIDTH < 400 ? 20 : SCREEN_WIDTH < 500 ? 22 : 24,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: SCREEN_WIDTH < 400 ? 13 : 15,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SCREEN_WIDTH < 400 ? 12 : SCREEN_WIDTH < 500 ? 16 : 20,
    marginBottom: SCREEN_HEIGHT < 700 ? 25 : 35,
  },
  cardContainer: {
    flex: 1,
    minWidth: SCREEN_WIDTH < 380 ? 130 : 150,
  },
  card: {
    borderRadius: 28,
    padding: SCREEN_WIDTH < 400 ? 16 : SCREEN_WIDTH < 500 ? 18 : 22,
    borderWidth: 2,
     backgroundColor: 'rgba(255, 255, 255, 0.95)',
    // backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  userCard: {
    borderColor: 'rgba(255, 255, 255, 0.75)',
    backgroundGradient: ['rgba(235, 247, 255, 0.85)', 'rgba(255, 255, 255, 0.9)'],
  },
  counselorCard: {
    borderColor: 'rgba(255, 255, 255, 0.75)',
  },
  selectedCard: {
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    transform: [{ scale: 1.02 }],
  },
  iconCircle: {
    width: SCREEN_WIDTH < 400 ? 55 : SCREEN_WIDTH < 500 ? 65 : 75,
    height: SCREEN_WIDTH < 400 ? 55 : SCREEN_WIDTH < 500 ? 65 : 75,
    borderRadius: SCREEN_WIDTH < 400 ? 27.5 : SCREEN_WIDTH < 500 ? 32.5 : 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH < 400 ? 12 : 15,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  selectedIconCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderColor: 'white',
  },
  iconText: {
    fontSize: SCREEN_WIDTH < 400 ? 32 : SCREEN_WIDTH < 500 ? 36 : 42,
  },
  roleLabel: {
    fontSize: SCREEN_WIDTH < 400 ? 18 : SCREEN_WIDTH < 500 ? 20 : 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    backgroundGradient: ['#667eea', '#764ba2'],
    color: '#1e293b',
  },
  selectedRoleLabel: {
    color: '#667eea',
  },
  roleHint: {
    fontSize: SCREEN_WIDTH < 400 ? 10 : SCREEN_WIDTH < 500 ? 11 : 12,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '500',
    // backgroundColor: 'rgba(255, 255, 240, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 40,
    overflow: 'hidden',
  },
  microDivider: {
    width: SCREEN_WIDTH < 400 ? 35 : 40,
    height: 2,
    backgroundColor: '#667eea',
    borderRadius: 1,
    marginVertical: 10,
    opacity: 0.5,
  },
  footerNote: {
    fontSize: SCREEN_WIDTH < 400 ? 9 : SCREEN_WIDTH < 500 ? 10 : 11,
    color: '#667eea',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SCREEN_WIDTH < 400 ? 8 : 12,
    paddingTop: SCREEN_WIDTH < 400 ? 15 : 20,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    flexWrap: 'wrap',
  },
  actionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: SCREEN_WIDTH < 400 ? 10 : 14,
    paddingVertical: SCREEN_WIDTH < 400 ? 6 : 8,
    borderRadius: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: SCREEN_WIDTH < 400 ? 10 : SCREEN_WIDTH < 500 ? 11 : 12,
    fontWeight: '500',
    color: '#2d3748',
  },
});

export default RoleSelector;