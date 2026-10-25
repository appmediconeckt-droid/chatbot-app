// Reviews — every rating patients left after a completed visit: for the doctor
// ("Doctor" tab) and for their clinics ("Clinic" tab), with the comment, the
// patient and the date. Data: loadDoctorReviews (completed appointments'
// doctorRating / clinicRating).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import {
  getDoctorIdFromUser,
  getStoredDoctorUser,
  loadDoctorReviews,
  summarizeReviews,
} from '../api/doctorAppointments';

const TABS = [
  { key: 'doctor', label: 'My Reviews', icon: 'person-outline' },
  { key: 'clinic', label: 'Clinic Reviews', icon: 'business-outline' },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'comments', label: 'With comments' },
  { key: 5, label: '5 ★' },
  { key: 4, label: '4 ★' },
  { key: 3, label: '3 ★' },
  { key: 'low', label: '1-2 ★' },
];

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const initialsOf = (name) => String(name || 'P').trim().split(/\s+/).slice(0, 2)
  .map((w) => w[0]).join('').toUpperCase() || 'P';

function Stars({ value, size = 14 }) {
  return (
    <View style={s.stars}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n - 0.25;
        const half = !filled && value >= n - 0.75;
        return (
          <Ionicons
            key={n}
            name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
            size={size}
            color={filled || half ? '#F59E0B' : '#D0D5DD'}
          />
        );
      })}
    </View>
  );
}

function PatientAvatar({ review }) {
  const [failed, setFailed] = useState(false);
  if (review.patientPhoto && !failed) {
    return <Image source={{ uri: review.patientPhoto }} style={s.avatar} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[s.avatar, s.avatarInitials]}>
      <Text translate={false} style={s.avatarText}>{initialsOf(review.patientName)}</Text>
    </View>
  );
}

function ReviewCard({ review }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <PatientAvatar review={review} />
        <View style={s.flex}>
          <Text translate={false} style={s.patientName} numberOfLines={1}>{review.patientName}</Text>
          <View style={s.cardMeta}>
            <Stars value={review.stars} size={13} />
            <Text translate={false} style={s.cardDate}>{formatDate(review.submittedAt || review.visitDate)}</Text>
          </View>
        </View>
        <View style={s.scorePill}>
          <Text translate={false} style={s.scorePillText}>{review.stars.toFixed(1)}</Text>
        </View>
      </View>
      {review.review ? (
        <View style={s.quoteBox}>
          <Ionicons name="chatbox-ellipses-outline" size={15} color="#0D9488" style={s.quoteIcon} />
          <Text translate={false} style={s.reviewText}>{review.review}</Text>
        </View>
      ) : (
        <Text style={s.noComment}>Rated without a comment</Text>
      )}
      {review.kind === 'clinic' && !!review.clinicName && (
        <View style={s.clinicTag}>
          <Ionicons name="business-outline" size={12} color="#475467" />
          <Text translate={false} style={s.clinicTagText} numberOfLines={1}>{review.clinicName}</Text>
        </View>
      )}
    </View>
  );
}

function Summary({ summary }) {
  return (
    <View style={s.summary}>
      <View style={s.summaryLeft}>
        <Text translate={false} style={s.summaryValue}>{summary.average.toFixed(1)}</Text>
        <Stars value={summary.average} size={16} />
        <Text translate={false} style={s.summaryCount}>
          {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
        </Text>
      </View>
      <View style={s.bars}>
        {[5, 4, 3, 2, 1].map((n) => {
          const count = summary.distribution[n] || 0;
          const pct = summary.count ? (count / summary.count) * 100 : 0;
          return (
            <View key={n} style={s.barRow}>
              <Text translate={false} style={s.barLabel}>{n}</Text>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <View style={s.barTrack}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
              <Text translate={false} style={s.barCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function DoctorReviewsScreen({ onBack }) {
  const [doctorId, setDoctorId] = useState('');
  const [reviews, setReviews] = useState({ doctor: [], clinic: [] });
  const [tab, setTab] = useState('doctor');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = getDoctorIdFromUser(user);
      if (id) setDoctorId(String(id));
      else {
        setLoading(false);
        setError('Doctor ID not found. Please sign in again.');
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      setError('');
      setReviews(await loadDoctorReviews(doctorId));
    } catch (err) {
      setError(err?.response?.data?.message || 'Reviews could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [doctorId]);

  useEffect(() => { load(); }, [load]);

  const list = reviews[tab];
  const summary = summarizeReviews(list);
  const shown = list.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'comments') return Boolean(r.review);
    if (filter === 'low') return r.stars <= 2;
    return Math.round(r.stars) === filter;
  });

  const header = (
    <>
      <View style={s.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => { setTab(t.key); setFilter('all'); }}
              style={[s.tab, active && s.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={t.icon} size={15} color={active ? '#FFFFFF' : '#475467'} />
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
              <View style={[s.tabCount, active && s.tabCountActive]}>
                <Text translate={false} style={[s.tabCountText, active && s.tabCountTextActive]}>{reviews[t.key].length}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {list.length > 0 && <Summary summary={summary} />}
      {list.length > 0 && (
        <View style={s.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={String(f.key)} onPress={() => setFilter(f.key)} style={[s.filter, active && s.filterActive]}>
                <Text style={[s.filterText, active && s.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
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
          <Text style={s.title}>Reviews</Text>
          <Text style={s.subtitle}>What patients say after their visit</Text>
        </View>
      </View>
      {loading ? (
        <View style={s.loading}><ActivityIndicator color="#0D9488" /><Text style={s.muted}>Loading reviews…</Text></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListHeaderComponent={header}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#0D9488']} />}
          ListEmptyComponent={(
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="star-outline" size={26} color="#F59E0B" /></View>
              <Text style={s.emptyTitle}>{list.length ? 'No reviews match this filter' : 'No reviews yet'}</Text>
              <Text style={s.emptyText}>
                {list.length
                  ? 'Try another filter to see more reviews.'
                  : tab === 'doctor'
                    ? 'Patients can rate you after a completed appointment. Their reviews will appear here.'
                    : 'Patients can rate your clinic after a completed clinic visit. Their reviews will appear here.'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { minHeight: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  subtitle: { fontSize: 12, color: '#667085', marginTop: 2 },
  content: { padding: 14, paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { fontSize: 13, color: '#667085' },
  error: { fontSize: 13, color: '#DC2626', marginBottom: 10 },

  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAECF0', marginBottom: 12 },
  tab: { flex: 1, height: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive: { backgroundColor: '#0D9488' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475467' },
  tabTextActive: { color: '#FFF' },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#475467' },
  tabCountTextActive: { color: '#FFF' },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAECF0', marginBottom: 12, shadowColor: '#101828', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  summaryLeft: { alignItems: 'center', minWidth: 92 },
  summaryValue: { fontSize: 38, fontWeight: '800', color: '#101828' },
  summaryCount: { fontSize: 12, color: '#667085', marginTop: 4 },
  stars: { flexDirection: 'row', gap: 2 },
  bars: { flex: 1, gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barLabel: { width: 10, fontSize: 11.5, fontWeight: '700', color: '#475467', textAlign: 'right' },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#F2F4F7', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: '#F59E0B' },
  barCount: { width: 20, fontSize: 11.5, color: '#667085', textAlign: 'right' },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  filter: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAECF0', alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: '#F0FDFA', borderColor: '#5EC9BC' },
  filterText: { fontSize: 12.5, fontWeight: '700', color: '#475467' },
  filterTextActive: { color: '#0F766E' },

  card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#EAECF0', padding: 14, marginBottom: 10, shadowColor: '#101828', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6FBF8' },
  avatarInitials: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#CCFBF1' },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#0F766E' },
  patientName: { fontSize: 14.5, fontWeight: '800', color: '#101828' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  cardDate: { fontSize: 11.5, color: '#98A2B3' },
  scorePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  scorePillText: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  quoteBox: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  quoteIcon: { marginTop: 1 },
  reviewText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: '#344054' },
  noComment: { marginTop: 10, fontSize: 12.5, fontStyle: 'italic', color: '#98A2B3' },
  clinicTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#F2F4F7' },
  clinicTagText: { fontSize: 11.5, fontWeight: '600', color: '#475467', maxWidth: 220 },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 15.5, fontWeight: '800', color: '#101828' },
  emptyText: { fontSize: 13, lineHeight: 19, color: '#667085', textAlign: 'center', marginTop: 4 },
});
