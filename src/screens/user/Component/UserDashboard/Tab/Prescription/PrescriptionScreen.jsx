import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  NativeModules,
  Platform,
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
import axiosInstance, { API_BASE_URL, TUNNEL_HEADERS } from '../../../../../../axiosConfig';
import { PATIENT_GRADIENT } from '../../../../../../theme/palette';

const { PdfFileOpener } = NativeModules;

const normalizeList = (payload) => {
  const list =
    payload?.prescriptions ||
    payload?.data?.prescriptions ||
    payload?.data ||
    payload?.items ||
    [];
  return Array.isArray(list) ? list : [];
};

const getId = (item) => item?._id || item?.id || item?.prescriptionId;

const toUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|file:|content:|data:)/i.test(String(path))) return String(path);
  return `${API_BASE_URL}${String(path).startsWith('/') ? '' : '/'}${path}`;
};

const formatDate = (value) => {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const getMedicines = (item) => {
  const medicines = item?.medicines || item?.medicine || item?.drugs || [];
  return Array.isArray(medicines) ? medicines : [];
};

const getMedicineTime = (medicine) => {
  if (Array.isArray(medicine?.timeOfDay)) return medicine.timeOfDay.join(', ');
  return medicine?.timeOfDay || medicine?.time || '';
};

const escapePdfValue = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/\r?\n/g, ' ');

const buildFallbackPdf = (item) => {
  const medicines = getMedicines(item);
  const doctorName =
    item?.psychiatrist?.fullName ||
    item?.psychiatrist?.name ||
    item?.consultant?.fullName ||
    item?.consultant?.name ||
    item?.doctorName ||
    'Psychiatrist';
  const patientName = item?.patient?.name || item?.patientName || 'Patient';
  const problem = item?.patientProblem || item?.problem || item?.diagnosis || 'Not specified';
  const commands = [];
  const rect = (x, y, w, h, color) => commands.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
  const text = (value, x, y, size = 11, color = '0.10 0.14 0.22', font = 'F1') => {
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfValue(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, color = '0.82 0.88 0.95', width = 1) => {
    commands.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  rect(0, 0, 612, 792, '0.98 0.99 1');
  rect(36, 704, 540, 54, '0.10 0.32 0.74');
  text('HUMAELI', 56, 734, 20, '1 1 1', 'F2');
  text('DIGITAL PRESCRIPTION', 56, 716, 10, '0.86 0.93 1', 'F2');
  text(`Date: ${formatDate(item?.createdAt || item?.issuedAt)}`, 430, 733, 10, '1 1 1');
  text(`Practitioner: ${doctorName}`, 430, 716, 10, '1 1 1');

  rect(36, 628, 540, 54, '0.94 0.97 1');
  text('PATIENT', 56, 662, 9, '0.39 0.45 0.55', 'F2');
  text(patientName, 56, 643, 15, '0.08 0.13 0.22', 'F2');
  text(`Problem: ${problem}`, 255, 650, 11);

  text('Medicines', 36, 596, 15, '0.08 0.13 0.22', 'F2');
  rect(36, 566, 540, 24, '0.12 0.29 0.62');
  text('#', 48, 574, 9, '1 1 1', 'F2');
  text('Medicine', 78, 574, 9, '1 1 1', 'F2');
  text('Dosage', 222, 574, 9, '1 1 1', 'F2');
  text('Time', 316, 574, 9, '1 1 1', 'F2');
  text('How to take', 424, 574, 9, '1 1 1', 'F2');

  let y = 540;
  medicines.slice(0, 9).forEach((medicine, index) => {
    if (index % 2 === 0) rect(36, y - 7, 540, 28, '1 1 1');
    else rect(36, y - 7, 540, 28, '0.96 0.98 1');
    text(String(index + 1), 50, y + 3, 9);
    text(medicine.name || medicine.medicineName || medicine.medicine || 'Medicine', 78, y + 3, 9, '0.08 0.13 0.22', 'F2');
    text(medicine.dosage || '', 222, y + 3, 9);
    text(getMedicineTime(medicine), 316, y + 3, 9);
    text(medicine.timing || medicine.whenToTake || '', 424, y + 3, 9);
    if (medicine.duration) text(`Duration: ${medicine.duration}`, 78, y - 10, 8, '0.39 0.45 0.55');
    line(36, y - 9, 576, y - 9);
    y -= 30;
  });

  if (item?.instructions) {
    rect(36, Math.max(118, y - 52), 540, 46, '0.92 0.96 1');
    text('Additional instructions', 52, Math.max(145, y - 24), 10, '0.10 0.32 0.74', 'F2');
    text(item.instructions, 52, Math.max(128, y - 42), 10);
  }

  line(390, 92, 556, 92, '0.58 0.64 0.72');
  text('Digitally prescribed by', 410, 74, 9, '0.39 0.45 0.55');
  text(doctorName, 410, 58, 11, '0.08 0.13 0.22', 'F2');
  line(36, 40, 576, 40);
  text('This prescription was issued through Humaeli - www.humaeli.com - support@humaeli.com', 92, 24, 8, '0.39 0.45 0.55');

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 5 0 R >>',
    '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
};

const openLocalPdf = async (filePath) => {
  if (Platform.OS === 'android' && PdfFileOpener?.open) {
    await PdfFileOpener.open(filePath);
    return;
  }
  await Linking.openURL(filePath.startsWith('file://') ? filePath : `file://${filePath}`);
};

const openBlobInBrowser = (blob) => {
  const pdfBlob = blob?.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(pdfBlob);
  const previewWindow = window.open(objectUrl, '_blank');
  if (!previewWindow) {
    window.URL.revokeObjectURL(objectUrl);
    throw new Error('Please allow pop-ups to view this prescription.');
  }
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 30000);
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
      setLoadError(error?.response?.data?.message || 'Unable to load prescriptions.');
      setPrescriptions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions(true);
  }, [fetchPrescriptions]);

  const openPrescriptionFile = async (item) => {
    const id = getId(item);
    if (!id) return;
    const path = `/api/prescriptions/${id}/file`;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const response = await axiosInstance.get(path, { responseType: 'blob' });
        openBlobInBrowser(response.data);
        return;
      }

      const headers = await getAuthHeaders();
      const filename = item?.fileName || `prescription-${id}.pdf`;
      const destPath = `${RNFS.CachesDirectoryPath}/${filename}`;
      const result = await RNFS.downloadFile({
        fromUrl: `${API_BASE_URL}${path}`,
        toFile: destPath,
        headers,
      }).promise;

      if (result.statusCode < 200 || result.statusCode >= 300) {
        if (result.statusCode === 404 && getMedicines(item).length > 0) {
          await RNFS.writeFile(destPath, buildFallbackPdf(item), 'utf8');
        } else {
          throw new Error(`Prescription file failed (${result.statusCode || 'unknown'})`);
        }
      }

      await openLocalPdf(destPath);
    } catch (error) {
      if (getMedicines(item).length > 0) {
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            openBlobInBrowser(new Blob([buildFallbackPdf(item)], { type: 'application/pdf' }));
            return;
          }
          const filename = item?.fileName || `prescription-${id}.pdf`;
          const destPath = `${RNFS.CachesDirectoryPath}/${filename}`;
          await RNFS.writeFile(destPath, buildFallbackPdf(item), 'utf8');
          await openLocalPdf(destPath);
          return;
        } catch (_) {
          // Surface the original prescription error below.
        }
      }
      Alert.alert(
        'Prescription',
        error?.response?.data?.message || 'Unable to open this prescription.',
      );
    }
  };

  const uploadPhoto = async (item) => {
    const id = getId(item);
    if (!id) return;
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: false, quality: 0.8, selectionLimit: 1 },
      async (response) => {
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
          Alert.alert('Photo uploaded', 'Your prescription photo was uploaded.');
        } catch (error) {
          Alert.alert('Photo upload failed', error?.response?.data?.message || 'Please try again.');
        } finally {
          setUploadingId(null);
        }
      },
    );
  };

  const renderPrescription = (item) => {
    const id = getId(item);
    const medicines = getMedicines(item);
    const photoUrl = toUrl(item?.patientPhotoUrl || item?.photoUrl || item?.patientPhoto);
    const verificationStatus = item?.verificationStatus || (item?.hasPatientPhoto ? 'pending' : 'photo_required');
    const isVerified = verificationStatus === 'verified';
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
            <Text style={styles.cardTitle} numberOfLines={1}>Prescription</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {doctorName} • {formatDate(item?.createdAt || item?.issuedAt)}
            </Text>
          </View>
          <View style={[styles.statusPill, isVerified ? styles.statusVerified : styles.statusPending]}>
            <Text style={[styles.statusText, isVerified ? styles.statusTextVerified : styles.statusTextPending]}>
              {String(verificationStatus).replace('_', ' ')}
            </Text>
          </View>
        </View>

        {!!photoUrl && <Image source={{ uri: photoUrl }} style={styles.patientPhoto} resizeMode="cover" />}

        <Text style={styles.problemLabel}>Patient problem</Text>
        <Text style={styles.problemText}>{item?.patientProblem || item?.problem || item?.diagnosis || 'Not specified'}</Text>

        <View style={styles.medicineList}>
          {medicines.length > 0 ? medicines.map((medicine, index) => (
            <View key={`${id}-medicine-${index}`} style={styles.medicineRow}>
              <Text style={styles.medicineName}>{index + 1}. {medicine.name || medicine.medicineName || 'Medicine'}</Text>
              <Text style={styles.medicineMeta}>
                {[medicine.dosage, medicine.timeOfDay, medicine.whenToTake, medicine.duration].filter(Boolean).join(' • ')}
              </Text>
            </View>
          )) : (
            <Text style={styles.emptyMedicine}>No medicines listed.</Text>
          )}
        </View>

        {!!item?.instructions && (
          <Text style={styles.instructions}>{item.instructions}</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => uploadPhoto(item)} disabled={uploadingId === id}>
            {uploadingId === id ? <ActivityIndicator size="small" color="#006B2C" /> : <Ionicons name="camera-outline" size={17} color="#006B2C" />}
            <Text style={styles.secondaryBtnText}>{photoUrl ? 'Change photo' : 'Upload photo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => openPrescriptionFile(item)}>
            <Ionicons name="eye-outline" size={17} color="#006B2C" />
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
      <LinearGradient colors={PATIENT_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="medical-outline" size={24} color="#006B2C" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Prescriptions</Text>
          <Text style={styles.headerSubtitle}>{prescriptions.length} prescription{prescriptions.length === 1 ? '' : 's'}</Text>
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
            <Text style={styles.emptyText}>Prescriptions sent by your psychiatrist will appear here.</Text>
          </View>
        ) : (
          prescriptions.map(renderPrescription)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  centerText: { marginTop: 10, fontSize: 14, color: '#64748B', fontWeight: '600' },
  header: { margin: 16, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  headerSubtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '700', marginTop: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rxIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF8EF', alignItems: 'center', justifyContent: 'center' },
  cardTitleWrap: { flex: 1 },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  cardMeta: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, maxWidth: 112 },
  statusVerified: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusTextVerified: { color: '#166534' },
  statusTextPending: { color: '#92400E' },
  patientPhoto: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#E2E8F0', marginTop: 12 },
  problemLabel: { color: '#006B2C', fontSize: 12, fontWeight: '900', marginTop: 14, textTransform: 'uppercase' },
  problemText: { color: '#1F2937', fontSize: 14, lineHeight: 20, marginTop: 4 },
  medicineList: { marginTop: 12, gap: 8 },
  medicineRow: { padding: 10, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  medicineName: { color: '#111827', fontSize: 14, fontWeight: '800' },
  medicineMeta: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 4 },
  emptyMedicine: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  instructions: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  secondaryBtn: { flex: 1, minWidth: 135, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#B7E4C7', backgroundColor: '#F0FDF4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  secondaryBtnText: { color: '#006B2C', fontSize: 12.5, fontWeight: '800' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: '#991B1B', fontSize: 13, fontWeight: '700' },
  retryText: { color: '#006B2C', fontSize: 13, fontWeight: '900' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 28 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#64748B', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
});

export default PrescriptionScreen;
