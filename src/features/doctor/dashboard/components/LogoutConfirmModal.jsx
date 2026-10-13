// Doctor logout confirmation (sidebar and Settings). Teal doctor theme; stays
// open with a spinner while the server logout runs.
import React from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles, doctorGradient } from '../theme';

export default function LogoutConfirmModal({ visible, doctorName, loggingOut = false, onCancel, onConfirm }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => !loggingOut && onCancel?.()}
    >
      <View style={s.backdrop}>
        <Pressable style={s.backdropTap} onPress={() => !loggingOut && onCancel?.()} />
        <View style={s.card}>
          <LinearGradient colors={doctorGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconCircle}>
            <AppIcon name="logout" size={26} color="#FFFFFF" strokeWidth={2.2} />
          </LinearGradient>

          <Text style={s.title}>Logout</Text>
          <Text style={s.subtitle}>
            {doctorName ? `You're signed in as ${doctorName}.` : "You're signed in on this phone."}
          </Text>

          <View style={s.note}>
            <AppIcon name="info" size={14} color="#0F766E" strokeWidth={2.2} />
            <Text style={s.noteText}>
              You'll stop getting appointment and call notifications on this phone until you sign in again.
            </Text>
          </View>

          <View style={s.actions}>
            <Pressable
              style={({ pressed }) => [s.btn, s.cancelBtn, pressed && s.pressed]}
              onPress={onCancel}
              disabled={loggingOut}
            >
              <Text style={s.cancelText}>Stay signed in</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.btn, s.logoutBtn, pressed && s.pressed, loggingOut && s.busy]}
              onPress={onConfirm}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon name="logout" size={15} color="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text style={s.logoutText}>{loggingOut ? 'Logging out...' : 'Logout'}</Text>
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
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A', marginTop: 14 },
  subtitle: { fontSize: 13.5, color: '#64748B', marginTop: 4, textAlign: 'center' },
  note: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#115E59' },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, height: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cancelBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: '#334155' },
  logoutBtn: { backgroundColor: '#DC2626' },
  logoutText: { fontSize: 14.5, fontWeight: '800', color: '#FFFFFF' },
  busy: { opacity: 0.85 },
  pressed: { opacity: 0.8 },
});
