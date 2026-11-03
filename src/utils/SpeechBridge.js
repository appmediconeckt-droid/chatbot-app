import { NativeModules, NativeEventEmitter } from 'react-native';
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';
import { API_BASE_URL, TUNNEL_HEADERS } from '../axiosConfig';

const { SpeechModule } = NativeModules;

let emitter = null;
const getEmitter = () => {
  if (!emitter && SpeechModule) emitter = new NativeEventEmitter(SpeechModule);
  return emitter;
};

// ── TTS ──────────────────────────────────────────────────────────────────────
// Replies are voiced by the backend (/api/ai-chat/tts, OpenAI "onyx" male
// voice), which speaks every app language on every phone without needing
// voice data installed. The phone's own TTS is only the offline fallback.

const SERVER_CHUNK_CHARS = 300; // keeps the GET URL short even for Devanagari
let playback = null; // { cancelled, sound, finish }
let nativeActive = false;
const doneListeners = new Set();

const emitDone = () => doneListeners.forEach((cb) => {
  try { cb(); } catch (_) {}
});

// Split on sentence ends (incl. the Devanagari danda), then hard-split
// anything still longer than max.
const splitForTts = (text, max = SERVER_CHUNK_CHARS) => {
  const parts = text.match(/[^.!?।\n]+[.!?।\n]*/g) || [text];
  const chunks = [];
  let current = '';
  parts.forEach((part) => {
    if (current && current.length + part.length > max) {
      chunks.push(current.trim());
      current = '';
    }
    let rest = part;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(' ', max) > max / 2 ? rest.lastIndexOf(' ', max) : max;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
    current += rest;
  });
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
};

async function downloadServerChunk(text, index) {
  const path = `${RNFS.CachesDirectoryPath}/tts-${Date.now()}-${index}.mp3`;
  const { promise } = RNFS.downloadFile({
    fromUrl: `${API_BASE_URL}/api/ai-chat/tts?text=${encodeURIComponent(text)}`,
    toFile: path,
    headers: TUNNEL_HEADERS,
    connectionTimeout: 15000,
    readTimeout: 30000,
  });
  const res = await promise;
  if (res.statusCode !== 200 || !res.bytesWritten) {
    RNFS.unlink(path).catch(() => {});
    throw new Error(`Voice server returned ${res.statusCode}`);
  }
  return path;
}

function playFile(path, session) {
  return new Promise((resolve, reject) => {
    const sound = new Sound(path, '', (loadError) => {
      if (loadError) { reject(loadError); return; }
      if (session.cancelled) { sound.release(); resolve(); return; }
      session.sound = sound;
      session.finish = resolve; // lets stopSpeaking() unblock this await
      sound.play((ok) => {
        sound.release();
        session.sound = null;
        session.finish = null;
        if (ok || session.cancelled) resolve();
        else reject(new Error('Unable to play this voice.'));
      });
    });
  });
}

// Plays chunks in order, fetching the next while the current one plays.
// Returns how many chunks were fully played (for the fallback on failure).
async function speakWithServer(chunks, session) {
  let played = 0;
  let next = downloadServerChunk(chunks[0], 0);
  for (let i = 0; i < chunks.length; i += 1) {
    const path = await next.catch((err) => { err.played = played; throw err; });
    if (i + 1 < chunks.length) {
      next = downloadServerChunk(chunks[i + 1], i + 1);
      next.catch(() => {}); // surfaced when awaited above
    }
    try {
      if (session.cancelled) break;
      await playFile(path, session).catch((err) => { err.played = played; throw err; });
      played += 1;
    } finally {
      RNFS.unlink(path).catch(() => {});
    }
  }
  return played;
}

let ttsInitialized = false;
export async function initTts() {
  if (ttsInitialized) return;
  if (!SpeechModule) return;
  try {
    await SpeechModule.initTts();
    ttsInitialized = true;
  } catch (_) {}
}

async function speakOnDevice(text, lang) {
  if (!SpeechModule) throw new Error('Voice playback is not available on this device.');
  await initTts();
  nativeActive = true;
  try {
    return await SpeechModule.speak(text, lang);
  } finally {
    nativeActive = false;
  }
}

export async function speakText(text, lang = 'en-IN') {
  const clean = String(text || '').replace(/\[.*?\]/g, '').trim();
  if (!clean) return;
  await stopSpeaking();
  const session = { cancelled: false, sound: null, finish: null };
  playback = session;
  const chunks = splitForTts(clean);
  try {
    await speakWithServer(chunks, session);
  } catch (err) {
    if (session.cancelled) return;
    // Offline or server error: say whatever is left with the phone's voice.
    console.warn('[TTS] server voice failed, using device voice:', err?.message ?? err);
    if (playback === session) playback = null;
    return speakOnDevice(chunks.slice(err?.played || 0).join(' '), lang);
  }
  if (playback === session) {
    playback = null;
    if (!session.cancelled) emitDone();
  }
}

// Opens the TTS voice-data download screen (falls back to TTS settings).
export async function openTtsSettings() {
  if (!SpeechModule?.openTtsSettings) return false;
  return SpeechModule.openTtsSettings();
}

export async function stopSpeaking() {
  const current = playback;
  playback = null;
  if (current) {
    current.cancelled = true;
    current.sound?.stop();
    current.finish?.();
  }
  if (nativeActive && SpeechModule) {
    nativeActive = false;
    await SpeechModule.stopSpeaking();
  }
}

export function onTtsDone(cb) {
  doneListeners.add(cb);
  const sub = getEmitter()?.addListener('tts-done', cb);
  return () => {
    doneListeners.delete(cb);
    sub?.remove();
  };
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
