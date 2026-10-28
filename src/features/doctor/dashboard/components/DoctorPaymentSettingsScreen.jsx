// Payment settings — same API as the web Setting/PaymentSetting/PaymentSettings.jsx:
//   GET /api/payments/preferences → { methods, bankAccount, upiId, upiApp }
//   PUT /api/payments/preferences   { methods: ['credit_card' | 'debit_card' | 'upi' | 'wallet' | 'cash'],
//                                     bankAccount: { accountHolder, bankName, accountNumber, ifscCode },
//                                     upiId, upiApp }
//   GET /api/payments/providers/:doctorId/methods → which ways patients can pay right now
// One receiving account on top (card and UPI payments settle to it), then the
// ways patients can pay. Patients' booking sheet offers exactly the ways
// that are on and set up; each row shows that live status from the server.
// Wallet is always on: every doctor accepts the patient's app wallet, and it
// is saved in `methods` so the server takes wallet payments for this doctor.
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import axiosInstance from '../../../../axiosConfig';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import useKeyboardLift from '../../../../hooks/useKeyboardLift';

// Keys are kept from the earlier screen so settings saved on a device still load.
const DEFAULT_SETTINGS = {
  onlinePayment: true,
  upiBank: false,
  wallet: true,
  cash: true,
  accountHolder: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  // Not edited here; sent back unchanged so nothing the server has is lost.
  upiId: '',
  upiApp: '',
};

// `values` are the server's names for the method.
const METHODS = [
  {
    key: 'onlinePayment', values: ['credit_card', 'debit_card'], title: 'Credit / Debit Card', icon: 'card-outline', fg: '#4F46E5', bg: '#EEF2FF',
    description: 'Patients pay by card in secure checkout while booking.', brands: ['VISA', 'Mastercard', 'RuPay'],
  },
  {
    key: 'upiBank', values: ['upi'], title: 'UPI', icon: 'qr-code-outline', fg: '#0D9488', bg: '#E6FBF8',
    description: 'Patients pay with their own UPI ID or UPI app while booking.',
  },
  {
    key: 'wallet', values: ['wallet'], title: 'Wallet', icon: 'wallet-outline', fg: '#7C3AED', bg: '#F3E8FF', alwaysOn: true,
    description: 'Patients pay from their app wallet balance while booking. Always on — your share is added to Earnings.',
  },
  {
    key: 'cash', values: ['cash'], title: 'Cash at Clinic', icon: 'cash-outline', fg: '#B45309', bg: '#FEF3C7',
    description: 'Patients pay at the clinic reception. Offered for in-clinic visits only.',
  },
];
const ONLINE_KEYS = ['onlinePayment', 'upiBank'];

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_FIELDS = ['accountHolder', 'bankName', 'accountNumber', 'ifscCode'];
const bankComplete = (v) => Boolean(v.accountHolder.trim() && v.bankName.trim() && /^\d{8,20}$/.test(v.accountNumber) && IFSC_PATTERN.test(v.ifscCode));
const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));

const toServerMethods = (settings) => METHODS.filter((m) => settings[m.key]).flatMap((m) => m.values);
const fromServerMethods = (list) => {
  const names = list.map((v) => String(v).trim().toLowerCase());
  return Object.fromEntries(METHODS.map((m) => [m.key, m.alwaysOn || m.values.some((v) => names.includes(v))]));
};
// Preferences saved before Wallet existed lack it: the server doesn't take
// wallet payments for this doctor until the next Save sends it.
const walletMissing = (data) => !(Array.isArray(data?.methods) && data.methods.some((v) => String(v).trim().toLowerCase() === 'wallet'));
const toServerPreferences = (settings) => ({
  methods: toServerMethods(settings),
  bankAccount: pick(settings, BANK_FIELDS),
  upiId: settings.upiId.trim(),
  upiApp: settings.upiApp,
});

// The server's saved preferences as this screen's settings. A bank account an
// earlier app version kept only on this device (`device`) fills in when the
// server has none yet, so one Save sends it to the server.
const fromServerPreferences = (data, device) => {
  const bankAccount = data?.bankAccount || {};
  const serverHasBank = BANK_FIELDS.some((k) => String(bankAccount[k] || '').trim());
  const bank = serverHasBank ? bankAccount : (device || {});
  const next = {
    ...DEFAULT_SETTINGS,
    ...fromServerMethods(Array.isArray(data?.methods) ? data.methods : ['cash']),
    ...Object.fromEntries(BANK_FIELDS.map((k) => [k, String(bank[k] || '')])),
    upiId: String(data?.upiId || ''),
    upiApp: String(data?.upiApp || ''),
  };
  const fromDevice = !serverHasBank && BANK_FIELDS.some((k) => String(device?.[k] || '').trim());
  return { next, fromDevice };
};

const loadErrorText = (err) => (err?.response?.status === 404
  ? 'Payment settings are not available on this server yet. Start or deploy the updated backend, then try again.'
  : err?.response?.status === 401
    ? 'Your session has expired. Please sign in again.'
    : 'Payment settings could not be reached. Check your connection and try again.');

const errorText = (err, fallback) => {
  const data = err?.response?.data;
  return (typeof data === 'object' && (data?.message || data?.error)) || err?.message || fallback;
};

export default function DoctorPaymentSettingsScreen({ onBack }) {
  // The window does not resize for the keyboard (edge-to-edge), so while it is
  // open the screen ends at its top edge: Save stays visible above it and the
  // form scrolls in the space left, with the focused field scrolled into view.
  const {
    scrollRef: kbScrollRef,
    keyboardOpen,
    keyboardTop,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ layoutAvoidsKeyboard: true });
  const [screenRef, keyboardLift] = useKeyboardLift(keyboardOpen, keyboardTop);
  const { showToast } = useToast();
  const [storageKey, setStorageKey] = useState(null);
  const [doctorId, setDoctorId] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Typed twice, like a checkout's "confirm account number"; never stored.
  const [confirmAccount, setConfirmAccount] = useState('');
  const [editingBank, setEditingBank] = useState(false);
  // The last saved (or loaded) values, which Cancel goes back to.
  const savedRef = useRef(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  // The server could not be read: nothing can be saved until a retry works.
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  // A bank account found only on this device, not yet on the server.
  const [unsentDetails, setUnsentDetails] = useState(false);
  // Wallet is not in the server's saved methods yet (needs one Save).
  const [walletUnsaved, setWalletUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  // What patients see now: { live: Set of server method names, reasons: { method: text } }.
  const [status, setStatus] = useState(null);

  const loadStatus = useCallback(async (id) => {
    if (!id) return;
    try {
      const { data } = await axiosInstance.get(`/api/payments/providers/${encodeURIComponent(id)}/methods`);
      setStatus({ live: new Set(data?.methods || []), reasons: data?.unavailableMethods || {} });
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError('');
      const user = await getStoredDoctorUser();
      const storageId = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, 'doctor');
      const providerId = String(pickFirst(user?._id, user?.id, user?.doctor_id, user?.doctorId, ''));
      const key = `doctorPaymentSettings:${storageId}`;
      let device = null;
      try {
        device = JSON.parse((await AsyncStorage.getItem(key)) || 'null');
      } catch { /* the server is authoritative */ }
      try {
        const { data } = await axiosInstance.get('/api/payments/preferences', { timeout: 15000 });
        if (!active) return;
        const { next, fromDevice } = fromServerPreferences(data, device);
        setStorageKey(key);
        setDoctorId(providerId);
        savedRef.current = next;
        setSettings(next);
        setConfirmAccount(next.accountNumber || '');
        setUnsentDetails(fromDevice);
        setWalletUnsaved(walletMissing(data));
        // An account that came from this device opens as a form, to be saved.
        setEditingBank(fromDevice || !bankComplete(next));
        loadStatus(providerId);
      } catch (err) {
        if (active) setLoadError(loadErrorText(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadAttempt, loadStatus]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError('');
  };

  const onlineOn = ONLINE_KEYS.some((key) => settings[key]);
  const validate = () => {
    if (!METHODS.some((m) => settings[m.key])) return 'Keep at least one way to pay turned on.';
    if (onlineOn) {
      if (!settings.accountHolder.trim() || !settings.bankName.trim() || !settings.accountNumber.trim() || !settings.ifscCode.trim()) {
        return 'Add the account card and UPI payments should go to: account holder, bank, account number and IFSC.';
      }
      if (!/^\d{8,20}$/.test(settings.accountNumber)) return 'Enter a valid 8 to 20 digit account number.';
      if (editingBank && confirmAccount !== settings.accountNumber) return 'The account numbers do not match.';
      if (!IFSC_PATTERN.test(settings.ifscCode)) return 'Enter a valid IFSC code, e.g. SBIN0001234.';
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
      setSaving(true);
      setError('');
      await axiosInstance.put('/api/payments/preferences', toServerPreferences(settings));
      // This device keeps only which ways are on; the account stays on the server.
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(pick(settings, ['onlinePayment', 'upiBank', 'cash'])));
      } catch { /* the server is authoritative */ }
      savedRef.current = settings;
      setUnsentDetails(false);
      setWalletUnsaved(false);
      setEditingBank(!bankComplete(settings));
      setSaved(true);
      showToast('Payment settings saved');
      loadStatus(doctorId);
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
  // Cancel only makes sense when there is a complete saved account to return to.
  const canCancelBank = bankComplete(savedRef.current) && !unsentDetails;
  const ready = !loading && !loadError;

  // The live status line under a way to pay, once its switch is saved on.
  const statusFor = (method) => {
    if (method.alwaysOn && walletUnsaved) return { live: false, text: 'Tap Save Payment Settings to start taking wallet payments.' };
    if (!status || !savedRef.current[method.key] || !settings[method.key]) return null;
    if (method.values.some((v) => status.live.has(v))) return { live: true, text: 'Live — patients can pay this way' };
    const reason = method.values.map((v) => status.reasons[v]).find(Boolean);
    return reason ? { live: false, text: reason } : null;
  };

  return (
    <View ref={screenRef} collapsable={false} style={[s.screen, keyboardLift > 0 && { paddingBottom: keyboardLift }]}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Payment Settings</Text>
          <Text style={s.subtitle}>How patients pay for appointments</Text>
        </View>
      </View>
      <ScrollView ref={kbScrollRef} contentContainerStyle={s.content} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        {loading && (
          <View style={s.loadingRow}><ActivityIndicator color="#0D9488" /><Text style={s.desc}>Loading your payment settings…</Text></View>
        )}

        {!loading && !!loadError && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#B42318" />
            <Text style={s.errorText}>{loadError}</Text>
            <Pressable onPress={() => setLoadAttempt((n) => n + 1)} hitSlop={8}>
              <Text style={s.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {ready && unsentDetails && (
          <View style={s.unsentBox}>
            <Ionicons name="cloud-upload-outline" size={16} color="#B54708" />
            <Text style={s.unsentText}>
              Your bank account was saved only on this phone. Tap Save Payment Settings so patients can pay you by card or UPI.
            </Text>
          </View>
        )}

        {ready && (
          <>
            <SectionLabel icon="business-outline" text="Receiving Account" />
            <View style={s.card}>
              {!editingBank ? (
                <View style={s.summary}>
                  <View style={s.summaryIcon}><Ionicons name="business" size={18} color="#4F46E5" /></View>
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
              ) : (
                <>
                  <View style={s.detailsHead}>
                    <Text style={[s.detailsHint, s.flex]}>Card and UPI payments from patients settle to this account.</Text>
                    {canCancelBank && (
                      <Pressable onPress={cancelBankEdit} hitSlop={8}><Text style={s.cancelText}>Cancel</Text></Pressable>
                    )}
                  </View>
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
                </>
              )}
            </View>

            <SectionLabel icon="wallet-outline" text="How patients can pay" right={`${activeCount} of ${METHODS.length} on`} />
            {METHODS.map((method) => {
              const enabled = settings[method.key];
              const line = statusFor(method);
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
                      disabled={saving || method.alwaysOn}
                      onValueChange={(v) => updateSetting(method.key, v)}
                      trackColor={{ false: '#D5DAE3', true: '#99E6DC' }}
                      thumbColor={enabled ? '#0D9488' : '#FFFFFF'}
                      accessibilityLabel={`Accept ${method.title}`}
                    />
                  </View>
                  {!!method.brands && (
                    <View style={s.brands}>
                      {method.brands.map((brand) => <CardBrand key={brand} brand={brand} />)}
                    </View>
                  )}
                  {!!line && (
                    <View style={[s.statusRow, line.live ? s.statusLive : s.statusPending]}>
                      <Ionicons name={line.live ? 'checkmark-circle' : 'time-outline'} size={14} color={line.live ? '#067647' : '#B54708'} />
                      <Text style={[s.statusText, line.live ? s.statusTextLive : s.statusTextPending]}>{line.text}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            <View style={s.note}>
              <Ionicons name="lock-closed-outline" size={13} color="#667085" />
              <Text style={s.noteText}>Your account details are saved securely on the server, where your payments settle.</Text>
            </View>
          </>
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
        <Pressable onPress={handleSave} style={[(!ready || saving) && s.saveDisabled]} disabled={!ready || saving || !storageKey}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveText}>Save Payment Settings</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function SectionLabel({ icon, text, right }) {
  return (
    <View style={s.sectionLabelRow}>
      <Ionicons name={icon} size={15} color="#0D9488" />
      <Text style={[s.sectionLabel, s.flex]}>{text}</Text>
      {!!right && <Text style={s.sectionRight}>{right}</Text>}
    </View>
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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20, justifyContent: 'center' },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginTop: 4, marginLeft: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#17243A' },
  sectionRight: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EF', borderRadius: 16, padding: 14, marginBottom: 18,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },

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
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  statusLive: { backgroundColor: '#ECFDF3' },
  statusPending: { backgroundColor: '#FFFAEB' },
  statusText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  statusTextLive: { color: '#067647' },
  statusTextPending: { color: '#93370D' },

  detailsHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailsHint: { fontSize: 12.5, lineHeight: 17, color: '#667085' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF' },
  summaryTitle: { fontSize: 14.5, fontWeight: '800', color: '#17243A' },
  summaryLine: { fontSize: 12.5, color: '#475467', marginTop: 2 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#99F6E4' },
  editText: { fontSize: 12.5, fontWeight: '800', color: '#0D9488' },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#667085' },
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
  retryText: { fontSize: 13, fontWeight: '800', color: '#B42318' },
  unsentBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: 11, borderRadius: 11, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  unsentText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#93370D' },
  savedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 11, borderRadius: 11, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  savedText: { flex: 1, fontSize: 13, color: '#067647', fontWeight: '600' },

  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E3E8EF' },
  saveDisabled: { opacity: 0.6 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
});
