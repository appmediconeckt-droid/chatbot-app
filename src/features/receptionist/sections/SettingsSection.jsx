import AppVersionFooter from '../../../components/common/AppVersionFooter';
import { formatPhoneNumber } from '../../../utils/countryCodes';
// Settings — the web ReceptionistSettings: account information and password &
// security (POST /api/auth/changePassword, then sign in again). Logout is in
// the side menu.
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../components/TranslatedText';
import { AlertBox, Card, DetailFields, Notice, NoticeText, REC, RecButton } from '../receptionistUi';
import { apiError, changePassword } from '../receptionistApi';
import { PASSWORD_RULES } from '../receptionistUtils';

const FIELDS = [
  ['oldPassword', 'Current password'],
  ['newPassword', 'New password'],
  ['confirmation', 'Confirm new password'],
];

function SectionTitle({ icon, tone, title, subtitle, right }) {
  return (
    <View style={s.titleRow}>
      <View style={[s.titleIcon, { backgroundColor: tone.bg }]}><Ionicons name={icon} size={20} color={tone.fg} /></View>
      <View style={s.flex}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

export default function SettingsSection({ profile, onNavigate, onPasswordChanged }) {
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmation: '' });
  const [visible, setVisible] = useState({});
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const updatePassword = (key, value) => {
    setPasswords((current) => ({ ...current, [key]: value }));
    setPasswordError('');
  };

  const submitPassword = async () => {
    if (busy) return;
    setPasswordError('');
    if (!PASSWORD_RULES.every(([, valid]) => valid(passwords.newPassword))) {
      setPasswordError('Your new password must meet all five requirements below.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmation) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (passwords.oldPassword === passwords.newPassword) {
      setPasswordError('Choose a new password different from your current password.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(passwords.oldPassword, passwords.newPassword);
      onPasswordChanged?.();
    } catch (err) {
      setPasswordError(apiError(err, 'Password could not be changed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <SectionTitle
          icon="person-outline"
          tone={{ bg: '#E3F6F2', fg: '#1C9686' }}
          title="Account information"
          subtitle="Your receptionist account and clinic assignment."
          right={(
            <Pressable onPress={() => onNavigate('profile')} hitSlop={6}>
              <Text style={s.link}>View profile</Text>
            </Pressable>
          )}
        />
        <DetailFields fields={[
          ['Full name', profile.fullName],
          ['Email address', profile.email],
          ['Phone number', formatPhoneNumber(profile.phoneNumber || profile.phone, profile.phoneCountryCode)],
          ['Role', 'Receptionist'],
          ['Assigned doctor', profile.assignedDoctorName],
          ['Assigned clinic', profile.clinic_name],
        ]} />
        <Notice icon="shield-checkmark-outline">
          <NoticeText>Your doctor manages your account details, staff role and clinic assignment.</NoticeText>
        </Notice>
      </Card>

      <Card>
        <SectionTitle icon="lock-closed-outline" tone={{ bg: '#E8F1FF', fg: '#3975C7' }} title="Password & security" subtitle="Update the password you use to sign in." />
        {FIELDS.map(([key, label]) => (
          <View key={key} style={s.field}>
            <Text style={s.fieldLabel}>{label}</Text>
            <View style={s.passwordInput}>
              <TextInput
                value={passwords[key]}
                onChangeText={(value) => updatePassword(key, value)}
                secureTextEntry={!visible[key]}
                editable={!busy}
                autoCapitalize="none"
                placeholder={label}
                placeholderTextColor="#94A3B8"
                style={s.input}
              />
              <Pressable onPress={() => setVisible((current) => ({ ...current, [key]: !current[key] }))} hitSlop={8}>
                <Ionicons name={visible[key] ? 'eye-off-outline' : 'eye-outline'} size={19} color={REC.muted} />
              </Pressable>
            </View>
          </View>
        ))}
        <View style={s.rules}>
          {PASSWORD_RULES.map(([label, valid]) => {
            const met = Boolean(passwords.newPassword) && valid(passwords.newPassword);
            return (
              <View key={label} style={s.rule}>
                <Ionicons name="checkmark" size={13} color={met ? '#298D69' : '#98A7B2'} />
                <Text style={[s.ruleText, met && s.ruleMet]}>{label}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.gap}><AlertBox text={passwordError} /></View>
        <View style={s.inline}>
          <Ionicons name="shield-checkmark-outline" size={15} color={REC.muted} />
          <Text style={s.hint}>After saving, sign in again with your new password.</Text>
        </View>
        <View style={s.actions}>
          <RecButton
            label="Clear"
            disabled={busy}
            onPress={() => { setPasswords({ oldPassword: '', newPassword: '', confirmation: '' }); setVisible({}); setPasswordError(''); }}
            style={s.flex}
          />
          <RecButton primary label={busy ? 'Updating...' : 'Update password'} disabled={busy} onPress={submitPassword} style={s.flex} />
        </View>
      </Card>

      {/* Logout is in the side menu. */}
      <AppVersionFooter />
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { marginTop: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  titleIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: REC.ink },
  subtitle: { fontSize: 12, color: REC.muted, marginTop: 2 },
  link: { fontSize: 13, fontWeight: '700', color: REC.primary },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: REC.muted, marginBottom: 6 },
  passwordInput: { height: 46, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 9, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontSize: 14, color: REC.ink, paddingVertical: 0 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, padding: 12, borderRadius: 8, backgroundColor: '#F8FAFB' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleText: { fontSize: 11, color: '#98A7B2' },
  ruleMet: { color: '#298D69', fontWeight: '600' },
  hint: { fontSize: 12, color: REC.muted, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
