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
  Animated,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import axiosInstance from '../../../../../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import { DOCTOR } from '../../../../../../theme/palette';
import CounselorGradientButton from '../../../../../../components/common/CounselorGradientButton';
import GradientFill from '../../../../../../components/common/GradientFill';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

// Payout-domain statuses returned by the backend (`normalizeWithdrawalStatus`).
const STATUS_META = {
  pending: { color: '#B45309', bg: '#FEF3C7', label: 'Pending' },
  approved: { color: '#0369A1', bg: '#E0F2FE', label: 'Approved' },
  paid: { color: '#15803D', bg: '#DCFCE7', label: 'Paid' },
  rejected: { color: '#B91C1C', bg: '#FEE2E2', label: 'Rejected' },
  refunded: { color: '#B91C1C', bg: '#FEE2E2', label: 'Refunded' },
};

// What MAX types into the amount field. String(balance) put the raw float in,
// so a balance carrying binary noise from the earnings split (e.g.
// 4999.999999999999) filled the box with a dozen decimals. Rounds DOWN to
// paise: rounding up would land above the real balance and fail the
// "Insufficient balance" check on submit.
const toAmountInput = (v) => {
  const value = Math.floor((Number(v) || 0) * 100) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

// `embedded` = rendered inside the counselor dashboard's Earnings tab, which
// already sits below the global header (its own top safe-area inset). In that
// case we skip the top edge here so we don't add a second inset — the gap it
// created looked like a big empty space. As a full-screen modal it keeps top.
// ─── Loading skeleton (mirrors the earnings layout) ──────────────────────────
const useShimmer = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
};

const WalletSkeleton = ({ safeEdges }) => {
  const opacity = useShimmer();
  const Line = ({ w, h, mt = 0, dark = false }) => (
    <Animated.View
      style={{ width: w, height: h, marginTop: mt, borderRadius: 6, opacity, backgroundColor: dark ? '#EDF1F6' : '#E2E8F0' }}
    />
  );
  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={skel.balanceCard}>
          <Line w={130} h={13} dark />
          <Line w={170} h={30} mt={12} dark />
          <Line w={150} h={12} mt={14} dark />
          <Animated.View style={[skel.balanceBtn, { opacity }]} />
        </View>


        {/* Summary stat cards - four, matching summaryCards */}
        <View style={skel.summaryGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={skel.summaryCard}>
              <Line w="70%" h={10} />
              <Line w="55%" h={20} mt={12} />
              <Line w="80%" h={9} mt={10} />
            </View>
          ))}
        </View>

        {/* Revenue split - counselor share + platform commission */}
        {[1, 2].map((i) => (
          <View key={i} style={skel.splitCard}>
            <Line w={130} h={11} />
            <View style={skel.splitRow}>
              <Line w={60} h={24} />
              <Line w={140} h={10} />
            </View>
            <Animated.View style={[skel.splitTrack, { opacity }]} />
          </View>
        ))}

        {/* Earning history */}
        <View style={skel.card}>
          <Line w={120} h={15} />
          {[1, 2, 3].map((i) => (
            <View key={i} style={skel.listRow}>
              <View style={{ flex: 1 }}>
                <Line w="55%" h={12} />
                <Line w="75%" h={9} mt={7} />
              </View>
              <Line w={70} h={14} />
            </View>
          ))}
        </View>

        {/* Withdrawal requests */}
        <View style={skel.card}>
          <Line w={150} h={15} />
          {[1, 2].map((i) => (
            <View key={i} style={skel.listRow}>
              <View style={{ flex: 1 }}>
                <Line w="45%" h={12} />
                <Line w="65%" h={9} mt={7} />
              </View>
              <Animated.View style={[skel.statusPill, { opacity }]} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const skel = StyleSheet.create({
  balanceCard: { borderRadius: 20, padding: 20, marginBottom: 16, backgroundColor: '#DCE3EC' },
  balanceBtn: { height: 46, borderRadius: 12, marginTop: 18, backgroundColor: '#EDF1F6' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 16, marginBottom: 16,
  },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  dateBox: { flex: 1, height: 56, borderRadius: 12, backgroundColor: '#E2E8F0' },
  applyBtn: { width: 110, height: 44, borderRadius: 12, marginTop: 14, backgroundColor: '#E2E8F0' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard: {
    flexGrow: 1, flexBasis: '46%', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', padding: 14,
  },
  // Mirrors the two revenue-split cards.
  splitCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 16, marginBottom: 16,
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  splitTrack: { height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', marginTop: 12 },
  // Rows inside earning history / withdrawal requests.
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 14, marginTop: 4,
  },
  statusPill: { width: 66, height: 22, borderRadius: 999, backgroundColor: '#E2E8F0' },
});

// ─── Pagination ──────────────────────────────────────────────────────────────
// Both history lists used to render every row, so a counselor with a long
// earning history had the Withdrawal requests card pushed metres down the
// scroll - it was effectively invisible. Each list now shows one page at a time.
const PAGE_SIZE = 5;

const pageCountOf = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));

// Numbers to draw. Long histories collapse to first / window / last with gaps,
// so the row never wraps: 1 … 4 [5] 6 … 12
const pageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push('gapL');
  for (let i = from; i <= to; i += 1) out.push(i);
  if (to < total - 1) out.push('gapR');
  out.push(total);
  return out;
};

const Pagination = ({ page, total, onChange }) => {
  const { t } = useLanguageRender();
  const pages = pageCountOf(total);
  if (pages <= 1) return null;

  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  const Arrow = ({ dir, disabled }) => (
    <TouchableOpacity
      style={[styles.pageBox, disabled && styles.pageBoxDisabled]}
      disabled={disabled}
      onPress={() => onChange(dir === 'prev' ? page - 1 : page + 1)}
      activeOpacity={0.75}
    >
      <Feather
        name={dir === 'prev' ? 'chevron-left' : 'chevron-right'}
        size={16}
        color={disabled ? '#9DB0CC' : '#004AC6'}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.pagination}>
      <Text style={styles.pageSummary}>
        {t('Showing')} {first}-{last} {t('of')} {total}
      </Text>
      <View style={styles.pageRow}>
        <Arrow dir="prev" disabled={page <= 1} />
        {pageNumbers(page, pages).map((n) =>
          typeof n === 'string' ? (
            <View key={n} style={styles.pageGap}>
              <Text style={styles.pageGapText}>…</Text>
            </View>
          ) : (
            <TouchableOpacity
              key={n}
              style={[styles.pageBox, n === page && styles.pageBoxActive]}
              onPress={() => onChange(n)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pageBoxText, n === page && styles.pageBoxTextActive]}>{n}</Text>
            </TouchableOpacity>
          ),
        )}
        <Arrow dir="next" disabled={page >= pages} />
      </View>
    </View>
  );
};

const CounselorWallet = ({ onClose, embedded = false }) => {
  const { t } = useLanguageRender();
  const safeEdges = embedded ? ['bottom'] : ['top', 'bottom'];
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
  const [showDateFilter, setShowDateFilter] = useState(false);
  const insets = useSafeAreaInsets();
  const [earningsPage, setEarningsPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);

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
    // Collapse the panel once applied - the filter icon keeps its active dot, so
    // the state stays visible without the panel occupying the screen.
    setShowDateFilter(false);
  };

  const clearDateFilter = () => {
    setDraftRange({ from: null, to: null });
    setDateFilter({ from: '', to: '' });
    setError('');
  };

  const earnings = data?.earnings || [];
  const withdrawals = data?.withdrawals || [];

  // The 15s poll and the date filter both change list length under our feet;
  // without this a counselor left on page 4 of a list that shrank to 2 pages
  // would stare at an empty card.
  useEffect(() => {
    setEarningsPage((p) => Math.min(p, pageCountOf(earnings.length)));
  }, [earnings.length]);
  useEffect(() => {
    setWithdrawalsPage((p) => Math.min(p, pageCountOf(withdrawals.length)));
  }, [withdrawals.length]);

  const pagedEarnings = earnings.slice(
    (earningsPage - 1) * PAGE_SIZE,
    earningsPage * PAGE_SIZE,
  );
  const pagedWithdrawals = withdrawals.slice(
    (withdrawalsPage - 1) * PAGE_SIZE,
    withdrawalsPage * PAGE_SIZE,
  );
  const verifiedPayoutAccount = data?.payoutAccount?.isVerified ? data.payoutAccount : null;
  const counselorPercentage = data?.split?.counselorPercentage ?? 80;
  const platformPercentage = data?.split?.platformPercentage ?? 20;
  const instantOption = data?.payoutOptions?.instant || {};
  const standardOption = data?.payoutOptions?.standard || {};
  const balance = Number(data?.balance || 0);

  // Does the backend actually tell us what the instant fee is? A missing
  // feePercent is NOT the same as a 0% fee - showing "0% FEE / -Rs.0.00" for
  // missing data told the counselor the transfer was free when nobody knew.
  const hasInstantFeeData =
    instantOption.feePercent !== undefined && instantOption.feePercent !== null;
  const instantIsFree = instantOption.isFirstFree === true;

  const { estimatedFee, estimatedPayout, selectedFeePercent, canEstimate } = useMemo(() => {
    const requested = Number(amount || 0);
    if (payoutType !== 'instant') {
      // Standard payout has no fee, so the counselor receives the full amount.
      return {
        selectedFeePercent: 0,
        estimatedFee: 0,
        estimatedPayout: requested,
        canEstimate: true,
      };
    }
    // isFirstFree was ignored here: the box said "your first instant payout is
    // free" while "You will receive" still had the fee taken off it.
    if (instantIsFree) {
      return { selectedFeePercent: 0, estimatedFee: 0, estimatedPayout: requested, canEstimate: true };
    }
    if (!hasInstantFeeData) {
      return { selectedFeePercent: 0, estimatedFee: 0, estimatedPayout: 0, canEstimate: false };
    }
    // feePercent is a percentage (2 => 2%), so divide by 100. It was being used
    // as a plain multiplier, which charged 2x the amount as "fee" and left
    // "You will receive" pinned at Rs.0.00 for every instant payout.
    const feePercent = Number(instantOption.feePercent);
    const fee = Math.round((requested * (feePercent / 100) + Number.EPSILON) * 100) / 100;
    return {
      selectedFeePercent: feePercent,
      estimatedFee: fee,
      estimatedPayout: Math.max(0, requested - fee),
      canEstimate: true,
    };
  }, [amount, payoutType, instantOption.feePercent, hasInstantFeeData, instantIsFree]);

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
    return <WalletSkeleton safeEdges={safeEdges} />;
  }

  const summaryCards = [
    ['Available balance', data?.balance, 'Ready for withdrawal'],
    [
      data?.period?.filtered ? t('Earned in selected period') : t('Total earned'),
      data?.totalEarned,
      `${counselorPercentage}% counselor share`,
    ],
    ['Available for payout', data?.pendingPayout, 'Earned, but not withdrawn yet'],
    [
      data?.period?.filtered ? t('Period gross session value') : t('Gross session value'),
      data?.grossRevenue,
      `Platform received ${money(data?.platformCommission)}`,
    ],
  ];

  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      {/* `onClose` was accepted but never used and no header was rendered, so
          opening this screen as a modal (from Settings or Help & Support) left
          no way back. Skipped when embedded in the Earnings tab, which already
          has the dashboard's own navigation. */}
      {!embedded && onClose ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Earnings &amp; Payouts')}</Text>
          {/* Balances the back button so the title stays optically centred. */}
          <View style={styles.backBtn} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

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
          {/* Filter lives here now: the standalone "Filter by date" card took a
              full screen of height for something used occasionally. */}
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => setShowDateFilter((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
          >
            <Feather name="filter" size={16} color="#ffffff" />
            {(dateFilter.from || dateFilter.to) && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
          <Text style={styles.balanceLabel}>{t('Available Balance')}</Text>
          <Text style={styles.balanceValue}>{money(balance)}</Text>
          <View style={styles.balanceFooter}>
            <Feather name="trending-up" size={14} color="#C7DAFB" />
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

        {/* Date filter popup, opened by the filter icon on the balance card. */}
        <Modal
          visible={showDateFilter}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDateFilter(false)}
        >
          <View style={styles.filterOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowDateFilter(false)}
            />
            <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
              <View style={styles.filterGrabber} />
              <View style={styles.filterHeadRow}>
                <Text style={styles.cardTitle}>{t('Filter by date')}</Text>
                <TouchableOpacity
                  onPress={() => setShowDateFilter(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="x" size={18} color="#6B7C99" />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>
                {t('View complete earnings and withdrawals for any selected period.')}
              </Text>
              <View style={styles.dateRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('from')}>
                  <Text style={styles.dateBtnLabel}>{t('From')}</Text>
                  <Text style={styles.dateBtnValue}>
                    {draftRange.from ? formatDate(draftRange.from) : t('Any')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('to')}>
                  <Text style={styles.dateBtnLabel}>{t('To')}</Text>
                  <Text style={styles.dateBtnValue}>
                    {draftRange.to ? formatDate(draftRange.to) : t('Any')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateActions}>
                <CounselorGradientButton style={styles.applyBtn} onPress={applyDateFilter}>
                  <Text style={styles.applyBtnText}>{t('Apply')}</Text>
                </CounselorGradientButton>
                {(dateFilter.from || dateFilter.to) && (
                  <TouchableOpacity style={styles.clearBtn} onPress={clearDateFilter}>
                    <Text style={styles.clearBtnText}>{t('Clear')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {data?.period?.filtered && (
                <Text style={styles.periodNote}>
                  {t('Showing')} {data.period.earningCount} {t('earning records and')}{' '}
                  {data.period.withdrawalCount} {t('withdrawals')}
                  {data.period.from ? ` ${t('from')} ${data.period.from}` : ''}
                  {data.period.to ? ` ${t('to')} ${data.period.to}` : ''}.
                </Text>
              )}
            </View>
          </View>
        </Modal>

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
            <Text style={styles.cardTitle}>{t('Withdraw your earnings')}</Text>
            <Text style={styles.cardSub}>
              {t('Funds will be transferred to the bank account below.')}
            </Text>

            <Text style={styles.stepLabel}>1 · {t('Withdrawal amount')}</Text>
            <View style={styles.amountBox}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder={t('0.00')}
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <TouchableOpacity onPress={() => setAmount(toAmountInput(balance))}>
                <Text style={styles.maxBtn}>{t('MAX')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.stepLabel}>2 · {t('Payout speed')}</Text>
            <TouchableOpacity
              style={[styles.speedOption, payoutType === 'standard' && styles.speedOptionActive]}
              onPress={() => setPayoutType('standard')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.speedTitle}>{t('Standard payout')}</Text>
                <Text style={styles.speedSub}>
                  {t('Free')} · {t('Within')} {standardOption.etaDays || 3} {t('business days')}
                </Text>
              </View>
              <Text style={styles.speedTag}>{t('FREE')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.speedOption, payoutType === 'instant' && styles.speedOptionActive]}
              onPress={() => setPayoutType('instant')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.speedTitle}>{t('Instant payout')}</Text>
                <Text style={styles.speedSub}>
                  {t('Money arrives within')} {instantOption.etaMinutes || 30} {t('minutes')}
                </Text>
              </View>
              <Text style={styles.speedTag}>
                {instantIsFree
                  ? 'FIRST ONE FREE'
                  : hasInstantFeeData
                  ? `${Number(instantOption.feePercent)}% FEE`
                  : 'FEE APPLIES'}
              </Text>
            </TouchableOpacity>

            {payoutType === 'instant' && (
              <View style={styles.feeBox}>
                {instantIsFree ? (
                  <Text style={styles.feeText}>
                    Your first instant payout is free. No transfer fee this time.
                  </Text>
                ) : canEstimate ? (
                  <Text style={styles.feeText}>
                    Instant payout fee ({selectedFeePercent}%): -{money(estimatedFee)}
                  </Text>
                ) : (
                  <Text style={styles.feeText}>
                    The transfer fee for this payout will be confirmed when it is
                    processed.
                  </Text>
                )}
                {/* Only shown when the fee is actually known - a figure here
                    that ignored an unknown fee would be wrong, not just vague. */}
                {canEstimate && (
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>{t('You will receive')}</Text>
                    <Text style={styles.feeValue}>{money(estimatedPayout)}</Text>
                  </View>
                )}
              </View>
            )}

            {verifiedPayoutAccount ? (
              <>
                <Text style={styles.stepLabel}>3 · {t('Verified payout account')}</Text>
                <View style={styles.verifiedBox}>
                  <Feather name="check-circle" size={18} color="#004AC6" />
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
                <Text style={styles.stepLabel}>3 · {t('Verify bank account')}</Text>
                <Text style={styles.cardSub}>{t('Required only for your first withdrawal.')}</Text>

                <Text style={styles.label}>{t('Account holder name')}</Text>
                <TextInput
                  style={styles.input}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder={t('Name as shown on bank account')}
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.label}>{t('Account number')}</Text>
                <TextInput
                  style={styles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder={t('Enter account number')}
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>{t('IFSC code')}</Text>
                <TextInput
                  style={styles.input}
                  value={ifsc}
                  onChangeText={(v) => setIfsc(v.toUpperCase())}
                  placeholder={t('Example: SBIN0001234')}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>{t('Bank name')}</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder={t('Enter bank name')}
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
                    {payoutType === 'instant' ? t('Withdraw instantly') : t('Request withdrawal')}
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
        <View style={[styles.splitCard, { backgroundColor: '#EFF4FE', borderColor: '#C7DAFB' }]}>
          <Text style={[styles.splitLabel, { color: '#003A9B' }]}>{t('Counselor share')}</Text>
          <View style={styles.splitRow}>
            <Text style={[styles.splitValue, { color: '#002357' }]}>{counselorPercentage}%</Text>
            <Text style={[styles.splitHint, { color: '#003A9B' }]}>
              ₹{Math.round(500 * counselorPercentage / 100)} from every ₹500
            </Text>
          </View>
          <View style={[styles.splitTrack, { backgroundColor: '#DCE8FB' }]}>
            <View style={[styles.splitFill, { width: `${counselorPercentage}%`, overflow: 'hidden' }]}>
              <GradientFill />
            </View>
          </View>
        </View>
        <View style={[styles.splitCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
          <Text style={[styles.splitLabel, { color: '#b45309' }]}>{t('Platform commission')}</Text>
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
          <Text style={styles.cardTitle}>{t('Earning history')}</Text>
          {earnings.length ? (
            pagedEarnings.map((earning) => (
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
            <Text style={styles.empty}>{t('No paid session earnings yet.')}</Text>
          )}
          <Pagination page={earningsPage} total={earnings.length} onChange={setEarningsPage} />
        </View>

        {/* Withdrawal requests */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Withdrawal requests')}</Text>
          <Text style={styles.cardSub}>
            {t('Approved means the payout is being processed. Paid appears after the bank transfer completes.')}
          </Text>
          {withdrawals.length ? (
            pagedWithdrawals.map((item) => {
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
                    <Text style={[styles.statusText, { color: meta.color }]}>{t(meta.label)}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>{t('No withdrawal requests yet.')}</Text>
          )}
          <Pagination
            page={withdrawalsPage}
            total={withdrawals.length}
            onChange={setWithdrawalsPage}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pagination: { marginTop: 14, gap: 10 },
  pageSummary: { fontSize: 12, color: '#6B7C99', fontWeight: '600' },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pageBox: {
    minWidth: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D6E0F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  // Active page carries the counselor blue so it reads as the same family as
  // the earnings card.
  pageBoxActive: { backgroundColor: '#004AC6', borderColor: '#004AC6' },
  pageBoxDisabled: { backgroundColor: '#F1F5FC', borderColor: '#E4EAF6' },
  pageBoxText: { fontSize: 13, fontWeight: '700', color: '#33456B' },
  pageBoxTextActive: { color: '#FFFFFF' },
  pageGap: { minWidth: 18, height: 34, alignItems: 'center', justifyContent: 'center' },
  pageGapText: { fontSize: 13, color: '#9DB0CC', fontWeight: '700' },

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
  backBtn: { width: 28, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
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
  filterIconBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  // Small dot so an active filter is visible without opening the panel.
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFD166',
  },
  filterHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  filterGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6E0F5',
    marginBottom: 14,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 0.4 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  balanceFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  balanceSub: { color: '#C7DAFB', fontSize: 12, fontWeight: '600' },
  withdrawCta: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  withdrawCtaText: { color: '#004AC6', fontWeight: '800', fontSize: 14 },
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
    color: '#004AC6',
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
  periodNote: { marginTop: 10, fontSize: 12, fontWeight: '600', color: '#003A9B' },
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
  maxBtn: { color: '#004AC6', fontWeight: '800', fontSize: 13, paddingHorizontal: 6 },
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
  speedOptionActive: { borderColor: '#004AC6', backgroundColor: '#EFF4FE' },
  speedTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  speedSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  speedTag: { fontSize: 10, fontWeight: '900', color: '#004AC6', letterSpacing: 0.4 },
  feeBox: {
    backgroundColor: '#EFF4FE',
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
  feeLabel: { fontSize: 12, color: '#003A9B', fontWeight: '700' },
  feeValue: { fontSize: 16, color: '#002357', fontWeight: '800' },
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF4FE',
    borderWidth: 1,
    borderColor: '#C7DAFB',
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
