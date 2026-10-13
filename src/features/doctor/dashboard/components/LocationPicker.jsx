// Location picker for the doctor profile. Three ways to set the address:
//   1. "Use my current location" — a fresh GPS fix, turned into an address by
//      the phone's own Geocoder (native ReverseGeocoder module: Google data,
//      names the area and pincode). Falls back to OpenStreetMap reverse
//      geocoding where that module isn't available (iOS, or an older build).
//   2. Search — type a place and pick one of the live suggestions
//      (OpenStreetMap Nominatim, India first).
//   3. Type it manually.
// "View on map" opens the chosen address in Google Maps.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, NativeModules, Pressable, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import AppIcon from '../icons/AppIcon';
import { colors, createDoctorStyles } from '../theme';
import { getCurrentPosition } from '../../../../utils/locationHelper';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'HumaeliApp/1.0 (support@humaeli.com)' };

// Joins address parts in order, dropping blanks and repeats, and puts the
// pincode after the last part ("…, Madhya Pradesh 452010").
const joinAddress = (parts, postcode) => {
  const unique = parts
    .map((part) => String(part || '').trim())
    .filter((part, index, all) => part && all.indexOf(part) === index);
  if (unique.length && postcode) unique[unique.length - 1] = `${unique[unique.length - 1]} ${postcode}`;
  return unique.join(', ');
};

// "Street, Area, City, State PIN" from a Nominatim result. Indian areas often
// come as quarter / residential / neighbourhood rather than suburb.
const shortAddress = (item) => {
  const a = item?.address || {};
  const parts = [
    a.road,
    a.neighbourhood || a.residential || a.quarter || a.hamlet,
    a.suburb,
    a.city || a.town || a.village || a.county || a.state_district,
    a.state,
  ];
  const text = joinAddress(parts, a.postcode);
  return text.split(', ').length >= 2 ? text : String(item?.display_name || '').split(', ').slice(0, 4).join(', ');
};

// "Street, Area, City, State PIN" from the phone's Geocoder ('' if none).
const nativeAddress = (a) => {
  if (!a) return '';
  const street = a.thoroughfare && !/unnamed road/i.test(a.thoroughfare) ? a.thoroughfare : '';
  const text = joinAddress([street, a.subLocality, a.locality || a.subAdminArea, a.adminArea], a.postalCode);
  if (a.subLocality || !a.addressLine) return text;
  // No area field: the full line usually still names it — drop the country
  // and any Google plus code ("XQ2V+7G").
  return String(a.addressLine)
    .split(', ')
    .filter((part) => part && part !== a.countryName && !/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/.test(part))
    .join(', ');
};

const reverseGeocode = async (latitude, longitude) => {
  const geocoder = NativeModules.ReverseGeocoder;
  if (geocoder?.reverse) {
    try {
      const address = nativeAddress(await geocoder.reverse(latitude, longitude));
      if (address) return address;
    } catch {
      // no network / no Geocoder backend — fall through to OpenStreetMap
    }
  }
  const res = await fetch(`${NOMINATIM}/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`, { headers: HEADERS });
  if (!res.ok) throw new Error('Could not look up this location');
  return shortAddress(await res.json());
};

export default function LocationPicker({ value, onChange, label = 'Location / Address' }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef(null);
  const skipSearchRef = useRef(false);

  useEffect(() => { setQuery(value || ''); }, [value]);

  // Debounced live search while the doctor types.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return undefined;
    }
    const term = query.trim();
    if (!focused || term.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=json&addressdetails=1&limit=6&countrycodes=in&q=${encodeURIComponent(term)}`,
          { headers: HEADERS },
        );
        const data = res.ok ? await res.json() : [];
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timerRef.current);
  }, [query, focused]);

  const choose = (address) => {
    skipSearchRef.current = true;
    setQuery(address);
    setSuggestions([]);
    onChange?.(address);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentPosition({ fresh: true, timeout: 26000 });
      const address = await reverseGeocode(coords.latitude, coords.longitude);
      if (!address) throw new Error('Could not find an address for your location.');
      choose(address);
    } catch (err) {
      if (err?.kind === 'blocked') {
        Alert.alert('Location permission', 'Location is turned off for Humaeli. Enable it in Settings to use your current location.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert('Location', err?.message || 'Could not get your current location.');
      }
    } finally {
      setLocating(false);
    }
  };

  const openMap = () => {
    if (!value) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`).catch(() => {});
  };

  return (
    <View>
      <Pressable style={[s.gpsBtn, locating && s.disabled]} onPress={useCurrentLocation} disabled={locating}>
        {locating ? <ActivityIndicator size="small" color="#FFF" /> : <AppIcon name="pin" size={16} color="#FFF" strokeWidth={2.2} />}
        <Text translate={false} style={s.gpsText}>{locating ? 'Getting your location…' : 'Use my current location'}</Text>
      </Pressable>

      <View style={s.orRow}><View style={s.orLine} /><Text style={s.orText}>or search</Text><View style={s.orLine} /></View>

      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputWrapFocused]}>
        <AppIcon name="search" size={15} color={focused ? colors.blue : '#98A2B3'} />
        <TextInput
          value={query}
          onChangeText={(text) => { setQuery(text); onChange?.(text); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Search area, city or clinic address"
          placeholderTextColor="#94A3B8"
          style={s.input}
        />
        {searching && <ActivityIndicator size="small" color={colors.blue} />}
        {!!query && !searching && (
          <Pressable onPress={() => { setQuery(''); onChange?.(''); setSuggestions([]); }} hitSlop={8}>
            <AppIcon name="x" size={14} color="#98A2B3" />
          </Pressable>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={s.suggestions}>
          {suggestions.map((item) => (
            <Pressable key={String(item.place_id)} style={({ pressed }) => [s.suggestion, pressed && s.suggestionPressed]} onPress={() => choose(shortAddress(item))}>
              <AppIcon name="pin" size={14} color={colors.blue} />
              <View style={s.flex}>
                <Text translate={false} style={s.suggestionMain} numberOfLines={1}>{shortAddress(item)}</Text>
                <Text translate={false} style={s.suggestionSub} numberOfLines={1}>{item.display_name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!!value && (
        <View style={s.selected}>
          <View style={s.selectedIcon}><AppIcon name="pin" size={18} color={colors.blue} strokeWidth={2.2} /></View>
          <View style={s.flex}>
            <Text style={s.selectedLabel}>Selected location</Text>
            <Text translate={false} style={s.selectedValue}>{value}</Text>
          </View>
          <Pressable onPress={openMap} hitSlop={6} style={s.mapBtn}>
            <Text style={s.mapBtnText}>View on map</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = createDoctorStyles({
  flex: { flex: 1 },
  disabled: { opacity: 0.7 },
  gpsBtn: { height: 46, borderRadius: 12, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gpsText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E3E8EF' },
  orText: { fontSize: 12, fontWeight: '700', color: '#98A2B3' },
  label: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderWidth: 1.5, borderColor: '#D5DAE3', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#FFF' },
  inputWrapFocused: { borderColor: colors.blue },
  input: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  suggestions: { marginTop: 6, borderWidth: 1, borderColor: '#D5E7E4', borderRadius: 12, backgroundColor: '#FFF', overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF3F2' },
  suggestionPressed: { backgroundColor: '#F0FDFA' },
  suggestionMain: { fontSize: 13.5, fontWeight: '700', color: '#17243A' },
  suggestionSub: { fontSize: 11.5, color: '#667085', marginTop: 1 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4' },
  selectedIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  selectedLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: '#0F766E', textTransform: 'uppercase' },
  selectedValue: { fontSize: 13.5, fontWeight: '700', color: '#17243A', marginTop: 2 },
  mapBtn: { borderWidth: 1, borderColor: colors.blue, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#FFF' },
  mapBtnText: { fontSize: 11.5, fontWeight: '800', color: colors.blue },
});
