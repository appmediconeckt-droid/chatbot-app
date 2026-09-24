// DoctorProfileCard — reusable doctor summary card.
//
// Used by the Doctor's own DoctorProfile screen today. Built to also work
// later on the User side (browsing/searching doctors) — it only needs a
// `doctor` object shaped like MOCK_DOCTOR_DIRECTORY entries in
// features/doctor/data/mockDoctorData.js, so it is not coupled to the
// Doctor auth flow.
import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import Text from '../../../components/TranslatedText';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { CLINICIAN } from '../../../theme/palette';
import useLanguageRender from '../../../hooks/useLanguageRender';
import { createDoctorStyles } from '../dashboard/theme';

const DoctorProfileCard = ({ doctor, onViewProfile, style }) => {
  const { t } = useLanguageRender();
  if (!doctor) return null;

  const {
    fullName,
    specialization,
    rating,
    experience,
    consultationType,
    photoUrl,
  } = doctor;

  return (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={[CLINICIAN.gradientFrom, CLINICIAN.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoWrap}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <Icon name="doctor" size={40} color="#ffffff" />
        )}
      </LinearGradient>

      <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
      {specialization ? <Text style={styles.specialization}>{specialization}</Text> : null}

      <View style={styles.metaRow}>
        {typeof rating === 'number' && (
          <View style={styles.metaItem}>
            <Icon name="star" size={14} color="#F59E0B" />
            <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
          </View>
        )}
        {(experience || experience === 0) && (
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>{t('Experience')} {experience} {t('yrs')}</Text>
          </View>
        )}
      </View>

      {consultationType ? (
        <View style={styles.consultBadge}>
          <Icon name="stethoscope" size={14} color={CLINICIAN.primary} />
          <Text style={styles.consultBadgeText}>{t(consultationType)} {t('Consultation')}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.viewBtn} activeOpacity={0.88} onPress={onViewProfile}>
        <Text style={styles.viewBtnText}>{t('View Profile')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = createDoctorStyles({
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECFDF9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  photoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: CLINICIAN.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  photo: { width: '100%', height: '100%', borderRadius: 42 },
  name: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  specialization: { fontSize: 14, color: '#64748b', fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 14.5, fontWeight: '700', color: '#475569' },
  consultBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDFA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 12 },
  consultBadgeText: { fontSize: 13.5, fontWeight: '700', color: CLINICIAN.primary },
  viewBtn: { width: '100%', height: 46, borderRadius: 14, backgroundColor: CLINICIAN.primary, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  viewBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});

export default DoctorProfileCard;
