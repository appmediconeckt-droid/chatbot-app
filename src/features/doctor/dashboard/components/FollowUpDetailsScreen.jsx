// Ported from MediconecktApp's FollowUpDetailsScreen. Shows one real follow-up
// (normalizeFollowUp shape from api/doctorFollowUps) — the web's "View"
// modal — with Check-in (status -> completed), Edit and Delete actions.
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { formatLocalDateKey } from '../api/doctorAppointments';
import { normalizeDateInput } from '../api/doctorFollowUps';
import displayLocale from '../../../../utils/displayLocale';

// Same palette as the FollowUpsScreen cards.
const STATUS_META = {
  pending: { label: 'Pending', fg: '#B45309', bg: '#FEF3C7', icon: 'clock' },
  scheduled: { label: 'Scheduled', fg: '#0F766E', bg: '#CCFBF1', icon: 'calendar' },
  completed: { label: 'Completed', fg: '#15803D', bg: '#DCFCE7', icon: 'check-mark' },
  overdue: { label: 'Overdue', fg: '#B91C1C', bg: '#FEE2E2', icon: 'warning' },
};
const TYPE_META = {
  routine: { label: 'Routine', fg: '#0369A1', bg: '#E0F2FE', icon: 'pulse' },
  urgent: { label: 'Urgent', fg: '#BE123C', bg: '#FFE4E6', icon: 'warning' },
  consultation: { label: 'Consultation', fg: '#6D28D9', bg: '#EDE9FE', icon: 'message' },
};
const DAY_MS = 86400000;

// Date-only values are local calendar days; ISO timestamps go through
// normalizeDateInput so a UTC midnight never shifts to the previous day.
const toDate = (value) => {
  const key = normalizeDateInput(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const relativeDay = (date, completed) => {
  if (!date) return null;
  const today = new Date(`${formatLocalDateKey()}T00:00:00`);
  const diff = Math.round((date - today) / DAY_MS);
  if (diff === 0) return { text: 'Today', tone: 'today' };
  if (diff === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (diff > 1) return { text: `In ${diff} days`, tone: 'soon' };
  if (completed) return { text: diff === -1 ? 'Yesterday' : `${-diff} days ago`, tone: 'past' };
  return { text: `Overdue by ${-diff} day${diff === -1 ? '' : 's'}`, tone: 'overdue' };
};

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '??';

export default function FollowUpDetailsScreen({ followUp, onBack, onEdit, onCheckIn, onDelete, busy }) {
  const date = toDate(followUp.followUpDate);
  const lastVisit = toDate(followUp.lastVisit);
  const isCompleted = followUp.followUpStatus === 'completed';
  const relative = relativeDay(date, isCompleted);
  const statusMeta = relative?.tone === 'overdue' ? STATUS_META.overdue : STATUS_META[followUp.followUpStatus] || STATUS_META.pending;
  const typeMeta = TYPE_META[followUp.followUpType] || TYPE_META.routine;
  const genderInitial = followUp.gender ? String(followUp.gender)[0].toUpperCase() : 'N/A';
  const notes = followUp.notes && followUp.notes !== 'N/A' ? String(followUp.notes).trim() : '';
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Follow-Up Details</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.patientCard}>
          <View style={[s.avatar, s.avatarInitials]}><Text translate={false} style={s.avatarText}>{getInitials(followUp.name)}</Text></View>
          <View style={s.grow}>
            <Text translate={false} style={s.patient}>{followUp.name}</Text>
            <Text translate={false} style={s.patientMeta}>Age: {followUp.age} • Gender: {genderInitial} • Phone: {followUp.phone}</Text>
          </View>
        </View>
        <View style={s.badges}>
          <Badge meta={statusMeta} />
          <Badge meta={typeMeta} />
        </View>
        <View style={s.card}>
          <View style={s.cardHeader}>
            <SectionLabel icon="calendar" text="FOLLOW-UP DATE" />
            {relative && (
              <View style={[s.relChip, s[`rel_${relative.tone}`]]}>
                <Text translate={false} style={[s.relText, s[`relText_${relative.tone}`]]}>{relative.text}</Text>
              </View>
            )}
          </View>
          <View style={s.appointment}>
            <View style={s.slot}>
              <View style={s.slotIcon}><AppIcon name="calendar" size={18} color="#0D9488" strokeWidth={2} /></View>
              <View style={s.grow}>
                <Text translate={false} style={s.slotValue} numberOfLines={1}>
                  {date ? date.toLocaleDateString(displayLocale('en-US'), { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}
                </Text>
                {date && (
                  <Text translate={false} style={s.slotSub} numberOfLines={1}>
                    {date.toLocaleDateString(displayLocale('en-US'), { weekday: 'long' })}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
        <View style={s.card}>
          <SectionLabel icon="pulse" text="CLINICAL CONTEXT" />
          <Context icon={typeMeta.icon} label="Follow-up Type" value={typeMeta.label} />
          <Context icon="user" label="Assigned Doctor" value={followUp.doctor || 'N/A'} />
          <Context icon="calendar" label="Last Visit" value={lastVisit ? lastVisit.toLocaleDateString(displayLocale('en-US'), { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'} last />
        </View>
        <View style={s.card}>
          <SectionLabel icon="note" text="NOTES & INSTRUCTIONS" />
          {notes ? (
            <View style={s.notesBox}><Text translate={false} style={s.notes}>{notes}</Text></View>
          ) : (
            <Text style={s.notesEmpty}>No notes added for this follow-up.</Text>
          )}
        </View>
      </ScrollView>
      <View style={s.footer}>
        {!isCompleted && (
          <Pressable onPress={onCheckIn} style={s.checkinWrap} disabled={busy}>
            <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.checkin}>
              <AppIcon name="check" size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={s.checkinText}>{busy ? 'Saving...' : 'Mark Completed'}</Text>
            </LinearGradient>
          </Pressable>
        )}
        <View style={s.bottomRow}>
          <Pressable onPress={onEdit} style={s.secondary}><Text style={s.secondaryText}>Edit</Text></Pressable>
          <Pressable onPress={onDelete} style={s.cancel}><Text style={s.cancelText}>Delete</Text></Pressable>
        </View>
      </View>
    </View>
  );
}
function Badge({ meta }) {
  return (
    <View style={[s.badge, { backgroundColor: meta.bg }]}>
      <AppIcon name={meta.icon} size={13} color={meta.fg} strokeWidth={2.2} />
      <Text translate={false} style={[s.badgeText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}
// Icon and text share one centered row so they never drift apart vertically.
function SectionLabel({ icon, text }) {
  return (
    <View style={s.labelRow}>
      <AppIcon name={icon} size={15} color="#526078" strokeWidth={2} />
      <Text style={s.label}>{text}</Text>
    </View>
  );
}
function Context({ icon, label, value, last }) {
  return (
    <View style={[s.context, last && s.contextLast]}>
      <View style={s.contextIcon}><AppIcon name={icon} size={16} color="#667085" strokeWidth={2} /></View>
      <View style={s.grow}>
        <Text style={s.contextLabel}>{label}</Text>
        <Text translate={false} style={s.contextValue}>{value}</Text>
      </View>
    </View>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 10, paddingBottom: 12 },
  patientCard: { height: 92, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C5CFDD', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  avatarInitials: { backgroundColor: '#DFFCFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700', color: '#0D9488' },
  grow: { flex: 1 },
  patient: { fontSize: 19, fontWeight: '700', color: '#17243A' },
  patientMeta: { fontSize: 13, color: '#667085', marginTop: 5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C5CFDD', borderRadius: 10, padding: 16, marginBottom: 11 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, color: '#526078' },
  relChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rel_today: { backgroundColor: '#CCFBF1' },
  rel_soon: { backgroundColor: '#E0F2FE' },
  rel_past: { backgroundColor: '#F1F4F8' },
  rel_overdue: { backgroundColor: '#FEE2E2' },
  relText: { fontSize: 12, fontWeight: '700' },
  relText_today: { color: '#0F766E' },
  relText_soon: { color: '#0369A1' },
  relText_past: { color: '#526078' },
  relText_overdue: { color: '#B91C1C' },
  appointment: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6FBFB', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10 },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DFFCFF', alignItems: 'center', justifyContent: 'center' },
  slotValue: { fontSize: 20, fontWeight: '800', color: '#17243A' },
  slotSub: { fontSize: 13, color: '#667085', marginTop: 2 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  contextLast: { marginBottom: 0 },
  contextIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  contextLabel: { fontSize: 12, color: '#667085' },
  contextValue: { fontSize: 14, fontWeight: '600', color: '#26364D', marginTop: 2 },
  notesBox: { backgroundColor: '#F8FAFC', borderLeftWidth: 3, borderLeftColor: '#0D9488', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  notes: { fontSize: 14, lineHeight: 21, color: '#344054' },
  notesEmpty: { fontSize: 14, fontStyle: 'italic', color: '#98A2B3' },
  footer: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9', padding: 10 },
  checkinWrap: {},
  checkin: { height: 48, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkinText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  secondary: { flex: 1, height: 43, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, color: '#344054' },
  cancel: { flex: 1, height: 43, borderWidth: 1, borderColor: '#F04438', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, color: '#D92D20' },
});
