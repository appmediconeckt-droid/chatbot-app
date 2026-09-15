export const APP_DISPLAY_NAME = 'Humaeli';
export const APP_VERSION = '1.0.13';
export const APP_VERSION_CODE = 14;
export const LAST_UPDATED = 'September 2026';
export const PLAY_STORE_ID = 'com.mindcrawller.humaeli';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;

// The real Play Store "is there an update" check (Play Core) can only ever
// succeed on a signed release build installed from the Store — it always
// fails on a debug/Metro build, which is expected, not a bug. Flip this to
// true locally to preview UpdateReminderModal in dev without a full release
// cycle; leave it false (the default, and always false in any real build)
// so the reminder never shows in dev unless you deliberately turn it on.
export const DEV_SIMULATE_UPDATE_AVAILABLE = false;
