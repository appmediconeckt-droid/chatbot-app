// Doctor earnings wallet: what patients paid for appointments, the platform's
// fee, the doctor's share and the bank settlements, read from the server's
// ledger (never from what the app showed the patient).
//   GET /api/payments/wallet   (signed-in doctor; the same call as the web
//   DoctorDashboard/Earnings/DoctorWallet.jsx — no query params)
//   → { mode: 'test' | 'live', platformFeePercent, settlement: { enabled, bankSaved, bankReady },
//       summary: { pending, available, processing, settled, platformFees, held },
//       transactions: [{ id, createdAt, patient, appointmentId, paymentId, clinic, method,
//                        gross, platformFee, net, status, payoutRequested, payoutUtr, payoutFailure }] }
// A payment stays `pending` until its appointment is completed, then the
// doctor's share is `available`, and `settled` once paid out to the bank.
// A cancelled appointment's payment is `held` for refund review.
// Older field names (amount / doctorEarning / type settlement|refund …) are
// still read, so other ledger shapes keep working.
import axiosInstance from '../../../../axiosConfig';
import { pickFirst } from './doctorAppointments';

// First value that is a number (null / '' are missing, not 0), else 0.
const num = (...values) => {
  const value = values
    .filter((v) => v !== undefined && v !== null && v !== '')
    .map(Number)
    .find((v) => Number.isFinite(v));
  return value ?? 0;
};

// Rounded to paise: ledger sums can carry float noise (0.1 + 0.2).
const paise = (value) => Math.round(value * 100) / 100;

export const METHOD_LABELS = {
  upi: 'UPI',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  card: 'Card',
  wallet: 'Wallet',
  cash: 'Cash at Clinic',
  insurance: 'Insurance',
  netbanking: 'Net Banking',
  bank_transfer: 'Bank Transfer',
};

export const methodLabel = (method) => {
  const key = String(method || '').toLowerCase().replace(/[\s-]+/g, '_');
  return METHOD_LABELS[key] || (key ? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
};

const TYPE_ALIASES = {
  payment: 'payment', appointment_payment: 'payment', earning: 'payment', credit: 'payment',
  settlement: 'settlement', payout: 'settlement', withdrawal: 'settlement', transfer: 'settlement',
  refund: 'refund', reversal: 'refund', commission_reversal: 'refund', chargeback: 'refund',
  subscription: 'subscription', platform_subscription: 'subscription',
  adjustment: 'adjustment',
};

export const normalizeType = (value) => TYPE_ALIASES[String(value || '').toLowerCase()] || 'payment';

const STATUS_ALIASES = {
  pending: 'pending', authorized: 'pending', captured: 'pending',
  held: 'held', on_hold: 'held', refund_review: 'held', disputed: 'held',
  available: 'available', released: 'available', payable: 'available',
  settled: 'settled', paid_out: 'settled',
  processing: 'processing', initiated: 'processing', queued: 'processing', in_progress: 'processing',
  completed: 'completed', success: 'completed', processed: 'completed', paid: 'completed',
  failed: 'failed', rejected: 'failed', reversed: 'failed', cancelled: 'failed',
  refunded: 'refunded',
};

export const normalizeStatus = (value, type) => {
  const status = STATUS_ALIASES[String(value || '').toLowerCase().replace(/[\s-]+/g, '_')];
  if (status) return status;
  return type === 'payment' ? 'pending' : 'completed';
};

// Label and colours of a status pill, plus what it means for the doctor.
export const STATUS_META = {
  pending: { label: 'Pending', color: '#B45309', bg: '#FFFBEB', hint: 'Released when the appointment is completed' },
  available: { label: 'Available', color: '#047857', bg: '#ECFDF5', hint: 'Ready for the next bank settlement' },
  settled: { label: 'Settled', color: '#1D4ED8', bg: '#EFF6FF', hint: 'Transferred to your bank account' },
  processing: { label: 'Processing', color: '#B45309', bg: '#FFFBEB', hint: 'Transfer to your bank is in progress' },
  completed: { label: 'Completed', color: '#047857', bg: '#ECFDF5', hint: '' },
  held: { label: 'Refund review', color: '#B91C1C', bg: '#FEF2F2', hint: 'Appointment cancelled — held for refund review' },
  failed: { label: 'Failed', color: '#B91C1C', bg: '#FEF2F2', hint: 'Not completed; the amount stays in your balance' },
  refunded: { label: 'Refunded', color: '#B91C1C', bg: '#FEF2F2', hint: 'Returned to the patient' },
};

// Bank settlement column of the web table (DoctorWallet.jsx), per status.
export const SETTLEMENT_LABELS = {
  pending: 'Pending appointment completion',
  available: 'Available · bank settlement pending',
  held: 'Held for refund review',
  settled: 'Bank settlement completed',
  processing: 'Bank settlement processing',
  completed: 'Completed',
  failed: 'Bank settlement failed',
  refunded: 'Refunded to patient',
};

// The web's search box: patient, appointment, payment reference or clinic.
export const matchesSearch = (tx, query) => {
  const text = String(query || '').trim().toLowerCase();
  if (!text) return true;
  return [tx.patientName, tx.appointmentId, tx.appointmentCode, tx.reference, tx.clinicName]
    .some((value) => String(value || '').toLowerCase().includes(text));
};

const nameOf = (value) => (typeof value === 'string' ? value : pickFirst(value?.full_name, value?.fullName, value?.name, value?.clinic_name));

export const normalizeTransaction = (row, index = 0) => {
  const type = normalizeType(pickFirst(row?.type, row?.entryType, row?.entry_type, row?.kind, row?.category));
  const status = normalizeStatus(pickFirst(row?.status, row?.settlementStatus, row?.settlement_status, row?.state), type);
  const gross = paise(Math.abs(num(row?.gross, row?.amount, row?.grossAmount, row?.gross_amount, row?.totalAmount, row?.total_amount)));
  const platformFee = paise(Math.abs(num(row?.platformFee, row?.platform_fee, row?.commission, row?.commissionAmount, row?.commission_amount)));
  const net = paise(Math.abs(num(
    row?.net, row?.doctorEarning, row?.doctor_earning, row?.netAmount, row?.net_amount, row?.earningAmount,
    type === 'payment' || type === 'refund' ? gross - platformFee : gross,
  )));
  // How the doctor's balance moved: a payment adds the share, a settlement
  // moves it to the bank, a refund / plan fee takes it back.
  const signedAmount = type === 'payment' ? net
    : type === 'adjustment' ? paise(num(row?.doctorEarning, row?.doctor_earning, row?.amount))
      : -net;
  return {
    id: String(pickFirst(row?._id, row?.id, row?.transactionId, row?.transaction_id, `${type}-${index}`)),
    type,
    status,
    createdAt: pickFirst(row?.createdAt, row?.created_at, row?.date, row?.paidAt, row?.paid_at) || null,
    appointmentId: String(pickFirst(row?.appointmentId, row?.appointment_id, row?.appointment?._id, row?.appointment?.id) || ''),
    appointmentCode: String(pickFirst(row?.appointmentCode, row?.appointment_code, row?.appointment?.token_number, row?.appointment?.code) || ''),
    appointmentDate: pickFirst(row?.appointmentDate, row?.appointment_date, row?.appointment?.appointment_date) || null,
    patientName: nameOf(pickFirst(row?.patientName, row?.patient_name, row?.patient, row?.user, row?.patientId)) || '',
    clinicName: nameOf(pickFirst(row?.clinicName, row?.clinic_name, row?.clinic)) || '',
    method: String(pickFirst(row?.paymentMethod, row?.payment_method, row?.method) || ''),
    gross,
    platformFee,
    net,
    signedAmount,
    gatewayFee: paise(Math.abs(num(row?.gatewayFee, row?.gateway_fee, 0))),
    tax: paise(Math.abs(num(row?.tax, row?.gst, 0))),
    reference: String(pickFirst(row?.reference, row?.utr, row?.paymentId, row?.payment_id, row?.razorpayPaymentId, row?.payoutId, row?.payout_id) || ''),
    bankAccount: String(pickFirst(row?.bankAccount, row?.bank_account, row?.accountNumber, row?.account) || ''),
    note: String(pickFirst(row?.note, row?.description, row?.failureReason, row?.failure_reason) || ''),
    // Bank settlement of this payment (web "Bank settlement" column).
    payoutRequested: Boolean(row?.payoutRequested ?? row?.payout_requested),
    payoutUtr: String(pickFirst(row?.payoutUtr, row?.payout_utr) || ''),
    payoutFailure: String(pickFirst(row?.payoutFailure, row?.payout_failure) || ''),
  };
};

export const normalizeSummary = (summary = {}) => ({
  pending: paise(num(summary.pending, summary.pendingEarnings, summary.pending_earnings, summary.pendingBalance, summary.pending_balance)),
  available: paise(num(summary.available, summary.availableBalance, summary.available_balance, summary.balance)),
  settled: paise(num(summary.settled, summary.settledToBank, summary.settled_to_bank, summary.totalSettled, summary.settledBalance, summary.settled_balance, summary.settledAmount)),
  platformFees: paise(num(summary.platformFees, summary.platform_fees, summary.totalCommission, summary.commission, summary.totalPlatformFees, summary.total_platform_fees, summary.platformFee)),
  grossCollected: paise(num(summary.grossCollected, summary.gross_collected, summary.totalCollected, summary.total_collected, summary.totalReceived, summary.total)),
  refunded: paise(num(summary.refunded, summary.totalRefunded, summary.total_refunded, summary.refunds)),
  held: paise(num(summary.held, summary.refundReview, summary.refund_review, summary.onHold, summary.on_hold)),
  processing: paise(num(summary.processing, summary.settlementProcessing, summary.settlement_processing)),
});

// YYYY-MM-DD in the device's own day.
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const PERIODS = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

// { from, to } (inclusive YYYY-MM-DD) of a period, or {} for all time.
export const periodRange = (key, now = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === 'today') return { from: dayKey(today), to: dayKey(today) };
  if (key === 'week') return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), to: dayKey(today) };
  if (key === 'month') return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dayKey(today) };
  if (key === 'lastMonth') {
    return {
      from: dayKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: dayKey(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  return {};
};

// The web's status filter (Pending earnings / Available / Settled / Refund review).
export const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'available', label: 'Available' },
  { key: 'processing', label: 'Processing' },
  { key: 'settled', label: 'Settled' },
  { key: 'held', label: 'Refund review' },
];

// The web loads the whole ledger and filters it on the page; so does the app.
const matchesFilters = (tx, { from, to, status }) => {
  if (status && status !== 'all' && tx.status !== status) return false;
  if ((from || to) && tx.createdAt) {
    const day = dayKey(new Date(tx.createdAt));
    if (from && day < from) return false;
    if (to && day > to) return false;
  }
  return true;
};

// The ledger: its rows and balances, normalized.
const readLedger = (part) => {
  const rows = [part?.transactions, part?.ledger, part?.entries, part?.history, part?.wallet?.transactions, part?.data]
    .find(Array.isArray) || [];
  const all = rows.map(normalizeTransaction);
  // The balances may come as `summary`, `wallet`, `balances`, or at the top level.
  const summary = [part?.summary, part?.wallet, part?.balances].find((v) => v && typeof v === 'object' && !Array.isArray(v)) || part || {};
  const totals = normalizeSummary(summary);
  // The web's summary has no "total collected": add up what patients paid.
  const payments = all.filter((tx) => tx.type === 'payment');
  if (!totals.grossCollected) {
    totals.grossCollected = paise(payments.reduce((sum, tx) => sum + tx.gross, 0));
  }
  // The server's platformFees stays 0 while payments are pending, though each
  // payment already shows its fee: show the same fee total as the rows.
  if (!totals.platformFees) {
    totals.platformFees = paise(payments.reduce((sum, tx) => sum + tx.platformFee, 0));
  }
  return { all, totals, currency: pickFirst(part?.currency, summary?.currency) };
};

// The doctor's earnings ledger, normalized, filtered by period and status
// (same call as the web DoctorWallet.jsx):
//   GET /api/payments/wallet → { mode: 'test' | 'live', platformFeePercent,
//     settlement: { enabled, bankSaved, bankReady }, summary, transactions }
// In test mode the server lists Razorpay test payments only; old dummy
// payments are left out.
// Rejects with `notAvailable: true` when the server has no earnings ledger yet.
export const loadDoctorEarnings = async ({ period = 'all', status = 'all' } = {}) => {
  const range = periodRange(period);
  let data;
  try {
    ({ data } = await axiosInstance.get('/api/payments/wallet'));
  } catch (error) {
    if (error?.response?.status === 404) throw Object.assign(new Error('Earnings are not available on the server yet.'), { notAvailable: true });
    throw error;
  }
  const body = data?.data && !Array.isArray(data.data) ? data.data : data;
  const ledger = readLedger(body);
  const fee = Number(body?.platformFeePercent);
  return {
    currency: String(pickFirst(body?.currency, ledger.currency) || 'INR').toUpperCase(),
    testMode: String(body?.mode || '').toLowerCase() === 'test',
    platformFeePercent: Number.isFinite(fee) ? fee : null,
    summary: ledger.totals,
    transactions: ledger.all.filter((tx) => matchesFilters(tx, { ...range, status })),
    total: ledger.all.length,
    // { enabled, bankSaved, bankReady } — whether "Settle to bank" can be used.
    settlement: body?.settlement && typeof body.settlement === 'object' ? body.settlement : null,
  };
};

// "Settle to bank" / "Check status" for one live payment (web settle):
//   POST /api/payments/wallet/:id/settlement { checkOnly }
// checkOnly re-reads a payout already requested instead of sending another.
// Resolves { status: 'completed' | 'failed' | 'processing', message }.
export const settleTransaction = async (tx) => {
  const { data } = await axiosInstance.post(
    `/api/payments/wallet/${encodeURIComponent(tx.id)}/settlement`,
    { checkOnly: Boolean(tx.payoutRequested) },
  );
  const status = String(data?.settlementStatus || 'processing').toLowerCase();
  const message = status === 'completed' ? 'Bank settlement completed.'
    : status === 'failed' ? 'Bank settlement failed. The amount is available again. Contact support before retrying.'
      : 'Settlement is processing. Use Check status to confirm the bank result.';
  return { status, message };
};
