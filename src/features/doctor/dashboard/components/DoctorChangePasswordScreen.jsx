import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import axiosInstance from '../../../../axiosConfig';

const REQUIREMENTS = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'number', label: 'At least one number', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'At least one special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function DoctorChangePasswordScreen({ onBack, onPasswordChanged }) {
  const { showToast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const metRequirements = REQUIREMENTS.map((req) => ({ ...req, met: req.test(next) }));
  const allMet = metRequirements.every((req) => req.met);
  const canSubmit = current.length > 0 && allMet && confirm.length > 0 && confirm === next && !submitting;

  const handleUpdate = async () => {
    if (!current) return showToast('Enter your current password');
    if (!allMet) return showToast('New password does not meet all requirements');
    if (confirm !== next) return showToast('Passwords do not match');
    try {
      setSubmitting(true);
      await axiosInstance.post('/api/auth/changePassword', {
        oldPassword: current,
        newPassword: next,
      });
      showToast('Password updated');
      setCurrent('');
      setNext('');
      setConfirm('');
      // Web parity: the server ends the session on password change — sign in again.
      onPasswordChanged?.();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to update password';
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Change Password</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Your password must be at least 8 characters long and include a combination of numbers, letters, and special characters.
            </Text>
          </View>

          <Text style={s.label}>Current Password</Text>
          <View style={s.inputWrap}>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              placeholder="Enter current password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showCurrent}
              style={s.input}
            />
            <Pressable onPress={() => setShowCurrent((v) => !v)} hitSlop={8}>
              <AppIcon name={showCurrent ? 'eye' : 'eye-off'} size={19} color="#7B8493" strokeWidth={1.8} />
            </Pressable>
          </View>
          <Pressable onPress={() => showToast('Password reset link sent')} style={s.forgotWrap}>
            <Text style={s.forgot}>Forgot Password?</Text>
          </Pressable>

          <View style={s.divider} />

          <Text style={s.label}>New Password</Text>
          <View style={s.inputWrap}>
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder="Create new password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showNext}
              style={s.input}
            />
            <Pressable onPress={() => setShowNext((v) => !v)} hitSlop={8}>
              <AppIcon name={showNext ? 'eye' : 'eye-off'} size={19} color="#7B8493" strokeWidth={1.8} />
            </Pressable>
          </View>

          <View style={s.requirements}>
            <Text style={s.requirementsTitle}>Password Requirements</Text>
            {metRequirements.map((req) => (
              <View key={req.key} style={s.requirementRow}>
                <AppIcon name="check" size={15} color={req.met ? '#0D9488' : '#B0B9C6'} strokeWidth={2} />
                <Text style={[s.requirementText, req.met && s.requirementTextMet]}>{req.label}</Text>
              </View>
            ))}
          </View>

          <Text style={s.label}>Confirm New Password</Text>
          <View style={s.inputWrap}>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter new password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showConfirm}
              style={s.input}
            />
            <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
              <AppIcon name={showConfirm ? 'eye' : 'eye-off'} size={19} color="#7B8493" strokeWidth={1.8} />
            </Pressable>
          </View>

          <Pressable onPress={handleUpdate} disabled={!canSubmit} style={[s.submit, !canSubmit && s.submitDisabled]}>
            <Text style={s.submitText}>{submitting ? 'Updating…' : 'Update Password'}</Text>
            <AppIcon name="check-mark" size={15} color="#FFF" strokeWidth={2.4} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C8D1DF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  infoBox: { backgroundColor: '#F1F4F8', borderRadius: 10, padding: 12, marginBottom: 18 },
  infoText: { fontSize: 12.5, lineHeight: 18, color: '#526078' },
  label: { fontSize: 13, fontWeight: '700', color: '#344054', marginBottom: 7 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderColor: '#D5DAE3',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: '#17243A' },
  forgotWrap: { alignSelf: 'flex-end', marginTop: 9 },
  forgot: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  divider: { height: 1, backgroundColor: '#EEF1F5', marginVertical: 18 },
  requirements: { backgroundColor: '#F0FDFA', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 18, gap: 8 },
  requirementsTitle: { fontSize: 13, fontWeight: '700', color: '#17243A', marginBottom: 2 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requirementText: { fontSize: 12.5, color: '#7B8493' },
  requirementTextMet: { color: '#0D9488', fontWeight: '600' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    marginTop: 6,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
