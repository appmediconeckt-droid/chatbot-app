import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../../../components/TranslatedText';
import TextInput from '../../../../../../components/TranslatedTextInput';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import {
  getPrescriptionFestivalTheme,
  PRESCRIPTION_FESTIVAL_THEMES,
} from '../../../../../../utils/prescriptionFestivalThemes';

const statusColors = {
  verified: ['#DCFCE7', '#166534'],
  pending: ['#FEF3C7', '#92400E'],
  rejected: ['#FEE2E2', '#B91C1C'],
  photo_required: ['#E2E8F0', '#475569'],
};
const idOf = item => item?.id || item?._id;
const authToken = async () =>
  (await AsyncStorage.getItem('accessToken')) || AsyncStorage.getItem('token');

export const PrescriptionPreview = ({
  item,
  photoUri,
  onClose,
  onTheme,
  saving,
  showThemePicker = true,
}) => {
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });
  const theme = getPrescriptionFestivalTheme(item?.festivalTheme);
  const specialization = Array.isArray(item?.psychiatrist?.specialization)
    ? item.psychiatrist.specialization.join(', ')
    : item?.psychiatrist?.specialization;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.modalHeader}>
        <Text style={s.modalTitle}>Prescription preview</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color="#0F172A" />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={s.previewPage}
        contentContainerStyle={s.previewContent}
      >
        {showThemePicker && (
          <>
            <Text style={s.sectionLabel}>Choose prescription theme</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.themeStrip}
            >
              {PRESCRIPTION_FESTIVAL_THEMES.map(option => (
                <TouchableOpacity
                  key={option.id}
                  disabled={saving}
                  onPress={() => option.id !== theme.id && onTheme(option.id)}
                  style={[
                    s.themeOption,
                    option.id === theme.id && s.themeSelected,
                  ]}
                >
                  <Image source={option.image} style={s.themeThumb} />
                  <Text style={s.themeLabel}>{option.label}</Text>
                  {option.id === theme.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#2563EB"
                      style={s.themeCheck}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {saving && <ActivityIndicator color="#2563EB" />}
          </>
        )}
        <View
          style={s.paper}
          onLayout={({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            setPaperSize(current =>
              current.width === width && current.height === height
                ? current
                : { width, height },
            );
          }}
        >
          {paperSize.width > 0 && paperSize.height > 0 && (
            <Image
              source={theme.image}
              style={[
                s.watermark,
                { width: paperSize.width, height: paperSize.height },
              ]}
              resizeMode="stretch"
            />
          )}
          <View style={s.docHeader}>
            <Image
              source={require('../../../../../../image/HumaeliIcon.png')}
              style={s.logo}
            />
            <View style={s.doctor}>
              <Text style={s.doctorName}>
                {item?.psychiatrist?.name || 'Psychiatrist'}
              </Text>
              <Text style={s.muted}>{specialization || 'Psychiatrist'}</Text>
              <Text style={s.tiny}>
                Practitioner ID: {item?.psychiatrist?.id}
              </Text>
              <Text style={s.tiny}>
                {new Date(item?.issuedAt).toLocaleDateString('en-IN')}
              </Text>
            </View>
          </View>
          <Text style={s.digital}>DIGITAL PRESCRIPTION</Text>
          <Text
            style={[
              s.identity,
              item?.verificationStatus === 'verified'
                ? s.verified
                : s.unverified,
            ]}
          >
            Identity:{' '}
            {item?.verificationStatus === 'verified'
              ? 'Verified'
              : 'Not verified'}
          </Text>
          <View style={s.patient}>
            <View style={s.patientAvatar}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.fill} />
              ) : (
                <Ionicons name="person" size={32} color="#2563EB" />
              )}
            </View>
            <View style={s.flex}>
              <Text style={s.tiny}>PATIENT</Text>
              <Text style={s.patientName}>
                {item?.patient?.name || 'Anonymous patient'}
              </Text>
              <Text>
                <Text style={s.bold}>Problem: </Text>
                {item?.problem}
              </Text>
            </View>
          </View>
          <Text style={s.medicineHeading}>Medicines</Text>
          {(item?.medicines || []).map((medicine, index) => (
            <View key={`${medicine.name}-${index}`} style={s.medicineRow}>
              <Text style={s.medNumber}>{index + 1}</Text>
              <View style={s.flex}>
                <Text style={s.bold}>{medicine.name || medicine.medicine}</Text>
                <Text style={s.muted}>
                  {medicine.dosage} · {(medicine.timeOfDay || []).join(', ')}
                </Text>
                <Text style={s.muted}>
                  {medicine.timing}
                  {medicine.duration ? ` · ${medicine.duration}` : ''}
                </Text>
              </View>
            </View>
          ))}
          {!!item?.instructions && (
            <View style={s.instructions}>
              <Text style={s.bold}>Additional instructions</Text>
              <Text style={s.muted}>{item.instructions}</Text>
            </View>
          )}
          <Text style={s.signature}>
            Digitally prescribed by{`\n`}
            {item?.psychiatrist?.name || 'Psychiatrist'}
          </Text>
          <Text style={s.footer}>
            Issued through Humaeli · www.humaeli.com · support@humaeli.com
          </Text>
        </View>
      </ScrollView>
    </Modal>
  );
};

export default function PrescriptionReviews() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState(null);
  const [photos, setPhotos] = useState({});
  const [preview, setPreview] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [savingThemeId, setSavingThemeId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/prescriptions/review');
      setItems(response.data?.prescriptions || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Unable to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await authToken();
      for (const item of items) {
        const id = idOf(item);
        if (!active || !id || !item.hasPatientPhoto || photos[id]) continue;
        try {
          const path = `${RNFS.CachesDirectoryPath}/rx-patient-${id}.jpg`;
          const result = await RNFS.downloadFile({
            fromUrl: `${API_BASE_URL}/api/prescriptions/${id}/photo?t=${Date.now()}`,
            toFile: path,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).promise;
          if (active && result.statusCode === 200)
            setPhotos(current => ({ ...current, [id]: `file://${path}` }));
        } catch (_) {}
      }
    })();
    return () => {
      active = false;
    };
  }, [items, photos]);

  const review = async (item, action, rejectionReason = '') => {
    const id = idOf(item);
    try {
      setWorkingId(id);
      setError('');
      await axios.patch(`/api/prescriptions/${id}/verification`, {
        action,
        reason: rejectionReason,
      });
      const status = action === 'approve' ? 'verified' : 'rejected';
      setItems(current =>
        current.map(entry =>
          idOf(entry) === id
            ? { ...entry, verificationStatus: status, rejectionReason }
            : entry,
        ),
      );
      setPreview(current =>
        idOf(current) === id
          ? { ...current, verificationStatus: status, rejectionReason }
          : current,
      );
      setRejecting(null);
      setReason('');
    } catch (e) {
      Alert.alert(
        'Review failed',
        e?.response?.data?.error || 'Unable to review patient photo',
      );
    } finally {
      setWorkingId(null);
    }
  };
  const updateTheme = async (item, festivalTheme) => {
    const id = idOf(item);
    try {
      setSavingThemeId(id);
      await axios.patch(`/api/prescriptions/${id}/festival-theme`, {
        festivalTheme,
      });
      setItems(current =>
        current.map(entry =>
          idOf(entry) === id ? { ...entry, festivalTheme } : entry,
        ),
      );
      setPreview(current =>
        idOf(current) === id ? { ...current, festivalTheme } : current,
      );
    } catch (e) {
      Alert.alert(
        'Theme failed',
        e?.response?.data?.error || 'Unable to save prescription theme',
      );
    } finally {
      setSavingThemeId(null);
    }
  };

  return (
    <View style={s.screen}>
      <View
        style={[s.pageHeader, { paddingTop: Math.max(insets.top, 18) + 24 }]}
      >
        <View>
          <Text style={s.title}>Prescriptions</Text>
          <Text style={s.subtitle}>
            Review patient photos before releasing final prescriptions.
          </Text>
        </View>
        <TouchableOpacity style={s.refresh} onPress={load}>
          <Ionicons name="refresh" size={21} color="#2563EB" />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator color="#2563EB" />
          <Text>Loading prescriptions...</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} />
          }
          contentContainerStyle={s.list}
        >
          {items.length === 0 ? (
            <View style={s.empty}>
              <Ionicons
                name="document-text-outline"
                size={46}
                color="#94A3B8"
              />
              <Text style={s.emptyTitle}>No prescriptions issued yet.</Text>
            </View>
          ) : (
            items.map(item => {
              const id = idOf(item);
              const colors =
                statusColors[item.verificationStatus] ||
                statusColors.photo_required;
              return (
                <View key={id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={s.photo}>
                      {photos[id] ? (
                        <Image source={{ uri: photos[id] }} style={s.fill} />
                      ) : item.hasPatientPhoto ? (
                        <ActivityIndicator color="#2563EB" />
                      ) : (
                        <Ionicons name="person" size={34} color="#64748B" />
                      )}
                    </View>
                    <View style={s.flex}>
                      <Text
                        style={[
                          s.status,
                          { backgroundColor: colors[0], color: colors[1] },
                        ]}
                      >
                        {String(
                          item.verificationStatus || 'photo_required',
                        ).replace('_', ' ')}
                      </Text>
                      <Text style={s.cardTitle}>
                        {item.patient?.name || 'Anonymous patient'}
                      </Text>
                      <Text style={s.problem}>
                        <Text style={s.bold}>Problem: </Text>
                        {item.problem}
                      </Text>
                      <Text style={s.tiny}>
                        {new Date(item.issuedAt).toLocaleDateString('en-IN')} ·{' '}
                        {item.medicines?.length || 0} medicine(s)
                      </Text>
                      {!!item.rejectionReason && (
                        <Text style={s.rejectReason}>
                          {item.rejectionReason}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={s.actions}>
                    <TouchableOpacity
                      style={[s.button, s.view]}
                      onPress={() => setPreview(item)}
                    >
                      <Ionicons name="eye" size={18} color="#1D4ED8" />
                      <Text style={s.viewText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={
                        !item.hasPatientPhoto ||
                        workingId === id ||
                        item.verificationStatus === 'verified'
                      }
                      style={[
                        s.button,
                        s.approve,
                        (!item.hasPatientPhoto ||
                          item.verificationStatus === 'verified') &&
                          s.disabled,
                      ]}
                      onPress={() => review(item, 'approve')}
                    >
                      <Ionicons name="checkmark" size={18} color="#166534" />
                      <Text style={s.approveText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={!item.hasPatientPhoto || workingId === id}
                      style={[
                        s.button,
                        s.reject,
                        !item.hasPatientPhoto && s.disabled,
                      ]}
                      onPress={() => setRejecting(item)}
                    >
                      <Ionicons name="close" size={18} color="#B91C1C" />
                      <Text style={s.rejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      {!!preview && (
        <PrescriptionPreview
          item={preview}
          photoUri={photos[idOf(preview)]}
          onClose={() => setPreview(null)}
          onTheme={theme => updateTheme(preview, theme)}
          saving={savingThemeId === idOf(preview)}
        />
      )}
      <Modal
        transparent
        visible={!!rejecting}
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>Reject patient photo</Text>
            <Text style={s.muted}>Please enter the reason for rejection.</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              style={s.reasonInput}
              placeholder="Rejection reason"
            />
            <View style={s.dialogActions}>
              <TouchableOpacity
                onPress={() => {
                  setRejecting(null);
                  setReason('');
                }}
                style={s.cancel}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!reason.trim()}
                onPress={() => review(rejecting, 'reject', reason.trim())}
                style={[s.confirmReject, !reason.trim() && s.disabled]}
              >
                <Text style={s.confirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  pageHeader: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  title: { fontSize: 27, fontWeight: '800', color: '#0F172A', marginTop: 3 },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4, maxWidth: 290 },
  refresh: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    margin: 14,
    padding: 12,
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  list: { padding: 14, paddingBottom: 100, gap: 12 },
  empty: {
    flex: 1,
    minHeight: 350,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: { fontWeight: '700', color: '#475569' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  photo: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  flex: { flex: 1 },
  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 5,
  },
  problem: { fontSize: 13, color: '#334155', marginTop: 3 },
  bold: { fontWeight: '700', color: '#0F172A' },
  tiny: { fontSize: 10, color: '#64748B', marginTop: 4 },
  rejectReason: {
    color: '#B91C1C',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 7, marginTop: 13 },
  button: {
    flex: 1,
    minHeight: 39,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  view: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  approve: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  reject: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  viewText: { color: '#1D4ED8', fontWeight: '700' },
  approveText: { color: '#166534', fontWeight: '700' },
  rejectText: { color: '#B91C1C', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  modalHeader: {
    padding: 18,
    paddingTop: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  previewPage: { backgroundColor: '#E9EEF5' },
  previewContent: { padding: 14, paddingBottom: 40 },
  sectionLabel: { fontWeight: '800', color: '#334155', marginBottom: 9 },
  themeStrip: { marginBottom: 12 },
  themeOption: {
    width: 94,
    padding: 6,
    marginRight: 9,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeSelected: { borderColor: '#2563EB' },
  themeThumb: { width: 78, height: 70, borderRadius: 6 },
  themeLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  themeCheck: {
    position: 'absolute',
    right: 2,
    top: 2,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  paper: {
    marginTop: 10,
    minHeight: 720,
    backgroundColor: '#FFF',
    padding: 22,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.18,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 3,
    borderColor: '#2563EB',
    paddingBottom: 14,
  },
  logo: { width: 65, height: 65, resizeMode: 'contain' },
  doctor: { alignItems: 'flex-end', flex: 1 },
  doctorName: { fontSize: 19, fontWeight: '800', color: '#172033' },
  muted: { fontSize: 12, color: '#64748B', marginTop: 3 },
  digital: { fontSize: 10, fontWeight: '800', color: '#2563EB', marginTop: 10 },
  identity: {
    alignSelf: 'flex-start',
    padding: 6,
    borderRadius: 10,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 8,
  },
  verified: { color: '#166534', backgroundColor: '#DCFCE7' },
  unverified: { color: '#B42318', backgroundColor: '#FEE2E2' },
  patient: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 13,
    backgroundColor: 'rgba(241,245,249,.9)',
    borderRadius: 10,
    marginVertical: 18,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientName: { fontSize: 17, fontWeight: '800', color: '#172033' },
  medicineHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 8,
  },
  medicineRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#DBE4EF',
  },
  medNumber: {
    width: 22,
    height: 22,
    textAlign: 'center',
    paddingTop: 2,
    borderRadius: 11,
    color: '#FFF',
    backgroundColor: '#2563EB',
    fontWeight: '700',
  },
  instructions: {
    marginTop: 18,
    padding: 13,
    borderLeftWidth: 4,
    borderColor: '#2563EB',
    backgroundColor: 'rgba(239,246,255,.94)',
  },
  signature: {
    textAlign: 'right',
    marginTop: 38,
    fontSize: 11,
    color: '#475569',
  },
  footer: {
    fontSize: 8,
    color: '#64748B',
    textAlign: 'center',
    borderTopWidth: 1,
    borderColor: '#DBE4EF',
    paddingTop: 12,
    marginTop: 25,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
  },
  dialogTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  reasonInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 11,
    marginTop: 14,
    textAlignVertical: 'top',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancel: { padding: 12 },
  confirmReject: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
    backgroundColor: '#DC2626',
  },
  confirmText: { color: '#FFF', fontWeight: '700' },
});
