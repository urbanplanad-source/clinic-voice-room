"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Loader2, Mic, MessageSquareText, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { languageLabels, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { OpenAIRealtimeClient } from "@/lib/openai-realtime-client";
import { isMicEnabled, type RoomStatus } from "@/lib/room-state";
import {
  broadcastRoomUpdate,
  broadcastTranslationMessage,
  subscribeToRoomUpdates,
  subscribeToTranslationMessages,
  type RealtimeTranslationMessage
} from "@/lib/supabase-realtime";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const PROCEDURE_SEGMENT_MS = 11000;
const PROCEDURE_TRANSLATION_QUIET_MS = 2600;
const PROCEDURE_TRANSLATION_MAX_MS = 18000;

type RoomMode = "consultation" | "procedure";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

const speechLanguageByPatientLanguage: Record<PatientLanguage | "ko", string> = {
  ko: "ko-KR",
  zh: "zh-CN",
  ja: "ja-JP",
  en: "en-US",
  ru: "ru-RU",
  vi: "vi-VN",
  id: "id-ID"
};

type RoomSnapshot = {
  id: string;
  status: RoomStatus;
  patientLanguage: PatientLanguage;
  hospital?: { name: string };
  usageSession?: { totalRoomSeconds: number; roomStartedAt: string; roomEndedAt?: string | null } | null;
};

type TranslationMessage = {
  id: string;
  speaker: ParticipantRole;
  text: string;
};

type VoiceRoomCopy = {
  statusLabels: Record<RoomStatus, string>;
  statusDescriptions: Record<RoomStatus, string>;
  primary: {
    ended: string;
    speaking: string;
    ready: string;
    waiting: string;
  };
  helper: {
    speaking: string;
    idle: string;
  };
  errors: {
    mic: string;
    busy: string;
  };
  transcript: {
    title: string;
    empty: string;
    staff: string;
    patient: string;
  };
  end: string;
  backWarning: {
    title: string;
    body: string;
  };
  connecting: {
    title: string;
    body: string;
    hint: string;
  };
};

const staffCopy: VoiceRoomCopy = {
  statusLabels: {
    waiting_for_patient: "대기",
    ready: "준비됨",
    staff_speaking: "직원 말하는 중",
    translating_to_patient: "번역 중",
    patient_listening: "번역 표시됨",
    patient_speaking: "환자 말하는 중",
    translating_to_staff: "번역 중",
    staff_listening: "번역 표시됨",
    ended: "종료",
    error: "오류"
  },
  statusDescriptions: {
    waiting_for_patient: "환자가 QR로 입장하기를 기다리고 있습니다.",
    ready: "마이크 버튼을 누르고 말해주세요.",
    staff_speaking: "직원이 말하는 중입니다.",
    translating_to_patient: "환자 언어로 번역 중입니다.",
    patient_listening: "환자에게 번역 텍스트가 표시되었습니다.",
    patient_speaking: "환자가 말하는 중입니다.",
    translating_to_staff: "한국어로 번역 중입니다.",
    staff_listening: "번역 텍스트가 표시되었습니다.",
    ended: "통역이 종료되었습니다.",
    error: "연결 오류가 발생했습니다."
  },
  primary: { ended: "세션 종료", speaking: "다시 누르면 종료", ready: "누르고 말씀하세요", waiting: "잠시 기다려주세요" },
  helper: { speaking: "말이 끝나면 버튼을 다시 눌러주세요", idle: "한 번에 한 사람씩 말합니다" },
  errors: { mic: "마이크를 사용할 수 없습니다.", busy: "상대방이 말하는 중입니다. 잠시 후 다시 눌러주세요." },
  transcript: {
    title: "최근 통역",
    empty: "상대방의 통역 결과가 여기에 표시됩니다.",
    staff: "직원 발화 번역",
    patient: "환자 발화 번역"
  },
  end: "통역 종료",
  backWarning: { title: "통역 중에는 이 화면을 유지해주세요.", body: "화면을 벗어나면 통역 연결이 불안정해질 수 있습니다." },
  connecting: {
    title: "실시간 번역 연결 중",
    body: "처음 연결하는 중입니다. 잠시만 기다려주세요.",
    hint: "버튼이 빨간색으로 바뀌면 말씀하시면 됩니다."
  }
};

const patientCopies: Record<PatientLanguage, VoiceRoomCopy> = {
  zh: {
    statusLabels: {
      waiting_for_patient: "等待",
      ready: "准备好了",
      staff_speaking: "工作人员正在讲话",
      translating_to_patient: "正在翻译",
      patient_listening: "已显示翻译",
      patient_speaking: "您正在讲话",
      translating_to_staff: "正在翻译",
      staff_listening: "已显示翻译",
      ended: "已结束",
      error: "错误"
    },
    statusDescriptions: {
      waiting_for_patient: "正在等待翻译室打开。",
      ready: "请点击麦克风并讲话。",
      staff_speaking: "工作人员正在讲话。",
      translating_to_patient: "正在为您翻译。",
      patient_listening: "翻译内容已显示。",
      patient_speaking: "正在听您讲话。",
      translating_to_staff: "正在为工作人员翻译。",
      staff_listening: "翻译内容已显示。",
      ended: "本次翻译已结束。",
      error: "发生连接错误。"
    },
    primary: { ended: "会话已结束", speaking: "再次点击结束", ready: "点击并讲话", waiting: "请稍候" },
    helper: { speaking: "讲完后请再次点击", idle: "请一次一人讲话" },
    errors: { mic: "无法使用麦克风。", busy: "对方正在讲话。请稍后再试。" },
    transcript: { title: "最近翻译", empty: "对方的翻译文本将显示在这里。", staff: "工作人员讲话翻译", patient: "患者讲话翻译" },
    end: "结束翻译",
    backWarning: { title: "翻译过程中请停留在此页面。", body: "如果语音无法继续使用，请让工作人员创建新的房间。" },
    connecting: { title: "正在连接实时翻译", body: "首次连接中，请稍候。", hint: "按钮变红后即可讲话。" }
  },
  ja: {
    statusLabels: {
      waiting_for_patient: "待機中",
      ready: "準備完了",
      staff_speaking: "スタッフが話しています",
      translating_to_patient: "翻訳中",
      patient_listening: "翻訳を表示しました",
      patient_speaking: "あなたが話しています",
      translating_to_staff: "翻訳中",
      staff_listening: "翻訳を表示しました",
      ended: "終了",
      error: "エラー"
    },
    statusDescriptions: {
      waiting_for_patient: "通訳ルームが開くのを待っています。",
      ready: "マイクをタップして話してください。",
      staff_speaking: "スタッフが話しています。",
      translating_to_patient: "あなたの言語に翻訳しています。",
      patient_listening: "翻訳テキストが表示されました。",
      patient_speaking: "あなたの話を聞いています。",
      translating_to_staff: "スタッフ向けに翻訳しています。",
      staff_listening: "翻訳テキストが表示されました。",
      ended: "通訳セッションは終了しました。",
      error: "接続エラーが発生しました。"
    },
    primary: { ended: "セッション終了", speaking: "もう一度タップして終了", ready: "タップして話す", waiting: "少々お待ちください" },
    helper: { speaking: "話し終わったらもう一度タップしてください", idle: "一度に一人ずつ話してください" },
    errors: { mic: "マイクを使用できません。", busy: "相手が話しています。少し待ってからもう一度お試しください。" },
    transcript: { title: "最近の通訳", empty: "相手の通訳テキストがここに表示されます。", staff: "スタッフ発話の翻訳", patient: "患者発話の翻訳" },
    end: "通訳を終了",
    backWarning: { title: "通訳中はこの画面を開いたままにしてください。", body: "音声が使えなくなった場合は、スタッフに新しいルームの作成を依頼してください。" },
    connecting: { title: "リアルタイム翻訳に接続中", body: "初回接続中です。少々お待ちください。", hint: "ボタンが赤くなったら話してください。" }
  },
  en: {
    statusLabels: {
      waiting_for_patient: "Waiting",
      ready: "Ready",
      staff_speaking: "Staff speaking",
      translating_to_patient: "Translating",
      patient_listening: "Text shown",
      patient_speaking: "You are speaking",
      translating_to_staff: "Translating",
      staff_listening: "Text shown",
      ended: "Ended",
      error: "Error"
    },
    statusDescriptions: {
      waiting_for_patient: "Waiting for the room to open.",
      ready: "Tap the microphone and speak.",
      staff_speaking: "The staff is speaking.",
      translating_to_patient: "Translating for you.",
      patient_listening: "The translated text is shown.",
      patient_speaking: "Listening to you.",
      translating_to_staff: "Translating for the staff.",
      staff_listening: "The translated text is shown.",
      ended: "The interpretation session has ended.",
      error: "A connection error occurred."
    },
    primary: { ended: "Session ended", speaking: "Tap again to finish", ready: "Tap and speak", waiting: "Please wait" },
    helper: { speaking: "Tap again when you are done", idle: "Please speak one at a time" },
    errors: { mic: "Microphone is unavailable.", busy: "The other person is speaking. Please try again shortly." },
    transcript: { title: "Recent interpretation", empty: "The other person's interpretation text will appear here.", staff: "Staff speech translation", patient: "Patient speech translation" },
    end: "End interpretation",
    backWarning: { title: "Please stay on this screen during interpretation.", body: "If speaking no longer works, keep this room open and ask the staff to create a new room." },
    connecting: { title: "Connecting realtime interpretation", body: "Connecting for the first time. Please wait a moment.", hint: "Please speak when the button turns red." }
  },
  ru: {
    statusLabels: {
      waiting_for_patient: "Ожидание",
      ready: "Готово",
      staff_speaking: "Сотрудник говорит",
      translating_to_patient: "Перевод",
      patient_listening: "Текст показан",
      patient_speaking: "Вы говорите",
      translating_to_staff: "Перевод",
      staff_listening: "Текст показан",
      ended: "Завершено",
      error: "Ошибка"
    },
    statusDescriptions: {
      waiting_for_patient: "Ожидаем открытия комнаты перевода.",
      ready: "Нажмите на микрофон и говорите.",
      staff_speaking: "Сотрудник говорит.",
      translating_to_patient: "Переводим для вас.",
      patient_listening: "Переведенный текст показан.",
      patient_speaking: "Мы слушаем вас.",
      translating_to_staff: "Переводим для сотрудника.",
      staff_listening: "Переведенный текст показан.",
      ended: "Сеанс перевода завершен.",
      error: "Произошла ошибка соединения."
    },
    primary: { ended: "Сеанс завершен", speaking: "Нажмите еще раз, чтобы закончить", ready: "Нажмите и говорите", waiting: "Пожалуйста, подождите" },
    helper: { speaking: "Когда закончите говорить, нажмите еще раз", idle: "Пожалуйста, говорите по очереди" },
    errors: { mic: "Микрофон недоступен.", busy: "Сейчас говорит другой человек. Повторите чуть позже." },
    transcript: { title: "Последний перевод", empty: "Здесь появится перевод слов собеседника.", staff: "Перевод слов сотрудника", patient: "Перевод слов пациента" },
    end: "Завершить перевод",
    backWarning: { title: "Пожалуйста, оставайтесь на этом экране во время перевода.", body: "Если голос перестал работать, попросите сотрудника создать новую комнату." },
    connecting: { title: "Подключение перевода", body: "Первое подключение. Пожалуйста, подождите.", hint: "Говорите, когда кнопка станет красной." }
  },
  vi: {
    statusLabels: {
      waiting_for_patient: "Đang chờ",
      ready: "Sẵn sàng",
      staff_speaking: "Nhân viên đang nói",
      translating_to_patient: "Đang dịch",
      patient_listening: "Đã hiển thị",
      patient_speaking: "Bạn đang nói",
      translating_to_staff: "Đang dịch",
      staff_listening: "Đã hiển thị",
      ended: "Đã kết thúc",
      error: "Lỗi"
    },
    statusDescriptions: {
      waiting_for_patient: "Đang chờ phòng phiên dịch mở.",
      ready: "Nhấn micro và nói.",
      staff_speaking: "Nhân viên đang nói.",
      translating_to_patient: "Đang dịch cho bạn.",
      patient_listening: "Văn bản dịch đã được hiển thị.",
      patient_speaking: "Đang nghe bạn nói.",
      translating_to_staff: "Đang dịch cho nhân viên.",
      staff_listening: "Văn bản dịch đã được hiển thị.",
      ended: "Phiên phiên dịch đã kết thúc.",
      error: "Đã xảy ra lỗi kết nối."
    },
    primary: { ended: "Phiên đã kết thúc", speaking: "Nhấn lại để kết thúc", ready: "Nhấn và nói", waiting: "Vui lòng chờ" },
    helper: { speaking: "Khi nói xong, vui lòng nhấn lại", idle: "Vui lòng nói từng người một" },
    errors: { mic: "Không thể sử dụng micro.", busy: "Người kia đang nói. Vui lòng thử lại sau." },
    transcript: { title: "Phiên dịch gần đây", empty: "Bản dịch của người kia sẽ hiển thị ở đây.", staff: "Dịch lời nhân viên", patient: "Dịch lời bệnh nhân" },
    end: "Kết thúc phiên dịch",
    backWarning: { title: "Vui lòng ở lại màn hình này trong khi phiên dịch.", body: "Nếu không thể nói tiếp, hãy yêu cầu nhân viên tạo phòng mới." },
    connecting: { title: "Đang kết nối phiên dịch", body: "Đang kết nối lần đầu. Vui lòng chờ một chút.", hint: "Hãy nói khi nút chuyển sang màu đỏ." }
  },
  id: {
    statusLabels: {
      waiting_for_patient: "Menunggu",
      ready: "Siap",
      staff_speaking: "Staf sedang berbicara",
      translating_to_patient: "Menerjemahkan",
      patient_listening: "Teks ditampilkan",
      patient_speaking: "Anda sedang berbicara",
      translating_to_staff: "Menerjemahkan",
      staff_listening: "Teks ditampilkan",
      ended: "Selesai",
      error: "Error"
    },
    statusDescriptions: {
      waiting_for_patient: "Menunggu ruang interpretasi dibuka.",
      ready: "Ketuk mikrofon dan berbicara.",
      staff_speaking: "Staf sedang berbicara.",
      translating_to_patient: "Menerjemahkan untuk Anda.",
      patient_listening: "Teks terjemahan telah ditampilkan.",
      patient_speaking: "Mendengarkan Anda.",
      translating_to_staff: "Menerjemahkan untuk staf.",
      staff_listening: "Teks terjemahan telah ditampilkan.",
      ended: "Sesi interpretasi telah selesai.",
      error: "Terjadi kesalahan koneksi."
    },
    primary: { ended: "Sesi selesai", speaking: "Ketuk lagi untuk selesai", ready: "Ketuk dan bicara", waiting: "Mohon tunggu" },
    helper: { speaking: "Ketuk lagi setelah selesai berbicara", idle: "Mohon berbicara satu per satu" },
    errors: { mic: "Mikrofon tidak tersedia.", busy: "Orang lain sedang berbicara. Coba lagi sebentar lagi." },
    transcript: { title: "Interpretasi terbaru", empty: "Terjemahan dari lawan bicara akan muncul di sini.", staff: "Terjemahan ucapan staf", patient: "Terjemahan ucapan pasien" },
    end: "Akhiri interpretasi",
    backWarning: { title: "Tetap di layar ini selama interpretasi.", body: "Jika suara tidak berfungsi lagi, minta staf membuat ruang baru." },
    connecting: { title: "Menghubungkan interpretasi", body: "Menghubungkan untuk pertama kali. Mohon tunggu sebentar.", hint: "Silakan berbicara saat tombol berubah merah." }
  }
};

const statusTones: Record<RoomStatus, { tone: string; dot: string }> = {
  waiting_for_patient: { tone: "bg-slate-50 text-slate-600", dot: "bg-slate-400" },
  ready: { tone: "bg-emerald-50 text-emerald-700", dot: "bg-mint" },
  staff_speaking: { tone: "bg-blue-50 text-trust", dot: "bg-trust" },
  translating_to_patient: { tone: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  patient_listening: { tone: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  patient_speaking: { tone: "bg-blue-50 text-trust", dot: "bg-trust" },
  translating_to_staff: { tone: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  staff_listening: { tone: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  ended: { tone: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  error: { tone: "bg-rose-50 text-rose-700", dot: "bg-coral" }
};

function copyFor(role: ParticipantRole, patientLanguage: PatientLanguage) {
  return role === "staff" ? staffCopy : patientCopies[patientLanguage];
}

export function VoiceRoom({
  initialRoom,
  role,
  roomToken,
  roomMode = "consultation"
}: {
  initialRoom: RoomSnapshot;
  role: ParticipantRole;
  roomToken?: string;
  roomMode?: RoomMode;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [speakingStartedAt, setSpeakingStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("");
  const [, setTranslationDraft] = useState("");
  const [backWarning, setBackWarning] = useState(false);
  const [audioPlaybackEnabled, setAudioPlaybackEnabled] = useState(false);
  const [procedureActive, setProcedureActive] = useState(false);
  const [procedureBusy, setProcedureBusy] = useState(false);
  const [wakeLockStatus, setWakeLockStatus] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const realtimeClientRef = useRef<OpenAIRealtimeClient | null>(null);
  const realtimePreconnectStartedRef = useRef(false);
  const spokenMessageIdsRef = useRef(new Set<string>());
  const procedureActiveRef = useRef(false);
  const roomRef = useRef(initialRoom);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const aiSpeechQueueRef = useRef(Promise.resolve());
  const pendingUsageSecondsRef = useRef(0);
  const usageFlushTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const cleanupRef = useRef<() => void>(() => undefined);

  const copy = copyFor(role, room.patientLanguage);
  const isProcedureMode = roomMode === "procedure";
  const micEnabled = isMicEnabled(room.status, role);
  const isSpeaking = speakingStartedAt !== null;
  const statusTone = statusTones[room.status];
  const latestMessage = messages[0];
  const olderMessages = messages.slice(1);
  const isConnectingRealtime = busy && !isSpeaking && realtimeStatus.includes("준비");

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const title = useMemo(() => {
    const language = languageLabels[room.patientLanguage];
    if (isProcedureMode) return role === "staff" ? `${language.ko} 시술 통역` : `${language.native} Procedure`;
    return role === "staff" ? `${language.ko} 통역` : `${language.native} Interpretation`;
  }, [isProcedureMode, role, room.patientLanguage]);

  const transition = useCallback(async (status: RoomStatus) => {
    const response = await fetch(`/api/rooms/${room.id}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, status, roomToken })
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      roomRef.current = data.room;
      setRoom(data.room);
      void broadcastRoomUpdate(data.room);
      return true;
    }
    if (data?.room) {
      roomRef.current = data.room;
      setRoom(data.room);
      void broadcastRoomUpdate(data.room);
    }
    return false;
  }, [role, room.id, roomToken]);

  const ensureRealtimeSession = useCallback(async (stream: MediaStream) => {
    if (!realtimeClientRef.current) {
      realtimeClientRef.current = new OpenAIRealtimeClient({
        roomId: room.id,
        role,
        roomToken
      }, {
        onStatus: setRealtimeStatus,
        onTranscriptDelta: setTranslationDraft,
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
  }, [role, room.id, roomToken]);

  const appendMessage = useCallback((message: RealtimeTranslationMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [message, ...current].slice(0, 3);
    });
  }, []);

  const speakWithBrowserTts = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = role === "staff" ? speechLanguageByPatientLanguage.ko : speechLanguageByPatientLanguage[room.patientLanguage];
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [role, room.patientLanguage]);

  const stopPlayback = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    audioElementRef.current?.pause();
    audioElementRef.current = null;
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  }, []);

  const playAiTranslatedSpeech = useCallback(async (message: TranslationMessage) => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        role,
        roomToken,
        patientLanguage: room.patientLanguage,
        text: message.text
      })
    });

    if (!response.ok) throw new Error("AI translated speech could not be created.");

    const audioBlob = await response.blob();
    stopPlayback();
    const url = URL.createObjectURL(audioBlob);
    audioObjectUrlRef.current = url;
    const audio = new Audio(url);
    audioElementRef.current = audio;
    audio.volume = 1;
    await audio.play();
    await new Promise<void>((resolve) => {
      const finish = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.onpause = finish;
    });
  }, [role, room.id, room.patientLanguage, roomToken, stopPlayback]);

  const flushUsage = useCallback(async () => {
    const durationSeconds = pendingUsageSecondsRef.current;
    if (!durationSeconds) return;
    pendingUsageSecondsRef.current = 0;
    if (usageFlushTimerRef.current) {
      window.clearTimeout(usageFlushTimerRef.current);
      usageFlushTimerRef.current = null;
    }

    await fetch("/api/usage/speaking-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, role, durationSeconds, roomToken })
    }).catch(() => {
      pendingUsageSecondsRef.current += durationSeconds;
    });
  }, [role, room.id, roomToken]);

  const endRoom = useCallback(async () => {
    procedureActiveRef.current = false;
    setProcedureActive(false);
    setBusy(true);
    await flushUsage();
    await releaseScreenWakeLock();
    stopPlayback();
    const response = await fetch(`/api/rooms/${room.id}/end`, { method: "POST" });
    setBusy(false);
    realtimeClientRef.current?.close();
    realtimeClientRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (response.ok) {
      const data = await response.json();
      setRoom((current) => ({ ...current, ...data.room }));
      void broadcastRoomUpdate(data.room);
    }
  }, [flushUsage, room.id, stopPlayback]);

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
      }
      markActivity();
    }) ?? undefined;
  }, [appendMessage, markActivity, role, room.id]);

  useEffect(() => {
    cleanupRef.current = () => {
      procedureActiveRef.current = false;
      void flushUsage();
      void releaseScreenWakeLock();
      stopPlayback();
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [flushUsage, stopPlayback]);

  useEffect(() => {
    markActivity();
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [markActivity]);

  useEffect(() => {
    return () => cleanupRef.current();
  }, []);

  useEffect(() => {
    if (!audioPlaybackEnabled || !latestMessage || spokenMessageIdsRef.current.has(latestMessage.id)) return;

    spokenMessageIdsRef.current.add(latestMessage.id);
    if (isProcedureMode) {
      aiSpeechQueueRef.current = aiSpeechQueueRef.current
        .catch(() => undefined)
        .then(() => playAiTranslatedSpeech(latestMessage))
        .catch(() => speakWithBrowserTts(latestMessage.text));
      return;
    }

    speakWithBrowserTts(latestMessage.text);
  }, [audioPlaybackEnabled, isProcedureMode, latestMessage, playAiTranslatedSpeech, role, speakWithBrowserTts]);

  useEffect(() => {
    if (!isProcedureMode) return;
    setAudioPlaybackEnabled(true);
    if (role === "patient") void requestScreenWakeLock();
    return () => {
      if (role === "patient") void releaseScreenWakeLock();
      stopPlayback();
    };
  }, [isProcedureMode, role, stopPlayback]);

  useEffect(() => {
    const shouldKeepAwake = (isProcedureMode && role === "patient") || procedureActive;
    if (!shouldKeepAwake) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void requestScreenWakeLock();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isProcedureMode, procedureActive, role]);

  useEffect(() => {
    if (role !== "patient" || room.status === "ended") return;

    window.history.pushState({ clinicVoiceRoom: true }, "", window.location.href);
    const handleBack = () => {
      window.history.pushState({ clinicVoiceRoom: true }, "", window.location.href);
      setBackWarning(true);
    };

    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [role, room.status]);

  useEffect(() => {
    if (room.status !== "ready" || realtimePreconnectStartedRef.current || realtimeClientRef.current || !streamRef.current) return;
    realtimePreconnectStartedRef.current = true;
    void ensureRealtimeSession(streamRef.current).catch(() => {
      realtimePreconnectStartedRef.current = false;
    });
  }, [ensureRealtimeSession, room.status]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response =
        role === "staff"
          ? await fetch(`/api/rooms/${room.id}`, { cache: "no-store" })
          : await fetch(`/api/rooms/by-token/${roomToken}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setRoom((current) => ({ ...current, ...data.room }));
    }, 5000);

    return () => window.clearInterval(interval);
  }, [role, room.id, roomToken]);

  async function ensureMicStream() {
    const currentStream = streamRef.current;
    if (currentStream?.active && currentStream.getAudioTracks().some((track) => track.readyState === "live")) {
      return currentStream;
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

  function queueUsage(durationSeconds: number) {
    pendingUsageSecondsRef.current += durationSeconds;
    if (usageFlushTimerRef.current) return;
    usageFlushTimerRef.current = window.setTimeout(() => {
      usageFlushTimerRef.current = null;
      void flushUsage();
    }, 3000);
  }

  function toggleAudioPlayback() {
    if (!audioPlaybackEnabled && latestMessage) {
      spokenMessageIdsRef.current.add(latestMessage.id);
    }
    if (audioPlaybackEnabled) stopPlayback();
    setAudioPlaybackEnabled((current) => !current);
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  async function requestScreenWakeLock() {
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock || wakeLockRef.current) return;

    try {
      const sentinel = await wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setWakeLockStatus("화면 켜짐 유지 중");
      sentinel.addEventListener("release", () => {
        wakeLockRef.current = null;
        setWakeLockStatus("");
      });
    } catch {
      setWakeLockStatus("화면 자동 꺼짐 설정을 확인해주세요");
    }
  }

  async function releaseScreenWakeLock() {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (!sentinel) return;
    await sentinel.release().catch(() => undefined);
    setWakeLockStatus("");
  }

  async function runProcedureLoop(stream: MediaStream, realtimeClient: OpenAIRealtimeClient) {
    while (procedureActiveRef.current) {
      if (roomRef.current.status !== "ready") {
        setRealtimeStatus("시술 모드 대기 중");
        await sleep(700);
        continue;
      }

      const acquiredTurn = await transition("staff_speaking");
      if (!acquiredTurn) {
        setRealtimeStatus("시술 모드 대기 중");
        await sleep(1000);
        continue;
      }

      setError("");
      const startedAt = Date.now();
      realtimeClient.startTurn();
      setMicEnabled(true);
      setRealtimeStatus("시술 모드 청취 중");
      await sleep(PROCEDURE_SEGMENT_MS);
      setMicEnabled(false);
      queueUsage(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));

      if (!procedureActiveRef.current) {
        await transition("ready");
        break;
      }

      void transition("translating_to_patient");
      try {
        const translatedText = await realtimeClient.stopTurnAndTranslate({
          quietMs: PROCEDURE_TRANSLATION_QUIET_MS,
          maxMs: PROCEDURE_TRANSLATION_MAX_MS
        });

        if (translatedText) {
          const message = {
            id: `staff-procedure-${Date.now()}`,
            speaker: "staff",
            text: translatedText
          } satisfies RealtimeTranslationMessage;
          void broadcastTranslationMessage(room.id, message);
        }
      } catch {
        setRealtimeStatus("시술 모드 계속 청취 중");
      } finally {
        if (stream.active && procedureActiveRef.current) {
          const readyRoom = { ...room, status: "ready" as const };
          roomRef.current = readyRoom;
          setRoom(readyRoom);
          void broadcastRoomUpdate(readyRoom);
          void transition("ready");
        }
      }

      await sleep(300);
    }
  }

  async function startProcedureMode() {
    if (role !== "staff" || procedureActiveRef.current) return;
    setError("");
    setProcedureBusy(true);
    setTranslationDraft("");

    try {
      const stream = await ensureMicStream();
      const realtimeClient = await ensureRealtimeSession(stream);
      await requestScreenWakeLock();
      procedureActiveRef.current = true;
      setProcedureActive(true);
      setAudioPlaybackEnabled(true);
      void runProcedureLoop(stream, realtimeClient);
    } catch (caught) {
      procedureActiveRef.current = false;
      setProcedureActive(false);
      setMicEnabled(false);
      setError(caught instanceof Error ? caught.message : copy.errors.mic);
    } finally {
      setProcedureBusy(false);
    }
  }

  async function stopProcedureMode() {
    procedureActiveRef.current = false;
    setProcedureActive(false);
    setProcedureBusy(true);
    setMicEnabled(false);
    setRealtimeStatus("시술 모드 종료 중");
    await transition("ready");
    await flushUsage();
    await releaseScreenWakeLock();
    setRealtimeStatus("시술 모드 종료됨");
    setProcedureBusy(false);
  }

  async function startSpeaking() {
    setError("");
    setTranslationDraft("");
    markActivity();
    setBusy(true);
    try {
      if (isProcedureMode && role === "patient") stopPlayback();
      const nextStatus = role === "staff" ? "staff_speaking" : "patient_speaking";
      const acquiredTurn = await transition(nextStatus);
      if (!acquiredTurn) {
        setError(copy.errors.busy);
        return;
      }

      const stream = await ensureMicStream();
      const realtimeClient = await ensureRealtimeSession(stream);
      realtimeClient.startTurn();
      setMicEnabled(true);
      setSpeakingStartedAt(Date.now());
    } catch (caught) {
      setSpeakingStartedAt(null);
      setError(caught instanceof Error ? caught.message : copy.errors.mic);
      setMicEnabled(false);
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      realtimePreconnectStartedRef.current = false;
      await transition("ready");
    } finally {
      setBusy(false);
    }
  }

  async function stopSpeaking() {
    if (!speakingStartedAt) return;
    markActivity();
    setBusy(true);
    const durationSeconds = Math.max(1, Math.round((Date.now() - speakingStartedAt) / 1000));
    setSpeakingStartedAt(null);
    setMicEnabled(false);
    queueUsage(durationSeconds);

    const translatingStatus = role === "staff" ? "translating_to_patient" : "translating_to_staff";
    const readyRoom = { ...room, status: "ready" as const };

    try {
      void transition(translatingStatus);
      const translatedText = await realtimeClientRef.current?.stopTurnAndTranslate();
      if (!translatedText) throw new Error("No translated text was returned.");

      const message = {
        id: `${role}-${Date.now()}`,
        speaker: role,
        text: translatedText
      } satisfies RealtimeTranslationMessage;

      void broadcastTranslationMessage(room.id, message);
      setTranslationDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Translation failed.");
    } finally {
      setRoom(readyRoom);
      void broadcastRoomUpdate(readyRoom);
      await transition("ready");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {backWarning ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-bold text-amber-800">{copy.backWarning.title}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-700">{copy.backWarning.body}</p>
          <button
            type="button"
            onClick={() => setBackWarning(false)}
            className="mt-3 h-10 rounded-lg bg-white px-4 text-sm font-bold text-amber-800 shadow-sm"
          >
            OK
          </button>
        </section>
      ) : null}

      <header className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-trust">{room.hospital?.name ?? "Clinic Voice Room"}</p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight text-ink">{title}</h1>
          </div>
          {!isProcedureMode ? (
            <span className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${statusTone.tone}`}>
              <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
              {copy.statusLabels[room.status]}
            </span>
          ) : null}
        </div>
        {!isProcedureMode ? (
          <div className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold leading-6 text-slate-700">
            <Volume2 size={18} className="mt-0.5 shrink-0 text-trust" />
            {copy.statusDescriptions[room.status]}
          </div>
        ) : null}
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        {!isProcedureMode ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquareText size={19} className="text-trust" />
              <h2 className="text-base font-bold text-ink">{copy.transcript.title}</h2>
            </div>
            <button
              type="button"
              onClick={toggleAudioPlayback}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition ${
                audioPlaybackEnabled ? "border-blue-100 bg-blue-50 text-trust" : "border-line bg-white text-slate-500"
              }`}
              aria-label={audioPlaybackEnabled ? "번역 음성 읽기 끄기" : "번역 음성 읽기 켜기"}
              title={audioPlaybackEnabled ? "번역 음성 읽기 끄기" : "번역 음성 읽기 켜기"}
            >
              {audioPlaybackEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        ) : null}

        <div className={isProcedureMode ? "" : "mt-4"}>
          {isConnectingRealtime ? (
            <article className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-xs font-bold text-trust">{copy.connecting.title}</p>
              <p className="mt-2 text-lg font-bold leading-7 text-ink">{copy.connecting.body}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{copy.connecting.hint}</p>
            </article>
          ) : null}

          {latestMessage ? (
            <article className="rounded-lg bg-blue-50 px-4 py-5">
              {!isProcedureMode ? (
                <p className="text-xs font-bold text-trust">
                  {latestMessage.speaker === "staff" ? copy.transcript.staff : copy.transcript.patient}
                </p>
              ) : null}
              <p className={`${isProcedureMode ? "text-2xl" : "mt-2 text-xl"} font-bold leading-8 text-ink`}>{latestMessage.text}</p>
            </article>
          ) : (
            <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
              {isProcedureMode ? "번역 내용이 여기에 표시됩니다." : copy.transcript.empty}
            </p>
          )}

          {!isProcedureMode && olderMessages.length ? (
            <div className="mt-3 space-y-2">
              {olderMessages.map((message) => (
                <article key={message.id} className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold text-slate-500">{message.speaker === "staff" ? copy.transcript.staff : copy.transcript.patient}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{message.text}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {isProcedureMode ? (
        <section className="rounded-lg bg-white p-5 text-center shadow-soft">
          {role === "staff" ? (
            <>
              <h2 className="text-xl font-bold text-ink">시술 모드</h2>
              <button
                type="button"
                disabled={room.status === "ended" || procedureBusy}
                onClick={procedureActive ? stopProcedureMode : startProcedureMode}
                className={`mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-lg px-4 text-lg font-bold text-white transition disabled:opacity-50 ${
                  procedureActive ? "bg-coral hover:bg-rose-600" : "bg-ink hover:bg-slate-700"
                }`}
              >
                {procedureBusy ? <Loader2 size={22} className="animate-spin" /> : <Headphones size={22} />}
                {procedureActive ? "중지" : "시작"}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-ink">{isSpeaking ? "말하는 중" : "필요할 때 말씀하세요"}</h2>
              <button
                type="button"
                disabled={room.status === "ended" || (busy && !isSpeaking) || (!micEnabled && !isSpeaking)}
                onClick={isSpeaking ? stopSpeaking : startSpeaking}
                className={`mt-4 flex h-20 w-full items-center justify-center gap-2 rounded-lg px-4 text-xl font-bold text-white transition disabled:bg-slate-300 disabled:opacity-80 ${
                  isSpeaking ? "bg-coral hover:bg-rose-600" : "bg-ink hover:bg-slate-700"
                }`}
              >
                {busy && !isSpeaking ? <Loader2 size={22} className="animate-spin" /> : <Mic size={22} />}
                {isSpeaking ? "끝" : micEnabled ? "말하기" : "대기"}
              </button>
            </>
          )}
          {!isProcedureMode && wakeLockStatus ? <p className="mt-3 text-xs font-bold text-trust">{wakeLockStatus}</p> : null}
          {!isProcedureMode && realtimeStatus ? <p className="mt-2 text-xs font-bold text-trust">{realtimeStatus}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </section>
      ) : (
        <section className="rounded-lg bg-white p-5 text-center shadow-soft">
          <button
            type="button"
            disabled={room.status === "ended" || (busy && !isSpeaking) || (!micEnabled && !isSpeaking)}
            onClick={isSpeaking ? stopSpeaking : startSpeaking}
            className={`tap-highlight-none mx-auto grid h-40 w-40 place-items-center rounded-full text-white shadow-soft transition active:scale-[0.98] ${
              isSpeaking ? "bg-coral" : micEnabled ? "bg-trust" : "bg-slate-300"
            }`}
            aria-label={isSpeaking ? copy.primary.speaking : copy.primary.ready}
          >
            {busy && !isSpeaking ? <Loader2 size={44} className="animate-spin" /> : <Mic size={52} />}
          </button>
          <p className="mt-4 text-xl font-bold text-ink">
            {room.status === "ended" ? copy.primary.ended : isSpeaking ? copy.primary.speaking : micEnabled ? copy.primary.ready : copy.primary.waiting}
          </p>
          {realtimeStatus ? <p className="mt-2 text-xs font-bold text-trust">{realtimeStatus}</p> : null}
          <p className="mt-2 text-sm font-semibold text-slate-500">{isSpeaking ? copy.helper.speaking : copy.helper.idle}</p>
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </section>
      )}

      {role === "staff" ? (
        <button
          onClick={endRoom}
          disabled={busy || room.status === "ended"}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 font-bold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
        >
          <PhoneOff size={19} />
          {copy.end}
        </button>
      ) : null}
    </div>
  );
}
