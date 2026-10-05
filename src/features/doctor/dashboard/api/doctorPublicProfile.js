// The doctor's public profile link, built exactly like the web Profile QR
// (chatbot/.../SettingProfileQR/profileQrData.js): the live web app serves
// /doctor-profile-qr and reads the patient-facing details from the URL hash
// (base64 of UTF-8 JSON). The /doctor/:id page the app linked to before is not
// deployed on humaeli.com, so that link opened an empty page.
/* eslint-disable no-bitwise -- UTF-8 and base64 encoding work on bits. */
import axiosInstance from '../../../../axiosConfig';
import { PUBLIC_WEB_APP_URL } from '../../../../config';

// key -> source fields, in the web's order (only patient-facing details).
const PROFILE_FIELDS = {
  name: ['full_name', 'fullName', 'name'],
  email: ['email', 'email_address'],
  phone: ['contact_number', 'phoneNumber', 'phone_number', 'phone', 'mobile', 'contactNumber'],
  speciality: ['speciality', 'specialization', 'primary_specialties'],
  qualification: ['qualification', 'medical_degree'],
  experience: ['experience', 'years_of_experience'],
  languages: ['languages', 'known_languages'],
  about: ['about_doctor', 'about', 'bio', 'aboutMe'],
  location: ['doctor_location', 'location'],
};

const MAX_LINK_BYTES = 2200; // same limit the web uses (fits a QR code)

const displayValue = (value) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter((part) => ['string', 'number'].includes(typeof part)).join(', ');
  return ['string', 'number'].includes(typeof value) ? String(value).trim() : '';
};

const toUtf8Bytes = (text) => {
  const bytes = [];
  for (const char of text) {
    let code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
  }
  return bytes;
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const toBase64 = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
      + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=')
      + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
};

export const publicProfileFields = (user = {}) => Object.fromEntries(
  Object.entries(PROFILE_FIELDS)
    .map(([key, aliases]) => [key, aliases.map((alias) => displayValue(user?.[alias])).find(Boolean) || ''])
    .filter(([, value]) => value),
);

export const buildPublicProfileLink = (user) => {
  const origin = PUBLIC_WEB_APP_URL.replace(/\/+$/, '');
  const fields = publicProfileFields(user);
  const make = (data) => `${origin}/doctor-profile-qr#${toBase64(toUtf8Bytes(JSON.stringify(data)))}`;
  let link = make(fields);
  // Too long for the page/QR: drop the longest free-text fields first.
  for (const key of ['about', 'location']) {
    if (toUtf8Bytes(link).length <= MAX_LINK_BYTES) break;
    delete fields[key];
    link = make(fields);
  }
  return link;
};

// Fresh profile from the server, falling back to the stored login data.
export const loadPublicProfileLink = async (fallbackUser) => {
  let user = fallbackUser || {};
  try {
    const { data } = await axiosInstance.get('/api/auth/me');
    if (data?.user) user = data.user;
  } catch { /* use the stored copy */ }
  if (!publicProfileFields(user).name) throw new Error('Your profile is not complete yet.');
  return buildPublicProfileLink(user);
};
