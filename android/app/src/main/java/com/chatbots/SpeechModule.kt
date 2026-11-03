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
    @Volatile private var ttsSession = 0
    @Volatile private var pendingSettle: ((String?, Boolean) -> Unit)? = null
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

    // Java keeps legacy ISO codes for a few languages (he->iw, id->in, yi->ji),
    // and engines report either form, so compare on one canonical code.
    private fun canonicalLanguage(code: String): String = when (code.lowercase(Locale.ROOT)) {
        "iw" -> "he"
        "in" -> "id"
        "ji" -> "yi"
        "fil" -> "tl"
        "nb", "nn" -> "no"
        else -> code.lowercase(Locale.ROOT)
    }

    private fun isInstalled(voice: Voice) =
        !voice.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)

    // Prefer a male voice for the language, then any installed voice for it,
    // then whatever the engine picks for the locale. Only fail when the phone
    // has no voice data for the language at all.
    private fun selectVoice(engine: TextToSpeech, locale: Locale): Boolean {
        val language = canonicalLanguage(locale.language)
        val candidates = engine.voices.orEmpty()
            .filter { canonicalLanguage(it.locale.language) == language && isInstalled(it) }
            .sortedWith(compareBy<Voice> { !isMaleVoice(it, engine) }
                .thenBy { !it.locale.country.equals(locale.country, ignoreCase = true) }
                .thenBy { it.isNetworkConnectionRequired }
                .thenByDescending { it.quality }
                .thenBy { it.name })
        if (candidates.any { engine.setVoice(it) == TextToSpeech.SUCCESS }) return true
        val result = engine.setLanguage(locale)
        return result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
    }

    // Engines reject input longer than getMaxSpeechInputLength(), so long
    // replies are queued in sentence-sized chunks.
    private fun chunkText(text: String): List<String> {
        val max = minOf(TextToSpeech.getMaxSpeechInputLength(), 3000)
        if (text.length <= max) return listOf(text)
        val chunks = mutableListOf<String>()
        val current = StringBuilder()
        Regex("[^.!?।\\n]+[.!?।\\n]*").findAll(text).map { it.value }.forEach { part ->
            if (current.length + part.length > max && current.isNotEmpty()) {
                chunks.add(current.toString())
                current.clear()
            }
            var rest = part
            while (rest.length > max) {
                chunks.add(rest.substring(0, max))
                rest = rest.substring(max)
            }
            current.append(rest)
        }
        if (current.isNotBlank()) chunks.add(current.toString())
        return chunks
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
            if (!selectVoice(engine, locale)) {
                promise.reject("TTS_LANGUAGE_UNAVAILABLE",
                    "Voice for ${locale.displayLanguage} is not installed on this phone. Download it in your phone's Text-to-speech settings and try again.")
                return@post
            }
            engine.setPitch(1.0f)
            engine.setSpeechRate(0.9f)
            // A newer speak() supersedes this one: resolve the old promise
            // quietly so its late tts-done can't stop the new reply's UI.
            pendingSettle?.invoke(null, false)
            val session = ++ttsSession
            val prefix = "rn-tts-$session-"
            val chunks = chunkText(text)
            val lastId = "$prefix${chunks.size - 1}"
            var settled = false
            val settle: (String?, Boolean) -> Unit = settle@{ error, notify ->
                synchronized(this) {
                    if (settled) return@settle
                    settled = true
                    if (pendingSettle != null && ttsSession == session) pendingSettle = null
                }
                if (notify) sendEvent("tts-done", null)
                if (error == null) promise.resolve(true)
                else promise.reject("TTS_PLAYBACK_FAILED", error)
            }
            pendingSettle = settle
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) { if (id == lastId) settle(null, true) }
                override fun onStop(id: String?, interrupted: Boolean) {
                    if (id?.startsWith(prefix) == true) settle(null, true)
                }
                @Deprecated("Deprecated in Java")
                override fun onError(id: String?) {
                    if (id?.startsWith(prefix) == true) {
                        settle("Unable to play this voice. Check your connection and installed voice data.", true)
                    }
                }
            })
            chunks.forEachIndexed { i, chunk ->
                val mode = if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
                if (engine.speak(chunk, mode, null, "$prefix$i") == TextToSpeech.ERROR) {
                    engine.stop()
                    settle("Unable to start voice playback.", true)
                    return@post
                }
            }
        }
    }

    @ReactMethod
    fun openTtsSettings(promise: Promise) {
        mainHandler.post {
            val activity = reactContext.currentActivity
            val intents = listOf(
                Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA),
                Intent("com.android.settings.TTS_SETTINGS"),
            )
            val launched = intents.any { intent ->
                try {
                    if (activity != null) activity.startActivity(intent)
                    else reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    true
                } catch (_: Exception) { false }
            }
            promise.resolve(launched)
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
