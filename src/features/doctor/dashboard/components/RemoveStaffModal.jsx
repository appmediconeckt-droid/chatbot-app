// Confirmation popup for removing a staff member (Staff tab "⋯" button).
// Same look as DeleteClinicModal. Stays open while the request runs and
// shows the server's reason if the staff member can't be removed.
import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';

export default function RemoveStaffModal({
  visible,
  member,
  removing = false,
  error = '',
  onCancel,
  onConfirm,
}) {
  const subline = [member?.role, member?.department].filter(Boolean).join(' · ');
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => !removing && onCancel?.()}
    >
      <View style={s.backdrop}>
        <Pressable style={s.backdropTap} onPress={() => !removing && onCancel?.()} />
        <View style={s.card}>
          <View style={s.iconRing}>
            <View style={s.iconCircle}>
              <AppIcon name="trash" size={26} color="#DC2626" strokeWidth={2.2} />
            </View>
          </View>

          <Text style={s.title}>Remove Staff Member?</Text>
          <Text style={s.subtitle}>This action cannot be undone.</Text>

          <View style={s.memberBox}>
            {member?.image
              ? <Image source={{ uri: member.image }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarEmpty]}><AppIcon name="user" size={18} color="#0D9488" /></View>}
            <View style={s.flex}>
              <Text translate={false} style={s.memberName} numberOfLines={1}>
                {member?.name || 'This staff member'}
              </Text>
              {!!subline && <Text style={s.memberRole} numberOfLines={1}>{subline}</Text>}
              {!!member?.email && (
                <Text translate={false} style={s.memberEmail} numberOfLines={1}>{member.email}</Text>
              )}
            </View>
          </View>

          <View style={s.warning}>
            <AppIcon name="info" size={14} color="#B45309" strokeWidth={2.2} />
            <Text style={s.warningText}>
              They will be removed from your staff list along with their shift and profile details.
            </Text>
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <AppIcon name="warning" size={14} color="#B91C1C" strokeWidth={2.2} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.actions}>
            <Pressable
              style={({ pressed }) => [s.btn, s.cancelBtn, pressed && s.pressed]}
              onPress={onCancel}
              disabled={removing}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.btn, s.removeBtn, removing && s.busy, pressed && s.pressed]}
              onPress={onConfirm}
              disabled={removing}
            >
              {removing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon name="trash" size={15} color="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text style={s.removeText}>{removing ? 'Removing…' : 'Remove'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = createDoctorStyles({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  backdropTap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconRing: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 14, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' },
  memberBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarEmpty: { backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  memberRole: { fontSize: 12, fontWeight: '600', color: '#0F766E', marginTop: 2 },
  memberEmail: { fontSize: 12, color: '#64748B', marginTop: 1 },
  warning: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#92400E' },
  errorBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: '#B91C1C', fontWeight: '600' },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, height: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cancelBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#334155' },
  removeBtn: { backgroundColor: '#DC2626' },
  removeText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  busy: { opacity: 0.85 },
  pressed: { opacity: 0.8 },
});
