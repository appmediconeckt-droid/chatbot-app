import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Voice from '@react-native-voice/voice';

export const useSpeechToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Initialize voice listener
  useEffect(() => {
    Voice.onSpeechStart = () => {
      setError(null);
      setTranscript('');
    };

    Voice.onSpeechRecognized = () => {
      // Called when speech recognition stops
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
    };

    Voice.onSpeechError = (e) => {
      setIsListening(false);
      setError(e.error || 'Speech recognition error');
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
      Voice.destroy().catch(() => {});
    };
  }, []);

  // Request microphone permissions (Android)
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

  // Start listening
  const startListening = useCallback(async () => {
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

      // Start voice recognition with language based on device locale
      await Voice.start('en-US', {
        NUMBER_OF_MATCHES: 1,
        PARTIAL_RESULTS: true,
        EXTRA_LANGUAGE_MODEL: Platform.OS === 'android' ? 'web_search' : undefined,
      });
    } catch (err) {
      setIsListening(false);
      setError(err.message || 'Failed to start listening');
      console.error('[Speech-to-Text] Start error:', err);
    }
  }, [isListening, isAvailable, requestMicPermission]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await Voice.stop();
      setIsListening(false);
    } catch (err) {
      setError(err.message || 'Failed to stop listening');
      console.error('[Speech-to-Text] Stop error:', err);
    }
  }, [isListening]);

  // Toggle listening
  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clear transcript
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
