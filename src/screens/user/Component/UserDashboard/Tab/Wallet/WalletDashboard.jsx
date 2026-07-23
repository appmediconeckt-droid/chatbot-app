import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import RazorpayCheckout from 'react-native-razorpay';
import axiosInstance from '../../../../../../axiosConfig';
import PATIENT from '../../../../../../theme/palette';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];
const PAYMENT_METHODS = [
  { id: 'upi', labelKey: 'wallet:upi', icon: 'payments' },
  { id: 'card', labelKey: 'wallet:card', icon: 'credit-card' },
  { id: 'bank', labelKey: 'wallet:netbanking', icon: 'account-balance' },
  { id: 'wallet', labelKey: 'wallet:walletPayment', icon: 'account-balance-wallet' },
];

const WalletSkeleton = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return (
    <View style={walletSkel.wrap}>
      <Animated.View style={[walletSkel.headerTitle, { opacity }]} />
      <Animated.View style={[walletSkel.headerSub, { opacity }]} />
      <Animated.View style={[walletSkel.balanceCard, { opacity }]} />
      <View style={walletSkel.statsRow}>
        <Animated.View style={[walletSkel.statBox, { opacity }]} />
        <Animated.View style={[walletSkel.statBox, { opacity }]} />
        <Animated.View style={[walletSkel.statBox, { opacity }]} />
      </View>
      <Animated.View style={[walletSkel.summaryCard, { opacity }]} />
      <View style={walletSkel.tabs}>
        <Animated.View style={[walletSkel.tabPill, { opacity }]} />
        <Animated.View style={[walletSkel.tabPill, { opacity }]} />
      </View>
      <Animated.View style={[walletSkel.bigCard, { opacity }]} />
      <Animated.View style={[walletSkel.supportCard, { opacity }]} />
    </View>
  );
};

const WalletDashboard = ({ userData = {} }) => {
  const { t } = useLanguageRender();
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
      Alert.alert('Wallet', t('wallet:walletFailedToLoad'));
    } finally {
      setFetching(false);
    }
  };

  const handlePayment = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert(t('wallet:invalidAmount'), t('wallet:pleaseEnterValidAmount'));
      return;
    }

    setLoading(true);
    try {
      // Create order on backend
      console.log('[wallet] creating order, amount=', numericAmount);
      const { data: orderData } = await axiosInstance.post('/api/wallet/create-order', {
        amount: numericAmount,
        paymentMethod,
      });
      console.log('[wallet] order response:', JSON.stringify(orderData));

      // Mirror the web checks: an incomplete order can't open checkout.
      if (!orderData?.order_id || !orderData?.key_id || !orderData?.amount) {
        throw new Error('Payment order response is incomplete');
      }

      // RazorpayCheckout.open is a static JS method that ALWAYS exists, so
      // checking it tells us nothing. The real test is whether the NATIVE
      // module got compiled into this build — if it didn't, open() registers
      // listeners and then silently fails, leaving the button spinning forever.
      // Under the New Architecture the module is a TurboModule, so ask the
      // TurboModuleRegistry first; NativeModules alone can read as null there.
      const nativeRazorpay =
        TurboModuleRegistry.get('RNRazorpayCheckout') ||
        NativeModules.RNRazorpayCheckout;
      console.log('[wallet] native Razorpay module present?', !!nativeRazorpay);
      if (!nativeRazorpay) {
        Alert.alert(
          'Payment not available in this build',
          'Razorpay is installed but its native module is not compiled into the app yet.\n\n' +
            'Run this once to fix it:\n\nnpx react-native run-android\n\n' +
            '(A JS/Metro reload is not enough — a native rebuild is required.)',
        );
        setLoading(false);
        return;
      }

      // Razorpay rejects/hangs on empty prefill strings — only send real values.
      const prefill = {};
      if (userData?.email) prefill.email = String(userData.email);
      if (userData?.phone || userData?.phoneNumber) {
        prefill.contact = String(userData.phone || userData.phoneNumber);
      }
      if (userData?.name || userData?.fullName) {
        prefill.name = String(userData.name || userData.fullName);
      }

      const options = {
        // The Razorpay SDK reads the publishable key from `key` — NOT `key_id`.
        // With the wrong name the native open() throws, gets swallowed, and no
        // success/error event is ever emitted, so the promise below never
        // settles and the button spins forever. Same field the web uses.
        key: orderData.key_id,
        amount: orderData.amount,
        currency: 'INR',
        order_id: orderData.order_id,
        name: 'Mediconeckt Wallet',
        description: 'Wallet Top-up',
        ...(Object.keys(prefill).length ? { prefill } : {}),
        theme: { color: '#4648d4' },
      };
      console.log('[wallet] opening Razorpay with options:', JSON.stringify(options));

      let settled = false;
      // Safety net: if the native checkout never settles, don't leave the
      // button spinning forever — clear it and refresh so state stays honest.
      const watchdog = setTimeout(() => {
        if (!settled) {
          console.warn('[wallet] Razorpay did not respond in time');
          setLoading(false);
          fetchWalletData();
        }
      }, 120000);

      try {
        const data = await RazorpayCheckout.open(options);
        settled = true;
        clearTimeout(watchdog);
        console.log('[wallet] payment success:', JSON.stringify(data));
        await verifyPayment(
          orderData?.order_id,
          data?.razorpay_payment_id,
          data?.razorpay_signature,
        );
      } catch (err) {
        settled = true;
        clearTimeout(watchdog);
        // Razorpay returns code 0 / "Payment Cancelled" when the user backs out.
        const cancelled =
          err?.code === 0 ||
          /cancel/i.test(String(err?.description || err?.message || ''));
        console.error('[wallet] Razorpay Error:', JSON.stringify(err), err?.message);
        Alert.alert(
          cancelled ? t('wallet:paymentCancelled') : t('wallet:paymentFailed'),
          cancelled
            ? 'You cancelled the payment. No money was deducted.'
            : err?.description || err?.message || 'Payment could not be completed.',
        );
        setLoading(false);
        // The order stays "pending" server-side on cancel — refresh so the list
        // reflects reality instead of showing a stale state.
        fetchWalletData();
      }
    } catch (error) {
      console.error(
        '[wallet] init failed:',
        error?.response?.status,
        JSON.stringify(error?.response?.data),
        error?.message,
      );
      Alert.alert(
        t('wallet:paymentError'),
        error?.response?.data?.message || error?.message || t('wallet:couldNotInitiatePayment')
      );
      setLoading(false);
    }
  };

  const verifyPayment = async (orderId, paymentId, signature) => {
    try {
      const verifyRes = await axiosInstance.post('/api/wallet/verify-payment', {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      if (verifyRes?.data?.success) {
        Alert.alert(t('wallet:success'), t('wallet:fundsAddedSuccessfully'));
        setAmount('');
        await fetchWalletData();
      } else {
        Alert.alert(t('wallet:paymentFailed'), t('wallet:verificationFailed'));
      }
    } catch (error) {
      console.error('Payment verification failed:', error);
      Alert.alert(t('wallet:verificationError'), error?.response?.data?.message || 'Verification failed');
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
    <LinearGradient
      colors={[PATIENT.gradientFrom, PATIENT.gradientTo, PATIENT.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.balanceCard}
    >
      <View style={styles.cardGlowOne} />
      <View style={styles.cardGlowTwo} />

      <View style={styles.cardHeader}>
        <View style={styles.premiumBadge}>
          <MaterialIcons name="verified" size={13} color="#ffffff" />
          <Text style={styles.premiumBadgeText}>{t('wallet:premiumHealth', 'PREMIUM HEALTH')}</Text>
        </View>
        <MaterialIcons name="wifi" size={20} color="rgba(255,255,255,0.85)" />
      </View>

      <TranslatedMessageBubble text={t('wallet:availableBalance')} style={styles.balanceLabel} />
      <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.cardNumber}>.... .... .... 4242</Text>
      </View>

      <View style={styles.cardButtonsRow}>
        <TouchableOpacity style={styles.primaryMiniAction} onPress={() => setActiveTab('add-money')}>
          <MaterialIcons name="add" size={17} color={PATIENT.primary} />
          <Text style={styles.primaryMiniActionText}>{t('wallet:addFunds')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostMiniAction} onPress={() => setActiveTab('transactions')}>
          <MaterialIcons name="history" size={16} color="#ffffff" />
          <Text style={styles.ghostMiniActionText}>{t('wallet:viewHistory')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderStats = () => (
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>{t('wallet:credits')}</Text>
        <Text style={[styles.statValue, { color: PATIENT.primary }]}>{formatCurrency(stats.creditTotal)}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>{t('wallet:spent')}</Text>
        <Text style={[styles.statValue, { color: '#B91C1C' }]}>{formatCurrency(stats.debitTotal)}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>{t('wallet:completed')}</Text>
        <Text style={[styles.statValue, { color: PATIENT.text }]}>{stats.completed}</Text>
      </View>
    </View>
  );

  const renderSpendingSummary = () => (
    <View style={styles.cardSection}>
      <Text style={styles.sectionTitle}>{t('wallet:spendingSummary')}</Text>
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
                    backgroundColor: index % 2 === 0 ? PATIENT.primary : PATIENT.gradientFrom,
                  },
                ]}
              />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyHint}>{t('wallet:noSpendingRecorded')}</Text>
      )}
      <View style={styles.summaryFooter}>
        <Text style={styles.summaryFooterLabel}>{t('wallet:totalSpentThisMonth')}</Text>
        <Text style={styles.summaryFooterValue}>{formatCurrency(spendingSummary.total)}</Text>
      </View>
    </View>
  );

  const renderAddMoney = () => (
    <View style={styles.cardSection}>
      <Text style={styles.sectionTitle}>{t('wallet:addMoney')}</Text>
      <Text style={styles.sectionSubtitle}>{t('wallet:fastSecureWalletTopup')}</Text>

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
        {QUICK_AMOUNTS.map((qa) => {
          const isActive = String(qa) === String(amount);
          return (
            <TouchableOpacity
              key={qa}
              style={[styles.quickBtn, isActive && styles.quickBtnActive]}
              onPress={() => setAmount(String(qa))}
              activeOpacity={0.85}
            >
              <Text style={[styles.quickBtnText, isActive && styles.quickBtnTextActive]}>₹{qa}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.inputLabel}>{t('wallet:paymentMethod')}</Text>
      <View style={styles.methodGrid}>
        {PAYMENT_METHODS.map((method) => {
          const isActive = paymentMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodItem, isActive && styles.methodItemActive]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <MaterialIcons name={method.icon} size={18} color={isActive ? PATIENT.primary : PATIENT.textSecondary} />
              <Text style={[styles.methodText, isActive && styles.methodTextActive]}>{t(method.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.payBtn, loading && styles.payBtnDisabled]}
        onPress={handlePayment}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.payBtnText}>
            {amount
              ? `${t('wallet:confirmAndAdd', 'Confirm and Add')} ₹${amount}`
              : t('wallet:confirmAndAddFunds')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.cardSection}>
      <View style={styles.transactionsHeader}>
        <Text style={styles.sectionTitle}>{t('wallet:transactionHistory')}</Text>
        <TouchableOpacity onPress={fetchWalletData}>
          <Text style={styles.linkBtn}>{t('wallet:refresh')}</Text>
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
        <Text style={styles.emptyHint}>{t('wallet:noTransactionsFound')}</Text>
      )}
    </View>
  );

  const renderSupport = () => (
    <View style={styles.supportCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.supportLabel}>{t('wallet:needPaymentHelp')}</Text>
        <Text style={styles.supportText}>{t('wallet:supportTeamAvailable')}</Text>
      </View>
      <TouchableOpacity style={styles.supportAction}>
        <Text style={styles.supportActionText}>{t('wallet:support')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (fetching) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F9FF" />
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <WalletSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9FF" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('wallet:walletOverview')}</Text>
          <Text style={styles.headerSubtitle}>{t('wallet:professionalPaymentDashboard')}</Text>
        </View>

        {renderBalanceCard()}
        {renderStats()}
        {renderSpendingSummary()}

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'add-money' && styles.tabBtnActive]}
            onPress={() => setActiveTab('add-money')}
          >
            <TranslatedMessageBubble text={t('wallet:addMoney')} style={[styles.tabBtnText, activeTab === 'add-money' && styles.tabBtnTextActive]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'transactions' && styles.tabBtnActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'transactions' && styles.tabBtnTextActive]}>{t('wallet:transactionHistory')}</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'add-money' ? renderAddMoney() : renderTransactions()}
        {renderSupport()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    backgroundColor: PATIENT.backgroundTint,
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: PATIENT.backgroundTint,
  },
  content: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    marginTop: 0,
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: PATIENT.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 4,
    color: PATIENT.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  balanceCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: PATIENT.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  premiumBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
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
    alignItems: 'center',
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
    color: PATIENT.primary,
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
    backgroundColor: PATIENT.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: PATIENT.border,
  },
  statLabel: {
    color: PATIENT.textMuted,
    fontSize: 10.5,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardSection: {
    backgroundColor: PATIENT.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PATIENT.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PATIENT.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: PATIENT.textSecondary,
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
    backgroundColor: PATIENT.primary,
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
    borderColor: PATIENT.chipBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: PATIENT.backgroundTint,
  },
  currencyPrefix: {
    color: PATIENT.textSecondary,
    fontWeight: '700',
    fontSize: 18,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: PATIENT.text,
    paddingVertical: 13,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PATIENT.chipBorder,
    backgroundColor: PATIENT.surface,
  },
  quickBtnActive: {
    borderColor: PATIENT.primary,
    backgroundColor: '#E6F6EC',
  },
  quickBtnText: {
    color: PATIENT.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  quickBtnTextActive: {
    color: PATIENT.primary,
  },
  inputLabel: {
    color: PATIENT.text,
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
    borderColor: PATIENT.chipBorder,
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: PATIENT.surface,
  },
  methodItemActive: {
    borderColor: PATIENT.primary,
    backgroundColor: '#E6F6EC',
  },
  methodText: {
    fontSize: 11,
    color: PATIENT.textSecondary,
    fontWeight: '700',
    marginTop: 6,
  },
  methodTextActive: {
    color: PATIENT.primary,
  },
  payBtn: {
    backgroundColor: PATIENT.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
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
    color: PATIENT.primary,
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
    borderColor: '#CDEBD8',
    backgroundColor: '#E6F6EC',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  supportLabel: {
    color: PATIENT.primary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '800',
  },
  supportText: {
    marginTop: 2,
    color: PATIENT.text,
    fontSize: 13,
    lineHeight: 18,
  },
  supportAction: {
    backgroundColor: PATIENT.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  supportActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

const walletSkel = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingTop: 12,
  },
  headerTitle: {
    width: 180,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#dbe2ea',
    marginBottom: 10,
  },
  headerSub: {
    width: '70%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e6ebf2',
    marginBottom: 18,
  },
  balanceCard: {
    width: '100%',
    height: 160,
    borderRadius: 24,
    backgroundColor: '#dbe2ea',
    marginBottom: 16,
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    height: 84,
    borderRadius: 16,
    backgroundColor: '#dbe2ea',
  },
  summaryCard: {
    width: '100%',
    height: 130,
    borderRadius: 18,
    backgroundColor: '#dbe2ea',
    marginBottom: 16,
  },
  tabs: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  tabPill: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#dbe2ea',
  },
  bigCard: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    backgroundColor: '#dbe2ea',
    marginBottom: 16,
  },
  supportCard: {
    width: '100%',
    height: 80,
    borderRadius: 16,
    backgroundColor: '#dbe2ea',
    marginBottom: 24,
  },
});

export default WalletDashboard;
