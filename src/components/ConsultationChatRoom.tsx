"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, PhoneOff, Send, Volume2 } from "lucide-react";
import { languageLabels, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { isMicEnabled, type RoomStatus } from "@/lib/room-state";
import { OpenAIRealtimeClient } from "@/lib/openai-realtime-client";
import { normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { speechLanguageByPatientLanguage } from "@/lib/speech";
import {
  broadcastRoomUpdate,
  broadcastTranslationMessage,
  prepareTranslationBroadcastChannel,
  subscribeToRoomUpdates,
  subscribeToTranslationMessages,
  type RealtimeTranslationMessage
} from "@/lib/supabase-realtime";
import {
  consultationDeliveryStatusCopy,
  consultationTextCopy
} from "@/lib/consultation-templates";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const CONSULTATION_TRANSLATION_QUIET_MS = 500;
const CONSULTATION_TRANSLATION_MAX_MS = 5500;

const voiceCopy: Record<PatientLanguage, { ready: string; speaking: string; waiting: string; helper: string; micError: string; busy: string; fallback: string }> = {
  zh: { ready: "按住说话", speaking: "再次点击结束", waiting: "请稍候", helper: "建议先用语音咨询。输入框可作为备用。", micError: "无法使用麦克风。请允许浏览器使用麦克风。", busy: "对方正在讲话。请稍后再试。", fallback: "语音不顺利时可输入文字。" },
  zh_tw: { ready: "點擊說話", speaking: "再次點擊結束", waiting: "請稍候", helper: "建議先用語音諮詢。輸入框可作為備用。", micError: "無法使用麥克風。請允許瀏覽器使用麥克風。", busy: "對方正在說話。請稍後再試。", fallback: "語音不順利時可輸入文字。" },
  ja: { ready: "タップして話す", speaking: "もう一度タップして終了", waiting: "少々お待ちください", helper: "まず音声で相談できます。入力欄は予備として使えます。", micError: "マイクを使用できません。ブラウザでマイクを許可してください。", busy: "相手が話しています。少し待ってからお試しください。", fallback: "音声がうまくいかない時は文字で入力できます。" },
  en: { ready: "Tap and speak", speaking: "Tap again to finish", waiting: "Please wait", helper: "Voice is the main way to consult. Typing is available as a backup.", micError: "Microphone is unavailable. Please allow microphone access in your browser.", busy: "The other person is speaking. Please try again shortly.", fallback: "If voice does not work well, type here." },
  th: { ready: "แตะแล้วพูด", speaking: "แตะอีกครั้งเพื่อจบ", waiting: "กรุณารอสักครู่", helper: "แนะนำให้ปรึกษาด้วยเสียงก่อน ช่องพิมพ์ใช้เป็นทางเลือกสำรอง", micError: "ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์", busy: "อีกฝ่ายกำลังพูด กรุณาลองใหม่อีกครั้ง", fallback: "หากเสียงไม่ชัด สามารถพิมพ์ข้อความได้" },
  ms: { ready: "Ketik dan bercakap", speaking: "Ketik lagi untuk tamat", waiting: "Sila tunggu", helper: "Gunakan suara dahulu untuk konsultasi. Ruang teks tersedia sebagai sandaran.", micError: "Mikrofon tidak tersedia. Sila benarkan akses mikrofon dalam pelayar.", busy: "Orang lain sedang bercakap. Cuba lagi sebentar lagi.", fallback: "Jika suara tidak lancar, taip di sini." },
  mn: { ready: "Дарж ярих", speaking: "Дахин дарж дуусгах", waiting: "Түр хүлээнэ үү", helper: "Эхлээд дуугаар зөвлөгөө авахыг зөвлөж байна. Бичих талбар нөөцөөр байна.", micError: "Микрофон ашиглах боломжгүй. Хөтөч дээр микрофон зөвшөөрнө үү.", busy: "Нөгөө хүн ярьж байна. Түр хүлээгээд дахин оролдоно уу.", fallback: "Дуу сайн ажиллахгүй бол энд бичнэ үү." },
  ru: { ready: "Нажмите и говорите", speaking: "Нажмите еще раз, чтобы закончить", waiting: "Пожалуйста, подождите", helper: "Лучше начать консультацию голосом. Текстовое поле доступно как запасной вариант.", micError: "Микрофон недоступен. Разрешите доступ к микрофону в браузере.", busy: "Сейчас говорит другой человек. Повторите чуть позже.", fallback: "Если голос работает плохо, введите текст здесь." },
  vi: { ready: "Nhấn và nói", speaking: "Nhấn lại để kết thúc", waiting: "Vui lòng chờ", helper: "Nên tư vấn bằng giọng nói trước. Ô nhập chữ dùng khi cần.", micError: "Không thể sử dụng micro. Vui lòng cho phép micro trong trình duyệt.", busy: "Người kia đang nói. Vui lòng thử lại sau.", fallback: "Nếu giọng nói không ổn, hãy nhập chữ tại đây." },
  id: { ready: "Ketuk dan bicara", speaking: "Ketuk lagi untuk selesai", waiting: "Mohon tunggu", helper: "Gunakan suara sebagai cara utama konsultasi. Kolom teks tersedia sebagai cadangan.", micError: "Mikrofon tidak tersedia. Izinkan akses mikrofon di browser.", busy: "Orang lain sedang berbicara. Coba lagi sebentar lagi.", fallback: "Jika suara kurang lancar, ketik di sini." },
  fr: { ready: "Touchez et parlez", speaking: "Touchez à nouveau pour terminer", waiting: "Veuillez patienter", helper: "La consultation se fait d'abord par voix. Le texte reste disponible en secours.", micError: "Le microphone n'est pas disponible. Autorisez l'accès au microphone dans le navigateur.", busy: "L'autre personne parle. Veuillez réessayer dans un instant.", fallback: "Si la voix fonctionne mal, écrivez ici." },
  es: { ready: "Toque y hable", speaking: "Toque de nuevo para terminar", waiting: "Espere un momento", helper: "Use la voz como forma principal de consulta. El texto queda como respaldo.", micError: "El micrófono no está disponible. Permita el acceso al micrófono en el navegador.", busy: "La otra persona está hablando. Inténtelo de nuevo en un momento.", fallback: "Si la voz no funciona bien, escriba aquí." },
  de: { ready: "Tippen und sprechen", speaking: "Zum Beenden erneut tippen", waiting: "Bitte warten", helper: "Die Beratung läuft zuerst per Sprache. Das Textfeld bleibt als Reserve verfügbar.", micError: "Das Mikrofon ist nicht verfügbar. Bitte erlauben Sie den Mikrofonzugriff im Browser.", busy: "Die andere Person spricht. Bitte versuchen Sie es gleich erneut.", fallback: "Wenn Sprache nicht gut funktioniert, schreiben Sie hier." },
  it: { ready: "Tocca e parla", speaking: "Tocca di nuovo per finire", waiting: "Attendi", helper: "La consulenza parte dalla voce. Il testo resta come opzione di riserva.", micError: "Il microfono non è disponibile. Consenti l'accesso al microfono nel browser.", busy: "L'altra persona sta parlando. Riprova tra poco.", fallback: "Se la voce non funziona bene, scrivi qui." },
  pt: { ready: "Toque e fale", speaking: "Toque novamente para terminar", waiting: "Aguarde", helper: "A consulta deve começar por voz. O texto fica como opção de apoio.", micError: "O microfone não está disponível. Permita o acesso ao microfone no navegador.", busy: "A outra pessoa está falando. Tente novamente em instantes.", fallback: "Se a voz não funcionar bem, digite aqui." }
};

const replayCopy: Record<PatientLanguage, string> = {
  zh: "重新播放",
  zh_tw: "重新播放",
  ja: "もう一度聞く",
  en: "Replay",
  th: "ฟังอีกครั้ง",
  ms: "Dengar semula",
  mn: "Дахин сонсох",
  ru: "Повторить",
  vi: "Nghe lại",
  id: "Dengar lagi",
  fr: "Réécouter",
  es: "Escuchar de nuevo",
  de: "Erneut anhören",
  it: "Riascolta",
  pt: "Ouvir novamente"
};

type RoomSnapshot = {
  id: string;
  status: RoomStatus;
  patientLanguage: PatientLanguage;
  hospital?: { name: string };
};

type TranslationMessage = {
  id: string;
  speaker: ParticipantRole;
  sourceText?: string;
  text: string;
  targetLanguage?: PatientLanguage | "ko";
  createdAt?: string;
  readAt?: string | null;
  deliveryStatus?: "sending" | "failed";
};

type RecordingMode = "upload" | "safety";

export function ConsultationChatRoom({
  initialRoom,
  role,
  roomToken
}: {
  initialRoom: RoomSnapshot;
  role: ParticipantRole;
  roomToken?: string;
}) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speakingStartedAt, setSpeakingStartedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const isComposingTextRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const lastFetchedMessageAtRef = useRef<string | null>(null);
  const messageFetchInitializedRef = useRef(false);
  const messagePollInFlightRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingModeRef = useRef<RecordingMode | null>(null);
  const realtimeClientRef = useRef<OpenAIRealtimeClient | null>(null);
  const realtimePreconnectStartedRef = useRef(false);
  const speechQueueRef = useRef(Promise.resolve());
  const spokenMessageIdsRef = useRef(new Set<string>());

  const copy = consultationTextCopy[room.patientLanguage];
  const voiceText = role === "staff"
    ? { ready: "누르고 말하세요", speaking: "다시 누르면 종료", waiting: "잠시 기다려주세요", helper: "음성을 먼저 사용하고, 인식이 어려울 때만 텍스트로 입력하세요.", micError: "마이크를 사용할 수 없습니다.", busy: "상대방이 말하는 중입니다. 잠시 후 다시 눌러주세요.", fallback: "음성 인식이 원활하지 않을 때 텍스트로 입력하세요." }
    : voiceCopy[room.patientLanguage];
  const deliveryStatusCopy = role === "staff" ? { sending: "전송 중", failed: "전송 실패", read: "읽음" } : consultationDeliveryStatusCopy[room.patientLanguage];
  const chatMessages = [...messages].reverse();
  const canSubmitText = Boolean(textInput.trim()) && !textSubmitting && room.status !== "ended";
  const isSpeaking = speakingStartedAt !== null;
  const micEnabled = isMicEnabled(room.status, role);
  const browserAudioOutputEnabled = role === "staff";
  const lastIncomingMessage = messages.find((message) => message.speaker !== role && message.deliveryStatus !== "failed");
  const replayLabel = role === "staff" ? "다시 듣기" : replayCopy[room.patientLanguage];

  const title = useMemo(() => {
    const language = languageLabels[room.patientLanguage];
    return role === "staff" ? `${language.ko} 번역상담` : `${language.native} Consultation`;
  }, [role, room.patientLanguage]);

  const visibleMessageText = useCallback((message: TranslationMessage) => {
    return message.speaker === role ? (message.sourceText ?? message.text) : message.text;
  }, [role]);

  const transition = useCallback(async (status: RoomStatus) => {
    const response = await fetch(`/api/rooms/${room.id}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, status, roomToken })
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setRoom((current) => ({ ...current, ...data.room }));
      void broadcastRoomUpdate(data.room);
      return true;
    }
    if (data?.room) {
      setRoom((current) => ({ ...current, ...data.room }));
      void broadcastRoomUpdate(data.room);
    }
    return false;
  }, [role, room.id, roomToken]);

  const mergeMessages = useCallback((incomingMessages: TranslationMessage[]) => {
    setMessages((current) => {
      const merged = new Map<string, TranslationMessage>();
      for (const message of current) merged.set(message.id, message);
      for (const message of incomingMessages) {
        const existing = merged.get(message.id);
        merged.set(message.id, existing ? { ...existing, ...message, deliveryStatus: existing.deliveryStatus } : message);
      }
      return [...merged.values()]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 80);
    });
  }, []);

  const appendMessage = useCallback((message: TranslationMessage) => {
    mergeMessages([message]);
  }, [mergeMessages]);

  const updateMessageDeliveryStatus = useCallback((messageId: string, deliveryStatus?: TranslationMessage["deliveryStatus"]) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        if (!deliveryStatus) return { ...message, deliveryStatus: undefined };
        return { ...message, deliveryStatus };
      })
    );
  }, []);

  const confirmLocalMessage = useCallback((localMessageId: string, serverMessage: TranslationMessage) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== localMessageId) return message;
        return { ...message, ...serverMessage, deliveryStatus: undefined };
      })
    );
  }, []);

  const stopPlayback = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (role === "staff") return;
    stopPlayback();
    speechQueueRef.current = Promise.resolve();

    return () => {
      stopPlayback();
    };
  }, [role, stopPlayback]);

  const targetLanguageForMessage = useCallback((message: TranslationMessage) => {
    return message.targetLanguage ?? (message.speaker === "staff" ? room.patientLanguage : "ko");
  }, [room.patientLanguage]);

  const findBrowserVoice = useCallback((lang: string) => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const normalizedLang = lang.toLowerCase();
    const baseLang = normalizedLang.split("-")[0];
    return (
      voices.find((voice) => voice.lang.toLowerCase() === normalizedLang) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(`${baseLang}-`)) ??
      null
    );
  }, []);

  const playBrowserTranslatedSpeech = useCallback((text: string, targetLanguage: PatientLanguage | "ko") => {
    if (!browserAudioOutputEnabled) return;
    if (!("speechSynthesis" in window)) return;

    const lang = speechLanguageByPatientLanguage[targetLanguage];
    const voice = findBrowserVoice(lang);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    if (voice) utterance.voice = voice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [browserAudioOutputEnabled, findBrowserVoice]);

  const playQueuedTranslatedSpeech = useCallback((message: TranslationMessage) => {
    if (!browserAudioOutputEnabled) return;
    if (message.speaker === role) return;
    if (spokenMessageIdsRef.current.has(message.id)) return;
    spokenMessageIdsRef.current.add(message.id);
    const targetLanguage = targetLanguageForMessage(message);
    speechQueueRef.current = speechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        playBrowserTranslatedSpeech(message.text, targetLanguage);
      });
  }, [browserAudioOutputEnabled, playBrowserTranslatedSpeech, role, targetLanguageForMessage]);

  const markIncomingMessagesRead = useCallback((incomingMessages: TranslationMessage[]) => {
    if (!incomingMessages.some((message) => message.speaker !== role)) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (role === "patient" && roomToken) headers["x-room-token"] = roomToken;

    void fetch(`/api/rooms/${room.id}/messages/read`, {
      method: "POST",
      cache: "no-store",
      headers,
      body: "{}"
    }).catch(() => undefined);
  }, [role, room.id, roomToken]);

  const replayLastIncomingMessage = useCallback(() => {
    if (!browserAudioOutputEnabled) return;
    if (!lastIncomingMessage) return;
    stopPlayback();
    playBrowserTranslatedSpeech(lastIncomingMessage.text, targetLanguageForMessage(lastIncomingMessage));
  }, [browserAudioOutputEnabled, lastIncomingMessage, playBrowserTranslatedSpeech, stopPlayback, targetLanguageForMessage]);

  const ensureRealtimeSession = useCallback(async (stream: MediaStream) => {
    if (!realtimeClientRef.current) {
      realtimeClientRef.current = new OpenAIRealtimeClient({
        roomId: room.id,
        role,
        roomToken,
        direction: role === "staff" ? "staff_to_patient" : "patient_to_staff",
        manualTurn: true
      }, {
        onFirstOutputDelta: () => {
          void transition(role === "staff" ? "patient_listening" : "staff_listening");
        },
        onError: setError
      });
    }

    try {
      await realtimeClientRef.current.connect(stream);
      return realtimeClientRef.current;
    } catch (caught) {
      realtimeClientRef.current.close();
      realtimeClientRef.current = null;
      realtimePreconnectStartedRef.current = false;
      throw caught;
    }
  }, [role, room.id, roomToken, transition]);

  const endRoom = useCallback(async () => {
    if (room.status === "ended") return true;
    setEnding(true);
    const response = await fetch(`/api/rooms/${room.id}/end`, { method: "POST" });
    setEnding(false);
    if (!response.ok) return false;

    const data = await response.json();
    setRoom((current) => ({ ...current, ...data.room }));
    void broadcastRoomUpdate(data.room);
    return true;
  }, [room.id, room.status]);

  const endRoomAndReturn = useCallback(async () => {
    const ended = await endRoom();
    if (!ended) return;
    router.replace("/staff");
    router.refresh();
  }, [endRoom, router]);

  const markActivity = useCallback(() => {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    if (room.status === "ended") return;

    inactivityTimerRef.current = window.setTimeout(() => {
      if (role === "staff") {
        void endRoom();
      } else {
        setRoom((current) => ({ ...current, status: "ended" }));
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, [endRoom, role, room.status]);

  async function ensureMicStream() {
    const currentStream = streamRef.current;
    if (currentStream?.active && currentStream.getAudioTracks().some((track) => track.readyState === "live")) {
      return currentStream;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(role === "staff" ? "마이크는 HTTPS 브라우저 환경에서만 사용할 수 있습니다." : voiceText.micError);
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    streamRef.current = stream;
    return stream;
  }

  function setMicEnabled(enabled: boolean) {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function preferredRecordingMimeType() {
    if (!("MediaRecorder" in window)) return "";
    if (MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")) return "audio/mp4;codecs=mp4a.40.2";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    return "";
  }

  function audioFileExtension(mimeType: string) {
    if (mimeType.includes("mp4") || mimeType.includes("aac")) return "mp4";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
    return "webm";
  }

  function createAudioRecorder(stream: MediaStream) {
    if (!("MediaRecorder" in window)) {
      throw new Error("This browser does not support audio recording.");
    }

    const mimeType = preferredRecordingMimeType();
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  }

  function beginUploadRecording(stream: MediaStream, mode: RecordingMode) {
    const recorder = createAudioRecorder(stream);
    mediaChunksRef.current = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (mediaRecorderRef.current === recorder && event.data.size > 0) mediaChunksRef.current.push(event.data);
    });
    recorder.start();
    mediaRecorderRef.current = recorder;
    recordingModeRef.current = mode;
    setMicEnabled(true);
    setSpeakingStartedAt(Date.now());
  }

  function beginRealtimeSafetyRecording(stream: MediaStream) {
    try {
      beginUploadRecording(stream, "safety");
    } catch {
      recordingModeRef.current = null;
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
    }
  }

  function stopPatientRecorder() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      const mimeType = mediaChunksRef.current.find((chunk) => chunk.type)?.type || "audio/webm";
      return Promise.resolve(new Blob(mediaChunksRef.current, { type: mimeType }));
    }

    return new Promise<Blob>((resolve, reject) => {
      const mimeType = recorder.mimeType || "audio/webm";
      recorder.addEventListener(
        "stop",
        () => {
          resolve(new Blob(mediaChunksRef.current, { type: mimeType }));
        },
        { once: true }
      );
      recorder.addEventListener(
        "error",
        () => {
          reject(new Error("Audio recording failed."));
        },
        { once: true }
      );
      recorder.stop();
    });
  }

  async function stopAndClearRecorder() {
    const audio = await stopPatientRecorder();
    mediaRecorderRef.current = null;
    recordingModeRef.current = null;
    mediaChunksRef.current = [];
    return audio;
  }

  function discardRecorderSoon() {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    recordingModeRef.current = null;
    mediaChunksRef.current = [];
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.stop();
    } catch {
      // Safety recording cleanup should never delay a completed realtime turn.
    }
  }

  function microphoneErrorMessage(caught: unknown) {
    const name = caught instanceof DOMException || caught instanceof Error ? caught.name : "";
    if (role !== "staff") return voiceText.micError;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "마이크 권한이 거부되었습니다. 브라우저 주소창 또는 설정에서 마이크를 허용한 뒤 다시 시도해주세요.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "사용 가능한 마이크를 찾지 못했습니다. 마이크 연결 상태를 확인해주세요.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "다른 앱이 마이크를 사용 중일 수 있습니다. 다른 통화/녹음 앱을 닫고 다시 시도해주세요.";
    }
    return caught instanceof Error ? caught.message : voiceText.micError;
  }

  async function uploadConsultationVoiceTurn(audio: Blob) {
    const clientTurnId = `${Date.now()}`;
    const formData = new FormData();
    formData.set("roomId", room.id);
    formData.set("role", role);
    formData.set("roomToken", roomToken ?? "");
    formData.set("clientTurnId", clientTurnId);
    formData.set("patientLanguage", room.patientLanguage);
    formData.set("audio", audio, `${role}-${clientTurnId}.${audioFileExtension(audio.type)}`);

    const response = await fetch("/api/consultation-voice-turns", {
      method: "POST",
      body: formData
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Consultation voice translation failed.");
    }
    return data.message as RealtimeTranslationMessage;
  }

  async function persistRealtimeConsultationVoiceTurn(params: {
    messageId: string;
    speakerRole: ParticipantRole;
    sourceText: string;
    translatedText: string;
  }) {
    const response = await fetch("/api/consultation-voice-turns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        messageId: params.messageId,
        role: params.speakerRole,
        roomToken,
        patientLanguage: room.patientLanguage,
        sourceText: params.sourceText,
        translatedText: params.translatedText
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Consultation voice message could not be saved.");
    }
    return data.message as RealtimeTranslationMessage;
  }

  async function startVoiceTurn() {
    if (voiceBusy || room.status === "ended") return;

    markActivity();
    setError("");
    setVoiceBusy(true);
    try {
      stopPlayback();
      if (role === "patient") {
        const acquiredTurn = await transition("patient_speaking");
        if (!acquiredTurn) {
          setError(voiceText.busy);
          return;
        }

        const stream = await ensureMicStream();
        try {
          const realtimeClient = await ensureRealtimeSession(stream);
          realtimeClient.startTurn();
          beginRealtimeSafetyRecording(stream);
          setMicEnabled(true);
          setSpeakingStartedAt(Date.now());
        } catch {
          beginUploadRecording(stream, "upload");
        }
        return;
      }

      const acquiredTurn = await transition("staff_speaking");
      if (!acquiredTurn) {
        setError(voiceText.busy);
        return;
      }

      const stream = await ensureMicStream();
      try {
        const realtimeClient = await ensureRealtimeSession(stream);
        realtimeClient.startTurn();
        beginRealtimeSafetyRecording(stream);
        setMicEnabled(true);
        setSpeakingStartedAt(Date.now());
      } catch {
        beginUploadRecording(stream, "upload");
      }
    } catch (caught) {
      setSpeakingStartedAt(null);
      setError(microphoneErrorMessage(caught));
      setMicEnabled(false);
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      realtimePreconnectStartedRef.current = false;
      recordingModeRef.current = null;
      await transition("ready");
    } finally {
      setVoiceBusy(false);
    }
  }

  async function stopVoiceTurn() {
    if (!speakingStartedAt) return;

    markActivity();
    setVoiceBusy(true);
    setSpeakingStartedAt(null);
    setMicEnabled(false);
    const recordingMode = recordingModeRef.current;

    if (role === "patient") {
      try {
        setRoom((current) => ({ ...current, status: "translating_to_staff" }));
        void transition("translating_to_staff");
        let message: RealtimeTranslationMessage;
        if (recordingMode === "upload") {
          const audio = await stopAndClearRecorder();
          if (audio.size <= 0) throw new Error("No audio was recorded.");
          message = await uploadConsultationVoiceTurn(audio);
        } else {
          try {
            const translatedText = await realtimeClientRef.current?.stopTurnAndTranslate({
              quietMs: CONSULTATION_TRANSLATION_QUIET_MS,
              maxMs: CONSULTATION_TRANSLATION_MAX_MS
            });
            if (!translatedText) throw new Error("No translated text was returned.");
            const normalizedText = normalizeClinicTranslation(translatedText, "ko");
            const sourceText = realtimeClientRef.current?.getInputTranscript() || voiceText.fallback;
            message = await persistRealtimeConsultationVoiceTurn({
              messageId: `${role}-voice-${Date.now()}`,
              speakerRole: role,
              sourceText,
              translatedText: normalizedText
            });
            discardRecorderSoon();
          } catch (realtimeError) {
            if (recordingMode !== "safety") throw realtimeError;
            const audio = await stopAndClearRecorder();
            if (audio.size <= 0) throw realtimeError;
            message = await uploadConsultationVoiceTurn(audio);
          }
        }
        appendMessage(message);
        void broadcastTranslationMessage(room.id, message);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Translation failed.");
      } finally {
        mediaChunksRef.current = [];
        setRoom((current) => ({ ...current, status: "ready" }));
        void transition("ready");
        setVoiceBusy(false);
      }
      return;
    }

    try {
      let message: RealtimeTranslationMessage;
      if (recordingMode === "upload") {
        await transition("translating_to_patient");
        const audio = await stopAndClearRecorder();
        if (audio.size <= 0) throw new Error("No audio was recorded.");
        message = await uploadConsultationVoiceTurn(audio);
      } else {
        await transition("translating_to_patient");
        try {
          const translatedText = await realtimeClientRef.current?.stopTurnAndTranslate({
            quietMs: CONSULTATION_TRANSLATION_QUIET_MS,
            maxMs: CONSULTATION_TRANSLATION_MAX_MS
          });
          if (!translatedText) throw new Error("No translated text was returned.");
          const normalizedText = normalizeClinicTranslation(translatedText, room.patientLanguage);
          const sourceText = realtimeClientRef.current?.getInputTranscript() || "한국어 원문을 표시하지 못했습니다.";
          const messageId = `${role}-voice-${Date.now()}`;
          message = await persistRealtimeConsultationVoiceTurn({
            messageId,
            speakerRole: role,
            sourceText,
            translatedText: normalizedText
          });
          discardRecorderSoon();
        } catch (realtimeError) {
          if (recordingMode !== "safety") throw realtimeError;
          const audio = await stopAndClearRecorder();
          if (audio.size <= 0) throw realtimeError;
          message = await uploadConsultationVoiceTurn(audio);
        }
      }

      appendMessage(message);
      void broadcastTranslationMessage(room.id, message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Translation failed.");
    } finally {
      await transition("ready");
      setVoiceBusy(false);
    }
  }

  useEffect(() => {
    const chatScroll = chatScrollRef.current;
    if (!chatScroll) return;

    const frame = window.requestAnimationFrame(() => {
      chatScroll.scrollTo({
        top: chatScroll.scrollHeight,
        behavior: chatMessages.length > 1 ? "smooth" : "auto"
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatMessages.length, textSubmitting]);

  useEffect(() => {
    return subscribeToRoomUpdates(room.id, (updatedRoom) => {
      setRoom((current) => ({ ...current, ...updatedRoom }));
      markActivity();
    }) ?? undefined;
  }, [markActivity, room.id]);

  useEffect(() => {
    return subscribeToTranslationMessages(room.id, (message) => {
      if (message.speaker !== role) {
        appendMessage(message);
        playQueuedTranslatedSpeech(message);
        markIncomingMessagesRead([message]);
      }
      markActivity();
    }) ?? undefined;
  }, [appendMessage, markActivity, markIncomingMessagesRead, playQueuedTranslatedSpeech, role, room.id]);

  useEffect(() => {
    return prepareTranslationBroadcastChannel(room.id) ?? undefined;
  }, [room.id]);

  useEffect(() => {
    async function fetchMessages() {
      if (messagePollInFlightRef.current) return;

      messagePollInFlightRef.current = true;
      try {
        const response = await fetch(`/api/rooms/${room.id}/messages`, {
          cache: "no-store",
          headers: role === "patient" && roomToken ? { "x-room-token": roomToken } : undefined
        });
        if (!response.ok) return;

        const data = (await response.json()) as { messages?: TranslationMessage[] };
        const fetchedMessages = data.messages ?? [];
        let latestCreatedAt = lastFetchedMessageAtRef.current;
        const hadFetchedBefore = messageFetchInitializedRef.current;

        for (const message of fetchedMessages) {
          if (message.createdAt && (!latestCreatedAt || message.createdAt > latestCreatedAt)) {
            latestCreatedAt = message.createdAt;
          }
        }
        mergeMessages(fetchedMessages);
        markIncomingMessagesRead(fetchedMessages);
        for (const message of fetchedMessages) {
          if (message.speaker === role) continue;
          if (hadFetchedBefore) playQueuedTranslatedSpeech(message);
          else spokenMessageIdsRef.current.add(message.id);
        }

        if (latestCreatedAt) lastFetchedMessageAtRef.current = latestCreatedAt;
        messageFetchInitializedRef.current = true;
        if (fetchedMessages.length) markActivity();
      } finally {
        messagePollInFlightRef.current = false;
      }
    }

    void fetchMessages();
    const interval = window.setInterval(() => {
      void fetchMessages();
    }, 1500);

    return () => window.clearInterval(interval);
  }, [markActivity, markIncomingMessagesRead, mergeMessages, playQueuedTranslatedSpeech, role, room.id, roomToken]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response =
        role === "staff"
          ? await fetch(`/api/rooms/${room.id}`, { cache: "no-store" })
          : roomToken
            ? await fetch(`/api/rooms/by-token/${roomToken}`, { cache: "no-store" })
            : await fetch(`/api/rooms/${room.id}/patient`, { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      setRoom((current) => ({ ...current, ...data.room }));
    }, 5000);

    return () => window.clearInterval(interval);
  }, [role, room.id, roomToken]);

  useEffect(() => {
    markActivity();
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [markActivity]);

  useEffect(() => {
    if (room.status !== "ready" || realtimePreconnectStartedRef.current || realtimeClientRef.current) return;
    realtimePreconnectStartedRef.current = true;
    void ensureMicStream()
      .then((stream) => ensureRealtimeSession(stream))
      .catch((caught) => {
        realtimePreconnectStartedRef.current = false;
        setError(microphoneErrorMessage(caught));
      });
    // Preconnect should run once when the room becomes ready; it reads current refs and room identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status]);

  useEffect(() => {
    const reconnectWhenVisible = (event?: Event) => {
      if (event?.type === "pageshow" && "persisted" in event && !event.persisted) return;
      if (document.visibilityState !== "visible" || speakingStartedAt || room.status !== "ready") return;
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      realtimePreconnectStartedRef.current = true;
      void ensureMicStream()
        .then((stream) => ensureRealtimeSession(stream))
        .catch((caught) => {
          realtimePreconnectStartedRef.current = false;
          setError(microphoneErrorMessage(caught));
        });
    };

    document.addEventListener("visibilitychange", reconnectWhenVisible);
    window.addEventListener("pageshow", reconnectWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", reconnectWhenVisible);
      window.removeEventListener("pageshow", reconnectWhenVisible);
    };
    // Resume handling should use the latest visibility/status state while reusing current media refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, speakingStartedAt]);

  useEffect(() => {
    return () => {
      stopPlayback();
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      recordingModeRef.current = null;
      mediaChunksRef.current = [];
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [stopPlayback]);

  async function submitTextMessage(textOverride?: string) {
    const sourceText = (textOverride ?? textInput).trim();
    if (!sourceText || textSubmitting || room.status === "ended") return;

    markActivity();
    setError("");
    setTextSubmitting(true);

    const messageId = `${role}-text-${Date.now()}`;
    const localMessage = {
      id: `${messageId}-local`,
      speaker: role,
      sourceText,
      text: sourceText,
      targetLanguage: role === "staff" ? room.patientLanguage : "ko",
      createdAt: new Date().toISOString(),
      deliveryStatus: "sending"
    } satisfies TranslationMessage;

    appendMessage(localMessage);

    try {
      const response = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          messageId,
          role,
          roomToken,
          patientLanguage: room.patientLanguage,
          text: sourceText
        })
      });
      const data = (await response.json().catch(() => null)) as {
        translatedText?: string;
        message?: RealtimeTranslationMessage & { createdAt?: string };
        error?: string;
      } | null;
      if (!response.ok || !data?.translatedText) {
        throw new Error(data?.error ?? "Text translation failed.");
      }

      const message = data.message ?? {
        id: messageId,
        speaker: role,
        sourceText,
        text: data.translatedText,
        targetLanguage: role === "staff" ? room.patientLanguage : "ko",
        createdAt: new Date().toISOString()
      } satisfies RealtimeTranslationMessage;

      void broadcastTranslationMessage(room.id, message);

      confirmLocalMessage(localMessage.id, message);
      if (!textOverride) setTextInput("");
    } catch (caught) {
      updateMessageDeliveryStatus(localMessage.id, "failed");
      setError(caught instanceof Error ? caught.message : "Text translation failed.");
    } finally {
      setTextSubmitting(false);
    }
  }

  function handleTextInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (isComposingTextRef.current || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void submitTextMessage();
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-soft md:min-h-[720px]">
      <header className="shrink-0 border-b border-line bg-white px-3 py-2 md:px-6 md:py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-trust">{room.hospital?.name ?? "Clinic Voice Room"}</p>
            <h1 className="mt-0.5 truncate text-base font-bold text-ink md:text-lg">{title}</h1>
          </div>
          {role === "patient" ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-trust md:gap-2 md:px-3 md:py-1.5 md:text-xs">
              <span className="h-2 w-2 rounded-full bg-trust" />
              {room.status === "ended" ? copy.statusEnded : copy.statusChat}
            </span>
          ) : null}
        </div>

        {role === "patient" ? (
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{copy.chatStarted}</p>
        ) : null}

      </header>

      <section ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-mist px-3 py-3 md:px-6 md:py-4" aria-live="polite">
        {chatMessages.length ? (
          <div className="space-y-3">
            {chatMessages.map((message) => {
              const mine = message.speaker === role;
              const failed = message.deliveryStatus === "failed";
              const sentAt = message.createdAt
                ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))
                : "";
              const metaText = message.deliveryStatus
                ? message.deliveryStatus === "sending"
                  ? deliveryStatusCopy.sending
                  : deliveryStatusCopy.failed
                : mine && message.readAt
                  ? deliveryStatusCopy.read
                  : "";
              return (
                <article key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine ? (
                    <div className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-mint">
                      {message.speaker === "staff" ? "S" : "P"}
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm md:max-w-[70%] md:text-base ${
                      mine ? (failed ? "rounded-br-md bg-rose-500 text-white" : "rounded-br-md bg-trust text-white") : "rounded-bl-md bg-white text-ink"
                    }`}
                  >
                    {visibleMessageText(message)}
                    {sentAt || metaText ? (
                      <span className={`mt-1 block text-[11px] font-bold ${mine ? "text-white/80" : "text-slate-400"}`}>
                        {[sentAt, metaText].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center text-center md:min-h-[260px]">
            <div>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-green-100 text-sm font-bold text-mint md:h-14 md:w-14 md:text-lg">AI</div>
              <p className="mt-3 text-sm font-bold text-ink md:mt-4 md:text-base">{role === "staff" ? "고객의 메시지가 여기에 표시됩니다." : copy.title}</p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500 md:mt-2 md:text-sm md:leading-6">{role === "staff" ? "고객 응답에 맞춰 안내하세요." : copy.empty}</p>
            </div>
          </div>
        )}
      </section>

      <footer className="shrink-0 border-t border-line bg-white px-2.5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 md:px-4 md:pb-4">
        <div className="mb-2 rounded-2xl bg-slate-50 p-3 text-center md:p-4">
          <button
            type="button"
            disabled={room.status === "ended" || (voiceBusy && !isSpeaking) || (!micEnabled && !isSpeaking)}
            onClick={isSpeaking ? stopVoiceTurn : startVoiceTurn}
            className={`tap-highlight-none mx-auto grid h-20 w-20 place-items-center rounded-full text-white shadow-soft transition active:scale-[0.98] disabled:bg-slate-300 disabled:opacity-80 md:h-24 md:w-24 ${
              isSpeaking ? "bg-coral" : micEnabled ? "bg-ink" : "bg-slate-300"
            }`}
            aria-label={isSpeaking ? voiceText.speaking : voiceText.ready}
            title={isSpeaking ? voiceText.speaking : voiceText.ready}
          >
            {voiceBusy && !isSpeaking ? <Loader2 size={30} className="animate-spin" /> : <Mic size={34} />}
          </button>
          <p className="mt-2 text-base font-bold text-ink md:text-lg">
            {room.status === "ended" ? (role === "staff" ? "상담 종료" : copy.statusEnded) : isSpeaking ? voiceText.speaking : micEnabled ? voiceText.ready : voiceText.waiting}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 md:text-sm">{voiceText.helper}</p>
          {browserAudioOutputEnabled && lastIncomingMessage ? (
            <button
              type="button"
              onClick={replayLastIncomingMessage}
              className="mx-auto mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-trust shadow-sm transition hover:bg-blue-50 md:h-10 md:px-4 md:text-sm"
              aria-label={replayLabel}
              title={replayLabel}
            >
              <Volume2 size={16} />
              {replayLabel}
            </button>
          ) : null}
        </div>

        <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-1.5 md:p-2">
          <textarea
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            onCompositionStart={() => {
              isComposingTextRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingTextRef.current = false;
            }}
            onKeyDown={handleTextInputKeyDown}
            placeholder={role === "staff" ? voiceText.fallback : voiceText.fallback}
            disabled={room.status === "ended" || textSubmitting}
            rows={1}
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-3 py-1.5 text-base font-semibold leading-7 text-ink outline-none disabled:opacity-60 md:max-h-28 md:min-h-11 md:py-2"
          />
          <button
            type="button"
            onClick={() => void submitTextMessage()}
            disabled={!canSubmitText}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-trust text-white transition hover:bg-blue-600 disabled:opacity-50 md:h-11 md:w-11"
            aria-label={role === "staff" ? "번역 보내기" : copy.submit}
            title={role === "staff" ? "번역 보내기" : copy.submit}
          >
            {textSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
        {error ? <p className="mt-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {role === "staff" ? (
          <button
            onClick={endRoomAndReturn}
            disabled={ending}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 md:mt-3 md:h-14 md:text-base"
          >
            {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />}
            {room.status === "ended" ? "직원 화면으로" : "상담 종료 후 직원 화면으로"}
          </button>
        ) : null}
      </footer>
    </div>
  );
}
