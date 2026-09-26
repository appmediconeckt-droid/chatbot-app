import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLINICIAN, DOCTOR, PATIENT } from './palette';

// Role → theme for screens shared by every role (App Lock, PIN setup):
//   doctor    → CLINICIAN (teal)
//   counselor → DOCTOR (blue; historical name for the counselor palette)
//   anyone else → PATIENT (green)
//
// userRole is written at login and is the authoritative value; userType and
// the older `role` key are only fallbacks, so a stale `role` left behind by a
// RoleSelector visit can't flip the theme.
const normalize = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'doctor') return 'doctor';
  if (v === 'counselor' || v === 'counsellor') return 'counselor';
  if (v) return 'user';
  return '';
};

export const getStoredThemeRole = async () => {
  try {
    const [userRole, userType, roleKey] = await Promise.all([
      AsyncStorage.getItem('userRole'),
      AsyncStorage.getItem('userType'),
      AsyncStorage.getItem('role'),
    ]);
    return normalize(userRole) || normalize(userType) || normalize(roleKey) || 'user';
  } catch {
    return 'user';
  }
};

export const paletteForRole = (role) => {
  if (role === 'doctor') return CLINICIAN;
  if (role === 'counselor') return DOCTOR;
  return PATIENT;
};
