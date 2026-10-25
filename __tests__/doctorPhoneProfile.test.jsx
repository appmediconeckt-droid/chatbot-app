/* eslint-env jest */
import React from 'react';
import { act, create } from 'react-test-renderer';
import DoctorEditProfileScreen from '../src/features/doctor/dashboard/components/DoctorEditProfileScreen';

jest.mock('react-native', () => ({
  View: 'View', FlatList: 'FlatList', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image',
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('../src/components/common/CountryPhoneInput', () => 'CountryPhoneInput');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('../src/features/doctor/dashboard/components/LocationPicker', () => 'LocationPicker');
jest.mock('../src/features/doctor/dashboard/theme', () => ({ createDoctorStyles: styles => styles }));
jest.mock('../src/hooks/useKeyboardAwareScroll', () => () => ({ keyboardInset: 0 }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue('test-session') }));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../src/axiosConfig', () => ({ API_BASE_URL: 'https://example.test', TUNNEL_HEADERS: {} }));
jest.mock('../src/components/common/ToastProvider', () => ({ useToast: () => ({ showToast: mockToast }) }));

const mockToast = jest.fn();
const profile = { _id: 'doctor-1', fullName: 'Test Doctor', phoneNumber: '501234567', phoneCountryCode: '+971' };
let root;
let originalFetch;
let originalFormData;
beforeEach(() => {
  mockToast.mockClear();
  originalFetch = global.fetch;
  originalFormData = global.FormData;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ user: profile }) });
  global.FormData = function PhoneFormData() { this.parts = []; this.append = (...part) => this.parts.push(part); };
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  global.fetch = originalFetch;
  global.FormData = originalFormData;
});
const render = async () => { await act(async () => { root = create(<DoctorEditProfileScreen profile={profile} />); }); };
const save = async () => {
  const button = root.root.findAllByType('Pressable').find(node => node.findAllByType('Text').some(text => text.props.children === 'Save'));
  await act(async () => { await button.props.onPress(); });
};

it('initializes the saved code and sends the local number and country code together', async () => {
  await render();
  expect(root.root.findByType('CountryPhoneInput').props).toMatchObject({ value: '501234567', countryCode: '+971' });
  await save();
  const [, request] = global.fetch.mock.calls[0];
  expect(request.body.parts).toEqual(expect.arrayContaining([
    ['phoneNumber', '501234567'], ['phoneNum', '501234567'], ['phoneCountryCode', '+971'],
  ]));
});

it('blocks save when a code change makes the existing local number invalid', async () => {
  await render();
  await act(async () => root.root.findByType('CountryPhoneInput').props.onChangeCountryCode('+91'));
  await save();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('10 digit phone number for +91'));
});
