// DoctorOnboarding — runs AFTER DoctorSignup (account creation), same as
// UserOnboarding/CounselorOnboarding now run after their signups. 3 pages:
// a marketing Welcome, then Qualifications and Practice/Availability forms
// that collect the credentialing details DoctorSignup didn't already ask for
// (name/specialization/experience/qualification/city all come from the
// account-level signup — this wizard only adds registration number,
// institution, certifications, clinic, consultation type and availability).
//
// Same swipeable-carousel pattern as UserOnboarding.jsx/CounselorOnboarding.jsx:
// a single horizontal, paging ScrollView (real native swipe), dots at the
// bottom just above the CTA button, header carries only "Skip".
//
// The base profile created at signup arrives via `route.params.doctorProfileBase`
// — since DoctorSignup.jsx now does a real POST /api/auth/complete-registration,
// this is the real backend user object, not mock data. On completion it's
// merged with this wizard's draft into one profile object, written to
// `doctorMockProfile` (still just a local display cache — see DoctorSignup.jsx
// for why that key name stuck around), and handed to DoctorDashboard. This
// wizard's OWN fields (registration number, institution, clinic, availability)
// are still local-only: there is no backend endpoint for doctor credentialing
// yet, so nothing on this screen itself is sent over the network.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Animated, Easing, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextInput from '../../components/TranslatedTextInput';
import Text from '../../components/TranslatedText';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { CLINICIAN } from '../../theme/palette';
import AuthBackground from '../../theme/AuthBackground';
import useLanguageRender from '../../hooks/useLanguageRender';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';
import { createDoctorStyles } from '../../features/doctor/dashboard/theme';

import { enterAuthenticatedRoute } from '../../utils/authSession';
const { width } = Dimensions.get('window');
const TOTAL_PAGES = 3;

const CONSULTATION_TYPES = ['Online', 'In-person', 'Both'];

const AVAILABILITY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AVAILABILITY_SLOTS = ['Morning', 'Afternoon', 'Evening'];

const emptyDraft = {
  registrationNumber: '',
  institution: '',
  certifications: '',
  certificateFileName: '',
  clinicName: '',
  consultationType: '',
  availabilityDays: [],
  availabilitySlots: [],
};

const FieldLabel = ({ children }) => <Text style={s.fieldLabel}>{children}</Text>;

// Dedicated component (not an inline render function) so its entrance/loop
// animations are proper hooks owned by a mounted instance.
const WelcomeStep = ({ t }) => {
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.88)).current;
  const heroSlide = useRef(new Animated.Value(22)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;
  const badgeSlide = useRef(new Animated.Value(14)).current;
  const chip1Fade = useRef(new Animated.Value(0)).current;
  const chip2Fade = useRef(new Animated.Value(0)).current;
  const chip1Slide = useRef(new Animated.Value(12)).current;
  const chip2Slide = useRef(new Animated.Value(12)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const sparkleSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(badgeFade, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.spring(badgeSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(420),
        Animated.stagger(120, [
          Animated.parallel([
            Animated.timing(chip1Fade, { toValue: 1, duration: 340, useNativeDriver: true }),
            Animated.spring(chip1Slide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(chip2Fade, { toValue: 1, duration: 340, useNativeDriver: true }),
            Animated.spring(chip2Slide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
          ]),
        ]),
      ]),
    ]).start();

    // Gentle float on the stethoscope icon — loops forever while this step is mounted.
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, { toValue: -10, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(iconFloat, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    floatLoop.start();

    // Soft pulsing glow ring behind the hero card.
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    // Slow-spinning sparkle accent on the hero card corner.
    const spinLoop = Animated.loop(
      Animated.timing(sparkleSpin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }),
    );
    spinLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, []);

  const glowScale = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const sparkleRotate = sparkleSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <AuthBackground role="doctor" style={s.welcomeBg}>
      <View style={s.welcomeWrap}>
        <Animated.View style={{ opacity: heroFade, transform: [{ scale: heroScale }, { translateY: heroSlide }] }}>
          <View style={s.heroStack}>
            <Animated.View style={[s.glowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
            <LinearGradient
              colors={[CLINICIAN.gradientFrom, CLINICIAN.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.heroCard}
            >
              <Animated.View style={[s.sparkleDot, { transform: [{ rotate: sparkleRotate }] }]}>
                <Icon name="star-four-points" size={16} color="rgba(255,255,255,0.85)" />
              </Animated.View>
              <Animated.View style={{ transform: [{ translateY: iconFloat }] }}>
                <View style={s.heroIconRing}>
                  <Icon name="stethoscope" size={54} color="#ffffff" />
                </View>
              </Animated.View>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroSlide }] }}>
          <Text style={s.welcomeTitle}>{t('Your Expertise Can Make a Difference')}</Text>
          <Text style={s.welcomeSub}>
            {t('Join Humaeli and connect with people seeking trusted professional care.')}
          </Text>
        </Animated.View>

        <Animated.View style={[s.trustBadge, { opacity: badgeFade, transform: [{ translateY: badgeSlide }] }]}>
          <Icon name="shield-star-outline" size={13} color={CLINICIAN.primary} />
          <Text style={s.trustBadgeText}>{t('VERIFIED HEALTHCARE PROFESSIONALS')}</Text>
        </Animated.View>

        <View style={s.welcomeFeatureRow}>
          <Animated.View style={[s.welcomeFeaturePill, { opacity: chip1Fade, transform: [{ translateY: chip1Slide }] }]}>
            <Icon name="shield-check-outline" size={16} color={CLINICIAN.primary} />
            <Text style={s.welcomeFeatureText}>{t('Verified Profile')}</Text>
          </Animated.View>
          <Animated.View style={[s.welcomeFeaturePill, { opacity: chip2Fade, transform: [{ translateY: chip2Slide }] }]}>
            <Icon name="calendar-check-outline" size={16} color={CLINICIAN.primary} />
            <Text style={s.welcomeFeatureText}>{t('Flexible Scheduling')}</Text>
          </Animated.View>
        </View>
      </View>
    </AuthBackground>
  );
};

// Each form page owns its own keyboard-aware vertical ScrollView — all pages
// are mounted at once inside the outer horizontal pager (same as
// Counselor/User), so each needs an independent scroll/keyboard hook instance
// rather than one shared ref.
const QualificationsPage = ({ t, draft, errors, update, onUpload }) => {
  const { scrollRef, keyboardInset, scrollFocusedInputIntoView, handleKeyboardAwareScroll, handleKeyboardAwareScrollLayout } = useKeyboardAwareScroll();
  return (
    <ScrollView
      ref={scrollRef}
      style={s.formScroll}
      contentContainerStyle={[s.formScrollContent, { paddingBottom: 24 + keyboardInset }]}
      showsVerticalScrollIndicator={false}
      onLayout={handleKeyboardAwareScrollLayout}
      onScroll={handleKeyboardAwareScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.formStep}>
        <Text style={s.stepTitle}>{t('Complete Your Doctor Details')}</Text>

        <FieldLabel>{t('Medical Registration Number')}</FieldLabel>
        <View style={[s.inputWrapper, errors.registrationNumber && s.inputWrapperError]}>
          <Icon name="card-account-details-outline" size={20} color="#64748b" style={s.inputIcon} />
          <TextInput
            style={s.textInput}
            value={draft.registrationNumber}
            onChangeText={(v) => update('registrationNumber', v)}
            onFocus={scrollFocusedInputIntoView}
            placeholder={t('Registration / license number')}
            placeholderTextColor="#94a3b8"
          />
        </View>
        {errors.registrationNumber ? <Text style={s.errorText}>{errors.registrationNumber}</Text> : null}

        <FieldLabel>{t('University / Institution')}</FieldLabel>
        <View style={[s.inputWrapper, errors.institution && s.inputWrapperError]}>
          <Icon name="bank-outline" size={20} color="#64748b" style={s.inputIcon} />
          <TextInput
            style={s.textInput}
            value={draft.institution}
            onChangeText={(v) => update('institution', v)}
            onFocus={scrollFocusedInputIntoView}
            placeholder={t('Where you studied')}
            placeholderTextColor="#94a3b8"
          />
        </View>
        {errors.institution ? <Text style={s.errorText}>{errors.institution}</Text> : null}

        <FieldLabel>{t('Additional Certifications')} ({t('optional')})</FieldLabel>
        <View style={s.inputWrapper}>
          <Icon name="certificate" size={20} color="#64748b" style={s.inputIcon} />
          <TextInput
            style={s.textInput}
            value={draft.certifications}
            onChangeText={(v) => update('certifications', v)}
            onFocus={scrollFocusedInputIntoView}
            placeholder={t('e.g. Fellowship in Cardiology')}
            placeholderTextColor="#94a3b8"
          />
        </View>

        <FieldLabel>{t('Credentials')}</FieldLabel>
        <TouchableOpacity style={s.uploadCard} activeOpacity={0.85} onPress={onUpload}>
          <View style={s.uploadIconWrap}>
            <Icon
              name={draft.certificateFileName ? 'file-check-outline' : 'cloud-upload-outline'}
              size={26}
              color={CLINICIAN.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadTitle}>
              {draft.certificateFileName ? draft.certificateFileName : t('Upload your professional credentials')}
            </Text>
            <Text style={s.uploadSub}>
              {draft.certificateFileName ? t('Tap to replace') : t('PDF, JPG or PNG')}
            </Text>
          </View>
          <Text style={s.uploadCta}>{t('+ Upload Certificate')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const PracticePage = ({ t, draft, errors, update, toggleListValue }) => {
  const { scrollRef, keyboardInset, scrollFocusedInputIntoView, handleKeyboardAwareScroll, handleKeyboardAwareScrollLayout } = useKeyboardAwareScroll();
  return (
    <ScrollView
      ref={scrollRef}
      style={s.formScroll}
      contentContainerStyle={[s.formScrollContent, { paddingBottom: 24 + keyboardInset }]}
      showsVerticalScrollIndicator={false}
      onLayout={handleKeyboardAwareScrollLayout}
      onScroll={handleKeyboardAwareScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.formStep}>
        <Text style={s.stepTitle}>{t('Set Up Your Practice')}</Text>

        <FieldLabel>{t('Hospital / Clinic Name')}</FieldLabel>
        <View style={[s.inputWrapper, errors.clinicName && s.inputWrapperError]}>
          <Icon name="hospital-building" size={20} color="#64748b" style={s.inputIcon} />
          <TextInput
            style={s.textInput}
            value={draft.clinicName}
            onChangeText={(v) => update('clinicName', v)}
            onFocus={scrollFocusedInputIntoView}
            placeholder={t('e.g. Sunrise Medical Center')}
            placeholderTextColor="#94a3b8"
          />
        </View>
        {errors.clinicName ? <Text style={s.errorText}>{errors.clinicName}</Text> : null}

        <FieldLabel>{t('Consultation Type')}</FieldLabel>
        <View style={s.chipRow}>
          {CONSULTATION_TYPES.map((option) => (
            <TouchableOpacity
              key={option}
              style={[s.chip, draft.consultationType === option && s.chipSelected]}
              onPress={() => update('consultationType', option)}
            >
              <Text style={[s.chipText, draft.consultationType === option && s.chipTextSelected]}>{t(option)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.consultationType ? <Text style={s.errorText}>{errors.consultationType}</Text> : null}

        <FieldLabel>{t('Availability')} ({t('optional')})</FieldLabel>
        <Text style={s.sectionHint}>{t('Days')}</Text>
        <View style={s.chipRow}>
          {AVAILABILITY_DAYS.map((day) => (
            <TouchableOpacity
              key={day}
              style={[s.dayChip, draft.availabilityDays.includes(day) && s.chipSelected]}
              onPress={() => toggleListValue('availabilityDays', day)}
            >
              <Text style={[s.chipText, draft.availabilityDays.includes(day) && s.chipTextSelected]}>{t(day)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.sectionHint}>{t('Time Slots')}</Text>
        <View style={s.chipRow}>
          {AVAILABILITY_SLOTS.map((slot) => (
            <TouchableOpacity
              key={slot}
              style={[s.chip, draft.availabilitySlots.includes(slot) && s.chipSelected]}
              onPress={() => toggleListValue('availabilitySlots', slot)}
            >
              <Text style={[s.chipText, draft.availabilitySlots.includes(slot) && s.chipTextSelected]}>{t(slot)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const DoctorOnboarding = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const [currentPage, setCurrentPage] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const scrollViewRef = useRef(null);
  // The account-level profile DoctorSignup already created. Read once — this
  // wizard only adds credentialing/practice fields on top of it.
  const baseProfileRef = useRef(route?.params?.doctorProfileBase || {});

  const update = useCallback((name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  const toggleListValue = useCallback((name, value) => {
    setDraft((prev) => {
      const list = prev[name].includes(value)
        ? prev[name].filter((v) => v !== value)
        : [...prev[name], value];
      return { ...prev, [name]: list };
    });
  }, []);

  const validatePage = useCallback((pageIndex) => {
    const next = {};
    if (pageIndex === 1) {
      if (!draft.registrationNumber.trim()) next.registrationNumber = 'Registration number is required';
      if (!draft.institution.trim()) next.institution = 'University / institution is required';
    } else if (pageIndex === 2) {
      if (!draft.clinicName.trim()) next.clinicName = 'Hospital / clinic name is required';
      if (!draft.consultationType) next.consultationType = 'Select a consultation type';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [draft]);

  const finishOnboarding = useCallback(() => {
    const destination = route?.params?.destination || 'DoctorDashboard';
    const destinationParams = route?.params?.destinationParams || {};
    // Merge the signup-created base profile with what this wizard collected
    // into one complete mock doctor profile, and keep the mock session (used
    // by DoctorDashboard) in sync with it.
    const mergedProfile = { ...baseProfileRef.current, ...draft };
    AsyncStorage.setItem('doctorMockProfile', JSON.stringify(mergedProfile)).catch(() => {});
    enterAuthenticatedRoute(navigation, destination, { ...destinationParams, doctorProfile: mergedProfile });
  }, [draft, navigation, route?.params?.destination, route?.params?.destinationParams]);

  const goToNextPage = useCallback(() => {
    if (currentPage > 0 && !validatePage(currentPage)) return;
    if (currentPage === TOTAL_PAGES - 1) {
      finishOnboarding();
      return;
    }
    const next = currentPage + 1;
    setCurrentPage(next);
    scrollViewRef.current?.scrollTo({ x: next * width, animated: true });
  }, [currentPage, finishOnboarding, validatePage]);

  const onScroll = useCallback((event) => {
    const pageNumber = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage((prev) => (prev === pageNumber ? prev : pageNumber));
  }, []);

  const mockUploadCertificate = useCallback(() => {
    // UI-only placeholder — no document picker / upload wired up yet.
    update('certificateFileName', 'credential-certificate.pdf');
  }, [update]);

  const pages = useMemo(() => [
    <View key="0" style={s.pageWrap}><WelcomeStep t={t} /></View>,
    <View key="1" style={s.pageWrap}>
      <QualificationsPage t={t} draft={draft} errors={errors} update={update} onUpload={mockUploadCertificate} />
    </View>,
    <View key="2" style={s.pageWrap}>
      <PracticePage t={t} draft={draft} errors={errors} update={update} toggleListValue={toggleListValue} />
    </View>,
  ], [draft, errors, mockUploadCertificate, t, toggleListValue, update]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={CLINICIAN.backgroundTint} />

      {/* Header — Skip only, no dots and no back chevron, matching
          UserOnboarding / CounselorOnboarding. */}
      <View style={s.header}>
        <View style={{ width: 24 }} />
        <TouchableOpacity onPress={finishOnboarding} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.skipText}>{t('Skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Pages — real native horizontal swipe, same as User/Consultant. */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={onScroll}
        showsHorizontalScrollIndicator={false}
        style={s.pagesScroll}
      >
        {pages}
      </ScrollView>

      {/* Dots — bottom, just above the CTA button, matching User/Consultant. */}
      <View style={s.dotsContainer}>
        {Array.from({ length: TOTAL_PAGES }).map((_, idx) => (
          <View
            key={idx}
            style={[
              s.dot,
              { backgroundColor: idx === currentPage ? CLINICIAN.primary : '#cbd5e1', width: idx === currentPage ? 24 : 8 },
            ]}
          />
        ))}
      </View>

      <View style={s.buttonsContainer}>
        <TouchableOpacity activeOpacity={0.85} onPress={goToNextPage} style={s.buttonWrapper}>
          <LinearGradient
            colors={[CLINICIAN.gradientFrom, CLINICIAN.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.nextBtn}
          >
            <Text style={s.nextBtnText}>
              {currentPage === 0 ? t('Continue') : currentPage === TOTAL_PAGES - 1 ? t('Complete Profile') : t('Next')}
            </Text>
            {currentPage !== TOTAL_PAGES - 1 && <Ionicons name="arrow-forward" size={20} color="#ffffff" />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const s = createDoctorStyles({
  container: { flex: 1, backgroundColor: CLINICIAN.backgroundTint },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },

  pagesScroll: { flex: 1 },
  pageWrap: { width, flex: 1 },

  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { height: 8, borderRadius: 4 },

  welcomeBg: { flex: 1, borderRadius: 0 },
  welcomeWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, alignItems: 'center', gap: 16 },
  heroStack: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  glowRing: { position: 'absolute', top: 0, left: 0, width: 220, height: 220, borderRadius: 110, backgroundColor: CLINICIAN.primary },
  heroCard: { width: 210, height: 210, borderRadius: 105, alignItems: 'center', justifyContent: 'center', shadowColor: CLINICIAN.primary, shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  sparkleDot: { position: 'absolute', top: 14, right: 22 },
  heroIconRing: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 25, fontWeight: '800', color: '#0f172a', textAlign: 'center', lineHeight: 32, marginTop: 6 },
  welcomeSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, marginTop: 8 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#CCFBF1', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2, marginTop: 4 },
  trustBadgeText: { fontSize: 10, fontWeight: '800', color: CLINICIAN.primary, letterSpacing: 0.4 },
  welcomeFeatureRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  welcomeFeaturePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F0FDFA', borderRadius: 999, borderWidth: 1, borderColor: '#CCFBF1' },
  welcomeFeatureText: { fontSize: 11.5, fontWeight: '700', color: CLINICIAN.primary },

  formScroll: { flex: 1 },
  // Centers short form content vertically (matching the Welcome page's
  // justifyContent:'center'), instead of pinning it to the top with barely
  // any margin. Safe to combine with scrolling/keyboard avoidance here
  // because useKeyboardAwareScroll's scrollFocusedInputIntoView measures the
  // focused field's actual position each time rather than assuming a fixed
  // top-anchored layout, so it still brings the active input above the
  // keyboard correctly regardless of this resting centered position.
  formScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  formStep: { gap: 10 },
  stepTitle: { fontSize: 21, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  fieldLabel: { fontSize: 11.5, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: 6, marginBottom: 2 },
  sectionHint: { fontSize: 11.5, fontWeight: '700', color: '#94a3b8', marginTop: 2 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 14, height: 54, borderWidth: 1.5, borderColor: '#f1f5f9' },
  inputWrapperError: { borderColor: '#fca5a5' },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  placeholderColor: { color: '#94a3b8', fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 4, fontWeight: '600' },

  uploadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#99F6E4', padding: 14, marginTop: 4 },
  uploadIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  uploadSub: { fontSize: 11.5, color: '#94a3b8', marginTop: 2 },
  uploadCta: { fontSize: 11.5, fontWeight: '800', color: CLINICIAN.primary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent' },
  dayChip: { width: 44, paddingVertical: 9, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  chipSelected: { backgroundColor: '#F0FDFA', borderColor: CLINICIAN.primary },
  chipText: { fontSize: 12.5, fontWeight: '700', color: '#64748b' },
  chipTextSelected: { color: CLINICIAN.primary },

  buttonsContainer: { paddingHorizontal: 20, paddingVertical: 16 },
  buttonWrapper: { width: '100%' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, maxHeight: '60%' },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerRowText: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
});

export default DoctorOnboarding;
