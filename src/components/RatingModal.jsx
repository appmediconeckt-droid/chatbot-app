import React, { useState, useEffect } from "react";
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
 * Popup shown after a counseling session ends. Lets the user pick 1-5 stars and
 * (optionally) leave a comment. "Maybe later" dismisses without rating — the
 * caller is responsible for scheduling the 24h re-prompt.
 *
 * Props:
 *   visible        bool
 *   counselorName  string
 *   counselorPhoto string|null
 *   submitting     bool      shows a spinner on the submit button
 *   onSubmit       ({ stars, comment }) => void
 *   onDismiss      () => void   "Maybe later" / close
 */
const RatingModal = ({
  visible,
  counselorName = "your counselor",
  counselorPhoto,
  submitting = false,
  onSubmit,
  onDismiss,
}) => {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  // Reset whenever the popup is re-opened for a new session.
  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment("");
    }
  }, [visible]);

  const initials = (counselorName || "C")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSubmit = () => {
    if (stars < 1 || submitting) return;
    onSubmit?.({ stars, comment });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !submitting && onDismiss?.()}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Close */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => !submitting && onDismiss?.()}
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

          <Text style={styles.title}>Rate your session</Text>
          <Text style={styles.subtitle}>
            How was your session with{" "}
            <Text style={styles.counselorName}>{counselorName}</Text>?
          </Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            <StarRating
              rating={stars}
              onChange={setStars}
              size={40}
              showValue={false}
            />
          </View>
          <Text style={styles.starLabel}>{STAR_LABELS[stars] || "Tap a star to rate"}</Text>

          {/* Optional comment */}
          <TextInput
            style={styles.input}
            placeholder="Add a comment (optional)"
            placeholderTextColor="#9AA5B1"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (stars < 1 || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={stars < 1 || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit rating</Text>
            )}
          </TouchableOpacity>

          {/* Maybe later */}
          <TouchableOpacity
            style={styles.laterBtn}
            onPress={() => !submitting && onDismiss?.()}
            disabled={submitting}
          >
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
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
});

export default RatingModal;
