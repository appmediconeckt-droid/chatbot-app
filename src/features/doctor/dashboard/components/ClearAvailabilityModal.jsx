// Confirmation popup for Calendar & Availability → Clear All. Same look as
// DeleteClinicModal; stays open while the request runs and shows the
// server's reason inline if clearing fails.
import React from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';

const CLEARED = [
  { icon: 'calendar', label: 'Selected days' },
  { icon: 'refresh', label: 'Repeating weekdays' },
  { icon: 'clock', label: 'Saved time ranges & slots' },
];

export default function ClearAvailabilityModal({
  visible,
  clinicName,
  clearing = false,
  error = '',
  onCancel,
  onConfirm,
}) {
  const close = () => !clearing && onCancel?.();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={s.backdrop}>
        <Pressable style={s.backdropTap} onPress={close} />
        <View style={s.card}>
          <View style={s.iconRing}>
            <View style={s.iconCircle}>
              <AppIcon name="trash" size={26} color="#DC2626" strokeWidth={2.2} />
            </View>
          </View>

          <Text style={s.title}>Clear all availability?</Text>
          <Text style={s.subtitle}>This can't be undone.</Text>

          <View style={s.clinicBox}>
            <View style={s.clinicIcon}>
              <AppIcon name="briefcase" size={16} color="#0D9488" strokeWidth={2} />
            </View>
            <Text translate={false} style={s.clinicName} numberOfLines={1}>
              {clinicName || 'Selected clinic'}
            </Text>
          </View>

          <View style={s.list}>
            {CLEARED.map((item) => (
              <View key={item.label} style={s.listRow}>
                <View style={s.listIcon}>
                  <AppIcon name={item.icon} size={13} color="#DC2626" strokeWidth={2.2} />
                </View>
                <Text style={s.listText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.note}>
            <AppIcon name="info" size={14} color="#0369A1" strokeWidth={2.2} />
            <Text style={s.noteText}>Dates you marked unavailable stay blocked.</Text>
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <AppIcon name="warning" size={14} color="#B91C1C" strokeWidth={2.2} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.actions}>
            <Pressable style={({ pressed }) => [s.btn, s.cancelBtn, pressed && s.pressed]} onPress={close} disabled={clearing}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.btn, s.clearBtn, clearing && s.busy, pressed && s.pressed]}
              onPress={onConfirm}
              disabled={clearing}
            >
              {clearing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon name="trash" size={15} color="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text style={s.clearText}>{clearing ? 'Clearing…' : 'Clear All'}</Text>
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
  clinicBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clinicIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  clinicName: { flex: 1, fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  list: { alignSelf: 'stretch', marginTop: 12, gap: 8, paddingHorizontal: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  listText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#334155' },
  note: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#075985' },
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
  clearBtn: { backgroundColor: '#DC2626' },
  clearText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  busy: { opacity: 0.85 },
  pressed: { opacity: 0.8 },
});
