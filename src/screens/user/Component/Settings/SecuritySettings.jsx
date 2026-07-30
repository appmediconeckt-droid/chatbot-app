import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import PATIENT from '../../../../theme/palette';
import useLanguageRender from '../../../../hooks/useLanguageRender';

const SecuritySettings = ({ navigation }) => {
  const { t } = useLanguageRender();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(true);

  const passwordStrength = {
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*]/.test(newPassword),
  };

  const strengthCount = Object.values(passwordStrength).filter(Boolean).length;
  const strengthColor = strengthCount === 0 ? '#cbd5e1' : strengthCount < 2 ? '#f59e0b' : '#00652C';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('Security')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Security Center */}
        <View style={s.section}>
          <View style={s.securityHeader}>
            <View style={s.securityIconBox}>
              <Ionicons name="shield-checkmark" size={28} color={PATIENT.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.securityTitle}>{t('Security Center')}</Text>
              <Text style={s.securitySubtitle}>{t('Keep your account protection and authentication secure')}</Text>
            </View>
          </View>

          <View style={s.securityStatus}>
            <View style={s.statusLeft}>
              <Text style={s.statusLabel}>{t('Protected')}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: PATIENT.primary }]}>
              <Text style={s.statusBadgeText}>{t('Score: 87%')}</Text>
            </View>
          </View>

          <View style={s.securityChecks}>
            {[
              { icon: 'checkmark-circle', label: 'Two-factor auth active' },
              { icon: 'checkmark-circle', label: 'Strong password set' },
              { icon: 'checkmark-circle', label: 'Biometrics enabled' },
            ].map((item, idx) => (
              <View key={idx} style={s.checkItem}>
                <Ionicons name={item.icon} size={18} color={PATIENT.primary} />
                <Text style={s.checkLabel}>{t(item.label)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Account Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('ACCOUNT INFO')}</Text>

          <View style={s.accountCard}>
            <Image
              source={{ uri: 'https://ui-avatars.com/api/?name=Rohan&background=0f172a&color=ffffff' }}
              style={s.accountAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.accountName}>{t('Rohan')}</Text>
              <Text style={s.accountType}>{t('Personal Account')}</Text>
            </View>
          </View>

          {[
            { icon: 'mail-outline', label: 'Email', value: 'vishnumahar3536@gmail.com' },
            { icon: 'phone-portrait-outline', label: 'Phone', value: '6701424686' },
            { icon: 'log-in-outline', label: 'Login via', value: 'Email & Password' },
          ].map((item, idx) => (
            <View key={idx} style={s.infoRow}>
              <Ionicons name={item.icon} size={18} color={PATIENT.primary} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.infoLabel}>{t(item.label)}</Text>
                <Text style={s.infoValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Password Security */}
        <View style={s.section}>
          <View style={s.passwordHeader}>
            <Text style={s.sectionTitle}>{t('Password Security')}</Text>
            <TouchableOpacity>
              <Text style={s.cancelBtn}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.passwordSubtitle}>{t('Update your current password')}</Text>

          {/* Current Password */}
          <View style={s.inputBox}>
            <Text style={s.inputLabel}>{t('Current Password')}</Text>
            <View style={s.inputWrapper}>
              <TextInput
                style={s.input}
                placeholder={t('••••••••••••')}
                placeholderTextColor="#cbd5e1"
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Ionicons
                  name={showCurrentPassword ? 'eye' : 'eye-off'}
                  size={18}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            </View>
            <Text style={s.inputHint}>{t('Updated 2 mos ago')}</Text>
          </View>

          {/* New Password */}
          <View style={s.inputBox}>
            <Text style={s.inputLabel}>{t('New Password')}</Text>
            <View style={s.inputWrapper}>
              <TextInput
                style={s.input}
                placeholder={t('Enter new password')}
                placeholderTextColor="#cbd5e1"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons
                  name={showNewPassword ? 'eye' : 'eye-off'}
                  size={18}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            </View>

            {/* Strength Indicator */}
            <View style={s.strengthBox}>
              <View style={[s.strengthBar, { backgroundColor: strengthColor, width: `${(strengthCount / 3) * 100}%` }]} />
            </View>

            {/* Requirements */}
            <View style={s.requirementsRow}>
              <View style={s.requirementItem}>
                <Ionicons
                  name={passwordStrength.uppercase ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={passwordStrength.uppercase ? PATIENT.primary : '#cbd5e1'}
                />
                <Text style={[s.requirementText, passwordStrength.uppercase && { color: PATIENT.primary }]}>
                  Uppercase
                </Text>
              </View>
              <View style={s.requirementItem}>
                <Ionicons
                  name={passwordStrength.number ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={passwordStrength.number ? PATIENT.primary : '#cbd5e1'}
                />
                <Text style={[s.requirementText, passwordStrength.number && { color: PATIENT.primary }]}>
                  Number
                </Text>
              </View>
              <View style={s.requirementItem}>
                <Ionicons
                  name={passwordStrength.special ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={passwordStrength.special ? PATIENT.primary : '#cbd5e1'}
                />
                <Text style={[s.requirementText, passwordStrength.special && { color: PATIENT.primary }]}>
                  Special char
                </Text>
              </View>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={s.inputBox}>
            <Text style={s.inputLabel}>{t('Confirm Password')}</Text>
            <View style={s.inputWrapper}>
              <TextInput
                style={s.input}
                placeholder={t('Confirm new password')}
                placeholderTextColor="#cbd5e1"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          </View>

          {/* Save Changes Button */}
          <TouchableOpacity activeOpacity={0.85}>
            <LinearGradient
              colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.saveBtn}
            >
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={s.saveBtnText}>{t('Save Changes')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* App Lock */}
        <View style={s.section}>
          <View style={s.appLockRow}>
            <View>
              <Text style={s.appLockTitle}>{t('App Lock')}</Text>
              <Text style={s.appLockSubtitle}>{t('Face & PIN protection')}</Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={setAppLockEnabled}
              trackColor={{ false: '#cbd5e1', true: PATIENT.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Save Security Settings */}
        <TouchableOpacity activeOpacity={0.85} style={s.saveSecurityBtn}>
          <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
          <Text style={s.saveSecurityBtnText}>{t('Save Security Settings')}</Text>
        </TouchableOpacity>

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

  section: { backgroundColor: '#ffffff', marginHorizontal: 12, marginTop: 14, borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },

  securityHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  securityIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: PATIENT.backgroundTint, alignItems: 'center', justifyContent: 'center' },
  securityTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  securitySubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

  securityStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PATIENT.backgroundTint, padding: 12, borderRadius: 10 },
  statusLeft: { gap: 6 },
  statusLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  securityChecks: { gap: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkLabel: { fontSize: 13, fontWeight: '500', color: '#0f172a' },

  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PATIENT.backgroundTint, padding: 12, borderRadius: 10, marginBottom: 12 },
  accountAvatar: { width: 40, height: 40, borderRadius: 20 },
  accountName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  accountType: { fontSize: 12, color: '#64748b', marginTop: 2 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 4 },

  passwordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  passwordSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 14 },
  cancelBtn: { fontSize: 12, fontWeight: '700', color: '#ef4444' },

  inputBox: { marginVertical: 10 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: PATIENT.backgroundTint, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 44 },
  input: { flex: 1, fontSize: 13, color: '#0f172a', fontWeight: '500', paddingVertical: 12 },
  inputHint: { fontSize: 11, color: '#94a3b8', marginTop: 6 },

  strengthBox: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginVertical: 10, overflow: 'hidden' },
  strengthBar: { height: 4, borderRadius: 2 },

  requirementsRow: { flexDirection: 'row', gap: 16, marginVertical: 10 },
  requirementItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requirementText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, paddingVertical: 14, marginTop: 14 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

  appLockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appLockTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  appLockSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

  saveSecurityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: PATIENT.primary, borderRadius: 12, paddingVertical: 14, marginHorizontal: 12, marginVertical: 14 },
  saveSecurityBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
});

export default SecuritySettings;
