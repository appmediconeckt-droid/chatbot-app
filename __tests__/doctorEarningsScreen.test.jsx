import React from 'react';
import { act, create } from 'react-test-renderer';
import api from '../src/axiosConfig';
import DoctorEarningsScreen from '../src/features/doctor/dashboard/components/DoctorEarningsScreen';

jest.mock('react-native', () => {
  const FlatList = ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }) => {
    const React = require('react');
    return React.createElement('FlatList', null,
      ListHeaderComponent,
      data.length ? data.map((item) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent,
      ListFooterComponent);
  };
  return {
    View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', TextInput: 'TextInput', Alert: { alert: jest.fn() },
    ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl', FlatList,
    Platform: { OS: 'android', select: (options) => options.android },
    StyleSheet: { create: (value) => value },
  };
});
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'Gradient');
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('../src/hooks/useLiveRefresh', () => ({ __esModule: true, default: () => {} }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../src/features/doctor/dashboard/api/doctorAppointments', () => ({
  pickFirst: (...values) => values.find((v) => v !== undefined && v !== null && v !== ''),
}));

const textOf = (node) => [].concat(node.props.children).join('');
const texts = (tree) => tree.root.findAllByType('Text').map(textOf);

const render = async () => {
  let tree;
  await act(async () => { tree = create(<DoctorEarningsScreen onBack={jest.fn()} />); });
  return tree;
};

describe('doctor earnings screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the balances and each payment with its platform fee and the doctor share', async () => {
    api.get.mockResolvedValue({ data: {
      currency: 'INR',
      summary: { pending: 450, available: 900, settled: 1350, platformFees: 300, grossCollected: 3000 },
      transactions: [
        { _id: 't1', type: 'payment', status: 'pending', amount: 500, platformFee: 50, paymentMethod: 'wallet', patientName: 'Asha Rao', clinicName: 'City Clinic', appointmentCode: 'A12', createdAt: '2026-10-20T10:00:00Z' },
        { _id: 't2', type: 'settlement', status: 'completed', amount: 1350, bankAccount: 'HDFC ••1234', createdAt: '2026-10-18T10:00:00Z' },
      ],
    } });
    const tree = await render();
    const all = texts(tree).join(' | ');
    expect(texts(tree)).toEqual(expect.arrayContaining(['Your earnings', 'Pending', 'Available', 'Settled', 'Total collected', 'Platform fees', 'Refund review']));
    expect(all).toMatch(/Asha Rao/);
    expect(all).toMatch(/· {2}Wallet/);
    expect(all).toMatch(/#A12/);
    expect(all).toMatch(/Bank settlement completed/);
    expect(all).toMatch(/HDFC ••1234/);
    expect(all).toMatch(/Patient paid ₹500 {2}· {2}Platform fee ₹50/);
    expect(all).not.toMatch(/How your earnings move/);
  });

  it('shows pending patient payments in the total instead of ₹0 (web wallet shape)', async () => {
    api.get.mockResolvedValue({ data: {
      summary: { pending: 450, available: 0, settled: 0, platformFees: 50, held: 0 },
      transactions: [
        { id: 'p1', createdAt: '2026-10-25T10:00:00Z', patient: 'Asha Rao', appointmentId: 'apt-1', paymentId: 'pay_1', clinic: 'City Clinic', method: 'wallet', gross: 500, platformFee: 50, net: 450, status: 'pending' },
      ],
    } });
    const tree = await render();
    const all = texts(tree);
    expect(all).toContain('Your earnings');
    expect(all).toContain('Refund review');
    expect(all.filter((t) => /450/.test(t)).length).toBeGreaterThanOrEqual(2);
    expect(all.some((t) => /500/.test(t))).toBe(true);
    expect(all).toContain('Asha Rao');
  });

  it('opens a transaction with its full breakdown', async () => {
    api.get.mockResolvedValue({ data: { summary: {}, transactions: [
      { _id: 't1', type: 'payment', status: 'available', amount: 500, platformFee: 50, paymentMethod: 'upi', patientName: 'Asha Rao', reference: 'pay_123' },
    ] } });
    const tree = await render();
    expect(tree.root.findAllByType('Modal')).toHaveLength(0);
    const card = tree.root.findAll((n) => n.type === 'Pressable' && n.findAll((c) => c.type === 'Text' && textOf(c) === 'Asha Rao').length > 0)[0];
    await act(async () => { card.props.onPress(); });
    expect(tree.root.findAllByType('Modal')).toHaveLength(1);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Paid by patient', 'Transaction ID', 'pay_123', 'UPI', 'Bank settlement', 'Available · bank settlement pending']));
  });

  it('shows the transaction ID and bank settlement like the web, and searches by it', async () => {
    api.get.mockResolvedValue({ data: { summary: {}, transactions: [
      { id: 'p1', patient: 'Asha Rao', appointmentId: 'apt-1', paymentId: 'wallet_abc', method: 'wallet', gross: 300, platformFee: 60, net: 240, status: 'pending' },
      { id: 'p2', patient: 'Ravi', appointmentId: 'apt-2', paymentId: 'pay_xyz', method: 'upi', gross: 500, platformFee: 0, net: 500, status: 'settled' },
    ] } });
    const tree = await render();
    const all = texts(tree).join(' | ');
    expect(all).toMatch(/Txn ID {2}wallet_abc/);
    expect(all).toMatch(/Pending appointment completion/);
    expect(all).toMatch(/Bank settlement completed/);
    await act(async () => { tree.root.findByType('TextInput').props.onChangeText('pay_x'); });
    expect(texts(tree)).toContain('Ravi');
    expect(texts(tree)).not.toContain('Asha Rao');
  });

  it('says so when the server has no earnings ledger yet', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(["Earnings aren't live yet"]));
  });
});

describe('doctor earnings screen — test mode', () => {
  it('labels Razorpay test payments without the bank payouts box', async () => {
    api.get.mockResolvedValue({ data: {
      mode: 'test', platformFeePercent: 20,
      settlement: { enabled: false, bankReady: false, bankSaved: true },
      summary: {}, transactions: [],
    } });
    let tree;
    await act(async () => { tree = create(<DoctorEarningsScreen onBack={jest.fn()} />); });
    const all = tree.root.findAllByType('Text').map((n) => [].concat(n.props.children).join('')).join(' | ');
    expect(all).toMatch(/Razorpay test payments/);
    expect(all).not.toMatch(/Bank payouts/);
    expect(all).toMatch(/No payments received yet/);
  });
});

describe('doctor earnings screen — bank settlement on the card (web column)', () => {
  const rows = [
    { id: 'a1', createdAt: '2026-10-27T10:00:00Z', patient: 'Asha', gross: 500, platformFee: 100, net: 400, status: 'available', method: 'credit_card', paymentId: 'pay_a' },
    { id: 'p1', createdAt: '2026-10-27T09:00:00Z', patient: 'Ravi', gross: 300, platformFee: 60, net: 240, status: 'processing', method: 'debit_card', paymentId: 'pay_p', payoutRequested: true },
    { id: 'n1', createdAt: '2026-10-27T08:00:00Z', patient: 'Neha', gross: 300, platformFee: 60, net: 240, status: 'pending', method: 'upi', paymentId: 'pay_n' },
  ];
  const buttons = (tree, label) => tree.root.findAll((n) => n.type === 'Pressable'
    && n.findAll((c) => c.type === 'Text' && [].concat(c.props.children).join('') === label).length > 0
    && !n.findAll((c) => c.type === 'Pressable' && c !== n).length);

  const texts = (tree) => tree.root.findAllByType('Text').map((n) => [].concat(n.props.children).join(''));

  it('shows Settle to bank on every payment that can be settled, usable once available', async () => {
    api.get.mockResolvedValue({ data: { mode: 'test', settlement: { enabled: true, bankReady: true, bankSaved: true }, summary: {}, transactions: rows } });
    let tree;
    await act(async () => { tree = create(<DoctorEarningsScreen onBack={jest.fn()} />); });
    // Available (Asha) and pending (Neha) both show it; only the available one works.
    const settle = buttons(tree, 'Settle to bank');
    expect(settle.map((b) => b.props.disabled)).toEqual([false, true]);
    expect(texts(tree)).toContain('Available after the appointment is completed.');
    expect(buttons(tree, 'Check status')).toHaveLength(1);
  });

  it('keeps Settle to bank greyed out until payouts and the bank are ready', async () => {
    api.get.mockResolvedValue({ data: { mode: 'test', settlement: { enabled: false, bankReady: false, bankSaved: true }, summary: {}, transactions: rows } });
    let tree;
    await act(async () => { tree = create(<DoctorEarningsScreen onBack={jest.fn()} />); });
    expect(buttons(tree, 'Settle to bank').every((b) => b.props.disabled)).toBe(true);
    expect(texts(tree)).toContain("Bank payouts aren't ready yet.");
    expect(buttons(tree, 'Check status')[0].props.disabled).toBe(false);
  });
});
