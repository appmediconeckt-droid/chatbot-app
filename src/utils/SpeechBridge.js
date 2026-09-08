import { NativeModules, NativeEventEmitter } from 'react-native';

const { SpeechModule } = NativeModules;

let emitter = null;
const getEmitter = () => {
  if (!emitter && SpeechModule) emitter = new NativeEventEmitter(SpeechModule);
  return emitter;
};

// ── TTS ──────────────────────────────────────────────────────────────────────

let ttsInitialized = false;
export async function initTts() {
  if (ttsInitialized) return;
  if (!SpeechModule) return;
  try {
    await SpeechModule.initTts();
    ttsInitialized = true;
  } catch (_) {}
}

export async function speakText(text, lang = 'en-IN') {
  if (!SpeechModule) return;
  await initTts();
  const clean = String(text || '').replace(/\[.*?\]/g, '').trim();
  if (!clean) return;
  return SpeechModule.speak(clean, lang);
}

export async function stopSpeaking() {
  if (!SpeechModule) return;
  return SpeechModule.stopSpeaking();
}

export function onTtsDone(cb) {
  const sub = getEmitter()?.addListener('tts-done', cb);
  return () => sub?.remove();
}

// ── STT ──────────────────────────────────────────────────────────────────────

export async function startListening(lang = 'en-IN') {
  if (!SpeechModule) throw new Error('SpeechModule not available');
  return SpeechModule.startListening(lang);
}

export async function stopListening() {
  if (!SpeechModule) return;
  return SpeechModule.stopListening();
}

export async function destroyRecognizer() {
  if (!SpeechModule) return;
  return SpeechModule.destroyRecognizer();
}

export function isSpeechModuleAvailable() {
  return !!SpeechModule;
}

export async function isRecognitionAvailable() {
  if (!SpeechModule?.isRecognitionAvailable) return false;
  return SpeechModule.isRecognitionAvailable();
}

export function onSttResult(cb) {
  const sub = getEmitter()?.addListener('stt-result', cb);
  return () => sub?.remove();
}

export function onSttPartialResult(cb) {
  const sub = getEmitter()?.addListener('stt-partial-result', cb);
  return () => sub?.remove();
}

export function onSttStart(cb) {
  const sub = getEmitter()?.addListener('stt-start', cb);
  return () => sub?.remove();
}

export function onSttEnd(cb) {
  const sub = getEmitter()?.addListener('stt-end', cb);
  return () => sub?.remove();
}

export function onSttError(cb) {
  const sub = getEmitter()?.addListener('stt-error', cb);
  return () => sub?.remove();
}
