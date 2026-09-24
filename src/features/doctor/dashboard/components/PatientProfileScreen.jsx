// Patient Profile — the clinical summary card shown when a doctor opens a
// patient's profile from Patient Communications (Communication → avatar/name
// → Patient Profile). This is intentionally separate from PatientDetailScreen
// ("Patient Details", reached from the Patients list), which keeps its own
// tabbed vitals/allergies/visit layout untouched.
import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { colors, createDoctorStyles } from '../theme';

const DEFAULT_DIAGNOSIS = {
  title: 'Hypertension (Stage 2)',
  detail: 'Diagnosed Oct 2022. Monitored bi-weekly.',
};
const DEFAULT_MEDICATIONS = [
  { name: 'Lisinopril', dose: '20mg • 1x Daily (Morning)' },
  { name: 'Amlodipine', dose: '5mg • 1x Daily (Evening)' },
];
const DEFAULT_LABS = { title: 'Lipid Panel', date: 'Nov 12', badge: '2 New' };
const DEFAULT_VISIT = { title: 'Follow-up', date: 'Oct 28' };
const DEFAULT_APPT_HISTORY = [
  { date: 'OCT\n28', title: 'Routine Checkup', subtitle: 'In-Person • Dr. Morrow' },
  { date: 'SEP\n15', title: 'BP Monitoring', subtitle: 'Telehealth • NP. Davis' },
];

export default function PatientProfileScreen({ patient, onBack }) {
  const diagnosis = patient?.diagnosis ?? DEFAULT_DIAGNOSIS;
  const medications = patient?.medications ?? DEFAULT_MEDICATIONS;
  const labs = patient?.labs ?? DEFAULT_LABS;
  const visit = patient?.visit ?? DEFAULT_VISIT;
  const apptHistory = patient?.apptHistory ?? DEFAULT_APPT_HISTORY;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Patient Profile</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.profileCard}>
          <Image source={{ uri: patient?.image }} style={s.avatar} />
          <Text style={s.name}>{patient?.name ?? 'Patient'}</Text>
          <Text style={s.meta}>
            {patient?.age ?? 54} Yrs · {patient?.gender ?? 'Male'} · {patient?.bloodGroup ?? 'O+'}
          </Text>
          <View style={s.quickActions}>
            <QuickAction icon="phone" label="Call" />
            <QuickAction icon="pill" label="Rx" />
            <QuickAction icon="calendar" label="Appt" />
            <QuickAction icon="note" label="Note" />
          </View>
        </View>

        <View style={s.diagnosisCard}>
          <View style={s.diagnosisIcon}><AppIcon name="pulse" size={16} color="#C0463F" strokeWidth={2.2} /></View>
          <View style={s.grow}>
            <Text style={s.diagnosisEyebrow}>CURRENT PRIMARY DIAGNOSIS</Text>
            <Text style={s.diagnosisTitle}>{diagnosis.title}</Text>
            <Text style={s.diagnosisDetail}>{diagnosis.detail}</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.sectionTitle}>Medications</Text>
            <Pressable hitSlop={8}><Text style={s.editLink}>Edit</Text></Pressable>
          </View>
          {medications.map((med, index) => (
            <View key={med.name} style={[s.medRow, index === medications.length - 1 && s.medRowLast]}>
              <View style={s.medIcon}><AppIcon name="pill" size={17} color={colors.blue} strokeWidth={2} /></View>
              <View style={s.grow}>
                <Text style={s.medName}>{med.name}</Text>
                <Text style={s.medDose}>{med.dose}</Text>
              </View>
              <Pressable hitSlop={8} style={s.medEdit}>
                <AppIcon name="edit" size={16} color="#8A94A4" strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={s.two}>
          <View style={s.miniCard}>
            <View style={s.miniHeaderRow}>
              <AppIcon name="flask" size={17} color={colors.blue} strokeWidth={2} />
              <Text style={s.miniTitle}>Labs</Text>
            </View>
            <Text style={s.miniLine}>{labs.title}</Text>
            <View style={s.miniFooterRow}>
              <Text style={s.miniSub}>{labs.date}</Text>
              {!!labs.badge && (
                <View style={s.miniBadge}><Text style={s.miniBadgeText}>{labs.badge}</Text></View>
              )}
            </View>
          </View>
          <View style={s.miniCard}>
            <View style={s.miniHeaderRow}>
              <AppIcon name="calendar" size={17} color={colors.blue} strokeWidth={2} />
              <Text style={s.miniTitle}>Visits</Text>
            </View>
            <Text style={s.miniLine}>{visit.title}</Text>
            <View style={s.miniFooterRow}>
              <Text style={s.miniSub}>{visit.date}</Text>
              <Text style={s.viewAllLink}>View All</Text>
            </View>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.sectionHeaderRow}>
            <AppIcon name="clock" size={17} color="#17243A" strokeWidth={2} />
            <Text style={s.sectionTitle}>Appt History</Text>
          </View>
          {apptHistory.map((item, index) => (
            <Pressable key={item.title + index} style={[s.apptRow, index === apptHistory.length - 1 && s.apptRowLast]}>
              <View style={s.apptDateBadge}>
                {item.date.split('\n').map((line, i) => (
                  <Text key={i} style={s.apptDateText}>{line}</Text>
                ))}
              </View>
              <View style={s.grow}>
                <Text style={s.apptTitle}>{item.title}</Text>
                <Text style={s.apptSubtitle}>{item.subtitle}</Text>
              </View>
              <AppIcon name="chevron-right" size={17} color="#B0B8C4" strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label }) {
  return (
    <View style={s.quickAction}>
      <View style={s.quickActionCircle}><AppIcon name={icon} size={19} color={colors.blue} strokeWidth={2} /></View>
      <Text style={s.quickActionLabel}>{label}</Text>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { height: 56, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 30, height: 38, alignItems: 'flex-start', justifyContent: 'center', marginRight: 6 },
  title: { fontSize: 18, fontWeight: '700', color: colors.blue },
  content: { padding: 14, paddingBottom: 30 },
  grow: { flex: 1 },

  profileCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 14, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#E7ECF3' },
  name: { fontSize: 20, fontWeight: '700', color: '#17243A', marginTop: 12 },
  meta: { fontSize: 13.5, color: '#667085', marginTop: 3 },
  quickActions: { flexDirection: 'row', gap: 26, marginTop: 18 },
  quickAction: { alignItems: 'center', gap: 6 },
  quickActionCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: '#3C4759' },

  diagnosisCard: { flexDirection: 'row', backgroundColor: '#FDF1F1', borderWidth: 1, borderColor: '#F8DADA', borderRadius: 12, padding: 14, marginTop: 14, gap: 11 },
  diagnosisIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  diagnosisEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: '#C0463F' },
  diagnosisTitle: { fontSize: 16.5, fontWeight: '700', color: '#17243A', marginTop: 4 },
  diagnosisDetail: { fontSize: 13, color: '#8C6B6B', marginTop: 3 },

  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 12, padding: 14, marginTop: 14, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#17243A' },
  editLink: { fontSize: 13.5, fontWeight: '700', color: colors.blue },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  medRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  medIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  medDose: { fontSize: 13, color: '#667085', marginTop: 2 },
  medEdit: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  two: { flexDirection: 'row', gap: 12, marginTop: 14 },
  miniCard: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E6EE', borderRadius: 12, padding: 13, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  miniHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  miniTitle: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  miniLine: { fontSize: 13.5, fontWeight: '600', color: '#3C4759', marginTop: 9 },
  miniFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  miniSub: { fontSize: 12, color: '#8A94A4' },
  miniBadge: { backgroundColor: colors.paleBlue, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 },
  miniBadgeText: { fontSize: 11, fontWeight: '700', color: colors.blue },
  viewAllLink: { fontSize: 12, fontWeight: '700', color: colors.blue },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  apptRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  apptDateBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  apptDateText: { fontSize: 11, fontWeight: '700', color: '#3C4759', textAlign: 'center', lineHeight: 14 },
  apptTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  apptSubtitle: { fontSize: 13, color: '#667085', marginTop: 2 },
});
