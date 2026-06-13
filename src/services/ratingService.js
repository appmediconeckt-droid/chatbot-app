// ratingService.js
// ---------------------------------------------------------------------------
// Handles counselor ratings end-to-end on the client:
//   1. Submitting a rating to the backend.
//   2. Ending a chat session (so the rating popup knows when to appear).
//   3. Tracking "pending" ratings the user ignored, so we can re-prompt
//      in-app after 24 hours (the push-notification reminder is a backend
//      job — see registerDeviceToken() and BACKEND_RATING_API.md).
//
// The rating display, average and review count are recomputed by the backend;
// the client only submits a single rating and reads back the aggregate.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../axiosConfig";

const PENDING_KEY = "@pending_ratings";
const RATED_KEY = "@rated_counselors";

// How long to wait before re-prompting a user who ignored the rating popup.
export const REPROMPT_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Backend calls ─────────────────────────────────────────────────────────

/**
 * Submit a rating for a counselor.
 * Backend contract: POST /api/counselors/:counselorId/ratings
 *   body: { stars: 1-5, comment?: string, chatId?: string }
 *   returns: { rating: number, ratingCount: number }  (new aggregate)
 */
export async function submitRating({ counselorId, stars, comment = "", chatId }) {
  if (!counselorId) throw new Error("counselorId is required");
  if (!stars || stars < 1 || stars > 5) throw new Error("stars must be 1-5");

  const response = await api.post(`/api/counselors/${counselorId}/ratings`, {
    stars,
    comment: comment?.trim() || "",
    chatId: chatId || null,
  });

  // Mark this counselor as rated (don't prompt again)
  if (counselorId) await markAsRated(counselorId);

  // Whatever happens with the network, this session no longer needs a prompt.
  if (chatId) await removePendingRating(chatId);

  return response.data; // { rating, ratingCount }
}


// ─── Pending-rating persistence (in-app 24h reminder) ───────────────────────

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch (e) {
    console.log("ratingService: failed to persist pending ratings", e?.message);
  }
}

/**
 * Record that a session ended and still needs a rating. Safe to call multiple
 * times for the same chat — it de-dupes on chatId.
 */
export async function savePendingRating({ counselorId, counselorName, counselorPhoto, chatId }) {
  if (!chatId || !counselorId) return;
  const list = await readAll();
  if (list.some((e) => e.chatId === chatId)) return; // already pending
  list.push({
    chatId,
    counselorId,
    counselorName: counselorName || "Counselor",
    counselorPhoto: counselorPhoto || null,
    sessionEndedAt: Date.now(),
    lastPromptedAt: Date.now(),
    dismissCount: 0,
  });
  await writeAll(list);
}

/** Remove a pending rating (after submit, or if the user is done with it). */
export async function removePendingRating(chatId) {
  if (!chatId) return;
  const list = await readAll();
  const next = list.filter((e) => e.chatId !== chatId);
  if (next.length !== list.length) await writeAll(next);
}

/**
 * Get all pending ratings (ones that haven't been rated yet).
 */
export async function getAllPendingRatings() {
  const list = await readAll();
  return list;
}

/**
 * Returns the next pending rating that is "due" to be shown again — i.e. it was
 * last prompted more than 24h ago — or null. Call this on app/screen open to
 * power the in-app 24h reminder.
 */
export async function getDuePendingRating() {
  const list = await readAll();
  const now = Date.now();
  const due = list
    .filter((e) => now - (e.lastPromptedAt || 0) >= REPROMPT_AFTER_MS)
    .sort((a, b) => a.lastPromptedAt - b.lastPromptedAt);
  return due[0] || null;
}

// ─── Per-counselor rating tracking (don't re-prompt for same counselor) ──────

async function getRatedCounselors() {
  try {
    const raw = await AsyncStorage.getItem(RATED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeRatedCounselors(list) {
  try {
    await AsyncStorage.setItem(RATED_KEY, JSON.stringify(list));
  } catch (e) {
    console.log("ratingService: failed to persist rated counselors", e?.message);
  }
}

/** Check if user has already rated this counselor */
export async function isAlreadyRated(counselorId) {
  if (!counselorId) return false;
  const list = await getRatedCounselors();
  return list.some((id) => id === counselorId);
}

/** Mark a counselor as rated (after successful submission) */
export async function markAsRated(counselorId) {
  if (!counselorId) return;
  const list = await getRatedCounselors();
  if (!list.includes(counselorId)) {
    list.push(counselorId);
    await writeRatedCounselors(list);
  }
}

// ─── Push reminder (prepared for later) ─────────────────────────────────────

/**
 * Stub for the future push-notification reminder. Once Firebase/FCM is set up,
 * call this with the device's FCM token after a session ends. The backend will
 * store it and schedule a 24h "please rate your counselor" push if the rating
 * is still pending. No-op today (the app has no push library yet) so callers
 * are safe to invoke it.
 *
 * Backend contract: POST /api/users/me/device-token { token, platform }
 */
export async function registerDeviceToken(token, platform) {
  if (!token) return;
  try {
    await api.post("/api/users/me/device-token", { token, platform });
  } catch (e) {
    // Non-fatal: the in-app reminder still covers this case.
    console.log("ratingService: registerDeviceToken skipped/failed", e?.message);
  }
}

export default {
  submitRating,
  savePendingRating,
  removePendingRating,
  getAllPendingRatings,
  getDuePendingRating,
  isAlreadyRated,
  markAsRated,
  registerDeviceToken,
  REPROMPT_AFTER_MS,
};
