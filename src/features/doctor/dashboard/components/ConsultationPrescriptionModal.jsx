// "Prescription" on a completed queue card — port of the web dashboard's
// SummaryModal + common/PrescriptionDocument.jsx: the consultation record
// (patient, diagnosis, prescribed medicines, advice, notes, tests, follow-up)
// with Close and Download PDF.
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { downloadConsultationPrescriptionPdf } from '../utils/consultationPrescriptionPdf';

import ConsultationPrescriptionDocument from '../../../../screens/user/Component/UserDashboard/Tab/Prescription/ConsultationPrescriptionDocument';
import useDoctorPrescriptionDocument from '../useDoctorPrescriptionDocument';

export default function ConsultationPrescriptionModal({ visible, appointment, onClose }) {
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);
  const { data, error, retry } = useDoctorPrescriptionDocument(appointment, visible);
  if (!appointment) return null;

  // Same PDF as the web doctor dashboard (common/downloadPrescription.js).
  const download = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      await downloadConsultationPrescriptionPdf(data);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={s.backdropTap} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Consultation Prescription</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close prescription" onPress={onClose} hitSlop={8} style={s.closeIcon}>
              <AppIcon name="x" size={18} color="#475467" strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            {error ? (
              <View style={s.status}>
                <Text accessibilityRole="alert" style={s.error}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={retry} style={s.retry}>
                  <Text style={s.closeText}>Retry</Text>
                </Pressable>
              </View>
            ) : data ? (
              <ConsultationPrescriptionDocument data={data} bleed={12} />
            ) : (
              <View style={s.status}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={s.loadingText}>Loading prescription...</Text>
              </View>
            )}
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={s.closeBtn}><Text style={s.closeText}>Close</Text></Pressable>
            <Pressable onPress={download} disabled={!data || downloading} style={[s.downloadWrap, (!data || downloading) && s.disabled]}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.download}>
                {downloading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <AppIcon name="download" size={16} color="#FFF" strokeWidth={2.2} />}
                <Text style={s.downloadText}>{downloading ? 'Downloading...' : 'Download PDF'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = createDoctorStyles({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', paddingVertical: 24 },
  backdropTap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { width: '100%', maxWidth: 900, alignSelf: 'center', maxHeight: '92%', backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sheetTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#172033' },
  closeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { padding: 12 },
  status: { padding: 32, alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: '#64748B' },
  error: { fontSize: 14, color: '#B91C1C', textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 9 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  closeBtn: { flex: 1, height: 46, borderRadius: 9, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  downloadWrap: { flex: 1.4, borderRadius: 9 },
  download: { height: 46, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  downloadText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  disabled: { opacity: 0.5 },
});
