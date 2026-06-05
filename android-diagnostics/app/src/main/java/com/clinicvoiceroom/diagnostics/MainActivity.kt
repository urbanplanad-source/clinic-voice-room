package com.clinicvoiceroom.diagnostics

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.sqrt

private const val GOOGLE_TTS_ENGINE = "com.google.android.tts"

private val Ink = Color(0xFF191F28)
private val Mist = Color(0xFFF7F8FA)
private val Trust = Color(0xFF3182F6)
private val Mint = Color(0xFF00A881)
private val Coral = Color(0xFFF04452)
private val SlateText = Color(0xFF64748B)
private val SoftBlue = Color(0xFFEFF6FF)

private data class AudioDeviceRow(
    val id: Int,
    val type: String,
    val name: String,
    val detail: String,
    val isExternalMic: Boolean,
    val isA2dpOutput: Boolean
)

private data class TtsLanguage(
    val tag: String,
    val label: String,
    val locale: Locale,
    val sample: String
)

private data class TtsCheck(
    val tag: String,
    val label: String,
    val availability: String = "Pending",
    val playback: String = "Not tested",
    val supported: Boolean = false
)

private data class KeyDiagnostic(
    val keyCode: Int,
    val keyName: String,
    val action: String,
    val deviceId: Int,
    val source: String,
    val vendorId: Int,
    val productId: Int,
    val deviceName: String,
    val repeat: Boolean
)

private data class DiagnosticsUiState(
    val deviceSummary: String = "${Build.MANUFACTURER} ${Build.MODEL} / Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})",
    val recordAudioGranted: Boolean = false,
    val bluetoothConnectGranted: Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S,
    val inputDevices: List<AudioDeviceRow> = emptyList(),
    val outputDevices: List<AudioDeviceRow> = emptyList(),
    val hasExternalMic: Boolean = false,
    val hasA2dpOutput: Boolean = false,
    val hasAnyInput: Boolean = false,
    val hasAnyOutput: Boolean = false,
    val micRunning: Boolean = false,
    val micStatus: String = "Not tested",
    val micPeakPercent: Int = 0,
    val micRmsPercent: Int = 0,
    val speakerStatus: String = "Not tested",
    val ttsEngine: String = "Initializing",
    val ttsChecks: List<TtsCheck> = defaultTtsChecks(),
    val lastKey: KeyDiagnostic? = null,
    val logs: List<String> = listOf("Diagnostics app ready")
)

private val ttsLanguages = listOf(
    TtsLanguage(
        tag = "ko-KR",
        label = "Korean",
        locale = Locale.KOREA,
        sample = "\uc548\ub155\ud558\uc138\uc694. \uc7a5\ube44 \ud14c\uc2a4\ud2b8\uc785\ub2c8\ub2e4."
    ),
    TtsLanguage(
        tag = "zh-CN",
        label = "Chinese",
        locale = Locale.SIMPLIFIED_CHINESE,
        sample = "\u8bf7\u653e\u677e\uff0c\u6211\u4eec\u6b63\u5728\u8fdb\u884c\u8bbe\u5907\u6d4b\u8bd5\u3002"
    ),
    TtsLanguage(
        tag = "ja-JP",
        label = "Japanese",
        locale = Locale.JAPAN,
        sample = "\u3053\u308c\u306f\u6a5f\u5668\u30c6\u30b9\u30c8\u3067\u3059\u3002"
    ),
    TtsLanguage(
        tag = "en-US",
        label = "English",
        locale = Locale.US,
        sample = "This is a device test for Clinic Voice Room."
    )
)

private fun defaultTtsChecks() = ttsLanguages.map { TtsCheck(tag = it.tag, label = it.label) }

private class KeyCaptureRootView(
    context: Context,
    private val onDiagnosticKey: (KeyEvent) -> Boolean
) : FrameLayout(context) {
    private val composeView = ComposeView(context)

    init {
        isFocusableInTouchMode = true
        addView(composeView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    fun setDiagnosticsContent(content: @Composable () -> Unit) {
        composeView.setContent(content)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (onDiagnosticKey(event)) return true
        return super.dispatchKeyEvent(event)
    }
}

class MainActivity : ComponentActivity() {
    private val uiState = mutableStateOf(DiagnosticsUiState())
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val utteranceLanguages = ConcurrentHashMap<String, String>()

    private val audioManager by lazy { getSystemService(AudioManager::class.java) }
    private var mediaSession: MediaSession? = null
    private var textToSpeech: TextToSpeech? = null
    private var lastKeySignature = ""
    private var lastKeyEventTime = 0L

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        updatePermissionState()
        refreshAudioDevices("permission result")
        appendLog("permissions updated: $result")
    }

    private val audioDeviceCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
            refreshAudioDevices("audio devices added")
        }

        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
            refreshAudioDevices("audio devices removed")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        MediaButtonRouter.setHandler(::handleDiagnosticKey)
        configureMediaSession()
        updatePermissionState()
        refreshAudioDevices("startup")
        initializeTextToSpeech(GOOGLE_TTS_ENGINE)
        requestMissingPermissions()

        audioManager.registerAudioDeviceCallback(audioDeviceCallback, mainHandler)

        val rootView = KeyCaptureRootView(this) { event ->
            handleDiagnosticKey(event, "compose view")
        }.apply {
            requestFocus()
            setDiagnosticsContent {
                MaterialTheme {
                    Surface(modifier = Modifier.fillMaxSize(), color = Mist) {
                        DiagnosticsScreen(
                            state = uiState.value,
                            onRequestPermissions = ::requestMissingPermissions,
                            onRefresh = { refreshAudioDevices("manual refresh") },
                            onRunMicTest = ::runMicLevelTest,
                            onTestSpeaker = ::playSpeakerTone,
                            onTestTts = ::speakTtsSample,
                            onCopyReport = ::copyReport
                        )
                    }
                }
            }
        }
        setContentView(rootView)
        rootView.requestFocus()
        appendLog("keyboard HID diagnostics active")
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (handleDiagnosticKey(event, "activity down")) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (handleDiagnosticKey(event, "activity up")) return true
        return super.onKeyUp(keyCode, event)
    }

    override fun onDestroy() {
        runCatching { audioManager.unregisterAudioDeviceCallback(audioDeviceCallback) }
        textToSpeech?.shutdown()
        textToSpeech = null
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        MediaButtonRouter.setHandler(null)
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun updateState(block: (DiagnosticsUiState) -> DiagnosticsUiState) {
        runOnUiThread {
            uiState.value = block(uiState.value)
        }
    }

    private fun appendLog(message: String) {
        val stamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        updateState { current ->
            current.copy(logs = (listOf("$stamp $message") + current.logs).take(60))
        }
    }

    private fun updatePermissionState() {
        val hasRecordAudio = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val hasBluetoothConnect =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

        updateState {
            it.copy(
                recordAudioGranted = hasRecordAudio,
                bluetoothConnectGranted = hasBluetoothConnect
            )
        }
    }

    private fun requestMissingPermissions() {
        val permissions = buildList {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                add(Manifest.permission.RECORD_AUDIO)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
            ) {
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }

        if (permissions.isEmpty()) {
            appendLog("all required diagnostic permissions granted")
            return
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    private fun refreshAudioDevices(reason: String) {
        val inputs = safeAudioDevices(AudioManager.GET_DEVICES_INPUTS)
        val outputs = safeAudioDevices(AudioManager.GET_DEVICES_OUTPUTS)

        updateState {
            it.copy(
                inputDevices = inputs,
                outputDevices = outputs,
                hasAnyInput = inputs.isNotEmpty(),
                hasAnyOutput = outputs.isNotEmpty(),
                hasExternalMic = inputs.any { device -> device.isExternalMic },
                hasA2dpOutput = outputs.any { device -> device.isA2dpOutput }
            )
        }
        appendLog("audio device refresh: $reason, inputs=${inputs.size}, outputs=${outputs.size}")
    }

    private fun safeAudioDevices(flag: Int): List<AudioDeviceRow> {
        return runCatching {
            audioManager.getDevices(flag).map { device ->
                val type = audioDeviceTypeLabel(device.type)
                val name = runCatching { device.productName?.toString().orEmpty() }
                    .getOrDefault("")
                    .ifBlank { "Unknown device" }
                val sampleRates = device.sampleRates.take(4).joinToString(",").ifBlank { "default" }
                val channels = device.channelCounts.take(4).joinToString(",").ifBlank { "default" }
                AudioDeviceRow(
                    id = device.id,
                    type = type,
                    name = name,
                    detail = "rates=$sampleRates channels=$channels",
                    isExternalMic = isExternalInput(device.type),
                    isA2dpOutput = device.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                )
            }
        }.getOrElse { caught ->
            appendLog("audio devices unavailable: ${caught.message}")
            emptyList()
        }
    }

    private fun initializeTextToSpeech(preferredEngine: String?) {
        val requestedEngine = preferredEngine
        textToSpeech = if (requestedEngine == null) {
            TextToSpeech(this) { status -> handleTtsInit(status, null) }
        } else {
            TextToSpeech(this, { status -> handleTtsInit(status, requestedEngine) }, requestedEngine)
        }
    }

    private fun handleTtsInit(status: Int, requestedEngine: String?) {
        if (status != TextToSpeech.SUCCESS) {
            if (requestedEngine != null) {
                appendLog("Google TTS unavailable, retrying default engine")
                textToSpeech?.shutdown()
                initializeTextToSpeech(null)
                return
            }
            updateState { it.copy(ttsEngine = "Unavailable") }
            appendLog("TTS init failed")
            return
        }

        val tts = textToSpeech ?: return
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) {
                utteranceLanguages[utteranceId]?.let { tag ->
                    updateTtsPlayback(tag, "Speaking")
                }
            }

            override fun onDone(utteranceId: String) {
                utteranceLanguages.remove(utteranceId)?.let { tag ->
                    updateTtsPlayback(tag, "Playback passed")
                    appendLog("TTS playback passed: $tag")
                }
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) {
                utteranceLanguages.remove(utteranceId)?.let { tag ->
                    updateTtsPlayback(tag, "Playback error")
                    appendLog("TTS playback error: $tag")
                }
            }
        })

        val engineLabel = requestedEngine ?: "Default engine"
        updateState { current ->
            current.copy(
                ttsEngine = engineLabel,
                ttsChecks = ttsLanguages.map { language ->
                    val availability = ttsAvailabilityLabel(tts.isLanguageAvailable(language.locale))
                    TtsCheck(
                        tag = language.tag,
                        label = language.label,
                        availability = availability,
                        playback = "Not tested",
                        supported = availability.startsWith("Available")
                    )
                }
            )
        }
        appendLog("TTS ready: $engineLabel")
    }

    private fun updateTtsPlayback(tag: String, playback: String) {
        updateState { current ->
            current.copy(
                ttsChecks = current.ttsChecks.map { check ->
                    if (check.tag == tag) check.copy(playback = playback) else check
                }
            )
        }
    }

    private fun speakTtsSample(tag: String) {
        val language = ttsLanguages.firstOrNull { it.tag == tag } ?: return
        val tts = textToSpeech ?: run {
            updateTtsPlayback(tag, "TTS unavailable")
            return
        }

        val availability = tts.isLanguageAvailable(language.locale)
        if (availability < TextToSpeech.LANG_AVAILABLE) {
            updateTtsPlayback(tag, ttsAvailabilityLabel(availability))
            appendLog("TTS language unsupported: $tag")
            return
        }

        val languageResult = tts.setLanguage(language.locale)
        if (languageResult < TextToSpeech.LANG_AVAILABLE) {
            updateTtsPlayback(tag, "Language selection failed")
            appendLog("TTS language selection failed: $tag")
            return
        }

        val utteranceId = "${language.tag}-${UUID.randomUUID()}"
        utteranceLanguages[utteranceId] = language.tag
        updateTtsPlayback(tag, "Queued")
        val result = tts.speak(language.sample, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        if (result != TextToSpeech.SUCCESS) {
            utteranceLanguages.remove(utteranceId)
            updateTtsPlayback(tag, "Speak call failed")
            appendLog("TTS speak call failed: $tag")
        }
    }

    private fun playSpeakerTone() {
        updateState { it.copy(speakerStatus = "Playing test tone") }
        appendLog("speaker tone started")
        runCatching {
            val tone = ToneGenerator(AudioManager.STREAM_MUSIC, 90)
            tone.startTone(ToneGenerator.TONE_PROP_BEEP, 800)
            mainHandler.postDelayed({
                tone.release()
                updateState { it.copy(speakerStatus = "Tone played") }
                appendLog("speaker tone finished")
            }, 900L)
        }.onFailure { caught ->
            updateState { it.copy(speakerStatus = "Tone failed: ${caught.message}") }
            appendLog("speaker tone failed: ${caught.message}")
        }
    }

    @SuppressLint("MissingPermission")
    private fun runMicLevelTest() {
        updatePermissionState()
        if (!uiState.value.recordAudioGranted) {
            updateState { it.copy(micStatus = "Microphone permission required") }
            requestMissingPermissions()
            return
        }
        if (uiState.value.micRunning) return

        updateState {
            it.copy(
                micRunning = true,
                micStatus = "Measuring microphone level for 4 seconds",
                micPeakPercent = 0,
                micRmsPercent = 0
            )
        }
        appendLog("mic level test started")

        executor.execute {
            var recorder: AudioRecord? = null
            runCatching {
                val sampleRate = 16000
                val minBuffer = AudioRecord.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                val bufferBytes = max(minBuffer, 4096)
                val audioFormat = AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build()

                recorder = AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                    .setAudioFormat(audioFormat)
                    .setBufferSizeInBytes(bufferBytes)
                    .build()

                val activeRecorder = recorder ?: error("AudioRecord unavailable")
                if (activeRecorder.state != AudioRecord.STATE_INITIALIZED) {
                    error("AudioRecord did not initialize")
                }

                val buffer = ShortArray(bufferBytes / 2)
                val startedAt = System.currentTimeMillis()
                var maxPeakPercent = 0
                activeRecorder.startRecording()

                while (System.currentTimeMillis() - startedAt < 4000L) {
                    val count = activeRecorder.read(buffer, 0, buffer.size)
                    if (count <= 0) continue

                    var peak = 0
                    var sumSquares = 0.0
                    for (index in 0 until count) {
                        val value = buffer[index].toInt()
                        val abs = kotlin.math.abs(value)
                        if (abs > peak) peak = abs
                        sumSquares += value.toDouble() * value.toDouble()
                    }

                    val peakPercent = ((peak / 32767.0) * 100).toInt().coerceIn(0, 100)
                    val rmsPercent = ((sqrt(sumSquares / count) / 32767.0) * 100).toInt().coerceIn(0, 100)
                    maxPeakPercent = max(maxPeakPercent, peakPercent)
                    updateState {
                        it.copy(
                            micPeakPercent = peakPercent,
                            micRmsPercent = rmsPercent,
                            micStatus = "Measuring... peak=$peakPercent% rms=$rmsPercent%"
                        )
                    }
                    Thread.sleep(120L)
                }

                val status = if (maxPeakPercent >= 3) "Mic signal passed (peak $maxPeakPercent%)" else "No clear mic signal"
                updateState { it.copy(micRunning = false, micStatus = status) }
                appendLog("mic level test finished: $status")
            }.onFailure { caught ->
                updateState {
                    it.copy(
                        micRunning = false,
                        micStatus = "Mic test failed: ${caught.message}",
                        micPeakPercent = 0,
                        micRmsPercent = 0
                    )
                }
                appendLog("mic level test failed: ${caught.message}")
            }
            runCatching {
                recorder?.stop()
            }
            runCatching {
                recorder?.release()
            }
        }
    }

    private fun configureMediaSession() {
        val mediaButtonIntent = Intent(Intent.ACTION_MEDIA_BUTTON).setClass(this, MediaButtonReceiver::class.java)
        val mediaButtonPendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            mediaButtonIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        mediaSession = MediaSession(this, "ClinicVoiceRoomDiagnosticsMediaSession").apply {
            @Suppress("DEPRECATION")
            setMediaButtonReceiver(mediaButtonPendingIntent)
            setCallback(object : MediaSession.Callback() {
                override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
                    @Suppress("DEPRECATION")
                    val event = mediaButtonIntent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    return event?.let { handleDiagnosticKey(it, "media session") } ?: false
                }

                override fun onPlay() {
                    appendLog("media session onPlay")
                    setActivePlaybackState()
                }

                override fun onPause() {
                    appendLog("media session onPause")
                    setActivePlaybackState()
                }
            })
            isActive = true
        }
        setActivePlaybackState()
        appendLog("media session active for HID/media button diagnostics")
    }

    private fun setActivePlaybackState() {
        mediaSession?.setPlaybackState(
            PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY_PAUSE or
                        PlaybackState.ACTION_PLAY or
                        PlaybackState.ACTION_PAUSE or
                        PlaybackState.ACTION_STOP
                )
                .setState(PlaybackState.STATE_PLAYING, 0L, 1f)
                .build()
        )
    }

    private fun handleDiagnosticKey(event: KeyEvent, source: String): Boolean {
        if (!isSupportedDiagnosticKey(event.keyCode)) return false

        val signature = "${event.keyCode}:${event.action}:${event.deviceId}"
        val repeat = event.repeatCount > 0 || (signature == lastKeySignature && event.eventTime - lastKeyEventTime < 80L)
        lastKeySignature = signature
        lastKeyEventTime = event.eventTime

        val device = event.device
        val key = KeyDiagnostic(
            keyCode = event.keyCode,
            keyName = KeyEvent.keyCodeToString(event.keyCode),
            action = actionLabel(event.action),
            deviceId = event.deviceId,
            source = source,
            vendorId = device?.vendorId ?: 0,
            productId = device?.productId ?: 0,
            deviceName = device?.name ?: "unknown",
            repeat = repeat
        )

        updateState { it.copy(lastKey = key) }
        appendLog("key ${key.keyName} action=${key.action} source=$source repeat=$repeat device=${key.deviceId}")
        return true
    }

    private fun isSupportedDiagnosticKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_SPACE ||
            keyCode == KeyEvent.KEYCODE_ENTER ||
            keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
            keyCode == KeyEvent.KEYCODE_HEADSETHOOK
    }

    private fun copyReport() {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Clinic Voice Room diagnostics", buildReport()))
        appendLog("diagnostic metadata report copied")
    }

    private fun buildReport(): String {
        val state = uiState.value
        return buildString {
            appendLine("Clinic Voice Room Android Diagnostics")
            appendLine("Device: ${state.deviceSummary}")
            appendLine("Record audio permission: ${state.recordAudioGranted}")
            appendLine("Bluetooth connect permission: ${state.bluetoothConnectGranted}")
            appendLine("External mic detected: ${state.hasExternalMic}")
            appendLine("A2DP output detected: ${state.hasA2dpOutput}")
            appendLine("Mic test: ${state.micStatus}")
            appendLine("Speaker test: ${state.speakerStatus}")
            appendLine("TTS engine: ${state.ttsEngine}")
            state.ttsChecks.forEach {
                appendLine("TTS ${it.tag}: ${it.availability}, ${it.playback}")
            }
            state.lastKey?.let {
                appendLine("Last key: ${it.keyName} ${it.action} device=${it.deviceId} vendor=${it.vendorId} product=${it.productId} repeat=${it.repeat} name=${it.deviceName}")
            } ?: appendLine("Last key: none")
            appendLine("Input devices:")
            state.inputDevices.forEach {
                appendLine("- #${it.id} ${it.type} ${it.name} ${it.detail}")
            }
            appendLine("Output devices:")
            state.outputDevices.forEach {
                appendLine("- #${it.id} ${it.type} ${it.name} ${it.detail}")
            }
        }
    }
}

private fun audioDeviceTypeLabel(type: Int): String {
    return when (type) {
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "Built-in mic"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Built-in speaker"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Wired headset"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "Wired headphones"
        AudioDeviceInfo.TYPE_USB_DEVICE -> "USB device"
        AudioDeviceInfo.TYPE_USB_HEADSET -> "USB headset"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth A2DP"
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth SCO"
        AudioDeviceInfo.TYPE_TELEPHONY -> "Telephony"
        AudioDeviceInfo.TYPE_HDMI -> "HDMI"
        else -> "Type $type"
    }
}

private fun isExternalInput(type: Int): Boolean {
    return type == AudioDeviceInfo.TYPE_USB_DEVICE ||
        type == AudioDeviceInfo.TYPE_USB_HEADSET ||
        type == AudioDeviceInfo.TYPE_WIRED_HEADSET
}

private fun ttsAvailabilityLabel(value: Int): String {
    return when (value) {
        TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE -> "Available: country+variant"
        TextToSpeech.LANG_COUNTRY_AVAILABLE -> "Available: country"
        TextToSpeech.LANG_AVAILABLE -> "Available: language"
        TextToSpeech.LANG_MISSING_DATA -> "Missing voice data"
        TextToSpeech.LANG_NOT_SUPPORTED -> "Not supported"
        else -> "Unknown: $value"
    }
}

private fun actionLabel(action: Int): String {
    return when (action) {
        KeyEvent.ACTION_DOWN -> "DOWN"
        KeyEvent.ACTION_UP -> "UP"
        else -> "ACTION_$action"
    }
}

@Composable
private fun DiagnosticsScreen(
    state: DiagnosticsUiState,
    onRequestPermissions: () -> Unit,
    onRefresh: () -> Unit,
    onRunMicTest: () -> Unit,
    onTestSpeaker: () -> Unit,
    onTestTts: (String) -> Unit,
    onCopyReport: () -> Unit
) {
    val clinicReady = state.recordAudioGranted && state.hasExternalMic && state.hasA2dpOutput
    val basicReady = state.recordAudioGranted && state.hasAnyInput && state.hasAnyOutput
    val statusTitle = when {
        clinicReady -> "병원폰 장비 기준 통과"
        basicReady -> "기본 장비 테스트 가능"
        else -> "장비 연결을 확인하세요"
    }
    val statusBody = when {
        clinicReady -> "USB-C 마이크와 Bluetooth A2DP 출력이 감지되었습니다."
        basicReady -> "내장 장비로 테스트할 수 있습니다. 병원 표준 장비를 연결해 최종 확인하세요."
        !state.recordAudioGranted -> "마이크 권한이 필요합니다. 권한 버튼을 눌러 허용하세요."
        else -> "마이크와 스피커 장치 목록을 새로고침한 뒤 테스트를 진행하세요."
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        HeaderCard(deviceSummary = state.deviceSummary)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = onRefresh,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
            ) {
                Text("새로고침", fontWeight = FontWeight.Bold)
            }
            OutlinedButton(
                onClick = onRequestPermissions,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
            ) {
                Text("권한", fontWeight = FontWeight.Bold, color = Ink)
            }
            OutlinedButton(
                onClick = onCopyReport,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
            ) {
                Text("리포트", fontWeight = FontWeight.Bold, color = Ink)
            }
        }

        LatestStatusPanel(title = statusTitle, body = statusBody, ready = clinicReady)

        SectionCard(title = "장비 준비 상태") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                StatusBadge("USB/유선 마이크", state.hasExternalMic, Modifier.weight(1f))
                StatusBadge("A2DP 스피커", state.hasA2dpOutput, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                StatusBadge("마이크 권한", state.recordAudioGranted, Modifier.weight(1f))
                StatusBadge("Bluetooth 권한", state.bluetoothConnectGranted, Modifier.weight(1f))
            }
        }

        MicrophoneActionCard(
            state = state,
            canRun = state.recordAudioGranted && !state.micRunning,
            onRunMicTest = onRunMicTest
        )

        SectionCard(title = "스피커 출력") {
            Text(state.speakerStatus, color = Ink, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onTestSpeaker,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Ink, contentColor = Color.White)
            ) {
                Text("테스트음 재생", fontWeight = FontWeight.Bold)
            }
        }

        SectionCard(title = "Google TTS") {
            Text("엔진: ${state.ttsEngine}", color = Ink, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            state.ttsChecks.forEach { check ->
                TtsRow(check = check, onTestTts = onTestTts)
            }
        }

        SectionCard(title = "HID 발패드 / 버튼") {
            Text(
                "Space, Enter, Numpad Enter, MediaPlayPause, HeadsetHook 입력을 감지합니다.",
                color = SlateText,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(10.dp))
            val key = state.lastKey
            if (key == null) {
                Text("아직 지원 키 입력이 없습니다.", color = SlateText)
            } else {
                Text("${key.keyName} ${key.action}", color = Ink, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("source=${key.source} repeat=${key.repeat}", color = SlateText)
                Text("device=${key.deviceId} vendor=${key.vendorId} product=${key.productId}", color = SlateText)
                Text(key.deviceName, color = SlateText)
            }
        }

        DeviceSection("입력 장치", state.inputDevices)
        DeviceSection("출력 장치", state.outputDevices)

        SectionCard(title = "이벤트 로그") {
            state.logs.take(24).forEach {
                Text(it, color = Ink, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun HeaderCard(deviceSummary: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text("Clinic Voice Room", color = Trust, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
            Text(
                "병원폰 장비 진단",
                color = Ink,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                "USB-C 마이크, Bluetooth 스피커, Google TTS, 발패드 입력을 현장에서 확인합니다.",
                color = SlateText,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(deviceSummary, color = SlateText, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun LatestStatusPanel(title: String, body: String, ready: Boolean) {
    val background = if (ready) Color(0xFFEFFCF7) else SoftBlue
    val accent = if (ready) Mint else Trust

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(background, RoundedCornerShape(8.dp))
            .padding(16.dp)
    ) {
        Text("현재 판정", color = accent, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
        Text(title, color = Ink, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(body, color = Color(0xFF475569), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun MicrophoneActionCard(
    state: DiagnosticsUiState,
    canRun: Boolean,
    onRunMicTest: () -> Unit
) {
    val buttonColor = when {
        state.micRunning -> Coral
        canRun -> Ink
        else -> Color(0xFFCBD5E1)
    }
    val buttonLabel = when {
        state.micRunning -> "측정 중"
        canRun -> "마이크 테스트"
        else -> "권한 필요"
    }

    SectionCard(title = "마이크 입력") {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    state.micStatus,
                    color = Color(0xFF334155),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.height(18.dp))
            Button(
                onClick = onRunMicTest,
                enabled = canRun,
                modifier = Modifier.size(176.dp),
                shape = RoundedCornerShape(100.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = buttonColor,
                    contentColor = Color.White,
                    disabledContainerColor = Color(0xFFCBD5E1),
                    disabledContentColor = Color.White
                )
            ) {
                Text(buttonLabel, textAlign = TextAlign.Center, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Peak ${state.micPeakPercent}%", color = SlateText, fontWeight = FontWeight.Bold)
                    LevelBar(state.micPeakPercent)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("RMS ${state.micRmsPercent}%", color = SlateText, fontWeight = FontWeight.Bold)
                    LevelBar(state.micRmsPercent)
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = Ink, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun StatusBadge(label: String, ready: Boolean, modifier: Modifier = Modifier) {
    val background = if (ready) Color(0xFFDCFCE7) else Color(0xFFF1F5F9)
    val text = if (ready) Color(0xFF166534) else Color(0xFF475569)
    Column(
        modifier = modifier
            .background(background, RoundedCornerShape(8.dp))
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(if (ready) "통과" else "확인", color = text, fontWeight = FontWeight.Bold)
        Text(label, color = text, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun LevelBar(percent: Int) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(10.dp)
            .background(Color(0xFFE2E8F0), RoundedCornerShape(100.dp))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth((percent.coerceIn(0, 100) / 100f).coerceAtLeast(0.02f))
                .height(10.dp)
                .background(Trust, RoundedCornerShape(100.dp))
        )
    }
}

@Composable
private fun TtsRow(check: TtsCheck, onTestTts: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("${check.label} (${check.tag})", color = Ink, fontWeight = FontWeight.Bold)
            Text(check.availability, color = SlateText, style = MaterialTheme.typography.bodySmall)
            Text(check.playback, color = Color(0xFF334155), style = MaterialTheme.typography.bodySmall)
        }
        Button(
            onClick = { onTestTts(check.tag) },
            enabled = check.supported,
            modifier = Modifier.height(44.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
        ) {
            Text("재생", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun DeviceSection(title: String, devices: List<AudioDeviceRow>) {
    SectionCard(title = title) {
        if (devices.isEmpty()) {
            Text("보고된 장치가 없습니다.", color = SlateText)
            return@SectionCard
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            devices.forEach { device ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                        .padding(12.dp)
                ) {
                    Text("#${device.id} ${device.type}", color = Ink, fontWeight = FontWeight.Bold)
                    Text(device.name, color = Color(0xFF334155))
                    Text(device.detail, color = SlateText, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
