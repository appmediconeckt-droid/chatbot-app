import React, { useCallback, useEffect, useState } from "react";
import RatingModal from "./RatingModal";
import ratingService from "../services/ratingService";

/**
 * RatingPrompt
 *
 * Self-contained rating trigger for the app. On mount (and whenever
 * `triggerKey` changes) it asks the backend
 * (GET /api/ratings/check-eligibility) whether a popup is due and, if so,
 * shows the RatingModal. Mount it once inside the user dashboard shell so it
 * runs on dashboard / messages / profile loads.
 */
const RatingPrompt = ({ triggerKey }) => {
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [target, setTarget] = useState(null);
  const [openId, setOpenId] = useState(0); // fresh key per open

  const runCheck = useCallback(async () => {
    if (visible) return;
    const result = await ratingService.checkEligibility();
    if (result?.showPopup && result?.counselorId) {
      setTarget({
        counselorId: result.counselorId,
        counselorName: result.counselorName || "your consultant",
        counselorPhoto: result.counselorPhoto || null,
      });
      setSuccess(false);
      setOpenId((n) => n + 1);
      setVisible(true);
    }
  }, [visible]);

  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  const handleSubmit = async ({ rating, review }) => {
    if (!target?.counselorId) return;
    setSubmitting(true);
    try {
      await ratingService.submitRating({
        counselorId: target.counselorId,
        rating,
        review,
      });
      setSuccess(true);
      setTimeout(() => setVisible(false), 1500);
    } catch (e) {
      console.log("RatingPrompt submit failed:", e?.message);
      setVisible(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemindLater = async () => {
    if (target?.counselorId) await ratingService.remindLater(target.counselorId);
    setVisible(false);
  };

  const handleNeverAskAgain = async () => {
    if (target?.counselorId)
      await ratingService.neverAskAgain(target.counselorId);
    setVisible(false);
  };

  // Closing via X / hardware back defaults to "remind later" (non-destructive).
  const handleClose = () => {
    handleRemindLater();
  };

  return (
    <RatingModal
      key={openId}
      visible={visible}
      counselorName={target?.counselorName}
      counselorPhoto={target?.counselorPhoto}
      submitting={submitting}
      success={success}
      onSubmit={handleSubmit}
      onRemindLater={handleRemindLater}
      onNeverAskAgain={handleNeverAskAgain}
      onClose={handleClose}
    />
  );
};

export default RatingPrompt;
