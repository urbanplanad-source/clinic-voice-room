package com.clinicvoiceroom.staff

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.max

private val Ink = Color(0xFF191F28)
private val Mist = Color(0xFFF7F8FA)
private val Trust = Color(0xFF3182F6)
private val Mint = Color(0xFF00A881)
private val Coral = Color(0xFFF04452)
private val SlateText = Color(0xFF64748B)
private val Line = Color(0xFFE2E8F0)
private val Panel = Color(0xFFF8FAFC)
private val BlueTint = Color(0xFFEFF6FF)
private val GreenTint = Color(0xFFEFFCF7)
private val RoseTint = Color(0xFFFFF1F2)

private data class StaffLayoutMetrics(
    val isTablet: Boolean,
    val contentMaxWidth: Dp,
    val outerHorizontalPadding: Dp,
    val outerVerticalPadding: Dp,
    val screenSpacing: Dp,
    val contentSpacing: Dp,
    val headerPadding: Dp,
    val cardPadding: Dp,
    val statusPadding: Dp,
    val modeCardHeight: Dp,
    val modeIconBoxSize: Dp,
    val modeIconSize: Dp,
    val languageTileHeight: Dp,
    val languageGridGap: Dp,
    val primaryButtonHeight: Dp,
    val qrMaxSize: Dp,
    val qrPadding: Dp,
    val micSmallSize: Dp,
    val micLargeSize: Dp,
    val conversationMinHeight: Dp,
    val conversationEmptyHeight: Dp
)

private val CompactStaffLayoutMetrics = StaffLayoutMetrics(
    isTablet = false,
    contentMaxWidth = 560.dp,
    outerHorizontalPadding = 14.dp,
    outerVerticalPadding = 12.dp,
    screenSpacing = 10.dp,
    contentSpacing = 12.dp,
    headerPadding = 22.dp,
    cardPadding = 14.dp,
    statusPadding = 14.dp,
    modeCardHeight = 104.dp,
    modeIconBoxSize = 52.dp,
    modeIconSize = 28.dp,
    languageTileHeight = 68.dp,
    languageGridGap = 7.dp,
    primaryButtonHeight = 56.dp,
    qrMaxSize = 332.dp,
    qrPadding = 16.dp,
    micSmallSize = 104.dp,
    micLargeSize = 168.dp,
    conversationMinHeight = 280.dp,
    conversationEmptyHeight = 220.dp
)

private val TabletStaffLayoutMetrics = StaffLayoutMetrics(
    isTablet = true,
    contentMaxWidth = 680.dp,
    outerHorizontalPadding = 32.dp,
    outerVerticalPadding = 20.dp,
    screenSpacing = 14.dp,
    contentSpacing = 16.dp,
    headerPadding = 28.dp,
    cardPadding = 20.dp,
    statusPadding = 18.dp,
    modeCardHeight = 122.dp,
    modeIconBoxSize = 60.dp,
    modeIconSize = 34.dp,
    languageTileHeight = 88.dp,
    languageGridGap = 10.dp,
    primaryButtonHeight = 62.dp,
    qrMaxSize = 420.dp,
    qrPadding = 22.dp,
    micSmallSize = 120.dp,
    micLargeSize = 204.dp,
    conversationMinHeight = 420.dp,
    conversationEmptyHeight = 320.dp
)

private fun staffLayoutMetrics(maxWidth: Dp): StaffLayoutMetrics {
    return if (maxWidth >= 600.dp) TabletStaffLayoutMetrics else CompactStaffLayoutMetrics
}

private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
private const val AppDisplayVersion = "0.3.9"
private const val StaffSessionCookieName = "cvr_session"
private const val SetupStepMode = "mode"
private const val SetupStepLanguage = "language"
private const val SetupStepLocalInterpreter = "local_interpreter"
private const val RoomModeLocalInterpreter = "local_interpreter"
private const val LocalDirectionKoToPatient = "ko_to_patient"
private const val LocalDirectionPatientToKo = "patient_to_ko"
private const val RealtimePcmSampleRate = 24000
private const val RealtimeTurnWaitMs = 5500L
private const val RealtimeOutputQuietMs = 300L
private const val RealtimeInputTranscriptWaitMs = 750L
private const val RecordingStopJoinMs = 250L
private const val StaffRecordingMaxMs = 60_000L
private const val LocalValidationTimeoutMs = 900L
private const val LocalValidationMaxSourceChars = 18
private const val LocalValidationMaxTranslatedChars = 36
private const val LocalValidationMaxSourceWords = 3
private const val TtsSpeechUtterancePrefix = "cvr-speak"
private const val TtsWarmUtterancePrefix = "cvr-warm"

private data class PatientLanguageOption(
    val code: String,
    val ko: String,
    val native: String,
    val ttsLocale: Locale
)

private val patientLanguages = listOf(
    PatientLanguageOption("zh", "중국어", "中文", Locale.SIMPLIFIED_CHINESE),
    PatientLanguageOption("zh_tw", "중국어 번체", "繁體中文", Locale.TRADITIONAL_CHINESE),
    PatientLanguageOption("ja", "일본어", "日本語", Locale.JAPAN),
    PatientLanguageOption("en", "영어", "English", Locale.US),
    PatientLanguageOption("th", "태국어", "ไทย", Locale("th", "TH")),
    PatientLanguageOption("ms", "말레이어", "Melayu", Locale("ms", "MY")),
    PatientLanguageOption("mn", "몽골어", "Монгол", Locale("mn", "MN")),
    PatientLanguageOption("ru", "러시아어", "Русский", Locale("ru", "RU")),
    PatientLanguageOption("vi", "베트남어", "Tiếng Việt", Locale("vi", "VN")),
    PatientLanguageOption("id", "인도네시아어", "Indonesia", Locale("id", "ID")),
    PatientLanguageOption("fr", "프랑스어", "Français", Locale.FRANCE),
    PatientLanguageOption("es", "스페인어", "Español", Locale("es", "ES")),
    PatientLanguageOption("de", "독일어", "Deutsch", Locale.GERMANY),
    PatientLanguageOption("it", "이탈리아어", "Italiano", Locale.ITALY),
    PatientLanguageOption("pt", "포르투갈어", "Português", Locale("pt", "PT"))
)

private data class RoomInfo(
    val id: String,
    val patientLanguage: String,
    val joinUrl: String,
    val roomMode: String = "consultation",
    val status: String = "waiting_for_patient",
    val patientJoinedAt: String? = null
)

private data class StaffMessage(
    val id: String,
    val speaker: String,
    val sourceText: String,
    val text: String,
    val targetLanguage: String?,
    val createdAt: String
)

private data class StaffUiState(
    val backendUrl: String = "https://voice.insightmedi.co.kr",
    val email: String = "",
    val password: String = "",
    val rememberEmail: Boolean = true,
    val loggedIn: Boolean = false,
    val staffName: String = "",
    val hospitalName: String = "",
    val selectedLanguage: String = "zh",
    val selectedRoomMode: String = "consultation",
    val setupStep: String = SetupStepMode,
    val room: RoomInfo? = null,
    val status: String = "로그인 후 통역 모드를 선택하세요.",
    val busy: Boolean = false,
    val connected: Boolean = false,
    val speaking: Boolean = false,
    val ttsEnabled: Boolean = true,
    val ttsPlaybackActive: Boolean = false,
    val ttsStatus: String = "휴대폰 미디어 출력 준비 중",
    val recordAudioGranted: Boolean = false,
    val sourceDraft: String = "",
    val translatedDraft: String = "",
    val lastMessageSpeaker: String = "",
    val localTurnDirection: String = LocalDirectionKoToPatient,
    val messages: List<StaffMessage> = emptyList(),
    val textInput: String = "",
    val lastKey: String = "없음",
    val showEndRoomConfirm: Boolean = false,
    val logs: List<String> = listOf("Android staff app ready")
)

private class PersistentCookieJar(private val preferences: SharedPreferences) : CookieJar {
    private val cookiesByHost = mutableMapOf<String, MutableList<Cookie>>()
    @Volatile
    var persistCookies: Boolean = true

    init {
        restore()
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val hostCookies = cookiesByHost.getOrPut(url.host) { mutableListOf() }
        cookies.forEach { cookie ->
            hostCookies.removeAll { it.name == cookie.name && it.domain == cookie.domain && it.path == cookie.path }
            if (cookie.expiresAt > System.currentTimeMillis()) hostCookies.add(cookie)
        }
        pruneExpired()
        persist()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        val valid = cookiesByHost[url.host]
            ?.filter { it.expiresAt > now && it.matches(url) }
            ?.also { cookiesByHost[url.host] = it.toMutableList() }
            ?: emptyList()
        persist()
        return valid
    }

    @Synchronized
    fun hasCookiesFor(url: HttpUrl): Boolean {
        return loadForRequest(url).any { it.name == StaffSessionCookieName }
    }

    @Synchronized
    fun clear() {
        cookiesByHost.clear()
        preferences.edit().remove("cookies").apply()
    }

    @Synchronized
    private fun restore() {
        cookiesByHost.clear()
        val raw = preferences.getString("cookies", null) ?: return
        runCatching {
            val array = JSONArray(raw)
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                if (item.optString("name") != StaffSessionCookieName) continue
                val domain = item.optString("domain")
                if (domain.isBlank()) continue
                val builder = Cookie.Builder()
                    .name(item.optString("name"))
                    .value(item.optString("value"))
                    .expiresAt(item.optLong("expiresAt"))
                    .path(item.optString("path", "/"))
                if (item.optBoolean("hostOnly", true)) builder.hostOnlyDomain(domain) else builder.domain(domain)
                if (item.optBoolean("secure")) builder.secure()
                if (item.optBoolean("httpOnly")) builder.httpOnly()
                val cookie = builder.build()
                if (cookie.expiresAt > System.currentTimeMillis()) {
                    cookiesByHost.getOrPut(domain) { mutableListOf() }.add(cookie)
                }
            }
        }
    }

    @Synchronized
    private fun pruneExpired() {
        val now = System.currentTimeMillis()
        cookiesByHost.keys.toList().forEach { host ->
            val valid = cookiesByHost[host]?.filter { it.expiresAt > now }.orEmpty()
            if (valid.isEmpty()) cookiesByHost.remove(host) else cookiesByHost[host] = valid.toMutableList()
        }
    }

    @Synchronized
    private fun persist() {
        pruneExpired()
        if (!persistCookies) {
            preferences.edit().remove("cookies").apply()
            return
        }
        val array = JSONArray()
        cookiesByHost.values.flatten().filter { it.name == StaffSessionCookieName }.forEach { cookie ->
            array.put(
                JSONObject()
                    .put("name", cookie.name)
                    .put("value", cookie.value)
                    .put("expiresAt", cookie.expiresAt)
                    .put("domain", cookie.domain)
                    .put("path", cookie.path)
                    .put("secure", cookie.secure)
                    .put("httpOnly", cookie.httpOnly)
                    .put("hostOnly", cookie.hostOnly)
            )
        }
        preferences.edit().putString("cookies", array.toString()).apply()
    }
}

private data class RealtimeToken(
    val value: String,
    val model: String
)

private data class RealtimeTurnResult(
    val sourceText: String,
    val translatedText: String
)

private class AndroidRealtimeTurnClient(
    private val http: OkHttpClient,
    private val token: RealtimeToken,
    private val log: (String) -> Unit
) {
    private var webSocket: WebSocket? = null
    private var openLatch = CountDownLatch(1)
    private var turnDoneLatch = CountDownLatch(1)
    private val errorRef = AtomicReference<Throwable?>(null)
    private val outputText = StringBuilder()
    private val inputText = StringBuilder()
    @Volatile
    private var open = false
    @Volatile
    private var responseDone = false
    @Volatile
    private var inputTranscriptDone = false
    @Volatile
    private var responseRequestedAt = 0L
    @Volatile
    private var firstOutputLogged = false

    fun connect() {
        if (open) return

        val startedAt = SystemClock.elapsedRealtime()
        openLatch = CountDownLatch(1)
        errorRef.set(null)
        val encodedModel = URLEncoder.encode(token.model.ifBlank { "gpt-realtime" }, "UTF-8")
        val request = Request.Builder()
            .url("wss://api.openai.com/v1/realtime?model=$encodedModel")
            .header("Authorization", "Bearer ${token.value}")
            .build()

        webSocket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                open = true
                log("Realtime connected: ${token.model}")
                openLatch.countDown()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleServerEvent(text)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                open = false
                log("Realtime closed: $code $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                open = false
                errorRef.set(t)
                openLatch.countDown()
                turnDoneLatch.countDown()
                log("Realtime failure: ${t.message}")
            }
        })

        if (!openLatch.await(10, TimeUnit.SECONDS)) {
            close()
            error("Realtime connection timed out")
        }
        errorRef.get()?.let { throw it }
        if (!open) error("Realtime connection did not open")
        log("Realtime socket ready ${SystemClock.elapsedRealtime() - startedAt}ms")
    }

    fun isReady(): Boolean = open

    fun startTurn() {
        connect()
        synchronized(this) {
            outputText.clear()
            inputText.clear()
        }
        responseDone = false
        inputTranscriptDone = false
        responseRequestedAt = 0L
        firstOutputLogged = false
        errorRef.set(null)
        turnDoneLatch = CountDownLatch(1)
        send(JSONObject().put("type", "input_audio_buffer.clear"))
    }

    fun appendPcm(bytes: ByteArray, length: Int) {
        if (!open || length <= 0) return
        val audio = Base64.encodeToString(bytes, 0, length, Base64.NO_WRAP)
        send(
            JSONObject()
                .put("type", "input_audio_buffer.append")
                .put("audio", audio)
        )
    }

    fun stopTurnAndTranslate(timeoutMs: Long = RealtimeTurnWaitMs): RealtimeTurnResult {
        if (!open) error("Realtime connection is not open")

        send(JSONObject().put("type", "input_audio_buffer.commit"))
        send(
            JSONObject()
                .put("type", "response.create")
                .put(
                    "response",
                    JSONObject().put("output_modalities", JSONArray().put("text"))
                )
        )
        responseRequestedAt = SystemClock.elapsedRealtime()

        val deadlineAt = System.currentTimeMillis() + timeoutMs
        val doneLatch = turnDoneLatch
        var lastLength = -1
        var stableSince = 0L
        while (System.currentTimeMillis() < deadlineAt) {
            errorRef.get()?.let { throw it }
            val length = synchronized(this) { outputText.length }
            val now = System.currentTimeMillis()
            var shouldFinish = false
            if (length > 0) {
                if (length != lastLength) {
                    lastLength = length
                    stableSince = now
                }
                shouldFinish = responseDone || now - stableSince >= RealtimeOutputQuietMs
            } else if (responseDone) {
                shouldFinish = true
            }
            if (shouldFinish) break

            val waitMs = if (length > 0 && stableSince > 0L) {
                (RealtimeOutputQuietMs - (now - stableSince)).coerceIn(1L, 50L)
            } else {
                (deadlineAt - now).coerceIn(1L, 50L)
            }
            doneLatch.await(waitMs, TimeUnit.MILLISECONDS)
        }
        errorRef.get()?.let { throw it }
        val translated = synchronized(this) { outputText.toString().trim() }
        if (translated.isBlank()) error("Realtime returned no translated text")
        waitForInputTranscriptIfNeeded()
        log("Realtime local result ${SystemClock.elapsedRealtime() - responseRequestedAt}ms")

        return RealtimeTurnResult(
            sourceText = synchronized(this) { inputText.toString().trim() },
            translatedText = translated
        )
    }

    fun close() {
        runCatching { webSocket?.cancel() }
        webSocket = null
        open = false
    }

    private fun send(event: JSONObject) {
        val sent = webSocket?.send(event.toString()) ?: false
        if (!sent) log("Realtime send skipped: ${event.optString("type")}")
    }

    private fun handleServerEvent(text: String) {
        runCatching {
            val event = JSONObject(text)
            when (val type = event.optString("type")) {
                "session.output_transcript.delta",
                "response.output_audio_transcript.delta",
                "response.output_text.delta" -> {
                    if (type == "response.output_audio_transcript.delta" && !firstOutputLogged) {
                        log("Realtime audio transcript event received")
                    }
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) {
                        val isFirst = synchronized(this) {
                            val first = outputText.isEmpty()
                            outputText.append(delta)
                            first
                        }
                        if (isFirst && !firstOutputLogged && responseRequestedAt > 0L) {
                            firstOutputLogged = true
                            log("Realtime first text ${SystemClock.elapsedRealtime() - responseRequestedAt}ms")
                        }
                    }
                }

                "session.output_transcript.done",
                "response.output_audio_transcript.done",
                "response.output_text.done" -> {
                    if (type == "response.output_audio_transcript.done") {
                        log("Realtime audio transcript done received")
                    }
                    val finalText = event.optString("transcript", event.optString("text"))
                    if (finalText.isNotBlank()) synchronized(this) {
                        outputText.clear()
                        outputText.append(finalText)
                    }
                    responseDone = true
                    turnDoneLatch.countDown()
                }

                "response.content_part.done" -> {
                    val finalText = event.optJSONObject("part")?.optString("text").orEmpty()
                    if (finalText.isNotBlank()) synchronized(this) {
                        outputText.clear()
                        outputText.append(finalText)
                    }
                    responseDone = true
                    turnDoneLatch.countDown()
                }

                "response.output_item.done" -> {
                    val finalText = collectRealtimeItemText(event.optJSONObject("item"))
                    if (finalText.isNotBlank()) synchronized(this) {
                        outputText.clear()
                        outputText.append(finalText)
                    }
                    responseDone = true
                    turnDoneLatch.countDown()
                }

                "conversation.item.input_audio_transcription.delta" -> {
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) synchronized(this) { inputText.append(delta) }
                }

                "conversation.item.input_audio_transcription.completed" -> {
                    val finalText = event.optString("transcript")
                    if (finalText.isNotBlank()) synchronized(this) {
                        inputText.clear()
                        inputText.append(finalText)
                    }
                    inputTranscriptDone = true
                }

                "response.done" -> {
                    responseDone = true
                    turnDoneLatch.countDown()
                }

                "error" -> {
                    val message = event.optJSONObject("error")?.optString("message")
                        ?: "Realtime API error"
                    errorRef.set(IllegalStateException(message))
                    turnDoneLatch.countDown()
                    log("Realtime API error: $message")
                }

                else -> if (type.isNotBlank() && type.startsWith("input_audio_buffer.")) {
                    log("Realtime event: $type")
                }
            }
        }.onFailure {
            log("Realtime event parse skipped: ${text.take(120)}")
        }
    }

    private fun collectRealtimeItemText(item: JSONObject?): String {
        val content = item?.optJSONArray("content") ?: return ""
        val parts = mutableListOf<String>()
        for (index in 0 until content.length()) {
            val part = content.optJSONObject(index) ?: continue
            val text = part.optString("text").ifBlank { part.optString("transcript") }
            if (text.isNotBlank()) parts.add(text)
        }
        return parts.joinToString("").trim()
    }

    private fun waitForInputTranscriptIfNeeded() {
        if (synchronized(this) { inputText.isNotBlank() } || inputTranscriptDone) return

        val deadlineAt = SystemClock.elapsedRealtime() + RealtimeInputTranscriptWaitMs
        while (SystemClock.elapsedRealtime() < deadlineAt) {
            errorRef.get()?.let { throw it }
            if (synchronized(this) { inputText.isNotBlank() } || inputTranscriptDone) return
            Thread.sleep(40)
        }
        log("Realtime input transcript missing after ${RealtimeInputTranscriptWaitMs}ms")
    }
}

private data class SupabaseRealtimeConfig(
    val enabled: Boolean,
    val supabaseUrl: String = "",
    val supabaseAnonKey: String = ""
)

private class SupabaseTranslationRealtimeClient(
    private val http: OkHttpClient,
    private val config: SupabaseRealtimeConfig,
    private val roomId: String,
    private val mainHandler: Handler,
    private val log: (String) -> Unit,
    private val onMessage: (JSONObject) -> Unit
) {
    private val refCounter = AtomicInteger(1)
    private val topic = "realtime:clinic-room:$roomId:translations"
    private val joinRef = "join-${System.currentTimeMillis()}"
    @Volatile
    private var active = false
    @Volatile
    private var joined = false
    private var webSocket: WebSocket? = null
    private var reconnectAttempts = 0

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!active) return
            send("phoenix", "heartbeat", JSONObject())
            mainHandler.postDelayed(this, 25_000L)
        }
    }

    fun connect() {
        if (!config.enabled || active) return
        active = true
        openSocket()
    }

    fun close() {
        active = false
        joined = false
        mainHandler.removeCallbacks(heartbeatRunnable)
        runCatching { webSocket?.cancel() }
        webSocket = null
    }

    private fun openSocket() {
        val websocketUrl = websocketUrl() ?: run {
            log("Supabase realtime disabled: invalid URL")
            return
        }
        val request = Request.Builder()
            .url(websocketUrl)
            .header("apikey", config.supabaseAnonKey)
            .header("Authorization", "Bearer ${config.supabaseAnonKey}")
            .build()

        webSocket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempts = 0
                joined = false
                log("Supabase realtime connected")
                sendJoin()
                mainHandler.removeCallbacks(heartbeatRunnable)
                mainHandler.postDelayed(heartbeatRunnable, 25_000L)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleEvent(text)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                joined = false
                log("Supabase realtime closed: $code $reason")
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                joined = false
                log("Supabase realtime failed: ${t.message}")
                scheduleReconnect()
            }
        })
    }

    private fun websocketUrl(): String? {
        val base = config.supabaseUrl.trim().removeSuffix("/")
        if (base.isBlank()) return null
        val websocketBase = when {
            base.startsWith("https://") -> "wss://${base.removePrefix("https://")}"
            base.startsWith("http://") -> "ws://${base.removePrefix("http://")}"
            base.startsWith("wss://") || base.startsWith("ws://") -> base
            else -> "wss://$base"
        }
        val encodedKey = URLEncoder.encode(config.supabaseAnonKey, "UTF-8")
        return "$websocketBase/realtime/v1/websocket?apikey=$encodedKey&vsn=1.0.0"
    }

    private fun sendJoin() {
        val payload = JSONObject()
            .put(
                "config",
                JSONObject()
                    .put("broadcast", JSONObject().put("ack", false).put("self", false))
                    .put("presence", JSONObject().put("key", ""))
                    .put("postgres_changes", JSONArray())
            )
            .put("access_token", config.supabaseAnonKey)
        send(topic, "phx_join", payload, joinRef)
    }

    private fun send(topic: String, event: String, payload: JSONObject, joinRefOverride: String? = null) {
        val message = JSONObject()
            .put("topic", topic)
            .put("event", event)
            .put("payload", payload)
            .put("ref", refCounter.getAndIncrement().toString())
        joinRefOverride?.let { message.put("join_ref", it) }
        if (webSocket?.send(message.toString()) != true) {
            log("Supabase realtime send skipped: $event")
        }
    }

    private fun handleEvent(text: String) {
        val event = runCatching { JSONObject(text) }.getOrNull() ?: return
        val eventName = event.optString("event")
        if (eventName == "phx_reply" && event.optString("topic") == topic) {
            joined = event.optJSONObject("payload")?.optString("status") == "ok"
            if (joined) log("Supabase translation channel ready")
            return
        }

        val payload = event.optJSONObject("payload") ?: return
        val broadcastName = when (eventName) {
            "broadcast" -> payload.optString("event")
            else -> eventName
        }
        if (broadcastName != "translation:new") return

        val broadcastPayload = if (eventName == "broadcast") {
            payload.optJSONObject("payload")
        } else {
            payload
        } ?: return
        val message = broadcastPayload.optJSONObject("message") ?: return
        mainHandler.post {
            onMessage(message)
        }
    }

    private fun scheduleReconnect() {
        if (!active) return
        mainHandler.removeCallbacks(heartbeatRunnable)
        val delay = (1_000L * (reconnectAttempts + 1)).coerceAtMost(5_000L)
        reconnectAttempts += 1
        mainHandler.postDelayed({
            if (active) openSocket()
        }, delay)
    }
}

class MainActivity : ComponentActivity() {
    private val uiState = mutableStateOf(StaffUiState())
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val sessionExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val cookieJar by lazy { PersistentCookieJar(getSharedPreferences("staff_cookies", MODE_PRIVATE)) }
    private val ttsAudioAttributes by lazy {
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
    }
    private val http by lazy {
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .writeTimeout(45, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS)
            .build()
    }
    private var textToSpeech: TextToSpeech? = null
    private var mediaSession: MediaSession? = null
    private var lastHardwareKeySignature = ""
    private var lastHardwareKeyEventTime = 0L
    @Volatile
    private var recordingActive = false
    private var recordingThread: Thread? = null
    private val recordingLock = Any()
    private var recordedPcm: ByteArrayOutputStream? = null
    private var realtimeTurnClient: AndroidRealtimeTurnClient? = null
    private var realtimeTurnRoomId: String = ""
    @Volatile
    private var activeRealtimeTurnClient: AndroidRealtimeTurnClient? = null
    @Volatile
    private var ttsPlaybackActive = false
    @Volatile
    private var activeTtsUtteranceId = ""
    private val localRealtimeLock = Any()
    private val localRealtimeTurnClients = mutableMapOf<String, AndroidRealtimeTurnClient>()
    private val localRealtimePreparingKeys = mutableSetOf<String>()
    @Volatile
    private var realtimePreparingRoomId: String = ""
    @Volatile
    private var realtimeTurnActive = false
    @Volatile
    private var roomPollingActive = false
    @Volatile
    private var roomPollInFlight = false
    @Volatile
    private var messagePollingActive = false
    @Volatile
    private var messagePollInFlight = false
    private val realtimeExecutor: ExecutorService = Executors.newFixedThreadPool(2)
    private val pollExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val messageExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var messageCursor: String? = null
    private var messagePollingInitialized = false
    private val seenMessageIds = mutableSetOf<String>()
    private var translationRealtimeClient: SupabaseTranslationRealtimeClient? = null
    private var translationRealtimeRoomId = ""
    private val roomPollRunnable = object : Runnable {
        override fun run() {
            pollCurrentRoom()
            if (roomPollingActive) {
                mainHandler.postDelayed(this, roomPollDelayMs())
            }
        }
    }
    private val messagePollRunnable = object : Runnable {
        override fun run() {
            pollCurrentRoomMessages()
            if (messagePollingActive) {
                mainHandler.postDelayed(this, messagePollDelayMs())
            }
        }
    }
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        refreshPermissionState()
        appendLog("권한 상태 갱신")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        restorePreferences()
        refreshPermissionState()
        initializeTts()
        StaffMediaButtonRouter.setHandler(::handleHardwareKey)
        configureMediaSession()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleAppBack()
            }
        })

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Mist) {
                    StaffAppScreen(
                        state = uiState.value,
                        onBackendUrl = { updateState { it.copy(backendUrl = it.backendUrl) } },
                        onBackendChange = { value -> updateState { it.copy(backendUrl = value) } },
                        onEmailChange = { value -> updateState { it.copy(email = value) } },
                        onPasswordChange = { value -> updateState { it.copy(password = value) } },
                        onRememberEmailChange = ::updateRememberLogin,
                        onLogin = ::login,
                        onLogout = ::logout,
                        onLanguage = { code ->
                            updateState { it.copy(selectedLanguage = code) }
                            if (uiState.value.selectedRoomMode == RoomModeLocalInterpreter) {
                                closeLocalRealtimeTurnClients()
                            }
                        },
                        onRoomMode = { mode ->
                            if (mode != RoomModeLocalInterpreter) closeLocalRealtimeTurnClients()
                            updateState {
                                it.copy(
                                    selectedRoomMode = mode,
                                    setupStep = SetupStepLanguage,
                                    status = languageSelectionStatus(mode)
                                )
                            }
                        },
                        onCreateRoom = ::createRoom,
                        onToggleSpeak = ::toggleSpeaking,
                        onStartLocalTurn = ::toggleLocalSpeaking,
                        onExitLocalInterpreter = ::exitLocalInterpreter,
                        onRequestEndRoom = { updateState { it.copy(showEndRoomConfirm = true) } },
                        onConfirmEndRoom = ::endRoom,
                        onDismissEndRoom = { updateState { it.copy(showEndRoomConfirm = false) } },
                        onCopyLink = ::copyJoinLink,
                        onReplayTranslation = ::replayTranslation,
                        onTextInputChange = { value -> updateState { it.copy(textInput = value) } },
                        onSubmitText = ::submitTextMessage,
                        onTtsEnabled = ::setTtsEnabled,
                        onRequestMicPermission = ::requestMicPermissionIfMissing
                    )
                }
            }
        }
        verifyExistingSession()
        warmBackendConnection()
    }

    override fun onStart() {
        super.onStart()
        maybePrepareLocalRealtimeAfterResume()
    }

    override fun onStop() {
        if (uiState.value.setupStep == SetupStepLocalInterpreter && uiState.value.room == null) {
            if (recordingActive || uiState.value.speaking) {
                recordingActive = false
                runCatching { recordingThread?.join(RecordingStopJoinMs) }
                synchronized(recordingLock) {
                    recordedPcm = null
                }
                updateState {
                    it.copy(
                        speaking = false,
                        busy = false,
                        status = "앱이 백그라운드로 이동해 대면 통역 녹음을 중지했습니다."
                    )
                }
            }
            closeLocalRealtimeTurnClients()
            stopTtsPlayback()
        }
        super.onStop()
    }

    override fun onDestroy() {
        stopRoomPolling()
        recordingActive = false
        runCatching { recordingThread?.join(500) }
        closeRealtimeTurnClient()
        closeLocalRealtimeTurnClients()
        closeTranslationRealtimeClient()
        stopTtsPlayback()
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        StaffMediaButtonRouter.setHandler(null)
        textToSpeech?.shutdown()
        textToSpeech = null
        realtimeExecutor.shutdownNow()
        pollExecutor.shutdownNow()
        messageExecutor.shutdownNow()
        sessionExecutor.shutdownNow()
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (handleHardwareKey(event, "activity")) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (handleHardwareKey(event, "activity")) return true
        return super.onKeyUp(keyCode, event)
    }

    private fun handleAppBack() {
        val state = uiState.value
        when {
            state.showEndRoomConfirm -> updateState { it.copy(showEndRoomConfirm = false) }
            state.speaking -> stopActiveRecordingAndTranslate()
            state.busy -> updateState { it.copy(status = "처리 중입니다. 잠시만 기다려주세요.") }
            state.loggedIn && state.setupStep == SetupStepLocalInterpreter -> exitLocalInterpreter()
            state.room?.status == "ended" -> {
                stopRoomPolling()
                resetMessagePolling()
                closeRealtimeTurnClient()
                updateState {
                    it.copy(
                        room = null,
                        setupStep = SetupStepMode,
                        connected = false,
                        sourceDraft = "",
                        translatedDraft = "",
                        lastMessageSpeaker = "",
                        messages = emptyList(),
                        textInput = "",
                        localTurnDirection = LocalDirectionKoToPatient,
                        status = "통역 모드를 선택하세요."
                    )
                }
            }
            state.room != null -> updateState { it.copy(showEndRoomConfirm = true) }
            state.loggedIn && state.setupStep == SetupStepLanguage -> {
                updateState {
                    it.copy(
                        setupStep = SetupStepMode,
                        status = "통역 모드를 선택하세요."
                    )
                }
            }
            state.loggedIn && state.setupStep == SetupStepMode && state.room == null -> finishAndRemoveTask()
            state.loggedIn -> moveTaskToBack(true)
            else -> finishAndRemoveTask()
        }
    }

    private fun restorePreferences() {
        val prefs = getSharedPreferences("staff_app", MODE_PRIVATE)
        updateState {
            it.copy(
                backendUrl = prefs.getString("backendUrl", it.backendUrl) ?: it.backendUrl,
                email = prefs.getString("email", "") ?: "",
                rememberEmail = prefs.getBoolean("rememberEmail", true)
            )
        }
    }

    private fun persistPreferences() {
        val state = uiState.value
        getSharedPreferences("staff_app", MODE_PRIVATE)
            .edit()
            .putString("backendUrl", normalizedBackendUrl(state.backendUrl))
            .putBoolean("rememberEmail", state.rememberEmail)
            .apply {
                if (state.rememberEmail) putString("email", state.email.trim().lowercase(Locale.US))
                else remove("email")
            }
            .apply()
    }

    private fun updateRememberLogin(enabled: Boolean) {
        cookieJar.persistCookies = enabled
        if (!enabled) cookieJar.clear()
        val currentEmail = uiState.value.email.trim().lowercase(Locale.US)
        getSharedPreferences("staff_app", MODE_PRIVATE)
            .edit()
            .putBoolean("rememberEmail", enabled)
            .apply {
                if (enabled && currentEmail.isNotBlank()) putString("email", currentEmail)
                else remove("email")
            }
            .apply()
        updateState {
            it.copy(
                rememberEmail = enabled,
                status = if (enabled) {
                    it.status
                } else {
                    "이 기기의 저장된 로그인 정보가 삭제되었습니다."
                }
            )
        }
    }

    private fun verifyExistingSession() {
        val state = uiState.value
        val backend = normalizedBackendUrl(state.backendUrl)
        if (!state.rememberEmail || !backend.startsWith("https://")) return

        val meUrl = "$backend/api/me".toHttpUrl()
        if (!cookieJar.hasCookiesFor(meUrl)) return

        updateState { it.copy(status = "로그인 세션 확인 중...") }
        sessionExecutor.execute {
            runCatching {
                val data = getJson(meUrl.toString())
                val staff = data.getJSONObject("staff")
                val hospital = staff.getJSONObject("hospital")
                updateState {
                    it.copy(
                        backendUrl = backend,
                        loggedIn = true,
                        staffName = staff.optString("name", state.email),
                        hospitalName = hospital.optString("name", "병원"),
                        password = "",
                        busy = false,
                        status = "로그인 유지됨. 통역 모드를 선택하세요."
                    )
                }
                appendLog("기존 로그인 세션 복구")
            }.onFailure { caught ->
                if (uiState.value.loggedIn) return@onFailure
                cookieJar.clear()
                val message = userFacingError(caught)
                updateState { it.copy(loggedIn = false, status = "로그인이 필요합니다: $message") }
                appendLog("기존 로그인 세션 확인 실패: $message")
            }
        }
    }

    private fun warmBackendConnection() {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        if (!backend.startsWith("https://")) return

        sessionExecutor.execute {
            runCatching {
                val startedAt = SystemClock.elapsedRealtime()
                val request = Request.Builder().url("$backend/api/me").get().build()
                http.newCall(request).execute().use { response ->
                    appendLog("Warmup /api/me ${response.code} ${SystemClock.elapsedRealtime() - startedAt}ms")
                }
            }.onFailure {
                appendLog("Warmup skipped: ${it.message}")
            }
        }
    }

    private fun updateState(block: (StaffUiState) -> StaffUiState) {
        runOnUiThread { uiState.value = block(uiState.value) }
    }

    private fun appendLog(message: String) {
        val stamp = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
        updateState { it.copy(logs = (listOf("$stamp $message") + it.logs).take(40)) }
    }

    private fun refreshPermissionState() {
        val record = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        updateState { it.copy(recordAudioGranted = record) }
    }

    private fun requestMicPermissionIfMissing() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionLauncher.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
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
        val state = PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE)
            .setState(PlaybackState.STATE_PLAYING, 0L, 1f)
            .build()

        mediaSession = MediaSession(this, "MediVoiceMediaSession").apply {
            @Suppress("DEPRECATION")
            setMediaButtonReceiver(mediaButtonPendingIntent)
            setPlaybackState(state)
            setCallback(object : MediaSession.Callback() {
                override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
                    @Suppress("DEPRECATION")
                    val event = mediaButtonIntent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    return if (event != null && handleHardwareKey(event, "media session")) {
                        true
                    } else {
                        super.onMediaButtonEvent(mediaButtonIntent)
                    }
                }
            })
            isActive = true
        }
    }

    private fun handleHardwareKey(event: KeyEvent, source: String): Boolean {
        if (!isSupportedHardwareKey(event.keyCode)) return false
        if (event.action != KeyEvent.ACTION_DOWN) return true

        val keyName = KeyEvent.keyCodeToString(event.keyCode)
        if (event.repeatCount > 0) {
            updateState { it.copy(lastKey = "$keyName 반복 입력") }
            return true
        }

        val eventTime = if (event.eventTime > 0L) event.eventTime else System.currentTimeMillis()
        val signature = "${event.keyCode}:${event.deviceId}:${event.scanCode}"
        if (signature == lastHardwareKeySignature && eventTime - lastHardwareKeyEventTime in 0L..250L) {
            updateState { it.copy(lastKey = "$keyName 중복 입력 무시") }
            return true
        }

        lastHardwareKeySignature = signature
        lastHardwareKeyEventTime = eventTime
        updateState { it.copy(lastKey = "$keyName · $source") }
        if (uiState.value.setupStep == SetupStepLocalInterpreter && uiState.value.room == null) {
            toggleLocalSpeaking(LocalDirectionKoToPatient)
        } else {
            toggleSpeaking()
        }
        return true
    }

    private fun initializeTts() {
        textToSpeech = TextToSpeech(this, { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.setAudioAttributes(ttsAudioAttributes)
                textToSpeech?.setOnUtteranceProgressListener(ttsProgressListener())
            }
            updateState {
                it.copy(ttsStatus = if (status == TextToSpeech.SUCCESS) "휴대폰 미디어 출력으로 재생" else "TTS 초기화 실패")
            }
        }, "com.google.android.tts")
        textToSpeech?.setAudioAttributes(ttsAudioAttributes)
        textToSpeech?.setOnUtteranceProgressListener(ttsProgressListener())
    }

    private fun ttsProgressListener() = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
            if (utteranceId?.startsWith(TtsSpeechUtterancePrefix) == true) {
                mainHandler.post { handleTtsStarted(utteranceId) }
            }
        }

        override fun onDone(utteranceId: String?) {
            if (utteranceId?.startsWith(TtsSpeechUtterancePrefix) == true) {
                mainHandler.post { handleTtsFinished(utteranceId) }
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
            if (utteranceId?.startsWith(TtsSpeechUtterancePrefix) == true) {
                mainHandler.post { handleTtsFinished(utteranceId) }
            }
        }

        override fun onError(utteranceId: String?, errorCode: Int) {
            if (utteranceId?.startsWith(TtsSpeechUtterancePrefix) == true) {
                mainHandler.post { handleTtsFinished(utteranceId) }
            }
        }
    }

    private fun setTtsEnabled(enabled: Boolean) {
        if (!enabled) stopTtsPlayback()
        updateState { it.copy(ttsEnabled = enabled) }
    }

    private fun stopTtsPlayback() {
        activeTtsUtteranceId = ""
        runCatching { textToSpeech?.stop() }
        setTtsPlaybackActive(false)
    }

    private fun handleTtsStarted(utteranceId: String) {
        activeTtsUtteranceId = utteranceId
        setTtsPlaybackActive(true)
    }

    private fun handleTtsFinished(utteranceId: String) {
        if (activeTtsUtteranceId != utteranceId) return
        activeTtsUtteranceId = ""
        setTtsPlaybackActive(false)
    }

    private fun scheduleTtsWatchdog(utteranceId: String, text: String) {
        val delayMs = ttsWatchdogDelayMs(text)
        mainHandler.postDelayed({
            if (activeTtsUtteranceId == utteranceId && ttsPlaybackActive) {
                appendLog("TTS watchdog released mic lock")
                handleTtsFinished(utteranceId)
            }
        }, delayMs)
    }

    private fun ttsWatchdogDelayMs(text: String): Long {
        return (4_000L + text.length * 220L).coerceIn(6_000L, 60_000L)
    }

    private fun setTtsPlaybackActive(active: Boolean) {
        ttsPlaybackActive = active
        updateState { state ->
            val localActive = state.setupStep == SetupStepLocalInterpreter && state.room == null
            state.copy(
                ttsPlaybackActive = active,
                ttsStatus = if (active) "음성 재생 중" else "휴대폰 미디어 출력으로 재생",
                status = when {
                    active && localActive -> "음성 재생 중입니다. 끝난 뒤 다음 마이크를 눌러주세요."
                    !active && localActive && state.status.startsWith("음성 재생 중") -> "재생 완료. 다음 발화 쪽의 마이크를 눌러주세요."
                    else -> state.status
                }
            )
        }
    }

    private fun login() {
        val state = uiState.value
        val backend = normalizedBackendUrl(state.backendUrl)
        if (state.email.isBlank() || state.password.isBlank()) {
            updateState { it.copy(status = "이메일과 비밀번호를 입력하세요.") }
            return
        }
        if (!backend.startsWith("https://")) {
            updateState { it.copy(status = "운영 서버 주소는 https://로 시작해야 합니다.") }
            return
        }
        updateState { it.copy(busy = true, status = "로그인 중...") }
        cookieJar.persistCookies = state.rememberEmail
        if (!state.rememberEmail) cookieJar.clear()
        executor.execute {
            runCatching {
                val payload = JSONObject()
                    .put("email", state.email.trim())
                    .put("password", state.password)
                    .put("remember", state.rememberEmail)
                    .toString()
                val data = postJson("$backend/api/auth/login", payload)
                val staff = data.getJSONObject("staff")
                val hospital = staff.getJSONObject("hospital")
                persistPreferences()
                updateState {
                    it.copy(
                        backendUrl = backend,
                        password = "",
                        loggedIn = true,
                        staffName = staff.optString("name", state.email),
                        hospitalName = hospital.optString("name", "병원"),
                        status = "로그인 완료. 통역 모드를 선택하세요.",
                        busy = false
                    )
                }
                appendLog("로그인 성공")
            }.onFailure { caught ->
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "로그인 실패: $message") }
                appendLog("로그인 실패: $message")
            }
        }
    }

    private fun logout() {
        stopRoomPolling()
        resetMessagePolling()
        closeRealtimeTurnClient()
        closeLocalRealtimeTurnClients()
        stopTtsPlayback()
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        executor.execute {
            runCatching {
                Request.Builder().url("$backend/api/auth/logout").post(ByteArray(0).toRequestBody()).build().let { request ->
                    http.newCall(request).execute().close()
                }
            }
            cookieJar.clear()
            updateState {
                it.copy(
                    loggedIn = false,
                    staffName = "",
                    hospitalName = "",
                    room = null,
                    setupStep = SetupStepMode,
                    connected = false,
                    speaking = false,
                    sourceDraft = "",
                    translatedDraft = "",
                    lastMessageSpeaker = "",
                    localTurnDirection = LocalDirectionKoToPatient,
                    messages = emptyList(),
                    textInput = "",
                    status = "로그아웃되었습니다."
                )
                }
        }
    }

    private fun createRoom() {
        val state = uiState.value
        if (state.selectedRoomMode == RoomModeLocalInterpreter) {
            startLocalInterpreter()
            return
        }

        val backend = normalizedBackendUrl(state.backendUrl)
        val modeLabel = if (state.selectedRoomMode == "procedure") "시술" else "상담"
        closeRealtimeTurnClient()
        updateState { it.copy(busy = true, status = "$modeLabel 통역방 생성 중...") }
        executor.execute {
            runCatching {
                val payload = JSONObject()
                    .put("patientLanguage", state.selectedLanguage)
                    .put("roomMode", state.selectedRoomMode)
                    .toString()
                val data = postJson("$backend/api/rooms", payload)
                val room = data.getJSONObject("room")
                var roomInfo = roomInfoFromJson(room, backend)
                if (roomInfo.joinUrl.isBlank() && roomInfo.id.isNotBlank()) {
                    val refreshed = getJson("$backend/api/rooms/${roomInfo.id}").getJSONObject("room")
                    roomInfo = roomInfoFromJson(refreshed, backend, roomInfo)
                }
                resetMessagePolling()
                updateState {
                    it.copy(
                        room = roomInfo,
                        setupStep = SetupStepMode,
                        connected = false,
                        speaking = false,
                        sourceDraft = "",
                        translatedDraft = "",
                        lastMessageSpeaker = "",
                        messages = emptyList(),
                        textInput = "",
                        status = "$modeLabel 통역방 생성 완료. QR을 환자에게 보여주세요.",
                        busy = false
                    )
                }
                appendLog("$modeLabel 방 생성: ${roomInfo.id}")
                warmTtsForRoom(roomInfo)
                startRoomPolling()
                prepareRealtimeTurnClientAsync(roomInfo, force = true)
            }.onFailure { caught ->
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "$modeLabel 방 생성 실패: $message") }
                appendLog("$modeLabel 방 생성 실패: $message")
            }
        }
    }

    private fun startLocalInterpreter() {
        val state = uiState.value
        closeRealtimeTurnClient()
        stopRoomPolling()
        resetMessagePolling()
        updateState {
            it.copy(
                room = null,
                setupStep = SetupStepLocalInterpreter,
                connected = true,
                speaking = false,
                busy = false,
                ttsPlaybackActive = false,
                sourceDraft = "",
                translatedDraft = "",
                lastMessageSpeaker = "",
                localTurnDirection = LocalDirectionKoToPatient,
                messages = emptyList(),
                textInput = "",
                status = "대면 통역 준비됨. 말할 쪽의 마이크를 누르세요."
            )
        }
        warmTtsLanguage(Locale.KOREA, "한국어")
        patientLanguages.firstOrNull { it.code == state.selectedLanguage }?.let { language ->
            warmTtsLanguage(language.ttsLocale, language.ko)
        }
        closeLocalRealtimeTurnClients()
        prepareLocalRealtimeTurnClientsAsync(state.selectedLanguage, force = true)
        appendLog("대면 통역 시작: ${state.selectedLanguage}")
    }

    private fun exitLocalInterpreter() {
        recordingActive = false
        runCatching { recordingThread?.join(RecordingStopJoinMs) }
        closeLocalRealtimeTurnClients()
        stopTtsPlayback()
        synchronized(recordingLock) {
            recordedPcm = null
        }
        updateState {
            it.copy(
                setupStep = SetupStepLanguage,
                connected = false,
                speaking = false,
                busy = false,
                sourceDraft = "",
                translatedDraft = "",
                lastMessageSpeaker = "",
                localTurnDirection = LocalDirectionKoToPatient,
                ttsPlaybackActive = false,
                status = languageSelectionStatus(it.selectedRoomMode)
            )
        }
    }

    private fun roomInfoFromJson(room: JSONObject, backend: String, fallback: RoomInfo? = null): RoomInfo {
        val joinCode = room.optString("patientJoinCode", "").ifBlank { "" }
        val joinedAt = if (room.isNull("patientJoinedAt")) null else room.optString("patientJoinedAt").takeIf { it.isNotBlank() && it != "null" }
        val roomMode = room.optString("roomMode", fallback?.roomMode ?: uiState.value.selectedRoomMode)
        return RoomInfo(
            id = room.optString("id", fallback?.id.orEmpty()),
            patientLanguage = room.optString("patientLanguage", fallback?.patientLanguage ?: uiState.value.selectedLanguage),
            joinUrl = if (joinCode.isNotBlank()) "$backend/room/join/$joinCode?mode=$roomMode" else fallback?.joinUrl.orEmpty(),
            roomMode = roomMode,
            status = room.optString("status", fallback?.status ?: "waiting_for_patient"),
            patientJoinedAt = joinedAt
        )
    }

    private fun startRoomPolling() {
        roomPollingActive = true
        messagePollingActive = true
        ensureTranslationRealtimeForRoom(uiState.value.room)
        mainHandler.removeCallbacks(roomPollRunnable)
        mainHandler.removeCallbacks(messagePollRunnable)
        mainHandler.post(roomPollRunnable)
        mainHandler.post(messagePollRunnable)
    }

    private fun stopRoomPolling() {
        roomPollingActive = false
        messagePollingActive = false
        mainHandler.removeCallbacks(roomPollRunnable)
        mainHandler.removeCallbacks(messagePollRunnable)
        closeTranslationRealtimeClient()
    }

    private fun resetMessagePolling() {
        messagePollingInitialized = false
        synchronized(seenMessageIds) {
            messageCursor = null
            seenMessageIds.clear()
        }
    }

    private fun roomPollDelayMs(): Long {
        val room = uiState.value.room
        return when {
            room?.patientJoinedAt == null -> 500L
            room.status == "patient_speaking" || room.status == "translating_to_staff" -> 500L
            else -> 900L
        }
    }

    private fun messagePollDelayMs(): Long {
        val room = uiState.value.room
        return when {
            room?.patientJoinedAt == null -> 700L
            room.status == "patient_speaking" || room.status == "translating_to_staff" -> 225L
            else -> 850L
        }
    }

    private fun closeRealtimeTurnClient() {
        realtimeTurnActive = false
        realtimePreparingRoomId = ""
        if (activeRealtimeTurnClient === realtimeTurnClient) activeRealtimeTurnClient = null
        runCatching { realtimeTurnClient?.close() }
        realtimeTurnClient = null
        realtimeTurnRoomId = ""
    }

    private fun closeLocalRealtimeTurnClients() {
        val clients = synchronized(localRealtimeLock) {
            val values = localRealtimeTurnClients.values.toList()
            localRealtimeTurnClients.clear()
            localRealtimePreparingKeys.clear()
            values
        }
        clients.forEach { client ->
            if (activeRealtimeTurnClient === client) activeRealtimeTurnClient = null
            runCatching { client.close() }
        }
        realtimeTurnActive = false
    }

    private fun maybePrepareLocalRealtimeAfterResume() {
        val state = uiState.value
        if (
            state.loggedIn &&
            state.setupStep == SetupStepLocalInterpreter &&
            state.room == null &&
            !state.busy &&
            !state.speaking
        ) {
            prepareLocalRealtimeTurnClientsAsync(state.selectedLanguage)
        }
    }

    private fun localRealtimeKey(patientLanguage: String, direction: String): String {
        return "local:$patientLanguage:$direction"
    }

    private fun closeTranslationRealtimeClient() {
        runCatching { translationRealtimeClient?.close() }
        translationRealtimeClient = null
        translationRealtimeRoomId = ""
    }

    private fun ensureTranslationRealtimeForRoom(room: RoomInfo?) {
        if (room == null || room.roomMode == RoomModeLocalInterpreter) {
            closeTranslationRealtimeClient()
            return
        }
        if (translationRealtimeRoomId == room.id && translationRealtimeClient != null) return

        closeTranslationRealtimeClient()
        translationRealtimeRoomId = room.id
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        realtimeExecutor.execute {
            runCatching {
                val config = requestSupabaseRealtimeConfig(backend)
                if (!config.enabled) {
                    appendLog("Supabase realtime disabled; using message polling")
                    return@runCatching
                }
                val client = SupabaseTranslationRealtimeClient(
                    http = http,
                    config = config,
                    roomId = room.id,
                    mainHandler = mainHandler,
                    log = ::appendLog,
                    onMessage = ::handleRealtimeTranslationMessage
                )
                mainHandler.post {
                    if (uiState.value.room?.id == room.id && translationRealtimeRoomId == room.id) {
                        translationRealtimeClient = client
                        client.connect()
                    } else {
                        client.close()
                    }
                }
            }.onFailure {
                appendLog("Supabase realtime config failed: ${it.message}")
            }
        }
    }

    private fun requestSupabaseRealtimeConfig(backend: String): SupabaseRealtimeConfig {
        val data = getJson("$backend/api/realtime/client-config")
        val enabled = data.optBoolean("enabled", false)
        if (!enabled) return SupabaseRealtimeConfig(enabled = false)
        return SupabaseRealtimeConfig(
            enabled = true,
            supabaseUrl = data.optString("supabaseUrl"),
            supabaseAnonKey = data.optString("supabaseAnonKey")
        )
    }

    private fun handleRealtimeTranslationMessage(message: JSONObject) {
        if (!rememberMessage(message)) return
        appendConversationMessage(messageFromJson(message, uiState.value.room?.patientLanguage))
        if (message.optString("speaker") == "patient") {
            messagePollingInitialized = true
            handleIncomingPatientMessage(message, appendToConversation = false, speak = true)
            appendLog("환자 발화 실시간 수신")
        }
    }

    private fun pollCurrentRoom() {
        if (!roomPollingActive || roomPollInFlight) return
        val snapshot = uiState.value
        val room = snapshot.room ?: return
        if (!snapshot.loggedIn) return

        val backend = normalizedBackendUrl(snapshot.backendUrl)
        roomPollInFlight = true
        pollExecutor.execute {
            runCatching {
                val data = getJson("$backend/api/rooms/${room.id}")
                val updatedRoom = roomInfoFromJson(data.getJSONObject("room"), backend, room)
                val previousRoom = uiState.value.room
                val joinedNow = previousRoom?.patientJoinedAt == null && updatedRoom.patientJoinedAt != null
                val ended = updatedRoom.status == "ended"

                updateState { current ->
                    if (current.room?.id != updatedRoom.id) {
                        current
                    } else {
                        current.copy(
                            room = updatedRoom,
                            connected = updatedRoom.patientJoinedAt != null && !ended,
                            speaking = if (ended) false else current.speaking,
                            busy = if (ended) false else current.busy,
                            status = when {
                                ended -> "방이 종료되었습니다."
                                joinedNow -> "환자가 입장했습니다. 마이크를 눌러 말하세요."
                                updatedRoom.patientJoinedAt != null && current.status.contains("QR") -> "환자가 입장했습니다. 마이크를 눌러 말하세요."
                                else -> current.status
                            }
                        )
                    }
                }

                if (joinedNow) appendLog("환자 입장 확인")
                if (joinedNow) warmTtsForRoom(updatedRoom)
                if (ended) {
                    stopRoomPolling()
                } else {
                    if (updatedRoom.patientJoinedAt != null) {
                        prepareRealtimeTurnClientAsync(updatedRoom, force = joinedNow)
                        ensureTranslationRealtimeForRoom(updatedRoom)
                    }
                }
            }.onFailure { caught ->
                appendLog("방 상태 확인 실패: ${userFacingError(caught)}")
            }
            roomPollInFlight = false
        }
    }

    private fun pollCurrentRoomMessages() {
        if (!messagePollingActive || messagePollInFlight) return
        val snapshot = uiState.value
        val room = snapshot.room ?: return
        if (!snapshot.loggedIn || room.patientJoinedAt == null) return

        val backend = normalizedBackendUrl(snapshot.backendUrl)
        messagePollInFlight = true
        messageExecutor.execute {
            runCatching {
                pollRoomMessages(room, backend)
            }.onFailure { caught ->
                appendLog("메시지 확인 실패: ${userFacingError(caught)}")
            }
            messagePollInFlight = false
        }
    }

    private fun pollRoomMessages(room: RoomInfo, backend: String) {
        val urlBuilder = "$backend/api/rooms/${room.id}/messages".toHttpUrl().newBuilder()
        synchronized(seenMessageIds) { messageCursor }?.let { urlBuilder.addQueryParameter("after", it) }

        val data = getJson(urlBuilder.build().toString())
        val messages = data.optJSONArray("messages") ?: return
        for (index in 0 until messages.length()) {
            val message = messages.optJSONObject(index) ?: continue
            if (!rememberMessage(message)) continue
            appendConversationMessage(messageFromJson(message, room.patientLanguage))
            if (message.optString("speaker") == "patient") {
                handleIncomingPatientMessage(message, appendToConversation = false, speak = messagePollingInitialized)
            }
        }
        messagePollingInitialized = true
    }

    private fun rememberMessage(message: JSONObject): Boolean {
        val id = message.optString("id")
        val createdAt = message.optString("createdAt")
        synchronized(seenMessageIds) {
            if (createdAt.isNotBlank() && (messageCursor == null || createdAt > (messageCursor ?: ""))) {
                messageCursor = createdAt
            }
            if (id.isNotBlank() && !seenMessageIds.add(id)) return false
            return true
        }
    }

    private fun messageFromJson(message: JSONObject, fallbackPatientLanguage: String? = null): StaffMessage {
        val speaker = message.optString("speaker")
        val targetLanguage = message.optString("targetLanguage").takeIf { it.isNotBlank() && it != "null" }
        val displayLanguage = targetLanguage ?: if (speaker == "patient") {
            "ko"
        } else {
            fallbackPatientLanguage ?: uiState.value.room?.patientLanguage ?: uiState.value.selectedLanguage
        }
        return StaffMessage(
            id = message.optString("id", "message-${System.currentTimeMillis()}"),
            speaker = speaker,
            sourceText = if (speaker == "staff") normalizeKoreanSourceText(message.optString("sourceText")) else message.optString("sourceText"),
            text = normalizeClinicText(message.optString("text"), displayLanguage),
            targetLanguage = targetLanguage,
            createdAt = message.optString("createdAt", System.currentTimeMillis().toString())
        )
    }

    private fun appendConversationMessage(message: StaffMessage) {
        updateState {
            val nextMessages = (it.messages.filter { existing -> existing.id != message.id } + message)
                .sortedBy { item -> item.createdAt }
                .takeLast(80)
            it.copy(messages = nextMessages)
        }
    }

    private fun handleIncomingPatientMessage(message: JSONObject, appendToConversation: Boolean = true, speak: Boolean = true) {
        val parsedMessage = messageFromJson(message, "ko")
        val source = message.optString("sourceText")
        val translated = parsedMessage.text
        if (translated.isBlank()) return

        if (appendToConversation) appendConversationMessage(parsedMessage)
        updateState {
            it.copy(
                sourceDraft = source,
                translatedDraft = translated,
                lastMessageSpeaker = "patient",
                status = "환자 발화가 번역되었습니다. 화면을 확인하세요."
            )
        }
        if (speak) {
            speakKoreanText(translated)
            appendLog("환자 발화 수신")
        }
    }

    private fun toggleSpeaking() {
        val state = uiState.value
        if (state.speaking) {
            stopStaffRecordingAndTranslate()
            return
        }
        if (state.busy) return
        if (state.ttsPlaybackActive || ttsPlaybackActive) {
            updateState { it.copy(status = "음성 재생이 끝난 뒤 마이크를 눌러주세요.") }
            return
        }
        if (state.room == null) {
            updateState { it.copy(status = "먼저 통역방을 생성하세요.") }
            return
        }
        if (state.room.status == "ended") {
            updateState { it.copy(status = "이미 종료된 방입니다. 새 통역방을 생성하세요.") }
            return
        }
        if (state.room.patientJoinedAt == null) {
            updateState { it.copy(status = "환자가 QR로 입장하면 마이크가 활성화됩니다.") }
            return
        }
        if (!canStaffStartTurn(state.room.status)) {
            updateState { it.copy(status = statusHelperText(state.room.status)) }
            return
        }
        if (!state.recordAudioGranted) {
            updateState { it.copy(status = "마이크 권한이 필요합니다.") }
            requestMicPermissionIfMissing()
            return
        }

        beginStaffTurn()
    }

    private fun stopActiveRecordingAndTranslate() {
        val state = uiState.value
        if (state.setupStep == SetupStepLocalInterpreter && state.room == null) {
            stopLocalRecordingAndTranslate()
        } else {
            stopStaffRecordingAndTranslate()
        }
    }

    private fun toggleLocalSpeaking(direction: String) {
        val state = uiState.value
        if (state.speaking) {
            stopLocalRecordingAndTranslate()
            return
        }
        if (state.busy) return
        if (state.ttsPlaybackActive || ttsPlaybackActive) {
            updateState { it.copy(status = "음성 재생이 끝난 뒤 마이크를 눌러주세요.") }
            return
        }
        if (state.setupStep != SetupStepLocalInterpreter || state.room != null) return
        if (!state.recordAudioGranted) {
            updateState { it.copy(status = "마이크 권한이 필요합니다.") }
            requestMicPermissionIfMissing()
            return
        }

        val normalizedDirection = if (direction == LocalDirectionPatientToKo) LocalDirectionPatientToKo else LocalDirectionKoToPatient
        updateState {
            it.copy(
                speaking = true,
                busy = false,
                localTurnDirection = normalizedDirection,
                sourceDraft = "",
                translatedDraft = "",
                status = if (normalizedDirection == LocalDirectionKoToPatient) {
                    "한국어를 듣고 있습니다. 끝나면 다시 누르세요."
                } else {
                    "환자 언어를 듣고 있습니다. 끝나면 다시 누르세요."
                }
            )
        }
        realtimeTurnActive = tryStartPreparedLocalRealtimeTurn(state.selectedLanguage, normalizedDirection)
        val recordingStatus = if (realtimeTurnActive) {
            "Realtime 연결됨. 말하는 중입니다. 끝나면 다시 누르세요."
        } else {
            "Realtime 준비 중입니다. 녹음은 시작됐으니 계속 말씀하세요."
        }
        startStaffRecording(recordingStatus)
        appendLog("대면 통역 녹음 시작: $normalizedDirection")
    }

    private fun beginStaffTurn() {
        val room = uiState.value.room ?: return
        val optimisticRoom = room.copy(status = "staff_speaking")
        updateState {
            it.copy(
                room = optimisticRoom,
                busy = false,
                speaking = true,
                sourceDraft = "",
                translatedDraft = "",
                status = "Realtime 준비 중입니다. 녹음은 바로 시작됐으니 말씀하세요."
            )
        }
        realtimeTurnActive = tryStartPreparedRealtimeTurn(room)
        startStaffRecording()
        executor.execute {
            runCatching {
                val updatedRoom = transitionRoomState(room, "staff_speaking")
                updateState { current ->
                    if (current.room?.id == updatedRoom.id && current.speaking) {
                        current.copy(room = updatedRoom, busy = false)
                    } else {
                        current
                    }
                }
            }.onFailure { caught ->
                recordingActive = false
                realtimeTurnActive = false
                synchronized(recordingLock) {
                    recordedPcm = null
                }
                closeRealtimeTurnClient()
                val message = userFacingError(caught)
                updateState {
                    it.copy(
                        room = room,
                        speaking = false,
                        busy = false,
                        status = "지금은 말할 수 없습니다: $message"
                    )
                }
                appendLog("말하기 시작 실패: $message")
            }
        }
    }

    private fun requestRealtimeToken(room: RoomInfo): RealtimeToken {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val payload = JSONObject()
            .put("roomId", room.id)
            .put("role", "staff")
            .put("direction", "staff_to_patient")
            .put("manualTurn", true)
            .toString()
        val startedAt = SystemClock.elapsedRealtime()
        val data = postJson("$backend/api/realtime/session-token", payload)
        appendLog("Realtime token ${SystemClock.elapsedRealtime() - startedAt}ms")
        return realtimeTokenFromJson(data)
    }

    private fun requestLocalRealtimeToken(patientLanguage: String, direction: String): RealtimeToken {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val payload = JSONObject()
            .put("patientLanguage", patientLanguage)
            .put("direction", direction)
            .put("manualTurn", true)
            .toString()
        val startedAt = SystemClock.elapsedRealtime()
        val data = postJson("$backend/api/realtime/local-session-token", payload)
        appendLog("Local Realtime token ${SystemClock.elapsedRealtime() - startedAt}ms")
        return realtimeTokenFromJson(data)
    }

    private fun realtimeTokenFromJson(data: JSONObject): RealtimeToken {
        val token = data.getJSONObject("token")
        val clientSecret = token.opt("client_secret")
        val value = when (clientSecret) {
            is JSONObject -> clientSecret.optString("value")
            is String -> clientSecret
            else -> token.optString("value")
        }.ifBlank { error("Realtime token response was missing a client secret") }
        return RealtimeToken(
            value = value,
            model = token.optString("realtimeModel", "gpt-realtime").ifBlank { "gpt-realtime" }
        )
    }

    private fun ensureRealtimeTurnClient(room: RoomInfo): AndroidRealtimeTurnClient {
        val current = realtimeTurnClient
        if (current != null && realtimeTurnRoomId == room.id) return current

        closeRealtimeTurnClient()
        val token = requestRealtimeToken(room)
        return AndroidRealtimeTurnClient(http, token, ::appendLog).also { client ->
            client.connect()
            realtimeTurnClient = client
            realtimeTurnRoomId = room.id
        }
    }

    private fun prepareRealtimeTurnClientAsync(room: RoomInfo, force: Boolean = false) {
        if (room.status == "ended") return
        if (recordingActive || realtimeTurnActive) return

        val current = realtimeTurnClient
        if (!force && current != null && realtimeTurnRoomId == room.id && current.isReady()) return
        if (realtimePreparingRoomId == room.id) return

        realtimePreparingRoomId = room.id
        realtimeExecutor.execute {
            runCatching {
                val startedAt = SystemClock.elapsedRealtime()
                appendLog("Realtime preparing")
                val token = requestRealtimeToken(room)
                val client = AndroidRealtimeTurnClient(http, token, ::appendLog)
                client.connect()
                if (uiState.value.room?.id == room.id && !recordingActive && !realtimeTurnActive) {
                    runCatching { realtimeTurnClient?.close() }
                    realtimeTurnClient = client
                    realtimeTurnRoomId = room.id
                    appendLog("Realtime ready ${SystemClock.elapsedRealtime() - startedAt}ms")
                } else {
                    client.close()
                }
            }.onFailure {
                appendLog("Realtime prepare failed: ${it.message}")
                if (realtimeTurnRoomId == room.id) {
                    runCatching { realtimeTurnClient?.close() }
                    realtimeTurnClient = null
                    realtimeTurnRoomId = ""
                }
            }
            if (realtimePreparingRoomId == room.id) realtimePreparingRoomId = ""
        }
    }

    private fun tryStartPreparedRealtimeTurn(room: RoomInfo): Boolean {
        val realtime = realtimeTurnClient
        if (realtime == null || realtimeTurnRoomId != room.id || !realtime.isReady()) {
            prepareRealtimeTurnClientAsync(room)
            appendLog("Realtime not ready, recording with upload fallback")
            return false
        }

        return runCatching {
            realtime.startTurn()
            activeRealtimeTurnClient = realtime
            appendLog("Realtime turn started")
            true
        }.onFailure {
            appendLog("Realtime start failed, using upload fallback: ${it.message}")
            activeRealtimeTurnClient = null
            closeRealtimeTurnClient()
            prepareRealtimeTurnClientAsync(room, force = true)
        }.getOrDefault(false)
    }

    private fun prepareLocalRealtimeTurnClientsAsync(patientLanguage: String, force: Boolean = false) {
        prepareLocalRealtimeTurnClientAsync(patientLanguage, LocalDirectionKoToPatient, force)
        prepareLocalRealtimeTurnClientAsync(patientLanguage, LocalDirectionPatientToKo, force)
    }

    private fun prepareLocalRealtimeTurnClientAsync(patientLanguage: String, direction: String, force: Boolean = false) {
        if (recordingActive || realtimeTurnActive) return
        val key = localRealtimeKey(patientLanguage, direction)
        synchronized(localRealtimeLock) {
            val current = localRealtimeTurnClients[key]
            if (!force && current != null && current.isReady()) return
            if (localRealtimePreparingKeys.contains(key)) return
            localRealtimePreparingKeys.add(key)
        }

        realtimeExecutor.execute {
            runCatching {
                val startedAt = SystemClock.elapsedRealtime()
                appendLog("Local Realtime preparing: $direction")
                val token = requestLocalRealtimeToken(patientLanguage, direction)
                val client = AndroidRealtimeTurnClient(http, token, ::appendLog)
                client.connect()
                val state = uiState.value
                val localSetupActive = state.setupStep == SetupStepLocalInterpreter ||
                    (state.setupStep == SetupStepLanguage && state.selectedRoomMode == RoomModeLocalInterpreter)
                if (
                    localSetupActive &&
                    state.room == null &&
                    state.selectedLanguage == patientLanguage &&
                    !recordingActive &&
                    !realtimeTurnActive
                ) {
                    val previous = synchronized(localRealtimeLock) {
                        val old = localRealtimeTurnClients[key]
                        localRealtimeTurnClients[key] = client
                        localRealtimePreparingKeys.remove(key)
                        old
                    }
                    runCatching { previous?.close() }
                    appendLog("Local Realtime ready ${SystemClock.elapsedRealtime() - startedAt}ms: $direction")
                } else {
                    client.close()
                    synchronized(localRealtimeLock) { localRealtimePreparingKeys.remove(key) }
                }
            }.onFailure {
                appendLog("Local Realtime prepare failed: ${it.message}")
                synchronized(localRealtimeLock) { localRealtimePreparingKeys.remove(key) }
            }
        }
    }

    private fun tryStartPreparedLocalRealtimeTurn(patientLanguage: String, direction: String): Boolean {
        val key = localRealtimeKey(patientLanguage, direction)
        val realtime = synchronized(localRealtimeLock) { localRealtimeTurnClients[key] }
        if (realtime == null || !realtime.isReady()) {
            prepareLocalRealtimeTurnClientAsync(patientLanguage, direction)
            appendLog("Local Realtime not ready, recording with upload fallback")
            return false
        }

        return runCatching {
            realtime.startTurn()
            activeRealtimeTurnClient = realtime
            appendLog("Local Realtime turn started: $direction")
            true
        }.onFailure {
            appendLog("Local Realtime start failed, using upload fallback: ${it.message}")
            activeRealtimeTurnClient = null
            synchronized(localRealtimeLock) {
                localRealtimeTurnClients.remove(key)
            }?.close()
            prepareLocalRealtimeTurnClientAsync(patientLanguage, direction, force = true)
        }.getOrDefault(false)
    }

    @SuppressLint("MissingPermission")
    private fun startStaffRecording(statusOverride: String? = null) {
        if (recordingActive) return

        synchronized(recordingLock) {
            recordedPcm = ByteArrayOutputStream()
        }
        recordingActive = true
        val recordingStatus = statusOverride ?: if (realtimeTurnActive) {
            "Realtime 연결됨. 말하는 중입니다. 끝나면 다시 누르세요."
        } else {
            "Realtime 준비 중입니다. 녹음은 시작됐으니 계속 말씀하세요."
        }
        updateState {
            it.copy(
                busy = false,
                connected = true,
                speaking = true,
                sourceDraft = "",
                translatedDraft = "",
                status = recordingStatus
            )
        }
        appendLog(if (realtimeTurnActive) "마이크 시작: Realtime streaming" else "마이크 시작: Realtime 준비 중, 안전 녹음")

        recordingThread = Thread {
            var recorder: AudioRecord? = null
            runCatching {
                val sampleRate = RealtimePcmSampleRate
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
                if (activeRecorder.state != AudioRecord.STATE_INITIALIZED) error("AudioRecord did not initialize")

                val buffer = ShortArray(bufferBytes / 2)
                val byteBuffer = ByteArray(buffer.size * 2)
                val startedAt = System.currentTimeMillis()
                activeRecorder.startRecording()

                while (recordingActive && System.currentTimeMillis() - startedAt < StaffRecordingMaxMs) {
                    val count = activeRecorder.read(buffer, 0, buffer.size)
                    if (count <= 0) continue
                    for (index in 0 until count) {
                        val value = buffer[index].toInt()
                        byteBuffer[index * 2] = (value and 0xff).toByte()
                        byteBuffer[index * 2 + 1] = ((value shr 8) and 0xff).toByte()
                    }
                    synchronized(recordingLock) {
                        recordedPcm?.write(byteBuffer, 0, count * 2)
                    }
                    if (realtimeTurnActive) {
                        activeRealtimeTurnClient?.appendPcm(byteBuffer, count * 2)
                    }
                }

                if (recordingActive) {
                    recordingActive = false
                    mainHandler.post { stopActiveRecordingAndTranslate() }
                }
            }.onFailure { caught ->
                recordingActive = false
                realtimeTurnActive = false
                activeRealtimeTurnClient = null
                recoverRoomToReady("마이크 녹음 실패")
                val message = userFacingError(caught)
                updateState { it.copy(speaking = false, busy = false, status = "마이크 녹음 실패: $message") }
                appendLog("마이크 녹음 실패: $message")
            }
            runCatching { recorder?.stop() }
            runCatching { recorder?.release() }
        }.also { it.start() }
    }

    private fun stopStaffRecordingAndTranslate() {
        if (!uiState.value.speaking && !recordingActive) return

        recordingActive = false
        updateState { it.copy(speaking = false, busy = true, status = "번역 중입니다...") }
        appendLog("마이크 종료: 서버 번역 요청")

        executor.execute {
            runCatching {
                val joinStartedAt = SystemClock.elapsedRealtime()
                recordingThread?.join(RecordingStopJoinMs)
                appendLog("Recorder stop wait ${SystemClock.elapsedRealtime() - joinStartedAt}ms")
                val pcm = synchronized(recordingLock) {
                    recordedPcm?.toByteArray() ?: ByteArray(0)
                }
                synchronized(recordingLock) {
                    recordedPcm = null
                }
                if (pcm.size < 1600) error("녹음된 음성이 너무 짧습니다.")

                val room = uiState.value.room ?: error("Room is missing")
                val result = translateStaffVoiceTurn(room, pcm)
                val message = result.getJSONObject("message")
                rememberMessage(message)
                val parsedMessage = messageFromJson(message, room.patientLanguage)
                appendConversationMessage(parsedMessage)
                val source = message.optString("sourceText")
                val translated = parsedMessage.text

                updateState {
                    it.copy(
                        room = room.copy(status = "ready"),
                        busy = false,
                        sourceDraft = source,
                        translatedDraft = translated,
                        lastMessageSpeaker = "staff",
                        status = "번역 완료. 다시 말하려면 마이크를 누르세요."
                    )
                }
                speakTranslatedText(translated, room.patientLanguage)
                transitionRoomStateAsync(room, "ready", "대기 상태 전환")
                appendLog("번역 완료")
            }.onFailure { caught ->
                recoverRoomToReady("번역 실패")
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "번역 실패: $message") }
                appendLog("번역 실패: $message")
            }
        }
    }

    private fun stopLocalRecordingAndTranslate() {
        if (!uiState.value.speaking && !recordingActive) return

        val snapshot = uiState.value
        val direction = if (snapshot.localTurnDirection == LocalDirectionPatientToKo) LocalDirectionPatientToKo else LocalDirectionKoToPatient
        val patientLanguage = snapshot.selectedLanguage
        recordingActive = false
        updateState { it.copy(speaking = false, busy = true, status = "대면 통역 번역 중입니다...") }
        appendLog("대면 통역 녹음 종료: $direction")

        executor.execute {
            runCatching {
                val joinStartedAt = SystemClock.elapsedRealtime()
                recordingThread?.join(RecordingStopJoinMs)
                appendLog("Local recorder stop wait ${SystemClock.elapsedRealtime() - joinStartedAt}ms")
                val pcm = synchronized(recordingLock) {
                    recordedPcm?.toByteArray() ?: ByteArray(0)
                }
                synchronized(recordingLock) {
                    recordedPcm = null
                }
                if (pcm.size < 1600) error("녹음된 음성이 너무 짧습니다.")

                val durationSeconds = localRecordingDurationSeconds(pcm)
                val result = translateLocalVoiceTurn(direction, patientLanguage, pcm, durationSeconds)
                val sourceLanguage = result.optString("sourceLanguage")
                val targetLanguage = result.optString("targetLanguage")
                val source = if (sourceLanguage == "ko") {
                    normalizeKoreanSourceText(result.optString("sourceText"))
                } else {
                    result.optString("sourceText").trim()
                }
                val translated = normalizeClinicText(result.optString("translatedText"), targetLanguage)
                val speaker = if (direction == LocalDirectionKoToPatient) "staff" else "patient"
                prepareLocalRealtimeTurnClientsAsync(patientLanguage)

                if (localTranslationNeedsRetry(direction, patientLanguage, source, translated)) {
                    val retryKorean = localRetryPromptKorean()
                    val retryPatient = localRetryPromptForPatientLanguage(patientLanguage)
                    updateState {
                        it.copy(
                            busy = false,
                            speaking = false,
                            sourceDraft = if (direction == LocalDirectionKoToPatient) retryKorean else retryPatient,
                            translatedDraft = if (direction == LocalDirectionKoToPatient) retryPatient else retryKorean,
                            lastMessageSpeaker = speaker,
                            localTurnDirection = direction,
                            status = "번역 내용이 서로 맞지 않아 다시 말해주세요."
                        )
                    }
                    appendLog("대면 통역 의미 불일치: 다시 말하기 요청")
                    return@runCatching
                }

                updateState {
                    it.copy(
                        busy = false,
                        speaking = false,
                        sourceDraft = source,
                        translatedDraft = translated,
                        lastMessageSpeaker = speaker,
                        localTurnDirection = direction,
                        status = "대면 통역 완료. 다음 발화 쪽 마이크를 누르세요."
                    )
                }

                if (direction == LocalDirectionKoToPatient) {
                    speakTranslatedText(translated, patientLanguage)
                } else {
                    speakKoreanText(translated)
                }
                appendLog("대면 통역 완료")
            }.onFailure { caught ->
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, speaking = false, status = "대면 통역 실패: $message") }
                prepareLocalRealtimeTurnClientsAsync(patientLanguage)
                appendLog("대면 통역 실패: $message")
            }
        }
    }

    private fun localRecordingDurationSeconds(pcm: ByteArray): Int {
        val samples = pcm.size / 2
        return max(1, (samples + RealtimePcmSampleRate - 1) / RealtimePcmSampleRate)
    }

    private fun localTranslationNeedsRetry(
        direction: String,
        patientLanguage: String,
        sourceText: String,
        translatedText: String
    ): Boolean {
        if (!shouldValidateLocalTranslation(sourceText, translatedText)) return false

        return runCatching {
            val backend = normalizedBackendUrl(uiState.value.backendUrl)
            val payload = JSONObject()
                .put("direction", direction)
                .put("patientLanguage", patientLanguage)
                .put("sourceText", sourceText)
                .put("translatedText", translatedText)
                .toString()
            val data = postJsonWithTimeout("$backend/api/local-voice-turns/validate", payload, LocalValidationTimeoutMs)
            val checked = data.optBoolean("checked", false)
            val ok = data.optBoolean("ok", true)
            if (checked) appendLog("Local consistency ${if (ok) "ok" else "retry"}: ${data.optString("reason")}")
            checked && !ok
        }.onFailure {
            appendLog("Local consistency skipped: ${it.message}")
        }.getOrDefault(false)
    }

    private fun shouldValidateLocalTranslation(sourceText: String, translatedText: String): Boolean {
        val source = sourceText.trim()
        val translated = translatedText.trim()
        if (source.isBlank() || translated.isBlank()) return false
        val hasWordBoundaries = source.contains(Regex("\\s"))
        val sourceWords = if (hasWordBoundaries) {
            source.split(Regex("\\s+")).filter { it.isNotBlank() }.size
        } else {
            Int.MAX_VALUE
        }
        return source.length <= LocalValidationMaxSourceChars ||
            translated.length <= LocalValidationMaxTranslatedChars ||
            sourceWords <= LocalValidationMaxSourceWords
    }

    private fun localRetryPromptKorean(): String = "다시 한 번 말씀해주세요."

    private fun localRetryPromptForPatientLanguage(patientLanguage: String): String {
        return when (patientLanguage) {
            "zh" -> "请再说一遍。"
            "zh_tw" -> "請再說一遍。"
            "ja" -> "もう一度お話しください。"
            "en" -> "Please say that again."
            "th" -> "กรุณาพูดอีกครั้ง"
            "ms" -> "Sila ulang sekali lagi."
            "mn" -> "Дахин хэлнэ үү."
            "ru" -> "Пожалуйста, повторите."
            "vi" -> "Vui lòng nói lại."
            "id" -> "Tolong ulangi sekali lagi."
            "fr" -> "Veuillez répéter."
            "es" -> "Por favor, repítalo."
            "de" -> "Bitte sagen Sie es noch einmal."
            "it" -> "Per favore, ripeta."
            "pt" -> "Por favor, repita."
            else -> "Please say that again."
        }
    }

    private fun translateLocalVoiceTurn(direction: String, patientLanguage: String, pcm: ByteArray, durationSeconds: Int): JSONObject {
        val realtimeWasActive = realtimeTurnActive
        realtimeTurnActive = false

        if (realtimeWasActive) {
            val key = localRealtimeKey(patientLanguage, direction)
            val realtime = activeRealtimeTurnClient ?: synchronized(localRealtimeLock) { localRealtimeTurnClients[key] }
            activeRealtimeTurnClient = null
            if (realtime != null) {
                runCatching {
                    val startedAt = SystemClock.elapsedRealtime()
                    val result = realtime.stopTurnAndTranslate()
                    appendLog("Local Realtime translation complete ${SystemClock.elapsedRealtime() - startedAt}ms")
                    recordLocalInterpreterUsageAsync(
                        direction = direction,
                        patientLanguage = patientLanguage,
                        transport = "realtime",
                        durationSeconds = durationSeconds,
                        sourceText = result.sourceText,
                        translatedText = result.translatedText
                    )
                    return localRealtimeVoiceTurn(direction, patientLanguage, result.sourceText, result.translatedText)
                }.onFailure {
                    appendLog("Local Realtime failed, falling back to upload: ${it.message}")
                    synchronized(localRealtimeLock) {
                        localRealtimeTurnClients.remove(key)
                    }?.close()
                    prepareLocalRealtimeTurnClientAsync(patientLanguage, direction, force = true)
                }
            }
        }

        translateLocalPcmWithPreparedRealtime(direction, patientLanguage, pcm, durationSeconds)?.let { return it }

        val wav = pcm16ToWav(pcm, RealtimePcmSampleRate, 1)
        appendLog("Local voice upload (${wav.size} bytes)")
        return uploadLocalVoiceTurn(direction, patientLanguage, wav, durationSeconds)
    }

    private fun translateLocalPcmWithPreparedRealtime(
        direction: String,
        patientLanguage: String,
        pcm: ByteArray,
        durationSeconds: Int
    ): JSONObject? {
        val key = localRealtimeKey(patientLanguage, direction)
        val realtime = synchronized(localRealtimeLock) { localRealtimeTurnClients[key] }
        if (realtime == null || !realtime.isReady()) return null

        return runCatching {
            val startedAt = SystemClock.elapsedRealtime()
            realtime.startTurn()
            streamPcmToRealtime(realtime, pcm)
            val result = realtime.stopTurnAndTranslate()
            appendLog("Local buffered Realtime complete ${SystemClock.elapsedRealtime() - startedAt}ms")
            recordLocalInterpreterUsageAsync(
                direction = direction,
                patientLanguage = patientLanguage,
                transport = "realtime",
                durationSeconds = durationSeconds,
                sourceText = result.sourceText,
                translatedText = result.translatedText
            )
            localRealtimeVoiceTurn(direction, patientLanguage, result.sourceText, result.translatedText)
        }.onFailure {
            appendLog("Local buffered Realtime failed, falling back to upload: ${it.message}")
            synchronized(localRealtimeLock) {
                localRealtimeTurnClients.remove(key)
            }?.close()
            prepareLocalRealtimeTurnClientAsync(patientLanguage, direction, force = true)
        }.getOrNull()
    }

    private fun streamPcmToRealtime(realtime: AndroidRealtimeTurnClient, pcm: ByteArray) {
        val chunkBytes = 24_000
        var offset = 0
        while (offset < pcm.size) {
            val length = minOf(chunkBytes, pcm.size - offset)
            realtime.appendPcm(pcm.copyOfRange(offset, offset + length), length)
            offset += length
        }
    }

    private fun localRealtimeVoiceTurn(direction: String, patientLanguage: String, sourceText: String, translatedText: String): JSONObject {
        val targetLanguage = if (direction == LocalDirectionKoToPatient) patientLanguage else "ko"
        val sourceLanguage = if (direction == LocalDirectionKoToPatient) "ko" else patientLanguage
        return JSONObject()
            .put("sourceText", sourceText)
            .put("translatedText", translatedText)
            .put("sourceLanguage", sourceLanguage)
            .put("targetLanguage", targetLanguage)
            .put("direction", direction)
            .put("model", "realtime-local")
    }

    private fun recoverRoomToReady(context: String) {
        val room = uiState.value.room ?: return
        if (room.status == "ended" || room.patientJoinedAt == null) return

        runCatching {
            val readyRoom = transitionRoomState(room, "ready")
            updateState { it.copy(room = readyRoom) }
        }.onFailure {
            appendLog("$context 후 대기 상태 복구 실패: ${it.message}")
        }
    }

    private fun translateStaffVoiceTurn(room: RoomInfo, pcm: ByteArray): JSONObject {
        val realtimeWasActive = realtimeTurnActive
        realtimeTurnActive = false

        if (realtimeWasActive) {
            val realtime = activeRealtimeTurnClient ?: realtimeTurnClient
            activeRealtimeTurnClient = null
            if (realtime != null) {
                runCatching {
                    val startedAt = SystemClock.elapsedRealtime()
                    val result = realtime.stopTurnAndTranslate()
                    val sourceText = normalizeKoreanSourceText(result.sourceText)
                    appendLog("Realtime translation complete ${SystemClock.elapsedRealtime() - startedAt}ms")
                    val messageId = "staff-realtime-android-${System.currentTimeMillis()}"
                    persistRealtimeStaffVoiceTurnAsync(room, messageId, sourceText, result.translatedText)
                    return localRealtimeStaffVoiceTurn(room, messageId, sourceText, result.translatedText)
                }.onFailure {
                    appendLog("Realtime failed, falling back to upload: ${it.message}")
                    closeRealtimeTurnClient()
                }
            }
        }

        val wav = pcm16ToWav(pcm, RealtimePcmSampleRate, 1)
        appendLog("Upload fallback translation (${wav.size} bytes)")
        return uploadStaffVoiceTurn(room, wav)
    }

    private fun localRealtimeStaffVoiceTurn(room: RoomInfo, messageId: String, sourceText: String, translatedText: String): JSONObject {
        val message = JSONObject()
            .put("id", messageId)
            .put("speaker", "staff")
            .put("sourceText", sourceText)
            .put("text", translatedText)
            .put("targetLanguage", room.patientLanguage)
            .put("createdAt", isoTimestampNow())
            .put("readAt", JSONObject.NULL)
        return JSONObject()
            .put("message", message)
            .put("sourceText", sourceText)
            .put("translatedText", translatedText)
            .put("model", "realtime-local")
    }

    private fun persistRealtimeStaffVoiceTurnAsync(room: RoomInfo, messageId: String, sourceText: String, translatedText: String) {
        sessionExecutor.execute {
            var lastError: Throwable? = null
            var persisted = false
            repeat(2) { attempt ->
                if (persisted) return@repeat
                runCatching {
                    persistRealtimeStaffVoiceTurn(room, messageId, sourceText, translatedText)
                }.onSuccess {
                    persisted = true
                }.onFailure {
                    lastError = it
                    if (attempt == 0) {
                        appendLog("Realtime persist retry: ${it.message}")
                        Thread.sleep(250)
                    }
                }
            }
            if (!persisted) appendLog("Realtime persist failed: ${lastError?.message ?: "unknown error"}")
        }
    }

    private fun persistRealtimeStaffVoiceTurn(room: RoomInfo, messageId: String, sourceText: String, translatedText: String): JSONObject {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val endpoint = if (room.roomMode == "procedure") "procedure-turns" else "consultation-voice-turns"
        val payload = JSONObject()
            .put("roomId", room.id)
            .put("messageId", messageId)
            .put("role", "staff")
            .put("patientLanguage", room.patientLanguage)
            .put("sourceText", sourceText)
            .put("translatedText", translatedText)
            .toString()
        val startedAt = SystemClock.elapsedRealtime()
        return postJson("$backend/api/$endpoint", payload).also {
            appendLog("Realtime persist ${SystemClock.elapsedRealtime() - startedAt}ms")
        }
    }

    private fun uploadStaffVoiceTurn(room: RoomInfo, wav: ByteArray): JSONObject {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val clientTurnId = "android-${System.currentTimeMillis()}"
        val endpoint = if (room.roomMode == "procedure") "procedure-turns" else "consultation-voice-turns"
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("roomId", room.id)
            .addFormDataPart("clientTurnId", clientTurnId)
            .addFormDataPart("role", "staff")
            .addFormDataPart("patientLanguage", room.patientLanguage)
            .addFormDataPart("audio", "staff-$clientTurnId.wav", wav.toRequestBody("audio/wav".toMediaType()))
            .build()
        val request = Request.Builder()
            .url("$backend/api/$endpoint")
            .post(body)
            .build()
        val startedAt = SystemClock.elapsedRealtime()
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) error(apiErrorMessage(text, response.code))
            appendLog("Upload fallback HTTP ${SystemClock.elapsedRealtime() - startedAt}ms")
            return JSONObject(text)
        }
    }

    private fun recordLocalInterpreterUsageAsync(
        direction: String,
        patientLanguage: String,
        transport: String,
        durationSeconds: Int,
        sourceText: String,
        translatedText: String
    ) {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val payload = JSONObject()
            .put("direction", direction)
            .put("patientLanguage", patientLanguage)
            .put("transport", transport)
            .put("durationSeconds", durationSeconds)
            .put("sourceTextCharacters", sourceText.length)
            .put("translatedTextCharacters", translatedText.length)
            .toString()
        sessionExecutor.execute {
            runCatching {
                postJson("$backend/api/local-voice-turns/usage", payload)
            }.onSuccess {
                appendLog("Local usage logged: $transport ${durationSeconds}s")
            }.onFailure {
                appendLog("Local usage log failed: ${it.message}")
            }
        }
    }

    private fun uploadLocalVoiceTurn(direction: String, patientLanguage: String, wav: ByteArray, durationSeconds: Int): JSONObject {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val clientTurnId = "local-android-${System.currentTimeMillis()}"
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("clientTurnId", clientTurnId)
            .addFormDataPart("direction", direction)
            .addFormDataPart("patientLanguage", patientLanguage)
            .addFormDataPart("durationSeconds", durationSeconds.toString())
            .addFormDataPart("audio", "local-$clientTurnId.wav", wav.toRequestBody("audio/wav".toMediaType()))
            .build()
        val request = Request.Builder()
            .url("$backend/api/local-voice-turns")
            .post(body)
            .build()
        val startedAt = SystemClock.elapsedRealtime()
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) error(apiErrorMessage(text, response.code))
            appendLog("Local voice HTTP ${SystemClock.elapsedRealtime() - startedAt}ms")
            return JSONObject(text)
        }
    }

    private fun submitTextMessage() {
        val state = uiState.value
        val room = state.room ?: return
        val sourceText = state.textInput.trim()
        if (room.roomMode != "consultation") {
            updateState { it.copy(status = "텍스트 전송은 상담모드에서만 사용할 수 있습니다.") }
            return
        }
        if (room.patientJoinedAt == null || room.status == "ended") {
            updateState { it.copy(status = "환자가 입장한 상담방에서만 텍스트를 전송할 수 있습니다.") }
            return
        }
        if (!canStaffSendText(room.status)) {
            updateState { it.copy(status = statusHelperText(room.status)) }
            return
        }
        if (sourceText.isBlank() || state.busy || state.speaking) return

        updateState { it.copy(busy = true, status = "텍스트 번역 중입니다...") }
        executor.execute {
            runCatching {
                val backend = normalizedBackendUrl(uiState.value.backendUrl)
                val messageId = "staff-text-android-${System.currentTimeMillis()}"
                val payload = JSONObject()
                    .put("roomId", room.id)
                    .put("messageId", messageId)
                    .put("role", "staff")
                    .put("patientLanguage", room.patientLanguage)
                    .put("text", sourceText)
                    .toString()
                val result = postJson("$backend/api/translate-text", payload)
                val message = result.getJSONObject("message")
                rememberMessage(message)
                val parsedMessage = messageFromJson(message, room.patientLanguage)
                appendConversationMessage(parsedMessage)

                val translated = parsedMessage.text
                updateState {
                    it.copy(
                        busy = false,
                        textInput = "",
                        sourceDraft = sourceText,
                        translatedDraft = translated,
                        lastMessageSpeaker = "staff",
                        status = "텍스트 번역 완료. 환자 화면에 전달되었습니다."
                    )
                }
                speakTranslatedText(translated, room.patientLanguage)
                appendLog("텍스트 번역 전송")
            }.onFailure { caught ->
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "텍스트 번역 실패: $message") }
                appendLog("텍스트 번역 실패: $message")
            }
        }
    }

    private fun endRoom() {
        val room = uiState.value.room ?: return
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        stopRoomPolling()
        resetMessagePolling()
        closeRealtimeTurnClient()
        updateState { it.copy(busy = true, showEndRoomConfirm = false, status = "방 종료 중...") }
        executor.execute {
            runCatching {
                postEmpty("$backend/api/rooms/${room.id}/end")
            }.onSuccess {
                updateState {
                    it.copy(
                        room = null,
                        setupStep = SetupStepMode,
                        connected = false,
                        speaking = false,
                        sourceDraft = "",
                        translatedDraft = "",
                        lastMessageSpeaker = "",
                        messages = emptyList(),
                        textInput = "",
                        busy = false,
                        status = "방이 종료되었습니다."
                    )
                }
            }.onFailure { caught ->
                startRoomPolling()
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "방 종료 실패: $message") }
                appendLog("방 종료 실패: $message")
            }
        }
    }

    private fun copyJoinLink() {
        val url = uiState.value.room?.joinUrl ?: return
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("MediVoice patient link", url))
        appendLog("환자 링크 복사")
    }

    private fun replayTranslation() {
        if (uiState.value.setupStep == SetupStepLocalInterpreter && uiState.value.room == null) {
            val state = uiState.value
            val text = state.translatedDraft
            if (text.isBlank()) {
                updateState { it.copy(status = "아직 다시 들을 번역이 없습니다.") }
                return
            }
            if (state.lastMessageSpeaker == "patient") speakKoreanText(text)
            else speakTranslatedText(text, state.selectedLanguage)
            appendLog("대면 통역 다시 듣기")
            return
        }

        val room = uiState.value.room ?: return
        val text = uiState.value.translatedDraft
        if (text.isBlank()) {
            updateState { it.copy(status = "아직 다시 들을 번역이 없습니다.") }
            return
        }
        if (uiState.value.lastMessageSpeaker == "patient") speakKoreanText(text)
        else speakTranslatedText(text, room.patientLanguage)
        appendLog("번역 다시 듣기")
    }

    private fun warmTtsForRoom(room: RoomInfo) {
        if (!uiState.value.ttsEnabled) return
        warmTtsLanguage(Locale.KOREA, "한국어")
        val language = patientLanguages.firstOrNull { it.code == room.patientLanguage } ?: return
        warmTtsLanguage(language.ttsLocale, language.ko)
    }

    private fun warmTtsLanguage(locale: Locale, label: String) {
        val tts = textToSpeech ?: return
        val availability = tts.setLanguage(locale)
        if (availability < TextToSpeech.LANG_AVAILABLE) return
        val result = tts.playSilentUtterance(1L, TextToSpeech.QUEUE_ADD, "$TtsWarmUtterancePrefix-${locale.toLanguageTag()}-${System.currentTimeMillis()}")
        if (result != TextToSpeech.ERROR) appendLog("TTS warmup: $label")
    }

    private fun speakTranslatedText(text: String, patientLanguage: String) {
        val language = patientLanguages.firstOrNull { it.code == patientLanguage } ?: patientLanguages.first()
        speakText(text, language.ttsLocale, language.ko)
    }

    private fun speakKoreanText(text: String) {
        speakText(text, Locale.KOREA, "한국어")
    }

    private fun speakText(text: String, locale: Locale, label: String) {
        if (!uiState.value.ttsEnabled || text.isBlank()) return
        val tts = textToSpeech ?: return
        val availability = tts.setLanguage(locale)
        if (availability < TextToSpeech.LANG_AVAILABLE) {
            updateState { it.copy(ttsStatus = "$label TTS 미지원") }
            appendLog("TTS 미지원: $label")
            return
        }
        val utteranceId = "$TtsSpeechUtterancePrefix-${System.currentTimeMillis()}"
        activeTtsUtteranceId = utteranceId
        val result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        if (result == TextToSpeech.ERROR) {
            activeTtsUtteranceId = ""
            setTtsPlaybackActive(false)
            updateState { it.copy(ttsStatus = "$label 재생 실패") }
            appendLog("TTS 재생 실패: $label")
            return
        }
        setTtsPlaybackActive(true)
        scheduleTtsWatchdog(utteranceId, text)
        updateState { it.copy(ttsStatus = "$label 재생 중") }
    }

    private fun isoTimestampNow(): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date())
    }

    private fun postJson(url: String, json: String): JSONObject {
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .post(json.toRequestBody(jsonMediaType))
            .build()
        val startedAt = SystemClock.elapsedRealtime()
        http.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            val elapsedMs = SystemClock.elapsedRealtime() - startedAt
            appendLog("HTTP POST ${requestPath(url)} ${response.code} ${elapsedMs}ms")
            if (!response.isSuccessful) error(apiErrorMessage(body, response.code))
            return JSONObject(body)
        }
    }

    private fun postJsonWithTimeout(url: String, json: String, timeoutMs: Long): JSONObject {
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .post(json.toRequestBody(jsonMediaType))
            .build()
        val startedAt = SystemClock.elapsedRealtime()
        val call = http.newCall(request)
        call.timeout().timeout(timeoutMs, TimeUnit.MILLISECONDS)
        call.execute().use { response ->
            val body = response.body?.string().orEmpty()
            val elapsedMs = SystemClock.elapsedRealtime() - startedAt
            appendLog("HTTP POST ${requestPath(url)} ${response.code} ${elapsedMs}ms")
            if (!response.isSuccessful) error(apiErrorMessage(body, response.code))
            return JSONObject(body)
        }
    }

    private fun transitionRoomState(room: RoomInfo, status: String): RoomInfo {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val payload = JSONObject()
            .put("role", "staff")
            .put("status", status)
            .toString()
        val data = postJson("$backend/api/rooms/${room.id}/state", payload)
        return roomInfoFromJson(data.getJSONObject("room"), backend, room)
    }

    private fun transitionRoomStateAsync(room: RoomInfo, status: String, label: String) {
        pollExecutor.execute {
            runCatching {
                val updatedRoom = transitionRoomState(room, status)
                updateState { current ->
                    if (current.room?.id == updatedRoom.id) current.copy(room = updatedRoom) else current
                }
            }.onFailure {
                appendLog("$label 실패: ${it.message}")
            }
        }
    }

    private fun getJson(url: String): JSONObject {
        val request = Request.Builder().url(url).get().build()
        val startedAt = SystemClock.elapsedRealtime()
        http.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            val elapsedMs = SystemClock.elapsedRealtime() - startedAt
            if (elapsedMs >= 900L) appendLog("HTTP GET ${requestPath(url)} ${response.code} ${elapsedMs}ms")
            if (!response.isSuccessful) error(apiErrorMessage(body, response.code))
            return JSONObject(body)
        }
    }

    private fun postEmpty(url: String) {
        val request = Request.Builder().url(url).post(ByteArray(0).toRequestBody()).build()
        http.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) error(apiErrorMessage(body, response.code))
        }
    }
}

private fun normalizedBackendUrl(value: String): String {
    val trimmed = value.trim().ifBlank { "https://voice.insightmedi.co.kr" }
    val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "https://$trimmed"
    return withScheme.removeSuffix("/")
}

private fun requestPath(url: String): String {
    return runCatching {
        val httpUrl = url.toHttpUrl()
        val query = httpUrl.encodedQuery?.let { "?$it" }.orEmpty()
        "${httpUrl.encodedPath}$query"
    }.getOrDefault(url.takeLast(48))
}

private fun apiErrorMessage(body: String, code: Int): String {
    val serverError = runCatching {
        JSONObject(body).optString("error").trim().takeIf { it.isNotBlank() }
    }.getOrNull()
    val raw = serverError ?: body.trim().takeIf { it.isNotBlank() && it.length <= 160 }
    return when {
        raw == "Unauthorized" -> "로그인이 만료되었습니다. 다시 로그인하세요."
        raw == "Room not available" || raw == "Room not found" -> "통역방을 사용할 수 없습니다. 새 방을 생성하세요."
        raw == "Room already ended" -> "이미 종료된 방입니다."
        raw == "Room state changed" -> "방 상태가 바뀌었습니다. 잠시 후 다시 시도하세요."
        raw == "Role cannot request this state" || raw?.startsWith("Invalid transition") == true -> "지금은 말할 수 없습니다. 상대방 발화가 끝난 뒤 다시 시도하세요."
        raw == "Audio transcription failed" -> "음성 인식에 실패했습니다. 더 짧고 또렷하게 다시 말해주세요."
        raw == "No speech was transcribed" -> "말소리가 인식되지 않았습니다. 마이크 위치를 확인하고 다시 말해주세요."
        raw == "Procedure turn translation failed" || raw == "Consultation voice translation failed" || raw == "Local voice translation failed" || raw == "Text translation failed" -> "번역에 실패했습니다. 네트워크를 확인하고 다시 시도하세요."
        raw == "No translated text was returned" -> "번역 결과가 비어 있습니다. 다시 시도하세요."
        raw == "OPENAI_API_KEY is not configured" -> "서버 OpenAI 설정이 필요합니다."
        else -> raw ?: "서버 응답 오류입니다. 잠시 후 다시 시도하세요. (HTTP $code)"
    }
}

private fun userFacingError(caught: Throwable): String {
    val message = caught.message?.trim().orEmpty()
    return when {
        caught is java.net.SocketTimeoutException -> "서버 응답 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도하세요."
        caught is java.net.UnknownHostException -> "서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요."
        caught is java.net.ConnectException -> "서버 연결에 실패했습니다. 네트워크를 확인하세요."
        message.isNotBlank() -> message
        else -> "오류가 발생했습니다. 다시 시도하세요."
    }
}

private fun isSupportedHardwareKey(keyCode: Int): Boolean {
    return keyCode == KeyEvent.KEYCODE_SPACE ||
        keyCode == KeyEvent.KEYCODE_ENTER ||
        keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ||
        keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
        keyCode == KeyEvent.KEYCODE_HEADSETHOOK
}

private fun canStaffStartTurn(status: String): Boolean {
    return status == "ready" ||
        status == "translating_to_staff" ||
        status == "staff_listening"
}

private fun canStaffSendText(status: String): Boolean {
    return status == "ready" ||
        status == "translating_to_staff" ||
        status == "staff_listening"
}

private fun statusHelperText(status: String): String {
    return when (status) {
        "patient_speaking" -> "환자가 말하는 중입니다. 잠시 기다려주세요."
        "staff_speaking" -> "이미 직원 마이크가 켜져 있습니다."
        "translating_to_patient" -> "환자에게 보낼 번역을 처리 중입니다."
        "patient_listening" -> "환자가 번역을 듣는 중입니다. 잠시 후 다시 시도하세요."
        "translating_to_staff" -> "환자 발화를 번역 중입니다. 곧 이어서 말할 수 있습니다."
        "staff_listening" -> "환자 발화 번역을 확인한 뒤 이어서 말하세요."
        "waiting_for_patient" -> "환자가 QR로 입장하면 마이크가 활성화됩니다."
        "ended" -> "이미 종료된 방입니다. 새 통역방을 생성하세요."
        else -> "잠시 후 다시 시도하세요."
    }
}

private fun roomModeLabel(mode: String): String {
    return when (mode) {
        "procedure" -> "시술"
        RoomModeLocalInterpreter -> "대면"
        else -> "상담"
    }
}

private fun roomModeDescription(mode: String): String {
    return when (mode) {
        "procedure" -> "누워 있는 환자에게 짧은 안내를 바로 번역해 들려줍니다."
        RoomModeLocalInterpreter -> "병원 기기 하나를 마주 보고 놓고 양방향 음성 통역을 합니다."
        else -> "직원과 환자가 채팅하듯이 짧게 말하고 번역을 주고받습니다."
    }
}

private fun languageSelectionStatus(mode: String): String {
    return if (mode == RoomModeLocalInterpreter) {
        "대면 통역에 사용할 환자 언어를 선택하세요."
    } else {
        "${roomModeLabel(mode)} 통역방에 사용할 환자 언어를 선택하세요."
    }
}

private fun roomStatusLabel(status: String, patientJoinedAt: String?): String {
    return when (status) {
        "waiting_for_patient" -> "QR 대기"
        "staff_speaking" -> "직원 발화"
        "patient_speaking" -> "환자 발화"
        "translating_to_patient" -> "환자 번역 중"
        "translating_to_staff" -> "직원 번역 중"
        "patient_listening" -> "환자 재생 중"
        "staff_listening" -> "직원 확인 중"
        "ended" -> "종료"
        "ready" -> if (patientJoinedAt == null) "QR 대기" else "준비됨"
        else -> if (patientJoinedAt == null) "QR 대기" else "진행 중"
    }
}

private fun messageTimeLabel(createdAt: String): String {
    return Regex("T(\\d{2}:\\d{2})").find(createdAt)?.groupValues?.getOrNull(1).orEmpty()
}

private fun brandDisplay(patientLanguage: String, key: String): String {
    return when (key) {
        "rejuranHealer" -> when (patientLanguage) {
            "ko" -> "리쥬란 힐러"
            "zh" -> "丽珠兰 Healer"
            "zh_tw" -> "麗珠蘭 Healer"
            "ja" -> "リジュランヒーラー"
            else -> "Rejuran Healer"
        }
        "rejuran" -> when (patientLanguage) {
            "ko" -> "리쥬란"
            "zh" -> "丽珠兰"
            "zh_tw" -> "麗珠蘭"
            "ja" -> "リジュラン"
            else -> "Rejuran"
        }
        "juvelookVolume" -> when (patientLanguage) {
            "ko" -> "쥬베룩 볼륨"
            "ja" -> "ジュベルック ボリューム"
            else -> "Juvelook Volume"
        }
        "juvelook" -> when (patientLanguage) {
            "ko" -> "쥬베룩"
            "ja" -> "ジュベルック"
            else -> "Juvelook"
        }
        else -> ""
    }
}

private fun normalizeKoreanSourceText(text: String): String {
    return text.trim()
        .replace(Regex("(?:리\\s*[쥬주]\\s*란|니\\s*[쥬주]\\s*란|리.{0,3}란)\\s*힐러|\\b(?:re|ni|nizhu|niju)[\\s-]?juran\\s*healer\\b", RegexOption.IGNORE_CASE), "리쥬란 힐러")
        .replace(Regex("(?:쥬|주)\\s*베\\s*룩\\s*볼륨|\\bjuve[\\s-]?look\\s*volume\\b", RegexOption.IGNORE_CASE), "쥬베룩 볼륨")
        .replace(Regex("(?:쥬|주)\\s*베\\s*룩|\\bjuve[\\s-]?look\\b", RegexOption.IGNORE_CASE), "쥬베룩")
        .replace(Regex("니[주쥬]란|리주란|\\bni[\\s-]?juran\\b|\\bni[\\s-]?zuran\\b|\\bniju[\\s-]?ran\\b", RegexOption.IGNORE_CASE), "리쥬란")
        .replace(Regex("그종|구종|붓종"), "부종")
        .replace(Regex("\\b(?:geu|gu|geo)[\\s-]?jong\\b", RegexOption.IGNORE_CASE), "부종")
}

private fun normalizeClinicText(text: String, patientLanguage: String): String {
    val rejuran = brandDisplay(patientLanguage, "rejuran")
    val rejuranHealer = brandDisplay(patientLanguage, "rejuranHealer")
    val juvelook = brandDisplay(patientLanguage, "juvelook")
    val juvelookVolume = brandDisplay(patientLanguage, "juvelookVolume")
    val swelling = when (patientLanguage) {
        "zh" -> "肿胀"
        "zh_tw" -> "腫脹"
        "ja" -> "腫れ"
        "en" -> "swelling"
        "ko" -> "부종"
        "ru" -> "отек"
        "vi" -> "sưng"
        "id", "ms" -> "bengkak"
        "fr" -> "gonflement"
        "es" -> "hinchazón"
        "de" -> "Schwellung"
        "it" -> "gonfiore"
        "pt" -> "inchaço"
        else -> "swelling"
    }
    val swellingSentence = when (patientLanguage) {
        "zh" -> "可能会出现肿胀。"
        "zh_tw" -> "可能會出現腫脹。"
        "ja" -> "腫れが出ることがあります。"
        "en" -> "Swelling may occur."
        "ko" -> "부종이 생길 수 있어요."
        else -> "$swelling may occur."
    }
    val trimmed = text.trim()
    if (Regex("^(그종|구종|붓종|geu[\\s-]?jong|gu[\\s-]?jong|geo[\\s-]?jong)(?:[.!?。？\\s]*)$", RegexOption.IGNORE_CASE).matches(trimmed)) {
        return swellingSentence
    }
    return trimmed
        .replace(Regex("(?:리\\s*[쥬주]\\s*란|니\\s*[쥬주]\\s*란|리.{0,3}란|Rejuran|丽珠兰|麗珠蘭|リジュラン)\\s*힐러|\\b(?:re|ni|nizhu|niju)[\\s-]?juran\\s*healer\\b", RegexOption.IGNORE_CASE), rejuranHealer)
        .replace(Regex("(?:쥬|주)\\s*베\\s*룩\\s*볼륨|\\bjuve[\\s-]?look\\s*volume\\b", RegexOption.IGNORE_CASE), juvelookVolume)
        .replace(Regex("(?:쥬|주)\\s*베\\s*룩|\\bjuve[\\s-]?look\\b", RegexOption.IGNORE_CASE), juvelook)
        .replace(Regex("니[주쥬]란|리주란"), rejuran)
        .replace(Regex("\\bni[\\s-]?juran\\b|\\bni[\\s-]?zuran\\b|\\bniju[\\s-]?ran\\b", RegexOption.IGNORE_CASE), rejuran)
        .replace(Regex("그종|구종|붓종"), swelling)
        .replace(Regex("\\b(?:geu|gu|geo)[\\s-]?jong\\b", RegexOption.IGNORE_CASE), swelling)
}

private fun pcm16ToWav(pcm: ByteArray, sampleRate: Int, channels: Int): ByteArray {
    val byteRate = sampleRate * channels * 2
    val dataSize = pcm.size
    val totalSize = 36 + dataSize
    val out = ByteArrayOutputStream(44 + dataSize)

    fun ascii(value: String) {
        out.write(value.toByteArray(StandardCharsets.US_ASCII))
    }

    fun intLe(value: Int) {
        out.write(value and 0xff)
        out.write((value shr 8) and 0xff)
        out.write((value shr 16) and 0xff)
        out.write((value shr 24) and 0xff)
    }

    fun shortLe(value: Int) {
        out.write(value and 0xff)
        out.write((value shr 8) and 0xff)
    }

    ascii("RIFF")
    intLe(totalSize)
    ascii("WAVE")
    ascii("fmt ")
    intLe(16)
    shortLe(1)
    shortLe(channels)
    intLe(sampleRate)
    intLe(byteRate)
    shortLe(channels * 2)
    shortLe(16)
    ascii("data")
    intLe(dataSize)
    out.write(pcm)
    return out.toByteArray()
}

private fun staffScreenKey(state: StaffUiState): String {
    val room = state.room
    return when {
        !state.loggedIn -> "login"
        room == null && state.setupStep == SetupStepLocalInterpreter -> "local_interpreter"
        room == null && state.setupStep == SetupStepMode -> "mode"
        room == null -> "language"
        room.status == "ended" -> "ended"
        room.patientJoinedAt == null -> "qr"
        else -> "conversation"
    }
}

private fun staffScreenOrder(screen: String): Int {
    return when (screen) {
        "login" -> 0
        "mode" -> 1
        "language" -> 2
        "local_interpreter" -> 3
        "qr" -> 3
        "conversation" -> 4
        "ended" -> 5
        else -> 0
    }
}

@Composable
@OptIn(ExperimentalAnimationApi::class)
private fun StaffAppScreen(
    state: StaffUiState,
    onBackendUrl: () -> Unit,
    onBackendChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onRememberEmailChange: (Boolean) -> Unit,
    onLogin: () -> Unit,
    onLogout: () -> Unit,
    onLanguage: (String) -> Unit,
    onRoomMode: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onToggleSpeak: () -> Unit,
    onStartLocalTurn: (String) -> Unit,
    onExitLocalInterpreter: () -> Unit,
    onRequestEndRoom: () -> Unit,
    onConfirmEndRoom: () -> Unit,
    onDismissEndRoom: () -> Unit,
    onCopyLink: () -> Unit,
    onReplayTranslation: () -> Unit,
    onTextInputChange: (String) -> Unit,
    onSubmitText: () -> Unit,
    onTtsEnabled: (Boolean) -> Unit,
    onRequestMicPermission: () -> Unit
) {
    val room = state.room
    val screenKey = staffScreenKey(state)
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Mist)
            .systemBarsPadding()
    ) {
        val metrics = staffLayoutMetrics(maxWidth)
        if (screenKey == "local_interpreter") {
            LocalInterpreterScreen(
                state = state,
                metrics = metrics,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = metrics.outerHorizontalPadding, vertical = metrics.outerVerticalPadding),
                onStartLocalTurn = onStartLocalTurn,
                onExit = onExitLocalInterpreter,
                onReplayTranslation = onReplayTranslation,
                onTtsEnabled = onTtsEnabled,
                onRequestMicPermission = onRequestMicPermission
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = metrics.outerHorizontalPadding, vertical = metrics.outerVerticalPadding),
                contentAlignment = Alignment.TopCenter
            ) {
                Column(
                    modifier = Modifier
                        .widthIn(max = metrics.contentMaxWidth)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(metrics.screenSpacing)
                ) {
                    if (screenKey != "conversation" && screenKey != "ended") {
                        Header(state, metrics)
                    }

                    AnimatedContent(
                        targetState = screenKey,
                        label = "staff-flow-screen",
                        transitionSpec = {
                            val forward = staffScreenOrder(targetState) >= staffScreenOrder(initialState)
                            (slideInHorizontally(animationSpec = tween(220)) { width -> if (forward) width / 4 else -width / 4 } + fadeIn(tween(180)))
                                .togetherWith(slideOutHorizontally(animationSpec = tween(180)) { width -> if (forward) -width / 5 else width / 5 } + fadeOut(tween(140)))
                        }
                    ) { screen ->
                        Column(verticalArrangement = Arrangement.spacedBy(metrics.contentSpacing)) {
                            when (screen) {
                                "login" -> LoginPanel(
                                    state = state,
                                    metrics = metrics,
                                    onBackendUrl = onBackendUrl,
                                    onBackendChange = onBackendChange,
                                    onEmailChange = onEmailChange,
                                    onPasswordChange = onPasswordChange,
                                    onRememberEmailChange = onRememberEmailChange,
                                    onLogin = onLogin
                                )

                                "mode" -> ModeSelectionScreen(
                                    metrics = metrics,
                                    onRoomMode = onRoomMode,
                                    onLogout = onLogout
                                )

                                "language" -> LanguageSelectionScreen(
                                    state = state,
                                    metrics = metrics,
                                    onLanguage = onLanguage,
                                    onCreateRoom = onCreateRoom
                                )

                                "qr" -> QrWaitingScreen(
                                    state = state,
                                    metrics = metrics,
                                    onCopyLink = onCopyLink,
                                    onEndRoom = onRequestEndRoom
                                )

                                "ended" -> {
                                    StatusPanel(state, metrics)
                                    TranslationPanel(
                                        state = state,
                                        metrics = metrics,
                                        onToggleSpeak = onToggleSpeak,
                                        onReplayTranslation = onReplayTranslation,
                                        onTextInputChange = onTextInputChange,
                                        onSubmitText = onSubmitText,
                                        onTtsEnabled = onTtsEnabled,
                                        onRequestMicPermission = onRequestMicPermission
                                    )
                                    RoomActionBar(
                                        onCopyLink = onCopyLink,
                                        onEndRoom = onRequestEndRoom
                                    )
                                }

                                else -> {
                                    StatusPanel(state, metrics)
                                    TranslationPanel(
                                        state = state,
                                        metrics = metrics,
                                        onToggleSpeak = onToggleSpeak,
                                        onReplayTranslation = onReplayTranslation,
                                        onTextInputChange = onTextInputChange,
                                        onSubmitText = onSubmitText,
                                        onTtsEnabled = onTtsEnabled,
                                        onRequestMicPermission = onRequestMicPermission
                                    )
                                    RoomActionBar(
                                        onCopyLink = onCopyLink,
                                        onEndRoom = onRequestEndRoom
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (state.showEndRoomConfirm && room != null) {
            EndRoomConfirmDialog(
                roomMode = roomModeLabel(room.roomMode),
                onDismiss = onDismissEndRoom,
                onConfirm = onConfirmEndRoom
            )
        }
    }
}

@Composable
private fun ModeSelectionScreen(
    metrics: StaffLayoutMetrics,
    onRoomMode: (String) -> Unit,
    onLogout: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(metrics.contentSpacing)) {
        ModeLargeCard(
            metrics = metrics,
            title = "상담방 만들기",
            body = "음성 중심 AI 번역 상담",
            icon = {
                Icon(
                    Icons.Outlined.ChatBubbleOutline,
                    contentDescription = null,
                    tint = Trust,
                    modifier = Modifier.size(metrics.modeIconSize)
                )
            },
            onClick = { onRoomMode("consultation") }
        )

        ModeLargeCard(
            metrics = metrics,
            title = "시술방 만들기",
            body = "시술 중 안내 번역",
            icon = {
                Icon(
                    Icons.Outlined.MedicalServices,
                    contentDescription = null,
                    tint = Ink,
                    modifier = Modifier.size(metrics.modeIconSize)
                )
            },
            onClick = { onRoomMode("procedure") }
        )

        ModeLargeCard(
            metrics = metrics,
            title = "대면 통역",
            body = "병원폰 하나로 양방향 음성 통역",
            icon = {
                Icon(
                    Icons.Outlined.Translate,
                    contentDescription = null,
                    tint = Mint,
                    modifier = Modifier.size(metrics.modeIconSize)
                )
            },
            onClick = { onRoomMode(RoomModeLocalInterpreter) }
        )

        MainScreenFooter(onLogout = onLogout)
    }
}

@Composable
private fun MainScreenFooter(onLogout: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 2.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            "MediVoice $AppDisplayVersion",
            color = SlateText,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.bodySmall
        )
        TextButton(
            onClick = onLogout,
            modifier = Modifier
                .defaultMinSize(minWidth = 1.dp, minHeight = 1.dp)
                .heightIn(min = 28.dp),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                "로그아웃",
                color = SlateText,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun ModeLargeCard(
    metrics: StaffLayoutMetrics,
    title: String,
    body: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(metrics.modeCardHeight),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Ink),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp),
        contentPadding = PaddingValues(0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = metrics.cardPadding, vertical = if (metrics.isTablet) 14.dp else 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(if (metrics.isTablet) 16.dp else 14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(metrics.modeIconBoxSize)
                    .background(BlueTint, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                icon()
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(if (metrics.isTablet) 6.dp else 4.dp)
            ) {
                Text(
                    title,
                    color = Ink,
                    style = if (metrics.isTablet) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    body,
                    color = SlateText,
                    style = if (metrics.isTablet) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

private fun languageNativeLabel(language: PatientLanguageOption): String {
    return when (language.code) {
        "zh" -> "简体中文"
        "zh_tw" -> "繁體中文"
        else -> language.native
    }
}

private fun languageEnglishLabel(code: String): String {
    return when (code) {
        "zh" -> "Simplified Chinese"
        "zh_tw" -> "Traditional Chinese"
        "ja" -> "Japanese"
        "en" -> "English"
        "th" -> "Thai"
        "ms" -> "Malay"
        "mn" -> "Mongolian"
        "ru" -> "Russian"
        "vi" -> "Vietnamese"
        "id" -> "Indonesian"
        "fr" -> "French"
        "es" -> "Spanish"
        "de" -> "German"
        "it" -> "Italian"
        "pt" -> "Portuguese"
        else -> code
    }
}

private fun modeEnglishLabel(mode: String): String {
    return when (mode) {
        "procedure" -> "Procedure"
        RoomModeLocalInterpreter -> "Face to face"
        else -> "Consultation"
    }
}

private fun modeKoreanLabel(mode: String): String {
    return when (mode) {
        "procedure" -> "시술"
        RoomModeLocalInterpreter -> "대면"
        else -> "상담"
    }
}

private fun languageRoomTitle(mode: String): String {
    if (mode == RoomModeLocalInterpreter) return "대면 통역"
    return "${modeKoreanLabel(mode)} 통역방"
}

private fun createRoomButtonLabel(mode: String): String {
    if (mode == RoomModeLocalInterpreter) return "대면 통역 시작"
    return "${modeKoreanLabel(mode)} 통역방 생성"
}

private fun qrInstructionTitle(languageCode: String): String {
    return when (languageCode) {
        "zh" -> "请扫描二维码"
        "zh_tw" -> "請掃描 QR Code"
        "ja" -> "QRコードを読み取ってください"
        "en" -> "Please scan the QR code"
        else -> "Please scan the QR code"
    }
}

private fun qrInstructionBody(languageCode: String): String {
    return when (languageCode) {
        "zh" -> "请使用手机相机扫描下方二维码，进入医院翻译室。"
        "zh_tw" -> "請使用手機相機掃描下方 QR Code，進入醫院翻譯室。"
        "ja" -> "スマートフォンのカメラで下のQRコードを読み取り、病院通訳ルームに入室してください。"
        "en" -> "Use the phone camera to scan the QR code below and enter the hospital interpretation room."
        else -> "Use the phone camera to scan the QR code below and enter the hospital interpretation room."
    }
}

private fun qrWaitingTitle(languageCode: String): String {
    return when (languageCode) {
        "zh" -> "正在等待患者进入"
        "zh_tw" -> "正在等待患者進入"
        "ja" -> "患者さんの入室を待っています"
        "en" -> "Waiting for patient to enter"
        else -> "Waiting for patient to enter"
    }
}

private fun qrWaitingBody(languageCode: String): String {
    return when (languageCode) {
        "zh" -> "请使用手机相机扫描下方二维码，进入医院翻译室。"
        "zh_tw" -> "請使用手機相機掃描下方 QR Code，進入醫院翻譯室。"
        "ja" -> "下のQRコードを読み取って入室してください。"
        "en" -> "Scan the QR code below to enter the hospital interpretation room."
        else -> "Scan the QR code below to enter the hospital interpretation room."
    }
}

@Composable
private fun LanguageSelectionScreen(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    onLanguage: (String) -> Unit,
    onCreateRoom: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(metrics.contentSpacing)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(metrics.cardPadding),
                verticalArrangement = Arrangement.spacedBy(if (metrics.isTablet) 14.dp else 10.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text(
                        modeEnglishLabel(state.selectedRoomMode),
                        color = Trust,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier
                            .background(BlueTint, RoundedCornerShape(40.dp))
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
                Text(
                    languageRoomTitle(state.selectedRoomMode),
                    color = Ink,
                    style = if (metrics.isTablet) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "Please choose the language you use.",
                    color = SlateText,
                    style = if (metrics.isTablet) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )

                Column(verticalArrangement = Arrangement.spacedBy(metrics.languageGridGap)) {
                    patientLanguages.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(metrics.languageGridGap), modifier = Modifier.fillMaxWidth()) {
                            row.forEach { language ->
                                LanguageTile(
                                    metrics = metrics,
                                    language = language,
                                    selected = state.selectedLanguage == language.code,
                                    onClick = { onLanguage(language.code) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }

                Button(
                    onClick = onCreateRoom,
                    enabled = !state.busy,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(metrics.primaryButtonHeight),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Outlined.Translate, contentDescription = null)
                        Text(
                            if (state.busy) "생성 중..." else createRoomButtonLabel(state.selectedRoomMode),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LanguageTile(
    metrics: StaffLayoutMetrics,
    language: PatientLanguageOption,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .height(metrics.languageTileHeight)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) Trust else Line,
                shape = RoundedCornerShape(10.dp)
            ),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) BlueTint else Color.White,
            contentColor = if (selected) Trust else Color(0xFF475569)
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp),
        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(
                languageNativeLabel(language),
                fontWeight = FontWeight.Bold,
                style = if (metrics.isTablet) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                languageEnglishLabel(language.code),
                fontWeight = FontWeight.Bold,
                style = if (metrics.isTablet) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun localInterpreterDisabledReason(state: StaffUiState, active: Boolean): String {
    return when {
        active -> ""
        !state.recordAudioGranted -> "마이크 권한 필요"
        state.speaking -> "상대방 말하는 중"
        state.ttsPlaybackActive -> "음성 재생 중"
        state.busy -> "번역 중"
        else -> ""
    }
}

@Composable
private fun LocalInterpreterScreen(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    modifier: Modifier = Modifier,
    onStartLocalTurn: (String) -> Unit,
    onExit: () -> Unit,
    onReplayTranslation: () -> Unit,
    onTtsEnabled: (Boolean) -> Unit,
    onRequestMicPermission: () -> Unit
) {
    val language = patientLanguages.firstOrNull { it.code == state.selectedLanguage } ?: patientLanguages.first()
    val patientActive = state.speaking && state.localTurnDirection == LocalDirectionPatientToKo
    val staffActive = state.speaking && state.localTurnDirection != LocalDirectionPatientToKo
    val koreanText = when (state.lastMessageSpeaker) {
        "staff" -> state.sourceDraft
        "patient" -> state.translatedDraft
        else -> ""
    }
    val patientLanguageText = when (state.lastMessageSpeaker) {
        "staff" -> state.translatedDraft
        "patient" -> state.sourceDraft
        else -> ""
    }
    val patientLanguageLabel = languageNativeLabel(language)
    val canStart = !state.busy && !state.speaking && !state.ttsPlaybackActive
    val patientDisabledReason = localInterpreterDisabledReason(state, patientActive)
    val staffDisabledReason = localInterpreterDisabledReason(state, staffActive)

    BoxWithConstraints(modifier = modifier) {
        val landscape = maxWidth > maxHeight && maxWidth >= 720.dp
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(if (landscape) 8.dp else if (metrics.isTablet) 10.dp else 8.dp)
        ) {
            LocalInterpreterHalf(
                label = patientLanguageLabel,
                text = patientLanguageText,
                active = patientActive,
                busy = state.busy,
                disabledReason = patientDisabledReason,
                micEnabled = patientActive || canStart || !state.recordAudioGranted,
                buttonColor = Mint,
                landscape = landscape,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .graphicsLayer(rotationZ = 180f),
                onMic = {
                    if (state.recordAudioGranted) onStartLocalTurn(LocalDirectionPatientToKo)
                    else onRequestMicPermission()
                }
            )

            LocalInterpreterControlStrip(
                state = state,
                metrics = metrics,
                compact = landscape,
                onReplayTranslation = onReplayTranslation,
                onTtsEnabled = onTtsEnabled,
                onExit = onExit
            )

            LocalInterpreterHalf(
                label = "한국어",
                text = koreanText,
                active = staffActive,
                busy = state.busy,
                disabledReason = staffDisabledReason,
                micEnabled = staffActive || canStart || !state.recordAudioGranted,
                buttonColor = Trust,
                landscape = landscape,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                onMic = {
                    if (state.recordAudioGranted) onStartLocalTurn(LocalDirectionKoToPatient)
                    else onRequestMicPermission()
                }
            )
        }
    }
}

@Composable
private fun LocalInterpreterHalf(
    label: String,
    text: String,
    active: Boolean,
    busy: Boolean,
    disabledReason: String,
    micEnabled: Boolean,
    buttonColor: Color,
    landscape: Boolean,
    modifier: Modifier = Modifier,
    onMic: () -> Unit
) {
    val buttonSize = if (landscape) 86.dp else 96.dp
    val contentGap = if (landscape) 12.dp else 10.dp
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        val contentModifier = Modifier
            .fillMaxSize()
            .padding(if (landscape) 12.dp else 16.dp)

        if (landscape) {
            Row(
                modifier = contentModifier,
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(contentGap)
            ) {
                LocalInterpreterTextPane(
                    label = label,
                    text = text,
                    active = active,
                    landscape = true,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxSize()
                )
                LocalInterpreterMicButton(
                    active = active,
                    disabledReason = disabledReason,
                    busy = busy,
                    micEnabled = micEnabled,
                    buttonColor = buttonColor,
                    buttonSize = buttonSize,
                    onMic = onMic
                )
            }
        } else {
            Column(
                modifier = contentModifier,
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(contentGap)
            ) {
                LocalInterpreterTextPane(
                    label = label,
                    text = text,
                    active = active,
                    landscape = false,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                )
                LocalInterpreterMicButton(
                    active = active,
                    disabledReason = disabledReason,
                    busy = busy,
                    micEnabled = micEnabled,
                    buttonColor = buttonColor,
                    buttonSize = buttonSize,
                    onMic = onMic
                )
            }
        }
    }
}

@Composable
private fun LocalInterpreterTextPane(
    label: String,
    text: String,
    active: Boolean,
    landscape: Boolean = false,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    LaunchedEffect(text) {
        scrollState.scrollTo(0)
    }

    Box(
        modifier = modifier
            .background(Panel, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Text(
            label,
            color = Trust,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .align(Alignment.TopStart)
                .background(BlueTint, RoundedCornerShape(20.dp))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 34.dp)
                .verticalScroll(scrollState),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text.ifBlank { if (active) "듣는 중" else " " },
                color = if (text.isBlank()) SlateText else Ink,
                style = if (landscape) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun LocalInterpreterMicButton(
    active: Boolean,
    disabledReason: String,
    busy: Boolean,
    micEnabled: Boolean,
    buttonColor: Color,
    buttonSize: Dp,
    onMic: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Button(
            onClick = onMic,
            enabled = micEnabled,
            modifier = Modifier.size(buttonSize),
            shape = RoundedCornerShape(buttonSize / 2),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (active) Coral else buttonColor,
                disabledContainerColor = if (busy) Color(0xFFCBD5E1) else buttonColor.copy(alpha = 0.45f),
                contentColor = Color.White,
                disabledContentColor = Color.White
            ),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
        ) {
            if (busy) {
                CircularProgressIndicator(
                    modifier = Modifier.size(if (buttonSize < 90.dp) 32.dp else 38.dp),
                    color = Color.White,
                    strokeWidth = 3.dp
                )
            } else {
                Icon(
                    if (active) Icons.Filled.Stop else Icons.Filled.Mic,
                    contentDescription = null,
                    modifier = Modifier.size(if (buttonSize < 90.dp) 36.dp else 42.dp)
                )
            }
        }
        if (!micEnabled && disabledReason.isNotBlank()) {
            Text(
                disabledReason,
                color = SlateText,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun LocalInterpreterControlStrip(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    compact: Boolean,
    onReplayTranslation: () -> Unit,
    onTtsEnabled: (Boolean) -> Unit,
    onExit: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Ink, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = if (compact) 6.dp else if (metrics.isTablet) 10.dp else 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                if (state.busy) "번역 중" else if (state.speaking) "녹음 중" else "대면 통역",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                state.status,
                color = Color(0xFFCBD5E1),
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        OutlinedButton(
            onClick = onReplayTranslation,
            enabled = state.translatedDraft.isNotBlank() && !state.busy && !state.speaking && !state.ttsPlaybackActive,
            shape = RoundedCornerShape(10.dp)
        ) {
            Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        Switch(checked = state.ttsEnabled, onCheckedChange = onTtsEnabled)
        TextButton(
            onClick = onExit,
            enabled = !state.busy && !state.speaking && !state.ttsPlaybackActive
        ) {
            Text("나가기", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun QrWaitingScreen(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    onCopyLink: () -> Unit,
    onEndRoom: () -> Unit
) {
    val room = state.room ?: return
    val qrBitmap = rememberQrBitmap(room.joinUrl)
    val showLargeQr = androidx.compose.runtime.remember { mutableStateOf(false) }
    val expandedQrSize = if (metrics.isTablet) 380.dp else 320.dp

    if (showLargeQr.value && qrBitmap != null) {
        AlertDialog(
            onDismissRequest = { showLargeQr.value = false },
            confirmButton = {
                TextButton(onClick = { showLargeQr.value = false }) {
                    Text("닫기", fontWeight = FontWeight.Bold, color = Trust)
                }
            },
            title = { Text(qrWaitingTitle(room.patientLanguage), fontWeight = FontWeight.Bold, color = Ink) },
            text = {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Image(bitmap = qrBitmap.asImageBitmap(), contentDescription = "환자 QR 크게 보기", modifier = Modifier.size(expandedQrSize))
                }
            }
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(metrics.contentSpacing)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(metrics.cardPadding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(metrics.contentSpacing)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(state.hospitalName, color = Trust, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        qrInstructionTitle(room.patientLanguage),
                        color = Ink,
                        style = if (metrics.isTablet) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        qrInstructionBody(room.patientLanguage),
                        color = SlateText,
                        style = if (metrics.isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (room.joinUrl.isBlank()) {
                    Text("QR 링크를 만들 수 없습니다.", color = Coral, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text(
                        "서버가 patientJoinCode를 반환하지 않았습니다. 웹 서버를 최신 버전으로 배포한 뒤 새 방을 만들어주세요.",
                        color = SlateText,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center
                    )
                } else if (qrBitmap == null) {
                    Text("QR 코드를 그릴 수 없습니다.", color = Coral, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text(room.joinUrl, color = SlateText, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                } else {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Box(
                            modifier = Modifier
                                .widthIn(max = metrics.qrMaxSize)
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .background(Color.White, RoundedCornerShape(12.dp))
                                .border(1.dp, Line, RoundedCornerShape(12.dp))
                                .padding(metrics.qrPadding),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(bitmap = qrBitmap.asImageBitmap(), contentDescription = "환자 QR", modifier = Modifier.fillMaxSize())
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .size(if (metrics.isTablet) 58.dp else 48.dp)
                        .background(BlueTint, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.QrCodeScanner, contentDescription = null, tint = Trust, modifier = Modifier.size(if (metrics.isTablet) 32.dp else 28.dp))
                }
                Text(
                    qrWaitingTitle(room.patientLanguage),
                    color = Ink,
                    style = if (metrics.isTablet) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Text(
                    qrWaitingBody(room.patientLanguage),
                    color = SlateText,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = onCopyLink,
                        enabled = room.joinUrl.isNotBlank(),
                        modifier = Modifier
                            .weight(1f)
                            .height(metrics.primaryButtonHeight),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Outlined.ContentCopy, contentDescription = null)
                            Text("링크 복사", fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Button(
                        onClick = { showLargeQr.value = true },
                        enabled = qrBitmap != null,
                        modifier = Modifier
                            .weight(1f)
                            .height(metrics.primaryButtonHeight),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Panel, contentColor = Ink),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                    ) {
                        Text("QR 크게", fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }

        Button(
            onClick = onEndRoom,
            modifier = Modifier
                .fillMaxWidth()
                .height(metrics.primaryButtonHeight),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RoseTint, contentColor = Coral),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
        ) {
            Text("방 종료", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun StaffIdentityRow(state: StaffUiState, onLogout: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text(state.staffName.ifBlank { "직원" }, color = Ink, fontWeight = FontWeight.Bold)
            Text(state.hospitalName, color = SlateText, fontWeight = FontWeight.SemiBold)
        }
        OutlinedButton(onClick = onLogout) {
            Text("로그아웃", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SetupProgress(activeStep: Int) {
    val steps = listOf("방 선택", "언어", "QR", "대화")
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        steps.forEachIndexed { index, label ->
            val step = index + 1
            val active = step <= activeStep
            Text(
                "$step. $label",
                color = if (active) Trust else SlateText,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .weight(1f)
                    .background(if (active) BlueTint else Panel, RoundedCornerShape(40.dp))
                    .padding(vertical = 8.dp)
            )
        }
    }
}

@Composable
private fun PatientNoticePreview(roomMode: String, languageLabel: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BlueTint, RoundedCornerShape(8.dp))
            .border(1.dp, Color(0xFFBFDBFE), RoundedCornerShape(8.dp))
            .padding(14.dp)
    ) {
        Text("환자 화면 안내", color = Trust, fontWeight = FontWeight.Bold)
        Text("언어: $languageLabel", color = Ink, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text("앱 설치 없이 웹으로 입장합니다.", color = SlateText, fontWeight = FontWeight.SemiBold)
        Text("통역을 위해 음성이 외부 AI 서비스에서 처리될 수 있습니다.", color = SlateText, fontWeight = FontWeight.SemiBold)
        Text("원본 음성과 전체 상담 transcript는 저장하지 않습니다.", color = SlateText, fontWeight = FontWeight.SemiBold)
        Text("한 번에 한 사람씩, 차례가 되었을 때만 마이크를 누릅니다.", color = SlateText, fontWeight = FontWeight.SemiBold)
        Text(
            if (roomMode == "procedure") "시술 중 번역 안내가 자동 재생될 수 있습니다." else "짧게 말하고 번역 결과를 확인하며 상담합니다.",
            color = SlateText,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun RoomActionBar(onCopyLink: () -> Unit, onEndRoom: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        OutlinedButton(onClick = onCopyLink, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp)) {
            Text("링크 복사", fontWeight = FontWeight.Bold)
        }
        OutlinedButton(onClick = onEndRoom, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp)) {
            Text("방 종료", fontWeight = FontWeight.Bold, color = Coral)
        }
    }
}

@Composable
private fun Header(state: StaffUiState, metrics: StaffLayoutMetrics) {
    val room = state.room
    val subtitle = if (state.loggedIn && state.hospitalName.isNotBlank()) state.hospitalName else "병원 직원용 통역"
    val activeLanguage = room?.let { patientLanguages.firstOrNull { language -> language.code == it.patientLanguage } }
    val title = when {
        !state.loggedIn -> "MediVoice"
        room == null && state.setupStep == SetupStepLanguage -> "환자 언어 선택"
        room == null -> "통역 모드 선택"
        room.patientJoinedAt == null && room.status != "ended" -> "QR 입장 대기"
        else -> "${activeLanguage?.ko ?: "환자"} ${roomModeLabel(room.roomMode)} 통역방"
    }
    val helper = when {
        !state.loggedIn -> "QR 입장, 짧은 발화, 즉시 번역 재생"
        room == null && state.setupStep == SetupStepLanguage -> ""
        room == null -> "통역 모드를 먼저 고른 뒤 환자 언어를 선택하세요."
        room.patientJoinedAt == null -> "환자 QR을 보여주고 입장을 기다리세요."
        room.status == "ended" -> "통역방이 종료되었습니다."
        else -> "마이크 버튼으로 짧게 말하고 번역을 확인하세요."
    }
    val dark = state.loggedIn && room == null
    val bg = if (dark) Ink else Color.White
    val eyebrowColor = if (dark) Color(0xFFBFDBFE) else Trust
    val titleColor = if (dark) Color.White else Ink
    val helperColor = if (dark) Color(0xFFCBD5E1) else SlateText
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(bg, RoundedCornerShape(16.dp))
            .padding(if (room == null) metrics.headerPadding else metrics.statusPadding)
    ) {
        Text(subtitle, color = eyebrowColor, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(10.dp))
        Text(
            title,
            color = titleColor,
            style = if (room == null && metrics.isTablet) MaterialTheme.typography.displaySmall else if (room == null) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        if (helper.isNotBlank()) {
            Spacer(Modifier.height(16.dp))
            Text(helper, color = helperColor, style = if (metrics.isTablet) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatusPanel(state: StaffUiState, metrics: StaffLayoutMetrics) {
    val room = state.room
    val color = when {
        state.speaking -> Coral
        state.busy -> Trust
        room?.patientJoinedAt != null && room.status != "ended" -> Mint
        else -> Trust
    }
    val label = when {
        !state.loggedIn -> "로그인 필요"
        state.speaking -> "말하는 중"
        state.busy -> "처리 중"
        room?.status == "ended" -> "종료"
        room?.patientJoinedAt != null -> "환자 입장 완료"
        room != null -> "QR 대기"
        else -> "방 생성 전"
    }
    val statusLine = room?.let { roomStatusLabel(it.status, it.patientJoinedAt) } ?: label
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(8.dp))
            .padding(metrics.statusPadding)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, color = color, fontWeight = FontWeight.Bold)
                Text(statusLine, color = Ink, style = if (metrics.isTablet) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            if (room != null) {
                val roomColor = if (room.status == "ended") Coral else color
                StatusPill(roomModeLabel(room.roomMode), roomColor)
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(state.status, color = SlateText, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun LoginPanel(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    onBackendUrl: () -> Unit,
    onBackendChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onRememberEmailChange: (Boolean) -> Unit,
    onLogin: () -> Unit
) {
    val uriHandler = LocalUriHandler.current
    SectionCard("직원 로그인", metrics) {
        OutlinedTextField(
            value = state.backendUrl,
            onValueChange = onBackendChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("서버 주소") },
            singleLine = true
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = state.email,
            onValueChange = onEmailChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("이메일") },
            singleLine = true
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = state.password,
            onValueChange = onPasswordChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("비밀번호") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true
        )
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text("이 기기에서 로그인 유지", color = Ink, fontWeight = FontWeight.SemiBold)
                Text("비밀번호는 저장하지 않습니다.", color = SlateText, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = state.rememberEmail, onCheckedChange = onRememberEmailChange)
        }
        Button(
            onClick = {
                onBackendUrl()
                onLogin()
            },
            enabled = !state.busy,
            modifier = Modifier
                .fillMaxWidth()
                .height(metrics.primaryButtonHeight),
            colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
        ) {
            Text(if (state.busy) "처리 중" else "로그인", fontWeight = FontWeight.Bold)
        }
        Text(
            state.status,
            color = if (state.status.contains("실패") || state.status.contains("확인") || state.status.contains("오류")) Coral else SlateText,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
        TextButton(
            onClick = { uriHandler.openUri("${normalizedBackendUrl(state.backendUrl)}/privacy") },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("개인정보처리방침", color = SlateText, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun EndRoomConfirmDialog(
    roomMode: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("$roomMode 통역방을 종료할까요?", fontWeight = FontWeight.Bold, color = Ink)
        },
        text = {
            Text(
                "종료하면 환자 QR 연결과 현재 화면의 임시 메시지가 닫힙니다.",
                color = SlateText,
                fontWeight = FontWeight.SemiBold
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = Coral, contentColor = Color.White)
            ) {
                Text("방 종료", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("계속 사용", fontWeight = FontWeight.Bold, color = Trust)
            }
        }
    )
}

@Composable
private fun RoomPanel(
    state: StaffUiState,
    onLogout: () -> Unit,
    onLanguage: (String) -> Unit,
    onRoomMode: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onEndRoom: () -> Unit,
    onCopyLink: () -> Unit
) {
    val room = state.room
    val activeRoomReady = room != null && room.patientJoinedAt != null && room.status != "ended"
    val panelTitle = when {
        room == null -> "새 통역방"
        activeRoomReady -> "방 정보"
        else -> "통역방"
    }
    SectionCard(panelTitle) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(state.staffName.ifBlank { "직원" }, color = Ink, fontWeight = FontWeight.Bold)
                Text(state.hospitalName, color = SlateText, fontWeight = FontWeight.SemiBold)
            }
            if (state.room == null) {
                OutlinedButton(onClick = onLogout) { Text("로그아웃") }
            }
        }
        Spacer(Modifier.height(12.dp))

        if (room == null) {
            Text("통역 모드", color = Ink, fontWeight = FontWeight.Bold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ModeChoiceButton(
                    title = "상담방 만들기",
                    body = "상대방과 채팅하듯이 음성 번역을 주고받습니다.",
                    selected = state.selectedRoomMode == "consultation",
                    onClick = { onRoomMode("consultation") }
                )
                ModeChoiceButton(
                    title = "시술방 만들기",
                    body = "시술 중 누워 있는 환자에게 짧은 안내를 들려줍니다.",
                    selected = state.selectedRoomMode == "procedure",
                    onClick = { onRoomMode("procedure") }
                )
            }
            Spacer(Modifier.height(12.dp))
            Text("환자 언어", color = Ink, fontWeight = FontWeight.Bold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                patientLanguages.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        row.forEach { language ->
                            val selected = state.selectedLanguage == language.code
                            val bg = if (selected) BlueTint else Color.White
                            val fg = if (selected) Trust else Ink
                            Button(
                                onClick = { onLanguage(language.code) },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(58.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = bg, contentColor = fg),
                                elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(language.ko, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                    Text(language.native, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                                }
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onCreateRoom,
                enabled = !state.busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
            ) {
                Text(if (state.selectedRoomMode == "procedure") "시술 통역방 생성" else "상담 통역방 생성", fontWeight = FontWeight.Bold)
            }
        } else {
            val language = patientLanguages.firstOrNull { it.code == room.patientLanguage }
            val patientReady = room.patientJoinedAt != null && room.status != "ended"
            val modeLabel = roomModeLabel(room.roomMode)
            val qrBitmap = rememberQrBitmap(room.joinUrl)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                StatusBadge("$modeLabel 모드", true, Modifier.weight(1f), modeLabel)
                StatusBadge("환자 언어", true, Modifier.weight(1f), language?.ko ?: room.patientLanguage)
                StatusBadge("방 상태", patientReady && room.status != "ended", Modifier.weight(1f), roomStatusLabel(room.status, room.patientJoinedAt))
            }
            Spacer(Modifier.height(12.dp))

            if (!patientReady) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Panel, RoundedCornerShape(8.dp))
                        .padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("환자 QR", color = Trust, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    Text("QR 코드를 스캔하세요", color = Ink, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text("환자가 입장하면 자동으로 통역 화면이 열립니다.", color = SlateText, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(16.dp))
                    qrBitmap?.let {
                        Box(
                            modifier = Modifier
                                .background(Color.White, RoundedCornerShape(8.dp))
                                .border(1.dp, Line, RoundedCornerShape(8.dp))
                                .padding(12.dp)
                        ) {
                            Image(bitmap = it.asImageBitmap(), contentDescription = "환자 QR", modifier = Modifier.size(248.dp))
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(room.joinUrl, color = SlateText, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = onCopyLink, modifier = Modifier.weight(1f)) { Text("환자 링크 복사") }
                OutlinedButton(onClick = onEndRoom, modifier = Modifier.weight(1f)) { Text("방 종료") }
            }
        }
    }
}

@Composable
private fun ModeChoiceButton(
    title: String,
    body: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 86.dp)
            .border(
                width = 1.dp,
                color = if (selected) Trust else Line,
                shape = RoundedCornerShape(8.dp)
            ),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) BlueTint else Color.White,
            contentColor = Ink
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, color = Ink, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(body, color = SlateText, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
                }
                StatusPill(if (selected) "선택됨" else "선택", if (selected) Trust else SlateText)
            }
        }
    }
}

@Composable
private fun TranslationPanel(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    onToggleSpeak: () -> Unit,
    onReplayTranslation: () -> Unit,
    onTextInputChange: (String) -> Unit,
    onSubmitText: () -> Unit,
    onTtsEnabled: (Boolean) -> Unit,
    onRequestMicPermission: () -> Unit
) {
    val room = state.room
    val patientReady = room?.patientJoinedAt != null && room.status != "ended"
    val canSpeak = patientReady && canStaffStartTurn(room.status) && state.recordAudioGranted && !state.busy && !state.ttsPlaybackActive
    val patientSpeaking = room?.status == "patient_speaking"
    val showingPatientTurn = state.lastMessageSpeaker == "patient"
    val sourceLabel = if (showingPatientTurn) "환자 발화" else "한국어 인식"
    val translatedLabel = if (showingPatientTurn) "직원용 한국어 번역" else "환자 언어 번역"
    val sourcePlaceholder = if (showingPatientTurn) "환자가 말하면 원문이 표시됩니다." else "말하면 한국어 원문이 표시됩니다."
    val translatedPlaceholder = if (showingPatientTurn) "환자 발화의 한국어 번역이 표시됩니다." else "번역 결과가 표시되고 직원폰에서 재생됩니다."
    val isConsultation = room?.roomMode == "consultation"
    if (isConsultation) {
        SectionCard("상담 통역", metrics) {
            AutoPlayBar(state = state, onTtsEnabled = onTtsEnabled)
            Spacer(Modifier.height(12.dp))
            ConversationList(state.messages, metrics)
            Spacer(Modifier.height(10.dp))
            MicControlBox(
                state = state,
                metrics = metrics,
                patientReady = patientReady,
                patientSpeaking = patientSpeaking,
                canSpeak = canSpeak,
                large = false,
                onToggleSpeak = onToggleSpeak,
                onRequestMicPermission = onRequestMicPermission
            )
            Spacer(Modifier.height(8.dp))
            TextFallbackBox(
                value = state.textInput,
                metrics = metrics,
                enabled = patientReady && canStaffSendText(room.status) && !state.busy && !state.speaking,
                onValueChange = onTextInputChange,
                onSubmit = onSubmitText
            )
            if (state.translatedDraft.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                ReplayButton(onReplayTranslation, enabled = true)
            }
        }
        return
    }

    SectionCard("시술 통역", metrics) {
        AutoPlayBar(state = state, onTtsEnabled = onTtsEnabled)
        Spacer(Modifier.height(14.dp))
        MicControlBox(
            state = state,
            metrics = metrics,
            patientReady = patientReady,
            patientSpeaking = patientSpeaking,
            canSpeak = canSpeak,
            large = true,
            onToggleSpeak = onToggleSpeak,
            onRequestMicPermission = onRequestMicPermission
        )
        Spacer(Modifier.height(14.dp))
        TranscriptBox(sourceLabel, state.sourceDraft.ifBlank { sourcePlaceholder }, metrics)
        Spacer(Modifier.height(8.dp))
        TranscriptBox(translatedLabel, state.translatedDraft.ifBlank { translatedPlaceholder }, metrics)
        Spacer(Modifier.height(8.dp))
        ReplayButton(onReplayTranslation, enabled = state.translatedDraft.isNotBlank())
    }
}

@Composable
private fun AutoPlayBar(state: StaffUiState, onTtsEnabled: (Boolean) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = null, tint = Trust, modifier = Modifier.size(20.dp))
        Spacer(Modifier.size(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text("직원폰 자동재생", color = Ink, fontWeight = FontWeight.Bold)
            Text(state.ttsStatus, color = SlateText, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
        }
        Switch(checked = state.ttsEnabled, onCheckedChange = onTtsEnabled)
    }
}

@Composable
private fun ReplayButton(onReplayTranslation: () -> Unit, enabled: Boolean) {
    OutlinedButton(
        onClick = onReplayTranslation,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp)
    ) {
        Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text("직원폰 다시 듣기", fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MicControlBox(
    state: StaffUiState,
    metrics: StaffLayoutMetrics,
    patientReady: Boolean,
    patientSpeaking: Boolean,
    canSpeak: Boolean,
    large: Boolean,
    onToggleSpeak: () -> Unit,
    onRequestMicPermission: () -> Unit
) {
    val buttonSize = if (large) metrics.micLargeSize else metrics.micSmallSize
    val iconSize = if (large) {
        if (metrics.isTablet) 56.dp else 46.dp
    } else {
        if (metrics.isTablet) 36.dp else 32.dp
    }
    val panelPadding = if (large) metrics.cardPadding else 12.dp
    val micButtonEnabled = state.speaking || (!state.busy && canSpeak)
    val disabledMicColor = if (state.busy) Ink else Color(0xFFCBD5E1)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(16.dp))
            .padding(vertical = panelPadding),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                when {
                    state.speaking -> "말하는 중"
                    state.busy -> "번역 중"
                    else -> "마이크"
                },
                color = if (state.speaking) Coral else Trust,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = onToggleSpeak,
                enabled = micButtonEnabled,
                modifier = Modifier.size(buttonSize),
                shape = RoundedCornerShape(120.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.speaking) Coral else Ink,
                    contentColor = Color.White,
                    disabledContainerColor = disabledMicColor,
                    disabledContentColor = Color.White
                )
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        if (state.speaking) Icons.Filled.Stop else Icons.Filled.Mic,
                        contentDescription = null,
                        modifier = Modifier.size(iconSize)
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        when {
                            state.speaking -> "종료"
                            state.busy -> "처리 중"
                            else -> "말하기"
                        },
                        style = if (large) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(
                when {
                    state.speaking -> state.status
                    !patientReady -> "환자가 입장하면 마이크가 활성화됩니다."
                    !state.recordAudioGranted -> "마이크 권한이 필요합니다."
                    patientSpeaking -> "환자가 말하는 중입니다. 잠시 기다려주세요."
                    state.busy -> "번역을 처리하고 있습니다."
                    else -> "짧게 누르고 말한 뒤 다시 누르세요."
                },
                color = SlateText,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            if (patientReady && !state.recordAudioGranted) {
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = onRequestMicPermission) {
                    Text("마이크 권한 허용", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun TextFallbackBox(
    value: String,
    metrics: StaffLayoutMetrics,
    enabled: Boolean,
    onValueChange: (String) -> Unit,
    onSubmit: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(16.dp))
            .padding(if (metrics.isTablet) 10.dp else 8.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                modifier = Modifier.weight(1f),
                placeholder = { Text("환자에게 보낼 한국어") },
                maxLines = 3
            )
            Button(
                onClick = onSubmit,
                enabled = enabled && value.trim().isNotEmpty(),
                modifier = Modifier.size(52.dp),
                shape = RoundedCornerShape(60.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "전송", modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun ConversationList(messages: List<StaffMessage>, metrics: StaffLayoutMetrics) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = metrics.conversationMinHeight)
            .background(Mist, RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (messages.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().height(metrics.conversationEmptyHeight), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("AI", color = Mint, fontWeight = FontWeight.Bold, modifier = Modifier
                        .background(Color(0xFFDFF7EF), RoundedCornerShape(40.dp))
                        .padding(horizontal = 14.dp, vertical = 8.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("환자와 주고받은 말이 여기에 표시됩니다.", color = Ink, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text("마이크로 짧게 말하면 자동 번역됩니다.", color = SlateText, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                }
            }
        } else {
            messages.takeLast(20).forEach { message ->
                ConversationBubble(message)
            }
        }
    }
}

@Composable
private fun ConversationBubble(message: StaffMessage) {
    val isStaff = message.speaker == "staff"
    val bubbleColor = if (isStaff) Trust else Color.White
    val labelColor = if (isStaff) Color.White else Mint
    val mainColor = if (isStaff) Color.White else Ink
    val subColor = if (isStaff) Color.White.copy(alpha = 0.84f) else SlateText
    val borderText = if (isStaff) "나" else "환자"
    val mainText = if (isStaff) message.sourceText.ifBlank { message.text } else message.text
    val subText = if (isStaff) message.text else message.sourceText
    val sentAt = messageTimeLabel(message.createdAt)
    val bubbleShape = if (isStaff) {
        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 6.dp)
    } else {
        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 6.dp, bottomEnd = 18.dp)
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isStaff) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Top
    ) {
        if (!isStaff) {
            Box(
                modifier = Modifier
                    .padding(end = 8.dp)
                    .size(34.dp)
                    .background(Color(0xFFDFF7EF), RoundedCornerShape(40.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text("P", color = Mint, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
            }
        }
        Column(
            modifier = Modifier
                .fillMaxWidth(0.86f)
                .background(bubbleColor, bubbleShape)
                .then(if (isStaff) Modifier else Modifier.border(1.dp, Line, bubbleShape))
                .padding(12.dp)
        ) {
            Text(borderText, color = labelColor, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
            Text(mainText.ifBlank { "내용 없음" }, color = mainColor, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            if (subText.isNotBlank() && subText != mainText) {
                Spacer(Modifier.height(4.dp))
                Text(subText, color = subColor, fontWeight = FontWeight.SemiBold)
            }
            if (sentAt.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(sentAt, color = subColor, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun TranscriptBox(label: String, text: String, metrics: StaffLayoutMetrics) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(8.dp))
            .padding(if (metrics.isTablet) 18.dp else 14.dp)
    ) {
        Text(label, color = Trust, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(4.dp))
        Text(text, color = Ink, style = if (metrics.isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SectionCard(
    title: String,
    metrics: StaffLayoutMetrics = CompactStaffLayoutMetrics,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(metrics.cardPadding)) {
            Text(title, color = Ink, style = if (metrics.isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun StatusPill(text: String, color: Color) {
    Text(
        text,
        color = color,
        fontWeight = FontWeight.Bold,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier
            .background(color.copy(alpha = 0.10f), RoundedCornerShape(40.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    )
}

@Composable
private fun StatusBadge(label: String, ok: Boolean, modifier: Modifier = Modifier, value: String? = null) {
    val bg = if (ok) GreenTint else Panel
    val fg = if (ok) Color(0xFF047857) else Color(0xFF475569)
    Column(
        modifier = modifier
            .background(bg, RoundedCornerShape(8.dp))
            .border(1.dp, if (ok) Color(0xFFBBF7D0) else Line, RoundedCornerShape(8.dp))
            .heightIn(min = 64.dp)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value ?: if (ok) "통과" else "확인", color = fg, fontWeight = FontWeight.Bold)
        Text(label, color = fg, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun rememberQrBitmap(text: String): Bitmap? {
    return androidx.compose.runtime.remember(text) {
        runCatching {
            val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 512, 512)
            Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888).also { bitmap ->
                for (x in 0 until 512) {
                    for (y in 0 until 512) {
                        bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                    }
                }
            }
        }.getOrNull()
    }
}
