import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance from '../../../../axiosConfig';
import DoctorEditProfileScreen from './DoctorEditProfileScreen';

export default function DoctorProfileScreen({ onBack, onOpenCard }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useDoctorBack(() => {
    if (!editing) return false;
    setEditing(false);
    return true;
  });

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/api/auth/me');
      setProfile(data?.user || null);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (editing) {
    return (
      <DoctorEditProfileScreen
        profile={profile}
        onBack={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          fetchProfile();
        }}
      />
    );
  }

  if (loading && !profile) {
    return (
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
            <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
          </Pressable>
          <Text style={s.title}>Doctor Profile</Text>
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#0D9488" />
        </View>
      </View>
    );
  }

  const specialization = Array.isArray(profile?.specialization) ? profile.specialization : [];
  const languages = Array.isArray(profile?.languages) ? profile.languages : [];
  const consultationMode = Array.isArray(profile?.consultationMode) ? profile.consultationMode : [];
  const displayName = profile?.fullName ? `Dr. ${profile.fullName}` : 'Doctor';
  const subtitle = specialization.length ? specialization.join(' · ') : (profile?.qualification || '');

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Doctor Profile</Text>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={s.editLink}>EDIT</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <View style={s.profileCard}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner} />
          <View style={s.profileBody}>
            <Image
              source={{ uri: profile?.profilePhoto?.url || 'https://i.pravatar.cc/120?img=32' }}
              style={s.avatar}
            />
            <Text style={s.name}>{displayName}</Text>
            {!!subtitle && <Text style={s.role}>{subtitle}</Text>}
            <View style={s.pillRow}>
              <Pressable onPress={onOpenCard} style={s.darkPill}>
                <AppIcon name="qr" size={12} color="#FFF" strokeWidth={2} />
                <Text style={s.darkPillText}>Open Card</Text>
              </Pressable>
              <View style={s.lightPill}>
                <View style={s.lightPillDot} />
                <Text style={s.lightPillText}>{profile?.isActive === false ? 'Inactive' : 'Active'}</Text>
              </View>
            </View>
          </View>
        </View>

        <Section icon="user" label="Overview">
          <InfoRow label="Qualification" value={profile?.qualification || '—'} />
          <InfoRow label="Experience" value={profile?.experience != null ? `${profile.experience}+ Years` : '—'} />
          <InfoRow label="Language" value={languages.length ? languages.join(', ') : '—'} last />
        </Section>

        <Section icon="pulse" label="Specialization">
          <View style={s.chipsRow}>
            {specialization.length ? (
              specialization.map((tag) => (
                <View key={tag} style={s.chip}><Text style={s.chipText}>{tag}</Text></View>
              ))
            ) : (
              <Text style={s.subLabel}>No specialization added yet</Text>
            )}
          </View>
        </Section>

        {consultationMode.length > 0 && (
          <Section icon="clock" label="Availability">
            <InfoRow label="Consultation Mode" value={consultationMode.join(', ')} last />
          </Section>
        )}

        <Section icon="pin" label="Location">
          <Text style={s.subLabel}>{profile?.location || 'Not set'}</Text>
          <View style={s.mapPreview}>
            <AppIcon name="pin" size={22} color="#0D9488" strokeWidth={2} />
          </View>
          <Pressable onPress={() => showToast('Opening Google Maps — coming soon')}>
            <Text style={s.mapLink}>View on Google Maps</Text>
          </Pressable>
        </Section>

        {!!profile?.aboutMe && (
          <Section icon="file" label="About">
            <Text style={s.subLabel}>{profile.aboutMe}</Text>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ icon, label, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <AppIcon name={icon} size={15} color="#0D9488" strokeWidth={1.9} />
        <Text style={s.sectionLabel}>{label}</Text>
      </View>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, last && s.infoRowLast]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0D9488' },
  editLink: { fontSize: 13, fontWeight: '800', color: '#0D9488', letterSpacing: 0.5 },
  content: { padding: 16, paddingBottom: 30 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profileCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, overflow: 'hidden', marginBottom: 18, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  banner: { height: 64 },
  profileBody: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 18, marginTop: -34 },
  avatar: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, borderColor: '#FFF', backgroundColor: '#DCFCFF' },
  name: { fontSize: 17, fontWeight: '800', color: '#17243A', marginTop: 10 },
  role: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  darkPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#17243A', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  darkPillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  lightPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#B7ECE7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  lightPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A36A' },
  lightPillText: { fontSize: 12, fontWeight: '700', color: '#0D9488' },

  section: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginLeft: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 13, color: '#667085' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#17243A' },

  subLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#B7ECE7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F0FDFA' },
  chipText: { fontSize: 11.5, fontWeight: '700', color: '#0D9488' },
  chipMuted: { borderWidth: 1, borderColor: '#E3E7EE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F8FAFD' },
  chipMutedText: { fontSize: 11.5, fontWeight: '700', color: '#526078' },

  availableBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#D9FAE8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A36A' },
  availableText: { fontSize: 11.5, fontWeight: '700', color: '#139A5B' },

  mapPreview: { height: 110, borderRadius: 10, backgroundColor: '#E7EEF5', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 10 },
  mapLink: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
});
