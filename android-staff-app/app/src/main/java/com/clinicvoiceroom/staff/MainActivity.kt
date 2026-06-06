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
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
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

private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
private const val StaffSessionCookieName = "cvr_session"
private const val SetupStepMode = "mode"
private const val SetupStepLanguage = "language"
private const val RealtimePcmSampleRate = 24000
private const val RealtimeTurnWaitMs = 6500L

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
    val status: String = "로그인 후 통역방을 생성하세요.",
    val busy: Boolean = false,
    val connected: Boolean = false,
    val speaking: Boolean = false,
    val ttsEnabled: Boolean = true,
    val ttsStatus: String = "휴대폰 미디어 출력 준비 중",
    val recordAudioGranted: Boolean = false,
    val sourceDraft: String = "",
    val translatedDraft: String = "",
    val lastMessageSpeaker: String = "",
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

    fun connect() {
        if (open) return

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
    }

    fun isReady(): Boolean = open

    fun startTurn() {
        connect()
        synchronized(this) {
            outputText.clear()
            inputText.clear()
        }
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
                    JSONObject().put("modalities", JSONArray().put("text"))
                )
        )

        turnDoneLatch.await(timeoutMs, TimeUnit.MILLISECONDS)
        errorRef.get()?.let { throw it }
        val translated = synchronized(this) { outputText.toString().trim() }
        if (translated.isBlank()) error("Realtime returned no translated text")

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
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) synchronized(this) { outputText.append(delta) }
                }

                "session.output_transcript.done",
                "response.output_audio_transcript.done",
                "response.output_text.done" -> {
                    val finalText = event.optString("transcript", event.optString("text"))
                    if (finalText.isNotBlank()) synchronized(this) {
                        outputText.clear()
                        outputText.append(finalText)
                    }
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
                }

                "response.done" -> turnDoneLatch.countDown()

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
    private var realtimePreparingRoomId: String = ""
    @Volatile
    private var realtimeTurnActive = false
    @Volatile
    private var roomPollingActive = false
    @Volatile
    private var roomPollInFlight = false
    private val realtimeExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var messageCursor: String? = null
    private var messagePollingInitialized = false
    private val seenMessageIds = mutableSetOf<String>()
    private val roomPollRunnable = object : Runnable {
        override fun run() {
            pollCurrentRoom()
            if (roomPollingActive) {
                mainHandler.postDelayed(this, roomPollDelayMs())
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
                        onLanguage = { code -> updateState { it.copy(selectedLanguage = code) } },
                        onRoomMode = { mode ->
                            updateState {
                                it.copy(
                                    selectedRoomMode = mode,
                                    setupStep = SetupStepLanguage,
                                    status = "${roomModeLabel(mode)} 통역방에 사용할 환자 언어를 선택하세요."
                                )
                            }
                        },
                        onBackToMode = {
                            updateState {
                                it.copy(
                                    setupStep = SetupStepMode,
                                    status = "상담방 또는 시술방을 선택하세요."
                                )
                            }
                        },
                        onCreateRoom = ::createRoom,
                        onToggleSpeak = ::toggleSpeaking,
                        onRequestEndRoom = { updateState { it.copy(showEndRoomConfirm = true) } },
                        onConfirmEndRoom = ::endRoom,
                        onDismissEndRoom = { updateState { it.copy(showEndRoomConfirm = false) } },
                        onCopyLink = ::copyJoinLink,
                        onReplayTranslation = ::replayTranslation,
                        onTextInputChange = { value -> updateState { it.copy(textInput = value) } },
                        onSubmitText = ::submitTextMessage,
                        onTtsEnabled = { enabled -> updateState { it.copy(ttsEnabled = enabled) } },
                        onRequestMicPermission = ::requestMicPermissionIfMissing
                    )
                }
            }
        }
        verifyExistingSession()
    }

    override fun onDestroy() {
        stopRoomPolling()
        recordingActive = false
        runCatching { recordingThread?.join(500) }
        closeRealtimeTurnClient()
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        StaffMediaButtonRouter.setHandler(null)
        textToSpeech?.shutdown()
        textToSpeech = null
        realtimeExecutor.shutdownNow()
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
                        status = "로그인 유지됨. 통역방을 생성하세요."
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

        mediaSession = MediaSession(this, "ClinicVoiceRoomStaffMediaSession").apply {
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
        toggleSpeaking()
        return true
    }

    private fun initializeTts() {
        textToSpeech = TextToSpeech(this, { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.setAudioAttributes(ttsAudioAttributes)
            }
            updateState {
                it.copy(ttsStatus = if (status == TextToSpeech.SUCCESS) "휴대폰 미디어 출력으로 재생" else "TTS 초기화 실패")
            }
        }, "com.google.android.tts")
        textToSpeech?.setAudioAttributes(ttsAudioAttributes)
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
                        status = "로그인 완료. 통역방을 생성하세요.",
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
                        messages = emptyList(),
                        textInput = "",
                        status = "로그아웃되었습니다."
                    )
                }
        }
    }

    private fun createRoom() {
        val state = uiState.value
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
                startRoomPolling()
            }.onFailure { caught ->
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "$modeLabel 방 생성 실패: $message") }
                appendLog("$modeLabel 방 생성 실패: $message")
            }
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
        mainHandler.removeCallbacks(roomPollRunnable)
        mainHandler.post(roomPollRunnable)
    }

    private fun stopRoomPolling() {
        roomPollingActive = false
        mainHandler.removeCallbacks(roomPollRunnable)
    }

    private fun resetMessagePolling() {
        messageCursor = null
        messagePollingInitialized = false
        seenMessageIds.clear()
    }

    private fun roomPollDelayMs(): Long {
        val room = uiState.value.room
        return if (room?.patientJoinedAt == null) 800L else 1_500L
    }

    private fun closeRealtimeTurnClient() {
        realtimeTurnActive = false
        realtimePreparingRoomId = ""
        runCatching { realtimeTurnClient?.close() }
        realtimeTurnClient = null
        realtimeTurnRoomId = ""
    }

    private fun pollCurrentRoom() {
        if (!roomPollingActive || roomPollInFlight) return
        val snapshot = uiState.value
        val room = snapshot.room ?: return
        if (!snapshot.loggedIn) return

        val backend = normalizedBackendUrl(snapshot.backendUrl)
        roomPollInFlight = true
        executor.execute {
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
                if (ended) {
                    stopRoomPolling()
                } else {
                    if (updatedRoom.patientJoinedAt != null) {
                        prepareRealtimeTurnClientAsync(updatedRoom, force = joinedNow)
                    }
                    pollRoomMessages(updatedRoom, backend)
                }
            }.onFailure { caught ->
                appendLog("방 상태 확인 실패: ${userFacingError(caught)}")
            }
            roomPollInFlight = false
        }
    }

    private fun pollRoomMessages(room: RoomInfo, backend: String) {
        val urlBuilder = "$backend/api/rooms/${room.id}/messages".toHttpUrl().newBuilder()
        messageCursor?.let { urlBuilder.addQueryParameter("after", it) }

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
        if (id.isNotBlank() && !seenMessageIds.add(id)) return false

        val createdAt = message.optString("createdAt")
        if (createdAt.isNotBlank() && (messageCursor == null || createdAt > (messageCursor ?: ""))) {
            messageCursor = createdAt
        }
        return true
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
            sourceText = message.optString("sourceText"),
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

    private fun beginStaffTurn() {
        val room = uiState.value.room ?: return
        updateState { it.copy(busy = true, status = "마이크 준비 중입니다...") }
        executor.execute {
            runCatching {
                val updatedRoom = transitionRoomState(room, "staff_speaking")
                realtimeTurnActive = tryStartPreparedRealtimeTurn(updatedRoom)
                updateState { it.copy(room = updatedRoom, busy = false) }
                mainHandler.post { startStaffRecording() }
            }.onFailure { caught ->
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "지금은 말할 수 없습니다: $message") }
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
        val data = postJson("$backend/api/realtime/session-token", payload)
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
        if (room.status == "ended" || room.patientJoinedAt == null) return
        if (recordingActive || realtimeTurnActive) return

        val current = realtimeTurnClient
        if (!force && current != null && realtimeTurnRoomId == room.id && current.isReady()) return
        if (realtimePreparingRoomId == room.id) return

        realtimePreparingRoomId = room.id
        realtimeExecutor.execute {
            runCatching {
                appendLog("Realtime preparing")
                val token = requestRealtimeToken(room)
                val client = AndroidRealtimeTurnClient(http, token, ::appendLog)
                client.connect()
                if (uiState.value.room?.id == room.id && !recordingActive && !realtimeTurnActive) {
                    runCatching { realtimeTurnClient?.close() }
                    realtimeTurnClient = client
                    realtimeTurnRoomId = room.id
                    appendLog("Realtime ready")
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
            appendLog("Realtime turn started")
            true
        }.onFailure {
            appendLog("Realtime start failed, using upload fallback: ${it.message}")
            closeRealtimeTurnClient()
            prepareRealtimeTurnClientAsync(room, force = true)
        }.getOrDefault(false)
    }

    @SuppressLint("MissingPermission")
    private fun startStaffRecording() {
        if (recordingActive) return

        synchronized(recordingLock) {
            recordedPcm = ByteArrayOutputStream()
        }
        recordingActive = true
        updateState {
            it.copy(
                busy = false,
                connected = true,
                speaking = true,
                sourceDraft = "",
                translatedDraft = "",
                status = "말하는 중입니다. 끝나면 다시 누르세요."
            )
        }
        appendLog("마이크 시작: 안전 녹음 업로드 모드")

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

                while (recordingActive && System.currentTimeMillis() - startedAt < 12000L) {
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
                        realtimeTurnClient?.appendPcm(byteBuffer, count * 2)
                    }
                }

                if (recordingActive) {
                    recordingActive = false
                    mainHandler.post { stopStaffRecordingAndTranslate() }
                }
            }.onFailure { caught ->
                recordingActive = false
                realtimeTurnActive = false
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
                recordingThread?.join(1500)
                val pcm = synchronized(recordingLock) {
                    recordedPcm?.toByteArray() ?: ByteArray(0)
                }
                synchronized(recordingLock) {
                    recordedPcm = null
                }
                if (pcm.size < 1600) error("녹음된 음성이 너무 짧습니다.")

                val room = uiState.value.room ?: error("Room is missing")
                runCatching {
                    val translatingRoom = transitionRoomState(room, "translating_to_patient")
                    updateState { it.copy(room = translatingRoom) }
                }.onFailure { appendLog("번역 상태 전환 실패: ${it.message}") }

                val result = translateStaffVoiceTurn(room, pcm)
                val message = result.getJSONObject("message")
                rememberMessage(message)
                val parsedMessage = messageFromJson(message, room.patientLanguage)
                appendConversationMessage(parsedMessage)
                val source = message.optString("sourceText")
                val translated = parsedMessage.text

                updateState {
                    it.copy(
                        busy = false,
                        sourceDraft = source,
                        translatedDraft = translated,
                        lastMessageSpeaker = "staff",
                        status = "번역 완료. 다시 말하려면 마이크를 누르세요."
                    )
                }
                speakTranslatedText(translated, room.patientLanguage)
                runCatching {
                    val readyRoom = transitionRoomState(room, "ready")
                    updateState { it.copy(room = readyRoom) }
                }.onFailure { appendLog("대기 상태 전환 실패: ${it.message}") }
                appendLog("번역 완료")
            }.onFailure { caught ->
                recoverRoomToReady("번역 실패")
                val message = userFacingError(caught)
                updateState { it.copy(busy = false, status = "번역 실패: $message") }
                appendLog("번역 실패: $message")
            }
        }
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
            val realtime = realtimeTurnClient
            if (realtime != null) {
                runCatching {
                    val result = realtime.stopTurnAndTranslate()
                    val sourceText = result.sourceText.ifBlank {
                        "\uD55C\uAD6D\uC5B4 \uC6D0\uBB38\uC744 \uD45C\uC2DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
                    }
                    appendLog("Realtime translation complete")
                    return persistRealtimeStaffVoiceTurn(room, sourceText, result.translatedText)
                }.onFailure {
                    appendLog("Realtime failed, falling back to upload: ${it.message}")
                    closeRealtimeTurnClient()
                }
            }
        }

        val wav = pcm16ToWav(pcm, RealtimePcmSampleRate, 1)
        appendLog("Upload fallback translation")
        return uploadStaffVoiceTurn(room, wav)
    }

    private fun persistRealtimeStaffVoiceTurn(room: RoomInfo, sourceText: String, translatedText: String): JSONObject {
        val backend = normalizedBackendUrl(uiState.value.backendUrl)
        val endpoint = if (room.roomMode == "procedure") "procedure-turns" else "consultation-voice-turns"
        val messageId = "staff-realtime-android-${System.currentTimeMillis()}"
        val payload = JSONObject()
            .put("roomId", room.id)
            .put("messageId", messageId)
            .put("role", "staff")
            .put("patientLanguage", room.patientLanguage)
            .put("sourceText", sourceText)
            .put("translatedText", translatedText)
            .toString()
        return postJson("$backend/api/$endpoint", payload)
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
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) error(apiErrorMessage(text, response.code))
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
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Clinic Voice Room patient link", url))
        appendLog("환자 링크 복사")
    }

    private fun replayTranslation() {
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
        val result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cvr-${System.currentTimeMillis()}")
        if (result == TextToSpeech.ERROR) {
            updateState { it.copy(ttsStatus = "$label 재생 실패") }
            appendLog("TTS 재생 실패: $label")
            return
        }
        updateState { it.copy(ttsStatus = "$label 재생 중") }
    }

    private fun postJson(url: String, json: String): JSONObject {
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .post(json.toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
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

    private fun getJson(url: String): JSONObject {
        val request = Request.Builder().url(url).get().build()
        http.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
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
        raw == "Procedure turn translation failed" || raw == "Consultation voice translation failed" || raw == "Text translation failed" -> "번역에 실패했습니다. 네트워크를 확인하고 다시 시도하세요."
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
    return if (mode == "procedure") "시술" else "상담"
}

private fun roomModeDescription(mode: String): String {
    return if (mode == "procedure") {
        "누워 있는 환자에게 짧은 안내를 바로 번역해 들려줍니다."
    } else {
        "직원과 환자가 채팅하듯이 짧게 말하고 번역을 주고받습니다."
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

private fun normalizeClinicText(text: String, patientLanguage: String): String {
    val rejuran = if (patientLanguage == "ko") "리쥬란" else "Rejuran"
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
    onBackToMode: () -> Unit,
    onCreateRoom: () -> Unit,
    onToggleSpeak: () -> Unit,
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
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Header(state)

        AnimatedContent(
            targetState = staffScreenKey(state),
            label = "staff-flow-screen",
            transitionSpec = {
                val forward = staffScreenOrder(targetState) >= staffScreenOrder(initialState)
                (slideInHorizontally(animationSpec = tween(220)) { width -> if (forward) width / 4 else -width / 4 } + fadeIn(tween(180)))
                    .togetherWith(slideOutHorizontally(animationSpec = tween(180)) { width -> if (forward) -width / 5 else width / 5 } + fadeOut(tween(140)))
            }
        ) { screen ->
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (screen) {
                    "login" -> LoginPanel(
                        state = state,
                        onBackendUrl = onBackendUrl,
                        onBackendChange = onBackendChange,
                        onEmailChange = onEmailChange,
                        onPasswordChange = onPasswordChange,
                        onRememberEmailChange = onRememberEmailChange,
                        onLogin = onLogin
                    )

                    "mode" -> ModeSelectionScreen(
                        state = state,
                        onRoomMode = onRoomMode,
                        onLogout = onLogout
                    )

                    "language" -> LanguageSelectionScreen(
                        state = state,
                        onLanguage = onLanguage,
                        onBackToMode = onBackToMode,
                        onCreateRoom = onCreateRoom
                    )

                    "qr" -> QrWaitingScreen(
                        state = state,
                        onCopyLink = onCopyLink,
                        onEndRoom = onRequestEndRoom
                    )

                    "ended" -> {
                        SetupProgress(activeStep = 4)
                        StatusPanel(state)
                        TranslationPanel(
                            state = state,
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
                        SetupProgress(activeStep = 4)
                        StatusPanel(state)
                        TranslationPanel(
                            state = state,
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
    state: StaffUiState,
    onRoomMode: (String) -> Unit,
    onLogout: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ModeLargeCard(
            title = "상담방 만들기",
            body = "텍스트 중심 AI 번역 상담",
            icon = {
                Icon(
                    Icons.Outlined.ChatBubbleOutline,
                    contentDescription = null,
                    tint = Trust,
                    modifier = Modifier.size(42.dp)
                )
            },
            onClick = { onRoomMode("consultation") }
        )

        ModeLargeCard(
            title = "시술방 만들기",
            body = "시술 중 안내 번역",
            icon = {
                Icon(
                    Icons.Outlined.MedicalServices,
                    contentDescription = null,
                    tint = Ink,
                    modifier = Modifier.size(42.dp)
                )
            },
            onClick = { onRoomMode("procedure") }
        )

        Button(
            onClick = onLogout,
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RoseTint, contentColor = Coral),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = Coral)
                Text("로그아웃", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
            }
        }
    }
}

@Composable
private fun ModeLargeCard(
    title: String,
    body: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(252.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Ink),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                modifier = Modifier
                    .size(74.dp)
                    .background(BlueTint, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                icon()
            }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    title,
                    color = Ink,
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    body,
                    color = SlateText,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
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
    return if (mode == "procedure") "Procedure" else "Consultation"
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
    onLanguage: (String) -> Unit,
    onBackToMode: () -> Unit,
    onCreateRoom: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text(
                        modeEnglishLabel(state.selectedRoomMode),
                        color = Trust,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier
                            .background(BlueTint, RoundedCornerShape(40.dp))
                            .padding(horizontal = 18.dp, vertical = 10.dp)
                    )
                }
                Text(
                    "AI translation ${if (state.selectedRoomMode == "procedure") "procedure" else "consultation"}",
                    color = Ink,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "Choose the language the patient will read and hear.",
                    color = SlateText,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    patientLanguages.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            row.forEach { language ->
                                LanguageTile(
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
                        .height(62.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Outlined.Translate, contentDescription = null)
                        Text(if (state.busy) "Creating room..." else "Confirm language", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    }
                }
            }
        }

        Button(
            onClick = onBackToMode,
            enabled = !state.busy,
            modifier = Modifier
                .fillMaxWidth()
                .height(78.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Ink),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = null, modifier = Modifier.size(30.dp))
                Text("처음으로", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall)
            }
        }
    }
}

@Composable
private fun LanguageTile(
    language: PatientLanguageOption,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .height(78.dp)
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
        contentPadding = ButtonDefaults.ContentPadding
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(
                languageNativeLabel(language),
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                languageEnglishLabel(language.code),
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
private fun QrWaitingScreen(
    state: StaffUiState,
    onCopyLink: () -> Unit,
    onEndRoom: () -> Unit
) {
    val room = state.room ?: return
    val language = patientLanguages.firstOrNull { it.code == room.patientLanguage }
    val qrBitmap = rememberQrBitmap(room.joinUrl)
    val showLargeQr = androidx.compose.runtime.remember { mutableStateOf(false) }

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
                    Image(bitmap = qrBitmap.asImageBitmap(), contentDescription = "환자 QR 크게 보기", modifier = Modifier.size(320.dp))
                }
            }
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(state.hospitalName, color = Trust, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Text(qrInstructionTitle(room.patientLanguage), color = Ink, style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
                Text(
                    qrInstructionBody(room.patientLanguage),
                    color = SlateText,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
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
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .background(Color.White, RoundedCornerShape(12.dp))
                            .border(1.dp, Line, RoundedCornerShape(12.dp))
                            .padding(22.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(bitmap = qrBitmap.asImageBitmap(), contentDescription = "환자 QR", modifier = Modifier.fillMaxSize())
                    }
                }

                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .background(BlueTint, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.QrCodeScanner, contentDescription = null, tint = Trust, modifier = Modifier.size(30.dp))
                }
                Text(qrWaitingTitle(room.patientLanguage), color = Ink, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text(qrWaitingBody(room.patientLanguage), color = SlateText, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = onCopyLink,
                        enabled = room.joinUrl.isNotBlank(),
                        modifier = Modifier
                            .weight(1f)
                            .height(62.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Outlined.ContentCopy, contentDescription = null)
                            Text("환자 링크 복사", fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Button(
                        onClick = { showLargeQr.value = true },
                        enabled = qrBitmap != null,
                        modifier = Modifier
                            .weight(1f)
                            .height(62.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Panel, contentColor = Ink),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                    ) {
                        Text("QR 크게 보기", fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }

        Button(
            onClick = onEndRoom,
            modifier = Modifier
                .fillMaxWidth()
                .height(58.dp),
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
private fun Header(state: StaffUiState) {
    val room = state.room
    val subtitle = if (state.loggedIn && state.hospitalName.isNotBlank()) state.hospitalName else "병원 직원용 통역"
    val activeLanguage = room?.let { patientLanguages.firstOrNull { language -> language.code == it.patientLanguage } }
    val title = when {
        !state.loggedIn -> "Clinic Voice Room"
        room == null && state.setupStep == SetupStepLanguage -> "Choose patient language"
        room == null -> "Select translation mode"
        room.patientJoinedAt == null && room.status != "ended" -> "QR 입장 대기"
        else -> "${activeLanguage?.ko ?: "환자"} ${roomModeLabel(room.roomMode)} 통역방"
    }
    val helper = when {
        !state.loggedIn -> "QR 입장, 짧은 발화, 즉시 번역 재생"
        room == null && state.setupStep == SetupStepLanguage -> ""
        room == null -> "Choose the room type first. The patient will choose their language on the next screen."
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
            .padding(if (room == null) 26.dp else 16.dp)
    ) {
        Text(subtitle, color = eyebrowColor, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(12.dp))
        Text(title, color = titleColor, style = if (room == null) MaterialTheme.typography.displaySmall else MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (helper.isNotBlank()) {
            Spacer(Modifier.height(22.dp))
            Text(helper, color = helperColor, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatusPanel(state: StaffUiState) {
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
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, color = color, fontWeight = FontWeight.Bold)
                Text(statusLine, color = Ink, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
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
    onBackendUrl: () -> Unit,
    onBackendChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onRememberEmailChange: (Boolean) -> Unit,
    onLogin: () -> Unit
) {
    SectionCard("직원 로그인") {
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
                .height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Trust, contentColor = Color.White)
        ) {
            Text(if (state.busy) "처리 중" else "로그인", fontWeight = FontWeight.Bold)
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
    onToggleSpeak: () -> Unit,
    onReplayTranslation: () -> Unit,
    onTextInputChange: (String) -> Unit,
    onSubmitText: () -> Unit,
    onTtsEnabled: (Boolean) -> Unit,
    onRequestMicPermission: () -> Unit
) {
    val room = state.room
    val patientReady = room?.patientJoinedAt != null && room.status != "ended"
    val canSpeak = patientReady && canStaffStartTurn(room.status) && state.recordAudioGranted && !state.busy
    val patientSpeaking = room?.status == "patient_speaking"
    val showingPatientTurn = state.lastMessageSpeaker == "patient"
    val sourceLabel = if (showingPatientTurn) "환자 발화" else "한국어 인식"
    val translatedLabel = if (showingPatientTurn) "직원에게 보여줄 한국어" else "환자에게 들려줄 번역"
    val sourcePlaceholder = if (showingPatientTurn) "환자가 말하면 원문이 표시됩니다." else "말하면 한국어 원문이 표시됩니다."
    val translatedPlaceholder = if (showingPatientTurn) "환자 발화의 한국어 번역이 표시됩니다." else "번역 결과가 표시되고 자동재생됩니다."
    val isConsultation = room?.roomMode == "consultation"
    if (isConsultation) {
        SectionCard("상담 통역") {
            Text(
                "웹 상담방처럼 대화가 아래에 쌓이고, 하단 조작부에서 바로 말하거나 텍스트로 보낼 수 있습니다.",
                color = SlateText,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(10.dp))
            AutoPlayBar(state = state, onTtsEnabled = onTtsEnabled)
            Spacer(Modifier.height(12.dp))
            ConversationList(state.messages)
            Spacer(Modifier.height(10.dp))
            MicControlBox(
                state = state,
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

    SectionCard("시술 통역") {
        Text(
            "짧게 말하면 환자 언어로 바로 재생됩니다. 놓친 안내는 다시 들을 수 있습니다.",
            color = SlateText,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(10.dp))
        AutoPlayBar(state = state, onTtsEnabled = onTtsEnabled)
        Spacer(Modifier.height(14.dp))
        MicControlBox(
            state = state,
            patientReady = patientReady,
            patientSpeaking = patientSpeaking,
            canSpeak = canSpeak,
            large = true,
            onToggleSpeak = onToggleSpeak,
            onRequestMicPermission = onRequestMicPermission
        )
        Spacer(Modifier.height(14.dp))
        TranscriptBox(sourceLabel, state.sourceDraft.ifBlank { sourcePlaceholder })
        Spacer(Modifier.height(8.dp))
        TranscriptBox(translatedLabel, state.translatedDraft.ifBlank { translatedPlaceholder })
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
            Text("자동재생", color = Ink, fontWeight = FontWeight.Bold)
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
        Text("다시 듣기", fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MicControlBox(
    state: StaffUiState,
    patientReady: Boolean,
    patientSpeaking: Boolean,
    canSpeak: Boolean,
    large: Boolean,
    onToggleSpeak: () -> Unit,
    onRequestMicPermission: () -> Unit
) {
    val buttonSize = if (large) 176.dp else 104.dp
    val iconSize = if (large) 48.dp else 32.dp
    val panelPadding = if (large) 20.dp else 12.dp
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
                    state.speaking -> "말이 끝나면 다시 누르세요."
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
    enabled: Boolean,
    onValueChange: (String) -> Unit,
    onSubmit: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(16.dp))
            .padding(8.dp)
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
private fun ConversationList(messages: List<StaffMessage>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 320.dp)
            .background(Mist, RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (messages.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().height(260.dp), contentAlignment = Alignment.Center) {
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
private fun TranscriptBox(label: String, text: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(8.dp))
            .padding(14.dp)
    ) {
        Text(label, color = Trust, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(4.dp))
        Text(text, color = Ink, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
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
