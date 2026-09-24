// Staff Profile — opened by tapping a staff card in Staff Management.
// Frontend-only mock: schedule/activity/documents come from the same local
// roster as the directory list. Message, Assign Shift, View Full Calendar and
// document rows all show a toast since none of those flows exist yet; Edit
// Profile hands off to StaffEditProfileScreen via onEdit.
import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';

const formatLongDate = (isoDate) => {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function StaffProfileScreen({ member, onBack, onEdit }) {
  const { showToast } = useToast();
  const isActive = member.status === 'Active';
  const isVerified = member.verification === 'Verified';
  const schedule = member.schedule ?? [];
  const activity = member.activity ?? [];
  const documents = member.documents ?? [];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Staff Profile</Text>
      </View>

      <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            <Image source={{ uri: member.image }} style={s.avatar} />
            {isActive && <View style={s.onlineDot} />}
          </View>
          <Text style={s.name}>{member.name}</Text>
          <Text style={s.meta}>#{member.id} · {member.department} {member.role}</Text>

          <View style={s.badgeRow}>
            <View style={s.verifiedBadge}>
              <AppIcon name={isVerified ? 'check-mark' : 'clock'} size={11} color={isVerified ? '#16A34A' : '#B7791F'} strokeWidth={3} />
              <Text style={[s.verifiedBadgeText, !isVerified && s.pendingBadgeText]}>{member.verification}</Text>
            </View>
            <View style={[s.statusBadge, !isActive && s.statusBadgeLeave]}>
              <View style={[s.statusDot, !isActive && s.statusDotLeave]} />
              <Text style={[s.statusBadgeText, !isActive && s.statusBadgeTextLeave]}>{member.status}</Text>
            </View>
          </View>

          <View style={s.contactBlock}>
            <View style={s.contactRow}>
              <AppIcon name="message" size={13} color="#8A94A4" strokeWidth={1.9} />
              <Text style={s.contactText}>{member.email}</Text>
            </View>
            {!!member.phone && (
              <View style={s.contactRow}>
                <AppIcon name="phone" size={13} color="#8A94A4" strokeWidth={1.9} />
                <Text style={s.contactText}>{member.phone}</Text>
              </View>
            )}
          </View>

          <Pressable style={s.messageButtonWrap} onPress={() => showToast(`Messaging ${member.name} is coming soon.`)}>
            <View style={s.messageButton}>
              <AppIcon name="message" size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={s.messageButtonText}>Message</Text>
            </View>
          </Pressable>
          <Pressable style={s.editButton} onPress={onEdit}>
            <AppIcon name="edit" size={15} color={colors.blue} strokeWidth={2.1} />
            <Text style={s.editButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Employment Details</Text>
          <View style={s.employmentGrid}>
            <View style={s.employmentItem}>
              <Text style={s.employmentLabel}>Department</Text>
              <View style={s.employmentValueRow}>
                <AppIcon name="home" size={14} color={colors.blue} strokeWidth={2} />
                <Text style={s.employmentValue}>{member.department}</Text>
              </View>
            </View>
            <View style={s.employmentItem}>
              <Text style={s.employmentLabel}>Role Type</Text>
              <View style={s.rolePill}><Text style={s.rolePillText}>{member.role}</Text></View>
            </View>
          </View>
          <InfoRow label="Employment Status" value={member.employmentStatus} />
          <InfoRow label="Join Date" value={formatLongDate(member.joinDate)} />
          <InfoRow label="Manager" value={member.manager} last />
        </View>

        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Current Schedule</Text>
            <Pressable onPress={() => showToast('Shift assignment is coming soon.')} hitSlop={6}>
              <Text style={s.headerLink}>Assign Shift</Text>
            </Pressable>
          </View>
          {schedule.length === 0 && <Text style={s.emptyHint}>No shifts scheduled.</Text>}
          {schedule.map((item, index) => {
            const inProgress = item.status === 'In Progress';
            return (
              <View key={item.title + index} style={[s.scheduleRow, index === schedule.length - 1 && s.scheduleRowLast]}>
                <View style={s.scheduleIcon}><AppIcon name="clock" size={16} color={colors.blue} strokeWidth={2} /></View>
                <View style={s.grow}>
                  <Text style={s.scheduleTitle}>{item.title}</Text>
                  <Text style={s.scheduleTime}>{item.time}</Text>
                </View>
                <View style={s.scheduleRight}>
                  <Text style={s.scheduleDay}>{item.day}</Text>
                  <View style={[s.schedulePill, inProgress && s.schedulePillActive]}>
                    <Text style={[s.schedulePillText, inProgress && s.schedulePillTextActive]}>{item.status}</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <Pressable style={s.viewCalendarButton} onPress={() => showToast('The full calendar is coming soon.')}>
            <Text style={s.viewCalendarText}>View Full Calendar</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Recent Activity</Text>
          {activity.length === 0 && <Text style={s.emptyHint}>No recent activity.</Text>}
          {activity.map((item, index) => (
            <View key={item.title + index} style={s.activityRow}>
              <View style={s.activityMarkerCol}>
                <View style={s.activityDot} />
                {index < activity.length - 1 && <View style={s.activityLine} />}
              </View>
              <View style={[s.grow, s.activityContent]}>
                <Text style={s.activityTime}>{item.time}</Text>
                <Text style={s.activityTitle}>{item.title}</Text>
                {!!item.subtitle && <Text style={s.activitySubtitle}>{item.subtitle}</Text>}
              </View>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Documents</Text>
          {documents.length === 0 && <Text style={s.emptyHint}>No documents on file.</Text>}
          {documents.map((doc, index) => (
            <Pressable
              key={doc.name}
              onPress={() => showToast('Document preview is coming soon.')}
              style={[s.documentRow, index === documents.length - 1 && s.documentRowLast]}
            >
              <View style={s.documentIcon}><AppIcon name="file" size={16} color={colors.blue} strokeWidth={1.9} /></View>
              <View style={s.grow}>
                <Text style={s.documentText}>{doc.name}</Text>
                {!!(doc.type || doc.size) && (
                  <Text style={s.documentSubtext}>{[doc.type, doc.size].filter(Boolean).join(' · ')}</Text>
                )}
              </View>
              <AppIcon name="chevron-right" size={16} color="#B0B8C4" strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, last && s.infoRowLast]}>
      <Text style={s.employmentLabel}>{label}</Text>
      <Text style={s.employmentValue}>{value || '—'}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { height: 56, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 30, height: 38, alignItems: 'flex-start', justifyContent: 'center', marginRight: 6 },
  title: { fontSize: 18, fontWeight: '700', color: colors.blue },
  scrollArea: { flex: 1 },
  content: { padding: 14, paddingBottom: 30 },
  grow: { flex: 1 },

  profileCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 14, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF' },
  name: { fontSize: 19, fontWeight: '700', color: '#17243A', marginTop: 12 },
  meta: { fontSize: 13, color: '#667085', marginTop: 3 },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E9FBF0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedBadgeText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  pendingBadgeText: { color: '#B7791F' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E6FFFB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeLeave: { backgroundColor: '#FFF6E5' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  statusDotLeave: { backgroundColor: colors.amber },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: colors.blue },
  statusBadgeTextLeave: { color: '#B7791F' },

  contactBlock: { marginTop: 14, alignItems: 'center', gap: 5 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  contactText: { fontSize: 13, color: '#526078' },

  messageButtonWrap: { width: '100%', marginTop: 18 },
  messageButton: { height: 46, borderRadius: 12, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  messageButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  editButton: { width: '100%', height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D2DAE6', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  editButtonText: { fontSize: 15, fontWeight: '700', color: colors.blue },

  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 14, padding: 15, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#17243A', marginBottom: 12 },
  headerLink: { fontSize: 13, fontWeight: '700', color: colors.blue, marginBottom: 12 },
  emptyHint: { fontSize: 13, color: '#8E9DB0' },

  employmentGrid: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  employmentItem: { flex: 1 },
  employmentLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: '#8A94A4', textTransform: 'uppercase', marginBottom: 6 },
  employmentValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  employmentValue: { fontSize: 14, fontWeight: '600', color: '#17243A' },
  rolePill: { alignSelf: 'flex-start', backgroundColor: colors.paleBlue, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillText: { fontSize: 13, fontWeight: '700', color: colors.blue },
  infoRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF1F5', marginTop: 12 },
  infoRowLast: {},

  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  scheduleRowLast: { borderBottomWidth: 0 },
  scheduleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  scheduleTitle: { fontSize: 14.5, fontWeight: '700', color: '#17243A' },
  scheduleTime: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  scheduleRight: { alignItems: 'flex-end', gap: 5 },
  scheduleDay: { fontSize: 12, fontWeight: '600', color: '#8A94A4' },
  schedulePill: { backgroundColor: '#F1F4F8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  schedulePillActive: { backgroundColor: colors.paleBlue },
  schedulePillText: { fontSize: 11, fontWeight: '700', color: '#667085' },
  schedulePillTextActive: { color: colors.blue },
  viewCalendarButton: { alignItems: 'center', paddingTop: 13 },
  viewCalendarText: { fontSize: 13.5, fontWeight: '700', color: colors.blue },

  activityRow: { flexDirection: 'row' },
  activityMarkerCol: { width: 18, alignItems: 'center' },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue, marginTop: 5 },
  activityLine: { width: 2, flex: 1, backgroundColor: '#E1E6EE', marginVertical: 2 },
  activityContent: { paddingBottom: 16, paddingLeft: 10 },
  activityTime: { fontSize: 11.5, fontWeight: '600', color: '#8A94A4' },
  activityTitle: { fontSize: 14.5, fontWeight: '700', color: '#17243A', marginTop: 2 },
  activitySubtitle: { fontSize: 12.5, color: '#667085', marginTop: 2 },

  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  documentRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  documentIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  documentText: { fontSize: 14, fontWeight: '600', color: '#26364D' },
  documentSubtext: { fontSize: 12, color: '#8A94A4', marginTop: 2 },
});
