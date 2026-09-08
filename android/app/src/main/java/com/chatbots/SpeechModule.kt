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
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class SpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val mainHandler = Handler(Looper.getMainLooper())

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
            val result = engine.setLanguage(locale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                engine.setLanguage(Locale("en", "IN"))
            }
            // Female voice: higher pitch (1.2), slightly slower rate (0.9)
            engine.setPitch(1.2f)
            engine.setSpeechRate(0.9f)
            // Try to set a female voice if available on this device
            val voices = engine.voices
            if (voices != null) {
                val femaleVoice = voices.firstOrNull { v ->
                    v.locale.language == locale.language &&
                    (v.name.contains("female", ignoreCase = true) ||
                     v.name.contains("f-", ignoreCase = true) ||
                     v.name.contains("#female", ignoreCase = true))
                } ?: voices.firstOrNull { v ->
                    v.locale == Locale("en", "IN") &&
                    v.name.contains("female", ignoreCase = true)
                }
                if (femaleVoice != null) engine.voice = femaleVoice
            }
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) {
                    sendEvent("tts-done", null)
                    promise.resolve(true)
                }
                override fun onError(id: String?) {
                    sendEvent("tts-done", null)
                    promise.resolve(false)
                }
            })
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rn-tts")
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
