/* eslint-env jest */
import React from 'react';
import { act, create } from 'react-test-renderer';
import CountryPhoneInput from '../src/components/common/CountryPhoneInput';

jest.mock('react-native', () => ({
  View: 'View', FlatList: 'FlatList', Modal: 'Modal', TouchableOpacity: 'TouchableOpacity',
  Platform: { OS: 'android' }, StyleSheet: { create: styles => styles },
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/components/common/KeyboardSheet', () => ({ KeyboardSheetOverlay: 'View' }));

let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
const render = async props => { await act(async () => { root = create(<CountryPhoneInput value="9876543210" countryCode="+91" {...props} />); }); };

it('accepts a pasted international number and updates both code and local number', async () => {
  const onChangePhoneNumber = jest.fn();
  const onChangeCountryCode = jest.fn();
  await render({ onChangePhoneNumber, onChangeCountryCode });
  await act(async () => root.root.findAllByType('TextInput')[0].props.onChangeText('+971 50 123 4567'));
  expect(onChangeCountryCode).toHaveBeenCalledWith('+971');
  expect(onChangePhoneNumber).toHaveBeenCalledWith('501234567');
  expect(root.root.findAllByType('TextInput')[0].props.maxLength).toBeUndefined();
});

it('keeps the local number intact when changing to a shorter country format', async () => {
  const onChangePhoneNumber = jest.fn();
  const onChangeCountryCode = jest.fn();
  await render({ onChangePhoneNumber, onChangeCountryCode });
  const list = root.root.findByType('FlatList');
  const country = list.props.data.find(item => item.code === '+971');
  await act(async () => list.props.renderItem({ item: country }).props.onPress());
  expect(onChangeCountryCode).toHaveBeenCalledWith('+971');
  expect(onChangePhoneNumber).not.toHaveBeenCalled();
});

it('preserves overlong input for validation and locks the picker when disabled', async () => {
  const onChangePhoneNumber = jest.fn();
  await render({ onChangePhoneNumber, editable: false });
  expect(root.root.findAllByType('TouchableOpacity')[0].props.disabled).toBe(true);
  expect(root.root.findAllByType('TextInput')[0].props.editable).toBe(false);
  await act(async () => root.root.findAllByType('TextInput')[0].props.onChangeText('98765432101'));
  expect(onChangePhoneNumber).toHaveBeenCalledWith('98765432101');
});
