import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { DOCTOR } from '../../theme/palette';
import useLanguageRender from '../../hooks/useLanguageRender';

const { width } = Dimensions.get('window');

// The supplied artwork is taller than a fixed 200px band would allow, so the
// card takes its shape FROM the image (via the asset's real dimensions) instead
// of letterboxing it inside tinted bars.
const OnboardingHero = ({ source }) => {
  const meta = Image.resolveAssetSource(source);
  const ratio = meta && meta.height ? meta.width / meta.height : 1.4;
  return (
    <View style={[s.illustration, { aspectRatio: ratio }]}>
      <Image source={source} style={s.illustrationImage} resizeMode="contain" />
    </View>
  );
};

const OnboardingPage1 = () => {
  const { t } = useLanguageRender();
  return (
  <View style={s.page}>
    <OnboardingHero source={require('../../public/consleor1.png')} />
    <Text style={s.title}>{t('Grow Your Practice Digitally')}</Text>
    <Text style={s.description}>
      Reach more patients through secure online and offline consultations.
    </Text>
    <TouchableOpacity style={s.featureBtn}>
      <Ionicons name="shield-checkmark" size={16} color={DOCTOR.primary} />
      <Text style={s.featureBtnText}>{t('Secure Sessions')}</Text>
    </TouchableOpacity>
  </View>
);
};

const OnboardingPage2 = () => {
  const { t } = useLanguageRender();
  return (
  <View style={s.page}>
    <OnboardingHero source={require('../../public/consleor2.png')} />
    <Text style={s.title}>{t('Manage Appointments Effortlessly')}</Text>
    <Text style={s.description}>
      Accept bookings, reschedule appointments, and manage your daily calendar in one place.
    </Text>
  </View>
);
};

const OnboardingPage3 = () => {
  const { t } = useLanguageRender();
  return (
  <View style={s.page}>
    <OnboardingHero source={require('../../public/consleor3.png')} />
    <Text style={s.title}>{t('Consult. Connect. Earn.')}</Text>
    <Text style={s.description}>
      Offer video consultations, in-person visits, and build lasting relationships with patients.
    </Text>
  </View>
);
};

const OnboardingPage4 = () => {
  const { t } = useLanguageRender();
  return (
  <View style={s.page}>
    <OnboardingHero source={require('../../public/consleor4.png')} />
    <Text style={s.title}>{t("You're Ready to Start")}</Text>
    <Text style={s.description}>
      Complete your profile and let Humaeli help manage your practice.
    </Text>

    <View style={s.featuresList}>
      <TouchableOpacity style={s.featureSmallBtn}>
        <MaterialIcons name="schedule" size={16} color={DOCTOR.primary} />
        <Text style={s.featureSmallBtnText}>{t('Smart Scheduling')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.featureSmallBtn}>
        <Ionicons name="mail-outline" size={16} color={DOCTOR.primary} />
        <Text style={s.featureSmallBtnText}>{t('Secure Messaging')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.featureSmallBtn}>
        <Ionicons name="folder-outline" size={16} color={DOCTOR.primary} />
        <Text style={s.featureSmallBtnText}>{t('Patient Records')}</Text>
      </TouchableOpacity>
    </View>
  </View>
);
};

const CounselorOnboarding = ({ navigation, previewMode = false, onPreviewComplete }) => {
  const { t } = useLanguageRender();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef(null);

  const pages = [
    <OnboardingPage1 key="1" />,
    <OnboardingPage2 key="2" />,
    <OnboardingPage3 key="3" />,
    <OnboardingPage4 key="4" />,
  ];

  const finishOnboarding = () => {
    if (previewMode && onPreviewComplete) {
      onPreviewComplete();
      return;
    }
    navigation.replace('CounselorDashboard');
  };

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      scrollViewRef.current?.scrollTo({ x: (currentPage + 1) * width, animated: true });
    } else {
      finishOnboarding();
    }
  };

  useEffect(() => {
    if (!previewMode) return undefined;

    const delay = currentPage < pages.length - 1 ? 1300 : 1600;
    const timer = setTimeout(() => {
      goToNextPage();
    }, delay);

    return () => clearTimeout(timer);
  }, [currentPage, previewMode]);

  const onScroll = (event) => {
    const pageNumber = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(pageNumber);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={DOCTOR.backgroundTint} />

      {/* Header */}
      <View style={s.header}>
        <View style={{ width: 24 }} />
        <TouchableOpacity onPress={finishOnboarding}>
          <Text style={s.skipText}>{t('Skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={onScroll}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        style={s.pagesScroll}
      >
        {pages}
      </ScrollView>

      {/* Dots */}
      <View style={s.dotsContainer}>
        {pages.map((_, idx) => (
          <View
            key={idx}
            style={[
              s.dot,
              {
                backgroundColor: idx === currentPage ? DOCTOR.primary : '#cbd5e1',
                width: idx === currentPage ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={s.buttonsContainer}>
        {currentPage === pages.length - 1 ? (
          <>
            <TouchableOpacity activeOpacity={0.85} onPress={goToNextPage} style={s.buttonWrapper}>
              <LinearGradient
                colors={[DOCTOR.gradientFrom, DOCTOR.gradientTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.nextBtn}
              >
                <Text style={s.nextBtnText}>{t('Complete Profile')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.replace('CounselorDashboard')}>
              <Text style={s.maybeLaterText}>{t('Maybe Later')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity activeOpacity={0.85} onPress={goToNextPage} style={s.buttonWrapper}>
            <LinearGradient
              colors={[DOCTOR.gradientFrom, DOCTOR.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.nextBtn}
            >
              <Text style={s.nextBtnText}>{t('Next')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DOCTOR.backgroundTint },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },

  pagesScroll: { flex: 1 },
  page: { width, paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center', gap: 20 },

  illustrationImage: { width: '100%', height: '100%' },
  illustration: { width: '100%', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E7EEFE', borderRadius: 20, marginBottom: 20 },

  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  description: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21 },

  featureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: '#E7EEFE', borderRadius: 10 },
  featureBtnText: { fontSize: 13, fontWeight: '600', color: DOCTOR.primary },

  scheduleIllustration: { height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  scheduleCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 20, width: '80%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  scheduleTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  scheduleTime: { fontSize: 12, color: '#64748b', marginTop: 6 },

  earningsIllustration: { height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' },
  earningsDisplay: { flexDirection: 'row', gap: 16 },
  priceBox: { alignItems: 'center', gap: 4 },
  currencySymbol: { fontSize: 16, fontWeight: '700', color: DOCTOR.primary },
  priceValue: { fontSize: 22, fontWeight: '800', color: DOCTOR.primary },
  serviceIcons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  serviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E7EEFE', alignItems: 'center', justifyContent: 'center' },

  readyIllustration: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E7EEFE', borderRadius: 20, marginBottom: 20 },

  featuresList: { gap: 10, marginBottom: 20 },
  featureSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#E7EEFE' },
  featureSmallBtnText: { fontSize: 12, fontWeight: '600', color: DOCTOR.primary },

  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { height: 8, borderRadius: 4 },

  buttonsContainer: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  buttonWrapper: { width: '100%' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 14 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  maybeLaterText: { fontSize: 14, fontWeight: '600', color: DOCTOR.primary, textAlign: 'center', paddingVertical: 10 },
});

export default CounselorOnboarding;
