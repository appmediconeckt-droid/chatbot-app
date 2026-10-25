// Ported from MediconecktApp's src/doctor/dashboard/components/DoctorSidebar.tsx.
// Adaptation: the profile card reads the real (mock) doctor name/specialization
// from AsyncStorage instead of the source's hardcoded "Vikas Sharma".
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DoctorAvatar from './layout/DoctorAvatar';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { colors, typography, createDoctorStyles } from '../theme';
import LanguageSelector from '../../../../components/common/LanguageSelector';
import { LANGUAGES } from '../../../../i18n';
import { useLanguageContext } from '../../../../contexts/LanguageContext';
import { CLINICIAN } from '../../../../theme/palette';
import {
  formatDoctorDisplayName,
  getDoctorIdFromUser,
  getStoredDoctorUser,
  loadDoctorDisplayProfile,
  refreshDoctorUserOnce,
} from '../api/doctorAppointments';

const activeNav = {
  color: colors.blue,
  bg: colors.paleBlue,
  border: '#99F6E4',
  iconBg: '#CCFBF1',
  pressedBg: '#E6FFFB',
};

const GROUPS = [
  {
    label: 'MAIN',
    items: [
      { id: 'appointments', label: 'Appointments', icon: 'calendar', ...activeNav },
      { id: 'followUps', label: 'Follow Ups', icon: 'refresh', ...activeNav },
      { id: 'reviews', label: 'Reviews', icon: 'star', ...activeNav },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { id: 'qrCode', label: 'QR Code', icon: 'qr', ...activeNav },
      { id: 'clinic', label: 'Clinic Profile', icon: 'plus', ...activeNav },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings', ...activeNav },
    ],
  },
];

export default function DoctorSidebar({
  visible,
  activeItem,
  onClose,
  onNavigate,
  onProfilePress,
  onLogout,
}) {
  // The translucent Modal draws under the status bar AND the navigation bar
  // (edge-to-edge), so reserve both — Logout was half hidden behind 3-button
  // nav bars.
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight || 0)
    : insets.top;
  const [selectedItem, setSelectedItem] = useState(activeItem ?? null);
  const [doctorName, setDoctorName] = useState('Doctor');
  const [specialization, setSpecialization] = useState('');

  // Language: same per-doctor setting as Settings → Language (the dashboard
  // re-applies it on focus), so both entry points stay in sync.
  const { language: appLanguage } = useLanguageContext();
  const currentLanguageName = LANGUAGES.find((lang) => lang.code === appLanguage)?.name || 'English';
  const [doctorId, setDoctorId] = useState(null);
  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = getDoctorIdFromUser(user);
      if (id) setDoctorId(String(id));
    });
  }, []);

  useEffect(() => {
    setSelectedItem(activeItem ?? null);
  }, [activeItem, visible]);

  // Re-read on every open so a name or specialization edited in the profile
  // shows up, and once more after the server copy has been refreshed.
  useEffect(() => {
    if (!visible) return undefined;
    let mounted = true;
    const load = () => loadDoctorDisplayProfile().then(({ name, specialization: spec }) => {
      if (!mounted) return;
      setDoctorName(name);
      setSpecialization(spec || '');
    });
    load();
    refreshDoctorUserOnce().then(load).catch(() => {});
    return () => { mounted = false; };
  }, [visible]);

  const displayName = formatDoctorDisplayName(doctorName);
  // The card has room for one line: the first specialization, then "+N" for
  // the rest (all of them joined ran off the card).
  const specList = specialization.split(',').map((item) => item.trim()).filter(Boolean);
  const primarySpec = specList[0] || 'General Physician';
  const extraSpecs = specList.length - 1;

  // Opening animation: the panel slides in from the left while zooming up from
  // slightly small, and the backdrop fades in — quicker and livelier than the
  // Modal's built-in fade.
  const openAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    openAnim.setValue(0);
    Animated.timing(openAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, openAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <Pressable style={styles.backdropTap} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            { paddingTop: topInset + 12 },
            {
              opacity: openAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
              transform: [
                { translateX: openAnim.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) },
                { scale: openAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open doctor profile"
            onPress={onProfilePress}
            style={({ pressed }) => [styles.profileCard, pressed && styles.profileCardPressed]}
          >
            <View style={styles.avatarWrap}>
              <DoctorAvatar size={45} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.profileInfo}>
              <Text translate={false} style={styles.name} numberOfLines={1}>{displayName}</Text>
              <View style={styles.specRow}>
                <Text translate={false} style={styles.specialty} numberOfLines={1}>{primarySpec}</Text>
                {extraSpecs > 0 && (
                  <View style={styles.specMore}>
                    <Text translate={false} style={styles.specMoreText}>+{extraSpecs}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.profileChevron}>›</Text>
          </Pressable>

          <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menu} showsVerticalScrollIndicator={false}>
            {GROUPS.map((group) => (
              <View key={group.label} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.items.map((item) => {
                  const selected = selectedItem === item.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={item.id}
                      onPress={() => {
                        setSelectedItem(item.id);
                        onNavigate(item.id);
                      }}
                      style={({ pressed }) => [
                        styles.item,
                        selected && styles.selectedItem,
                        selected && { backgroundColor: item.bg, borderColor: item.border },
                        pressed && [styles.pressedItem, { backgroundColor: selected ? item.pressedBg : '#EEF4FA' }],
                      ]}
                    >
                      {selected && <View style={[styles.selectedBar, { backgroundColor: item.color }]} />}
                      <View style={[styles.iconBox, selected && { backgroundColor: item.iconBg }]}>
                        <AppIcon name={item.icon} size={19} strokeWidth={2} color={selected ? item.color : '#28405F'} />
                      </View>
                      <Text style={[styles.itemText, selected && styles.selectedItemText, selected && { color: item.color }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
            <LanguageSelector
              userId={doctorId}
              role="doctor"
              brand={CLINICIAN.primary}
              triggerStyle={[styles.item, styles.languageItem]}
            >
              <View style={styles.languageIconBox}>
                <AppIcon name="globe" size={18} strokeWidth={1.8} color={colors.blue} />
              </View>
              <Text style={styles.itemText}>Language</Text>
              <Text style={styles.languageValue} numberOfLines={1} translate={false}>{currentLanguageName}</Text>
              <AppIcon name="chevron-right" size={16} strokeWidth={2} color="#98A2B3" />
            </LanguageSelector>
            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [styles.item, styles.logoutItem, pressed && styles.pressedItem]}
            >
              <View style={styles.logoutIconBox}>
                <AppIcon name="logout" size={19} strokeWidth={1.8} color="#D92D36" />
              </View>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = createDoctorStyles({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,33,63,0.28)' },
  backdropTap: { flex: 1 },
  panel: { width: '88%', maxWidth: 360, height: '100%', backgroundColor: '#FFFFFF', paddingTop: 34, borderTopRightRadius: 26, borderBottomRightRadius: 18, shadowColor: '#10213F', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 5, height: 0 }, elevation: 12 },
  profileCard: { minHeight: 76, paddingVertical: 12, marginHorizontal: 16, borderWidth: 1, borderColor: '#BFF8F6', backgroundColor: colors.paleBlue, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#10213F', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  profileCardPressed: { backgroundColor: '#E6FFFB' },
  avatarWrap: { position: 'relative', marginRight: 12 },
  onlineDot: { position: 'absolute', right: 0, bottom: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#20A05A', borderWidth: 2, borderColor: '#FFF' },
  profileInfo: { flex: 1 },
  name: { ...typography.subtitle, fontSize: 16.5, lineHeight: 21, color: '#10213F' },
  specRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  specialty: { ...typography.body, flexShrink: 1, fontSize: 13.5, lineHeight: 18, color: '#667085' },
  specMore: { borderRadius: 9, backgroundColor: '#CCFBF1', paddingHorizontal: 6, paddingVertical: 1 },
  specMoreText: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  profileChevron: { ...typography.text, fontSize: 24, lineHeight: 26, color: '#98A2B3' },
  menuScroll: { flex: 1, marginTop: 6 },
  menu: { paddingHorizontal: 16, paddingBottom: 12 },
  group: { marginTop: 16 },
  groupLabel: { ...typography.label, fontSize: 11, lineHeight: 16, color: '#98A2B3', marginBottom: 8, marginLeft: 4 },
  item: { height: 50, width: '100%', borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 11, position: 'relative', marginBottom: 5 },
  selectedItem: { borderWidth: 1, borderColor: '#D9E2EC' },
  pressedItem: { backgroundColor: '#E6FFFB', opacity: 1, transform: [{ scale: 0.99 }] },
  selectedBar: { position: 'absolute', left: 0, width: 3, height: 22, borderRadius: 2, backgroundColor: colors.blue },
  iconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F3F6FA', alignItems: 'center', justifyContent: 'center' },
  itemText: { ...typography.body, fontSize: 15, lineHeight: 20, color: '#10213F', flex: 1 },
  selectedItemText: { ...typography.caption, fontSize: 15, lineHeight: 20, flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#E8ECF1' },
  languageItem: { marginBottom: 4 },
  languageIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  languageValue: { ...typography.caption, fontSize: 13, lineHeight: 18, color: colors.blue, maxWidth: 110 },
  logoutItem: { marginTop: 0, marginBottom: 0 },
  logoutIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFF0F1', alignItems: 'center', justifyContent: 'center' },
  logoutText: { ...typography.caption, fontSize: 15, lineHeight: 20, color: '#D92D36', flex: 1 },
});
