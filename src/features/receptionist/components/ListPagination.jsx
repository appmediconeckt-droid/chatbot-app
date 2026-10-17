import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../../../components/TranslatedText';
import { REC } from '../receptionistUi';

export const LIST_PAGE_SIZE = 10;

export default function ListPagination({ page, total, onPageChange, disabled = false }) {
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const start = Math.max(1, Math.min(current - 1, pages - 2));
  const numbers = Array.from({ length: Math.min(3, pages) }, (_, index) => start + index);
  const first = total ? (current - 1) * LIST_PAGE_SIZE + 1 : 0;
  const last = Math.min(current * LIST_PAGE_SIZE, total);
  const button = (label, target, unavailable, selected = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={typeof label === 'number' ? `Go to page ${label}` : `${label} page`}
      accessibilityState={{ disabled: disabled || unavailable, selected }}
      disabled={disabled || unavailable}
      onPress={() => onPageChange(target)}
      style={[s.button, selected && s.selected, (disabled || unavailable) && s.disabled]}
    >
      <Text translate={typeof label !== 'number'} style={[s.buttonText, selected && s.selectedText]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.container}>
      <Text translate={false} style={s.summary}>Showing {first}-{last} of {total}</Text>
      <View style={s.controls}>
        {button('Previous', current - 1, current <= 1)}
        <View style={s.numbers}>
          {numbers.map(number => button(number, number, false, number === current))}
        </View>
        {button('Next', current + 1, current >= pages)}
      </View>
      <Text translate={false} style={s.summary}>Page {current} of {pages}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { borderTopWidth: 1, borderTopColor: REC.line, marginTop: 14, paddingTop: 14, gap: 10 },
  summary: { fontSize: 12, color: REC.muted },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  button: { minWidth: 40, minHeight: 44, paddingHorizontal: 8, borderWidth: 1, borderColor: REC.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: REC.bg },
  buttonText: { fontSize: 12, fontWeight: '700', color: REC.ink },
  selected: { backgroundColor: REC.primary, borderColor: REC.primary },
  selectedText: { color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
});
