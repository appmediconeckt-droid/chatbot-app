import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

/**
 * Soft "mesh gradient" backdrop for the auth screens.
 *
 * Drawn in code rather than shipped as a PNG so it scales cleanly to any phone
 * or tablet (blob size/position are derived from the live window size) with no
 * asset weight and no stretching.
 *
 * role: 'user' | 'counselor' | 'counsellor' | 'both'
 *   user      → green mesh   (patient palette)
 *   counselor → blue mesh    (doctor palette)
 *   both      → green top-left → blue bottom-right (RoleSelector)
 */
const AuthBackground = ({ role = 'user', style, children }) => {
  const { width, height } = useWindowDimensions();
  const r = String(role || '').trim().toLowerCase();
  const isDoctor = r === 'counselor' || r === 'counsellor';
  const isBoth = r === 'both';

  // Blobs scale with the largest screen edge → same proportions on phone/tablet.
  const blob = Math.max(width, height) * 0.85;

  const base = isBoth
    ? ['#EAF7F0', '#F5F7FC', '#DEE9FC']
    : isDoctor
    ? ['#FFFFFF', '#EFF4FE', '#DCE8FB']
    : ['#FFFFFF', '#F0FBF5', '#DCF3E7'];

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={base}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {isBoth ? (
        <>
          <LinearGradient
            colors={['#B6E8D0', 'rgba(182,232,208,0)']}
            style={[
              styles.blob,
              { width: blob, height: blob, borderRadius: blob / 2, left: -blob * 0.34, top: -blob * 0.18 },
            ]}
          />
          <LinearGradient
            colors={['#A9C4F7', 'rgba(169,196,247,0)']}
            style={[
              styles.blob,
              { width: blob, height: blob, borderRadius: blob / 2, right: -blob * 0.34, bottom: -blob * 0.18 },
            ]}
          />
        </>
      ) : isDoctor ? (
        <>
          {/* Blue: strong on the right, soft wash bottom-left */}
          <LinearGradient
            colors={['#A8C6F8', 'rgba(168,198,248,0)']}
            style={[
              styles.blob,
              { width: blob, height: blob, borderRadius: blob / 2, right: -blob * 0.3, top: height * 0.06 },
            ]}
          />
          <LinearGradient
            colors={['#C3D8FB', 'rgba(195,216,251,0)']}
            style={[
              styles.blob,
              { width: blob * 0.9, height: blob * 0.9, borderRadius: blob * 0.45, left: -blob * 0.3, bottom: -blob * 0.1 },
            ]}
          />
        </>
      ) : (
        <>
          {/* Green: mint pooled on the left, fading to white on the right */}
          <LinearGradient
            colors={['#AEEAD0', 'rgba(174,234,208,0)']}
            style={[
              styles.blob,
              { width: blob, height: blob, borderRadius: blob / 2, left: -blob * 0.32, top: height * 0.04 },
            ]}
          />
          <LinearGradient
            colors={['#D2F4E4', 'rgba(210,244,228,0)']}
            style={[
              styles.blob,
              { width: blob * 0.9, height: blob * 0.9, borderRadius: blob * 0.45, right: -blob * 0.3, bottom: -blob * 0.12 },
            ]}
          />
        </>
      )}

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  // overflow:hidden is required — the blobs are oversized circles at negative
  // offsets, so without clipping they paint past the screen edges.
  root: { flex: 1, overflow: 'hidden' },
  blob: { position: 'absolute' },
});

export default AuthBackground;
