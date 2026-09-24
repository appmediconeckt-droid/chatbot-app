// Ported from MediconecktApp's DoctorProfileQrScreen. Same data as the web
// AppointmentQR/AllQRcode.jsx:
//   GET /api/auth/doctor-qr/:doctorId        (doctor card)
//   GET /api/auth/doctor-qr/:doctorId/stats  (todayScans, thisWeekScans, qrAppointments, profileViews)
// The QR encodes the public walk-in booking link, rendered by api.qrserver.com
// exactly like the web page.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance from '../../../../axiosConfig';
import { PUBLIC_WEB_APP_URL } from '../../../../config';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';

const createQrImageUrl = (targetUrl) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetUrl)}`;

const formatUpdated = (date) =>
  date
    ? `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '—';

export default function DoctorProfileQrScreen({ onBack }) {
  const { showToast } = useToast();
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
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'QR details could not be loaded');
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { getDoctorQR(); }, [getDoctorQR]);

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
  const qrImageUrl = appointmentUrl ? createQrImageUrl(appointmentUrl) : '';

  const shareQr = () => {
    if (!appointmentUrl) return;
    Share.share({
      title: `${doctorName} QR Code`,
      message: `Scan this QR to view profile or book appointment.\n${appointmentUrl}`,
      url: appointmentUrl,
    }).catch(() => {});
  };

  // No clipboard module in this app — the share sheet offers "Copy".
  const copyLink = () => {
    if (!appointmentUrl) return;
    Share.share({ message: appointmentUrl }).catch(() => {});
  };

  const downloadQr = async () => {
    if (!qrImageUrl) return;
    const safeName = String(doctorName).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    const toFile = `${dir}/${safeName || 'doctor'}-appointment-qr.png`;
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
        <Text style={s.title}>DR. Profile QR Code</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Share your professional profile instantly with{`\n`}patients using a secure QR Code.</Text>
        {isLoading && (
          <View style={s.stateBox}><ActivityIndicator color="#0D9488" /><Text style={s.stateText}>QR Loading...</Text></View>
        )}
        {!!error && !isLoading && (
          <View style={s.stateBox}>
            <Text style={s.errorText}>{error}</Text>
            <Outline text="↻  Retry" onPress={getDoctorQR} />
          </View>
        )}
        {!isLoading && !error && !!appointmentUrl && (
          <>
            <View style={s.qrCard}>
              <Text style={s.qrTitle}>Your Doctor QR Code</Text>
              <View style={s.qrBox}>
                <Image source={{ uri: qrImageUrl }} style={s.qrImage} resizeMode="contain" />
              </View>
              <View style={s.doctorPill}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={s.avatar} />
                ) : (
                  <View style={s.avatar}><Text style={s.avatarInitial}>{String(doctorName).replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}</Text></View>
                )}
                <View>
                  <Text style={s.doctorName}>{doctorName}</Text>
                  {!!speciality && <Text style={s.speciality}>{speciality}</Text>}
                </View>
                <View style={s.verified}><Text style={s.check}>✓</Text></View>
              </View>
            </View>
            <Text style={s.scanTitle}>SCAN THIS QR CODE TO:</Text>
            <View style={s.scanGrid}>
              <Action icon="user" text="View Profile" />
              <Action icon="calendar" text="Book Appt." />
              <Action icon="message" text="Start Chat" />
              <Action icon="phone" text="Contact Clinic" />
            </View>
            <View style={s.card}>
              <Text style={s.section}>QR MANAGEMENT</Text>
              <Pressable style={s.downloadWrap} onPress={downloadQr}>
                <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
                  <Text style={s.downloadText}>⇩ Download QR</Text>
                </LinearGradient>
              </Pressable>
              <View style={s.two}>
                <Outline text="⌁  Share" onPress={shareQr} />
                <Outline text="▣  Print" onPress={() => Linking.openURL(qrImageUrl).catch(() => {})} />
              </View>
              <View style={s.two}>
                <Outline text="🔗  Copy Link" onPress={copyLink} />
                <Outline text="↻  Refresh" onPress={getDoctorQR} />
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.section}>QUICK STATS</Text>
              <View style={s.statRow}>
                <Stat label="Today's Scans" value={String(quickStats.todayScans ?? 0)} />
                <Stat label="This Week" value={String(quickStats.thisWeekScans ?? 0)} />
              </View>
              <View style={s.statRow}>
                <Stat label="Appointments" value={String(quickStats.qrAppointments ?? 0)} />
                <Stat label="Profile Views" value={String(quickStats.profileViews ?? 0)} arrow="→" />
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
    </View>
  );
}

function Action({ icon, text }) {
  return <View style={s.action}><AppIcon name={icon} size={15} color="#526078" /><Text style={s.actionText}>{text}</Text></View>;
}
function Outline({ text, onPress }) {
  return <Pressable onPress={onPress} style={s.outline}><Text style={s.outlineText}>{text}</Text></Pressable>;
}
function Stat({ label, value, arrow = '↗' }) {
  return (
    <View style={s.stat}>
      <View style={s.statTop}><Text style={s.statLabel}>{label}</Text><Text style={s.statArrow}>{arrow}</Text></View>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
function Detail({ label, value, badge, last, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.detail, last && s.detailLast]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, badge && s.badge]}>{value}</Text>
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
  qrTitle: { fontSize: 17, fontWeight: '700', color: '#17243A', marginBottom: 20 },
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
  scanTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3, color: '#344054', marginTop: 22, marginBottom: 10 },
  scanGrid: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: '#DDE3EB', paddingBottom: 15 },
  action: { width: '50%', height: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 8 },
  actionText: { fontSize: 14, color: '#526078' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 11, padding: 15, marginTop: 16, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  section: { fontSize: 14, fontWeight: '700', letterSpacing: 0.7, color: '#344054', marginBottom: 13 },
  downloadWrap: { borderRadius: 8, shadowColor: '#2DD4BF', shadowOpacity: 0.18, shadowRadius: 4, elevation: 2 },
  download: { height: 49, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  downloadText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  two: { flexDirection: 'row', gap: 10, marginTop: 10 },
  outline: { flex: 1, height: 46, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  outlineText: { fontSize: 14, fontWeight: '500', color: '#344054' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, height: 90, borderWidth: 1, borderColor: '#D3DAE5', borderRadius: 9, backgroundColor: '#F8FAFD', padding: 12 },
  statTop: { flexDirection: 'row' },
  statLabel: { fontSize: 13, color: '#667085' },
  statArrow: { marginLeft: 'auto', fontSize: 17, color: '#16A36A' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#17243A', marginTop: 12 },
  detail: { height: 52, borderBottomWidth: 1, borderBottomColor: '#E3E7EE', flexDirection: 'row', alignItems: 'center' },
  detailLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 14, color: '#667085' },
  detailValue: { marginLeft: 'auto', fontSize: 14, fontWeight: '500', color: '#344054' },
  badge: { backgroundColor: '#D9FAE8', color: '#139A5B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
});
