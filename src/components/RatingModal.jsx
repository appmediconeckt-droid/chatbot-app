import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import StarRating from "./StarRating";

// Short helper labels shown under the stars to make the choice feel rewarding.
const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/**
 * RatingModal
 *
 * Eligibility-driven rating popup. Lets the user pick 1-5 stars and leave an
 * optional review. Three actions:
 *   - Submit rating        → onSubmit({ rating, review })
 *   - Remind me later      → onRemindLater()    (backend hides for 7 days)
 *   - Never ask again      → onNeverAskAgain()   (backend hides permanently)
 *
 * The parent should pass a fresh `key` per open so star/review reset.
 *
 * Props:
 *   visible          bool
 *   counselorName    string
 *   counselorPhoto   string|null
 *   submitting       bool
 *   success          bool      show success state after submit
 *   onSubmit         ({ rating, review }) => void
 *   onRemindLater    () => void
 *   onNeverAskAgain  () => void
 *   onClose          () => void   (X / back = remind later by default)
 */
const RatingModal = ({
  visible,
  counselorName = "your counselor",
  counselorPhoto,
  submitting = false,
  success = false,
  onSubmit,
  onRemindLater,
  onNeverAskAgain,
  onClose,
}) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const initials = (counselorName || "C")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const busy = submitting;

  const handleSubmit = () => {
    if (rating < 1 || busy) return;
    onSubmit?.({ rating, review });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !busy && onClose?.()}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {success ? (
            <View style={styles.successWrap}>
              <Text style={styles.successIcon}>🎉</Text>
              <Text style={styles.title}>Thank you!</Text>
              <Text style={styles.subtitle}>Your rating has been submitted.</Text>
            </View>
          ) : (
            <>
              {/* Close = remind later */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => !busy && onClose?.()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#9AA5B1" />
              </TouchableOpacity>

              {/* Avatar */}
              <View style={styles.avatarWrap}>
                {counselorPhoto ? (
                  <Image source={{ uri: counselorPhoto }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.title}>Rate your counselor</Text>
              <Text style={styles.subtitle}>
                How was your experience with{" "}
                <Text style={styles.counselorName}>{counselorName}</Text>?
              </Text>

              {/* Stars */}
              <View style={styles.starsRow}>
                <StarRating
                  rating={rating}
                  onChange={setRating}
                  size={40}
                  showValue={false}
                />
              </View>
              <Text style={styles.starLabel}>
                {STAR_LABELS[rating] || "Tap a star to rate"}
              </Text>

              {/* Optional review */}
              <TextInput
                style={styles.input}
                placeholder="Add a review (optional)"
                placeholderTextColor="#9AA5B1"
                value={review}
                onChangeText={setReview}
                multiline
                maxLength={500}
                textAlignVertical="top"
                editable={!busy}
              />

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, (rating < 1 || busy) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={rating < 1 || busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Submit rating</Text>
                )}
              </TouchableOpacity>

              {/* Remind me later */}
              <TouchableOpacity
                style={styles.laterBtn}
                onPress={() => !busy && onRemindLater?.()}
                disabled={busy}
              >
                <Text style={styles.laterText}>Remind me later</Text>
              </TouchableOpacity>

              {/* Never ask again */}
              <TouchableOpacity
                style={styles.neverBtn}
                onPress={() => !busy && onNeverAskAgain?.()}
                disabled={busy}
              >
                <Text style={styles.neverText}>Never ask again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
  },
  avatarWrap: {
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    backgroundColor: "#2c50cd",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#526071",
    textAlign: "center",
    marginBottom: 18,
  },
  counselorName: {
    fontWeight: "700",
    color: "#2c50cd",
  },
  starsRow: {
    marginBottom: 8,
  },
  starLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F5A623",
    minHeight: 20,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    minHeight: 72,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 16,
  },
  submitBtn: {
    width: "100%",
    backgroundColor: "#2c50cd",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  submitBtnDisabled: {
    backgroundColor: "#A9B6D9",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  laterBtn: {
    paddingVertical: 12,
    marginTop: 4,
  },
  laterText: {
    color: "#9AA5B1",
    fontSize: 14,
    fontWeight: "600",
  },
  neverBtn: {
    paddingVertical: 8,
  },
  neverText: {
    color: "#C0392B",
    fontSize: 13,
    fontWeight: "600",
  },
  successWrap: {
    alignItems: "center",
    paddingVertical: 24,
  },
  successIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
});

export default RatingModal;
