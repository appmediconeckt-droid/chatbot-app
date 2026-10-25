// Optional Add / Edit vitals during a consultation — the same form the
// receptionist uses before the checkup, in a bottom sheet.
import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../../components/TranslatedText';
import VitalsForm, { hasAnyVitals } from '../../../../components/VitalsForm';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import { getTokenLabel } from '../api/doctorAppointments';
import { saveDoctorAppointmentVitals } from '../api/doctorVitals';

const TEAL = '#0D9488';

export default function DoctorVitalsSheet({ appointment, visible, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const {
    scrollRef,
    keyboardOpen,
    keyboardTop,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true, layoutAvoidsKeyboard: true });
  const editing = hasAnyVitals(appointment?.vitals);

  const requestClose = () => {
    if (saving) return;
    if (keyboardOpen) Keyboard.dismiss();
    else onClose();
  };

  return (
    <Modal visible={Boolean(visible && appointment)} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessible={false} />
        {/* While typing, the frame ends at the keyboard so Save stays above it. */}
        <View pointerEvents="box-none" style={[s.frame, { paddingTop: insets.top + 12 }, keyboardOpen && keyboardTop > 0 && { height: keyboardTop }]}>
          <View style={[s.sheet, keyboardOpen && s.sheetKeyboard, { paddingBottom: keyboardOpen ? 12 : 18 + insets.bottom }]}>
            {!!appointment && (
              <>
                <View style={s.handle} />
                <View style={s.head}>
                  <View style={s.headIcon}><Ionicons name="pulse" size={18} color={TEAL} /></View>
                  <View style={s.flex}>
                    <Text style={s.eyebrow}>{editing ? 'EDIT VITALS' : 'ADD VITALS'} · OPTIONAL</Text>
                    <Text translate={false} style={s.name} numberOfLines={1}>{appointment.name || 'Patient'}</Text>
                    <Text translate={false} style={s.meta}>{getTokenLabel(appointment)}</Text>
                  </View>
                  <Pressable onPress={requestClose} disabled={saving} style={s.close} hitSlop={8} accessibilityLabel="Close vitals">
                    <Ionicons name="close" size={20} color="#1F2937" />
                  </Pressable>
                </View>
                <ScrollView
                  ref={scrollRef}
                  style={s.scroll}
                  contentContainerStyle={s.scrollContent}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="none"
                  onScroll={handleKeyboardAwareScroll}
                  onLayout={handleKeyboardAwareScrollLayout}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                >
                  <VitalsForm
                    key={String(appointment.apiId || appointment.id)}
                    initialVitals={appointment.vitals}
                    color={TEAL}
                    onInputFocus={scrollFocusedInputIntoView}
                    onBusyChange={setSaving}
                    onSubmit={async (draft) => {
                      const saved = await saveDoctorAppointmentVitals(appointment, draft);
                      onSaved?.(saved);
                    }}
                  />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
  frame: { height: '100%', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 720, alignSelf: 'center', height: '86%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10 },
  sheetKeyboard: { height: '100%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F5' },
  headIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: TEAL },
  name: { fontSize: 18, fontWeight: '800', color: '#17243A', marginTop: 2 },
  meta: { fontSize: 12.5, color: '#667085', marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F5F7', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingTop: 16, paddingBottom: 24 },
});
