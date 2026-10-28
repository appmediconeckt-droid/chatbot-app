import React from 'react';
import { act, create } from 'react-test-renderer';
import api from '../src/axiosConfig';
import { clinicFeeOf, createClinic, normalizeClinic, updateClinic } from '../src/features/doctor/dashboard/api/doctorClinics';
import ClinicFeeField, { cleanClinicFee, isValidClinicFee, profileFeeOf } from '../src/features/doctor/dashboard/components/ClinicFeeField';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
  Platform: { OS: 'android', select: options => options.android },
  StyleSheet: { create: value => value },
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('../src/features/doctor/dashboard/components/FeeCountryPicker', () => 'FeeCountryPicker');
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true,
  API_BASE_URL: 'https://example.test',
  default: { defaults: { baseURL: 'https://example.test' }, patch: jest.fn(), post: jest.fn(), get: jest.fn() },
}));

// FormData fields as { name: value } (RN keeps them in _parts).
const fields = (formData) => Object.fromEntries(formData._parts || [...formData.entries()]);

describe('clinic consultation fee', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the clinic fee the web saves (0 = free), null when it uses the profile fee', () => {
    expect(clinicFeeOf({ fee: 300 })).toBe(300);
    expect(clinicFeeOf({ fee: '450' })).toBe(450);
    expect(clinicFeeOf({ fee: 0 })).toBe(0);
    expect(clinicFeeOf({ fee: null })).toBeNull();
    expect(clinicFeeOf({ fee: '' })).toBeNull();
    expect(clinicFeeOf({})).toBeNull();
    expect(normalizeClinic({ _id: 'c1', clinic_name: 'A', fee: 250 }).fee).toBe(250);
    expect(normalizeClinic({ _id: 'c2', clinic_name: 'B' }).fee).toBeNull();
  });

  it('sends the clinic fee as `fee` on edit, like the web, and an empty one to clear it', async () => {
    api.patch.mockResolvedValue({ data: { clinic: { _id: 'c1', clinic_name: 'A', fee: 300 } } });
    const updated = await updateClinic('c1', { name: 'A', phone: '+911234567890', location: 'Indore', fee: '300' });
    expect(api.patch.mock.calls[0][0]).toBe('/api/clinics/c1');
    expect(fields(api.patch.mock.calls[0][1]).fee).toBe('300');
    expect(updated.fee).toBe(300);

    await updateClinic('c1', { name: 'A', phone: '', location: 'Indore', fee: '' });
    expect(fields(api.patch.mock.calls[1][1]).fee).toBe('');

    await updateClinic('c1', { name: 'A', phone: '', location: 'Indore' });
    expect(fields(api.patch.mock.calls[2][1])).not.toHaveProperty('fee');
  });

  it('sends the clinic fee when a clinic is created with one', async () => {
    api.post.mockResolvedValue({ data: { clinic: { _id: 'c3', clinic_name: 'C' } } });
    await createClinic('d1', { name: 'C', phone: '', location: 'Indore', fee: '700' });
    expect(fields(api.post.mock.calls[0][1]).fee).toBe('700');
    await createClinic('d1', { name: 'C', phone: '', location: 'Indore', fee: '' });
    expect(fields(api.post.mock.calls[1][1])).not.toHaveProperty('fee');
  });

  it('keeps fee input to digits and the currency decimals', () => {
    expect(cleanClinicFee('1a2b3', 'INR')).toBe('123');
    expect(cleanClinicFee('12.345', 'INR')).toBe('12.34');
    expect(cleanClinicFee('12.5', 'JPY')).toBe('12');
    expect(profileFeeOf({ consultationFee: 500 })).toBe(500);
    expect(profileFeeOf({})).toBeNull();
    expect(isValidClinicFee('0', 'INR')).toBe(true);
    expect(isValidClinicFee('250.50', 'INR')).toBe(true);
    expect(isValidClinicFee('12.5', 'JPY')).toBe(false);
    expect(isValidClinicFee('abc', 'INR')).toBe(false);
  });

  it('asks for the clinic fee in the profile currency, with no profile fee option', () => {
    const onChangeText = jest.fn();
    let tree;
    act(() => {
      tree = create(<ClinicFeeField value="300" onChangeText={onChangeText} currency="INR" />);
    });
    const texts = tree.root.findAllByType('Text').map((t) => [].concat(t.props.children).join(''));
    expect(texts).toEqual(['Consultation Fee', 'Patients pay this fee at this clinic', '₹']);
    expect(texts.join(' ')).not.toMatch(/profile/i);
    const input = tree.root.findByType('TextInput');
    expect(input.props.value).toBe('300');
    expect(input.props.keyboardType).toBe('decimal-pad');
    act(() => { input.props.onChangeText('450'); });
    expect(onChangeText).toHaveBeenCalledWith('450');
  });

  it('picks the fee currency with the fee and flags a saved currency that differs', () => {
    const onCountryChange = jest.fn();
    let tree;
    act(() => {
      tree = create(<ClinicFeeField value="500" onChangeText={jest.fn()} currency="INR" country="India" savedCurrency="EUR" onCountryChange={onCountryChange} />);
    });
    const texts = tree.root.findAllByType('Text').map((t) => [].concat(t.props.children).join(''));
    expect(texts).toContain('Fee Currency');
    expect(texts).toContain('India · ₹ INR');
    expect(texts).toContain('Your fees are saved in EUR. Saving switches them to INR.');
    act(() => { tree.root.findByType('FeeCountryPicker').props.onSelect('Germany'); });
    expect(onCountryChange).toHaveBeenCalledWith('Germany');

    act(() => {
      tree.update(<ClinicFeeField value="500" onChangeText={jest.fn()} currency="EUR" country="Germany" savedCurrency="EUR" onCountryChange={onCountryChange} />);
    });
    const after = tree.root.findAllByType('Text').map((t) => [].concat(t.props.children).join(''));
    expect(after).toContain('Online card / UPI payments work in INR only. In EUR, patients can only pay cash.');
  });
});
