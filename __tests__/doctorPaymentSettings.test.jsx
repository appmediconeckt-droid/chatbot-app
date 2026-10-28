import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../src/axiosConfig';
import DoctorPaymentSettingsScreen from '../src/features/doctor/dashboard/components/DoctorPaymentSettingsScreen';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Switch: 'Switch', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'android', select: options => options.android },
  StyleSheet: { create: value => value },
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'Gradient');
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn(), patch: jest.fn() } }));
jest.mock('../src/features/doctor/dashboard/api/doctorAppointments', () => ({
  getStoredDoctorUser: jest.fn(async () => ({ _id: 'doc-1' })),
  pickFirst: (...values) => values.find((v) => v !== undefined && v !== null && v !== ''),
}));
const mockShowToast = jest.fn();
jest.mock('../src/components/common/ToastProvider', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../src/hooks/useKeyboardAwareScroll', () => ({ __esModule: true, default: () => ({ scrollRef: { current: null }, keyboardOpen: false, keyboardTop: 0 }) }));
jest.mock('../src/hooks/useKeyboardLift', () => ({ __esModule: true, default: () => [{ current: null }, 0] }));

const BANK = { accountHolder: 'Vijay Kumar', bankName: 'State Bank of India', accountNumber: '12345678901', ifscCode: 'SBIN0001234' };
const textOf = (node) => [].concat(node.props.children).join('');
const pressableWithText = (root, text) => root.findAll((n) => n.type === 'Pressable'
  && n.findAll((c) => c.type === 'Text' && textOf(c) === text).length > 0)[0];

const render = async () => {
  let tree;
  await act(async () => { tree = create(<DoctorPaymentSettingsScreen onBack={jest.fn()} />); });
  return tree;
};

describe('doctor payment settings (web /api/payments/preferences)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    api.put.mockResolvedValue({ data: { success: true } });
  });

  it('shows one account section and three selectable ways to pay', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/providers/')
      ? { methods: ['cash'], unavailableMethods: { credit_card: 'The provider needs to complete card payment setup.' } }
      : { methods: ['credit_card', 'debit_card', 'upi', 'cash'], bankAccount: {}, upiId: '' } }));
    const tree = await render();
    const texts = tree.root.findAllByType('Text').map(textOf);
    expect(texts.indexOf('Receiving Account')).toBeLessThan(texts.indexOf('How patients can pay'));
    expect(texts).toEqual(expect.arrayContaining(['Account holder name', 'IFSC code', 'Credit / Debit Card', 'UPI', 'Cash at Clinic']));
    // Only the account form's five inputs; no UPI app picker or UPI ID field.
    expect(tree.root.findAllByType('TextInput')).toHaveLength(5);
    expect(texts.join(' ')).not.toMatch(/Choose your UPI app|Your UPI ID|Receive UPI payments in/);
    expect(tree.root.findAllByType('Switch')).toHaveLength(3);
    expect(texts).not.toContain('Wallet');
    // Live status from the server under each saved-on way to pay.
    expect(texts).toEqual(expect.arrayContaining(['The provider needs to complete card payment setup.', 'Live — patients can pay this way']));
    expect(api.get).toHaveBeenCalledWith('/api/payments/providers/doc-1/methods');
  });

  it('loads the server preferences and saves them back in the web format', async () => {
    api.get.mockResolvedValue({ data: { methods: ['credit_card', 'debit_card', 'cash'], bankAccount: BANK, upiId: '', upiApp: '' } });
    const tree = await render();
    expect(api.get).toHaveBeenCalledWith('/api/payments/preferences', expect.anything());
    expect(tree.root.findAllByType('Switch').map((s) => s.props.value)).toEqual([true, false, true]);

    await act(async () => { pressableWithText(tree.root, 'Save Payment Settings').props.onPress(); });
    expect(api.put).toHaveBeenCalledWith('/api/payments/preferences', {
      methods: ['credit_card', 'debit_card', 'cash'],
      bankAccount: BANK,
      upiId: '',
      upiApp: '',
    });
    expect(api.patch).not.toHaveBeenCalled();
    // Only the switches stay on the device; bank details live on the server.
    expect(JSON.parse(AsyncStorage.setItem.mock.calls[0][1])).toEqual({ onlinePayment: true, upiBank: false, cash: true });
  });

  it('sends a bank account an older app kept only on this phone, keeping the server UPI fields', async () => {
    api.get.mockResolvedValue({ data: { methods: ['credit_card', 'debit_card', 'upi'], bankAccount: {}, upiId: 'dr@okaxis', upiApp: 'google_pay' } });
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ ...BANK, onlinePayment: true, upiBank: true }));
    const tree = await render();
    expect(tree.root.findAll((n) => n.type === 'Text' && /saved only on this phone/.test(textOf(n)))).toHaveLength(1);

    await act(async () => { pressableWithText(tree.root, 'Save Payment Settings').props.onPress(); });
    expect(api.put).toHaveBeenCalledWith('/api/payments/preferences', {
      methods: ['credit_card', 'debit_card', 'upi'],
      bankAccount: BANK,
      upiId: 'dr@okaxis',
      upiApp: 'google_pay',
    });
    expect(tree.root.findAll((n) => n.type === 'Text' && /saved only on this phone/.test(textOf(n)))).toHaveLength(0);
  });

  it('saves a selected method without requiring receiving account details', async () => {
    api.get.mockResolvedValue({ data: { methods: ['upi'], bankAccount: {}, upiId: '' } });
    const tree = await render();
    await act(async () => { pressableWithText(tree.root, 'Save Payment Settings').props.onPress(); });
    expect(api.put).toHaveBeenCalledWith('/api/payments/preferences', {
      methods: ['upi'],
      bankAccount: { accountHolder: '', bankName: '', accountNumber: '', ifscCode: '' },
      upiId: '',
      upiApp: '',
    });
  });

  it('shows the web message and blocks saving when the server has no preferences API', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    const tree = await render();
    expect(tree.root.findAll((n) => n.type === 'Text' && /not available on this server yet/.test(textOf(n)))).toHaveLength(1);
    expect(pressableWithText(tree.root, 'Save Payment Settings').props.disabled).toBe(true);
  });
});
