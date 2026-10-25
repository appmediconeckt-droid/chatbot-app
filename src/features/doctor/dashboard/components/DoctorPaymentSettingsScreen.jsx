// Payment settings — port of the web Setting/PaymentSetting/PaymentSettings.jsx.
// Which methods the doctor accepts is saved on the server:
//   GET   /api/auth/me                  → user.acceptedPaymentMethods
//   PATCH /api/auth/update/:id          { acceptedPaymentMethods: ['online' | 'upi' | 'cash'] }
// (the same values the web's Appointment List uses; patients see 'online' as
// "Credit/Debit Card" and 'upi' as "UPI Payment"). The bank account card
// payments settle to and the UPI ID have no server field, so they stay on this
// device under `doctorPaymentSettings:<doctorId>`, as on the web.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getStoredDoctorUser, pickFirst, saveDoctorUser } from '../api/doctorAppointments';
import axiosInstance from '../../../../axiosConfig';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';

// Keys are kept from the earlier screen so saved settings still load.
const DEFAULT_SETTINGS = {
  onlinePayment: true,
  upiBank: false,
  cash: true,
  upiId: '',
  upiApp: '',
  accountHolder: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
};

// `value` is the server's name for the method.
const METHODS = [
  {
    key: 'onlinePayment', value: 'online', title: 'Credit / Debit Card', icon: 'card-outline', fg: '#4F46E5', bg: '#EEF2FF',
    description: 'Patients pay by credit or debit card while booking.', brands: ['VISA', 'Mastercard', 'RuPay'],
  },
  {
    key: 'upiBank', value: 'upi', title: 'UPI', icon: 'qr-code-outline', fg: '#0D9488', bg: '#E6FBF8',
    description: 'Patients pay to your UPI ID from any UPI app.',
  },
  {
    key: 'cash', value: 'cash', title: 'Cash at Clinic', icon: 'cash-outline', fg: '#B45309', bg: '#FEF3C7',
    description: 'Patients pay at the clinic reception. Offered for in-clinic visits only.',
  },
];

const UPI_PATTERN = /^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// The doctor's UPI app, as checkout pages list them. `handles` are the
// common UPI ID endings for that app; the first one is the example.
const UPI_APPS = [
  { key: 'phonepe', name: 'PhonePe', mark: 'Pe', fg: '#FFFFFF', bg: '#5F259F', handles: ['ybl', 'ibl', 'axl'] },
  { key: 'gpay', name: 'Google Pay', mark: 'G', fg: '#1A73E8', bg: '#E8F0FE', handles: ['okaxis', 'okhdfcbank', 'okicici', 'oksbi'] },
  { key: 'paytm', name: 'Paytm', mark: 'Paytm', fg: '#FFFFFF', bg: '#00BAF2', handles: ['paytm', 'ptyes', 'ptaxis'] },
  { key: 'bhim', name: 'BHIM', mark: 'BHIM', fg: '#FFFFFF', bg: '#F47920', handles: ['upi'] },
  { key: 'other', name: 'Other UPI app', icon: 'apps-outline', fg: '#475467', bg: '#F2F4F7', handles: [] },
];
const appForUpiId = (upiId) => {
  const handle = String(upiId || '').split('@')[1]?.toLowerCase();
  if (!handle) return '';
  return UPI_APPS.find((app) => app.handles.includes(handle))?.key || 'other';
};

// Saved details show as a summary with Edit; only incomplete ones open as a form.
const BANK_FIELDS = ['accountHolder', 'bankName', 'accountNumber', 'ifscCode'];
const UPI_FIELDS = ['upiApp', 'upiId'];
const bankComplete = (v) => Boolean(v.accountHolder.trim() && v.bankName.trim() && /^\d{8,20}$/.test(v.accountNumber) && IFSC_PATTERN.test(v.ifscCode));
const upiComplete = (v) => Boolean(v.upiApp && UPI_PATTERN.test(v.upiId.trim()));
const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));

const toServerMethods = (settings) => METHODS.filter((m) => settings[m.key]).map((m) => m.value);
const fromServerMethods = (list) => Object.fromEntries(
  METHODS.map((m) => [m.key, list.map((v) => String(v).trim().toLowerCase()).includes(m.value)]),
);
const sameMethods = (a, b) => [...a].sort().join(',') === [...b].map((v) => String(v).toLowerCase()).sort().join(',');


const errorText = (err, fallback) => {
  const data = err?.response?.data;
  return (typeof data === 'object' && (data?.message || data?.error)) || err?.message || fallback;
};

export default function DoctorPaymentSettingsScreen({ onBack }) {
  // Signup-style keyboard handling: the form scrolls above the keyboard and the
  // focused field is scrolled into view (the window does not resize, edge-to-edge).
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  const { showToast } = useToast();
  const [storageKey, setStorageKey] = useState(null);
  const [userId, setUserId] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Typed twice, like a checkout's "confirm account number"; never stored.
  const [confirmAccount, setConfirmAccount] = useState('');
  const [editingBank, setEditingBank] = useState(false);
  const [editingUpi, setEditingUpi] = useState(false);
  // The last saved (or loaded) values, which Cancel goes back to.
  const savedRef = useRef(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getStoredDoctorUser();
      const doctorId = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, 'doctor');
      const key = `doctorPaymentSettings:${doctorId}`;
      let next = DEFAULT_SETTINGS;
      try {
        const stored = JSON.parse((await AsyncStorage.getItem(key)) || 'null');
        if (stored) next = { ...DEFAULT_SETTINGS, ...stored };
      } catch {
        if (active) setError('Saved payment settings could not be read.');
      }
      // The server's list wins for the three methods.
      try {
        const { data } = await axiosInstance.get('/api/auth/me');
        const me = data?.user || data?.data?.user || {};
        if (active) setUserId(String(pickFirst(me._id, me.id, user?._id, user?.id, '')));
        if (Array.isArray(me.acceptedPaymentMethods)) next = { ...next, ...fromServerMethods(me.acceptedPaymentMethods) };
      } catch {
        if (active) setUserId(String(pickFirst(user?._id, user?.id, '')));
      }
      if (!active) return;
      setStorageKey(key);
      // Settings saved before the app picker: work the app out from the UPI ID.
      const loaded = next.upiApp ? next : { ...next, upiApp: appForUpiId(next.upiId) };
      savedRef.current = loaded;
      setSettings(loaded);
      setConfirmAccount(loaded.accountNumber || '');
      setEditingBank(!bankComplete(loaded));
      setEditingUpi(!upiComplete(loaded));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError('');
  };

  const validate = () => {
    if (!settings.onlinePayment && !settings.upiBank && !settings.cash) return 'Keep at least one payment method turned on.';
    if (settings.onlinePayment) {
      if (!settings.accountHolder.trim() || !settings.bankName.trim() || !settings.accountNumber.trim() || !settings.ifscCode.trim()) {
        return 'Add the bank account card payments should go to: account holder, bank, account number and IFSC.';
      }
      if (!/^\d{8,20}$/.test(settings.accountNumber)) return 'Enter a valid 8 to 20 digit account number.';
      if (editingBank && confirmAccount !== settings.accountNumber) return 'The account numbers do not match.';
      if (!IFSC_PATTERN.test(settings.ifscCode)) return 'Enter a valid IFSC code, e.g. SBIN0001234.';
    }
    if (settings.upiBank) {
      if (!settings.upiApp) return 'Choose the UPI app your UPI ID is linked to.';
      const upi = settings.upiId.trim();
      if (!upi) return 'Add your UPI ID to accept UPI payments.';
      if (!UPI_PATTERN.test(upi)) return 'Enter a valid UPI ID, e.g. drname@okaxis.';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!userId) {
      setError('Your session is incomplete. Please sign in again.');
      return;
    }
    const methods = toServerMethods(settings);
    try {
      setSaving(true);
      setError('');
      const { data } = await axiosInstance.patch(
        `/api/auth/update/${encodeURIComponent(userId)}`,
        { acceptedPaymentMethods: methods },
      );
      const serverUser = data?.user || data?.data?.user || data?.data || {};
      // A server without this field answers 200 and drops it.
      if (!Array.isArray(serverUser.acceptedPaymentMethods) || !sameMethods(methods, serverUser.acceptedPaymentMethods)) {
        setError('The server did not save your payment methods. Please try again later.');
        return;
      }
      await saveDoctorUser(serverUser);
      await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
      savedRef.current = settings;
      // Back to the summaries for whatever is now complete.
      setEditingBank(!bankComplete(settings));
      setEditingUpi(!upiComplete(settings));
      setSaved(true);
      showToast('Payment settings saved');
    } catch (err) {
      setError(errorText(err, 'Payment settings could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const activeCount = METHODS.filter((m) => settings[m.key]).length;
  const cancelBankEdit = () => {
    setSettings((prev) => ({ ...prev, ...pick(savedRef.current, BANK_FIELDS) }));
    setConfirmAccount(savedRef.current.accountNumber || '');
    setEditingBank(false);
    setError('');
  };
  const cancelUpiEdit = () => {
    setSettings((prev) => ({ ...prev, ...pick(savedRef.current, UPI_FIELDS) }));
    setEditingUpi(false);
    setError('');
  };
  // A section's own Save: its details are kept on this device only, so this
  // stores just those fields (not unsaved switches) and folds it to a summary.
  const [savingSection, setSavingSection] = useState('');
  const saveSection = async (kind) => {
    const fields = kind === 'bank' ? BANK_FIELDS : UPI_FIELDS;
    const next = { ...savedRef.current, ...pick(settings, fields) };
    try {
      setSavingSection(kind);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      savedRef.current = next;
      if (kind === 'bank') setEditingBank(false);
      else setEditingUpi(false);
      setError('');
      showToast(kind === 'bank' ? 'Bank details saved' : 'UPI ID saved');
    } catch {
      setError('Details could not be saved on this device. Please try again.');
    } finally {
      setSavingSection('');
    }
  };
  const bankReady = bankComplete(settings) && confirmAccount === settings.accountNumber;
  const upiReady = upiComplete(settings);

  // Cancel only makes sense when there is a complete saved version to return to.
  const canCancelBank = bankComplete(savedRef.current);
  const canCancelUpi = upiComplete(savedRef.current);
  const upiAppInfo = UPI_APPS.find((a) => a.key === settings.upiApp);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Payment Settings</Text>
          <Text style={s.subtitle}>How patients pay for appointments</Text>
        </View>
      </View>
      <ScrollView ref={kbScrollRef} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        <View style={s.banner}>
          <View style={s.bannerIcon}><Ionicons name="shield-checkmark" size={18} color="#0D9488" /></View>
          <View style={s.flex}>
            <Text style={s.bannerTitle}>{loading ? 'Payment methods' : `${activeCount} of ${METHODS.length} methods on`}</Text>
            <Text style={s.bannerText}>Patients see only the methods you turn on when they book.</Text>
          </View>
        </View>

        {loading && (
          <View style={s.loadingRow}><ActivityIndicator color="#0D9488" /><Text style={s.desc}>Loading your payment settings…</Text></View>
        )}

        {!loading && METHODS.map((method) => {
          const enabled = settings[method.key];
          return (
            <View key={method.key} style={[s.method, enabled && s.methodOn]}>
              <View style={s.methodRow}>
                <View style={[s.methodIcon, { backgroundColor: method.bg }]}>
                  <Ionicons name={method.icon} size={21} color={method.fg} />
                </View>
                <View style={s.flex}>
                  <Text style={s.methodTitle}>{method.title}</Text>
                  <Text style={s.desc}>{method.description}</Text>
                </View>
                <Switch
                  value={enabled}
                  disabled={saving}
                  onValueChange={(v) => updateSetting(method.key, v)}
                  trackColor={{ false: '#D5DAE3', true: '#99E6DC' }}
                  thumbColor={enabled ? '#0D9488' : '#FFFFFF'}
                />
              </View>
              {!!method.brands && (
                <View style={s.brands}>
                  {method.brands.map((brand) => <CardBrand key={brand} brand={brand} />)}
                </View>
              )}

              {method.key === 'onlinePayment' && enabled && !editingBank && (
                <View style={s.details}>
                  <Text style={s.detailsTitle}>Receive card payments in</Text>
                  <View style={s.summary}>
                    <View style={[s.summaryIcon, s.summaryIconBank]}><Ionicons name="business" size={18} color="#4F46E5" /></View>
                    <View style={s.flex}>
                      <Text translate={false} style={s.summaryTitle} numberOfLines={1}>{settings.bankName}</Text>
                      <Text translate={false} style={s.summaryLine}>A/c ••••{settings.accountNumber.slice(-4)}  ·  {settings.ifscCode}</Text>
                      <Text translate={false} style={s.summaryLine} numberOfLines={1}>{settings.accountHolder}</Text>
                    </View>
                    <Pressable onPress={() => { setEditingBank(true); setSaved(false); }} style={s.editButton} hitSlop={6} accessibilityLabel="Edit bank account">
                      <Ionicons name="create-outline" size={14} color="#0D9488" />
                      <Text style={s.editText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {method.key === 'onlinePayment' && enabled && editingBank && (
                <View style={s.details}>
                  <View style={s.detailsHead}>
                    <Ionicons name="business-outline" size={15} color="#4F46E5" />
                    <Text style={[s.detailsTitle, s.flex]}>Receive card payments in</Text>
                    {canCancelBank && (
                      <Pressable onPress={cancelBankEdit} hitSlop={8}><Text style={s.cancelText}>Cancel</Text></Pressable>
                    )}
                  </View>
                  <Text style={s.detailsHint}>Card payments are settled to this bank account.</Text>
                  <Field label="Account holder name" value={settings.accountHolder} onChangeText={(v) => updateSetting('accountHolder', v)} placeholder="As printed on your passbook" autoCapitalize="words" />
                  <Field label="Bank name" value={settings.bankName} onChangeText={(v) => updateSetting('bankName', v)} placeholder="e.g. State Bank of India" autoCapitalize="words" />
                  <Field
                    label="Account number"
                    value={settings.accountNumber}
                    onChangeText={(v) => updateSetting('accountNumber', v.replace(/\D/g, '').slice(0, 20))}
                    placeholder="Enter account number"
                    keyboardType="number-pad"
                  />
                  <Field
                    label="Confirm account number"
                    value={confirmAccount}
                    onChangeText={(v) => { setConfirmAccount(v.replace(/\D/g, '').slice(0, 20)); setError(''); setSaved(false); }}
                    placeholder="Re-enter account number"
                    keyboardType="number-pad"
                    status={confirmAccount && settings.accountNumber ? (confirmAccount === settings.accountNumber ? 'ok' : 'bad') : ''}
                  />
                  <Field
                    label="IFSC code"
                    value={settings.ifscCode}
                    onChangeText={(v) => updateSetting('ifscCode', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                    placeholder="e.g. SBIN0001234"
                    autoCapitalize="characters"
                    status={settings.ifscCode.length === 11 ? (IFSC_PATTERN.test(settings.ifscCode) ? 'ok' : 'bad') : ''}
                  />
                  {bankReady && (
                    <SectionSave label="Save bank details" busy={savingSection === 'bank'} onPress={() => saveSection('bank')} />
                  )}
                </View>
              )}

              {method.key === 'upiBank' && enabled && !editingUpi && !!upiAppInfo && (
                <View style={s.details}>
                  <Text style={s.detailsTitle}>Receive UPI payments in</Text>
                  <View style={s.summary}>
                    <View style={[s.upiLogo, { backgroundColor: upiAppInfo.bg }]}>
                      {upiAppInfo.icon
                        ? <Ionicons name={upiAppInfo.icon} size={18} color={upiAppInfo.fg} />
                        : <Text translate={false} style={[s.upiMark, { color: upiAppInfo.fg }, upiAppInfo.mark.length > 2 && s.upiMarkSmall]} numberOfLines={1}>{upiAppInfo.mark}</Text>}
                    </View>
                    <View style={s.flex}>
                      <Text translate={false} style={s.summaryTitle}>{upiAppInfo.name}</Text>
                      <Text translate={false} style={s.summaryLine} numberOfLines={1}>{settings.upiId}</Text>
                    </View>
                    <Pressable onPress={() => { setEditingUpi(true); setSaved(false); }} style={s.editButton} hitSlop={6} accessibilityLabel="Edit UPI ID">
                      <Ionicons name="create-outline" size={14} color="#0D9488" />
                      <Text style={s.editText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {method.key === 'upiBank' && enabled && (editingUpi || !upiAppInfo) && (
                <View style={s.details}>
                  <View style={s.detailsHead}>
                    <Text style={[s.detailsTitle, s.flex]}>Choose your UPI app</Text>
                    {canCancelUpi && (
                      <Pressable onPress={cancelUpiEdit} hitSlop={8}><Text style={s.cancelText}>Cancel</Text></Pressable>
                    )}
                  </View>
                  <Text style={s.detailsHint}>The app your UPI ID is linked to.</Text>
                  <View style={s.upiList}>
                    {UPI_APPS.map((app, index) => {
                      const selected = settings.upiApp === app.key;
                      return (
                        <Pressable
                          key={app.key}
                          onPress={() => updateSetting('upiApp', app.key)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={({ pressed }) => [s.upiRow, index > 0 && s.upiRowLine, selected && s.upiRowOn, pressed && s.upiRowPressed]}
                        >
                          <View style={[s.upiLogo, { backgroundColor: app.bg }]}>
                            {app.icon
                              ? <Ionicons name={app.icon} size={18} color={app.fg} />
                              : <Text translate={false} style={[s.upiMark, { color: app.fg }, app.mark.length > 2 && s.upiMarkSmall]} numberOfLines={1}>{app.mark}</Text>}
                          </View>
                          <Text translate={false} style={[s.upiName, selected && s.upiNameOn]}>{app.name}</Text>
                          <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.radioDot} />}</View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {!!settings.upiApp && (() => {
                    const app = UPI_APPS.find((a) => a.key === settings.upiApp);
                    const user = settings.upiId.split('@')[0];
                    return (
                      <>
                        <Field
                          label={`${app.key === 'other' ? 'Your' : app.name} UPI ID`}
                          value={settings.upiId}
                          onChangeText={(v) => updateSetting('upiId', v.trim())}
                          placeholder={app.handles[0] ? `e.g. 9876543210@${app.handles[0]}` : 'e.g. drname@bank'}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          status={settings.upiId.includes('@') ? (UPI_PATTERN.test(settings.upiId) ? 'ok' : 'bad') : ''}
                        />
                        {app.handles.length > 0 && (
                          <View style={s.handles}>
                            {app.handles.map((handle) => (
                              <Pressable key={handle} onPress={() => updateSetting('upiId', `${user || ''}@${handle}`)} style={s.handle} hitSlop={4}>
                                <Text translate={false} style={s.handleText}>@{handle}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </>
                    );
                  })()}
                  {upiReady && (
                    <SectionSave label="Save UPI ID" busy={savingSection === 'upi'} onPress={() => saveSection('upi')} />
                  )}
                </View>
              )}
            </View>
          );
        })}

        {!loading && (
          <View style={s.note}>
            <Ionicons name="lock-closed-outline" size={13} color="#667085" />
            <Text style={s.noteText}>Bank account and UPI details are saved on this device.</Text>
          </View>
        )}
        {!!error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#B42318" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
        {saved && !error && (
          <View style={s.savedBox}>
            <Ionicons name="checkmark-circle" size={16} color="#067647" />
            <Text style={s.savedText}>Payment settings saved.</Text>
          </View>
        )}
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={handleSave} style={[(loading || saving) && s.saveDisabled]} disabled={loading || saving || !storageKey}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveText}>Save Payment Settings</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// A section's own Save, shown once its details are complete.
function SectionSave({ label, busy, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [s.sectionSave, pressed && s.sectionSavePressed, busy && s.saveDisabled]}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />}
      <Text style={s.sectionSaveText}>{busy ? 'Saving...' : label}</Text>
    </Pressable>
  );
}

// Card network marks drawn with views, in each network's colours.
function CardBrand({ brand }) {
  if (brand === 'Mastercard') {
    return (
      <View style={s.brandTile} accessibilityLabel="Mastercard">
        <View style={s.mcCircles}>
          <View style={[s.mcCircle, s.mcRed]} />
          <View style={[s.mcCircle, s.mcYellow]} />
        </View>
        <Text translate={false} style={s.mcText}>mastercard</Text>
      </View>
    );
  }
  if (brand === 'RuPay') {
    return (
      <View style={s.brandTile} accessibilityLabel="RuPay">
        <Text translate={false} style={s.rupayText}>RuPay</Text>
        <View style={s.rupayArrows}>
          <View style={[s.rupayArrow, s.rupayOrange]} />
          <View style={[s.rupayArrow, s.rupayGreen]} />
        </View>
      </View>
    );
  }
  return (
    <View style={s.brandTile} accessibilityLabel="Visa">
      <Text translate={false} style={s.visaText}>VISA</Text>
    </View>
  );
}

// `status`: 'ok' / 'bad' adds a tick or a cross once the value can be judged.
function Field({ label, status, ...inputProps }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.inputBox, status === 'ok' && s.inputOk, status === 'bad' && s.inputBad]}>
        <TextInput style={s.input} placeholderTextColor="#98A2B3" {...inputProps} />
        {status === 'ok' && <Ionicons name="checkmark-circle" size={18} color="#16A34A" />}
        {status === 'bad' && <Ionicons name="close-circle" size={18} color="#DC2626" />}
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F7F9FB' },
  header: { minHeight: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E3E8EF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  subtitle: { fontSize: 12, color: '#667085', marginTop: 2 },
  content: { padding: 16, paddingBottom: 24 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1', borderRadius: 14, padding: 13, marginBottom: 14 },
  bannerIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#0F766E' },
  bannerText: { fontSize: 12, lineHeight: 17, color: '#475467', marginTop: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20, justifyContent: 'center' },

  method: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EF', borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  methodOn: { borderColor: '#5EEAD4' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontSize: 15.5, fontWeight: '800', color: '#17243A' },
  desc: { fontSize: 12.5, lineHeight: 17, color: '#667085', marginTop: 2 },
  brands: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginLeft: 56 },
  brandTile: {
    height: 30, minWidth: 54, paddingHorizontal: 9, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  visaText: { fontSize: 14, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5, color: '#1A1F71' },
  mcCircles: { flexDirection: 'row', alignItems: 'center' },
  mcCircle: { width: 15, height: 15, borderRadius: 7.5 },
  mcRed: { backgroundColor: '#EB001B' },
  mcYellow: { backgroundColor: '#F79E1B', marginLeft: -6, opacity: 0.9 },
  mcText: { fontSize: 9, fontWeight: '700', color: '#231F20' },
  rupayText: { fontSize: 12.5, fontWeight: '900', fontStyle: 'italic', color: '#1B3F94' },
  rupayArrows: { flexDirection: 'row', alignItems: 'center' },
  rupayArrow: { width: 0, height: 0, borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 6, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  rupayOrange: { borderLeftColor: '#F37021' },
  rupayGreen: { borderLeftColor: '#3EB049', marginLeft: -1 },

  details: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  detailsHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailsTitle: { fontSize: 14, fontWeight: '800', color: '#17243A' },
  detailsHint: { fontSize: 12, lineHeight: 17, color: '#667085', marginTop: 3 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, borderRadius: 13, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E4E7EC' },
  summaryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryIconBank: { backgroundColor: '#EEF2FF' },
  summaryTitle: { fontSize: 14.5, fontWeight: '800', color: '#17243A' },
  summaryLine: { fontSize: 12.5, color: '#475467', marginTop: 2 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#99F6E4' },
  editText: { fontSize: 12.5, fontWeight: '800', color: '#0D9488' },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#667085' },
  sectionSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, marginTop: 14, borderRadius: 11, backgroundColor: '#0D9488' },
  sectionSavePressed: { backgroundColor: '#0F766E' },
  sectionSaveText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  upiList: { marginTop: 10, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 13, overflow: 'hidden' },
  upiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#FFFFFF' },
  upiRowLine: { borderTopWidth: 1, borderTopColor: '#F0F2F5' },
  upiRowOn: { backgroundColor: '#F0FDFA' },
  upiRowPressed: { backgroundColor: '#F8FAFC' },
  upiLogo: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  upiMark: { fontSize: 15, fontWeight: '900' },
  upiMarkSmall: { fontSize: 9.5, fontWeight: '900' },
  upiName: { flex: 1, fontSize: 14.5, fontWeight: '600', color: '#344054' },
  upiNameOn: { fontWeight: '800', color: '#0F766E' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: '#0D9488' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0D9488' },
  handles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  handle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F2F4F7', borderWidth: 1, borderColor: '#E4E7EC' },
  handleText: { fontSize: 12, fontWeight: '700', color: '#475467' },
  field: { marginTop: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 11, backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  inputOk: { borderColor: '#86EFAC' },
  inputBad: { borderColor: '#FCA5A5' },
  input: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 14, color: '#17243A' },

  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, paddingHorizontal: 2 },
  noteText: { flex: 1, fontSize: 11.5, color: '#667085' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: 11, borderRadius: 11, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA' },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#B42318' },
  savedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 11, borderRadius: 11, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  savedText: { flex: 1, fontSize: 13, color: '#067647', fontWeight: '600' },

  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E3E8EF' },
  saveDisabled: { opacity: 0.6 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
});
