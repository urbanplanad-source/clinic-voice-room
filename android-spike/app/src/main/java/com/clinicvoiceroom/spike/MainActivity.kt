package com.clinicvoiceroom.spike

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private val executor = Executors.newSingleThreadExecutor()
    private var webRtcClient: OpenAiTranslationWebRtcClient? = null
    private var mediaSession: MediaSession? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { change ->
        appendLog("audio focus change=$change")
    }
    private var lastMediaKeyCode: Int? = null
    private var lastMediaKeyEventTime: Long = 0L
    private val translationDirection = mutableStateOf("patient_to_staff")
    private val staffRemoteDeviceId = mutableStateOf<Int?>(null)
    private val patientRemoteDeviceId = mutableStateOf<Int?>(null)
    private val remoteRegistrationTarget = mutableStateOf<String?>(null)
    private val roomMode = mutableStateOf("consultation")
    private var backendUrlValue = "https://losing-designers-advisory-intent.trycloudflare.com"
    private var roomIdValue = ""
    private var roomTokenValue = ""
    private var connectedDirection: String? = null
    @Volatile
    private var desiredMicEnabled = false

    private val requestAudioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        appendLog("RECORD_AUDIO permission: $granted")
    }

    private val logs = mutableStateListOf<String>()
    private val transcriptMessages = mutableStateListOf<String>()
    private var currentTranscript = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        MediaButtonEventRouter.setHandler(::handleMediaKeyEvent)
        configureAudio()
        configureMediaSession()

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
        }

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SpikeScreen(
                        logs = logs,
                        transcriptMessages = transcriptMessages,
                        direction = translationDirection.value,
                        staffRemoteDeviceId = staffRemoteDeviceId.value,
                        patientRemoteDeviceId = patientRemoteDeviceId.value,
                        remoteRegistrationTarget = remoteRegistrationTarget.value,
                        roomMode = roomMode.value,
                        onLog = ::appendLog,
                        onSwitchDirection = ::switchTranslationDirection,
                        onModeChanged = { nextMode ->
                            roomMode.value = nextMode
                            appendLog("room mode=$nextMode")
                        },
                        onBackendUrlChanged = { backendUrlValue = it },
                        onRoomIdChanged = { roomIdValue = it },
                        onRoomTokenChanged = { roomTokenValue = it },
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
                            executor.execute {
                                runCatching {
                                    webRtcClient?.close()
                                    webRtcClient = OpenAiTranslationWebRtcClient(applicationContext, ::appendLog, ::appendTranscriptDelta, ::finishTranscript)
                                    webRtcClient?.connect(token)
                                    webRtcClient?.setMicEnabled(roomMode.value != "consultation")
                                }.onFailure {
                                    appendLog("connect error: ${it.message}")
                                }
                            }
                        },
                        onDisconnect = {
                            executor.execute {
                                webRtcClient?.close()
                                webRtcClient = null
                                connectedDirection = null
                                appendLog("disconnected")
                            }
                        }
                    )
                }
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (handleRemoteKeyEvent(event)) return true
        if (handleMediaKeyEvent(event, "activity")) return true
        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        webRtcClient?.close()
        MediaButtonEventRouter.setHandler(null)
        abandonAudioFocus()
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        executor.shutdownNow()
        super.onDestroy()
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
                lastMediaKeyEventTime = System.currentTimeMillis()
                desiredMicEnabled = false
                webRtcClient?.setMicEnabled(false)
                appendLog("ptt mic off")
            }
            return
        }

        if (action == KeyEvent.ACTION_UP) {
            lastMediaKeyCode = 0
            lastMediaKeyEventTime = System.currentTimeMillis()
            setTranslationDirection(direction)
            connectForDirection(direction, micEnabled = true)
        }
    }

    private fun connectForDirection(direction: String, micEnabled: Boolean) {
        desiredMicEnabled = micEnabled
        if (backendUrlValue.isBlank() || roomIdValue.isBlank() || roomTokenValue.isBlank()) {
            appendLog("direction connect skipped: missing backend url, room id, or room token")
            return
        }

        executor.execute {
            runCatching {
                if (connectedDirection == direction && webRtcClient != null) {
                    webRtcClient?.setMicEnabled(desiredMicEnabled)
                    appendLog("direction session reused: $direction mic=$desiredMicEnabled")
                    return@execute
                }

                appendLog("direction session connecting: $direction")
                val role = if (direction == "staff_to_patient") "staff" else "patient"
                val token = requestToken(backendUrlValue, roomIdValue, roomTokenValue, role, direction)
                webRtcClient?.close()
                webRtcClient = OpenAiTranslationWebRtcClient(applicationContext, ::appendLog, ::appendTranscriptDelta, ::finishTranscript)
                webRtcClient?.connect(token)
                connectedDirection = direction
                webRtcClient?.setMicEnabled(desiredMicEnabled)
                appendLog("direction session connected: $direction mic=$desiredMicEnabled")
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

    private fun requestToken(
        backendUrl: String,
        roomId: String,
        roomToken: String,
        role: String,
        direction: String? = null
    ): String {
        val bodyJson = JSONObject()
            .put("roomId", roomId)
            .put("role", role)
            .put("roomToken", roomToken)
            .also { body ->
                if (direction != null) body.put("direction", direction)
            }
            .toString()

        val request = Request.Builder()
            .url("${backendUrl.trimEnd('/')}/api/realtime/session-token")
            .post(bodyJson.toRequestBody("application/json".toMediaType()))
            .build()

        OkHttpClient().newCall(request).execute().use { response ->
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

    private fun appendLog(message: String) {
        val stamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        runOnUiThread {
            logs.add(0, "[$stamp] $message")
            while (logs.size > 300) logs.removeLast()
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
            while (transcriptMessages.size > 20) transcriptMessages.removeLast()
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
            while (transcriptMessages.size > 20) transcriptMessages.removeLast()
        }
    }
}

@Composable
private fun SpikeScreen(
    logs: List<String>,
    transcriptMessages: List<String>,
    direction: String,
    staffRemoteDeviceId: Int?,
    patientRemoteDeviceId: Int?,
    remoteRegistrationTarget: String?,
    roomMode: String,
    onLog: (String) -> Unit,
    onSwitchDirection: () -> Unit,
    onModeChanged: (String) -> Unit,
    onBackendUrlChanged: (String) -> Unit,
    onRoomIdChanged: (String) -> Unit,
    onRoomTokenChanged: (String) -> Unit,
    onRegisterStaffRemote: () -> Unit,
    onRegisterPatientRemote: () -> Unit,
    onClearRemoteRegistration: () -> Unit,
    onRequestToken: (String, String, String, String, String?, (String) -> Unit) -> Unit,
    onConnect: (String) -> Unit,
    onDisconnect: () -> Unit
) {
    var backendUrl by remember { mutableStateOf("https://losing-designers-advisory-intent.trycloudflare.com") }
    var roomId by remember { mutableStateOf("") }
    var roomToken by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("patient") }
    var token by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Clinic Voice Room Android Spike", style = MaterialTheme.typography.titleLarge)
        Text("Start with role=patient. Staff currently needs web cookie auth.")
        Text("Remote test: register two Bluetooth controls, then press each to set direction.")
        Text("Mode: ${roomModeLabel(roomMode)}", style = MaterialTheme.typography.titleMedium)
        Text("Direction: ${directionLabel(direction)}", style = MaterialTheme.typography.titleMedium)
        Text("Staff remote: ${staffRemoteDeviceId?.toString() ?: "not registered"}")
        Text("Patient remote: ${patientRemoteDeviceId?.toString() ?: "not registered"}")
        if (remoteRegistrationTarget != null) {
            Text("Waiting for ${remoteRegistrationTargetLabel(remoteRegistrationTarget)} remote button...")
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { onModeChanged("consultation") }) {
                Text("Consultation PTT")
            }
            Button(onClick = { onModeChanged("procedure") }) {
                Text("Procedure")
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onRegisterStaffRemote) {
                Text("Register Staff")
            }
            Button(onClick = onRegisterPatientRemote) {
                Text("Register Patient")
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onSwitchDirection) {
                Text("Switch Direction")
            }
            Button(onClick = onClearRemoteRegistration) {
                Text("Clear Remotes")
            }
        }

        OutlinedTextField(
            value = backendUrl,
            onValueChange = {
                backendUrl = it
                onBackendUrlChanged(it)
            },
            label = { Text("Backend URL") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = roomId,
            onValueChange = {
                roomId = it
                onRoomIdChanged(it)
            },
            label = { Text("Room ID") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = roomToken,
            onValueChange = {
                roomToken = it
                onRoomTokenChanged(it)
            },
            label = { Text("Room Token") },
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { role = "patient"; onLog("role=patient") }) {
                Text("Patient")
            }
            Button(onClick = { role = "staff"; onLog("role=staff") }) {
                Text("Staff")
            }
            Text("Role: $role", modifier = Modifier.padding(12.dp))
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                onRequestToken(backendUrl, roomId, roomToken, role, direction) { fetched ->
                    token = fetched
                }
            }) {
                Text("Request Token")
            }
            Button(onClick = { onConnect(token) }, enabled = token.isNotBlank()) {
                Text("Connect")
            }
            Button(onClick = onDisconnect) {
                Text("Disconnect")
            }
        }

        Button(onClick = {
            token = ""
            onLog("local token cleared")
        }) {
            Text("Clear Token")
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text("Recent Translation Text", style = MaterialTheme.typography.titleMedium)
        if (transcriptMessages.isEmpty()) {
            Text("Translated text will appear here during consultation mode.")
        } else {
            transcriptMessages.forEach {
                Text(it, style = MaterialTheme.typography.bodyLarge)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text("Logs", style = MaterialTheme.typography.titleMedium)
        logs.forEach {
            Text(it, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun directionLabel(direction: String): String {
    return when (direction) {
        "staff_to_patient" -> "Staff Korean -> Patient language"
        else -> "Patient language -> Staff Korean"
    }
}

private fun roomModeLabel(mode: String): String {
    return when (mode) {
        "procedure" -> "Procedure direction select"
        else -> "Consultation PTT"
    }
}

private fun remoteRegistrationTargetLabel(target: String): String {
    return when (target) {
        "staff" -> "staff"
        "patient" -> "patient"
        else -> target
    }
}

private class OpenAiTranslationWebRtcClient(
    private val context: Context,
    private val log: (String) -> Unit,
    private val onTranscriptDelta: (String) -> Unit,
    private val onTranscriptDone: (String) -> Unit
) {
    private val http = OkHttpClient()
    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var audioDeviceModule: AudioDeviceModule? = null
    private var dataChannel: DataChannel? = null
    private var currentOutputText = ""

    fun connect(ephemeralToken: String) {
        if (ephemeralToken.isBlank()) error("ephemeral token is blank")

        WebRtcRuntime.initialize(context, log)

        audioDeviceModule = JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule()

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
