// src/config.js
// Shared runtime config for the RN app. Keep secrets/OAuth client IDs here
// so screens don't import them ad-hoc.

export { API_BASE_URL, default as axiosInstance } from './axiosConfig';


export const GOOGLE_WEB_CLIENT_ID =
  '704541656207-prln6ckc25sph827vat5cub6iu4fk6ft.apps.googleusercontent.com';

// Public web app origin. The doctor QR code encodes
// `${PUBLIC_WEB_APP_URL}/walk-in-appointment?doctorId=…&source=qr` — the same
// link the web dashboard's QR page generates (web uses window.location.origin).
export const PUBLIC_WEB_APP_URL = 'https://humaeli.com';

export const SUPPORT_EMAIL = 'support@humaeli.com';
export const SUPPORT_PHONE_DISPLAY = '+91 90095 55930';
export const SUPPORT_PHONE_TEL = '+919009555930';
