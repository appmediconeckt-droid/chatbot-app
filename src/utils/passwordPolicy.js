export const STRONG_PASSWORD_HINT =
  'Use at least 8 characters with uppercase, lowercase, number, and special character.';

export const STRONG_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

export const passwordRequirements = [
  {
    key: 'length',
    label: '8+ characters',
    test: (password) => String(password || '').length >= 8,
  },
  {
    key: 'uppercase',
    label: 'Uppercase letter',
    test: (password) => /[A-Z]/.test(String(password || '')),
  },
  {
    key: 'lowercase',
    label: 'Lowercase letter',
    test: (password) => /[a-z]/.test(String(password || '')),
  },
  {
    key: 'number',
    label: 'Number',
    test: (password) => /\d/.test(String(password || '')),
  },
  {
    key: 'special',
    label: 'Special character',
    test: (password) => /[^A-Za-z0-9]/.test(String(password || '')),
  },
];

export const passwordCharacterRequirements = passwordRequirements.filter(
  (requirement) => requirement.key !== 'length',
);

export const validateStrongPassword = (password) => {
  const failed = passwordRequirements.filter((requirement) => !requirement.test(password));
  return {
    isValid: failed.length === 0,
    failed,
    message: failed.length === 0 ? '' : STRONG_PASSWORD_MESSAGE,
  };
};

export const getPasswordStrength = (password) =>
  passwordRequirements.reduce(
    (score, requirement) => score + (requirement.test(password) ? 1 : 0),
    0,
  );
