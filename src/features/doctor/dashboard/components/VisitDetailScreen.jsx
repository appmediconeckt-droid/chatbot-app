// Visit details — port of the web Patient Details "Visit Details" view
// (PatientAppointmentDetails/PatientDetailsPage.jsx): patient banner, Visit
// Information, the full prescription (which carries the diagnosis)
// (each medicine with dose, timing and duration), advice, recommended tests,
// doctor's notes, follow-up, and Download Prescription (the shared paper PDF).
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { downloadConsultationPrescriptionPdf } from '../utils/consultationPrescriptionPdf';
import { formatAppointment } from '../api/doctorAppointments';
import useDoctorPrescriptionDocument from '../useDoctorPrescriptionDocument';
import ConsultationPrescriptionDocument from '../../../../screens/user/Component/UserDashboard/Tab/Prescription/ConsultationPrescriptionDocument';

const isSet = (value) => {
  const v = value === undefined || value === null ? '' : String(value).trim();
  return Boolean(v) && v !== 'N/A';
};

// A phone like "+91 98765 43210" never wraps between the country code and the
// number: spaces become non-breaking spaces, hyphens non-breaking hyphens.
const unbreakable = (value) => (isSet(value) ? String(value).trim().replace(/\s+/g, ' ').replace(/-/g, '‑') : null);

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())
  .trim();

const MODE_LABELS = { 'in-clinic': 'In-Clinic', clinic: 'In-Clinic', video: 'Video Call', audio: 'Video Call', voice: 'Video Call', phone: 'Video Call', chat: 'Chat' };
const SOURCE_LABELS = { qr: 'QR Walk-in', walkin: 'Walk-in', 'walk-in': 'Walk-in', online: 'Online Booking' };
const STATUS_TONES = {
  completed: { fg: '#047857', bg: '#D1FAE5' },
  cancelled: { fg: '#B42318', bg: '#FEE4E2' },
  booked: { fg: '#0369A1', bg: '#E0F2FE' },
  confirmed: { fg: '#0369A1', bg: '#E0F2FE' },
};

export default function VisitDetailScreen({ patient, record, onBack }) {
  const [downloading, setDownloading] = useState(false);
  const appointment = useMemo(() => formatAppointment(record.__raw || { ...record, patient }), [record, patient]);
  const { data: prescription, error, retry } = useDoctorPrescriptionDocument(appointment);

  // Until the consultation is completed there are no medicines and no signature
  // yet, so a download would only produce an empty prescription.
  const status = String(record.status || '').toLowerCase();
  const canDownload = !status || status === 'completed' || status === 'complete';

  const download = async () => {
    if (!prescription || downloading || !canDownload) return;
    setDownloading(true);
    try {
      await downloadConsultationPrescriptionPdf(prescription);
    } finally {
      setDownloading(false);
    }
  };

  const normalizedStatus = String(record.status || '').toLowerCase() === 'complete' ? 'completed' : String(record.status || '').toLowerCase();
  const statusTone = STATUS_TONES[normalizedStatus] || { fg: '#475467', bg: '#F2F4F7' };
  const visitTiles = [
    { icon: 'calendar', label: 'Date', value: record.date },
    { icon: 'clock', label: 'Time', value: record.time },
    isSet(record.consultationMode) && {
      icon: /video|audio|voice|phone/i.test(record.consultationMode) ? 'video' : 'pin',
      label: 'Mode',
      value: MODE_LABELS[record.consultationMode.toLowerCase()] || titleCase(record.consultationMode),
    },
    isSet(record.bookingSource) && {
      icon: /qr|walk/i.test(record.bookingSource) ? 'walk' : 'smartphone',
      label: 'Booked via',
      value: SOURCE_LABELS[record.bookingSource] || titleCase(record.bookingSource),
    },
  ].filter((tile) => tile && isSet(tile.value));
  const patientMeta = [
    isSet(patient.age) ? `${patient.age} yrs` : null,
    isSet(patient.gender) ? titleCase(patient.gender) : null,
    isSet(patient.bloodGroup) && !/not recorded/i.test(patient.bloodGroup) ? patient.bloodGroup : null,
  ].filter(Boolean).join('  •  ');

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Visit Details</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Patient hero: who, the token, and phone + status as chips (the
            phone gets its own chip so it is never cut off). */}
        <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={[s.heroBubble, s.heroBubbleLarge]} />
          <View style={[s.heroBubble, s.heroBubbleSmall]} />
          <View style={s.heroRow}>
            <View style={s.heroAvatar}>
              <Text translate={false} style={s.heroAvatarText}>{String(patient.name || 'P').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.flex}>
              <Text translate={false} style={s.heroName} numberOfLines={2}>{patient.name}</Text>
              {!!patientMeta && <Text translate={false} style={s.heroMeta}>{patientMeta}</Text>}
            </View>
            {isSet(record.tokenNumber) && (
              <View style={[s.heroToken, record.isEmergency && s.heroTokenDanger]}>
                <Text style={s.heroTokenLabel}>TOKEN</Text>
                <Text translate={false} style={s.heroTokenValue}>#{record.tokenNumber}</Text>
              </View>
            )}
          </View>
          {(isSet(patient.phone) || isSet(record.status)) && (
            <View style={s.heroChips}>
              {isSet(patient.phone) && (
                <View style={s.heroChip}>
                  <AppIcon name="phone" size={13} color="#FFFFFF" strokeWidth={2.2} />
                  <Text translate={false} selectable style={s.heroChipText}>{unbreakable(patient.phone)}</Text>
                </View>
              )}
              {isSet(record.status) && (
                <View style={[s.statusChip, { backgroundColor: statusTone.bg }]}>
                  <View style={[s.statusDot, { backgroundColor: statusTone.fg }]} />
                  <Text style={[s.statusChipText, { color: statusTone.fg }]}>{titleCase(normalizedStatus)}</Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>

        {record.isEmergency && (
          <View style={s.emergency}>
            <AppIcon name="warning" size={18} color="#DC2626" />
            <View style={s.flex}>
              <Text style={s.emergencyTitle}>Emergency Visit</Text>
              {isSet(record.emergencyReason) && <Text translate={false} style={s.emergencyText}>{record.emergencyReason}</Text>}
            </View>
          </View>
        )}

        {visitTiles.length > 0 && (
          <Card title="Visit Information" icon="calendar">
            {/* No "Consulting Doctor" row: the doctor reading this is that doctor. */}
            <View style={s.infoGrid}>
              {visitTiles.map((tile) => (
                <View key={tile.label} style={s.infoTile}>
                  <View style={s.infoTileIcon}><AppIcon name={tile.icon} size={15} color="#0D9488" strokeWidth={2.1} /></View>
                  <View style={s.flex}>
                    <Text style={s.infoTileLabel}>{tile.label}</Text>
                    <Text translate={false} style={s.infoTileValue} numberOfLines={2}>{tile.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* No vitals here: the patient's page shows the latest recorded ones. */}

        {/* No complaint or diagnosis card here: the prescription below already
            carries the diagnosis. */}

        <View style={s.rxHead}>
          <View style={s.cardIcon}><AppIcon name="file" size={14} color="#0D9488" /></View>
          <View style={s.flex}>
            <Text style={s.cardTitle}>Prescription</Text>
            <Text style={s.rxSub}>Medicines, tests and follow-up for this visit</Text>
          </View>
        </View>
        {error ? (
          <View style={s.rxState}>
            <AppIcon name="warning" size={20} color="#B42318" />
            <Text accessibilityRole="alert" style={s.rxStateText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={s.retryBtn} hitSlop={6}>
              <AppIcon name="refresh" size={14} color="#0D9488" />
              <Text style={s.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : prescription ? (
          <ConsultationPrescriptionDocument data={prescription} bleed={14} />
        ) : (
          <View style={s.rxState}>
            <ActivityIndicator color="#0D9488" />
            <Text style={s.rxStateText}>Loading prescription...</Text>
          </View>
        )}
      </ScrollView>
      <View style={s.footer}>
        <Pressable onPress={download} disabled={downloading || !prescription || !canDownload} style={[s.downloadWrap, (!prescription || !canDownload) && s.disabled]}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
            {downloading ? <ActivityIndicator color="#FFF" /> : <AppIcon name={canDownload ? 'download' : 'clock'} size={16} color="#FFF" />}
            <Text style={s.downloadText}>
              {downloading ? 'Downloading...' : canDownload ? 'Download Prescription' : 'Available after consultation'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Card({ title, icon, count, children }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardIcon}><AppIcon name={icon} size={14} color="#0D9488" /></View>
        <Text style={s.cardTitle}>{title}</Text>
        {count > 0 && <Text translate={false} style={s.cardCount}>{count}</Text>}
      </View>
      {children}
    </View>
  );
}

const s = createDoctorStyles({
  retry: { color: '#0D9488', fontWeight: '800', fontSize: 13.5 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E6FBF8', marginTop: 4 },
  rxHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10, paddingHorizontal: 2 },
  rxSub: { fontSize: 12, color: '#667085', marginTop: 1 },
  rxState: { alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E3EEEC', borderRadius: 16, paddingVertical: 28, paddingHorizontal: 16 },
  rxStateText: { fontSize: 13.5, lineHeight: 19, color: '#475467', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  screen: { flex: 1, backgroundColor: '#F4F8F7' },
  flex: { flex: 1 },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7E7E4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  content: { padding: 14, paddingBottom: 20 },
  hero: { borderRadius: 20, padding: 16, overflow: 'hidden' },
  heroBubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroBubbleLarge: { width: 150, height: 150, top: -60, right: -40 },
  heroBubbleSmall: { width: 80, height: 80, bottom: -36, left: 90 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { fontSize: 22, fontWeight: '900', color: '#0F766E' },
  heroName: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
  heroMeta: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  heroToken: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  heroTokenDanger: { backgroundColor: 'rgba(220,38,38,0.55)' },
  heroTokenLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.85)' },
  heroTokenValue: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroChip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroChipText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: 12.5, fontWeight: '800' },
  emergency: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 12, marginTop: 12 },
  emergencyTitle: { fontSize: 14, fontWeight: '800', color: '#B42318' },
  emergencyText: { fontSize: 13, lineHeight: 18, color: '#7A271A', marginTop: 2 },
  card: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#E3EEEC',
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#17243A' },
  cardCount: { fontSize: 12, fontWeight: '800', color: '#FFF', backgroundColor: '#0D9488', minWidth: 22, textAlign: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  infoTile: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 14, backgroundColor: '#F6FBFA', borderWidth: 1, borderColor: '#E1F1EE' },
  infoTileIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  infoTileLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, color: '#667085', textTransform: 'uppercase' },
  infoTileValue: { fontSize: 13.5, fontWeight: '800', color: '#17243A', marginTop: 2 },
  med: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F8FFFE', borderWidth: 1, borderColor: '#CCFBF1', borderRadius: 12, padding: 11 },
  medSpaced: { marginTop: 8 },
  medIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  medIndexText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  medName: { fontSize: 14.5, fontWeight: '800', color: '#17243A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  followUp: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12 },
  followUpLabel: { fontSize: 12, color: '#92400E' },
  followUpDate: { fontSize: 15, fontWeight: '800', color: '#B45309', marginTop: 1 },
  footer: { padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D7E7E4' },
  downloadWrap: {},
  download: { height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
