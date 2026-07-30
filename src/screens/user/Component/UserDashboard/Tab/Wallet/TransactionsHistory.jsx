import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import axiosInstance from '../../../../../../axiosConfig';
import PATIENT from '../../../../../../theme/palette';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

const FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Added', label: 'Added' },
  { id: 'Sessions', label: 'Sessions' },
  { id: 'Pending', label: 'Pending' },
];

const money = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// profilePhoto can be a plain string OR { url, publicId } — normalize to a string.
const photoOf = (counselor) => {
  const raw = counselor?.profilePhoto;
  if (!raw) return null;
  const uri = typeof raw === 'string' ? raw : raw.url || raw.secure_url;
  return uri ? String(uri) : null;
};

const statusStyle = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return { label: 'COMPLETED', color: '#10b981' };
  if (s === 'pending') return { label: 'PENDING', color: '#f59e0b' };
  if (s === 'failed') return { label: 'FAILED', color: '#ef4444' };
  return { label: s.toUpperCase() || 'UNKNOWN', color: '#94a3b8' };
};

const TransactionsHistory = ({ navigation }) => {
  const { t } = useLanguageRender();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [spendingSummary, setSpendingSummary] = useState({ total: 0, breakdown: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchWallet = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/api/wallet/data');
      setBalance(Number(res?.data?.balance || 0));
      setTransactions(Array.isArray(res?.data?.transactions) ? res.data.transactions : []);
      setSpendingSummary(res?.data?.spendingSummary || { total: 0, breakdown: [] });
    } catch (e) {
      console.error('Wallet fetch failed', e?.response?.status, e?.message);
      setError('Could not load transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  // Chip + search filtering.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      const isCredit = tx.type === 'credit';
      if (activeFilter === 'Added' && !isCredit) return false;
      if (activeFilter === 'Sessions' && isCredit) return false;
      if (activeFilter === 'Pending' && String(tx.status).toLowerCase() !== 'pending') return false;
      if (!q) return true;
      const name = tx.counselorId?.fullName || '';
      return (
        String(tx.description || '').toLowerCase().includes(q) ||
        String(name).toLowerCase().includes(q)
      );
    });
  }, [transactions, activeFilter, searchQuery]);

  // Group into month sections, newest first.
  const sections = useMemo(() => {
    const byMonth = new Map();
    [...filtered]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((tx) => {
        const d = new Date(tx.createdAt);
        const key = Number.isNaN(d.getTime())
          ? 'Unknown'
          : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key).push(tx);
      });
    return Array.from(byMonth.entries()).map(([month, items]) => ({ month, items }));
  }, [filtered]);

  const renderTransaction = (tx) => {
    const isCredit = tx.type === 'credit';
    const counselor = tx.counselorId;
    const photo = photoOf(counselor);
    const title = counselor?.fullName || tx.description || 'Transaction';
    const st = statusStyle(tx.status);

    const d = new Date(tx.createdAt);
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sessionType = tx.metadata?.sessionType;
    const mins = tx.metadata?.billedMinutes;
    const subtitle = isCredit
      ? `${dateLabel} • ${timeLabel} • Top-up`
      : `${dateLabel} • ${sessionType ? `${sessionType} ` : ''}${mins != null ? `${mins} min` : ''}`.trim();

    return (
      <View key={tx._id} style={s.transactionItem}>
        <View style={s.transactionLeft}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.avatarPhoto} />
          ) : (
            <View style={[s.transactionIcon, { backgroundColor: isCredit ? '#E6F6EC' : '#EEF2FF' }]}>
              <MaterialCommunityIcons
                name={isCredit ? 'bank-transfer-in' : sessionType === 'chat' ? 'message-text' : 'heart-pulse'}
                size={22}
                color={isCredit ? PATIENT.primary : '#4F46E5'}
              />
            </View>
          )}
          <View style={s.transactionDetails}>
            <Text style={s.transactionName} numberOfLines={1}>{title}</Text>
            <Text style={s.transactionSubtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>

        <View style={s.transactionRight}>
          <Text style={[s.transactionAmount, isCredit && s.amountGreen]}>
            {isCredit ? '+' : '−'}₹{money(tx.amount)}
          </Text>
          <View style={[s.statusBadge, { backgroundColor: `${st.color}20` }]}>
            <Text style={[s.statusText, { color: st.color }]}>{t(st.label)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('Transactions History')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={PATIENT.primary} /></View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchWallet({ silent: true }); }}
              colors={[PATIENT.primary]}
              tintColor={PATIENT.primary}
            />
          }
        >
          {/* Balance / spend card */}
          <View style={s.totalCard}>
            <LinearGradient
              colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.totalGradient}
            >
              <View style={s.totalContent}>
                <Text style={s.totalLabel}>{t('Available Balance')}</Text>
                <Text style={s.totalAmount}>₹{money(balance)}</Text>
                <View style={s.savingsRow}>
                  <MaterialCommunityIcons name="chart-line" size={16} color="#ffffff" />
                  <Text style={s.savingsText}>₹{money(spendingSummary.total)} spent so far</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={s.searchInput}
              placeholder={t('Search transactions, counselors...')}
              placeholderTextColor="#cbd5e1"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          <View style={s.filterChips}>
            {FILTERS.map((f) => {
              const active = activeFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[s.filterChip, active && s.filterChipActive]}
                  onPress={() => setActiveFilter(f.id)}
                  activeOpacity={0.85}
                >
                  {active && <Ionicons name="checkmark" size={14} color="#ffffff" style={{ marginRight: 4 }} />}
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{t(f.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* List */}
          {error ? (
            <View style={s.empty}>
              <Ionicons name="cloud-offline-outline" size={38} color="#cbd5e1" />
              <Text style={s.emptyText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => fetchWallet()} activeOpacity={0.85}>
                <Text style={s.retryText}>{t('Retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : sections.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={38} color="#cbd5e1" />
              <Text style={s.emptyText}>{t('No transactions found.')}</Text>
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.month}>
                <View style={s.dateHeader}>
                  <MaterialCommunityIcons name="circle" size={6} color={PATIENT.primary} style={{ marginRight: 8 }} />
                  <Text style={s.dateHeaderText}>{section.month}</Text>
                </View>
                {section.items.map(renderTransaction)}
              </View>
            ))
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  totalCard: { marginHorizontal: 16, marginVertical: 16, borderRadius: 16, overflow: 'hidden' },
  totalGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 18, gap: 12 },
  totalContent: { flex: 1 },
  totalLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  totalAmount: { fontSize: 32, fontWeight: '900', color: '#ffffff', marginBottom: 8 },
  savingsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savingsText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 16, paddingHorizontal: 12, height: 44, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: '#0f172a', padding: 0 },

  filterChips: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16, paddingBottom: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: PATIENT.primary, borderColor: PATIENT.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#ffffff' },

  dateHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginVertical: 12, marginTop: 16 },
  dateHeaderText: { fontSize: 12, fontWeight: '800', color: PATIENT.primary, letterSpacing: 0.3 },

  transactionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#ffffff' },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  transactionIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 44, height: 44, borderRadius: 22 },
  transactionDetails: { flex: 1 },
  transactionName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  transactionSubtitle: { fontSize: 11, fontWeight: '500', color: '#94a3b8' },

  transactionRight: { alignItems: 'flex-end', gap: 6 },
  transactionAmount: { fontSize: 14, fontWeight: '800', color: '#ef4444' },
  amountGreen: { color: '#10b981' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, backgroundColor: PATIENT.primary },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});

export default TransactionsHistory;
