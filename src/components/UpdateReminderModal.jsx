import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Linking, Platform, TurboModuleRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';
import useLanguageRender from '../hooks/useLanguageRender';
import { PATIENT_GRADIENT, DOCTOR_GRADIENT, GRADIENT_DIRECTION } from '../theme/palette';
import { APP_VERSION, PLAY_STORE_URL, DEV_SIMULATE_UPDATE_AVAILABLE } from '../constants/appInfo';

// "Later" snoozes the reminder for a day rather than closing it for good —
// nags again on the next app open only once a day has actually passed, same
// as most store apps. A newer store version than the one snoozed breaks
// through immediately, so a fresh release is never held back by an old snooze.
const SNOOZE_KEY = 'update_reminder_snoozed_until';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

const getSpInAppUpdates = () => {
  // The library calls TurboModuleRegistry.getEnforcing('SpInAppUpdates') the
  // moment it loads, and in dev that throw reaches LogBox as an uncaught
  // error even inside this try/catch. On a binary built before the native
  // module was added, bail out before requiring it at all.
  if (!TurboModuleRegistry.get('SpInAppUpdates')) {
    console.log('[UpdateReminder] In-app update native module not in this build; skipping check.');
    return null;
  }
  try {
    const updatesModule = require('sp-react-native-in-app-updates');
    return updatesModule?.default || updatesModule;
  } catch (error) {
    console.log('[UpdateReminder] In-app update module unavailable:', error?.message || error);
    return null;
  }
};

/**
 * Asks the Play Store (via Play Core) whether a newer version of the app is
 * live, and shows a dismissible reminder if so — on both the patient and
 * consultant dashboards, each mounting this with their own `variant` so the
 * reminder always matches the brand colour of the screen it's on.
 *
 * "Update now" opens the Play Store listing directly, same as tapping the
 * app's card in the store. It only ever shows on a genuine version mismatch
 * reported by the Play Store itself — never just because the app was opened.
 *
 * Props:
 *   variant  'patient' | 'consultant'  (default 'patient') — which brand
 *            gradient to use for the icon badge and CTA button.
 */
const UpdateReminderModal = ({ variant = 'patient' }) => {
  const { t } = useLanguageRender();
  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);
  const storeVersionRef = useRef('');
  const gradient = variant === 'consultant' ? DOCTOR_GRADIENT : PATIENT_GRADIENT;

  useEffect(() => {
    // In-app updates are Android/Play Store only — there's no iOS release to
    // check against here.
    if (checkedRef.current || Platform.OS !== 'android') return;
    checkedRef.current = true;

    const SpInAppUpdates = getSpInAppUpdates();
    if (!SpInAppUpdates) return;

    try {
      const inAppUpdates = new SpInAppUpdates(false);
      inAppUpdates
        .checkNeedsUpdate({ curVersion: APP_VERSION })
        .then(async (result) => {
          if (!result?.shouldUpdate) return;
          storeVersionRef.current = result.storeVersion || '';
          if (await isSnoozed(storeVersionRef.current)) return;
          setVisible(true);
        })
        .catch(() => {
          // Play Core's real check needs a signed release build installed
          // from the Play Store, so it always fails on a debug/Metro build.
          if (__DEV__ && DEV_SIMULATE_UPDATE_AVAILABLE) setVisible(true);
        });
    } catch (error) {
      console.log('[UpdateReminder] Update check failed:', error?.message || error);
      if (__DEV__ && DEV_SIMULATE_UPDATE_AVAILABLE) setVisible(true);
    }
  }, []);

  // Was this exact store version snoozed less than 24h ago? A snooze from an
  // older version doesn't count — if the store has moved on to something even
  // newer since the user last said "Later", that's worth surfacing right away.
  const isSnoozed = async (storeVersion) => {
    try {
      const raw = await AsyncStorage.getItem(SNOOZE_KEY);
      if (!raw) return false;
      const { until, version } = JSON.parse(raw);
      return version === storeVersion && Date.now() < until;
    } catch {
      return false;
    }
  };

  const handleLater = () => {
    setVisible(false);
    AsyncStorage.setItem(
      SNOOZE_KEY,
      JSON.stringify({ until: Date.now() + SNOOZE_MS, version: storeVersionRef.current }),
    ).catch(() => {});
  };

  const handleUpdate = () => {
    setVisible(false);
    Linking.openURL(PLAY_STORE_URL).catch(() => {});
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleLater}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#9AA5B1" />
          </TouchableOpacity>

          <LinearGradient
            colors={gradient}
            {...GRADIENT_DIRECTION}
            style={styles.iconBadge}
          >
            <Ionicons name="cloud-download-outline" size={30} color="#fff" />
          </LinearGradient>

          <Text style={styles.title}>{t('Update available')}</Text>
          <Text style={styles.subtitle}>
            {t('A new version of Humaeli is available with the latest features and fixes. Update now for the best experience.')}
          </Text>

          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
            <LinearGradient
              colors={gradient}
              {...GRADIENT_DIRECTION}
              style={styles.updateInner}
            >
              <Ionicons name="logo-google-playstore" size={18} color="#fff" />
              <Text style={styles.updateText}>{t('Update now')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterBtn} onPress={handleLater}>
            <Text style={styles.laterText}>{t('Later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#526071',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  updateBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    minHeight: 50,
  },
  updateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterBtn: {
    paddingVertical: 12,
    marginTop: 4,
  },
  laterText: {
    color: '#9AA5B1',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UpdateReminderModal;
