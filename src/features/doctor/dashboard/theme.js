// Ported from MediconecktApp's src/theme.ts — same palette, unchanged, so the
// Doctor dashboard module looks identical to the reference app it came from.
import { Platform, StyleSheet } from 'react-native';
import { CLINICIAN, CLINICIAN_GRADIENT, GRADIENT_DIRECTION } from '../../../theme/palette';

export const colors = {
  background: CLINICIAN.backgroundTint,
  surface: CLINICIAN.surface,
  ink: CLINICIAN.text,
  navy: CLINICIAN.gradientFrom,
  muted: CLINICIAN.textSecondary,
  line: CLINICIAN.border,
  blue: CLINICIAN.primary,
  brightBlue: CLINICIAN.gradientTo,
  paleBlue: CLINICIAN.secondaryTint,
  red: CLINICIAN.danger,
  amber: '#F59E0B',
};

export const doctorGradient = CLINICIAN_GRADIENT;
export const gradientDirection = GRADIENT_DIRECTION;

export const shadow = {
  shadowColor: '#152039',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 5,
  elevation: 2,
};

const appFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  fontFamily: appFontFamily,
  text: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
  },
  title: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
    fontWeight: '700',
    letterSpacing: 0,
  },
  body: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
    fontWeight: '500',
    letterSpacing: 0,
  },
  caption: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
    fontWeight: '600',
    letterSpacing: 0,
  },
  label: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  button: {
    fontFamily: appFontFamily,
    includeFontPadding: false,
    fontWeight: '800',
    letterSpacing: 0,
  },
};

const textStyleKeys = new Set([
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecorationLine',
  'includeFontPadding',
]);

const shouldUseDoctorFont = (style) => (
  style &&
  typeof style === 'object' &&
  !Array.isArray(style) &&
  Object.keys(style).some((key) => textStyleKeys.has(key))
);

export const createDoctorStyles = (styles) => {
  const withDoctorFont = Object.entries(styles).reduce((next, [key, style]) => {
    next[key] = shouldUseDoctorFont(style) && !style.fontFamily
      ? { ...typography.text, ...style }
      : style;
    return next;
  }, {});

  return StyleSheet.create(withDoctorFont);
};
