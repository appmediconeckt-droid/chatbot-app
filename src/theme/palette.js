// Patient (user-side) colour palette — from Figma.
export const PATIENT = {
  primary: '#00652C',
  gradientFrom: '#2A8A51',
  gradientTo: '#0E7552',
  backgroundTint: '#F9F9FF',
  secondaryTint: '#F9F9FF',

  // Derived neutrals used alongside the brand colours.
  surface: '#FFFFFF',
  border: '#ECECF3',
  chipBorder: '#E2E2EC',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  online: '#22C55E',
  danger: '#EF4444',
};

// Doctor (counselor-side) colour palette — from Figma.
export const DOCTOR = {
  primary: '#004AC6',
  gradientFrom: '#004AC6',
  gradientTo: '#0070FA',
  backgroundTint: '#F5F5F5',
  secondaryTint: '#F5F5F5',

  surface: '#FFFFFF',
  border: '#ECECF3',
  chipBorder: '#E2E2EC',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  online: '#22C55E',
  danger: '#EF4444',
};

// Pick the palette for a role: 'counselor' / 'counsellor' → blue, else green.
export const paletteForRole = (role) => {
  const r = String(role || '').trim().toLowerCase();
  return r === 'counselor' || r === 'counsellor' ? DOCTOR : PATIENT;
};

export default PATIENT;
