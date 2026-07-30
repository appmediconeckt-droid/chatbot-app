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

/**
 * Brand gradients, ready to spread into <LinearGradient>.
 *
 * This is the gradient on the wallet balance card, and the one every primary
 * action / active chip on the user side should use. Import these instead of
 * re-typing the hex pairs, so the whole app shifts together if the brand does.
 *
 *   <LinearGradient colors={PATIENT_GRADIENT} {...GRADIENT_DIRECTION} />
 */
export const PATIENT_GRADIENT = [PATIENT.gradientFrom, PATIENT.gradientTo];
export const DOCTOR_GRADIENT = [DOCTOR.gradientFrom, DOCTOR.gradientTo];

// Horizontal, matching the wallet card.
export const GRADIENT_DIRECTION = {
  start: { x: 0, y: 0.5 },
  end: { x: 1, y: 0.5 },
};

// Lets an inactive pill keep its own background behind an identically sized
// gradient layer, so selecting it cannot change its width.
export const TRANSPARENT_GRADIENT = ['transparent', 'transparent'];

export const gradientForRole = (role) => {
  const r = String(role || '').trim().toLowerCase();
  return r === 'counselor' || r === 'counsellor' ? DOCTOR_GRADIENT : PATIENT_GRADIENT;
};

export default PATIENT;
