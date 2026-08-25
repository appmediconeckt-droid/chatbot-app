import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Text from '../../components/TranslatedText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import HumaeliHeroVideo from '../../components/common/HumaeliHeroVideo';

const VIDEO_BACKGROUND_COLOR = '#04181B';

const Landing = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const isTinyPhone = height < 650 || width < 360;
  const isCompactPhone = height < 760;
  const heroTextWidth = Math.min(width - 44, 360);
  const contentBottomPadding = Math.max(insets.bottom + 18, isTinyPhone ? 20 : 30);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleGetStarted = () => {
    if (navigation?.replace) {
      navigation.replace('RoleSelector');
      return;
    }

    navigation?.navigate?.('RoleSelector');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <HumaeliHeroVideo
        style={StyleSheet.absoluteFill}
        muted
        resizeMode="cover"
        focusX={0.5}
        focusY={0.18}
        zoomScale={0.95}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(4, 24, 27, 0.02)', 'rgba(4, 24, 27, 0.08)', 'rgba(1, 41, 36, 0.82)', VIDEO_BACKGROUND_COLOR]}
        locations={[0, 0.42, 0.66, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 0.34)', 'rgba(0, 0, 0, 0)']}
        locations={[0, 0.45]}
        style={[styles.topShade, { height: Math.max(insets.top + 82, 120) }]}
      />

      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <View
          style={[
            styles.contentShell,
            { paddingBottom: contentBottomPadding },
            isTinyPhone ? styles.contentShellTiny : styles.contentShellRegular,
          ]}
        >
          <Animated.View
            style={[
              styles.content,
              {
                width: heroTextWidth,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.kicker, isTinyPhone ? styles.kickerTiny : styles.kickerRegular]}
            >
              HUMAELI - YOUR MENTAL WELLNESS
            </Text>
            <Text
              maxFontSizeMultiplier={1}
              style={[
                styles.title,
                isTinyPhone
                  ? styles.titleTiny
                  : isCompactPhone
                    ? styles.titleCompact
                    : styles.titleRegular,
              ]}
            >
              Human Empowered{'\n'}Mental Wellness Support
            </Text>
            <View style={styles.divider} />
            <Text
              maxFontSizeMultiplier={1}
              style={[
                styles.description,
                isTinyPhone
                  ? styles.descriptionTiny
                  : isCompactPhone
                    ? styles.descriptionCompact
                    : styles.descriptionRegular,
              ]}
            >
              In your difficult time of mental health to connect with consultants, psychologists,
              psychological wellness practitioners & psychiatrists
            </Text>

            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.ctaShadow, isTinyPhone ? styles.ctaShadowTiny : styles.ctaShadowRegular]}
              onPress={handleGetStarted}
            >
              <LinearGradient
                colors={['#24c184', '#277d9c']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.cta, isTinyPhone ? styles.ctaTiny : styles.ctaRegular]}
              >
                <Text maxFontSizeMultiplier={1} style={styles.ctaText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: VIDEO_BACKGROUND_COLOR,
    flex: 1,
  },
  topShade: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  safeArea: {
    flex: 1,
  },
  contentShell: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
  },
  contentShellTiny: {
    paddingHorizontal: 18,
  },
  contentShellRegular: {
    paddingHorizontal: 24,
  },
  content: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  kicker: {
    color: '#F4FFF9',
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.34)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  kickerTiny: {
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 8,
  },
  kickerRegular: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleTiny: {
    fontSize: 27,
    lineHeight: 31,
  },
  titleCompact: {
    fontSize: 31,
    lineHeight: 35,
  },
  titleRegular: {
    fontSize: 34,
    lineHeight: 38,
  },
  divider: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(223, 247, 239, 0.8)',
    height: StyleSheet.hairlineWidth,
    marginBottom: 13,
    marginTop: 14,
  },
  description: {
    color: '#ECFFFA',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 25,
  },
  descriptionTiny: {
    fontSize: 11,
    lineHeight: 15,
  },
  descriptionCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  descriptionRegular: {
    fontSize: 13,
    lineHeight: 18,
  },
  ctaShadow: {
    width: '100%',
    maxWidth: 292,
    shadowColor: '#0AAE8F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaShadowTiny: {
    borderRadius: 28,
  },
  ctaShadowRegular: {
    borderRadius: 32,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTiny: {
    height: 48,
    borderRadius: 24,
  },
  ctaRegular: {
    height: 54,
    borderRadius: 28,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
});

export default Landing;
