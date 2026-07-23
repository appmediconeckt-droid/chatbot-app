// Patient (user-side) colour palette — from Figma.
export const PATIENT = {
  primary: '#006B2C',
  gradientFrom: '#006B2C',
  gradientTo: '#01CE54',
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
  gradientFrom: '#003A9B',
  gradientTo: '#1490FF',
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
