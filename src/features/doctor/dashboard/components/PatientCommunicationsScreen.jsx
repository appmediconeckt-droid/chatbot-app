// Ported from MediconecktApp's src/doctor/dashboard/components/PatientCommunicationsScreen.tsx.
// Reworked into a real messaging-inbox look: avatars, unread emphasis, and
// filter chips that actually filter (they were purely decorative before).
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import PatientChatScreen from './PatientChatScreen';
import PatientProfileScreen from './PatientProfileScreen';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';

const conversations = [
  {
    name: 'John Smith',
    condition: 'Hypertension',
    preview: "I've been feeling dizzy today...",
    time: '9:42 AM',
    status: 'STABLE',
    tone: 'blue',
    unread: 2,
    online: true,
    image: 'https://i.pravatar.cc/120?img=51',
    age: 54,
    gender: 'Male',
    bloodGroup: 'O+',
    diagnosis: { title: 'Hypertension (Stage 2)', detail: 'Diagnosed Oct 2022. Monitored bi-weekly.' },
    medications: [
      { name: 'Lisinopril', dose: '20mg • 1x Daily (Morning)' },
      { name: 'Amlodipine', dose: '5mg • 1x Daily (Evening)' },
    ],
    labs: { title: 'Lipid Panel', date: 'Nov 12', badge: '2 New' },
    visit: { title: 'Follow-up', date: 'Oct 28' },
    apptHistory: [
      { date: 'OCT\n28', title: 'Routine Checkup', subtitle: 'In-Person • Dr. Morrow' },
      { date: 'SEP\n15', title: 'BP Monitoring', subtitle: 'Telehealth • NP. Davis' },
    ],
  },
  {
    name: 'Sarah Miller',
    condition: 'Diabetes Type 2',
    preview: 'Blood sugar is 140...',
    time: '11:15 AM',
    status: 'NEEDS ATTENTION',
    tone: 'orange',
    unread: 0,
    online: true,
    image: 'https://i.pravatar.cc/120?img=47',
    age: 47,
    gender: 'Female',
    bloodGroup: 'A+',
    diagnosis: { title: 'Type 2 Diabetes', detail: 'Diagnosed Mar 2021. Monitored monthly.' },
    medications: [
      { name: 'Metformin', dose: '500mg • 2x Daily' },
      { name: 'Glimepiride', dose: '1mg • 1x Daily (Morning)' },
    ],
    labs: { title: 'HbA1c Panel', date: 'Nov 8', badge: '1 New' },
    visit: { title: 'Diabetes Review', date: 'Nov 2' },
    apptHistory: [
      { date: 'NOV\n02', title: 'Diabetes Review', subtitle: 'In-Person • Dr. Morrow' },
      { date: 'OCT\n05', title: 'Foot Exam', subtitle: 'In-Person • NP. Davis' },
    ],
  },
  {
    name: 'Robert Jones',
    condition: 'Post-op Care',
    preview: '▱ incision_photo.jpg',
    time: 'Yesterday',
    status: 'CRITICAL',
    tone: 'red',
    unread: 0,
    online: false,
    image: 'https://i.pravatar.cc/120?img=13',
    age: 61,
    gender: 'Male',
    bloodGroup: 'B+',
    diagnosis: { title: 'Post-op Infection Risk', detail: 'Surgery Oct 2026. Wound checked daily.' },
    medications: [
      { name: 'Amoxicillin', dose: '500mg • 3x Daily' },
      { name: 'Paracetamol', dose: '650mg • As needed' },
    ],
    labs: { title: 'CBC Panel', date: 'Yesterday', badge: '3 New' },
    visit: { title: 'Wound Check', date: 'Tomorrow' },
    apptHistory: [
      { date: 'NOV\n03', title: 'Wound Dressing', subtitle: 'In-Person • Dr. Morrow' },
      { date: 'OCT\n30', title: 'Post-op Surgery', subtitle: 'In-Person • Dr. Chen' },
    ],
  },
];

const FILTERS = ['All', 'Unread', 'Critical', 'Needs Attention'];
const totalUnread = conversations.reduce((sum, item) => sum + (item.unread || 0), 0);

const matchesFilter = (item, filter) => {
  if (filter === 'All') return true;
  if (filter === 'Unread') return item.unread > 0;
  if (filter === 'Critical') return item.status === 'CRITICAL';
  if (filter === 'Needs Attention') return item.status === 'NEEDS ATTENTION';
  return true;
};

export default function PatientCommunicationsScreen({ onChatOpenChange }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [opened, setOpened] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  useEffect(() => () => onChatOpenChange?.(false), [onChatOpenChange]);
  const openChat = (item) => {
    setOpened(item);
    setShowProfile(false);
    onChatOpenChange?.(true);
  };
  const closeChat = () => {
    setOpened(null);
    setShowProfile(false);
    onChatOpenChange?.(false);
  };
  if (opened && showProfile) {
    return <PatientProfileScreen patient={opened} onBack={() => setShowProfile(false)} />;
  }
  if (opened) {
    return (
      <PatientChatScreen
        name={opened.name}
        avatar={opened.image}
        onBack={closeChat}
        onProfilePress={() => setShowProfile(true)}
      />
    );
  }

  const query = search.trim().toLowerCase();
  const visible = conversations.filter(
    (item) =>
      matchesFilter(item, filter) &&
      (!query || item.name.toLowerCase().includes(query) || item.condition.toLowerCase().includes(query))
  );

  return (
    <View style={s.screen}>
      <View style={s.search}>
        <View style={s.searchIconWrap}>
          <AppIcon name="search" size={16} color="#0D9488" strokeWidth={2.2} />
        </View>
        <TextInput value={search} onChangeText={setSearch} style={s.searchInput} placeholder="Search patients or conditions..." placeholderTextColor="#9AA4B5" />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8} style={s.searchClear}><AppIcon name="x" size={13} color="#8A94A4" /></Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filters}>
        {FILTERS.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[s.filter, filter === item && s.filterActive]}>
            {filter === item && <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
            <Text style={[s.filterText, filter === item && s.filterTextActive]}>{item}</Text>
            {item === 'Unread' && totalUnread > 0 && (
              <View style={[s.filterBadge, filter === item && s.filterBadgeOnActive]}>
                <Text style={[s.filterBadgeText, filter === item && s.filterBadgeTextOnActive]}>{totalUnread}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={s.listScroll} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {visible.map((item) => {
          const unread = item.unread > 0;
          return (
            <Pressable
              onPress={() => openChat(item)}
              key={item.name}
              style={({ pressed }) => [s.conversation, unread && s.conversationUnread, pressed && s.conversationPressed]}
            >
              <View style={[s.accentBar, item.tone === 'orange' && s.accentOrange, item.tone === 'red' && s.accentRed]} />
              <View style={s.avatarWrap}>
                <Image source={{ uri: item.image }} style={s.avatar} />
                {item.online && <View style={s.onlineDot} />}
              </View>
              <View style={s.conversationBody}>
                <View style={s.conversationTop}>
                  <Text style={[s.name, unread && s.nameUnread]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.time, unread && s.timeUnread]}>{item.time}</Text>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.condition} numberOfLines={1}>{item.condition}</Text>
                  <View style={[s.status, item.tone === 'orange' && s.orange, item.tone === 'red' && s.red]}>
                    <Text style={[s.statusText, item.tone === 'orange' && s.orangeText, item.tone === 'red' && s.redText]}>{item.status}</Text>
                  </View>
                </View>
                <View style={s.previewRow}>
                  <Text numberOfLines={1} style={[s.preview, unread && s.previewUnread]}>{item.preview}</Text>
                  {unread && <View style={s.unread}><Text style={s.unreadText}>{item.unread}</Text></View>}
                </View>
              </View>
            </Pressable>
          );
        })}
        {visible.length === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}><AppIcon name="message" size={22} color="#B0B8C4" strokeWidth={1.8} /></View>
            <Text style={s.emptyText}>No conversations match this filter.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F3F6FA' },
  search: {
    height: 46,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 9,
    shadowColor: '#17243A',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E4FBF9', alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  searchClear: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  filtersScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  filter: {
    height: 34,
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 17,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  filterActive: {
    borderColor: 'transparent',
    shadowColor: '#0D9488',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: '#526078' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },
  filterBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', marginLeft: 7, paddingHorizontal: 4 },
  filterBadgeOnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  filterBadgeTextOnActive: { color: '#FFF' },
  listScroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 10 },
  conversation: {
    flexDirection: 'row',
    minHeight: 84,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 11,
    overflow: 'hidden',
    shadowColor: '#17243A',
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  conversationUnread: { backgroundColor: '#F2FDFC' },
  conversationPressed: { opacity: 0.85 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#0D9488' },
  accentOrange: { backgroundColor: '#E08A3E' },
  accentRed: { backgroundColor: '#D2564B' },
  avatarWrap: { position: 'relative', marginLeft: 4 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#F0F3F8' },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF' },
  conversationBody: { flex: 1 },
  conversationTop: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 15.5, fontWeight: '700', color: '#374357' },
  nameUnread: { fontWeight: '800', color: '#17243A' },
  time: { marginLeft: 8, fontSize: 12, color: '#8A94A4' },
  timeUnread: { color: '#0D9488', fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  condition: { flex: 1, fontSize: 12.5, color: '#7B8493' },
  status: { backgroundColor: '#D9FEFF', borderRadius: 11, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10.5, fontWeight: '700', color: '#0D9488' },
  orange: { backgroundColor: '#FBEADD' },
  orangeText: { color: '#C44A21' },
  red: { backgroundColor: '#FDF1F1' },
  redText: { color: '#C0463F' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  preview: { flex: 1, fontSize: 13.5, color: '#7B8493' },
  previewUnread: { color: '#3C4759', fontWeight: '600' },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#8E9DB0' },
});
