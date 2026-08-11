import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { isBiometricAvailable, authenticateWithBiometrics } from '../../../../../utils/biometrics';
import { PATIENT, DOCTOR } from '../../../../../theme/palette';
import useLanguageRender from '../../../../../hooks/useLanguageRender';

const PIN_STORAGE_KEY = 'appLockPin';
const BIOMETRIC_ENABLED_KEY = 'appLockBiometricEnabled';

const AppLockSettings = ({ navigation }) => {
  const { t } = useLanguageRender();
  const [hasPIN, setHasPIN] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState(null);
  const [loading, setLoading] = useState(true);
  // Role → palette: counselor = blue, everyone else = green.
  const [C, setC] = useState(PATIENT);

  useEffect(() => {
    checkSecurityStatus();
    (async () => {
      const [userRole, roleKey, userType] = await Promise.all([
        AsyncStorage.getItem('userRole'),
        AsyncStorage.getItem('role'),
        AsyncStorage.getItem('userType'),
      ]);
      const norm = (v) => String(v || '').trim().toLowerCase();
      const isCounselor = [userRole, roleKey, userType]
        .map(norm)
        .some((v) => v === 'counselor' || v === 'counsellor');
      setC(isCounselor ? DOCTOR : PATIENT);
    })();
  }, []);

  // Re-check after returning from PinSetup so the ACTIVE/INACTIVE state and the
  // Set/Change/Remove buttons reflect the PIN that was just created.
  useEffect(() => {
    const unsub = navigation.addListener('focus', checkSecurityStatus);
    return unsub;
  }, [navigation]);

  const checkSecurityStatus = async () => {
    try {
      const pin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      setHasPIN(!!pin);

      const bioEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setBiometricEnabled(bioEnabled === 'true');

      const { available, biometryType: type } = await isBiometricAvailable();
      setBiometricAvailable(available);
      setBiometryType(type);
    } catch (e) {
      console.error('Failed to check security status:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBiometric = async (value) => {
    if (value && !hasPIN) {
      Alert.alert(t('PIN Required'), t('Please set up a PIN first before enabling biometric unlock.'));
      return;
    }

    if (value && !biometricAvailable) {
      Alert.alert(t('Biometric Unavailable'), t('Your device does not support biometric authentication.'));
      return;
    }

    if (value) {
      // Test biometric before enabling
      try {
        const bioType = biometryType === 'FaceID' ? 'Face ID' : biometryType === 'TouchID' ? 'Touch ID' : 'Fingerprint';
        const { success } = await authenticateWithBiometrics(`Verify with ${bioType}`);
        if (success) {
          await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
          setBiometricEnabled(true);
          Alert.alert(t('Success'), t(`${bioType} unlock enabled successfully.`));
        }
      } catch (e) {
        Alert.alert(t('Error'), t('Failed to enable biometric authentication.'));
      }
    } else {
      await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      setBiometricEnabled(false);
      Alert.alert(t('Disabled'), t('Biometric unlock has been disabled.'));
    }
  };

  const handleChangePIN = () => {
    if (!hasPIN) {
      navigation.navigate('PinSetup', { forced: false });
    } else {
      Alert.alert(
        t('Change PIN'),
        t('Do you want to change your current PIN?'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Change PIN'),
            onPress: () => {
              // Clear PIN and let user set a new one
              AsyncStorage.removeItem(PIN_STORAGE_KEY).then(() => {
                navigation.navigate('PinSetup', { forced: false });
              });
            },
          },
        ]
      );
    }
  };

  const handleRemovePIN = () => {
    if (!hasPIN) return;
    Alert.alert(
      t('Remove PIN Protection'),
      t('Are you sure you want to remove PIN protection? Your app will be less secure.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(PIN_STORAGE_KEY);
            await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
            setHasPIN(false);
            setBiometricEnabled(false);
            Alert.alert(t('PIN Removed'), t('App lock has been disabled.'));
          },
        },
      ]
    );
  };

  const getBiometryLabel = () => {
    if (biometryType === 'FaceID') return 'Face ID';
    if (biometryType === 'TouchID') return 'Touch ID';
    return 'Fingerprint';
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.backgroundTint }]} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.backgroundTint} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('App Lock')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Security Status Card */}
        <TouchableOpacity style={s.statusCard} activeOpacity={0.8}>
          <LinearGradient
            colors={[C.gradientFrom, C.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.statusGradient}
          >
            <View style={s.statusContent}>
              <MaterialCommunityIcons name="shield-check" size={32} color="#ffffff" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={s.statusTitle}>
                  {hasPIN ? t('Protected') : t('Not Protected')}
                </Text>
                <Text style={s.statusSubtitle}>
                  {hasPIN
                    ? t('Your app is secured with PIN protection')
                    : t('Set up PIN and biometric to protect your account')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* PIN Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons name="numeric-4-box" size={24} color={C.primary} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={s.sectionTitle}>{t('PIN Lock')}</Text>
              <Text style={s.sectionSubtitle}>{hasPIN ? t('PIN is set') : t('No PIN set')}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: hasPIN ? `${C.primary}14` : '#f1f5f9' }]}>
              <Text style={[s.statusBadgeText, { color: hasPIN ? C.primary : '#94a3b8' }]}>
                {hasPIN ? t('ACTIVE') : t('INACTIVE')}
              </Text>
            </View>
          </View>

          <Text style={s.sectionDescription}>
            {hasPIN
              ? t('Your app is protected with a 4-digit PIN. You must enter this PIN to unlock the app.')
              : t('Set up a 4-digit PIN to lock and unlock the app. This is the first step to secure your account.')}
          </Text>

          <TouchableOpacity style={s.actionButtonWrap} onPress={handleChangePIN} activeOpacity={0.85}>
            <LinearGradient
              colors={[C.gradientFrom, C.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.actionButton}
            >
              <MaterialCommunityIcons name={hasPIN ? 'pencil' : 'plus'} size={20} color="#ffffff" />
              <Text style={s.actionButtonText}>{hasPIN ? t('Change PIN') : t('Set PIN')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {hasPIN && (
            <TouchableOpacity style={s.removeButton} onPress={handleRemovePIN} activeOpacity={0.8}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
              <Text style={s.removeButtonText}>{t('Remove PIN')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Biometric Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons
              name={biometryType === 'FaceID' ? 'face-recognition' : 'fingerprint'}
              size={24}
              color={biometricAvailable ? C.primary : '#cbd5e1'}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[s.sectionTitle, !biometricAvailable && { color: '#cbd5e1' }]}>
                {t(`${getBiometryLabel()} Unlock`)}
              </Text>
              <Text style={s.sectionSubtitle}>
                {biometricAvailable
                  ? t('Supported on this device')
                  : t('Not available on this device')}
              </Text>
            </View>
            <Switch
              value={biometricEnabled && biometricAvailable}
              onValueChange={handleToggleBiometric}
              disabled={!biometricAvailable || !hasPIN}
              trackColor={{ false: '#cbd5e1', true: C.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <Text style={s.sectionDescription}>
            {biometricAvailable
              ? t(`Enable ${getBiometryLabel()} to unlock the app without entering your PIN. This requires PIN to be set first.`)
              : t(`${getBiometryLabel()} is not available on your device. Ensure your device has biometric sensors enabled.`)}
          </Text>

          {biometricAvailable && biometricEnabled && (
            <View style={[s.enabledInfo, { backgroundColor: `${C.primary}14` }]}>
              <Ionicons name="checkmark-circle" size={18} color={C.primary} />
              <Text style={[s.enabledInfoText, { color: C.primary }]}>
                {t(`${getBiometryLabel()} is enabled and ready to use`)}
              </Text>
            </View>
          )}

          {biometricAvailable && !biometricEnabled && hasPIN && (
            <View style={s.disabledInfo}>
              <Ionicons name="information-circle" size={18} color="#f59e0b" />
              <Text style={s.disabledInfoText}>
                {t(`Enable ${getBiometryLabel()} for faster, more convenient unlocking`)}
              </Text>
            </View>
          )}
        </View>

        {/* Security Tips */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('Security Tips')}</Text>
          {[
            { icon: 'lightbulb-outline', text: 'Use a unique PIN that is hard to guess' },
            { icon: 'shield-outline', text: 'Keep your biometric data secure' },
            { icon: 'lock-outline', text: 'Regularly review your security settings' },
            { icon: 'bell-outline', text: 'Update the app for latest security patches' },
          ].map((tip, idx) => (
            <View key={idx} style={s.tipRow}>
              <MaterialCommunityIcons name={tip.icon} size={18} color={C.primary} />
              <Text style={s.tipText}>{t(tip.text)}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  scroll: { flex: 1 },

  statusCard: { marginHorizontal: 16, marginVertical: 16, borderRadius: 16, overflow: 'hidden' },
  statusGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18 },
  statusContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginBottom: 2 },
  statusSubtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.9)' },

  section: { backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sectionDescription: { fontSize: 13, color: '#64748b', fontWeight: '500', marginBottom: 14, lineHeight: 20 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusBadgeActive: { backgroundColor: '#E6F6EC' },
  statusBadgeInactive: { backgroundColor: '#f1f5f9' },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  statusBadgeTextActive: { color: PATIENT.primary },
  statusBadgeTextInactive: { color: '#94a3b8' },

  actionButtonWrap: { marginTop: 12 },
  actionButton: {
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },

  removeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  removeButtonText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },

  enabledInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E6F6EC', borderRadius: 10, padding: 12, marginTop: 12 },
  enabledInfoText: { fontSize: 12, fontWeight: '600', color: PATIENT.primary, flex: 1 },

  disabledInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginTop: 12 },
  disabledInfoText: { fontSize: 12, fontWeight: '600', color: '#b45309', flex: 1 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tipText: { fontSize: 13, fontWeight: '500', color: '#64748b', flex: 1 },
});

export default AppLockSettings;
