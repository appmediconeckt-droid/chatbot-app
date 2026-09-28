// DoctorOnboarding — runs AFTER DoctorSignup (account creation). A 4-slide,
// UI-only product tour: it collects nothing. Clinic, availability and
// credentials are set up later from the dashboard (Clinic Settings /
// Calendar), where they are actually saved to the backend.
//
// Slides: Welcome → Calendar & availability → Live token queue →
// Patient records & prescriptions. One horizontal paging ScrollView (real
// native swipe) drives parallax transitions through a native-driven scrollX:
// each slide's illustration and text slide/fade/scale in as it comes into view.
//
// The base profile created at signup arrives via `route.params.doctorProfileBase`
// and is handed on to DoctorDashboard unchanged (cached as `doctorMockProfile`,
// the key DoctorDashboard reads — see DoctorSignup.jsx).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StatusBar, Animated, Easing, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Text from '../../components/TranslatedText';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { CLINICIAN } from '../../theme/palette';
import useLanguageRender from '../../hooks/useLanguageRender';
import { createDoctorStyles } from '../../features/doctor/dashboard/theme';
import { enterAuthenticatedRoute } from '../../utils/authSession';

const { width, height } = Dimensions.get('window');
const HERO_SIZE = Math.min(width - 48, height * 0.42, 340);
const GRADIENT = [CLINICIAN.gradientFrom, CLINICIAN.gradientTo];

const SLIDES = [
  {
    key: 'welcome',
    tag: 'WELCOME, DOCTOR',
    title: 'Your practice, beautifully organised',
    body: 'Appointments, patients and prescriptions — everything your clinic needs, in one simple app.',
    points: [
      { icon: 'shield-check-outline', label: 'Verified profile' },
      { icon: 'lock-outline', label: 'Private & secure' },
    ],
  },
  {
    key: 'calendar',
    tag: 'SMART CALENDAR',
    title: 'Set your hours, your way',
    body: 'Add time ranges for each clinic. Patients can only book open, upcoming slots — no clashes.',
    points: [
      { icon: 'calendar-clock', label: 'Per-clinic timings' },
      { icon: 'clock-check-outline', label: 'Auto time slots' },
    ],
  },
  {
    key: 'queue',
    tag: 'LIVE TOKEN QUEUE',
    title: 'A calm, organised waiting room',
    body: 'Bookings and walk-ins get token numbers. Emergencies go first, and patients see live wait times.',
    points: [
      { icon: 'ticket-confirmation-outline', label: 'Token system' },
      { icon: 'ambulance', label: 'Emergency priority' },
    ],
  },
  {
    key: 'records',
    tag: 'PATIENT CARE',
    title: 'Records & prescriptions in seconds',
    body: 'See every visit, write prescriptions, share them as PDF and schedule follow-ups.',
    points: [
      { icon: 'file-document-edit-outline', label: 'Digital Rx' },
      { icon: 'calendar-refresh-outline', label: 'Follow-ups' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Illustrations — small "app preview" cards built from Views, floating over a
// gradient orb. `float` is a shared looping value for the gentle bob.
// ---------------------------------------------------------------------------
const Orb = ({ children }) => (
  <View style={s.orbWrap}>
    <View style={s.orbHalo} />
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.orb}>
      <View style={s.orbShine} />
      {children}
    </LinearGradient>
  </View>
);

const Float = ({ float, range = 8, style, children }) => (
  <Animated.View
    style={[style, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -range] }) }] }]}
  >
    {children}
  </Animated.View>
);

const WelcomeArt = ({ float, t }) => (
  <Orb>
    <Float float={float} range={10}>
      <View style={s.bigIconRing}><Icon name="stethoscope" size={64} color="#FFFFFF" /></View>
    </Float>
    <Float float={float} range={6} style={[s.floatCard, s.posTopLeft]}>
      <View style={[s.miniIcon, { backgroundColor: '#CCFBF1' }]}><Icon name="calendar-check" size={15} color={CLINICIAN.gradientFrom} /></View>
      <View>
        <Text style={s.miniTitle}>{t('Next patient')}</Text>
        <Text style={s.miniSub}>10:30 AM</Text>
      </View>
    </Float>
    <Float float={float} range={12} style={[s.floatCard, s.posBottomRight]}>
      <View style={[s.miniIcon, { backgroundColor: '#DCFCE7' }]}><Icon name="check-decagram" size={15} color="#16A34A" /></View>
      <Text style={s.miniTitle}>{t('Verified')}</Text>
    </Float>
  </Orb>
);

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S'];
const CalendarArt = ({ float, t }) => (
  <Orb>
    <Float float={float} range={6} style={s.panel}>
      <View style={s.panelHead}>
        <Icon name="calendar-month" size={16} color={CLINICIAN.gradientFrom} />
        <Text style={s.panelTitle}>{t('This week')}</Text>
      </View>
      <View style={s.weekRow}>
        {WEEK.map((d, i) => (
          <View key={`${d}${i}`} style={[s.dayCell, i === 2 && s.dayCellActive]}>
            {i === 2 && <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fill} />}
            <Text style={[s.dayLetter, i === 2 && s.onGrad]}>{d}</Text>
            <Text style={[s.dayNum, i === 2 && s.onGrad]}>{12 + i}</Text>
          </View>
        ))}
      </View>
      <View style={s.slotRow}>
        {['09:00', '09:15', '09:30'].map((slot, i) => (
          <View key={slot} style={[s.slotChip, i === 1 && s.slotChipActive]}>
            <Text style={[s.slotText, i === 1 && s.slotTextActive]}>{slot}</Text>
          </View>
        ))}
      </View>
    </Float>
    <Float float={float} range={12} style={[s.floatCard, s.posBottomLeft]}>
      <View style={[s.miniIcon, { backgroundColor: '#CCFBF1' }]}><Icon name="clock-outline" size={15} color={CLINICIAN.gradientFrom} /></View>
      <Text style={s.miniTitle}>9 AM – 1 PM</Text>
    </Float>
  </Orb>
);

const QueueArt = ({ float, t }) => (
  <Orb>
    <Float float={float} range={6} style={s.tokenCard}>
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fill} />
      <Text style={s.tokenLabel}>{t('NOW SERVING')}</Text>
      <Text style={s.tokenNumber}>#07</Text>
      <View style={s.tokenTrack}><View style={s.tokenTrackFill} /></View>
      <Text style={s.tokenMeta}>{t('3 patients waiting')}</Text>
    </Float>
    <Float float={float} range={12} style={[s.floatCard, s.posTopRight]}>
      <View style={[s.miniIcon, { backgroundColor: '#FEE2E2' }]}><Icon name="ambulance" size={15} color="#DC2626" /></View>
      <Text style={s.miniTitle}>{t('Emergency first')}</Text>
    </Float>
    <Float float={float} range={9} style={[s.floatCard, s.posBottomLeft]}>
      <View style={[s.miniIcon, { backgroundColor: '#CCFBF1' }]}><Icon name="account-clock-outline" size={15} color={CLINICIAN.gradientFrom} /></View>
      <Text style={s.miniTitle}>{t('Walk-in #08')}</Text>
    </Float>
  </Orb>
);

const RecordsArt = ({ float, t }) => (
  <Orb>
    <Float float={float} range={6} style={s.panel}>
      <View style={s.panelHead}>
        <Icon name="prescription" size={18} color={CLINICIAN.gradientFrom} />
        <Text style={s.panelTitle}>{t('Prescription')}</Text>
        <View style={s.pdfBadge}><Text style={s.pdfBadgeText}>PDF</Text></View>
      </View>
      {[0.92, 0.7, 0.8].map((w, i) => (
        <View key={i} style={s.rxLine}>
          <View style={s.rxDot} />
          <View style={[s.rxBar, { width: `${w * 100}%` }]} />
        </View>
      ))}
      <View style={s.signRow}>
        <Icon name="draw-pen" size={14} color="#94A3B8" />
        <View style={s.signLine} />
      </View>
    </Float>
    <Float float={float} range={12} style={[s.floatCard, s.posBottomRight]}>
      <View style={[s.miniIcon, { backgroundColor: '#EDE9FE' }]}><Icon name="calendar-refresh" size={15} color="#7C3AED" /></View>
      <View>
        <Text style={s.miniTitle}>{t('Follow-up')}</Text>
        <Text style={s.miniSub}>{t('in 7 days')}</Text>
      </View>
    </Float>
  </Orb>
);

const ART = { welcome: WelcomeArt, calendar: CalendarArt, queue: QueueArt, records: RecordsArt };

// ---------------------------------------------------------------------------
// One slide: parallax on the illustration and text, driven by scrollX.
// ---------------------------------------------------------------------------
const Slide = ({ slide, index, scrollX, float, t }) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const artStyle = {
    opacity: scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
    transform: [
      { translateX: scrollX.interpolate({ inputRange, outputRange: [width * 0.4, 0, -width * 0.4], extrapolate: 'clamp' }) },
      { scale: scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' }) },
    ],
  };
  const textStyle = (depth) => ({
    opacity: scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
    transform: [{ translateX: scrollX.interpolate({ inputRange, outputRange: [width * depth, 0, -width * depth], extrapolate: 'clamp' }) }],
  });
  const Art = ART[slide.key];

  return (
    <View style={s.slide}>
      <Animated.View style={[s.artArea, artStyle]}>
        <Art float={float} t={t} />
      </Animated.View>

      <View style={s.textArea}>
        <Animated.View style={[s.tag, textStyle(0.15)]}>
          <Text style={s.tagText}>{t(slide.tag)}</Text>
        </Animated.View>
        <Animated.Text style={[s.title, textStyle(0.25)]}>{t(slide.title)}</Animated.Text>
        <Animated.Text style={[s.body, textStyle(0.35)]}>{t(slide.body)}</Animated.Text>
        <Animated.View style={[s.pointRow, textStyle(0.45)]}>
          {slide.points.map((p) => (
            <View key={p.label} style={s.point}>
              <Icon name={p.icon} size={15} color={CLINICIAN.primary} />
              <Text style={s.pointText}>{t(p.label)}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

// Pill-shaped active dot that stretches between pages as you swipe.
const Dot = ({ index, scrollX }) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  return (
    <Animated.View
      style={[
        s.dot,
        {
          opacity: scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }),
          transform: [{ scaleX: scrollX.interpolate({ inputRange, outputRange: [1, 3, 1], extrapolate: 'clamp' }) }],
        },
      ]}
    />
  );
};

const DoctorOnboarding = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const isLast = page === SLIDES.length - 1;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float, intro]);

  const finishOnboarding = useCallback(() => {
    const destination = route?.params?.destination || 'DoctorDashboard';
    const destinationParams = route?.params?.destinationParams || {};
    const profile = route?.params?.doctorProfileBase || {};
    AsyncStorage.setItem('doctorMockProfile', JSON.stringify(profile)).catch(() => {});
    enterAuthenticatedRoute(navigation, destination, { ...destinationParams, doctorProfile: profile });
  }, [navigation, route?.params]);

  const goNext = useCallback(() => {
    if (isLast) {
      finishOnboarding();
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  }, [finishOnboarding, isLast, page]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e) => {
        const next = Math.round(e.nativeEvent.contentOffset.x / width);
        setPage((prev) => (prev === next ? prev : next));
      },
    },
  );

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={CLINICIAN.backgroundTint} />

      {/* soft background blobs */}
      <View style={[s.bgBlob, s.bgBlobTop]} />
      <View style={[s.bgBlob, s.bgBlobBottom]} />

      <View style={s.header}>
        <View style={s.brand}>
          <LinearGradient colors={GRADIENT} style={s.brandMark}><Icon name="stethoscope" size={14} color="#FFF" /></LinearGradient>
          <Text style={s.brandText}>Humaeli <Text style={s.brandSub}>{t('for Doctors')}</Text></Text>
        </View>
        {!isLast ? (
          <TouchableOpacity onPress={finishOnboarding} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.skipText}>{t('Skip')}</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={[s.pager, { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
      >
        {SLIDES.map((slide, index) => (
          <Slide key={slide.key} slide={slide} index={index} scrollX={scrollX} float={float} t={t} />
        ))}
      </Animated.ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((slide, index) => <Dot key={slide.key} index={index} scrollX={scrollX} />)}
        </View>
        <TouchableOpacity activeOpacity={0.88} onPress={goNext} style={s.ctaWrap}>
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Text style={s.ctaText}>{isLast ? t('Go to Dashboard') : t('Next')}</Text>
            <View style={s.ctaIcon}>
              <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={17} color={CLINICIAN.gradientFrom} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const CARD_SHADOW = { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 };

const s = createDoctorStyles({
  container: { flex: 1, backgroundColor: CLINICIAN.backgroundTint },
  bgBlob: { position: 'absolute', borderRadius: 999, backgroundColor: '#CCFBF1' },
  bgBlobTop: { width: 260, height: 260, top: -120, right: -90, opacity: 0.55 },
  bgBlobBottom: { width: 220, height: 220, bottom: 60, left: -120, opacity: 0.35 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  brandSub: { fontSize: 13, fontWeight: '600', color: CLINICIAN.primary },
  skipText: { fontSize: 14, fontWeight: '700', color: '#64748B' },

  pager: { flex: 1 },
  slide: { width, flex: 1, paddingHorizontal: 24 },
  artArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textArea: { paddingBottom: 8, alignItems: 'center' },

  orbWrap: { width: HERO_SIZE, height: HERO_SIZE, alignItems: 'center', justifyContent: 'center' },
  orbHalo: { position: 'absolute', width: HERO_SIZE, height: HERO_SIZE, borderRadius: HERO_SIZE / 2, backgroundColor: 'rgba(45,212,191,0.16)' },
  orb: { width: HERO_SIZE * 0.78, height: HERO_SIZE * 0.78, borderRadius: HERO_SIZE, alignItems: 'center', justifyContent: 'center', shadowColor: CLINICIAN.gradientFrom, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  orbShine: { position: 'absolute', top: '10%', left: '14%', width: '34%', height: '20%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ rotate: '-30deg' }] },
  bigIconRing: { width: 116, height: 116, borderRadius: 58, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },

  floatCard: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, ...CARD_SHADOW },
  posTopLeft: { top: HERO_SIZE * 0.06, left: -HERO_SIZE * 0.06 },
  posTopRight: { top: HERO_SIZE * 0.04, right: -HERO_SIZE * 0.08 },
  posBottomLeft: { bottom: HERO_SIZE * 0.06, left: -HERO_SIZE * 0.08 },
  posBottomRight: { bottom: HERO_SIZE * 0.08, right: -HERO_SIZE * 0.06 },
  miniIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  miniSub: { fontSize: 10.5, fontWeight: '600', color: '#64748B', marginTop: 1 },

  panel: { width: HERO_SIZE * 0.86, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, ...CARD_SHADOW },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  panelTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { width: '14.5%', paddingVertical: 7, borderRadius: 10, alignItems: 'center', backgroundColor: '#F0FDFA', overflow: 'hidden' },
  dayCellActive: { backgroundColor: 'transparent' },
  dayLetter: { fontSize: 9.5, fontWeight: '700', color: '#64748B' },
  dayNum: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  onGrad: { color: '#FFFFFF' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  slotRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  slotChip: { flex: 1, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: '#99F6E4', alignItems: 'center' },
  slotChipActive: { backgroundColor: CLINICIAN.primary, borderColor: CLINICIAN.primary },
  slotText: { fontSize: 11, fontWeight: '800', color: CLINICIAN.gradientFrom },
  slotTextActive: { color: '#FFFFFF' },

  tokenCard: { width: HERO_SIZE * 0.62, borderRadius: 20, padding: 16, overflow: 'hidden', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', ...CARD_SHADOW },
  tokenLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.9)' },
  tokenNumber: { fontSize: 44, fontWeight: '900', color: '#FFFFFF', marginVertical: 2 },
  tokenTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 4 },
  tokenTrackFill: { width: '62%', height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  tokenMeta: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.92)', marginTop: 8 },

  pdfBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FEE2E2' },
  pdfBadgeText: { fontSize: 9.5, fontWeight: '900', color: '#DC2626' },
  rxLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  rxDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CLINICIAN.gradientTo },
  rxBar: { height: 7, borderRadius: 4, backgroundColor: '#E2E8F0' },
  signRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-end', width: '55%' },
  signLine: { flex: 1, height: 1.5, backgroundColor: '#CBD5E1' },

  tag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#99F6E4' },
  tagText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1, color: CLINICIAN.primary },
  title: { fontSize: 25, lineHeight: 32, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginTop: 14 },
  body: { fontSize: 14.5, lineHeight: 22, color: '#475569', textAlign: 'center', marginTop: 10, paddingHorizontal: 4 },
  pointRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCFBF1' },
  pointText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },

  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CLINICIAN.primary },
  ctaWrap: { borderRadius: 16, ...CARD_SHADOW, shadowColor: CLINICIAN.gradientFrom, shadowOpacity: 0.3 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 16, paddingVertical: 15 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  ctaIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});

export default DoctorOnboarding;
