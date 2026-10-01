import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Linking, Platform, TurboModuleRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';
import useLanguageRender from '../hooks/useLanguageRender';
import { PATIENT_GRADIENT, DOCTOR_GRADIENT, CLINICIAN_GRADIENT, GRADIENT_DIRECTION } from '../theme/palette';
import { APP_VERSION, PLAY_STORE_URL, DEV_SIMULATE_UPDATE_AVAILABLE } from '../constants/appInfo';
import { APP_UPDATE_NOTIFICATION_TYPE, displaySystemNotification } from '../services/notificationService';

// Each new store version is announced at most MAX_REMINDERS times, at least
// a day apart: the popup plus a device notification each time. After that the
// app stops reminding until the store has an even newer version.
const REMINDER_KEY = 'update_reminder_state'; // { version, count, lastShownAt }
const MAX_REMINDERS = 2;
const REMINDER_GAP_MS = 24 * 60 * 60 * 1000;

const GRADIENTS = { patient: PATIENT_GRADIENT, consultant: DOCTOR_GRADIENT, doctor: CLINICIAN_GRADIENT };

// Reserves one of this version's reminders, or returns false when they are
// used up (or the last one was less than a day ago).
const claimReminder = async (storeVersion) => {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(REMINDER_KEY)) || 'null');
    const sameVersion = saved?.version === storeVersion;
    const count = sameVersion ? Number(saved.count || 0) : 0;
    if (count >= MAX_REMINDERS) return false;
    if (sameVersion && Date.now() - Number(saved.lastShownAt || 0) < REMINDER_GAP_MS) return false;
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ version: storeVersion, count: count + 1, lastShownAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
};

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
 *   variant  'patient' | 'consultant' | 'doctor'  (default 'patient') —
 *            which brand gradient to use for the icon badge and CTA button.
 */
const UpdateReminderModal = ({ variant = 'patient' }) => {
  const { t } = useLanguageRender();
  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);
  const gradient = GRADIENTS[variant] || PATIENT_GRADIENT;

  // Popup + device notification, only while this version still has reminders left.
  const remind = async (storeVersion) => {
    if (!(await claimReminder(storeVersion || 'unknown'))) return;
    setVisible(true);
    displaySystemNotification({
      notification: {
        title: t('Update available'),
        body: t('A new version of Humaeli is available. Tap to update.'),
      },
      data: { type: APP_UPDATE_NOTIFICATION_TYPE, url: PLAY_STORE_URL, version: String(storeVersion || '') },
    }).catch(() => {});
  };

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
        .then((result) => {
          if (result?.shouldUpdate) remind(result.storeVersion);
        })
        .catch(() => {
          // Play Core's real check needs a signed release build installed
          // from the Play Store, so it always fails on a debug/Metro build.
          if (__DEV__ && DEV_SIMULATE_UPDATE_AVAILABLE) remind('dev-simulated');
        });
    } catch (error) {
      console.log('[UpdateReminder] Update check failed:', error?.message || error);
      if (__DEV__ && DEV_SIMULATE_UPDATE_AVAILABLE) remind('dev-simulated');
    }
    // Runs once per mount; `remind` only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The reminder was already counted when it was shown.
  const handleLater = () => setVisible(false);

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
