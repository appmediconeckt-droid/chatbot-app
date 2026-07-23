import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import axiosInstance from '../../../../../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import { DOCTOR } from '../../../../../../theme/palette';
import CounselorGradientButton from '../../../../../../components/common/CounselorGradientButton';

// Payout-domain statuses returned by the backend (`normalizeWithdrawalStatus`).
const STATUS_META = {
  pending: { color: '#B45309', bg: '#FEF3C7', label: 'Pending' },
  approved: { color: '#0369A1', bg: '#E0F2FE', label: 'Approved' },
  paid: { color: '#15803D', bg: '#DCFCE7', label: 'Paid' },
  rejected: { color: '#B91C1C', bg: '#FEE2E2', label: 'Rejected' },
  refunded: { color: '#B91C1C', bg: '#FEE2E2', label: 'Refunded' },
};

const money = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (d) => {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// The API expects India calendar dates as YYYY-MM-DD, so format from local
// parts rather than toISOString() (which would shift the day back in IST).
const toApiDate = (date) => {
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const CounselorWallet = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [amount, setAmount] = useState('');
  const [payoutType, setPayoutType] = useState('standard');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  // Applied filter drives the request; the draft only moves when Apply is hit,
  // matching the web form's behaviour.
  const [draftRange, setDraftRange] = useState({ from: null, to: null });
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [picker, setPicker] = useState(null); // 'from' | 'to' | null

  // Keeps the polling effect from re-subscribing on every state change.
  const filterRef = useRef(dateFilter);
  filterRef.current = dateFilter;

  const loadEarnings = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const params = {};
      if (filterRef.current.from) params.from = filterRef.current.from;
      if (filterRef.current.to) params.to = filterRef.current.to;
      const response = await axiosInstance.get('/api/wallet/counselor', { params });
      setData(response.data);
      setError('');
    } catch (requestError) {
      console.error('Counselor earnings load failed:', requestError?.response?.data || requestError?.message);
      setError(requestError?.response?.data?.message || 'Earnings could not be loaded.');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Live refresh, same as web: poll every 15s and refetch when the app returns
  // to the foreground (the RN equivalent of the web's window focus listener).
  useEffect(() => {
    void loadEarnings();
    const timer = setInterval(() => void loadEarnings({ silent: true }), 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadEarnings({ silent: true });
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loadEarnings, dateFilter.from, dateFilter.to]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEarnings({ silent: true });
  };

  const applyDateFilter = () => {
    const from = toApiDate(draftRange.from);
    const to = toApiDate(draftRange.to);
    if (from && to && from > to) {
      setError('From date cannot be after To date.');
      return;
    }
    setError('');
    setDateFilter({ from, to });
  };

  const clearDateFilter = () => {
    setDraftRange({ from: null, to: null });
    setDateFilter({ from: '', to: '' });
    setError('');
  };

  const earnings = data?.earnings || [];
  const withdrawals = data?.withdrawals || [];
  const verifiedPayoutAccount = data?.payoutAccount?.isVerified ? data.payoutAccount : null;
  const counselorPercentage = data?.split?.counselorPercentage ?? 80;
  const platformPercentage = data?.split?.platformPercentage ?? 20;
  const instantOption = data?.payoutOptions?.instant || {};
  const standardOption = data?.payoutOptions?.standard || {};
  const balance = Number(data?.balance || 0);

  const { estimatedFee, estimatedPayout, selectedFeePercent } = useMemo(() => {
    const requested = Number(amount || 0);
    const feePercent = payoutType === 'instant' ? Number(instantOption.feePercent || 0) : 0;
    const fee = Math.round((requested * feePercent + Number.EPSILON) * 100) / 100;
    return {
      selectedFeePercent: feePercent,
      estimatedFee: fee,
      estimatedPayout: Math.max(0, requested - fee),
    };
  }, [amount, payoutType, instantOption.feePercent]);

  const submitWithdrawal = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid withdrawal amount.');
      return;
    }
    if (numericAmount > balance) {
      Alert.alert('Insufficient balance', `You can withdraw up to ${money(balance)}.`);
      return;
    }
    // Bank details are only required until the account is verified; after the
    // first withdrawal the backend reuses the saved account.
    if (!verifiedPayoutAccount) {
      if (!accountName.trim() || !accountNumber.trim() || !ifsc.trim() || !bankName.trim()) {
        Alert.alert('Bank details required', 'Account holder name, account number, IFSC and bank name are all required for your first withdrawal.');
        return;
      }
      if (!/^\d{8,20}$/.test(accountNumber.replace(/\s+/g, ''))) {
        Alert.alert('Invalid account number', 'Enter a valid 8 to 20 digit account number.');
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) {
        Alert.alert('Invalid IFSC', 'Enter a valid IFSC code, for example SBIN0001234.');
        return;
      }
    }

    setSubmitting(true);
    try {
      // The API reads these as FLAT fields, not a nested bankDetails object.
      const { data: result } = await axiosInstance.post('/api/wallet/withdraw', {
        amount: numericAmount,
        payoutType,
        ...(verifiedPayoutAccount
          ? {}
          : {
              accountName: accountName.trim(),
              accountNumber: accountNumber.replace(/\s+/g, ''),
              ifsc: ifsc.trim().toUpperCase(),
              bankName: bankName.trim(),
            }),
      });
      Alert.alert('Request submitted', result?.message || 'Withdrawal request submitted successfully.');
      setAmount('');
      setShowWithdrawal(false);
      await loadEarnings();
    } catch (requestError) {
      Alert.alert(
        'Withdrawal failed',
        requestError?.response?.data?.message || requestError?.message || 'Withdrawal request could not be submitted.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      </SafeAreaView>
    );
  }

  const summaryCards = [
    ['Available balance', data?.balance, 'Ready for withdrawal'],
    [
      data?.period?.filtered ? 'Earned in selected period' : 'Total earned',
      data?.totalEarned,
      `${counselorPercentage}% counselor share`,
    ],
    ['Available for payout', data?.pendingPayout, 'Earned, but not withdrawn yet'],
    [
      data?.period?.filtered ? 'Period gross session value' : 'Gross session value',
      data?.grossRevenue,
      `Platform received ${money(data?.platformCommission)}`,
    ],
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.pageSub}>
          Live earning data from completed paid chat, voice and video sessions.
        </Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Balance card */}
        <LinearGradient
          colors={[DOCTOR.gradientFrom, DOCTOR.gradientTo]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{money(balance)}</Text>
          <View style={styles.balanceFooter}>
            <Feather name="trending-up" size={14} color="#c7d2fe" />
            <Text style={styles.balanceSub}>Total earned: {money(data?.totalEarned)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.withdrawCta, balance <= 0 && styles.submitDisabled]}
            disabled={balance <= 0}
            onPress={() => setShowWithdrawal((v) => !v)}
          >
            <Text style={styles.withdrawCtaText}>
              {showWithdrawal ? 'Close' : 'Withdraw funds'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Date filter */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter by date</Text>
          <Text style={styles.cardSub}>
            View complete earnings and withdrawals for any selected period.
          </Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('from')}>
              <Text style={styles.dateBtnLabel}>From</Text>
              <Text style={styles.dateBtnValue}>
                {draftRange.from ? formatDate(draftRange.from) : 'Any'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('to')}>
              <Text style={styles.dateBtnLabel}>To</Text>
              <Text style={styles.dateBtnValue}>
                {draftRange.to ? formatDate(draftRange.to) : 'Any'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateActions}>
            <CounselorGradientButton style={styles.applyBtn} onPress={applyDateFilter}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </CounselorGradientButton>
            {(dateFilter.from || dateFilter.to) && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearDateFilter}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {data?.period?.filtered && (
            <Text style={styles.periodNote}>
              Showing {data.period.earningCount} earning records and{' '}
              {data.period.withdrawalCount} withdrawals
              {data.period.from ? ` from ${data.period.from}` : ''}
              {data.period.to ? ` to ${data.period.to}` : ''}.
            </Text>
          )}
        </View>

        {picker && (
          <DateTimePicker
            value={draftRange[picker] || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selected) => {
              setPicker(null);
              if (event.type === 'dismissed' || !selected) return;
              setDraftRange((current) => ({ ...current, [picker]: selected }));
            }}
          />
        )}

        {/* Withdrawal form */}
        {showWithdrawal && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Withdraw your earnings</Text>
            <Text style={styles.cardSub}>
              Funds will be transferred to the bank account below.
            </Text>

            <Text style={styles.stepLabel}>1 · Withdrawal amount</Text>
            <View style={styles.amountBox}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <TouchableOpacity onPress={() => setAmount(String(balance))}>
                <Text style={styles.maxBtn}>MAX</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.stepLabel}>2 · Payout speed</Text>
            <TouchableOpacity
              style={[styles.speedOption, payoutType === 'standard' && styles.speedOptionActive]}
              onPress={() => setPayoutType('standard')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.speedTitle}>Standard payout</Text>
                <Text style={styles.speedSub}>
                  Free · Within {standardOption.etaDays || 3} business days
                </Text>
              </View>
              <Text style={styles.speedTag}>FREE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.speedOption, payoutType === 'instant' && styles.speedOptionActive]}
              onPress={() => setPayoutType('instant')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.speedTitle}>Instant payout</Text>
                <Text style={styles.speedSub}>
                  Money arrives within {instantOption.etaMinutes || 30} minutes
                </Text>
              </View>
              <Text style={styles.speedTag}>
                {instantOption.isFirstFree ? 'FIRST ONE FREE' : `${instantOption.feePercent || 0}% FEE`}
              </Text>
            </TouchableOpacity>

            {payoutType === 'instant' && (
              <View style={styles.feeBox}>
                {instantOption.isFirstFree ? (
                  <Text style={styles.feeText}>
                    Your first instant payout is free. No transfer fee this time.
                  </Text>
                ) : (
                  <Text style={styles.feeText}>
                    Instant payout fee ({selectedFeePercent}%): -{money(estimatedFee)}
                  </Text>
                )}
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>You will receive</Text>
                  <Text style={styles.feeValue}>{money(estimatedPayout)}</Text>
                </View>
              </View>
            )}

            {verifiedPayoutAccount ? (
              <>
                <Text style={styles.stepLabel}>3 · Verified payout account</Text>
                <View style={styles.verifiedBox}>
                  <Feather name="check-circle" size={18} color="#15803d" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifiedBank}>{verifiedPayoutAccount.bankName}</Text>
                    <Text style={styles.verifiedMeta}>
                      {verifiedPayoutAccount.accountName} · Account ending in{' '}
                      {verifiedPayoutAccount.last4}
                    </Text>
                    <Text style={styles.verifiedMeta}>IFSC: {verifiedPayoutAccount.ifsc}</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.stepLabel}>3 · Verify bank account</Text>
                <Text style={styles.cardSub}>Required only for your first withdrawal.</Text>

                <Text style={styles.label}>Account holder name</Text>
                <TextInput
                  style={styles.input}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Name as shown on bank account"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.label}>Account number</Text>
                <TextInput
                  style={styles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="Enter account number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>IFSC code</Text>
                <TextInput
                  style={styles.input}
                  value={ifsc}
                  onChangeText={(v) => setIfsc(v.toUpperCase())}
                  placeholder="Example: SBIN0001234"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>Bank name</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="Enter bank name"
                  placeholderTextColor="#9ca3af"
                />
              </>
            )}

            <View style={styles.secureNote}>
              <Feather name="lock" size={13} color="#64748b" />
              <Text style={styles.secureText}>
                {verifiedPayoutAccount
                  ? `Funds will be sent to the account ending in ${verifiedPayoutAccount.last4}.`
                  : 'After the first withdrawal this account is saved, and next time only the amount is required.'}
              </Text>
            </View>

            <CounselorGradientButton
              style={[styles.submitBtn, (submitting || !amount) && styles.submitDisabled]}
              onPress={submitWithdrawal}
              disabled={submitting || !amount}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#fff" />
                  <Text style={styles.submitText}>
                    {payoutType === 'instant' ? 'Withdraw instantly' : 'Request withdrawal'}
                  </Text>
                </>
              )}
            </CounselorGradientButton>
          </View>
        )}

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          {summaryCards.map(([label, value, caption]) => (
            <View key={label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{money(value)}</Text>
              <Text style={styles.summaryCaption}>{caption}</Text>
            </View>
          ))}
        </View>

        {/* Revenue split */}
        <View style={[styles.splitCard, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
          <Text style={[styles.splitLabel, { color: '#4338ca' }]}>Counselor share</Text>
          <View style={styles.splitRow}>
            <Text style={[styles.splitValue, { color: '#1e1b4b' }]}>{counselorPercentage}%</Text>
            <Text style={[styles.splitHint, { color: '#4338ca' }]}>
              ₹{Math.round(500 * counselorPercentage / 100)} from every ₹500
            </Text>
          </View>
          <View style={[styles.splitTrack, { backgroundColor: '#e0e7ff' }]}>
            <View style={[styles.splitFill, { width: `${counselorPercentage}%`, backgroundColor: '#4f46e5' }]} />
          </View>
        </View>
        <View style={[styles.splitCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
          <Text style={[styles.splitLabel, { color: '#b45309' }]}>Platform commission</Text>
          <View style={styles.splitRow}>
            <Text style={[styles.splitValue, { color: '#451a03' }]}>{platformPercentage}%</Text>
            <Text style={[styles.splitHint, { color: '#b45309' }]}>
              ₹{Math.round(500 * platformPercentage / 100)} from every ₹500
            </Text>
          </View>
          <View style={[styles.splitTrack, { backgroundColor: '#fef3c7' }]}>
            <View style={[styles.splitFill, { width: `${platformPercentage}%`, backgroundColor: '#f59e0b' }]} />
          </View>
        </View>

        {/* Earning history */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Earning history</Text>
          {earnings.length ? (
            earnings.map((earning) => (
              <View key={String(earning._id)} style={styles.earnRow}>
                <View style={styles.earnHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.earnUser}>
                      {earning.userId?.anonymous || 'Anonymous User'}
                    </Text>
                    <Text style={styles.earnMeta}>
                      {earning.sessionType} session · {formatDate(earning.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.earnNet}>+{money(earning.earningAmount)}</Text>
                </View>
                <View style={styles.earnBreakdown}>
                  <Text style={styles.earnBreakItem}>Gross {money(earning.totalAmount)}</Text>
                  <Text style={[styles.earnBreakItem, { color: '#b45309' }]}>
                    Platform -{money(earning.commission)}
                  </Text>
                </View>
                <View style={styles.earnBadges}>
                  <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.badgeText, { color: '#15803d' }]}>
                      {earning.earningStatus || 'completed'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: earning.payoutStatus === 'paid' ? '#dcfce7' : '#fef3c7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: earning.payoutStatus === 'paid' ? '#15803d' : '#b45309' },
                      ]}
                    >
                      {earning.payoutStatus === 'pending' ? 'Available' : earning.payoutStatus}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No paid session earnings yet.</Text>
          )}
        </View>

        {/* Withdrawal requests */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Withdrawal requests</Text>
          <Text style={styles.cardSub}>
            Approved means the payout is being processed. Paid appears after the bank transfer
            completes.
          </Text>
          {withdrawals.length ? (
            withdrawals.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.pending;
              return (
                <View key={String(item._id)} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histAmount}>
                      {money(item.metadata?.netAmount ?? item.amount)}
                    </Text>
                    <Text style={styles.histDate}>
                      {item.metadata?.bankName || 'Bank account'} ·{' '}
                      {String(item.metadata?.accountNumber || '').slice(-4) || '----'}
                    </Text>
                    <Text style={styles.histDate}>
                      {item.metadata?.payoutType || 'standard'} ·{' '}
                      {item.metadata?.estimatedArrival || 'Standard processing'} ·{' '}
                      {formatDate(item.createdAt)}
                    </Text>
                    {Number(item.metadata?.feeAmount || 0) > 0 && (
                      <Text style={styles.histFee}>Fee {money(item.metadata.feeAmount)}</Text>
                    )}
                    {item.status === 'paid' && item.metadata?.transactionReference && (
                      <Text style={styles.histUtr}>UTR: {item.metadata.transactionReference}</Text>
                    )}
                    {item.status === 'rejected' && item.metadata?.failureReason && (
                      <Text style={styles.histFee}>
                        {item.metadata.failureReason} · Amount returned to wallet
                      </Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>No withdrawal requests yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { width: 22 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  content: { padding: 16, paddingBottom: 48 },
  pageSub: { fontSize: 13, color: '#64748b', marginBottom: 14 },
  errorBox: {
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#be123c', fontSize: 13, fontWeight: '600' },
  balanceCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 0.4 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  balanceFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  balanceSub: { color: '#c7d2fe', fontSize: 12, fontWeight: '600' },
  withdrawCta: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  withdrawCtaText: { color: '#4f46e5', fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  cardSub: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 6 },
  stepLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateBtnLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  dateBtnValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 3 },
  dateActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  applyBtn: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  clearBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  clearBtnText: { color: '#334155', fontWeight: '800', fontSize: 13 },
  periodNote: { marginTop: 10, fontSize: 12, fontWeight: '600', color: '#4338ca' },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currency: { color: '#334155', fontWeight: '700', fontSize: 18, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', color: '#0f172a', paddingVertical: 12 },
  maxBtn: { color: '#4f46e5', fontWeight: '800', fontSize: 13, paddingHorizontal: 6 },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  speedOptionActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  speedTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  speedSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  speedTag: { fontSize: 10, fontWeight: '900', color: '#4f46e5', letterSpacing: 0.4 },
  feeBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  feeText: { fontSize: 12, color: '#3730a3', fontWeight: '600' },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  feeLabel: { fontSize: 12, color: '#4338ca', fontWeight: '700' },
  feeValue: { fontSize: 16, color: '#1e1b4b', fontWeight: '800' },
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
  },
  verifiedBank: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  verifiedMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  secureNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16 },
  secureText: { flex: 1, fontSize: 11, color: '#64748b', lineHeight: 16 },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: { fontSize: 19, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  summaryCaption: { fontSize: 11, color: '#64748b', marginTop: 4 },
  splitCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  splitLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  splitValue: { fontSize: 28, fontWeight: '800' },
  splitHint: { fontSize: 12, fontWeight: '600' },
  splitTrack: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  splitFill: { height: '100%', borderRadius: 999 },
  earnRow: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 12 },
  earnHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  earnUser: { fontSize: 14, fontWeight: '800', color: '#0f172a', textTransform: 'capitalize' },
  earnMeta: { fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'capitalize' },
  earnNet: { fontSize: 15, fontWeight: '800', color: '#15803d' },
  earnBreakdown: { flexDirection: 'row', gap: 14, marginTop: 6 },
  earnBreakItem: { fontSize: 12, color: '#475569', fontWeight: '600' },
  earnBadges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  histRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 12,
    gap: 10,
  },
  histAmount: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  histDate: { fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'capitalize' },
  histFee: { fontSize: 11, color: '#be123c', marginTop: 2, fontWeight: '600' },
  histUtr: { fontSize: 11, color: '#15803d', marginTop: 2, fontWeight: '700' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  empty: { fontSize: 13, color: '#94a3b8', marginTop: 8 },
});

export default CounselorWallet;
