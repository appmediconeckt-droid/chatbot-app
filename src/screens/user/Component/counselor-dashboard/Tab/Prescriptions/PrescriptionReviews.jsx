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
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../../../components/TranslatedText';
import TextInput from '../../../../../../components/TranslatedTextInput';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import {
  DEFAULT_PRESCRIPTION_THEME_ID,
  getPrescriptionFestivalTheme,
  PRESCRIPTION_FESTIVAL_THEMES,
} from '../../../../../../utils/prescriptionFestivalThemes';
import { getPrescriptionValidity } from '../../../../../../utils/prescriptionValidity';
import toImageUri from '../../../../../../utils/imageUri';

const statusColors = {
  verified: ['#DCFCE7', '#166534'],
  pending: ['#FEF3C7', '#92400E'],
  rejected: ['#FEE2E2', '#B91C1C'],
  photo_required: ['#E2E8F0', '#475569'],
};
const idOf = item => item?.id || item?._id;
const authToken = async () =>
  (await AsyncStorage.getItem('accessToken')) || AsyncStorage.getItem('token');

const cleanText = value => String(value || '').trim();

const joinList = value => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return cleanText(value);
};

const getPractitioner = item => {
  const source = item?.psychiatrist || item?.consultant || item?.doctor || {};
  const name =
    cleanText(source.fullName) ||
    cleanText(source.name) ||
    cleanText(item?.psychiatristName) ||
    cleanText(item?.doctorName) ||
    'Doctor';
  const type =
    joinList(source.specialization) ||
    joinList(source.specializations) ||
    cleanText(source.doctorType) ||
    cleanText(source.profession) ||
    cleanText(source.category) ||
    cleanText(item?.doctorType) ||
    'Psychiatrist';

  return {
    id: source.id || source._id || item?.psychiatristId || item?.doctorId,
    name: /^(dr\.?|doctor)\s/i.test(name) ? name : `Dr. ${name}`,
    type,
  };
};

const formatPractitionerId = id => {
  const value = cleanText(id);
  if (!value) return '';
  return value.length > 8 ? `...${value.slice(-4)}` : value;
};

const getThemeId = item =>
  item?.festivalTheme ||
  item?.prescriptionTheme ||
  item?.theme ||
  item?.selectedTheme ||
  DEFAULT_PRESCRIPTION_THEME_ID;

const getMedicineTimeLabel = medicine => {
  const time = medicine?.timeOfDay || medicine?.time;
  if (Array.isArray(time)) return time.filter(Boolean).join(', ');
  if (time && typeof time === 'object') {
    return Object.entries(time)
      .filter(([, selected]) => selected)
      .map(([slot]) => slot)
      .join(', ');
  }
  return cleanText(time);
};

const getPrescriptionAssetUri = (source, keys) => {
  for (const key of keys) {
    const uri = toImageUri(source?.[key]);
    if (uri) return uri;
  }
  return '';
};

const getPrescriptionSignatureAssets = item => {
  const source = item?.psychiatrist || item?.consultant || item?.doctor || {};
  const signatureUri =
    toImageUri(item?.prescriptionSignature) ||
    toImageUri(item?.prescriptionSignatureUrl) ||
    toImageUri(item?.signatureUrl) ||
    toImageUri(item?.signature) ||
    toImageUri(source.prescriptionSignature) ||
    toImageUri(source.prescriptionSignatureUrl) ||
    toImageUri(source.signature) ||
    toImageUri(source.signatureImage) ||
    toImageUri(source.doctorSignature);
  const sealUri =
    toImageUri(item?.prescriptionSeal) ||
    toImageUri(item?.prescriptionSealUrl) ||
    toImageUri(item?.sealUrl) ||
    toImageUri(item?.seal) ||
    toImageUri(source.prescriptionSeal) ||
    toImageUri(source.prescriptionSealUrl) ||
    toImageUri(source.seal) ||
    toImageUri(source.stamp) ||
    toImageUri(source.clinicSeal);

  return { signatureUri, sealUri };
};

export const PrescriptionPreview = ({
  item,
  photoUri,
  onClose,
  onTheme,
  saving,
  showThemePicker = true,
}) => {
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });
  const theme = getPrescriptionFestivalTheme(getThemeId(item));
  const practitioner = getPractitioner(item);
  const validity = getPrescriptionValidity(item);
  const isIdentityVerified = item?.verificationStatus === 'verified';
  const practitionerId = formatPractitionerId(practitioner.id);
  const { signatureUri, sealUri } = getPrescriptionSignatureAssets(item);
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
              <Text style={s.doctorName}>{practitioner.name}</Text>
              <Text style={s.doctorType}>{practitioner.type}</Text>
              {!!practitionerId && (
                <Text style={s.practitionerId}>ID: {practitionerId}</Text>
              )}
              {!!validity.issuedLabel && (
                <Text style={s.tiny}>Issued: {validity.issuedLabel}</Text>
              )}
            </View>
          </View>
          {/* <Text style={s.digital}>DIGITAL PRESCRIPTION</Text> */}
          {/* <View style={s.validityBox}>
            <View style={s.validityItem}>
              <Text style={s.validityLabel}>Valid until</Text>
              <Text
                style={[
                  s.validityValue,
                  validity.isExpired && s.validityExpired,
                ]}
              >
                {validity.validUntilLabel}
              </Text>
            </View>
            <Text
              style={[
                s.validityPill,
                validity.isExpired ? s.expiredPill : s.activePill,
              ]}
            >
              {validity.isExpired ? 'Expired' : `${validity.validDays} days`}
            </Text>
          </View> */}
          <View
            style={[
              s.identityCard,
              isIdentityVerified ? s.identityVerified : s.identityUnverified,
            ]}
          >
            <View
              style={[
                s.identityIcon,
                isIdentityVerified
                  ? s.identityIconVerified
                  : s.identityIconUnverified,
              ]}
            >
              <Ionicons
                name={isIdentityVerified ? 'checkmark' : 'close'}
                size={18}
                color="#FFFFFF"
              />
            </View>
            <View style={s.identityTextWrap}>
              <Text
                style={[
                  s.identityTitle,
                  isIdentityVerified
                    ? s.identityTitleVerified
                    : s.identityTitleUnverified,
                ]}
              >
                Identity {isIdentityVerified ? 'verified' : 'not verified'}
              </Text>
              <Text style={s.identitySubtitle}>
                {isIdentityVerified
                  ? 'Patient photo confirmed'
                  : 'Patient photo pending verification'}
              </Text>
            </View>
          </View>
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
          <View style={s.signatureBlock}>
            {!!sealUri && (
              <Image
                source={{ uri: sealUri }}
                style={s.sealImage}
                resizeMode="contain"
              />
            )}
            <View style={s.signaturePanel}>
              {!!signatureUri && (
                <Image
                  source={{ uri: signatureUri }}
                  style={s.signatureImage}
                  resizeMode="contain"
                />
              )}
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>Digitally prescribed by</Text>
              <Text style={s.signatureName}>{practitioner.name}</Text>
              <Text style={s.signatureType}>{practitioner.type}</Text>
            </View>
          </View>
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
  const [approving, setApproving] = useState(null);
  const [reason, setReason] = useState('');
  const [savingThemeId, setSavingThemeId] = useState(null);
  const [approvalSignatureFile, setApprovalSignatureFile] = useState(null);
  const [approvalSealFile, setApprovalSealFile] = useState(null);

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

  const pickApprovalAsset = (type) => new Promise((resolve) => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.9,
        selectionLimit: 1,
      },
      (response) => {
        if (response.didCancel) return resolve(null);
        const asset = response.assets?.[0];
        if (!asset?.uri) {
          Alert.alert('Image required', 'Unable to read selected image.');
          return resolve(null);
        }
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File too large', 'Signature or seal image must be less than 5MB.');
          return resolve(null);
        }
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (asset.type && !allowedTypes.includes(String(asset.type).toLowerCase())) {
          Alert.alert('Invalid format', 'Only JPG, PNG, and WEBP images are allowed.');
          return resolve(null);
        }
        const file = {
          uri: asset.uri,
          type: asset.type || 'image/png',
          name: asset.fileName || `prescription-${type}-${Date.now()}.png`,
        };
        if (type === 'signature') setApprovalSignatureFile(file);
        else setApprovalSealFile(file);
        resolve(file);
      },
    );
  });

  const openApprove = (item) => {
    setApprovalSignatureFile(null);
    setApprovalSealFile(null);
    setApproving(item);
  };

  const saveApprovalAssets = async (item, signatureFile = approvalSignatureFile, sealFile = approvalSealFile) => {
    if (!signatureFile && !sealFile) {
      return getPrescriptionSignatureAssets(item);
    }
    const practitioner = getPractitioner(item);
    if (!practitioner.id) throw new Error('Consultant profile not found.');
    const formData = new FormData();
    if (signatureFile) formData.append('prescriptionSignature', signatureFile);
    if (sealFile) formData.append('prescriptionSeal', sealFile);
    const token = await authToken();
    const response = await axios.patch(
      `${API_BASE_URL}/api/auth/update/${encodeURIComponent(practitioner.id)}`,
      formData,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    const updated = response.data?.user;
    return {
      signatureUri:
        getPrescriptionAssetUri(updated, ['prescriptionSignature', 'prescriptionSignatureUrl']) ||
        signatureFile?.uri ||
        getPrescriptionSignatureAssets(item).signatureUri,
      sealUri:
        getPrescriptionAssetUri(updated, ['prescriptionSeal', 'prescriptionSealUrl']) ||
        sealFile?.uri ||
        getPrescriptionSignatureAssets(item).sealUri,
    };
  };

  const confirmApproval = async () => {
    if (!approving) return;
    try {
      let signatureFile = approvalSignatureFile;
      let sealFile = approvalSealFile;
      const existingAssets = getPrescriptionSignatureAssets(approving);
      if (!existingAssets.signatureUri && !signatureFile) {
        signatureFile = await pickApprovalAsset('signature');
        if (!signatureFile) {
          Alert.alert('Signature required', 'Please add consultant signature before approving.');
          return;
        }
      }
      if (!existingAssets.sealUri && !sealFile) {
        sealFile = await pickApprovalAsset('seal');
        if (!sealFile) {
          Alert.alert('Humaeli seal required', 'Please add Humaeli seal before approving.');
          return;
        }
      }
      const assets = await saveApprovalAssets(approving, signatureFile, sealFile);
      await review(approving, 'approve', '', assets);
    } catch (e) {
      Alert.alert(
        'Approval failed',
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Unable to approve prescription.',
      );
    }
  };

  const review = async (item, action, rejectionReason = '', assets = {}) => {
    const id = idOf(item);
    try {
      setWorkingId(id);
      setError('');
      const response = await axios.patch(`/api/prescriptions/${id}/verification`, {
        action,
        reason: rejectionReason,
        prescriptionSignatureUrl: assets.signatureUri,
        signatureUrl: assets.signatureUri,
        prescriptionSealUrl: assets.sealUri,
        sealUrl: assets.sealUri,
      });
      const status = action === 'approve' ? 'verified' : 'rejected';
      const updatedPrescription = response.data?.prescription;
      setItems(current =>
        current.map(entry =>
          idOf(entry) === id
            ? {
                ...entry,
                ...(updatedPrescription || {}),
                verificationStatus: status,
                rejectionReason,
              }
            : entry,
        ),
      );
      setPreview(current =>
        idOf(current) === id
          ? {
              ...current,
              ...(updatedPrescription || {}),
              verificationStatus: status,
              rejectionReason,
            }
          : current,
      );
      setRejecting(null);
      setApproving(null);
      setApprovalSignatureFile(null);
      setApprovalSealFile(null);
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
              const practitioner = getPractitioner(item);
              const validity = getPrescriptionValidity(item);
              return (
                <View key={id} style={s.card}>
                  <View style={s.cardAccent} />
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
                      <Text style={s.cardDoctor} numberOfLines={1}>
                        {practitioner.name} · {practitioner.type}
                      </Text>
                      <Text style={s.problem}>
                        <Text style={s.bold}>Problem: </Text>
                        {item.problem}
                      </Text>
                      {!!item.medicines?.[0] && (
                        <Text style={s.cardMedicine} numberOfLines={1}>
                          {item.medicines[0].name || item.medicines[0].medicine}
                          {getMedicineTimeLabel(item.medicines[0])
                            ? ` · ${getMedicineTimeLabel(item.medicines[0])}`
                            : ''}
                        </Text>
                      )}
                      <Text style={s.tiny}>
                        {new Date(item.issuedAt).toLocaleDateString('en-IN')} ·{' '}
                        {item.medicines?.length || 0} medicine(s)
                      </Text>
                      <Text
                        style={[
                          s.cardValidUntil,
                          validity.isExpired && s.cardValidExpired,
                        ]}
                      >
                        Valid until: {validity.validUntilLabel}
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
                      onPress={() => openApprove(item)}
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
      {!!approving && (() => {
        const assets = getPrescriptionSignatureAssets(approving);
        const signatureUri = approvalSignatureFile?.uri || assets.signatureUri;
        const sealUri = approvalSealFile?.uri || assets.sealUri;
        const isWorking = workingId === idOf(approving);
        return (
          <Modal
            transparent
            visible
            animationType="fade"
            onRequestClose={() => !isWorking && setApproving(null)}
          >
            <View style={s.overlay}>
              <View style={s.dialog}>
                <Text style={s.dialogTitle}>Approve prescription</Text>
                <Text style={s.muted}>
                  Confirm consultant signature and Humaeli seal before approval.
                </Text>
                <View style={s.approvalAssetRow}>
                  {[
                    {
                      key: 'signature',
                      title: 'Signature',
                      icon: 'create-outline',
                      uri: signatureUri,
                    },
                    {
                      key: 'seal',
                      title: 'Humaeli seal',
                      icon: 'ribbon-outline',
                      uri: sealUri,
                    },
                  ].map(asset => (
                    <TouchableOpacity
                      key={asset.key}
                      style={s.approvalAssetTile}
                      onPress={() => pickApprovalAsset(asset.key)}
                      disabled={isWorking}
                      activeOpacity={0.82}
                    >
                      {asset.uri ? (
                        <Image
                          source={{ uri: asset.uri }}
                          style={s.approvalAssetImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={s.approvalAssetEmpty}>
                          <Ionicons name={asset.icon} size={23} color="#2563EB" />
                        </View>
                      )}
                      <Text style={s.approvalAssetTitle}>{asset.title}</Text>
                      <Text style={s.approvalAssetAction}>
                        {asset.uri ? 'Change' : 'Add image'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={s.dialogActions}>
                  <TouchableOpacity
                    onPress={() => setApproving(null)}
                    style={s.cancel}
                    disabled={isWorking}
                  >
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isWorking}
                    onPress={confirmApproval}
                    style={[s.confirmApprove, isWorking && s.disabled]}
                  >
                    {isWorking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.confirmText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#2563EB',
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
  cardDoctor: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  cardMedicine: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cardValidUntil: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  cardValidExpired: { color: '#B91C1C' },
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
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
  doctorType: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  practitionerId: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
    letterSpacing: 0.2,
  },
  muted: { fontSize: 12, color: '#64748B', marginTop: 3 },
  digital: { fontSize: 10, fontWeight: '800', color: '#2563EB', marginTop: 10 },
  validityBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(240,253,244,.94)',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  validityItem: { flex: 1 },
  validityLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  validityValue: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  validityExpired: { color: '#B91C1C' },
  validityPill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '900',
  },
  activePill: { color: '#166534', backgroundColor: '#DCFCE7' },
  expiredPill: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  identityCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  identityVerified: { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' },
  identityUnverified: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  identityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityIconVerified: { backgroundColor: '#16A34A' },
  identityIconUnverified: { backgroundColor: '#DC2626' },
  identityTextWrap: { flexShrink: 1 },
  identityTitle: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  identityTitleVerified: { color: '#166534' },
  identityTitleUnverified: { color: '#B91C1C' },
  identitySubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
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
  signatureBlock: {
    marginTop: 34,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 16,
  },
  sealImage: {
    width: 82,
    height: 82,
    opacity: 0.9,
  },
  signaturePanel: {
    minWidth: 170,
    maxWidth: '68%',
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 54,
    marginBottom: 2,
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#CBD5E1',
    marginTop: 2,
  },
  signatureLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  signatureName: {
    color: '#172033',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  signatureType: {
    color: '#0F766E',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
    textAlign: 'center',
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
  approvalAssetRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  approvalAssetTile: {
    flex: 1,
    minHeight: 122,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  approvalAssetImage: {
    width: '100%',
    height: 54,
    marginBottom: 8,
  },
  approvalAssetEmpty: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  approvalAssetTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  approvalAssetAction: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'center',
  },
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
  confirmApprove: {
    minWidth: 104,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
    backgroundColor: '#16A34A',
  },
  confirmText: { color: '#FFF', fontWeight: '700' },
});
