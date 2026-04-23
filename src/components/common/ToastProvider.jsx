import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ToastContext = createContext(null);

const TOAST_THEME = {
  success: {
    accent: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    title: "Success",
    icon: "OK",
  },
  error: {
    accent: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    title: "Something went wrong",
    icon: "!",
  },
  info: {
    accent: "#0284c7",
    bg: "#f0f9ff",
    border: "#bae6fd",
    title: "Info",
    icon: "i",
  },
  warning: {
    accent: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    title: "Warning",
    icon: "!",
  },
};

function ToastViewport({ toast, onHide, topOffset }) {
  const anim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!toast) return undefined;

    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const duration = Math.max(1500, toast.duration || 3200);
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(onHide);
    }, duration);

    return () => clearTimeout(timer);
  }, [anim, onHide, toast]);

  if (!toast) return null;

  const config = TOAST_THEME[toast.type] || TOAST_THEME.info;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          top: topOffset,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable onPress={onHide} style={styles.cardWrap}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: config.bg,
              borderColor: config.border,
            },
          ]}
        >
          <View style={[styles.leadingIcon, { backgroundColor: config.accent }]}>
            <Text style={styles.leadingIconText}>{config.icon}</Text>
          </View>

          <View style={styles.content}>
            <Text style={[styles.title, { color: config.accent }]} numberOfLines={1}>
              {toast.title || config.title}
            </Text>
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>

          <View style={[styles.sideAccent, { backgroundColor: config.accent }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((payload) => {
    if (typeof payload === "string") {
      setToast({ message: payload, type: "info" });
      return;
    }

    setToast({
      message: payload?.message || "",
      title: payload?.title,
      type: payload?.type || "info",
      duration: payload?.duration,
    });
  }, []);

  const api = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);

  React.useEffect(() => {
    const originalAlert = Alert.alert;

    const inferToastType = (title = "", message = "") => {
      const sample = `${title} ${message}`.toLowerCase();
      if (/error|failed|denied|invalid|unauthor|unable/.test(sample)) return "error";
      if (/success|sent|done|completed|accepted|saved/.test(sample)) return "success";
      if (/warning|required|pending|wait|expired/.test(sample)) return "warning";
      return "info";
    };

    Alert.alert = (title, message, buttons, options) => {
      const hasActionButtons = Array.isArray(buttons) && buttons.length > 1;

      // Keep true confirmation dialogs native because they require actions.
      if (hasActionButtons) {
        return originalAlert(title, message, buttons, options);
      }

      const titleText = typeof title === "string" ? title.trim() : "";
      const messageText = typeof message === "string" ? message.trim() : "";

      setToast({
        message: messageText || titleText || "Notification",
        title: messageText ? titleText || undefined : undefined,
        type: inferToastType(titleText, messageText),
      });
    };

    return () => {
      Alert.alert = originalAlert;
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toast={toast} onHide={hideToast} topOffset={Math.max(10, insets.top + 6)} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  cardWrap: {
    borderRadius: 18,
    overflow: "hidden",
  },
  card: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  leadingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  leadingIconText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  message: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  sideAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 999,
  },
});
