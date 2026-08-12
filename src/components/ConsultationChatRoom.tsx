"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Flag, Loader2, Mic, PhoneOff, Send, Volume2, X } from "lucide-react";
import { languageLabels, patientLanguageTags, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { isMicEnabled, type RoomStatus } from "@/lib/room-state";
import { OpenAIRealtimeClient } from "@/lib/openai-realtime-client";
import { normalizeClinicTranslation } from "@/lib/clinic-glossary";
import type { GuardFlags } from "@/lib/guard-flags";
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
import { useAdaptivePolling } from "@/lib/use-adaptive-polling";
import { EndRoomDialog } from "@/components/EndRoomDialog";
import { ImportantConfirmationPanel, type ConfirmationActionStatus } from "@/components/ImportantConfirmationPanel";
import { PatientTextSizeControl, patientTextSizeClassName, usePatientTextSize } from "@/components/PatientTextSizeControl";
import { patientAutoStopHelperCopy, patientAutoStopSpeakingCopy, patientNoVoiceCopy, startVoiceAutoStop, type VoiceLevelBucket } from "@/lib/web-voice-auto-stop";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const CONSULTATION_TRANSLATION_QUIET_MS = 500;
const CONSULTATION_TRANSLATION_MAX_MS = 5500;

const voiceCopy: Record<PatientLanguage, { ready: string; speaking: string; waiting: string; helper: string; micError: string; busy: string; fallback: string }> = {
  zh: { ready: "按住说话", speaking: "再次点击结束", waiting: "请稍候", helper: "建议先用语音咨询。输入框可作为备用。", micError: "无法使用麦克风。请允许浏览器使用麦克风。", busy: "对方正在讲话。请稍后再试。", fallback: "语音不顺利时可输入文字。" },
  yue: { ready: "點擊講話", speaking: "再次點擊結束", waiting: "請稍候", helper: "建議先用語音諮詢。輸入框可作為備用。", micError: "無法使用麥克風。請允許瀏覽器使用麥克風。", busy: "對方正在說話。請稍後再試。", fallback: "語音不順利時可輸入文字。" },
  zh_tw: { ready: "點擊說話", speaking: "再次點擊結束", waiting: "請稍候", helper: "建議先用語音諮詢。輸入框可作為備用。", micError: "無法使用麥克風。請允許瀏覽器使用麥克風。", busy: "對方正在說話。請稍後再試。", fallback: "語音不順利時可輸入文字。" },
  ja: { ready: "タップして話す", speaking: "もう一度タップして終了", waiting: "少々お待ちください", helper: "まず音声で相談できます。入力欄は予備として使えます。", micError: "マイクを使用できません。ブラウザでマイクを許可してください。", busy: "相手が話しています。少し待ってからお試しください。", fallback: "音声がうまくいかない時は文字で入力できます。" },
  en: { ready: "Tap and speak", speaking: "Tap again to finish", waiting: "Please wait", helper: "Voice is the main way to consult. Typing is available as a backup.", micError: "Microphone is unavailable. Please allow microphone access in your browser.", busy: "The other person is speaking. Please try again shortly.", fallback: "If voice does not work well, type here." },
  th: { ready: "แตะแล้วพูด", speaking: "แตะอีกครั้งเพื่อจบ", waiting: "กรุณารอสักครู่", helper: "แนะนำให้ปรึกษาด้วยเสียงก่อน ช่องพิมพ์ใช้เป็นทางเลือกสำรอง", micError: "ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์", busy: "อีกฝ่ายกำลังพูด กรุณาลองใหม่อีกครั้ง", fallback: "หากเสียงไม่ชัด สามารถพิมพ์ข้อความได้" },
  ms: { ready: "Ketik dan bercakap", speaking: "Ketik lagi untuk tamat", waiting: "Sila tunggu", helper: "Gunakan suara dahulu untuk konsultasi. Ruang teks tersedia sebagai sandaran.", micError: "Mikrofon tidak tersedia. Sila benarkan akses mikrofon dalam pelayar.", busy: "Orang lain sedang bercakap. Cuba lagi sebentar lagi.", fallback: "Jika suara tidak lancar, taip di sini." },
  mn: { ready: "Дарж ярих", speaking: "Дахин дарж дуусгах", waiting: "Түр хүлээнэ үү", helper: "Эхлээд дуугаар зөвлөгөө авахыг зөвлөж байна. Бичих талбар нөөцөөр байна.", micError: "Микрофон ашиглах боломжгүй. Хөтөч дээр микрофон зөвшөөрнө үү.", busy: "Нөгөө хүн ярьж байна. Түр хүлээгээд дахин оролдоно уу.", fallback: "Дуу сайн ажиллахгүй бол энд бичнэ үү." },
  ru: { ready: "Нажмите и говорите", speaking: "Нажмите еще раз, чтобы закончить", waiting: "Пожалуйста, подождите", helper: "Лучше начать консультацию голосом. Текстовое поле доступно как запасной вариант.", micError: "Микрофон недоступен. Разрешите доступ к микрофону в браузере.", busy: "Сейчас говорит другой человек. Повторите чуть позже.", fallback: "Если голос работает плохо, введите текст здесь." },
  vi: { ready: "Nhấn và nói", speaking: "Nhấn lại để kết thúc", waiting: "Vui lòng chờ", helper: "Nên tư vấn bằng giọng nói trước. Ô nhập chữ dùng khi cần.", micError: "Không thể sử dụng micro. Vui lòng cho phép micro trong trình duyệt.", busy: "Người kia đang nói. Vui lòng thử lại sau.", fallback: "Nếu giọng nói không ổn, hãy nhập chữ tại đây." },
  id: { ready: "Ketuk dan bicara", speaking: "Ketuk lagi untuk selesai", waiting: "Mohon tunggu", helper: "Gunakan suara sebagai cara utama konsultasi. Kolom teks tersedia sebagai cadangan.", micError: "Mikrofon tidak tersedia. Izinkan akses mikrofon di browser.", busy: "Orang lain sedang berbicara. Coba lagi sebentar lagi.", fallback: "Jika suara kurang lancar, ketik di sini." },
  tl: { ready: "I-tap at magsalita", speaking: "I-tap ulit para matapos", waiting: "Pakihintay", helper: "Gamitin muna ang boses para sa konsultasyon. May text box bilang backup.", micError: "Hindi magamit ang mikropono. Payagan ang microphone access sa browser.", busy: "Nagsasalita ang kabilang panig. Subukan muli pagkalipas ng ilang sandali.", fallback: "Kung hindi maayos ang boses, mag-type dito." },
  fr: { ready: "Touchez et parlez", speaking: "Touchez à nouveau pour terminer", waiting: "Veuillez patienter", helper: "La consultation se fait d'abord par voix. Le texte reste disponible en secours.", micError: "Le microphone n'est pas disponible. Autorisez l'accès au microphone dans le navigateur.", busy: "L'autre personne parle. Veuillez réessayer dans un instant.", fallback: "Si la voix fonctionne mal, écrivez ici." },
  es: { ready: "Toque y hable", speaking: "Toque de nuevo para terminar", waiting: "Espere un momento", helper: "Use la voz como forma principal de consulta. El texto queda como respaldo.", micError: "El micrófono no está disponible. Permita el acceso al micrófono en el navegador.", busy: "La otra persona está hablando. Inténtelo de nuevo en un momento.", fallback: "Si la voz no funciona bien, escriba aquí." },
  de: { ready: "Tippen und sprechen", speaking: "Zum Beenden erneut tippen", waiting: "Bitte warten", helper: "Die Beratung läuft zuerst per Sprache. Das Textfeld bleibt als Reserve verfügbar.", micError: "Das Mikrofon ist nicht verfügbar. Bitte erlauben Sie den Mikrofonzugriff im Browser.", busy: "Die andere Person spricht. Bitte versuchen Sie es gleich erneut.", fallback: "Wenn Sprache nicht gut funktioniert, schreiben Sie hier." },
  it: { ready: "Tocca e parla", speaking: "Tocca di nuovo per finire", waiting: "Attendi", helper: "La consulenza parte dalla voce. Il testo resta come opzione di riserva.", micError: "Il microfono non è disponibile. Consenti l'accesso al microfono nel browser.", busy: "L'altra persona sta parlando. Riprova tra poco.", fallback: "Se la voce non funziona bene, scrivi qui." },
  pt: { ready: "Toque e fale", speaking: "Toque novamente para terminar", waiting: "Aguarde", helper: "A consulta deve começar por voz. O texto fica como opção de apoio.", micError: "O microfone não está disponível. Permita o acesso ao microfone no navegador.", busy: "A outra pessoa está falando. Tente novamente em instantes.", fallback: "Se a voz não funcionar bem, digite aqui." }
};

export const patientReplayCopy: Record<PatientLanguage, string> = {
  zh: "重新播放",
  yue: "重新播放",
  zh_tw: "重新播放",
  ja: "もう一度聞く",
  en: "Replay",
  th: "ฟังอีกครั้ง",
  ms: "Dengar semula",
  mn: "Дахин сонсох",
  ru: "Повторить",
  vi: "Nghe lại",
  id: "Dengar lagi",
  tl: "Pakinggan muli",
  fr: "Réécouter",
  es: "Escuchar de nuevo",
  de: "Erneut anhören",
  it: "Riascolta",
  pt: "Ouvir novamente"
};

export const patientRetryCopy: Record<PatientLanguage, string> = {
  zh: "重试",
  yue: "再試一次",
  zh_tw: "重試",
  ja: "もう一度試す",
  en: "Try again",
  th: "ลองอีกครั้ง",
  ms: "Cuba lagi",
  mn: "Дахин оролдох",
  ru: "Повторить",
  vi: "Thử lại",
  id: "Coba lagi",
  tl: "Subukan muli",
  fr: "Réessayer",
  es: "Intentar de nuevo",
  de: "Erneut versuchen",
  it: "Riprova",
  pt: "Tentar novamente"
};

const confirmationCopy: Record<PatientLanguage, { title: string; confirm: string; repeat: string }> = {
  zh: { title: "请确认重要信息", confirm: "我已确认", repeat: "请再说明一次" }, yue: { title: "請確認重要資料", confirm: "我已確認", repeat: "請再講一次" }, zh_tw: { title: "請確認重要資訊", confirm: "我已確認", repeat: "請再說明一次" },
  ja: { title: "重要な内容をご確認ください", confirm: "確認しました", repeat: "もう一度説明してください" }, en: { title: "Please confirm the important details", confirm: "I confirm", repeat: "Please explain again" }, th: { title: "โปรดยืนยันข้อมูลสำคัญ", confirm: "ยืนยันแล้ว", repeat: "กรุณาอธิบายอีกครั้ง" },
  ms: { title: "Sila sahkan maklumat penting", confirm: "Saya sahkan", repeat: "Sila terangkan lagi" }, mn: { title: "Чухал мэдээллийг баталгаажуулна уу", confirm: "Баталгаажууллаа", repeat: "Дахин тайлбарлана уу" }, ru: { title: "Подтвердите важные сведения", confirm: "Подтверждаю", repeat: "Объясните ещё раз" },
  vi: { title: "Vui lòng xác nhận thông tin quan trọng", confirm: "Tôi xác nhận", repeat: "Vui lòng giải thích lại" }, id: { title: "Harap konfirmasi informasi penting", confirm: "Saya konfirmasi", repeat: "Tolong jelaskan lagi" }, tl: { title: "Pakikumpirma ang mahalagang detalye", confirm: "Kinukumpirma ko", repeat: "Pakipaliwanag muli" },
  fr: { title: "Veuillez confirmer les informations importantes", confirm: "Je confirme", repeat: "Veuillez réexpliquer" }, es: { title: "Confirme los datos importantes", confirm: "Confirmo", repeat: "Explíquelo de nuevo" }, de: { title: "Bitte bestätigen Sie die wichtigen Angaben", confirm: "Ich bestätige", repeat: "Bitte noch einmal erklären" },
  it: { title: "Confermi le informazioni importanti", confirm: "Confermo", repeat: "Spieghi di nuovo" }, pt: { title: "Confirme as informações importantes", confirm: "Confirmo", repeat: "Explique novamente" }
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
  guardFlags?: GuardFlags | null;
  deliveryStatus?: "sending" | "failed";
};

type QuickPhraseStage = "intake" | "medical" | "procedure" | "price_schedule" | "summary";

type QuickPhrase = {
  id: string;
  stage: QuickPhraseStage | null;
  ko: string;
  translatedText?: string | null;
  sortOrder: number;
};

const quickPhraseStages = ["intake", "medical", "procedure", "price_schedule", "summary"] as const;
const quickPhraseStageLabels: Record<QuickPhraseStage | "all", string> = {
  all: "All",
  intake: "Intake",
  medical: "Medical",
  procedure: "Procedure",
  price_schedule: "Price",
  summary: "Summary"
};

type FeedbackReason = "mistranslation" | "wrong_term" | "awkward" | "other";

const feedbackReasons: Array<{ value: FeedbackReason; label: string }> = [
  { value: "mistranslation", label: "오역" },
  { value: "wrong_term", label: "용어 틀림" },
  { value: "awkward", label: "어색함" },
  { value: "other", label: "기타" }
];

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
  const [patientTextSize, setPatientTextSize] = usePatientTextSize();
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speakingStartedAt, setSpeakingStartedAt] = useState<number | null>(null);
  const [noVoiceWarning, setNoVoiceWarning] = useState(false);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const [roomRealtimeHealthy, setRoomRealtimeHealthy] = useState(false);
  const [messageRealtimeHealthy, setMessageRealtimeHealthy] = useState(false);
  const [quickPhrases, setQuickPhrases] = useState<QuickPhrase[]>([]);
  const [quickPhraseStage, setQuickPhraseStage] = useState<QuickPhraseStage | "all">("all");
  const [quickPhraseLoading, setQuickPhraseLoading] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<TranslationMessage | null>(null);
  const [activeFeedbackMenuId, setActiveFeedbackMenuId] = useState("");
  const [feedbackSubmittingId, setFeedbackSubmittingId] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<ConfirmationActionStatus>("idle");
  const [confirmationError, setConfirmationError] = useState("");
  const [lastConfirmationAction, setLastConfirmationAction] = useState<"confirmed" | "repeat_requested">("confirmed");
  const [confirmationNotice, setConfirmationNotice] = useState("");
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endError, setEndError] = useState("");
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
  const voiceAutoStopCleanupRef = useRef<() => void>(() => undefined);
  const micLevelRingRef = useRef<HTMLSpanElement | null>(null);
  const realtimeClientRef = useRef<OpenAIRealtimeClient | null>(null);
  const realtimePreconnectStartedRef = useRef(false);
  const stopVoiceTurnRef = useRef<() => Promise<void>>(async () => undefined);
  const speechQueueRef = useRef(Promise.resolve());
  const spokenMessageIdsRef = useRef(new Set<string>());

  const copy =
    consultationTextCopy[room.patientLanguage] ??
    (room.patientLanguage === "yue" ? consultationTextCopy.zh_tw : consultationTextCopy.en);
  const voiceText = role === "staff"
    ? { ready: "누르고 말하세요", speaking: "다시 누르면 종료", waiting: "잠시 기다려주세요", helper: "음성을 먼저 사용하고, 인식이 어려울 때만 텍스트로 입력하세요.", micError: "마이크를 사용할 수 없습니다.", busy: "상대방이 말하는 중입니다. 잠시 후 다시 눌러주세요.", fallback: "음성 인식이 원활하지 않을 때 텍스트로 입력하세요." }
    : voiceCopy[room.patientLanguage];
  const deliveryStatusCopy = role === "staff"
    ? { sending: "전송 중", failed: "전송 실패", read: "읽음" }
    : consultationDeliveryStatusCopy[room.patientLanguage] ??
      (room.patientLanguage === "yue" ? consultationDeliveryStatusCopy.zh_tw : consultationDeliveryStatusCopy.en);
  const chatMessages = [...messages].reverse();
  const canSubmitText = Boolean(textInput.trim()) && !textSubmitting && room.status !== "ended";
  const isSpeaking = speakingStartedAt !== null;
  const micEnabled = isMicEnabled(room.status, role);
  const browserAudioOutputEnabled = role === "staff";
  const lastIncomingMessage = messages.find((message) => message.speaker !== role && message.deliveryStatus !== "failed");
  const pendingConfirmationMessage = role === "patient" ? messages.find((message) => message.speaker === "staff" && message.guardFlags?.confirmation?.status === "pending") : undefined;
  const staffConfirmationMessage = role === "staff" ? messages.find((message) => message.speaker === "staff" && ["pending", "repeat_requested"].includes(message.guardFlags?.confirmation?.status ?? "")) : undefined;
  const replayLabel = role === "staff" ? "다시 듣기" : patientReplayCopy[room.patientLanguage];
  const visibleQuickPhrases = useMemo(() => {
    if (quickPhraseStage === "all") return quickPhrases;
    return quickPhrases.filter((phrase) => phrase.stage === quickPhraseStage || phrase.stage === null);
  }, [quickPhraseStage, quickPhrases]);

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

  const verifyRoomEnded = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${room.id}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { room?: RoomSnapshot } | null;
      if (response.ok && data?.room) {
        setRoom((current) => ({ ...current, ...data.room }));
        return data.room.status === "ended";
      }
    } catch {
      // Keep the room visible until the final state is known.
    }
    return false;
  }, [room.id]);

  const endRoomAndReturn = useCallback(async () => {
    setEndError("");
    const ended = await endRoom();
    const verifiedEnded = ended || await verifyRoomEnded();
    if (!verifiedEnded) {
      setEndError("네트워크 오류로 종료 여부를 확인하지 못했습니다. 방을 닫지 말고 상태를 다시 확인해주세요.");
      return;
    }
    setEndDialogOpen(false);
    router.replace("/staff");
    router.refresh();
  }, [endRoom, router, verifyRoomEnded]);

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

  const updateMicLevel = useCallback((bucket: VoiceLevelBucket) => {
    const ring = micLevelRingRef.current;
    if (!ring) return;
    ring.style.opacity = bucket === 0 ? "0.25" : String(0.35 + bucket * 0.13);
    ring.style.transform = `scale(${1 + bucket * 0.035})`;
  }, []);
  const stopVoiceAutoStop = useCallback(() => {
    voiceAutoStopCleanupRef.current();
    voiceAutoStopCleanupRef.current = () => undefined;
    updateMicLevel(0);
    setNoVoiceWarning(false);
  }, [updateMicLevel]);

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
    stopVoiceAutoStop();
    voiceAutoStopCleanupRef.current = startVoiceAutoStop(stream, {
      onStop: () => {
        void stopVoiceTurnRef.current();
      },
      onLevel: updateMicLevel,
      onNoVoiceChange: setNoVoiceWarning
    });
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
    stopVoiceAutoStop();
    const audio = await stopPatientRecorder();
    mediaRecorderRef.current = null;
    recordingModeRef.current = null;
    mediaChunksRef.current = [];
    return audio;
  }

  function discardRecorderSoon() {
    stopVoiceAutoStop();
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
    sourceTranscriptComplete: boolean;
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
        translatedText: params.translatedText,
        sourceTranscriptComplete: params.sourceTranscriptComplete
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
            const realtimeClient = realtimeClientRef.current;
            const sourceText = (await realtimeClient?.waitForInputTranscript({ fastMs: 250, repairMs: 1200 })) || voiceText.fallback;
            const sourceTranscriptComplete = realtimeClient?.isInputTranscriptComplete() ?? false;
            message = await persistRealtimeConsultationVoiceTurn({
              messageId: `${role}-voice-${Date.now()}`,
              speakerRole: role,
              sourceText,
              translatedText: normalizedText,
              sourceTranscriptComplete
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
          const realtimeClient = realtimeClientRef.current;
          const sourceText = (await realtimeClient?.waitForInputTranscript({ fastMs: 250, repairMs: 1200 })) || "한국어 원문을 표시하지 못했습니다.";
          const sourceTranscriptComplete = realtimeClient?.isInputTranscriptComplete() ?? false;
          const messageId = `${role}-voice-${Date.now()}`;
          message = await persistRealtimeConsultationVoiceTurn({
            messageId,
            speakerRole: role,
            sourceText,
            translatedText: normalizedText,
            sourceTranscriptComplete
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
    stopVoiceTurnRef.current = stopVoiceTurn;
  });

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
    void fetch(`/api/rooms/${room.id}/warm-glossary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(role === "patient" && roomToken ? { "x-room-token": roomToken } : {})
      },
      body: JSON.stringify(roomToken ? { roomToken } : {})
    }).catch(() => undefined);
  }, [role, room.id, roomToken]);

  useEffect(() => {
    if (role !== "staff") return;

    let cancelled = false;
    setQuickPhraseLoading(true);
    void fetch(`/api/rooms/${room.id}/quick-phrases`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Quick phrases could not be loaded.");
        return response.json() as Promise<{ phrases?: QuickPhrase[] }>;
      })
      .then((data) => {
        if (!cancelled) setQuickPhrases(data.phrases ?? []);
      })
      .catch(() => {
        if (!cancelled) setQuickPhrases([]);
      })
      .finally(() => {
        if (!cancelled) setQuickPhraseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [role, room.id]);

  useEffect(() => {
    return subscribeToRoomUpdates(room.id, (updatedRoom) => {
      setRoom((current) => ({ ...current, ...updatedRoom }));
      markActivity();
    }, (status) => {
      setRoomRealtimeHealthy(status === "SUBSCRIBED");
    }) ?? undefined;
  }, [markActivity, room.id]);

  useEffect(() => {
    return subscribeToTranslationMessages(room.id, (message) => {
      const isConfirmationUpdate = Boolean(message.guardFlags?.confirmation?.status);
      if (message.speaker !== role || isConfirmationUpdate) {
        appendMessage(message);
      }
      if (message.speaker !== role) {
        playQueuedTranslatedSpeech(message);
        markIncomingMessagesRead([message]);
      }
      markActivity();
    }, (status) => {
      setMessageRealtimeHealthy(status === "SUBSCRIBED");
    }) ?? undefined;
  }, [appendMessage, markActivity, markIncomingMessagesRead, playQueuedTranslatedSpeech, role, room.id]);

  useEffect(() => {
    return prepareTranslationBroadcastChannel(room.id) ?? undefined;
  }, [room.id]);

  useAdaptivePolling({
    isRealtimeHealthy: messageRealtimeHealthy,
    healthyIntervalMs: 10_000,
    unhealthyIntervalMs: 1500,
    pollKey: `consultation-messages:${room.id}:${role}:${roomToken ?? ""}`,
    poll: async () => {
      if (messagePollInFlightRef.current) return;

      messagePollInFlightRef.current = true;
      try {
        const response = await fetch(`/api/rooms/${room.id}/messages`, {
          cache: "no-store",
          headers: role === "patient" && roomToken ? { "x-room-token": roomToken } : undefined
        });
        if (!response.ok) throw new Error("Message polling failed.");

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
  });

  useAdaptivePolling({
    isRealtimeHealthy: roomRealtimeHealthy,
    healthyIntervalMs: 15_000,
    unhealthyIntervalMs: 5000,
    pollKey: `consultation-room:${room.id}:${role}:${roomToken ?? ""}`,
    poll: async () => {
      const response =
        role === "staff"
          ? await fetch(`/api/rooms/${room.id}`, { cache: "no-store" })
          : roomToken
            ? await fetch(`/api/rooms/by-token/${roomToken}`, { cache: "no-store" })
            : await fetch(`/api/rooms/${room.id}/patient`, { cache: "no-store" });
      if (!response.ok) throw new Error("Room polling failed.");

      const data = await response.json();
      setRoom((current) => ({ ...current, ...data.room }));
    }
  });

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
      stopVoiceAutoStop();
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
  }, [stopPlayback, stopVoiceAutoStop]);

  async function submitTextMessage(textOverride?: string, quickPhraseId?: string) {
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
          text: sourceText,
          quickPhraseId
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

  function sendQuickPhrase(phrase: QuickPhrase) {
    if (textSubmitting || room.status === "ended") return;
    void submitTextMessage(phrase.ko, phrase.id);
  }

  async function submitFeedback(reason: FeedbackReason) {
    if (role !== "staff" || !feedbackTarget || feedbackSubmittingId) return;

    setFeedbackSubmittingId(feedbackTarget.id);
    setError("");
    setFeedbackNotice("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          roomId: room.id,
          roomToken,
          messageId: feedbackTarget.id,
          reporterRole: role,
          reason
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Feedback could not be sent.");
      }

      setFeedbackNotice("번역 신고가 접수되었습니다.");
      setFeedbackTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feedback could not be sent.");
    } finally {
      setFeedbackSubmittingId("");
    }
  }

  function handleTextInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (isComposingTextRef.current || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void submitTextMessage();
  }

  async function submitPatientConfirmation(status: "confirmed" | "repeat_requested") {
    if (!pendingConfirmationMessage || confirmationBusy) return;
    setLastConfirmationAction(status);
    setConfirmationBusy(true);
    setConfirmationStatus("submitting");
    setConfirmationError("");
    try {
      const response = await fetch(`/api/rooms/${room.id}/messages/${pendingConfirmationMessage.id}/confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(roomToken ? { "x-room-token": roomToken } : {}) },
        body: JSON.stringify({ status })
      });
      const data = await response.json().catch(() => null) as { message?: TranslationMessage; error?: string } | null;
      if (!response.ok || !data?.message) throw new Error(data?.error || voiceText.busy);
      appendMessage(data.message);
      setConfirmationStatus(status);
      setConfirmationNotice(status === "confirmed" ? confirmationCopy[room.patientLanguage].confirm : confirmationCopy[room.patientLanguage].repeat);
      window.setTimeout(() => setConfirmationNotice(""), 3500);
    } catch (caught) {
      setConfirmationStatus("failed");
      setConfirmationError(caught instanceof Error ? caught.message : voiceText.busy);
    } finally {
      setConfirmationBusy(false);
    }
  }

  function replayPatientConfirmation() {
    if (!pendingConfirmationMessage || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(pendingConfirmationMessage.text);
    utterance.lang = speechLanguageByPatientLanguage[room.patientLanguage];
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  const activeSpeakingLabel = role === "patient" ? patientAutoStopSpeakingCopy[room.patientLanguage] : voiceText.speaking;
  const activeHelperText = role === "patient" && isSpeaking ? patientAutoStopHelperCopy[room.patientLanguage] : voiceText.helper;

  return (
    <div lang={role === "patient" ? patientLanguageTags[room.patientLanguage] : "ko"} className={`flex h-full min-h-0 flex-col overflow-hidden bg-white shadow-soft sm:rounded-xl ${role === "patient" ? `patient-text-surface ${patientTextSizeClassName(patientTextSize)}` : ""}`}>
      <header className="shrink-0 border-b border-line bg-white px-3 py-2 md:px-6 md:py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-trust-text">{room.hospital?.name ?? "Clinic Voice Room"}</p>
            <h1 className="mt-0.5 truncate text-base font-bold text-ink md:text-lg">{title}</h1>
          </div>
          {role === "patient" ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-trust-text md:gap-2 md:px-3 md:py-1.5 md:text-xs">
              <span className="h-2 w-2 rounded-full bg-trust" />
              {room.status === "ended" ? copy.statusEnded : copy.statusChat}
            </span>
          ) : null}
        </div>

        {role === "patient" ? (
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{copy.chatStarted}</p>
        ) : null}

      </header>

      {role === "patient" ? (
        <div className="flex shrink-0 justify-end border-b border-line bg-white px-3 py-2 md:px-4">
          <PatientTextSizeControl language={room.patientLanguage} value={patientTextSize} onChange={setPatientTextSize} />
        </div>
      ) : null}

      {pendingConfirmationMessage ? (
        <ImportantConfirmationPanel title={confirmationCopy[room.patientLanguage].title} sentence={pendingConfirmationMessage.text} categories={pendingConfirmationMessage.guardFlags?.confirmation?.categories ?? []} confirmLabel={confirmationCopy[room.patientLanguage].confirm} repeatLabel={confirmationCopy[room.patientLanguage].repeat} replayLabel={patientReplayCopy[room.patientLanguage]} retryLabel={patientRetryCopy[room.patientLanguage]} status={confirmationStatus} error={confirmationError} onConfirm={() => void submitPatientConfirmation("confirmed")} onRepeat={() => void submitPatientConfirmation("repeat_requested")} onReplay={replayPatientConfirmation} onRetry={() => void submitPatientConfirmation(lastConfirmationAction)} />
      ) : null}

      {confirmationNotice ? <p role="status" aria-live="assertive" className="mx-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-base font-bold text-mint-text">{confirmationNotice}</p> : null}

      {staffConfirmationMessage ? (
        <section role="alert" aria-live="assertive" className={`sticky top-0 z-30 shrink-0 border-b-2 px-4 py-3 ${staffConfirmationMessage.guardFlags?.confirmation?.status === "repeat_requested" ? "border-rose-400 bg-rose-50" : "border-blue-300 bg-blue-50"}`}>
          <p className="flex items-center gap-2 text-sm font-bold text-ink">{staffConfirmationMessage.guardFlags?.confirmation?.status === "repeat_requested" ? <AlertTriangle size={19} className="text-coral-text" aria-hidden="true" /> : <Loader2 size={19} className="animate-spin text-trust-text motion-reduce:animate-none" aria-hidden="true" />}{staffConfirmationMessage.guardFlags?.confirmation?.status === "repeat_requested" ? "환자가 다시 설명을 요청했습니다. 같은 내용을 더 쉽게 설명해주세요." : "중요 정보에 대한 환자 확인을 기다리는 중입니다."}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">{staffConfirmationMessage.sourceText || staffConfirmationMessage.text}</p>
        </section>
      ) : null}

      <section ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-mist px-3 py-3 md:px-6 md:py-4" aria-live="polite">
        {chatMessages.length ? (
          <div className="space-y-3">
            {chatMessages.map((message) => {
              const mine = message.speaker === role;
              const failed = message.deliveryStatus === "failed";
              const showGuardFlags = role === "staff" && !message.deliveryStatus;
              const numberMismatch = showGuardFlags && message.guardFlags?.numberCheck === "mismatch";
              const backTranslationStatus = showGuardFlags ? message.guardFlags?.backTranslation?.status : undefined;
              const confirmationStatus = showGuardFlags ? message.guardFlags?.confirmation?.status : undefined;
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
              const feedbackMenuOpen = role === "staff" && activeFeedbackMenuId === message.id;
              return (
                <article key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine ? (
                    <div className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-mint-text">
                      {message.speaker === "staff" ? "S" : "P"}
                    </div>
                  ) : null}
                  <div
                    role={role === "staff" && !message.deliveryStatus ? "button" : undefined}
                    tabIndex={role === "staff" && !message.deliveryStatus ? 0 : undefined}
                    onClick={() => {
                      if (role !== "staff" || message.deliveryStatus) return;
                      setActiveFeedbackMenuId((current) => (current === message.id ? "" : message.id));
                    }}
                    onKeyDown={(event) => {
                      if (role !== "staff" || message.deliveryStatus) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveFeedbackMenuId((current) => (current === message.id ? "" : message.id));
                      }
                    }}
                    className={`patient-message-copy relative max-w-[78%] rounded-2xl px-4 py-3 font-semibold leading-7 shadow-sm outline-none transition focus:ring-2 focus:ring-trust/30 md:max-w-[70%] ${
                      mine ? (failed ? "rounded-br-md bg-rose-500 text-white" : "rounded-br-md bg-trust text-white") : "rounded-bl-md bg-white text-ink"
                    }`}
                  >
                    {visibleMessageText(message)}
                    {numberMismatch || backTranslationStatus === "pending" || backTranslationStatus === "pass" || backTranslationStatus === "fail" ? (
                      <div className={`mt-2 space-y-2 rounded-lg px-2 py-2 text-[11px] font-bold ${mine ? "bg-white/15 text-white" : "bg-amber-50 text-amber-800"}`}>
                        {numberMismatch ? (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            숫자 확인 필요: 원문 {(message.guardFlags?.sourceNumbers ?? []).join(", ")}
                          </div>
                        ) : null}
                        {backTranslationStatus === "pending" ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 size={13} className="animate-spin" />
                            고위험 문장 검증 중
                          </div>
                        ) : null}
                        {backTranslationStatus === "pass" ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            고위험 문장 검증 통과
                          </div>
                        ) : null}
                        {backTranslationStatus === "fail" ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle size={13} />
                              역번역 확인 필요
                            </div>
                            {message.guardFlags?.backTranslation?.backText ? (
                              <p className="rounded-md bg-white/70 px-2 py-1 text-slate-700">환자에게는 이렇게 전달됐을 수 있습니다: {message.guardFlags.backTranslation.backText}</p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void submitTextMessage(message.sourceText ?? visibleMessageText(message));
                                }}
                                className="rounded-md bg-white/80 px-2 py-1 text-slate-700"
                              >
                                다시 번역
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveFeedbackMenuId("");
                                  setFeedbackTarget(message);
                                }}
                                className="rounded-md bg-white/80 px-2 py-1 text-slate-700"
                              >
                                오역 신고
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {confirmationStatus ? <p className={`mt-2 rounded-lg px-2 py-1 text-[11px] font-bold ${mine ? "bg-white/15 text-white" : "bg-amber-50 text-amber-800"}`}>{confirmationStatus === "confirmed" ? "환자 확인 완료" : confirmationStatus === "repeat_requested" ? "환자가 다시 설명 요청" : "환자 확인 대기"}</p> : null}
                    {sentAt || metaText ? (
                      <span className={`mt-1 block text-[11px] font-bold ${mine ? "text-white/80" : "text-slate-400"}`}>
                        {[sentAt, metaText].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {feedbackMenuOpen ? (
                      <div
                        className={`absolute top-full z-20 mt-1 min-w-20 rounded-md border border-slate-200 bg-white py-1 text-xs font-bold text-slate-700 shadow-soft ${
                          mine ? "right-0" : "left-0"
                        }`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFeedbackMenuId("");
                            setFeedbackTarget(message);
                          }}
                          disabled={feedbackSubmittingId === message.id}
                          className="block w-full px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                        >
                          {feedbackSubmittingId === message.id ? "전송 중" : "신고"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center text-center md:min-h-[260px]">
            <div>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-green-100 text-sm font-bold text-mint-text md:h-14 md:w-14 md:text-lg">AI</div>
              <p className="mt-3 text-sm font-bold text-ink md:mt-4 md:text-base">{role === "staff" ? "고객의 메시지가 여기에 표시됩니다." : copy.title}</p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500 md:mt-2 md:text-sm md:leading-6">{role === "staff" ? "고객 응답에 맞춰 안내하세요." : copy.empty}</p>
            </div>
          </div>
        )}
      </section>

      <footer className="shrink-0 border-t border-line bg-white px-2.5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 md:px-4 md:pb-4">
        <div className="mb-2 rounded-2xl bg-slate-50 p-3 text-center md:p-4">
          <div className="relative mx-auto grid h-24 w-24 place-items-center md:h-28 md:w-28">
            <span
              ref={micLevelRingRef}
              className={`pointer-events-none absolute h-20 w-20 rounded-full border-4 transition-transform motion-reduce:transition-none md:h-24 md:w-24 ${
                isSpeaking ? "border-coral/60" : "border-transparent"
              }`}
              aria-hidden="true"
            />
            <button
              type="button"
              disabled={room.status === "ended" || (voiceBusy && !isSpeaking) || (!micEnabled && !isSpeaking) || (staffConfirmationMessage?.guardFlags?.confirmation?.status === "pending" && !isSpeaking)}
              onClick={isSpeaking ? stopVoiceTurn : startVoiceTurn}
              className={`tap-highlight-none grid h-20 w-20 place-items-center rounded-full text-white shadow-soft transition active:scale-[0.98] disabled:bg-slate-300 disabled:opacity-80 motion-reduce:transition-none md:h-24 md:w-24 ${
                isSpeaking ? "bg-coral" : micEnabled ? "bg-ink" : "bg-slate-300"
              }`}
              aria-label={isSpeaking ? activeSpeakingLabel : voiceText.ready}
              aria-describedby={isSpeaking && noVoiceWarning ? "consultation-no-voice-warning" : undefined}
              title={isSpeaking ? activeSpeakingLabel : voiceText.ready}
            >
              {voiceBusy && !isSpeaking ? <Loader2 size={30} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Mic size={34} aria-hidden="true" />}
            </button>
          </div>
          <p className="patient-body-copy mt-2 font-bold text-ink">
            {room.status === "ended" ? (role === "staff" ? "상담 종료" : copy.statusEnded) : isSpeaking ? activeSpeakingLabel : micEnabled ? voiceText.ready : voiceText.waiting}
          </p>
          <p className="patient-helper-copy mt-1 font-semibold leading-6 text-text-muted">{activeHelperText}</p>
          {isSpeaking && noVoiceWarning ? <p id="consultation-no-voice-warning" className="mt-2 text-sm font-bold text-amber-800" role="status" aria-live="polite">{role === "staff" ? "소리가 작거나 들리지 않습니다." : patientNoVoiceCopy[room.patientLanguage]}</p> : null}
          {browserAudioOutputEnabled && lastIncomingMessage ? (
            <button
              type="button"
              onClick={replayLastIncomingMessage}
              className="mx-auto mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-trust-text shadow-sm transition hover:bg-blue-50 md:px-4 md:text-sm"
              aria-label={replayLabel}
              title={replayLabel}
            >
              <Volume2 size={16} />
              {replayLabel}
            </button>
          ) : null}
        </div>

        {role === "staff" && (quickPhraseLoading || quickPhrases.length > 0) ? (
          <div className="mb-2 rounded-lg bg-slate-50 p-2.5 md:p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-600">
                <ClipboardList size={16} className="shrink-0 text-trust-text" />
                <span className="truncate">Quick phrases</span>
              </div>
              <select
                value={quickPhraseStage}
                onChange={(event) => setQuickPhraseStage(event.target.value as QuickPhraseStage | "all")}
                className="h-11 shrink-0 rounded-lg border border-line bg-white px-2 text-xs font-bold text-ink outline-none focus:border-trust"
                aria-label="Quick phrase stage"
              >
                <option value="all">{quickPhraseStageLabels.all}</option>
                {quickPhraseStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {quickPhraseStageLabels[stage]}
                  </option>
                ))}
              </select>
            </div>
            {quickPhraseLoading ? (
              <div className="mt-2 flex h-10 items-center gap-2 text-xs font-bold text-slate-500">
                <Loader2 size={15} className="animate-spin" />
                Loading
              </div>
            ) : (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {visibleQuickPhrases.length ? (
                  visibleQuickPhrases.map((phrase) => (
                    <button
                      key={phrase.id}
                      type="button"
                      onClick={() => sendQuickPhrase(phrase)}
                      disabled={textSubmitting || room.status === "ended"}
                      title={phrase.translatedText ?? phrase.ko}
                      className="min-h-11 max-w-[240px] shrink-0 rounded-lg border border-line bg-white px-3 py-2 text-left text-xs font-bold leading-5 text-ink shadow-sm transition hover:border-trust hover:bg-blue-50 disabled:opacity-50 md:max-w-[320px]"
                    >
                      <span className="line-clamp-2">{phrase.ko}</span>
                    </button>
                  ))
                ) : (
                  <span className="flex h-10 items-center text-xs font-bold text-slate-500">No phrases for this stage.</span>
                )}
              </div>
            )}
          </div>
        ) : null}

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
            className="max-h-24 min-h-11 flex-1 resize-none bg-transparent px-3 py-1.5 text-base font-semibold leading-7 text-ink outline-none disabled:opacity-60 md:max-h-28 md:py-2"
          />
          <button
            type="button"
            onClick={() => void submitTextMessage()}
            disabled={!canSubmitText}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-trust text-white transition hover:bg-blue-600 disabled:opacity-50"
            aria-label={role === "staff" ? "번역 보내기" : copy.submit}
            title={role === "staff" ? "번역 보내기" : copy.submit}
          >
            {textSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
        {feedbackNotice ? <p className="mt-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{feedbackNotice}</p> : null}
        {error ? <p className="mt-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {role === "staff" ? (
          <button
            onClick={() => room.status === "ended" ? void endRoomAndReturn() : setEndDialogOpen(true)}
            disabled={ending}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 md:mt-3 md:h-14 md:text-base"
          >
            {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />}
            {room.status === "ended" ? "직원 화면으로" : "상담 종료 후 직원 화면으로"}
          </button>
        ) : null}
      </footer>

      <EndRoomDialog open={endDialogOpen} ending={ending} error={endError} onCancel={() => { setEndDialogOpen(false); setEndError(""); }} onConfirm={() => void endRoomAndReturn()} onRetry={() => void verifyRoomEnded().then((ended) => { if (ended) void endRoomAndReturn(); else setEndError("방이 아직 열려 있습니다. 네트워크를 확인한 뒤 종료를 다시 시도해주세요."); })} />

      {feedbackTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-trust-text">Translation feedback</p>
                <h2 className="mt-0.5 text-lg font-bold text-ink">번역 신고</h2>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackTarget(null)}
                className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="닫기"
                title="닫기"
              >
                <X size={17} />
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
              환자 이름, 연락처, 주민등록번호 등 개인정보가 포함된 문장은 신고하지 마세요.
            </p>
            <p className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">
              {visibleMessageText(feedbackTarget)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {feedbackReasons.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => void submitFeedback(reason.value)}
                  disabled={Boolean(feedbackSubmittingId)}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-trust px-3 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {feedbackSubmittingId ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                  {reason.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
