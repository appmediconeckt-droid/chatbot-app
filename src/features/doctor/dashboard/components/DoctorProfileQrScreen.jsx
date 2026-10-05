s// Ported from MediconecktApp's DoctorProfileQrScreen. Same data as the web
// AppointmentQR/AllQRcode.jsx:
//   GET /api/auth/doctor-qr/:doctorId        (doctor card)
//   GET /api/auth/doctor-qr/:doctorId/stats  (todayScans, thisWeekScans, qrAppointments, profileViews)
// The QR encodes the doctor's public profile link (/doctor/:doctorId, the
// server's DOCTOR_PROFILE profileQrUrl), rendered by api.qrserver.com. The
// walk-in booking link is still offered under "Book Appt.".
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance from '../../../../axiosConfig';
import { PUBLIC_WEB_APP_URL } from '../../../../config';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import { loadDoctorClinics } from '../api/doctorClinics';
import ClinicLedDisplayCard from './ClinicLedDisplayCard';
const createQrImageUrl = (targetUrl) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetUrl)}`;

const formatUpdated = (date) =>
  date
    ? `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '—';

// mode 'profile' (Profile / Settings → Open Card): the doctor's profile QR.
// mode 'booking' (sidebar → QR Code): a Book Appointment QR per clinic — the
// doctor picks one of their clinics (same GET /api/clinics list as Clinic
// Settings) and the QR books a walk-in at that clinic.
export default function DoctorProfileQrScreen({ onBack, mode = 'profile' }) {
  const isBooking = mode === 'booking';
  const { showToast } = useToast();
  const [clinics, setClinics] = useState([]);
  const [clinicsLoading, setClinicsLoading] = useState(isBooking);
  const [selectedClinicId, setSelectedClinicId] = useState(null);
  const [clinicMenuOpen, setClinicMenuOpen] = useState(false);
  const [clinicWalkinUrls, setClinicWalkinUrls] = useState({});
  // clinicId -> { doctorClinicId, room } for the LED display (web parity).
  const [clinicLedInfo, setClinicLedInfo] = useState({});
  const [ledLoading, setLedLoading] = useState(true);
  const [doctorId, setDoctorId] = useState(null);
  const [storedUser, setStoredUser] = useState({});
  const [doctorData, setDoctorData] = useState(null);
  const [quickStats, setQuickStats] = useState({ todayScans: 0, thisWeekScans: 0, qrAppointments: 0, profileViews: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      setStoredUser(user || {});
      const id = pickFirst(user?.doctor_id, user?.doctorId, user?.user?.id, user?.id, user?._id, user?.user_id);
      if (id) setDoctorId(String(id));
      else {
        setError('Doctor ID not found. Please login again.');
        setIsLoading(false);
      }
    });
  }, []);

  const getDoctorQR = useCallback(async () => {
    if (!doctorId) return;
    try {
      setIsLoading(true);
      setError('');
      const [doctorQrRes, statsRes] = await Promise.all([
        axiosInstance.get(`/api/auth/doctor-qr/${doctorId}`),
        axiosInstance.get(`/api/auth/doctor-qr/${doctorId}/stats`),
      ]);
      setDoctorData(doctorQrRes.data?.data || doctorQrRes.data || null);
      setQuickStats(statsRes.data?.data || statsRes.data || {});
      // The server's own clinic walk-in QR links (…/walkin/<doctorClinicId>),
      // the same ones the web dashboard prints. Optional: older servers lack it.
      setLedLoading(true);
      axiosInstance.get(`/api/qr/doctors/${doctorId}/profile`)
        .then(({ data }) => {
          const map = {};
          const led = {};
          (data?.data?.clinics || []).forEach((c) => {
            const id = c?.clinicId || c?.clinic?.id;
            if (id && c?.walkinQrUrl) map[String(id)] = c.walkinQrUrl;
            if (id && c?.doctorClinicId) led[String(id)] = { doctorClinicId: c.doctorClinicId, room: c?.clinic?.room || '' };
          });
          setClinicWalkinUrls(map);
          setClinicLedInfo(led);
        })
        .catch(() => { setClinicWalkinUrls({}); setClinicLedInfo({}); })
        .finally(() => setLedLoading(false));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'QR details could not be loaded');
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { getDoctorQR(); }, [getDoctorQR]);

  const loadClinics = useCallback(async () => {
    if (!isBooking || !doctorId) return;
    try {
      setClinicsLoading(true);
      const list = await loadDoctorClinics(doctorId);
      setClinics(list);
      setSelectedClinicId((prev) => (list.some((c) => c.id === prev) ? prev : list[0]?.id ?? null));
    } catch (err) {
      console.warn('Failed to load clinics for QR:', err?.message);
      setClinics([]);
    } finally {
      setClinicsLoading(false);
    }
  }, [isBooking, doctorId]);

  useEffect(() => { loadClinics(); }, [loadClinics]);

  // Refresh: reload the QR details + stats and, for the booking QR, the clinic
  // list too (a clinic just added in Clinic Settings shows up).
  const refreshAll = () => {
    getDoctorQR();
    loadClinics();
  };
  const selectedClinic = clinics.find((c) => c.id === selectedClinicId) || null;
  // normalizeClinic fills a missing address with this placeholder.
  const clinicAddress = (clinic) => (clinic?.location && clinic.location !== 'Address not available' ? clinic.location : '');
  const selectedClinicAddress = clinicAddress(selectedClinic);

  const doctorRecord = doctorData?.doctor || doctorData?.user || doctorData || {};
  const doctorName = pickFirst(
    doctorRecord.full_name, doctorRecord.fullName, doctorRecord.name,
    storedUser.full_name, storedUser.fullName, storedUser.name, 'Doctor',
  );
  const specialityRaw = pickFirst(doctorRecord.speciality, doctorRecord.specialization, 'Doctor');
  const speciality = Array.isArray(specialityRaw) ? specialityRaw.join(' · ') : specialityRaw;
  const profileImage = pickFirst(doctorData?.profile_image, doctorData?.profileImage, doctorRecord.profilePhoto?.url);
  const appointmentUrl = doctorId
    ? `${PUBLIC_WEB_APP_URL.replace(/\/+$/, '')}/walk-in-appointment?doctorId=${encodeURIComponent(doctorId)}&source=qr`
    : '';
  // The doctor's public profile page (web /doctor/:doctorId) — the server's
  // own DOCTOR_PROFILE QR link when it sends one. This is what the QR encodes,
  // so scanning it opens the doctor's profile (booking is offered from there).
  const profileUrl = pickFirst(
    doctorData?.profileQrUrl,
    doctorId ? `${PUBLIC_WEB_APP_URL.replace(/\/+$/, '')}/doctor/${encodeURIComponent(doctorId)}` : '',
  ) || '';
  // Clinic-wise booking link: the walk-in link plus the chosen clinic.
  // Clinic-wise booking link: the server's walk-in link for this clinic when it
  // has one (what the web prints; the web sends the old ?doctorId= link to the
  // profile page instead of booking), else the old walk-in link + clinic.
  const clinicBookingUrl = selectedClinic
    ? clinicWalkinUrls[String(selectedClinic.id)]
      || (appointmentUrl ? `${appointmentUrl}&clinicId=${encodeURIComponent(selectedClinic.id)}` : '')
    : '';
  const qrTarget = isBooking ? clinicBookingUrl : profileUrl;
  const qrImageUrl = qrTarget ? createQrImageUrl(qrTarget) : '';

  // "Scan this QR code to" options: the doctor can open each one to see
  // what the patient gets.
  const openLink = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => showToast('Could not open link'));
  };

  const shareQr = () => {
    if (!qrTarget) return;
    Share.share({
      title: `${doctorName} QR Code`,
      message: isBooking
        ? `Book an appointment with ${doctorName} at ${selectedClinic?.name || 'the clinic'}:\n${qrTarget}`
        : `View my profile and book an appointment:\n${qrTarget}`,
      url: qrTarget,
    }).catch(() => {});
  };

  // No clipboard module in this app — the share sheet offers "Copy".
  const copyLink = () => {
    if (!qrTarget) return;
    Share.share({ message: qrTarget }).catch(() => {});
  };

  const downloadQr = async () => {
    if (!qrImageUrl) return;
    const slug = (value) => String(value || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    const safeName = slug(doctorName);
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    const toFile = isBooking
      ? `${dir}/${safeName || 'doctor'}-${slug(selectedClinic?.name) || 'clinic'}-booking-qr.png`
      : `${dir}/${safeName || 'doctor'}-profile-qr.png`;
    try {
      const result = await RNFS.downloadFile({ fromUrl: qrImageUrl, toFile }).promise;
      if (result.statusCode && result.statusCode >= 400) throw new Error(`HTTP ${result.statusCode}`);
      showToast(Platform.OS === 'android' ? 'QR saved to Downloads' : 'QR saved');
    } catch (err) {
      console.warn('QR download error:', err?.message);
      Linking.openURL(`${qrImageUrl}&download=1`).catch(() => showToast('Could not download QR'));
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>{isBooking ? 'Book Appointment QR' : 'DR. Profile QR Code'}</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!isBooking && (
          <Text style={s.intro}>Share your professional profile instantly with{`\n`}patients using a secure QR Code.</Text>
        )}
        {isBooking && !isLoading && !error && (
          clinicsLoading ? (
            <View style={s.stateBox}><ActivityIndicator color="#0D9488" /><Text style={s.stateText}>Loading clinics...</Text></View>
          ) : clinics.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}><AppIcon name="pin" size={26} color="#0D9488" /></View>
              <Text style={s.emptyTitle}>No clinic added yet</Text>
              <Text style={s.emptyText}>Add a clinic in Clinic Settings to create its Book Appointment QR.</Text>
              <Outline text="↻  Retry" onPress={loadClinics} />
            </View>
          ) : (
            <View style={s.selectWrap}>
              <Text style={s.selectLabel}>Select Clinic</Text>
              <Pressable
                onPress={() => setClinicMenuOpen(true)}
                style={({ pressed }) => [s.select, (pressed || clinicMenuOpen) && s.selectActive]}
                accessibilityRole="button"
                accessibilityLabel={`Clinic: ${selectedClinic?.name || 'none selected'}. Tap to change`}
              >
                <View style={s.selectIcon}><AppIcon name="pin" size={18} color="#0D9488" /></View>
                <View style={s.selectTextWrap}>
                  <Text translate={false} style={s.selectValue} numberOfLines={1}>{selectedClinic?.name || 'Select clinic'}</Text>
                  {!!selectedClinicAddress && <Text style={s.selectSub} numberOfLines={1}>{selectedClinicAddress}</Text>}
                </View>
                <View style={s.selectChevron}><AppIcon name="chevron-down" size={18} color="#0D9488" strokeWidth={2.2} /></View>
              </Pressable>
            </View>
          )
        )}
        {isLoading && (
          <View style={s.stateBox}><ActivityIndicator color="#0D9488" /><Text style={s.stateText}>QR Loading...</Text></View>
        )}
        {!!error && !isLoading && (
          <View style={s.stateBox}>
            <Text style={s.errorText}>{error}</Text>
            <Outline text="↻  Retry" onPress={getDoctorQR} />
          </View>
        )}
        {!isLoading && !error && !!qrTarget && (
          <>
            {isBooking ? (
              <View style={s.bookCard}>
                <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bookHead}>
                  <View style={s.bookDecoLg} />
                  <View style={s.bookDecoSm} />
                  <View style={s.bookBadge}>
                    <AppIcon name="calendar" size={13} color="#FFF" />
                    <Text style={s.bookBadgeText}>BOOK APPOINTMENT</Text>
                  </View>
                  <Text translate={false} style={s.bookClinic} numberOfLines={2}>{selectedClinic?.name}</Text>
                  {!!selectedClinicAddress && (
                    <View style={s.bookAddrRow}>
                      <AppIcon name="pin" size={12} color="rgba(255,255,255,0.9)" />
                      <Text style={s.bookAddr} numberOfLines={2}>{selectedClinicAddress}</Text>
                    </View>
                  )}
                </LinearGradient>
                <View style={s.bookBody}>
                  <View style={s.qrFrame}>
                    <View style={[s.corner, s.cornerTL]} />
                    <View style={[s.corner, s.cornerTR]} />
                    <View style={[s.corner, s.cornerBL]} />
                    <View style={[s.corner, s.cornerBR]} />
                    <Image source={{ uri: qrImageUrl }} style={s.bookQrImage} resizeMode="contain" />
                  </View>
                  <View style={s.scanHintRow}>
                    <AppIcon name="smartphone" size={14} color="#0D9488" />
                    <Text style={s.scanHint}>Scan to book a walk-in at this clinic</Text>
                  </View>
                  <View style={[s.doctorPill, s.bookDoctorPill]}>
                    {profileImage ? (
                      <Image source={{ uri: profileImage }} style={s.avatar} />
                    ) : (
                      <View style={s.avatar}><Text translate={false} style={s.avatarInitial}>{String(doctorName).replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}</Text></View>
                    )}
                    <View>
                      <Text translate={false} style={s.doctorName}>{doctorName}</Text>
                      {!!speciality && <Text style={s.speciality}>{speciality}</Text>}
                    </View>
                    <View style={s.verified}><Text style={s.check}>✓</Text></View>
                  </View>
                </View>
              </View>
            ) : (
            <View style={s.qrCard}>
              <Text style={s.qrTitle} numberOfLines={2}>Your Doctor QR Code</Text>
              <View style={s.qrBox}>
                <Image source={{ uri: qrImageUrl }} style={s.qrImage} resizeMode="contain" />
              </View>
              <View style={s.doctorPill}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={s.avatar} />
                ) : (
                  <View style={s.avatar}><Text translate={false} style={s.avatarInitial}>{String(doctorName).replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}</Text></View>
                )}
                <View>
                  <Text translate={false} style={s.doctorName}>{doctorName}</Text>
                  {!!speciality && <Text style={s.speciality}>{speciality}</Text>}
                </View>
                <View style={s.verified}><Text style={s.check}>✓</Text></View>
              </View>
            </View>
            )}
            <Text style={s.scanTitle}>SCAN THIS QR CODE TO</Text>
            <View style={s.scanGrid}>
              <ScanOption
                icon="person-circle-outline"
                title="View Profile"
                subtitle="Public doctor profile"
                onPress={() => openLink(profileUrl)}
              />
              <ScanOption
                icon="calendar-outline"
                title="Book Appt."
                subtitle={isBooking ? 'Walk-in at this clinic' : 'Walk-in booking'}
                onPress={() => openLink(isBooking ? clinicBookingUrl : appointmentUrl)}
              />
            </View>
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={s.sectionIcon}><Ionicons name="qr-code-outline" size={16} color="#0D9488" /></View>
                <Text style={[s.section, s.sectionInline]}>QR MANAGEMENT</Text>
              </View>
              <Pressable onPress={downloadQr} style={({ pressed }) => [s.downloadWrap, pressed && s.pressedScale]}>
                <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
                  <View style={s.downloadIcon}><Ionicons name="download-outline" size={19} color="#FFF" /></View>
                  <Text style={s.downloadText}>Download QR</Text>
                </LinearGradient>
              </Pressable>
              <View style={s.toolGrid}>
                <ToolButton icon="share-social-outline" label="Share" onPress={shareQr} />
                <ToolButton icon="print-outline" label="Print" onPress={() => Linking.openURL(qrImageUrl).catch(() => showToast('Could not open QR for printing'))} />
                <ToolButton icon="link-outline" label="Copy Link" onPress={copyLink} />
                <ToolButton icon="refresh-outline" label="Refresh" onPress={refreshAll} />
              </View>
            </View>
            {isBooking && !!selectedClinic && (
              <ClinicLedDisplayCard
                doctorClinicId={clinicLedInfo[String(selectedClinic.id)]?.doctorClinicId}
                clinicName={selectedClinic.name}
                room={clinicLedInfo[String(selectedClinic.id)]?.room}
                loading={ledLoading}
                onRoomSaved={(roomNumber) => setClinicLedInfo((current) => ({
                  ...current,
                  [String(selectedClinic.id)]: { ...current[String(selectedClinic.id)], room: roomNumber },
                }))}
              />
            )}
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={s.sectionIcon}><Ionicons name="stats-chart-outline" size={15} color="#0D9488" /></View>
                <Text style={[s.section, s.sectionInline]}>QUICK STATS</Text>
              </View>
              <View style={s.statGrid}>
                <Stat icon="scan-outline" label="Today's Scans" value={quickStats.todayScans} />
                <Stat icon="calendar-outline" label="This Week" value={quickStats.thisWeekScans} />
                <Stat icon="checkmark-done-outline" label="QR Bookings" value={quickStats.qrAppointments} />
                <Stat icon="eye-outline" label="Profile Views" value={quickStats.profileViews} />
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.section}>QR DETAILS</Text>
              <Detail label="QR Status" value="Active" badge />
              <Detail label="Last Updated" value={formatUpdated(updatedAt)} />
              <Detail label="Visibility" value="Public" />
              <Detail label="Expires" value="Never" last />
            </View>
          </>
        )}
      </ScrollView>

      {/* Clinic dropdown: bottom sheet listing every clinic of the doctor. */}
      <Modal visible={clinicMenuOpen} transparent animationType="fade" onRequestClose={() => setClinicMenuOpen(false)}>
        <View style={s.sheetOverlay}>
          <Pressable style={s.sheetBackdrop} onPress={() => setClinicMenuOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetGrabber} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Clinic</Text>
              <Pressable onPress={() => setClinicMenuOpen(false)} hitSlop={10} style={s.sheetClose}>
                <AppIcon name="x" size={18} color="#475467" />
              </Pressable>
            </View>
            <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false}>
              {clinics.map((clinic) => {
                const active = clinic.id === selectedClinicId;
                const address = clinicAddress(clinic);
                return (
                  <Pressable
                    key={clinic.id}
                    onPress={() => { setSelectedClinicId(clinic.id); setClinicMenuOpen(false); }}
                    style={({ pressed }) => [s.option, active && s.optionActive, pressed && s.optionPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[s.optionIcon, active && s.optionIconActive]}>
                      <AppIcon name="pin" size={16} color={active ? '#FFF' : '#0D9488'} />
                    </View>
                    <View style={s.selectTextWrap}>
                      <Text translate={false} style={[s.optionName, active && s.optionNameActive]} numberOfLines={1}>{clinic.name}</Text>
                      {!!address && <Text style={s.optionAddr} numberOfLines={2}>{address}</Text>}
                    </View>
                    {active
                      ? <View style={s.optionCheck}><AppIcon name="check" size={13} color="#FFF" strokeWidth={2.6} /></View>
                      : <View style={s.optionRadio} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// One brand accent (teal) on neutral greys across the screen — the earlier
// per-tile colours looked busy rather than professional.
const BRAND = '#0D9488';
const BRAND_SOFT = '#ECF8F6';

// "Scan this QR code to" card: icon, title, one-line hint, arrow.
function ScanOption({ icon, title, subtitle, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [s.scanOption, pressed && s.pressedScale]}
    >
      <View style={s.scanOptionIcon}>
        <Ionicons name={icon} size={21} color={BRAND} />
      </View>
      <Text style={s.scanOptionTitle} numberOfLines={1}>{title}</Text>
      <Text style={s.scanOptionSub} numberOfLines={1}>{subtitle}</Text>
      <View style={s.scanOptionArrow}>
        <Ionicons name="chevron-forward" size={14} color="#98A2B3" />
      </View>
    </Pressable>
  );
}

// QR Management tool: icon tile with a label under it.
function ToolButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.tool, pressed && s.pressedScale]}
    >
      <View style={s.toolIcon}>
        <Ionicons name={icon} size={20} color={BRAND} />
      </View>
      <Text style={s.toolLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
function Outline({ text, onPress }) {
  return <Pressable onPress={onPress} style={s.outline}><Text style={s.outlineText}>{text}</Text></Pressable>;
}
// Quick stat tile: small icon + label on top, count below. (The old version
// drew a green "↗" on every tile, which read as growth even at 0.)
function Stat({ icon, label, value }) {
  const count = Number(value);
  return (
    <View style={s.stat}>
      <View style={s.statHead}>
        <Ionicons name={icon} size={15} color={BRAND} />
        <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text translate={false} style={s.statValue}>
        {Number.isFinite(count) ? count.toLocaleString() : '0'}
      </Text>
    </View>
  );
}
function Detail({ label, value, badge, last, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.detail, last && s.detailLast]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text translate={false} style={[s.detailValue, badge && s.badge]}>{value}</Text>
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 12, paddingBottom: 36 },
  intro: { fontSize: 14, lineHeight: 20, color: '#526078', marginHorizontal: 3, marginBottom: 16 },
  qrCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 12, alignItems: 'center', padding: 22, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  qrTitle: { fontSize: 17, fontWeight: '700', color: '#17243A', marginBottom: 20, textAlign: 'center' },
  // Clinic dropdown field
  selectWrap: { marginBottom: 14 },
  selectLabel: { fontSize: 13, fontWeight: '700', color: '#344054', marginBottom: 7, marginLeft: 2, letterSpacing: 0.2 },
  select: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#B8E6DF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#0D9488', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  selectActive: { borderColor: '#0D9488', backgroundColor: '#F6FFFD' },
  selectIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  selectTextWrap: { flex: 1, minWidth: 0 },
  selectValue: { fontSize: 15.5, fontWeight: '700', color: '#17243A' },
  selectSub: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  selectChevron: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  // No-clinic state
  emptyCard: { alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 16, paddingVertical: 26, paddingHorizontal: 20, marginBottom: 14 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#17243A' },
  emptyText: { fontSize: 13.5, lineHeight: 19, color: '#667085', textAlign: 'center', marginBottom: 6 },
  // Book Appointment QR card
  bookCard: { backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#CDEFEA', shadowColor: '#0F766E', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  bookHead: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, overflow: 'hidden' },
  bookDecoLg: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -45, top: -60, backgroundColor: 'rgba(255,255,255,0.12)' },
  bookDecoSm: { position: 'absolute', width: 70, height: 70, borderRadius: 35, right: 60, bottom: -40, backgroundColor: 'rgba(255,255,255,0.10)' },
  bookBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  bookBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.8 },
  bookClinic: { fontSize: 21, fontWeight: '800', color: '#FFF', marginTop: 10 },
  bookAddrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 5 },
  bookAddr: { flex: 1, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.92)' },
  bookBody: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 20 },
  qrFrame: { width: 220, height: 220, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 16 },
  bookQrImage: { width: 188, height: 188 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#0D9488' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  scanHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#E6F7F5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  scanHint: { fontSize: 12.5, fontWeight: '600', color: '#0F766E' },
  bookDoctorPill: { marginTop: 16 },
  // Clinic dropdown sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,33,63,0.35)' },
  sheetBackdrop: { flex: 1 },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 24, maxHeight: '70%' },
  sheetGrabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  sheetClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sheetList: { marginTop: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', marginBottom: 9, backgroundColor: '#FFF' },
  optionActive: { borderColor: '#0D9488', backgroundColor: '#F0FDFA' },
  optionPressed: { backgroundColor: '#F6FFFD' },
  optionIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  optionIconActive: { backgroundColor: '#0D9488' },
  optionName: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  optionNameActive: { color: '#0F766E' },
  optionAddr: { fontSize: 12.5, lineHeight: 17, color: '#667085', marginTop: 2 },
  optionCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  optionRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D0D5DD' },
  qrBox: { width: 198, height: 198, padding: 10, backgroundColor: '#EEF1F5', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qrImage: { width: 178, height: 178 },
  avatarInitial: { fontSize: 17, fontWeight: '700', color: '#0D9488' },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  stateText: { fontSize: 14, color: '#526078' },
  errorText: { fontSize: 14, color: '#D92D20', textAlign: 'center' },
  doctorPill: { height: 58, borderWidth: 1, borderColor: '#D4DBE5', borderRadius: 29, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, marginTop: 20, backgroundColor: '#FFF' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1E2D5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 21 },
  doctorName: { fontSize: 14, fontWeight: '700', color: '#17243A', marginLeft: 9 },
  speciality: { fontSize: 13, color: '#667085', marginLeft: 9, marginTop: 2 },
  verified: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#2DD4BF', alignItems: 'center', justifyContent: 'center', marginLeft: 9 },
  check: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  scanTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, color: '#667085', marginTop: 22, marginBottom: 10, marginLeft: 2 },
  // "Scan this QR code to" cards
  scanGrid: { flexDirection: 'row', gap: 10 },
  scanOption: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 14, padding: 13, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  scanOptionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  scanOptionTitle: { fontSize: 15, fontWeight: '800', color: '#17243A' },
  scanOptionSub: { fontSize: 12, color: '#667085', marginTop: 2, paddingRight: 24 },
  scanOptionArrow: { position: 'absolute', right: 10, top: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  pressedScale: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 11, padding: 15, marginTop: 16, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  section: { fontSize: 14, fontWeight: '700', letterSpacing: 0.7, color: '#344054', marginBottom: 13 },
  // QR Management
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  sectionInline: { marginBottom: 0 },
  downloadWrap: { borderRadius: 14, shadowColor: '#0D9488', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  download: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  downloadIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  downloadText: { fontSize: 15.5, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  toolGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  tool: { width: '23%', alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E7EC' },
  toolIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 12, fontWeight: '700', color: '#344054', marginTop: 7 },
  outline: { flex: 1, height: 46, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  outlineText: { fontSize: 14, fontWeight: '500', color: '#344054' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat: { width: '48.5%', borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 12, backgroundColor: '#FAFBFC', paddingHorizontal: 12, paddingVertical: 12 },
  statValue: { fontSize: 24, lineHeight: 28, fontWeight: '800', color: '#17243A', marginTop: 8 },
  statLabel: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#667085' },
  detail: { height: 52, borderBottomWidth: 1, borderBottomColor: '#E3E7EE', flexDirection: 'row', alignItems: 'center' },
  detailLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 14, color: '#667085' },
  detailValue: { marginLeft: 'auto', fontSize: 14, fontWeight: '500', color: '#344054' },
  badge: { backgroundColor: '#D9FAE8', color: '#139A5B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
});
