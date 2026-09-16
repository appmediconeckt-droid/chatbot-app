// Ported from MediconecktApp's src/doctor/dashboard/components/PatientCommunicationsScreen.tsx.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PatientChatScreen from './PatientChatScreen';

const conversations = [
  { name: 'John Smith', condition: 'Hypertension', preview: "I've been feeling dizzy today...", time: '9:42 AM', status: 'STABLE', tone: 'blue', unread: 2 },
  { name: 'Sarah Miller', condition: 'Diabetes Type 2', preview: 'Blood sugar is 140...', time: '11:15 AM', status: 'NEEDS ATTENTION', tone: 'orange' },
  { name: 'Robert Jones', condition: 'Post-op Care', preview: '▱ incision_photo.jpg', time: 'Yesterday', status: 'CRITICAL', tone: 'red' },
];

export default function PatientCommunicationsScreen() {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState('John Smith');
  const [opened, setOpened] = useState(null);
  if (opened) return <PatientChatScreen name={opened} onBack={() => setOpened(null)} />;
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Patient Communications</Text>
        <Text style={s.subtitle}>Manage patient conversations and urgent communications.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {['All', 'Unread', 'Critical', 'Needs Attention'].map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[s.filter, filter === item && s.filterActive]}>
              <Text style={[s.filterText, filter === item && s.filterTextActive]}>{item}</Text>
              {item === 'Unread' && <View style={s.filterBadge}><Text style={s.filterBadgeText}>11</Text></View>}
            </Pressable>
          ))}
        </ScrollView>
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Conversations</Text>
            <Pressable style={s.add}><Text style={s.plus}>＋</Text></Pressable>
          </View>
          {conversations.map((item) => (
            <Pressable
              onPress={() => { setSelected(item.name); setOpened(item.name); }}
              key={item.name}
              style={[s.conversation, selected === item.name && s.selected]}
            >
              <View style={s.conversationTop}>
                <Text style={s.name}>{item.name}</Text>
                <View style={[s.status, item.tone === 'orange' && s.orange, item.tone === 'red' && s.red]}>
                  <Text style={[s.statusText, item.tone === 'orange' && s.orangeText, item.tone === 'red' && s.redText]}>{item.status}</Text>
                </View>
                <Text style={s.time}>{item.time}</Text>
              </View>
              <Text style={s.condition}>{item.condition}</Text>
              <View style={s.previewRow}>
                <Text numberOfLines={1} style={s.preview}>{item.preview}</Text>
                {item.unread && <View style={s.unread}><Text style={s.unreadText}>{item.unread}</Text></View>}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6FB' },
  content: { padding: 16, paddingBottom: 34 },
  title: { fontSize: 23, fontWeight: '700', color: '#07BFBD' },
  subtitle: { fontSize: 13, lineHeight: 19, color: '#667085', marginTop: 7 },
  filters: { gap: 10, paddingVertical: 18 },
  filter: { height: 44, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 23, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  filterActive: { backgroundColor: '#07BFBD', borderColor: '#07BFBD' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#344054' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },
  filterBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#07BFBD', alignItems: 'center', justifyContent: 'center', marginLeft: 7 },
  filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#BCC7D6', borderRadius: 12, overflow: 'hidden', marginTop: 8, shadowColor: '#17243A', shadowOpacity: 0.08, shadowRadius: 7, elevation: 2 },
  cardHeader: { height: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  cardTitle: { fontSize: 19, fontWeight: '700', color: '#26364D' },
  add: { marginLeft: 'auto', width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 25, color: '#07BFBD' },
  conversation: { minHeight: 116, borderTopWidth: 1, borderTopColor: '#CBD4E1', padding: 16, position: 'relative' },
  selected: { backgroundColor: '#EAF3FF', borderLeftWidth: 4, borderLeftColor: '#08F9ED', paddingLeft: 12 },
  conversationTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: '#26364D' },
  status: { backgroundColor: '#D9FEFF', borderRadius: 11, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  statusText: { fontSize: 9, fontWeight: '700', color: '#08F9ED' },
  orange: { backgroundColor: '#F8DFD2' },
  orangeText: { color: '#C44A21' },
  red: { backgroundColor: '#FFE0E0' },
  redText: { color: '#D92D20' },
  time: { marginLeft: 'auto', fontSize: 10, color: '#7B8493' },
  condition: { fontSize: 12, color: '#7B8493', marginTop: 9 },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  preview: { flex: 1, fontSize: 13, color: '#526078' },
  unread: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#07BFBD', alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
});
