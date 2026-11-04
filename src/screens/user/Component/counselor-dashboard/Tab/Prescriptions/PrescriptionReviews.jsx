import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Text from '../../../../../../components/TranslatedText';
import TextInput from '../../../../../../components/TranslatedTextInput';
import axios, { API_BASE_URL } from '../../../../../../axiosConfig';
import {
  getPrescriptionFestivalTheme,
  prescriptionThemeIdOf,
  PRESCRIPTION_FESTIVAL_THEMES,
} from '../../../../../../utils/prescriptionFestivalThemes';
import { appointmentToDocument, documentDate } from '../../../../../../utils/consultationPrescriptionDocument';
import ConsultationPrescriptionDocument from '../../../UserDashboard/Tab/Prescription/ConsultationPrescriptionDocument';
import { downloadDocumentPdf, printDocument } from '../../../../../../utils/printPrescription';
import { displayDownloadNotification } from '../../../../../../services/notificationService';
import {
  loadOwnProfileDetails,
  loadPrescriptionPatientDetails,
  mergeProfileIntoPatient,
} from '../../../../../../utils/patientProfileDetails';
import {
  prescriptionSignatureUrlOf,
  saveMySignature,
} from '../../../../../../utils/consultantSignature';
import SignaturePad from '../../../../../../components/SignaturePad';
import { KeyboardSheetOverlay } from '../../../../../../components/common/KeyboardSheet';
import displayLocale from '../../../../../../utils/displayLocale';

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


// The app is edge-to-edge and a Modal is its own native window, so the
// preview gets its own SafeAreaProvider: insets are measured for this window
// and the header / scroll content stay clear of the status and navigation bars.
// `headerGradient` (patient side) paints the header in that gradient.
export const PrescriptionPreview = props => (
  <Modal
    visible
    animationType="slide"
    statusBarTranslucent
    navigationBarTranslucent
    onRequestClose={props.onClose}
  >
    <SafeAreaProvider>
      <PrescriptionPreviewBody {...props} />
    </SafeAreaProvider>
  </Modal>
);

// A consultant's (psychiatrist's) chat prescription as the doctor's
// prescription page — same letterhead, patient table, medicines table and
// sign-off — in the consultant blue, on its festival theme, and never with a
// booking QR. Used by the consultant's preview here and the patient's
// Psychiatrist tab, so both see the page the doctor side shows.
// `profile` (loadPatientProfileDetails) fills age / gender / contact / weight
// the record doesn't carry; `withContact: false` keeps the number off the page.
export const consultantRxToDocument = (item = {}, { photoUri, profile, withContact = true } = {}) => {
  const practitioner = getPractitioner(item);
  const source = item?.psychiatrist || item?.consultant || item?.doctor || {};
  const base = appointmentToDocument(
    { ...item, doctorProfile: source, patient: mergeProfileIntoPatient(item?.patient || {}, profile, { withContact }) },
    practitioner.name,
  );
  const id = idOf(item);
  return {
    ...base,
    variant: 'consultant',
    themeId: prescriptionThemeIdOf(item),
    doctorId: '',
    bookingQr: '',
    doctor: practitioner.name,
    specialization: practitioner.type,
    patient: cleanText(item?.patient?.name || item?.patient?.fullName) || 'Anonymous patient',
    phone: withContact ? base.phone : '',
    date: documentDate(item?.issuedAt || item?.createdAt),
    prescriptionId: id ? `RX-${String(id).slice(-6).toUpperCase()}` : base.prescriptionId,
    issue: cleanText(item?.problem || item?.patientProblem) || '—',
    diagnosis: cleanText(item?.diagnosis) || '—',
    medicines: (Array.isArray(item?.medicines) ? item.medicines : []).map(medicine => ({
      ...medicine,
      name: medicine.name || medicine.medicine || medicine.medicineName,
      timeOfDay: getMedicineTimeLabel(medicine)
        .split(',')
        .map(slot => slot.trim())
        .filter(Boolean)
        .map(slot => slot.charAt(0).toUpperCase() + slot.slice(1))
        .join(', '),
      timing: cleanText(medicine.timing || medicine.whenToTake),
      duration: cleanText(medicine.duration),
    })),
    advice: item?.instructions || '',
    notes: '',
    tests: [],
    followUp: null,
    followUpRequired: false,
    signature: prescriptionSignatureUrlOf(item),
    photoUri: photoUri || '',
    identityVerified: item?.verificationStatus === 'verified',
  };
};

const PrescriptionPreviewBody = ({
  item,
  photoUri,
  onClose,
  onTheme,
  saving,
  showThemePicker = true,
  headerGradient,
  // 'self': the patient viewing their own prescription (their profile, with
  // contact); 'patient': the consultant (the patient's profile, no contact).
  profileSource = 'patient',
}) => {
  const theme = getPrescriptionFestivalTheme(prescriptionThemeIdOf(item));
  const self = profileSource === 'self';
  const [profile, setProfile] = useState({});
  useEffect(() => {
    let active = true;
    (self ? loadOwnProfileDetails() : loadPrescriptionPatientDetails(item))
      .then(details => { if (active) setProfile(details || {}); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self, idOf(item)]);
  const document = consultantRxToDocument(item, { photoUri, profile, withContact: self });
  const insets = useSafeAreaInsets();
  // Print / Download PDF, as on a doctor's prescription: the same page as
  // above (blue, its theme, no QR). Patient side green, consultant side blue.
  const actionColor = headerGradient ? '#006B2C' : '#1D4ED8';
  const actionGradient = headerGradient || ['#1D4ED8', '#3B82F6'];
  const [printing, setPrinting] = useState(false);
  const [makingPdf, setMakingPdf] = useState(false);
  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printDocument(document);
    } catch (error) {
      Alert.alert(
        'Print',
        error?.code === 'PRINT_UNAVAILABLE'
          ? 'Printing will work after the app is updated.'
          : error?.message || 'Could not open the print screen.',
      );
    } finally {
      setPrinting(false);
    }
  };
  const handleDownloadPdf = async () => {
    if (makingPdf) return;
    setMakingPdf(true);
    try {
      const { path, cachePath } = await downloadDocumentPdf(document);
      const fileName = path.split('/').pop();
      if (Platform.OS === 'android') ToastAndroid.show(`Downloaded: ${fileName}`, ToastAndroid.SHORT);
      else Alert.alert('PDF downloaded', fileName);
      // Status-bar "Download complete" notification; tapping it opens the PDF.
      displayDownloadNotification({ fileName, openPath: cachePath }).catch(() => {});
    } catch (error) {
      Alert.alert(
        'Prescription PDF',
        error?.code === 'PRINT_UNAVAILABLE'
          ? 'The PDF will work after the app is updated.'
          : error?.message || 'Could not create the PDF.',
      );
    } finally {
      setMakingPdf(false);
    }
  };
  const headerContent = (
    <>
      <Text style={[s.modalTitle, headerGradient && s.modalTitleLight]}>
        Prescription preview
      </Text>
      <TouchableOpacity onPress={onClose} hitSlop={10}>
        <Ionicons
          name="close"
          size={28}
          color={headerGradient ? '#FFFFFF' : '#0F172A'}
        />
      </TouchableOpacity>
    </>
  );
  return (
    <View style={s.previewRoot}>
      {/* The status-bar area stays white with dark icons; the (green)
          header starts below it so it never sits behind time / battery. */}
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={[s.previewSafeTop, { height: insets.top }]} />
      {headerGradient ? (
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[s.modalHeader, { paddingTop: 12 }]}
        >
          {headerContent}
        </LinearGradient>
      ) : (
        <View style={[s.modalHeader, { paddingTop: 12 }]}>
          {headerContent}
        </View>
      )}
      <ScrollView
        style={s.previewPage}
        contentContainerStyle={[s.previewContent, { paddingBottom: 24 }]}
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
        <ConsultationPrescriptionDocument data={document} bleed={14} />
      </ScrollView>

      {/* Actions — sticky, above the system navigation bar */}
      <View style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}>
        <TouchableOpacity
          onPress={handlePrint}
          disabled={printing}
          activeOpacity={0.85}
          style={[s.actionBtn, s.actionBtnOutline, { borderColor: actionColor }, printing && s.actionBusy]}
          accessibilityLabel="Print prescription"
        >
          {printing ? (
            <ActivityIndicator size="small" color={actionColor} />
          ) : (
            <Ionicons name="print-outline" size={19} color={actionColor} />
          )}
          <Text style={[s.actionTextOutline, { color: actionColor }]}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDownloadPdf}
          disabled={makingPdf}
          activeOpacity={0.85}
          style={[s.actionBtnWrap, makingPdf && s.actionBusy]}
          accessibilityLabel="Download prescription as PDF"
        >
          <LinearGradient colors={actionGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.actionBtn}>
            {makingPdf ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={s.actionText}>{makingPdf ? 'Downloading…' : 'Download PDF'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function PrescriptionReviews({ onClose } = {}) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
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

  // Every approval is signed live: the consultant draws their signature on the
  // pad for this prescription, and it's uploaded only when they approve.
  // No saved image is reused and there's no seal / stamp.
  const [signedFile, setSignedFile] = useState(null); // PNG drawn for this approval
  const [padVisible, setPadVisible] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const openApprove = (item) => {
    setSignedFile(null);
    setApproving(item);
    setPadVisible(true); // go straight to signing
  };

  const handleSignatureDrawn = (file) => {
    setPadVisible(false);
    setSignedFile(file);
  };

  const confirmApproval = async () => {
    if (!approving) return;
    if (!signedFile) {
      setPadVisible(true);
      return;
    }
    try {
      setUploadingSignature(true);
      const signatureUrl = await saveMySignature(signedFile);
      setUploadingSignature(false);
      await review(approving, 'approve', '', signatureUrl);
      setSignedFile(null);
    } catch (e) {
      setUploadingSignature(false);
      Alert.alert(
        'Approval failed',
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Unable to approve prescription.',
      );
    }
  };

  const review = async (item, action, rejectionReason = '', signatureUrl = '') => {
    const id = idOf(item);
    try {
      setWorkingId(id);
      setError('');
      const response = await axios.patch(`/api/prescriptions/${id}/verification`, {
        action,
        reason: rejectionReason,
        ...(signatureUrl
          ? { prescriptionSignatureUrl: signatureUrl, signatureUrl }
          : {}),
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

  // Status filter (counts per status) for the review list.
  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
  ];
  const statusOf = item => item?.verificationStatus || 'photo_required';
  const counts = {
    all: items.length,
    // "Pending" = waiting on the consultant: photo uploaded, not yet reviewed,
    // plus prescriptions still waiting for the patient's photo.
    pending: items.filter(item => ['pending', 'photo_required'].includes(statusOf(item))).length,
    verified: items.filter(item => statusOf(item) === 'verified').length,
    rejected: items.filter(item => statusOf(item) === 'rejected').length,
  };
  const visibleItems = items.filter(item =>
    filter === 'all'
      ? true
      : filter === 'pending'
        ? ['pending', 'photo_required'].includes(statusOf(item))
        : statusOf(item) === filter,
  );

  return (
    <View style={s.screen}>
      {/* Status-bar strip stays white (dark icons); the blue header starts
          below it so the colour never runs behind the phone's icons. */}
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[s.rvSafeTop, { height: insets.top }]} />
      <LinearGradient
        colors={['#1D4ED8', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.rvHeader}
      >
        <View style={s.rvHeaderDeco} />
        {!!onClose && (
          <TouchableOpacity style={s.rvHeaderBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={s.flex}>
          <Text style={s.rvTitle}>Prescriptions</Text>
          <Text style={s.rvSubtitle} numberOfLines={1}>
            Review patient photos before release
          </Text>
        </View>
        <TouchableOpacity style={s.rvHeaderBtn} onPress={load} hitSlop={8}>
          <Ionicons name="refresh" size={19} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.rvFilterScroll}
        contentContainerStyle={s.rvFilters}
      >
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.rvFilter, active && s.rvFilterActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.85}
            >
              <Text style={[s.rvFilterText, active && s.rvFilterTextActive]}>{f.label}</Text>
              <View style={[s.rvFilterCount, active && s.rvFilterCountActive]}>
                <Text style={[s.rvFilterCountText, active && s.rvFilterCountTextActive]}>
                  {counts[f.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
          contentContainerStyle={[s.rvList, { paddingBottom: insets.bottom + 24 }]}
        >
          {visibleItems.length === 0 ? (
            <View style={s.empty}>
              <Ionicons
                name="document-text-outline"
                size={46}
                color="#94A3B8"
              />
              <Text style={s.emptyTitle}>
                {items.length === 0 ? 'No prescriptions issued yet.' : 'Nothing in this list.'}
              </Text>
            </View>
          ) : (
            visibleItems.map(item => {
              const id = idOf(item);
              const colors =
                statusColors[item.verificationStatus] ||
                statusColors.photo_required;
              const practitioner = getPractitioner(item);
              const canReview = Boolean(item.hasPatientPhoto);
              const isVerified = item.verificationStatus === 'verified';
              const isRejected = item.verificationStatus === 'rejected';
              // An approved (or already rejected) prescription can't be rejected
              // again by a stray tap.
              const rejectLocked = !canReview || isVerified || isRejected;
              return (
                <View key={id} style={s.rvCard}>
                  <View style={s.rvCardTop}>
                    <View style={s.rvPhoto}>
                      {photos[id] ? (
                        <Image source={{ uri: photos[id] }} style={s.fill} />
                      ) : item.hasPatientPhoto ? (
                        <ActivityIndicator color="#2563EB" />
                      ) : (
                        <Ionicons name="person" size={24} color="#94A3B8" />
                      )}
                    </View>
                    <View style={s.flex}>
                      <View style={s.rvNameRow}>
                        <Text style={s.rvName} numberOfLines={1}>
                          {item.patient?.name || 'Anonymous patient'}
                        </Text>
                        <View style={[s.rvStatus, { backgroundColor: colors[0] }]}>
                          <Text style={[s.rvStatusText, { color: colors[1] }]}>
                            {String(item.verificationStatus || 'photo_required').replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.rvDoctor} numberOfLines={1}>
                        {practitioner.name} · {new Date(item.issuedAt).toLocaleDateString(displayLocale('en-IN'))}
                      </Text>
                    </View>
                  </View>

                  <View style={s.rvProblem}>
                    <Ionicons name="pulse-outline" size={14} color="#2563EB" />
                    <Text style={s.rvProblemText} numberOfLines={1}>
                      {item.problem || 'No problem noted'}
                    </Text>
                  </View>

                  {!!item.rejectionReason && (
                    <Text style={s.rejectReason}>{item.rejectionReason}</Text>
                  )}

                  <View style={s.rvActions}>
                    <TouchableOpacity
                      style={[s.rvAction, s.rvActionView]}
                      onPress={() => setPreview(item)}
                    >
                      <Ionicons name="eye-outline" size={16} color="#1D4ED8" />
                      <Text style={[s.rvActionText, { color: '#1D4ED8' }]}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={!canReview || workingId === id || isVerified}
                      style={[s.rvAction, s.rvActionApprove, (!canReview || isVerified) && s.disabled]}
                      onPress={() => openApprove(item)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
                      <Text style={[s.rvActionText, { color: '#166534' }]}>
                        {isVerified ? 'Approved' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={rejectLocked || workingId === id}
                      style={[s.rvAction, s.rvActionReject, rejectLocked && s.disabled]}
                      onPress={() => setRejecting(item)}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
                      <Text style={[s.rvActionText, { color: '#B91C1C' }]}>{isRejected ? 'Rejected' : 'Reject'}</Text>
                    </TouchableOpacity>
                  </View>
                  {!canReview && (
                    <Text style={s.rvHint}>Waiting for the patient to upload their photo.</Text>
                  )}
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
        const signerName = getPractitioner(approving).name;
        const isWorking = workingId === idOf(approving);
        const busy = isWorking || uploadingSignature;
        const hasSignature = Boolean(signedFile);
        // One modal at a time: Android can't show the signature pad's Modal
        // inside this dialog's Modal (it stayed hidden while padVisible was
        // already true, so "Tap to sign" did nothing). The dialog hides while
        // the pad is open and comes back with the signature.
        return (
          <>
          <Modal
            transparent
            visible={!padVisible}
            animationType="fade"
            onRequestClose={() => !busy && setApproving(null)}
          >
            <View style={s.overlay}>
              <View style={s.dialog}>
                <Text style={s.dialogTitle}>Approve prescription</Text>
                <Text style={s.muted}>
                  {hasSignature
                    ? 'Check your signature, then approve to sign this prescription.'
                    : 'Sign on the pad to approve this prescription.'}
                </Text>
                <TouchableOpacity
                  style={[s.approvalSignatureBox, !hasSignature && s.approvalSignatureEmpty]}
                  onPress={() => setPadVisible(true)}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  {uploadingSignature ? (
                    <ActivityIndicator color="#2563EB" style={s.signatureLoader} />
                  ) : hasSignature ? (
                    <Image
                      source={{ uri: signedFile.uri }}
                      style={s.signatureImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={s.signaturePrompt}>
                      <Ionicons name="create-outline" size={24} color="#2563EB" />
                      <Text style={s.signaturePromptText}>Tap to sign</Text>
                    </View>
                  )}
                  <View style={s.signatureLine} />
                  <Text style={s.signatureName}>{signerName}</Text>
                  {hasSignature && !uploadingSignature && (
                    <Text style={s.redrawText}>Tap to sign again</Text>
                  )}
                </TouchableOpacity>
                <View style={s.dialogActions}>
                  <TouchableOpacity
                    onPress={() => setApproving(null)}
                    style={s.cancel}
                    disabled={busy}
                  >
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={confirmApproval}
                    style={[s.confirmApprove, busy && s.disabled]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.confirmText}>
                        {hasSignature ? 'Approve' : 'Sign'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <SignaturePad
            visible={padVisible}
            signerName={signerName}
            onCancel={() => setPadVisible(false)}
            onDone={handleSignatureDrawn}
          />
          </>
        );
      })()}
      <Modal
        transparent
        visible={!!rejecting}
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        {/* Lifts the dialog above the keyboard while typing the reason. */}
        <KeyboardSheetOverlay style={s.overlay}>
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
        </KeyboardSheetOverlay>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  previewSafeTop: { backgroundColor: '#FFFFFF' },
  rvSafeTop: { backgroundColor: '#FFFFFF' },
  rvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  rvHeaderDeco: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    right: -40,
    top: -60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  rvHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rvTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  rvSubtitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  rvFilterScroll: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rvFilters: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 16 },
  rvFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  rvFilterActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  rvFilterText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  rvFilterTextActive: { color: '#FFFFFF' },
  rvFilterCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  rvFilterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  rvFilterCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  rvFilterCountTextActive: { color: '#FFFFFF' },
  rvList: { padding: 14, gap: 10 },
  rvCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 11,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rvCardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rvPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rvNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rvName: { flex: 1, fontSize: 15.5, fontWeight: '800', color: '#0F172A' },
  rvStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rvStatusText: { fontSize: 10.5, fontWeight: '800', textTransform: 'capitalize' },
  rvDoctor: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rvProblem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#F1F5FF',
  },
  rvProblemText: { flex: 1, fontSize: 13, color: '#1E293B' },
  rvMedicine: { fontSize: 12.5, color: '#334155', marginTop: 8 },
  rvMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  rvMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rvMetaText: { fontSize: 11.5, color: '#64748B', fontWeight: '600' },
  rvActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rvAction: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
  },
  rvActionView: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  rvActionApprove: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  rvActionReject: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  rvActionText: { fontSize: 13, fontWeight: '800' },
  rvHint: { fontSize: 11.5, color: '#92400E', marginTop: 8, textAlign: 'center' },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  modalTitleLight: { color: '#FFFFFF' },
  previewRoot: { flex: 1, backgroundColor: '#E9EEF5' },
  previewPage: { flex: 1, backgroundColor: '#E9EEF5' },
  previewContent: { padding: 14, paddingBottom: 40 },
  // Print / Download PDF bar (the doctor prescription view's).
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  actionBtnWrap: { flex: 1.4, borderRadius: 14, overflow: 'hidden' },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnOutline: { borderWidth: 1.5, backgroundColor: '#FFFFFF' },
  actionBusy: { opacity: 0.7 },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  actionTextOutline: { fontSize: 15, fontWeight: '900' },
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
  rxHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 52, height: 52, resizeMode: 'contain' },
  rxBrand: { flex: 1 },
  rxBrandName: { fontSize: 20, fontWeight: '900', color: '#0F2A5F', letterSpacing: 0.3 },
  rxBrandSub: { fontSize: 10.5, fontWeight: '700', color: '#64748B', marginTop: 1 },
  rxMeta: { alignItems: 'flex-end' },
  rxNumber: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1D4ED8',
    backgroundColor: 'rgba(219,234,254,.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  rxMetaText: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 4 },
  rxRule: {
    height: 5,
    borderTopWidth: 2.5,
    borderBottomWidth: 1,
    borderColor: '#2563EB',
    marginTop: 12,
    marginBottom: 14,
  },
  sectionTag: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 1,
    marginBottom: 3,
  },
  prescriber: { marginBottom: 12 },
  doctorName: { fontSize: 18, fontWeight: '800', color: '#172033' },
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
  patientCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(241,245,249,.92)',
    borderRadius: 12,
  },
  idChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  idChipVerified: { backgroundColor: '#DCFCE7' },
  idChipPending: { backgroundColor: '#FEF3C7' },
  idChipText: { fontSize: 10.5, fontWeight: '800' },
  idChipTextVerified: { color: '#166534' },
  idChipTextPending: { color: '#B45309' },
  complaint: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: 'rgba(239,246,255,.92)',
  },
  complaintText: { fontSize: 14, fontWeight: '700', color: '#172033', lineHeight: 20 },
  rxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 4 },
  rxSymbol: { fontSize: 30, fontWeight: '900', fontStyle: 'italic', color: '#2563EB', lineHeight: 34 },
  medicineRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  medIndex: { width: 20, fontSize: 14.5, fontWeight: '900', color: '#1E3A8A' },
  medName: { fontSize: 14.5, fontWeight: '900', color: '#0F172A' },
  medGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, rowGap: 6 },
  medCell: { width: '50%', paddingRight: 8 },
  medLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8 },
  medValue: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginTop: 1 },
  instructionsText: { fontSize: 13, color: '#334155', lineHeight: 19 },
  signatureImage: { width: '100%', height: 64, marginBottom: 2 },
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
    fontSize: 16,
    fontWeight: '900',
    color: '#172033',
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
  // Handwritten-style e-signature of the consultant's name.
  autoSignature: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: '#1E3A8A',
    fontSize: 26,
    lineHeight: 40,
    fontFamily: Platform.select({ ios: 'Snell Roundhand', android: 'cursive', default: undefined }),
    fontStyle: 'italic',
    transform: [{ rotate: '-3deg' }],
    marginBottom: 2,
  },
  signedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
  },
  signedText: { color: '#16A34A', fontSize: 9.5, fontWeight: '800' },
  signaturePanel: {
    minWidth: 170,
    maxWidth: '68%',
    alignItems: 'center',
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
  approvalSignatureEmpty: { borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#F8FBFF' },
  signatureLoader: { height: 64 },
  signaturePrompt: { height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  signaturePromptText: { color: '#2563EB', fontSize: 13, fontWeight: '800' },
  redrawText: { color: '#2563EB', fontSize: 11, fontWeight: '800', marginTop: 4 },
  approvalSignatureBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
