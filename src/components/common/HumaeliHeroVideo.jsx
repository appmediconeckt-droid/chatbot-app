import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  View,
  requireNativeComponent,
} from 'react-native';

const NativeHumaeliHeroVideo =
  Platform.OS === 'android' ? requireNativeComponent('HumaeliHeroVideo') : null;

const VIDEO_BACKGROUND_COLOR = '#04181B';

const HumaeliHeroVideo = ({
  style,
  sourceName = '',
  fallbackSource = require('../../image/wellness_hero.png'),
  muted = false,
  resizeMode = 'cover',
  focusX = 0.5,
  focusY = 0.5,
  zoomScale = 1,
}) => {
  const nativeSourceName = useMemo(
    () => String(sourceName || '').trim() || 'mobile_hero_section_video',
    [sourceName],
  );
  const [playbackFailed, setPlaybackFailed] = useState(false);

  useEffect(() => {
    setPlaybackFailed(false);
  }, [nativeSourceName]);

  if (Platform.OS === 'android' && NativeHumaeliHeroVideo) {
    return (
      <View style={[style, styles.fallback]}>
        {fallbackSource ? (
          <Image
            source={fallbackSource}
            style={[StyleSheet.absoluteFill, { transform: [{ scale: zoomScale }] }]}
            resizeMode={resizeMode === 'fitwidth' ? 'cover' : resizeMode}
          />
        ) : null}
        {!playbackFailed ? (
          <NativeHumaeliHeroVideo
            key={nativeSourceName}
            style={StyleSheet.absoluteFill}
            sourceName={nativeSourceName}
            muted={muted}
            resizeMode={resizeMode}
            focusX={focusX}
            focusY={focusY}
            zoomScale={zoomScale}
            onPlaybackError={() => setPlaybackFailed(true)}
          />
        ) : null}
      </View>
    );
  }

  const fallbackResizeMode = resizeMode === 'fitwidth' ? 'contain' : resizeMode;

  return (
    <View style={[style, styles.fallback]}>
      {fallbackSource ? (
        <Image
          source={fallbackSource}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: zoomScale }] }]}
          resizeMode={fallbackResizeMode}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: VIDEO_BACKGROUND_COLOR,
  },
});

export default HumaeliHeroVideo;
