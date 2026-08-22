import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useLanguageRender from '../../hooks/useLanguageRender';

const modeContent = {
  change: {
    icon: 'lock-reset',
    title: 'Change Password',
    subtitle: 'Confirm your current password, then choose a new one.',
    button: 'Change Password',
    passwordLabel: 'New Password',
  },
  set: {
    icon: 'enhanced-encryption',
    title: 'Add Password',
    subtitle: 'Create a password for this account so you can sign in securely.',
    button: 'Save Password',
    passwordLabel: 'Password',
  },
  setByOtp: {
    icon: 'mark-email-read',
    title: 'Set Password',
    subtitle: 'Enter your email, OTP, and create a new password.',
    button: 'Set Password',
    passwordLabel: 'Password',
  },
};

const PasswordForm = ({ mode = 'change', onSubmit }) => {
  const { t } = useLanguageRender();
  const copy = modeContent[mode] || modeContent.change;
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const strengthText = ['Too short', 'Basic', 'Good', 'Strong', 'Very strong'][strength];

  const validate = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'setByOtp' && !cleanEmail) {
      Alert.alert('Validation', 'Please enter your email address');
      return false;
    }
    if (mode === 'setByOtp' && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return false;
    }
    if (mode === 'setByOtp' && otp.length !== 6) {
      Alert.alert('Validation', 'Please enter the 6-digit OTP');
      return false;
    }
    if (mode === 'change' && !oldPassword) {
      Alert.alert('Validation', 'Please enter your current password');
      return false;
    }
    if (!password) {
      Alert.alert('Validation', 'Please enter a password');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters');
      return false;
    }
    if (password !== confirm) {
      Alert.alert('Validation', 'Passwords do not match');
      return false;
    }
    if (mode === 'change' && oldPassword === password) {
      Alert.alert('Validation', 'New password must be different from current password');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit?.({
        email: email.trim().toLowerCase(),
        otp,
        oldPassword,
        password,
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordInput = ({
    label,
    value,
    onChangeText,
    visible,
    onToggle,
    placeholder,
  }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Icon name="lock-outline" size={20} color="#64748b" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          returnKeyType="next"
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeButton}>
          <Icon name={visible ? 'visibility-off' : 'visibility'} size={20} color="#64748b" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Icon name={copy.icon} size={28} color="#2563eb" />
          </View>
          <Text style={styles.title}>{t(copy.title)}</Text>
          <Text style={styles.subtitle}>{t(copy.subtitle)}</Text>
        </View>

        <View style={styles.card}>
          {mode === 'setByOtp' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t('Email')}</Text>
                <View style={styles.inputShell}>
                  <Icon name="alternate-email" size={20} color="#64748b" />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={t('user@example.com')}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t('OTP Code')}</Text>
                <View style={styles.inputShell}>
                  <Icon name="pin" size={20} color="#64748b" />
                  <TextInput
                    value={otp}
                    onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                    style={styles.input}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    maxLength={6}
                    placeholder={t('Enter 6-digit OTP')}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </>
          )}

          {mode === 'change' &&
            renderPasswordInput({
              label: 'Current Password',
              value: oldPassword,
              onChangeText: setOldPassword,
              visible: showOldPassword,
              onToggle: () => setShowOldPassword((value) => !value),
              placeholder: 'Enter current password',
            })}

          {renderPasswordInput({
            label: copy.passwordLabel,
            value: password,
            onChangeText: setPassword,
            visible: showPassword,
            onToggle: () => setShowPassword((value) => !value),
            placeholder: 'Minimum 6 characters',
          })}

          <View style={styles.strengthRow}>
            {[0, 1, 2, 3].map((item) => (
              <View
                key={item}
                style={[
                  styles.strengthBar,
                  item < strength && styles.strengthBarActive,
                  strength >= 3 && item < strength && styles.strengthBarStrong,
                ]}
              />
            ))}
          </View>
          <Text style={styles.hint}>{password ? strengthText : 'Use letters and numbers for a stronger password'}</Text>

          {renderPasswordInput({
            label: 'Confirm Password',
            value: confirm,
            onChangeText: setConfirm,
            visible: showConfirm,
            onToggle: () => setShowConfirm((value) => !value),
            placeholder: 'Re-enter password',
          })}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>{copy.button}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingVertical: 12,
  },
  eyeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: -2,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  strengthBarActive: {
    backgroundColor: '#f59e0b',
  },
  strengthBarStrong: {
    backgroundColor: '#10b981',
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 14,
  },
  button: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default PasswordForm;
