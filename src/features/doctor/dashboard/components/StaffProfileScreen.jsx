// Staff Profile — opened by tapping a staff card in Staff Management.
// Current Schedule shows the staff member's shift (web shift field); Assign
// Shift saves a new one with PUT /api/staff/:id. Documents are real files
// kept on this device (see staffDocuments.js). Edit Profile hands off to
// StaffEditProfileScreen via onEdit.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { SHIFTS, isOnShiftNow, shiftInfo, updateStaff } from './staffApi';
import { addStaffDocument, loadStaffDocuments, openStaffDocument, removeStaffDocument } from './staffDocuments';

const formatLongDate = (isoDate) => {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function StaffProfileScreen({ member, onBack, onEdit, onUpdated }) {
  const { showToast } = useToast();
  const isActive = member.status === 'Active';
  const isVerified = member.verification === 'Verified';
  const activity = member.activity ?? [];
  const shift = shiftInfo(member.shift);
  const onShift = isActive && isOnShiftNow(shift.key);

  const [shiftSheet, setShiftSheet] = useState(false);
  const [savingShift, setSavingShift] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStaffDocuments(member.rawId).then((list) => { if (!cancelled) setDocuments(list); });
    return () => { cancelled = true; };
  }, [member.rawId]);

  const assignShift = useCallback(async (nextShift) => {
    if (nextShift === shift.key) {
      setShiftSheet(false);
      return;
    }
    setSavingShift(nextShift);
    try {
      const updated = await updateStaff(member.rawId, {
        fullName: member.name,
        clinicId: member.clinicId,
        email: member.email,
        phone: member.phone,
        department: member.department,
        role: member.role,
        shift: nextShift,
        status: member.status,
      });
      onUpdated?.({ ...member, ...updated, shift: updated.shift || nextShift });
      setShiftSheet(false);
      showToast(`${member.name} assigned to the ${nextShift} shift.`);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Could not assign the shift.');
    } finally {
      setSavingShift(null);
    }
  }, [member, onUpdated, shift.key, showToast]);

  const uploadDocument = async () => {
    setUploading(true);
    try {
      const list = await addStaffDocument(member.rawId);
      if (list) {
        setDocuments(list);
        showToast('Document added.');
      }
    } catch (err) {
      showToast(err?.message || 'Could not add the document.');
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (doc) => {
    try {
      await openStaffDocument(doc);
    } catch (err) {
      showToast(err?.message || 'No app found to open this document.');
    }
  };

  const deleteDocument = (doc) => {
    Alert.alert('Remove document', `Remove "${doc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => setDocuments(await removeStaffDocument(member.rawId, doc.id)),
      },
    ]);
  };

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
          <Text translate={false} style={s.name}>{member.name}</Text>
          <Text style={s.meta}>{member.id ? `#${String(member.id).replace(/^#/, '')} · ` : ''}{member.department} {member.role}</Text>

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
              <Text translate={false} style={s.contactText}>{member.email}</Text>
            </View>
            {!!member.phone && (
              <View style={s.contactRow}>
                <AppIcon name="phone" size={13} color="#8A94A4" strokeWidth={1.9} />
                <Text translate={false} style={s.contactText}>{member.phone}</Text>
              </View>
            )}
          </View>

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
            <Pressable onPress={() => setShiftSheet(true)} hitSlop={6}>
              <Text style={s.headerLink}>Assign Shift</Text>
            </Pressable>
          </View>
          <View style={[s.scheduleRow, s.scheduleRowLast]}>
            <View style={s.scheduleIcon}><AppIcon name="clock" size={16} color={colors.blue} strokeWidth={2} /></View>
            <View style={s.grow}>
              <Text style={s.scheduleTitle}>{shift.key} Shift</Text>
              <Text style={s.scheduleTime}>{shift.label}</Text>
            </View>
            <View style={s.scheduleRight}>
              <Text style={s.scheduleDay}>Daily</Text>
              <View style={[s.schedulePill, onShift && s.schedulePillActive]}>
                <Text style={[s.schedulePillText, onShift && s.schedulePillTextActive]}>
                  {!isActive ? member.status : onShift ? 'On shift now' : 'Off shift'}
                </Text>
              </View>
            </View>
          </View>
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
          {documents.length === 0 && <Text style={s.emptyHint}>No documents yet. Add ID proof, certificates or contracts.</Text>}
          {documents.map((doc) => (
            <Pressable key={doc.id} onPress={() => openDocument(doc)} style={s.documentRow}>
              <View style={[s.documentIcon, doc.type === 'PDF' && s.documentIconPdf]}>
                <AppIcon name="file" size={16} color={doc.type === 'PDF' ? '#D2564B' : colors.blue} strokeWidth={1.9} />
              </View>
              <View style={s.grow}>
                <Text translate={false} style={s.documentText} numberOfLines={1}>{doc.name}</Text>
                <Text style={s.documentSubtext}>{[doc.type, doc.size].filter(Boolean).join(' · ')}</Text>
              </View>
              <Pressable onPress={() => deleteDocument(doc)} hitSlop={8} style={s.documentDelete}>
                <AppIcon name="trash" size={15} color="#98A2B3" strokeWidth={1.9} />
              </Pressable>
            </Pressable>
          ))}
          <Pressable style={[s.uploadButton, uploading && s.uploadButtonBusy]} onPress={uploadDocument} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={colors.blue} />
              : <AppIcon name="upload" size={14} color={colors.blue} strokeWidth={2.2} />}
            <Text style={s.uploadButtonText}>{uploading ? 'Adding…' : 'Upload Document'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={shiftSheet} transparent animationType="fade" onRequestClose={() => !savingShift && setShiftSheet(false)}>
        <Pressable style={s.overlay} onPress={() => !savingShift && setShiftSheet(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Assign Shift</Text>
            <Text translate={false} style={s.sheetSub}>Choose the shift for {member.name}.</Text>
            {SHIFTS.map((option) => {
              const current = option.key === shift.key;
              return (
                <Pressable
                  key={option.key}
                  style={[s.shiftOption, current && s.shiftOptionActive]}
                  onPress={() => assignShift(option.key)}
                  disabled={Boolean(savingShift)}
                >
                  <View style={s.grow}>
                    <Text style={[s.shiftOptionTitle, current && s.shiftOptionTitleActive]}>{option.key} Shift</Text>
                    <Text style={s.shiftOptionTime}>{option.label}</Text>
                  </View>
                  {savingShift === option.key
                    ? <ActivityIndicator size="small" color={colors.blue} />
                    : current && <AppIcon name="check-mark" size={16} color={colors.blue} strokeWidth={2.6} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, last && s.infoRowLast]}>
      <Text style={s.employmentLabel}>{label}</Text>
      <Text translate={false} style={s.employmentValue}>{value || '—'}</Text>
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

  editButton: { width: '100%', height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D2DAE6', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
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
  documentIconPdf: { backgroundColor: '#FDF1F1' },
  documentDelete: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, marginTop: 12, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9FD8D0', backgroundColor: '#F7FDFC' },
  uploadButtonBusy: { opacity: 0.7 },
  uploadButtonText: { fontSize: 13.5, fontWeight: '700', color: colors.blue },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D6DCE5', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sheetSub: { fontSize: 13, color: '#64748B', marginTop: 3, marginBottom: 12 },
  shiftOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 },
  shiftOptionActive: { borderColor: '#5EEAD4', backgroundColor: '#F0FDFA' },
  shiftOptionTitle: { fontSize: 14.5, fontWeight: '700', color: '#0F172A' },
  shiftOptionTitleActive: { color: '#0F766E' },
  shiftOptionTime: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
});
