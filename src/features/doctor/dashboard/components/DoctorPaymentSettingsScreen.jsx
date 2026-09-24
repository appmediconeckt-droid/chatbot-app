// Payment settings — port of the web Setting/PaymentSetting/PaymentSettings.jsx.
// The web has no payment-settings API: it keeps these per doctor on the device
// under `doctorPaymentSettings:<doctorId>`. The app does the same in AsyncStorage.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';

const DEFAULT_SETTINGS = {
  onlinePayment: true,
  upiBank: false,
  cash: true,
  upiId: '',
  accountHolder: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
};

const METHODS = [
  { key: 'onlinePayment', title: 'Online Payment', description: 'Accept card and online appointment payments.', icon: 'smartphone' },
  { key: 'upiBank', title: 'UPI / Bank Transfer', description: 'Accept payments using UPI or bank account details.', icon: 'briefcase' },
  { key: 'cash', title: 'Cash Payment', description: 'Allow patients to pay cash at the clinic.', icon: 'note' },
];

export default function DoctorPaymentSettingsScreen({ onBack }) {
  const { showToast } = useToast();
  const [storageKey, setStorageKey] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStoredDoctorUser().then(async (user) => {
      const doctorId = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, 'doctor');
      const key = `doctorPaymentSettings:${doctorId}`;
      setStorageKey(key);
      try {
        const stored = JSON.parse((await AsyncStorage.getItem(key)) || 'null');
        if (stored) setSettings({ ...DEFAULT_SETTINGS, ...stored });
      } catch {
        setError('Saved payment settings could not be read.');
      }
    });
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError('');
  };

  const validate = () => {
    if (!settings.onlinePayment && !settings.upiBank && !settings.cash) return 'Keep at least one payment method available.';
    if (settings.upiBank && !settings.upiId.trim()
      && !(settings.accountHolder.trim() && settings.accountNumber.trim() && settings.ifscCode.trim())) {
      return 'Enter a UPI ID or complete bank account details.';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
      setSaved(true);
      setError('');
      showToast('Payment settings saved');
    } catch {
      setError('Payment settings could not be saved.');
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Payment Settings</Text>
          <Text style={s.subtitle}>Choose how patients can pay for appointments and consultations.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.secure}>
          <AppIcon name="shield" size={14} color="#0D9488" />
          <Text style={s.secureText}>Secure settings</Text>
        </View>
        {METHODS.map((method) => {
          const enabled = settings[method.key];
          return (
            <View key={method.key} style={[s.method, enabled && s.methodOn]}>
              <View style={s.methodIcon}><AppIcon name={method.icon} size={18} color="#0D9488" /></View>
              <View style={s.flex}>
                <Text style={s.methodTitle}>{method.title}</Text>
                <Text style={s.methodDesc}>{method.description}</Text>
                <Text style={[s.status, enabled ? s.statusOn : s.statusOff]}>{enabled ? 'Available' : 'Unavailable'}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(v) => updateSetting(method.key, v)}
                trackColor={{ false: '#D5DAE3', true: '#99E6DC' }}
                thumbColor={enabled ? '#0D9488' : '#FFFFFF'}
              />
            </View>
          );
        })}

        {settings.upiBank && (
          <View style={s.card}>
            <Text style={s.cardTitle}>UPI & Bank Details</Text>
            <Text style={s.methodDesc}>Enter either a UPI ID or bank account details.</Text>
            <Field label="UPI ID" value={settings.upiId} onChangeText={(v) => updateSetting('upiId', v)} placeholder="doctor@upi" />
            <Field label="Account Holder" value={settings.accountHolder} onChangeText={(v) => updateSetting('accountHolder', v)} placeholder="Account holder name" />
            <Field label="Bank Name" value={settings.bankName} onChangeText={(v) => updateSetting('bankName', v)} placeholder="Bank name" />
            <Field label="Account Number" value={settings.accountNumber} onChangeText={(v) => updateSetting('accountNumber', v.replace(/\D/g, ''))} placeholder="Account number" keyboardType="number-pad" />
            <Field label="IFSC Code" value={settings.ifscCode} onChangeText={(v) => updateSetting('ifscCode', v.toUpperCase().slice(0, 11))} placeholder="ABCD0123456" autoCapitalize="characters" />
          </View>
        )}

        {!!error && <Text style={s.error}>{error}</Text>}
        {saved && !error && <Text style={s.saved}>Payment settings saved.</Text>}
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={handleSave} style={s.saveWrap} disabled={!storageKey}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
            <Text style={s.saveText}>Save Payment Settings</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Field({ label, ...inputProps }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor="#94A3B8" {...inputProps} />
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { minHeight: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  subtitle: { fontSize: 12, color: '#667085', marginTop: 2 },
  content: { padding: 16, paddingBottom: 24 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#E6FBF8', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  secureText: { fontSize: 12, fontWeight: '700', color: '#0D9488' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14, marginBottom: 10 },
  methodOn: { borderColor: '#0D9488' },
  methodIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  methodDesc: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  status: { fontSize: 11.5, fontWeight: '700', marginTop: 5 },
  statusOn: { color: '#16A36A' },
  statusOff: { color: '#98A2B3' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14, marginTop: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  field: { marginTop: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 12, fontSize: 13.5, color: '#17243A' },
  error: { fontSize: 13, color: '#DC2626', marginTop: 12 },
  saved: { fontSize: 13, color: '#16A36A', marginTop: 12 },
  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9' },
  saveWrap: {},
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
});
