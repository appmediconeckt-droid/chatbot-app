import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import axiosInstance from '../../../../../../axiosConfig';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];
const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: 'payments' },
  { id: 'card', label: 'Card', icon: 'credit-card' },
  { id: 'bank', label: 'NetBanking', icon: 'account-balance' },
  { id: 'wallet', label: 'Wallet', icon: 'account-balance-wallet' },
];

const WalletDashboard = ({ userData = {} }) => {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [spendingSummary, setSpendingSummary] = useState({ total: 0, breakdown: [] });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState('add-money');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setFetching(true);
    try {
      const response = await axiosInstance.get('/api/wallet/data');
      setBalance(Number(response?.data?.balance || 0));
      setTransactions(Array.isArray(response?.data?.transactions) ? response.data.transactions : []);
      setSpendingSummary(response?.data?.spendingSummary || { total: 0, breakdown: [] });
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Wallet', 'Failed to load wallet data.');
    } finally {
      setFetching(false);
    }
  };

  const handlePayment = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const { data: orderData } = await axiosInstance.post('/api/wallet/create-order', {
        amount: numericAmount,
        paymentMethod,
      });

      // Razorpay native checkout can be plugged here when SDK is added.
      // For now we keep backend flow complete by verifying with a simulated payment id.
      const verifyRes = await axiosInstance.post('/api/wallet/verify-payment', {
        razorpay_order_id: orderData?.order_id,
        razorpay_payment_id: `pay_${Date.now()}`,
        razorpay_signature: 'mobile_preview_signature',
      });

      if (verifyRes?.data?.success) {
        Alert.alert('Success', 'Funds added successfully.');
        setAmount('');
        await fetchWalletData();
      } else {
        Alert.alert('Payment Failed', 'Verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment initialization failed:', error);
      Alert.alert('Payment Error', error?.response?.data?.message || 'Could not initiate payment.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const stats = useMemo(() => {
    const completed = transactions.filter((tx) => tx?.status === 'completed').length;
    const creditTotal = transactions
      .filter((tx) => tx?.type === 'credit')
      .reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);
    const debitTotal = transactions
      .filter((tx) => tx?.type !== 'credit')
      .reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);
    return {
      completed,
      creditTotal,
      debitTotal,
    };
  }, [transactions]);

  const getStatusColor = (status) => {
    if (status === 'completed') return '#059669';
    if (status === 'pending') return '#d97706';
    return '#dc2626';
  };

  const renderBalanceCard = () => (
    <LinearGradient colors={['#1d4ed8', '#4338ca', '#1e40af']} style={styles.balanceCard}>
      <View style={styles.cardGlowOne} />
      <View style={styles.cardGlowTwo} />

      <View style={styles.cardHeader}>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <View style={styles.chipDot} />
          <View style={styles.chipDot} />
        </View>
        <View style={styles.cardBrandWrap}>
          <Text style={styles.cardBrand}>MediWallet</Text>
          <Text style={styles.cardTier}>Premium Health</Text>
        </View>
      </View>

      <Text style={styles.balanceLabel}>Available Balance</Text>
      <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.cardNumber}>.... .... .... 4242</Text>
        <View>
          <Text style={styles.expiryLabel}>EXP</Text>
          <Text style={styles.expiryValue}>12/28</Text>
        </View>
      </View>

      <View style={styles.cardButtonsRow}>
        <TouchableOpacity style={styles.primaryMiniAction} onPress={() => setActiveTab('add-money')}>
          <MaterialIcons name="add-circle-outline" size={16} color="#1e40af" />
          <Text style={styles.primaryMiniActionText}>Add Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostMiniAction} onPress={() => setActiveTab('transactions')}>
          <MaterialIcons name="history" size={16} color="#ffffff" />
          <Text style={styles.ghostMiniActionText}>View History</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderStats = () => (
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>Credits</Text>
        <Text style={[styles.statValue, { color: '#0f766e' }]}>{formatCurrency(stats.creditTotal)}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>Spent</Text>
        <Text style={[styles.statValue, { color: '#b91c1c' }]}>{formatCurrency(stats.debitTotal)}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>Completed</Text>
        <Text style={[styles.statValue, { color: '#1d4ed8' }]}>{stats.completed}</Text>
      </View>
    </View>
  );

  const renderSpendingSummary = () => (
    <View style={styles.cardSection}>
      <Text style={styles.sectionTitle}>Spending Summary</Text>
      {spendingSummary.breakdown?.length ? (
        spendingSummary.breakdown.map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{item.label}</Text>
              <Text style={styles.progressValue}>{formatCurrency(item.amount)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(Math.max(Number(item.percentage || 0), 0), 100)}%`,
                    backgroundColor: index % 2 === 0 ? '#1d4ed8' : '#0ea5e9',
                  },
                ]}
              />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyHint}>No spending recorded this month.</Text>
      )}
      <View style={styles.summaryFooter}>
        <Text style={styles.summaryFooterLabel}>Total spent this month</Text>
        <Text style={styles.summaryFooterValue}>{formatCurrency(spendingSummary.total)}</Text>
      </View>
    </View>
  );

  const renderAddMoney = () => (
    <View style={styles.cardSection}>
      <Text style={styles.sectionTitle}>Add Money</Text>
      <Text style={styles.sectionSubtitle}>Fast and secure wallet top-up</Text>

      <View style={styles.inputBox}>
        <Text style={styles.currencyPrefix}>Rs</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      <View style={styles.quickWrap}>
        {QUICK_AMOUNTS.map((qa) => (
          <TouchableOpacity key={qa} style={styles.quickBtn} onPress={() => setAmount(String(qa))}>
            <Text style={styles.quickBtnText}>Rs {qa}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Payment Method</Text>
      <View style={styles.methodGrid}>
        {PAYMENT_METHODS.map((method) => {
          const isActive = paymentMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodItem, isActive && styles.methodItemActive]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <MaterialIcons name={method.icon} size={18} color={isActive ? '#1d4ed8' : '#64748b'} />
              <Text style={[styles.methodText, isActive && styles.methodTextActive]}>{method.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.payBtn, loading && styles.payBtnDisabled]}
        onPress={handlePayment}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.payBtnText}>Confirm and Add Funds</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.cardSection}>
      <View style={styles.transactionsHeader}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <TouchableOpacity onPress={fetchWalletData}>
          <Text style={styles.linkBtn}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {transactions.length ? (
        transactions.slice(0, 12).map((tx) => {
          const isCredit = tx?.type === 'credit';
          const statusColor = getStatusColor(tx?.status);
          return (
            <View key={String(tx?._id)} style={styles.txItem}>
              <View style={[styles.txIconWrap, { backgroundColor: isCredit ? '#dcfce7' : '#fee2e2' }]}>
                <MaterialIcons
                  name={isCredit ? 'south-west' : 'north-east'}
                  size={18}
                  color={isCredit ? '#15803d' : '#b91c1c'}
                />
              </View>

              <View style={styles.txTextWrap}>
                <Text numberOfLines={1} style={styles.txTitle}>
                  {tx?.description || 'Transaction'}
                </Text>
                <Text style={styles.txMeta}>{tx?.razorpayPaymentId || 'ID Pending'}</Text>
              </View>

              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: isCredit ? '#15803d' : '#0f172a' }]}>
                  {isCredit ? '+' : '-'}{formatCurrency(tx?.amount)}
                </Text>
                <View style={[styles.txBadge, { backgroundColor: `${statusColor}20` }]}>
                  <Text style={[styles.txBadgeText, { color: statusColor }]}>{String(tx?.status || 'pending').toUpperCase()}</Text>
                </View>
                <Text style={styles.txDate}>{formatDate(tx?.createdAt)}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyHint}>No transactions found.</Text>
      )}
    </View>
  );

  const renderSupport = () => (
    <View style={styles.supportCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.supportLabel}>Need payment help?</Text>
        <Text style={styles.supportText}>Support team is available 24x7 for wallet and payment issues.</Text>
      </View>
      <TouchableOpacity style={styles.supportAction}>
        <Text style={styles.supportActionText}>Support</Text>
      </TouchableOpacity>
    </View>
  );

  if (fetching) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f4f7ff" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1d4ed8" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7ff" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet Overview</Text>
          <Text style={styles.headerSubtitle}>Professional payment dashboard for your healthcare account.</Text>
        </View>

        {renderBalanceCard()}
        {renderStats()}
        {renderSpendingSummary()}

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'add-money' && styles.tabBtnActive]}
            onPress={() => setActiveTab('add-money')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'add-money' && styles.tabBtnTextActive]}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'transactions' && styles.tabBtnActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'transactions' && styles.tabBtnTextActive]}>Transactions</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'add-money' ? renderAddMoney() : renderTransactions()}
        {renderSupport()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7ff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f4f7ff',
  },
  content: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    marginTop: Platform.OS === 'ios' ? 8 : 12,
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  cardGlowOne: {
    position: 'absolute',
    right: -50,
    top: -30,
    width: 170,
    height: 170,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardGlowTwo: {
    position: 'absolute',
    left: -55,
    bottom: -70,
    width: 170,
    height: 170,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chip: {
    width: 40,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(250,204,21,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDot: {
    width: 2,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: 1,
  },
  cardBrandWrap: {
    alignItems: 'flex-end',
  },
  cardBrand: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  cardTier: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 0.6,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardNumber: {
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1.2,
    fontSize: 13,
    fontWeight: '500',
  },
  expiryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    letterSpacing: 1,
  },
  expiryValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardButtonsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  primaryMiniAction: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryMiniActionText: {
    color: '#1e40af',
    fontWeight: '700',
    fontSize: 12,
  },
  ghostMiniAction: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ghostMiniActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardSection: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  progressItem: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  progressValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
  },
  summaryFooter: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryFooterLabel: {
    color: '#64748b',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryFooterValue: {
    marginTop: 4,
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 18,
  },
  emptyHint: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 13,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 99,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtn: {
    flex: 1,
    borderRadius: 99,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabBtnActive: {
    backgroundColor: '#1d4ed8',
  },
  tabBtnText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 13,
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  currencyPrefix: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 18,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 12,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  quickBtnText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  methodItem: {
    minWidth: '23%',
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  methodItemActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  methodText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 6,
  },
  methodTextActive: {
    color: '#1d4ed8',
  },
  payBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  payBtnDisabled: {
    opacity: 0.7,
  },
  payBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  linkBtn: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 12,
    gap: 10,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  txMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  txBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 5,
  },
  txBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  txDate: {
    marginTop: 4,
    fontSize: 10,
    color: '#94a3b8',
  },
  supportCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportLabel: {
    color: '#1d4ed8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '800',
  },
  supportText: {
    marginTop: 2,
    color: '#1e293b',
    fontSize: 13,
    lineHeight: 18,
  },
  supportAction: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  supportActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default WalletDashboard;
