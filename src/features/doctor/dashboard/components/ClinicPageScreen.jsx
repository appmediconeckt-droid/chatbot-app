// Clinic profile — port of the web ClinicAllView/ClinicPage.jsx, styled with
// the app's clinician theme. Same data:
//   GET /api/clinics?doctor_id&role               (doctor's clinics; arrows switch between them)
//   GET /api/auth/me?clinic_id&doctor_id          (clinic doctors)
//   GET /api/appointments?clinic_id&doctor_id     (patient count / departments)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Linking, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../components/TranslatedText';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppIcon from '../icons/AppIcon';
import { colors, createDoctorStyles, typography } from '../theme';
import axiosInstance, { API_BASE_URL } from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import { clinicFeeOf, deleteDoctorClinic, unwrapApiArray } from '../api/doctorClinics';
import { useDoctorBack } from '../useDoctorBack';
import DoctorClinicSettingsScreen from './DoctorClinicSettingsScreen';
import DeleteClinicModal from './DeleteClinicModal';
import EditClinicScreen from './EditClinicScreen';
import { useToast } from '../../../../components/common/ToastProvider';
import { formatPhoneNumber } from '../../../../utils/countryCodes';

const DEFAULT_CLINIC_IMAGE = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80';
const TABS = [
  { key: 'Overview', icon: 'grid-outline' },
  { key: 'Doctors', icon: 'people-outline' },
  { key: 'Departments', icon: 'layers-outline' },
  { key: 'Facilities', icon: 'medkit-outline' },
  { key: 'Reviews', icon: 'star-outline' },
  { key: 'Contact', icon: 'call-outline' },
];

// Icon chip colours for the stat cards and panel headers.
const TONES = {
  teal: { bg: '#E6FBF8', fg: '#0D9488' },
  indigo: { bg: '#EEF2FF', fg: '#4F46E5' },
  blue: { bg: '#EFF6FF', fg: '#2563EB' },
  amber: { bg: '#FEF3C7', fg: '#D97706' },
  rose: { bg: '#FFE4E6', fg: '#E11D48' },
  slate: { bg: '#F1F5F9', fg: '#475569' },
};

const FALLBACK = {
  id: 'fallback-clinic',
  name: '',
  subtitle: '',
  address: '',
  fullAddress: '',
  phone: '',
  email: '',
  website: '',
  image: DEFAULT_CLINIC_IMAGE,
  mapUrl: '',
  about: '',
  mission: '',
  specialties: [],
  stats: { beds: 0, emergency: '—', rating: 0, ratingCount: 0 },
  raw: {},
};

const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '');

const getAssetUrl = (value) => {
  if (!value) return '';
  const path = String(value).trim().replace(/\\/g, '/');
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  if (/^(\/9j\/|iVBORw0KGgo|R0lGOD|UklGR)/.test(path)) return `data:image/jpeg;base64,${path}`;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const bufferToDataUrl = (bufferValue) => {
  const bytes = Array.isArray(bufferValue?.data) ? bufferValue.data : bufferValue;
  if (!Array.isArray(bytes) || typeof global.btoa !== 'function') return '';
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:image/jpeg;base64,${global.btoa(binary)}`;
};

const parsePhotoValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parsePhotoValue);
  if (typeof value === 'object') {
    if (value.type === 'Buffer' || Array.isArray(value.data)) return [bufferToDataUrl(value)].filter(Boolean);
    const direct = [value.url, value.secure_url, value.src, value.uri, value.path, value.file, value.filename,
      value.image, value.clinic_photo, value.clinic_image].filter(Boolean);
    const nested = value.data && !Array.isArray(value.data) ? parsePhotoValue(value.data) : [];
    return [...direct, ...nested];
  }
  const text = String(value).trim();
  if (!text) return [];
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try { return parsePhotoValue(JSON.parse(text)); } catch { return [text]; }
  }
  return text.includes(',') && !text.startsWith('data:') ? text.split(',').map((x) => x.trim()).filter(Boolean) : [text];
};

const buildMapUrl = (clinic, address) => {
  const existing = pickFirst(clinic.map_url, clinic.mapUrl, clinic.google_map_url);
  if (existing) return existing;
  const lat = pickFirst(clinic.latitude, clinic.lat, clinic.location_lat, clinic.location?.lat);
  const lng = pickFirst(clinic.longitude, clinic.lng, clinic.location_lng, clinic.location?.lng);
  if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return '';
};

const toList = (raw) => (Array.isArray(raw)
  ? raw.map((item) => (typeof item === 'string' ? item : item?.name || item?.title)).filter(Boolean)
  : String(raw || '').split(',').map((x) => x.trim()).filter(Boolean));

const normalizeClinic = (clinic, index = 0) => {
  const photos = parsePhotoValue([
    clinic.clinic_photo, clinic.clinicPhotoBuffer, clinic.clinic_photos, clinic.clinicPhoto, clinic.clinicPhotos,
    clinic.clinic_photo_url, clinic.clinicPhotoUrl, clinic.clinic_photo_path, clinic.clinicPhotoPath,
    clinic.clinic_image, clinic.clinic_image_url, clinic.photo, clinic.photos, clinic.photo_data, clinic.photoData,
    clinic.image, clinic.images, clinic.image_url, clinic.image_urls, clinic.photo_url, clinic.photo_urls,
    clinic.uploaded_photo, clinic.uploaded_photos, clinic.media, clinic.logo, clinic.file_path, clinic.filePath,
  ].filter(Boolean)).map(getAssetUrl);
  const location = typeof clinic.location === 'string' ? clinic.location : '';
  const address = pickFirst(location, clinic.address, clinic.clinic_address, FALLBACK.address);
  const specialties = toList(pickFirst(clinic.specialties, clinic.key_specialties, clinic.departments, clinic.services));
  return {
    raw: clinic,
    id: pickFirst(clinic.id, clinic.clinic_id, clinic._id, index),
    deleteId: pickFirst(clinic.id, clinic.clinic_id, clinic.clinicId, clinic._id, clinic.hospital_id, clinic.hospitalId, ''),
    doctorId: pickFirst(clinic.doctor_id, clinic.doctorId, clinic.doctor?.id, clinic.doctor?._id, ''),
    name: pickFirst(clinic.clinic_name, clinic.clinicName, clinic.name, FALLBACK.name),
    subtitle: pickFirst(clinic.type, clinic.category, FALLBACK.subtitle),
    address,
    fullAddress: pickFirst(clinic.full_address, clinic.fullAddress, clinic.address, address),
    phone: formatPhoneNumber(pickFirst(clinic.phone_number, clinic.phone, clinic.contact_number, ''), clinic.phoneCountryCode),
    email: pickFirst(clinic.email, clinic.clinic_email, ''),
    website: pickFirst(clinic.website, clinic.web_url, ''),
    image: photos[0] || DEFAULT_CLINIC_IMAGE,
    mapUrl: buildMapUrl(clinic, address),
    about: pickFirst(clinic.about, clinic.description, clinic.about_hospital, FALLBACK.about),
    mission: pickFirst(clinic.mission, clinic.our_mission, FALLBACK.mission),
    specialties,
    stats: {
      beds: pickFirst(clinic.beds_count, clinic.bed_count, clinic.total_beds, 0),
      emergency: pickFirst(clinic.emergency_status, clinic.emergency, '—'),
      // GET /api/clinics: the average of patients' clinic ratings and how many.
      rating: Number(pickFirst(clinic.rating, clinic.patient_rating, 0)) || 0,
      ratingCount: Number(pickFirst(clinic.ratingCount, clinic.rating_count, 0)) || 0,
    },
  };
};

// A specialization field as a clean list (array, JSON text or comma text).
const toSpecialties = (value) => {
  let list = value;
  if (typeof list === 'string') {
    const text = list.trim();
    if (text.startsWith('[')) {
      try { list = JSON.parse(text); } catch { list = text; }
    }
    if (typeof list === 'string') list = list.split(',');
  }
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item ?? '').trim())
    .filter((item, i, all) => item && all.indexOf(item) === i);
};

const normalizeDoctor = (doctor, index) => {
  const specialties = toSpecialties(pickFirst(doctor.specialization, doctor.speciality, doctor.specialty, doctor.department));
  const years = Number(pickFirst(doctor.experience, doctor.years_of_experience, doctor.experience_years));
  const rating = Number(pickFirst(doctor.rating, doctor.average_rating, doctor.averageRating));
  const ratingCount = Number(pickFirst(doctor.ratingCount, doctor.totalRatings, doctor.rating_count, 0)) || 0;
  const languages = Array.isArray(doctor.languages) ? doctor.languages : toSpecialties(doctor.languages);
  return {
    id: pickFirst(doctor.id, doctor.user_id, doctor.doctor_id, doctor._id, index),
    name: pickFirst(doctor.fullName, doctor.full_name, doctor.fullname, doctor.name, doctor.doctor_name, 'Doctor'),
    specialties,
    specialty: specialties[0] || 'General Physician',
    experience: Number.isFinite(years) && years > 0 ? `${years}+ yrs` : '',
    rating: Number.isFinite(rating) && rating > 0 ? rating : 0,
    ratingCount,
    qualification: pickFirst(doctor.qualification, doctor.education, ''),
    languages: languages.filter(Boolean),
    about: pickFirst(doctor.aboutMe, doctor.about, doctor.bio, ''),
    image: getAssetUrl(pickFirst(doctor.profile_photo, doctor.profilePhoto?.url, doctor.profilePhoto, doctor.avatar, doctor.image)),
  };
};

const initialsOf = (name) => String(name || 'D')
  .replace(/^dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'D';

const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

export default function ClinicPageScreen({ onBack }) {
  const [user, setUser] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Overview');
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [deletingClinic, setDeletingClinic] = useState(false);
  // Custom confirm popup (DeleteClinicModal) instead of a plain Alert.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { showToast } = useToast();

  useEffect(() => { getStoredDoctorUser().then((u) => setUser(u || {})); }, []);

  const doctorId = user ? pickFirst(user.doctor_id, user.doctorId, user.id, user._id, user.user_id, user.userId, '') : '';
  const userRole = String(user?.role || 'doctor').toLowerCase();

  // keepId: stay on this clinic after the reload (e.g. the one just edited).
  const loadClinics = useCallback(async (keepId) => {
    if (!user) return;
    if (!doctorId) {
      setClinics([]);
      setStatus('succeeded');
      return;
    }
    try {
      setStatus('loading');
      setError('');
      const response = await axiosInstance.get('/api/clinics', { params: { doctor_id: doctorId, role: userRole } });
      const rows = unwrapApiArray(response.data)
        .map(normalizeClinic)
        .filter((item) => !item.doctorId || String(item.doctorId) === String(doctorId));
      setClinics(rows);
      const keepIndex = keepId != null
        ? rows.findIndex((item) => String(pickFirst(item.deleteId, item.id)) === String(keepId))
        : -1;
      setActiveIndex(keepIndex >= 0 ? keepIndex : 0);
      setStatus('succeeded');
    } catch (err) {
      setClinics([]);
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to load live clinic data.');
      setStatus('failed');
    } finally {
      setRefreshing(false);
    }
  }, [user, doctorId, userRole]);

  useEffect(() => { loadClinics(); }, [loadClinics]);

  const clinic = clinics[activeIndex] || FALLBACK;

  useEffect(() => {
    setImageFailed(false);
    if (!clinic.id || clinic.id === FALLBACK.id) {
      setDoctors([]);
      setAppointments([]);
      return undefined;
    }
    let cancelled = false;
    const params = { clinic_id: clinic.id, doctor_id: clinic.doctorId || doctorId };
    // Promise.allSettled without relying on the JS engine having it.
    const settle = (promise) => promise.then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    );
    Promise.all([
      settle(axiosInstance.get('/api/auth/me', { params })),
      settle(axiosInstance.get('/api/appointments', { params })),
    ]).then(([doctorResult, appointmentResult]) => {
      if (cancelled) return;
      const matchesClinic = (item) => {
        const itemClinicId = pickFirst(item.clinic_id, item.clinicId, item.clinic?.id, item.clinic?._id, item.hospital_id, item.hospitalId);
        return !itemClinicId || String(itemClinicId) === String(clinic.id);
      };
      setDoctors(doctorResult.status === 'fulfilled' ? [doctorResult.value.data?.user].filter(Boolean) : []);
      setAppointments(appointmentResult.status === 'fulfilled' ? unwrapApiArray(appointmentResult.value.data).filter(matchesClinic) : []);
    });
    return () => { cancelled = true; };
  }, [clinic.id, clinic.doctorId, doctorId]);

  const normalizedDoctors = useMemo(() => doctors.map(normalizeDoctor), [doctors]);

  const departmentNames = useMemo(() => {
    const names = new Set();
    (Array.isArray(clinic.raw?.departments) ? clinic.raw.departments : []).forEach((d) => {
      const name = pickFirst(d?.department_name, d?.name, d?.title, typeof d === 'string' ? d : undefined);
      if (name) names.add(String(name));
    });
    normalizedDoctors.forEach((d) => d.specialties.forEach((spec) => names.add(spec)));
    appointments.forEach((a) => {
      const name = pickFirst(a.department_name, a.department, a.specialization);
      if (name) names.add(String(name));
    });
    return Array.from(names);
  }, [clinic, appointments, normalizedDoctors]);

  const patientCount = useMemo(() => {
    const ids = new Set();
    appointments.forEach((a, index) => {
      const patient = a.patient || a.patient_details || {};
      ids.add(String(pickFirst(a.patient_id, a.patientId, patient.id, patient._id, a.patient_phone, a.phone_number, patient.phone, `appointment-${index}`)));
    });
    return ids.size;
  }, [appointments]);

  const facilities = useMemo(() => toList(pickFirst(clinic.raw?.facilities, clinic.raw?.services, clinic.raw?.amenities, [])), [clinic]);
  const activeClinicId = pickFirst(
    clinic.deleteId,
    clinic.raw?.id,
    clinic.raw?.clinic_id,
    clinic.raw?.clinicId,
    clinic.raw?._id,
    clinic.raw?.hospital_id,
    clinic.raw?.hospitalId,
    '',
  );
  const canDeleteClinic = Boolean(activeClinicId && activeClinicId !== FALLBACK.id);

  const hasRating = clinic.stats.ratingCount > 0 && clinic.stats.rating > 0;
  const ratingText = clinic.stats.rating.toFixed(1);
  const ratingSummary = hasRating
    ? `${ratingText} (${clinic.stats.ratingCount} ${clinic.stats.ratingCount === 1 ? 'rating' : 'ratings'})`
    : 'No ratings yet';

  const stats = [
    { label: 'Doctors', value: normalizedDoctors.length, icon: 'medkit-outline', tone: TONES.teal },
    { label: 'Departments', value: departmentNames.length, icon: 'layers-outline', tone: TONES.indigo },
    { label: 'Patients', value: patientCount, icon: 'people-outline', tone: TONES.blue },
    { label: 'Beds', value: clinic.stats.beds, icon: 'bed-outline', tone: TONES.slate },
    { label: 'Emergency', value: clinic.stats.emergency, icon: 'pulse-outline', tone: TONES.rose },
    { label: 'Rating', value: hasRating ? ratingText : '—', icon: 'star', tone: TONES.amber },
  ];
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const changeClinic = (direction) => {
    if (!clinics.length) return;
    setActiveIndex((i) => (i + direction + clinics.length) % clinics.length);
    setActiveTab('Overview');
  };

  const performDeleteClinic = async () => {
    if (deletingClinic || !activeClinicId || activeClinicId === FALLBACK.id) return;
    try {
      setDeletingClinic(true);
      setDeleteError('');
      await deleteDoctorClinic(activeClinicId);
      setClinics((rows) => {
        const remaining = rows.filter((item) => String(pickFirst(item.deleteId, item.id)) !== String(activeClinicId));
        setActiveIndex((index) => Math.min(index, Math.max(remaining.length - 1, 0)));
        return remaining;
      });
      setActiveTab('Overview');
      setConfirmDeleteOpen(false);
      showToast('Clinic deleted');
    } catch (err) {
      // Shown inside the popup so the doctor sees why it wasn't deleted.
      setDeleteError(err?.response?.data?.message || err?.response?.data?.error || 'Clinic could not be deleted. Please try again.');
    } finally {
      setDeletingClinic(false);
    }
  };

  const handleDeleteClinic = () => {
    setDeleteError('');
    setConfirmDeleteOpen(true);
  };

  const website = clinic.website && (clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`);
  const emergencyHours = pickFirst(clinic.raw?.emergency_hours, clinic.raw?.emergencyHours, clinic.raw?.emergency_status, clinic.raw?.emergency);
  const opdHours = pickFirst(clinic.raw?.opd_timings, clinic.raw?.opdTimings, clinic.raw?.opening_hours, clinic.raw?.openingHours, clinic.raw?.timings);

  // "+ Add" in the header opens the Add Clinic form (same screen as Settings →
  // Clinic) right here; closing it reloads the list so a new clinic shows up.
  const [addingClinic, setAddingClinic] = useState(false);
  const closeAddClinic = () => {
    setAddingClinic(false);
    loadClinics();
  };
  // The edit button on the clinic photo opens the Edit Clinic form for the
  // clinic on screen; after saving, the list reloads and stays on that clinic.
  const [editingClinic, setEditingClinic] = useState(null);
  const finishEditClinic = (saved) => {
    const keepId = editingClinic?.id;
    setEditingClinic(null);
    if (saved) loadClinics(keepId);
  };
  useDoctorBack(() => {
    if (editingClinic) {
      finishEditClinic(false);
      return true;
    }
    if (!addingClinic) return false;
    closeAddClinic();
    return true;
  });

  if (editingClinic) {
    return (
      <EditClinicScreen
        clinic={editingClinic}
        onBack={() => finishEditClinic(false)}
        onSaved={() => finishEditClinic(true)}
      />
    );
  }
  if (addingClinic) return <DoctorClinicSettingsScreen onBack={closeAddClinic} />;

  const openEditClinic = () => setEditingClinic({
    id: activeClinicId,
    name: clinic.name,
    phone: clinic.phone,
    location: clinic.address,
    photoUrl: clinic.image !== DEFAULT_CLINIC_IMAGE ? clinic.image : '',
    fee: clinicFeeOf(clinic.raw),
  });

  const renderScreenHeader = () => (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
        <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
      </Pressable>
      <Text style={s.title}>Clinic</Text>
      <Pressable
        onPress={() => setAddingClinic(true)}
        style={({ pressed }) => [s.addClinicButton, pressed && s.addClinicButtonPressed]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Add clinic"
      >
        <AppIcon name="plus" size={16} color="#FFFFFF" strokeWidth={2.6} />
        <Text style={s.addClinicText}>Add</Text>
      </Pressable>
    </View>
  );

  if (!clinics.length) {
    return (
      <View style={s.screen}>
        {renderScreenHeader()}
        <View style={s.noClinicState}>
          {status === 'loading' ? (
            <ActivityIndicator color="#0D9488" />
          ) : (
            <View style={s.noClinicIcon}><AppIcon name="pin" size={24} color="#0D9488" /></View>
          )}
          <Text style={s.noClinicTitle}>{status === 'loading' ? 'Loading clinics…' : 'No clinic added'}</Text>
          <Text style={s.noClinicText}>{error || 'Add a clinic to view its live profile and appointment data.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <DeleteClinicModal
        visible={confirmDeleteOpen}
        clinicName={clinic?.name}
        clinicAddress={clinic?.fullAddress || clinic?.address}
        deleting={deletingClinic}
        error={deleteError}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={performDeleteClinic}
      />
      {renderScreenHeader()}
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadClinics(); }} colors={['#0D9488']} />}
      >
        {!!error && <Text style={s.error}>{error}</Text>}
        <ImageBackground
          source={{ uri: imageFailed ? DEFAULT_CLINIC_IMAGE : clinic.image }}
          onError={() => setImageFailed(true)}
          style={s.hero}
          imageStyle={s.heroImage}
        >
          <View style={s.heroOverlay} />
          {canDeleteClinic && (
            <Pressable
              onPress={handleDeleteClinic}
              disabled={deletingClinic}
              style={({ pressed }) => [s.heroDeleteBtn, pressed && s.heroDeleteBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete clinic"
            >
              {deletingClinic ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <AppIcon name="trash" size={17} color="#DC2626" strokeWidth={2.4} />
              )}
            </Pressable>
          )}
          {canDeleteClinic && (
            <Pressable
              onPress={openEditClinic}
              disabled={deletingClinic}
              style={({ pressed }) => [s.heroEditBtn, pressed && s.heroEditBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit clinic"
            >
              <AppIcon name="pencil" size={15} color="#0D9488" strokeWidth={2.4} />
              <Text style={s.heroEditText}>Edit</Text>
            </Pressable>
          )}
          <View style={s.heroContent}>
            <View style={s.badgeRow}>
              {!!clinic.subtitle && <Text style={s.typeBadge}>{clinic.subtitle}</Text>}
            </View>
            <Text translate={false} style={s.heroTitle}>{clinic.name}</Text>
            <View style={s.heroMetaRow}>
              <AppIcon name="pin" size={13} color="#FFFFFF" />
              <Text translate={false} style={s.heroMeta} numberOfLines={1}>{clinic.address}</Text>
            </View>
            <Text translate={false} style={s.heroMeta}>★ {ratingSummary}</Text>
          </View>
          {clinics.length > 1 && (
            <>
              <Pressable style={[s.switchBtn, s.switchPrev]} onPress={() => changeClinic(-1)}>
                <AppIcon name="chevron-left" size={18} color="#17243A" strokeWidth={2.4} />
              </Pressable>
              <Pressable style={[s.switchBtn, s.switchNext]} onPress={() => changeClinic(1)}>
                <AppIcon name="chevron-right" size={18} color="#17243A" strokeWidth={2.4} />
              </Pressable>
            </>
          )}
        </ImageBackground>

        {/* Section tabs: icon + label pills; the active one is solid teal. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [s.tab, active && s.tabActive, pressed && !active && s.tabPressed]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={tab.icon} size={15} color={active ? '#FFFFFF' : '#475467'} />
                <Text style={[s.tabText, active && s.tabTextActive]}>{tab.key}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {status === 'loading' && (
          <View style={s.state}><ActivityIndicator color="#0D9488" /><Text style={s.muted}>Loading clinic profile...</Text></View>
        )}

        {activeTab === 'Overview' && (
          <View style={s.stats}>
            {stats.map((item) => (
              <View key={item.label} style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: item.tone.bg }]}>
                  <Ionicons name={item.icon} size={16} color={item.tone.fg} />
                </View>
                <Text translate={false} style={s.statValue} numberOfLines={1}>{String(item.value)}</Text>
                <Text style={s.statLabel} numberOfLines={1}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Overview' && (
          <Panel icon="business-outline" tone={TONES.teal} title="About Hospital">
            <Text translate={false} style={s.body}>{clinic.about}</Text>
            <View style={s.missionBox}>
              <Ionicons name="flag-outline" size={15} color="#0F766E" />
              <View style={s.flex}>
                <Text style={s.missionTitle}>Our Mission</Text>
                <Text style={s.body}>{clinic.mission}</Text>
              </View>
            </View>
            <Text style={s.subTitle}>Key Specialties</Text>
            <ChipList items={clinic.specialties} empty="No specialties added yet" />
          </Panel>
        )}

        {(activeTab === 'Overview' || activeTab === 'Doctors') && (
          <Panel
            icon="people-outline"
            tone={TONES.indigo}
            title="Featured Specialists"
            subtitle="Tap a doctor to see full details"
            right={activeTab === 'Overview' && normalizedDoctors.length > 0 ? (
              <Pressable onPress={() => setActiveTab('Doctors')} hitSlop={8}><Text style={s.link}>View All</Text></Pressable>
            ) : null}
          >
            {normalizedDoctors.length === 0 && <EmptyNote icon="person-outline" text="No doctors available" />}
            {normalizedDoctors.map((doctor, index) => (
              <Pressable
                key={String(doctor.id)}
                onPress={() => setSelectedDoctor(doctor)}
                style={({ pressed }) => [s.doctorCard, index > 0 && s.doctorCardDivider, pressed && s.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`View ${doctor.name}`}
              >
                <DoctorPhoto doctor={doctor} size={54} />
                <View style={s.flex}>
                  <Text translate={false} style={s.doctorName} numberOfLines={1}>{doctor.name}</Text>
                  <View style={s.doctorSpecRow}>
                    <Text translate={false} style={s.doctorSpec} numberOfLines={1}>{doctor.specialty}</Text>
                    {doctor.specialties.length > 1 && (
                      <View style={s.morePill}><Text translate={false} style={s.morePillText}>+{doctor.specialties.length - 1}</Text></View>
                    )}
                  </View>
                  <View style={s.metaRow}>
                    {!!doctor.experience && <MetaBadge icon="briefcase-outline" text={doctor.experience} tone={TONES.blue} />}
                    {doctor.rating > 0 && (
                      <MetaBadge icon="star" text={`${doctor.rating.toFixed(1)}${doctor.ratingCount ? ` (${doctor.ratingCount})` : ''}`} tone={TONES.amber} />
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
              </Pressable>
            ))}
          </Panel>
        )}

        {(activeTab === 'Overview' || activeTab === 'Contact') && (
          <Panel icon="call-outline" tone={TONES.blue} title="Contact Information">
            <ContactRow icon="location-outline" label="Address" value={clinic.fullAddress} onPress={clinic.mapUrl ? () => openUrl(clinic.mapUrl) : null} action="Map" />
            {!!clinic.phone && <ContactRow icon="call-outline" label="Phone" value={clinic.phone} onPress={() => openUrl(`tel:${clinic.phone}`)} action="Call" />}
            {!!clinic.email && <ContactRow icon="mail-outline" label="Email" value={clinic.email} onPress={() => openUrl(`mailto:${clinic.email}`)} action="Email" />}
            {!!website && <ContactRow icon="globe-outline" label="Website" value={clinic.website} onPress={() => openUrl(website)} action="Open" />}
            {(emergencyHours || opdHours) && (
              <>
                <Text style={s.subTitle}>Hours</Text>
                <View style={s.hoursCard}>
                  {!!emergencyHours && (
                    <View style={s.hoursRow}>
                      <View style={s.hoursLabelRow}><Ionicons name="pulse-outline" size={14} color="#E11D48" /><Text style={s.muted}>Emergency</Text></View>
                      <Text translate={false} style={s.strong}>{String(emergencyHours)}</Text>
                    </View>
                  )}
                  {!!opdHours && (
                    <View style={[s.hoursRow, emergencyHours && s.hoursRowDivider]}>
                      <View style={s.hoursLabelRow}><Ionicons name="time-outline" size={14} color="#0D9488" /><Text style={s.muted}>OPD Timings</Text></View>
                      <Text translate={false} style={s.strong}>{String(opdHours)}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Panel>
        )}

        {activeTab === 'Departments' && (
          <Panel icon="layers-outline" tone={TONES.indigo} title="Departments" subtitle={`${departmentNames.length} available`}>
            <ChipList items={departmentNames} empty="No departments available" />
          </Panel>
        )}

        {activeTab === 'Facilities' && (
          <Panel icon="medkit-outline" tone={TONES.teal} title="Facilities" subtitle={facilities.length ? `${facilities.length} available` : undefined}>
            <ChipList items={facilities} empty="No facilities added yet" icon="checkmark-circle" />
          </Panel>
        )}

        {activeTab === 'Reviews' && (
          <Panel icon="star-outline" tone={TONES.amber} title="Reviews">
            {hasRating ? (
              <View style={s.ratingSummary}>
                <Text translate={false} style={s.ratingBig}>{ratingText}</Text>
                <View style={s.flex}>
                  <View style={s.ratingStars}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const filled = clinic.stats.rating >= n - 0.25;
                      const half = !filled && clinic.stats.rating >= n - 0.75;
                      return (
                        <Ionicons
                          key={n}
                          name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
                          size={17}
                          color={filled || half ? '#F59E0B' : '#D0D5DD'}
                        />
                      );
                    })}
                  </View>
                  <Text translate={false} style={s.muted}>
                    Average from {clinic.stats.ratingCount} patient {clinic.stats.ratingCount === 1 ? 'rating' : 'ratings'}
                  </Text>
                </View>
              </View>
            ) : (
              <EmptyNote icon="star-outline" text="No ratings yet. Patients can rate this clinic after a completed visit." />
            )}
          </Panel>
        )}
      </ScrollView>
      <DoctorDetailSheet doctor={selectedDoctor} clinicName={clinic.name} onClose={() => setSelectedDoctor(null)} />
    </View>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function Panel({ icon, tone, title, subtitle, right, children }) {
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <View style={[s.panelIcon, { backgroundColor: tone.bg }]}><Ionicons name={icon} size={17} color={tone.fg} /></View>
        <View style={s.flex}>
          <Text style={s.panelTitle}>{title}</Text>
          {!!subtitle && <Text translate={false} style={s.panelSub}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function ChipList({ items, empty, icon }) {
  if (!items.length) return <EmptyNote icon="information-circle-outline" text={empty} />;
  return (
    <View style={s.chips}>
      {items.map((item) => (
        <View key={item} style={s.chip}>
          {!!icon && <Ionicons name={icon} size={13} color="#0D9488" />}
          <Text translate={false} style={s.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function EmptyNote({ icon, text }) {
  return (
    <View style={s.emptyNote}>
      <Ionicons name={icon} size={16} color="#98A2B3" />
      <Text style={s.emptyNoteText}>{text}</Text>
    </View>
  );
}

function MetaBadge({ icon, text, tone }) {
  return (
    <View style={[s.metaBadge, { backgroundColor: tone.bg }]}>
      <Ionicons name={icon} size={11} color={tone.fg} />
      <Text translate={false} style={[s.metaBadgeText, { color: tone.fg }]}>{text}</Text>
    </View>
  );
}

function ContactRow({ icon, label, value, onPress, action }) {
  return (
    <Pressable onPress={onPress || undefined} disabled={!onPress} style={({ pressed }) => [s.contactRow, pressed && s.pressed]}>
      <View style={s.contactIcon}><Ionicons name={icon} size={16} color="#0D9488" /></View>
      <View style={s.flex}>
        <Text style={s.contactLabel}>{label}</Text>
        <Text translate={false} style={s.contactValue}>{value}</Text>
      </View>
      {!!onPress && <Text style={s.contactAction}>{action}</Text>}
    </Pressable>
  );
}

function DoctorPhoto({ doctor, size }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (doctor.image && !failed) {
    return <Image source={{ uri: doctor.image }} style={[s.doctorImage, box]} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[s.doctorImage, s.doctorInitials, box]}>
      <Text translate={false} style={[s.doctorInitialText, { fontSize: size * 0.36 }]}>{initialsOf(doctor.name)}</Text>
    </View>
  );
}

// Bottom sheet with the doctor's full profile: every specialization,
// experience, rating, qualification, languages and about.
function DoctorDetailSheet({ doctor, clinicName, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={Boolean(doctor)}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.sheetBackdrop}>
        <Pressable style={s.sheetBackdropTap} onPress={onClose} />
        {!!doctor && (
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
            <View style={s.sheetHandle} />
            <Pressable onPress={onClose} hitSlop={10} style={s.sheetClose} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color="#475467" />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
              <View style={s.sheetHero}>
                <DoctorPhoto doctor={doctor} size={84} />
                <Text translate={false} style={s.sheetName}>{doctor.name}</Text>
                <Text translate={false} style={s.sheetClinic} numberOfLines={1}>{clinicName}</Text>
              </View>

              <View style={s.sheetStats}>
                <SheetStat icon="briefcase-outline" tone={TONES.blue} value={doctor.experience || '—'} label="Experience" />
                <View style={s.sheetStatDivider} />
                <SheetStat
                  icon="star"
                  tone={TONES.amber}
                  value={doctor.rating > 0 ? doctor.rating.toFixed(1) : '—'}
                  label={doctor.rating > 0 && doctor.ratingCount ? `${doctor.ratingCount} ratings` : 'Rating'}
                />
                <View style={s.sheetStatDivider} />
                <SheetStat icon="layers-outline" tone={TONES.indigo} value={String(doctor.specialties.length || '—')} label="Specialties" />
              </View>

              <Text style={s.sheetSection}>Specialization</Text>
              <ChipList items={doctor.specialties} empty="No specialization added yet" />

              {!!doctor.qualification && (
                <>
                  <Text style={s.sheetSection}>Qualification</Text>
                  <View style={s.sheetInfoRow}>
                    <Ionicons name="school-outline" size={16} color="#0D9488" />
                    <Text translate={false} style={[s.body, s.flex]}>{doctor.qualification}</Text>
                  </View>
                </>
              )}

              {doctor.languages.length > 0 && (
                <>
                  <Text style={s.sheetSection}>Languages</Text>
                  <ChipList items={doctor.languages} />
                </>
              )}

              {!!doctor.about && (
                <>
                  <Text style={s.sheetSection}>About</Text>
                  <Text translate={false} style={s.body}>{doctor.about}</Text>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

function SheetStat({ icon, tone, value, label }) {
  return (
    <View style={s.sheetStat}>
      <View style={[s.sheetStatIcon, { backgroundColor: tone.bg }]}><Ionicons name={icon} size={15} color={tone.fg} /></View>
      <Text translate={false} style={s.sheetStatValue} numberOfLines={1}>{value}</Text>
      <Text translate={false} style={s.sheetStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#0D9488' },
  addClinicButton: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: '#0D9488' },
  addClinicButtonPressed: { backgroundColor: '#0F766E' },
  addClinicText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' },
  content: { padding: 12, paddingBottom: 32 },
  error: { fontSize: 13, color: colors.red, marginBottom: 10 },
  noClinicState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  noClinicIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6FBF8' },
  noClinicTitle: { fontSize: 18, fontWeight: '800', color: '#101828', textAlign: 'center' },
  noClinicText: { fontSize: 13.5, lineHeight: 20, color: '#667085', textAlign: 'center' },
  hero: { height: 210, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { borderRadius: 14 },
  heroOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8, 47, 45, 0.55)' },
  heroDeleteBtn: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  heroDeleteBtnPressed: { backgroundColor: '#FEE2E2' },
  heroEditBtn: { position: 'absolute', top: 12, left: 56, height: 36, borderRadius: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.92)' },
  heroEditBtnPressed: { backgroundColor: '#E6FBF8' },
  heroEditText: { fontSize: 13, fontWeight: '800', color: '#0D9488' },
  heroContent: { padding: 14, gap: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  openBadge: { fontSize: 11, fontWeight: '700', color: '#FFF', backgroundColor: '#16A34A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  typeBadge: { fontSize: 11, fontWeight: '700', color: '#0D9488', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMeta: { fontSize: 13, color: '#E6FFFB', flexShrink: 1 },
  switchBtn: { position: 'absolute', top: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  switchPrev: { right: 54 },
  switchNext: { right: 12 },
  // Tabs
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: '#F2F4F7' },
  tabActive: { backgroundColor: '#0D9488', shadowColor: '#0D9488', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tabPressed: { backgroundColor: '#E4E7EC' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475467' },
  tabTextActive: { color: '#FFF' },
  state: { alignItems: 'center', gap: 8, paddingVertical: 16 },

  // Stats (3 per row)
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { width: '31.6%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAECF0', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, shadowColor: '#101828', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 19, fontWeight: '800', color: '#101828', marginTop: 8 },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: '#667085', marginTop: 1 },

  // Panels
  panel: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAECF0', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#101828', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  panelIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { ...typography.subtitle, fontSize: 16, color: '#101828' },
  panelSub: { fontSize: 12, color: '#667085', marginTop: 1 },
  subTitle: { fontSize: 12, fontWeight: '800', color: '#667085', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  body: { fontSize: 13.5, lineHeight: 20, color: '#475467' },
  muted: { fontSize: 12.5, color: '#667085' },
  strong: { fontSize: 13.5, fontWeight: '700', color: '#101828' },
  link: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  missionBox: { flexDirection: 'row', gap: 10, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' },
  missionTitle: { fontSize: 13, fontWeight: '800', color: '#0F766E', marginBottom: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCEFEA', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14 },
  chipText: { fontSize: 12.5, fontWeight: '600', color: '#0F766E' },
  emptyNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F2F4F7', borderStyle: 'dashed' },
  emptyNoteText: { flex: 1, fontSize: 12.5, color: '#667085' },

  // Reviews
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, backgroundColor: '#FFFBEB' },
  ratingBig: { fontSize: 36, fontWeight: '800', color: '#101828' },
  ratingStars: { flexDirection: 'row', gap: 3, marginBottom: 4 },

  // Contact
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  contactIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 11.5, fontWeight: '700', color: '#98A2B3' },
  contactValue: { fontSize: 13.5, fontWeight: '600', color: '#101828', marginTop: 1 },
  contactAction: { fontSize: 12, fontWeight: '800', color: '#0D9488', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#E6FBF8', overflow: 'hidden' },
  hoursCard: { borderRadius: 12, borderWidth: 1, borderColor: '#EAECF0', paddingHorizontal: 12 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  hoursRowDivider: { borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  hoursLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Doctors
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  doctorCardDivider: { borderTopWidth: 1, borderTopColor: '#F2F4F7' },
  doctorImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E6FBF8' },
  doctorInitials: { backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  doctorInitialText: { fontSize: 18, fontWeight: '800', color: '#0F766E' },
  doctorName: { fontSize: 15, fontWeight: '800', color: '#101828' },
  doctorSpecRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  doctorSpec: { flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: '#0F766E' },
  morePill: { borderRadius: 8, backgroundColor: '#CCFBF1', paddingHorizontal: 6, paddingVertical: 1 },
  morePillText: { fontSize: 10.5, fontWeight: '800', color: '#0F766E' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  metaBadgeText: { fontSize: 11, fontWeight: '800' },

  // Doctor detail sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.45)', justifyContent: 'flex-end' },
  sheetBackdropTap: { flex: 1 },
  sheet: { maxHeight: '86%', backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD' },
  sheetClose: { position: 'absolute', top: 12, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  sheetContent: { paddingHorizontal: 18, paddingBottom: 8 },
  sheetHero: { alignItems: 'center', paddingTop: 14 },
  sheetName: { fontSize: 19, fontWeight: '800', color: '#101828', marginTop: 10, textAlign: 'center' },
  sheetClinic: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  sheetStats: { flexDirection: 'row', alignItems: 'stretch', marginTop: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EAECF0' },
  sheetStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  sheetStatIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sheetStatValue: { fontSize: 15, fontWeight: '800', color: '#101828', marginTop: 6 },
  sheetStatLabel: { fontSize: 11, color: '#667085', marginTop: 1 },
  sheetStatDivider: { width: 1, backgroundColor: '#EAECF0' },
  sheetSection: { fontSize: 12, fontWeight: '800', color: '#667085', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  sheetInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
