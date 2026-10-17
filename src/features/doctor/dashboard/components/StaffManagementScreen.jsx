// Staff Management — bottom-nav tab for the Doctor dashboard.
// Real backend: /api/staff (doctor-owned directory records, no login —
// see staffApi.js / staffModel.js). Search and role/department/status
// filtering run client-side over the fetched roster.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import CreateStaffScreen from './CreateStaffScreen';
import StaffProfileScreen from './StaffProfileScreen';
import StaffEditProfileScreen from './StaffEditProfileScreen';
import RemoveStaffModal from './RemoveStaffModal';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import { deleteStaff, fetchStaff } from './staffApi';

const ROLES = ['All', 'Nurse', 'Medical Assistant', 'Lab Technician', 'Billing', 'Housekeeping', 'Supervisor', 'Receptionist'];
const DEPARTMENTS = ['All', 'Nursing', 'Clinical', 'Emergency', 'Pathology', 'Finance', 'Operations', 'Admin', 'General Medicine', 'General'];
const STATUSES = ['All', 'Active', 'On Leave', 'Suspended'];
const PAGE_SIZE = 10;

// Stat tiles: a solid icon colour and a light border in the same hue.
const TONES = {
  teal: { fg: '#0D9488', border: '#B7EDE5' },
  green: { fg: '#16A34A', border: '#BBF0CC' },
};

// Staff status colours (pill + the dot on the avatar).
const STATUS_TONES = {
  Active: { fg: '#047857', bg: '#D1FAE5', dot: '#16A34A' },
  'On Leave': { fg: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  Suspended: { fg: '#B42318', bg: '#FEE4E2', dot: '#DC2626' },
};

// Avatar fallback: a steady colour per name, like the Patients tab.
const AVATAR_COLORS = ['#0D9488', '#4F46E5', '#D97706', '#0369A1', '#E11D48', '#7C3AED'];
const avatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export default function StaffManagementScreen({ onCreateStaffOpenChange, onStaffProfileOpenChange }) {
  // Bottom sheets live in Modals, which draw under the system navigation
  // bar (edge-to-edge) — pad them by its height so their last row stays visible.
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [picker, setPicker] = useState(null);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [viewingMember, setViewingMember] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [page, setPage] = useState(1);
  // Staff member waiting for confirmation in the Remove popup.
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchStaff();
      setStaffList(list);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // A new search / filter starts again from the first page.
  useEffect(() => { setPage(1); }, [search, roleFilter, deptFilter, statusFilter]);

  useEffect(() => () => onCreateStaffOpenChange?.(false), [onCreateStaffOpenChange]);
  useEffect(() => () => onStaffProfileOpenChange?.(false), [onStaffProfileOpenChange]);

  const confirmDelete = (member) => {
    setRemoveError('');
    setPendingRemove(member);
  };

  const closeRemove = () => {
    if (removing) return;
    setPendingRemove(null);
    setRemoveError('');
  };

  const handleRemove = async () => {
    const member = pendingRemove;
    if (!member) return;
    setRemoving(true);
    setRemoveError('');
    try {
      await deleteStaff(member.rawId);
      setStaffList((current) => current.filter((item) => item.rawId !== member.rawId));
      setPendingRemove(null);
      showToast(`${member.name} removed`);
    } catch (error) {
      setRemoveError(error?.response?.data?.message || error?.response?.data?.error || 'Failed to remove staff member. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  useDoctorBack(() => {
    if (editingMember) {
      setEditingMember(null);
      return true;
    }
    if (viewingMember) {
      setViewingMember(null);
      onStaffProfileOpenChange?.(false);
      return true;
    }
    return false;
  });

  if (creatingStaff) {
    return (
      <CreateStaffScreen
        onCancel={() => {
          setCreatingStaff(false);
          onCreateStaffOpenChange?.(false);
        }}
        onCreated={(created) => {
          setStaffList((current) => [created, ...current]);
          setCreatingStaff(false);
          onCreateStaffOpenChange?.(false);
        }}
      />
    );
  }

  if (editingMember) {
    return (
      <StaffEditProfileScreen
        member={editingMember}
        onCancel={() => setEditingMember(null)}
        onSave={(updated) => {
          setStaffList((current) => current.map((item) => (item.rawId === updated.rawId ? updated : item)));
          setViewingMember(updated);
          setEditingMember(null);
          showToast('Staff profile updated.');
        }}
      />
    );
  }

  if (viewingMember) {
    return (
      <StaffProfileScreen
        member={viewingMember}
        onBack={() => {
          setViewingMember(null);
          onStaffProfileOpenChange?.(false);
        }}
        onEdit={() => setEditingMember(viewingMember)}
        onUpdated={(updated) => {
          setStaffList((current) => current.map((item) => (item.rawId === updated.rawId ? updated : item)));
          setViewingMember(updated);
        }}
      />
    );
  }

  const activeCount = staffList.filter((member) => member.status === 'Active').length;
  const query = search.trim().toLowerCase();

  const visible = staffList.filter((member) => {
    const matchesQuery =
      !query ||
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.id.toLowerCase().includes(query);
    return (
      matchesQuery &&
      (roleFilter === 'All' || member.role === roleFilter) &&
      (deptFilter === 'All' || member.department === deptFilter) &&
      (statusFilter === 'All' || member.status === statusFilter)
    );
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const first = (safePage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(first, first + PAGE_SIZE);

  const pickerConfig = {
    role: { label: 'Role', options: ROLES, value: roleFilter, onSelect: setRoleFilter },
    dept: { label: 'Department', options: DEPARTMENTS, value: deptFilter, onSelect: setDeptFilter },
    status: { label: 'Status', options: STATUSES, value: statusFilter, onSelect: setStatusFilter },
  }[picker];

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.statsRow}>
          {[
            { label: 'Total Staff', value: staffList.length, icon: 'users', tone: TONES.teal },
            { label: 'Active Now', value: activeCount, icon: 'check', tone: TONES.green },
          ].map((item) => (
            <View key={item.label} style={[s.statCard, { borderColor: item.tone.border }]}>
              <View style={[s.statIcon, { backgroundColor: item.tone.fg }]}>
                <AppIcon name={item.icon} size={19} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <View style={s.statBody}>
                <Text translate={false} style={s.statValue}>{item.value}</Text>
                <Text style={s.statLabel} numberOfLines={1}>{item.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.titleRow}>
          <Text style={s.title}>Staff Directory</Text>
          <Pressable
            style={s.addButton}
            onPress={() => {
              setCreatingStaff(true);
              onCreateStaffOpenChange?.(true);
            }}
          >
            <AppIcon name="plus" size={15} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={s.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <View style={s.search}>
          <AppIcon name="search" size={17} color="#778195" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
            placeholder="Search by name, ID or email..."
            placeholderTextColor="#818A9C"
          />
        </View>

        <View style={s.filterRow}>
          <FilterChip label="Role" value={roleFilter} onPress={() => setPicker('role')} />
          <FilterChip label="Dept" value={deptFilter} onPress={() => setPicker('dept')} />
          <FilterChip label="Status" value={statusFilter} onPress={() => setPicker('status')} />
        </View>

        {loading ? (
          <View style={s.empty}><ActivityIndicator color={colors.blue} /></View>
        ) : (
          <View style={s.cards}>
            {pageRows.map((member) => (
              <StaffCard
                key={member.rawId}
                member={member}
                onPress={() => {
                  setViewingMember(member);
                  onStaffProfileOpenChange?.(true);
                }}
                onMore={() => confirmDelete(member)}
              />
            ))}
            {visible.length === 0 && (
              <View style={s.empty}><Text style={s.emptyText}>No staff match your search.</Text></View>
            )}
            {visible.length > 0 && (
              <View style={s.pagination}>
                <Text style={s.pageInfo}>Showing {first + 1} to {Math.min(first + PAGE_SIZE, visible.length)} of {visible.length} staff</Text>
                <View style={s.pageBtns}>
                  <Pressable disabled={safePage === 1} onPress={() => setPage(safePage - 1)} hitSlop={6} style={[s.pageBtn, safePage === 1 && s.pageBtnDisabled]}>
                    <AppIcon name="chevron-left" size={15} color={colors.blue} strokeWidth={2.6} />
                  </Pressable>
                  <Text translate={false} style={s.pageNow}>{safePage} / {totalPages}</Text>
                  <Pressable disabled={safePage === totalPages} onPress={() => setPage(safePage + 1)} hitSlop={6} style={[s.pageBtn, safePage === totalPages && s.pageBtnDisabled]}>
                    <AppIcon name="chevron-right" size={15} color={colors.blue} strokeWidth={2.6} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <RemoveStaffModal
        visible={!!pendingRemove}
        member={pendingRemove}
        removing={removing}
        error={removeError}
        onCancel={closeRemove}
        onConfirm={handleRemove}
      />

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={s.overlay} onPress={() => setPicker(null)}>
          <View style={[s.sheet, { paddingBottom: 28 + insets.bottom }]}>
            <View style={s.handle} />
            {pickerConfig && (
              <>
                <Text style={s.sheetTitle}>{pickerConfig.label}</Text>
                {pickerConfig.options.map((option) => {
                  const active = pickerConfig.value === option;
                  return (
                    <Pressable
                      key={option}
                      style={s.sheetOption}
                      onPress={() => {
                        pickerConfig.onSelect(option);
                        setPicker(null);
                      }}
                    >
                      <Text style={[s.sheetOptionText, active && s.sheetOptionTextActive]}>{option}</Text>
                      {active && <AppIcon name="check-mark" size={16} color={colors.blue} strokeWidth={2.6} />}
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function FilterChip({ label, value, onPress }) {
  return (
    <Pressable onPress={onPress} style={s.filterChip}>
      <Text translate={false} style={s.filterChipText} numberOfLines={1}>
        {label}: <Text translate={false} style={s.filterChipValue}>{value}</Text>
      </Text>
      <AppIcon name="chevron-down" size={13} color="#526078" strokeWidth={2.4} />
    </Pressable>
  );
}

function StaffCard({ member, onPress, onMore }) {
  const tone = STATUS_TONES[member.status] || STATUS_TONES.Active;
  const initial = String(member.name || '?').trim().charAt(0).toUpperCase();
  const subline = [member.id, member.email].filter(Boolean).join('  ·  ');
  return (
    // Press feedback is a tint, not an opacity fade (fading an elevated card
    // makes Android draw its shadow as a rectangle).
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={onPress}>
      <View style={s.cardTop}>
        <View style={s.avatarWrap}>
          {member.image ? (
            <Image source={{ uri: member.image }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback, { backgroundColor: avatarColor(member.name) }]}>
              <Text translate={false} style={s.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={[s.avatarDot, { backgroundColor: tone.dot }]} />
        </View>
        <View style={s.identity}>
          <Text translate={false} style={s.name} numberOfLines={1}>{member.name}</Text>
          {!!subline && <Text translate={false} style={s.subline} numberOfLines={1}>{subline}</Text>}
        </View>
        <Pressable onPress={onMore} hitSlop={8} style={({ pressed }) => [s.moreButton, pressed && s.moreButtonPressed]}>
          <AppIcon name="more" size={16} color="#667085" />
        </Pressable>
      </View>

      <View style={s.pillRow}>
        <View style={s.rolePill}>
          <AppIcon name="briefcase" size={11} color={colors.blue} strokeWidth={2.2} />
          <Text style={s.rolePillText} numberOfLines={1}>{member.role}</Text>
        </View>
        {!!member.department && (
          <View style={s.deptPill}>
            <AppIcon name="home" size={11} color="#4F46E5" strokeWidth={2.2} />
            <Text style={s.deptPillText} numberOfLines={1}>{member.department}</Text>
          </View>
        )}
        <View style={[s.statusPill, { backgroundColor: tone.bg }]}>
          <View style={[s.statusDot, { backgroundColor: tone.dot }]} />
          <Text style={[s.statusText, { color: tone.fg }]}>{member.status}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 18 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1, minWidth: 0 },
  statValue: { fontSize: 22, lineHeight: 26, fontWeight: '800', color: '#17243A' },
  statLabel: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: '#667085', marginTop: 1 },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '700', color: colors.blue },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blue, borderRadius: 18, height: 34, paddingHorizontal: 14 },
  addButtonText: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },

  search: { height: 40, borderWidth: 1, borderColor: '#BFC8D8', backgroundColor: '#F9FAFE', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },

  filterRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 18 },
  filterChip: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderColor: '#C8D1E0',
    borderRadius: 17,
    backgroundColor: '#FAFBFF',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  filterChipText: { flex: 1, fontSize: 12.5, fontWeight: '500', color: '#667085' },
  filterChipValue: { fontWeight: '700', color: '#17243A' },

  cards: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EEEC',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardPressed: { backgroundColor: '#F6FBFA' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 50, height: 50 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EEF2F6' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  avatarDot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF' },
  identity: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '800', color: '#12213A' },
  subline: { fontSize: 12.5, color: '#7B8493', marginTop: 2 },
  moreButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F9' },
  moreButtonPressed: { backgroundColor: '#E6EAF0' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 12 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: colors.paleBlue, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rolePillText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: colors.blue },
  deptPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  deptPillText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#4338CA' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  pageInfo: { flex: 1, fontSize: 12, color: '#667085' },
  pageBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1E0', alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
  pageNow: { fontSize: 12.5, fontWeight: '700', color: '#344054' },

  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#8E9DB0' },

  overlay: { flex: 1, backgroundColor: 'rgba(18,28,45,.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 17 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#17243A', marginBottom: 6 },
  sheetOption: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  sheetOptionText: { fontSize: 15, fontWeight: '500', color: '#26364D' },
  sheetOptionTextActive: { fontWeight: '700', color: colors.blue },
});
