// Ported from MediconecktApp's FollowUpDetailsScreen. Shows one real follow-up
// (normalizeFollowUp shape from api/doctorFollowUps) — the web's "View"
// modal — with Check-in (status -> completed), Edit and Delete actions.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';

const STATUS_LABEL = { scheduled: 'Scheduled', pending: 'Pending', completed: 'Completed' };
const TYPE_LABEL = { routine: 'Routine', urgent: 'Urgent', consultation: 'Consultation' };

const toDate = (value) => {
  if (!value) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatTime = (value) => {
  if (!value) return { time: '--:--', meridiem: '' };
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { time: String(value), meridiem: '' };
  let h = Number(m[1]);
  const meridiem = /pm/i.test(value) || h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { time: `${String(h).padStart(2, '0')}:${m[2]}`, meridiem };
};

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '??';

export default function FollowUpDetailsScreen({ followUp, onBack, onEdit, onCheckIn, onDelete, busy }) {
  const date = toDate(followUp.followUpDate);
  const lastVisit = toDate(followUp.lastVisit);
  const { time, meridiem } = formatTime(followUp.followUpTime);
  const isCompleted = followUp.followUpStatus === 'completed';
  const genderInitial = followUp.gender ? String(followUp.gender)[0].toUpperCase() : 'N/A';
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
          <View style={[s.avatar, s.avatarInitials]}><Text style={s.avatarText}>{getInitials(followUp.name)}</Text></View>
          <View style={s.grow}>
            <Text style={s.patient}>{followUp.name}</Text>
            <Text style={s.patientMeta}>Age: {followUp.age} • Gender: {genderInitial} • Phone: {followUp.phone}</Text>
          </View>
        </View>
        <View style={s.badges}>
          <View style={s.scheduled}>
            <AppIcon name="calendar" size={12} color="#0D9488" strokeWidth={2.2} />
            <Text style={s.scheduledText}>{STATUS_LABEL[followUp.followUpStatus] || 'Pending'}</Text>
          </View>
          <View style={s.priority}>
            <AppIcon name="warning" size={12} color="#D92D20" strokeWidth={2.2} />
            <Text style={s.priorityText}>{TYPE_LABEL[followUp.followUpType] || 'Routine'}</Text>
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.label}>FOLLOW-UP DATE & TIME</Text>
          <View style={s.appointment}>
            <View style={s.dateBlock}>
              <Text style={s.bigDate}>{date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</Text>
              <Text style={s.year}>{date ? date.getFullYear() : ''}</Text>
            </View>
            <View style={s.vertical} />
            <View><Text style={s.bigTime}>{time}</Text><Text style={s.year}>{meridiem}</Text></View>
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.label}>CLINICAL CONTEXT</Text>
          <Context icon="pulse" label="Follow-up Type" value={TYPE_LABEL[followUp.followUpType] || 'Routine'} />
          <Context icon="user" label="Assigned Doctor" value={followUp.doctor} />
          <Context icon="calendar" label="Last Visit" value={lastVisit ? lastVisit.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} />
        </View>
        <View style={s.card}>
          <View style={s.notesLabelRow}>
            <AppIcon name="note" size={14} color="#526078" strokeWidth={1.9} />
            <Text style={s.label}>NOTES & INSTRUCTIONS</Text>
          </View>
          <Text style={s.notes}>{followUp.notes || 'N/A'}</Text>
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
function Context({ icon, label, value }) {
  return (
    <View style={s.context}>
      <AppIcon name={icon} size={17} color="#667085" />
      <View><Text style={s.contextLabel}>{label}</Text><Text style={s.contextValue}>{value}</Text></View>
    </View>
  );
}
const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
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
  badges: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  scheduled: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#B7ECE7', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  scheduledText: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  priority: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFC9C4', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  priorityText: { fontSize: 13, fontWeight: '600', color: '#D92D20' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C5CFDD', borderRadius: 8, padding: 16, marginBottom: 11 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: '#526078', marginBottom: 15 },
  notesLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  appointment: { flexDirection: 'row', alignItems: 'center' },
  dateBlock: { width: '45%' },
  bigDate: { fontSize: 29, fontWeight: '700', color: '#0D9488' },
  bigTime: { fontSize: 29, fontWeight: '700', color: '#17243A' },
  year: { fontSize: 14, color: '#667085', marginTop: 3 },
  vertical: { height: 55, width: 1, backgroundColor: '#D8DFE9', marginRight: 20 },
  context: { flexDirection: 'row', gap: 11, marginBottom: 16 },
  contextLabel: { fontSize: 13, color: '#667085' },
  contextValue: { fontSize: 14, fontWeight: '500', color: '#26364D', marginTop: 3 },
  notes: { fontSize: 14, lineHeight: 21, color: '#344054' },
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
