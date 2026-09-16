// DoctorProfile — shows the doctor's own completed profile right after
// signup. Reads the mock profile created by DoctorSignup (AsyncStorage key
// `doctorMockProfile`) or the `doctorProfile` route param when navigated to
// directly. Frontend-only: nothing here is fetched from a backend.
import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../../../components/TranslatedText';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLINICIAN } from '../../../theme/palette';
import useLanguageRender from '../../../hooks/useLanguageRender';
import DoctorProfileCard from '../components/DoctorProfileCard';

const InfoRow = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Icon name={icon} size={18} color={CLINICIAN.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
};

const DoctorProfile = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const [profile, setProfile] = useState(route?.params?.doctorProfile || null);

  useEffect(() => {
    if (profile) return;
    AsyncStorage.getItem('doctorMockProfile').then((raw) => {
      if (raw) {
        try { setProfile(JSON.parse(raw)); } catch { /* ignore malformed mock data */ }
      }
    });
  }, [profile]);

  const cardDoctor = profile
    ? {
      fullName: profile.fullName,
      specialization: profile.specialization,
      experience: Number(profile.experience) || 0,
      rating: 5.0,
      consultationType: profile.consultationType || (profile.consultationMode || [])[0],
      photoUrl: null,
    }
    : null;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={CLINICIAN.backgroundTint} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-left" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('Professional Profile')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {cardDoctor && <DoctorProfileCard doctor={cardDoctor} onViewProfile={() => {}} />}

        {profile && (
          <View style={s.detailsCard}>
            <Text style={s.sectionTitle}>{t('Qualifications')}</Text>
            <InfoRow icon="school-outline" label={t('Medical Qualification')} value={profile.qualification} />
            <InfoRow icon="card-account-details-outline" label={t('Registration Number')} value={profile.registrationNumber} />
            <InfoRow icon="bank-outline" label={t('University / Institution')} value={profile.institution} />
            <InfoRow icon="certificate" label={t('Certifications')} value={profile.certifications} />

            <Text style={[s.sectionTitle, { marginTop: 18 }]}>{t('Practice')}</Text>
            <InfoRow icon="hospital-building" label={t('Hospital / Clinic')} value={profile.clinicName} />
            <InfoRow icon="map-marker-radius-outline" label={t('City')} value={profile.city || profile.location} />
            <InfoRow icon="stethoscope" label={t('Consultation Type')} value={profile.consultationType} />
            <InfoRow
              icon="calendar-check-outline"
              label={t('Availability')}
              value={
                (profile.availabilityDays || []).length
                  ? `${profile.availabilityDays.join(', ')} · ${(profile.availabilitySlots || []).join(', ')}`
                  : ''
              }
            />

            <Text style={[s.sectionTitle, { marginTop: 18 }]}>{t('About')}</Text>
            <Text style={s.aboutText}>{profile.aboutMe || t('No description added yet.')}</Text>
          </View>
        )}

        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.replace('DoctorDashboard')} style={{ marginTop: 20 }}>
          <LinearGradient colors={[CLINICIAN.gradientFrom, CLINICIAN.gradientTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.dashboardBtn}>
            <Text style={s.dashboardBtnText}>{t('Go to Dashboard')}</Text>
            <Icon name="arrow-right" size={20} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CLINICIAN.backgroundTint },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30, gap: 16 },
  detailsCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, marginTop: 4, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  infoIconWrap: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  aboutText: { fontSize: 13.5, color: '#475569', lineHeight: 21 },
  dashboardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 16 },
  dashboardBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});

export default DoctorProfile;
