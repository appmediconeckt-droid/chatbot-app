// Clinic profile — port of the web ClinicAllView/ClinicPage.jsx, styled with
// the app's clinician theme. Same data:
//   GET /api/clinics?doctor_id&role               (doctor's clinics; arrows switch between them)
//   GET /api/auth/me?clinic_id&doctor_id          (clinic doctors)
//   GET /api/appointments?clinic_id&doctor_id     (patient count / departments)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { colors, createDoctorStyles, typography } from '../theme';
import axiosInstance, { API_BASE_URL } from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import { unwrapApiArray } from '../api/doctorClinics';

const DEFAULT_CLINIC_IMAGE = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80';
const TABS = ['Overview', 'Doctors', 'Departments', 'Facilities', 'Reviews', 'Contact'];

const FALLBACK = {
  id: 'fallback-clinic',
  name: 'Clinic Profile',
  subtitle: 'Healthcare Facility',
  address: 'Address not available',
  fullAddress: 'Address not available',
  phone: '',
  email: '',
  website: '',
  image: DEFAULT_CLINIC_IMAGE,
  mapUrl: '',
  about: 'Clinic information is not available.',
  mission: 'Mission information is not available.',
  specialties: [],
  stats: { beds: 0, emergency: '24/7', rating: 'N/A' },
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
    doctorId: pickFirst(clinic.doctor_id, clinic.doctorId, clinic.doctor?.id, clinic.doctor?._id, ''),
    name: pickFirst(clinic.clinic_name, clinic.clinicName, clinic.name, FALLBACK.name),
    subtitle: pickFirst(clinic.type, clinic.category, FALLBACK.subtitle),
    address,
    fullAddress: pickFirst(clinic.full_address, clinic.fullAddress, clinic.address, address),
    phone: pickFirst(clinic.phone_number, clinic.phone, clinic.contact_number, ''),
    email: pickFirst(clinic.email, clinic.clinic_email, ''),
    website: pickFirst(clinic.website, clinic.web_url, ''),
    image: photos[0] || DEFAULT_CLINIC_IMAGE,
    mapUrl: buildMapUrl(clinic, address),
    about: pickFirst(clinic.about, clinic.description, clinic.about_hospital, FALLBACK.about),
    mission: pickFirst(clinic.mission, clinic.our_mission, FALLBACK.mission),
    specialties,
    stats: {
      beds: pickFirst(clinic.beds_count, clinic.bed_count, clinic.total_beds, 0),
      emergency: pickFirst(clinic.emergency_status, clinic.emergency, '24/7'),
      rating: pickFirst(clinic.rating, clinic.patient_rating, 'N/A'),
    },
  };
};

const normalizeDoctor = (doctor, index) => ({
  id: pickFirst(doctor.id, doctor.user_id, doctor.doctor_id, doctor._id, index),
  name: pickFirst(doctor.fullName, doctor.full_name, doctor.fullname, doctor.name, doctor.doctor_name, 'Doctor'),
  specialty: (Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : doctor.specialization)
    || doctor.speciality || doctor.specialty || doctor.department || 'General Physician',
  experience: pickFirst(doctor.experience, doctor.years_of_experience, doctor.experience_years, 'N/A'),
  rating: pickFirst(doctor.rating, doctor.average_rating, 'N/A'),
  image: getAssetUrl(pickFirst(doctor.profile_photo, doctor.profilePhoto?.url, doctor.profilePhoto, doctor.avatar, doctor.image)),
});

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

  useEffect(() => { getStoredDoctorUser().then((u) => setUser(u || {})); }, []);

  const doctorId = user ? pickFirst(user.doctor_id, user.doctorId, user.id, user._id, user.user_id, user.userId, '') : '';
  const userRole = String(user?.role || 'doctor').toLowerCase();

  const loadClinics = useCallback(async () => {
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
      setActiveIndex(0);
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
    Promise.allSettled([
      axiosInstance.get('/api/auth/me', { params }),
      axiosInstance.get('/api/appointments', { params }),
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
    normalizedDoctors.forEach((d) => { if (d.specialty && d.specialty !== 'General Physician') names.add(String(d.specialty)); });
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

  const stats = [
    { label: 'Doctors', value: normalizedDoctors.length, icon: 'user' },
    { label: 'Departments', value: departmentNames.length, icon: 'briefcase' },
    { label: 'Patients', value: patientCount, icon: 'users' },
    { label: 'Beds', value: clinic.stats.beds, icon: 'bed' },
    { label: 'Emergency', value: clinic.stats.emergency, icon: 'pulse' },
  ];

  const changeClinic = (direction) => {
    if (!clinics.length) return;
    setActiveIndex((i) => (i + direction + clinics.length) % clinics.length);
    setActiveTab('Overview');
  };

  const website = clinic.website && (clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Clinic</Text>
      </View>
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
          <View style={s.heroContent}>
            <View style={s.badgeRow}>
              <Text style={s.openBadge}>Open Now</Text>
              <Text style={s.typeBadge}>{clinic.subtitle}</Text>
            </View>
            <Text style={s.heroTitle}>{clinic.name}</Text>
            <View style={s.heroMetaRow}>
              <AppIcon name="pin" size={13} color="#FFFFFF" />
              <Text style={s.heroMeta} numberOfLines={1}>{clinic.address}</Text>
            </View>
            <Text style={s.heroMeta}>★ {clinic.stats.rating !== 'N/A' ? `${clinic.stats.rating} Rating` : 'No rating available'}</Text>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {TABS.map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[s.tab, activeTab === tab && s.tabActive]}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {status === 'loading' && (
          <View style={s.state}><ActivityIndicator color="#0D9488" /><Text style={s.muted}>Loading clinic profile...</Text></View>
        )}

        {activeTab === 'Overview' && (
          <View style={s.stats}>
            {stats.map((item) => (
              <View key={item.label} style={s.statCard}>
                <View style={s.statIcon}><AppIcon name={item.icon} size={16} color="#0D9488" /></View>
                <Text style={s.statValue}>{String(item.value)}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Overview' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>About Hospital</Text>
            <Text style={s.body}>{clinic.about}</Text>
            <Text style={s.subTitle}>Our Mission</Text>
            <Text style={s.body}>{clinic.mission}</Text>
            <Text style={s.subTitle}>Key Specialties</Text>
            <View style={s.chips}>
              {clinic.specialties.length
                ? clinic.specialties.map((item) => <Text key={item} style={s.chip}>{item}</Text>)
                : <Text style={s.chip}>No specialties available</Text>}
            </View>
          </View>
        )}

        {(activeTab === 'Overview' || activeTab === 'Contact') && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Contact Information</Text>
            <Pressable style={s.contactRow} onPress={() => openUrl(clinic.mapUrl)}>
              <AppIcon name="pin" size={15} color="#0D9488" />
              <Text style={[s.body, s.flex]}>{clinic.fullAddress}</Text>
            </Pressable>
            {!!clinic.phone && (
              <Pressable style={s.contactRow} onPress={() => openUrl(`tel:${clinic.phone}`)}>
                <AppIcon name="phone" size={15} color="#0D9488" />
                <Text style={[s.link, s.flex]}>{clinic.phone}</Text>
              </Pressable>
            )}
            {!!clinic.email && (
              <Pressable style={s.contactRow} onPress={() => openUrl(`mailto:${clinic.email}`)}>
                <AppIcon name="mail" size={15} color="#0D9488" />
                <Text style={[s.link, s.flex]}>{clinic.email}</Text>
              </Pressable>
            )}
            {!!website && (
              <Pressable style={s.contactRow} onPress={() => openUrl(website)}>
                <AppIcon name="globe" size={15} color="#0D9488" />
                <Text style={[s.link, s.flex]}>{clinic.website}</Text>
              </Pressable>
            )}
            <Text style={s.subTitle}>Hours</Text>
            <View style={s.hoursRow}><Text style={s.muted}>Emergency</Text><Text style={s.strong}>24/7 Open</Text></View>
            <View style={s.hoursRow}><Text style={s.muted}>OPD Timings</Text><Text style={s.strong}>8:00 AM - 8:00 PM</Text></View>
          </View>
        )}

        {(activeTab === 'Overview' || activeTab === 'Doctors') && (
          <View style={s.panel}>
            <View style={s.sectionHead}>
              <View style={s.flex}>
                <Text style={s.panelTitle}>Featured Specialists</Text>
                <Text style={s.muted}>Our team of experienced medical professionals</Text>
              </View>
              {activeTab === 'Overview' && (
                <Pressable onPress={() => setActiveTab('Doctors')}><Text style={s.link}>View All</Text></Pressable>
              )}
            </View>
            {normalizedDoctors.length === 0 && <Text style={s.muted}>No doctors available</Text>}
            {normalizedDoctors.map((doctor) => (
              <View key={String(doctor.id)} style={s.doctorCard}>
                {doctor.image ? (
                  <Image source={{ uri: doctor.image }} style={s.doctorImage} />
                ) : (
                  <View style={[s.doctorImage, s.doctorInitials]}><Text style={s.doctorInitialText}>{doctor.name.charAt(0)}</Text></View>
                )}
                <View style={s.flex}>
                  <Text style={s.strong}>{doctor.name}</Text>
                  <Text style={s.muted}>{doctor.specialty}</Text>
                  <Text style={s.muted}>Experience: {doctor.experience} • Rating: {doctor.rating}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Departments' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Departments</Text>
            {departmentNames.length === 0 && <Text style={s.muted}>No departments available</Text>}
            <View style={s.chips}>{departmentNames.map((name) => <Text key={name} style={s.chip}>{name}</Text>)}</View>
          </View>
        )}

        {activeTab === 'Facilities' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Facilities</Text>
            {facilities.length === 0 && <Text style={s.muted}>No facilities available</Text>}
            <View style={s.chips}>{facilities.map((name) => <Text key={name} style={s.chip}>{name}</Text>)}</View>
          </View>
        )}

        {activeTab === 'Reviews' && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Reviews</Text>
            <Text style={s.muted}>{clinic.stats.rating !== 'N/A' ? `Average rating: ${clinic.stats.rating}` : 'No reviews available'}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 12, paddingBottom: 32 },
  error: { fontSize: 13, color: colors.red, marginBottom: 10 },
  hero: { height: 210, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end' },
  heroImage: { borderRadius: 14 },
  heroOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8, 47, 45, 0.55)' },
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
  tabs: { gap: 6, paddingVertical: 12 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: '#C8D1DF', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#0D9488', borderColor: '#0D9488' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#344054' },
  tabTextActive: { color: '#FFF' },
  state: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { width: '31.5%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 10, padding: 10 },
  statIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#17243A', marginTop: 6 },
  statLabel: { fontSize: 11.5, color: '#667085' },
  panel: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8DFE9', borderRadius: 12, padding: 14, marginBottom: 12 },
  panelTitle: { ...typography.subtitle, fontSize: 16, color: '#17243A', marginBottom: 6 },
  subTitle: { fontSize: 14, fontWeight: '700', color: '#0D9488', marginTop: 12, marginBottom: 4 },
  body: { fontSize: 13.5, lineHeight: 19, color: '#475467' },
  muted: { fontSize: 12.5, color: '#667085' },
  strong: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  link: { fontSize: 13.5, fontWeight: '600', color: '#0D9488' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { fontSize: 12.5, color: '#0D9488', backgroundColor: '#E6FBF8', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEF1F5' },
  doctorImage: { width: 48, height: 48, borderRadius: 24 },
  doctorInitials: { backgroundColor: '#DFFCFF', alignItems: 'center', justifyContent: 'center' },
  doctorInitialText: { fontSize: 18, fontWeight: '700', color: '#0D9488' },
});
