"use client";

type RealtimeTranslationEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  item_id?: string;
  item?: {
    id?: string;
  };
  response_id?: string;
  response?: {
    id?: string;
    metadata?: Record<string, string> | null;
  };
  error?: {
    message?: string;
    event_id?: string;
  };
};

type SessionTokenResponse = {
  error?: string;
  token?: {
    mode?: "demo";
    value?: string;
    client_secret?:
      | string
      | {
          value?: string;
        };
    realtimeTurnInstructions?: string;
  };
};

type PendingTranslation = {
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  quietTimer: number | null;
  maxTimer: number | null;
  quietMs: number;
};

type StopTurnOptions = {
  quietMs?: number;
  maxMs?: number;
};

type InputTranscriptWaitOptions = {
  fastMs?: number;
  repairMs?: number;
};

const committedInputWaitMs = 750;
const inputCleanupFallbackMs = 2600;
const defaultRealtimeTurnInstructions = "Translate only the current committed audio into the session's configured target language. Output only the faithful translation. Preserve whether it is a question, request, or statement. Never answer the speaker, predict the other participant's reply, or continue the conversation.";

export function matchesRealtimeResponseId(expectedResponseId: string | null, eventResponseId: string) {
  return Boolean(expectedResponseId) && eventResponseId === expectedResponseId;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hideUnsafeReplacementCharacters(text: string) {
  return text.replace(/\uFFFD+/g, (match, offset, fullText) => {
    const before = offset > 0 ? fullText.charAt(offset - 1) : "";
    const after = fullText.charAt(offset + match.length);
    return /\d/.test(before) || /\d/.test(after) ? match : "";
  });
}

function sanitizeRealtimeInputTranscript(text: string) {
  const repaired = text
    .replace(/울\uFFFD+\s*라\s*피\s*프라임/g, "울쎄라피 프라임")
    .replace(/울\uFFFD+\s*라\s*프라임/g, "울쎄라 프라임")
    .replace(/울\uFFFD+\s*라/g, "울쎄라")
    .replace(/리\uFFFD+\s*란\s*힐러/g, "리쥬란 힐러")
    .replace(/리\s*쥬\s*란\s*\uFFFD+\s*러/g, "리쥬란 힐러")
    .replace(/리\s*쥬\s*란\s*러/g, "리쥬란 힐러")
    .replace(/리\uFFFD+\s*란/g, "리쥬란")
    .replace(/\uFFFD+\s*마\s*지\s*(?:F\s*L\s*X|에프\s*엘\s*엑스)/gi, "써마지 FLX")
    .replace(/\uFFFD+\s*마\s*지/gi, "써마지");
  const cleaned = hideUnsafeReplacementCharacters(repaired)
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.includes("\uFFFD") ? "" : cleaned;
}

export class OpenAIRealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pendingTranslation: PendingTranslation | null = null;
  private connectPromise: Promise<void> | null = null;
  private currentOutputText = "";
  private currentInputText = "";
  private inputTranscriptComplete = false;
  private inputTranscriptItemId: string | null = null;
  private firstOutputDeltaSeen = false;
  private turnInstructions = defaultRealtimeTurnInstructions;
  private currentTurnId = "";
  private activeResponseId: string | null = null;
  private committedInputItemId: string | null = null;
  private committedInputResolver: ((itemId: string) => void) | null = null;
  private committedInputRejecter: ((reason?: unknown) => void) | null = null;
  private committedInputTimer: number | null = null;
  private inputCleanupTimer: number | null = null;
  private readonly retiredInputItemIds = new Set<string>();

  constructor(
    private readonly params: {
      roomId: string;
      role: "staff" | "patient";
      roomToken?: string;
      direction?: "staff_to_patient" | "patient_to_staff";
      manualTurn?: boolean;
    },
    private readonly callbacks: {
      onStatus?: (status: string) => void;
      onTranscriptDelta?: (text: string) => void;
      onInputTranscriptDelta?: (text: string) => void;
      onFirstOutputDelta?: () => void;
      onRemoteAudioStream?: (stream: MediaStream) => void;
      onError?: (message: string) => void;
    }
  ) {}

  connect(stream: MediaStream) {
    this.callbacks.onStatus?.("Realtime session preparing");
    this.connectPromise ??= this.createConnection(stream);
    return this.connectPromise;
  }

  startTurn() {
    if (this.activeResponseId) {
      this.sendClientEvent({
        event_id: `response-cancel-${this.currentTurnId}`,
        type: "response.cancel",
        response_id: this.activeResponseId
      });
    }
    this.retireCommittedInputItem();
    this.clearCommittedInputWaiter(new Error("Realtime turn was replaced."));
    this.currentOutputText = "";
    this.currentInputText = "";
    this.inputTranscriptComplete = false;
    this.inputTranscriptItemId = null;
    this.firstOutputDeltaSeen = false;
    this.currentTurnId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.activeResponseId = null;
    this.committedInputItemId = null;
    this.clearPendingTranslation();
    this.callbacks.onTranscriptDelta?.("");
    this.callbacks.onInputTranscriptDelta?.("");
    this.sendClientEvent({ type: "input_audio_buffer.clear" });
    this.callbacks.onStatus?.("Listening");
  }

  getInputTranscript() {
    return sanitizeRealtimeInputTranscript(this.currentInputText);
  }

  isInputTranscriptComplete() {
    return this.inputTranscriptComplete;
  }

  async waitForInputTranscript(options: InputTranscriptWaitOptions = {}) {
    try {
      const startedAt = Date.now();
      const fastMs = options.fastMs ?? 650;
      const repairMs = options.repairMs ?? 2400;
      let deadlineAt = startedAt + fastMs;
      let repairWindowEnabled = false;

      while (Date.now() < deadlineAt) {
        if (this.inputTranscriptComplete) return this.getInputTranscript();
        if (!repairWindowEnabled && this.currentInputText.includes("\uFFFD")) {
          repairWindowEnabled = true;
          deadlineAt = startedAt + repairMs;
        }
        await delay(40);
      }

      return this.getInputTranscript();
    } finally {
      this.retireCommittedInputItem();
    }
  }

  async stopTurnAndTranslate(options: StopTurnOptions = {}) {
    await this.waitUntilOpen();
    const quietMs = options.quietMs ?? 900;
    const maxMs = options.maxMs ?? 6500;
    const turnId = this.currentTurnId;

    this.sendClientEvent(
      { event_id: `input-commit-${turnId}`, type: "input_audio_buffer.commit" },
      { requireOpen: true }
    );
    const committedItemId = await this.waitForCommittedInputItem(committedInputWaitMs);

    const result = new Promise<string>((resolve, reject) => {
      const finish = () => {
        const finalText = this.currentOutputText.trim();
        this.clearPendingTranslation();
        if (this.activeResponseId) {
          this.sendClientEvent({
            event_id: `response-cancel-${this.currentTurnId}`,
            type: "response.cancel",
            response_id: this.activeResponseId
          });
        }
        this.activeResponseId = null;
        this.scheduleCommittedInputCleanup();
        if (finalText) {
          resolve(finalText);
        } else {
          reject(new Error("No translated text was received yet. Please speak a little longer and try again."));
        }
      };

      this.pendingTranslation = {
        resolve,
        reject,
        quietMs,
        quietTimer: null,
        maxTimer: window.setTimeout(finish, maxMs)
      };
    });

    try {
      this.sendClientEvent({
        event_id: `response-create-${turnId}`,
        type: "response.create",
        response: {
          conversation: "none",
          metadata: { client_turn_id: turnId },
          output_modalities: ["text"],
          instructions: this.turnInstructions,
          input: [{ type: "item_reference", id: committedItemId }]
        }
      }, { requireOpen: true });
    } catch (caught) {
      this.pendingTranslation?.reject(caught);
      this.clearPendingTranslation();
      this.retireCommittedInputItem();
      throw caught;
    }

    return result;
  }

  close() {
    this.pendingTranslation?.reject(new Error("Realtime translation session closed."));
    this.clearPendingTranslation();
    this.clearCommittedInputWaiter(new Error("Realtime translation session closed."));
    this.retireCommittedInputItem();
    this.dataChannel?.close();
    this.peerConnection?.getSenders().forEach((sender) => sender.track?.stop());
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.connectPromise = null;
    this.currentOutputText = "";
    this.currentInputText = "";
    this.firstOutputDeltaSeen = false;
    this.currentTurnId = "";
    this.activeResponseId = null;
    this.callbacks.onTranscriptDelta?.("");
    this.callbacks.onInputTranscriptDelta?.("");
    this.callbacks.onStatus?.("Realtime session closed");
  }

  private async createConnection(stream: MediaStream) {
    const sessionToken = await this.fetchSessionToken();
    this.turnInstructions = sessionToken.turnInstructions;
    const peerConnection = new RTCPeerConnection();
    const dataChannel = peerConnection.createDataChannel("oai-events");

    this.peerConnection = peerConnection;
    this.dataChannel = dataChannel;

    dataChannel.addEventListener("message", (event) => this.handleServerEvent(event));
    dataChannel.addEventListener("open", () => {
      this.callbacks.onStatus?.("Realtime ready");
    });
    dataChannel.addEventListener("close", () => {
      const error = new Error("Realtime translation data channel closed.");
      this.pendingTranslation?.reject(error);
      this.clearPendingTranslation();
      this.clearCommittedInputWaiter(error);
      this.activeResponseId = null;
      this.callbacks.onStatus?.("Realtime session closed");
    });

    peerConnection.addEventListener("track", (event) => {
      if (event.track.kind !== "audio") return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.callbacks.onRemoteAudioStream?.(stream);
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) throw new Error("No microphone audio track is available.");
    peerConnection.addTrack(audioTrack, stream);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${sessionToken.value}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Realtime translation connection failed: ${response.status} ${detail}`);
    }

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: await response.text()
    });

    await this.waitUntilOpen();
  }

  private async fetchSessionToken() {
    const response = await fetch("/api/realtime/session-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...this.params,
        manualTurn: this.params.manualTurn ?? true
      })
    });

    const data = (await response.json().catch(() => null)) as SessionTokenResponse | null;
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error ?? "Realtime translation session token could not be created.");
    }
    if (data?.token?.mode === "demo") throw new Error("OPENAI_API_KEY is not configured.");

    const token = data?.token?.value ?? (typeof data?.token?.client_secret === "string" ? data.token.client_secret : data?.token?.client_secret?.value);
    if (!token) throw new Error("Realtime translation token response was missing a client secret.");
    return {
      value: token,
      turnInstructions: data?.token?.realtimeTurnInstructions?.trim() || defaultRealtimeTurnInstructions
    };
  }

  private waitUntilOpen() {
    if (this.dataChannel?.readyState === "open") return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const channel = this.dataChannel;
      if (!channel) {
        reject(new Error("Realtime translation data channel is not initialized."));
        return;
      }

      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Realtime translation data channel did not open in time."));
      }, 10000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        channel.removeEventListener("open", onOpen);
        channel.removeEventListener("close", onClose);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onClose = () => {
        cleanup();
        reject(new Error("Realtime translation data channel closed before opening."));
      };

      channel.addEventListener("open", onOpen);
      channel.addEventListener("close", onClose);
    });
  }

  private handleServerEvent(event: MessageEvent<string>) {
    let serverEvent: RealtimeTranslationEvent;
    try {
      serverEvent = JSON.parse(event.data) as RealtimeTranslationEvent;
    } catch {
      return;
    }

    if (serverEvent.type === "error") {
      const clientEventId = serverEvent.error?.event_id ?? "";
      if (clientEventId && this.currentTurnId && !clientEventId.includes(this.currentTurnId)) return;
      const message = serverEvent.error?.message ?? "Realtime translation API error.";
      this.callbacks.onError?.(message);
      this.pendingTranslation?.reject(new Error(message));
      this.clearPendingTranslation();
      this.activeResponseId = null;
      this.scheduleCommittedInputCleanup();
      return;
    }

    if (serverEvent.type === "input_audio_buffer.committed" && serverEvent.item_id) {
      if (!this.committedInputResolver) {
        this.retireInputItem(serverEvent.item_id);
        return;
      }
      this.committedInputItemId = serverEvent.item_id;
      this.committedInputResolver?.(serverEvent.item_id);
      this.clearCommittedInputWaiter();
      return;
    }

    if (serverEvent.type === "response.created") {
      const responseTurnId = serverEvent.response?.metadata?.client_turn_id ?? "";
      const responseId = serverEvent.response?.id ?? "";
      if (responseTurnId === this.currentTurnId && responseId) {
        this.activeResponseId = responseId;
      }
      return;
    }

    if (
      (
        serverEvent.type === "session.output_transcript.delta" ||
        serverEvent.type === "response.output_audio_transcript.delta" ||
        serverEvent.type === "response.output_text.delta"
      ) &&
      this.shouldAcceptResponseEvent(serverEvent) &&
      typeof serverEvent.delta === "string"
    ) {
      this.currentOutputText += serverEvent.delta;
      if (!this.firstOutputDeltaSeen) {
        this.firstOutputDeltaSeen = true;
        this.callbacks.onFirstOutputDelta?.();
      }
      this.callbacks.onTranscriptDelta?.(this.currentOutputText);
      this.callbacks.onStatus?.("Receiving translation");
      this.resetQuietTimer();
      return;
    }

    if (
      (
        serverEvent.type === "session.output_transcript.done" ||
        serverEvent.type === "response.output_audio_transcript.done"
      ) &&
      this.shouldAcceptResponseEvent(serverEvent) &&
      typeof serverEvent.transcript === "string"
    ) {
      this.currentOutputText = serverEvent.transcript;
      this.callbacks.onTranscriptDelta?.(this.currentOutputText);
      this.resolvePendingTranslation();
      return;
    }

    if (
      serverEvent.type === "response.output_text.done" &&
      this.shouldAcceptResponseEvent(serverEvent) &&
      typeof serverEvent.text === "string"
    ) {
      this.currentOutputText = serverEvent.text;
      this.callbacks.onTranscriptDelta?.(this.currentOutputText);
      this.resolvePendingTranslation();
      return;
    }

    if (serverEvent.type === "response.done" && this.shouldAcceptResponseEvent(serverEvent)) {
      this.resolvePendingTranslation();
      return;
    }

    if (
      (
        serverEvent.type === "session.input_transcript.delta" ||
        serverEvent.type === "conversation.item.input_audio_transcription.delta"
      ) &&
      typeof serverEvent.delta === "string"
    ) {
      if (!this.shouldAcceptInputTranscriptEvent(serverEvent)) return;
      this.currentInputText += serverEvent.delta;
      this.callbacks.onInputTranscriptDelta?.(this.getInputTranscript());
      return;
    }

    if (
      (
        serverEvent.type === "session.input_transcript.done" ||
        serverEvent.type === "conversation.item.input_audio_transcription.completed"
      ) &&
      typeof serverEvent.transcript === "string"
    ) {
      if (!this.shouldAcceptInputTranscriptEvent(serverEvent)) return;
      this.currentInputText = serverEvent.transcript;
      this.inputTranscriptComplete = true;
      this.callbacks.onInputTranscriptDelta?.(this.getInputTranscript());
      if (!this.pendingTranslation) this.retireCommittedInputItem();
    }
  }

  private shouldAcceptResponseEvent(serverEvent: RealtimeTranslationEvent) {
    const responseId = serverEvent.response_id ?? serverEvent.response?.id ?? "";
    return matchesRealtimeResponseId(this.activeResponseId, responseId);
  }

  private shouldAcceptInputTranscriptEvent(serverEvent: RealtimeTranslationEvent) {
    const itemId = serverEvent.item_id ?? serverEvent.item?.id ?? "";
    if (!itemId) return false;
    if (this.retiredInputItemIds.has(itemId)) return false;
    if (!this.inputTranscriptItemId) {
      this.inputTranscriptItemId = itemId;
      return true;
    }
    return this.inputTranscriptItemId === itemId;
  }

  private resetQuietTimer() {
    if (!this.pendingTranslation) return;
    if (!this.firstOutputDeltaSeen) return;

    if (this.pendingTranslation.quietTimer) {
      window.clearTimeout(this.pendingTranslation.quietTimer);
    }

    this.pendingTranslation.quietTimer = window.setTimeout(() => {
      this.resolvePendingTranslation();
    }, this.pendingTranslation.quietMs);
  }

  private resolvePendingTranslation() {
    const pending = this.pendingTranslation;
    if (!pending) return;

    const finalText = this.currentOutputText.trim();
    this.clearPendingTranslation();
    this.activeResponseId = null;
    this.scheduleCommittedInputCleanup();
    if (finalText) {
      this.callbacks.onStatus?.("Translation ready");
      pending.resolve(finalText);
    } else {
      pending.reject(new Error("No translated text was received yet. Please speak a little longer and try again."));
    }
  }

  private waitForCommittedInputItem(timeoutMs: number) {
    if (this.committedInputItemId) return Promise.resolve(this.committedInputItemId);

    return new Promise<string>((resolve, reject) => {
      this.committedInputResolver = resolve;
      this.committedInputRejecter = reject;
      this.committedInputTimer = window.setTimeout(() => {
        const rejecter = this.committedInputRejecter;
        this.clearCommittedInputWaiter();
        rejecter?.(new Error("Realtime input commit was not acknowledged."));
      }, timeoutMs);
    });
  }

  private clearCommittedInputWaiter(reason?: unknown) {
    if (this.committedInputTimer) window.clearTimeout(this.committedInputTimer);
    const rejecter = this.committedInputRejecter;
    this.committedInputResolver = null;
    this.committedInputRejecter = null;
    this.committedInputTimer = null;
    if (reason) rejecter?.(reason);
  }

  private scheduleCommittedInputCleanup() {
    if (this.inputTranscriptComplete) {
      this.retireCommittedInputItem();
      return;
    }
    if (this.inputCleanupTimer) window.clearTimeout(this.inputCleanupTimer);
    this.inputCleanupTimer = window.setTimeout(() => this.retireCommittedInputItem(), inputCleanupFallbackMs);
  }

  private retireCommittedInputItem() {
    if (this.inputCleanupTimer) window.clearTimeout(this.inputCleanupTimer);
    this.inputCleanupTimer = null;
    const itemId = this.committedInputItemId ?? this.inputTranscriptItemId;
    this.committedInputItemId = null;
    if (!itemId) return;

    this.retireInputItem(itemId);
  }

  private retireInputItem(itemId: string) {

    this.retiredInputItemIds.add(itemId);
    while (this.retiredInputItemIds.size > 8) {
      const oldest = this.retiredInputItemIds.values().next().value as string | undefined;
      if (!oldest) break;
      this.retiredInputItemIds.delete(oldest);
    }
    this.sendClientEvent({
      event_id: `conversation-delete-${this.currentTurnId}`,
      type: "conversation.item.delete",
      item_id: itemId
    });
  }

  private clearPendingTranslation() {
    if (this.pendingTranslation?.quietTimer) {
      window.clearTimeout(this.pendingTranslation.quietTimer);
    }
    if (this.pendingTranslation?.maxTimer) {
      window.clearTimeout(this.pendingTranslation.maxTimer);
    }
    this.pendingTranslation = null;
  }

  private sendClientEvent(event: Record<string, unknown>, options: { requireOpen?: boolean } = {}) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      if (options.requireOpen) throw new Error("Realtime translation data channel is not open.");
      return;
    }
    this.dataChannel.send(JSON.stringify(event));
  }
}
