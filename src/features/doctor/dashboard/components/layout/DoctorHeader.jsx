// Ported from MediconecktApp's src/doctor/components/layout/DoctorHeader.tsx.
// Adaptation: the header reads the real (mock) doctor name from
// AsyncStorage instead of the source's hardcoded "Dr. Sharma".
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import DoctorAvatar from './DoctorAvatar';
import Text from '../../../../../components/TranslatedText';
import { colors, typography, createDoctorStyles } from '../../theme';
import AppIcon from '../../icons/AppIcon';
import { formatDoctorDisplayName, loadDoctorDisplayProfile } from '../../api/doctorAppointments';
import { fetchNotificationList, subscribeToNewNotifications } from '../../api/doctorNotifications';
import { toDoctorNotifications } from '../NotificationsScreen';

// Fallback refresh for the bell when the socket isn't delivering events.
const UNREAD_POLL_MS = 60000;

export default function DoctorHeader({ onMenuPress, onProfilePress, onNotificationsPress, onSettingsPress }) {
  const [doctorName, setDoctorName] = useState('Doctor');
  // Unread notifications (same list and rules as the Notifications screen).
  // The red badge used to be drawn always, whether or not anything was unread.
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    loadDoctorDisplayProfile().then(({ name }) => setDoctorName(name));
  }, []);

  useEffect(() => {
    let mounted = true;
    const refresh = () => fetchNotificationList()
      .then((list) => { if (mounted) setUnread(toDoctorNotifications(list).filter((n) => !n.read).length); })
      .catch(() => { /* keep the last count */ });
    refresh();
    const timer = setInterval(refresh, UNREAD_POLL_MS);
    const unsubscribe = subscribeToNewNotifications(refresh);
    return () => { mounted = false; clearInterval(timer); unsubscribe(); };
  }, []);

  const displayName = formatDoctorDisplayName(doctorName);

  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Open menu" style={styles.menu} onPress={onMenuPress}>
        <AppIcon name="menu" size={24} strokeWidth={2} color={colors.ink} />
      </Pressable>
      <View style={styles.titleArea}>
        <Text translate={false} style={styles.doctor} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Settings" style={styles.actionButton} onPress={onSettingsPress}>
          <AppIcon name="settings" size={17} strokeWidth={1.9} color="#20242C" />
        </Pressable>
        <Pressable
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          style={[styles.actionButton, styles.bell]}
          onPress={onNotificationsPress}
        >
          <AppIcon name="bell" size={17} strokeWidth={1.9} color="#20242C" />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text translate={false} style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable accessibilityLabel="Doctor profile" style={styles.avatarButton} onPress={onProfilePress}>
          <DoctorAvatar size={30} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = createDoctorStyles({
  header: { height: 54, paddingHorizontal: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: '#E4E7EC', flexDirection: 'row', alignItems: 'center' },
  menu: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  titleArea: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 8 },
  doctor: { ...typography.subtitle, fontSize: 16, lineHeight: 20, color: colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bell: { position: 'relative' },
  badge: { position: 'absolute', right: 0, top: 1, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.surface },
  badgeText: { fontSize: 9.5, lineHeight: 12, fontWeight: '800', color: '#FFF' },
  avatarButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
