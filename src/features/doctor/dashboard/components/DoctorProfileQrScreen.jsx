// Ported from MediconecktApp's src/doctor/dashboard/components/DoctorProfileQrScreen.tsx.
// Adaptations: ToastAndroid -> cross-platform useToast; share text no longer
// references the source app's own domain.
import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';

const qr = [
  '1111111001101111111',
  '1000001010101000001',
  '1011101011101011101',
  '1011101000101011101',
  '1011101011101011101',
  '1000001010101000001',
  '1111111010101111111',
  '0000000011100000000',
  '1101011110111010111',
  '0011100011000111000',
  '1110111010111011101',
  '0101000111010001010',
  '1111111010111010111',
  '1000000011101001000',
  '1111111010011110111',
  '1000001011100010100',
  '1011101010111111101',
  '1000001001000010010',
  '1111111011111011111',
];

export default function DoctorProfileQrScreen({ onBack, onMenuPress }) {
  const [visible, setVisible] = useState(true);
  const { showToast } = useToast();
  const notify = (text) => showToast(text);
  const share = () => void Share.share({ message: 'Dr. Sarah Mitchell — Humaeli Provider Profile' });
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.title}>DR. Profile QR Code</Text>
        {onMenuPress && (
          <Pressable accessibilityLabel="Open navigation menu" onPress={onMenuPress} style={s.menuButton}>
            <AppIcon name="menu" size={21} color="#26364D" strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Share your professional profile instantly with{`\n`}patients using a secure QR Code.</Text>
        <View style={s.qrCard}>
          <Text style={s.qrTitle}>Your Doctor QR Code</Text>
          <View style={s.qrBox}>
            {qr.flatMap((row, r) => [...row].map((cell, c) => <View key={`${r}-${c}`} style={[s.pixel, cell === '1' && s.pixelOn]} />))}
          </View>
          <View style={s.doctorPill}>
            <View style={s.avatar}><Text style={s.avatarText}>👩🏻‍⚕</Text></View>
            <View>
              <Text style={s.doctorName}>Dr. Sarah Mitchell</Text>
              <Text style={s.speciality}>Cardiologist</Text>
            </View>
            <View style={s.verified}><Text style={s.check}>✓</Text></View>
          </View>
        </View>
        <Text style={s.scanTitle}>SCAN THIS QR CODE TO:</Text>
        <View style={s.scanGrid}>
          <Action icon="user" text="View Profile" />
          <Action icon="calendar" text="Book Appt." />
          <Action icon="message" text="Start Chat" />
          <Action icon="phone" text="Contact Clinic" />
        </View>
        <View style={s.card}>
          <Text style={s.section}>QR MANAGEMENT</Text>
          <Pressable style={s.download} onPress={() => notify('QR downloaded')}><Text style={s.downloadText}>⇩ Download QR</Text></Pressable>
          <View style={s.two}>
            <Outline text="⌁  Share" onPress={share} />
            <Outline text="▣  Print" onPress={() => notify('Print ready')} />
          </View>
          <View style={s.two}>
            <Outline text="🔗  Copy Link" onPress={() => notify('Profile link copied')} />
            <Outline text="↻  Refresh" onPress={() => notify('QR refreshed')} />
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.section}>QUICK STATS</Text>
          <View style={s.statRow}>
            <Stat label="Today's Scans" value="42" />
            <Stat label="This Week" value="186" />
          </View>
          <View style={s.statRow}>
            <Stat label="Appointments" value="24" />
            <Stat label="Profile Views" value="512" arrow="→" />
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.section}>QR DETAILS</Text>
          <Detail label="QR Status" value="Active" badge />
          <Detail label="Last Updated" value="Today, 09:41 AM" />
          <Detail label="Visibility" value={visible ? 'Public' : 'Private'} onPress={() => setVisible((x) => !x)} />
          <Detail label="Expires" value="Never" last />
        </View>
      </ScrollView>
    </View>
  );
}

function Action({ icon, text }) {
  return <View style={s.action}><AppIcon name={icon} size={15} color="#526078" /><Text style={s.actionText}>{text}</Text></View>;
}
function Outline({ text, onPress }) {
  return <Pressable onPress={onPress} style={s.outline}><Text style={s.outlineText}>{text}</Text></Pressable>;
}
function Stat({ label, value, arrow = '↗' }) {
  return (
    <View style={s.stat}>
      <View style={s.statTop}><Text style={s.statLabel}>{label}</Text><Text style={s.statArrow}>{arrow}</Text></View>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
function Detail({ label, value, badge, last, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.detail, last && s.detailLast]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, badge && s.badge]}>{value}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FB' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  back: { fontSize: 32, lineHeight: 34, color: '#26364D', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#07BFBD' },
  menuButton: { marginLeft: 'auto' },
  content: { padding: 12, paddingBottom: 36 },
  intro: { fontSize: 13, lineHeight: 19, color: '#526078', marginHorizontal: 3, marginBottom: 16 },
  qrCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 12, alignItems: 'center', padding: 22, shadowColor: '#17243A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  qrTitle: { fontSize: 16, fontWeight: '700', color: '#17243A', marginBottom: 20 },
  qrBox: { width: 198, height: 198, padding: 15, backgroundColor: '#EEF1F5', borderRadius: 10, flexDirection: 'row', flexWrap: 'wrap' },
  pixel: { width: 8.84, height: 8.84, backgroundColor: 'transparent' },
  pixelOn: { backgroundColor: '#05080D' },
  doctorPill: { height: 58, borderWidth: 1, borderColor: '#D4DBE5', borderRadius: 29, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, marginTop: 20, backgroundColor: '#FFF' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1E2D5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 21 },
  doctorName: { fontSize: 13, fontWeight: '700', color: '#17243A', marginLeft: 9 },
  speciality: { fontSize: 11, color: '#667085', marginLeft: 9, marginTop: 2 },
  verified: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#08F9ED', alignItems: 'center', justifyContent: 'center', marginLeft: 9 },
  check: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  scanTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, color: '#344054', marginTop: 22, marginBottom: 10 },
  scanGrid: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: '#DDE3EB', paddingBottom: 15 },
  action: { width: '50%', height: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 8 },
  actionText: { fontSize: 13, color: '#526078' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 11, padding: 15, marginTop: 16, shadowColor: '#17243A', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, color: '#344054', marginBottom: 13 },
  download: { height: 49, backgroundColor: '#08F9ED', borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#08F9ED', shadowOpacity: 0.18, shadowRadius: 4, elevation: 2 },
  downloadText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  two: { flexDirection: 'row', gap: 10, marginTop: 10 },
  outline: { flex: 1, height: 46, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  outlineText: { fontSize: 13, fontWeight: '500', color: '#344054' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, height: 90, borderWidth: 1, borderColor: '#D3DAE5', borderRadius: 9, backgroundColor: '#F8FAFD', padding: 12 },
  statTop: { flexDirection: 'row' },
  statLabel: { fontSize: 11, color: '#667085' },
  statArrow: { marginLeft: 'auto', fontSize: 16, color: '#16A36A' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#17243A', marginTop: 12 },
  detail: { height: 52, borderBottomWidth: 1, borderBottomColor: '#E3E7EE', flexDirection: 'row', alignItems: 'center' },
  detailLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 13, color: '#667085' },
  detailValue: { marginLeft: 'auto', fontSize: 13, fontWeight: '500', color: '#344054' },
  badge: { backgroundColor: '#D9FAE8', color: '#139A5B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
});
