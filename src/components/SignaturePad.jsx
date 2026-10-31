// Draw-with-your-finger signature pad. "Use signature" turns the drawing into
// a transparent PNG (native PrescriptionPrint.renderSignaturePng) and hands it
// back as an upload-ready file: onDone({ uri, type, name }).
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeModules,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from './TranslatedText';

const INK = '#0B1F4D';

// Same smoothing as the native renderer: quadratic curves through midpoints.
const strokeToPath = points => {
  if (points.length < 2) return '';
  let d = `M ${points[0]} ${points[1]}`;
  if (points.length < 4) return `${d} L ${points[0] + 0.1} ${points[1] + 0.1}`;
  let px = points[0];
  let py = points[1];
  for (let i = 2; i + 1 < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    d += ` Q ${px} ${py} ${(px + x) / 2} ${(py + y) / 2}`;
    px = x;
    py = y;
  }
  return `${d} L ${px} ${py}`;
};

// Room around the ink when cropping: half the native 3.2 stroke width plus a
// little air, so round caps aren't clipped.
const CROP_PADDING = 4;

// The strokes moved to the ink's own box, and that box's size. Saving the
// whole pad left empty space under the signature, which showed as a gap
// above the doctor's name on the prescription.
const cropStrokes = strokes => {
  const xs = [];
  const ys = [];
  strokes.forEach(stroke => {
    for (let i = 0; i + 1 < stroke.length; i += 2) {
      xs.push(stroke[i]);
      ys.push(stroke[i + 1]);
    }
  });
  const left = Math.min(...xs) - CROP_PADDING;
  const top = Math.min(...ys) - CROP_PADDING;
  return {
    strokes: strokes.map(stroke => stroke.map((value, i) => value - (i % 2 ? top : left))),
    width: Math.max(...xs) + CROP_PADDING - left,
    height: Math.max(...ys) + CROP_PADDING - top,
  };
};

export default function SignaturePad({ visible, title = 'Draw your signature', signerName, onCancel, onDone }) {
  const [strokes, setStrokes] = useState([]);
  const [saving, setSaving] = useState(false);
  const current = useRef(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          current.current = [locationX, locationY];
          setStrokes(prev => [...prev, current.current]);
        },
        onPanResponderMove: evt => {
          if (!current.current) return;
          const { locationX, locationY } = evt.nativeEvent;
          current.current = [...current.current, locationX, locationY];
          const stroke = current.current;
          setStrokes(prev => [...prev.slice(0, -1), stroke]);
        },
        onPanResponderRelease: () => {
          current.current = null;
        },
      }),
    [],
  );

  const clear = () => {
    current.current = null;
    setStrokes([]);
  };

  const hasInk = strokes.some(stroke => stroke.length >= 2);

  const confirm = async () => {
    if (!hasInk || saving) return;
    const renderer = NativeModules.PrescriptionPrint;
    if (!renderer?.renderSignaturePng) {
      Alert.alert('Signature', 'Signing will work after the app is updated.');
      return;
    }
    try {
      setSaving(true);
      const cropped = cropStrokes(strokes.filter(stroke => stroke.length >= 2));
      const path = await renderer.renderSignaturePng(cropped.strokes, cropped.width, cropped.height);
      onDone?.({ uri: `file://${path}`, type: 'image/png', name: `signature-${Date.now()}.png` });
      clear();
    } catch (error) {
      Alert.alert('Signature', error?.message || 'Could not save the signature.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {!!signerName && (
                <Text translate={false} style={styles.subtitle}>{signerName}</Text>
              )}
            </View>
            <Pressable onPress={onCancel} hitSlop={10} disabled={saving}>
              <Ionicons name="close" size={24} color="#334155" />
            </Pressable>
          </View>

          <View style={styles.pad} {...responder.panHandlers}>
            {!hasInk && (
              <View style={styles.hint} pointerEvents="none">
                <Ionicons name="create-outline" size={22} color="#94A3B8" />
                <Text style={styles.hintText}>Sign here with your finger</Text>
              </View>
            )}
            <View style={styles.baseline} pointerEvents="none">
              <Text style={styles.cross}>✕</Text>
              <View style={styles.baselineRule} />
            </View>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {strokes.map((stroke, index) => (
                <Path
                  key={`stroke-${index}`}
                  d={strokeToPath(stroke)}
                  stroke={INK}
                  strokeWidth={3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
            </Svg>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={clear} style={[styles.btn, styles.btnGhost]} disabled={saving || !hasInk}>
              <Ionicons name="refresh" size={16} color={hasInk ? '#334155' : '#CBD5E1'} />
              <Text style={[styles.btnGhostText, !hasInk && styles.dim]}>Clear</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={[styles.btn, styles.btnGhost]} disabled={saving}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              style={[styles.btn, styles.btnPrimary, (!hasInk || saving) && styles.btnDisabled]}
              disabled={!hasInk || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark" size={17} color="#FFFFFF" />
              )}
              <Text style={styles.btnPrimaryText}>Use signature</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12.5, fontWeight: '700', color: '#64748B', marginTop: 2 },
  pad: {
    height: 220,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#FBFDFF',
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hintText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  baseline: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  cross: { color: '#94A3B8', fontSize: 16, fontWeight: '900', marginBottom: -4 },
  baselineRule: { flex: 1, height: 1.5, backgroundColor: '#CBD5E1' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  btnGhost: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  btnGhostText: { color: '#334155', fontSize: 14, fontWeight: '800' },
  dim: { color: '#CBD5E1' },
  btnPrimary: { flex: 1, backgroundColor: '#2563EB' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '900' },
  btnDisabled: { opacity: 0.5 },
});
