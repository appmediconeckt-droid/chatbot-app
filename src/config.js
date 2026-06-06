// src/config.js
// Shared runtime config for the RN app. Keep secrets/OAuth client IDs here
// so screens don't import them ad-hoc.

export { API_BASE_URL, default as axiosInstance } from './axiosConfig';

// Google OAuth Web client ID — same one the backend verifies the idToken
// against. For native Android sign-in we use this as `webClientId` (the
// google-signin library exchanges it for an idToken the backend already
// knows how to validate). Adding a separate Android OAuth client ID in
// Google Cloud Console (matched to the app's SHA-1) is recommended for
// production; until then, webClientId alone works for idToken-based flows.
export const GOOGLE_WEB_CLIENT_ID =
  '704541656207-prln6ckc25sph827vat5cub6iu4fk6ft.apps.googleusercontent.com';
