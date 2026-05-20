"use client";

type RealtimeTranslationEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  error?: {
    message?: string;
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

export class OpenAIRealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pendingTranslation: PendingTranslation | null = null;
  private connectPromise: Promise<void> | null = null;
  private currentOutputText = "";
  private currentInputText = "";
  private firstOutputDeltaSeen = false;

  constructor(
    private readonly params: {
      roomId: string;
      role: "staff" | "patient";
      roomToken?: string;
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
    this.currentOutputText = "";
    this.currentInputText = "";
    this.firstOutputDeltaSeen = false;
    this.clearPendingTranslation();
    this.callbacks.onTranscriptDelta?.("");
    this.callbacks.onInputTranscriptDelta?.("");
    this.callbacks.onStatus?.("Listening");
  }

  getInputTranscript() {
    return this.currentInputText.trim();
  }

  async stopTurnAndTranslate(options: StopTurnOptions = {}) {
    await this.waitUntilOpen();
    const quietMs = options.quietMs ?? 900;
    const maxMs = options.maxMs ?? 6500;

    return new Promise<string>((resolve, reject) => {
      const finish = () => {
        const finalText = this.currentOutputText.trim();
        this.clearPendingTranslation();
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
        quietTimer: window.setTimeout(finish, quietMs),
        maxTimer: window.setTimeout(finish, maxMs)
      };
    });
  }

  close() {
    this.pendingTranslation?.reject(new Error("Realtime translation session closed."));
    this.clearPendingTranslation();
    this.dataChannel?.close();
    this.peerConnection?.getSenders().forEach((sender) => sender.track?.stop());
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.connectPromise = null;
    this.currentOutputText = "";
    this.currentInputText = "";
    this.firstOutputDeltaSeen = false;
    this.callbacks.onTranscriptDelta?.("");
    this.callbacks.onInputTranscriptDelta?.("");
    this.callbacks.onStatus?.("Realtime session closed");
  }

  private async createConnection(stream: MediaStream) {
    const token = await this.fetchSessionToken();
    const peerConnection = new RTCPeerConnection();
    const dataChannel = peerConnection.createDataChannel("oai-events");

    this.peerConnection = peerConnection;
    this.dataChannel = dataChannel;

    dataChannel.addEventListener("message", (event) => this.handleServerEvent(event));
    dataChannel.addEventListener("open", () => {
      this.callbacks.onStatus?.("Realtime ready");
    });
    dataChannel.addEventListener("close", () => {
      this.pendingTranslation?.reject(new Error("Realtime translation data channel closed."));
      this.clearPendingTranslation();
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

    const response = await fetch("https://api.openai.com/v1/realtime/translations/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${token}`,
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
      body: JSON.stringify(this.params)
    });

    const data = (await response.json().catch(() => null)) as SessionTokenResponse | null;
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error ?? "Realtime translation session token could not be created.");
    }
    if (data?.token?.mode === "demo") throw new Error("OPENAI_API_KEY is not configured.");

    const token = data?.token?.value ?? (typeof data?.token?.client_secret === "string" ? data.token.client_secret : data?.token?.client_secret?.value);
    if (!token) throw new Error("Realtime translation token response was missing a client secret.");
    return token;
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
      const message = serverEvent.error?.message ?? "Realtime translation API error.";
      this.callbacks.onError?.(message);
      this.pendingTranslation?.reject(new Error(message));
      this.clearPendingTranslation();
      return;
    }

    if (serverEvent.type === "session.output_transcript.delta" && typeof serverEvent.delta === "string") {
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

    if (serverEvent.type === "session.output_transcript.done" && typeof serverEvent.transcript === "string") {
      this.currentOutputText = serverEvent.transcript;
      this.callbacks.onTranscriptDelta?.(this.currentOutputText);
      this.resolvePendingTranslation();
      return;
    }

    if (serverEvent.type === "session.input_transcript.delta" && typeof serverEvent.delta === "string") {
      this.currentInputText += serverEvent.delta;
      this.callbacks.onInputTranscriptDelta?.(this.currentInputText);
      return;
    }

    if (serverEvent.type === "session.input_transcript.done" && typeof serverEvent.transcript === "string") {
      this.currentInputText = serverEvent.transcript;
      this.callbacks.onInputTranscriptDelta?.(this.currentInputText);
    }
  }

  private resetQuietTimer() {
    if (!this.pendingTranslation) return;

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
    if (finalText) {
      this.callbacks.onStatus?.("Translation ready");
      pending.resolve(finalText);
    } else {
      pending.reject(new Error("No translated text was received yet. Please speak a little longer and try again."));
    }
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
}
