// Ported from MediconecktApp's src/doctor/dashboard/components/CalendarAvailabilityScreen.tsx.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';

const weeks = [
  [31, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, 1, 2, 3, 4],
];
const selected = [23, 24, 25, 26];

export default function CalendarAvailabilityScreen() {
  const [mode, setMode] = useState('Specific Dates');
  const [recurring, setRecurring] = useState(true);
  const [weekdays, setWeekdays] = useState(['M1', 'T2', 'W3', 'T4', 'F5']);
  const toggleDay = (day, index) =>
    setWeekdays((current) => (current.includes(`${day}${index}`) ? current.filter((x) => x !== `${day}${index}`) : [...current, `${day}${index}`]));
  return (
    <View style={s.screen}>
      <View style={s.titleBar}>
        <Text style={s.title}>Calendar &amp; Availability</Text>
        <Pressable style={s.facility}><Text style={s.facilityIcon}>▣</Text><Text style={s.chevron}>⌄</Text></Pressable>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.modeTabs}>
          {['Recurring', 'Specific Dates', 'Exceptions'].map((item) => (
            <Pressable key={item} onPress={() => setMode(item)} style={[s.modeTab, mode === item && s.modeActive]}>
              <Text style={[s.modeText, mode === item && s.modeTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.calendarCard}>
          <View style={s.monthRow}>
            <Text style={s.month}>June 2026</Text>
            <View style={s.arrows}><Text style={s.arrow}>‹</Text><Text style={s.arrow}>›</Text></View>
          </View>
          <View style={s.legend}>
            <Dot color="#08F9ED" /><Text style={s.legendText}>Configured</Text>
            <Dot color="#7157F5" /><Text style={s.legendText}>Selected</Text>
            <Dot color="#AAB4C3" hollow /><Text style={s.legendText}>Empty</Text>
          </View>
          <View style={s.week}>
            <Text style={s.dayHead}>S</Text>
            {['M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <Text key={`${x}${i}`} style={s.dayHead}>{x}</Text>)}
          </View>
          {weeks.map((week, row) => (
            <View key={row} style={s.week}>
              {week.map((date, col) => {
                const adjacent = (row === 0 && col === 0) || (row === 4 && col > 2);
                const chosen = !adjacent && selected.includes(date);
                return (
                  <Pressable key={col} style={[s.date, chosen && s.selectedDate, date === 23 && s.configuredDate]}>
                    <Text style={[s.dateText, adjacent && s.adjacent, chosen && s.selectedText]}>{date}</Text>
                    {date === 23 && !adjacent && (
                      <View style={s.dateDots}><View style={s.blueDot} /><View style={s.purpleDot} /></View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={s.card}>
          <View style={s.dateHeader}>
            <View><Text style={s.cardTitle}>June 24, 2026</Text><Text style={s.selectedCount}>3 days selected</Text></View>
            <Text style={s.block}>⊘</Text>
          </View>
          <Text style={s.label}>Time Ranges</Text>
          <TimeRange start="09:00 AM" end="01:00 PM" />
          <TimeRange start="04:00 PM" end="07:00 PM" />
          <Pressable><Text style={s.add}>＋ Add Another Range</Text></Pressable>
          <Pressable style={s.primary}><Text style={s.primaryText}>Apply to Selected Dates</Text></Pressable>
        </View>
        <View style={s.card}>
          <View style={s.switchRow}>
            <Text style={s.cardTitle}>Recurring Rules</Text>
            <Switch value={recurring} onValueChange={setRecurring} trackColor={{ false: '#D5DAE3', true: '#08F9ED' }} thumbColor="#FFF" style={s.switch} />
          </View>
          <Text style={s.help}>Repeat these timings weekly on selected days.</Text>
          <View style={s.days}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
              const active = weekdays.includes(`${day}${index}`);
              return (
                <Pressable onPress={() => toggleDay(day, index)} key={`${day}${index}`} style={[s.dayCircle, active && s.dayActive]}>
                  <Text style={[s.dayText, active && s.dayTextActive]}>{day}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={s.secondary}><Text style={s.secondaryText}>Apply to weekdays</Text></Pressable>
        </View>
        <Text style={s.sectionTitle}>Slot Preview — Main Hospital</Text>
        <View style={s.preview}>
          <View style={s.previewIcon}>
            <AppIcon name="calendar" size={22} color="#26364D" />
            <View style={s.clockBadge}><AppIcon name="clock" size={8} color="#26364D" /></View>
          </View>
          <Text style={s.emptyTitle}>No slots generated yet. Configure</Text>
          <Text style={s.emptyTitle}>availability and click</Text>
          <Pressable><Text style={s.generateLink}>Generate Slots to preview.</Text></Pressable>
        </View>
      </ScrollView>
      <View style={s.actions}>
        <Pressable style={s.draft}><Text style={s.draftText}>Save Draft</Text></Pressable>
        <Pressable style={s.generate}><Text style={s.generateText}>↯  Generate Slots</Text></Pressable>
      </View>
    </View>
  );
}

function Dot({ color, hollow }) {
  return <View style={[s.legendDot, { backgroundColor: hollow ? '#FFF' : color, borderColor: color }]} />;
}
function TimeRange({ start, end }) {
  return (
    <View style={s.timeRange}>
      <AppIcon name="clock" size={12} color="#667085" />
      <Text style={s.timeText}>{start}</Text>
      <Text style={s.to}>—</Text>
      <AppIcon name="clock" size={12} color="#667085" />
      <Text style={s.timeText}>{end}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  titleBar: { height: 56, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  title: { fontSize: 19, fontWeight: '700', color: '#07BFBD' },
  facility: { marginLeft: 'auto', height: 30, minWidth: 42, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  facilityIcon: { fontSize: 13, color: '#344054' },
  chevron: { fontSize: 13, color: '#667085' },
  scroll: { flex: 1 },
  content: { padding: 10, paddingBottom: 16 },
  modeTabs: { height: 56, backgroundColor: '#F0F3FA', borderRadius: 10, flexDirection: 'row', padding: 4, marginBottom: 12 },
  modeTab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  modeActive: { backgroundColor: '#FFF', shadowColor: '#17243A', shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  modeText: { fontSize: 12, color: '#344054' },
  modeTextActive: { color: '#08F9ED', fontWeight: '700' },
  calendarCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CAD3E1', borderRadius: 10, padding: 14, marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  month: { fontSize: 18, fontWeight: '700', color: '#17243A' },
  arrows: { marginLeft: 'auto', flexDirection: 'row', gap: 24 },
  arrow: { fontSize: 25, color: '#344054' },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8, gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  legendText: { fontSize: 9, color: '#667085', marginRight: 10 },
  week: { flexDirection: 'row' },
  dayHead: { width: '14.285%', textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#667085', paddingVertical: 6 },
  date: { width: '14.285%', height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 7 },
  dateText: { fontSize: 13, color: '#25344A' },
  adjacent: { color: '#C5CBD5' },
  selectedDate: { borderColor: '#7B61FF', backgroundColor: '#F7F4FF' },
  configuredDate: { backgroundColor: '#EAF3FF', borderColor: '#D4FFFF' },
  selectedText: { color: '#4C34C9', fontWeight: '600' },
  dateDots: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 },
  blueDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#08F9ED' },
  purpleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7157F5' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CAD3E1', borderRadius: 10, padding: 14, marginBottom: 12 },
  dateHeader: { flexDirection: 'row', marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#17243A' },
  selectedCount: { fontSize: 11, color: '#08F9ED', marginTop: 4 },
  block: { marginLeft: 'auto', fontSize: 22, color: '#E53935' },
  label: { fontSize: 13, fontWeight: '700', color: '#344054', marginBottom: 9 },
  timeRange: { height: 46, borderWidth: 1, borderColor: '#C7D0DF', borderRadius: 7, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  timeText: { fontSize: 12, color: '#344054' },
  to: { marginHorizontal: 6, color: '#667085' },
  add: { fontSize: 12, fontWeight: '600', color: '#08F9ED', marginVertical: 10 },
  primary: { height: 46, backgroundColor: '#08F9ED', borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switch: { marginLeft: 'auto' },
  help: { fontSize: 11, color: '#667085', marginTop: 3 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#CDD5E1', alignItems: 'center', justifyContent: 'center' },
  dayActive: { backgroundColor: '#08F9ED', borderColor: '#08F9ED' },
  dayText: { fontSize: 12, color: '#344054' },
  dayTextActive: { color: '#FFF', fontWeight: '700' },
  secondary: { height: 42, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 12, fontWeight: '600', color: '#344054' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#26364D', margin: 3, marginBottom: 10 },
  preview: { height: 220, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CAD3E1', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#DFFBFF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  clockBadge: { position: 'absolute', right: 11, bottom: 10, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 12, color: '#667085', lineHeight: 18 },
  generateLink: { fontSize: 11, color: '#08F9ED', marginTop: 3 },
  actions: { height: 62, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D7DEE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 9 },
  draft: { width: '34%', height: 46, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  draftText: { fontSize: 13, fontWeight: '600', color: '#344054' },
  generate: { flex: 1, height: 46, backgroundColor: '#08F9ED', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  generateText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
