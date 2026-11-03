import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import TextInput from '../TranslatedTextInput';
import Text from '../TranslatedText';
import { translatePhrase } from '../../hooks/useSmartT';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { KeyboardSheetOverlay } from './KeyboardSheet';
import {
  findCountryOption,
  findStateOption,
  useCities,
  useCountryStates,
} from '../../services/countryStateApi';

// Every text of the field, written out whole so the phrase dictionary
// (scripts/complete-locales.js) translates each one.
const COPY = {
  country: {
    select: 'Select country',
    search: 'Search country',
    empty: 'No country found',
  },
  state: {
    select: 'Select state',
    // "state" alone reads as "condition" to Google in several languages.
    search: 'Search state or province',
    empty: 'No state found',
    loading: 'Loading list of states…',
    typed: 'State / Province / Region',
  },
  city: {
    select: 'Select city',
    search: 'Search or type city',
    empty: 'No city found',
    loading: 'Loading cities…',
    typed: 'City',
  },
};
const NEEDS_FIRST = { country: 'Select country first', state: 'Select state first' };

// The Country, State or City field of every address form
// (kind="country" | "state" | "city"). Each opens a searchable list from
// services/countryStateApi: states of `country`, cities of `country` + `state`
// (a city missing from the list can still be typed in the search and used).
// A State / City field turns into a plain text field when the API has no list
// for it (or couldn't be reached), so an address can always be completed. The
// screen clears the state and city when the country changes, and the city
// when a state is picked: onChange(value, fromList) — fromList is false while
// a value is being typed.
const CountryStateSelect = ({
  kind = 'country',
  value,
  onChange,
  country,
  state,
  placeholder,
  style,
  textStyle,
  placeholderTextColor = '#94a3b8',
  accentColor = '#0D9488',
  onFocus,
  editable = true,
}) => {
  const { countries, fromApi, loading, retry } = useCountryStates();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isCountry = kind === 'country';
  const isCity = kind === 'city';
  const copy = COPY[kind] || COPY.country;

  const countryOption = useMemo(
    () => findCountryOption(countries, isCountry ? value : country),
    [countries, country, value, isCountry],
  );
  // States come from a list for this country (else they're typed by hand).
  const listedStates = fromApi && countryOption?.states.length ? countryOption.states : null;
  const cityState = isCity && listedStates ? findStateOption(countryOption, state) : '';
  const cityList = useCities(cityState ? countryOption : null, cityState);

  const cities = cityList.cities;
  const options = useMemo(() => {
    if (isCountry) return countries.map((c) => c.name);
    return (kind === 'state' ? listedStates : cities) || [];
  }, [isCountry, kind, countries, listedStates, cities]);

  const selected = isCountry
    ? countryOption?.name || ''
    : options.find((name) => name.toLowerCase() === String(value || '').trim().toLowerCase()) || '';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    if (!isCountry) return options.filter((name) => name.toLowerCase().includes(q));
    return countries
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
      .map((c) => c.name);
  }, [query, options, countries, isCountry]);
  // A city the list lacks: offered as the first row while searching.
  const typedCity = isCity && query.trim() && !options.some((name) => name.toLowerCase() === query.trim().toLowerCase())
    ? query.trim()
    : '';

  const hasCountry = Boolean(String(country || '').trim());
  const hasState = Boolean(String(state || '').trim());
  // What the field needs first, if anything.
  let needs = '';
  if (!isCountry && !hasCountry) needs = NEEDS_FIRST.country;
  else if (isCity && listedStates && !hasState) needs = NEEDS_FIRST.state;

  const waiting = !needs && ((!isCountry && loading) || (isCity && cityList.loading));
  // Typed by hand when there is no list for it.
  const freeText = !isCountry && !needs && !waiting && (
    kind === 'state'
      ? !listedStates
      : !listedStates || !cityState || !cityList.ok || !cityList.cities.length
  );

  if (freeText) {
    return (
      <TextInput
        style={[styles.trigger, style, styles.textInput, textStyle]}
        value={value || ''}
        onChangeText={(text) => onChange?.(text, false)}
        onFocus={onFocus}
        placeholder={placeholder || copy.typed}
        placeholderTextColor={placeholderTextColor}
        editable={editable}
      />
    );
  }

  const disabled = !editable || Boolean(needs) || waiting;
  const shown = String(value || '').trim();
  const hint = needs || (waiting ? copy.loading : placeholder || copy.select);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (name) => {
    close();
    if (name !== value) onChange?.(name, true);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={[styles.trigger, style, styles.triggerRow, disabled && styles.triggerDisabled]}
        accessibilityRole="button"
        accessibilityLabel={shown || translatePhrase(hint)}
      >
        <Text
          numberOfLines={1}
          style={[styles.triggerText, textStyle, !shown && { color: placeholderTextColor }]}
        >
          {shown || hint}
        </Text>
        {waiting ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <Icon name="chevron-down" size={20} color={disabled ? '#cbd5e1' : accentColor} />
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={close}
      >
        <KeyboardSheetOverlay style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text translate={false} style={styles.modalTitle} numberOfLines={1}>
                {translatePhrase(copy.select)
                  + (kind === 'state' && countryOption ? ` · ${countryOption.name}` : '')
                  + (isCity && cityState ? ` · ${cityState}` : '')}
              </Text>
              <TouchableOpacity onPress={close} style={styles.closeButton}>
                <Icon name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBox, { borderColor: accentColor }]}>
              <Icon name="magnify" size={20} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={copy.search}
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
              />
            </View>
            {isCountry && !fromApi && (
              <TouchableOpacity onPress={retry} disabled={loading} style={styles.notice}>
                {loading ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <Icon name="refresh" size={16} color="#B45309" />
                )}
                <Text style={styles.noticeText}>
                  {loading ? 'Loading countries…' : 'Offline list shown. Tap to reload.'}
                </Text>
              </TouchableOpacity>
            )}
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={rows}
              keyExtractor={(item) => item}
              style={styles.list}
              initialNumToRender={24}
              renderItem={({ item }) => {
                const active = item === selected;
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowSelected]}
                    onPress={() => choose(item)}
                  >
                    <Text
                      translate={false}
                      style={[styles.rowText, active && { color: accentColor }]}
                      numberOfLines={1}
                    >
                      {item}
                    </Text>
                    {active && <Icon name="check" size={18} color={accentColor} />}
                  </TouchableOpacity>
                );
              }}
              ListHeaderComponent={typedCity ? (
                <TouchableOpacity style={styles.row} onPress={() => choose(typedCity)}>
                  <Icon name="plus-circle-outline" size={18} color={accentColor} />
                  <Text translate={false} style={[styles.rowText, { color: accentColor }]} numberOfLines={1}>
                    {`Use "${typedCity}"`}
                  </Text>
                </TouchableOpacity>
              ) : null}
              ListEmptyComponent={typedCity ? null : (
                <Text style={styles.emptyText}>{copy.empty}</Text>
              )}
            />
          </View>
        </KeyboardSheetOverlay>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerDisabled: { opacity: 0.6 },
  triggerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#1e293b',
  },
  textInput: { color: '#1e293b' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    flexShrink: 1,
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
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    marginBottom: 8,
  },
  noticeText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#B45309' },
  list: { marginHorizontal: -4 },
  row: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowSelected: { backgroundColor: '#eef6ff' },
  rowText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '700',
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

export default CountryStateSelect;
