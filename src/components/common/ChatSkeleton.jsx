import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

/**
 * Placeholder for a chat thread while messages + call history load.
 *
 * Mirrors the shape of the real thread — alternating incoming/outgoing bubbles of
 * varying width, with a date chip — so the layout does not jump when the content
 * arrives. Same looped-opacity technique as the wallet/appointment skeletons in
 * this app, so it needs no animation library.
 *
 * Props:
 *   role — 'user' | 'counselor' (only changes the outgoing bubble tint)
 */

// width fraction, isOutgoing, has a second line
const ROWS = [
  [0.52, false, false],
  [0.68, true, true],
  [0.44, false, false],
  [0.74, false, true],
  [0.58, true, false],
  [0.36, true, false],
  [0.62, false, true],
];

const ChatSkeleton = ({ role = 'user' }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  const outgoingTint = role === 'counselor' ? '#DBE7FB' : '#DCF3E4';

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.View style={[s.dateChip, { opacity }]} />

      {ROWS.map(([frac, outgoing, twoLine], i) => (
        <View key={i} style={[s.row, outgoing && s.rowOut]}>
          {/* Incoming messages carry an avatar in both chats. */}
          {!outgoing && <Animated.View style={[s.avatar, { opacity }]} />}
          <Animated.View
            style={[
              s.bubble,
              {
                opacity,
                width: `${Math.round(frac * 100)}%`,
                backgroundColor: outgoing ? outgoingTint : '#E7EBF0',
                borderBottomRightRadius: outgoing ? 4 : 16,
                borderBottomLeftRadius: outgoing ? 16 : 4,
              },
            ]}
          >
            <View style={s.line} />
            {twoLine && <View style={[s.line, s.lineShort]} />}
          </Animated.View>
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 14, paddingTop: 16 },
  dateChip: {
    alignSelf: 'center',
    width: 84,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    marginBottom: 18,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  rowOut: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0' },
  bubble: {
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
    gap: 7,
  },
  // Faint bars inside the bubble stand in for the text itself.
  line: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.75)' },
  lineShort: { width: '62%' },
});

export default ChatSkeleton;
