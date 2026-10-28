// The consultation fee of one clinic, on the Add Clinic and Edit Clinic forms.
// Doctors set their fee per clinic (the profile has no fee of its own); the
// patient booking sheet charges the fee of the clinic that was picked.
// The fee currency is chosen here too: the server keeps one currency per
// doctor (from the profile country), so it applies to every clinic.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import FeeCountryPicker from './FeeCountryPicker';
import { createDoctorStyles } from '../theme';
import { currencyDigits, currencySymbol, isValidFee } from '../../../../utils/consultationCurrency';

// Online checkout on the server takes this currency only.
const ONLINE_CURRENCY = 'INR';

// The fee saved in the doctor's profile before fees moved to clinics, or null.
// A clinic without its own fee still charges it, so Edit Clinic starts there.
export const profileFeeOf = (user) => {
  const fee = Number(user?.consultationFee ?? user?.consultation_fee ?? user?.fee);
  return Number.isFinite(fee) && fee > 0 ? fee : null;
};

// Digits, plus as many decimals as the currency allows (none for JPY).
export const cleanClinicFee = (value, currency) => {
  const digits = currencyDigits(currency);
  const [whole = '', ...rest] = String(value).replace(/[^\d.]/g, '').split('.');
  const decimals = rest.join('').slice(0, digits);
  return digits > 0 && String(value).includes('.') ? `${whole.slice(0, 7)}.${decimals}` : whole.slice(0, 7);
};

// Like the web, a clinic may charge 0 (free checkups there).
export const isValidClinicFee = (value, currency) =>
  /^0+(\.0*)?$/.test(String(value).trim()) || isValidFee(value, currency);

// country / onCountryChange: the doctor's fee country (sets the currency);
// savedCurrency: the currency the server holds now, to flag a mismatch.
export default function ClinicFeeField({ value, onChangeText, currency, onFocus, country, onCountryChange, savedCurrency }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pending = !!savedCurrency && savedCurrency !== currency;
  return (
    <View>
      {!!onCountryChange && (
        <>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [s.currencyRow, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Choose fee country and currency"
          >
            <View style={s.info}>
              <Text style={s.title}>Fee Currency</Text>
              <Text style={s.subtitle}>Used for all your clinics</Text>
            </View>
            <View style={s.currencyValue}>
              <Text translate={false} style={s.currencyValueText} numberOfLines={1}>
                {country} · {currencySymbol(currency)} {currency}
              </Text>
              <AppIcon name="chevron-down" size={15} color="#475467" strokeWidth={2.4} />
            </View>
          </Pressable>
          {pending && (
            <Text style={s.note}>Your fees are saved in {savedCurrency}. Saving switches them to {currency}.</Text>
          )}
          {currency !== ONLINE_CURRENCY && (
            <Text style={s.warn}>Online card / UPI payments work in {ONLINE_CURRENCY} only. In {currency}, patients can only pay cash.</Text>
          )}
          <FeeCountryPicker
            visible={pickerOpen}
            selected={country}
            onSelect={(name) => { setPickerOpen(false); onCountryChange(name); }}
            onClose={() => setPickerOpen(false)}
          />
        </>
      )}
      <View style={s.row}>
      <View style={s.info}>
        <Text style={s.title}>Consultation Fee</Text>
        <Text style={s.subtitle}>Patients pay this fee at this clinic</Text>
      </View>
      <View style={s.inputWrap}>
        <Text translate={false} style={s.currency}>{currencySymbol(currency)}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={s.input}
          placeholder="0"
          placeholderTextColor="#94A3B8"
          keyboardType={currencyDigits(currency) > 0 ? 'decimal-pad' : 'number-pad'}
          onFocus={onFocus}
          accessibilityLabel="Clinic consultation fee"
        />
      </View>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  info: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '700', color: '#17243A' },
  subtitle: { fontSize: 11.5, color: '#667085', marginTop: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 9, paddingHorizontal: 10, gap: 4, width: 110 },
  currency: { fontSize: 13.5, color: '#667085' },
  input: { flex: 1, fontSize: 13.5, color: '#17243A', paddingVertical: 0 },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  pressed: { opacity: 0.7 },
  currencyValue: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '55%', borderWidth: 1, borderColor: '#B7ECE7', backgroundColor: '#F0FDFA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  currencyValueText: { flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: '#0F766E' },
  note: { fontSize: 12, lineHeight: 17, color: '#B54708', marginTop: -4, marginBottom: 10 },
  warn: { fontSize: 12, lineHeight: 17, color: '#B42318', marginTop: -4, marginBottom: 10 },
});
