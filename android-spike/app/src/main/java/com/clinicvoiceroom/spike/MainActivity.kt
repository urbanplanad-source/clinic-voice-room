package com.clinicvoiceroom.spike

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.KeyEvent
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.audio.JavaAudioDeviceModule
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private companion object {
        const val DEFAULT_BACKEND_URL = "https://voice.insightmedi.co.kr"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val http = OkHttpClient.Builder()
        .cookieJar(InMemoryCookieJar())
        .build()
    private var mediaSession: MediaSession? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { change ->
        appendLog("audio focus change=$change")
    }
    private var lastMediaKeyCode: Int? = null
    private var lastMediaKeyEventTime: Long = 0L
    private val translationDirection = mutableStateOf("patient_to_staff")
    private val outputRoute = mutableStateOf(StoreTranslationForegroundService.OUTPUT_PHONE)
    private val staffRemoteDeviceId = mutableStateOf<Int?>(null)
    private val patientRemoteDeviceId = mutableStateOf<Int?>(null)
    private val remoteRegistrationTarget = mutableStateOf<String?>(null)
    private val roomMode = mutableStateOf("consultation")
    private val backendUrlState = mutableStateOf(DEFAULT_BACKEND_URL)
    private val roomIdState = mutableStateOf("")
    private val roomTokenState = mutableStateOf("")
    private var joinedRoomId: String? = null
    private var connectedDirection: String? = null
    @Volatile
    private var desiredMicEnabled = false

    private val requestRuntimePermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        appendLog("RECORD_AUDIO permission: ${result[Manifest.permission.RECORD_AUDIO] == true}")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appendLog("POST_NOTIFICATIONS permission: ${result[Manifest.permission.POST_NOTIFICATIONS] == true}")
        }
    }

    private val logs = mutableStateListOf<String>()
    private val transcriptMessages = mutableStateListOf<String>()
    private var currentTranscript = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        StoreTranslationForegroundService.setUiCallbacks(
            ::appendLog,
            ::appendTranscriptDelta,
            ::finishTranscript
        )
        applyLaunchIntent(intent)

        val permissions = buildList {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                add(Manifest.permission.RECORD_AUDIO)
            }
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (permissions.isNotEmpty()) {
            requestRuntimePermissions.launch(permissions.toTypedArray())
        }

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SpikeScreen(
                        logs = logs,
                        transcriptMessages = transcriptMessages,
                        direction = translationDirection.value,
                        outputRoute = outputRoute.value,
                        staffRemoteDeviceId = staffRemoteDeviceId.value,
                        patientRemoteDeviceId = patientRemoteDeviceId.value,
                        remoteRegistrationTarget = remoteRegistrationTarget.value,
                        roomMode = roomMode.value,
                        backendUrl = backendUrlState.value,
                        roomId = roomIdState.value,
                        roomToken = roomTokenState.value,
                        onLog = ::appendLog,
                        onSwitchDirection = ::switchTranslationDirection,
                        onOutputRouteChanged = { nextRoute ->
                            outputRoute.value = nextRoute
                            StoreTranslationForegroundService.setOutputRoute(nextRoute)
                            appendLog("requested output route=$nextRoute")
                        },
                        onModeChanged = { nextMode ->
                            roomMode.value = nextMode
                            appendLog("room mode=$nextMode")
                        },
                        onBackendUrlChanged = { backendUrlState.value = it },
                        onRoomIdChanged = { roomIdState.value = it },
                        onRoomTokenChanged = { input ->
                            if (!applyRoomInput(input)) roomTokenState.value = input
                        },
                        onCreateRoom = { backendUrl, email, password, patientLanguage, mode ->
                            executor.execute {
                                runCatching {
                                    createRoomFromApp(backendUrl, email, password, patientLanguage, mode)
                                }.onFailure {
                                    appendLog("room create error: ${it.message}")
                                }
                            }
                        },
                        onRegisterStaffRemote = {
                            remoteRegistrationTarget.value = "staff"
                            appendLog("register staff remote: press a button")
                        },
                        onRegisterPatientRemote = {
                            remoteRegistrationTarget.value = "patient"
                            appendLog("register patient remote: press a button")
                        },
                        onClearRemoteRegistration = {
                            remoteRegistrationTarget.value = null
                            staffRemoteDeviceId.value = null
                            patientRemoteDeviceId.value = null
                            appendLog("remote registration cleared")
                        },
                        onRequestToken = { backendUrl, roomId, roomToken, role, direction, onToken ->
                            executor.execute {
                                runCatching {
                                    val token = requestToken(backendUrl, roomId, roomToken, role, direction)
                                    appendLog("token fetched, length=${token.length}")
                                    runOnUiThread { onToken(token) }
                                }.onFailure {
                                    appendLog("token error: ${it.message}")
                                }
                            }
                        },
                        onConnect = { token ->
                            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                appendLog("connect blocked: microphone permission is not granted")
                            } else {
                                StoreTranslationForegroundService.start(
                                    this,
                                    token,
                                    roomMode.value != "consultation",
                                    outputRoute.value
                                )
                            }
                        },
                        onDisconnect = {
                            StoreTranslationForegroundService.stop(this)
                            connectedDirection = null
                            appendLog("disconnected")
                        }
                    )
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (handleRemoteKeyEvent(event)) return true
        if (handleMediaKeyEvent(event, "activity")) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (handleRemoteKeyEvent(event)) return true
        if (handleMediaKeyEvent(event, "activity")) return true
        return super.onKeyUp(keyCode, event)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyLaunchIntent(intent)
    }

    override fun onDestroy() {
        StoreTranslationForegroundService.clearUiCallbacks()
        executor.shutdownNow()
        super.onDestroy()
    }

    private data class RoomLaunch(
        val backendUrl: String,
        val roomToken: String,
        val mode: String?
    )

    private fun applyLaunchIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        val launch = parseRoomLaunch(uri) ?: return
        applyRoomLaunch(launch, "deep link")
    }

    private fun applyRoomInput(input: String): Boolean {
        val trimmed = input.trim()
        if (!trimmed.contains("://")) return false
        val uri = runCatching { Uri.parse(trimmed) }.getOrNull() ?: return false
        val launch = parseRoomLaunch(uri) ?: return false
        applyRoomLaunch(launch, "room link")
        return true
    }

    private fun applyRoomLaunch(launch: RoomLaunch, source: String) {
        backendUrlState.value = launch.backendUrl
        roomTokenState.value = launch.roomToken
        roomIdState.value = ""
        joinedRoomId = null
        if (launch.mode == "consultation" || launch.mode == "procedure") {
            roomMode.value = launch.mode
        }
        appendLog("$source applied: mode=${roomMode.value} token=${launch.roomToken.take(8)}...")
    }

    private fun parseRoomLaunch(uri: Uri): RoomLaunch? {
        val scheme = uri.scheme.orEmpty()
        val mode = uri.getQueryParameter("mode")
        val queryBackend = uri.getQueryParameter("backend")?.trim().orEmpty()

        if (scheme == "clinicvoiceroom") {
            val token = uri.getQueryParameter("token") ?: uri.pathSegments.lastOrNull()
            if (token.isNullOrBlank()) return null
            return RoomLaunch(
                backendUrl = queryBackend.ifBlank { DEFAULT_BACKEND_URL },
                roomToken = token,
                mode = mode
            )
        }

        if (scheme == "http" || scheme == "https") {
            val segments = uri.pathSegments
            val token = when {
                segments.size >= 3 && segments[0] == "room" && segments[1] == "join" -> segments[2]
                segments.size >= 2 && segments[0] == "room" -> segments[1]
                else -> uri.getQueryParameter("token")
            }
            if (token.isNullOrBlank()) return null
            val authority = uri.encodedAuthority ?: return null
            return RoomLaunch(
                backendUrl = queryBackend.ifBlank { "$scheme://$authority" },
                roomToken = token,
                mode = mode
            )
        }

        return null
    }

    private fun configureAudio() {
        val audioManager = getSystemService(AudioManager::class.java)
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = false
        runCatching {
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
        }.onFailure {
            appendLog("bluetooth audio route error: ${it.message}")
        }
        requestAudioFocus(audioManager)
        appendLog("audio mode set: MODE_IN_COMMUNICATION, speaker=false, bluetooth sco requested")
    }

    private fun configureMediaSession() {
        val mediaButtonIntent = Intent(Intent.ACTION_MEDIA_BUTTON).setClass(this, EarbudMediaButtonReceiver::class.java)
        val mediaButtonPendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            mediaButtonIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        mediaSession = MediaSession(this, "ClinicVoiceRoomSpikeMediaSession").apply {
            setMediaButtonReceiver(mediaButtonPendingIntent)
            setCallback(object : MediaSession.Callback() {
                override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
                    val event = mediaButtonIntent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)
                    return event?.let { handleMediaKeyEvent(it, "media session") } ?: false
                }

                override fun onPlay() {
                    appendLog("media session onPlay")
                    setActivePlaybackState()
                }

                override fun onPause() {
                    appendLog("media session onPause")
                    switchTranslationDirection()
                    setActivePlaybackState()
                }

                override fun onStop() {
                    appendLog("media session onStop")
                    switchTranslationDirection()
                    setActivePlaybackState()
                }
            })
            isActive = true
        }
        setActivePlaybackState()
        appendLog("media session active for earbud touch test")
    }

    private fun requestAudioFocus(audioManager: AudioManager) {
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setOnAudioFocusChangeListener(audioFocusChangeListener)
            .setAcceptsDelayedFocusGain(true)
            .build()
        audioFocusRequest = request

        val result = audioManager.requestAudioFocus(request)
        appendLog("audio focus request=$result")
    }

    private fun abandonAudioFocus() {
        val request = audioFocusRequest ?: return
        val audioManager = getSystemService(AudioManager::class.java)
        runCatching {
            audioManager.isBluetoothScoOn = false
            audioManager.stopBluetoothSco()
        }
        audioManager.abandonAudioFocusRequest(request)
        audioFocusRequest = null
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

    private fun handleMediaKeyEvent(event: KeyEvent, source: String): Boolean {
        if (!isMediaButton(event.keyCode)) return false

        if (StoreTranslationForegroundService.isRunning()) {
            return StoreTranslationForegroundService.handleExternalMediaButton(event, source)
        }

        appendLog("media button $source: ${describeKeyEvent(event)}")
        if (event.action != KeyEvent.ACTION_UP) return true

        if (lastMediaKeyCode == event.keyCode && event.eventTime - lastMediaKeyEventTime < 250L) {
            appendLog("media button duplicate ignored")
            return true
        }

        lastMediaKeyCode = event.keyCode
        lastMediaKeyEventTime = event.eventTime
        switchTranslationDirection()
        return true
    }

    private fun handleRemoteKeyEvent(event: KeyEvent): Boolean {
        if (!isRemoteControlKey(event.keyCode)) {
            return false
        }
        if (event.deviceId < 0) {
            appendLog("remote key virtual ignored: ${describeKeyEvent(event)}")
            return true
        }

        appendLog("remote key: ${describeKeyEvent(event)}")
        if (event.action != KeyEvent.ACTION_DOWN && event.action != KeyEvent.ACTION_UP) return true
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount > 0) return true

        if (event.action == KeyEvent.ACTION_UP && lastMediaKeyCode == event.keyCode && event.eventTime - lastMediaKeyEventTime < 250L) {
            appendLog("remote key duplicate ignored")
            return true
        }

        handleRegisteredRemoteEvent(event)
        return true
    }

    private fun handleRegisteredRemoteEvent(event: KeyEvent) {
        when (remoteRegistrationTarget.value) {
            "staff" -> {
                if (event.action != KeyEvent.ACTION_UP) return
                staffRemoteDeviceId.value = event.deviceId
                remoteRegistrationTarget.value = null
                appendLog("staff remote registered: deviceId=${event.deviceId}")
                setTranslationDirection("staff_to_patient")
            }
            "patient" -> {
                if (event.action != KeyEvent.ACTION_UP) return
                patientRemoteDeviceId.value = event.deviceId
                remoteRegistrationTarget.value = null
                appendLog("patient remote registered: deviceId=${event.deviceId}")
                setTranslationDirection("patient_to_staff")
            }
            else -> {
                val direction = when (event.deviceId) {
                    staffRemoteDeviceId.value -> "staff_to_patient"
                    patientRemoteDeviceId.value -> "patient_to_staff"
                    else -> {
                        appendLog("unregistered remote pressed: deviceId=${event.deviceId}")
                        null
                    }
                }
                if (direction != null) handleDirectionRemoteEvent(direction, event.action)
            }
        }
    }

    private fun handleDirectionRemoteEvent(direction: String, action: Int) {
        if (roomMode.value == "consultation") {
            if (action == KeyEvent.ACTION_DOWN) {
                setTranslationDirection(direction)
                connectForDirection(direction, micEnabled = true)
            } else if (action == KeyEvent.ACTION_UP) {
                lastMediaKeyCode = 0
                lastMediaKeyEventTime = SystemClock.uptimeMillis()
                desiredMicEnabled = false
                StoreTranslationForegroundService.setMicEnabled(false)
                appendLog("ptt mic off")
            }
            return
        }

        if (action == KeyEvent.ACTION_UP) {
            lastMediaKeyCode = 0
            lastMediaKeyEventTime = SystemClock.uptimeMillis()
            setTranslationDirection(direction)
            connectForDirection(direction, micEnabled = true)
        }
    }

    private fun connectForDirection(direction: String, micEnabled: Boolean) {
        desiredMicEnabled = micEnabled
        val backendUrl = backendUrlState.value
        val roomId = roomIdState.value
        val roomToken = roomTokenState.value
        if (backendUrl.isBlank() || roomToken.isBlank()) {
            appendLog("direction connect skipped: missing backend url or room token")
            return
        }

        executor.execute {
            runCatching {
                if (connectedDirection == direction && StoreTranslationForegroundService.isRunning()) {
                    StoreTranslationForegroundService.setMicEnabled(desiredMicEnabled)
                    appendLog("direction session reused: $direction mic=$desiredMicEnabled")
                    return@execute
                }

                appendLog("direction session connecting: $direction")
                val role = if (direction == "staff_to_patient") "staff" else "patient"
                val token = requestToken(backendUrl, roomId, roomToken, role, direction)
                StoreTranslationForegroundService.start(
                    this,
                    token,
                    desiredMicEnabled,
                    outputRoute.value
                )
                connectedDirection = direction
                appendLog("direction background service requested: $direction mic=$desiredMicEnabled")
            }.onFailure {
                appendLog("direction connect error: ${it.message}")
            }
        }
    }

    private fun isMediaButton(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PLAY ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE ||
            keyCode == KeyEvent.KEYCODE_MEDIA_STOP ||
            keyCode == KeyEvent.KEYCODE_HEADSETHOOK
    }

    private fun isRemoteControlKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
            keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
            keyCode == KeyEvent.KEYCODE_CAMERA ||
            keyCode == KeyEvent.KEYCODE_ENTER ||
            keyCode == KeyEvent.KEYCODE_SPACE ||
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
            keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            isMediaButton(keyCode)
    }

    private fun describeKeyEvent(event: KeyEvent): String {
        val device = event.device
        val deviceName = device?.name ?: "unknown"
        val vendorId = device?.vendorId ?: 0
        val productId = device?.productId ?: 0
        return "${KeyEvent.keyCodeToString(event.keyCode)} action=${event.action} deviceId=${event.deviceId} source=${event.source} vendor=$vendorId product=$productId name=$deviceName"
    }

    private fun switchTranslationDirection() {
        val next = if (translationDirection.value == "patient_to_staff") "staff_to_patient" else "patient_to_staff"
        setTranslationDirection(next)
    }

    private fun setTranslationDirection(next: String) {
        translationDirection.value = next
        appendLog("translation direction=$next")
    }

    private fun createRoomFromApp(
        backendUrl: String,
        email: String,
        password: String,
        patientLanguage: String,
        mode: String
    ) {
        if (backendUrl.isBlank()) error("missing backend url")
        if (email.isBlank() || password.isBlank()) error("missing staff login")

        val loginBody = JSONObject()
            .put("email", email)
            .put("password", password)
            .toString()

        val loginRequest = Request.Builder()
            .url("${backendUrl.trimEnd('/')}/api/auth/login")
            .post(loginBody.toRequestBody("application/json".toMediaType()))
            .build()

        http.newCall(loginRequest).execute().use { response ->
            appendLog("staff login response: ${response.code}")
            if (!response.isSuccessful) error(response.body?.string().orEmpty().ifBlank { "staff login failed" })
        }

        val createBody = JSONObject()
            .put("patientLanguage", patientLanguage)
            .toString()

        val createRequest = Request.Builder()
            .url("${backendUrl.trimEnd('/')}/api/rooms")
            .post(createBody.toRequestBody("application/json".toMediaType()))
            .build()

        http.newCall(createRequest).execute().use { response ->
            val text = response.body?.string().orEmpty()
            appendLog("room create response: ${response.code}")
            if (!response.isSuccessful) error(text.ifBlank { "room create failed" })

            val room = JSONObject(text).getJSONObject("room")
            val newRoomId = room.getString("id")
            val newRoomToken = room.getString("roomToken")
            runOnUiThread {
                backendUrlState.value = backendUrl
                roomIdState.value = newRoomId
                roomTokenState.value = newRoomToken
                roomMode.value = mode
                joinedRoomId = null
            }
            appendLog("room created: mode=$mode language=$patientLanguage id=${newRoomId.take(10)} token=${newRoomToken.take(8)}...")
        }
    }

    private fun requestToken(
        backendUrl: String,
        roomId: String,
        roomToken: String,
        role: String,
        direction: String? = null
    ): String {
        val normalizedRoomToken = extractRoomToken(roomToken)
        val effectiveRoomId = roomId.ifBlank {
            resolveRoomIdByToken(backendUrl, normalizedRoomToken)
        }
        markRoomJoined(backendUrl, effectiveRoomId, normalizedRoomToken)

        val bodyJson = JSONObject()
            .put("roomId", effectiveRoomId)
            .put("role", role)
            .put("roomToken", normalizedRoomToken)
            .put("translationSession", true)
            .also { body ->
                if (direction != null) body.put("direction", direction)
            }
            .toString()

        val request = Request.Builder()
            .url("${backendUrl.trimEnd('/')}/api/realtime/session-token")
            .post(bodyJson.toRequestBody("application/json".toMediaType()))
            .build()

        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            appendLog("token response: ${response.code}")
            if (!response.isSuccessful) error(text.ifBlank { "token request failed" })

            val token = JSONObject(text).getJSONObject("token")
            val clientSecret = token.opt("client_secret")
            return when (clientSecret) {
                is JSONObject -> clientSecret.getString("value")
                is String -> clientSecret
                else -> token.optString("value")
            }.ifBlank { error("missing ephemeral client secret") }
        }
    }

    private fun resolveRoomIdByToken(backendUrl: String, roomToken: String): String {
        if (roomToken.isBlank()) error("missing room token")
        val encodedToken = URLEncoder.encode(roomToken, "UTF-8")
        val request = Request.Builder()
            .url("${backendUrl.trimEnd('/')}/api/rooms/by-token/$encodedToken")
            .get()
            .build()

        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            appendLog("room lookup response: ${response.code}")
            if (!response.isSuccessful) error(text.ifBlank { "room lookup failed" })
            val roomId = JSONObject(text).getJSONObject("room").getString("id")
            runOnUiThread { roomIdState.value = roomId }
            appendLog("room id resolved=$roomId")
            return roomId
        }
    }

    private fun extractRoomToken(input: String): String {
        val trimmed = input.trim()
        if (!trimmed.contains("://")) return trimmed
        val uri = runCatching { Uri.parse(trimmed) }.getOrNull() ?: return trimmed
        return parseRoomLaunch(uri)?.roomToken ?: trimmed
    }

    private fun markRoomJoined(backendUrl: String, roomId: String, roomToken: String) {
        if (joinedRoomId == roomId) return

        runCatching {
            val bodyJson = JSONObject()
                .put("roomToken", roomToken)
                .toString()
            val request = Request.Builder()
                .url("${backendUrl.trimEnd('/')}/api/rooms/$roomId/join-patient")
                .post(bodyJson.toRequestBody("application/json".toMediaType()))
                .build()

            http.newCall(request).execute().use { response ->
                appendLog("room join response: ${response.code}")
                if (response.isSuccessful) joinedRoomId = roomId
            }
        }.onFailure {
            appendLog("room join skipped: ${it.message}")
        }
    }

    private fun appendLog(message: String) {
        val stamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        runOnUiThread {
            logs.add(0, "[$stamp] $message")
            while (logs.size > 300) logs.removeAt(logs.lastIndex)
        }
    }

    private fun appendTranscriptDelta(text: String) {
        runOnUiThread {
            currentTranscript = text
            if (transcriptMessages.firstOrNull()?.startsWith("... ") == true) {
                transcriptMessages[0] = "... $currentTranscript"
            } else {
                transcriptMessages.add(0, "... $currentTranscript")
            }
            while (transcriptMessages.size > 20) transcriptMessages.removeAt(transcriptMessages.lastIndex)
        }
    }

    private fun finishTranscript(text: String) {
        runOnUiThread {
            val finalText = text.trim().ifBlank { currentTranscript.trim() }
            if (finalText.isBlank()) return@runOnUiThread

            if (transcriptMessages.firstOrNull()?.startsWith("... ") == true) {
                transcriptMessages[0] = finalText
            } else {
                transcriptMessages.add(0, finalText)
            }
            currentTranscript = ""
            while (transcriptMessages.size > 20) transcriptMessages.removeAt(transcriptMessages.lastIndex)
        }
    }
}

@Composable
private fun SpikeScreen(
    logs: List<String>,
    transcriptMessages: List<String>,
    direction: String,
    outputRoute: String,
    staffRemoteDeviceId: Int?,
    patientRemoteDeviceId: Int?,
    remoteRegistrationTarget: String?,
    roomMode: String,
    backendUrl: String,
    roomId: String,
    roomToken: String,
    onLog: (String) -> Unit,
    onSwitchDirection: () -> Unit,
    onOutputRouteChanged: (String) -> Unit,
    onModeChanged: (String) -> Unit,
    onBackendUrlChanged: (String) -> Unit,
    onRoomIdChanged: (String) -> Unit,
    onRoomTokenChanged: (String) -> Unit,
    onCreateRoom: (String, String, String, String, String) -> Unit,
    onRegisterStaffRemote: () -> Unit,
    onRegisterPatientRemote: () -> Unit,
    onClearRemoteRegistration: () -> Unit,
    onRequestToken: (String, String, String, String, String?, (String) -> Unit) -> Unit,
    onConnect: (String) -> Unit,
    onDisconnect: () -> Unit
) {
    var role by remember { mutableStateOf("staff") }
    var token by remember(roomToken) { mutableStateOf("") }
    var staffEmail by remember { mutableStateOf("staff@clinic.test") }
    var staffPassword by remember { mutableStateOf("password1234") }
    var patientLanguage by remember { mutableStateOf("zh") }
    val hasRoom = roomToken.isNotBlank()
    val hasRemotes = staffRemoteDeviceId != null && patientRemoteDeviceId != null
    val latestTranscript = transcriptMessages.firstOrNull()
    val createdRoomLabel = if (hasRoom) "${languageLabel(patientLanguage)} ${if (roomMode == "procedure") "시술" else "상담"} 통역방" else "아직 생성된 방이 없습니다"
    val joinUrl = if (hasRoom) "${backendUrl.trimEnd('/')}/room/join/$roomToken?mode=$roomMode" else ""
    val clipboard = LocalClipboardManager.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF6F7FB))
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        if (remoteRegistrationTarget != null) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                AlertPanel("${remoteRegistrationTargetLabel(remoteRegistrationTarget)} 리모컨 버튼을 눌러주세요")
            }
        }

        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (!hasRoom) {
                HeaderCard(
                    eyebrow = "BTSKIN CLINIC",
                    title = "상담실장님",
                    subtitle = null,
                    status = null
                )

                SectionCard(title = "음성 통역 시작") {
                    Text("환자 언어를 선택하고 상담 또는 시술 통역방을 만드세요.", color = Color(0xFF64748B), fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        LanguageButton("中文\n중국어", "zh", patientLanguage, Modifier.weight(1f)) { patientLanguage = it }
                        LanguageButton("日本語\n일본어", "ja", patientLanguage, Modifier.weight(1f)) { patientLanguage = it }
                        LanguageButton("English\n영어", "en", patientLanguage, Modifier.weight(1f)) { patientLanguage = it }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        LanguageButton("Русский\n러시아어", "ru", patientLanguage, Modifier.weight(1f)) { patientLanguage = it }
                        LanguageButton("Tiếng Việt\n베트남어", "vi", patientLanguage, Modifier.weight(1f)) { patientLanguage = it }
                        LanguageButton("Bahasa\n인도네시아어", "id", patientLanguage, Modifier.weight(1f)) { patientLanguage = it }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        ModeButton(
                            label = "상담 통역방",
                            active = roomMode == "consultation",
                            modifier = Modifier.weight(1f),
                            onClick = { onModeChanged("consultation") }
                        )
                        ModeButton(
                            label = "시술 통역방",
                            active = roomMode == "procedure",
                            modifier = Modifier.weight(1f),
                            onClick = { onModeChanged("procedure") }
                        )
                    }
                    Button(
                        onClick = {
                            token = ""
                            role = "staff"
                            onCreateRoom(backendUrl, staffEmail, staffPassword, patientLanguage, roomMode)
                        },
                        modifier = Modifier.fillMaxWidth().height(58.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                    ) {
                        Text(if (roomMode == "procedure") "시술 통역방" else "상담 통역방", fontWeight = FontWeight.Bold)
                    }
                }
            } else if (token.isBlank()) {
                HeaderCard(
                    eyebrow = "BTSKIN CLINIC",
                    title = "${languageLabel(patientLanguage)} 통역 대기실",
                    subtitle = waitingInstruction(patientLanguage),
                    status = null
                )

                QrWaitingCard(
                    joinUrl = joinUrl,
                    patientLanguage = patientLanguage,
                    onCopy = { clipboard.setText(AnnotatedString(joinUrl)) }
                )

                Text(
                    waitingMessage(patientLanguage),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFEFF6FF), RoundedCornerShape(8.dp))
                        .padding(16.dp),
                    color = Color(0xFF2563EB),
                    fontWeight = FontWeight.Bold
                )

                Button(
                    onClick = {
                        onRequestToken(backendUrl, roomId, roomToken, role, direction) { fetched ->
                            token = fetched
                            onConnect(fetched)
                        }
                    },
                    enabled = hasRoom,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB), disabledContainerColor = Color(0xFFCBD5E1))
                ) {
                    Text("통역 시작", fontWeight = FontWeight.Bold)
                }
            } else {
                HeaderCard(
                    eyebrow = "BTSKIN CLINIC",
                    title = "${languageLabel(patientLanguage)} 통역",
                    subtitle = "마이크 버튼을 누르고 말해주세요.",
                    status = "준비됨"
                )

                SectionCard(title = "최근 통역") {
                    Text(
                        latestTranscript ?: "상대방의 통역 결과가 여기에 표시됩니다.",
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                            .padding(16.dp),
                        style = if (latestTranscript == null) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.titleLarge,
                        color = if (latestTranscript == null) Color(0xFF64748B) else Color(0xFF0F172A),
                        fontWeight = FontWeight.Bold
                    )
                    if (transcriptMessages.size > 1) {
                        Spacer(modifier = Modifier.height(6.dp))
                        transcriptMessages.drop(1).take(3).forEach {
                            Text(it, color = Color(0xFF64748B), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }

                MicCard(
                    title = "누르고 말씀하세요",
                    helper = "한 번에 한 사람씩 말합니다"
                )

                SectionCard(title = "음성 출력") {
                    Text(
                        "화면이 꺼져도 선택한 장치로 번역 음성이 재생됩니다.",
                        color = Color(0xFF64748B),
                        fontWeight = FontWeight.SemiBold
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        ModeButton(
                            label = "휴대폰 스피커",
                            active = outputRoute == StoreTranslationForegroundService.OUTPUT_PHONE,
                            modifier = Modifier.weight(1f),
                            onClick = { onOutputRouteChanged(StoreTranslationForegroundService.OUTPUT_PHONE) }
                        )
                        ModeButton(
                            label = "블루투스 스피커",
                            active = outputRoute == StoreTranslationForegroundService.OUTPUT_BLUETOOTH,
                            modifier = Modifier.weight(1f),
                            onClick = { onOutputRouteChanged(StoreTranslationForegroundService.OUTPUT_BLUETOOTH) }
                        )
                    }
                    Text(
                        "블루투스는 통화 오디오를 지원하는 장치가 연결되어 있어야 합니다.",
                        color = Color(0xFF64748B),
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (roomMode == "procedure") {
                    SectionCard(title = "시술 리모컨") {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                            RemoteRegisterButton(
                                label = "Staff",
                                deviceId = staffRemoteDeviceId,
                                modifier = Modifier.weight(1f),
                                onClick = onRegisterStaffRemote
                            )
                            RemoteRegisterButton(
                                label = "Patient",
                                deviceId = patientRemoteDeviceId,
                                modifier = Modifier.weight(1f),
                                onClick = onRegisterPatientRemote
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                            Button(
                                onClick = onSwitchDirection,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                            ) {
                                Text("방향 전환")
                            }
                            Button(
                                onClick = onClearRemoteRegistration,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2E8F0), contentColor = Color(0xFF0F172A))
                            ) {
                                Text("초기화")
                            }
                        }
                    }
                }

                Button(
                    onClick = onDisconnect,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color(0xFFE11D48))
                ) {
                    Text("통역 종료", fontWeight = FontWeight.Bold)
                }
            }

            SectionCard(title = "운영 설정") {
                Text("번역 음성 출력", color = Color(0xFF334155), fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    ModeButton(
                        label = "휴대폰",
                        active = outputRoute == StoreTranslationForegroundService.OUTPUT_PHONE,
                        modifier = Modifier.weight(1f),
                        onClick = { onOutputRouteChanged(StoreTranslationForegroundService.OUTPUT_PHONE) }
                    )
                    ModeButton(
                        label = "블루투스",
                        active = outputRoute == StoreTranslationForegroundService.OUTPUT_BLUETOOTH,
                        modifier = Modifier.weight(1f),
                        onClick = { onOutputRouteChanged(StoreTranslationForegroundService.OUTPUT_BLUETOOTH) }
                    )
                }
                Text(
                    "블루투스 스피커는 통역 시작 전에 선택하세요.",
                    color = Color(0xFF64748B),
                    style = MaterialTheme.typography.bodySmall
                )
                OutlinedTextField(
                    value = staffEmail,
                    onValueChange = { staffEmail = it },
                    label = { Text("직원 이메일") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = staffPassword,
                    onValueChange = { staffPassword = it },
                    label = { Text("비밀번호") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = backendUrl,
                    onValueChange = { onBackendUrlChanged(it) },
                    label = { Text("서버 주소") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = roomToken,
                    onValueChange = {
                        token = ""
                        onRoomTokenChanged(it)
                    },
                    label = { Text("방 링크 또는 토큰") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = roomId,
                    onValueChange = { onRoomIdChanged(it) },
                    label = { Text("Room ID (자동 조회)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    ModeButton(
                        label = "Staff",
                        active = role == "staff",
                        modifier = Modifier.weight(1f),
                        onClick = { role = "staff"; onLog("role=staff") }
                    )
                    ModeButton(
                        label = "Patient",
                        active = role == "patient",
                        modifier = Modifier.weight(1f),
                        onClick = { role = "patient"; onLog("role=patient") }
                    )
                }
                Button(
                    onClick = {
                        token = ""
                        onLog("local token cleared")
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2E8F0), contentColor = Color(0xFF0F172A))
                ) {
                    Text("토큰 지우기")
                }
            }

            SectionCard(title = "시스템 로그") {
                if (logs.isEmpty()) {
                    Text("아직 로그가 없습니다.", color = Color(0xFF94A3B8))
                } else {
                    logs.take(12).forEach {
                        Text(it, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall, color = Color(0xFF334155))
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
            content()
        }
    }
}

@Composable
private fun HeaderCard(eyebrow: String, title: String, subtitle: String?, status: String?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(eyebrow, color = Color(0xFF2F7DF6), fontWeight = FontWeight.Bold)
                Text(title, color = Color(0xFF0F172A), style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
                if (subtitle != null) {
                    Text(subtitle, color = Color(0xFF64748B), style = MaterialTheme.typography.bodyLarge)
                }
            }
            if (status != null) {
                Text(
                    text = "●  $status",
                    modifier = Modifier
                        .background(Color(0xFFEAFBF4), RoundedCornerShape(8.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    color = Color(0xFF047857),
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun QrWaitingCard(joinUrl: String, patientLanguage: String, onCopy: () -> Unit) {
    val qrImage = remember(joinUrl) { createQrBitmap(joinUrl, 640).asImageBitmap() }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Text(
                text = qrHeading(patientLanguage),
                color = Color(0xFF0F172A),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Text(
                text = qrInstruction(patientLanguage),
                color = Color(0xFF64748B),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            Image(
                bitmap = qrImage,
                contentDescription = "Patient join QR code",
                modifier = Modifier
                    .size(240.dp)
                    .background(Color.White, RoundedCornerShape(8.dp))
                    .padding(8.dp)
            )
            Text(
                text = joinUrl,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                    .padding(14.dp),
                color = Color(0xFF334155),
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Button(
                onClick = onCopy,
                modifier = Modifier.height(54.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2F7DF6))
            ) {
                Text("링크 복사", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun MicCard(title: String, helper: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "마이크",
                modifier = Modifier
                    .size(160.dp)
                    .background(Color(0xFF3182F6), RoundedCornerShape(100.dp))
                    .padding(top = 66.dp),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Text(title, color = Color(0xFF0F172A), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(helper, color = Color(0xFF64748B), fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun StatusCard(
    mode: String,
    direction: String,
    hasRoom: Boolean,
    hasToken: Boolean,
    hasRemotes: Boolean,
    staffRemoteDeviceId: Int?,
    patientRemoteDeviceId: Int?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(roomModeLabel(mode), color = Color(0xFFC7D2FE), fontWeight = FontWeight.Bold)
            Text(directionLabel(direction), color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                StatusPill("방", hasRoom, Modifier.weight(1f))
                StatusPill("토큰", hasToken, Modifier.weight(1f))
                StatusPill("리모컨", hasRemotes, Modifier.weight(1f))
            }
            Text(
                "Staff ${staffRemoteDeviceId ?: "-"}  |  Patient ${patientRemoteDeviceId ?: "-"}",
                color = Color(0xFFCBD5E1),
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun StatusPill(label: String, ready: Boolean, modifier: Modifier = Modifier) {
    Text(
        text = if (ready) "$label OK" else "$label -",
        modifier = modifier
            .background(
                color = if (ready) Color(0xFFDCFCE7) else Color(0xFF334155),
                shape = RoundedCornerShape(100.dp)
            )
            .padding(horizontal = 10.dp, vertical = 8.dp),
        color = if (ready) Color(0xFF166534) else Color(0xFFCBD5E1),
        fontWeight = FontWeight.Bold,
        style = MaterialTheme.typography.bodySmall
    )
}

@Composable
private fun ModeButton(label: String, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (active) Color(0xFF2563EB) else Color(0xFFE2E8F0),
            contentColor = if (active) Color.White else Color(0xFF0F172A)
        )
    ) {
        Text(label)
    }
}

@Composable
private fun LanguageButton(label: String, value: String, selected: String, modifier: Modifier = Modifier, onClick: (String) -> Unit) {
    Button(
        onClick = { onClick(value) },
        modifier = modifier.height(92.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected == value) Color(0xFFEFF6FF) else Color.White,
            contentColor = if (selected == value) Color(0xFF1D4ED8) else Color(0xFF0F172A)
        )
    ) {
        Text(label, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
    }
}

@Composable
private fun RemoteRegisterButton(label: String, deviceId: Int?, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (deviceId == null) Color(0xFFEEF2FF) else Color(0xFFDCFCE7),
            contentColor = if (deviceId == null) Color(0xFF3730A3) else Color(0xFF166534)
        )
    ) {
        Text(if (deviceId == null) "$label 등록" else "$label #$deviceId", fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun AlertPanel(text: String) {
    Text(
        text = text,
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFFFF7ED), RoundedCornerShape(14.dp))
            .padding(14.dp),
        color = Color(0xFF9A3412),
        fontWeight = FontWeight.Bold
    )
}

private fun directionLabel(direction: String): String {
    return when (direction) {
        "staff_to_patient" -> "Staff 한국어 -> 환자 언어"
        else -> "환자 언어 -> Staff 한국어"
    }
}

private fun roomModeLabel(mode: String): String {
    return when (mode) {
        "procedure" -> "시술 방향 선택"
        else -> "상담 PTT"
    }
}

private fun createQrBitmap(content: String, size: Int): Bitmap {
    val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    for (x in 0 until size) {
        for (y in 0 until size) {
            bitmap.setPixel(x, y, if (matrix[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
        }
    }
    return bitmap
}

private fun languageLabel(language: String): String {
    return when (language) {
        "zh" -> "중국어"
        "ja" -> "일본어"
        "en" -> "영어"
        "ru" -> "러시아어"
        "vi" -> "베트남어"
        "id" -> "인도네시아어"
        else -> language
    }
}

private fun waitingInstruction(language: String): String {
    return when (language) {
        "zh" -> "请扫描二维码"
        "ja" -> "QRコードをスキャンしてください"
        "en" -> "Scan the QR code"
        "ru" -> "Отсканируйте QR-код"
        "vi" -> "Vui lòng quét mã QR"
        "id" -> "Pindai kode QR"
        else -> "QR 코드를 스캔해주세요"
    }
}

private fun qrHeading(language: String): String {
    return when (language) {
        "zh" -> "请扫描二维码"
        "ja" -> "QRコードをスキャンしてください"
        "en" -> "Scan the QR code"
        "ru" -> "Отсканируйте QR-код"
        "vi" -> "Vui lòng quét mã QR"
        "id" -> "Pindai kode QR"
        else -> "QR 코드를 스캔해주세요"
    }
}

private fun qrInstruction(language: String): String {
    return when (language) {
        "zh" -> "请使用手机相机扫描下方二维码，进入医院翻译室。"
        "ja" -> "スマートフォンのカメラで下のQRコードを読み取り、通訳ルームに入室してください。"
        "en" -> "Use your phone camera to scan the QR code below and enter the interpretation room."
        "ru" -> "Откройте камеру телефона, отсканируйте QR-код и войдите в кабинет перевода."
        "vi" -> "Dùng camera điện thoại quét mã QR bên dưới để vào phòng phiên dịch."
        "id" -> "Gunakan kamera ponsel untuk memindai kode QR di bawah dan masuk ke ruang interpretasi."
        else -> "스마트폰 카메라로 아래 QR 코드를 읽고 통역방에 입장해주세요."
    }
}

private fun waitingMessage(language: String): String {
    return when (language) {
        "zh" -> "正在等待患者进入"
        "ja" -> "患者さんの入室を待っています"
        "en" -> "Waiting for the patient to join"
        "ru" -> "Ожидаем вход пациента"
        "vi" -> "Đang chờ bệnh nhân vào phòng"
        "id" -> "Menunggu pasien masuk"
        else -> "환자 입장을 기다리고 있습니다"
    }
}

private fun remoteRegistrationTargetLabel(target: String): String {
    return when (target) {
        "staff" -> "staff"
        "patient" -> "patient"
        else -> target
    }
}

private class InMemoryCookieJar : CookieJar {
    private val cookies = mutableMapOf<String, MutableList<Cookie>>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        this.cookies[url.host] = cookies.toMutableList()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        return cookies[url.host]?.filter { !it.hasExpired() }.orEmpty()
    }

    private fun Cookie.hasExpired(): Boolean {
        return expiresAt < System.currentTimeMillis()
    }
}

internal class OpenAiTranslationWebRtcClient(
    private val context: Context,
    private val log: (String) -> Unit,
    private val onTranscriptDelta: (String) -> Unit,
    private val onTranscriptDone: (String) -> Unit,
    private val preferredInputDevice: AudioDeviceInfo? = null,
    private val useMediaPlaybackOutput: Boolean = false
) {
    private val http = OkHttpClient()
    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var audioDeviceModule: JavaAudioDeviceModule? = null
    private var dataChannel: DataChannel? = null
    private var currentOutputText = ""

    fun connect(ephemeralToken: String) {
        if (ephemeralToken.isBlank()) error("ephemeral token is blank")

        WebRtcRuntime.initialize(context, log)

        audioDeviceModule = JavaAudioDeviceModule.builder(context)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(
                        if (useMediaPlaybackOutput) AudioAttributes.USAGE_MEDIA
                        else AudioAttributes.USAGE_VOICE_COMMUNICATION
                    )
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule()

        preferredInputDevice?.let { device ->
            audioDeviceModule?.setPreferredInputDevice(device)
            log("preferred input requested device=${device.productName} type=${device.type}")
        }

        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioDeviceModule)
            .createPeerConnectionFactory()
        val pcFactory = factory ?: error("PeerConnectionFactory unavailable")

        audioSource = pcFactory.createAudioSource(MediaConstraints())
        audioTrack = pcFactory.createAudioTrack("local-audio", audioSource)
        val localAudioTrack = audioTrack ?: error("local audio track unavailable")

        val rtcConfig = PeerConnection.RTCConfiguration(emptyList()).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        peerConnection = pcFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState) = log("signaling=$state")
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) = log("ice=$state")
            override fun onIceConnectionReceivingChange(receiving: Boolean) = log("ice receiving=$receiving")
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) = log("ice gathering=$state")
            override fun onIceCandidate(candidate: IceCandidate) = log("ice candidate: ${candidate.sdpMid}")
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = log("ice candidates removed=${candidates.size}")
            override fun onAddStream(stream: MediaStream) = log("add stream: ${stream.id}")
            override fun onRemoveStream(stream: MediaStream) = log("remove stream: ${stream.id}")
            override fun onDataChannel(channel: DataChannel) = log("remote data channel: ${channel.label()}")
            override fun onRenegotiationNeeded() = log("renegotiation needed")
            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {
                val track = receiver.track()
                log("remote track: kind=${track?.kind()} id=${track?.id()} enabled=${track?.enabled()}")
            }
        }) ?: error("PeerConnection unavailable")

        val pc = peerConnection ?: error("PeerConnection missing")
        pc.addTrack(localAudioTrack, listOf("local-stream"))

        dataChannel = pc.createDataChannel("oai-events", DataChannel.Init()).also { channel ->
            channel.registerObserver(object : DataChannel.Observer {
                override fun onBufferedAmountChange(previousAmount: Long) = Unit
                override fun onStateChange() = log("data channel=${channel.state()}")
                override fun onMessage(buffer: DataChannel.Buffer) {
                    val bytes = ByteArray(buffer.data.remaining())
                    buffer.data.get(bytes)
                    val text = String(bytes)
                    handleServerEvent(text)
                }
            })
        }

        val offer = blockingCreateOffer(pc)
        blockingSetLocalDescription(pc, offer)
        log("local offer created, chars=${offer.description.length}")

        val answer = postOffer(ephemeralToken, offer.description)
        blockingSetRemoteDescription(pc, SessionDescription(SessionDescription.Type.ANSWER, answer))
        log("remote answer set, chars=${answer.length}")
    }

    fun setMicEnabled(enabled: Boolean) {
        audioTrack?.setEnabled(enabled)
        log("mic enabled=$enabled")
    }

    fun close() {
        runCatching { dataChannel?.unregisterObserver() }
        runCatching { dataChannel?.close() }
        runCatching { dataChannel?.dispose() }
        runCatching { peerConnection?.close() }
        runCatching { peerConnection?.dispose() }
        runCatching { audioTrack?.setEnabled(false) }
        runCatching { audioTrack?.dispose() }
        runCatching { audioSource?.dispose() }
        runCatching { factory?.dispose() }
        runCatching { audioDeviceModule?.release() }
        dataChannel = null
        peerConnection = null
        audioTrack = null
        audioSource = null
        factory = null
        audioDeviceModule = null
    }

    private fun postOffer(ephemeralToken: String, sdp: String): String {
        val request = Request.Builder()
            .url("https://api.openai.com/v1/realtime/translations/calls")
            .header("Authorization", "Bearer $ephemeralToken")
            .post(sdp.toRequestBody("application/sdp".toMediaType()))
            .build()

        log("posting offer to OpenAI calls endpoint")
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            log("calls response: ${response.code}")
            if (!response.isSuccessful) error(text.ifBlank { "calls request failed" })
            return text
        }
    }

    private fun blockingCreateOffer(pc: PeerConnection): SessionDescription {
        var result: SessionDescription? = null
        var failure: String? = null
        val lock = Object()

        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription) {
                synchronized(lock) {
                    result = description
                    lock.notify()
                }
            }
            override fun onSetSuccess() = Unit
            override fun onCreateFailure(error: String) {
                synchronized(lock) {
                    failure = error
                    lock.notify()
                }
            }
            override fun onSetFailure(error: String) = Unit
        }, MediaConstraints())

        synchronized(lock) {
            if (result == null && failure == null) lock.wait(10000)
        }
        failure?.let { error(it) }
        return result ?: error("createOffer timed out")
    }

    private fun blockingSetLocalDescription(pc: PeerConnection, sdp: SessionDescription) {
        blockingSetDescription("setLocalDescription") { observer ->
            pc.setLocalDescription(observer, sdp)
        }
    }

    private fun blockingSetRemoteDescription(pc: PeerConnection, sdp: SessionDescription) {
        blockingSetDescription("setRemoteDescription") { observer ->
            pc.setRemoteDescription(observer, sdp)
        }
    }

    private fun blockingSetDescription(name: String, block: (SdpObserver) -> Unit) {
        var done = false
        var failure: String? = null
        val lock = Object()

        block(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription) = Unit
            override fun onSetSuccess() {
                synchronized(lock) {
                    done = true
                    lock.notify()
                }
            }
            override fun onCreateFailure(error: String) = Unit
            override fun onSetFailure(error: String) {
                synchronized(lock) {
                    failure = error
                    lock.notify()
                }
            }
        })

        synchronized(lock) {
            if (!done && failure == null) lock.wait(10000)
        }
        failure?.let { error("$name failed: $it") }
        if (!done) error("$name timed out")
    }

    private fun handleServerEvent(json: String) {
        runCatching {
            val event = JSONObject(json)
            val type = event.optString("type", json.take(160))
            log("event: $type")

            when (type) {
                "session.output_transcript.delta" -> {
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) {
                        currentOutputText += delta
                        onTranscriptDelta(currentOutputText)
                    }
                }
                "session.output_transcript.done" -> {
                    val transcript = event.optString("transcript", currentOutputText)
                    currentOutputText = transcript
                    onTranscriptDone(transcript)
                    currentOutputText = ""
                }
                "error" -> {
                    val message = event.optJSONObject("error")?.optString("message").orEmpty()
                    if (message.isNotBlank()) log("realtime error: $message")
                }
            }
        }.onFailure {
            log("event: ${json.take(160)}")
        }
    }
}

private object WebRtcRuntime {
    private var initialized = false

    @Synchronized
    fun initialize(context: Context, log: (String) -> Unit) {
        if (initialized) return

        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context.applicationContext)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )
        initialized = true
        log("WebRTC runtime initialized")
    }
}
