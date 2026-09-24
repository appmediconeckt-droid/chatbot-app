// MockGoogleAuthButton — visual twin of GoogleAuthButton.jsx, for roles that
// have no backend yet (currently: Doctor).
//
// GoogleAuthButton.jsx performs a REAL native Google sign-in and then POSTs
// to a real backend endpoint (`/api/auth/google`) that doesn't know about the
// doctor role — wiring that up here would either error out against the real
// backend or require inventing a fake endpoint, both of which the Doctor
// frontend-only scope rules out. This component only renders the same look;
// all "auth" happens in the caller's own mock logic (see DoctorSignup.jsx's
// MOCK AUTH section). Swap it for the real GoogleAuthButton the moment a
// Doctor backend + `/api/auth/google` doctor support exists.
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from '../../../components/TranslatedText';

const MockGoogleAuthButton = ({ mode = 'signin', onPress, disabled = false, loading = false }) => {
  const label = mode === 'signup' ? 'Sign up with Google' : 'Continue with Google';

  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>
        <Image
          source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
          style={styles.icon}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
      {loading ? <ActivityIndicator size="small" color="#3c4043" style={styles.spinner} /> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.6 },
  iconWrap: { width: 20, height: 20, marginRight: 12 },
  icon: { width: 20, height: 20, resizeMode: 'contain' },
  label: { fontSize: 15, fontWeight: '600', color: '#3c4043', letterSpacing: 0.2 },
  spinner: { marginLeft: 10 },
});

export default MockGoogleAuthButton;
