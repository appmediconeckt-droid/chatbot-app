// QR Code — the bottom-bar QR button and the sidebar "QR Code" item. Same as
// the web /qrcode page (AppointmentQR/AllQRcode.jsx): the clinic walk-in QR
// patients scan to join today's queue, QR management and the clinic LED
// display (see ClinicQrLedSection). The doctor's own profile QR is a separate
// screen, Settings → Profile QR (DoctorProfileCardQrScreen), as on the web —
// showing both here put two different QR codes on one page.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import ClinicQrLedSection from './ClinicQrLedSection';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';

export default function DoctorProfileQrScreen({ onBack }) {
  // Signup-style keyboard handling: the form scrolls above the keyboard and the
  // focused field is scrolled into view (the window does not resize, edge-to-edge).
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  const [doctorId, setDoctorId] = useState(null);

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = pickFirst(user?.doctor_id, user?.doctorId, user?.user?.id, user?.id, user?._id, user?.user_id);
      if (id) setDoctorId(String(id));
    });
  }, []);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>QR Code</Text>
      </View>
      <ScrollView  showsVerticalScrollIndicator={false} ref={kbScrollRef} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        <ClinicQrLedSection doctorId={doctorId} />
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 12, paddingBottom: 36 },
});
