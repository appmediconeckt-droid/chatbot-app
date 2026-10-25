import {
  buildInternationalPhoneNumber,
  formatPhoneNumber,
  getPhoneLengthsForCountryCode,
  isValidInternationalPhoneNumber,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
  splitInternationalPhoneNumber,
} from '../src/utils/countryCodes';

it.each([
  ['+91', '9876543210'],
  ['+1', '2025550123'],
  ['+44', '7700900123'],
  ['+971', '501234567'],
  ['+65', '81234567'],
  ['+1-242', '3591234'],
  ['+44-1481', '723456'],
])('round trips %s numbers without losing or duplicating digits', (code, number) => {
  const international = buildInternationalPhoneNumber(code, number);
  expect(splitInternationalPhoneNumber(international, '+91')).toEqual({ countryCode: code, phoneNumber: number });
  expect(formatPhoneNumber(international)).toBe(`${code} ${number}`);
  expect(formatPhoneNumber(number, code)).toBe(`${code} ${number}`);
  expect(isValidLocalPhoneNumber(number, code)).toBe(true);
});

it('uses the saved code for legacy numbers and reads international prefixes', () => {
  expect(formatPhoneNumber('9876543210')).toBe('+91 9876543210');
  expect(splitInternationalPhoneNumber('00971 50 123 4567')).toEqual({ countryCode: '+971', phoneNumber: '501234567' });
  expect(splitInternationalPhoneNumber('91 9876543210', '+91')).toEqual({ countryCode: '+91', phoneNumber: '9876543210' });
  expect(formatPhoneNumber('')).toBe('');
  expect(formatPhoneNumber('N/A')).toBe('N/A');
  expect(buildInternationalPhoneNumber('+91', '')).toBe('');
});

it('rejects excess digits rather than truncating a different number into validity', () => {
  const extraDigit = '98765432101';
  expect(normalizeLocalPhoneNumber(extraDigit, '+91')).toBe(extraDigit);
  expect(isValidInternationalPhoneNumber('+91', extraDigit)).toBe(false);
  expect(splitInternationalPhoneNumber('+91 98765432101').phoneNumber).toBe(extraDigit);
  expect(normalizeLocalPhoneNumber('919876543', '+971')).toBe('919876543');
  expect(normalizeLocalPhoneNumber('91987654321', '+971')).toBe('91987654321');
});

it('validates the selected country and rejects malformed or placeholder numbers', () => {
  expect(isValidLocalPhoneNumber('9876543210', '+971')).toBe(false);
  expect(isValidLocalPhoneNumber('501234567', '+971')).toBe(true);
  expect(isValidLocalPhoneNumber('98765', '+91')).toBe(false);
  expect(isValidLocalPhoneNumber('0000000000', '+91')).toBe(false);
  expect(isValidLocalPhoneNumber('98765abc43210', '+91')).toBe(false);
  expect(isValidLocalPhoneNumber('9876543210', '+999')).toBe(false);
  expect(getPhoneLengthsForCountryCode('+1-242')).toEqual([7]);
});
