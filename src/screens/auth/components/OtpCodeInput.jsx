import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const OtpCodeInput = ({
  value = "",
  onChangeText,
  length = 6,
  editable = true,
  autoFocus = false,
  containerStyle,
  boxStyle,
  filledBoxStyle,
  focusedBoxStyle,
  successBoxStyle,
  textStyle,
  success = false,
}) => {
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const sanitizedValue = String(value).replace(/\D/g, "").slice(0, length);
  const digits = Array.from({ length }, (_, index) => sanitizedValue[index] || "");

  useEffect(() => {
    if (!autoFocus || !editable) return undefined;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => clearTimeout(timer);
  }, [autoFocus, editable]);

  const focusInput = () => {
    if (editable) {
      inputRef.current?.focus();
    }
  };

  const currentIndex =
    sanitizedValue.length >= length ? length - 1 : sanitizedValue.length;

  return (
    <Pressable style={[styles.container, containerStyle]} onPress={focusInput}>
      <View style={styles.row}>
        {digits.map((digit, index) => {
          const showFocusRing = isFocused && editable && currentIndex === index;

          return (
            <View
              key={index}
              style={[
                styles.box,
                boxStyle,
                digit && styles.boxFilled,
                digit && filledBoxStyle,
                showFocusRing && styles.boxFocused,
                showFocusRing && focusedBoxStyle,
                success && styles.boxSuccess,
                success && successBoxStyle,
              ]}
            >
              <Text style={[styles.digit, textStyle]}>{digit || " "}</Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={sanitizedValue}
        onChangeText={(text) => onChangeText?.(text.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        editable={editable}
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden
        importantForAutofill="no"
        style={styles.inputOverlay}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  box: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: {
    backgroundColor: "#ffffff",
  },
  boxFocused: {
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  boxSuccess: {
    borderColor: "#22c55e",
    backgroundColor: "#f0fdf4",
  },
  digit: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  inputOverlay: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    backgroundColor: "transparent",
    opacity: 0.02,
    zIndex: 5,
  },
});

export default OtpCodeInput;
