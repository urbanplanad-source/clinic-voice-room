"use client";

import type { PatientLanguage, TranslationLanguage } from "./languages";

export type StoreTranslationDirection = "staff_to_customer" | "customer_to_staff";

type TranslationClientSecret = {
  value: string;
  realtimeModel: string;
  targetLanguage: TranslationLanguage;
  targetLanguageCode: string;
};

type TranslationSessionsResponse = {
  error?: string;
  sessions?: {
    staffToCustomer?: TranslationClientSecret;
    customerToStaff?: TranslationClientSecret;
  };
};

type TranslationServerEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  error?: {
    message?: string;
  };
};

type TranslationCallbacks = {
  onStatus?: (direction: StoreTranslationDirection, status: string) => void;
  onInputTranscriptDelta?: (direction: StoreTranslationDirection, transcript: string) => void;
  onOutputTranscriptDelta?: (direction: StoreTranslationDirection, transcript: string) => void;
  onRemoteAudioStream?: (direction: StoreTranslationDirection, stream: MediaStream) => void;
  onError?: (direction: StoreTranslationDirection, message: string) => void;
};

class OpenAIRealtimeTranslationPeer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private inputText = "";
  private outputText = "";

  constructor(
    private readonly direction: StoreTranslationDirection,
    private readonly stream: MediaStream,
    private readonly clientSecret: TranslationClientSecret,
    private readonly callbacks: TranslationCallbacks
  ) {}

  async connect() {
    const inputTrack = this.stream.getAudioTracks()[0];
    if (!inputTrack) throw new Error(`No microphone track is available for ${this.direction}.`);
    inputTrack.enabled = false;

    const peerConnection = new RTCPeerConnection();
    const dataChannel = peerConnection.createDataChannel("oai-events");
    this.peerConnection = peerConnection;
    this.dataChannel = dataChannel;

    dataChannel.addEventListener("message", (event) => this.handleServerEvent(event));
    dataChannel.addEventListener("open", () => this.callbacks.onStatus?.(this.direction, "ready"));
    dataChannel.addEventListener("close", () => this.callbacks.onStatus?.(this.direction, "closed"));

    peerConnection.addEventListener("track", (event) => {
      if (event.track.kind !== "audio") return;
      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      this.callbacks.onRemoteAudioStream?.(this.direction, remoteStream);
    });

    peerConnection.addTrack(inputTrack, this.stream);
    this.callbacks.onStatus?.(this.direction, "connecting");

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    if (!offer.sdp) throw new Error("Realtime translation offer did not contain SDP.");

    const response = await fetch("https://api.openai.com/v1/realtime/translations/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.clientSecret.value}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp
    });

    if (!response.ok) {
      throw new Error(`Realtime translation connection failed: ${response.status} ${await response.text()}`);
    }

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: await response.text()
    });
    await this.waitUntilOpen();
  }

  setInputEnabled(enabled: boolean) {
    const inputTrack = this.stream.getAudioTracks()[0];
    if (inputTrack) inputTrack.enabled = enabled;
    this.callbacks.onStatus?.(this.direction, enabled ? "listening" : "ready");
  }

  close() {
    this.setInputEnabled(false);
    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(JSON.stringify({ type: "session.close" }));
    }
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.callbacks.onStatus?.(this.direction, "closed");
  }

  private handleServerEvent(event: MessageEvent<string>) {
    let serverEvent: TranslationServerEvent;
    try {
      serverEvent = JSON.parse(event.data) as TranslationServerEvent;
    } catch {
      return;
    }

    if (serverEvent.type === "error") {
      this.callbacks.onError?.(
        this.direction,
        serverEvent.error?.message ?? "Realtime translation API error."
      );
      return;
    }

    if (serverEvent.type === "session.input_transcript.delta" && typeof serverEvent.delta === "string") {
      this.inputText += serverEvent.delta;
      this.callbacks.onInputTranscriptDelta?.(this.direction, this.inputText);
      return;
    }

    if (serverEvent.type === "session.input_transcript.done" && typeof serverEvent.transcript === "string") {
      this.inputText = serverEvent.transcript;
      this.callbacks.onInputTranscriptDelta?.(this.direction, this.inputText);
      return;
    }

    if (serverEvent.type === "session.output_transcript.delta" && typeof serverEvent.delta === "string") {
      this.outputText += serverEvent.delta;
      this.callbacks.onOutputTranscriptDelta?.(this.direction, this.outputText);
      return;
    }

    if (serverEvent.type === "session.output_transcript.done" && typeof serverEvent.transcript === "string") {
      this.outputText = serverEvent.transcript;
      this.callbacks.onOutputTranscriptDelta?.(this.direction, this.outputText);
      return;
    }

    if (serverEvent.type === "session.closed") {
      this.callbacks.onStatus?.(this.direction, "closed");
    }
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
      }, 10_000);
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
}

export class StoreRealtimeTranslationPair {
  private staffToCustomer: OpenAIRealtimeTranslationPeer | null = null;
  private customerToStaff: OpenAIRealtimeTranslationPeer | null = null;

  constructor(private readonly callbacks: TranslationCallbacks = {}) {}

  async connect(params: {
    patientLanguage: PatientLanguage;
    staffStream: MediaStream;
    customerStream: MediaStream;
  }) {
    this.close();
    const response = await fetch("/api/store/realtime/translation-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientLanguage: params.patientLanguage })
    });
    const data = (await response.json().catch(() => null)) as TranslationSessionsResponse | null;
    if (!response.ok) {
      throw new Error(data?.error ?? "Realtime translation sessions could not be created.");
    }

    const staffToken = data?.sessions?.staffToCustomer;
    const customerToken = data?.sessions?.customerToStaff;
    if (!staffToken?.value || !customerToken?.value) {
      throw new Error("Realtime translation session response was incomplete.");
    }

    const staffPeer = new OpenAIRealtimeTranslationPeer(
      "staff_to_customer",
      params.staffStream,
      staffToken,
      this.callbacks
    );
    const customerPeer = new OpenAIRealtimeTranslationPeer(
      "customer_to_staff",
      params.customerStream,
      customerToken,
      this.callbacks
    );
    this.staffToCustomer = staffPeer;
    this.customerToStaff = customerPeer;

    try {
      await Promise.all([staffPeer.connect(), customerPeer.connect()]);
    } catch (caught) {
      this.close();
      throw caught;
    }
  }

  setActiveDirection(direction: StoreTranslationDirection | null) {
    this.staffToCustomer?.setInputEnabled(direction === "staff_to_customer");
    this.customerToStaff?.setInputEnabled(direction === "customer_to_staff");
  }

  close() {
    this.staffToCustomer?.close();
    this.customerToStaff?.close();
    this.staffToCustomer = null;
    this.customerToStaff = null;
  }
}
