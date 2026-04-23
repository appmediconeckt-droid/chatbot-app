import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const SimpleWallet = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank •••• 4582');
  const [modalAnim] = useState(new Animated.Value(0));

  // Wallet Data
  const walletData = {
    balance: 25450.75,
    totalDeposit: 45800,
    totalPayment: 20349.25,
    currency: '₹',
  };

  // Transactions
  const transactions = [
    {
      id: 1,
      type: 'deposit',
      amount: 5000,
      date: '15 Jan 2024',
      to: 'Wallet',
      status: 'success',
    },
    {
      id: 2,
      type: 'payment',
      amount: 1200,
      date: '14 Jan 2024',
      to: 'Dr. Priya Sharma',
      status: 'success',
    },
    {
      id: 3,
      type: 'payment',
      amount: 1500,
      date: '12 Jan 2024',
      to: 'Dr. Rajesh Kumar',
      status: 'success',
    },
    {
      id: 4,
      type: 'deposit',
      amount: 3000,
      date: '10 Jan 2024',
      to: 'Wallet',
      status: 'success',
    },
    {
      id: 5,
      type: 'payment',
      amount: 1000,
      date: '08 Jan 2024',
      to: 'Dr. Sneha Patel',
      status: 'success',
    },
    {
      id: 6,
      type: 'withdraw',
      amount: 2000,
      date: '05 Jan 2024',
      to: 'Bank Account',
      status: 'pending',
    },
    {
      id: 7,
      type: 'deposit',
      amount: 2500,
      date: '03 Jan 2024',
      to: 'Wallet',
      status: 'success',
    },
  ];

  // Payments to Counselors
  const counselorPayments = [
    {
      name: 'Dr. Priya Sharma',
      amount: 4800,
      sessions: 4,
      lastDate: '14 Jan',
    },
    {
      name: 'Dr. Rajesh Kumar',
      amount: 4500,
      sessions: 3,
      lastDate: '12 Jan',
    },
    {
      name: 'Dr. Sneha Patel',
      amount: 3200,
      sessions: 3,
      lastDate: '08 Jan',
    },
    {
      name: 'Dr. Amit Verma',
      amount: 2800,
      sessions: 2,
      lastDate: '06 Jan',
    },
  ];

  const handleSubmit = (type) => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (type === 'Withdraw' && parseFloat(amount) > walletData.balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    Alert.alert('Success', `${type} of ${walletData.currency}${amount} successful!`);
    setShowDeposit(false);
    setShowWithdraw(false);
    setAmount('');
  };

  const openModal = (modalType) => {
    if (modalType === 'deposit') {
      setShowDeposit(true);
    } else {
      setShowWithdraw(true);
    }
    Animated.spring(modalAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowDeposit(false);
      setShowWithdraw(false);
      setAmount('');
    });
  };

  const filteredTransactions = transactions.filter((t) => {
    if (activeTab === 'deposits') return t.type === 'deposit';
    if (activeTab === 'payments') return t.type === 'payment';
    if (activeTab === 'withdrawals') return t.type === 'withdraw';
    return true;
  });

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return '📥';
      case 'payment':
        return '📤';
      case 'withdraw':
        return '💳';
      default:
        return '💰';
    }
  };

  const getTransactionAmountStyle = (type) => {
    if (type === 'deposit') return styles.amountDeposit;
    return styles.amountDebit;
  };

  const getTransactionBadgeStyle = (status) => {
    if (status === 'success') return styles.badgeSuccess;
    return styles.badgePending;
  };

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionLeft}>
        <View style={[styles.transactionIcon, styles[`icon${item.type}`]]}>
          <Text style={styles.transactionIconText}>{getTransactionIcon(item.type)}</Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle}>{item.to}</Text>
          <Text style={styles.transactionDate}>{item.date}</Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, getTransactionAmountStyle(item.type)]}>
          {item.type === 'deposit' ? '+' : '-'}
          {walletData.currency}
          {item.amount.toLocaleString()}
        </Text>
        <View style={[styles.transactionBadge, getTransactionBadgeStyle(item.status)]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
    </View>
  );

  const renderCounselorPayment = ({ item, index }) => (
    <View style={styles.counselorCard}>
      <View style={styles.counselorAvatar}>
        <Text style={styles.counselorAvatarText}>
          {item.name.split(' ')[1]?.[0] || item.name[0]}
        </Text>
      </View>
      <View style={styles.counselorInfo}>
        <Text style={styles.counselorName}>{item.name}</Text>
        <Text style={styles.counselorMeta}>
          {item.sessions} sessions • Last: {item.lastDate}
        </Text>
      </View>
      <View style={styles.counselorAmount}>
        <Text style={styles.counselorAmountText}>
          {walletData.currency}
          {item.amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const quickAmounts = [500, 1000, 2000, 5000];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a6b" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Wallet</Text>
            <Text style={styles.headerSubtitle}>Manage your money & payments securely</Text>
          </View>
        </View>

        {/* Balance Card */}
        <LinearGradient
          colors={['#1e3a6b', '#2e4b8f', '#5b3e9e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              {walletData.currency}
              {walletData.balance.toLocaleString()}
            </Text>
          </View>
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.walletActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.depositBtn]}
            onPress={() => openModal('deposit')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnIcon}>+</Text>
            <Text style={styles.btnText}>Add Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.withdrawBtn]}
            onPress={() => openModal('withdraw')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnIcon}>↓</Text>
            <Text style={styles.btnText}>Withdraw</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.transferBtn]} activeOpacity={0.8}>
            <Text style={styles.btnIcon}>↗</Text>
            <Text style={styles.btnText}>Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.walletTabs}>
          {['overview', 'deposits', 'payments', 'withdrawals'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions Section */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllBtn}>View All</Text>
            </TouchableOpacity>
          </View>

          {filteredTransactions.length > 0 ? (
            <FlatList
              data={filteredTransactions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTransaction}
              scrollEnabled={false}
              contentContainerStyle={styles.transactionsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions found</Text>
            </View>
          )}
        </View>

        {/* Counselor Payments - shown only on payments tab */}
        {activeTab === 'payments' && (
          <View style={styles.counselorSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payments to Counselors</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.badgeText}>This month</Text>
              </View>
            </View>

            <FlatList
              data={counselorPayments}
              keyExtractor={(item, index) => index.toString()}
              renderItem={renderCounselorPayment}
              scrollEnabled={false}
              contentContainerStyle={styles.counselorList}
            />
          </View>
        )}
      </ScrollView>

      {/* Deposit Modal */}
      <Modal transparent visible={showDeposit} animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <Animated.View
            style={[
              styles.modal,
              {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Enter amount</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="₹500"
                  placeholderTextColor="#7b8faf"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.quickAmounts}>
                {quickAmounts.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.quickAmountBtn}
                    onPress={() => setAmount(amt.toString())}
                  >
                    <Text style={styles.quickAmountText}>
                      {walletData.currency}
                      {amt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.paymentMethods}>
                <Text style={styles.paymentMethodsLabel}>Payment methods</Text>
                <View style={styles.methodIcons}>
                  <Text style={styles.methodIcon}>💳</Text>
                  <Text style={styles.methodIcon}>🏦</Text>
                  <Text style={styles.methodIcon}>📱</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => handleSubmit('Deposit')}
                >
                  <Text style={styles.confirmBtnText}>Add Money</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Withdraw Modal */}
      <Modal transparent visible={showWithdraw} animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <Animated.View
            style={[
              styles.modal,
              {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Withdraw to Bank</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount to withdraw</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter amount"
                  placeholderTextColor="#7b8faf"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Select bank account</Text>
                <View style={styles.bankSelectContainer}>
                  <Text style={styles.bankSelectText}>{selectedBank}</Text>
                  <Text style={styles.bankSelectArrow}>▼</Text>
                </View>
              </View>

              <View style={styles.balanceInfo}>
                <Text style={styles.balanceInfoLabel}>Available balance:</Text>
                <Text style={styles.balanceInfoValue}>
                  {walletData.currency}
                  {walletData.balance.toLocaleString()}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.withdrawConfirmBtn]}
                  onPress={() => handleSubmit('Withdraw')}
                >
                  <Text style={styles.confirmBtnText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5faff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a2f4f',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#61799e',
  },
  balanceCard: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginBottom: 20,
    shadowColor: '#1e3a6b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  balanceTop: {
    marginBottom: 0,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  depositBtn: {
    backgroundColor: '#0f973d',
  },
  withdrawBtn: {
    backgroundColor: '#e68a2e',
  },
  transferBtn: {
    backgroundColor: '#4f46e5',
  },
  btnIcon: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  walletTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 70,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 60,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#1e3f76',
    shadowColor: '#1e3f76',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4d6587',
  },
  activeTabText: {
    color: '#ffffff',
  },
  transactionsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e2f47',
  },
  viewAllBtn: {
    fontSize: 13,
    color: '#4f6f9f',
    fontWeight: '500',
  },
  transactionsList: {
    gap: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#f9fcff',
    borderWidth: 1,
    borderColor: '#eef4fe',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  icondeposit: {
    // placeholder for dynamic style
  },
  iconpayment: {},
  iconwithdraw: {},
  transactionIconText: {
    fontSize: 20,
  },
  transactionInfo: {
    flexDirection: 'column',
  },
  transactionTitle: {
    fontWeight: '600',
    color: '#1a2b44',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 11,
    color: '#7b8faf',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transactionAmount: {
    fontWeight: '700',
    fontSize: 15,
  },
  amountDeposit: {
    color: '#0f973d',
  },
  amountDebit: {
    color: '#dc2626',
  },
  transactionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 30,
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  badgePending: {
    backgroundColor: '#fef9c3',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#0b6e41',
  },
  counselorSection: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionBadge: {
    backgroundColor: '#e1ecfe',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 40,
  },
  counselorList: {
    gap: 12,
  },
  counselorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#f9fcff',
    borderWidth: 1,
    borderColor: '#e2edff',
  },
  counselorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b5e9b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counselorAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  counselorInfo: {
    flex: 1,
  },
  counselorName: {
    fontWeight: '600',
    color: '#1b2d4a',
    marginBottom: 4,
  },
  counselorMeta: {
    fontSize: 11,
    color: '#6c85ad',
  },
  counselorAmount: {
    backgroundColor: '#e2edff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 40,
  },
  counselorAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e4b8f',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8ba0c0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 40, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 40,
    padding: 24,
    width: screenWidth - 32,
    maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1b2f4e',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: '#61799e',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4d6587',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 2,
    borderColor: '#e2edff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: '#f9fcff',
    color: '#1b2f4e',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  quickAmountBtn: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#e2edff',
    borderRadius: 60,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3f76',
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#e2edff',
    marginBottom: 28,
  },
  paymentMethodsLabel: {
    fontWeight: '500',
    color: '#4d6587',
  },
  methodIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  methodIcon: {
    fontSize: 22,
  },
  balanceInfo: {
    backgroundColor: '#f0f7ff',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  balanceInfoLabel: {
    fontSize: 14,
    color: '#1e3f76',
    fontWeight: '500',
  },
  balanceInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3f76',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 60,
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4f6f9f',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 60,
    backgroundColor: '#1e3f76',
    alignItems: 'center',
    shadowColor: '#1e3f76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  withdrawConfirmBtn: {
    backgroundColor: '#c2410c',
    shadowColor: '#c2410c',
  },
  bankSelectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2edff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#f9fcff',
  },
  bankSelectText: {
    fontSize: 15,
    color: '#1b2f4e',
  },
  bankSelectArrow: {
    fontSize: 12,
    color: '#7b8faf',
  },
};

export default SimpleWallet;
