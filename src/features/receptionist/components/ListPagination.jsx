import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../components/TranslatedText';
import { REC } from '../receptionistUi';

export const LIST_PAGE_SIZE = 10;

// "Showing 1–10 of 23" on the left, ‹ 1 2 3 › on the right.
export default function ListPagination({ page, total, onPageChange, disabled = false }) {
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const start = Math.max(1, Math.min(current - 1, pages - 2));
  const numbers = Array.from({ length: Math.min(3, pages) }, (_, index) => start + index);
  const first = total ? (current - 1) * LIST_PAGE_SIZE + 1 : 0;
  const last = Math.min(current * LIST_PAGE_SIZE, total);

  const arrow = (direction) => {
    const target = direction === 'back' ? current - 1 : current + 1;
    const unavailable = direction === 'back' ? current <= 1 : current >= pages;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={direction === 'back' ? 'Previous page' : 'Next page'}
        accessibilityState={{ disabled: disabled || unavailable }}
        disabled={disabled || unavailable}
        onPress={() => onPageChange(target)}
        hitSlop={4}
        style={({ pressed }) => [s.button, pressed && s.pressed, (disabled || unavailable) && s.disabled]}
      >
        <Ionicons name={direction === 'back' ? 'chevron-back' : 'chevron-forward'} size={16} color={REC.ink} />
      </Pressable>
    );
  };

  return (
    <View style={s.container}>
      <Text translate={false} style={s.summary}>
        Showing <Text translate={false} style={s.summaryStrong}>{first}–{last}</Text> of <Text translate={false} style={s.summaryStrong}>{total}</Text>
      </Text>
      <View style={s.controls}>
        {arrow('back')}
        {numbers.map((number) => {
          const selected = number === current;
          return (
            <Pressable
              key={number}
              accessibilityRole="button"
              accessibilityLabel={`Go to page ${number}`}
              accessibilityState={{ disabled, selected }}
              disabled={disabled || selected}
              onPress={() => onPageChange(number)}
              hitSlop={4}
              style={({ pressed }) => [s.button, selected && s.selected, pressed && !selected && s.pressed, disabled && s.disabled]}
            >
              <Text translate={false} style={[s.buttonText, selected && s.selectedText]}>{number}</Text>
            </Pressable>
          );
        })}
        {arrow('forward')}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTopWidth: 1, borderTopColor: REC.line, marginTop: 6, paddingTop: 14 },
  summary: { fontSize: 12.5, color: REC.muted },
  summaryStrong: { fontWeight: '800', color: REC.ink },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  button: { width: 36, height: 36, borderWidth: 1, borderColor: REC.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: REC.bg },
  pressed: { backgroundColor: '#F2F6F8' },
  buttonText: { fontSize: 13, fontWeight: '700', color: REC.ink },
  selected: { backgroundColor: REC.primary, borderColor: REC.primary },
  selectedText: { color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
});
