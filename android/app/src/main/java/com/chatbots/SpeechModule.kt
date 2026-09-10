package com.chatbots

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class SpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val mainHandler = Handler(Looper.getMainLooper())

    // Android Voice has no gender field. Recognize explicit gender tokens and
    // documented Google voice IDs, never a substring of "female".
    // IDs: https://www.crosstales.com/media/data/assets/rtvoice/RTVoice-doc.pdf
    private fun isMaleVoice(voice: Voice, engine: TextToSpeech): Boolean {
        val name = voice.name.lowercase(Locale.ROOT)
        if (Regex("(^|[^a-z])female([^a-z]|$)").containsMatchIn(name)) return false
        if (Regex("(^|[^a-z])(male|m)([^a-z]|$)").containsMatchIn(name)) return true
        if (engine.defaultEngine != "com.google.android.tts") return false
        val googleMaleIds = setOf(
            "en-in-x-end", "en-in-x-ene", "hi-in-x-hid", "hi-in-x-hie",
            "en-us-x-iol", "en-us-x-iom", "en-us-x-tpd",
            "en-gb-x-gbb", "en-gb-x-gbd", "en-gb-x-rjs",
            "gu-in-x-gum", "kn-in-x-knm", "ml-in-x-mlm",
            "ta-in-x-tag", "te-in-x-tem"
        )
        return name.removeSuffix("-local").removeSuffix("-network") in googleMaleIds
    }

    override fun getName() = "SpeechModule"

    // ── TTS ──────────────────────────────────────────────────────────────────

    @ReactMethod
    fun initTts(promise: Promise) {
        mainHandler.post {
            if (ttsReady) { promise.resolve(true); return@post }
            tts = TextToSpeech(reactContext) { status ->
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) promise.resolve(true)
                else promise.reject("TTS_INIT_FAILED", "TTS engine failed to initialize")
            }
        }
    }

    @ReactMethod
    fun speak(text: String, lang: String, promise: Promise) {
        mainHandler.post {
            val engine = tts
            if (engine == null || !ttsReady) {
                promise.reject("TTS_NOT_READY", "TTS not initialized")
                return@post
            }
            val locale = Locale.forLanguageTag(lang.replace('_', '-'))
            val maleVoices = engine.voices.orEmpty()
                .filter { voice ->
                    voice.locale.language == locale.language &&
                        !voice.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) &&
                        isMaleVoice(voice, engine)
                }
                .sortedWith(compareBy<Voice> { it.locale.country != locale.country }
                    .thenBy { it.isNetworkConnectionRequired }
                    .thenByDescending { it.quality }
                    .thenBy { it.name })
            if (maleVoices.none { engine.setVoice(it) == TextToSpeech.SUCCESS }) {
                promise.reject("TTS_MALE_VOICE_UNAVAILABLE",
                    "A male voice is not available for this language. Install a male voice in your phone's Text-to-speech settings and try again.")
                return@post
            }
            engine.setPitch(1.0f)
            engine.setSpeechRate(0.9f)
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) {
                    sendEvent("tts-done", null)
                    promise.resolve(true)
                }
                override fun onError(id: String?) {
                    sendEvent("tts-done", null)
                    promise.reject("TTS_PLAYBACK_FAILED", "Unable to play this voice. Check your connection and installed voice data.")
                }
            })
            if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rn-tts") == TextToSpeech.ERROR) {
                promise.reject("TTS_PLAYBACK_FAILED", "Unable to start voice playback.")
            }
        }
    }

    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        mainHandler.post {
            tts?.stop()
            sendEvent("tts-done", null)
            promise.resolve(true)
        }
    }

    // ── STT ──────────────────────────────────────────────────────────────────

    @ReactMethod
    fun isRecognitionAvailable(promise: Promise) {
        mainHandler.post {
            promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactContext))
        }
    }

    @ReactMethod
    fun startListening(lang: String, promise: Promise) {
        mainHandler.post {
            if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
                promise.reject("STT_UNAVAILABLE", "Speech recognition not available on this device")
                return@post
            }
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { sendEvent("stt-ready", null) }
                override fun onBeginningOfSpeech() { sendEvent("stt-start", null) }
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { sendEvent("stt-end", null) }
                override fun onError(error: Int) {
                    val msg = when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH -> "no-match"
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "timeout"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission"
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy"
                        SpeechRecognizer.ERROR_NETWORK -> "network"
                        else -> "error-$error"
                    }
                    sendEvent("stt-error", msg)
                }
                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val transcript = matches?.firstOrNull() ?: ""
                    sendEvent("stt-result", transcript)
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val transcript = matches?.firstOrNull() ?: ""
                    if (transcript.isNotBlank()) {
                        sendEvent("stt-partial-result", transcript)
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang.replace('_', '-'))
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 60000L)
            }
            speechRecognizer?.startListening(intent)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        mainHandler.post {
            speechRecognizer?.stopListening()
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun destroyRecognizer(promise: Promise) {
        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
            promise.resolve(true)
        }
    }

    // ── Events ────────────────────────────────────────────────────────────────

    private fun sendEvent(name: String, data: String?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, data)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
            tts?.shutdown()
            tts = null
            ttsReady = false
        }
    }
}
