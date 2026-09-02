import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../TranslatedText';
import axiosInstance, { API_BASE_URL } from '../../axiosConfig';
import { DOCTOR, DOCTOR_GRADIENT, GRADIENT_DIRECTION } from '../../theme/palette';

const PSYCHIATRIST_ENDPOINTS = [
  'https://s5jl7g4z-5001.inc1.devtunnels.ms/api/auth/counsellors',
  '/api/auth/counsellors',
  '/api/chat/counselors',
  '/api/chat/counsellors',
  '/api/counselors',
  '/api/counsellors',
  '/api/consultants',
];

export const isPsychiatristSpecialization = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => /psychiatrist|psychiatry/i.test(String(item || '')));
};

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.counselors)) return payload.counselors;
  if (Array.isArray(payload?.counsellors)) return payload.counsellors;
  if (Array.isArray(payload?.consultants)) return payload.consultants;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
};

const normalizePhoto = (photo) => {
  if (!photo) return null;
  if (typeof photo === 'string') return photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
  const uri = photo.secure_url || photo.url || photo.path;
  if (!uri) return null;
  return uri.startsWith('http') ? uri : `${API_BASE_URL}${uri}`;
};

const getProfilePhoto = (item) =>
  normalizePhoto(
    item?.profilePhoto ||
    item?.profilePicture ||
    item?.profileImage ||
    item?.profilePhotoUrl ||
    item?.photoUrl ||
    item?.image ||
    item?.avatar ||
    item?.photo ||
    item?.user?.profilePhoto ||
    item?.counsellor?.profilePhoto ||
    item?.counselor?.profilePhoto,
  );

const getPsychiatristKey = (item, index) =>
  String(item?._id || item?.id || item?.userId || item?.email || `psychiatrist-${index}`);

const getPsychiatristName = (item) =>
  item?.fullName || item?.name || item?.displayName || item?.username || 'Psychiatrist';

const getSpecializationText = (item) => {
  const specialization = item?.specialization || item?.specializations || item?.category;
  return Array.isArray(specialization)
    ? specialization.filter(Boolean).join(', ')
    : specialization || 'Psychiatry';
};

const getRating = (item) => {
  const rating = Number(item?.rating || item?.averageRating || item?.ratingsAverage || 0);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : null;
};

const getPsychiatrySearchText = (item) => {
  const specializations = Array.isArray(item?.specializations)
    ? item.specializations
    : [item?.specializations];
  return [
    item?.specialization,
    ...specializations,
    item?.roleSpecialization,
    item?.role,
    item?.userType,
    item?.profession,
    item?.title,
  ].filter(Boolean).join(' ');
};

const sortPsychiatrists = (a, b) => {
  const online = Number(Boolean(b?.isOnline || b?.online)) - Number(Boolean(a?.isOnline || a?.online));
  if (online !== 0) return online;
  return Number(b?.rating || b?.averageRating || 0) - Number(a?.rating || a?.averageRating || 0);
};

const PsychiatristDirectory = ({
  title = 'Psychiatrists',
  subtitle = 'Verified psychiatrists available for patient referrals',
  onClose,
  onSelect,
  selectLabel = 'Recommend',
  selectDisabled = false,
  headerVariant = 'hero',
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [psychiatrists, setPsychiatrists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPsychiatrists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let lastError = null;
      for (const endpoint of PSYCHIATRIST_ENDPOINTS) {
        try {
          const response = await axiosInstance.get(endpoint, {
            headers: endpoint.includes('devtunnels.ms')
              ? { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' }
              : undefined,
          });
          const items = asArray(response.data)
            .filter((item) => isPsychiatristSpecialization(getPsychiatrySearchText(item)))
            .sort(sortPsychiatrists);
          setPsychiatrists(items);
          return;
        } catch (requestError) {
          lastError = requestError;
        }
      }
      throw lastError;
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load psychiatrists right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPsychiatrists();
  }, [loadPsychiatrists]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return psychiatrists;
    return psychiatrists.filter((item) => {
      const haystack = `${getPsychiatristName(item)} ${getSpecializationText(item)} ${item?.email || ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [psychiatrists, query]);
  const onlineCount = useMemo(
    () => psychiatrists.filter((item) => Boolean(item?.isOnline || item?.online)).length,
    [psychiatrists],
  );

  const renderItem = ({ item, index }) => {
    const name = getPsychiatristName(item);
    const photo = getProfilePhoto(item);
    const rating = getRating(item);
    const online = Boolean(item?.isOnline || item?.online);

    return (
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={DOCTOR_GRADIENT} {...GRADIENT_DIRECTION} style={styles.avatarRing}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </LinearGradient>
          <View style={[styles.onlineDot, online ? styles.onlineActive : styles.onlineInactive]} />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {online ? <View style={styles.onlineBadgeDot} /> : null}
          </View>
          <Text style={styles.specialization} numberOfLines={1}>{getSpecializationText(item)}</Text>
          <View style={styles.metaRow}>
            {rating ? (
              <View style={styles.metaPill}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.metaText}>{rating}</Text>
              </View>
            ) : null}
            <View style={styles.metaPill}>
              <View style={[styles.statusDot, online ? styles.statusActive : styles.statusInactive]} />
              <Text style={styles.metaText}>{online ? 'Online' : 'Available'}</Text>
            </View>
          </View>
        </View>

        {onSelect ? (
          <TouchableOpacity
            style={[styles.selectBtn, selectDisabled && styles.selectBtnDisabled]}
            activeOpacity={0.85}
            onPress={() => onSelect(item)}
            disabled={selectDisabled}
          >
            {selectDisabled ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.selectText}>{selectLabel}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const compactHeader = headerVariant === 'compact';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={compactHeader ? 'dark-content' : 'light-content'} backgroundColor={compactHeader ? '#FFFFFF' : DOCTOR.primary} translucent={false} />
      {compactHeader ? (
        <View style={[styles.compactTop, { paddingTop: Math.max(insets.top, 10) }]}>
          <View style={styles.compactNav}>
            {onClose ? (
              <TouchableOpacity style={styles.compactCloseBtn} activeOpacity={0.75} onPress={onClose}>
                <Feather name="chevron-left" size={24} color="#0F172A" />
              </TouchableOpacity>
            ) : (
              <View style={styles.compactHeaderSpacer} />
            )}
            <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
            <View style={styles.compactHeaderSpacer} />
          </View>
          <View style={styles.compactIntro}>
            <View style={styles.compactIcon}>
              <Ionicons name="people-outline" size={19} color={DOCTOR.primary} />
            </View>
            <View style={styles.compactIntroText}>
              <Text style={styles.compactIntroTitle} numberOfLines={1}>Verified Specialists</Text>
              <Text style={styles.compactSubtitle} numberOfLines={2}>{subtitle}</Text>
            </View>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={DOCTOR_GRADIENT}
          {...GRADIENT_DIRECTION}
          style={styles.header}
        >
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
          {onClose ? (
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.75} onPress={onClose}>
              <Feather name="x" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      )}

      <View style={[styles.contentTop, compactHeader && styles.compactContentTop]}>
        <View style={styles.searchBox}>
          <Feather name="search" size={17} color="#64748B" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search psychiatrist"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {query ? (
            <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        {!loading && !error ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryValue}>{filtered.length}</Text>
              <Text style={styles.summaryLabel}>{query ? 'matched' : 'psychiatrists'}</Text>
            </View>
            <View style={styles.summaryPill}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryValue}>{onlineCount}</Text>
              <Text style={styles.summaryLabel}>online</Text>
            </View>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={DOCTOR.primary} />
          <Text style={styles.stateText}>Loading psychiatrists...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Feather name="alert-circle" size={26} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={loadPsychiatrists}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={getPsychiatristKey}
          renderItem={renderItem}
          contentContainerStyle={filtered.length ? styles.list : styles.emptyWrap}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Feather name="user-x" size={28} color="#94A3B8" />
              <Text style={styles.stateTitle}>No psychiatrists found</Text>
              <Text style={styles.stateText}>Try a different search or check again later.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  compactTop: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF7',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  compactNav: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  compactHeaderSpacer: {
    width: 40,
    height: 40,
  },
  compactTitle: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    color: '#0F172A',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  compactIntro: {
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  compactIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  compactIntroText: { flex: 1, minWidth: 0 },
  compactIntroTitle: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  compactSubtitle: {
    color: '#64748B',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  contentTop: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  compactContentTop: {
    paddingTop: 14,
  },
  searchBox: {
    height: 54,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, marginLeft: 10, color: '#0F172A', fontSize: 15, paddingVertical: 0 },
  clearSearchBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  summaryPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryValue: { color: DOCTOR.primary, fontSize: 13, fontWeight: '900' },
  summaryLabel: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  summaryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DOCTOR.online },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  card: {
    minHeight: 102,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EEF8',
    padding: 13,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  avatarWrap: { width: 66, height: 66, marginRight: 14 },
  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: { color: DOCTOR.primary, fontSize: 22, fontWeight: '900' },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  onlineActive: { backgroundColor: DOCTOR.online },
  onlineInactive: { backgroundColor: '#CBD5E1' },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  name: { flexShrink: 1, color: '#0F172A', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  onlineBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DOCTOR.online,
    marginLeft: 7,
  },
  specialization: { color: '#64748B', fontSize: 13, marginTop: 2, lineHeight: 18, textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusActive: { backgroundColor: DOCTOR.online },
  statusInactive: { backgroundColor: '#94A3B8' },
  selectBtn: {
    marginLeft: 10,
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DOCTOR.primary,
  },
  selectBtnDisabled: { opacity: 0.65 },
  selectText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyWrap: { flexGrow: 1 },
  stateTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 10 },
  stateText: { color: '#64748B', fontSize: 13, marginTop: 6, textAlign: 'center' },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  retryBtn: {
    marginTop: 14,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  retryText: { color: DOCTOR.primary, fontWeight: '800' },
});

export default PsychiatristDirectory;
