const {
  STRONG_PASSWORD_MESSAGE,
  getPasswordStrength,
  passwordCharacterRequirements,
  validateStrongPassword,
} = require('../src/utils/passwordPolicy');

describe('passwordPolicy', () => {
  it('requires length, uppercase, lowercase, number, and special character', () => {
    expect(validateStrongPassword('Password1!')).toEqual({
      isValid: true,
      failed: [],
      message: '',
    });

    expect(validateStrongPassword('password')).toEqual(
      expect.objectContaining({
        isValid: false,
        message: STRONG_PASSWORD_MESSAGE,
      }),
    );
  });

  it('scores each satisfied password requirement', () => {
    expect(getPasswordStrength('Password1!')).toBe(5);
    expect(getPasswordStrength('password')).toBe(2);
  });

  it('exposes the four live character checklist points', () => {
    expect(passwordCharacterRequirements.map((requirement) => requirement.key)).toEqual([
      'uppercase',
      'lowercase',
      'number',
      'special',
    ]);
  });
});
