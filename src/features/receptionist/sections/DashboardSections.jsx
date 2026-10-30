// Sections fed by the shared /api/staff/receptionist/dashboard poll — the web
// ReceptionistPages.jsx: Overview, Live Queue, Doctor & Clinics, My Profile.
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../components/TranslatedText';
import { ResponsiveGrid, useResponsiveLayout } from '../../../components/common/ResponsiveLayout';
import {
  AppointmentRow, Avatar, Badge, Card, CardHeading, EmergencyReason, Empty, Eyebrow,
  LoadingCard, Notice, NoticeText, QueueTabs, REC, StatGrid, StatTile,
} from '../receptionistUi';
import {
  clinicName, dedupeRows, displayTime, groupQueue, patientKey, profilePhotoOf, staffIdentity, staffShiftTiming,
} from '../receptionistUtils';
import EditProfileSheet from '../components/EditProfileSheet';
import { formatPhoneNumber } from '../../../utils/countryCodes';

// Every booking the dashboard feed knows about, each once.
const allRows = (data) => dedupeRows([...(data?.currentPatients || []), ...(data?.waiting || []), ...(data?.appointments || [])]);

const EMPTY_TEXT = {
  pending: ['No patients waiting', 'New arrivals and bookings will appear in the queue here.'],
  'in-progress': ['No checkup in progress', 'The patient being examined will appear here when the doctor starts a checkup.'],
  completed: ['No completed visits yet', "Today's finished checkups will appear here."],
  cancelled: ['No cancelled appointments', 'Cancelled and no-show bookings for today will appear here.'],
};

// Today's receptionist queue, emergencies first and then by token.
function QueueCard({ data, clinics, onView, title = "Today's Queue", subtitle, right }) {
  const groups = useMemo(() => groupQueue(allRows(data)), [data]);
  const counts = Object.fromEntries(Object.entries(groups).map(([name, rows]) => [name, rows.length]));
  const [tab, setTab] = useState('pending');
  const rows = groups[tab] || [];
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const [emptyTitle, emptyText] = EMPTY_TEXT[tab];
  // No card around the queue: header, tabs and patient cards sit on the page,
  // full width — the same layout as the doctor's Appointment Queue.
  return (
    <View style={s.queueSection}>
      <View style={s.queueHead}>
        <View style={s.queueHeadIcon}><Ionicons name="people" size={18} color={REC.primary} /></View>
        <View style={s.flex}>
          <Text style={s.queueTitle}>{title}</Text>
          {!!subtitle && <Text style={s.queueSub}>{subtitle}</Text>}
        </View>
        {right || (
          <View style={s.queueTotal}>
            <Text translate={false} style={s.queueTotalValue}>{total}</Text>
            <Text style={s.queueTotalLabel}>{total === 1 ? 'patient' : 'patients'}</Text>
          </View>
        )}
      </View>
      <QueueTabs active={tab} counts={counts} onChange={setTab} />
      {rows.length
        ? <ResponsiveGrid minItemWidth={350} maxColumns={2}>{rows.map((row) => <AppointmentRow key={patientKey(row)} row={row} clinics={clinics} onView={onView} />)}</ResponsiveGrid>
        : <View style={s.queueEmpty}><Empty title={emptyTitle} description={emptyText} /></View>}
    </View>
  );
}

function CurrentCheckups({ data, clinics, onView }) {
  const current = dedupeRows(data.currentPatients || []);
  if (!current.length) return null;
  return <ResponsiveGrid minItemWidth={320} maxColumns={2} gap={12}>{current.map((row) => (
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
          <Text translate={false} style={s.currentTokenText} numberOfLines={1} adjustsFontSizeToFit>{row.token ?? '--'}</Text>
          <Text style={s.currentTokenLabel}>TOKEN</Text>
        </LinearGradient>
        <View style={s.flex}>
          <Text translate={false} style={s.currentName}>{row.patientName}</Text>
          <Text translate={false} style={s.muted} numberOfLines={1}>{clinicName(clinics, row.clinicId)}</Text>
        </View>
      </View>
      <EmergencyReason row={row} />
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
  ))}</ResponsiveGrid>;
}

export function OverviewSection({ data, clinics, error, onView }) {
  const groups = useMemo(() => groupQueue(allRows(data)), [data]);
  const { gutter } = useResponsiveLayout();
  if (!data) return <LoadingCard error={error} />;
  const waitingCount = groups.pending.length;
  return (
    <View style={[s.overview, { paddingHorizontal: gutter }]}>
      <View style={s.overviewHeading}>
        <View style={s.flex}>
          <Eyebrow>FRONT DESK</Eyebrow>
          <Text style={s.overviewTitle}>Today's overview</Text>
          <Text style={s.muted}>Appointments and patient flow at a glance</Text>
        </View>
      </View>
      <StatGrid>
        <StatTile fluid title="Appointments today" value={data.summary?.total} icon="calendar" tone="blue" />
        <StatTile fluid title="Waiting patients" value={data.summary?.waiting ?? waitingCount} icon="time" tone="amber" />
        <StatTile fluid title="Ongoing checkups" value={data.summary?.ongoing ?? groups['in-progress'].length} icon="medkit" tone="teal" />
        <StatTile fluid title="Completed today" value={data.summary?.completed ?? groups.completed.length} icon="checkmark-circle" tone="green" />
      </StatGrid>

      {dedupeRows(data.currentPatients || []).length > 0 && (
        <Card>
          <CardHeading title="Currently with the doctor" />
          <CurrentCheckups data={data} clinics={clinics} onView={onView} />
        </Card>
      )}

      <QueueCard
        data={data}
        clinics={clinics}
        onView={onView}
        subtitle="Emergencies first, then by token"
      />
    </View>
  );
}

const tokenText = (row) => (row?.token != null && row.token !== '' ? String(row.token) : '--');

// Entry point to the clinic LED / TV screen that shows this same queue.
function LedLaunchCard({ onOpen }) {
  return (
    <LinearGradient colors={['#0D6A62', '#1A9483']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.launch}>
      <View style={s.launchGlow} />
      <View style={s.launchGlowSmall} />
      <View style={s.launchTop}>
        <View style={s.launchIcon}><Ionicons name="tv-outline" size={22} color="#FFFFFF" /></View>
        <View style={s.flex}>
          <Text style={s.launchEyebrow}>WAITING ROOM DISPLAY</Text>
          <Text style={s.launchTitle}>Show the queue on your LED</Text>
          <Text style={s.launchText}>Patients see the current and next tokens, refreshed every 3 seconds.</Text>
        </View>
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        style={({ pressed }) => [s.launchButton, pressed && s.launchButtonPressed]}
      >
        <Ionicons name="tv" size={16} color={REC.primary} />
        <Text style={s.launchButtonText}>Open LED display</Text>
        <Ionicons name="arrow-forward" size={16} color={REC.primary} />
      </Pressable>
    </LinearGradient>
  );
}

// What the waiting room sees: the token with the doctor, who is next, the day's
// counts and the wait estimate — in one card.
function NowServingCard({ data, groups, clinics, onView }) {
  const current = dedupeRows(data.currentPatients || [])[0] || groups['in-progress'][0];
  const waiting = groups.pending;
  const nextRows = waiting.slice(0, 4);
  const timing = data.timing;
  const wait = timing?.estimatedWaitLabel || (timing?.estimatedWaitMinutes != null ? `${timing.estimatedWaitMinutes} min` : '');
  const breakNote = [timing?.breakInfo?.headline, timing?.breakInfo?.expectedStart && `Expected start ${timing.breakInfo.expectedStart}`]
    .filter(Boolean).join(' · ');
  const stats = [
    { label: 'Waiting', value: data.summary?.waiting ?? waiting.length, icon: 'time-outline', color: '#C27C0E' },
    { label: 'With doctor', value: data.summary?.ongoing ?? groups['in-progress'].length, icon: 'medkit-outline', color: REC.primary },
    { label: 'Completed', value: data.summary?.completed ?? groups.completed.length, icon: 'checkmark-circle-outline', color: '#3E8E41' },
  ];
  return (
    <Card style={s.serveCard}>
      <View style={s.serveHead}>
        <Text style={s.serveTitle}>Now serving</Text>
        <View style={s.livePill}>
          <View style={s.dot} />
          <Text style={s.livePillText}>LIVE</Text>
        </View>
      </View>

      <View style={[s.servePanel, current?.emergency && s.servePanelEmergency]}>
        <LinearGradient
          colors={current?.emergency ? ['#F87171', '#DC2626'] : ['#12756D', '#1C9686']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.serveToken, !current && s.serveTokenIdle]}
        >
          <Text style={s.serveTokenLabel}>TOKEN</Text>
          <Text translate={false} style={s.serveTokenText} numberOfLines={1} adjustsFontSizeToFit>{tokenText(current)}</Text>
        </LinearGradient>
        <View style={s.flex}>
          {current ? (
            <>
              <Text style={[s.serveState, current.emergency && s.serveStateEmergency]}>
                {current.emergency ? 'Emergency · ' : ''}{current.queueStatus === 'called' ? 'Patient called' : 'In consultation'}
              </Text>
              <Text translate={false} style={s.serveName} numberOfLines={1}>{current.patientName}</Text>
              <Text translate={false} style={s.serveMeta} numberOfLines={1}>
                {current.timing?.startedAt ? `Started ${displayTime(current.timing.startedAt)}` : clinicName(clinics, current.clinicId)}
                {current.timing?.state === 'paused' ? ' · Paused' : ''}
              </Text>
              <Pressable onPress={() => onView(current)} style={s.serveLink} hitSlop={6} accessibilityRole="button">
                <Text style={s.textButtonText}>View details</Text>
                <Ionicons name="arrow-forward" size={14} color={REC.primary} />
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.serveState}>Waiting for next call</Text>
              <Text style={s.serveName}>No patient with the doctor</Text>
              <Text style={s.serveMeta}>The token appears here as soon as the doctor calls a patient.</Text>
            </>
          )}
        </View>
      </View>

      <Text style={s.serveSubhead}>NEXT UP</Text>
      {nextRows.length ? (
        <View style={s.nextChips}>
          {nextRows.map((row, index) => (
            <View key={patientKey(row)} style={[s.nextChip, index === 0 && s.nextChipFirst, row.emergency && s.nextChipEmergency]}>
              {row.emergency && <Ionicons name="alert-circle" size={13} color="#C24848" />}
              <Text translate={false} style={[s.nextChipText, index === 0 && s.nextChipTextFirst, row.emergency && s.nextChipTextEmergency]}>
                #{tokenText(row)}
              </Text>
            </View>
          ))}
          {waiting.length > nextRows.length && (
            <Text translate={false} style={s.nextMore}>+{waiting.length - nextRows.length} more</Text>
          )}
        </View>
      ) : (
        <View style={s.nextClear}>
          <Ionicons name="checkmark-done" size={15} color="#3E8E41" />
          <Text style={s.nextClearText}>Queue is clear</Text>
        </View>
      )}

      <View style={s.statStrip}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={[s.statCell, index > 0 && s.statCellDivider]}>
            <Text translate={false} style={[s.statValue, { color: stat.color }]}>{stat.value ?? 0}</Text>
            <View style={s.statLabelRow}>
              <Ionicons name={stat.icon} size={12} color={REC.muted} />
              <Text style={s.statLabel} numberOfLines={1}>{stat.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[s.waitRow, !!breakNote && s.waitRowBreak]}>
        <View style={[s.waitIcon, !!breakNote && s.waitIconBreak]}>
          <Ionicons name={breakNote ? 'cafe-outline' : 'hourglass-outline'} size={17} color={breakNote ? '#B54708' : REC.primary} />
        </View>
        <View style={s.flex}>
          <Text style={s.waitLabel}>Estimated wait</Text>
          {!!breakNote && <Text translate={false} style={s.waitNote}>{breakNote}</Text>}
        </View>
        <Text translate={false} style={s.waitValue}>{wait || '--'}</Text>
      </View>
    </Card>
  );
}

export function LiveQueueSection({ data, clinics, error, onView, onNavigate }) {
  const groups = useMemo(() => groupQueue(allRows(data)), [data]);
  const { gutter } = useResponsiveLayout();
  if (!data) return <LoadingCard error={error} />;
  // The first patient with the doctor leads "Now serving"; any others (e.g. a
  // second room) are listed below it.
  const alsoWithDoctor = dedupeRows(data.currentPatients || []).slice(1);
  return (
    <View style={[s.overview, { paddingHorizontal: gutter }]}>
      <LedLaunchCard onOpen={() => onNavigate('led-display')} />
      <NowServingCard data={data} groups={groups} clinics={clinics} onView={onView} />

      {alsoWithDoctor.length > 0 && (
        <Card>
          <CardHeading title="Also with the doctor" count={alsoWithDoctor.length} />
          <CurrentCheckups data={{ currentPatients: alsoWithDoctor }} clinics={clinics} onView={onView} />
        </Card>
      )}

      <QueueCard data={data} clinics={clinics} onView={onView} title="Patient queue" subtitle="Emergencies first, then by token" />
    </View>
  );
}

// Arrays / objects from the doctor record as readable text.
const listText = (value) => {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(listText).filter(Boolean).join(', ');
  if (typeof value === 'object') return [value.degree, value.institution || value.college, value.year].filter(Boolean).join(' · ') || Object.values(value).filter((v) => typeof v === 'string').join(', ');
  return String(value);
};
const callNumber = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (digits) Linking.openURL(`tel:${digits}`).catch(() => {});
};

export function DoctorSection({ data, clinics, error }) {
  if (!data) return <LoadingCard error={error} />;
  const doctor = data.doctor || {};
  const name = doctor.fullName || doctor.name || 'Doctor';
  const specialization = listText(doctor.specialization);
  const tiles = [
    ['Qualification', listText(doctor.qualification), 'school-outline', '#7C3AED', '#F1EAFE'],
    ['Experience', doctor.experience != null && doctor.experience !== '' ? `${doctor.experience} years` : '', 'ribbon-outline', '#D08A16', '#FFF4DF'],
    ['Consultation', listText(doctor.consultationMode), 'videocam-outline', '#3975C7', '#E8F1FF'],
    ['Languages', listText(doctor.languages), 'language-outline', '#0E9384', '#E3F6F2'],
    ['Location', listText(doctor.location), 'location-outline', '#C2410C', '#FFF1E8'],
    ['Education', listText(doctor.education), 'library-outline', '#3E4784', '#EEF0FA'],
  ];
  return (
    <View style={s.doctorSection}>
      <ResponsiveGrid minItemWidth={380} maxColumns={2} gap={20}>
      <View style={[s.profileCard, { marginBottom: 0 }]}>
        <LinearGradient colors={['#12756D', '#1C9686']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.profileCover}>
          <Text style={s.profileCoverText}>ASSIGNED DOCTOR</Text>
        </LinearGradient>
        <View style={s.profileAvatarRing}>
          <Avatar photo={profilePhotoOf(doctor)} name={name} size={92} />
        </View>
        <Text translate={false} style={s.profileName}>{/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`}</Text>
        <Text translate={false} style={s.profileRole}>{specialization || 'Specialization not provided'}</Text>
        <View style={s.profileChips}>
          <View style={s.activeChip}>
            <View style={s.activeDot} />
            <Text style={s.activeChipText}>Your care team</Text>
          </View>
          <View style={s.shiftChip}>
            <Ionicons name="business-outline" size={13} color="#0369A1" />
            <Text translate={false} style={s.shiftChipText}>{clinics.length} {clinics.length === 1 ? 'clinic' : 'clinics'}</Text>
          </View>
        </View>
        <View style={s.contactBox}>
          <View style={s.contactRow}>
            <View style={s.contactIcon}><Ionicons name="mail-outline" size={17} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.contactLabel}>Email</Text>
              <Text translate={false} style={s.contactValue} numberOfLines={1}>{doctor.email || 'Not provided'}</Text>
            </View>
          </View>
          <View style={[s.contactRow, s.contactRowLast]}>
            <View style={s.contactIcon}><Ionicons name="call-outline" size={17} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.contactLabel}>Phone</Text>
              <Text translate={false} style={s.contactValue} numberOfLines={1}>{formatPhoneNumber(doctor.phoneNumber || doctor.phone, doctor.phoneCountryCode) || 'Not provided'}</Text>
            </View>
            {!!(doctor.phoneNumber || doctor.phone) && (
              <Pressable onPress={() => callNumber(formatPhoneNumber(doctor.phoneNumber || doctor.phone, doctor.phoneCountryCode))} style={s.callButton} hitSlop={6} accessibilityLabel="Call doctor">
                <Ionicons name="call" size={15} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View>
      <Text style={s.drHeading}>Professional details</Text>
      <View style={s.drTiles}>
        {tiles.map(([label, value, icon, fg, bg]) => (
          <View key={label} style={s.drTile}>
            <View style={[s.drTileIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={17} color={fg} /></View>
            <Text style={s.drTileLabel}>{label}</Text>
            <Text translate={false} style={[s.drTileValue, !value && s.drTileEmpty]} numberOfLines={3}>{value || 'Not provided'}</Text>
          </View>
        ))}
      </View>

      {!!(doctor.aboutMe || doctor.bio) && (
        <View style={s.drAbout}>
          <View style={s.drAboutHead}>
            <Ionicons name="person-circle-outline" size={18} color={REC.primary} />
            <Text style={s.drAboutTitle}>About the doctor</Text>
          </View>
          <Text translate={false} style={s.aboutText}>{doctor.aboutMe || doctor.bio}</Text>
        </View>
      )}

      </View>
      </ResponsiveGrid>
      <View style={s.sectionHeading}>
        <Text style={s.drHeadingInline}>Clinics & hospitals</Text>
        <Text translate={false} style={s.countPill}>{clinics.length} {clinics.length === 1 ? 'location' : 'locations'}</Text>
      </View>
      {clinics.length ? <ResponsiveGrid minItemWidth={330} maxColumns={2}>{clinics.map((row) => (
        <View key={row._id || row.id} style={s.drClinic}>
          <View style={s.drClinicAccent} />
          <View style={s.clinicTop}>
            <LinearGradient colors={['#E3F6F2', '#C9EEE5']} style={s.drClinicIcon}>
              <Ionicons name="business" size={20} color={REC.primary} />
            </LinearGradient>
            <Text translate={false} style={s.clinicName}>{row.clinic_name}</Text>
          </View>
          <View style={s.clinicLine}>
            <Ionicons name="location-outline" size={16} color={REC.muted} style={s.clinicLineIcon} />
            <Text translate={false} style={s.clinicText}>{row.location || 'Location not provided'}</Text>
          </View>
          <View style={[s.clinicLine, s.drClinicPhone]}>
            <Ionicons name="call-outline" size={16} color={REC.muted} style={s.clinicLineIcon} />
            <Text translate={false} style={s.clinicText}>{formatPhoneNumber(row.phone_number, row.phoneCountryCode) || 'Phone not provided'}</Text>
            {!!row.phone_number && (
              <Pressable onPress={() => callNumber(formatPhoneNumber(row.phone_number, row.phoneCountryCode))} style={s.drCallPill} hitSlop={6} accessibilityLabel="Call clinic">
                <Ionicons name="call" size={12} color={REC.primary} />
                <Text style={s.drCallText}>Call</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}</ResponsiveGrid> : <Card style={s.doctorCard}><Empty icon="business-outline" title="No clinics assigned" description="Your doctor can add clinic details from their portal." /></Card>}
    </View>
  );
}

export function ProfileSection({ profile, onProfileUpdated }) {
  const [editing, setEditing] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const details = [
    ['Assigned doctor', profile.assignedDoctorName, 'medkit-outline'],
    ['Assigned clinic', profile.clinic_name, 'business-outline'],
    ['Department', profile.department, 'briefcase-outline'],
    ['Staff ID', staffIdentity(profile), 'id-card-outline'],
    ['Shift', profile.shift, 'sunny-outline'],
    ['Shift timings', staffShiftTiming(profile), 'time-outline'],
  ];
  return (
    <View style={s.profileSection}>
      <ResponsiveGrid minItemWidth={380} maxColumns={2} gap={20}>
      <View style={[s.profileCard, { marginBottom: 0 }]}>
        <LinearGradient colors={['#12756D', '#1C9686']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.profileCover}>
          <Text style={s.profileCoverText}>STAFF ACCOUNT</Text>
        </LinearGradient>
        {/* Edit lives on the photo: tap it (pencil badge) to edit the profile. */}
        <Pressable
          onPress={onProfileUpdated ? () => { setSavedNote(false); setEditing(true); } : undefined}
          disabled={!onProfileUpdated}
          style={({ pressed }) => [s.profileAvatarRing, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Avatar photo={profilePhotoOf(profile)} name={profile.fullName} size={92} />
          {!!onProfileUpdated && (
            <View style={s.avatarEditBadge}>
              <Ionicons name="pencil" size={14} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
        <Text translate={false} style={s.profileName}>{profile.fullName}</Text>
        <Text style={s.profileRole}>Receptionist</Text>
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
        {savedNote && (
          <View style={s.savedNote}>
            <Ionicons name="checkmark-circle" size={15} color="#067647" />
            <Text style={s.savedNoteText}>Profile updated</Text>
          </View>
        )}
        <View style={s.contactBox}>
          <View style={s.contactRow}>
            <View style={s.contactIcon}><Ionicons name="mail-outline" size={17} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.contactLabel}>Email</Text>
              <Text translate={false} style={s.contactValue} selectable>{profile.email || 'Not provided'}</Text>
            </View>
          </View>
          <View style={[s.contactRow, s.contactRowLast]}>
            <View style={s.contactIcon}><Ionicons name="call-outline" size={17} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.contactLabel}>Phone</Text>
              <Text translate={false} style={s.contactValue} selectable>{formatPhoneNumber(profile.phoneNumber || profile.phone, profile.phoneCountryCode) || 'Not provided'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={s.assignmentCard}>
        <View style={s.assignmentHeading}>
          <View style={s.assignmentHeadingIcon}><Ionicons name="briefcase-outline" size={19} color={REC.primary} /></View>
          <View style={s.flex}>
            <Text style={s.assignmentTitle}>Staff assignment</Text>
            <Text style={s.assignmentSubtitle}>Your workplace & schedule</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={16} color={REC.muted} />
        </View>
        {details.map(([label, value, icon], index) => (
          <View key={label} style={[s.assignmentRow, index === details.length - 1 && s.assignmentRowLast]}>
            <View style={s.assignmentIcon}><Ionicons name={icon} size={18} color={REC.primary} /></View>
            <View style={s.flex}>
              <Text style={s.assignmentLabel}>{label}</Text>
              <Text translate={false} style={[s.assignmentValue, !value && s.assignmentUnassigned]} selectable>{value || 'Not assigned'}</Text>
            </View>
          </View>
        ))}
      </View>

      </ResponsiveGrid>
      <Notice icon="shield-checkmark-outline">
        <NoticeText>You can edit your name, phone and photo. Your doctor manages your role, clinic assignment and staff details.</NoticeText>
      </Notice>

      {!!onProfileUpdated && (
        <EditProfileSheet
          visible={editing}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(user) => { onProfileUpdated(user); setEditing(false); setSavedNote(true); }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  muted: { fontSize: 12.5, color: REC.muted, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: REC.green },
  overview: { minWidth: 0 },
  queueSection: { marginTop: 6, marginBottom: 16 },
  queueEmpty: { borderRadius: 14, borderWidth: 1, borderColor: REC.line, backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  queueHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  queueHeadIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  queueTitle: { fontSize: 17, fontWeight: '800', color: REC.ink },
  queueSub: { fontSize: 12.5, color: REC.muted, marginTop: 2 },
  queueTotal: { alignItems: 'center', minWidth: 58, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F4F7F9', borderWidth: 1, borderColor: REC.line },
  queueTotalValue: { fontSize: 18, fontWeight: '800', color: REC.primary, lineHeight: 22 },
  queueTotalLabel: { fontSize: 10, fontWeight: '700', color: REC.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  overviewHeading: { marginTop: 2, marginBottom: 14 },
  overviewTitle: { fontSize: 21, fontWeight: '800', color: REC.ink, marginTop: 4, marginBottom: 2 },
  current: { borderWidth: 1, borderColor: '#CCE8DD', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14 },
  currentEmergency: { borderColor: '#F4C9C9' },
  currentMain: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  currentToken: { paddingHorizontal: 4, width: 66, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  currentTokenText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  currentTokenLabel: { fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  currentName: { fontSize: 18, fontWeight: '700', color: REC.ink },
  currentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#DCEDE5' },
  footerText: { flexShrink: 1, fontSize: 12.5, color: '#5B7F73' },
  textButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  textButtonText: { fontSize: 13, fontWeight: '700', color: REC.primary },
  launch: {
    padding: 18, borderRadius: 18, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#0D6A62', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  launchGlow: { position: 'absolute', top: -60, right: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.08)' },
  launchGlowSmall: { position: 'absolute', bottom: -36, right: 70, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)' },
  launchTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  launchIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  launchEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(255,255,255,0.72)' },
  launchTitle: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },
  launchText: { fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.86)', marginTop: 4 },
  launchButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, backgroundColor: '#FFFFFF', marginTop: 16 },
  launchButtonPressed: { backgroundColor: '#E7F4EE' },
  launchButtonText: { fontSize: 14, fontWeight: '800', color: REC.primary },
  serveCard: { borderRadius: 18, padding: 16 },
  serveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  serveTitle: { fontSize: 17, fontWeight: '800', color: REC.ink },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E9F7F0' },
  livePillText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: '#1F8F63' },
  servePanel: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: '#F3FAF7', borderWidth: 1, borderColor: '#D5EDE3' },
  servePanelEmergency: { backgroundColor: '#FFF5F5', borderColor: '#F4C9C9' },
  serveToken: { width: 84, height: 84, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  serveTokenIdle: { opacity: 0.45 },
  serveTokenLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  serveTokenText: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: '#FFFFFF' },
  serveState: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: REC.primary },
  serveStateEmergency: { color: '#C24848' },
  serveName: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: REC.ink, marginTop: 3 },
  serveMeta: { fontSize: 12.5, lineHeight: 17, color: REC.muted, marginTop: 2 },
  serveLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, marginTop: 4 },
  serveSubhead: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: REC.muted, marginTop: 18, marginBottom: 8 },
  nextChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  nextChip: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 54, height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F4F7F9', borderWidth: 1, borderColor: REC.line, justifyContent: 'center' },
  nextChipFirst: { backgroundColor: REC.soft, borderColor: '#B7E4DA' },
  nextChipEmergency: { backgroundColor: '#FFF0F0', borderColor: '#F4C9C9' },
  nextChipText: { fontSize: 15, fontWeight: '800', color: '#476072' },
  nextChipTextFirst: { color: REC.primary },
  nextChipTextEmergency: { color: '#C24848' },
  nextMore: { fontSize: 12.5, fontWeight: '700', color: REC.muted, marginLeft: 2 },
  nextClear: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36 },
  nextClearText: { fontSize: 13.5, fontWeight: '700', color: '#3E8E41' },
  statStrip: { flexDirection: 'row', marginTop: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F8FAFB', borderWidth: 1, borderColor: REC.line },
  statCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 6 },
  statCellDivider: { borderLeftWidth: 1, borderLeftColor: REC.line },
  statValue: { fontSize: 22, lineHeight: 27, fontWeight: '800' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statLabel: { flexShrink: 1, fontSize: 11.5, fontWeight: '600', color: REC.muted },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: REC.line },
  waitRowBreak: { backgroundColor: '#FFF8EC', borderColor: '#F6DDAE' },
  waitIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: REC.soft, alignItems: 'center', justifyContent: 'center' },
  waitIconBreak: { backgroundColor: '#FDEBCF' },
  waitLabel: { fontSize: 13.5, fontWeight: '700', color: REC.ink },
  waitNote: { fontSize: 12, lineHeight: 17, color: '#B54708', marginTop: 2 },
  waitValue: { fontSize: 16, fontWeight: '800', color: REC.ink },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: REC.line },
  queuePosition: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F2F5F7', color: '#92A1AD', fontSize: 11, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' },
  waitingToken: { fontSize: 14, fontWeight: '700', color: '#55748B' },
  waitingName: { fontSize: 14.5, fontWeight: '700', color: REC.ink },
  waitingSub: { fontSize: 12, color: REC.muted, marginTop: 2 },
  waitingBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  emergencyText: { fontSize: 11.5, fontWeight: '700', color: '#C25E5E' },
  callButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: REC.primary, alignItems: 'center', justifyContent: 'center' },
  drHeading: { fontSize: 17, fontWeight: '800', color: REC.ink, marginBottom: 10 },
  drHeadingInline: { flexShrink: 1, fontSize: 17, fontWeight: '800', color: REC.ink },
  drTiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  drTile: {
    width: '48.5%', padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line,
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  drTileIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  drTileLabel: { fontSize: 11, fontWeight: '700', color: REC.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  drTileValue: { fontSize: 13.5, lineHeight: 19, fontWeight: '700', color: REC.ink, marginTop: 3 },
  drTileEmpty: { fontWeight: '500', color: '#98A2B3' },
  drAbout: { padding: 14, borderRadius: 16, backgroundColor: '#F6FAF9', borderWidth: 1, borderColor: '#E3EEEC', marginBottom: 18 },
  drAboutHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  drAboutTitle: { fontSize: 14, fontWeight: '800', color: REC.ink },
  drClinic: {
    padding: 14, paddingLeft: 17, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#0F3D38', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  drClinicAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: REC.primary },
  drClinicIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  drClinicPhone: { alignItems: 'center' },
  drCallPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: REC.soft },
  drCallText: { fontSize: 12, fontWeight: '700', color: REC.primary },
  doctorSection: { marginHorizontal: 14 },
  doctorCard: { borderRadius: 20 },
  doctorHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  doctorAvatar: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#E9F5EF', alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 20, fontWeight: '700', color: REC.ink, marginTop: 4 },
  careTeam: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 16 },
  careTeamText: { fontSize: 12.5, fontWeight: '600', color: '#499865' },
  about: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: REC.line },
  aboutTitle: { fontSize: 14, fontWeight: '700', color: REC.ink, marginBottom: 6 },
  aboutText: { fontSize: 13, lineHeight: 20, color: '#5B6B7B' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 12 },
  sectionTitle: { flexShrink: 1, fontSize: 17, lineHeight: 23, fontWeight: '700', color: REC.ink },
  countPill: { fontSize: 11, fontWeight: '600', color: REC.muted, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  clinicTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  clinicIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BCDAD4', alignItems: 'center', justifyContent: 'center' },
  clinicName: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 23, fontWeight: '700', color: REC.ink },
  clinicLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  clinicLineIcon: { marginTop: 2 },
  clinicText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 20, color: '#5B6B7B' },
  profileSection: { marginHorizontal: 14 },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: REC.line, overflow: 'hidden', alignItems: 'center', paddingBottom: 16, marginBottom: 18 },
  profileCover: { alignSelf: 'stretch', height: 92, paddingTop: 14, alignItems: 'center' },
  profileCoverText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6, color: 'rgba(255,255,255,0.85)' },
  profileAvatarRing: { marginTop: -50, padding: 4, borderRadius: 54, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  profileName: { fontSize: 21, fontWeight: '800', color: REC.ink, marginTop: 10, textAlign: 'center', paddingHorizontal: 16 },
  profileRole: { fontSize: 13, color: REC.muted, marginTop: 3, textAlign: 'center', paddingHorizontal: 16 },
  profileChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12, paddingHorizontal: 14 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E9F6ED', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22A06B' },
  activeChipText: { fontSize: 12, fontWeight: '700', color: '#2F8A55' },
  shiftChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E0F2FE', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  shiftChipText: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  avatarEditBadge: { position: 'absolute', right: 4, bottom: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: REC.primary, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  savedNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  savedNoteText: { fontSize: 12.5, fontWeight: '600', color: '#067647' },
  contactBox: { alignSelf: 'stretch', marginTop: 16, marginHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E3EEEC' },
  contactRowLast: { borderBottomWidth: 0 },
  contactIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#E3F6F2', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 11, color: REC.muted },
  contactValue: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: REC.ink, marginTop: 2 },
  assignmentCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: REC.line, borderRadius: 20, overflow: 'hidden' },
  assignmentHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderBottomWidth: 1, borderBottomColor: REC.line },
  assignmentHeadingIcon: { width: 40, height: 40, borderWidth: 1, borderColor: '#BCDAD4', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  assignmentTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: REC.ink },
  assignmentSubtitle: { fontSize: 11.5, lineHeight: 17, color: REC.muted, marginTop: 2 },
  assignmentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 72, marginHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: REC.line },
  assignmentRowLast: { borderBottomWidth: 0 },
  assignmentIcon: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: REC.line, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  assignmentLabel: { fontSize: 11.5, lineHeight: 17, color: REC.muted },
  assignmentValue: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: REC.ink, marginTop: 3 },
  assignmentUnassigned: { color: REC.muted, fontWeight: '400' },
});
