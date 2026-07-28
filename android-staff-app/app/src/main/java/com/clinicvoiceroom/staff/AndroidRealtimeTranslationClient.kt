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
    val mode: String
)

internal data class AndroidRealtimeTranslationTurnResult(
    val sourceText: String,
    val translatedText: String,
    val sourceTranscriptComplete: Boolean,
    val outputTranscriptComplete: Boolean,
    val settled: Boolean,
    val firstOutputMs: Long?,
    val completedMs: Long
)

internal class AndroidRealtimeTranslationClient(
    private val http: OkHttpClient,
    private val token: AndroidRealtimeTranslationToken,
    private val log: (String) -> Unit
) {
    private var webSocket: WebSocket? = null
    private var openLatch = CountDownLatch(1)
    private val errorRef = AtomicReference<Throwable?>(null)
    private val textLock = Any()
    private val inputText = StringBuilder()
    private val outputText = StringBuilder()

    @Volatile
    private var open = false

    @Volatile
    private var acceptingTurn = false

    @Volatile
    private var inputDone = false

    @Volatile
    private var outputDone = false

    @Volatile
    private var turnStartedAt = 0L

    @Volatile
    private var firstOutputAt = 0L

    @Volatile
    private var lastOutputAt = 0L

    fun mode(): String = token.mode

    fun connect() {
        if (open) return

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
                log("Realtime Translate closed: $code $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                open = false
                errorRef.set(t)
                openLatch.countDown()
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

    fun isReady(): Boolean = open

    fun startTurn() {
        if (!open) error("Realtime Translate connection is not open")
        synchronized(textLock) {
            inputText.clear()
            outputText.clear()
        }
        inputDone = false
        outputDone = false
        firstOutputAt = 0L
        lastOutputAt = 0L
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

    fun finishTurn(maxWaitMs: Long, quietMs: Long): AndroidRealtimeTranslationTurnResult {
        if (!open || !acceptingTurn) error("Realtime Translate turn is not active")

        appendPcm(ByteArray(RealtimeTranslationFlushSilenceBytes), RealtimeTranslationFlushSilenceBytes)
        val waitStartedAt = SystemClock.elapsedRealtime()
        val deadlineAt = waitStartedAt + maxWaitMs
        var settled = false

        while (SystemClock.elapsedRealtime() < deadlineAt) {
            errorRef.get()?.let { throw it }
            val now = SystemClock.elapsedRealtime()
            val hasOutput = synchronized(textLock) { outputText.isNotBlank() }
            val outputQuiet = hasOutput && lastOutputAt > 0L && now - lastOutputAt >= quietMs
            if (hasOutput && inputDone && (outputDone || outputQuiet)) {
                settled = true
                break
            }
            Thread.sleep(20)
        }

        acceptingTurn = false
        val completedAt = SystemClock.elapsedRealtime()
        val source = synchronized(textLock) { inputText.toString().trim() }
        val translated = synchronized(textLock) { outputText.toString().trim() }
        val firstOutputMs = firstOutputAt.takeIf { it > 0L }?.let { it - turnStartedAt }
        log(
            "Realtime Translate turn ${completedAt - waitStartedAt}ms " +
                "settled=$settled inputDone=$inputDone outputDone=$outputDone"
        )

        return AndroidRealtimeTranslationTurnResult(
            sourceText = source,
            translatedText = translated,
            sourceTranscriptComplete = inputDone,
            outputTranscriptComplete = outputDone,
            settled = settled,
            firstOutputMs = firstOutputMs,
            completedMs = completedAt - turnStartedAt
        )
    }

    fun close() {
        acceptingTurn = false
        runCatching {
            if (open) send(JSONObject().put("type", "session.close"))
        }
        runCatching { webSocket?.cancel() }
        webSocket = null
        open = false
    }

    private fun send(event: JSONObject) {
        val sent = webSocket?.send(event.toString()) ?: false
        if (!sent) log("Realtime Translate send skipped: ${event.optString("type")}")
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
                    inputDone = true
                }

                "session.output_transcript.delta" -> {
                    if (!acceptingTurn) return@runCatching
                    val delta = event.optString("delta")
                    if (delta.isNotBlank()) {
                        val now = SystemClock.elapsedRealtime()
                        synchronized(textLock) { outputText.append(delta) }
                        if (firstOutputAt == 0L) firstOutputAt = now
                        lastOutputAt = now
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
                    lastOutputAt = now
                    outputDone = true
                }

                "error" -> {
                    val message = event.optJSONObject("error")?.optString("message")
                        ?: "Realtime Translate API error"
                    errorRef.set(IllegalStateException(message))
                    log("Realtime Translate API error: $message")
                }

                else -> if (type == "session.closed") {
                    open = false
                }
            }
        }.onFailure {
            log("Realtime Translate event parse skipped: ${text.take(120)}")
        }
    }

    private companion object {
        const val RealtimeTranslationFlushSilenceBytes = 14_400
    }
}
