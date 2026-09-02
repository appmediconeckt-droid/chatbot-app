import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Voice from '@react-native-voice/voice';
import i18n from '../i18n';
import * as SpeechBridge from '../utils/SpeechBridge';

const normalizeSpeechLanguage = (language) => {
  const value = String(language || i18n.language || 'en-IN').trim();
  return value ? value.replace('_', '-') : 'en-IN';
};

export const useSpeechToText = (options = {}) => {
  const preferredLanguage = typeof options === 'string' ? options : options.language;
  const languageRef = useRef(normalizeSpeechLanguage(preferredLanguage));
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const useNativeBridge = Platform.OS === 'android' && SpeechBridge.isSpeechModuleAvailable();

  useEffect(() => {
    languageRef.current = normalizeSpeechLanguage(preferredLanguage);
  }, [preferredLanguage]);

  useEffect(() => {
    if (useNativeBridge) {
      const subscriptions = [
        SpeechBridge.onSttStart(() => {
          setError(null);
          setTranscript('');
          setIsListening(true);
        }),
        // Android fires end-of-speech before final recognition is delivered.
        // Keep the mic state active until a final result/error or manual stop.
        SpeechBridge.onSttEnd(() => {}),
        SpeechBridge.onSttPartialResult((text) => {
          const nextText = String(text || '').trim();
          if (nextText) setTranscript(nextText);
        }),
        SpeechBridge.onSttResult((text) => {
          const nextText = String(text || '').trim();
          if (nextText) setTranscript(nextText);
          setIsListening(false);
        }),
        SpeechBridge.onSttError((message) => {
          setIsListening(false);
          const readable =
            message === 'no-match' || message === 'timeout'
              ? 'No speech detected. Please try again.'
              : message === 'permission'
                ? 'Microphone permission denied'
                : `Speech recognition error: ${message || 'unknown'}`;
          setError(readable);
          console.warn('[Speech-to-Text] Native error:', message);
        }),
      ];

      SpeechBridge.isRecognitionAvailable()
        .then((available) => setIsAvailable(Boolean(available)))
        .catch(() => setIsAvailable(false));

      return () => {
        subscriptions.forEach((unsubscribe) => unsubscribe?.());
        SpeechBridge.destroyRecognizer().catch(() => {});
      };
    }

    Voice.onSpeechStart = () => {
      setError(null);
      setTranscript('');
      setIsListening(true);
    };

    Voice.onSpeechRecognized = () => {
      // Called when speech recognition stops
    };

    Voice.onSpeechEnd = () => {
      // Final results can arrive after this event, so keep the mic active until
      // onSpeechResults/onSpeechError updates the state.
    };

    Voice.onSpeechError = (e) => {
      setIsListening(false);
      const message = e?.error?.message || e?.error || 'Speech recognition error';
      setError(message);
      console.warn('[Speech-to-Text] Error:', e);
    };

    Voice.onSpeechResults = (e) => {
      if (e.value && e.value.length > 0) {
        const recognizedText = e.value[0]; // Get best match
        setTranscript(recognizedText);
      }
      setIsListening(false);
    };

    Voice.onSpeechPartialResults = (e) => {
      if (e.value && e.value.length > 0) {
        setTranscript(e.value[0]); // Live partial results
      }
    };

    // Check if voice recognition is available
    Voice.isAvailable()
      .then(available => setIsAvailable(available))
      .catch(() => setIsAvailable(false));

    return () => {
      Voice.removeAllListeners?.();
      Voice.destroy().catch(() => {});
    };
  }, [useNativeBridge]);

  const requestMicPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for speech recognition.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('[Speech-to-Text] Permission error:', err);
      return false;
    }
  }, []);

  const startListening = useCallback(async (languageOverride) => {
    if (!isAvailable) {
      setError('Speech recognition not available on this device');
      return;
    }

    if (isListening) return;

    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        setError('Microphone permission denied');
        return;
      }

      setTranscript('');
      setError(null);
      setIsListening(true);
      const language = normalizeSpeechLanguage(languageOverride || languageRef.current);

      if (useNativeBridge) {
        await SpeechBridge.startListening(language);
        return;
      }

      await Voice.start(language, {
        NUMBER_OF_MATCHES: 1,
        PARTIAL_RESULTS: true,
        EXTRA_LANGUAGE_MODEL: Platform.OS === 'android' ? 'web_search' : undefined,
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 60000,
      });
    } catch (err) {
      setIsListening(false);
      setError(err.message || 'Failed to start listening');
      console.error('[Speech-to-Text] Start error:', err);
    }
  }, [isListening, isAvailable, requestMicPermission, useNativeBridge]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      if (useNativeBridge) {
        await SpeechBridge.stopListening();
      } else {
        await Voice.stop();
      }
      setIsListening(false);
    } catch (err) {
      setError(err.message || 'Failed to stop listening');
      console.error('[Speech-to-Text] Stop error:', err);
    }
  }, [isListening, useNativeBridge]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isAvailable,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
};
