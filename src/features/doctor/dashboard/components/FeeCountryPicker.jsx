// Searchable list of countries, each with the currency it sets for the
// doctor's fees (the server takes the fee currency from the profile country).
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { COUNTRY_OPTIONS, currencySymbol } from '../../../../utils/consultationCurrency';

export default function FeeCountryPicker({ visible, selected, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) =>
      c.name.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onShow={() => setQuery('')}
    >
      <View style={s.pickerBackdrop}>
        <Pressable style={s.pickerBackdropTap} onPress={onClose} />
        <View style={[s.pickerSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.pickerHandle} />
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Fee Country & Currency</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <AppIcon name="x" size={20} color="#475467" strokeWidth={2.2} />
            </Pressable>
          </View>
          <View style={s.pickerSearch}>
            <AppIcon name="search" size={16} color="#7B8493" strokeWidth={1.9} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or currency"
              placeholderTextColor="#94A3B8"
              style={s.pickerSearchInput}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            style={s.pickerList}
            ListEmptyComponent={<Text style={s.pickerEmpty}>No country found</Text>}
            renderItem={({ item }) => {
              const active = item.name === selected;
              return (
                <Pressable
                  onPress={() => onSelect(item.name)}
                  style={({ pressed }) => [s.pickerRow, active && s.pickerRowActive, pressed && s.pickerRowPressed]}
                >
                  <Text translate={false} style={[s.pickerRowName, active && s.pickerRowNameActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text translate={false} style={s.pickerRowCurrency}>
                    {currencySymbol(item.currency)} {item.currency}
                  </Text>
                  {active && <AppIcon name="check" size={16} color="#0D9488" strokeWidth={2.6} />}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const s = createDoctorStyles({
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(16,33,63,0.35)', justifyContent: 'flex-end' },
  pickerBackdropTap: { flex: 1 },
  pickerSheet: { height: '78%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8 },
  pickerHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', marginBottom: 10 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerTitle: { fontSize: 16.5, fontWeight: '800', color: '#17243A' },
  pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 },
  pickerSearchInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  pickerList: { flex: 1 },
  pickerEmpty: { textAlign: 'center', color: '#667085', fontSize: 13, paddingVertical: 24 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10 },
  pickerRowActive: { backgroundColor: '#F0FDFA' },
  pickerRowPressed: { backgroundColor: '#F2F4F7' },
  pickerRowName: { flex: 1, fontSize: 14.5, color: '#17243A' },
  pickerRowNameActive: { fontWeight: '800', color: '#0F766E' },
  pickerRowCurrency: { fontSize: 13, fontWeight: '700', color: '#667085' },
});
