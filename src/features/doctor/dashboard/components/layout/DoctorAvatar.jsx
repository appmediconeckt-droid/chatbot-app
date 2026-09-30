// The logged-in doctor's own avatar (header, sidebar, chat). Shows the real
// profile photo; without one (or if it fails to load) it shows the doctor's
// initials. It never falls back to a stock/placeholder face.
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Text from '../../../../../components/TranslatedText';
import { colors, createDoctorStyles } from '../../theme';
import {
  getDoctorInitials,
  loadDoctorDisplayProfile,
  refreshDoctorUserOnce,
} from '../../api/doctorAppointments';

export default function DoctorAvatar({ size = 30, style }) {
  const [profile, setProfile] = useState({ name: '', photo: '' });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = () => loadDoctorDisplayProfile().then((p) => {
      if (!mounted) return;
      setProfile((prev) => {
        if (prev.photo !== p.photo) setFailed(false);
        return { name: p.name, photo: p.photo };
      });
    });
    load();
    // The stored login data can be missing a photo added later: refresh it
    // from the server once per session, then re-read.
    refreshDoctorUserOnce().then(load);
    return () => { mounted = false; };
  }, []);

  const box = { width: size, height: size, borderRadius: size / 2 };

  if (profile.photo && !failed) {
    return (
      <Image
        source={{ uri: profile.photo }}
        style={[box, s.image, style]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[box, s.initials, style]}>
      <Text translate={false} style={[s.initialsText, { fontSize: Math.round(size * 0.4) }]}>
        {getDoctorInitials(profile.name)}
      </Text>
    </View>
  );
}

const s = createDoctorStyles({
  image: { backgroundColor: colors.paleBlue },
  initials: { backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontWeight: '800', color: '#FFFFFF' },
});
