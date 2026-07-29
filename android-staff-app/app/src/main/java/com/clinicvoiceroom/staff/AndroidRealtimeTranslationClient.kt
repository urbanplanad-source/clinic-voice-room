package com.clinicvoiceroom.staff

import android.os.SystemClock
import android.util.Base64
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

internal data class AndroidRealtimeTranslationToken(
    val value: String,
    val model: String,
    val mode: String,
    val expiresAtEpochSeconds: Long? = null
)

internal fun AndroidRealtimeTranslationToken.isReusable(
    nowEpochSeconds: Long,
    minimumValiditySeconds: Long = 15L
): Boolean {
    val expiresAt = expiresAtEpochSeconds ?: return false
    return expiresAt > nowEpochSeconds + minimumValiditySeconds
}

internal data class AndroidRealtimeTranslationTurnResult(
    val sourceText: String,
    val translatedText: String,
    val sourceTranscriptComplete: Boolean,
    val outputTranscriptComplete: Boolean,
    val settled: Boolean,
    val firstOutputMs: Long?,
    val completedMs: Long,
    val finalizationMs: Long,
    val completionReason: String
)

internal data class RealtimeTranslationCompletion(
    val sourceTranscriptComplete: Boolean,
    val outputTranscriptComplete: Boolean,
    val settled: Boolean
)

internal fun realtimeTranslationCompletion(
    sessionClosed: Boolean,
    sourceText: String,
    translatedText: String
): RealtimeTranslationCompletion {
    val sourceComplete = sessionClosed && sourceText.isNotBlank()
    val outputComplete = sessionClosed && translatedText.isNotBlank()
    return RealtimeTranslationCompletion(
        sourceTranscriptComplete = sourceComplete,
        outputTranscriptComplete = outputComplete,
        settled = sourceComplete && outputComplete
    )
}

internal class AndroidRealtimeTranslationClient(
    private val http: OkHttpClient,
    private val token: AndroidRealtimeTranslationToken,
    private val log: (String) -> Unit
) {
    private var webSocket: WebSocket? = null
    private var openLatch = CountDownLatch(1)
    @Volatile
    private var terminalLatch = CountDownLatch(1)
    private val errorRef = AtomicReference<Throwable?>(null)
    private val textLock = Any()
    private val inputText = StringBuilder()
    private val outputText = StringBuilder()

    @Volatile
    private var open = false

    @Volatile
    private var acceptingTurn = false

    @Volatile
    private var sessionCloseSent = false

    @Volatile
    private var sessionClosed = false

    @Volatile
    private var turnStartedAt = 0L

    @Volatile
    private var firstOutputAt = 0L

    fun mode(): String = token.mode

    fun connect() {
        if (isReady()) return
        if (sessionCloseSent) error("Realtime Translate client cannot reconnect after session.close")

        openLatch = CountDownLatch(1)
        errorRef.set(null)
        val encodedModel = URLEncoder.encode(token.model.ifBlank { "gpt-realtime-translate" }, "UTF-8")
        val request = Request.Builder()
            .url("wss://api.openai.com/v1/realtime/translations?model=$encodedModel")
            .header("Authorization", "Bearer ${token.value}")
            .build()

        webSocket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                open = true
                log("Realtime Translate connected: ${token.model} (${token.mode})")
                openLatch.countDown()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleServerEvent(text)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                open = false
                acceptingTurn = false
                terminalLatch.countDown()
                log("Realtime Translate closed: $code $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                open = false
                acceptingTurn = false
                errorRef.set(t)
                openLatch.countDown()
                terminalLatch.countDown()
                log("Realtime Translate failure: ${t.message}")
            }
        })

        if (!openLatch.await(10, TimeUnit.SECONDS)) {
            close()
            error("Realtime Translate connection timed out")
        }
        errorRef.get()?.let { throw it }
        if (!open) error("Realtime Translate connection did not open")
    }

    fun isReady(): Boolean = open && !sessionCloseSent

    fun startTurn() {
        if (!isReady()) error("Realtime Translate connection is not ready")
        synchronized(textLock) {
            inputText.clear()
            outputText.clear()
        }
        terminalLatch = CountDownLatch(1)
        sessionClosed = false
        firstOutputAt = 0L
        turnStartedAt = SystemClock.elapsedRealtime()
        errorRef.set(null)
        acceptingTurn = true
    }

    fun appendPcm(bytes: ByteArray, length: Int) {
        if (!open || !acceptingTurn || length <= 0) return
        val audio = Base64.encodeToString(bytes, 0, length, Base64.NO_WRAP)
        send(
            JSONObject()
                .put("type", "session.input_audio_buffer.append")
                .put("audio", audio)
        )
    }

    fun finishTurn(maxWaitMs: Long): AndroidRealtimeTranslationTurnResult {
        if (!isReady() || !acceptingTurn) error("Realtime Translate turn is not active")

        val waitStartedAt = SystemClock.elapsedRealtime()
        sessionCloseSent = true
        if (!send(JSONObject().put("type", "session.close"))) {
            acceptingTurn = false
            open = false
            error("Realtime Translate session.close could not be sent")
        }

        val terminalReached = terminalLatch.await(maxWaitMs, TimeUnit.MILLISECONDS)
        val terminalError = errorRef.get()
        if (terminalError != null && !sessionClosed) throw terminalError

        acceptingTurn = false
        val completedAt = SystemClock.elapsedRealtime()
        val source = synchronized(textLock) { inputText.toString().trim() }
        val translated = synchronized(textLock) { outputText.toString().trim() }
        val completion = realtimeTranslationCompletion(sessionClosed, source, translated)
        val firstOutputMs = firstOutputAt.takeIf { it > 0L }?.let { it - turnStartedAt }
        val completionReason = when {
            sessionClosed -> "session_closed"
            terminalReached -> "socket_closed"
            else -> "timeout"
        }

        if (!terminalReached) {
            runCatching { webSocket?.cancel() }
            webSocket = null
            open = false
        }

        log(
            "Realtime Translate turn ${completedAt - waitStartedAt}ms " +
                "settled=${completion.settled} completion=$completionReason"
        )

        return AndroidRealtimeTranslationTurnResult(
            sourceText = source,
            translatedText = translated,
            sourceTranscriptComplete = completion.sourceTranscriptComplete,
            outputTranscriptComplete = completion.outputTranscriptComplete,
            settled = completion.settled,
            firstOutputMs = firstOutputMs,
            completedMs = completedAt - turnStartedAt,
            finalizationMs = completedAt - waitStartedAt,
            completionReason = completionReason
        )
    }

    fun close() {
        acceptingTurn = false
        val socket = webSocket
        if (open && !sessionCloseSent) {
            sessionCloseSent = true
            runCatching { socket?.send(JSONObject().put("type", "session.close").toString()) }
        }
        val closing = runCatching { socket?.close(1000, "client closed") }.getOrDefault(false)
        if (closing != true) runCatching { socket?.cancel() }
        webSocket = null
        open = false
        terminalLatch.countDown()
    }

    private fun send(event: JSONObject): Boolean {
        val sent = webSocket?.send(event.toString()) ?: false
        if (!sent) log("Realtime Translate send skipped: ${event.optString("type")}")
        return sent
    }

    private fun handleServerEvent(text: String) {
        runCatching {
            val event = JSONObject(text)
            when (val type = event.optString("type")) {
                "session.input_transcript.delta" -> {
                    if (!acceptingTurn) return@runCatching
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) synchronized(textLock) { inputText.append(delta) }
                }

                "session.input_transcript.done" -> {
                    if (!acceptingTurn) return@runCatching
                    val transcript = event.optString("transcript")
                    if (transcript.isNotBlank()) synchronized(textLock) {
                        inputText.clear()
                        inputText.append(transcript)
                    }
                }

                "session.output_transcript.delta" -> {
                    if (!acceptingTurn) return@runCatching
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) {
                        val now = SystemClock.elapsedRealtime()
                        synchronized(textLock) { outputText.append(delta) }
                        if (firstOutputAt == 0L) firstOutputAt = now
                    }
                }

                "session.output_transcript.done" -> {
                    if (!acceptingTurn) return@runCatching
                    val transcript = event.optString("transcript")
                    if (transcript.isNotBlank()) synchronized(textLock) {
                        outputText.clear()
                        outputText.append(transcript)
                    }
                    val now = SystemClock.elapsedRealtime()
                    if (firstOutputAt == 0L) firstOutputAt = now
                }

                "error" -> {
                    val message = event.optJSONObject("error")?.optString("message")
                        ?: "Realtime Translate API error"
                    errorRef.set(IllegalStateException(message))
                    terminalLatch.countDown()
                    log("Realtime Translate API error: $message")
                }

                "session.closed" -> {
                    sessionClosed = true
                    open = false
                    acceptingTurn = false
                    terminalLatch.countDown()
                }

                else -> Unit
            }
        }.onFailure {
            log("Realtime Translate event parse skipped: ${text.take(120)}")
        }
    }
}
