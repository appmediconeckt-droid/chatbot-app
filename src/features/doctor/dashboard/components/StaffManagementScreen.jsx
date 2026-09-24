// Staff Management — bottom-nav tab for the Doctor dashboard.
// Real backend: /api/staff (doctor-owned directory records, no login —
// see staffApi.js / staffModel.js). Search and role/department/status
// filtering run client-side over the fetched roster.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import CreateStaffScreen from './CreateStaffScreen';
import StaffProfileScreen from './StaffProfileScreen';
import StaffEditProfileScreen from './StaffEditProfileScreen';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { deleteStaff, fetchStaff } from './staffApi';

const ROLES = ['All', 'Nurse', 'Medical Assistant', 'Lab Technician', 'Billing', 'Housekeeping', 'Supervisor', 'Receptionist'];
const DEPARTMENTS = ['All', 'Emergency', 'Pathology', 'Finance', 'Admin', 'General Medicine', 'Housekeeping', 'General'];
const STATUSES = ['All', 'Active', 'On Leave', 'Suspended'];

export default function StaffManagementScreen({ onCreateStaffOpenChange, onStaffProfileOpenChange }) {
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

  useEffect(() => () => onCreateStaffOpenChange?.(false), [onCreateStaffOpenChange]);
  useEffect(() => () => onStaffProfileOpenChange?.(false), [onStaffProfileOpenChange]);

  const confirmDelete = (member) => {
    Alert.alert('Remove Staff Member', `Remove ${member.name} from your staff directory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStaff(member.rawId);
            setStaffList((current) => current.filter((item) => item.rawId !== member.rawId));
            showToast('Staff member removed');
          } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to remove staff member');
          }
        },
      },
    ]);
  };

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

  const pickerConfig = {
    role: { label: 'Role', options: ROLES, value: roleFilter, onSelect: setRoleFilter },
    dept: { label: 'Department', options: DEPARTMENTS, value: deptFilter, onSelect: setDeptFilter },
    status: { label: 'Status', options: STATUSES, value: statusFilter, onSelect: setStatusFilter },
  }[picker];

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={s.statIcon}><AppIcon name="users" size={17} color={colors.blue} strokeWidth={2} /></View>
            <Text style={s.statValue}>{staffList.length}</Text>
            <Text style={s.statLabel}>Total Staff</Text>
          </View>
          <View style={s.statCard}>
            <View style={s.statIcon}><AppIcon name="check" size={17} color={colors.blue} strokeWidth={2} /></View>
            <Text style={s.statValue}>{activeCount}</Text>
            <Text style={s.statLabel}>Active Now</Text>
          </View>
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
            {visible.map((member) => (
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
          </View>
        )}
      </ScrollView>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={s.overlay} onPress={() => setPicker(null)}>
          <View style={s.sheet}>
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
      <Text style={s.filterChipText} numberOfLines={1}>
        {label}: <Text style={s.filterChipValue}>{value}</Text>
      </Text>
      <AppIcon name="chevron-down" size={13} color="#526078" strokeWidth={2.4} />
    </Pressable>
  );
}

function StaffCard({ member, onPress, onMore }) {
  const isActive = member.status === 'Active';
  const isVerified = member.verification === 'Verified';
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.cardTop}>
        <Image source={{ uri: member.image }} style={s.avatar} />
        <View style={s.identity}>
          <Text style={s.name} numberOfLines={1}>{member.name}</Text>
          <Text style={s.subline} numberOfLines={1}>{member.email} · {member.id}</Text>
        </View>
        <Pressable onPress={onMore} hitSlop={8} style={s.moreButton}>
          <AppIcon name="more" size={17} color="#8A94A4" />
        </Pressable>
      </View>

      <Text style={s.sectionLabel}>Department &amp; Role</Text>

      <View style={s.deptRow}>
        <Text style={s.deptText}>{member.department}</Text>
        <View style={s.verifyRow}>
          <AppIcon name={isVerified ? 'check-mark' : 'clock'} size={12} color={isVerified ? '#16A34A' : '#B7791F'} strokeWidth={2.6} />
          <Text style={[s.verifyText, isVerified ? s.verifyTextOn : s.verifyTextPending]}>{member.verification}</Text>
        </View>
      </View>

      <View style={s.pillRow}>
        <View style={s.rolePill}><Text style={s.rolePillText}>{member.role}</Text></View>
        <View style={[s.statusPill, isActive ? s.statusOn : s.statusLeave]}>
          <View style={[s.statusDot, isActive ? s.dotOn : s.dotLeave]} />
          <Text style={[s.statusText, isActive ? s.statusTextOn : s.statusTextLeave]}>{member.status}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  content: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 18 },

  statsRow: { flexDirection: 'row', gap: 11, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D2DAE6',
    borderRadius: 14,
    padding: 13,
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#17243A' },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#667085', marginTop: 2 },

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
    borderColor: '#D2DAE6',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 11 },
  identity: { flex: 1 },
  name: { fontSize: 15.5, fontWeight: '700', color: '#12213A' },
  subline: { fontSize: 12, color: '#7B8493', marginTop: 2 },
  moreButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, color: '#98A2B3', textTransform: 'uppercase', marginTop: 13, marginBottom: 7 },
  deptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deptText: { fontSize: 14, fontWeight: '600', color: '#26364D' },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyText: { fontSize: 12, fontWeight: '700' },
  verifyTextOn: { color: '#16A34A' },
  verifyTextPending: { color: '#B7791F' },

  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  rolePill: { backgroundColor: colors.paleBlue, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  rolePillText: { fontSize: 12, fontWeight: '700', color: colors.blue },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusOn: { backgroundColor: '#E6FFFB' },
  statusLeave: { backgroundColor: '#FFF6E5' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: '#16A34A' },
  dotLeave: { backgroundColor: colors.amber },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  statusTextOn: { color: colors.blue },
  statusTextLeave: { color: '#B7791F' },

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
