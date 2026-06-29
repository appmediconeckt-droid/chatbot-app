import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import axiosInstance from '../../../../../../axiosConfig';

const STATUS_META = {
  pending: { color: '#D97706', bg: '#FEF3C7', label: 'Pending' },
  approved: { color: '#2563EB', bg: '#DBEAFE', label: 'Approved' },
  paid: { color: '#16A34A', bg: '#DCFCE7', label: 'Paid' },
  rejected: { color: '#DC2626', bg: '#FEE2E2', label: 'Rejected' },
};

const formatCurrency = (v) =>
  `Rs ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CounselorWallet = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);

  const [amount, setAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  const fetchWallet = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/api/wallet/counselor');
      setBalance(Number(data?.balance || 0));
      setTotalEarned(Number(data?.totalEarned || 0));
      setWithdrawals(Array.isArray(data?.withdrawals) ? data.withdrawals : []);
      const pa = data?.payoutAccount;
      if (pa) {
        setAccountName((prev) => prev || pa.accountName || '');
        setAccountNumber((prev) => prev || pa.accountNumber || '');
        setIfsc((prev) => prev || pa.ifsc || '');
        setBankName((prev) => prev || pa.bankName || '');
      }
    } catch (err) {
      console.error('Failed to load counselor wallet:', err?.response?.data || err?.message);
      Alert.alert('Wallet', 'Could not load your earnings. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const handleWithdraw = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid withdrawal amount.');
      return;
    }
    if (numericAmount > balance) {
      Alert.alert('Insufficient balance', `You can withdraw up to ${formatCurrency(balance)}.`);
      return;
    }
    if (!accountName.trim() || !accountNumber.trim() || !ifsc.trim()) {
      Alert.alert('Bank details required', 'Enter account name, account number and IFSC.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/api/wallet/withdraw', {
        amount: numericAmount,
        bankDetails: {
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          bankName: bankName.trim(),
        },
      });
      if (data?.success) {
        Alert.alert('Request submitted', data.message || 'Your withdrawal request was submitted.');
        setAmount('');
        await fetchWallet();
      } else {
        Alert.alert('Withdrawal failed', data?.message || 'Could not submit your request.');
      }
    } catch (err) {
      Alert.alert('Withdrawal failed', err?.response?.data?.message || err?.message || 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings & Payouts</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
          <View style={styles.balanceFooter}>
            <Feather name="trending-up" size={14} color="#bbf7d0" />
            <Text style={styles.balanceSub}>Total earned: {formatCurrency(totalEarned)}</Text>
          </View>
        </View>

        {/* Withdraw form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Withdraw Funds</Text>
          <Text style={styles.cardSub}>Request a payout to your bank account.</Text>

          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountBox}>
            <Text style={styles.currency}>Rs</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <Text style={styles.label}>Account holder name</Text>
          <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="As per bank records" placeholderTextColor="#9ca3af" />

          <Text style={styles.label}>Account number</Text>
          <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="Bank account number" placeholderTextColor="#9ca3af" keyboardType="number-pad" />

          <Text style={styles.label}>IFSC code</Text>
          <TextInput style={styles.input} value={ifsc} onChangeText={setIfsc} placeholder="e.g. HDFC0001234" placeholderTextColor="#9ca3af" autoCapitalize="characters" />

          <Text style={styles.label}>Bank name (optional)</Text>
          <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g. HDFC Bank" placeholderTextColor="#9ca3af" />

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !amount) && styles.submitDisabled]}
            onPress={handleWithdraw}
            disabled={submitting || !amount}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <><Feather name="send" size={16} color="#fff" /><Text style={styles.submitText}>Request Withdrawal</Text></>
            )}
          </TouchableOpacity>
          <Text style={styles.note}>Requests are reviewed and paid by the admin.</Text>
        </View>

        {/* History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Withdrawal History</Text>
          {withdrawals.length ? (
            withdrawals.map((w) => {
              const meta = STATUS_META[w.status] || STATUS_META.pending;
              return (
                <View key={String(w._id)} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histAmount}>{formatCurrency(w.amount)}</Text>
                    <Text style={styles.histDate}>{formatDate(w.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>No withdrawals yet.</Text>
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
  balanceCard: {
    backgroundColor: '#1d4ed8',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 0.4 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  balanceFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  balanceSub: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
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
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  note: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 10 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 12,
  },
  histAmount: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  histDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  empty: { fontSize: 13, color: '#94a3b8', marginTop: 8 },
});

export default CounselorWallet;
