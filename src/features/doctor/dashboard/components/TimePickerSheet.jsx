// Analog clock time picker for the doctor calendar (Start / End Time).
// Material-style: tap or drag on the dial to pick the hour — it then jumps to
// minutes automatically — tap or drag again for minutes, toggle AM / PM, Set.
// Pure JS (PanResponder + Views, no native dialog), so it never resets / loops
// like the old native Android picker did inside a Modal. The result is a
// plain local "HH:mm" string with no timezone conversion — exactly what
// /api/availability/ranges expects.
//
// Render it INSIDE the Modal that opens it (it is an absolute overlay, not a
// Modal itself) so it always sits on top of that sheet on iOS and Android.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { colors, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';

const DIAL = 260; // dial diameter
const CENTER = DIAL / 2;
const NUMBER_RADIUS = 100; // where the numbers sit
const KNOB = 40; // selected-value circle

const HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const parse = (hhmm, fallback) => {
  const m = String(hhmm || fallback || '').match(/^(\d{1,2}):(\d{2})/);
  const h24 = m ? Number(m[1]) : 9;
  const min = m ? Number(m[2]) : 0;
  return { hour12: h24 % 12 || 12, minute: min, pm: h24 >= 12 };
};

const to24 = ({ hour12, minute, pm }) => {
  let h = hour12 % 12;
  if (pm) h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

// Position of label i (0 = 12 o'clock) on the dial.
const labelPosition = (index) => {
  const angle = (index * 30 * Math.PI) / 180;
  return {
    left: CENTER + NUMBER_RADIUS * Math.sin(angle) - KNOB / 2,
    top: CENTER - NUMBER_RADIUS * Math.cos(angle) - KNOB / 2,
  };
};

export default function TimePickerSheet({ visible, title = 'Select time', value, fallback, onCancel, onConfirm }) {
  const [draft, setDraft] = useState(() => parse(value, fallback));
  const [mode, setMode] = useState('hour'); // 'hour' | 'minute'
  const dialRef = useRef(null);
  const dialOrigin = useRef({ x: 0, y: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Re-seed every time the sheet opens so it shows the field's current value.
  useEffect(() => {
    if (visible) {
      setDraft(parse(value, fallback));
      setMode('hour');
    }
  }, [visible, value, fallback]);

  // Touch point -> clock angle (0° at 12 o'clock, clockwise) -> hour / minute.
  const applyTouch = (pageX, pageY) => {
    const dx = pageX - dialOrigin.current.x - CENTER;
    const dy = pageY - dialOrigin.current.y - CENTER;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (modeRef.current === 'hour') {
      const hour = Math.round(deg / 30) % 12 || 12;
      setDraft((d) => (d.hour12 === hour ? d : { ...d, hour12: hour }));
    } else {
      const minute = Math.round(deg / 6) % 60;
      setDraft((d) => (d.minute === minute ? d : { ...d, minute }));
    }
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      // Measure the dial on every touch — the sheet may have moved.
      dialRef.current?.measure((_x, _y, _w, _h, px, py) => {
        dialOrigin.current = { x: px, y: py };
        applyTouch(pageX, pageY);
      });
    },
    onPanResponderMove: (evt) => applyTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    onPanResponderRelease: () => {
      // Like Android's clock: after choosing the hour, go to minutes.
      if (modeRef.current === 'hour') setMode('minute');
    },
  }), []);

  if (!visible) return null;

  const isHour = mode === 'hour';
  const handAngle = isHour ? (draft.hour12 % 12) * 30 : draft.minute * 6;
  const labels = isHour ? HOUR_LABELS : MINUTE_LABELS;
  const selectedIndex = isHour ? draft.hour12 % 12 : draft.minute % 5 === 0 ? draft.minute / 5 : -1;
  const hh = String(draft.hour12).padStart(2, '0');
  const mm = String(draft.minute).padStart(2, '0');

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onCancel} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.headerRow}>
          <View style={s.titleRow}>
            <AppIcon name="clock" size={16} color={colors.blue} />
            <Text style={s.title}>{title}</Text>
          </View>
          <Pressable onPress={onCancel} hitSlop={10}><AppIcon name="x" size={18} color="#667085" /></Pressable>
        </View>

        {/* Digital readout: tap HH or MM to switch what the dial edits */}
        <View style={s.readout}>
          <Pressable onPress={() => setMode('hour')} style={[s.readoutPart, isHour && s.readoutPartActive]}>
            <Text style={[s.readoutText, isHour && s.readoutTextActive]}>{hh}</Text>
          </Pressable>
          <Text style={s.readoutColon}>:</Text>
          <Pressable onPress={() => setMode('minute')} style={[s.readoutPart, !isHour && s.readoutPartActive]}>
            <Text style={[s.readoutText, !isHour && s.readoutTextActive]}>{mm}</Text>
          </Pressable>
          <View style={s.meridiem}>
            {['AM', 'PM'].map((label) => {
              const active = (label === 'PM') === draft.pm;
              return (
                <Pressable key={label} onPress={() => setDraft((d) => ({ ...d, pm: label === 'PM' }))} style={[s.meridiemBtn, active && s.meridiemBtnActive]}>
                  <Text style={[s.meridiemText, active && s.meridiemTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={s.modeHint}>{isHour ? 'Tap or drag to choose the hour' : 'Tap or drag to choose the minutes'}</Text>

        {/* Clock dial */}
        <View style={s.dialWrap}>
          <View ref={dialRef} collapsable={false} style={s.dial} {...panResponder.panHandlers}>
            {/* Hand + knob rotate together around the dial centre */}
            <View pointerEvents="none" style={[s.handLayer, { transform: [{ rotate: `${handAngle}deg` }] }]}>
              <View style={s.hand} />
              <View style={s.knob}>{selectedIndex === -1 && <View style={s.knobDot} />}</View>
            </View>
            <View pointerEvents="none" style={s.centerDot} />
            {labels.map((label, index) => {
              const selected = index === selectedIndex;
              return (
                <View key={label} pointerEvents="none" style={[s.label, labelPosition(index)]}>
                  <Text style={[s.labelText, selected && s.labelTextSelected]}>
                    {isHour ? label : String(label).padStart(2, '0')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.actions}>
          <Pressable style={s.cancelBtn} onPress={onCancel}><Text style={s.cancelText}>Cancel</Text></Pressable>
          <Pressable style={s.confirmWrap} onPress={() => onConfirm(to24(draft))}>
            <LinearGradient colors={doctorGradient} {...gradientDirection} style={s.confirmBtn}>
              <AppIcon name="check-mark" size={14} color="#FFF" strokeWidth={3} />
              <Text style={s.confirmText}>Set {hh}:{mm} {draft.pm ? 'PM' : 'AM'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', zIndex: 50, elevation: 50 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5DAE3', marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: '#17243A' },

  readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14 },
  readoutPart: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, backgroundColor: '#F1F5F9' },
  readoutPartActive: { backgroundColor: colors.paleBlue },
  readoutText: { fontSize: 42, fontWeight: '800', color: '#98A2B3', fontVariant: ['tabular-nums'] },
  readoutTextActive: { color: colors.blue },
  readoutColon: { fontSize: 40, fontWeight: '800', color: '#98A2B3', marginHorizontal: 2 },
  meridiem: { gap: 6, marginLeft: 10 },
  meridiemBtn: { width: 52, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#99F6E4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  meridiemBtnActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  meridiemText: { fontSize: 13, fontWeight: '700', color: colors.blue },
  meridiemTextActive: { color: '#FFF' },
  modeHint: { textAlign: 'center', fontSize: 12, color: '#667085', marginTop: 8 },

  dialWrap: { alignItems: 'center', marginVertical: 14 },
  dial: { width: DIAL, height: DIAL, borderRadius: DIAL / 2, backgroundColor: '#EEF6F5', borderWidth: 1, borderColor: '#D1EAE6' },
  handLayer: { position: 'absolute', top: 0, left: 0, width: DIAL, height: DIAL },
  hand: { position: 'absolute', left: CENTER - 1.5, top: CENTER - NUMBER_RADIUS, width: 3, height: NUMBER_RADIUS, borderRadius: 2, backgroundColor: colors.blue },
  knob: { position: 'absolute', left: CENTER - KNOB / 2, top: CENTER - NUMBER_RADIUS - KNOB / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  knobDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  centerDot: { position: 'absolute', left: CENTER - 5, top: CENTER - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  label: { position: 'absolute', width: KNOB, height: KNOB, alignItems: 'center', justifyContent: 'center' },
  labelText: { fontSize: 16, fontWeight: '700', color: '#344054' },
  labelTextSelected: { color: '#FFF' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#D5DAE3', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: '#344054' },
  confirmWrap: { flex: 1.6 },
  confirmBtn: { height: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 14.5, fontWeight: '800', color: '#FFF' },
});
