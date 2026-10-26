// The consultation fee of one clinic, on the Add Clinic and Edit Clinic forms.
// Doctors set their fee per clinic (the profile has no fee of its own); the
// patient booking sheet charges the fee of the clinic that was picked.
import React from 'react';
import { View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import { createDoctorStyles } from '../theme';
import { currencyDigits, currencySymbol, isValidFee } from '../../../../utils/consultationCurrency';

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

export default function ClinicFeeField({ value, onChangeText, currency, onFocus }) {
  return (
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
});
