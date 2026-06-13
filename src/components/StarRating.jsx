import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

/**
 * StarRating
 *
 * Dual-purpose star component:
 *  - Read-only display (default): pass `rating` (e.g. 4.6) to render full / half /
 *    empty stars, with an optional review `count` like "★ 4.6 (128)".
 *  - Interactive input: pass `onChange` to make the stars tappable (used by the
 *    rating popup). When interactive, only whole stars are shown.
 *
 * Props:
 *   rating    number   current value (0-5)
 *   count     number   optional number of reviews to show next to the stars
 *   size      number   icon size (default 16)
 *   color     string   filled star color (default gold)
 *   onChange  func     (value) => void; when provided, stars become tappable
 *   showValue bool     show the numeric value next to the stars (default true for display)
 *   style     object   container style override
 */
const StarRating = ({
  rating = 0,
  count,
  size = 16,
  color = "#F5A623",
  emptyColor = "#D8DEE6",
  onChange,
  showValue,
  style,
}) => {
  const interactive = typeof onChange === "function";
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  // For display we allow half stars; for input we snap to whole stars.
  const display = showValue === undefined ? !interactive : showValue;

  const renderStar = (index) => {
    const starNumber = index + 1;
    let iconName;
    if (interactive) {
      iconName = starNumber <= safeRating ? "star" : "star-outline";
    } else if (safeRating >= starNumber) {
      iconName = "star";
    } else if (safeRating >= starNumber - 0.5) {
      iconName = "star-half";
    } else {
      iconName = "star-outline";
    }

    const filled = iconName !== "star-outline";
    const icon = (
      <Ionicons
        name={iconName}
        size={size}
        color={filled ? color : emptyColor}
        style={styles.star}
      />
    );

    if (!interactive) return <View key={index}>{icon}</View>;

    return (
      <TouchableOpacity
        key={index}
        onPress={() => onChange(starNumber)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={`Rate ${starNumber} star${starNumber > 1 ? "s" : ""}`}
      >
        {icon}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.row, style]}>
      <View style={styles.row}>{[0, 1, 2, 3, 4].map(renderStar)}</View>
      {display && (
        <Text style={[styles.value, { fontSize: size * 0.85 }]}>
          {safeRating.toFixed(1)}
          {typeof count === "number" && count >= 0 ? ` (${count})` : ""}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  star: {
    marginRight: 1,
  },
  value: {
    marginLeft: 6,
    color: "#526071",
    fontWeight: "600",
  },
});

export default StarRating;
