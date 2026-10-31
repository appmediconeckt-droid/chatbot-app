// Earnings — the doctor's wallet: what patients paid for appointments (UPI,
// card, wallet or cash), the platform fee taken from each, the
// doctor's share, and the bank settlements. Every amount comes from the
// server's ledger (api/doctorEarnings), so it only moves once the server has
// verified a payment.
// Balances: Pending (paid, appointment not completed yet) → Available (fee
// deducted, waiting for the next settlement) → Settled to bank; a cancelled
// appointment's payment is held for refund review (web DoctorWallet.jsx).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles, doctorGradient } from '../theme';
import { formatFee } from '../../../../utils/consultationCurrency';
import useLiveRefresh from '../../../../hooks/useLiveRefresh';
import {
  PERIODS,
  SETTLEMENT_LABELS,
  STATUS_FILTERS,
  STATUS_META,
  loadDoctorEarnings,
  matchesSearch,
  methodLabel,
  settleTransaction,
} from '../api/doctorEarnings';

const EMPTY_SUMMARY = { pending: 0, available: 0, settled: 0, platformFees: 0, grossCollected: 0, refunded: 0, held: 0, processing: 0 };

const TYPE_META = {
  payment: { icon: 'arrow-down', color: '#047857', bg: '#ECFDF5' },
  settlement: { icon: 'business-outline', color: '#1D4ED8', bg: '#EFF6FF' },
  refund: { icon: 'return-down-back', color: '#B91C1C', bg: '#FEF2F2' },
  subscription: { icon: 'receipt-outline', color: '#B91C1C', bg: '#FEF2F2' },
  adjustment: { icon: 'create-outline', color: '#475467', bg: '#F2F4F7' },
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

const formatShortDateTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

const formatDay = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const initialsOf = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const titleOf = (tx) => {
  if (tx.type === 'settlement') return tx.status === 'completed' || tx.status === 'settled' ? 'Bank settlement completed' : 'Bank settlement';
  if (tx.type === 'refund') return tx.patientName ? `Refund · ${tx.patientName}` : 'Refund to patient';
  if (tx.type === 'subscription') return 'Platform subscription';
  if (tx.type === 'adjustment') return tx.note || 'Adjustment';
  return tx.patientName || 'Patient payment';
};

const amountColor = (tx) => (tx.type === 'payment' ? '#047857' : tx.type === 'settlement' ? '#1D4ED8' : tx.signedAmount < 0 ? '#B91C1C' : '#047857');

const appointmentLabel = (tx) => (tx.appointmentCode ? `#${tx.appointmentCode}` : tx.appointmentId ? `APT ${tx.appointmentId.slice(-8).toUpperCase()}` : '');

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.completed;
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }]}>
      <View style={[s.pillDot, { backgroundColor: meta.color }]} />
      <Text style={[s.pillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function BalanceColumn({ label, value, last }) {
  return (
    <View style={[s.balanceCol, !last && s.balanceColDivider]}>
      <Text style={s.balanceLabel} numberOfLines={1}>{label}</Text>
      <Text translate={false} style={s.balanceValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function SummaryRow({ icon, color, label, value, last }) {
  return (
    <View style={[s.summaryRow, !last && s.summaryRowDivider]}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={s.summaryLabel}>{label}</Text>
      <Text translate={false} style={s.summaryValue}>{value}</Text>
    </View>
  );
}

// Web "Bank settlement" column: a payment that is available can be settled
// once the server's payout is on and the bank account is ready; a requested
// payout can always be re-checked.
// A pending payment shows the button too (greyed, with the reason), so the
// doctor can see where settlement will happen.
const canSettleTx = (tx) => tx.payoutRequested || (tx.type === 'payment' && ['pending', 'available'].includes(tx.status));
// Why the button can't be used yet, or '' when it can.
const settleBlockedReason = (tx, payout) => {
  if (tx.payoutRequested) return '';
  if (tx.status !== 'available') return 'Available after the appointment is completed.';
  if (!(payout?.enabled && payout?.bankReady)) return "Bank payouts aren't ready yet.";
  return '';
};
const settleBlocked = (tx, payout) => Boolean(settleBlockedReason(tx, payout));

// Icon for the bank settlement strip at the foot of a card.
const SETTLEMENT_ICONS = {
  pending: 'hourglass-outline',
  available: 'wallet-outline',
  settled: 'checkmark-circle',
  processing: 'sync-outline',
  held: 'alert-circle-outline',
  failed: 'close-circle-outline',
  refunded: 'return-down-back',
  completed: 'checkmark-circle',
};

function TransactionCard({ tx, money, onPress, payout, settling, onSettle }) {
  const meta = TYPE_META[tx.type] || TYPE_META.adjustment;
  const status = STATUS_META[tx.status] || STATUS_META.completed;
  const isPayment = tx.type === 'payment';
  const initials = isPayment ? initialsOf(tx.patientName) : '';
  // The full split (patient paid, platform fee) is in the detail sheet.
  const appointment = appointmentLabel(tx);
  // Bank settlement state (web column); skipped when it would only repeat the
  // pill, and for pending (the Pending pill already says it).
  const settlement = SETTLEMENT_LABELS[tx.status];
  const showSettlement = Boolean(settlement) && settlement !== status.label && tx.status !== 'pending';
  const blockedReason = canSettleTx(tx) ? settleBlockedReason(tx, payout) : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.cardPressed]}>
      <View style={s.cardHead}>
        <View style={[s.avatar, { backgroundColor: meta.bg }]}>
          {initials
            ? <Text translate={false} style={[s.avatarText, { color: meta.color }]}>{initials}</Text>
            : <Ionicons name={meta.icon} size={17} color={meta.color} />}
        </View>
        <View style={s.flex}>
          <Text translate={false} style={s.cardTitle} numberOfLines={1}>{titleOf(tx)}</Text>
          <Text translate={false} style={s.cardSub} numberOfLines={1}>
            {[formatShortDateTime(tx.createdAt), methodLabel(tx.method)].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
        <StatusPill status={tx.status} />
      </View>

      {(!!tx.reference || !!appointment || !!tx.bankAccount) && (
        <View style={s.refRow}>
          {!!tx.reference && (
            <View style={[s.refChip, s.refChipGrow]}>
              <Ionicons name="receipt-outline" size={12} color="#475467" />
              <Text style={s.refLabel}>Txn ID</Text>
              <Text translate={false} style={s.refValue} numberOfLines={1} ellipsizeMode="middle">{tx.reference}</Text>
            </View>
          )}
          {!!appointment && (
            <View style={s.refChip}>
              <Ionicons name="calendar-outline" size={12} color="#475467" />
              <Text translate={false} style={s.refValue} numberOfLines={1}>{appointment}</Text>
            </View>
          )}
          {!!tx.bankAccount && (
            <View style={[s.refChip, s.refChipGrow]}>
              <Ionicons name="business-outline" size={12} color="#475467" />
              <Text translate={false} style={s.refValue} numberOfLines={1}>{tx.bankAccount}</Text>
            </View>
          )}
        </View>
      )}

      {showSettlement && (
        <View style={[s.settleStrip, { backgroundColor: status.bg }]}>
          <Ionicons name={SETTLEMENT_ICONS[tx.status] || 'business-outline'} size={14} color={status.color} />
          <Text style={[s.settleText, { color: status.color }]} numberOfLines={1}>{settlement}</Text>
        </View>
      )}

      {canSettleTx(tx) && (
        <Pressable
          onPress={() => onSettle(tx)}
          disabled={settling || settleBlocked(tx, payout)}
          style={[s.cardSettle, (settling || settleBlocked(tx, payout)) && s.settleButtonDisabled]}
        >
          {settling
            ? <ActivityIndicator size="small" color="#0F766E" />
            : (
              <>
                <Ionicons name={tx.payoutRequested ? 'refresh' : 'business-outline'} size={14} color="#0F766E" />
                <Text style={s.cardSettleText}>{tx.payoutRequested ? 'Check status' : 'Settle to bank'}</Text>
              </>
            )}
        </Pressable>
      )}
      {!!blockedReason && (
        <View style={s.cardSettleHintRow}>
          <Ionicons name="information-circle-outline" size={13} color="#667085" />
          <Text style={s.cardSettleHint}>{blockedReason}</Text>
        </View>
      )}
    </Pressable>
  );
}

const labelOf = (options, key) => options.find((option) => option.key === key)?.label || options[0]?.label || '';

// Dropdown field for a list filter: shows the chosen option, opens FilterSheet.
function FilterSelect({ icon, label, value, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [s.filterSelect, active && s.filterSelectActive, pressed && s.cardPressed]}
    >
      <Ionicons name={icon} size={15} color={active ? '#0F766E' : '#667085'} />
      <View style={s.flex}>
        <Text style={s.filterLabel}>{label}</Text>
        <Text style={[s.filterValue, active && s.filterValueActive]} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={active ? '#0F766E' : '#98A2B3'} />
    </Pressable>
  );
}

// Bottom sheet listing a filter's options; picking one closes it.
function FilterSheet({ visible, title, options, value, onSelect, onClose }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.sheetBackdrop}>
        <Pressable style={s.flex} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <Text style={[s.sheetTitle, s.flex]}>{title}</Text>
            <Pressable onPress={onClose} style={s.sheetClose} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color="#344054" />
            </Pressable>
          </View>
          <View style={s.sheetBody}>
            {options.map((option) => {
              const selected = option.key === value;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => { onSelect(option.key); onClose(); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [s.option, selected && s.optionSelected, pressed && s.cardPressed]}
                >
                  <Text style={[s.optionText, selected && s.optionTextSelected]}>{option.label}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={19} color="#0D9488" />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, strong, color }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text translate={false} style={[s.detailValue, strong && s.detailStrong, color && { color }]} selectable>{value}</Text>
    </View>
  );
}

function TransactionDetail({ tx, money, onClose, settlement, settling, onSettle }) {
  if (!tx) return null;
  const status = STATUS_META[tx.status] || STATUS_META.completed;
  const isSplit = tx.type === 'payment' || tx.type === 'refund';
  // Web "Bank settlement" column: a live payment that is available can be
  // settled once the server's payout is on and the bank account is ready; a
  // requested payout can always be re-checked.
  const canSettle = canSettleTx(tx);
  const settleDisabled = settling || settleBlocked(tx, settlement);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.sheetBackdrop}>
        <Pressable style={s.flex} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <View style={s.flex}>
              <Text translate={false} style={s.sheetTitle} numberOfLines={2}>{titleOf(tx)}</Text>
              <Text translate={false} style={s.cardSub}>{formatDateTime(tx.createdAt)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={s.sheetClose}><Ionicons name="close" size={20} color="#344054" /></Pressable>
          </View>
          <ScrollView contentContainerStyle={s.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={s.sheetAmountBox}>
              <Text translate={false} style={[s.sheetAmount, { color: amountColor(tx) }]}>
                {tx.signedAmount < 0 ? '−' : '+'}{money(Math.abs(tx.signedAmount))}
              </Text>
              <StatusPill status={tx.status} />
              {!!status.hint && <Text style={s.sheetHint}>{status.hint}</Text>}
            </View>
            <DetailRow label="Patient" value={tx.patientName} />
            <DetailRow label="Appointment ID" value={tx.appointmentCode ? `#${tx.appointmentCode}` : tx.appointmentId} />
            <DetailRow label={tx.type === 'settlement' ? 'UTR / Payout reference' : 'Transaction ID'} value={tx.reference} />
            <DetailRow label="Appointment date" value={formatDay(tx.appointmentDate)} />
            <DetailRow label="Clinic" value={tx.clinicName} />
            <DetailRow label="Payment method" value={methodLabel(tx.method)} />
            <DetailRow label="Bank settlement" value={SETTLEMENT_LABELS[tx.status]} />
            <DetailRow label="Payout UTR" value={tx.payoutUtr} />
            <DetailRow label="Payout failed" value={tx.payoutFailure} color="#B91C1C" />
            {isSplit ? (
              <>
                <View style={s.detailDivider} />
                <DetailRow label={tx.type === 'refund' ? 'Refunded to patient' : 'Paid by patient'} value={money(tx.gross)} />
                <DetailRow label={tx.type === 'refund' ? 'Platform fee reversed' : 'Platform fee'} value={`${tx.type === 'refund' ? '+' : '−'}${money(tx.platformFee)}`} color="#B91C1C" />
                {tx.gatewayFee > 0 && <DetailRow label="Payment gateway fee" value={`−${money(tx.gatewayFee)}`} color="#B91C1C" />}
                {tx.tax > 0 && <DetailRow label="Tax (GST)" value={`−${money(tx.tax)}`} color="#B91C1C" />}
                <DetailRow label={tx.type === 'refund' ? 'Taken from your earnings' : 'Your earning'} value={money(tx.net)} strong />
              </>
            ) : (
              <DetailRow label="Amount" value={money(tx.net)} strong />
            )}
            <View style={s.detailDivider} />
            <DetailRow label="Bank account" value={tx.bankAccount} />
            <DetailRow label="Ledger entry" value={tx.id} />
            <DetailRow label="Note" value={tx.note} />
            {canSettle && (
              <>
                <Pressable onPress={() => onSettle(tx)} disabled={settleDisabled} style={[s.settleButton, settleDisabled && s.settleButtonDisabled]}>
                  {settling
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={s.settleButtonText}>{tx.payoutRequested ? 'Check status' : 'Settle to bank'}</Text>}
                </Pressable>
                {!!settleBlockedReason(tx, settlement) && (
                  <Text style={s.settleHint}>{settleBlockedReason(tx, settlement)}</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function DoctorEarningsScreen({ onBack }) {
  const [period, setPeriod] = useState('all');
  const [status, setStatus] = useState('all');
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [currency, setCurrency] = useState('INR');
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notAvailable, setNotAvailable] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [settlement, setSettlement] = useState(null);
  const [settlingId, setSettlingId] = useState('');
  // Which filter dropdown is open: 'period', 'status' or null.
  const [picker, setPicker] = useState(null);
  const visible = useMemo(() => transactions.filter((tx) => matchesSearch(tx, search)), [transactions, search]);
  // Only the latest request may write: a slow answer for an old filter must
  // not replace the rows of the one now shown.
  const requestRef = useRef(0);

  const money = useCallback((amount) => formatFee(Number(amount) || 0, currency), [currency]);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      // A request that never reached the server (tunnel / Wi-Fi blip) is tried
      // twice more before "could not be loaded" shows; a server answer is not.
      let result;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await loadDoctorEarnings({ period, status });
          break;
        } catch (err) {
          if (err?.response || err?.notAvailable || attempt >= 2 || request !== requestRef.current) throw err;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      if (request !== requestRef.current) return;
      setError('');
      setNotAvailable(false);
      setCurrency(result.currency);
      setSummary(result.summary);
      setTransactions(result.transactions);
      setTotal(result.total);
      setTestMode(result.testMode);
      setSettlement(result.settlement);
      setSelected((current) => (current ? result.transactions.find((tx) => tx.id === current.id) || current : current));
    } catch (err) {
      if (request !== requestRef.current) return;
      setNotAvailable(Boolean(err?.notAvailable));
      setError(err?.notAvailable ? '' : (err?.response?.data?.message || 'Earnings could not be loaded. Pull down to try again.'));
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [period, status]);

  // The first load shows the spinner; a filter change keeps the balances on
  // screen and only swaps the list.
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (!loadedOnceRef.current) setLoading(true);
    loadedOnceRef.current = true;
    load();
  }, [load]);

  // A patient payment or an appointment completed / cancelled elsewhere moves
  // the balances (the web listens to the same events).
  useLiveRefresh(() => load(), ['wallet:updated', 'appointments:updated', 'payment:updated'], 30000, 90000);


  const settle = async (tx) => {
    const run = async () => {
      setSettlingId(tx.id);
      try {
        const result = await settleTransaction(tx);
        Alert.alert('Bank settlement', (testMode ? 'Test payout: ' : '') + result.message);
      } catch (err) {
        Alert.alert('Bank settlement', err?.response?.data?.message || 'Settlement could not be confirmed. Check status before trying again.');
      } finally {
        setSettlingId('');
        load();
      }
    };
    if (tx.payoutRequested) { run(); return; }
    const what = testMode ? 'a test payout of ' + money(tx.net) + ' (no real money)' : money(tx.net);
    Alert.alert('Settle to bank', 'Send ' + what + ' to your bank account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settle', onPress: run },
    ]);
  };

  const header = (
    <>
      <View style={s.modeRow}>
        <View style={[s.modeBadge, testMode && s.modeBadgeTest]}>
          <Ionicons name={testMode ? 'flask-outline' : 'radio-button-on'} size={13} color={testMode ? '#B45309' : '#047857'} />
          <Text style={[s.modeText, testMode && s.modeTextTest]}>{testMode ? 'Razorpay test payments' : 'Live payments'}</Text>
        </View>
      </View>
      <LinearGradient colors={doctorGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.flex}>
            <Text style={s.heroLabel}>Your earnings</Text>
            <Text translate={false} style={s.heroValue} numberOfLines={1} adjustsFontSizeToFit>{money(summary.pending + summary.available + summary.processing + summary.settled)}</Text>
          </View>
          <View style={s.heroIcon}><Ionicons name="wallet-outline" size={20} color="#FFF" /></View>
        </View>
        <Text style={s.heroHint}>After platform fee</Text>
        <View style={s.balances}>
          <BalanceColumn label="Pending" value={money(summary.pending)} />
          <BalanceColumn label="Available" value={money(summary.available)} />
          <BalanceColumn label="Settled" value={money(summary.settled)} last />
        </View>
      </LinearGradient>

      <View style={s.summaryCard}>
        <SummaryRow icon="card-outline" color="#047857" label="Total collected" value={money(summary.grossCollected)} />
        <SummaryRow icon="pricetag-outline" color="#B91C1C" label="Platform fees" value={money(summary.platformFees)} />
        <SummaryRow icon="sync-outline" color="#B45309" label="Settlement processing" value={money(summary.processing)} />
        <SummaryRow icon="alert-circle-outline" color="#B45309" label="Refund review" value={money(summary.held)} last />
      </View>

      <View style={s.listHead}>
        <Text style={s.sectionTitle}>Transactions</Text>
        {total > 0 && <Text translate={false} style={s.listCount}>{visible.length}</Text>}
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={16} color="#98A2B3" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Patient, appointment, transaction ID or clinic"
          placeholderTextColor="#98A2B3"
          style={s.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}><Ionicons name="close-circle" size={17} color="#98A2B3" /></Pressable>
        )}
      </View>

      <View style={s.filters}>
        <FilterSelect
          icon="calendar-outline"
          label="Period"
          value={labelOf(PERIODS, period)}
          active={period !== 'all'}
          onPress={() => setPicker('period')}
        />
        <FilterSelect
          icon="funnel-outline"
          label="Status"
          value={labelOf(STATUS_FILTERS, status)}
          active={status !== 'all'}
          onPress={() => setPicker('status')}
        />
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}
    </>
  );

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Earnings</Text>
          <Text style={s.subtitle}>Appointment payments and settlements</Text>
        </View>
      </View>
      {loading ? (
        <View style={s.loading}><ActivityIndicator color="#0D9488" /><Text style={s.muted}>Loading earnings…</Text></View>
      ) : notAvailable ? (
        <View style={s.loading}>
          <View style={s.emptyIcon}><Ionicons name="wallet-outline" size={26} color="#0D9488" /></View>
          <Text style={s.emptyTitle}>Earnings aren't live yet</Text>
          <Text style={s.emptyText}>The server doesn't provide the earnings ledger yet. Your payments and settlements will appear here once it does.</Text>
          <Pressable onPress={() => { setLoading(true); load(); }} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TransactionCard
              tx={item}
              money={money}
              onPress={() => setSelected(item)}
              payout={settlement}
              settling={settlingId === item.id}
              onSettle={settle}
            />
          )}
          ListHeaderComponent={header}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#0D9488']} />}
          ListEmptyComponent={error ? null : (
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="receipt-outline" size={24} color="#0D9488" /></View>
              <Text style={s.emptyTitle}>{total ? 'No transactions match your filters' : 'No payments received yet'}</Text>
              <Text style={s.emptyText}>
                {total
                  ? 'Try another search, period or status.'
                  : 'Appointment payments by UPI, card or wallet will appear here.'}
              </Text>
            </View>
          )}
        />
      )}
      <TransactionDetail
        tx={selected}
        money={money}
        onClose={() => setSelected(null)}
        settlement={settlement}
        settling={Boolean(settlingId) && settlingId === selected?.id}
        onSettle={settle}
      />
      <FilterSheet
        visible={picker === 'period'}
        title="Period"
        options={PERIODS}
        value={period}
        onSelect={setPeriod}
        onClose={() => setPicker(null)}
      />
      <FilterSheet
        visible={picker === 'status'}
        title="Status"
        options={STATUS_FILTERS}
        value={status}
        onSelect={setStatus}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F6F8FA' },
  header: { minHeight: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E4E7EC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#101828' },
  subtitle: { fontSize: 12, color: '#667085', marginTop: 1 },
  content: { padding: 16, paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { fontSize: 13, color: '#667085' },
  error: { fontSize: 13, color: '#DC2626', marginBottom: 10 },

  hero: { borderRadius: 18, padding: 18, marginBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2 },
  heroValue: { fontSize: 30, fontWeight: '800', color: '#FFF', marginTop: 2 },
  heroHint: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  balances: { flexDirection: 'row', marginTop: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  balanceCol: { flex: 1, paddingHorizontal: 10 },
  balanceColDivider: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.22)' },
  balanceLabel: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  balanceValue: { fontSize: 15, fontWeight: '800', color: '#FFF', marginTop: 3 },

  summaryCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', paddingHorizontal: 14, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  summaryRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  summaryLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#344054' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#101828' },

  listHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15.5, fontWeight: '800', color: '#101828' },
  listCount: { fontSize: 11.5, fontWeight: '800', color: '#475467', backgroundColor: '#EAECF0', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterSelect: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E7EC' },
  filterSelectActive: { borderColor: '#99E2D8', backgroundColor: '#F0FDFA' },
  filterLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', color: '#98A2B3' },
  filterValue: { fontSize: 13.5, fontWeight: '700', color: '#101828', marginTop: 1 },
  filterValueActive: { color: '#0F766E' },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optionSelected: { backgroundColor: '#F0FDFA' },
  optionText: { fontSize: 14.5, fontWeight: '600', color: '#344054' },
  optionTextSelected: { fontWeight: '800', color: '#0F766E' },

  card: {
    backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8,
    shadowColor: '#101828', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardPressed: { backgroundColor: '#F9FAFB' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#101828' },
  cardSub: { fontSize: 11.5, color: '#667085', marginTop: 2 },
  refRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  refChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', height: 24, paddingHorizontal: 8, borderRadius: 7, backgroundColor: '#F2F4F7' },
  refChipGrow: { flexShrink: 1 },
  refLabel: { fontSize: 10.5, fontWeight: '700', color: '#667085' },
  refValue: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: '#344054' },
  settleStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  settleText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E7EC', marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13.5, color: '#101828', paddingVertical: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 10.5, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0' },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 14.5, fontWeight: '800', color: '#101828', textAlign: 'center' },
  emptyText: { fontSize: 12.5, lineHeight: 18, color: '#667085', textAlign: 'center', marginTop: 4 },
  retry: { marginTop: 14, height: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.45)' },
  sheet: { maxHeight: '85%', backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 24 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', marginTop: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#101828' },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 18, paddingBottom: 12 },
  sheetAmountBox: { alignItems: 'center', gap: 6, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, marginBottom: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EAECF0' },
  sheetAmount: { fontSize: 26, fontWeight: '800' },
  sheetHint: { fontSize: 12, color: '#475467', textAlign: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 9 },
  detailLabel: { fontSize: 13, color: '#667085', fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 13.5, color: '#101828', fontWeight: '700', textAlign: 'right' },
  detailStrong: { fontSize: 15, fontWeight: '800', color: '#047857' },
  settleButton: { height: 46, borderRadius: 12, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  settleButtonDisabled: { opacity: 0.45 },
  cardSettle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, borderRadius: 9, borderWidth: 1, borderColor: '#99E2D8', backgroundColor: '#F0FDFA', marginTop: 8 },
  cardSettleText: { fontSize: 12.5, fontWeight: '800', color: '#0F766E' },
  cardSettleHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 5 },
  cardSettleHint: { flexShrink: 1, fontSize: 11, color: '#667085' },
  settleButtonText: { fontSize: 14.5, fontWeight: '800', color: '#FFF' },
  settleHint: { fontSize: 12, lineHeight: 17, color: '#667085', textAlign: 'center', marginTop: 8 },
  modeRow: { flexDirection: 'row', marginBottom: 10 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#ECFDF5' },
  modeBadgeTest: { backgroundColor: '#FFFBEB' },
  modeText: { fontSize: 12, fontWeight: '800', color: '#047857' },
  modeTextTest: { color: '#B45309' },
  detailDivider: { height: 1, backgroundColor: '#EAECF0', marginVertical: 6 },
});
