import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  COUNTRY_CODES,
  LOCAL_PHONE_NUMBER_LENGTH,
  findCountryByCode,
  normalizeLocalPhoneNumber,
} from '../../utils/countryCodes';

const CountryPhoneInput = ({
  value,
  countryCode,
  onChangePhoneNumber,
  onChangeCountryCode,
  placeholder = 'Phone Number',
  accentColor = '#00652C',
  focused = false,
  onFocus,
  onBlur,
  containerStyle,
  inputStyle,
  iconColor = '#64748b',
  placeholderTextColor = '#94a3b8',
  showIcon = true,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const selectedCountry = findCountryByCode(countryCode);
  const selectedCode = selectedCountry?.code || countryCode || '+91';

  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return COUNTRY_CODES;
    const digitQuery = normalizedQuery.replace(/\D/g, '');

    return COUNTRY_CODES.filter((country) => {
      const name = country.name.toLowerCase();
      const iso = country.iso2.toLowerCase();
      const code = country.code.toLowerCase();
      const codeDigits = country.code.replace(/\D/g, '');
      return (
        name.includes(normalizedQuery) ||
        iso.includes(normalizedQuery) ||
        code.includes(normalizedQuery) ||
        (!!digitQuery && codeDigits.includes(digitQuery))
      );
    });
  }, [query]);

  const handleSelectCountry = (country) => {
    onChangeCountryCode?.(country.code);
    onChangePhoneNumber?.(normalizeLocalPhoneNumber(value, country.code));
    setModalVisible(false);
    setQuery('');
  };

  return (
    <>
      <View style={[styles.inputWrapper, focused && { borderColor: accentColor, backgroundColor: '#ffffff' }, containerStyle]}>
        {showIcon ? (
          <Icon
            name="phone-outline"
            size={20}
            color={focused ? accentColor : iconColor}
            style={styles.inputIcon}
          />
        ) : null}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
          style={styles.codeButton}
        >
          <Text style={[styles.codeText, { color: accentColor }]} numberOfLines={1}>
            {selectedCode}
          </Text>
          <Icon name="chevron-down" size={18} color={accentColor} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TextInput
          style={[styles.textInput, inputStyle]}
          value={value}
          onChangeText={(text) => onChangePhoneNumber?.(normalizeLocalPhoneNumber(text, selectedCode))}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          keyboardType="phone-pad"
          maxLength={LOCAL_PHONE_NUMBER_LENGTH}
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select country code</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBox, { borderColor: accentColor }]}>
              <Icon name="magnify" size={20} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search country or code"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredCountries}
              keyExtractor={(item, index) => `${item.iso2}-${item.code}-${index}`}
              style={styles.countryList}
              initialNumToRender={24}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCode;
                return (
                  <TouchableOpacity
                    style={[styles.countryRow, isSelected && styles.countryRowSelected]}
                    onPress={() => handleSelectCountry(item)}
                  >
                    <View style={styles.countryNameWrap}>
                      <Text style={styles.countryName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.countryIso}>{item.iso2}</Text>
                    </View>
                    <Text style={[styles.countryCode, isSelected && { color: accentColor }]}>
                      {item.code}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No country code found</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 54,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
  inputIcon: { marginRight: 8 },
  codeButton: {
    minWidth: 72,
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  codeText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    color: '#1e293b',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 0 : 6,
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '82%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: '#0f172a',
    includeFontPadding: false,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  searchBox: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '600',
    includeFontPadding: false,
  },
  countryList: { marginHorizontal: -4 },
  countryRow: {
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  countryRowSelected: { backgroundColor: '#eef6ff' },
  countryNameWrap: { flex: 1, minWidth: 0 },
  countryName: {
    fontSize: 14,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '700',
    includeFontPadding: false,
  },
  countryIso: {
    fontSize: 11,
    lineHeight: 14,
    color: '#94a3b8',
    fontWeight: '800',
    marginTop: 2,
    includeFontPadding: false,
  },
  countryCode: {
    fontSize: 14,
    lineHeight: 18,
    color: '#334155',
    fontWeight: '900',
    includeFontPadding: false,
  },
  emptyText: {
    paddingVertical: 28,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default CountryPhoneInput;
