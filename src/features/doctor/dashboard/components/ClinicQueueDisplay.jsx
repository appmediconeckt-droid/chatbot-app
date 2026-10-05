// Full-screen clinic queue display (the "LED screen"), built into the app so a
// phone / tablet connected to the clinic TV (HDMI or screen cast) can show it.
// Same data as the web LED page: GET /api/qr/walkin/:doctorClinicId/queue,
// polled every 3 seconds. Landscape = TV layout, portrait = stacked layout.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, NativeModules, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import axiosInstance from '../../../../axiosConfig';

const POLL_MS = 3000;
const CALL_MS = 6000;
const NOTES = [
  'Please wait for your token to be called.',
  'Keep your token ready when your number is called.',
  'Kindly keep your phone on silent in the waiting area.',
];
const C = {
  bg: '#04131C', bg2: '#072433', teal: '#2DD4BF', tealDeep: '#0F8A9D', green: '#34D399',
  gold: '#FCD34D', text: '#EEF8FB', muted: '#B4CDD8', amber: '#FBBF24',
  panel: 'rgba(255,255,255,0.05)', line: 'rgba(124,224,210,0.18)',
};

let Tts = null;
try { Tts = require('react-native-tts').default; } catch { Tts = null; }

const initials = (name) => String(name || 'Doctor').replace(/^dr\.?\s*/i, '').split(/\s+/)
  .filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'DR';
const tokenText = (v) => (v === undefined || v === null || v === '' ? '—' : String(v));
const T = (props) => <Text allowFontScaling={false} {...props} />;

export default function ClinicQueueDisplay({ visible, onClose, doctorClinicId, clinicName, doctorName }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  // One unit ≈ 1% of the short side, so the layout scales from phone to TV.
  const u = Math.min(width, height) / 100;

  const [data, setData] = useState(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(new Date());
  const [call, setCall] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const lastToken = useRef(undefined);
  const callTimer = useRef(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // Animations: rotating ring glow, pulsing live dots, shine on "Next", token pop, call overlay.
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const callAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;
    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1300),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible, spin, pulse, shine]);

  // Keep the screen awake while the display runs (native helper; no-op on older builds).
  useEffect(() => {
    if (!visible) return undefined;
    const mod = NativeModules.ScreenshotPrevent;
    mod?.keepScreenOn?.();
    return () => { mod?.allowScreenOff?.(); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const announce = (snapshot) => {
    const token = snapshot?.current?.token;
    const room = snapshot?.roomId;
    clearTimeout(callTimer.current);
    setCall({ token, room });
    callAnim.setValue(0);
    Animated.spring(callAnim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
    callTimer.current = setTimeout(() => {
      Animated.timing(callAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => setCall(null));
    }, CALL_MS);
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    if (soundRef.current && Tts) {
      try {
        Tts.stop();
        Tts.speak(`Token number ${token}. ${room ? `Please proceed to room ${room}.` : 'Please proceed.'}`);
      } catch { /* TTS unavailable */ }
    }
  };

  useEffect(() => {
    if (!visible || !doctorClinicId) return undefined;
    let active = true;
    let timer;
    lastToken.current = undefined;
    const load = async () => {
      try {
        const res = await axiosInstance.get(`/api/qr/walkin/${encodeURIComponent(doctorClinicId)}/queue`, { timeout: 8000 });
        if (!active) return;
        const next = res.data || {};
        const token = next?.current?.token;
        if (lastToken.current !== undefined && token && token !== lastToken.current) announce(next);
        lastToken.current = token ?? null;
        setData(next);
        setStale(false);
        setUpdatedAt(new Date());
      } catch {
        if (active) setStale(true);
      } finally {
        if (active) timer = setTimeout(load, POLL_MS);
      }
    };
    load();
    return () => { active = false; clearTimeout(timer); clearTimeout(callTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, doctorClinicId]);

  const facility = data?.facility?.name || clinicName || 'Humaeli';
  const docName = data?.doctor?.name || doctorName || 'Doctor';
  const room = data?.roomId || '';
  const current = data?.current?.token;
  const nextTokens = (data?.nextTokens || []).slice(0, 3);
  const total = Number(data?.totalPatients) || 0;
  const completed = Number(data?.completedCount) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const note = NOTES[Math.floor(now.getTime() / 10000) % NOTES.length];
  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const ringSize = landscape ? Math.min(height * 0.5, width * 0.32) : Math.min(width * 0.64, height * 0.3);
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const s = useMemo(() => makeStyles(u, landscape), [u, landscape]);

  const nextRow = (token, index) => {
    const first = index === 0;
    const body = (
      <>
        <View>
          <T style={[s.nextPos, first && s.nextPosFirst]}>{first ? 'NEXT' : `#${index + 1}`}</T>
          {first && (
            <View style={s.readyRow}>
              <Animated.View style={[s.readyDot, { opacity: dotOpacity }]} />
              <T style={s.ready}>Please be ready</T>
            </View>
          )}
        </View>
        <T style={[s.nextToken, first && s.nextTokenFirst]} numberOfLines={1} adjustsFontSizeToFit>{String(token)}</T>
      </>
    );
    if (!first) return <View key={String(token)} style={[s.nextItem, !landscape && s.nextItemHalf]}>{body}</View>;
    return (
      <LinearGradient
        key={String(token)}
        colors={['rgba(45,212,191,0.32)', 'rgba(52,211,153,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.nextItem, s.nextFirst]}
      >
        <Animated.View
          pointerEvents="none"
          style={[s.shine, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width * 0.6] }) }, { rotate: '20deg' }] }]}
        />
        {body}
      </LinearGradient>
    );
  };

  const serving = (
    <View style={s.serving}>
      <View style={s.docHead}>
        <LinearGradient colors={['#A7F3D0', C.teal]} style={s.avatar}><T style={s.avatarText}>{initials(docName)}</T></LinearGradient>
        <T style={s.docName} numberOfLines={1}>{docName}</T>
        {!!room && <LinearGradient colors={[C.teal, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.roomPill}><T style={s.roomText}>Room {room}</T></LinearGradient>}
      </View>
      <T style={s.label}>NOW SERVING</T>
      <View style={[s.ringBox, { width: ringSize, height: ringSize }]}>
        <View style={[s.ringFill, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]} />
        <Svg width={ringSize + 4 * u} height={ringSize + 4 * u} style={[s.abs, { left: -2 * u, top: -2 * u }]}>
          <Circle cx={(ringSize + 4 * u) / 2} cy={(ringSize + 4 * u) / 2} r={ringSize / 2 + 1.4 * u} stroke="rgba(52,211,153,0.35)" strokeWidth={0.35 * u} strokeDasharray={`${u} ${1.2 * u}`} fill="none" />
        </Svg>
        <Animated.View style={[s.abs, { transform: [{ rotate }] }]}>
          <Svg width={ringSize} height={ringSize}>
            <Defs>
              <SvgGradient id="arc" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={C.green} stopOpacity="0" />
                <Stop offset="0.7" stopColor={C.green} stopOpacity="0.9" />
                <Stop offset="1" stopColor={C.gold} stopOpacity="1" />
              </SvgGradient>
            </Defs>
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringSize / 2 - 0.6 * u} stroke="rgba(45,212,191,0.45)" strokeWidth={0.6 * u} fill="none" />
            <Circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringSize / 2 - 0.6 * u}
              stroke="url(#arc)" strokeWidth={1.1 * u} strokeLinecap="round" fill="none"
              strokeDasharray={`${Math.PI * (ringSize - 1.2 * u) * 0.28} ${Math.PI * ringSize}`}
            />
          </Svg>
        </Animated.View>
        <Animated.Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[s.current, { fontSize: ringSize * 0.42, transform: [{ scale: pop }] }]}
        >
          {tokenText(current)}
        </Animated.Text>
      </View>
      <T style={s.proceed} numberOfLines={2}>
        {current ? (room ? `Please proceed to Room ${room}` : 'Please proceed to the doctor') : 'The next token will be called shortly'}
      </T>
    </View>
  );

  const upNext = (
    <View style={s.upnext}>
      <T style={[s.label, s.labelLeft]}>UP NEXT</T>
      {nextTokens.length ? (
        <View style={s.nextList}>{nextTokens.map(nextRow)}</View>
      ) : (
        <View style={s.empty}><T style={s.emptyText}>No one waiting right now</T></View>
      )}
      <View style={s.counts}>
        {[['Waiting', data?.waitingCount, C.amber], ['Completed', data?.completedCount, C.green], ['Total today', data?.totalPatients, C.text]].map(([label, value, color]) => (
          <View key={label} style={s.count}>
            <T style={[s.countValue, { color }]}>{value ?? 0}</T>
            <T style={s.countLabel}>{label}</T>
          </View>
        ))}
      </View>
      {total > 0 && (
        <>
          <View style={s.progress}>
            <LinearGradient colors={[C.tealDeep, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.progressFill, { width: `${pct}%` }]} />
          </View>
          <T style={s.progressText}>{pct}% of today's patients seen</T>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <StatusBar hidden />
      <LinearGradient colors={[C.bg2, C.bg, C.bg]} locations={[0, 0.6, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.screen}>
        <View style={[s.blob, s.blobTop]} />
        <View style={[s.blob, s.blobBottom]} />

        <View style={s.top}>
          <View style={s.brand}>
            <LinearGradient colors={[C.tealDeep, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logo}>
              <Ionicons name="chatbubble-ellipses" size={4.2 * u} color="#FFF" />
            </LinearGradient>
            <View style={s.flex}>
              <T style={s.eyebrow} numberOfLines={1}>{facility.toUpperCase()}</T>
              <T style={s.title}>Clinic queue</T>
            </View>
          </View>
          <View style={s.status}>
            <View style={s.time}>
              <T style={s.clock}>{clock}</T>
              <T style={s.date}>{date}</T>
            </View>
            <View style={[s.live, stale && s.liveStale]}>
              <Animated.View style={[s.liveDot, stale && s.liveDotStale, { opacity: stale ? 1 : dotOpacity }]} />
              <T style={[s.liveText, stale && s.liveTextStale]}>{stale ? 'Reconnecting…' : 'Live'}</T>
            </View>
            <Pressable onPress={() => setSoundOn((v) => !v)} style={s.iconBtn} hitSlop={8}>
              <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={2.8 * u} color={C.text} />
            </Pressable>
            <Pressable onPress={onClose} style={s.iconBtn} hitSlop={8}>
              <Ionicons name="close" size={3 * u} color={C.text} />
            </Pressable>
          </View>
        </View>

        <View style={s.main}>
          <View style={[s.card, stale && s.cardStale]}>
            {serving}
            {upNext}
          </View>
          {call && (
            <Animated.View style={[s.call, { opacity: callAnim, transform: [{ scale: callAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
              <LinearGradient colors={['rgba(15,138,157,0.97)', 'rgba(4,19,28,0.98)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.callInner}>
                <T style={s.callLabel}>NOW CALLING</T>
                <T style={s.callToken} numberOfLines={1} adjustsFontSizeToFit>{tokenText(call.token)}</T>
                <T style={s.callRoom}>{call.room ? `Please proceed to Room ${call.room}` : docName}</T>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        <View style={s.footer}>
          <View style={s.note}>
            <View style={s.noteIcon}><T style={s.noteIconText}>i</T></View>
            <T style={s.noteText} numberOfLines={1}>{note}</T>
          </View>
          {landscape && (
            <T style={s.updated}>
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for live data'}
            </T>
          )}
          <T style={s.powered}>Powered by <T style={s.poweredBrand}>Humaeli</T></T>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const makeStyles = (u, landscape) => StyleSheet.create({
  flex: { flex: 1 },
  abs: { position: 'absolute' },
  screen: { flex: 1, paddingHorizontal: landscape ? 3 * u : 4 * u, paddingTop: landscape ? 3 * u : 9 * u, paddingBottom: landscape ? 2.4 * u : 5 * u, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { width: 90 * u, height: 90 * u, right: -30 * u, top: -45 * u, backgroundColor: 'rgba(45,212,191,0.10)' },
  blobBottom: { width: 80 * u, height: 80 * u, left: -30 * u, bottom: -40 * u, backgroundColor: 'rgba(15,138,157,0.14)' },

  top: { flexDirection: landscape ? 'row' : 'column', alignItems: landscape ? 'center' : 'stretch', justifyContent: 'space-between', gap: 2 * u },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2 * u, flexShrink: 1 },
  logo: { width: 8.5 * u, height: 8.5 * u, borderRadius: 2.4 * u, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: C.teal, fontWeight: '800', letterSpacing: 0.3 * u, fontSize: 2.1 * u },
  title: { color: C.text, fontWeight: '900', fontSize: 4.4 * u },
  status: { flexDirection: 'row', alignItems: 'center', gap: 2 * u, justifyContent: landscape ? 'flex-end' : 'space-between' },
  time: { alignItems: landscape ? 'flex-end' : 'flex-start', marginRight: landscape ? 0 : 'auto' },
  clock: { color: C.text, fontWeight: '900', fontSize: 5.2 * u, fontVariant: ['tabular-nums'] },
  date: { color: C.muted, fontSize: 1.9 * u },
  live: { flexDirection: 'row', alignItems: 'center', gap: u, paddingHorizontal: 1.8 * u, paddingVertical: 0.8 * u, borderRadius: 99, backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)' },
  liveStale: { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.4)' },
  liveDot: { width: 1.3 * u, height: 1.3 * u, borderRadius: u, backgroundColor: C.green },
  liveDotStale: { backgroundColor: C.amber },
  liveText: { color: '#A7F3D0', fontWeight: '800', fontSize: 1.9 * u },
  liveTextStale: { color: '#FDE68A' },
  iconBtn: { width: 5.4 * u, height: 5.4 * u, borderRadius: 1.4 * u, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,138,157,0.25)', borderWidth: 1, borderColor: 'rgba(124,224,210,0.35)' },

  main: { flex: 1, marginVertical: 2.2 * u },
  card: { flex: 1, flexDirection: landscape ? 'row' : 'column', borderRadius: 3 * u, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.045)', overflow: 'hidden' },
  cardStale: { opacity: 0.45 },

  serving: { flex: landscape ? 1.55 : 1.25, alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 2.5 * u, paddingVertical: 2 * u },
  docHead: { flexDirection: 'row', alignItems: 'center', gap: 1.4 * u, maxWidth: '100%', flexWrap: landscape ? 'nowrap' : 'wrap', justifyContent: 'center' },
  avatar: { width: 6.4 * u, height: 6.4 * u, borderRadius: 3.2 * u, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#052E2B', fontWeight: '900', fontSize: 2.6 * u },
  docName: { color: C.text, fontWeight: '900', fontSize: 5 * u, flexShrink: 1 },
  roomPill: { paddingHorizontal: 2 * u, paddingVertical: 0.6 * u, borderRadius: 99 },
  roomText: { color: '#052E2B', fontWeight: '900', fontSize: 2.6 * u },
  label: { color: C.muted, fontWeight: '800', letterSpacing: 0.45 * u, fontSize: 2 * u, textAlign: 'center' },
  labelLeft: { textAlign: 'left' },
  ringBox: { alignItems: 'center', justifyContent: 'center' },
  ringFill: { position: 'absolute', backgroundColor: 'rgba(45,212,191,0.12)' },
  current: { color: C.gold, fontWeight: '900', textShadowColor: 'rgba(252,211,77,0.55)', textShadowRadius: 3 * u, paddingHorizontal: 2 * u, fontVariant: ['tabular-nums'] },
  proceed: { color: '#A7F3D0', fontWeight: '800', fontSize: 3.6 * u, textAlign: 'center' },

  upnext: { flex: 1, padding: landscape ? 3 * u : 4 * u, gap: 1.6 * u, borderLeftWidth: landscape ? 1 : 0, borderTopWidth: landscape ? 0 : 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.14)' },
  nextList: { flex: landscape ? 1 : 0, gap: 1.2 * u, flexDirection: landscape ? 'column' : 'row', flexWrap: landscape ? 'nowrap' : 'wrap' },
  nextItem: { flex: landscape ? 1 : 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2.4 * u, paddingVertical: 1.4 * u, borderRadius: 2 * u, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  nextItemHalf: { flexGrow: 1, flexBasis: '45%' },
  nextFirst: { borderColor: 'rgba(52,211,153,0.55)', width: landscape ? undefined : '100%' },
  shine: { position: 'absolute', top: -10 * u, bottom: -10 * u, width: 8 * u, backgroundColor: 'rgba(255,255,255,0.10)' },
  nextPos: { color: C.muted, fontWeight: '800', letterSpacing: 0.3 * u, fontSize: 2.3 * u },
  nextPosFirst: { color: '#A7F3D0' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 0.8 * u, marginTop: 0.5 * u },
  readyDot: { width: 1.2 * u, height: 1.2 * u, borderRadius: u, backgroundColor: C.gold },
  ready: { color: '#FDE68A', fontWeight: '800', fontSize: 2 * u },
  nextToken: { color: C.text, fontWeight: '900', fontSize: 6.4 * u, fontVariant: ['tabular-nums'], flexShrink: 1, marginLeft: 2 * u },
  nextTokenFirst: { color: C.gold, fontSize: 7.8 * u, textShadowColor: 'rgba(252,211,77,0.35)', textShadowRadius: 2 * u },
  empty: { flex: landscape ? 1 : 0, paddingVertical: 4 * u, alignItems: 'center', justifyContent: 'center', borderRadius: 2 * u, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line },
  emptyText: { color: C.muted, fontSize: 3 * u, fontWeight: '600' },
  counts: { flexDirection: 'row', gap: 1.2 * u },
  count: { flex: 1, alignItems: 'center', paddingVertical: 1.4 * u, borderRadius: 1.8 * u, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  countValue: { fontWeight: '900', fontSize: 5 * u, fontVariant: ['tabular-nums'] },
  countLabel: { color: C.muted, fontWeight: '700', fontSize: 1.9 * u },
  progress: { height: 1.2 * u, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  progressText: { color: C.muted, fontWeight: '700', fontSize: 1.8 * u, textAlign: 'center' },

  call: { ...StyleSheet.absoluteFillObject, borderRadius: 3 * u, overflow: 'hidden', borderWidth: 0.6 * u, borderColor: 'rgba(252,211,77,0.75)' },
  callInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 * u },
  callLabel: { color: '#A7F3D0', fontWeight: '900', letterSpacing: 0.8 * u, fontSize: 3.4 * u },
  callToken: { color: C.gold, fontWeight: '900', fontSize: (landscape ? 36 : 30) * u, textShadowColor: 'rgba(252,211,77,0.6)', textShadowRadius: 5 * u, fontVariant: ['tabular-nums'] },
  callRoom: { color: C.text, fontWeight: '900', fontSize: 5 * u, textAlign: 'center' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 * u },
  note: { flexDirection: 'row', alignItems: 'center', gap: 1.2 * u, flexShrink: 1 },
  noteIcon: { width: 3 * u, height: 3 * u, borderRadius: 1.5 * u, backgroundColor: C.tealDeep, alignItems: 'center', justifyContent: 'center' },
  noteIconText: { color: '#FFF', fontWeight: '900', fontStyle: 'italic', fontSize: 1.9 * u },
  noteText: { color: C.text, fontWeight: '700', fontSize: 2 * u, flexShrink: 1 },
  updated: { color: C.muted, fontSize: 1.9 * u },
  powered: { color: C.muted, fontSize: 1.9 * u },
  poweredBrand: { color: C.teal, fontWeight: '900' },
});
