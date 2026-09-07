import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../../../components/TranslatedText';
import axiosInstance, {
  API_BASE_URL,
  TUNNEL_HEADERS,
} from '../../../../../../axiosConfig';
import { PATIENT_GRADIENT } from '../../../../../../theme/palette';
import { PrescriptionPreview } from '../../../counselor-dashboard/Tab/Prescriptions/PrescriptionReviews';
import { getPrescriptionValidity } from '../../../../../../utils/prescriptionValidity';

const normalizeList = payload => {
  const list =
    payload?.prescriptions ||
    payload?.data?.prescriptions ||
    payload?.data ||
    payload?.items ||
    [];
  return Array.isArray(list) ? list : [];
};

const getId = item => item?._id || item?.id || item?.prescriptionId;

const toUrl = path => {
  if (!path) return '';
  if (/^(https?:|file:|content:|data:)/i.test(String(path)))
    return String(path);
  return `${API_BASE_URL}${String(path).startsWith('/') ? '' : '/'}${path}`;
};

const formatDate = value => {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatSize = bytes => {
  const size = Number(bytes);
  if (!size) return 'PDF document';
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getMedicines = item => {
  const medicines = item?.medicines || item?.medicine || item?.drugs || [];
  return Array.isArray(medicines) ? medicines : [];
};

const getAuthHeaders = async () => {
  const token =
    (await AsyncStorage.getItem('accessToken')) ||
    (await AsyncStorage.getItem('token'));
  return {
    ...TUNNEL_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const PrescriptionScreen = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [viewingId, setViewingId] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewPhotoUri, setPreviewPhotoUri] = useState('');

  const fetchPrescriptions = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await axiosInstance.get('/api/prescriptions/my');
      setLoadError('');
      setPrescriptions(normalizeList(response.data));
    } catch (error) {
      if (error?.response?.status === 404) {
        setLoadError('');
        setPrescriptions([]);
        return;
      }
      setLoadError(
        error?.response?.data?.message || 'Unable to load prescriptions.',
      );
      setPrescriptions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions(true);
  }, [fetchPrescriptions]);

  const viewPrescription = async item => {
    const id = getId(item);
    if (!item?.hasPatientPhoto) {
      setActionError(
        'Please upload your photo first to view this prescription.',
      );
      return;
    }
    setActionError('');
    setViewingId(id);
    try {
      let photoUri = toUrl(item?.patient?.photo);
      if (item?.hasPatientPhoto) {
        const headers = await getAuthHeaders();
        const destination = `${RNFS.CachesDirectoryPath}/prescription-patient-${id}.jpg`;
        const result = await RNFS.downloadFile({
          fromUrl: `${API_BASE_URL}/api/prescriptions/${id}/photo?t=${Date.now()}`,
          toFile: destination,
          headers,
        }).promise;
        if (result.statusCode === 200) photoUri = `file://${destination}`;
      }
      setPreviewPhotoUri(photoUri);
      setPreviewItem(item);
    } catch (error) {
      setActionError(error?.message || 'Unable to open prescription.');
    } finally {
      setViewingId(null);
    }
  };

  const uploadPhoto = async item => {
    const id = getId(item);
    if (!id) return;
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.8,
        selectionLimit: 1,
      },
      async response => {
        if (response.didCancel) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) {
          Alert.alert('Photo', 'Unable to read selected photo.');
          return;
        }
        try {
          setUploadingId(id);
          const formData = new FormData();
          formData.append('photo', {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `prescription-photo-${Date.now()}.jpg`,
          });
          await axiosInstance.post(`/api/prescriptions/${id}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          await fetchPrescriptions(false);
          setActionError('');
          Alert.alert(
            'Photo uploaded',
            'Your prescription photo was uploaded.',
          );
        } catch (error) {
          const message =
            error?.response?.data?.error ||
            error?.response?.data?.message ||
            'Please try again.';
          setActionError(message);
          Alert.alert('Photo upload failed', message);
        } finally {
          setUploadingId(null);
        }
      },
    );
  };

  const renderPrescription = item => {
    const id = getId(item);
    const medicines = getMedicines(item);
    const photoUrl = toUrl(
      item?.patientPhotoUrl || item?.photoUrl || item?.patientPhoto,
    );
    const verificationStatus =
      item?.verificationStatus ||
      (item?.hasPatientPhoto ? 'pending' : 'photo_required');
    const isVerified = verificationStatus === 'verified';
    const validity = getPrescriptionValidity(item);
    const doctorName =
      item?.psychiatrist?.fullName ||
      item?.psychiatrist?.name ||
      item?.consultant?.fullName ||
      item?.consultant?.name ||
      item?.doctorName ||
      'Psychiatrist';

    return (
      <View key={id || item.createdAt} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.rxIcon}>
            <Ionicons name="document-text-outline" size={21} color="#006B2C" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              Prescription
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {doctorName} • {formatDate(item?.createdAt || item?.issuedAt)}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              isVerified ? styles.statusVerified : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isVerified
                  ? styles.statusTextVerified
                  : styles.statusTextPending,
              ]}
            >
              {String(verificationStatus).replace('_', ' ')}
            </Text>
          </View>
        </View>

        {!!photoUrl && (
          <Image
            source={{ uri: photoUrl }}
            style={styles.patientPhoto}
            resizeMode="cover"
          />
        )}

        <Text style={styles.problemLabel}>Patient problem</Text>
        <Text style={styles.problemText}>
          {item?.patientProblem ||
            item?.problem ||
            item?.diagnosis ||
            'Not specified'}
        </Text>

        <Text style={styles.fileMeta}>
          {item?.fileName || 'Prescription.pdf'} • {formatSize(item?.fileSize)}
        </Text>
        <View style={styles.validityCard}>
          <Ionicons
            name={validity.isExpired ? 'alert-circle-outline' : 'time-outline'}
            size={18}
            color={validity.isExpired ? '#B91C1C' : '#166534'}
          />
          {/* <View style={styles.validityTextWrap}>
            <Text style={styles.validityLabel}>Prescription validity</Text>
            <Text
              style={[
                styles.validityValue,
                validity.isExpired && styles.validityExpired,
              ]}
            >
              Valid until {validity.validUntilLabel}
            </Text>
          </View> */}
        </View>
        {verificationStatus === 'rejected' && !!item?.rejectionReason && (
          <Text style={styles.rejectionText}>
            Photo rejected: {item.rejectionReason}
          </Text>
        )}

        <View style={styles.medicineList}>
          {medicines.length > 0 ? (
            medicines.map((medicine, index) => (
              <View key={`${id}-medicine-${index}`} style={styles.medicineRow}>
                <Text style={styles.medicineName}>
                  {index + 1}.{' '}
                  {medicine.name || medicine.medicineName || 'Medicine'}
                </Text>
                <Text style={styles.medicineMeta}>
                  {[
                    medicine.dosage,
                    medicine.timeOfDay,
                    medicine.whenToTake,
                    medicine.duration,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyMedicine}>No medicines listed.</Text>
          )}
        </View>

        {!!item?.instructions && (
          <Text style={styles.instructions}>{item.instructions}</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => uploadPhoto(item)}
            disabled={uploadingId === id}
          >
            {uploadingId === id ? (
              <ActivityIndicator size="small" color="#006B2C" />
            ) : (
              <Ionicons name="camera-outline" size={17} color="#006B2C" />
            )}
            <Text style={styles.secondaryBtnText}>
              {photoUrl ? 'Change photo' : 'Upload photo'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => viewPrescription(item)}
            disabled={viewingId === id}
          >
            {viewingId === id ? (
              <ActivityIndicator size="small" color="#006B2C" />
            ) : (
              <Ionicons name="eye-outline" size={17} color="#006B2C" />
            )}
            <Text style={styles.secondaryBtnText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#006B2C" />
        <Text style={styles.centerText}>Loading prescriptions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={PATIENT_GRADIENT}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.header}
      >
        <View style={styles.headerIcon}>
          <Ionicons name="medical-outline" size={24} color="#006B2C" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Prescriptions</Text>
          <Text style={styles.headerSubtitle}>
            {prescriptions.length} prescription
            {prescriptions.length === 1 ? '' : 's'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPrescriptions(false);
            }}
          />
        }
      >
        {!!actionError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />
            <Text style={styles.errorText}>{actionError}</Text>
            <TouchableOpacity onPress={() => setActionError('')}>
              <Ionicons name="close" size={19} color="#B91C1C" />
            </TouchableOpacity>
          </View>
        )}
        {!!loadError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={() => fetchPrescriptions(true)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {prescriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No prescriptions yet</Text>
            <Text style={styles.emptyText}>
              Prescriptions sent by your psychiatrist will appear here.
            </Text>
          </View>
        ) : (
          prescriptions.map(renderPrescription)
        )}
      </ScrollView>
      {!!previewItem && (
        <PrescriptionPreview
          item={previewItem}
          photoUri={previewPhotoUri}
          onClose={() => {
            setPreviewItem(null);
            setPreviewPhotoUri('');
          }}
          showThemePicker={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  centerText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  header: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rxIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAF8EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  cardMeta: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 112,
  },
  statusVerified: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusTextVerified: { color: '#166534' },
  statusTextPending: { color: '#92400E' },
  patientPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    marginTop: 12,
  },
  problemLabel: {
    color: '#006B2C',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 14,
    textTransform: 'uppercase',
  },
  problemText: { color: '#1F2937', fontSize: 14, lineHeight: 20, marginTop: 4 },
  medicineList: { marginTop: 12, gap: 8 },
  medicineRow: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medicineName: { color: '#111827', fontSize: 14, fontWeight: '800' },
  medicineMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyMedicine: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  instructions: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    fontWeight: '600',
  },
  fileMeta: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 9 },
  validityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  validityTextWrap: { flex: 1 },
  validityLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  validityValue: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  validityExpired: { color: '#B91C1C' },
  rejectionText: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    padding: 9,
    borderRadius: 8,
    marginTop: 9,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  secondaryBtn: {
    flex: 1,
    minWidth: 135,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B7E4C7',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  secondaryBtnText: { color: '#006B2C', fontSize: 12.5, fontWeight: '800' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, color: '#991B1B', fontSize: 13, fontWeight: '700' },
  retryText: { color: '#006B2C', fontSize: 13, fontWeight: '900' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
});

export default PrescriptionScreen;
