import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDoctorMedicines,
  getDoctorTests,
  splitTimings,
  unpackConsultationNotes,
} from '../../../../../../utils/consultationDetails';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
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
import DoctorPrescriptionView from './DoctorPrescriptionView';

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

// Doctors (role or accountType "doctor") issue prescriptions too, but neither a
// chat prescription nor an appointment's populated counselor carries the
// issuer's role, so it is looked up in the public consultant list by id.
const isDoctorAccount = person =>
  [person?.role, person?.accountType]
    .map(value => String(value || '').toLowerCase())
    .includes('doctor');

const toIssuerMap = payload => {
  // The list endpoint splits people across several arrays (counsellors,
  // professionals, doctors, …); merge them all.
  const list = [
    payload,
    payload?.counsellors,
    payload?.counselors,
    payload?.professionals,
    payload?.doctors,
    payload?.data,
    payload?.users,
  ]
    .filter(Array.isArray)
    .flat();
  return new Map(
    list
      .filter(person => person?._id || person?.id)
      .map(person => [String(person._id || person.id), person]),
  );
};

const chatPrescriptionKind = (item, issuers) => {
  const issuerId = String(
    item?.psychiatrist?.id || item?.psychiatrist?._id || item?.psychiatristId || '',
  );
  return isDoctorAccount(item?.psychiatrist) || isDoctorAccount(issuers?.get(issuerId))
    ? 'doctor'
    : 'psychiatrist';
};

// A chat prescription written by a doctor → the same compact doctor card and
// Rx-pad view as a doctor's appointment prescription (grouped with them).
const chatToDoctorPrescription = item => {
  const id = String(getId(item) || '');
  const issuer = item?.psychiatrist || {};
  const rawName = issuer.fullName || issuer.name || item?.doctorName || 'Doctor';
  const doctorId = String(issuer.id || issuer._id || item?.psychiatristId || '');
  const specialization = Array.isArray(issuer.specialization)
    ? issuer.specialization.filter(Boolean).join(', ')
    : issuer.specialization;
  return {
    kind: 'doctor',
    id: `chat-${id}`,
    doctorKey: doctorId || rawName,
    doctorId,
    clinicId: '',
    rxNumber: id ? `RX-${id.slice(-6).toUpperCase()}` : '',
    doctorName: /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`,
    specialization: specialization || 'Consulting Doctor',
    patientName: item?.patient?.name || item?.patient?.fullName || '',
    consultationMode: 'chat',
    complaint: '',
    date: item?.issuedAt || item?.createdAt,
    diagnosis: item?.problem || item?.patientProblem || item?.diagnosis || '',
    medicines: getMedicines(item).map(m => ({
      name: m.name || m.medicineName || 'Medicine',
      dosage: m.dosage || '',
      timings: [...splitTimings(m.timeOfDay), ...splitTimings(m.timing || m.whenToTake)],
      duration: m.duration || '',
    })),
    advice: item?.instructions || '',
    tests: [],
    additionalNotes: '',
    followUpDate: '',
  };
};

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

// Who wrote the prescription — shown as a badge so the patient can tell a
// psychiatrist's chat prescription from a doctor's consultation prescription.
const SOURCE_BADGES = {
  doctor: {
    label: 'Doctor',
    icon: 'medkit-outline',
    bg: '#E6F6EC',
    text: '#006B2C',
  },
  psychiatrist: {
    label: 'Psychiatrist',
    icon: 'chatbubble-ellipses-outline',
    bg: '#F3E8FF',
    text: '#7E22CE',
  },
};


const isCompletedAppointment = appt =>
  [appt?.status, appt?.appointment_status, appt?.queue_status]
    .map(s => String(s || '').toLowerCase())
    .includes('completed');

// A completed doctor appointment → prescription card data. Null when the
// doctor completed without writing anything (the "Complete" skip).
const toDoctorPrescription = (rawAppt, issuers) => {
  if (!isCompletedAppointment(rawAppt)) return null;
  const appt = unpackConsultationNotes(rawAppt);
  const medicines = getDoctorMedicines(appt);
  const tests = getDoctorTests(appt);
  const followUpRequired =
    appt?.follow_up_required === true ||
    String(appt?.follow_up_required).toLowerCase() === 'true' ||
    Boolean(appt?.follow_up_date);
  const hasContent =
    medicines.length ||
    tests.length ||
    appt?.diagnosis ||
    appt?.advice ||
    (followUpRequired && appt?.follow_up_date);
  if (!hasContent) return null;
  const doctor = appt?.counselor || {};
  const patient = appt?.patient || {};
  const rawName = doctor.fullName || doctor.name || 'Doctor';
  const issuer = {
    ...issuers?.get(String(doctor._id || doctor.id || appt.counselor || '')),
    ...doctor,
  };
  const isPsychiatrist =
    !isDoctorAccount(issuer) &&
    ['counsellor', 'counselor'].includes(String(issuer.role || '').toLowerCase());
  const apiId = String(appt._id || appt.id || '');
  const specialization = Array.isArray(doctor.specialization)
    ? doctor.specialization.filter(Boolean).join(', ')
    : doctor.specialization;
  const doctorId =
    doctor._id || doctor.id || (typeof appt.counselor === 'string' ? appt.counselor : '');
  return {
    kind: isPsychiatrist ? 'psychiatrist' : 'doctor',
    id: `appointment-${apiId}`,
    doctorKey: String(doctorId || rawName),
    doctorId: doctorId ? String(doctorId) : '',
    clinicId: String(appt.clinic_id?._id || appt.clinic_id || ''),
    rxNumber: apiId ? `RX-${apiId.slice(-6).toUpperCase()}` : '',
    doctorName:
      isPsychiatrist || /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`,
    specialization:
      specialization || (isPsychiatrist ? 'Psychiatrist' : 'Consulting Doctor'),
    patientName: patient.fullName || patient.name || '',
    tokenNumber: appt.token_number,
    consultationMode: appt.consultation_mode,
    complaint: appt.symptoms || appt.notes || '',
    date:
      appt.consultation_ended_at || appt.updatedAt || appt.date || appt.createdAt,
    diagnosis: appt.diagnosis,
    medicines,
    advice: appt.advice,
    tests,
    additionalNotes: appt.additional_notes,
    followUpDate: followUpRequired ? appt.follow_up_date : '',
  };
};

// The clinic / hospital each prescription was written at, for the letterhead.
// Appointments only carry clinic_id, so each doctor's clinics are looked up
// once (the same public list the booking screen uses).
const attachClinics = async list => {
  const doctorIds = [
    ...new Set(list.filter(rx => rx.clinicId && rx.doctorId).map(rx => rx.doctorId)),
  ];
  if (!doctorIds.length) return list;
  const results = await Promise.allSettled(
    doctorIds.map(id =>
      axiosInstance.get('/api/clinics', { params: { doctor_id: id }, timeout: 15000 }),
    ),
  );
  const clinicsById = {};
  results.forEach(result => {
    if (result.status !== 'fulfilled') return;
    const data = result.value.data;
    const clinics = Array.isArray(data) ? data : data?.data || data?.clinics || [];
    (Array.isArray(clinics) ? clinics : []).forEach(clinic => {
      const id = String(clinic?._id || clinic?.id || '');
      if (id) {
        clinicsById[id] = {
          name: clinic.clinic_name || clinic.name || '',
          location: clinic.location || clinic.address || '',
          phone: clinic.phone_number || clinic.phone || '',
        };
      }
    });
  });
  return list.map(rx => (clinicsById[rx.clinicId] ? { ...rx, clinic: clinicsById[rx.clinicId] } : rx));
};

const visitTime = rx => {
  const time = new Date(rx.date).getTime();
  return Number.isNaN(time) ? 0 : time;
};

// A doctor's chat prescription has no queue token of its own; take the
// token, clinic and mode from the patient's appointment with that doctor on
// the same day (closest in time).
const linkChatToAppointment = (rx, appointments) => {
  const day = new Date(rx.date).toDateString();
  const rxTime = visitTime(rx);
  const apptTime = appt => new Date(appt?.date || appt?.appointment_date).getTime();
  const match = appointments
    .filter(appt => {
      const doctorId = String(
        appt?.counselor?._id || appt?.counselor?.id || appt?.counselor || '',
      );
      return (
        doctorId === rx.doctorId &&
        new Date(appt?.date || appt?.appointment_date).toDateString() === day
      );
    })
    .sort((a, b) => Math.abs(apptTime(a) - rxTime) - Math.abs(apptTime(b) - rxTime))[0];
  if (!match) return rx;
  return {
    ...rx,
    tokenNumber: match.token_number ?? match.tokenNumber ?? rx.tokenNumber,
    clinicId: String(match.clinic_id?._id || match.clinic_id || rx.clinicId || ''),
    consultationMode: match.consultation_mode || rx.consultationMode,
    complaint: rx.complaint || match.symptoms || '',
  };
};

// One card per doctor: every prescription the same doctor wrote (first visit,
// follow-ups…) is kept together, newest visit first. The group carries the
// latest visit's fields so the card can show it, plus all `visits`.
const groupByDoctor = list => {
  const groups = new Map();
  list.forEach(rx => {
    const key = `${rx.kind}:${rx.doctorKey}`;
    groups.set(key, [...(groups.get(key) || []), rx]);
  });
  return [...groups.entries()].map(([key, visits]) => {
    const sorted = [...visits].sort((a, b) => visitTime(b) - visitTime(a));
    return { ...sorted[0], id: `doctor-${key}`, visits: sorted };
  });
};

const getSortTime = entry => {
  const value =
    entry.kind === 'psychiatrist' && entry.item
      ? entry.item.createdAt || entry.item.issuedAt
      : entry.date;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getDoctorInitials = (name = '') =>
  name
    .replace(/^dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'DR';

const SourceBadge = ({ kind }) => {
  const badge = SOURCE_BADGES[kind] || SOURCE_BADGES.doctor;
  return (
    <View style={[styles.sourceBadge, { backgroundColor: badge.bg }]}>
      <Ionicons name={badge.icon} size={11} color={badge.text} />
      <Text style={[styles.sourceBadgeText, { color: badge.text }]}>
        {badge.label}
      </Text>
    </View>
  );
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
  const [doctorPrescriptions, setDoctorPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [viewingId, setViewingId] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  // Doctor / Psychiatrist switch (null = pick the side that has prescriptions).
  const [sourceTab, setSourceTab] = useState(null);
  const [openDoctorRx, setOpenDoctorRx] = useState(null);

  // The full-screen prescriptions have a green header under the status bar.
  // An Android Modal copies the status-bar icon colour from the screen at
  // the moment it opens, so switch to white icons first, open a frame later,
  // and restore the previous style when it closes.
  const statusBarEntryRef = useRef(null);
  const lightStatusBar = () => {
    if (!statusBarEntryRef.current) {
      statusBarEntryRef.current = StatusBar.pushStackEntry({
        barStyle: 'dark-content', // white status-bar strip above the green header
        animated: true,
      });
    }
  };
  const restoreStatusBar = useCallback(() => {
    if (statusBarEntryRef.current) {
      StatusBar.popStackEntry(statusBarEntryRef.current);
      statusBarEntryRef.current = null;
    }
  }, []);
  useEffect(() => restoreStatusBar, [restoreStatusBar]);
  const STATUS_BAR_SETTLE_MS = 80;
  const openDoctorPrescription = rx => {
    lightStatusBar();
    setTimeout(() => setOpenDoctorRx(rx), STATUS_BAR_SETTLE_MS);
  };
  const closeDoctorPrescription = () => {
    setOpenDoctorRx(null);
    restoreStatusBar();
  };
  const [previewPhotoUri, setPreviewPhotoUri] = useState('');

  const fetchPrescriptions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    // Psychiatrist prescriptions (chat) and doctor prescriptions (written when
    // a consultation is completed) come from different APIs; one failing
    // must not hide the other.
    const [psychiatristResult, appointmentResult, issuersResult] = await Promise.allSettled([
      axiosInstance.get('/api/prescriptions/my'),
      axiosInstance.get('/api/appointments'),
      axiosInstance.get('/api/auth/counsellors'),
    ]);
    const issuerMap =
      issuersResult.status === 'fulfilled'
        ? toIssuerMap(issuersResult.value.data)
        : new Map();
    const chatList =
      psychiatristResult.status === 'fulfilled'
        ? normalizeList(psychiatristResult.value.data)
        : [];
    const isDoctorChat = item => chatPrescriptionKind(item, issuerMap) === 'doctor';
    const doctorChatList = chatList.filter(isDoctorChat).map(item => chatToDoctorPrescription(item, 'doctor'));

    if (psychiatristResult.status === 'fulfilled') {
      setLoadError('');
      setPrescriptions(chatList.filter(item => !isDoctorChat(item)));
    } else {
      const error = psychiatristResult.reason;
      setPrescriptions([]);
      setLoadError(
        error?.response?.status === 404
          ? ''
          : error?.response?.data?.message || 'Unable to load prescriptions.',
      );
    }

    if (appointmentResult.status === 'fulfilled') {
      const data = appointmentResult.value.data;
      const appointments = Array.isArray(data)
        ? data
        : data?.appointments || data?.data || [];
      const doctorList = (Array.isArray(appointments) ? appointments : [])
        .map(appt => toDoctorPrescription(appt, issuerMap))
        .filter(Boolean)
        .concat(
          doctorChatList.map(rx =>
            linkChatToAppointment(rx, Array.isArray(appointments) ? appointments : []),
          ),
        );
      setDoctorPrescriptions(groupByDoctor(doctorList));
      // Fill in the clinic letterhead without holding up the list.
      attachClinics(doctorList)
        .then(withClinics => setDoctorPrescriptions(groupByDoctor(withClinics)))
        .catch(() => {});
    } else {
      console.warn(
        'Doctor prescriptions could not be loaded:',
        appointmentResult.reason?.message,
      );
      setDoctorPrescriptions(groupByDoctor(doctorChatList));
    }

    setLoading(false);
    setRefreshing(false);
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
      // Green header → white status-bar icons (see lightStatusBar).
      lightStatusBar();
      await new Promise(resolve => setTimeout(resolve, STATUS_BAR_SETTLE_MS));
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
        // The backend rejects photos over 3 MB; full-size camera photos are
        // usually bigger, so downscale before upload.
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.7,
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
          // Backend accepts only JPG/PNG/WebP; anything else is re-labelled as
          // JPEG (the picker re-encodes resized photos).
          const type = ['image/jpeg', 'image/png', 'image/webp'].includes(
            String(asset.type).toLowerCase(),
          )
            ? asset.type
            : 'image/jpeg';
          formData.append('photo', {
            uri: asset.uri,
            type,
            name: asset.fileName || `prescription-photo-${Date.now()}.jpg`,
          });
          await axiosInstance.post(`/api/prescriptions/${id}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            // Send the FormData as-is and allow time for the upload.
            transformRequest: data => data,
            timeout: 60000,
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
            (error?.response ? 'Please try again.' : error?.message) ||
            'Please try again.';
          setActionError(message);
          Alert.alert('Photo upload failed', message);
        } finally {
          setUploadingId(null);
        }
      },
    );
  };

  const renderPrescription = (item, kind = 'psychiatrist') => {
    const id = getId(item);
    const medicines = getMedicines(item);
    const photoUrl = toUrl(
      item?.patientPhotoUrl || item?.photoUrl || item?.patientPhoto,
    );
    const verificationStatus =
      item?.verificationStatus ||
      (item?.hasPatientPhoto ? 'pending' : 'photo_required');
    const doctorName =
      item?.psychiatrist?.fullName ||
      item?.psychiatrist?.name ||
      item?.consultant?.fullName ||
      item?.consultant?.name ||
      item?.doctorName ||
      (kind === 'psychiatrist' ? 'Psychiatrist' : 'Doctor');

    return (
      <View
        key={id || item.createdAt}
        style={[
          styles.card,
          kind === 'psychiatrist' ? styles.cardPsychiatrist : styles.cardDoctor,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.rxIcon}>
            <Ionicons name="document-text-outline" size={21} color="#006B2C" />
          </View>
          <View style={styles.cardTitleWrap}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, styles.cardTitleShrink]} numberOfLines={1}>
                Prescription
              </Text>
              <SourceBadge kind={kind} />
            </View>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {doctorName} • {formatDate(item?.createdAt || item?.issuedAt)}
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

  // Doctor prescription — written in the Complete Appointment form when the
  // doctor finishes a consultation. The card is a two-row summary; tapping it
  // opens the full Rx-pad view (DoctorPrescriptionView).
  const renderDoctorPrescription = rx => {
    const badge = SOURCE_BADGES[rx.kind] || SOURCE_BADGES.doctor;
    const medicineCount = `${rx.medicines.length} medicine${rx.medicines.length === 1 ? '' : 's'}`;
    return (
      <TouchableOpacity
        key={rx.id}
        activeOpacity={0.85}
        onPress={() => openDoctorPrescription(rx)}
        style={[
          styles.card,
          styles.cardCompact,
          rx.kind === 'psychiatrist' ? styles.cardPsychiatrist : styles.cardDoctor,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.doctorAvatar, { backgroundColor: badge.bg }]}>
            <Text translate={false} style={[styles.doctorAvatarText, { color: badge.text }]}>
              {getDoctorInitials(rx.doctorName)}
            </Text>
          </View>
          <View style={styles.cardTitleWrap}>
            <Text translate={false} style={[styles.cardTitle, styles.doctorNameText]} numberOfLines={1}>
              {rx.doctorName}
            </Text>
            <Text translate={false} style={styles.cardMeta} numberOfLines={1}>
              {formatDate(rx.date)}
              {rx.diagnosis ? ` • ${rx.diagnosis}` : ''}
            </Text>
          </View>
          <SourceBadge kind={rx.kind} />
        </View>

        {/* Chips wrap onto a second line when the row runs out of room, and
            View never shrinks — they used to run into each other on narrow
            phones once a follow-up date was shown. */}
        <View style={styles.doctorFooter}>
          <View style={styles.footerInfo}>
            {rx.visits?.length > 1 && (
              <View style={styles.visitsChip}>
                <Ionicons name="layers-outline" size={12} color="#FFFFFF" />
                <Text style={styles.visitsChipText}>{rx.visits.length} visits</Text>
              </View>
            )}
            <View style={styles.medCountWrap}>
              <Ionicons name="medical-outline" size={13} color="#64748B" />
              <Text style={styles.medCount}>{medicineCount}</Text>
            </View>
            {!!rx.followUpDate && (
              <View style={styles.followUpChip}>
                <Ionicons name="calendar-outline" size={12} color="#006B2C" />
                <Text style={styles.followUpChipText}>
                  Follow-up · {formatDate(rx.followUpDate)}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.viewLink, { backgroundColor: badge.bg }]}>
            <Text style={[styles.viewLinkText, { color: badge.text }]}>View</Text>
            <Ionicons name="chevron-forward" size={14} color={badge.text} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const allPrescriptions = [
    ...prescriptions.map(item => ({ kind: 'psychiatrist', chat: true, item })),
    ...doctorPrescriptions,
  ].sort((a, b) => getSortTime(b) - getSortTime(a));
  const tabCounts = {
    doctor: allPrescriptions.filter(entry => entry.kind === 'doctor').length,
    psychiatrist: allPrescriptions.filter(entry => entry.kind === 'psychiatrist').length,
  };
  const activeSource =
    sourceTab || (tabCounts.doctor || !tabCounts.psychiatrist ? 'doctor' : 'psychiatrist');
  const visiblePrescriptions = allPrescriptions.filter(entry => entry.kind === activeSource);

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
      {/* Compact header card: icon, title + one-line subtitle, total count. */}
      <LinearGradient
        colors={PATIENT_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerDecoLg} />
        <View style={styles.headerDecoSm} />
        <View style={styles.headerIcon}>
          <Ionicons name="document-text" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>My Prescriptions</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Doctor & psychiatrist records
          </Text>
        </View>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountValue}>{allPrescriptions.length}</Text>
          <Text style={styles.headerCountLabel}>
            {allPrescriptions.length === 1 ? 'record' : 'records'}
          </Text>
        </View>
      </LinearGradient>

      {/* Doctor | Psychiatrist segmented switch — colours match the card badges. */}
      <View style={styles.switchWrap}>
        <View style={styles.switchTrack}>
          {['doctor', 'psychiatrist'].map(key => {
            const badge = SOURCE_BADGES[key];
            const active = activeSource === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.85}
                onPress={() => setSourceTab(key)}
                style={[styles.switchItem, active && styles.switchItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={badge.icon} size={16} color={active ? badge.text : '#64748B'} />
                <Text style={[styles.switchText, active && { color: badge.text }]} numberOfLines={1}>
                  {badge.label}
                </Text>
                <View style={[styles.switchCount, { backgroundColor: active ? badge.bg : '#E2E8F0' }]}>
                  <Text style={[styles.switchCountText, active && { color: badge.text }]}>
                    {tabCounts[key]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
        {visiblePrescriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>
              {activeSource === 'doctor'
                ? 'No doctor prescriptions yet'
                : 'No psychiatrist prescriptions yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeSource === 'doctor'
                ? 'Prescriptions from your doctor visits will appear here.'
                : 'Prescriptions from your psychiatrist will appear here.'}
            </Text>
          </View>
        ) : (
          visiblePrescriptions.map(entry =>
            entry.chat
              ? renderPrescription(entry.item, entry.kind)
              : renderDoctorPrescription(entry),
          )
        )}
      </ScrollView>
      {!!previewItem && (
        <PrescriptionPreview
          item={previewItem}
          photoUri={previewPhotoUri}
          onClose={() => {
            setPreviewItem(null);
            setPreviewPhotoUri('');
            restoreStatusBar();
          }}
          showThemePicker={false}
          headerGradient={PATIENT_GRADIENT}
        />
      )}
      {!!openDoctorRx && (
        <DoctorPrescriptionView
          rx={openDoctorRx}
          onClose={closeDoctorPrescription}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  switchWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2 },
  switchTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 11,
    paddingHorizontal: 8,
  },
  switchItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  switchText: { flexShrink: 1, fontSize: 13.5, fontWeight: '800', color: '#64748B' },
  switchCount: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  switchCountText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
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
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    overflow: 'hidden',
    shadowColor: '#006B2C',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerDecoLg: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -30,
    top: -60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerDecoSm: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    left: -18,
    bottom: -30,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.2 },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  headerCount: {
    alignItems: 'center',
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  headerCountValue: { color: '#006B2C', fontSize: 16, fontWeight: '900', lineHeight: 19 },
  headerCountLabel: { color: '#4B7A5C', fontSize: 10, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDoctor: { borderLeftWidth: 4, borderLeftColor: '#01CE54' },
  cardPsychiatrist: { borderLeftWidth: 4, borderLeftColor: '#A855F7' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardCompact: { paddingVertical: 11, paddingHorizontal: 12, marginBottom: 10 },
  doctorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorAvatarText: { fontSize: 13, fontWeight: '900' },
  doctorNameText: { fontSize: 15 },
  doctorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerInfo: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 6 },
  medCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  followUpChipText: { color: '#166534', fontSize: 11.5, fontWeight: '800' },
  medCount: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  visitsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#006B2C',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visitsChipText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  viewLink: {
    flexShrink: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewLinkText: { fontSize: 13, fontWeight: '900' },
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
  cardTitleShrink: { flexShrink: 1 },
  cardMeta: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
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
