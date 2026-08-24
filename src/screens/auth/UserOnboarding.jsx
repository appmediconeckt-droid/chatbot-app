import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import Text from '../../components/TranslatedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import PATIENT from '../../theme/palette';
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
    <OnboardingHero source={require('../../public/user1.png')} />
    <Text style={s.title}>{t('Your Safe Space to Talk')}</Text>
    <Text style={s.description}>
      Connect with trusted consultants in a private, secure environment designed to support your mental well-being.
    </Text>
  </View>
);
};

const OnboardingPage2 = () => {
  const { t } = useLanguageRender();
  return (
    <View style={s.page}>
      <OnboardingHero source={require('../../public/user2.png')} />
      <Text style={s.title}>{t('Find the Right Consultant')}</Text>
      <Text style={s.description}>
        Browse experienced consultants based on specialty, language, availability, consultation type, and reviews.
      </Text>
    </View>
);
};

const OnboardingPage3 = () => {
  const { t } = useLanguageRender();
  return (
  <View style={s.page}>
    <View style={s.aiIconContainer}>
      <View style={s.aiIcon}>
        <Ionicons name="chatbubble" size={60} color={PATIENT.primary} />
      </View>
      <Ionicons name="heart" size={24} color={PATIENT.primary} style={s.heartIcon} />
    </View>
    <Text style={s.title}>{t('Your AI Wellness Companion')}</Text>
    <Text style={s.description}>
      Get instant emotional support, wellness tips, and guidance anytime before connecting with a consultant.
    </Text>

    <View style={s.aiChatBox}>
      <View style={s.aiBubble}>
        <Text style={s.aiMessage}>{t('Hello 👋 How are you feeling today?')}</Text>
      </View>
      <View style={s.responseButtons}>
        {['😊 Happy', '😐 Okay', '😟 Stressed'].map((btn, idx) => (
          <TouchableOpacity key={idx} style={s.responseBtn}>
            <Text style={s.responseBtnText}>{btn}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
);
};

const OnboardingPage4 = () => {
  const { t } = useLanguageRender();
  return (
  <View style={s.page}>
    <View style={s.featuresCircle}>
      <View style={s.centerHeart}>
        <Ionicons name="heart" size={48} color={PATIENT.primary} />
      </View>
      <View style={[s.featureIcon, s.featureTop]}>
        <MaterialIcons name="event" size={24} color={PATIENT.primary} />
      </View>
      <View style={[s.featureIcon, s.featureLeft]}>
        <Ionicons name="chatbubbles" size={24} color={PATIENT.primary} />
      </View>
      <View style={[s.featureIcon, s.featureRight]}>
        <Ionicons name="shield-checkmark" size={24} color={PATIENT.primary} />
      </View>
      <View style={[s.featureIcon, s.featureBottom]}>
        <Ionicons name="videocam" size={24} color={PATIENT.primary} />
      </View>
    </View>

    <Text style={s.title}>{t('Book, Chat & Heal')}</Text>
    <Text style={s.description}>
      Schedule appointments, join secure video sessions, chat with consultants, and track your wellness journey—all in one place.
    </Text>

    <View style={s.featuresList}>
      <View style={s.featureRow}>
        <TouchableOpacity style={s.featureBtn}>
          <MaterialIcons name="event" size={20} color={PATIENT.primary} />
          <Text style={s.featureBtnText}>{t('Book Sessions')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.featureBtn}>
          <Ionicons name="videocam" size={20} color={PATIENT.primary} />
          <Text style={s.featureBtnText}>{t('Video Calls')}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.featureRow}>
        <TouchableOpacity style={s.featureBtn}>
          <Ionicons name="chatbubble" size={20} color={PATIENT.primary} />
          <Text style={s.featureBtnText}>{t('Secure Chat')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.featureBtn}>
          <Ionicons name="shield-checkmark" size={20} color={PATIENT.primary} />
          <Text style={s.featureBtnText}>{t('End-to-End')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);
};

const UserOnboarding = ({ navigation, route, previewMode = false, onPreviewComplete }) => {
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
    navigation.replace(
      route?.params?.destination || 'UserDashboard',
      route?.params?.destinationParams,
    );
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
      <StatusBar barStyle="dark-content" backgroundColor={PATIENT.backgroundTint} />

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
                backgroundColor: idx === currentPage ? PATIENT.primary : '#cbd5e1',
                width: idx === currentPage ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity activeOpacity={0.85} onPress={goToNextPage} style={s.buttonWrapper}>
        <LinearGradient
          colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.nextBtn}
        >
          <Text style={s.nextBtnText}>{currentPage === pages.length - 1 ? t('Get Started') : t('Next')}</Text>
          {currentPage < pages.length - 1 && <Ionicons name="arrow-forward" size={20} color="#ffffff" />}
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },

  pagesScroll: { flex: 1 },
  page: { width, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, justifyContent: 'center', gap: 18 },

  illustrationImage: { width: '100%', height: '100%' },
  illustration: { width: '100%', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E6F6EC', borderRadius: 24, marginBottom: 8 },

  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginTop: 2 },
  description: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },

  aiIconContainer: { height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' },
  aiIcon: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center' },
  heartIcon: { position: 'absolute', left: 20, top: 120 },

  aiChatBox: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E6F6EC', marginBottom: 20 },
  aiBubble: { backgroundColor: '#E6F6EC', borderRadius: 12, padding: 12, marginBottom: 14 },
  aiMessage: { fontSize: 13, color: '#0f172a', fontWeight: '500' },
  responseButtons: { flexDirection: 'row', gap: 8 },
  responseBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: PATIENT.backgroundTint, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  responseBtnText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },

  featuresCircle: { height: 240, justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' },
  centerHeart: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center' },
  featureIcon: { position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: '#F9F9FF', borderWidth: 1, borderColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center' },
  featureTop: { top: 0 },
  featureLeft: { left: 0, top: 95 },
  featureRight: { right: 0, top: 95 },
  featureBottom: { bottom: 0 },

  featuresList: { gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: 'row', gap: 10 },
  featureBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#E6F6EC' },
  featureBtnText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },

  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  dot: { height: 8, borderRadius: 4 },

  buttonWrapper: { paddingHorizontal: 20, marginBottom: 20 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 14 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});

export default UserOnboarding;
