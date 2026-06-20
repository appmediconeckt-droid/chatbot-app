// ratingService.js — React Native client for the eligibility-driven rating flow.
// ---------------------------------------------------------------------------
// All rules (5-min call OR 20 messages, 48h delay, once-per-counselor,
// remind-later 7d, never-again) are enforced by the backend. This client just
// asks "should I show a popup?" and relays the user's choice.
// ---------------------------------------------------------------------------

import api from "../axiosConfig";

/**
 * Ask the backend whether a rating popup should be shown right now.
 * Returns: { showPopup, counselorId, counselorName, counselorPhoto,
 *            eligibleReason, daysRemaining }
 */
export async function checkEligibility() {
  try {
    const { data } = await api.get("/api/ratings/check-eligibility");
    return data || { showPopup: false };
  } catch (e) {
    console.log("ratingService.checkEligibility failed:", e?.message);
    return { showPopup: false };
  }
}

/**
 * Submit a rating. Backend: POST /api/ratings/submit
 * Returns { success, averageRating, totalRatings }.
 */
export async function submitRating({ counselorId, rating, review = "" }) {
  if (!counselorId || counselorId === "undefined" || counselorId === "null") {
    throw new Error("counselorId is required");
  }
  if (!rating || rating < 1 || rating > 5) {
    throw new Error("rating must be 1-5");
  }

  const { data } = await api.post("/api/ratings/submit", {
    counselorId,
    rating,
    review: review?.trim() || "",
  });
  return data;
}

/** Hide the popup for 7 days. */
export async function remindLater(counselorId) {
  if (!counselorId) return;
  try {
    await api.post("/api/ratings/remind-later", { counselorId });
  } catch (e) {
    console.log("ratingService.remindLater failed:", e?.message);
  }
}

/** Permanently stop asking for this counselor. */
export async function neverAskAgain(counselorId) {
  if (!counselorId) return;
  try {
    await api.post("/api/ratings/never-ask-again", { counselorId });
  } catch (e) {
    console.log("ratingService.neverAskAgain failed:", e?.message);
  }
}

/** Public aggregate rating for a counselor: { averageRating, totalRatings }. */
export async function getCounselorRating(counselorId) {
  if (!counselorId) return { averageRating: 0, totalRatings: 0 };
  try {
    const { data } = await api.get(`/api/counselors/${counselorId}/rating`);
    return data;
  } catch (e) {
    console.log("ratingService.getCounselorRating failed:", e?.message);
    return { averageRating: 0, totalRatings: 0 };
  }
}

// ─── Deprecated no-op shims ─────────────────────────────────────────────────
// The old end-of-chat immediate prompt is superseded by the 48h eligibility
// flow. These keep older imports from crashing without showing a popup.
export async function savePendingRating() {}
export async function removePendingRating() {}
export async function getAllPendingRatings() {
  return [];
}
export async function getDuePendingRating() {
  return null;
}
export async function isAlreadyRated() {
  return true; // suppress the legacy immediate popup
}
export async function markAsRated() {}
export async function registerDeviceToken() {}

export default {
  checkEligibility,
  submitRating,
  remindLater,
  neverAskAgain,
  getCounselorRating,
  // deprecated shims
  savePendingRating,
  removePendingRating,
  getAllPendingRatings,
  getDuePendingRating,
  isAlreadyRated,
  markAsRated,
  registerDeviceToken,
};
