// The heading above each doctor session in a queue (see utils/queueSlots):
// the session's range, whether it is running now / over / later, and how
// many of its patients are in this list.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from '../TranslatedText';
import { slotRangeLabel } from '../../utils/queueSlots';

const STATES = {
  current: { tag: 'Running now', fg: '#0F766E', bg: '#E6F6F1', line: '#9FD9C7' },
  past: { tag: 'Slot over · still waiting', fg: '#B45309', bg: '#FFF4E5', line: '#F5CF94' },
  upcoming: { tag: 'Upcoming', fg: '#475569', bg: '#F1F5F9', line: '#D7DEE6' },
  emergency: { tag: 'Seen first', fg: '#C24848', bg: '#FDECEC', line: '#F3B5B5' },
  untimed: { tag: 'In queue', fg: '#475569', bg: '#F1F5F9', line: '#D7DEE6' },
};

const titleOf = (section) => {
  if (section.kind === 'emergency') return 'Emergency';
  if (section.kind === 'untimed') return 'No slot time';
  return slotRangeLabel(section);
};

export default function QueueSlotHeader({ range }) {
  if (!range) return null;
  const look = STATES[range.state] || STATES.upcoming;
  return (
    <View style={[s.wrap, { backgroundColor: look.bg, borderColor: look.line }]}>
      <View style={[s.bar, { backgroundColor: look.fg }]} />
      <View style={s.body}>
        <Text style={[s.eyebrow, { color: look.fg }]}>{range.kind === 'session' ? 'SLOT' : 'QUEUE'}</Text>
        <Text translate={false} style={s.title} numberOfLines={1}>{titleOf(range)}</Text>
      </View>
      <View style={s.side}>
        <View style={[s.tag, { borderColor: look.line }]}>
          <Text style={[s.tagText, { color: look.fg }]} numberOfLines={1}>{look.tag}</Text>
        </View>
        <Text translate={false} style={s.count}>{range.count} {range.count === 1 ? 'patient' : 'patients'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingVertical: 8, paddingRight: 10, marginTop: 4, marginBottom: 12, overflow: 'hidden',
  },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginLeft: 6, marginRight: 10 },
  body: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 15, fontWeight: '800', color: '#213547', marginTop: 1 },
  side: { alignItems: 'flex-end', marginLeft: 8, flexShrink: 1 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FFFFFF' },
  tagText: { fontSize: 11, fontWeight: '700' },
  count: { fontSize: 11, color: '#728092', marginTop: 3 },
});
