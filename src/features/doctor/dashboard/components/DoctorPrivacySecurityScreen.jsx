import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import DoctorChangePasswordScreen from './DoctorChangePasswordScreen';

const DEVICES = [
  { icon: 'smartphone', name: 'iPhone 13 Pro', detail: 'Current Session', current: true },
  { icon: 'laptop', name: 'MacBook Pro', detail: 'Last active: 2 hours ago', current: false },
];

export default function DoctorPrivacySecurityScreen({ onBack }) {
  const { showToast } = useToast();
  const [view, setView] = useState('list');
  const [twoFactor, setTwoFactor] = useState(true);
  const [biometric, setBiometric] = useState(false);

  const notify = (text) => showToast(text);

  if (view === 'changePassword') {
    return <DoctorChangePasswordScreen onBack={() => setView('list')} />;
  }

  const revokeDevice = (name) => {
    Alert.alert('Log Out Device', `Log out "${name}" from your account?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => notify(`${name} logged out`) },
    ]);
  };

  const logoutAllDevices = () => {
    Alert.alert('Log Out of All Devices', 'This will sign you out everywhere except this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out All', style: 'destructive', onPress: () => notify('Logged out of all other devices') },
    ]);
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Security & Privacy</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <Section icon="lock" label="Login Security">
          <Row
            icon="lock"
            title="Change Password"
            subtitle="Last changed: Oct 12, 2023"
            onPress={() => setView('changePassword')}
          />
          <Row
            icon="shield"
            title="Two-Factor Authentication"
            subtitle="Add an extra layer of security"
            last
            control={
              <Switch
                value={twoFactor}
                onValueChange={(v) => { setTwoFactor(v); notify(v ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled'); }}
                trackColor={{ false: '#D5DAE3', true: '#2DD4BF' }}
                thumbColor="#FFF"
              />
            }
          />
        </Section>

        <Section icon="fingerprint" label="Biometric Access">
          <Row
            icon="fingerprint"
            title="Face ID / Touch ID"
            subtitle="Use biometrics to login"
            last
            control={
              <Switch
                value={biometric}
                onValueChange={(v) => { setBiometric(v); notify(v ? 'Biometric login enabled' : 'Biometric login disabled'); }}
                trackColor={{ false: '#D5DAE3', true: '#2DD4BF' }}
                thumbColor="#FFF"
              />
            }
          />
        </Section>

        <Section icon="shield" label="Data & Privacy">
          <Row
            icon="shield"
            title="Manage Health Data Sharing"
            subtitle="Control who sees your records"
            onPress={() => notify('Manage Health Data Sharing — coming soon')}
          />
          <Row
            icon="file"
            title="Privacy Policy"
            subtitle="Read our commitment to privacy"
            onPress={() => notify('Privacy Policy — coming soon')}
          />
          <Row
            icon="download"
            title="Request Data Export"
            subtitle="Download a copy of your data"
            last
            onPress={() => notify('Data export requested')}
          />
        </Section>

        <Section icon="smartphone" label="Device Management">
          {DEVICES.map((device, index) => (
            <View key={device.name} style={[s.row, index === DEVICES.length - 1 && s.rowLast]}>
              <View style={s.rowIcon}>
                <AppIcon name={device.icon} size={18} color="#0D9488" strokeWidth={1.9} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>{device.name}</Text>
                {device.current ? (
                  <View style={s.currentBadge}><Text style={s.currentBadgeText}>Current Session</Text></View>
                ) : (
                  <Text style={s.rowSubtitle}>{device.detail}</Text>
                )}
              </View>
              {!device.current && (
                <Pressable onPress={() => revokeDevice(device.name)} hitSlop={8} style={s.revokeBtn}>
                  <AppIcon name="logout" size={16} color="#DC2626" strokeWidth={2} />
                </Pressable>
              )}
            </View>
          ))}
        </Section>

        <Pressable onPress={logoutAllDevices} style={s.logoutAll}>
          <AppIcon name="logout" size={17} color="#FFF" strokeWidth={2} />
          <Text style={s.logoutAllText}>Log Out of All Devices</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ label, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle, last, control, onPress }) {
  const content = (
    <>
      <View style={s.rowIcon}>
        <AppIcon name={icon} size={18} color="#0D9488" strokeWidth={1.9} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      {control || (onPress && <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />)}
    </>
  );
  if (control) {
    return <View style={[s.row, last && s.rowLast]}>{content}</View>;
  }
  return (
    <Pressable onPress={onPress} style={[s.row, last && s.rowLast]}>
      {content}
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: '#667085', marginBottom: 10, marginLeft: 2, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C8D1DF',
    borderRadius: 14,
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF1F5', gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  rowSubtitle: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  currentBadge: { alignSelf: 'flex-start', backgroundColor: '#D9FAE8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3 },
  currentBadgeText: { fontSize: 11.5, fontWeight: '700', color: '#139A5B' },
  revokeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  logoutAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    marginTop: 4,
  },
  logoutAllText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
