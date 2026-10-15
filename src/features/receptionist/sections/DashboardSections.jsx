// Sections fed by the shared /api/staff/receptionist/dashboard poll — the web
// ReceptionistPages.jsx: Overview, Live Queue, Doctor & Clinics, My Profile.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../components/TranslatedText';
import {
  AppointmentRow, Avatar, Badge, Card, CardHeading, DetailFields, Empty, Eyebrow, LiveLabel,
  LoadingCard, Notice, NoticeText, QueueTabs, REC, RecButton, StatTile,
} from '../receptionistUi';
import {
  clinicName, clockLabel, dedupeRows, displayTime, groupQueue, longDateToday, patientKey, profilePhotoOf, staffIdentity, staffShiftTiming,
} from '../receptionistUtils';

// Every booking the dashboard feed knows about, each once.
const allRows = (data) => dedupeRows([...(data?.currentPatients || []), ...(data?.waiting || []), ...(data?.appointments || [])]);

const EMPTY_TEXT = {
  pending: ['No patients waiting', 'New arrivals and bookings will appear in the queue here.'],
  'in-progress': ['No checkup in progress', 'The patient being examined will appear here when the doctor starts a checkup.'],
  next: ['Nobody moved to Next', 'Patients the doctor moves to Next will wait here.'],
  completed: ['No completed visits yet', "Today's finished checkups will appear here."],
  cancelled: ['No cancelled appointments', 'Cancelled and no-show bookings for today will appear here.'],
};

// Today's queue with the doctor's tabs (Pending / In Progress / Next /
// Completed / Cancelled), emergencies first and then by token.
function QueueCard({ data, clinics, onView, compact, title = "Today's Queue", subtitle, right }) {
  const groups = useMemo(() => groupQueue(allRows(data)), [data]);
  const counts = Object.fromEntries(Object.entries(groups).map(([name, rows]) => [name, rows.length]));
  const [tab, setTab] = useState('pending');
  const rows = groups[tab] || [];
  const [emptyTitle, emptyText] = EMPTY_TEXT[tab];
  return (
    <Card>
      <CardHeading title={title} subtitle={subtitle} right={right} />
      <QueueTabs active={tab} counts={counts} onChange={setTab} />
      {rows.length
        ? rows.map((row) => <AppointmentRow key={patientKey(row)} row={row} clinics={clinics} onView={onView} compact={compact} />)
        : <Empty title={emptyTitle} description={emptyText} />}
    </Card>
  );
}

function CurrentCheckups({ data, clinics, onView }) {
  const current = dedupeRows(data.currentPatients || []);
  if (!current.length) return null;
  return current.map((row) => (
    <View key={patientKey(row)} style={[s.current, row.emergency && s.currentEmergency]}>
      <View style={s.inline}>
        <View style={s.dot} />
        <Eyebrow>{row.queueStatus === 'called' ? 'PATIENT CALLED' : 'CHECKUP IN PROGRESS'}</Eyebrow>
        {row.emergency && <Badge emergency />}
      </View>
      <View style={s.currentMain}>
        <LinearGradient
          colors={row.emergency ? ['#F87171', '#DC2626'] : ['#12756D', '#1C9686']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.currentToken}
        >
          <Text translate={false} style={s.currentTokenText}>{row.token ?? '--'}</Text>
          <Text style={s.currentTokenLabel}>TOKEN</Text>
        </LinearGradient>
        <View style={s.flex}>
          <Text translate={false} style={s.currentName} numberOfLines={1}>{row.patientName}</Text>
          <Text translate={false} style={s.muted} numberOfLines={1}>{clinicName(clinics, row.clinicId)}</Text>
        </View>
      </View>
      <View style={s.currentFooter}>
        <View style={s.inline}>
          <Ionicons name="time-outline" size={15} color="#5B7F73" />
          <Text translate={false} style={s.footerText}>
            {row.timing?.startedAt ? `Started ${displayTime(row.timing.startedAt)}` : 'Awaiting checkup'}
            {row.timing?.state === 'paused' ? ' / Paused' : ''}
          </Text>
        </View>
        <Pressable onPress={() => onView(row)} style={s.textButton} hitSlop={6}>
          <Text style={s.textButtonText}>View details</Text>
          <Ionicons name="arrow-forward" size={14} color={REC.primary} />
        </Pressable>
      </View>
    </View>
  ));
}

export function OverviewSection({ profile, data, clinics, error, onView, onNavigate, compact }) {
  const groups = useMemo(() => groupQueue(allRows(data)), [data]);
  if (!data) return <LoadingCard error={error} />;
  const firstName = String(profile?.fullName || 'there').split(' ')[0];
  // Up next = the first waiting patient who isn't already with the doctor.
  const next = groups.pending[0];
  const waitingCount = groups.pending.length;
  return (
    <>
      <LinearGradient colors={['#12756D', '#1C9686']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.welcome}>
        <Text style={s.welcomeEyebrow}>{longDateToday().toUpperCase()}</Text>
        <Text translate={false} style={s.welcomeTitle}>Welcome, {firstName}</Text>
        <Pressable onPress={() => onNavigate('appointments')} style={({ pressed }) => [s.welcomeButton, pressed && s.welcomeButtonPressed]}>
          <Text style={s.welcomeButtonText}>View appointments</Text>
          <Ionicons name="arrow-forward" size={16} color={REC.primary} />
        </Pressable>
      </LinearGradient>

      <View style={s.stats}>
        <StatTile title="Appointments today" value={data.summary?.total} icon="calendar" tone="blue" />
        <StatTile title="Waiting patients" value={data.summary?.waiting ?? waitingCount} icon="time" tone="amber" />
        <StatTile title="Ongoing checkups" value={data.summary?.ongoing ?? groups['in-progress'].length} icon="medkit" tone="teal" />
        <StatTile title="Completed today" value={data.summary?.completed ?? groups.completed.length} icon="checkmark-circle" tone="green" />
      </View>

      {dedupeRows(data.currentPatients || []).length > 0 && (
        <Card>
          <CardHeading title="Currently with the doctor" right={<LiveLabel text="Today / Live" />} />
          <CurrentCheckups data={data} clinics={clinics} onView={onView} />
        </Card>
      )}

      <Card>
        <CardHeading title="Up next" right={<Ionicons name="list-outline" size={20} color={REC.muted} />} />
        {next ? (
          <Pressable onPress={() => onView(next)} style={[s.next, next.emergency && s.nextEmergency]}>
            <LinearGradient
              colors={next.emergency ? ['#F87171', '#DC2626'] : ['#12756D', '#1C9686']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.nextTokenTile}
            >
              <Text translate={false} style={s.nextToken}>#{next.token ?? '--'}</Text>
              <Text style={s.nextTokenLabel}>{next.emergency ? 'SOS' : 'TOKEN'}</Text>
            </LinearGradient>
            <View style={s.flex}>
              <Text translate={false} style={s.nextName} numberOfLines={1}>{next.patientName}</Text>
              <Text translate={false} style={s.muted} numberOfLines={1}>{clinicName(clinics, next.clinicId)} · {next.time ? clockLabel(next.time) : 'Not scheduled'}</Text>
              <View style={s.nextBadges}>
                {next.emergency && <Badge emergency />}
                <Badge value={next.queueStatus} />
              </View>
            </View>
          </Pressable>
        ) : <Empty title="Queue is clear" description="No patients are waiting right now." />}
        <View style={s.waitingLine}>
          <Ionicons name="people-outline" size={15} color={REC.muted} />
          <Text translate={false} style={s.muted}>{waitingCount} {waitingCount === 1 ? 'patient' : 'patients'} waiting</Text>
        </View>
        <RecButton full label="Open live queue" icon="arrow-forward" onPress={() => onNavigate('live-queue')} />
      </Card>

      <QueueCard
        data={data}
        clinics={clinics}
        onView={onView}
        compact={compact}
        right={(
          <Pressable onPress={() => onNavigate('appointments')} style={s.textButton} hitSlop={6}>
            <Text style={s.textButtonText}>All</Text>
            <Ionicons name="arrow-forward" size={14} color={REC.primary} />
          </Pressable>
        )}
      />
    </>
  );
}

export function LiveQueueSection({ data, clinics, clinic, error, onView, onNavigate, compact }) {
  if (!data) return <LoadingCard error={error} />;
  const timing = data.timing;
  return (
    <>
      <LinearGradient colors={['#12756D', '#1C9686']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.launch}>
        <View style={s.flex}>
          <Text style={s.launchTitle}>Show the queue on your LED</Text>
        </View>
        <Pressable onPress={() => onNavigate('led-display')} style={({ pressed }) => [s.welcomeButton, s.launchButton, pressed && s.welcomeButtonPressed]}>
          <Ionicons name="tv-outline" size={16} color={REC.primary} />
          <Text style={s.welcomeButtonText}>LED</Text>
        </Pressable>
      </LinearGradient>

      {dedupeRows(data.currentPatients || []).length > 0 && (
        <Card>
          <CardHeading title="With the doctor" right={<LiveLabel text="Live" />} />
          <CurrentCheckups data={data} clinics={clinics} onView={onView} />
        </Card>
      )}

      <Card>
        <CardHeading title="Wait estimate" />
        {timing ? (
          <Notice icon="time-outline">
            {!!timing.breakInfo?.headline && <NoticeText strong translate={false}>{timing.breakInfo.headline}</NoticeText>}
            <NoticeText translate={false}>
              Estimated wait: {timing.estimatedWaitLabel || (timing.estimatedWaitMinutes != null ? `${timing.estimatedWaitMinutes} min` : 'Updating estimate')}
              {timing.breakInfo?.expectedStart ? ` / Expected start: ${timing.breakInfo.expectedStart}` : ''}
            </NoticeText>
          </Notice>
        ) : (
          <Text style={s.muted}>No wait estimate right now.</Text>
        )}
      </Card>

      <QueueCard data={data} clinics={clinics} onView={onView} compact={compact} title="Patient queue" />
    </>
  );
}

export function DoctorSection({ data, clinics, error }) {
  if (!data) return <LoadingCard error={error} />;
  const doctor = data.doctor || {};
  return (
    <>
      <Card>
        <View style={s.doctorHeading}>
          <View style={s.doctorAvatar}><Ionicons name="medkit" size={32} color={REC.primary} /></View>
          <View style={s.flex}>
            <Eyebrow>ASSIGNED DOCTOR</Eyebrow>
            <Text translate={false} style={s.doctorName}>{doctor.fullName || 'Doctor'}</Text>
            <Text translate={false} style={s.muted}>
              {(Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : doctor.specialization) || 'Specialization not provided'}
            </Text>
          </View>
        </View>
        <View style={s.careTeam}><Badge value="confirmed" /><Text style={s.careTeamText}>Your care team</Text></View>
        <DetailFields fields={[
          ['Qualification', doctor.qualification],
          ['Experience', doctor.experience != null ? `${doctor.experience} years` : null],
          ['Email address', doctor.email],
          ['Phone number', doctor.phoneNumber],
          ['Location', doctor.location],
          ['Consultation modes', doctor.consultationMode],
          ['Languages', doctor.languages],
          ['Education', doctor.education],
        ]} />
        {!!(doctor.aboutMe || doctor.bio) && (
          <View style={s.about}>
            <Text style={s.aboutTitle}>About the doctor</Text>
            <Text translate={false} style={s.aboutText}>{doctor.aboutMe || doctor.bio}</Text>
          </View>
        )}
      </Card>

      <View style={s.sectionHeading}>
        <Text style={s.sectionTitle}>Clinics & hospitals</Text>
        <Text translate={false} style={s.countPill}>{clinics.length} locations</Text>
      </View>
      {clinics.length ? clinics.map((row) => (
        <Card key={row._id || row.id}>
          <View style={s.clinicTop}>
            <View style={s.clinicIcon}><Ionicons name="business-outline" size={22} color="#3975C7" /></View>
            <Text translate={false} style={s.clinicName}>{row.clinic_name}</Text>
          </View>
          <View style={s.clinicLine}>
            <Ionicons name="location-outline" size={16} color={REC.muted} />
            <Text translate={false} style={s.clinicText}>{row.location || 'Location not provided'}</Text>
          </View>
          <View style={s.clinicLine}>
            <Ionicons name="call-outline" size={16} color={REC.muted} />
            <Text translate={false} style={s.clinicText}>{row.phone_number || 'Phone not provided'}</Text>
          </View>
        </Card>
      )) : <Card><Empty icon="business-outline" title="No clinics assigned" description="Your doctor can add clinic details from their portal." /></Card>}
    </>
  );
}

export function ProfileSection({ profile }) {
  const details = [
    ['Assigned doctor', profile.assignedDoctorName, 'medkit-outline', '#12756D', '#E3F6F2'],
    ['Assigned clinic', profile.clinic_name, 'business-outline', '#3975C7', '#E8F1FF'],
    ['Department', profile.department, 'briefcase-outline', '#7C3AED', '#F1EAFE'],
    ['Staff ID', staffIdentity(profile), 'id-card-outline', '#D08A16', '#FFF4DF'],
    ['Shift', profile.shift, 'sunny-outline', '#0369A1', '#E0F2FE'],
    ['Shift timings', staffShiftTiming(profile), 'time-outline', '#3E8E41', '#E9F6E9'],
  ];
  return (
    <>
      <View style={s.profileCard}>
        <LinearGradient colors={['#12756D', '#1C9686']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.profileCover}>
          <Text style={s.profileCoverText}>STAFF ACCOUNT</Text>
        </LinearGradient>
        <View style={s.profileAvatarRing}>
          <Avatar photo={profilePhotoOf(profile)} name={profile.fullName} size={92} />
        </View>
        <Text translate={false} style={s.profileName}>{profile.fullName}</Text>
        <Text style={s.profileRole}>Receptionist · Front desk team</Text>
        <View style={s.profileChips}>
          <View style={s.activeChip}>
            <View style={s.activeDot} />
            <Text style={s.activeChipText}>Active account</Text>
          </View>
          {!!profile.shift && (
            <View style={s.shiftChip}>
              <Ionicons name="time-outline" size={13} color="#0369A1" />
              <Text translate={false} style={s.shiftChipText}>{profile.shift} shift</Text>
            </View>
          )}
        </View>
        <View style={s.contactBox}>
          <View style={s.contactRow}>
            <View style={s.contactIcon}><Ionicons name="mail-outline" size={17} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.contactLabel}>Email</Text>
              <Text translate={false} style={s.contactValue} numberOfLines={1}>{profile.email || 'Not provided'}</Text>
            </View>
          </View>
          <View style={[s.contactRow, s.contactRowLast]}>
            <View style={s.contactIcon}><Ionicons name="call-outline" size={17} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.contactLabel}>Phone</Text>
              <Text translate={false} style={s.contactValue} numberOfLines={1}>{profile.phoneNumber || profile.phone || 'Not provided'}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={s.sectionTitle}>Staff assignment</Text>
      <View style={s.detailTiles}>
        {details.map(([label, value, icon, fg, bg]) => (
          <View key={label} style={s.detailTile}>
            <View style={[s.detailTileIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={fg} /></View>
            <Text style={s.detailTileLabel}>{label}</Text>
            <Text translate={false} style={s.detailTileValue} numberOfLines={2}>{value || 'Not assigned'}</Text>
          </View>
        ))}
      </View>

      <Notice icon="shield-checkmark-outline">
        <NoticeText>Your doctor manages your role, clinic assignment and staff details. Contact them to update these details.</NoticeText>
      </Notice>
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { fontSize: 12.5, color: REC.muted, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: REC.green },
  welcome: { padding: 18, borderRadius: 18, marginBottom: 16 },
  welcomeEyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(255,255,255,0.85)' },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  welcomeText: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  welcomeButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFFFFF', marginTop: 16 },
  welcomeButtonPressed: { backgroundColor: '#E7F4EE' },
  welcomeButtonText: { fontSize: 13.5, fontWeight: '800', color: REC.primary },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  current: { borderWidth: 1, borderColor: '#CCE8DD', backgroundColor: '#F4FAF7', borderRadius: 14, padding: 14, marginBottom: 10 },
  currentEmergency: { borderColor: '#F4C9C9', backgroundColor: '#FFF7F7' },
  currentMain: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  currentToken: { width: 66, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  currentTokenText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  currentTokenLabel: { fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  currentName: { fontSize: 18, fontWeight: '700', color: REC.ink },
  currentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#DCEDE5' },
  footerText: { fontSize: 12.5, color: '#5B7F73' },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textButtonText: { fontSize: 13, fontWeight: '700', color: REC.primary },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#CCE8DD', backgroundColor: '#F4FAF7' },
  nextEmergency: { borderColor: '#F4C9C9', backgroundColor: '#FFF7F7' },
  nextTokenTile: { width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextToken: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  nextTokenLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  nextName: { fontSize: 16.5, fontWeight: '800', color: REC.ink },
  nextBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  waitingLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  launch: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, marginBottom: 16 },
  launchTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  launchText: { fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.88)', marginTop: 3 },
  launchButton: { marginTop: 0 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: REC.line },
  queuePosition: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F2F5F7', color: '#92A1AD', fontSize: 11, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' },
  waitingToken: { fontSize: 14, fontWeight: '700', color: '#55748B' },
  waitingName: { fontSize: 14.5, fontWeight: '700', color: REC.ink },
  waitingSub: { fontSize: 12, color: REC.muted, marginTop: 2 },
  waitingBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  emergencyText: { fontSize: 11.5, fontWeight: '700', color: '#C25E5E' },
  doctorHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  doctorAvatar: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#E9F5EF', alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 20, fontWeight: '700', color: REC.ink, marginTop: 4 },
  careTeam: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 16 },
  careTeamText: { fontSize: 12.5, fontWeight: '600', color: '#499865' },
  about: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: REC.line },
  aboutTitle: { fontSize: 14, fontWeight: '700', color: REC.ink, marginBottom: 6 },
  aboutText: { fontSize: 13, lineHeight: 20, color: '#5B6B7B' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: REC.ink },
  countPill: { fontSize: 11, fontWeight: '600', color: '#728798', backgroundColor: '#F1F5F8', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  clinicTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  clinicIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  clinicName: { flex: 1, fontSize: 16, fontWeight: '700', color: REC.ink },
  clinicLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
  clinicText: { flex: 1, fontSize: 13, color: '#5B6B7B' },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: REC.line, overflow: 'hidden', alignItems: 'center', paddingBottom: 16, marginBottom: 18 },
  profileCover: { alignSelf: 'stretch', height: 92, paddingTop: 14, alignItems: 'center' },
  profileCoverText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6, color: 'rgba(255,255,255,0.85)' },
  profileAvatarRing: { marginTop: -50, padding: 4, borderRadius: 54, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  profileName: { fontSize: 21, fontWeight: '800', color: REC.ink, marginTop: 10, textAlign: 'center', paddingHorizontal: 16 },
  profileRole: { fontSize: 13, color: REC.muted, marginTop: 3 },
  profileChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E9F6ED', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22A06B' },
  activeChipText: { fontSize: 12, fontWeight: '700', color: '#2F8A55' },
  shiftChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E0F2FE', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  shiftChipText: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  contactBox: { alignSelf: 'stretch', marginTop: 16, marginHorizontal: 14, borderRadius: 14, backgroundColor: '#F7FAF9', borderWidth: 1, borderColor: '#E3EEEC' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E3EEEC' },
  contactRowLast: { borderBottomWidth: 0 },
  contactIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#E3F6F2', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 11, color: REC.muted },
  contactValue: { fontSize: 14, fontWeight: '700', color: REC.ink, marginTop: 1 },
  detailTiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  detailTile: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: REC.line, padding: 12 },
  detailTileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailTileLabel: { fontSize: 11.5, color: REC.muted },
  detailTileValue: { fontSize: 14, fontWeight: '700', color: REC.ink, marginTop: 2 },
});
