import axiosInstance from '../src/axiosConfig';
import {
  loadDoctorEarnings,
  methodLabel,
  normalizeSummary,
  normalizeTransaction,
  periodRange,
  settleTransaction,
} from '../src/features/doctor/dashboard/api/doctorEarnings';

jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../src/features/doctor/dashboard/api/doctorAppointments', () => ({
  pickFirst: (...values) => values.find((value) => value !== undefined && value !== null && value !== ''),
}));

describe('doctor earnings ledger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('splits a patient payment into platform fee and doctor earning', () => {
    const tx = normalizeTransaction({
      _id: 't1', type: 'payment', status: 'pending', amount: 500, platformFee: 50,
      paymentMethod: 'upi', patient: { full_name: 'Asha Rao' }, clinic: { clinic_name: 'City Clinic' },
      appointment_id: 'apt-9', createdAt: '2026-10-20T10:00:00Z',
    });
    expect(tx).toMatchObject({
      id: 't1', type: 'payment', status: 'pending', gross: 500, platformFee: 50, net: 450, signedAmount: 450,
      method: 'upi', patientName: 'Asha Rao', clinicName: 'City Clinic', appointmentId: 'apt-9',
    });
  });

  it('uses the server net when given, and a null field is not read as 0', () => {
    expect(normalizeTransaction({ type: 'payment', amount: 500, platformFee: 50, doctorEarning: 430 }).net).toBe(430);
    expect(normalizeTransaction({ type: 'payment', amount: 500, platform_fee: 50, doctorEarning: null }).net).toBe(450);
  });

  it('takes settlements and refunds out of the balance', () => {
    const payout = normalizeTransaction({ type: 'payout', status: 'processed', amount: 900, utr: 'UTR123', bankAccount: 'HDFC ••1234' });
    expect(payout).toMatchObject({ type: 'settlement', status: 'completed', net: 900, signedAmount: -900, reference: 'UTR123' });
    const refund = normalizeTransaction({ type: 'refund', amount: 500, platformFee: 50 });
    expect(refund).toMatchObject({ type: 'refund', net: 450, signedAmount: -450 });
  });

  it('rounds sums to paise and reads summary aliases', () => {
    expect(normalizeSummary({ pendingEarnings: 0.1 + 0.2, available_balance: '900', totalCommission: 150 }))
      .toMatchObject({ pending: 0.3, available: 900, platformFees: 150, settled: 0 });
  });

  it('labels payment methods', () => {
    expect(methodLabel('credit_card')).toBe('Credit Card');
    expect(methodLabel('wallet')).toBe('Wallet');
    expect(methodLabel('net-banking')).toBe('Net Banking');
    expect(methodLabel('')).toBe('');
  });

  it('computes period ranges in local days', () => {
    const now = new Date(2026, 9, 27, 15, 0);
    expect(periodRange('today', now)).toEqual({ from: '2026-10-27', to: '2026-10-27' });
    expect(periodRange('week', now)).toEqual({ from: '2026-10-21', to: '2026-10-27' });
    expect(periodRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-27' });
    expect(periodRange('lastMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('all', now)).toEqual({});
  });

  it('reads the web wallet answer (gross / net / held) like DoctorWallet.jsx', async () => {
    axiosInstance.get.mockResolvedValue({ data: {
      summary: { pending: 450, available: 900, settled: 0, platformFees: 150, held: 270 },
      transactions: [
        { id: 'p1', createdAt: '2026-10-25T10:00:00Z', patient: 'Asha Rao', appointmentId: 'apt-1', paymentId: 'pay_1', clinic: 'City Clinic', method: 'wallet', gross: 500, platformFee: 50, net: 450, status: 'pending' },
        { id: 'p2', createdAt: '2026-10-24T10:00:00Z', patient: 'Ravi', appointmentId: 'apt-2', paymentId: 'pay_2', clinic: 'City Clinic', method: 'credit_card', gross: 300, platformFee: 30, net: 270, status: 'held' },
      ],
      demo: { summary: { pending: 99999 }, transactions: [] },
    } });
    const result = await loadDoctorEarnings();
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/payments/wallet');
    expect(result.summary).toMatchObject({ pending: 450, available: 900, platformFees: 150, held: 270, grossCollected: 800 });
    expect(result.transactions[0]).toMatchObject({
      id: 'p1', patientName: 'Asha Rao', clinicName: 'City Clinic', method: 'wallet', reference: 'pay_1',
      gross: 500, platformFee: 50, net: 450, signedAmount: 450, status: 'pending',
    });
    expect(result.transactions[1].status).toBe('held');
    expect(result.total).toBe(2);
    await expect(loadDoctorEarnings({ status: 'held' })).resolves.toMatchObject({ transactions: [{ id: 'p2' }], total: 2 });
  });

  it('filters by status and period on the device', async () => {
    axiosInstance.get.mockResolvedValue({ data: {
      currency: 'inr',
      summary: { available: 450 },
      transactions: [
        { _id: 'a', status: 'available', gross: 500, platformFee: 50, createdAt: new Date().toISOString() },
        { _id: 'b', status: 'pending', gross: 500, platformFee: 50, createdAt: '2020-01-01T10:00:00Z' },
      ],
    } });
    const result = await loadDoctorEarnings({ status: 'available' });
    expect(result.currency).toBe('INR');
    expect(result.summary.available).toBe(450);
    expect(result.transactions.map((tx) => tx.id)).toEqual(['a']);
    expect((await loadDoctorEarnings({ period: 'today' })).transactions.map((tx) => tx.id)).toEqual(['a']);
  });

  it('reads a wallet-shaped answer (balances under wallet, rows under ledger)', async () => {
    axiosInstance.get.mockResolvedValue({ data: { success: true, data: {
      wallet: { availableBalance: 900, pendingBalance: 450, settledBalance: 1350, totalPlatformFees: 300, currency: 'INR' },
      ledger: [{ _id: 'l1', type: 'payment', amount: 500, platformFee: 50 }],
    } } });
    const result = await loadDoctorEarnings();
    expect(result.summary).toMatchObject({ available: 900, pending: 450, settled: 1350, platformFees: 300 });
    expect(result.transactions.map((tx) => tx.net)).toEqual([450]);
  });

  it('reports a server without the earnings ledger', async () => {
    axiosInstance.get.mockRejectedValue({ response: { status: 404 } });
    await expect(loadDoctorEarnings()).rejects.toMatchObject({ notAvailable: true });
  });
});

describe('test mode and bank payouts (web DoctorWallet)', () => {
  const row = { id: 'l1', createdAt: '2026-10-27T10:00:00Z', patient: 'Asha', gross: 500, platformFee: 100, net: 400, status: 'available', method: 'upi', paymentId: 'pay_1' };

  it('reads the mode, fee and payout setup the server sends', async () => {
    axiosInstance.get.mockResolvedValue({ data: {
      success: true, mode: 'test', platformFeePercent: 20,
      settlement: { enabled: false, bankReady: false, bankSaved: true },
      summary: { pending: 0, available: 0, processing: 0, settled: 0, platformFees: 0, held: 0 },
      transactions: [],
    } });
    const result = await loadDoctorEarnings();
    expect(result).toMatchObject({ testMode: true, platformFeePercent: 20, total: 0, settlement: { enabled: false, bankSaved: true } });
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/payments/wallet');
  });

  it('reads payout fields and the processing balance', async () => {
    axiosInstance.get.mockResolvedValue({ data: { mode: 'live', summary: { processing: 400 }, transactions: [{ ...row, status: 'processing', payoutRequested: true, payoutUtr: 'UTR9' }] } });
    const result = await loadDoctorEarnings();
    expect(result).toMatchObject({ testMode: false, summary: { processing: 400 } });
    expect(result.transactions[0]).toMatchObject({ status: 'processing', payoutRequested: true, payoutUtr: 'UTR9' });
  });

  it('settles a payment, or only checks a payout already requested', async () => {
    axiosInstance.post = jest.fn().mockResolvedValue({ data: { settlementStatus: 'processing' } });
    await expect(settleTransaction({ id: 'l1', payoutRequested: false })).resolves.toMatchObject({ status: 'processing' });
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/payments/wallet/l1/settlement', { checkOnly: false });
    axiosInstance.post.mockResolvedValue({ data: { settlementStatus: 'completed' } });
    await expect(settleTransaction({ id: 'l1', payoutRequested: true })).resolves.toEqual({ status: 'completed', message: 'Bank settlement completed.' });
    expect(axiosInstance.post).toHaveBeenLastCalledWith('/api/payments/wallet/l1/settlement', { checkOnly: true });
  });
});
